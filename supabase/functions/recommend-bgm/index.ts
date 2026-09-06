import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

export type BgmCategory = "upbeat_pop" | "lofi_chill" | "acoustic_indie" | "energy_hiphop";

export interface BgmRecommendation {
  category: BgmCategory;
  templateId: string;
  label: string;
  description: string;
  bpm: number;
  reason: string;
  highlightStartSec: number;
  highlightDurationSec: number;
  energyCurve: number[];
}

interface CategoryMeta {
  templateId: string;
  label: string;
  description: string;
  bpm: number;
  defaultHighlightStart: number;
  defaultHighlightDuration: number;
  energyCurve: number[];
}

const CATEGORY_META: Record<BgmCategory, CategoryMeta> = {
  upbeat_pop: {
    templateId: "upbeat_pop",
    label: "트렌디 업비트 팝",
    description: "틱톡 및 릴스에서 가장 인기 있는 경쾌한 리듬의 보컬/악기 믹스",
    bpm: 128,
    defaultHighlightStart: 7,
    defaultHighlightDuration: 8,
    energyCurve: [0.3, 0.5, 0.7, 0.85, 1.0, 0.95, 0.9, 0.85, 0.8, 0.75, 0.7, 0.65, 0.6, 0.55, 0.5],
  },
  lofi_chill: {
    templateId: "lofi_chill",
    label: "감성 로파이 비트",
    description: "카페, 베이커리, 소품샵에 어울리는 감성적인 재즈/힙합 비트",
    bpm: 85,
    defaultHighlightStart: 5,
    defaultHighlightDuration: 10,
    energyCurve: [0.2, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.6, 0.58, 0.55, 0.5, 0.45, 0.4, 0.35],
  },
  acoustic_indie: {
    templateId: "acoustic_indie",
    label: "어쿠스틱 인디 기타",
    description: "수제 디저트나 자연 친화적 상품에 어울리는 따뜻한 어쿠스틱 기타 선율",
    bpm: 95,
    defaultHighlightStart: 6,
    defaultHighlightDuration: 9,
    energyCurve: [0.15, 0.25, 0.35, 0.45, 0.55, 0.65, 0.7, 0.72, 0.7, 0.65, 0.6, 0.55, 0.5, 0.45, 0.4],
  },
  energy_hiphop: {
    templateId: "energy_hiphop",
    label: "다이나믹 힙합 비트",
    description: "의류, 신제품 런칭 등 강렬한 후킹이 필요할 때 시선을 사로잡는 비트",
    bpm: 140,
    defaultHighlightStart: 3,
    defaultHighlightDuration: 7,
    energyCurve: [0.4, 0.6, 0.8, 1.0, 1.0, 0.95, 0.9, 0.85, 0.8, 0.75, 0.7, 0.65, 0.6, 0.55, 0.5],
  },
};

function stripJsonFence(s: string): string {
  let t = s.trim();
  if (t.startsWith("```")) {
    t = t.replace(/^```[a-zA-Z]*\n?/, "").replace(/```$/, "").trim();
  }
  return t;
}

function ensureDataUrl(dataUrl: string, mimeType: string): string {
  if (dataUrl.startsWith("data:")) return dataUrl;
  return `data:${mimeType};base64,${dataUrl}`;
}

async function resolveOpenAIKey(): Promise<string | null> {
  const serverKey = Deno.env.get("OPENAI_API_KEY");
  if (serverKey) return serverKey;

  if (supabaseUrl && serviceRoleKey) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const resp = await fetch(
        `${supabaseUrl}/rest/v1/user_settings?select=openai_api_key&order=created_at.desc&limit=1`,
        {
          headers: {
            apikey: serviceRoleKey,
            Authorization: `Bearer ${serviceRoleKey}`,
          },
          signal: controller.signal,
        },
      );
      clearTimeout(timeoutId);
      if (resp.ok) {
        const rows = await resp.json() as Array<{ openai_api_key: string | null }>;
        const dbKey = rows[0]?.openai_api_key;
        if (dbKey) return dbKey;
      }
    } catch {
      // no fallback beyond env
    }
  }
  return null;
}

