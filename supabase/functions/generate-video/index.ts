import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

interface ProductVisionData {
  productName: string;
  productCategory: string;
  visualFeatures: string[];
  marketingPoints: string[];
  textureDescription: string;
  colorPalette: string[];
  shapeDescription: string;
  materialGuess: string;
  keyAngles: { angle: string; description: string }[];
  orbitalFocusPoint: string;
  parallaxDepthLayers: string[];
  suggestedCopyLayers: { primary: string; secondary: string; tertiary: string };
}

interface GenerateVideoRequest {
  mode?: "submit" | "poll" | "webhook" | "runway-submit";
  taskId?: string;
  prompt?: string;
  runwayPrompt?: string;
  durationSec?: number;
  aspectRatio?: "9:16" | "16:9" | "1:1";
  productName?: string;
  scanId?: string;
  variationSeed?: number;
  bgmMood?: string;
  captionText?: string;
  platform?: string;
  hookCategory?: string;
  cutCount?: number;
  productVision?: ProductVisionData | null;
  draft?: boolean;
  isCleanVideoMode?: boolean;
  promptStrength?: number;
  negativePrompt?: string;
  bgStyle?: string;
  outfitIntensity?: number;
  zoomSpeed?: number;
  cameraRotation?: number;
  transitionEffect?: string;
  hdUpscale?: boolean;
  qualityTier?: 'standard' | 'pro';
  resolution?: string;
  fps?: number;
  // webhook fields (sent by Runway callback)
  status?: string;
  output?: string[] | { url?: string } | string;
  failure?: string;
  error?: string;
}

