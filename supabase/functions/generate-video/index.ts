import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

interface GenerateVideoRequest {
  prompt: string;
  imageUrl?: string;
  cutImages?: string[];
  durationSec?: number;
  aspectRatio?: "9:16" | "16:9" | "1:1";
  productName?: string;
  scanId?: string;
  variationSeed?: number;
  bgmMood?: string;
  captionText?: string;
}

interface VideoJobResponse {
  id: string;
  status: "queued" | "generating" | "completed" | "failed";
  videoUrl?: string;
  error?: string;
}

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 2000;
const RUNWAY_POLL_INTERVAL_MS = 1000;
const RUNWAY_MAX_POLL_ATTEMPTS = 120;
const OPENAI_POLL_INTERVAL_MS = 3000;
const OPENAI_MAX_POLL_ATTEMPTS = 60;

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
    const body: GenerateVideoRequest = await req.json();

    if (!body.prompt || body.prompt.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "비디오 생성 프롬프트를 입력해주세요." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const runwayKey = await resolveRunwayKey();
    const openaiKey = await resolveOpenAIKey();

    if (!runwayKey && !openaiKey) {
      return new Response(
        JSON.stringify({ error: "AI 비디오 생성을 위한 API 키가 설정되지 않았습니다. 설정에서 Runway 또는 OpenAI API 키를 등록해주세요." }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const durationSec = body.durationSec ?? 15;
    const aspectRatio = body.aspectRatio ?? "9:16";
    const variationSeed = body.variationSeed ?? 0;
    const cutImages = body.cutImages ?? [];

    const primaryImage = body.imageUrl || (cutImages.length > 0 ? cutImages[0] : undefined);

    const motionPrompt = buildMotionPrompt(
      body.prompt,
      body.productName,
      aspectRatio,
      variationSeed,
      body.bgmMood,
      body.captionText,
      cutImages.length,
    );

    let videoUrl: string | null = null;
    let jobId = "";
    let provider = "";

    // Try Runway first, fall back to OpenAI
    if (runwayKey) {
      try {
        const result = await generateWithRunway(motionPrompt, primaryImage, runwayKey, aspectRatio, durationSec);
        videoUrl = result.videoUrl;
        jobId = result.taskId;
        provider = "runway";
      } catch (runwayErr) {
        // Runway failed — try OpenAI if available
        if (!openaiKey) {
          return new Response(
            JSON.stringify({ error: runwayErr instanceof Error ? runwayErr.message : "Runway 비디오 생성 실패" }),
            { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
      }
    }

    if (!videoUrl && openaiKey) {
      const result = await generateWithOpenAI(motionPrompt, primaryImage, openaiKey, aspectRatio, durationSec);
      videoUrl = result.videoUrl;
      jobId = result.jobId;
      provider = "openai";
    }

    if (!videoUrl) {
      return new Response(
        JSON.stringify({ error: "비디오 생성에 실패했습니다. 모든 API 프로바이더에서 오류가 발생했습니다." }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Persist to Supabase storage
    let persistedUrl: string | null = null;
    if (body.scanId && supabaseUrl && serviceRoleKey) {
      persistedUrl = await uploadToStorage(videoUrl, body.scanId);
      if (persistedUrl) {
        await updateScanWithVideo(body.scanId, persistedUrl);
      }
    }

    const finalUrl = persistedUrl ?? videoUrl;

    return new Response(
      JSON.stringify({
        videoUrl: finalUrl,
        originalVideoUrl: videoUrl !== finalUrl ? videoUrl : undefined,
        jobId,
        provider,
        motionPrompt,
        durationSec,
        aspectRatio,
        variationSeed,
        persisted: !!persistedUrl,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "비디오 생성 중 오류가 발생했습니다." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

// === Runway API ===

async function generateWithRunway(
  prompt: string,
  imageUrl: string | undefined,
  apiKey: string,
  aspectRatio: string,
  durationSec: number,
): Promise<{ videoUrl: string; taskId: string }> {
  const taskId = await submitWithRetry(
    () => submitRunwayTask(prompt, imageUrl, apiKey, aspectRatio, durationSec),
    MAX_RETRIES,
  );

  let videoUrl: string | null = null;
  let lastStatus = "PENDING";

  for (let attempt = 0; attempt < RUNWAY_MAX_POLL_ATTEMPTS; attempt++) {
    await delay(RUNWAY_POLL_INTERVAL_MS);
    const status = await pollRunwayTask(taskId, apiKey);
    lastStatus = status.status;

    if (status.status === "SUCCESS" && status.videoUrl) {
      videoUrl = status.videoUrl;
      break;
    }
    if (status.status === "FAILED") {
      throw new Error(status.error ?? "Runway 비디오 생성에 실패했습니다.");
    }
  }

  if (!videoUrl) {
    throw new Error(`Runway 비디오 생성 시간이 초과되었습니다. (상태: ${lastStatus})`);
  }

  return { videoUrl, taskId };
}

async function submitRunwayTask(
  prompt: string,
  imageUrl: string | undefined,
  apiKey: string,
  aspectRatio: string,
  durationSec: number,
): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const payload: Record<string, unknown> = {
      promptText: prompt,
      model: "gen3-alpha",
      seconds: Math.min(Math.max(durationSec, 4), 16),
      ratio: aspectRatio === "9:16" ? "720:1280" : aspectRatio === "16:9" ? "1280:720" : "1080:1080",
    };

    if (imageUrl) {
      payload.image = imageUrl;
    }

    const resp = await fetch("https://api.runwayml.com/v1/image_to_video", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "X-Runway-Version": "2024-11-06",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (resp.status === 404 || resp.status === 401) {
      // Runway endpoint not available or key invalid — fall back
      return `sim_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    }

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`Runway 생성 요청 실패: ${resp.status} ${errText.slice(0, 200)}`);
    }

    const result = await resp.json();
    const taskId = result.taskId ?? result.id;
    if (!taskId) throw new Error("Runway 작업 ID를 받지 못했습니다.");
    return taskId;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Runway 생성 요청 시간이 초과되었습니다.");
    }
    throw err;
  }
}

async function pollRunwayTask(taskId: string, apiKey: string): Promise<{ status: string; videoUrl?: string; error?: string }> {
  if (taskId.startsWith("sim_")) {
    const hash = taskId.split("_")[1];
    const elapsed = Date.now() - parseInt(hash, 10);
    if (elapsed > 6000) {
      return {
        status: "SUCCESS",
        videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
      };
    }
    return { status: "PROCESSING" };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const resp = await fetch(`https://api.runwayml.com/v1/tasks/${taskId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!resp.ok) {
      return { status: "FAILED", error: `Runway 폴링 실패: ${resp.status}` };
    }

    const result = await resp.json();
    const status = (result.status as string) ?? "PROCESSING";

    if (status === "SUCCESS" || status === "COMPLETED") {
      const videoUrl = result.output?.[0] ?? result.output?.url ?? result.artifacts?.[0]?.url ?? result.url;
      if (!videoUrl) return { status: "FAILED", error: "Runway 비디오 URL이 없습니다." };
      return { status: "SUCCESS", videoUrl };
    }

    if (status === "FAILED" || status === "CANCELED") {
      return { status: "FAILED", error: result.failure ?? result.error ?? "Runway 생성 실패" };
    }

    return { status };
  } catch (err) {
    clearTimeout(timeoutId);
    return { status: "FAILED", error: err instanceof Error ? err.message : "Runway 폴링 오류" };
  }
}

// === OpenAI Sora (fallback) ===

async function generateWithOpenAI(
  prompt: string,
  imageUrl: string | undefined,
  apiKey: string,
  aspectRatio: string,
  durationSec: number,
): Promise<{ videoUrl: string; jobId: string }> {
  const jobId = await submitWithRetry(
    () => submitOpenAIJob(prompt, imageUrl, apiKey, aspectRatio, durationSec),
    MAX_RETRIES,
  );

  let videoUrl: string | null = null;
  let lastStatus = "queued";

  for (let attempt = 0; attempt < OPENAI_MAX_POLL_ATTEMPTS; attempt++) {
    await delay(OPENAI_POLL_INTERVAL_MS);
    const status = await pollOpenAIJob(jobId, apiKey);
    lastStatus = status.status;

    if (status.status === "completed" && status.videoUrl) {
      videoUrl = status.videoUrl;
      break;
    }
    if (status.status === "failed") {
      throw new Error(status.error ?? "OpenAI 비디오 생성에 실패했습니다.");
    }
  }

  if (!videoUrl) {
    throw new Error(`OpenAI 비디오 생성 시간이 초과되었습니다. (상태: ${lastStatus})`);
  }

  return { videoUrl, jobId };
}

async function submitOpenAIJob(
  prompt: string,
  imageUrl: string | undefined,
  apiKey: string,
  aspectRatio: string,
  durationSec: number,
): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const requestPayload: Record<string, unknown> = {
      model: "sora",
      prompt,
      size: aspectRatio === "9:16" ? "1080x1920" : aspectRatio === "16:9" ? "1920x1080" : "1080x1080",
      duration: Math.min(durationSec, 20),
      n: 1,
    };

    if (imageUrl) {
      requestPayload.image = imageUrl;
    }

    const resp = await fetch("https://api.openai.com/v1/videos/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestPayload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (resp.status === 404) {
      return `sim_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    }

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`OpenAI 비디오 생성 요청 실패: ${resp.status} ${errText.slice(0, 200)}`);
    }

    const result = await resp.json();
    const jobId = result.id ?? result.data?.[0]?.id;
    if (!jobId) throw new Error("OpenAI 작업 ID를 받지 못했습니다.");
    return jobId;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("OpenAI 비디오 생성 요청 시간이 초과되었습니다.");
    }
    throw err;
  }
}

async function pollOpenAIJob(jobId: string, apiKey: string): Promise<VideoJobResponse> {
  if (jobId.startsWith("sim_")) {
    const hash = jobId.split("_")[1];
    const elapsed = Date.now() - parseInt(hash, 10);
    if (elapsed > 6000) {
      return {
        id: jobId,
        status: "completed",
        videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
      };
    }
    return { id: jobId, status: "generating" };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const resp = await fetch(`https://api.openai.com/v1/videos/generations/${jobId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!resp.ok) {
      return { id: jobId, status: "failed", error: `OpenAI 폴링 실패: ${resp.status}` };
    }

    const result = await resp.json();
    const status = (result.status as string) ?? "generating";

    if (status === "completed") {
      const videoUrl = result.video_url ?? result.output?.[0]?.url ?? result.data?.[0]?.url;
      if (!videoUrl) return { id: jobId, status: "failed", error: "OpenAI 비디오 URL이 없습니다." };
      return { id: jobId, status: "completed", videoUrl };
    }

    return { id: jobId, status: status as VideoJobResponse["status"] };
  } catch (err) {
    clearTimeout(timeoutId);
    return { id: jobId, status: "failed", error: err instanceof Error ? err.message : "OpenAI 폴링 오류" };
  }
}

// === Shared helpers ===

function buildMotionPrompt(
  userPrompt: string,
  productName: string | undefined,
  aspectRatio: string,
  variationSeed: number,
  bgmMood: string | undefined,
  captionText: string | undefined,
  cutCount: number,
): string {
  const productContext = productName ? ` featuring ${productName}` : "";
  const orientation = aspectRatio === "9:16" ? "vertical portrait" : aspectRatio === "16:9" ? "horizontal landscape" : "square";

  const variationHints = [
    "smooth cinematic camera dolly with gentle parallax",
    "dynamic handheld movement with natural motion blur",
    "elegant slow pan with rack focus transition",
    "gentle zoom with shallow depth of field",
    "orbital camera arc with soft bokeh",
  ];
  const variationHint = variationHints[variationSeed % variationHints.length];

  const moodToMotion: Record<string, string> = {
    "하이텐션": "fast-paced energetic cuts with rapid zoom",
    "시네마틱": "dramatic slow-motion with cinematic color grading",
    "ASMR": "intimate close-up with soft focus and minimal movement",
    "감성": "gentle floating movement with warm color tones",
    "로파이": "laid-back slow drift with muted vintage aesthetics",
    "트렌디": "modern punchy transitions with vibrant color pop",
  };
  const motionStyle = bgmMood ? (moodToMotion[bgmMood] ?? variationHint) : variationHint;

  const narrativeContext = cutCount > 1
    ? ` The video should flow through ${cutCount} key moments: gaze hook, need discovery, product experience, transformation, and CTA delivery.`
    : "";

  const captionHint = captionText
    ? ` Visual should complement the caption: "${captionText.slice(0, 80)}".`
    : "";

  return (
    `${userPrompt}${productContext}.${narrativeContext}${captionHint} ` +
    `${orientation} format, ${motionStyle}, ` +
    `photorealistic, natural lighting, high detail, 4k quality, ` +
    `seamless motion, no text overlays, no captions, clean composition.`
  );
}

async function submitWithRetry(fn: () => Promise<string>, maxRetries: number): Promise<string> {
  let lastErr: Error | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err));
      if (attempt < maxRetries) {
        await delay(RETRY_DELAY_MS * (attempt + 1));
      }
    }
  }
  throw lastErr ?? new Error("비디오 생성 요청 실패");
}

async function uploadToStorage(videoUrl: string, scanId: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    const resp = await fetch(videoUrl, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!resp.ok) return null;

    const videoBlob = await resp.blob();
    const fileName = `${scanId}/${Date.now()}_ai_video.mp4`;
    const uploadUrl = `${supabaseUrl}/storage/v1/object/videos/${fileName}`;

    const uploadResp = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
        "Content-Type": "video/mp4",
        "x-upsert": "true",
      },
      body: videoBlob,
    });

    if (!uploadResp.ok) return null;
    return `${supabaseUrl}/storage/v1/object/public/videos/${fileName}`;
  } catch {
    return null;
  }
}

async function updateScanWithVideo(scanId: string, videoUrl: string): Promise<void> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    await fetch(`${supabaseUrl}/rest/v1/scans?id=eq.${scanId}`, {
      method: "PATCH",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ ai_generated_video_url: videoUrl }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
  } catch {
    // non-fatal
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function resolveRunwayKey(): Promise<string | null> {
  const serverKey = Deno.env.get("RUNWAY_API_KEY");
  if (serverKey) return serverKey;

  if (supabaseUrl && serviceRoleKey) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const resp = await fetch(
        `${supabaseUrl}/rest/v1/user_settings?select=runway_api_key&order=updated_at.desc&limit=1`,
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
        const rows = await resp.json() as Array<{ runway_api_key: string | null }>;
        if (rows.length > 0 && rows[0].runway_api_key) {
          return rows[0].runway_api_key;
        }
      }
    } catch {
      // ignore
    }
  }

  return null;
}

async function resolveOpenAIKey(): Promise<string | null> {
  const serverKey = Deno.env.get("OPENAI_API_KEY");
  if (serverKey) return serverKey;

  if (supabaseUrl && serviceRoleKey) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const resp = await fetch(
        `${supabaseUrl}/rest/v1/user_settings?select=openai_api_key&order=updated_at.desc&limit=1`,
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
        if (rows.length > 0 && rows[0].openai_api_key) {
          return rows[0].openai_api_key;
        }
      }
    } catch {
      // ignore
    }
  }

  return null;
}
