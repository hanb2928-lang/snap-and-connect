import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

interface LocalizeRequest {
  hook: string;
  title: string;
  caption: string;
  hashtags: string[];
  productName: string;
  productCategory: string;
  narrationText?: string;
  targetLanguages: string[];
  affiliateUrl?: string;
}

interface LocalizedContent {
  language: string;
  languageCode: string;
  hook: string;
  title: string;
  caption: string;
  hashtags: string[];
  narrationText: string;
  ttsVoice: string;
  affiliatePlatform: string;
  affiliateUrl: string;
}

interface LocalizeResponse {
  localizations: LocalizedContent[];
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body: LocalizeRequest = await req.json();

    if (!body.targetLanguages || body.targetLanguages.length === 0) {
      return new Response(
        JSON.stringify({ error: "Target languages are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const openaiKey = await resolveOpenAIKey();

    let result: LocalizeResponse;

    if (openaiKey) {
      try {
        result = await localizeWithOpenAI(body, openaiKey);
      } catch {
        result = localizeLocal(body);
      }
    } else {
      result = localizeLocal(body);
    }

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Localization failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

async function resolveOpenAIKey(): Promise<string | null> {
  const serverKey = Deno.env.get("OPENAI_API_KEY");
  if (serverKey) return serverKey;

  if (supabaseUrl && serviceRoleKey) {
    try {
      const resp = await fetch(
        `${supabaseUrl}/rest/v1/user_settings?select=openai_api_key&id=eq.1`,
        {
          headers: {
            apikey: serviceRoleKey,
            Authorization: `Bearer ${serviceRoleKey}`,
          },
        },
      );
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

const LANG_INFO: Record<string, { code: string; nativeName: string; voice: string; platform: string }> = {
  en: { code: 'en', nativeName: 'English', voice: 'alloy', platform: 'TikTok Shop US' },
  ja: { code: 'ja', nativeName: '日本語', voice: 'nova', platform: 'TikTok Shop JP' },
  zh: { code: 'zh', nativeName: '中文', voice: 'echo', platform: 'TikTok Shop CN' },
  es: { code: 'es', nativeName: 'Español', voice: 'shimmer', platform: 'TikTok Shop LATAM' },
  vi: { code: 'vi', nativeName: 'Tiếng Việt', voice: 'alloy', platform: 'TikTok Shop VN' },
  th: { code: 'th', nativeName: 'ภาษาไทย', voice: 'nova', platform: 'TikTok Shop TH' },
  id: { code: 'id', nativeName: 'Bahasa Indonesia', voice: 'echo', platform: 'TikTok Shop ID' },
};

async function localizeWithOpenAI(data: LocalizeRequest, apiKey: string): Promise<LocalizeResponse> {
  const langInfos = data.targetLanguages
    .map(l => LANG_INFO[l])
    .filter((l): l is NonNullable<typeof l> => Boolean(l));
  if (langInfos.length === 0) {
    throw new Error("지원하지 않는 언어 코드입니다. 지원 언어: en, ja, zh, th, id");
  }

  const systemPrompt =
    "너는 글로벌 숏폼 로컬라이징 전문가야. 한국어 콘텐츠를 각 국가 언어로 자연스럽게 번역하고 현지화해.\n" +
    "단순 번역이 아니라 현지 문화와 숏폼 트렌드에 맞게 후킹 문구와 캡션을 재작성해.\n" +
    "해시태그는 각 국가에서 인기 있는 것으로 현지화해.\n" +
    "결과는 JSON만 반환: { \"localizations\": [{ \"language\": \"English\", \"languageCode\": \"en\", \"hook\": \"...\", \"title\": \"...\", \"caption\": \"...\", \"hashtags\": [\"...\"], \"narrationText\": \"...\" }] }";

  const userPrompt =
    `원본 후킹: ${data.hook || ''}\n` +
    `원본 제목: ${data.title || ''}\n` +
    `원본 캡션: ${data.caption || ''}\n` +
    `원본 해시태그: ${(data.hashtags || []).join(', ')}\n` +
    `제품명: ${data.productName || ''}\n` +
    `카테고리: ${data.productCategory || ''}\n` +
    `내레이션 텍스트: ${data.narrationText || ''}\n` +
    `대상 언어: ${langInfos.map(l => `${l.code}(${l.nativeName})`).join(', ')}\n` +
    `각 언어별로 현지화된 콘텐츠를 작성해.`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 2500,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const result = await response.json();
  const content = result.choices?.[0]?.message?.content;
  if (!content) throw new Error("No content from OpenAI");

  const parsed = JSON.parse(content);
  const rawLocals = Array.isArray(parsed.localizations) ? parsed.localizations : [];

  const localizations: LocalizedContent[] = rawLocals.map((loc: any) => {
    const code = String(loc.languageCode || '').slice(0, 5);
    const info = LANG_INFO[code] || { voice: 'alloy', platform: 'TikTok Shop' };
    return {
      language: String(loc.language || info.nativeName || code).slice(0, 30),
      languageCode: code,
      hook: String(loc.hook || '').slice(0, 200),
      title: String(loc.title || '').slice(0, 100),
      caption: String(loc.caption || '').slice(0, 1000),
      hashtags: Array.isArray(loc.hashtags) ? loc.hashtags.slice(0, 10).map((h: any) => String(h).slice(0, 50)) : [],
      narrationText: String(loc.narrationText || '').slice(0, 300),
      ttsVoice: info.voice,
      affiliatePlatform: info.platform,
      affiliateUrl: data.affiliateUrl || '',
    };
  });

  return { localizations };
}

function localizeLocal(data: LocalizeRequest): LocalizeResponse {
  const localizations: LocalizedContent[] = data.targetLanguages.map(langCode => {
    const info = LANG_INFO[langCode] || { code: langCode, nativeName: langCode, voice: 'alloy', platform: 'TikTok Shop' };
    return {
      language: info.nativeName,
      languageCode: info.code,
      hook: data.hook || '',
      title: data.title || '',
      caption: data.caption || '',
      hashtags: data.hashtags || [],
      narrationText: data.narrationText || data.hook || '',
      ttsVoice: info.voice,
      affiliatePlatform: info.platform,
      affiliateUrl: data.affiliateUrl || '',
    };
  });

  return { localizations };
}
