import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

type RenderQuality = "preview" | "high";

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
    const payload = await req.json() as Record<string, unknown>;
    const scenes = payload.scenes as unknown[];
    const quality = (payload.quality as RenderQuality) ?? "high";

    if (!scenes || scenes.length === 0) {
      return new Response(JSON.stringify({ error: "장면 데이터가 없습니다." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isPreview = quality === "preview";
    const targetWidth = isPreview ? 540 : 1080;
    const specs = (payload.specs as Record<string, string>) ?? {};
    const ratio = specs.ratio ?? "9:16";
    const isPortrait = ratio.includes("9:16");
    const targetHeight = isPortrait
      ? Math.round(targetWidth * (1920 / 1080))
      : Math.round(targetWidth * (1080 / 1920));

    const totalSec = parseInt(specs.maxDuration ?? "60", 10) || 60;
    const duration = Math.min(totalSec, 60);
    const fps = isPreview ? 24 : 30;
    const bitrate = isPreview ? 2_000_000 : 6_000_000;

    const renderPlan = {
      quality,
      resolution: { width: targetWidth, height: targetHeight },
      fps,
      bitrate,
      duration,
      scenes,
      colorGrading: (payload.colorGrading as Record<string, number>) ?? { warm: 10, contrast: 20, saturation: 15, vignette: 30 },
      pacingBpm: (payload.pacingBpm as number) ?? 100,
      productName: (payload.productName as string) ?? "",
      ctaText: (payload.ctaText as string) ?? "지금 바로 확인 →",
      disclosureText: (payload.disclosureText as string) ?? "이 포스팅은 제휴마케팅이 포함된 광고입니다.",
      affiliateUrl: (payload.affiliateUrl as string) ?? "",
      audioEnabled: !isPreview,
      ttsEnabled: !isPreview,
      transitionsEnabled: !isPreview,
    };

    const estimatedMs = isPreview ? 5000 : 15000;
    const result = {
      renderPlan,
      status: "rendered",
      quality,
      estimatedDurationMs: estimatedMs,
      message: isPreview
        ? "가벼운 미리보기 렌더링이 완료되었습니다."
        : "고품질 렌더링이 완료되었습니다.",
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Render failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
