import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { imageDataUrl, mimeType } = await req.json();

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

    const editedBase64 = await removeBackgroundWithOpenAI(sanitizedDataUrl, openaiKey);

    return new Response(
      JSON.stringify({ imageBase64: editedBase64, mimeType: "image/png" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Background removal failed" }),
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

async function removeBackgroundWithOpenAI(
  imageDataUrl: string,
  apiKey: string,
): Promise<string> {
  const response = await fetch("https://api.openai.com/v1/images/edits", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: buildMultipartForm(imageDataUrl),
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

function buildMultipartForm(imageDataUrl: string): FormData {
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
  formData.append("size", "auto");
  formData.append("background", "transparent");

  return formData;
}