const MAX_RETRIES = 3; // Max retry attempts for transient API errors (4 total attempts)
const RETRY_INITIAL_DELAY_MS = 1500; // Base delay for first retry, doubled each attempt
const RUNWAY_SUBMIT_TIMEOUT_MS = 20000;
const RUNWAY_POLL_TIMEOUT_MS = 10000;
const EDGE_WALL_CLOCK_BUDGET_MS = 120000;
const ZOMBIE_JOB_TIMEOUT_MS = 600000; // 10 minutes — jobs exceeding this in PENDING/PROCESSING are auto-failed
const SERVER_POLL_MAX_ATTEMPTS = 60; // ~10 min of polling with jitter, covers 2-4 min Runway renders + HD upscale + retries
const SERVER_POLL_INITIAL_DELAY_MS = 4000;
const SERVER_POLL_MAX_DELAY_MS = 15000;
const SERVER_POLL_SELF_INVOKE_TIMEOUT_MS = 15000; // AbortController timeout for self-reinvocation fetch
const JITTER_MAX_MS = 2000; // Random jitter added to each backoff delay to desynchronize concurrent polls
const VIDEO_DAILY_LIMIT = 10; // Max AI video generations per IP per day

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
    const url = new URL(req.url);
    const queryMode = url.searchParams.get("mode");

    let body: GenerateVideoRequest;
    if (queryMode === "webhook") {
      body = {
        mode: "webhook",
        taskId: url.searchParams.get("taskId") ?? undefined,
        scanId: url.searchParams.get("scanId") ?? undefined,
      };
      const contentType = req.headers.get("content-type") ?? "";
      if (contentType.includes("application/json")) {
        try {
          const jsonBody = await req.json();
          body.status = jsonBody.status;
          body.output = jsonBody.output;
          body.failure = jsonBody.failure;
          body.error = jsonBody.error;
        } catch {
          // Runway may send form-encoded or empty body
        }
      }
      return await handleWebhook(body);
    }

    body = await req.json();
    const mode = body.mode ?? "submit";

    // Validate required fields per mode
    const validModes = ["submit", "poll", "server-poll", "webhook", "runway-submit"];
    if (!validModes.includes(mode)) {
      return new Response(
        JSON.stringify({ error: `지원하지 않는 모드입니다: ${mode}`, step: "validation", provider: "unknown" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (mode === "submit") {
      // At least one of prompt, scanId, productName, or productVision must be present
      const hasAnyContext = body.prompt || body.scanId || body.productName || body.productVision;
      if (!hasAnyContext) {
        return new Response(
          JSON.stringify({ error: "prompt, scanId, productName 중 하나 이상은 필수입니다.", step: "validation", provider: "unknown" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // Rate limit: max VIDEO_DAILY_LIMIT submissions per IP per day
      const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
      const rateLimitOk = await checkRateLimit(clientIp);
      if (!rateLimitOk) {
        return new Response(
          JSON.stringify({
            error: `일일 AI 비디오 생성 한도(${VIDEO_DAILY_LIMIT}회)를 초과했습니다. 내일 다시 이용해주세요.`,
            step: "rate_limit",
            provider: "none",
          }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // runway-submit mode needs the Runway key to call the API
    if (mode === "runway-submit") {
      const runwayKey = await resolveRunwayKey();
      if (!runwayKey) {
        return new Response(
          JSON.stringify({ error: "Runway API 키가 설정되지 않았습니다.", step: "key_resolution", provider: "none" }),
          { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      return await handleRunwaySubmit(body, runwayKey);
    }

    // poll and server-poll need the Runway key to poll the Runway API
    if (mode === "poll" || mode === "server-poll") {
      const runwayKey = await resolveRunwayKey();
      if (!runwayKey) {
        return new Response(
          JSON.stringify({
            error: "AI 비디오 생성을 위한 Runway API 키가 설정되지 않았습니다. 설정에서 Runway API 키를 등록해주세요.",
            step: "key_resolution",
            provider: "none",
          }),
          { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (mode === "poll") return await handlePoll(body, runwayKey);
      return await handleServerPoll(body, runwayKey);
    }

    return await handleSubmit(body);
  } catch (err) {
    console.error("[generate-video] Unhandled error:", err);
    return new Response(
      JSON.stringify({
        error: "비디오 생성 중 오류가 발생했습니다.",
        step: "unhandled",
        provider: "unknown",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

async function handleSubmit(body: GenerateVideoRequest): Promise<Response> {
  console.log("[generate-video] Submit payload:", JSON.stringify({
    promptLength: body.prompt?.length ?? 0,
    durationSec: body.durationSec,
    aspectRatio: body.aspectRatio,
    productName: body.productName,
    scanId: body.scanId,
    variationSeed: body.variationSeed,
    hasProductVision: !!body.productVision,
  }));

  let effectivePrompt = body.prompt ?? "";
  if (effectivePrompt.trim().length === 0) {
    effectivePrompt = buildAutoPrompt(body.productName, body.productVision, body.captionText, body.isCleanVideoMode === true);
  }

  const isDraft = body.draft === true;
  const requestedDuration = Math.min(Math.max(Math.round(body.durationSec ?? 5), 2), 10);
  const durationSec = isDraft ? Math.min(requestedDuration, 3) : requestedDuration;
  const aspectRatio = body.aspectRatio ?? "9:16";
  const variationSeed = body.variationSeed ?? 0;

  const hdUpscale = body.hdUpscale === true;
  const qualityTier = hdUpscale ? 'pro' : (body.qualityTier ?? 'standard');
  const resolution = body.resolution ?? (hdUpscale ? '1080p' : '720p');
  const fps = body.fps ?? (hdUpscale ? 30 : 24);

  const runwayPrompt = buildCompactRunwayPrompt({
    userPrompt: effectivePrompt,
    productName: body.productName,
    aspectRatio,
    variationSeed,
    bgmMood: body.bgmMood,
    captionText: body.captionText,
    platform: body.platform ?? "shorts",
    hookCategory: body.hookCategory ?? "curiosity",
    productVision: body.productVision ?? null,
    isCleanVideoMode: body.isCleanVideoMode === true,
    promptStrength: body.promptStrength,
    negativePrompt: body.negativePrompt,
    bgStyle: body.bgStyle,
    outfitIntensity: body.outfitIntensity,
    zoomSpeed: body.zoomSpeed,
    cameraRotation: body.cameraRotation,
    transitionEffect: body.transitionEffect,
    qualityTier,
    resolution,
    fps,
  });

  // Generate internal job ID immediately — no waiting for Runway API
  const internalJobId = crypto.randomUUID();

  // Save PENDING row to DB immediately
  if (body.scanId) {
    await saveVideoJob(body.scanId, internalJobId, isDraft, hdUpscale);
  }

  // Fire-and-forget: self-invoke runway-submit mode to call Runway API asynchronously
  if (supabaseUrl && serviceRoleKey) {
    const selfUrl = `${supabaseUrl}/functions/v1/generate-video`;
    fetch(selfUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
      },
      body: JSON.stringify({
        mode: "runway-submit",
        taskId: internalJobId,
        scanId: body.scanId,
        runwayPrompt,
        durationSec,
        aspectRatio,
        isDraft,
        hdUpscale,
        resolution,
        fps,
      }),
    }).catch((err) => {
      console.error("[generate-video] Failed to self-invoke runway-submit:", err);
      // Mark job as FAILED if we can't even start the Runway submission
      if (body.scanId) {
        markVideoJobFailed(body.scanId, internalJobId, "Runway API 호출 시작에 실패했습니다.");
      }
    });
  }

  // Return HTTP 202 Accepted immediately — client polls via Realtime/poll mode
  return new Response(
    JSON.stringify({
      mode: "submit",
      taskId: internalJobId,
      provider: "runway",
      motionPrompt: runwayPrompt,
      durationSec,
      aspectRatio,
      variationSeed,
      draft: isDraft,
      status: "PENDING",
    }),
    { status: 202, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

/**
 * Async Runway API submission — called via self-invoke from handleSubmit.
 * Calls the Runway API, stores the real runway_task_id, then kicks off server-poll.
 */
async function handleRunwaySubmit(body: GenerateVideoRequest, runwayKey: string): Promise<Response> {
  const internalJobId = body.taskId;
  const scanId = body.scanId;

  if (!internalJobId || !scanId) {
    return new Response(
      JSON.stringify({ error: "runway-submit 모드에서는 taskId와 scanId가 필요합니다." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const runwayPrompt = body.prompt ?? body.runwayPrompt ?? "";
  if (!runwayPrompt) {
    await markVideoJobFailed(scanId, internalJobId, "Runway 프롬프트가 비어 있습니다.");
    return new Response(
      JSON.stringify({ error: "runwayPrompt가 필요합니다." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const aspectRatio = body.aspectRatio ?? "9:16";
  const durationSec = Math.min(Math.max(Math.round(body.durationSec ?? 5), 2), 10);
  const isDraft = body.draft === true;
  const hdUpscale = body.hdUpscale === true;
  const resolution = body.resolution ?? (hdUpscale ? "1080p" : "720p");
  const fps = body.fps ?? (hdUpscale ? 30 : 24);

  try {
    const webhookUrl = `${supabaseUrl}/functions/v1/generate-video`;

    let promptImage: string | null = null;
    promptImage = await fetchScanImageUrl(scanId);
    console.log("[generate-video] runway-submit: Fetched scan image:", promptImage ? "found" : "not found");

    const runwayTaskId = await submitWithRetry(
      () => submitRunwayTask(runwayPrompt, runwayKey, aspectRatio, durationSec, isDraft, webhookUrl, scanId, promptImage, hdUpscale, resolution, fps),
      MAX_RETRIES,
    );

    // Store the real Runway task ID in the video_jobs row
    await updateRunwayTaskId(scanId, internalJobId, runwayTaskId);
    console.log(`[generate-video] runway-submit: Runway task ${runwayTaskId} saved for job ${internalJobId}`);

    // Kick off server-poll using the Runway task ID
    if (supabaseUrl && serviceRoleKey) {
      setTimeout(() => {
        const selfUrl = `${supabaseUrl}/functions/v1/generate-video`;
        fetch(selfUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceRoleKey}`,
            apikey: serviceRoleKey,
          },
          body: JSON.stringify({
            mode: "server-poll",
            taskId: runwayTaskId,
            scanId,
            variationSeed: 0,
          }),
        }).catch(() => {
          // Non-fatal — zombie-job guard will catch it if this fails.
        });
      }, SERVER_POLL_INITIAL_DELAY_MS);
    }

    return new Response(
      JSON.stringify({ mode: "runway-submit", status: "SUBMITTED", runwayTaskId, internalJobId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[generate-video] runway-submit error:", err);
    const errMsg = err instanceof Error ? err.message : "Runway API 호출에 실패했습니다.";
    await markVideoJobFailed(scanId, internalJobId, errMsg);
    return new Response(
      JSON.stringify({ error: errMsg, step: "runway-submit", provider: "runway" }),
      { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
}

async function handlePoll(body: GenerateVideoRequest, runwayKey: string): Promise<Response> {
  const taskId = body.taskId;
  if (!taskId) {
    return new Response(
      JSON.stringify({ error: "폴링 모드에서는 taskId가 필요합니다.", step: "poll", provider: "runway" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  if (body.scanId) {
    const cached = await checkWebhookResult(body.scanId);
    if (cached) {
      return new Response(
        JSON.stringify({
          mode: "poll",
          status: "SUCCESS",
          videoUrl: cached,
          taskId,
          provider: "runway",
          persisted: true,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const jobStatus = await checkVideoJobStatus(body.scanId, taskId);
    if (jobStatus?.status === "FAILED") {
      return new Response(
        JSON.stringify({
          mode: "poll",
          status: "FAILED",
          error: jobStatus.error ?? "Runway 비디오 생성에 실패했습니다.",
          taskId,
          provider: "runway",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Idempotency: if the job is already SUCCESS in DB, return immediately
    // without polling Runway again. This prevents redundant API calls from
    // repeated client polls after completion.
    if (jobStatus?.status === "SUCCESS" && jobStatus.videoUrl) {
      return new Response(
        JSON.stringify({
          mode: "poll",
          status: "SUCCESS",
          videoUrl: jobStatus.videoUrl,
          taskId,
          provider: "runway",
          persisted: true,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Resolve runway_task_id — the client may poll with the internal job ID
    // before the async Runway submission has completed. If runway_task_id is
    // not yet set, the job is still being submitted to Runway.
    const runwayTaskId = jobStatus?.runwayTaskId ?? taskId;
    const pollStatus = await pollRunwayTask(runwayTaskId, runwayKey);

    if (pollStatus.status === "SUCCESS" && pollStatus.videoUrl) {
      let persistedUrl: string | null = null;
      if (supabaseUrl && serviceRoleKey) {
        persistedUrl = await uploadToStorage(pollStatus.videoUrl, body.scanId);
        if (persistedUrl) {
          await updateScanWithVideo(body.scanId, persistedUrl);
        }
        await markVideoJobComplete(body.scanId, taskId, persistedUrl ?? pollStatus.videoUrl);
      }
      const finalUrl = persistedUrl ?? pollStatus.videoUrl;
      return new Response(
        JSON.stringify({
          mode: "poll",
          status: "SUCCESS",
          videoUrl: finalUrl,
          originalVideoUrl: pollStatus.videoUrl !== finalUrl ? pollStatus.videoUrl : undefined,
          taskId,
          provider: "runway",
          persisted: !!persistedUrl,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (pollStatus.status === "FAILED") {
      if (supabaseUrl && serviceRoleKey) {
        await markVideoJobFailed(body.scanId, taskId, pollStatus.error ?? "Runway 생성 실패");
      }
      return new Response(
        JSON.stringify({
          mode: "poll",
          status: "FAILED",
          error: pollStatus.error ?? "Runway 비디오 생성에 실패했습니다.",
          taskId,
          provider: "runway",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({
        mode: "poll",
        status: pollStatus.status,
        progress: pollStatus.progress ?? "",
        taskId,
        provider: "runway",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const status = await pollRunwayTask(taskId, runwayKey);

  if (status.status === "SUCCESS" && status.videoUrl) {
    let persistedUrl: string | null = null;
    if (body.scanId && supabaseUrl && serviceRoleKey) {
      persistedUrl = await uploadToStorage(status.videoUrl, body.scanId);
      if (persistedUrl) {
        await updateScanWithVideo(body.scanId, persistedUrl);
      }
    }
    const finalUrl = persistedUrl ?? status.videoUrl;
    return new Response(
      JSON.stringify({
        mode: "poll",
        status: "SUCCESS",
        videoUrl: finalUrl,
        originalVideoUrl: status.videoUrl !== finalUrl ? status.videoUrl : undefined,
        taskId,
        provider: "runway",
        persisted: !!persistedUrl,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  if (status.status === "FAILED") {
    return new Response(
      JSON.stringify({
        mode: "poll",
        status: "FAILED",
        error: status.error ?? "Runway 비디오 생성에 실패했습니다.",
        taskId,
        provider: "runway",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  return new Response(
    JSON.stringify({
      mode: "poll",
      status: status.status,
      progress: status.progress ?? "",
      taskId,
      provider: "runway",
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

// === Runway API ===

async function handleServerPoll(body: GenerateVideoRequest, runwayKey: string): Promise<Response> {
  const taskId = body.taskId;
  const scanId = body.scanId;
  const attempt = body.variationSeed ?? 0; // reuse field as poll attempt counter

  if (!taskId || !scanId) {
    return new Response(
      JSON.stringify({ error: "server-poll 모드에서는 taskId와 scanId가 필요합니다." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // Check if the job was already completed by a webhook
  const cached = await checkWebhookResult(scanId);
  if (cached) {
    return new Response(
      JSON.stringify({ mode: "server-poll", status: "SUCCESS", videoUrl: cached, taskId, persisted: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // Check if the job was already marked FAILED or SUCCESS — look up by runway_task_id
  const jobInfo = await findJobByRunwayTaskId(scanId, taskId);
  if (jobInfo?.status === "FAILED") {
    return new Response(
      JSON.stringify({ mode: "server-poll", status: "FAILED", error: jobInfo.error, taskId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
  if (jobInfo?.status === "SUCCESS" && jobInfo.videoUrl) {
    return new Response(
      JSON.stringify({ mode: "server-poll", status: "SUCCESS", videoUrl: jobInfo.videoUrl, taskId, persisted: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
  const internalJobId = jobInfo?.internalJobId ?? taskId;

  if (attempt >= SERVER_POLL_MAX_ATTEMPTS) {
    await markVideoJobFailed(scanId, internalJobId, "서버 폴링이 최대 횟수에 도달했습니다. 좀비 작업으로 분류됩니다.");
    return new Response(
      JSON.stringify({ mode: "server-poll", status: "FAILED", error: "서버 폴링 한도 초과", taskId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // Poll Runway once
  const status = await pollRunwayTask(taskId, runwayKey);

  if (status.status === "SUCCESS" && status.videoUrl) {
    // Check if the webhook already completed this job — skip redundant work
    const existing = await findJobByRunwayTaskId(scanId, taskId);
    if (existing?.status === "SUCCESS" && existing.videoUrl) {
      return new Response(
        JSON.stringify({ mode: "server-poll", status: "SUCCESS", videoUrl: existing.videoUrl, taskId, persisted: true, alreadyCompleted: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let persistedUrl: string | null = null;
    if (supabaseUrl && serviceRoleKey) {
      persistedUrl = await uploadToStorage(status.videoUrl, scanId);
      if (persistedUrl) {
        await updateScanWithVideo(scanId, persistedUrl);
      }
      await markVideoJobComplete(scanId, internalJobId, persistedUrl ?? status.videoUrl);
    }
    await sendVideoCompletePush(scanId);
    return new Response(
      JSON.stringify({
        mode: "server-poll",
        status: "SUCCESS",
        videoUrl: persistedUrl ?? status.videoUrl,
        taskId,
        persisted: !!persistedUrl,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  if (status.status === "FAILED") {
    if (supabaseUrl && serviceRoleKey) {
      await markVideoJobFailed(scanId, internalJobId, status.error ?? "Runway 생성 실패");
    }
    return new Response(
      JSON.stringify({ mode: "server-poll", status: "FAILED", error: status.error, taskId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // Still PROCESSING — update the step field so the frontend's
  // Realtime subscription can map it to the correct UI progress step.
  const runwayStep = RUNWAY_STATUS_TO_STEP[status.status] ?? "rendering";
  await updateVideoJobStep(scanId, internalJobId, runwayStep);

  // Schedule the next poll via self-reinvocation
  // Exponential backoff with full jitter to desynchronize concurrent jobs
  const baseDelay = Math.min(SERVER_POLL_INITIAL_DELAY_MS * Math.pow(1.5, attempt), SERVER_POLL_MAX_DELAY_MS);
  const jitter = Math.random() * JITTER_MAX_MS;
  const nextDelay = Math.round(baseDelay + jitter);
  const nextAttempt = attempt + 1;

  // Fire-and-forget self-reinvoke after delay with AbortController guard
  setTimeout(() => {
    const selfUrl = `${supabaseUrl}/functions/v1/generate-video`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), SERVER_POLL_SELF_INVOKE_TIMEOUT_MS);
    fetch(selfUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
      },
      body: JSON.stringify({
        mode: "server-poll",
        taskId,
        scanId,
        variationSeed: nextAttempt,
      }),
      signal: controller.signal,
    }).then(() => {
      clearTimeout(timeoutId);
    }).catch(() => {
      clearTimeout(timeoutId);
      // If self-reinvoke fails, the zombie-job guard in checkVideoJobStatus
      // will eventually mark it FAILED after ZOMBIE_JOB_TIMEOUT_MS.
    });
  }, nextDelay);

  return new Response(
    JSON.stringify({
      mode: "server-poll",
      status: "PROCESSING",
      progress: status.progress ?? "",
      taskId,
      nextPollInMs: nextDelay,
      attempt: nextAttempt,
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

async function handleWebhook(body: GenerateVideoRequest): Promise<Response> {
  const taskId = body.taskId;
  const scanId = body.scanId;

  console.log("[generate-video] Webhook received:", JSON.stringify({
    taskId,
    scanId,
    status: body.status,
  }));

  if (!taskId || !scanId) {
    return new Response(
      JSON.stringify({ error: "webhook 처리에 taskId와 scanId가 필요합니다." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const status = body.status ?? "";

  if (status === "SUCCESS" || status === "SUCCEEDED" || status === "COMPLETED") {
    let videoUrl: string | undefined;
    if (Array.isArray(body.output)) {
      videoUrl = body.output[0];
    } else if (typeof body.output === "string") {
      videoUrl = body.output;
    } else if (body.output && typeof body.output === "object" && body.output.url) {
      videoUrl = body.output.url;
    }

    if (!videoUrl) {
      console.error("[generate-video] Webhook: no videoUrl in output");
      return new Response(
        JSON.stringify({ error: "webhook: 비디오 URL이 없습니다." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Check if server-poll already completed this job — look up by runway_task_id
    const existing = await findJobByRunwayTaskId(scanId, taskId);
    if (existing?.status === "SUCCESS" && existing.videoUrl) {
      console.log("[generate-video] Webhook: job already completed by server-poll, skipping");
      return new Response(
        JSON.stringify({ mode: "webhook", status: "SUCCESS", scanId, persisted: true, alreadyCompleted: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const internalJobId = existing?.internalJobId ?? taskId;

    let persistedUrl: string | null = null;
    if (supabaseUrl && serviceRoleKey) {
      persistedUrl = await uploadToStorage(videoUrl, scanId);
      if (persistedUrl) {
        await updateScanWithVideo(scanId, persistedUrl);
      }
      await markVideoJobComplete(scanId, internalJobId, persistedUrl ?? videoUrl);
    }
    await sendVideoCompletePush(scanId);

    console.log("[generate-video] Webhook: video persisted for scan", scanId);
    return new Response(
      JSON.stringify({ mode: "webhook", status: "SUCCESS", scanId, persisted: !!persistedUrl }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  if (status === "FAILED" || status === "CANCELED") {
    const errMsg = body.failure ?? body.error ?? "Runway 생성 실패";
    if (supabaseUrl && serviceRoleKey) {
      const jobInfo = await findJobByRunwayTaskId(scanId, taskId);
      const internalJobId = jobInfo?.internalJobId ?? taskId;
      await markVideoJobFailed(scanId, internalJobId, errMsg);
    }
    return new Response(
      JSON.stringify({ mode: "webhook", status: "FAILED", error: errMsg }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  return new Response(
    JSON.stringify({ mode: "webhook", status }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

async function checkVideoJobStatus(scanId: string, taskId: string): Promise<{ status: string; error?: string; videoUrl?: string; runwayTaskId?: string } | null> {
  if (!supabaseUrl || !serviceRoleKey) return null;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const resp = await fetch(
      `${supabaseUrl}/rest/v1/video_jobs?scan_id=eq.${scanId}&task_id=eq.${taskId}&select=status,error_message,video_url,created_at,runway_task_id`,
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
      const rows = await resp.json() as Array<{ status: string; error_message: string | null; video_url: string | null; created_at: string; runway_task_id: string | null }>;
      if (rows.length > 0) {
        const row = rows[0];
        const isZombie = (row.status === 'PENDING' || row.status === 'PROCESSING' || row.status === 'RUNNING' || row.status === 'THROTTLED')
          && Date.now() - new Date(row.created_at).getTime() > ZOMBIE_JOB_TIMEOUT_MS;
        if (isZombie) {
          await markVideoJobFailed(scanId, taskId, '영상 생성이 6분 이상 진행 중 상태로 멈춰 있어 좀비 작업으로 분류되었습니다. 다시 시도해주세요.');
          return { status: 'FAILED', error: '영상 생성 작업이 시간 초과로 실패했습니다. 다시 시도해주세요.' };
        }
        return {
          status: row.status,
          error: row.error_message ?? undefined,
          videoUrl: row.video_url ?? undefined,
          runwayTaskId: row.runway_task_id ?? undefined,
        };
      }
    }
  } catch {
    // ignore
  }
  return null;
}

async function checkWebhookResult(scanId: string): Promise<string | null> {
  if (!supabaseUrl || !serviceRoleKey) return null;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const resp = await fetch(
      `${supabaseUrl}/rest/v1/scans?select=video_url&id=eq.${scanId}`,
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
      const rows = await resp.json() as Array<{ video_url: string | null }>;
      if (rows.length > 0 && rows[0].video_url) {
        return rows[0].video_url;
      }
    }
  } catch {
    // ignore
  }
  return null;
}

async function saveVideoJob(scanId: string, taskId: string, isDraft: boolean, isHd: boolean): Promise<void> {
  if (!supabaseUrl || !serviceRoleKey) return;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    await fetch(`${supabaseUrl}/rest/v1/video_jobs`, {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        scan_id: scanId,
        task_id: taskId,
        status: "PENDING",
        step: "rendering",
        is_draft: isDraft,
        is_hd: isHd,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
  } catch {
    // non-fatal
  }
}

async function updateRunwayTaskId(scanId: string, internalJobId: string, runwayTaskId: string): Promise<void> {
  if (!supabaseUrl || !serviceRoleKey) return;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    await fetch(`${supabaseUrl}/rest/v1/video_jobs?scan_id=eq.${scanId}&task_id=eq.${internalJobId}`, {
      method: "PATCH",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ runway_task_id: runwayTaskId }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
  } catch {
    // non-fatal — server-poll can still find the job via task_id
  }
}

async function findJobByRunwayTaskId(scanId: string, runwayTaskId: string): Promise<{ status: string; error?: string; videoUrl?: string; internalJobId?: string } | null> {
  if (!supabaseUrl || !serviceRoleKey) return null;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const resp = await fetch(
      `${supabaseUrl}/rest/v1/video_jobs?scan_id=eq.${scanId}&runway_task_id=eq.${runwayTaskId}&select=status,error_message,video_url,task_id,created_at`,
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
      const rows = await resp.json() as Array<{ status: string; error_message: string | null; video_url: string | null; task_id: string; created_at: string }>;
      if (rows.length > 0) {
        const row = rows[0];
        const isZombie = (row.status === 'PENDING' || row.status === 'PROCESSING' || row.status === 'RUNNING' || row.status === 'THROTTLED')
          && Date.now() - new Date(row.created_at).getTime() > ZOMBIE_JOB_TIMEOUT_MS;
        if (isZombie) {
          await markVideoJobFailed(scanId, row.task_id, '영상 생성이 6분 이상 진행 중 상태로 멈춰 있어 좀비 작업으로 분류되었습니다. 다시 시도해주세요.');
          return { status: 'FAILED', error: '영상 생성 작업이 시간 초과로 실패했습니다. 다시 시도해주세요.' };
        }
        return {
          status: row.status,
          error: row.error_message ?? undefined,
          videoUrl: row.video_url ?? undefined,
          internalJobId: row.task_id,
        };
      }
    }
  } catch {
    // ignore
  }
  return null;
}

async function markVideoJobComplete(scanId: string, taskId: string, videoUrl: string): Promise<void> {
  if (!supabaseUrl || !serviceRoleKey) return;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    // Atomic transition: only PATCH if the job is NOT already in a terminal state.
    // This prevents webhook and server-poll from racing to overwrite each other.
    await fetch(`${supabaseUrl}/rest/v1/video_jobs?scan_id=eq.${scanId}&task_id=eq.${taskId}&status=not.in.(SUCCESS,FAILED)`, {
      method: "PATCH",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ status: "SUCCESS", step: "completed", video_url: videoUrl, completed_at: new Date().toISOString() }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
  } catch {
    // non-fatal
  }
}

async function markVideoJobFailed(scanId: string, taskId: string, errMsg: string): Promise<void> {
  if (!supabaseUrl || !serviceRoleKey) return;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    // Atomic transition: only PATCH if the job is NOT already in a terminal state.
    // Prevents a late failure from overwriting a successful completion.
    await fetch(`${supabaseUrl}/rest/v1/video_jobs?scan_id=eq.${scanId}&task_id=eq.${taskId}&status=not.in.(SUCCESS,FAILED)`, {
      method: "PATCH",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ status: "FAILED", step: "failed", error_message: errMsg.slice(0, 500) }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
  } catch {
    // non-fatal
  }
}

const RUNWAY_STATUS_TO_STEP: Record<string, string> = {
  PENDING: "submitting",
  PROCESSING: "rendering",
  RUNNING: "rendering",
  THROTTLED: "rendering",
  QUEUED: "submitting",
};

async function updateVideoJobStep(scanId: string, taskId: string, step: string): Promise<void> {
  if (!supabaseUrl || !serviceRoleKey) return;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    await fetch(`${supabaseUrl}/rest/v1/video_jobs?scan_id=eq.${scanId}&task_id=eq.${taskId}&status=not.in.(SUCCESS,FAILED)`, {
      method: "PATCH",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ step }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
  } catch {
    // non-fatal
  }
}

async function fetchScanImageUrl(scanId: string): Promise<string | null> {
  if (!supabaseUrl || !serviceRoleKey) return null;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const resp = await fetch(
      `${supabaseUrl}/rest/v1/scans?select=edited_image_url,image_url&id=eq.${scanId}`,
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
      const rows = await resp.json() as Array<{ edited_image_url: string | null; image_url: string | null }>;
      if (rows.length > 0) {
        return rows[0].edited_image_url ?? rows[0].image_url ?? null;
      }
    }
  } catch {
    // non-fatal
  }
  return null;
}

async function submitRunwayTask(
  prompt: string,
  apiKey: string,
  aspectRatio: string,
  durationSec: number,
  isDraft: boolean,
  webhookUrl?: string,
  scanId?: string,
  promptImage?: string | null,
  isHd?: boolean,
  resolution?: string,
  fps?: number,
): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), RUNWAY_SUBMIT_TIMEOUT_MS);

  try {
    const clampedDuration = Math.min(Math.max(Math.round(durationSec), 2), 10);
    const ratioMap: Record<string, string> = isHd
      ? {
          "9:16": "1080:1920",
          "16:9": "1920:1080",
          "1:1": "1440:1440",
          "4:3": "1440:1080",
          "3:4": "1080:1440",
          "21:9": "2376:1008",
        }
      : {
          "9:16": "720:1280",
          "16:9": "1280:720",
          "1:1": "960:960",
          "4:3": "1104:832",
          "3:4": "832:1104",
          "21:9": "1584:672",
        };

    const hasImage = typeof promptImage === "string" && promptImage.length > 0;
    const endpoint = hasImage ? "image_to_video" : "text_to_video";
    const model = "gen4.5";
    const ratioValue = ratioMap[aspectRatio] ?? "720:1280";
    const safePrompt = prompt.trim().slice(0, 500);

    const payload: Record<string, unknown> = {
      model,
      promptText: safePrompt,
      duration: clampedDuration,
      ratio: ratioValue,
    };
    if (resolution) payload.resolution = resolution;
    if (fps != null) payload.fps = fps;
    if (hasImage && promptImage) {
      payload.promptImage = promptImage;
    }

    console.log("[generate-video] Runway request:", JSON.stringify({
      endpoint: `https://api.dev.runwayml.com/v1/${endpoint}`,
      method: "POST",
      model: payload.model,
      duration: payload.duration,
      ratio: payload.ratio,
      hasPromptImage: hasImage,
      promptLength: prompt.length,
      promptPreview: prompt.slice(0, 120),
      fullBody: JSON.stringify(payload),
    }));

    const resp = await fetch(`https://api.dev.runwayml.com/v1/${endpoint}`, {
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

    const respStatus = resp.status;
    const respText = await resp.text();

    console.log("[generate-video] Runway response:", JSON.stringify({
      status: respStatus,
      bodyPreview: respText.slice(0, 500),
    }));

    if (!resp.ok) {
      console.error("[generate-video] Runway error:", respStatus, respText.slice(0, 800));
      const errDetail = parseRunwayError(respText);
      if (respStatus === 401) {
        throw new Error(`Runway API 키가 유효하지 않거나 비활성화되었습니다. 설정에서 활성화된 Runway API 키를 다시 등록해주세요. (HTTP 401): ${errDetail}`);
      }
      if (respStatus === 400) {
        throw new Error(`Runway 요청 형식 오류 (HTTP 400): ${errDetail}`);
      }
      if (respStatus === 404) {
        throw new Error(`Runway API 엔드포인트를 찾을 수 없습니다 (HTTP 404). API 주소나 모델명이 잘못되었을 수 있습니다: ${errDetail}`);
      }
      if (respStatus === 429) {
        throw new Error(`Runway API 요청 한도를 초과했습니다 (HTTP 429). 잠시 후 다시 시도해주세요: ${errDetail}`);
      }
      throw new Error(`Runway 생성 요청 실패 (HTTP ${respStatus}): ${errDetail}`);
    }

    const result = JSON.parse(respText) as { taskId?: string; id?: string; status?: string };
    const taskId = result.taskId ?? result.id;
    console.log("[generate-video] Runway task created:", taskId, "status:", result.status);
    if (!taskId) throw new Error("Runway 작업 ID를 받지 못했습니다.");
    return taskId;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Runway 생성 요청 시간이 초과되었습니다 (30초).");
    }
    throw err;
  }
}

async function pollRunwayTask(
  taskId: string,
  apiKey: string,
): Promise<{ status: string; videoUrl?: string; error?: string; progress?: string }> {
  let lastErr: string | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), RUNWAY_POLL_TIMEOUT_MS);

    try {
      const resp = await fetch(`https://api.dev.runwayml.com/v1/tasks/${taskId}`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "X-Runway-Version": "2024-11-06",
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!resp.ok) {
        const errText = await resp.text().catch(() => "");
        const errDetail = parseRunwayError(errText);

        // 5xx errors are transient — retry with backoff
        if (resp.status >= 500 && resp.status < 600 && attempt < MAX_RETRIES) {
          lastErr = `Runway 폴링 실패 (HTTP ${resp.status}): ${errDetail}`;
          const backoffDelay = RETRY_INITIAL_DELAY_MS * Math.pow(2, attempt);
          console.log(`[generate-video] Poll retry ${attempt + 1}/${MAX_RETRIES} after ${backoffDelay}ms (HTTP ${resp.status})`);
          await delay(backoffDelay);
          continue;
        }

        // 4xx errors (except 429) are non-retryable — fail immediately
        if (resp.status === 429 && attempt < MAX_RETRIES) {
          lastErr = `Runway API 요청 한도 초과 (HTTP 429): ${errDetail}`;
          const backoffDelay = RETRY_INITIAL_DELAY_MS * Math.pow(2, attempt);
          console.log(`[generate-video] Poll retry ${attempt + 1}/${MAX_RETRIES} after ${backoffDelay}ms (HTTP 429)`);
          await delay(backoffDelay);
          continue;
        }

        return { status: "FAILED", error: `Runway 폴링 실패 (HTTP ${resp.status}): ${errDetail}` };
      }

      const respText = await resp.text();
      const trimmed = respText.trim();
      if (trimmed.startsWith("<!") || trimmed.startsWith("<html") || trimmed.startsWith("<HTML")) {
        // HTML response is transient (server maintenance) — retry
        if (attempt < MAX_RETRIES) {
          lastErr = "Runway API 서버가 HTML 페이지를 반환했습니다.";
          const backoffDelay = RETRY_INITIAL_DELAY_MS * Math.pow(2, attempt);
          console.log(`[generate-video] Poll retry ${attempt + 1}/${MAX_RETRIES} after ${backoffDelay}ms (HTML response)`);
          await delay(backoffDelay);
          continue;
        }
        return { status: "FAILED", error: "Runway API 서버가 HTML 페이지를 반환했습니다. API 엔드포인트 경로가 잘못되었거나 서버가 일시적으로 사용 불가능합니다." };
      }

      let result: Record<string, unknown>;
      try {
        result = JSON.parse(trimmed);
      } catch {
        // Invalid JSON is transient — retry
        if (attempt < MAX_RETRIES) {
          lastErr = `Runway 폴링 실패: 유효하지 않은 응답 형식 (HTTP ${resp.status})`;
          const backoffDelay = RETRY_INITIAL_DELAY_MS * Math.pow(2, attempt);
          console.log(`[generate-video] Poll retry ${attempt + 1}/${MAX_RETRIES} after ${backoffDelay}ms (invalid JSON)`);
          await delay(backoffDelay);
          continue;
        }
        return { status: "FAILED", error: `Runway 폴링 실패: 유효하지 않은 응답 형식 (HTTP ${resp.status})` };
      }
      const status = (result.status as string) ?? "PROCESSING";
      const progress = result.progress != null ? String(result.progress) : "";

      if (status === "SUCCESS" || status === "SUCCEEDED" || status === "COMPLETED") {
        const output = result.output;
        const videoUrl = typeof output === "string"
          ? output
          : Array.isArray(output) ? output[0] : output?.url ?? result.artifacts?.[0]?.url ?? result.url;
        if (!videoUrl) return { status: "FAILED", error: "Runway 비디오 URL이 없습니다." };
        return { status: "SUCCESS", videoUrl, progress };
      }

      if (status === "FAILED" || status === "CANCELED") {
        const errMsg = result.failure ?? result.error ?? "Runway 생성 실패";
        return { status: "FAILED", error: errMsg };
      }

      return { status, progress };
    } catch (err) {
      clearTimeout(timeoutId);
      if (err instanceof Error && err.name === "AbortError") {
        // Timeout — treat as transient, retry with backoff
        if (attempt < MAX_RETRIES) {
          lastErr = "Runway 폴링 시간 초과";
          const backoffDelay = RETRY_INITIAL_DELAY_MS * Math.pow(2, attempt);
          console.log(`[generate-video] Poll retry ${attempt + 1}/${MAX_RETRIES} after ${backoffDelay}ms (timeout)`);
          await delay(backoffDelay);
          continue;
        }
        return { status: "PROCESSING", progress: "polling timeout, will retry on next poll cycle" };
      }
      // Network error — retry with backoff
      if (attempt < MAX_RETRIES) {
        lastErr = err instanceof Error ? err.message : "Runway 폴링 네트워크 오류";
        const backoffDelay = RETRY_INITIAL_DELAY_MS * Math.pow(2, attempt);
        console.log(`[generate-video] Poll retry ${attempt + 1}/${MAX_RETRIES} after ${backoffDelay}ms (network error: ${lastErr})`);
        await delay(backoffDelay);
        continue;
      }
      console.error("[generate-video] Poll error after all retries:", err);
      return { status: "FAILED", error: lastErr ?? "Runway 폴링 오류" };
    }
  }

  // All retries exhausted — return PROCESSING so server-poll continues to next cycle
  console.error("[generate-video] Poll: all retries exhausted, returning PROCESSING:", lastErr);
  return { status: "PROCESSING", progress: lastErr ?? "transient error, will retry on next poll cycle" };
}

// === Shared helpers ===

function buildAutoPrompt(
  productName: string | undefined,
  vision: ProductVisionData | null,
  captionText: string | undefined,
  isCleanVideoMode: boolean,
): string {
  const parts: string[] = [];

  const name = productName || vision?.productName || "제품";

  if (isCleanVideoMode) {
    parts.push(`Top-tier luxury commercial for ${name}, ultra-premium 3D product showcase, cinematic quality rivaling high-end brand films`);
    if (vision) {
      if (vision.productCategory) parts.push(`category: ${vision.productCategory}`);
      if (vision.visualFeatures.length > 0) parts.push(`key features: ${vision.visualFeatures.slice(0, 4).join(", ")}`);
      if (vision.shapeDescription) parts.push(`shape: ${vision.shapeDescription}`);
      if (vision.materialGuess) parts.push(`material: ${vision.materialGuess}`);
      if (vision.textureDescription) parts.push(`texture: ${vision.textureDescription}`);
      if (vision.colorPalette.length > 0) parts.push(`colors: ${vision.colorPalette.slice(0, 4).join(", ")}`);
      if (vision.orbitalFocusPoint) parts.push(`focal point: ${vision.orbitalFocusPoint}`);
    }
    parts.push("professional 3-point studio lighting with softboxes, rim light for edge definition, macro detail of surface texture, smooth gimbal camera movement, shallow depth of field, color-graded filmic look, no text overlays, no captions, no marketing elements, pure luxury product cinematography");
    return parts.join(". ");
  }

  parts.push(`Raw smartphone-style unboxing review for ${name}, shot on phone, handheld shaky cam, natural lighting`);

  if (vision) {
    if (vision.productCategory) parts.push(`category: ${vision.productCategory}`);
    if (vision.visualFeatures.length > 0) parts.push(`key features: ${vision.visualFeatures.slice(0, 4).join(", ")}`);
    if (vision.marketingPoints.length > 0) parts.push(`marketing angles: ${vision.marketingPoints.slice(0, 2).join(" / ")}`);
    if (vision.shapeDescription) parts.push(`shape: ${vision.shapeDescription}`);
    if (vision.materialGuess) parts.push(`material: ${vision.materialGuess}`);
    if (vision.textureDescription) parts.push(`texture: ${vision.textureDescription}`);
    if (vision.colorPalette.length > 0) parts.push(`colors: ${vision.colorPalette.slice(0, 4).join(", ")}`);
    const copy = vision.suggestedCopyLayers;
    if (copy.primary || copy.secondary || copy.tertiary) {
      parts.push(`copy layers — hook: "${copy.primary}", benefit: "${copy.secondary}", CTA: "${copy.tertiary}"`);
    }
  }

  if (captionText && captionText.trim()) {
    parts.push(`caption context: "${captionText.slice(0, 100)}"`);
  }

  parts.push("10-second vertical short-form, raw unboxing aesthetic, handheld phone camera, imperfect framing, natural room lighting, no studio setup, loss-aversion hook, before/after problem-solution contrast, social-proof urgency CTA");

  return parts.join(". ");
}

type CompactPromptParams = {
  userPrompt: string;
  productName?: string;
  aspectRatio: string;
  variationSeed: number;
  bgmMood?: string;
  captionText?: string;
  platform: string;
  hookCategory: string;
  productVision?: ProductVisionData | null;
  isCleanVideoMode: boolean;
  promptStrength?: number;
  negativePrompt?: string;
  bgStyle?: string;
  outfitIntensity?: number;
  zoomSpeed?: number;
  cameraRotation?: number;
  transitionEffect?: string;
  qualityTier: string;
  resolution: string;
  fps: number;
};

const PLATFORM_STYLE: Record<string, { camera: string; lighting: string; grade: string }> = {
  shorts: { camera: "handheld phone + shaky zoom-in", lighting: "natural room light, no studio", grade: "raw, slight grain, minimal grading" },
  tiktok: { camera: "handheld + jump cuts + quick pans", lighting: "available light only, window light", grade: "unfiltered, phone-camera look, slight warmth" },
  reels: { camera: "handheld selfie-style + slow pan", lighting: "natural golden hour, no setup", grade: "raw filmic, light grain, muted tones" },
  naverclip: { camera: "handheld + casual product close-up", lighting: "natural indoor, no studio", grade: "neutral raw, minimal correction" },
};

const MOOD_GRADE: Record<string, string> = {
  "하이텐션": "urgent handheld, slight shake, raw energy",
  "시네마틱": "natural filmic, light grain, minimal grading",
  "ASMR": "close-up intimate, soft natural light, shallow DOF",
  "감성": "warm natural, gentle handheld, soft window light",
  "로파이": "lofi raw, phone-camera aesthetic, vintage grain",
};

const HOOK_TEXTS: Record<string, string[]> = {
  curiosity: ["이거 진짜였음?", "나만 빼고 다 알더라", "왜 이제야 알았지 진짜"],
  problem: ["이거 모르면 호구 되는 거", "이거 때문에 돈 날릴 뻔", "다들 이걸로 고생함"],
  transformation: ["이랬는데 → 이렇게 됨", "사용 전후 비교 충격", "이거 쓰고 다른 거 다 버렸음"],
  social_proof: ["실시간 품절 캡처 봄", "다들 이거 사느라 난리", "리뷰 수 폭발 중"],
  fomo: ["품절 전에 확인하셈", "선착순 마감 임박", "이거 모르면 손해인데"],
};

const BG_STYLE_MAP: Record<string, string> = {
  "스튜디오": "studio backdrop, controlled lighting, seamless background",
  "야외": "outdoor natural environment, golden hour, natural surroundings",
  "빈티지": "vintage retro setting, warm faded tones, nostalgic atmosphere",
  "미니멀": "minimalist clean background, white space, simple setting",
  "카페": "cozy cafe interior, warm ambient lighting, lifestyle setting",
  "도시": "urban city backdrop, street style, modern architecture",
};

const TRANSITION_MAP: Record<string, string> = {
  "컷 전환": "quick cut transitions",
  "크로스페이드": "crossfade dissolves",
  "와이프": "wipe transitions",
  "줌 전환": "zoom-through transitions",
  "플래시": "flash-cut transitions",
  "슬로우 모션": "slow-motion ramps",
};

function buildCompactRunwayPrompt(p: CompactPromptParams): string {
  const name = p.productName || p.productVision?.productName || "the product";
  const orientation = p.aspectRatio === "9:16" ? "vertical" : p.aspectRatio === "16:9" ? "horizontal" : "square";

  // Prompt strength: 1-10 scale, default 7. Higher = more literal prompt adherence.
  const strength = p.promptStrength ?? 7;
  const strengthTag = strength >= 8 ? "strict prompt adherence, literal interpretation" : strength <= 4 ? "creative interpretation, loose prompt guidance, artistic freedom" : "balanced prompt adherence";
  const userDirective = p.userPrompt.trim().replace(/\s+/g, " ").slice(0, 600);
  const userDirectiveTag = userDirective
    ? `USER DIRECTIVE — follow this visual instruction: "${userDirective}"`
    : "";

  // Negative prompt: user-specified elements to exclude
  const negTag = p.negativePrompt && p.negativePrompt.trim() ? `neg=[${p.negativePrompt.trim().slice(0, 80)}]` : "";

  // Background style
  const bgTag = p.bgStyle && BG_STYLE_MAP[p.bgStyle] ? `bg=${BG_STYLE_MAP[p.bgStyle]}` : "";

  // Outfit/style intensity: 1-5 scale, default 3
  const outfitTag = p.outfitIntensity != null && p.outfitIntensity !== 3
    ? p.outfitIntensity >= 4 ? "strong style transformation, dramatic outfit change" : "subtle style enhancement, minimal outfit change"
    : "";

  // Camera motion controls
  const zoomTag = p.zoomSpeed != null && p.zoomSpeed !== 2
    ? p.zoomSpeed >= 3 ? "fast aggressive zoom-in" : p.zoomSpeed <= 1 ? "slow gentle zoom-in" : ""
    : "";
  const rotTag = p.cameraRotation != null && p.cameraRotation !== 0
    ? `camera rotation ${p.cameraRotation > 0 ? "right" : "left"} ${Math.abs(p.cameraRotation)}deg`
    : "";

  // Transition effect
  const transTag = p.transitionEffect && TRANSITION_MAP[p.transitionEffect] ? `transitions=${TRANSITION_MAP[p.transitionEffect]}` : "";

  if (p.isCleanVideoMode) {
    const v = p.productVision;
    const tokens: string[] = [
      `luxury showcase ${name} ${orientation}`,
      "cam=smooth gimbal dolly + gentle orbit + macro push-in",
      "light=professional 3-point studio + softbox + rim light",
      "grade=filmic luxury, shallow DOF, color-graded, premium look",
      "quality=top 1% commercial, ultra-premium, high-end brand film",
      `prompt_strength=${strength}/10, ${strengthTag}`,
    ];
    if (userDirectiveTag) tokens.push(userDirectiveTag);
    if (v) {
      const feats = v.visualFeatures.slice(0, 2).join(",");
      tokens.push(`product=${v.shapeDescription},${v.materialGuess}${feats ? "," + feats : ""}`);
      if (v.textureDescription) tokens.push(`texture=${v.textureDescription}`);
    }
    if (bgTag) tokens.push(bgTag);
    if (outfitTag) tokens.push(outfitTag);
    if (zoomTag) tokens.push(zoomTag);
    if (rotTag) tokens.push(rotTag);
    if (transTag) tokens.push(transTag);
    tokens.push("no text, no captions, no hooks, no CTA, pure luxury product cinematography, top-tier quality");
    tokens.push(`tier=${p.qualityTier}, res=${p.resolution}, fps=${p.fps}`);
    if (negTag) tokens.push(negTag);
    return tokens.join(" ").slice(0, 1000);
  }

  const style = PLATFORM_STYLE[p.platform] ?? PLATFORM_STYLE.shorts;
  const mood = MOOD_GRADE[p.bgmMood ?? ""] ?? MOOD_GRADE["하이텐션"];
  const hooks = HOOK_TEXTS[p.hookCategory] ?? HOOK_TEXTS.curiosity;
  const hook = hooks[p.variationSeed % hooks.length];

  const tokens: string[] = [
    `raw smartphone review ${name} ${orientation}`,
    `cam=${style.camera}`,
    `light=${style.lighting}`,
    `grade=${style.grade},${mood}`,
    `hook="${hook}"`,
    `aesthetic=raw,imperfect,handheld,no-studio`,
    `prompt_strength=${strength}/10, ${strengthTag}`,
  ];

  if (userDirectiveTag) tokens.push(userDirectiveTag);

  if (p.productVision) {
    const v = p.productVision;
    const feats = v.visualFeatures.slice(0, 2).join(",");
    tokens.push(`product=${v.shapeDescription},${v.materialGuess}${feats ? "," + feats : ""}`);
  }

  if (p.captionText && p.captionText.trim()) {
    tokens.push(`ctx="${p.captionText.slice(0, 40)}"`);
  }

  if (bgTag) tokens.push(bgTag);
  if (outfitTag) tokens.push(outfitTag);
  if (zoomTag) tokens.push(zoomTag);
  if (rotTag) tokens.push(rotTag);
  if (transTag) tokens.push(transTag);
  if (negTag) tokens.push(negTag);

  tokens.push("3phase:hook→contrast→cta, raw unboxing vibe, smartphone aesthetic, no polished production");
  tokens.push(`tier=${p.qualityTier}, res=${p.resolution}, fps=${p.fps}`);

  return tokens.join(" ").slice(0, 1000);
}

function parseRunwayError(errText: string): string {
  const trimmed = errText.trim();
  if (trimmed.startsWith("<!") || trimmed.startsWith("<html") || trimmed.startsWith("<HTML")) {
    return "Runway API 서버가 HTML 페이지를 반환했습니다. API 엔드포인트 경로가 잘못되었거나 서버가 일시적으로 사용 불가능합니다.";
  }
  try {
    const errJson = JSON.parse(trimmed);
    if (errJson?.error) {
      if (typeof errJson.error === "string") return errJson.error.slice(0, 500);
      if (typeof errJson.error === "object") {
        const fields = Object.entries(errJson.error)
          .map(([field, val]) => `${field}: ${typeof val === "string" ? val : JSON.stringify(val)}`)
          .join("; ");
        return fields.slice(0, 500);
      }
    }
    if (errJson?.message) return String(errJson.message).slice(0, 500);
    if (Array.isArray(errJson?.details)) return errJson.details.map((d: unknown) => String(d)).join("; ").slice(0, 500);
  } catch { /* not JSON */ }
  return trimmed.slice(0, 500);
}

async function submitWithRetry(fn: () => Promise<string>, maxRetries: number): Promise<string> {
  const deadline = Date.now() + EDGE_WALL_CLOCK_BUDGET_MS;
  let lastErr: Error | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (Date.now() >= deadline) {
      throw lastErr ?? new Error("비디오 생성 요청 시간 초과 (엣지 함수 제한)");
    }
    try {
      return await fn();
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err));
      // Exponential backoff: 1.5s, 3s, 6s, 12s — stop if next delay exceeds deadline
      const backoffDelay = RETRY_INITIAL_DELAY_MS * Math.pow(2, attempt);
      if (attempt < maxRetries && Date.now() + backoffDelay < deadline) {
        console.log(`[generate-video] Retry ${attempt + 1}/${maxRetries} after ${backoffDelay}ms:`, lastErr.message);
        await delay(backoffDelay);
      }
    }
  }
  throw lastErr ?? new Error("비디오 생성 요청 실패");
}

async function uploadToStorage(videoUrl: string, scanId: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);
    const resp = await fetch(videoUrl, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!resp.ok) return null;

    const videoBlob = await resp.blob();
    const fileName = `${scanId}/${Date.now()}_ai_video.mp4`;
    const uploadUrl = `${supabaseUrl}/storage/v1/object/videos/${fileName}`;

    const uploadController = new AbortController();
    const uploadTimeoutId = setTimeout(() => uploadController.abort(), 20000);
    const uploadResp = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
        "Content-Type": "video/mp4",
        "x-upsert": "true",
        "Cache-Control": "max-age=360000",
      },
      body: videoBlob,
      signal: uploadController.signal,
    });
    clearTimeout(uploadTimeoutId);

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
    // Guard: don't overwrite an existing video_url — the first completion wins.
    await fetch(`${supabaseUrl}/rest/v1/scans?id=eq.${scanId}&video_url=is.null`, {
      method: "PATCH",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ video_url: videoUrl }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
  } catch {
    // non-fatal
  }
}

async function sendVideoCompletePush(scanId: string): Promise<void> {
  if (!supabaseUrl || !serviceRoleKey) return;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const resp = await fetch(
      `${supabaseUrl}/rest/v1/scans?select=user_id&id=eq.${scanId}`,
      { headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` }, signal: controller.signal },
    );
    clearTimeout(timeoutId);
    if (!resp.ok) return;
    const rows = await resp.json() as Array<{ user_id: string | null }>;
    if (!rows[0]?.user_id) return;
    const userId = rows[0].user_id;

    const pushController = new AbortController();
    const pushTimeoutId = setTimeout(() => pushController.abort(), 10000);
    await fetch(`${supabaseUrl}/functions/v1/send-push`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
      },
      body: JSON.stringify({
        userId,
        title: "숏폼 영상 제작 완료!",
        body: "AI 영상이 완성되었습니다. 지금 바로 확인해보세요.",
        url: `/result/${scanId}`,
      }),
      signal: pushController.signal,
    });
    clearTimeout(pushTimeoutId);
  } catch {
    // non-fatal — push is best-effort
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function resolveRunwayKey(): Promise<string | null> {
  const serverKey = Deno.env.get("RUNWAY_API_KEY") ?? null;

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

  return serverKey || null;
}

async function checkRateLimit(identifier: string): Promise<boolean> {
  if (!supabaseUrl || !serviceRoleKey) return true;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const resp = await fetch(
      `${supabaseUrl}/rest/v1/rpc/check_rate_limit`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({
          p_identifier: identifier,
          p_feature: "generate_video",
          p_daily_limit: VIDEO_DAILY_LIMIT,
        }),
        signal: controller.signal,
      },
    );
    clearTimeout(timeoutId);
    if (!resp.ok) return true;
    const data = await resp.json();
    return data === true;
  } catch {
    return true;
  }
}
