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
  imageUrl: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const raw = await req.json();
    const imageDataUrl = String(raw?.imageDataUrl ?? '');
    const mimeType = String(raw?.mimeType ?? 'image/jpeg');
    const productName = String(raw?.productName ?? '');
    const productCategory = String(raw?.productCategory ?? '');

    if (!imageDataUrl) {
      return new Response(
        JSON.stringify({ error: "Image data is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const cleanMime = mimeType;
    const sanitizedDataUrl = ensureDataUrl(imageDataUrl, cleanMime);

    const openaiKey = await resolveOpenAIKey();
    if (!openaiKey) {
      return new Response(
        JSON.stringify({ error: "OpenAI API 키가 설정되지 않았습니다. 설정에서 API 키를 입력하세요." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { results, failedCount, totalRequested } = await generateFittingImages(
      sanitizedDataUrl,
      openaiKey,
      productName || "",
      productCategory || "",
    );

    return new Response(
      JSON.stringify({ results, failedCount, totalRequested }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Virtual fitting failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

async function uploadToStorage(b64: string, mimeType: string): Promise<string> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) throw new Error("Storage not configured");

  const ext = mimeType === "image/png" ? "png" : "jpg";
  const fileName = `fitting-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: mimeType });

  const uploadResp = await fetch(`${supabaseUrl}/storage/v1/object/scans/${fileName}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": mimeType,
    },
    body: blob,
  });

  if (!uploadResp.ok) {
    const errText = await uploadResp.text();
    throw new Error(`Storage upload failed: ${uploadResp.status} ${errText}`);
  }

  return `${supabaseUrl}/storage/v1/object/public/scans/${fileName}`;
}

function ensureDataUrl(imageDataUrl: string, mimeType: string): string {
  if (!imageDataUrl) return "";
  const trimmed = imageDataUrl.trim().replace(/\s/g, "");
  if (trimmed.startsWith("data:")) {
    const match = trimmed.match(/^data:([^;,]+);base64,(.+)$/s);
    if (match) {
      const [, declaredMime, b64] = match;
      const detectedMime = detectImageMime(b64);
      if (detectedMime) return `data:${detectedMime};base64,${b64}`;
      if (declaredMime.startsWith("image/")) return trimmed;
    }
    return trimmed;
  }
  const detectedMime = detectImageMime(trimmed);
  return `data:${detectedMime || mimeType};base64,${trimmed}`;
}

function detectImageMime(b64: string): string | null {
  const clean = b64.replace(/\s/g, "");
  if (clean.startsWith("iVBORw0KGgo")) return "image/png";
  if (clean.startsWith("/9j/")) return "image/jpeg";
  if (clean.startsWith("R0lGOD")) return "image/gif";
  if (clean.startsWith("UklGR")) return "image/webp";
  return null;
}

async function resolveOpenAIKey(): Promise<string | null> {
  const serverKey = Deno.env.get("OPENAI_API_KEY");
  if (serverKey) return serverKey;

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (supabaseUrl && serviceRoleKey) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const resp = await fetch(`${supabaseUrl}/rest/v1/user_settings?select=openai_api_key&id=eq.1`, {
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
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
): Promise<{ results: FittingResult[]; failedCount: number; totalRequested: number }> {
  const contextHint = productName || productCategory
    ? ` This is a ${productCategory || 'fashion/beauty product'}${productName ? ` called "${productName}"` : ''}.`
    : ' This is a fashion or beauty product.';

  const results = await Promise.all(
    MODEL_PRESETS.map(async (preset) => {
      try {
        const b64 = await editWithOpenAI(imageDataUrl, apiKey, preset.prompt + contextHint);
        const imageUrl = await uploadToStorage(b64, 'image/png');
        return {
          modelType: preset.type,
          label: preset.label,
          imageUrl,
        } satisfies FittingResult;
      } catch (err) {
        console.error(`Fitting ${preset.type} failed:`, err instanceof Error ? err.message : String(err));
        return null;
      }
    }),
  );

  const valid = results.filter((r): r is FittingResult => r !== null);
  if (valid.length === 0) {
    throw new Error('모든 가상 피팅 생성에 실패했습니다. OpenAI API 키를 확인하거나 이미지를 다시 시도해주세요.');
  }
  return { results: valid, failedCount: results.length - valid.length, totalRequested: results.length };
}

async function editWithOpenAI(
  imageDataUrl: string,
  apiKey: string,
  prompt: string,
): Promise<string> {
  const maxRetries = 1;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const formData = buildMultipartForm(imageDataUrl, prompt);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 90000);

    try {
      const response = await fetch("https://api.openai.com/v1/images/edits", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        signal: controller.signal,
        body: formData,
      });

      if (!response.ok) {
        const errText = await response.text();
        if (response.status >= 500 && attempt < maxRetries) {
          lastError = new Error(`OpenAI Image API error: ${response.status} - ${errText}`);
          await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
          continue;
        }
        throw new Error(`OpenAI Image API error: ${response.status} - ${errText}`);
      }

      const data = await response.json();
      const b64 = data.data?.[0]?.b64_json;
      if (!b64) throw new Error("No image returned from OpenAI");
      return b64;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (err instanceof Error && err.name === 'AbortError' && attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
        continue;
      }
      if (err instanceof Error && err.message.startsWith('OpenAI Image API error: 5') && attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
        continue;
      }
      throw lastError;
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError ?? new Error("OpenAI API request failed");
}

function buildMultipartForm(imageDataUrl: string, prompt: string): FormData {
  const formData = new FormData();

  let base64Data = "";
  let mimeType = "image/png";

  const commaIdx = imageDataUrl.indexOf(",");
  if (imageDataUrl.startsWith("data:") && commaIdx > 0) {
    const header = imageDataUrl.slice(5, commaIdx);
    base64Data = imageDataUrl.slice(commaIdx + 1).replace(/\s/g, "");
    if (header.includes("base64")) {
      const declaredMime = header.split(";")[0];
      if (declaredMime.startsWith("image/")) {
        mimeType = declaredMime;
      } else {
        const detected = detectImageMime(base64Data);
        if (detected) mimeType = detected;
      }
    }
  } else {
    const clean = imageDataUrl.trim().replace(/\s/g, "");
    const detected = detectImageMime(clean);
    if (detected) mimeType = detected;
    base64Data = clean;
  }

  if (!base64Data) throw new Error("Invalid image data: empty base64");

  const detectedFromData = detectImageMime(base64Data);
  if (detectedFromData) mimeType = detectedFromData;

  const ext = mimeType === "image/jpeg" ? "jpg" : mimeType.split("/")[1] || "png";

  const binary = atob(base64Data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  const blob = new Blob([bytes], { type: mimeType });
  formData.append("image", blob, `input.${ext}`);
  formData.append("model", "gpt-image-1");
  formData.append("size", "1024x1536");
  formData.append("prompt", prompt);

  return formData;
}
