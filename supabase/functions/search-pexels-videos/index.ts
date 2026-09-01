import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface PexelsVideoFile {
  id: number;
  quality: string;
  file_type: string;
  width: number;
  height: number;
  fps: number;
  link: string;
}

interface PexelsVideoResult {
  id: number;
  width: number;
  height: number;
  duration: number;
  user: { name: string };
  video_files: PexelsVideoFile[];
  video_pictures: { id: number; picture: string; nr: number }[];
  image: string;
}

interface PexelsVideoResponse {
  page: number;
  per_page: number;
  total_results: number;
  videos: PexelsVideoResult[];
}

export interface StockVideoClip {
  id: number;
  duration: number;
  width: number;
  height: number;
  previewUrl: string;
  thumbnailUrl: string;
  videoUrl: string;
  author: string;
  ratio: string;
}

async function resolvePexelsKey(): Promise<string | null> {
  const envKey = Deno.env.get("PEXELS_API_KEY");
  if (envKey) return envKey;

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (supabaseUrl && serviceRoleKey) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const resp = await fetch(
        `${supabaseUrl}/rest/v1/user_settings?select=pexels_api_key&order=updated_at.desc&limit=1`,
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
        const rows = await resp.json() as Array<{ pexels_api_key: string | null }>;
        const dbKey = rows[0]?.pexels_api_key;
        if (dbKey) return dbKey;
      }
    } catch {
      // ignore — no key found
    }
  }
  return null;
}

function pickBestFile(files: PexelsVideoFile[], targetOrientation: string): PexelsVideoFile | null {
  const vertical = targetOrientation === "portrait";
  const sorted = [...files].sort((a, b) => {
    const aScore = vertical ? a.height / Math.max(a.width, 1) : a.width / Math.max(a.height, 1);
    const bScore = vertical ? b.height / Math.max(b.width, 1) : b.width / Math.max(b.height, 1);
    return bScore - aScore;
  });
  const hd = sorted.find((f) => f.quality === "hd" || f.quality === "sd");
  return hd ?? sorted[0] ?? null;
}

function buildRatio(width: number, height: number): string {
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const d = gcd(width, height);
  return `${width / d}:${height / d}`;
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
    const body = await req.json();
    const { query, orientation, perPage } = body as {
      query?: string;
      orientation?: string;
      perPage?: number;
    };

    if (!query || typeof query !== "string" || query.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "검색어가 필요합니다." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const apiKey = await resolvePexelsKey();
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "Pexels API 키가 설정되지 않았습니다." }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const params = new URLSearchParams({
      query: query.trim(),
      per_page: String(Math.min(Math.max(perPage ?? 10, 1), 20)),
    });
    if (orientation === "portrait" || orientation === "landscape" || orientation === "square") {
      params.set("orientation", orientation);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    const resp = await fetch(`https://api.pexels.com/videos/search?${params.toString()}`, {
      headers: { Authorization: apiKey },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!resp.ok) {
      const errText = await resp.text();
      return new Response(
        JSON.stringify({ error: `Pexels API 오류: ${resp.status} - ${errText}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data = (await resp.json()) as PexelsVideoResponse;
    const targetOrientation = params.get("orientation") ?? "landscape";

    const clips: StockVideoClip[] = data.videos
      .filter((v) => v.video_files && v.video_files.length > 0)
      .map((v) => {
        const bestFile = pickBestFile(v.video_files, targetOrientation);
        return {
          id: v.id,
          duration: v.duration,
          width: bestFile?.width ?? v.width,
          height: bestFile?.height ?? v.height,
          previewUrl: v.image,
          thumbnailUrl: v.video_pictures?.[0]?.picture ?? v.image,
          videoUrl: bestFile?.link ?? v.video_files[0]?.link ?? "",
          author: v.user?.name ?? "Unknown",
          ratio: buildRatio(bestFile?.width ?? v.width, bestFile?.height ?? v.height),
        };
      })
      .filter((c) => c.videoUrl.length > 0);

    return new Response(
      JSON.stringify({ clips, totalResults: data.total_results }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "영상 검색에 실패했습니다." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
