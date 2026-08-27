import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function stripJsonFence(s: string): string {
  let t = s.trim();
  if (t.startsWith("```")) {
    t = t.replace(/^```[a-zA-Z]*\n?/, "").replace(/```$/, "").trim();
  }
  return t;
}

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

interface ComicScenarioRequest {
  productName: string;
  productCategory: string;
  priceEstimate: string;
  oneLiner: string;
  productAdvantages: string[];
  hook: string;
  panelCount?: number;
  trendingKeywords?: string[];
  trendingHashtags?: string[];
  episodeMode?: boolean;
  mbtiMode?: boolean;
  multiverseMode?: boolean;
}

type MoodTemplate = 'cute-webtoon' | 'noir' | 'sale-popup' | 'retro' | 'premium-minimal' | 'energetic-popart';

interface AutoConfig {
  mood: MoodTemplate;
  duration: 10000 | 15000 | 20000;
  panelCount: number;
}

const CATEGORY_MOOD_MAP: Record<string, MoodTemplate> = {
  '뷰티': 'cute-webtoon',
  '패션': 'energetic-popart',
  '디지털': 'premium-minimal',
  '가전': 'noir',
  '생활': 'cute-webtoon',
  '주방': 'retro',
  '스포츠': 'energetic-popart',
  '식품': 'retro',
  '유아': 'cute-webtoon',
  '반려': 'cute-webtoon',
};

function autoDecideConfig(category: string, advantages: string[]): AutoConfig {
  const mood = CATEGORY_MOOD_MAP[category] || 'energetic-popart';
  const hasRichStory = advantages.length >= 3;
  const panelCount = hasRichStory ? 3 : category === '뷰티' || category === '패션' ? 2 : 1;
  const duration: 10000 | 15000 | 20000 = panelCount >= 3 ? 20000 : panelCount === 2 ? 15000 : 10000;
  return { mood, duration, panelCount };
}

interface ComicPanel {
  speech: string;
  sfx: string;
  emotion: string;
  episodeLabel?: string;
}

interface MbtiCommentary {
  type: string;
  label: string;
  comment: string;
}

interface MultiverseEnding {
  label: string;
  speech: string;
  sfx: string;
  emotion: string;
}

interface ComicScenario {
  panels: ComicPanel[];
  isFallback: boolean;
  trendingKeywords?: string[];
  narrationText?: string;
  mbtiCommentary?: MbtiCommentary[];
  multiverse?: {
    choicePrompt: string;
    endings: [MultiverseEnding, MultiverseEnding];
  };
  autoConfig?: AutoConfig;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body: ComicScenarioRequest = await req.json();

