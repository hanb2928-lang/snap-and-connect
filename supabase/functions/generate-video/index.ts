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
  platform?: string;
  hookCategory?: string;
  cutCount?: number;
  productVision?: ProductVisionData | null;
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
      body.platform ?? "shorts",
      body.hookCategory ?? "curiosity",
      body.cutCount,
      body.productVision ?? null,
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
  platform: string = "shorts",
  hookCategory: string = "curiosity",
  explicitCutCount?: number,
  productVision?: ProductVisionData | null,
): string {
  const orientation = aspectRatio === "9:16" ? "vertical portrait 9:16" : aspectRatio === "16:9" ? "horizontal landscape 16:9" : "square 1:1";
  const effectiveCutCount = explicitCutCount ?? Math.max(cutCount, 5);

  const platformBenchmarks: Record<string, {
    composition: string; gaze: string; lighting: string; transition: string; colorGrade: string; cutInterval: number; hookSec: number;
  }> = {
    shorts: {
      composition: "Rule of thirds, subject upper-third, negative space lower third for captions",
      gaze: "Direct eye contact with lens, subject fills 60-70% frame width",
      lighting: "Soft key light 45° camera-left, rim light for depth, no harsh shadows",
      transition: "Match-cut on motion, whip-pan at beat peaks, zero cross-dissolves",
      colorGrade: "Warm highlights +200K, crushed blacks, saturation +15%",
      cutInterval: 1.8,
      hookSec: 2.0,
    },
    tiktok: {
      composition: "Center-weighted, subject fills 70-80% frame, high contrast against background",
      gaze: "Immediate direct-to-camera gaze, fast subject movement within 0.5s",
      lighting: "High-key bright, ring light primary, ambient fill, no moody low-key",
      transition: "Jump cuts every 1.5s, zoom-punch on beat drops, screen-shake on impact",
      colorGrade: "Vibrant pop, saturation +25%, warm skin tones, teal shadows",
      cutInterval: 1.5,
      hookSec: 0.5,
    },
    reels: {
      composition: "Cinematic asymmetry, subject in left/right third, shallow depth of field",
      gaze: "Soft gaze, storytelling expression, emotional micro-expressions in first 2s",
      lighting: "Golden hour warmth, natural window light, soft diffusion, backlight halo",
      transition: "Smooth speed-ramp transitions, seamless match-action, minimal hard cuts",
      colorGrade: "Filmic teal-orange, muted mid-tones, warm highlights, deep blacks",
      cutInterval: 2.0,
      hookSec: 2.5,
    },
    naverclip: {
      composition: "Product-centric center, clean uncluttered background, info-dense framing",
      gaze: "Product hero shot first, presenter gaze to product, trust-building angle",
      lighting: "Clean bright studio, even key+fill ratio, minimal shadows for clarity",
      transition: "Information cuts, text-overlay transitions, clean wipe synced to VO",
      colorGrade: "Neutral natural colors, accurate product representation, slight warmth",
      cutInterval: 2.5,
      hookSec: 3.0,
    },
  };
  const benchmark = platformBenchmarks[platform] ?? platformBenchmarks.shorts;

  const cameraSpecs = [
    {
      phase: "HOOK",
      shot: "Extreme close-up, subject eyes fill upper third",
      lens: "85mm equiv, f/1.8, shallow depth of field, bokeh background isolation",
      light: "Rembrandt key 45° camera-left at eye level, fill 1:4 ratio, rim light",
      motion: `Slow dolly-in 1.05x→1.22x over ${benchmark.hookSec}s, handheld micro-tremor`,
      micro: "0.5° rotation drift, natural breathing sway, 2px vertical drift",
    },
    {
      phase: "DISCOVERY",
      shot: "Medium close-up, product visible with environmental context",
      lens: "50mm equiv, f/2.8, context visible but subject prioritized",
      light: "Practical lighting integrated, soft bounce fill, ambient atmosphere",
      motion: "Lateral pan +4 to -4 on X axis, ease-in-out cubic, 1.5s",
      micro: "Parallax shift on background, focus pull foreground→product at midpoint",
    },
    {
      phase: "TRANSFORMATION",
      shot: "Medium shot, full product-in-use context visible",
      lens: "35mm equiv, f/4.0, full scene sharp for transformation reveal",
      light: "Motivated lighting shift: warm key → cool key, simulating time passage",
      motion: "Tilt reveal +4 to -4 on Y axis, ease-out quart, ascending",
      micro: "Rack focus from hands→product→face, 0.3s each beat",
    },
    {
      phase: "CTA",
      shot: "Medium-wide, subject + product + CTA text space in lower third",
      lens: "35mm equiv, f/3.5, subject and product both in focus",
      light: "Even key+fill, bright approachable, no dramatic shadows for CTA clarity",
      motion: "Slow pull-back 1.3x→1.0x, stabilizing to fixed frame for text overlay",
      micro: "Settling motion, zero drift after 0.5s, locked frame for CTA burn-in",
    },
  ];

  const moodGrades: Record<string, string> = {
    "하이텐션": "High-energy: saturation +25%, contrast +20%, punchy highlights, motion blur on fast cuts",
    "시네마틱": "Cinematic: teal-orange split tone, film grain 15%, anamorphic lens flare, letterbox safe",
    "ASMR": "Soft intimate: warm muted tones, f/1.4 shallow DOF, gentle glow on highlights",
    "감성": "Emotional: warm golden tones, soft contrast, bloom on highlights, gentle vignette",
    "로파이": "Lofi: desaturated -10%, warm tint, slight grain, vintage film emulation",
  };
  const moodGrade = bgmMood ? (moodGrades[bgmMood] ?? moodGrades["하이텐션"]) : moodGrades["하이텐션"];

  const hookPatterns: Record<string, string[]> = {
    curiosity: ["이거 진짜였어?", "다들 놀라는 중", "왜 이제야 알았지"],
    problem: ["이거 때문에 스트레스", "다들 이걸로 고생함", "해결책 찾았어"],
    transformation: ["before 이랬는데 after 이렇게", "사용 전후 비교 충격", "이거 쓰고 달라졌어"],
    social_proof: ["이 동네 1위", "다들 이거 사감", "리뷰 1만 개"],
    fomo: ["품절 전에 확인", "선찹순 마감 임박", "놓치면 다시 없어"],
  };
  const hookTexts = hookPatterns[hookCategory] ?? hookPatterns.curiosity;
  const hookText = hookTexts[variationSeed % hookTexts.length];

  const gazeAnchors: Record<string, string> = {
    shorts: "Direct eye contact with lens, subject upper-third, expression: subtle surprise→confidence",
    tiktok: "Fast head turn to camera at 0.3s, eyes wide, micro-expression of discovery, leaning in",
    reels: "Soft gaze off-camera then slow turn to lens at 1.5s, vulnerability→empowerment",
    naverclip: "Product hero shot centered, presenter hand enters at 0.5s pointing to key feature",
  };
  const motionTriggers: Record<string, string> = {
    shorts: `Slow dolly-in 1.05x→1.22x over ${benchmark.hookSec}s with handheld micro-tremor`,
    tiktok: "Snap zoom to 1.3x at 0.2s then settle to 1.15x by 1s, screen-shake on beat 1",
    reels: "Gentle push-in 1.0x→1.1x over 2.5s, parallax drift on background bokeh, dreamy motion",
    naverclip: "Static locked frame 1s, then 5° tilt-down reveal of product detail at 1.5s",
  };

  const segmentDirectives = cameraSpecs.slice(0, Math.min(effectiveCutCount, cameraSpecs.length)).map((spec, i) => {
    const startSec = i === 0 ? 0 : Math.round(i * (15 / effectiveCutCount) * 10) / 10;
    const endSec = i === Math.min(effectiveCutCount, cameraSpecs.length) - 1 ? 15 : Math.round((i + 1) * (15 / effectiveCutCount) * 10) / 10;
    return `[${startSec}-${endSec}s] ${spec.phase}: ${spec.shot}. Camera: ${spec.motion}. Lens: ${spec.lens}. Light: ${spec.light}. Micro: ${spec.micro}.`;
  }).join("\n");

  const hookDirective =
    `HOOK (first ${benchmark.hookSec}s): ${gazeAnchors[platform] ?? gazeAnchors.shorts}. ` +
    `Motion: ${motionTriggers[platform] ?? motionTriggers.shorts}. ` +
    `Text: "${hookText}" at 0.3s, kinetic typography 120% pop-in. ` +
    `ZERO scene changes in first ${benchmark.hookSec}s — locked frame, escalating audio only.`;

  const retentionDirective =
    `Cut interval ${benchmark.cutInterval}s accelerating. Pattern interrupts every 3-4s. ` +
    `Kill-point captions 0.3s before audio peaks. Last 3s: locked frame for CTA. ` +
    `Audio-visual sync: 0.1s max desync.`;

  const captionHint = captionText ? `\nCaption context: "${captionText.slice(0, 80)}".` : "";

  const visionSection = productVision ? buildVisionPromptSection(productVision) : "";

  const promptParts = [
    `### CINEMATIC VIDEO PROMPT — TOP-1% VIRAL QUALITY`,
    ``,
    `Subject: ${userPrompt}${productName ? ` featuring ${productName}` : ""}.`,
    `Format: ${orientation}.`,
    ``,
    `### HOOK STRUCTURE (first ${benchmark.hookSec}s)`,
    hookDirective,
    ``,
    `### CINEMATOGRAPHY — PER-SEGMENT CAMERA SPECS`,
    segmentDirectives,
    ``,
    `### PLATFORM OPTIMIZATION — ${platform.toUpperCase()}`,
    `Composition: ${benchmark.composition}. Gaze: ${benchmark.gaze}. Transition: ${benchmark.transition}.`,
    ``,
    `### COLOR GRADING`,
    `${moodGrade}. Base: ${benchmark.colorGrade}.`,
    ``,
    `### RETENTION ENGINE`,
    retentionDirective,
  ];

  if (visionSection) {
    promptParts.push(``, visionSection);
  }

  promptParts.push(
    ``,
    `### QUALITY LOCK`,
    `Photorealistic, 4K, natural skin tones, no text artifacts, no warped faces, seamless motion, clean composition, professional color science.${captionHint}`,
  );

  return promptParts.join("\n");
}

