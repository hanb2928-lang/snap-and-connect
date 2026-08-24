import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface StyleRecommendation {
  cardStyle: "bold" | "magazine" | "feed" | "minimal";
  musicMood: "upbeat" | "calm" | "emotional" | "none";
  motionPreset: "kenburns" | "zoom-in" | "zoom-out" | "slide-in" | "slow-motion";
  format: "vertical" | "horizontal";
  duration: number;
  hybridMode: "off" | "photo-to-comic";
  reason: string;
  alternatives: { label: string; cardStyle: string; reason: string }[];
}

const VALID_CARD_STYLES = new Set(["bold", "magazine", "feed", "minimal"]);
const VALID_MUSIC = new Set(["upbeat", "calm", "emotional", "none"]);
const VALID_MOTION = new Set(["kenburns", "zoom-in", "zoom-out", "slide-in", "slow-motion"]);
const VALID_FORMAT = new Set(["vertical", "horizontal"]);
const VALID_HYBRID = new Set(["off", "photo-to-comic"]);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { productName, productCategory, accentColor, hook, oneLiner, platform } = body;

    if (!productName && !productCategory) {
      return new Response(
        JSON.stringify({ error: "Product name or category is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const openaiKey = await resolveOpenAIKey();
    let recommendation: StyleRecommendation;

    if (openaiKey) {
      try {
        recommendation = await recommendWithOpenAI(
          String(productName || ""),
          String(productCategory || "product"),
          String(accentColor || "#2f9dff"),
          String(hook || ""),
          String(oneLiner || ""),
          String(platform || "shortform"),
          openaiKey,
        );
      } catch {
        recommendation = fallbackRecommendation(String(productCategory || "product"), String(platform || "shortform"));
      }
    } else {
      recommendation = fallbackRecommendation(String(productCategory || "product"), String(platform || "shortform"));
    }

    return new Response(
      JSON.stringify(recommendation),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Recommendation failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

async function resolveOpenAIKey(): Promise<string | null> {
  const serverKey = Deno.env.get("OPENAI_API_KEY");
  if (serverKey) return serverKey;

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (supabaseUrl && serviceRoleKey) {
    try {
      // Row id=1 is the shared/global OpenAI key for this project. All users
      // share this key when no per-user key is configured via environment.
      const resp = await fetch(`${supabaseUrl}/rest/v1/user_settings?select=openai_api_key&id=eq.1`, {
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
        },
      });
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

async function recommendWithOpenAI(
  productName: string,
  productCategory: string,
  accentColor: string,
  hook: string,
  oneLiner: string,
  platform: string,
  apiKey: string,
): Promise<StyleRecommendation> {
  const systemPrompt =
    "You are a short-form video marketing director who picks the best visual template, music mood, camera motion, aspect ratio, and duration for product clips.\n" +
    "Based on the product info, recommend the SINGLE best combination and explain WHY in Korean (1-2 sentences, practical and specific to this product).\n" +
    "Also provide 2 alternative styles with a brief Korean reason each.\n\n" +
    "Return JSON with these exact fields:\n" +
    "- cardStyle: one of \"bold\" (big text, punchy colors — for Reels/Shorts/TikTok), \"magazine\" (elegant layout — for Naver Blog), \"feed\" (square, review-focused — for Instagram), \"minimal\" (clean whitespace — for X/Threads)\n" +
    "- musicMood: one of \"upbeat\" (energetic, fast tempo), \"calm\" (relaxed, steady), \"emotional\" (sentimental, slow), \"none\"\n" +
    "- motionPreset: one of \"kenburns\" (smooth zoom + pan), \"zoom-in\" (fast zoom to grab attention), \"zoom-out\" (reveal whole product), \"slide-in\" (slide from left), \"slow-motion\" (slow zoom + fade for emotional feel)\n" +
    "- format: \"vertical\" (9:16 for Reels/Shorts/Stories) or \"horizontal\" (16:9 for Blog/X)\n" +
    "- duration: integer in milliseconds (8000-20000). Shorter for punchy products, longer for detailed storytelling.\n" +
    "- hybridMode: \"off\" or \"photo-to-comic\" (photo hook then comic transition — use for fun/trendy products)\n" +
    "- reason: Korean explanation of why this combination is best for THIS product (1-2 sentences)\n" +
    "- alternatives: array of 2 objects, each with { label (Korean style name), cardStyle (one of the 4 values), reason (Korean, 1 sentence why) }\n\n" +
    "Guidelines:\n" +
    "- Fashion/beauty/cosmetics → lean toward emotional or calm music, slow-motion or kenburns, feed or bold style\n" +
    "- Food/beverage → upbeat music, zoom-in motion, bold style, shorter duration (10-12s)\n" +
    "- Tech/electronics → upbeat or calm, zoom-in or kenburns, bold or minimal\n" +
    "- Home/furniture/interior → calm music, kenburns or zoom-out, magazine style\n" +
    "- Kids/toys/fun items → upbeat, photo-to-comic hybrid, bold style\n" +
    "- Luxury/premium items → calm or emotional, slow-motion, magazine or minimal\n" +
    "- Adjust format for the target platform if provided.\n" +
    "Return ONLY valid JSON, no markdown.";

  const userText = [
    `상품명: ${productName || "알 수 없음"}`,
    `카테고리: ${productCategory}`,
    `액센트 컬러: ${accentColor}`,
    hook ? `훅: ${hook}` : "",
    oneLiner ? `원라이너: ${oneLiner}` : "",
    `타겟 플랫폼: ${platform}`,
  ].filter(Boolean).join("\n");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userText },
        ],
        max_tokens: 800,
        temperature: 0.6,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${errText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("No content from OpenAI");

    const parsed = JSON.parse(content);
    return normalizeRecommendation(parsed, productCategory, platform);
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeRecommendation(
  raw: Record<string, unknown>,
  category: string,
  platform: string,
): StyleRecommendation {
  const cardStyle = VALID_CARD_STYLES.has(String(raw.cardStyle))
    ? String(raw.cardStyle) as StyleRecommendation["cardStyle"]
    : "bold";

  const musicMood = VALID_MUSIC.has(String(raw.musicMood))
    ? String(raw.musicMood) as StyleRecommendation["musicMood"]
    : "upbeat";

  const motionPreset = VALID_MOTION.has(String(raw.motionPreset))
    ? String(raw.motionPreset) as StyleRecommendation["motionPreset"]
    : "kenburns";

  const platformHorizontal = platform === "naverBlog" || platform === "twitter" || platform === "smartstore";
  const format: StyleRecommendation["format"] = platformHorizontal
    ? "horizontal"
    : VALID_FORMAT.has(String(raw.format))
      ? String(raw.format) as StyleRecommendation["format"]
      : "vertical";

  const rawDuration = Number(raw.duration);
  let duration = 15000;
  if (Number.isFinite(rawDuration)) {
    const ms = rawDuration < 100 ? rawDuration * 1000 : rawDuration;
    if (ms >= 8000 && ms <= 20000) duration = Math.round(ms);
  }

  const hybridMode = VALID_HYBRID.has(String(raw.hybridMode))
    ? String(raw.hybridMode) as StyleRecommendation["hybridMode"]
    : "off";

  const reason = String(raw.reason || "이 상품에 가장 적합한 스타일입니다.");

  const alternatives = Array.isArray(raw.alternatives)
    ? raw.alternatives.slice(0, 2).map((a: Record<string, unknown>) => ({
        label: String(a.label || ""),
        cardStyle: VALID_CARD_STYLES.has(String(a.cardStyle)) ? String(a.cardStyle) : "bold",
        reason: String(a.reason || ""),
      }))
    : [];

  return { cardStyle, musicMood, motionPreset, format, duration, hybridMode, reason, alternatives };
}

function fallbackRecommendation(category: string, platform: string): StyleRecommendation {
  const cat = category.toLowerCase();

  let cardStyle: StyleRecommendation["cardStyle"] = "bold";
  let musicMood: StyleRecommendation["musicMood"] = "upbeat";
  let motionPreset: StyleRecommendation["motionPreset"] = "kenburns";
  let duration = 15000;
  let hybridMode: StyleRecommendation["hybridMode"] = "off";
  let reason = "이 상품에 가장 적합한 스타일입니다.";

  if (cat.includes("cloth") || cat.includes("fashion") || cat.includes("apparel") || cat.includes("jacket") || cat.includes("shirt") || cat.includes("패션") || cat.includes("의류") || cat.includes("옷") || cat.includes("자켓") || cat.includes("셔츠")) {
    cardStyle = "feed";
    musicMood = "emotional";
    motionPreset = "slow-motion";
    duration = 14000;
    reason = "패션 상품은 감성적인 음악과 슬로우모션으로 착장 분위기를 살리는 것이 효과적입니다.";
  } else if (cat.includes("beauty") || cat.includes("cosmetic") || cat.includes("skincare") || cat.includes("makeup") || cat.includes("뷰티") || cat.includes("화장품") || cat.includes("스킨케어") || cat.includes("메이크업")) {
    cardStyle = "feed";
    musicMood = "calm";
    motionPreset = "kenburns";
    duration = 13000;
    reason = "뷰티 상품은 차분한 음악과 부드러운 줌으로 제품 질감을 돋보이게 하는 것이 좋습니다.";
  } else if (cat.includes("food") || cat.includes("drink") || cat.includes("beverage") || cat.includes("snack") || cat.includes("식품") || cat.includes("음식") || cat.includes("음료") || cat.includes("간식")) {
    cardStyle = "bold";
    musicMood = "upbeat";
    motionPreset = "zoom-in";
    duration = 10000;
    reason = "식품은 업비트 음악과 빠른 줌인으로 시선을 즉시 사로잡는 짧은 영상이 효과적입니다.";
  } else if (cat.includes("tech") || cat.includes("electronic") || cat.includes("gadget") || cat.includes("phone") || cat.includes("테크") || cat.includes("전자") || cat.includes("가전") || cat.includes("스마트폰") || cat.includes("휴대폰")) {
    cardStyle = "bold";
    musicMood = "upbeat";
    motionPreset = "zoom-in";
    duration = 12000;
    reason = "테크 제품은 업비트 음악과 줌인으로 핵심 기능을 빠르게 보여주는 것이 좋습니다.";
  } else if (cat.includes("home") || cat.includes("furniture") || cat.includes("interior") || cat.includes("lamp") || cat.includes("light") || cat.includes("홈") || cat.includes("가구") || cat.includes("인테리어") || cat.includes("조명") || cat.includes("램프")) {
    cardStyle = "magazine";
    musicMood = "calm";
    motionPreset = "zoom-out";
    duration = 16000;
    reason = "홈/인테리어는 매거진 스타일과 차분한 음악으로 공간 분위기를 전달하는 것이 효과적입니다.";
  } else if (cat.includes("toy") || cat.includes("kid") || cat.includes("fun") || cat.includes("장난감") || cat.includes("완구") || cat.includes("유아") || cat.includes("키즈")) {
    cardStyle = "bold";
    musicMood = "upbeat";
    motionPreset = "kenburns";
    duration = 12000;
    hybridMode = "photo-to-comic";
    reason = "장난감/유아 상품은 업비트 음악과 만화 전환 효과로 재미를 살리는 것이 좋습니다.";
  } else if (cat.includes("luxury") || cat.includes("jewel") || cat.includes("watch") || cat.includes("premium") || cat.includes("럭셔리") || cat.includes("명품") || cat.includes("주얼리") || cat.includes("시계") || cat.includes("프리미엄")) {
    cardStyle = "minimal";
    musicMood = "emotional";
    motionPreset = "slow-motion";
    duration = 16000;
    reason = "럭셔리 상품은 미니멀 디자인과 감성 음악으로 고급스러움을 강조하는 것이 좋습니다.";
  }

  const format: StyleRecommendation["format"] =
    platform === "naverBlog" || platform === "twitter" || platform === "smartstore" ? "horizontal" : "vertical";

  return {
    cardStyle,
    musicMood,
    motionPreset,
    format,
    duration,
    hybridMode,
    reason,
    alternatives: [
      { label: "볼드", cardStyle: "bold", reason: "큰 텍스트로 숏폼에서 시선을 강하게 사로잡습니다." },
      { label: "매거진", cardStyle: "magazine", reason: "블로그처럼 신뢰감 있는 상세 설명에 적합합니다." },
    ],
  };
}
