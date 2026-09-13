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
  mode?: "submit" | "poll" | "webhook";
  taskId?: string;
  prompt?: string;
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
  // webhook fields (sent by Runway callback)
  status?: string;
  output?: string[] | { url?: string } | string;
  failure?: string;
  error?: string;
}

const MAX_RETRIES = 1;
const RETRY_DELAY_MS = 1500;
const RUNWAY_SUBMIT_TIMEOUT_MS = 20000;
const RUNWAY_POLL_TIMEOUT_MS = 10000;
const EDGE_WALL_CLOCK_BUDGET_MS = 120000;

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

    if (mode === "poll") {
      return await handlePoll(body, runwayKey);
    }

    return await handleSubmit(body, runwayKey);
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "비디오 생성 중 오류가 발생했습니다.",
        step: "unhandled",
        provider: "unknown",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

async function handleSubmit(body: GenerateVideoRequest, runwayKey: string): Promise<Response> {
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
  const durationSec = isDraft ? 3 : Math.min(body.durationSec ?? 5, 5);
  const aspectRatio = body.aspectRatio ?? "9:16";
  const variationSeed = body.variationSeed ?? 0;

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
  });

  try {
    const webhookUrl = body.scanId && supabaseUrl
      ? `${supabaseUrl}/functions/v1/generate-video`
      : undefined;

    const taskId = await submitWithRetry(
      () => submitRunwayTask(runwayPrompt, runwayKey, aspectRatio, durationSec, isDraft, webhookUrl, body.scanId),
      MAX_RETRIES,
    );

    if (body.scanId) {
      await saveVideoJob(body.scanId, taskId, isDraft);
    }

    return new Response(
      JSON.stringify({
        mode: "submit",
        taskId,
        provider: "runway",
        motionPrompt: runwayPrompt,
        durationSec,
        aspectRatio,
        variationSeed,
        draft: isDraft,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const errorDetail = err instanceof Error ? err.message : "Runway 작업 생성 실패";
    return new Response(
      JSON.stringify({
        error: `AI 비디오 생성 요청에 실패했습니다: ${errorDetail}`,
        step: "submit",
        provider: "runway",
        motionPrompt: runwayPrompt,
      }),
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

    let persistedUrl: string | null = null;
    if (supabaseUrl && serviceRoleKey) {
      persistedUrl = await uploadToStorage(videoUrl, scanId);
      if (persistedUrl) {
        await updateScanWithVideo(scanId, persistedUrl);
      }
      await markVideoJobComplete(scanId, taskId, persistedUrl ?? videoUrl);
    }

    console.log("[generate-video] Webhook: video persisted for scan", scanId);
    return new Response(
      JSON.stringify({ mode: "webhook", status: "SUCCESS", scanId, persisted: !!persistedUrl }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  if (status === "FAILED" || status === "CANCELED") {
    const errMsg = body.failure ?? body.error ?? "Runway 생성 실패";
    if (supabaseUrl && serviceRoleKey) {
      await markVideoJobFailed(scanId, taskId, errMsg);
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

async function checkVideoJobStatus(scanId: string, taskId: string): Promise<{ status: string; error?: string; videoUrl?: string } | null> {
  if (!supabaseUrl || !serviceRoleKey) return null;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const resp = await fetch(
      `${supabaseUrl}/rest/v1/video_jobs?scan_id=eq.${scanId}&task_id=eq.${taskId}&select=status,error_message,video_url`,
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
      const rows = await resp.json() as Array<{ status: string; error_message: string | null; video_url: string | null }>;
      if (rows.length > 0) {
        return {
          status: rows[0].status,
          error: rows[0].error_message ?? undefined,
          videoUrl: rows[0].video_url ?? undefined,
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

async function saveVideoJob(scanId: string, taskId: string, isDraft: boolean): Promise<void> {
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
        is_draft: isDraft,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
  } catch {
    // non-fatal
  }
}

async function markVideoJobComplete(scanId: string, taskId: string, videoUrl: string): Promise<void> {
  if (!supabaseUrl || !serviceRoleKey) return;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    await fetch(`${supabaseUrl}/rest/v1/video_jobs?scan_id=eq.${scanId}&task_id=eq.${taskId}`, {
      method: "PATCH",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ status: "SUCCESS", video_url: videoUrl, completed_at: new Date().toISOString() }),
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
    await fetch(`${supabaseUrl}/rest/v1/video_jobs?scan_id=eq.${scanId}&task_id=eq.${taskId}`, {
      method: "PATCH",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ status: "FAILED", error_message: errMsg.slice(0, 500) }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
  } catch {
    // non-fatal
  }
}

async function submitRunwayTask(
  prompt: string,
  apiKey: string,
  aspectRatio: string,
  durationSec: number,
  isDraft: boolean,
  webhookUrl?: string,
  scanId?: string,
): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), RUNWAY_SUBMIT_TIMEOUT_MS);

  try {
    const clampedDuration = Math.min(Math.max(Math.round(durationSec), 2), 5);
    const ratioValue = aspectRatio === "9:16" ? "9:16" : aspectRatio === "16:9" ? "16:9" : "1:1";
    const safePrompt = prompt.slice(0, 500);

    const payload: Record<string, unknown> = {
      taskType: "text_to_video",
      model: "gen3a_turbo",
      promptText: safePrompt,
      duration: clampedDuration,
      ratio: ratioValue,
    };
    if (webhookUrl && scanId) {
      payload.callBackUrl = `${webhookUrl}?mode=webhook&taskId={taskId}&scanId=${scanId}`;
    }

    console.log("[generate-video] Runway request:", JSON.stringify({
      endpoint: "https://api.dev.runwayml.com/v1/tasks",
      method: "POST",
      model: payload.model,
      duration: payload.duration,
      ratio: payload.ratio,
      promptLength: prompt.length,
      promptPreview: prompt.slice(0, 120),
      fullBody: JSON.stringify(payload),
    }));

    const resp = await fetch("https://api.dev.runwayml.com/v1/tasks", {
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
      return { status: "FAILED", error: `Runway 폴링 실패 (HTTP ${resp.status}): ${errText.slice(0, 200)}` };
    }

    const result = await resp.json();
    const status = (result.status as string) ?? "PROCESSING";
    const progress = result.progress != null ? String(result.progress) : "";

    if (status === "SUCCESS" || status === "SUCCEEDED" || status === "COMPLETED") {
      const videoUrl = result.output?.[0] ?? result.output?.url ?? result.artifacts?.[0]?.url ?? result.url;
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
      return { status: "PROCESSING", progress: "polling timeout, retrying" };
    }
    return { status: "FAILED", error: err instanceof Error ? err.message : "Runway 폴링 오류" };
  }
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
    parts.push(`Cinematic 3D product showcase for ${name}, pure visual focus`);
    if (vision) {
      if (vision.productCategory) parts.push(`category: ${vision.productCategory}`);
      if (vision.visualFeatures.length > 0) parts.push(`key features: ${vision.visualFeatures.slice(0, 4).join(", ")}`);
      if (vision.shapeDescription) parts.push(`shape: ${vision.shapeDescription}`);
      if (vision.materialGuess) parts.push(`material: ${vision.materialGuess}`);
      if (vision.textureDescription) parts.push(`texture: ${vision.textureDescription}`);
      if (vision.colorPalette.length > 0) parts.push(`colors: ${vision.colorPalette.slice(0, 4).join(", ")}`);
      if (vision.orbitalFocusPoint) parts.push(`focal point: ${vision.orbitalFocusPoint}`);
    }
    parts.push("smooth gentle camera pan, soft studio lighting, macro detail of surface texture, no text overlays, no captions, no marketing elements, pure product cinematography");
    return parts.join(". ");
  }

  parts.push(`Cinematic 3D commercial for ${name}`);

  if (vision) {
    if (vision.productCategory) parts.push(`category: ${vision.productCategory}`);
    if (vision.visualFeatures.length > 0) parts.push(`key features: ${vision.visualFeatures.slice(0, 4).join(", ")}`);
    if (vision.marketingPoints.length > 0) parts.push(`marketing angles: ${vision.marketingPoints.slice(0, 2).join(" / ")}`);
    if (vision.shapeDescription) parts.push(`shape: ${vision.shapeDescription}`);
    if (vision.materialGuess) parts.push(`material: ${vision.materialGuess}`);
    if (vision.textureDescription) parts.push(`texture: ${vision.textureDescription}`);
    if (vision.colorPalette.length > 0) parts.push(`colors: ${vision.colorPalette.slice(0, 4).join(", ")}`);
    if (vision.orbitalFocusPoint) parts.push(`focal point: ${vision.orbitalFocusPoint}`);
    const copy = vision.suggestedCopyLayers;
    if (copy.primary || copy.secondary || copy.tertiary) {
      parts.push(`copy layers — hook: "${copy.primary}", benefit: "${copy.secondary}", CTA: "${copy.tertiary}"`);
    }
  }

  if (captionText && captionText.trim()) {
    parts.push(`caption context: "${captionText.slice(0, 100)}"`);
  }

  parts.push("10-second vertical short-form commercial with loss-aversion hook, before/after problem-solution contrast, and social-proof urgency CTA");

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
};

const PLATFORM_STYLE: Record<string, { camera: string; lighting: string; grade: string }> = {
  shorts: { camera: "dolly-in + 3D rotation", lighting: "studio 3-point + rim light", grade: "warm, crushed blacks, +15% sat" },
  tiktok: { camera: "zoom-punch + jump cuts", lighting: "high-key bright + neon", grade: "vibrant pop, +25% sat, teal shadows" },
  reels: { camera: "orbital arc + speed ramps", lighting: "golden hour + volumetric", grade: "filmic teal-orange, deep blacks" },
  naverclip: { camera: "hero rotation + info overlay", lighting: "clean bright studio", grade: "neutral natural, slight warmth" },
};

const MOOD_GRADE: Record<string, string> = {
  "하이텐션": "high-energy, motion blur, neon glow",
  "시네마틱": "cinematic teal-orange, film grain, lens flare",
  "ASMR": "soft intimate, warm muted, shallow DOF",
  "감성": "emotional golden, soft bloom, gentle vignette",
  "로파이": "lofi desaturated, warm tint, vintage grain",
};

const HOOK_TEXTS: Record<string, string[]> = {
  curiosity: ["이거 진짜였어?", "다들 놀라는 중", "왜 이제야 알았지"],
  problem: ["이거 때문에 스트레스", "다들 이걸로 고생함", "해결책 찾았어"],
  transformation: ["before 이랬는데 after 이렇게", "사용 전후 비교 충격", "이거 쓰고 달라졌어"],
  social_proof: ["이 동네 1위", "다들 이거 사감", "리뷰 1만 개"],
  fomo: ["품절 전에 확인", "선찹순 마감 임박", "놓치면 다시 없어"],
};

function buildCompactRunwayPrompt(p: CompactPromptParams): string {
  const name = p.productName || p.productVision?.productName || "the product";
  const orientation = p.aspectRatio === "9:16" ? "vertical" : p.aspectRatio === "16:9" ? "horizontal" : "square";

  if (p.isCleanVideoMode) {
    const v = p.productVision;
    const tokens: string[] = [
      `showcase ${name} ${orientation}`,
      "cam=smooth dolly + gentle orbit",
      "light=soft studio + natural rim",
      "grade=clean natural, minimal grading",
    ];
    if (v) {
      const feats = v.visualFeatures.slice(0, 2).join(",");
      tokens.push(`product=${v.shapeDescription},${v.materialGuess}${feats ? "," + feats : ""}`);
      if (v.textureDescription) tokens.push(`texture=${v.textureDescription}`);
    }
    tokens.push("no text, no captions, no hooks, no CTA, pure product cinematography");
    return tokens.join(" ").slice(0, 500);
  }

  const style = PLATFORM_STYLE[p.platform] ?? PLATFORM_STYLE.shorts;
  const mood = MOOD_GRADE[p.bgmMood ?? ""] ?? MOOD_GRADE["하이텐션"];
  const hooks = HOOK_TEXTS[p.hookCategory] ?? HOOK_TEXTS.curiosity;
  const hook = hooks[p.variationSeed % hooks.length];

  const tokens: string[] = [
    `commercial ${name} ${orientation}`,
    `cam=${style.camera}`,
    `light=${style.lighting}`,
    `grade=${style.grade},${mood}`,
    `hook="${hook}"`,
  ];

  if (p.productVision) {
    const v = p.productVision;
    const feats = v.visualFeatures.slice(0, 2).join(",");
    tokens.push(`product=${v.shapeDescription},${v.materialGuess}${feats ? "," + feats : ""}`);
  }

  if (p.captionText && p.captionText.trim()) {
    tokens.push(`ctx="${p.captionText.slice(0, 40)}"`);
  }

  tokens.push("3phase:hook→contrast→cta");

  return tokens.join(" ").slice(0, 500);
}

function parseRunwayError(errText: string): string {
  try {
    const errJson = JSON.parse(errText);
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
  return errText.slice(0, 500);
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
      if (attempt < maxRetries && Date.now() + RETRY_DELAY_MS < deadline) {
        await delay(RETRY_DELAY_MS * (attempt + 1));
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
    await fetch(`${supabaseUrl}/rest/v1/scans?id=eq.${scanId}`, {
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
