import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { buildPsychoSystemPrompt } from "../_shared/psycho-engine.ts";

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

interface TimelineSegment {
  startTime: number;
  endTime: number;
  phase: string;
  narration: string;
  overlayText: string;
  visualDirection: string;
}

interface ViralShortformPackage {
  vision: {
    category: string;
    coreFeature: string;
    targetAudience: string;
    mood: string;
    colorPalette: { name: string; hex: string }[];
  };
  psychology: {
    lossAversion: string;
    painPoint: string;
    justification: string;
    primaryTrigger: string;
    consumerDesire: string;
  };
  timeline: {
    totalDuration: number;
    segments: TimelineSegment[];
    mandatoryDisclosure: {
      text: string;
      position: string;
      startTime: number;
      endTime: number;
    };
  };
  output: {
    hookPhrase: string;
    caption: string;
    hashtags: string[];
    ctaText: string;
  };
  isFallback: boolean;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const { imageDataUrl, mimeType, affiliatePlatform, productName } = body;

    if (!imageDataUrl) {
      return new Response(
        JSON.stringify({ error: "Image data is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const cleanMime = mimeType || "image/jpeg";
    const openaiKey = await resolveOpenAIKey();

    let result: ViralShortformPackage;

    if (openaiKey) {
      try {
        result = await generateWithOpenAI(imageDataUrl, cleanMime, openaiKey, affiliatePlatform, productName);
      } catch {
        result = generateLocalPackage(productName || "상품", affiliatePlatform);
      }
    } else {
      result = generateLocalPackage(productName || "상품", affiliatePlatform);
    }

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Generation failed" }),
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

async function generateWithOpenAI(
  imageDataUrl: string,
  mimeType: string,
  apiKey: string,
  affiliatePlatform?: string,
  productName?: string,
): Promise<ViralShortformPackage> {
  const platformHint = affiliatePlatform
    ? `\n제휴 플랫폼: ${affiliatePlatform}\n이 플랫폼에 맞는 공정위 고지 문구를 생성할 것.`
    : "\n제휴 플랫폼: 일반 (Naver BrandConnect 기준 공정위 고지 문구 적용)";

  const productHint = productName ? `\n사용자가 입력한 상품명: ${productName}` : "";

  const shortformChannelSpecific =
    "## 숏폼 영상 전용 지시사항\n" +
    "- Hook(0-2초): 패턴 인식을 즉각 깨부수어라. 강렬한 부조화, 거친 모션, 역설적 내레이션/자막으로 시선을 잡아라.\n" +
    "- 페이싱: 높은 서사 속도를 유지하라. 펀치한 시각-텍스트 시너지, 다이내믹 컷, 위트 있는 사운드 큐 마커로 이탈을 막아라.\n" +
    "- 절대 제품 피치로 시작하지 마라. 일상의 짜증이나 황당한 반전으로 시작하라.\n" +
    "- 제품은 중간에 '우연한 구원자'로 등장해야 한다.\n" +
    "- CTA는 '지금 바로 구매하세요'가 아니라 내부자 꿀팁 톤으로. 예: '고민하는 사이 품절됨 ㅋㅋ'\n" +
    "\n# Phase 1: Vision & Context Analysis\n" +
    "업로드된 상품 이미지를 분석하여 다음 데이터를 즉시 추출:\n" +
    "- Category & Core Feature: 상품의 정확한 카테고리 및 시각적으로 드러나는 핵심 USP\n" +
    "- Target Audience: 가장 즉각적인 구매 반응을 보일 타겟층 및 라이프스타일\n" +
    "- Mood & Color Palette: 상품의 패키징과 무드에 어울리는 최적의 톤앤매너 및 강조 컬러 헥스 코드\n" +
    "\n# Phase 2: Psychological Trigger Mapping\n" +
    "추출된 상품 데이터를 바탕으로 소비자의 구매를 강제하는 심리 트리거 적용:\n" +
    "- Loss Aversion (손실 회피): '오늘 자정 마감', '품절 임박' 등 긴급성 부여\n" +
    "- Pain Point Agony (일상 고통 공감): 타겟 소비자의 날것의 고민을 1컷 후킹 문구로 후벼파기\n" +
    "- Justification (가성비 합리화): '이 가격에 이 스펙이면 무조건 이득'이라는 구매 정당화\n" +
    "\n# Phase 3: AIDCA 15-Second Timeline Auto-Assembly & Legal Disclosure\n" +
    "전체 15초 러닝타임을 4개 구간으로 정밀 분할:\n" +
    "- [0~3초 | Hook]: 시선을 단번에 사로잡는 강력한 일상 고통 공감 및 자극적 도입부 대사\n" +
    "- [4~8초 | Interest]: 문제를 심화시키고 해결책의 필요성을 각인시키는 구간\n" +
    "- [9~12초 | Desire]: 상품의 핵심 특장점과 시각적 스틸컷이 오버랩되며 감탄을 유도\n" +
    "- [13~15초 | Action & Mandatory Disclosure]: 마감 임박 타이머 및 직관적 구매 유도 독백 + 영상 하단에 공정위 문구 자동 고정\n" +
    platformHint +
    productHint;

  const systemPrompt = buildPsychoSystemPrompt(
    "당신은 멀티모달 비전 분석 전문가이자, 인간의 소비 심리를 자극하여 구매 전환을 극대화하는 동시에 법적 규제를 완벽히 준수하는 '초고속 바이럴 숏폼 아키텍트'입니다.",
    shortformChannelSpecific,
  );
    "\n\n다음 JSON 구조로만 응답할 것 (다른 텍스트 금지):\n" +
    "{\n" +
    '  "vision": {\n' +
    '    "category": "카테고리 (한국어)",\n' +
    '    "coreFeature": "핵심 USP (한국어, 1-2문장)",\n' +
    '    "targetAudience": "타겟층 (한국어)",\n' +
    '    "mood": "무드/톤앤매너 (한국어)",\n' +
    '    "colorPalette": [{ "name": "컬러명", "hex": "#XXXXXX" }, { "name": "컬러명2", "hex": "#YYYYYY" }]\n' +
    '  },\n' +
    '  "psychology": {\n' +
    '    "lossAversion": "손실 회비 문구 (한국어, 10-30자)",\n' +
    '    "painPoint": "일상 고통 공감 문구 (한국어, 10-30자)",\n' +
    '    "justification": "가성비 합리화 문구 (한국어, 10-40자)",\n' +
    '    "primaryTrigger": "FOMO|SOCIAL_PROOF|LOSS_AVERSION|MIRROR_NEURON|IDENTITY_PROJECTION|CONTRAST_EFFECT 중 하나",\n' +
    '    "consumerDesire": "深层 욕구 (한국어, 10-30자)"\n' +
    '  },\n' +
    '  "timeline": {\n' +
    '    "totalDuration": 15,\n' +
    '    "segments": [\n' +
    '      { "startTime": 0, "endTime": 3, "phase": "Hook", "narration": "0-3초 대사 (한국어)", "overlayText": "화면에 표시될 자막 (한국어)", "visualDirection": "시각 연출 지시 (한국어)" },\n' +
    '      { "startTime": 4, "endTime": 8, "phase": "Interest", "narration": "4-8초 대사 (한국어)", "overlayText": "자막 (한국어)", "visualDirection": "시각 연출 (한국어)" },\n' +
    '      { "startTime": 9, "endTime": 12, "phase": "Desire", "narration": "9-12초 대사 (한국어)", "overlayText": "자막 (한국어)", "visualDirection": "시각 연출 (한국어)" },\n' +
    '      { "startTime": 13, "endTime": 15, "phase": "Action", "narration": "13-15초 대사 (한국어)", "overlayText": "자막 (한국어)", "visualDirection": "시각 연출 (한국어)" }\n' +
    '    ],\n' +
    '    "mandatoryDisclosure": {\n' +
    '      "text": "공정위 고지 문구 (한국어, 예: 파트너스 활동의 일환으로 이에 따른 일정액의 수수료를 제공받습니다)",\n' +
    '      "position": "bottom",\n' +
    '      "startTime": 13,\n' +
    '      "endTime": 15\n' +
    '    }\n' +
    '  },\n' +
    '  "output": {\n' +
    '    "hookPhrase": "스크롤을 멈추게 하는 후킹 문구 (한국어, 10-20자)",\n' +
    '    "caption": "게시용 캡션 (한국어, 2-4줄)",\n' +
    '    "hashtags": ["해시태그1", "해시태그2", "해시태그3", "해시태그4", "해시태그5"],\n' +
    '    "ctaText": "구매 유도 CTA 문구 (한국어, 10-20자)"\n' +
    '  }\n' +
    "}";

  const userContent = [
    { type: "text", text: "이 상품 사진을 분석하여 완전 자동화 숏폼 패키지를 생성해주세요." },
    { type: "image_url", image_url: { url: imageDataUrl, detail: "high" } },
  ];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 55000);

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
          { role: "user", content: userContent },
        ],
        max_tokens: 2400,
        temperature: 0.7,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${errText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("No content returned from OpenAI");

    const parsed = JSON.parse(stripJsonFence(content));
    return normalizePackage(parsed);
  } finally {
    clearTimeout(timeout);
  }
}

function normalizePackage(raw: Record<string, unknown>): ViralShortformPackage {
  const vision = (raw.vision || {}) as Record<string, unknown>;
  const psychology = (raw.psychology || {}) as Record<string, unknown>;
  const timeline = (raw.timeline || {}) as Record<string, unknown>;
  const output = (raw.output || {}) as Record<string, unknown>;
  const segments = Array.isArray(timeline.segments) ? timeline.segments : [];
  const colorPalette = Array.isArray(vision.colorPalette) ? vision.colorPalette : [];

  return {
    vision: {
      category: String(vision.category || ""),
      coreFeature: String(vision.coreFeature || ""),
      targetAudience: String(vision.targetAudience || ""),
      mood: String(vision.mood || ""),
      colorPalette: colorPalette.map((c: unknown) => {
        const co = c as Record<string, unknown>;
        return { name: String(co.name || ""), hex: String(co.hex || "#000000") };
      }),
    },
    psychology: {
      lossAversion: String(psychology.lossAversion || ""),
      painPoint: String(psychology.painPoint || ""),
      justification: String(psychology.justification || ""),
      primaryTrigger: String(psychology.primaryTrigger || "FOMO"),
      consumerDesire: String(psychology.consumerDesire || ""),
    },
    timeline: {
      totalDuration: 15,
      segments: segments.slice(0, 4).map((s: unknown, i: number) => {
        const seg = s as Record<string, unknown>;
        const defaults = [
          { startTime: 0, endTime: 3, phase: "Hook" },
          { startTime: 4, endTime: 8, phase: "Interest" },
          { startTime: 9, endTime: 12, phase: "Desire" },
          { startTime: 13, endTime: 15, phase: "Action" },
        ];
        return {
          startTime: Number(seg.startTime ?? defaults[i].startTime),
          endTime: Number(seg.endTime ?? defaults[i].endTime),
          phase: String(seg.phase ?? defaults[i].phase),
          narration: String(seg.narration || ""),
          overlayText: String(seg.overlayText || ""),
          visualDirection: String(seg.visualDirection || ""),
        };
      }),
      mandatoryDisclosure: {
        text: String(
          (timeline.mandatoryDisclosure as Record<string, unknown>)?.text ||
            "파트너스 활동의 일환으로 이에 따른 일정액의 수수료를 제공받습니다",
        ),
        position: String(
          (timeline.mandatoryDisclosure as Record<string, unknown>)?.position || "bottom",
        ),
        startTime: Number(
          (timeline.mandatoryDisclosure as Record<string, unknown>)?.startTime || 13,
        ),
        endTime: Number(
          (timeline.mandatoryDisclosure as Record<string, unknown>)?.endTime || 15,
        ),
      },
    },
    output: {
      hookPhrase: String(output.hookPhrase || ""),
      caption: String(output.caption || ""),
      hashtags: Array.isArray(output.hashtags) ? output.hashtags.map(String) : [],
      ctaText: String(output.ctaText || ""),
    },
    isFallback: false,
  };
}

function generateLocalPackage(productName: string, affiliatePlatform?: string): ViralShortformPackage {
  const platform = affiliatePlatform || "Naver BrandConnect";
  return {
    vision: {
      category: "일반 상품",
      coreFeature: `${productName}의 핵심 특장점을 확인해보세요.`,
      targetAudience: "가성비와 품질을 동시에 찾는 2030 소비자",
      mood: "깔끔하고 신뢰감 있는 톤",
      colorPalette: [
        { name: "Primary", hex: "#2f9dff" },
        { name: "Accent", hex: "#ff6b35" },
      ],
    },
    psychology: {
      lossAversion: "오늘 자정까지 한정가, 놓치면 다시 없을 가격",
      painPoint: "매번 비싸게 사서 속상했죠? 이제 그만 고민하세요",
      justification: "이 가격에 이 스펙이면 무조건 이득입니다",
      primaryTrigger: "LOSS_AVERSION",
      consumerDesire: "후회 없는 현명한 소비를 원함",
    },
    timeline: {
      totalDuration: 15,
      segments: [
        {
          startTime: 0,
          endTime: 3,
          phase: "Hook",
          narration: "이거 모르면 평생 손해 봅니다. 진짜입니다.",
          overlayText: "이거 모르면 손해",
          visualDirection: "상품 클로즈업 + 자극적 자막",
        },
        {
          startTime: 4,
          endTime: 8,
          phase: "Interest",
          narration: "매번 비싸게 사서 속상했죠? 이제 더 이상 고민하지 마세요.",
          overlayText: "이 가격에 이 품질?",
          visualDirection: "사용 전/후 비교 화면",
        },
        {
          startTime: 9,
          endTime: 12,
          phase: "Desire",
          narration: `${productName}, 핵심 스펙 한눈에 확인하세요. 이 가격에 이 스펙이면 무조건 이득입니다.`,
          overlayText: "가성비 끝판왕",
          visualDirection: "상품 디테일 스틸컷 오버랩",
        },
        {
          startTime: 13,
          endTime: 15,
          phase: "Action",
          narration: "고민은 배송만 늦출 뿐입니다. 링크 남겨둡니다, 지금 바로.",
          overlayText: "지금 바로 구매",
          visualDirection: "마감 타이머 + 구매 링크 강조",
        },
      ],
      mandatoryDisclosure: {
        text: "파트너스 활동의 일환으로 이에 따른 일정액의 수수료를 제공받습니다",
        position: "bottom",
        startTime: 13,
        endTime: 15,
      },
    },
    output: {
      hookPhrase: "이거 모르면 평생 손해",
      caption: `${productName} 진짜 추천합니다.\n이 가격에 이 품질이면 무조건 이득이에요.\n고민하는 사이에 품절될 수도 있어요. 링크 남겨둡니다.`,
      hashtags: ["가성비템", "추천", "숏폼", "제품추천", "오늘뭐살까"],
      ctaText: "지금 바로 구매하세요",
    },
    isFallback: true,
  };
}
