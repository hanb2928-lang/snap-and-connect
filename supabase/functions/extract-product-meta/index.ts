import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ProductMeta {
  productName: string;
  description: string;
  price: string;
  currency: string;
  image: string;
  url: string;
  platform: string;
  availability: string;
  brand: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { url } = await req.json();
    if (!url || typeof url !== "string") {
      return new Response(
        JSON.stringify({ error: "URL is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let meta: ProductMeta;
    try {
      meta = await fetchAndParse(url);
    } catch {
      meta = {
        productName: "",
        description: "",
        price: "",
        currency: "KRW",
        image: "",
        url,
        platform: detectPlatform(url),
        availability: "",
        brand: "",
      };
    }

    if (!meta.productName && !meta.description) {
      const openaiKey = Deno.env.get("OPENAI_API_KEY");
      if (openaiKey) {
        try {
          meta = await enrichWithAI(url, meta, openaiKey);
        } catch {
          // keep basic meta
        }
      }
    }

    return new Response(
      JSON.stringify({ productMeta: meta }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Extraction failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

function detectPlatform(url: string): string {
  const u = url.toLowerCase();
  if (u.includes("coupang.com")) return "Coupang";
  if (u.includes("smartstore.naver.com") || u.includes("brand.naver.com")) return "Naver";
  if (u.includes("11st.co.kr")) return "11st";
  if (u.includes("gmarket.com")) return "Gmarket";
  if (u.includes("aliexpress.com")) return "AliExpress";
  if (u.includes("amazon.com")) return "Amazon";
  if (u.includes("toss.to")) return "Toss";
  return "Unknown";
}

async function fetchAndParse(url: string): Promise<ProductMeta> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; SnapConnectBot/1.0; +https://snapconnect.app/bot)",
      "Accept": "text/html,application/xhtml+xml",
      "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
    },
    signal: controller.signal,
  });
  clearTimeout(timeoutId);

  if (!response.ok) {
    throw new Error(`Fetch failed: ${response.status}`);
  }

  const html = await response.text();
  return parseHtml(html, url);
}

function parseHtml(html: string, url: string): ProductMeta {
  const platform = detectPlatform(url);

  const getMeta = (property: string): string => {
    const patterns = [
      new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`, "i"),
      new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property}["']`, "i"),
      new RegExp(`<meta[^>]+name=["']${property.replace("og:", "")}["'][^>]+content=["']([^"']+)["']`, "i"),
    ];
    for (const p of patterns) {
      const m = html.match(p);
      if (m?.[1]) return decodeEntities(m[1].trim());
    }
    return "";
  };

  const titleTag = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = titleTag?.[1]?.trim() ? decodeEntities(titleTag[1].trim()) : "";

  let productName = getMeta("og:title") || title || "";
  productName = cleanTitle(productName, platform);

  const description = getMeta("og:description") || getMeta("description") || "";
  const image = getMeta("og:image") || "";
  const siteName = getMeta("og:site_name") || "";

  let price = extractPrice(html, platform);
  let currency = "KRW";
  let availability = extractAvailability(html);
  let brand = extractBrand(html, siteName);

  if (price && price.includes("$")) currency = "USD";
  if (price && price.includes("¥")) currency = "JPY";

  return {
    productName,
    description: description.slice(0, 500),
    price,
    currency,
    image,
    url,
    platform,
    availability,
    brand,
  };
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function cleanTitle(title: string, platform: string): string {
  let clean = title;
  if (platform === "Coupang") {
    clean = clean.replace(/\s*[-:|]\s*쿠팡.*$/i, "").replace(/\s*쿠팡\s*$/i, "");
  } else if (platform === "Naver") {
    clean = clean.replace(/\s*[-:|]\s*네이버.*$/i, "").replace(/\s*네이버\s*$/i, "");
  }
  clean = clean.replace(/\s*\|\s*네이버쇼핑\s*$/i, "");
  clean = clean.replace(/\s*[-:|]\s*11번가\s*$/i, "");
  clean = clean.replace(/\s*[-:|]\s*G마켓\s*$/i, "");
  return clean.trim().slice(0, 200);
}

function extractPrice(html: string, platform: string): string {
  const pricePatterns: RegExp[] = [];

  if (platform === "Coupang") {
    pricePatterns.push(
      /"salePrice"\s*:\s*(\d+)/i,
      /"price"\s*:\s*(\d+)/i,
      /class=["'][^"']*price[^"']*["'][^>]*>.*?(\d[\d,]+)\s*원/si,
    );
  } else if (platform === "Naver") {
    pricePatterns.push(
      /"salePrice"\s*:\s*(\d+)/i,
      /"lowPrice"\s*:\s*(\d+)/i,
      /class=["'][^"']*price[^"']*["'][^>]*>.*?(\d[\d,]+)\s*원/si,
    );
  }

  pricePatterns.push(
    /<meta[^>]+property=["']og:price:amount["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+property=["']product:price:amount["'][^>]+content=["']([^"']+)["']/i,
    /"price"\s*:\s*"?(\d[\d,]*)"?/i,
    /(\d[\d,]+)\s*원/,
  );

  for (const p of pricePatterns) {
    const m = html.match(p);
    if (m?.[1]) {
      const raw = m[1].replace(/,/g, "");
      const num = parseInt(raw, 10);
      if (num > 0) return formatPrice(num);
    }
  }
  return "";
}

function formatPrice(num: number): string {
  return num.toLocaleString("ko-KR") + "원";
}

function extractAvailability(html: string): string {
  const m = html.match(/<meta[^>]+property=["']og:availability["'][^>]+content=["']([^"']+)["']/i)
    || html.match(/"availability"\s*:\s*"([^"]+)"/i);
  return m?.[1] || "";
}

function extractBrand(html: string, siteName: string): string {
  const m = html.match(/<meta[^>]+property=["']og:brand["'][^>]+content=["']([^"']+)["']/i)
    || html.match(/"brand"\s*:\s*"([^"]+)"/i)
    || html.match(/"brandName"\s*:\s*"([^"]+)"/i);
  return m?.[1] || siteName || "";
}

async function enrichWithAI(url: string, basic: ProductMeta, apiKey: string): Promise<ProductMeta> {
  const systemPrompt =
    "You are a product information extractor. Given a URL, infer the most likely product name, category, price range, and key selling points. " +
    "Return ONLY valid JSON with fields: productName, description, price, brand. " +
    "All text in Korean. If you cannot determine a field, leave it empty.";

  const userPrompt = `URL: ${url}\nPlatform: ${basic.platform}\nExtracted title: ${basic.productName}\nReturn product metadata as JSON.`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

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
          { role: "user", content: userPrompt },
        ],
        max_tokens: 500,
        temperature: 0.3,
        response_format: { type: "json_object" },
      }),
    });
    clearTimeout(timeoutId);

    if (!response.ok) return basic;
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) return basic;

    let parsed: Record<string, unknown>;
    try {
      let t = content.trim();
      if (t.startsWith("```")) t = t.replace(/^```[a-zA-Z]*\n?/, "").replace(/```$/, "").trim();
      parsed = JSON.parse(t);
    } catch {
      return basic;
    }

    return {
      ...basic,
      productName: basic.productName || String(parsed.productName || ""),
      description: basic.description || String(parsed.description || ""),
      price: basic.price || String(parsed.price || ""),
      brand: basic.brand || String(parsed.brand || ""),
    };
  } finally {
    clearTimeout(timeoutId);
  }
}
