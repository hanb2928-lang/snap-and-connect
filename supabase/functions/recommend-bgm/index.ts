import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

type BgmMood = "urgent" | "warm" | "snappy" | "neutral";

interface BgmRecommendation {
  mood: BgmMood;
  templateId: string;
  label: string;
  moodDescription: string;
  bpm: number;
  reason: string;
}

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

const MOOD_TO_TEMPLATE: Record<BgmMood, Omit<BgmRecommendation, "reason" | "mood">> = {
  urgent: { templateId: "urgent_upbeat", label: "업비트 긴장감", moodDescription: "긴박·액션", bpm: 130 },
  warm: { templateId: "warm_acoustic", label: "따뜻한 어쿠스틱", moodDescription: "감성·일상", bpm: 80 },
  snappy: { templateId: "snappy_pop", label: "스내피 팝", moodDescription: "경쾌·정보", bpm: 110 },
  neutral: { templateId: "trendy_neutral", label: "트렌디 중간 템포", moodDescription: "범용·무드", bpm: 100 },
};

function fallbackRecommendation(): BgmRecommendation {
  const base = MOOD_TO_TEMPLATE.neutral;
  return { ...base, mood: "neutral", reason: "이미지 분석 없이 범용 BGM을 추천했습니다." };
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
      "You are a music supervisor for short-form marketing videos. " +
      "Analyze the product/scene in the image and recommend the most fitting BGM mood.\n" +
      "Choose exactly ONE mood from these options:\n" +
      "- \"urgent\": High-energy, creates urgency/FOMO. Best for sales, discounts, limited stock, breaking news.\n" +
      "- \"warm\": Soft, emotional, cozy. Best for lifestyle, daily essentials, food, family, healing products.\n" +
      "- \"snappy\": Upbeat, catchy, information-driven. Best for tips, tutorials, product demos, comparisons.\n" +
      "- \"neutral\": Versatile mid-tempo. Best when the scene doesn't fit a strong mood.\n" +
      "Return a JSON object with exactly these fields:\n" +
      "- mood: one of \"urgent\", \"warm\", \"snappy\", \"neutral\"\n" +
      "- reason: 1-2 sentence explanation in Korean of why this BGM mood fits the image content";

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
              { type: "text", text: "이 이미지에 가장 어울리는 BGM 무드를 추천해주세요." },
              { type: "image_url", image_url: { url: sanitizedDataUrl } },
            ],
          },
        ],
        max_tokens: 200,
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

    const validMoods: BgmMood[] = ["urgent", "warm", "snappy", "neutral"];
    const mood = validMoods.includes(parsed.mood) ? parsed.mood : "neutral";
    const base = MOOD_TO_TEMPLATE[mood];
    const reason = typeof parsed.reason === "string" ? parsed.reason : "AI 분석 기반 추천입니다.";

    const recommendation: BgmRecommendation = {
      mood,
      templateId: base.templateId,
      label: base.label,
      moodDescription: base.moodDescription,
      bpm: base.bpm,
      reason,
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