function fallbackRecommendation(): BgmRecommendation {
  const c = CATEGORY_META.upbeat_pop;
  return {
    category: "upbeat_pop",
    templateId: c.templateId,
    label: c.label,
    description: c.description,
    bpm: c.bpm,
    reason: "이미지 분석 없이 트렌디 업비트 팝을 기본 추천했습니다.",
    highlightStartSec: c.defaultHighlightStart,
    highlightDurationSec: c.defaultHighlightDuration,
    energyCurve: c.energyCurve,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const { imageDataUrl, mimeType } = body;

    if (!imageDataUrl) {
      return new Response(
        JSON.stringify({ error: "Image data is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const cleanMime = mimeType || "image/jpeg";
    const openaiKey = await resolveOpenAIKey();

    if (!openaiKey) {
      return new Response(
        JSON.stringify(fallbackRecommendation()),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const sanitizedDataUrl = ensureDataUrl(imageDataUrl, cleanMime);

    const systemPrompt =
      "You are a music supervisor for short-form marketing videos (15 seconds).\n" +
      "Analyze the product/scene in the image and recommend the most fitting BGM track category.\n\n" +
      "Choose exactly ONE category from these options:\n" +
      "- \"upbeat_pop\": Trendy upbeat pop — light, catchy vocal/instrumental mix. Best for TikTok/Reels trending content, general product showcases, lifestyle products.\n" +
      "- \"lofi_chill\": Emotional lofi beats — jazzy/hiphop instrumental. Best for cafes, bakeries, small shops, cozy atmosphere, daily essentials.\n" +
      "- \"acoustic_indie\": Warm acoustic indie guitar — gentle string melodies. Best for handmade desserts, natural/eco-friendly products, warm storytelling.\n" +
      "- \"energy_hiphop\": Dynamic hiphop beats — hard-hitting rhythm. Best for fashion/clothing, new product launches, bold hooks, high-energy content.\n\n" +
      "ALSO identify the highlight segment — the most impactful part of the track for a 15-second video:\n" +
      "- highlightStartSec: when the highlight should begin (0-12, integer)\n" +
      "- highlightDurationSec: how long the highlight lasts (3-10, integer)\n" +
      "  The highlight should align with the video's hook moment (typically 3-7 seconds in).\n\n" +
      "Return a JSON object with exactly these fields:\n" +
      "- category: one of \"upbeat_pop\", \"lofi_chill\", \"acoustic_indie\", \"energy_hiphop\"\n" +
      "- reason: 1-2 sentence explanation in Korean of why this track fits the image content\n" +
      "- highlightStartSec: integer (0-12)\n" +
      "- highlightDurationSec: integer (3-10)";

    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: "이 이미지에 가장 어울리는 음악 트랙 카테고리와 핵심 구간을 추천해주세요." },
              { type: "image_url", image_url: { url: sanitizedDataUrl } },
            ],
          },
        ],
        max_tokens: 300,
        temperature: 0.3,
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => "");
      console.error("OpenAI BGM recommendation failed:", resp.status, errText);
      return new Response(
        JSON.stringify(fallbackRecommendation()),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data = await resp.json();
    const content = data.choices?.[0]?.message?.content ?? "";
    const parsed = JSON.parse(stripJsonFence(content));

    const validCategories: BgmCategory[] = ["upbeat_pop", "lofi_chill", "acoustic_indie", "energy_hiphop"];
    const category = validCategories.includes(parsed.category) ? parsed.category : "upbeat_pop";
    const meta = CATEGORY_META[category];

    const highlightStartSec = Math.max(0, Math.min(12, Math.round(parsed.highlightStartSec ?? meta.defaultHighlightStart)));
    const highlightDurationSec = Math.max(3, Math.min(10, Math.round(parsed.highlightDurationSec ?? meta.defaultHighlightDuration)));
    const reason = typeof parsed.reason === "string" ? parsed.reason : "AI 분석 기반 추천입니다.";

    const recommendation: BgmRecommendation = {
      category,
      templateId: meta.templateId,
      label: meta.label,
      description: meta.description,
      bpm: meta.bpm,
      reason,
      highlightStartSec,
      highlightDurationSec,
      energyCurve: meta.energyCurve,
    };

    return new Response(
      JSON.stringify(recommendation),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("recommend-bgm error:", err);
    return new Response(
      JSON.stringify(fallbackRecommendation()),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
