import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

interface ViralPredictRequest {
  hook: string;
  title: string;
  productName: string;
  productCategory: string;
  hashtags: string[];
  comicStyle?: string;
  panelCount?: number;
  hasTTS?: boolean;
  episodeMode?: boolean;
  trendingKeywords?: string[];
}

interface ViralPrediction {
  score: number;
  grade: string;
  factors: { label: string; positive: boolean; detail: string }[];
  suggestions: { type: string; label: string; detail: string }[];
  predictedViews: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body: ViralPredictRequest = await req.json();

    if (!body.hook && !body.title) {
      return new Response(
        JSON.stringify({ error: "Hook or title is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const openaiKey = await resolveOpenAIKey();

    let prediction: ViralPrediction;

    if (openaiKey) {
      try {
        prediction = await predictWithOpenAI(body, openaiKey);
      } catch {
        prediction = predictLocal(body);
      }
    } else {
      prediction = predictLocal(body);
    }

    return new Response(
      JSON.stringify(prediction),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Prediction failed" }),
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

async function predictWithOpenAI(data: ViralPredictRequest, apiKey: string): Promise<ViralPrediction> {
  const systemPrompt =
    "너는 숏폼 바이럴 예측 AI야. 틱톡·릴스·쇼츠 알고리즘 트렌드를 분석해서 콘텐츠의 바이럴 확률을 예측해.\n" +
    "0~100점 사이의 점수를 매기고, 등급(S/A/B/C/D)을 부여해.\n" +
    "점수 기준:\n" +
    "- 후킹 문구의 임팩트 (감정 자극, 호기심 유발)\n" +
    "- 해시태그 트렌드 적합도\n" +
    "- 제품 카테고리의 숏폼 인기도\n" +
    "- 만화 스타일과 패널 수의 시각적 다양성\n" +
    "- 트렌드 키워드 포함 여부\n" +
    "- TTS 내레이션 포함 여부 (시청 지속 시간 증가)\n" +
    "- 에피소드 모드 (시청 지속 시간 증가)\n" +
    "결과는 JSON만 반환: {\n" +
    "  \"score\": number,\n" +
    "  \"grade\": string,\n" +
    "  \"factors\": [{ \"label\": string, \"positive\": boolean, \"detail\": string }],\n" +
    "  \"suggestions\": [{ \"type\": string, \"label\": string, \"detail\": string }],\n" +
    "  \"predictedViews\": string\n" +
    "}\n" +
    "factors는 4~6개, suggestions는 2~3개로 작성해.\n" +
    "predictedViews는 '5천~1만', '1만~5만', '5만~10만', '10만 이상' 형식으로 작성해.";

  const userPrompt =
    `후킹 문구: ${data.hook || '없음'}\n` +
    `제품명: ${data.productName || '없음'}\n` +
    `카테고리: ${data.productCategory || '없음'}\n` +
    `해시태그: ${(data.hashtags || []).join(', ') || '없음'}\n` +
    `만화 스타일: ${data.comicStyle || '기본'}\n` +
    `패널 수: ${data.panelCount || 1}\n` +
    `TTS 내레이션: ${data.hasTTS ? '있음' : '없음'}\n` +
    `에피소드 모드: ${data.episodeMode ? '있음' : '없음'}\n` +
    `트렌드 키워드: ${(data.trendingKeywords || []).join(', ') || '없음'}\n`;

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
      max_tokens: 1200,
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

  return {
    score: Math.min(Math.max(Number(parsed.score) || 50, 0), 100),
    grade: String(parsed.grade || 'B'),
    factors: Array.isArray(parsed.factors) ? parsed.factors.slice(0, 6).map((f: any) => ({
      label: String(f.label || '').slice(0, 30),
      positive: !!f.positive,
      detail: String(f.detail || '').slice(0, 100),
    })) : [],
    suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions.slice(0, 3).map((s: any) => ({
      type: String(s.type || 'tip').slice(0, 20),
      label: String(s.label || '').slice(0, 50),
      detail: String(s.detail || '').slice(0, 150),
    })) : [],
    predictedViews: String(parsed.predictedViews || '1만~5만').slice(0, 30),
  };
}

function predictLocal(data: ViralPredictRequest): ViralPrediction {
  let score = 40;
  const factors: { label: string; positive: boolean; detail: string }[] = [];
  const suggestions: { type: string; label: string; detail: string }[] = [];

  const hook = data.hook || '';
  if (hook.length > 5) { score += 10; factors.push({ label: '후킹 문구', positive: true, detail: '감정을 자극하는 후킹 문구가 포함되어 있습니다.' }); }
  else { factors.push({ label: '후킹 문구', positive: false, detail: '후킹 문구가 짧거나 없습니다. 호기심을 유발하는 문구를 추가해보세요.' }); }

  const hashtags = data.hashtags || [];
  if (hashtags.length >= 3) { score += 10; factors.push({ label: '해시태그', positive: true, detail: `${hashtags.length}개의 해시태그가 포함되어 알고리즘 노출에 유리합니다.` }); }
  else { factors.push({ label: '해시태그', positive: false, detail: '해시태그가 부족합니다. 5~8개를 권장합니다.' }); }

  if (data.trendingKeywords && data.trendingKeywords.length > 0) { score += 15; factors.push({ label: '트렌드 키워드', positive: true, detail: '실시간 트렌드 키워드가 포함되어 알고리즘 선택 확률이 높습니다.' }); }
  else { factors.push({ label: '트렌드 키워드', positive: false, detail: '트렌드 키워드가 없습니다. 트렌딩 해시태그를 추가해보세요.' }); }

  if (data.hasTTS) { score += 10; factors.push({ label: 'AI 내레이션', positive: true, detail: '음성 더빙이 포함되어 시청 지속 시간이 증가합니다.' }); }
  else { factors.push({ label: 'AI 내레이션', positive: false, detail: '내레이션이 없으면 무음 영상은 스크롤 이탈이 빠릅니다.' }); }

  if (data.episodeMode) { score += 10; factors.push({ label: '에피소드 구성', positive: true, detail: '연작 스토리 구성이 시청 지속 시간을 늘립니다.' }); }

  if ((data.panelCount || 1) >= 2) { score += 5; factors.push({ label: '컷 분할', positive: true, detail: '다중 컷 구성이 시각적 다양성을 제공합니다.' }); }

  if (score < 50) suggestions.push({ type: 'hook', label: '후킹 강화', detail: '첫 1초 시선을 사로잡는 감정 자극 문구를 추가해보세요. "이거 모르면 손해!" 같은 표현이 효과적입니다.' });
  if (hashtags.length < 5) suggestions.push({ type: 'hashtag', label: '해시태그 추가', detail: '제품 카테고리 관련 트렌딩 해시태그를 5~8개 추가하면 알고리즘 노출이 늘어납니다.' });
  if (!data.hasTTS) suggestions.push({ type: 'tts', label: 'AI 내레이션 켜기', detail: '음성 더빙을 켜면 시청 지속 시간이 평균 30% 증가합니다.' });
  if (!data.episodeMode) suggestions.push({ type: 'episode', label: '에피소드 모드', detail: '연작 스토리로 구성하면 시청자가 끝까지 보게 됩니다.' });

  score = Math.min(score, 95);
  const grade = score >= 85 ? 'S' : score >= 70 ? 'A' : score >= 55 ? 'B' : score >= 40 ? 'C' : 'D';
  const predictedViews = score >= 85 ? '10만 이상' : score >= 70 ? '5만~10만' : score >= 55 ? '1만~5만' : score >= 40 ? '5천~1만' : '1천~5천';

  return { score, grade, factors, suggestions, predictedViews };
}
