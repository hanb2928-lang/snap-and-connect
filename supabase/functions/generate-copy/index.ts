import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

type CopyType = "deal" | "info" | "viral" | "all";
type CopyPlatform = "shortform" | "instagram" | "blog" | "x" | "threads" | "naverBlog" | "twitter" | "smartstore" | "pinterest";

interface CopyItem {
  hook: string;
  caption: string;
  hashtags: string[];
}

interface LocalStoreInfo {
  enabled: boolean;
  storeName: string;
  address: string;
  region: string;
  phone: string;
  todayOffer: string;
}

interface CopyRequest {
  productName: string;
  productCategory: string;
  priceEstimate: string;
  oneLiner: string;
  productAdvantages: string[];
  copyType: CopyType;
  platform: CopyPlatform;
  count: number;
  localStoreInfo?: LocalStoreInfo | null;
}

interface CopyGroup {
  type: CopyType;
  label: string;
  copies: CopyItem[];
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const raw = await req.json();
    const body: CopyRequest = {
      productName: String(raw?.productName ?? ''),
      productCategory: String(raw?.productCategory ?? ''),
      priceEstimate: String(raw?.priceEstimate ?? ''),
      oneLiner: String(raw?.oneLiner ?? ''),
      productAdvantages: Array.isArray(raw?.productAdvantages)
        ? raw.productAdvantages.map((s: unknown) => String(s)).slice(0, 10)
        : [],
      copyType: ((): CopyType => {
        const valid: CopyType[] = ['viral', 'info', 'deal', 'all'];
        return valid.includes(raw?.copyType) ? raw.copyType : 'viral';
      })(),
      platform: ((): CopyPlatform => {
        const valid: CopyPlatform[] = ['shortform', 'instagram', 'blog', 'naverBlog', 'x', 'twitter', 'threads', 'smartstore', 'pinterest'];
        return valid.includes(raw?.platform) ? raw.platform : 'shortform';
      })(),
      count: Math.min(Math.max(Number(raw?.count) || 3, 1), 5),
      localStoreInfo: raw?.localStoreInfo ?? null,
    };

