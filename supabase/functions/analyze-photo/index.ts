import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

interface ContactInfo {
  type: string;
  label: string;
  value: string;
  action?: string;
}

interface ShoppingMatch {
  platform: string;
  productName: string;
  price: string;
  url: string;
}

interface PlatformVariant {
  hook: string;
  caption: string;
  hashtags: string[];
  cardStyle: "magazine" | "bold" | "minimal" | "feed";
}

interface TemplateData {
  priceLabel: string;
  oneLiner: string;
  category: string;
  accentColor: string;
  hook: string;
  hashtags: string[];
  productAdvantages: string[];
  caption: string;
  platformVariants: Record<string, PlatformVariant>;
}

interface DetectedProduct {
  id: string;
  productName: string;
  productCategory: string;
  priceEstimate: string;
  oneLiner: string;
  shoppingMatches: ShoppingMatch[];
  templateData: TemplateData;
}

interface AnalysisResult {
  title: string;
  summary: string;
  contacts: ContactInfo[];
  tags: string[];
  productName: string;
  productCategory: string;
  priceEstimate: string;
  oneLiner: string;
  shoppingMatches: ShoppingMatch[];
  templateData: TemplateData;
  detectedProducts: DetectedProduct[];
}

const DEFAULT_TEMPLATE: TemplateData = {
  priceLabel: "",
  oneLiner: "",
  category: "",
  accentColor: "#2f9dff",
  hook: "",
  hashtags: [],
  productAdvantages: [],
  caption: "",
  platformVariants: {},
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { imageDataUrl, images, fileName, mimeType, mode } = body;

    if (!imageDataUrl && !images) {
      return new Response(
        JSON.stringify({ error: "Image data is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let result: AnalysisResult;

    const cleanMime = mimeType || "image/jpeg";
    const openaiKey = await resolveOpenAIKey();

    if (mode === "multi-shot" && Array.isArray(images) && images.length > 0) {
      const sanitizedImages = images.slice(0, 4).map((url: string) => ensureDataUrl(url, cleanMime));
      if (sanitizedImages.length === 0) {
        return new Response(
          JSON.stringify({ error: "No valid images provided" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (openaiKey) {
        result = await analyzeMultiShotWithOpenAI(sanitizedImages, openaiKey);
      } else {
        result = generateContextualAnalysis(fileName || "snapshot");
      }
    } else {
      if (!imageDataUrl) {
        return new Response(
          JSON.stringify({ error: "Image data is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const sanitizedDataUrl = ensureDataUrl(imageDataUrl, cleanMime);
      const recognitionMode = mode === "single" ? "single" : "multi";
      if (openaiKey) {
        result = await analyzeWithOpenAI(sanitizedDataUrl, cleanMime, openaiKey, recognitionMode);
      } else {
        result = generateContextualAnalysis(fileName || "snapshot");
      }
    }

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Analysis failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

async function resolveOpenAIKey(): Promise<string | null> {
  const serverKey = Deno.env.get("OPENAI_API_KEY");
  if (serverKey) return serverKey;

  if (supabaseUrl && serviceRoleKey) {
    try {
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

async function analyzeWithOpenAI(
  imageDataUrl: string,
  mimeType: string,
  apiKey: string,
  mode: "single" | "multi",
): Promise<AnalysisResult> {
  const isSingle = mode === "single";

  const productInstruction = isSingle
    ? "Identify the SINGLE primary/main product visible in the photo. Focus on the most prominent item. Return a detectedProducts array with exactly ONE element."
    : "Identify ALL distinct products visible in the photo. Return a detectedProducts array with one element per product found. Maximum 4 products — if more than 4 are visible, pick the 4 most prominent and distinct ones. Each product must be genuinely different (not the same item from a different angle).";

  const systemPrompt =
    "You are a viral short-form marketing copywriter and product identification assistant. " +
    "Analyze the photo and identify products, then generate KILLER marketing content for each product.\n" +
    "Return a JSON object with these fields:\n" +
    "- title: short 2-5 word catchy title for the overall scan (in Korean)\n" +
    "- summary: 2-3 sentence description of what's in the photo (in Korean)\n" +
    "- tags: array of 3-6 descriptive single-word tags (mix of Korean and English as appropriate)\n" +
    "- contacts: array of any visible contact info objects with type/label/value\n" +
    "- detectedProducts: ARRAY of objects. Each object must have:\n" +
    "  - id: a short unique identifier (e.g. 'product-1', 'product-2')\n" +
    "  - productName: the identified product name or best guess (e.g. 'Nike Air Force 1')\n" +
    "  - productCategory: category (e.g. sneakers, lamp, jacket, headphones, furniture)\n" +
    "  - priceEstimate: estimated price range in KRW (e.g. '80,000-120,000원')\n" +
    "  - oneLiner: a catchy one-line recommendation in Korean for a short-form post\n" +
    "  - shoppingMatches: array of objects with platform (must be \"BrandConnect\"), productName, price, url\n" +
    "  - templateData: object with ALL of these fields:\n" +
    "    - priceLabel: price string for display\n" +
    "    - oneLiner: the catchy one-liner\n" +
    "    - category: category label in Korean\n" +
    "    - accentColor: hex color matching the product mood (e.g. '#2f9dff')\n" +
    "    - hook: a scroll-stopping hook phrase in Korean (10-20 chars, the kind that makes people stop scrolling). Think curiosity gap + emotional trigger. Examples: '이거 모르면 손해', '다들 이거 사느라 난리남', '가성비 끝판왕 등장', '이 가격에 이 품질?'\n" +
    "    - hashtags: array of 5-8 Korean hashtags WITHOUT the # symbol, optimized for Naver/Instagram search. Mix broad and niche tags. Example: ['착붕템', '가성비', '스니커즈', '신발추천', '옷장필수템', '데일리룩', '오늘뭐입지']\n" +
    "    - productAdvantages: array of 2-4 short Korean phrases describing the product's REAL advantages (e.g. '통화 기능', '가성비', '실용성', '스마트한 일상', '장시간 착용 편안함', '초경량'). Focus on concrete, product-specific benefits — NOT target audience or emotional angle.\n" +
    "    - caption: a full 2-4 line caption in Korean for posting (shortform style). Must include the hook at the start, a brief product recommendation, and end with a call-to-action. Natural, conversational tone like a real influencer post. Do NOT include hashtags in the caption.\n" +
    "    - platformVariants: object with 5 platform-specific variant objects. Each key MUST be exactly \"naverBlog\", \"shortform\", \"instagram\", \"threads\", or \"twitter\":\n" +
    "      - naverBlog: optimized for Naver Blog clip format. hook = a curiosity-driven title (15-30 chars Korean, like a blog post title). caption = 3-5 sentence paragraph in Korean, conversational blog-review style, naturally weaving in the product and a recommendation. hashtags = 8-12 Korean blog SEO keywords WITHOUT # symbol (broader, search-intent focused). cardStyle = \"magazine\"\n" +
    "      - shortform: optimized for TikTok/Reels. hook = scroll-stopping phrase (10-20 chars, punchy and visual). caption = 2-3 short punchy lines in Korean with line breaks, influencer speak, end with a CTA. hashtags = 6-10 mix of trending + niche Korean tags WITHOUT # symbol. cardStyle = \"bold\"\n" +
    "      - instagram: optimized for Instagram feed post (square 1:1). hook = an aesthetically pleasing lifestyle phrase (10-20 chars Korean, emotional and aspirational). caption = 2-3 elegant lines in Korean, lifestyle/influencer tone, with emoji-free visual storytelling. hashtags = 10-15 mix of Korean and English tags WITHOUT # symbol (lifestyle + product + aesthetic tags). cardStyle = \"feed\"\n" +
    "      - twitter: optimized for X/Twitter. hook = a provocative or bold claim (10-20 chars). caption = 1-2 lines max 280 chars in Korean, punchy and shareable. hashtags = 3-5 trending Korean tags WITHOUT # symbol. cardStyle = \"minimal\"\n" +
    "      - threads: optimized for Meta Threads. hook = a conversational, thought-provoking question or statement (10-25 chars Korean). caption = 2-4 lines in Korean, casual and discussion-friendly tone, like sharing a personal discovery. hashtags = 5-8 Korean tags WITHOUT # symbol (conversation-driven). cardStyle = \"minimal\"\n" +
    "    All five variants must feel native to that platform, not copy-pasted with minor edits. Different hooks, different caption lengths, different hashtag strategies.\n" +
    "    Also populate the top-level hook, hashtags, productAdvantages, caption with the SHORTFORM variant's values (since shortform is the default view).\n" +
    productInstruction + "\n" +
    "For shoppingMatches, use the official Naver Brand Connect creator page: https://brandconnect.naver.com/about/creator\n" +
    "Also populate the top-level productName, productCategory, priceEstimate, oneLiner, shoppingMatches, and templateData with the FIRST/primary product's data for backward compatibility.\n" +
    "Return ONLY valid JSON, no markdown.";

  const userContent: Array<{ type: string; text?: string; image_url?: { url: string; detail: string } }> = [
    {
      type: "text",
      text: isSingle
        ? "Identify the single primary product in this image. Generate viral marketing copy, hashtags, and short-form template data for it. Return the detectedProducts array with one element."
        : "Identify ALL distinct products in this image. For each product, generate viral marketing copy, hashtags, and short-form template data. Return the detectedProducts array.",
    },
    { type: "image_url", image_url: { url: imageDataUrl, detail: isSingle ? "low" : "high" } },
  ];

  return callOpenAIWithRetry(systemPrompt, userContent, apiKey, isSingle ? 1600 : 3200);
}

async function analyzeMultiShotWithOpenAI(
  imageDataUrls: string[],
  apiKey: string,
): Promise<AnalysisResult> {
  const systemPrompt =
    "You are a viral short-form marketing copywriter and product identification assistant. " +
    "You are given MULTIPLE photos of the SAME product taken from different angles. " +
    "Analyze ALL photos together to get a comprehensive understanding of the product — its design, material, features, brand, and details visible from different sides.\n" +
    "Then generate KILLER marketing content for this ONE product.\n" +
    "Return a JSON object with these fields:\n" +
    "- title: short 2-5 word catchy title for the product (in Korean)\n" +
    "- summary: 2-3 sentence description combining what you see across all angles (in Korean)\n" +
    "- tags: array of 3-6 descriptive single-word tags (mix of Korean and English as appropriate)\n" +
    "- contacts: array of any visible contact info objects with type/label/value\n" +
    "- productName: the identified product name or best guess\n" +
    "- productCategory: category (e.g. sneakers, lamp, jacket, headphones, furniture)\n" +
    "- priceEstimate: estimated price range in KRW (e.g. '80,000-120,000원')\n" +
    "- oneLiner: a catchy one-line recommendation in Korean for a short-form post\n" +
    "- shoppingMatches: array of objects with platform (must be \"BrandConnect\"), productName, price, url\n" +
    "- templateData: object with ALL of these fields:\n" +
    "  - priceLabel: price string for display\n" +
    "  - oneLiner: the catchy one-liner\n" +
    "  - category: category label in Korean\n" +
    "  - accentColor: hex color matching the product mood (e.g. '#2f9dff')\n" +
    "  - hook: a scroll-stopping hook phrase in Korean (10-20 chars, the kind that makes people stop scrolling). Think curiosity gap + emotional trigger. Examples: '이거 모르면 손해', '다들 이거 사느라 난리남', '가성비 끝판왕 등장', '이 가격에 이 품질?'\n" +
    "  - hashtags: array of 5-8 Korean hashtags WITHOUT the # symbol, optimized for Naver/Instagram search. Mix broad and niche tags. Example: ['착붕템', '가성비', '스니커즈', '신발추천', '옷장필수템', '데일리룩', '오늘뭐입지']\n" +
    "  - productAdvantages: array of 2-4 short Korean phrases describing the product's REAL advantages (e.g. '통화 기능', '가성비', '실용성', '스마트한 일상', '장시간 착용 편안함', '초경량'). Focus on concrete, product-specific benefits — NOT target audience or emotional angle.\n" +
    "  - caption: a full 2-4 line caption in Korean for posting (shortform style). Must include the hook at the start, a brief product recommendation, and end with a call-to-action. Natural, conversational tone like a real influencer post. Do NOT include hashtags in the caption.\n" +
    "  - platformVariants: object with 5 platform-specific variant objects. Each key MUST be exactly \"naverBlog\", \"shortform\", \"instagram\", \"threads\", or \"twitter\":\n" +
    "    - naverBlog: optimized for Naver Blog clip format. hook = a curiosity-driven title (15-30 chars Korean, like a blog post title). caption = 3-5 sentence paragraph in Korean, conversational blog-review style, naturally weaving in the product and a recommendation. hashtags = 8-12 Korean blog SEO keywords WITHOUT # symbol (broader, search-intent focused). cardStyle = \"magazine\"\n" +
    "    - shortform: optimized for TikTok/Reels. hook = scroll-stopping phrase (10-20 chars, punchy and visual). caption = 2-3 short punchy lines in Korean with line breaks, influencer speak, end with a CTA. hashtags = 6-10 mix of trending + niche Korean tags WITHOUT # symbol. cardStyle = \"bold\"\n" +
    "    - instagram: optimized for Instagram feed post (square 1:1). hook = an aesthetically pleasing lifestyle phrase (10-20 chars Korean, emotional and aspirational). caption = 2-3 elegant lines in Korean, lifestyle/influencer tone, with emoji-free visual storytelling. hashtags = 10-15 mix of Korean and English tags WITHOUT # symbol (lifestyle + product + aesthetic tags). cardStyle = \"feed\"\n" +
    "    - twitter: optimized for X/Twitter. hook = a provocative or bold claim (10-20 chars). caption = 1-2 lines max 280 chars in Korean, punchy and shareable. hashtags = 3-5 trending Korean tags WITHOUT # symbol. cardStyle = \"minimal\"\n" +
    "    - threads: optimized for Meta Threads. hook = a conversational, thought-provoking question or statement (10-25 chars Korean). caption = 2-4 lines in Korean, casual and discussion-friendly tone, like sharing a personal discovery. hashtags = 5-8 Korean tags WITHOUT # symbol (conversation-driven). cardStyle = \"minimal\"\n" +
    "  All five variants must feel native to that platform, not copy-pasted with minor edits. Different hooks, different caption lengths, different hashtag strategies.\n" +
    "  Also populate the top-level hook, hashtags, productAdvantages, caption with the SHORTFORM variant's values (since shortform is the default view).\n" +
    "Also populate detectedProducts as an array with exactly ONE element using the same product data (for backward compatibility).\n" +
    "For shoppingMatches, use the official Naver Brand Connect creator page: https://brandconnect.naver.com/about/creator\n" +
    "Return ONLY valid JSON, no markdown.";

  const userContent: Array<{ type: string; text?: string; image_url?: { url: string; detail: string } }> = [
    {
      type: "text",
      text: `These ${imageDataUrls.length} photos show the SAME product from different angles. Analyze all of them together to identify the product comprehensively, then generate viral marketing copy, hashtags, and short-form template data for this single product.`,
    },
    ...imageDataUrls.map((url) => ({
      type: "image_url",
      image_url: { url, detail: "low" as const },
    })),
  ];

  const result = await callOpenAIWithRetry(systemPrompt, userContent, apiKey, 3200);
  return result;
}

async function callOpenAIWithRetry(
  systemPrompt: string,
  userContent: Array<{ type: string; text?: string; image_url?: { url: string; detail: string } }>,
  apiKey: string,
  maxTokens: number,
): Promise<AnalysisResult> {
  const MAX_RETRIES = 2;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
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
          max_tokens: maxTokens,
          temperature: 0.7,
          response_format: { type: "json_object" },
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        const err = new Error(`OpenAI API error: ${response.status} - ${errText}`);
        if (response.status >= 500 && attempt < MAX_RETRIES) {
          lastError = err;
          clearTimeout(timeout);
          await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
          continue;
        }
        throw err;
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      if (!content) throw new Error("No content returned from OpenAI");

      const finishReason = data.choices?.[0]?.finish_reason;
      if (finishReason === "length") {
        const retryController = new AbortController();
        const retryTimeout = setTimeout(() => retryController.abort(), 55000);
        try {
          const retryResponse = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
            signal: retryController.signal,
            body: JSON.stringify({
              model: "gpt-4o-mini",
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userContent },
                { role: "assistant", content },
                { role: "user", content: "Continue and complete the JSON. Return only the remaining fields." },
              ],
              max_tokens: 1600,
              temperature: 0.7,
              response_format: { type: "json_object" },
            }),
          });
          if (retryResponse.ok) {
            const retryData = await retryResponse.json();
            const retryContent = retryData.choices?.[0]?.message?.content;
            if (retryContent) {
              try {
                const base = JSON.parse(content);
                try {
                  const ext = JSON.parse(retryContent);
                  return normalizeResult({ ...base, ...ext });
                } catch {
                  return normalizeResult(base);
                }
              } catch {
                try {
                  return normalizeResult(JSON.parse(retryContent));
                } catch {
                  // retry content wasn't valid JSON either
                }
              }
            }
          }
        } catch {
          // retry failed, try parsing original content
        } finally {
          clearTimeout(retryTimeout);
        }
      }

      try {
        const parsed = JSON.parse(content);
        return normalizeResult(parsed);
      } catch {
        return normalizeResult({});
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        lastError = new Error("AI 분석 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.");
        if (attempt < MAX_RETRIES) {
          clearTimeout(timeout);
          await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
          continue;
        }
        throw lastError;
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError || new Error("AI 분석에 실패했습니다. 잠시 후 다시 시도해주세요.");
}

function normalizeTemplate(raw: Record<string, unknown> | undefined, fallback: Partial<TemplateData>): TemplateData {
  const td = (raw || {}) as Record<string, unknown>;
  return {
    priceLabel: String(td.priceLabel || fallback.priceLabel || ""),
    oneLiner: String(td.oneLiner || fallback.oneLiner || ""),
    category: String(td.category || fallback.category || ""),
    accentColor: String(td.accentColor || fallback.accentColor || "#2f9dff"),
    hook: String(td.hook || fallback.hook || ""),
    hashtags: Array.isArray(td.hashtags) ? td.hashtags.map(String) : (Array.isArray(fallback.hashtags) ? fallback.hashtags : []),
    productAdvantages: Array.isArray(td.productAdvantages) ? td.productAdvantages.map(String).filter(Boolean) : (Array.isArray(fallback.productAdvantages) ? fallback.productAdvantages : []),
    caption: String(td.caption || fallback.caption || ""),
    platformVariants: normalizePlatformVariants(td.platformVariants, {
      hook: String(td.hook || fallback.hook || ""),
      caption: String(td.caption || fallback.caption || ""),
      hashtags: Array.isArray(td.hashtags) ? td.hashtags.map(String) : (Array.isArray(fallback.hashtags) ? fallback.hashtags : []),
    }),
  };
}

function normalizePlatformVariants(
  raw: unknown,
  defaults: { hook: string; caption: string; hashtags: string[] },
): Record<string, PlatformVariant> {
  if (!raw || typeof raw !== "object") {
    const fallback: PlatformVariant = {
      hook: defaults.hook,
      caption: defaults.caption,
      hashtags: defaults.hashtags,
      cardStyle: "bold",
    };
    return {
      naverBlog: { ...fallback, cardStyle: "magazine" },
      shortform: { ...fallback, cardStyle: "bold" },
      instagram: { ...fallback, cardStyle: "feed" },
      threads: { ...fallback, cardStyle: "minimal" },
      twitter: { ...fallback, cardStyle: "minimal" },
    };
  }

  const obj = raw as Record<string, unknown>;
  const result: Record<string, PlatformVariant> = {};

  for (const key of ["naverBlog", "shortform", "instagram", "threads", "twitter"]) {
    const v = obj[key] as Record<string, unknown> | undefined;
    if (v) {
      result[key] = {
        hook: String(v.hook || defaults.hook),
        caption: String(v.caption || defaults.caption),
        hashtags: Array.isArray(v.hashtags) ? v.hashtags.map(String) : defaults.hashtags,
        cardStyle: (String(v.cardStyle || "bold") === "magazine" || String(v.cardStyle || "bold") === "minimal" || String(v.cardStyle || "bold") === "feed")
          ? String(v.cardStyle) as "magazine" | "minimal" | "feed" : "bold",
      };
    } else {
      const styleMap: Record<string, "magazine" | "bold" | "minimal" | "feed"> = {
        naverBlog: "magazine",
        shortform: "bold",
        instagram: "feed",
        threads: "minimal",
        twitter: "minimal",
      };
      result[key] = {
        hook: defaults.hook,
        caption: defaults.caption,
        hashtags: defaults.hashtags,
        cardStyle: styleMap[key],
      };
    }
  }

  return result;
}

function normalizeResult(raw: Record<string, unknown>): AnalysisResult {
  const productName = String(raw.productName || raw.product_name || "");
  const productCategory = String(raw.productCategory || raw.product_category || "product");
  const priceEstimate = String(raw.priceEstimate || raw.price_estimate || "");
  const oneLiner = String(raw.oneLiner || raw.one_liner || "");
  const rawMatches = Array.isArray(raw.shoppingMatches) ? raw.shoppingMatches as ShoppingMatch[] : [];
  const shoppingMatches: ShoppingMatch[] = rawMatches.length > 0
    ? rawMatches.slice(0, 1).map((m) => {
        const url = String(m?.url || "");
        return {
          platform: "BrandConnect" as const,
          productName: String(m?.productName || ""),
          price: String(m?.price || ""),
          url: url.includes("brandconnect.naver.com") || url.includes("brand.naver.com")
            ? url
            : "https://brandconnect.naver.com/about/creator",
        };
      })
    : [];
  const templateData = normalizeTemplate(raw.templateData as Record<string, unknown>, {
    priceLabel: priceEstimate,
    oneLiner,
    category: productCategory,
  });

  const rawProducts = Array.isArray(raw.detectedProducts) ? raw.detectedProducts as Record<string, unknown>[] : [];

  const detectedProducts: DetectedProduct[] = rawProducts.length > 0
    ? rawProducts.slice(0, 4).map((p, i) => ({
        id: String(p.id || `product-${i + 1}`),
        productName: String(p.productName || p.product_name || ""),
        productCategory: String(p.productCategory || p.product_category || "product"),
        priceEstimate: String(p.priceEstimate || p.price_estimate || ""),
        oneLiner: String(p.oneLiner || p.one_liner || ""),
        shoppingMatches: Array.isArray(p.shoppingMatches) ? (p.shoppingMatches as ShoppingMatch[]).slice(0, 1).map((m) => {
          const url = String(m?.url || "");
          return {
            platform: "BrandConnect" as const,
            productName: String(m?.productName || ""),
            price: String(m?.price || ""),
            url: url.includes("brandconnect.naver.com") || url.includes("brand.naver.com")
              ? url
              : "https://brandconnect.naver.com/about/creator",
          };
        }) : [],
        templateData: normalizeTemplate(p.templateData as Record<string, unknown>, {
          priceLabel: String(p.priceEstimate || ""),
          oneLiner: String(p.oneLiner || ""),
          category: String(p.productCategory || ""),
        }),
      }))
    : [{
        id: "product-1",
        productName,
        productCategory,
        priceEstimate,
        oneLiner,
        shoppingMatches,
        templateData,
      }];

  return {
    title: String(raw.title || "Product Captured"),
    summary: String(raw.summary || ""),
    contacts: Array.isArray(raw.contacts) ? raw.contacts as ContactInfo[] : [],
    tags: Array.isArray(raw.tags) ? raw.tags as string[] : [],
    productName,
    productCategory,
    priceEstimate,
    oneLiner,
    shoppingMatches,
    templateData,
    detectedProducts,
  };
}

function ensureDataUrl(imageDataUrl: string, mimeType: string): string {
  if (!imageDataUrl) return "";

  const trimmed = imageDataUrl.trim().replace(/\s/g, "");

  if (trimmed.startsWith("data:")) {
    return trimmed;
  }

  return `data:${mimeType};base64,${trimmed}`;
}

function generateContextualAnalysis(fileName: string): AnalysisResult {
  const now = new Date();
  const dateLabel = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  const base = fileName.toLowerCase();
  let title = "Product Captured";
  let summary = `A photo was captured on ${dateLabel}. `;
  const tags: string[] = ["product", "shopping"];
  const contacts: ContactInfo[] = [];
  let productName = "";
  let productCategory = "product";
  let priceEstimate = "";
  let oneLiner = "";
  const shoppingMatches: ShoppingMatch[] = [];
  let hook = "";
  let hashtags: string[] = [];
  let productAdvantages: string[] = [];
  let caption = "";

  if (base.includes("shoe") || base.includes("sneaker") || base.includes("신발")) {
    title = "스니커즈 매치";
    productCategory = "sneakers";
    productName = "Athletic Sneakers";
    priceEstimate = "50,000-150,000원";
    oneLiner = "이 신발, 착붕템 인정!";
    hook = "다들 이거 사느라 난리남";
    hashtags = ["착붕템", "스니커즈", "신발추천", "가성비", "데일리룩", "스타일링"];
    productAdvantages = ["가성비", "스타일링", "데일리 착용감"];
    caption = "다들 이거 사느라 난리남\n지금 가장 핫한 신발, 내 발에 딱 맞는 핏까지\n구매 링크에서 확인해보세요.";
    summary = `A pair of sneakers was captured on ${dateLabel}. `;
    tags.push("sneakers", "fashion", "footwear");
  } else if (base.includes("lamp") || base.includes("light") || base.includes("조명")) {
    title = "조명 매치";
    productCategory = "lighting";
    productName = "Modern Desk Lamp";
    priceEstimate = "20,000-80,000원";
    oneLiner = "공간의 분위기를 바꾸는 조명";
    hook = "방 분위기 확 바뀜";
    hashtags = ["조명", "인테리어", "자취방꾸미기", "감성", "데스크조명", "공간변화"];
    productAdvantages = ["감성 인테리어", "공간 변화", "조명 효과"];
    caption = "방 분위기 확 바뀜\n이 조명 하나로 공간이 완전히 달라져요\n지금 바로 확인해보세요.";
    summary = `A lighting fixture was captured on ${dateLabel}. `;
    tags.push("lamp", "lighting", "interior");
  } else if (base.includes("cloth") || base.includes("jacket") || base.includes("shirt") || base.includes("옷")) {
    title = "패션 매치";
    productCategory = "clothing";
    productName = "Stylish Jacket";
    priceEstimate = "30,000-200,000원";
    oneLiner = "이번 코디, 완벽해!";
    hook = "이거 입고 나갔더면 칭찬 빵빵";
    hashtags = ["패션", "아우터", "코디", "데일리룩", "가성비옷", "옷장필수템"];
    productAdvantages = ["코디 완성", "가성비", "트렌드 디자인"];
    caption = "이거 입고 나갔더니 칭찬 빵빵\n이번 시즌 완벽한 코디 완성템\n구매 링크에서 만나보세요.";
    summary = `A clothing item was captured on ${dateLabel}. `;
    tags.push("fashion", "clothing", "style");
  } else {
    productName = "Identified Product";
    priceEstimate = "가격 정보 필요";
    oneLiner = "이 아이템, 주목해!";
    hook = "이거 모르면 손해";
    hashtags = ["아이템", "추천", "쇼핑"];
    productAdvantages = ["실용성", "가성비"];
    caption = "이거 모르면 손해\n사진 한 장으로 바로 만날 수 있어요\n잠시 후 다시 시도하면 풀버전 마케팅 카드가 생성됩니다.";
    summary += "AI 분석이 일시적으로 비활성화되었습니다. 잠시 후 다시 시도해주세요.";
    tags.push("item", "capture");
    contacts.push(
      { type: "note", label: "AI 분석 준비 중", value: "AI 분석이 일시적으로 비활성화되었습니다. 잠시 후 다시 시도해주세요.", action: "retry" },
    );
  }

  if (productName && productName !== "Identified Product") {
    const encodedQuery = encodeURIComponent(productName);
    shoppingMatches.push(
      { platform: "BrandConnect", productName, price: priceEstimate, url: "https://brandconnect.naver.com/about/creator" },
    );
  }

  const accentColors: Record<string, string> = {
    sneakers: "#2f9dff",
    lighting: "#f59e0b",
    clothing: "#06b3d4",
    product: "#2f9dff",
  };

  const td: TemplateData = {
    priceLabel: priceEstimate,
    oneLiner,
    category: productCategory,
    accentColor: accentColors[productCategory] || "#2f9dff",
    hook,
    hashtags,
    productAdvantages,
    caption,
    platformVariants: {
      naverBlog: {
        hook: hook + " — 후기",
        caption: caption + "\n이 제품을 직접 사용해보니, 기대했던 것 이상이었습니다. 디자인부터 성능까지 만족스러운 부지기수예요. 비슷한 제품을 찾고 계셨다면 이걸로 정하셔도 후회 없으실 겁니다. 가격대도 합리적이라 추천할 만한 아이템입니다.",
        hashtags: [...hashtags, "리뷰", "추천템", "후기"],
        cardStyle: "magazine",
      },
      shortform: {
        hook,
        caption,
        hashtags,
        cardStyle: "bold",
      },
      instagram: {
        hook: hook + " ✨",
        caption: `${oneLiner}\n${caption.split('\n')[0]}\n${priceEstimate ? `가격대 ${priceEstimate}` : ''}`,
        hashtags: [...hashtags, "ootd", "lifestyle", "daily"],
        cardStyle: "feed",
      },
      twitter: {
        hook: hook + "인정",
        caption: `${oneLiner} ${priceEstimate ? `가격대 ${priceEstimate}.` : ""} 지금 확인하세요.`,
        hashtags: hashtags.slice(0, 4),
        cardStyle: "minimal",
      },
      threads: {
        hook: hook + " — 진짜였음",
        caption: `${oneLiner}\n${caption.split('\n')[0]}\n${priceEstimate ? `가격대 ${priceEstimate}` : ''}\n직접 써보니 이해되는 맛이 있어요.`,
        hashtags: [...hashtags.slice(0, 6), "스레드", "일상"],
        cardStyle: "minimal",
      },
    },
  };

  return {
    title,
    summary,
    contacts,
    tags,
    productName,
    productCategory,
    priceEstimate,
    oneLiner,
    shoppingMatches,
    templateData: td,
    detectedProducts: [{
      id: "product-1",
      productName,
      productCategory,
      priceEstimate,
      oneLiner,
      shoppingMatches,
      templateData: td,
    }],
  };
}
