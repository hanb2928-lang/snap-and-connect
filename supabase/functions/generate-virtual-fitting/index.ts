import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface FittingRequest {
  imageDataUrl: string;
  mimeType?: string;
  productName?: string;
  productCategory?: string;
}

type ModelType = 'asian-female-young' | 'asian-male-young' | 'western-female' | 'western-male' | 'asian-female-30s' | 'asian-male-30s';

interface FittingResult {
  modelType: ModelType;
  label: string;
  imageBase64: string;
  mimeType: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { imageDataUrl, mimeType, productName, productCategory } = await req.json() as FittingRequest;

    if (!imageDataUrl) {
      return new Response(
        JSON.stringify({ error: "Image data is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const cleanMime = mimeType || "image/jpeg";
    const sanitizedDataUrl = ensureDataUrl(imageDataUrl, cleanMime);

    const openaiKey = await resolveOpenAIKey();
    if (!openaiKey) {
      return new Response(
        JSON.stringify({ error: "OpenAI API 키가 설정되지 않았습니다. 설정에서 API 키를 입력하세요." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const results = await generateFittingImages(
      sanitizedDataUrl,
      openaiKey,
      productName || "",
      productCategory || "",
    );

    return new Response(
      JSON.stringify({ results }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Virtual fitting failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

function ensureDataUrl(imageDataUrl: string, mimeType: string): string {
  if (!imageDataUrl) return "";
  const trimmed = imageDataUrl.trim().replace(/\s/g, "");
  if (trimmed.startsWith("data:")) return trimmed;
  return `data:${mimeType};base64,${trimmed}`;
}

async function resolveOpenAIKey(): Promise<string | null> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

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
      // fall through to env var
    }
  }
  return Deno.env.get("OPENAI_API_KEY") ?? null;
}

const MODEL_PRESETS: { type: ModelType; label: string; prompt: string }[] = [
  {
    type: 'asian-female-young',
    label: '아시아 여성 20대',
    prompt: 'A young Asian woman in her early 20s wearing this product, professional fashion photography, natural lighting, clean studio background, full body shot, fashion catalog style',
  },
  {
    type: 'asian-male-young',
    label: '아시아 남성 20대',
    prompt: 'A young Asian man in his early 20s wearing this product, professional fashion photography, natural lighting, clean studio background, full body shot, fashion catalog style',
  },
  {
    type: 'western-female',
    label: '서양 여성',
    prompt: 'A Caucasian woman in her 20s wearing this product, professional fashion photography, soft natural lighting, clean studio background, full body shot, fashion catalog style',
  },
  {
    type: 'asian-female-30s',
    label: '아시아 여성 30대',
    prompt: 'An Asian woman in her 30s wearing this product, professional fashion photography, warm natural lighting, clean studio background, full body shot, elegant fashion catalog style',
  },
];

async function generateFittingImages(
  imageDataUrl: string,
  apiKey: string,
  productName: string,
  productCategory: string,
): Promise<FittingResult[]> {
  const contextHint = productName || productCategory
    ? ` This is a ${productCategory || 'fashion/beauty product'}${productName ? ` called "${productName}"` : ''}.`
    : ' This is a fashion or beauty product.';

  const results = await Promise.all(
    MODEL_PRESETS.map(async (preset) => {
      try {
        const b64 = await editWithOpenAI(imageDataUrl, apiKey, preset.prompt + contextHint);
        return {
          modelType: preset.type,
          label: preset.label,
          imageBase64: b64,
          mimeType: 'image/png',
        } satisfies FittingResult;
      } catch {
        return null;
      }
    }),
  );

  const valid = results.filter((r): r is FittingResult => r !== null);
  if (valid.length === 0) {
    throw new Error('모든 가상 피팅 생성에 실패했습니다');
  }
  return valid;
}

async function editWithOpenAI(
  imageDataUrl: string,
  apiKey: string,
  prompt: string,
): Promise<string> {
  const formData = buildMultipartForm(imageDataUrl, prompt);

  const response = await fetch("https://api.openai.com/v1/images/edits", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenAI Image API error: ${response.status} - ${errText}`);
  }

  const data = await response.json();
  const b64 = data.data?.[0]?.b64_json;
  if (!b64) throw new Error("No image returned from OpenAI");
  return b64;
}

function buildMultipartForm(imageDataUrl: string, prompt: string): FormData {
  const formData = new FormData();

  const base64Match = imageDataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
  if (!base64Match) throw new Error("Invalid image data URL");

  const ext = base64Match[1] === "png" ? "png" : "jpg";
  const base64Data = base64Match[2];
  const binary = atob(base64Data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  const blob = new Blob([bytes], { type: `image/${ext}` });
  formData.append("image", blob, `input.${ext}`);
  formData.append("model", "gpt-image-1");
  formData.append("size", "1024x1024");
  formData.append("prompt", prompt);

  return formData;
}