    if (!body.productName) {
      return new Response(
        JSON.stringify({ error: "Product name is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const autoConfig = autoDecideConfig(body.productCategory || '', body.productAdvantages || []);
    const panelCount = body.panelCount ? Math.min(Math.max(body.panelCount, 1), 3) : autoConfig.panelCount;
    const openaiKey = await resolveOpenAIKey();

    let scenario: ComicScenario;

    if (openaiKey) {
      try {
        scenario = await generateWithOpenAI(body, openaiKey, panelCount);
      } catch {
        scenario = generateLocalScenario(body, panelCount, body.mbtiMode === true, body.multiverseMode === true);
      }
    } else {
      scenario = generateLocalScenario(body, panelCount, body.mbtiMode === true, body.multiverseMode === true);
    }

    scenario.autoConfig = autoConfig;

    return new Response(
      JSON.stringify(scenario),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Scenario generation failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

async function resolveOpenAIKey(): Promise<string | null> {
  const serverKey = Deno.env.get("OPENAI_API_KEY");
  if (serverKey) return serverKey;

  if (supabaseUrl && serviceRoleKey) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const resp = await fetch(
        `${supabaseUrl}/rest/v1/user_settings?select=openai_api_key&id=eq.1`,
        {
          headers: {
            apikey: serviceRoleKey,
            Authorization: `Bearer ${serviceRoleKey}`,
            signal: controller.signal,
          },
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

async function generateWithOpenAI(
  data: ComicScenarioRequest,
  apiKey: string,
  panelCount: number,
): Promise<ComicScenario> {
  const trendingKeywords = (data.trendingKeywords || []).slice(0, 8);
  const trendingHashtags = (data.trendingHashtags || []).slice(0, 8);
  const episodeMode = data.episodeMode === true;

  const multiverseMode = data.multiverseMode === true;
  const mbtiMode = data.mbtiMode === true;
  const episodeGuidance = episodeMode
    ? "\n이 만화는 연작(시리즈물) 에피소드형으로, 각 패널이 '1일차 → 3일차 → 7일차' 또는 '문제 → 해결 → 결과'의 시간 흐름을 가져야 해.\n" +
      "각 패널에 episodeLabel 필드로 '1일차', '3일차', '7일차' 같은 라벨을 추가해.\n"
    : "";

  const trendingGuidance = trendingKeywords.length > 0
    ? `\n현재 SNS에서 인기 있는 트렌드 키워드: ${trendingKeywords.join(', ')}\n` +
      `이 키워드들을 만화 대사에 자연스럽게 녹여내. 강제로 넣지 말고 문맥에 맞게 활용해.\n` +
      `추천 해시태그: ${trendingHashtags.join(', ')}\n`
    : "";

  const systemPrompt =
    "너는 한국인 만화 작가야. 제품을 홍보하는 숏폼 만화의 시나리오를 작성해.\n" +
    "만화는 '문제 → 해결 → 결과' 구조를 따라야 해.\n" +
    "각 패널은 만화 말풍선에 들어갈 대사(speech), 효과음(sfx), 감정(emotion)을 가져야 해.\n" +
    "대사는 일상적이고 자연스러운 한국어 대화체로 작성해. 과장된 마케팅 톤은 금지.\n" +
    "효과음은 만화식 의성어(KWAANG!, BOOM!, 촤악!, 번쩍!)를 사용해.\n" +
    "감정은 해당 패널의 분위기를 한 단어로(예: 고민, 놀람, 행복, 확신).\n" +
    `${episodeGuidance}` +
    (mbtiMode ? "\n추가로 MBTI 유형별 구매 가이드를 만들어. 4개 유형(INTJ, ENFP, ISTP, ENFJ) 각각에 대해 이 제품을 왜 좋아할지 위트 있는 한 줄 멘트를 작성해.\n형식: \"type\": \"INTJ\", \"label\": \"계획형\", \"comment\": \"시간 절약템 - 이건 효율성이니까\"\n" : "") +
    (multiverseMode ? "\n이 만화는 '멀티버스 A/B 결말' 형식이야. 만화 마지막에 시청자가 선택할 수 있는 두 가지 갈림길을 제시해.\nchoicePrompt는 시청자에게 던지는 질문(예: '이 원피스, 데이트룩? vs 오피스룩?')이고,\nendings는 2개의 다른 결말 패널이야. 각 결말은 서로 다른 상황/감정을 보여줘.\n" : "") +
    `정확히 ${panelCount}개의 패널을 만들어.\n` +
    (multiverseMode
      ? "결과는 JSON만 반환: { \"panels\": [...], \"narrationText\": \"...\", \"multiverse\": { \"choicePrompt\": \"...\", \"endings\": [{ \"label\": \"A결말\", \"speech\": \"...\", \"sfx\": \"...\", \"emotion\": \"...\" }, { \"label\": \"B결말\", \"speech\": \"...\", \"sfx\": \"...\", \"emotion\": \"...\" }] } }\n"
      : mbtiMode
        ? "결과는 JSON만 반환: { \"panels\": [...], \"narrationText\": \"...\", \"mbtiCommentary\": [{ \"type\": \"...\", \"label\": \"...\", \"comment\": \"...\" }] }\n"
        : "결과는 JSON만 반환: { \"panels\": [{ \"speech\": \"...\", \"sfx\": \"...\", \"emotion\": \"...\", \"episodeLabel\": \"...\" }], \"narrationText\": \"...\" }\n") +
    "narrationText는 만화 전체를 한 줄로 설명하는 내레이션 문장이야. AI 음성 더빙에 사용될 거야.";

  const userPrompt =
    `제품명: ${data.productName}\n` +
    `카테고리: ${data.productCategory}\n` +
    `가격: ${data.priceEstimate || "알 수 없음"}\n` +
    `한 줄 소개: ${data.oneLiner || ""}\n` +
    `장점: ${(data.productAdvantages || []).join(', ')}\n` +
    `후킹 문구: ${data.hook || ""}\n` +
    `패널 수: ${panelCount}\n` +
    `${trendingGuidance}` +
    `\n${panelCount}컷 만화 시나리오를 만들어줘.`;

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
      max_tokens: 1500,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${errText}`);
  }

  const result = await response.json();
  const content = result.choices?.[0]?.message?.content;
  if (!content) throw new Error("No content returned from OpenAI");

  let parsed: any;
  try {
    parsed = JSON.parse(stripJsonFence(content));
  } catch {
    return generateLocalScenario(data, panelCount, mbtiMode, multiverseMode);
  }
  const rawPanels = Array.isArray(parsed.panels) ? parsed.panels : [];

  const panels: ComicPanel[] = rawPanels.slice(0, panelCount).map((p: any) => ({
    speech: String(p.speech || "").slice(0, 100),
    sfx: String(p.sfx || "").slice(0, 20),
    emotion: String(p.emotion || "").slice(0, 20),
    episodeLabel: p.episodeLabel ? String(p.episodeLabel).slice(0, 15) : undefined,
  }));

  if (panels.length < panelCount) {
    const local = generateLocalScenario(data, panelCount);
    while (panels.length < panelCount && panels.length < local.panels.length) {
      panels.push(local.panels[panels.length]);
    }
  }

  const narrationText = parsed.narrationText
    ? String(parsed.narrationText).slice(0, 200)
    : panels.map((p) => p.speech).join('. ');

  let mbtiCommentary: MbtiCommentary[] | undefined;
  if (mbtiMode && Array.isArray(parsed.mbtiCommentary)) {
    mbtiCommentary = parsed.mbtiCommentary.slice(0, 4).map((m: any) => ({
      type: String(m.type || '').slice(0, 5),
      label: String(m.label || '').slice(0, 10),
      comment: String(m.comment || '').slice(0, 80),
    })).filter((m: MbtiCommentary) => m.type && m.comment);
  }

  let multiverse: ComicScenario["multiverse"];
  if (multiverseMode && parsed.multiverse) {
    const mv = parsed.multiverse;
    const rawEndings = Array.isArray(mv.endings) ? mv.endings.slice(0, 2) : [];
    if (rawEndings.length === 2 && mv.choicePrompt) {
      multiverse = {
        choicePrompt: String(mv.choicePrompt).slice(0, 80),
        endings: [
          {
            label: String(rawEndings[0].label || "A").slice(0, 20),
            speech: String(rawEndings[0].speech || "").slice(0, 100),
            sfx: String(rawEndings[0].sfx || "KWAANG!").slice(0, 20),
            emotion: String(rawEndings[0].emotion || "").slice(0, 20),
          },
          {
            label: String(rawEndings[1].label || "B").slice(0, 20),
            speech: String(rawEndings[1].speech || "").slice(0, 100),
            sfx: String(rawEndings[1].sfx || "BOOM!").slice(0, 20),
            emotion: String(rawEndings[1].emotion || "").slice(0, 20),
          },
        ],
      };
    }
  }

  return { panels, isFallback: false, trendingKeywords, narrationText, mbtiCommentary, multiverse };
}

function generateLocalScenario(data: ComicScenarioRequest, panelCount: number, mbtiMode = false, multiverseMode = false): ComicScenario {
  const name = data.productName || "이 제품";
  const nameShort = name.length > 10 ? name.slice(0, 10) + "…" : name;
  const advantages = data.productAdvantages?.length ? data.productAdvantages : ["가성비"];
  const topAdvantage = advantages[0] || "가성비";
  const hook = data.hook || `${nameShort} 진짜 괜찮음`;
  const trendingKeywords = (data.trendingKeywords || []).slice(0, 5);
  const episodeMode = data.episodeMode === true;

  const episodeLabels = episodeMode ? ['1일차', '3일차', '7일차'] : [];
  const trendTag = trendingKeywords.length > 0 ? ` #${trendingKeywords[0]}` : '';

  const allPanels: ComicPanel[] = [
    {
      speech: `아 ${nameShort} 때문에 고민이었는데…`,
      sfx: '촤악!',
      emotion: '고민',
      episodeLabel: episodeLabels[0],
    },
    {
      speech: `이거 ${topAdvantage}이라니까? 진짜임?${trendTag}`,
      sfx: '?!',
      emotion: '놀람',
      episodeLabel: episodeLabels[1],
    },
    {
      speech: `와 진짜 ${topAdvantage}네. 지금바로 가자!`,
      sfx: 'KWAANG!',
      emotion: '확신',
      episodeLabel: episodeLabels[2],
    },
  ];

  const panels = allPanels.slice(0, panelCount);

  if (panelCount === 1) {
    panels[0] = {
      speech: `${hook}`,
      sfx: 'KWAANG!',
      emotion: '행복',
      episodeLabel: episodeLabels[0],
    };
  } else if (panelCount === 2) {
    panels[0] = {
      speech: `${nameShort} 때문에 고민이었는데…`,
      sfx: '촤악!',
      emotion: '고민',
      episodeLabel: episodeLabels[0],
    };
    panels[1] = {
      speech: `이거 ${topAdvantage}! 진짜 추천해${trendTag}`,
      sfx: 'BOOM!',
      emotion: '확신',
      episodeLabel: episodeLabels[1],
    };
  }

  const narrationText = panels.map((p) => p.speech).join('. ');

  let mbtiCommentary: MbtiCommentary[] | undefined;
  if (mbtiMode) {
    mbtiCommentary = generateLocalMbti(data);
  }

  let multiverse: ComicScenario["multiverse"];
  if (multiverseMode) {
    multiverse = generateLocalMultiverse(data);
  }

  return { panels, isFallback: true, trendingKeywords, narrationText, mbtiCommentary, multiverse };
}

function generateLocalMultiverse(data: ComicScenarioRequest): NonNullable<ComicScenario["multiverse"]> {
  const name = data.productName || "이 제품";
  const nameShort = name.length > 8 ? name.slice(0, 8) + "…" : name;
  const advantages = data.productAdvantages?.length ? data.productAdvantages : ["가성비"];
  const topAdv = advantages[0] || "가성비";
  const secondAdv = advantages[1] || topAdv;
  return {
    choicePrompt: `${nameShort} 어떻게 쓸까?`,
    endings: [
      { label: 'A: 혼자 쓸 때', speech: `혼자 ${topAdv}! 역시 최고`, sfx: '번쩍!', emotion: '행복' },
      { label: 'B: 같이 쓸 때', speech: `같이 쓰면 ${secondAdv}! 더 좋음`, sfx: 'KWAANG!', emotion: '설렘' },
    ],
  };
}

function generateLocalMbti(data: ComicScenarioRequest): MbtiCommentary[] {
  const name = data.productName || "이 제품";
  const nameShort = name.length > 8 ? name.slice(0, 8) + "…" : name;
  const advantages = data.productAdvantages?.length ? data.productAdvantages : ["가성비"];
  const topAdv = advantages[0] || "가성비";
  return [
    { type: 'INTJ', label: '계획형', comment: `${nameShort} - ${topAdv}이라 시간 아껴주는 효율템` },
    { type: 'ENFP', label: '인싸형', comment: `${nameShort} - 이거 알면 뿌듯한 내부 정보템!` },
    { type: 'ISTP', label: '공감', comment: `${nameShort} - 심플한데 실용적. 그래서 더 좋음` },
    { type: 'ENFJ', label: '리더형', comment: `${nameShort} - 다들 좋다고 하니깐 선물용 딱!` },
  ];
}
