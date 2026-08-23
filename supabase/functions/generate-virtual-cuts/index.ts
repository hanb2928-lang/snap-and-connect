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
  imageBase64: string;
  mimeType: string;
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

    const cuts = await generateVirtualCuts(sanitizedDataUrl, openaiKey, productName || "", productCategory || "");

    return new Response(
      JSON.stringify({ cuts }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Virtual cut generation failed" }),
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
): Promise<VirtualCut[]> {
  const contextHint = productName || productCategory
    ? ` This is a ${productCategory || 'product'}${productName ? ` called "${productName}"` : ''}.`
    : '';

  const results = await Promise.all(
    CUT_PROMPTS.map(async (cut) => {
      try {
        const b64 = await editWithOpenAI(imageDataUrl, apiKey, cut.prompt + contextHint);
        return {
          angle: cut.angle,
          label: cut.label,
          imageBase64: b64,
          mimeType: 'image/png',
        } satisfies VirtualCut;
      } catch {
        return null;
      }
    }),
  );

  const valid = results.filter((r): r is VirtualCut => r !== null);
  if (valid.length === 0) {
    throw new Error('모든 가상 컷 생성에 실패했습니다');
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