    if (!body.productName) {
      return new Response(
        JSON.stringify({ error: "Product name is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const count = body.count;
    const openaiKey = await resolveOpenAIKey();
    const isAllMode = body.copyType === "all";

    if (isAllMode) {
      const types: CopyType[] = ["viral", "info", "deal"];
      const groups: CopyGroup[] = [];
      let isFallback = false;

      for (const ct of types) {
        const reqBody = { ...body, copyType: ct };
        let copies: CopyItem[];
        if (openaiKey) {
          try {
            copies = await generateWithOpenAI(reqBody, openaiKey, count);
          } catch {
            copies = generateLocalCopies(reqBody, count);
            isFallback = true;
          }
        } else {
          copies = generateLocalCopies(reqBody, count);
          isFallback = true;
        }
        groups.push({ type: ct, label: typeLabel(ct), copies });
      }

      return new Response(
        JSON.stringify({ groups, isFallback }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let copies: CopyItem[];
    let isFallback = false;

    if (openaiKey) {
      try {
        copies = await generateWithOpenAI(body, openaiKey, count);
      } catch {
        copies = generateLocalCopies(body, count);
        isFallback = true;
      }
    } else {
      copies = generateLocalCopies(body, count);
      isFallback = true;
    }

    return new Response(
      JSON.stringify({ copies, isFallback }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Copy generation failed" }),
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

function typeLabel(copyType: CopyType): string {
  if (copyType === "deal") return "파격할인형 (할인/한정/가치 강조)";
  if (copyType === "info") return "정보형 (꿀팁/비교/리뷰 형식)";
  return "감성형 (호기심/공감/후킹 유발)";
}

function platformLabel(platform: CopyPlatform): string {
  if (platform === "instagram") return "인스타그램 피드";
  if (platform === "blog" || platform === "naverBlog") return "네이버 블로그";
  if (platform === "x" || platform === "twitter") return "X(트위터)";
  if (platform === "threads") return "스레드";
  if (platform === "smartstore") return "스마트스토어 상세페이지";
  if (platform === "pinterest") return "핀터레스트";
  return "쇼츠/릴스/틱톡";
}

function platformTone(platform: CopyPlatform): string {
  if (platform === "threads") {
    return "스레드는 반말투로 써. '해요', '습니다', '세요' 같은 존댓말은 빼고 '한다', '임', '드라고', '거든' 같은 반말로 자연스럽게. 마치 혼자 중얼거리거나 친구한테 툭 던지듯이.";
  }
  if (platform === "smartstore") {
    return "스마트스토어 상세페이지용이니까 구매 결정을 돮는 방향으로 써. 상품명, 장점, 가격을 명확히 전달하고 '지금 구매하기', '한정 수량' 같은 구매 유도 문구를 자연스럽게 포함해.";
  }
  return "말투는 친근한 존댓말('해요', '요')를 기본으로 하되 너무 격식 차리지 마.";
}

async function generateWithOpenAI(
  data: CopyRequest,
  apiKey: string,
  count: number,
): Promise<CopyItem[]> {
  let systemPrompt =
    "너는 한국인 SNS 유저야. 마케터가 아니라 실제로 제품을 써본 사람처럼 글을 써.\n" +
    "절대로 '놓치면 후회합니다', '지금 바로 확인하세요', '강력 추천합니다' 같은 상투적인 마케팅 문구는 쓰지 마.\n" +
    "진짜 친구한테 문자 보내듯이, 쓸데없는 수식어 빼고 핵심만 자연스럽게 말해.\n" +
    "인터넷에서 실제 사람들이 쓰는 말투(ㅋㅋ, ㅠㅠ, ~임, ~드라고요, ~거든요 등)를 자연스럽게 섞어 써.\n" +
    "과장 금지. '인생 바뀜', '대박', '최고' 같은 과도한 표현 대신 구체적인 경험을 담아.\n" +
    `\"${typeLabel(data.copyType)}\" 스타일로 ${platformLabel(data.platform)}에 맞게 ${count}개 변형을 만들어.\n` +
    `${platformTone(data.platform)}\n` +
    "각 변형은 'hook'(10~30자, 첫 줄부터 자연스럽게 호기심 유발), " +
    "'caption'(50~200자, 진짜 후기처럼 줄바꿈 있는 본문), " +
    "'hashtags'(5~12개, # 없이 문자열 배열)를 가져야 해.\n" +
    "해시태그도 너무 상업적인 건 빼고 실제 SNS에서 많이 쓰는 자연스러운 걸로.\n";

  if (data.localStoreInfo?.enabled && data.localStoreInfo.storeName) {
    const ls = data.localStoreInfo;
    systemPrompt +=
      "\n" +
      "이 카피는 오프라인 매장 홍보용이야. 다음 매장 정보를 카피에 자연스럽게 반영해:\n" +
      `- 매장명: ${ls.storeName}\n` +
      `- 주소: ${ls.address}\n` +
      `- 전화번호: ${ls.phone || '없음'}\n` +
      `- 오늘의 혜택: ${ls.todayOffer || '없음'}\n` +
      `지역 해시태그(${ls.region}맛집, ${ls.region}카페, ${ls.region}스토어 등)를 반드시 2~3개 포함해.\n` +
      "방문 유도 문구(\"오늘 방문 시 서비스\", \"선착순 할인\", \"매장에서 직접 확인\" 등)를 후킹이나 캡션에 자연스럽게 넣어.\n" +
      "온라인 구매 링크 대신 매장 방문을 유도하는 방향으로 작성해.\n";
  }

  systemPrompt +=
    "결과는 JSON만 반환: { \"copies\": [{ \"hook\": \"...\", \"caption\": \"...\", \"hashtags\": [...] }] }";

  let userPrompt =
    `제품명: ${data.productName}\n` +
    `카테고리: ${data.productCategory}\n` +
    `가격: ${data.priceEstimate || "알 수 없음"}\n` +
    `한 줄 소개: ${data.oneLiner || ""}\n` +
    `장점: ${(data.productAdvantages || []).join(', ')}\n` +
    `카피 타입: ${typeLabel(data.copyType)}\n` +
    `플랫폼: ${platformLabel(data.platform)}\n\n` +
    `${count}개 만들어줘. 서로 다른 말투와 구성으로.`;

  if (data.localStoreInfo?.enabled && data.localStoreInfo.storeName) {
    const ls = data.localStoreInfo;
    userPrompt +=
      `\n매장명: ${ls.storeName}\n` +
      `매장 주소: ${ls.address}\n` +
      `전화번호: ${ls.phone || ''}\n` +
      `오늘의 혜택: ${ls.todayOffer || ''}\n` +
      `지역: ${ls.region}\n` +
      `오프라인 매장 홍보 모드이므로 방문 유도형으로 작성해줘.`;
  }

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
      max_tokens: 2000,
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

  const parsed = JSON.parse(content);
  const rawCopies = Array.isArray(parsed.copies) ? parsed.copies : [];

  return rawCopies.slice(0, count).map((c: any) => ({
    hook: String(c.hook || "").slice(0, 80),
    caption: String(c.caption || "").slice(0, 500),
    hashtags: Array.isArray(c.hashtags)
      ? c.hashtags.map((h: any) => String(h).replace(/^#/, "")).slice(0, 15)
      : [],
  }));
}

function generateLocalCopies(data: CopyRequest, count: number): CopyItem[] {
  const name = data.productName || "이 제품";
  const nameShort = name.length > 12 ? name.slice(0, 12) + "…" : name;
  const price = data.priceEstimate || "";
  const advantages = data.productAdvantages?.length ? data.productAdvantages : ["가성비"];
  const category = (data.productCategory || "").toLowerCase();

  const catHashtags = categoryHashtags(category, name);
  const baseHashtags = ["추천템", "가성비", name.replace(/\s/g, "")];

  const dealHooks = [
    `이 가격 뜨면 무조건 사야 됨`,
    `${nameShort} ${price ? `${price}라서 ` : ""}일단 담음`,
    `아까 장바구니에 담아둔거 얼른 결제하셈`,
    `이거 품절 되기 전에 가져가세요`,
    `${nameShort} 지금 가격 보고 놀람`,
    `재고 언제까지 있는지 모르겠는데 일단 올림`,
    `이 가격대 다시 올 거 같진 않음`,
    `${nameShort} ${price ? `${price}에 ` : ""}살 수 있을 때 사두세요`,
    `공구로 가져왔는데 양이 제법 됨`,
    `이거 장바구니에 안 넣으면 손해인 거 아시죠`,
    `${nameShort} 할인율 보고 두 번 봄`,
    `지금 아니면 이 가격 못 받음 진짜로`,
    `${advantages.join(', ')}에다가 이 가격이면 무조건`,
    `오늘까지만 이 가격 유지된대요`,
    `이거 수량 한정이라 빨리 결제하셔야 됨`,
    `타임세일 들어오자마자 품절된 거 어제 봄`,
    `${nameShort} ${price ? `${price}이라서 ` : ""}거의 공짜 수준 아닌가`,
    `벌써 세일 끝난 줄 알았는데 아직 살 수 있음`,
    `이런 가격에 이런 거 거의 못 구함`,
  ];

  const dealCaptions = [
    `${name} 지금 한정가로 가져왔어요.\n${advantages.join(', ')}이라서 획득하셔야 됨\n이 가격대 다시 올 거 같진 않아요.`,
    `이거 진짜 빨리 가져가셔야 돼요.\n${name} 한정 수량이라 언제 끝날지 모름.\n${price ? `지금 ${price}인데 ` : ""}나중에 올라도 저도 책임 못 짐 ㅋㅋ`,
    `${name} 지금이 제일 싼 거 같아요.\n벌써 장바구니에 담으신 분들 많고,\n이 가격 다시 오면 그때 사려니까요.`,
    `공구로 가져왔어요 ${name}.\n${price ? `이 가격(${price})이면 무조건 사야 됨. ` : ""}재고 털리면 끝이라서\n망설일 시간이 없어요.`,
    `${name} ${price ? `${price}에 ` : ""}이 품질이면 거의 공짜 아닌가 싶음.\n${advantages.join(', ')} 제대로라서\n저는 이미 두 개 샀어요.`,
    `오늘까지만 이 가격이라고 하더라고요.\n${name} ${advantages.join(', ')}이 제일 큰 장점인데,\n${price ? `${price}이라서 ` : ""}가성비는 진짜 인정.`,
    `${name} 벌써 주문 폭주 중이래요.\n${price ? `지금 가격 ${price}인데 ` : ""}이건 오늘까지만 유지된대요.\n품절 전에 하나는 가져가세요.`,
    `${name} 이 가격 실화인가 싶어서 두 번 봤어요.\n${advantages.join(', ')}에 ${price ? `${price}라면 ` : ""}거의 무조건 사야 되는 거 아닌가\n수량 한정이라 빨리 결제하셔야 됨.`,
  ];

  const infoHooks = [
    `${nameShort} 3개월 써봤는데 솔직히 적어봄`,
    `${nameShort} 구매 전에 이거부터 보세요`,
    `이거 모르고 샀다가 조금 손해 봤어요`,
    `${nameShort} 이렇게 쓰니까 훨씬 편하더라고요`,
    `${nameShort} 왜 인기인지 써보니까 알겠음`,
    `${nameShort} 처음 사시는 분들 참고하세요`,
    `이 제품 리뷰 5점인 이유가 있었네요`,
    `${nameShort} 한 달 써본 사람의 솔직 후기`,
    `${nameShort} 고민 중이면 이 글부터 읽으시면 됨`,
    `광고 아님. 내돈내산으로 일주일 써본 ${nameShort}`,
    `${nameShort} 쓰자마자 왜 이제 샀나 싶었음`,
    `이 카테고리는 ${nameShort}이 제일 나았던 거 같아요`,
    `${nameShort} 구매 가이드 몇 개만 적어봅니다`,
    `비슷한 거 여러 개 써본 결과 ${nameShort}이었음`,
    `${nameShort} 사용 전과 후가 확실히 다르더라고요`,
    `구매 전 체크할 거 딱 3가지만 말할게요`,
    `솔직히 ${nameShort} 이 가격에 이 퀄리티면 거의 사기 수준`,
    `${nameShort} 한 번 써보니까 다른 건 안 보이더라고요`,
  ];

  const infoCaptions = [
    `${name} 한 달 정도 써보고 솔직히 적어봅니다.\n장점은 ${advantages.join(', ')}이고, 사용감도 괜찮아요.\n단점이라면 사이즈 선택을 신중해야 한다는 정도?\n${price ? `${price}이라면 ` : ""}이 가격대에서는 무난한 선택 같아요.`,
    `${name} 구매 전 체크할 거 3가지:\n1. 어디다 쓸지 확실하게 정하기\n2. 사이즈 한 번 더 확인하기\n3. 다른 제품이랑 가격 비교하기\n${price ? `지금 ${price}이면 ` : ""}적정선인 거 같아요.`,
    `${name} 리얼 사용기 적어봅니다.\n이 분야에서 꿀템으로 통하더라고요.\n${advantages.join(', ')}이 제일 맘에 들었어요.\n이게 왜 인기인지 알겠음.`,
    `${name} 한 달간 꼼꼼하게 써봤어요.\n기대했던 ${advantages.join(', ')} 그대로고,\n${price ? `${price}이라는 가격 대비 ` : ""}만족도 꽤 높아요.\n저는 다음에도 이걸로 살 거 같습니다.`,
    `${name} 구매 고민 중이시면 참고하세요.\n이 제품 좋은 점: ${advantages.join(', ')}, 내구성, 가성비\n그렇게 나쁜 점은 못 찾겠더라고요.\n${price ? `가격도 ${price}로 ` : ""}합리적인 편입니다.`,
    `${name}이랑 비슷한 제품 여러 개 비교해봤어요.\n결론부터 말하면 ${name}이 ${advantages.join(', ')} 면에서 제일 나았어요.\n${price ? `가격도 ${price}라서 ` : ""}무난하게 추천합니다.`,
    `광고 아닙니다. ${name} 내돈내산으로 일주일 써봤어요.\n${advantages.join(', ')} 부분에서 기대 이상이었고,\n${price ? `${price}이라는 가격 대비 ` : ""}퀄리티가 꽤 괜찮아요.\n진짜 만족하고 있습니다.`,
    `${name} 쓰자마자 '왜 이제 샀나' 싶더라고요.\n삶의 질 올려주는 아이템 맞아요.\n${advantages.join(', ')} 제대로 체감하실 수 있을 거에요.`,
  ];

  const viralHooks = [
    `${nameShort} 사지 마세요... 아니 꼭 사세요`,
    `이거 모르면 손해인 제품이 나왔어요`,
    `${nameShort} SNS에서 난리난 이유를 써보니까 알겠음`,
    `제 친구가 ${nameShort} 추천해줬는데...`,
    `이거 보면 ${nameShort} 안 살 수가 없음`,
    `${nameShort} 쓰고 나서 생각이 좀 바뀌었어요`,
    `이 제품 SNS에서 왜 난리인지 알겠더라고요`,
    `${nameShort} 한 번 쓰면 못 빠져나옴`,
    `주변에서 자꾸 어디서 샀냐고 물어봐요`,
    `${nameShort} 이거 진짜 인생템 맞음`,
    `SNS 바이럴 터진 이유가 있었네요`,
    `${nameShort} 소문난 김에 하나 더 샀어요`,
    `이거 쓰기 전과 후가 확실히 다름`,
    `${nameShort} 후기가 터지는 이유가 있었네요`,
    `입소문 난 제품이라서 가져와봤어요`,
    `요즘 이거 모르면 간첩이라면서요? ${nameShort} 드디어 써봄`,
    `내돈내산인데 역대급으로 잘 샀음.. 폼 미친 ${nameShort}`,
    `알고리즘에 계속 떠서 직접 사서 써봤습니다`,
    `고민하다가 품절되는 거 보다 빨리 담으세요`,
  ];

  const viralCaptions = [
    `처음엔 반신반의했는데 ${name} 쓰고 나서 생각 바뀌었어요.\n${advantages.join(', ')}가 실화인 거 ㅠㅠ\n진짜 한 번 써보시는 거 추천합니다.`,
    `${name} 일단 보면 사고 싶어지더라고요.\n${price ? `가격도 ${price}라서 부담 없고, ` : ""}이거 완전 럭키템 인정.\n빨리 가져가시는 게 좋을 거 같아요.`,
    `${name} 소문 난 이유가 있었네요.\n입소문 터진 제품이라더니 진짜였음.\n지금 아니면 다시 품절될 수도 있어요.`,
    `${name} 쓰기 전엔 몰랐어요.\n${advantages.join(', ')}가 이 정도일 줄은...\n이거 안 써보면 손해인 거 아닌가 싶음.`,
    `제 친구가 ${name} 추천해줬는데\n처음엔 별거 아닌 줄 알았거든요?\n써보고 나서 바로 사러 감 ㅋㅋ`,
    `이 제품 SNS에서 난리난 거 진짜 이유가 있어요.\n${name} ${advantages.join(', ')}가 제일 낫더라고요.\n한 번 쓰면 다른 거 못 쓸 수도 있어요.`,
    `요즘 ${name} 모르면 간첩이라면서요?\n직접 써봤는데 ${advantages.join(', ')} 폼이 장난 아님.\n이거 안 쓰면 손해 보는 거 같아요.`,
    `내돈내산으로 ${name} 샀는데 역대급이에요.\n${price ? `${price}이라는 가격이 아까워서 더 열심히 씀. ` : ""}${advantages.join(', ')} 진짜임.\n고민 중이면 일단 사보시는 걸 추천.`,
  ];

  let hooks: string[], captions: string[], hashtags: string[];

  if (data.copyType === "deal") {
    hooks = [...dealHooks];
    captions = [...dealCaptions];
    hashtags = [...baseHashtags, "한정특가", "할인", "공구", "타임세일", ...catHashtags];
  } else if (data.copyType === "info") {
    hooks = [...infoHooks];
    captions = [...infoCaptions];
    hashtags = [...baseHashtags, "리뷰", "꿀템", "구매전략", "현직자추천", ...catHashtags];
  } else {
    hooks = [...viralHooks];
    captions = [...viralCaptions];
    hashtags = [...baseHashtags, "바이럴", "인생템", "SNS난리", "럭키템", "공감", ...catHashtags];
  }

  if (data.localStoreInfo?.enabled && data.localStoreInfo.storeName) {
    const ls = data.localStoreInfo;
    const regionTag = ls.region || '';
    const localHashtags = regionTag
      ? [`${regionTag}맛집`, `${regionTag}카페`, `${regionTag}스토어`, `${regionTag}핫플`, `${regionTag}추천`].slice(0, 3)
      : [];
    const storeNameTag = ls.storeName.replace(/\s/g, '');
    localHashtags.push(storeNameTag, '매장방문', '오늘의혜택');

    const offerSuffix = ls.todayOffer ? `\n${ls.todayOffer}` : '';
    const addrLine = ls.address ? `\n📍 ${ls.address}${ls.phone ? ` · ${ls.phone}` : ''}` : '';

    hooks.unshift(`${ls.storeName} 오늘 방문하면 혜택이 있는 거 아셨나요`);
    hooks.unshift(`${regionTag} 이거 먹으러 오신 분들 여기로 오세요`);
    captions.unshift(`${ls.storeName}에서 ${ls.todayOffer || '오늘 특별한 혜택'} 준비했어요.${addrLine}${offerSuffix}\n직접 매장에서 만나보세요!`);

    hashtags = [...hashtags, ...localHashtags];
  }

  const indices = pickUniqueIndices(hooks.length, count);
  const result: CopyItem[] = indices.map((hi, i) => {
    let hook = hooks[hi];
    let caption = captions[hi % captions.length];
    if (data.platform === "threads") {
      hook = toBanmal(hook);
      caption = toBanmal(caption);
    }
    let iterHashtags = hashtags;
    if (data.platform === "smartstore") {
      const ctaTags = ["스마트스토어", "네이버쇼핑", "오늘의딜", "구매하기"];
      iterHashtags = [...iterHashtags, ...ctaTags];
    }
    return {
      hook,
      caption,
      hashtags: shuffle(iterHashtags).slice(0, 10),
    };
  });
  return result;
}

function toBanmal(text: string): string {
  return text
    .replace(/해요\./g, '한다.')
    .replace(/해요\!/g, '한다!')
    .replace(/해요\n/g, '한다\n')
    .replace(/해요$/g, '한다')
    .replace(/해요, /g, '해서, ')
    .replace(/세요\./g, '라.')
    .replace(/세요\!/g, '라!')
    .replace(/세요\n/g, '라\n')
    .replace(/세요$/g, '라')
    .replace(/습니다\./g, '다.')
    .replace(/습니다\!/g, '다!')
    .replace(/습니다\n/g, '다\n')
    .replace(/습니다$/g, '다')
    .replace(/습니다, /g, '고, ')
    .replace(/어요\./g, '어.')
    .replace(/어요\!/g, '어!')
    .replace(/어요\n/g, '어\n')
    .replace(/어요$/g, '어')
    .replace(/드리고요\./g, '드라고.')
    .replace(/드리고요\!/g, '드라고!')
    .replace(/드리고요\n/g, '드라고\n')
    .replace(/드리고요$/g, '드라고')
    .replace(/거든요\./g, '거든.')
    .replace(/거든요\!/g, '거든!')
    .replace(/거든요\n/g, '거든\n')
    .replace(/거든요$/g, '거든')
    .replace(/나요\?/g, '나?')
    .replace(/을까요\?/g, '을까?')
    .replace(/일까요\?/g, '일까?')
    .replace(/죠\?/g, '지?')
    .replace(/죠\./g, '다.')
    .replace(/죠\!/g, '다!')
    .replace(/죠\n/g, '다\n')
    .replace(/죠$/g, '다')
    .replace(/에요\./g, '다.')
    .replace(/에요\!/g, '다!')
    .replace(/에요\n/g, '다\n')
    .replace(/에요$/g, '다')
    .replace(/예요\./g, '다.')
    .replace(/예요\!/g, '다!')
    .replace(/예요\n/g, '다\n')
    .replace(/예요$/g, '다')
    .replace(/습니다만/g, '지만')
    .replace(/어서요/g, '어서');
}

function categoryHashtags(category: string, name: string): string[] {
  const nameTag = name.replace(/\s/g, "");
  const map: Record<string, string[]> = {
    sneakers: ["스니커즈", "신발추천", "데일리룩", "착붕템"],
    shoes: ["신발추천", "스니커즈", "데일리룩"],
    clothing: ["패션", "옷장필수템", "코디", "데일리룩"],
    jacket: ["아우터", "코디", "패션"],
    lighting: ["조명", "인테리어", "자취방꾸미기", "감성"],
    electronics: ["전자기기", "IT템", "가성비템"],
    beauty: ["뷰티", "스킨케어", "꿀팁"],
    food: ["먹스타그램", "맛집", "푸드"],
    furniture: ["가구", "인테리어", "공간변화"],
  };
  return map[category] || ["아이템", "추천", nameTag];
}

function pickUniqueIndices(poolSize: number, count: number): number[] {
  const indices = Array.from({ length: poolSize }, (_, i) => i);
  return shuffle(indices).slice(0, count);
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
