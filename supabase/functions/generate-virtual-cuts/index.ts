import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface CutRequest {
  imageDataUrl: string;
  mimeType?: string;
  productName?: string;
  productCategory?: string;
}

type CutAngle = 'front' | 'side' | 'detail' | 'full';

interface VirtualCut {
  angle: CutAngle;
  label: string;
  imageUrl: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { imageDataUrl, mimeType, productName, productCategory } = await req.json() as CutRequest;

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

    const { cuts, failedCount, totalRequested } = await generateVirtualCuts(
      sanitizedDataUrl, openaiKey, productName || "", productCategory || "",
    );

    return new Response(
      JSON.stringify({ cuts, failedCount, totalRequested }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Virtual cut generation failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

async function uploadToStorage(b64: string, mimeType: string): Promise<string> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) throw new Error("Storage not configured");

  const ext = mimeType === "image/png" ? "png" : "jpg";
  const fileName = `cut-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

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

const CUT_PROMPTS: { angle: CutAngle; label: string; prompt: string }[] = [
  {
    angle: 'front',
    label: '정면 컷',
    prompt: 'Show this product from a direct front-facing angle, centered, well-lit, professional product photography style, clean composition',
  },
  {
    angle: 'side',
    label: '측면 줌인',
    prompt: 'Show this product from a 45-degree side angle, highlighting its profile and depth, professional product photography, soft studio lighting',
  },
  {
    angle: 'detail',
    label: '디테일 클로즈업',
    prompt: 'Create a close-up detail shot of this product, focusing on texture and material quality, macro product photography, shallow depth of field',
  },
  {
    angle: 'full',
    label: '전체 풀샷',
    prompt: 'Show this product as a full scene shot with the product in context, professional lifestyle product photography, natural lighting, wider composition',
  },
];

async function generateVirtualCuts(
  imageDataUrl: string,
  apiKey: string,
  productName: string,
  productCategory: string,
): Promise<{ cuts: VirtualCut[]; failedCount: number; totalRequested: number }> {
  const contextHint = productName || productCategory
    ? ` This is a ${productCategory || 'product'}${productName ? ` called "${productName}"` : ''}.`
    : '';

  const results = await Promise.all(
    CUT_PROMPTS.map(async (cut) => {
      try {
        const b64 = await editWithOpenAI(imageDataUrl, apiKey, cut.prompt + contextHint);
        const imageUrl = await uploadToStorage(b64, 'image/png');
        return {
          angle: cut.angle,
          label: cut.label,
          imageUrl,
        } satisfies VirtualCut;
      } catch (err) {
        console.error(`Cut ${cut.angle} failed:`, err instanceof Error ? err.message : String(err));
        return null;
      }
    }),
  );

  const valid = results.filter((r): r is VirtualCut => r !== null);
  if (valid.length === 0) {
    throw new Error('모든 가상 컷 생성에 실패했습니다. OpenAI API 키를 확인하거나 이미지를 다시 시도해주세요.');
  }
  return { cuts: valid, failedCount: results.length - valid.length, totalRequested: results.length };
}

async function editWithOpenAI(
  imageDataUrl: string,
  apiKey: string,
  prompt: string,
): Promise<string> {
  const maxRetries = 2;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const formData = buildMultipartForm(imageDataUrl, prompt);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120000);

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
      if (attempt < maxRetries) {
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

  const base64Match = imageDataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
  if (!base64Match) throw new Error("Invalid image data URL");

  const imgFormat = base64Match[1];
  const mimeType = `image/${imgFormat}`;
  const ext = imgFormat === "jpeg" ? "jpg" : imgFormat;

  const base64Data = base64Match[2];
  const binary = atob(base64Data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  const blob = new Blob([bytes], { type: mimeType });
  formData.append("image", blob, `input.${ext}`);
  formData.append("model", "gpt-image-1");
  formData.append("size", "auto");
  formData.append("prompt", prompt);

  return formData;
}
