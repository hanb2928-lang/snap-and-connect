import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

interface BatchTTSItem {
  languageCode: string;
  text: string;
  voice: string;
  instructions?: string;
  speed?: number;
}

interface BatchTTSRequest {
  items: BatchTTSItem[];
}

interface BatchTTSResult {
  languageCode: string;
  audioBase64: string;
  mimeType: string;
  duration: number;
  error?: string;
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
    const body: BatchTTSRequest = await req.json();

    if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
      return new Response(
        JSON.stringify({ error: "items array is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (body.items.length > 12) {
      return new Response(
        JSON.stringify({ error: "Maximum 12 TTS items per batch" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const openaiKey = await resolveOpenAIKey();
    if (!openaiKey) {
      return new Response(
        JSON.stringify({ error: "OpenAI API key not configured. TTS is unavailable." }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const CONCURRENCY = 3;
    const results: BatchTTSResult[] = new Array(body.items.length);

    for (let i = 0; i < body.items.length; i += CONCURRENCY) {
      const batch = body.items.slice(i, i + CONCURRENCY);
      const batchResults = await Promise.all(
        batch.map(async (item, idx): Promise<BatchTTSResult> => {
          const itemIndex = i + idx;
          try {
            const text = item.text.slice(0, 500);
            if (!text.trim()) {
              return { languageCode: item.languageCode, audioBase64: "", mimeType: "audio/mpeg", duration: 0, error: "Empty text" };
            }

            const speed = Math.min(Math.max(item.speed || 1.0, 0.5), 2.0);
            const ttsBody: Record<string, unknown> = {
              model: "gpt-4o-mini-tts",
              input: text,
              voice: item.voice,
              speed: speed,
              response_format: "mp3",
            };
            if (item.instructions?.trim()) {
              ttsBody.instructions = item.instructions.trim();
            }

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000);
            const ttsResponse = await fetch("https://api.openai.com/v1/audio/speech", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${openaiKey}`,
              },
              body: JSON.stringify(ttsBody),
              signal: controller.signal,
            });
            clearTimeout(timeoutId);

            if (!ttsResponse.ok) {
              return { languageCode: item.languageCode, audioBase64: "", mimeType: "audio/mpeg", duration: 0, error: `TTS error: ${ttsResponse.status}` };
            }

            const audioBuffer = await ttsResponse.arrayBuffer();
            const bytes = new Uint8Array(audioBuffer);
            let binary = "";
            const chunk = 0x8000;
            for (let j = 0; j < bytes.length; j += chunk) {
              binary += String.fromCharCode(...bytes.subarray(j, j + chunk));
            }
            const base64Audio = btoa(binary);

            return {
              languageCode: item.languageCode,
              audioBase64: base64Audio,
              mimeType: "audio/mpeg",
              duration: estimateDuration(text, speed),
            };
          } catch (err) {
            const msg = err instanceof Error && err.name === 'AbortError'
              ? 'TTS timeout'
              : err instanceof Error ? err.message : "TTS generation failed";
            return {
              languageCode: item.languageCode,
              audioBase64: "",
              mimeType: "audio/mpeg",
              duration: 0,
              error: msg,
            };
          }
        }),
      );
      for (let k = 0; k < batchResults.length; k++) {
        results[i + k] = batchResults[k];
      }
    }

    return new Response(
      JSON.stringify({ results }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Batch TTS failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

function estimateDuration(text: string, speed: number): number {
  const charsPerSecond = 12 * speed;
  return Math.max(Math.ceil(text.length / charsPerSecond), 1);
}

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