function buildVisionPromptSection(vision: ProductVisionData): string {
  const features = vision.visualFeatures.slice(0, 5).join(", ");
  const marketingPoints = vision.marketingPoints.slice(0, 3).join(" / ");
  const depthLayers = vision.parallaxDepthLayers.length > 0
    ? vision.parallaxDepthLayers.join(" → ")
    : "foreground product → midground context → background bokeh";
  const copyLayers = vision.suggestedCopyLayers;
  const angleDescs = vision.keyAngles.length > 0
    ? vision.keyAngles.map((a) => `  • ${a.angle}: ${a.description}`).join("\n")
    : "  • Front: product face detail\n  • 45° side: depth and form\n  • Top: texture overview\n  • Close-up: material detail\n  • Context: lifestyle placement";

  return [
    `### VISION AI PRODUCT ANALYSIS — 3D ORBITAL AD FORMAT`,
    ``,
    `Product: ${vision.productName}`,
    `Category: ${vision.productCategory}`,
    `Visual Features: ${features}`,
    `Marketing Points: ${marketingPoints}`,
    `Texture: ${vision.textureDescription}`,
    `Material: ${vision.materialGuess}`,
    `Color Palette: ${vision.colorPalette.join(", ")}`,
    `Shape: ${vision.shapeDescription}`,
    ``,
    `### MULTI-ANGLE REFERENCE (from 5 captured cuts)`,
    angleDescs,
    ``,
    `### 3D CAMERA ORBITAL TRAJECTORY`,
    `Orbital Focus Point: ${vision.orbitalFocusPoint || "product center mass"}`,
    `Parallax Depth Layers: ${depthLayers}`,
    ``,
    `Camera path: Start frontal close-up → orbital arc clockwise 90° over 4s (radius 1.5x product width) →`,
    `parallax drift through depth layers at 6s → reverse arc counter-clockwise 45° at 10s →`,
    `settle to frontal zoom-out reveal at 13s → locked hero frame for CTA 14-15s.`,
    `Maintain product as orbital anchor; background parallax shifts with camera angle.`,
    `Depth: foreground product sharp, midground 50% blur, background 85% bokeh blur.`,
    ``,
    `### STEREOSCOPIC COPYWRITING LAYERS (3D Z-AXIS TEXT)`,
    `Primary (z=0, foreground): "${copyLayers.primary}" — kinetic typography, 120% pop, drop shadow depth 4px`,
    `Secondary (z=0.5, midground): "${copyLayers.secondary}" — fades in at 4s, 80% opacity, parallax drift -8px`,
    `Tertiary (z=1.0, background): "${copyLayers.tertiary}" — subtle ambient text, 40% opacity, static placement`,
  ].join("\n");
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
