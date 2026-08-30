import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface CutSegment {
  index: number;
  startTime: number;
  endTime: number;
  type: "highlight" | "transition" | "detail";
  label: string;
}

interface VirtualCutsRequest {
  imageBase64?: string;
  imageUrl?: string;
  totalDuration?: number;
  cutDuration?: number;
  tempo?: "fast" | "medium" | "slow";
  beatSync?: "micro" | "macro" | "off";
  productInfo?: { name?: string; category?: string; description?: string };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body: VirtualCutsRequest = await req.json();
    const tempo = body.tempo ?? "fast";
    const beatSync = body.beatSync ?? "micro";
    const totalDuration = body.totalDuration ?? 15;

    const tempoCutMap: Record<string, number> = {
      fast: 0.8,
      medium: 1.2,
      slow: 1.8,
    };
    const baseCutDuration = body.cutDuration ?? tempoCutMap[tempo] ?? 0.8;

    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    let segments: CutSegment[];
    let aiPowered = false;

    if (openaiKey && body.productInfo) {
      try {
        segments = await generateAICuts(openaiKey, body.productInfo, totalDuration, baseCutDuration, beatSync);
        aiPowered = true;
      } catch {
        segments = generateDeterministicCuts(totalDuration, baseCutDuration, beatSync);
      }
    } else {
      segments = generateDeterministicCuts(totalDuration, baseCutDuration, beatSync);
    }

    return new Response(
      JSON.stringify({ segments, aiPowered, count: segments.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

function generateDeterministicCuts(
  totalDuration: number,
  cutDuration: number,
  beatSync: string,
): CutSegment[] {
  const segments: CutSegment[] = [];
  let cutCount = Math.floor(totalDuration / cutDuration);

  if (beatSync === "macro") {
    cutDuration = cutDuration * 1.5;
    cutCount = Math.floor(totalDuration / cutDuration);
  } else if (beatSync === "off") {
    cutDuration = totalDuration / Math.max(cutCount, 6);
    cutCount = Math.floor(totalDuration / cutDuration);
  }

  const labels: Record<CutSegment["type"], string> = {
    highlight: "하이라이트",
    transition: "전환",
    detail: "디테일",
  };

  for (let i = 0; i < cutCount; i++) {
    const start = i * cutDuration;
    const end = Math.min(start + cutDuration, totalDuration);
    const type: CutSegment["type"] =
      i % 3 === 0 ? "highlight" : i % 3 === 1 ? "transition" : "detail";
    segments.push({
      index: i,
      startTime: Number(start.toFixed(2)),
      endTime: Number(end.toFixed(2)),
      type,
      label: labels[type],
    });
  }

  return segments;
}

async function generateAICuts(
  apiKey: string,
  productInfo: { name?: string; category?: string; description?: string },
  totalDuration: number,
  cutDuration: number,
  beatSync: string,
): Promise<CutSegment[]> {
  const prompt = `You are a short-form video editor. Create a cut list for a ${totalDuration}-second promotional short video about a product.

Product: ${productInfo.name ?? "unknown"}
Category: ${productInfo.category ?? "general"}
Description: ${productInfo.description ?? ""}

Base cut interval: ${cutDuration}s
Beat sync mode: ${beatSync}

Return a JSON array of cut segments. Each segment has:
- index: sequential number starting at 0
- startTime: in seconds (number)
- endTime: in seconds (number)
- type: one of "highlight", "transition", "detail"
- label: a short Korean label for the segment type

Guidelines:
- Start with a strong hook (highlight) in the first 2 seconds
- Place detail segments to showcase product features
- Use transition segments between highlights
- Total duration should not exceed ${totalDuration} seconds
- Return ONLY the JSON array, no other text

Example format:
[{"index":0,"startTime":0,"endTime":0.8,"type":"highlight","label":"오프닝 훅"}]`;

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a professional short-form video editor. Always respond with valid JSON only." },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 2000,
    }),
  });

  if (!resp.ok) {
    throw new Error(`OpenAI API error: ${resp.status}`);
  }

  const data = await resp.json();
  const content = data.choices?.[0]?.message?.content ?? "[]";

  let parsed: CutSegment[];
  try {
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    parsed = JSON.parse(jsonMatch ? jsonMatch[0] : content);
  } catch {
    throw new Error("Failed to parse AI response");
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("AI returned empty or invalid segments");
  }

  return parsed.slice(0, 30).map((seg, i) => ({
    index: seg.index ?? i,
    startTime: Number(seg.startTime?.toFixed(2) ?? i * cutDuration),
    endTime: Number(seg.endTime?.toFixed(2) ?? (i + 1) * cutDuration),
    type: (["highlight", "transition", "detail"].includes(seg.type) ? seg.type : "detail") as CutSegment["type"],
    label: seg.label ?? "컷",
  }));
}
