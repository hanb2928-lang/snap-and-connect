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
  imageUrls?: string[] | null;
}

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 2000;
const RUNWAY_POLL_INTERVAL_MS = 2000;
const RUNWAY_MAX_POLL_ATTEMPTS = 70;
const RUNWAY_SUBMIT_TIMEOUT_MS = 30000;
const RUNWAY_POLL_TIMEOUT_MS = 10000;

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

    let effectivePrompt = body.prompt ?? "";
    if (effectivePrompt.trim().length === 0) {
      effectivePrompt = buildAutoPrompt(body.productName, body.productVision, body.captionText);
    }

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

    const durationSec = Math.min(body.durationSec ?? 10, 10);
    const aspectRatio = body.aspectRatio ?? "9:16";
    const variationSeed = body.variationSeed ?? 0;

    const motionPrompt = buildMotionPrompt(
      effectivePrompt,
      body.productName,
      aspectRatio,
      variationSeed,
      body.bgmMood,
      body.captionText,
      body.cutCount,
      body.platform ?? "shorts",
      body.hookCategory ?? "curiosity",
      body.cutCount,
      body.productVision ?? null,
    );

    const runwayPrompt = motionPrompt.slice(0, 500);

    let videoUrl: string | null = null;
    let taskId = "";
    let provider = "runway";
    let providerError: string | null = null;

    try {
      const result = await generateWithRunway(runwayPrompt, undefined, runwayKey, aspectRatio, durationSec);
      videoUrl = result.videoUrl;
      taskId = result.taskId;
    } catch (runwayErr) {
      providerError = runwayErr instanceof Error ? runwayErr.message : "Runway 비디오 생성 실패";
    }

    if (!videoUrl) {
      const errorDetail = providerError ?? "알 수 없는 오류";
      return new Response(
        JSON.stringify({
          error: `AI 비디오 생성에 실패했습니다: ${errorDetail}`,
          step: "runway",
          provider,
          motionPrompt: runwayPrompt,
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

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
        jobId: taskId,
        provider,
        motionPrompt: runwayPrompt,
        durationSec,
        aspectRatio,
        variationSeed,
        persisted: !!persistedUrl,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
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
  let lastProgress = "";

  for (let attempt = 0; attempt < RUNWAY_MAX_POLL_ATTEMPTS; attempt++) {
    await delay(RUNWAY_POLL_INTERVAL_MS);
    const status = await pollRunwayTask(taskId, apiKey);
    lastStatus = status.status;
    lastProgress = status.progress ?? "";

    if (status.status === "SUCCESS" && status.videoUrl) {
      videoUrl = status.videoUrl;
      break;
    }
    if (status.status === "FAILED") {
      throw new Error(status.error ?? "Runway 비디오 생성에 실패했습니다.");
    }
  }

  if (!videoUrl) {
    throw new Error(`Runway 비디오 생성 시간이 초과되었습니다. (마지막 상태: ${lastStatus}${lastProgress ? `, 진행률: ${lastProgress}` : ""})`);
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
  const timeoutId = setTimeout(() => controller.abort(), RUNWAY_SUBMIT_TIMEOUT_MS);

  try {
    const validDurations = [5, 10];
    const clampedSeconds = validDurations.reduce((closest, valid) =>
      Math.abs(valid - durationSec) < Math.abs(closest - durationSec) ? valid : closest, 5);
    const ratioValue = aspectRatio === "9:16" ? "768:1280" : aspectRatio === "16:9" ? "1280:768" : "768:768";

    const payload: Record<string, unknown> = {
      promptText: prompt,
      model: "gen4.5",
      seconds: clampedSeconds,
    };
    if (imageUrl) {
      payload.promptImage = { uri: imageUrl };
    } else {
      payload.ratio = ratioValue;
    }

    const resp = await fetch("https://api.dev.runwayml.com/v1/image_to_video", {
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

    if (!resp.ok) {
      const errText = await resp.text();
      let errDetail = errText.slice(0, 500);
      try {
        const errJson = JSON.parse(errText);
        errDetail = errJson?.error ?? errJson?.message ?? errDetail;
      } catch { /* keep raw text */ }
      if (resp.status === 401) {
        throw new Error(`Runway API 키가 유효하지 않거나 비활성화되었습니다. 설정에서 활성화된 Runway API 키를 다시 등록해주세요. (HTTP 401): ${errDetail}`);
      }
      if (resp.status === 400) {
        throw new Error(`Runway 요청 형식 오류 (HTTP 400): ${errDetail}`);
      }
      throw new Error(`Runway 생성 요청 실패 (HTTP ${resp.status}): ${errDetail}`);
    }

    const result = await resp.json();
    const taskId = result.taskId ?? result.id;
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
      headers: { Authorization: `Bearer ${apiKey}` },
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

    if (status === "SUCCESS" || status === "COMPLETED") {
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
): string {
  const parts: string[] = [];

  const name = productName || vision?.productName || "제품";
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

function buildMotionPrompt(
  userPrompt: string,
  productName: string | undefined,
  aspectRatio: string,
  variationSeed: number,
  bgmMood: string | undefined,
  captionText: string | undefined,
  _cutCount: number,
  platform: string = "shorts",
  hookCategory: string = "curiosity",
  explicitCutCount?: number,
  productVision?: ProductVisionData | null,
): string {
  const orientation = aspectRatio === "9:16" ? "vertical portrait 9:16" : aspectRatio === "16:9" ? "horizontal landscape 16:9" : "square 1:1";
  const effectiveCutCount = explicitCutCount ?? 3;

  const platformBenchmarks: Record<string, {
    composition: string; gaze: string; lighting: string; transition: string; colorGrade: string; cutInterval: number; hookSec: number;
  }> = {
    shorts: {
      composition: "Rule of thirds, subject upper-third, negative space lower third for captions",
      gaze: "Dynamic 3D product rotation with particle effects, no human subject needed",
      lighting: "Studio 3-point lighting with animated color shifts, rim light for depth",
      transition: "Seamless 3D morph transitions, camera whoosh between scenes, zero cross-dissolves",
      colorGrade: "Warm highlights +200K, crushed blacks, saturation +15%",
      cutInterval: 1.8,
      hookSec: 2.0,
    },
    tiktok: {
      composition: "Center-weighted, product fills 70-80% frame, high contrast against dynamic background",
      gaze: "Fast 3D zoom-punch on product, kinetic energy, trending visual effects",
      lighting: "High-key bright, neon accent lighting, ambient fill, energetic atmosphere",
      transition: "Jump cuts with 3D zoom-punch on beat drops, particle burst transitions",
      colorGrade: "Vibrant pop, saturation +25%, warm skin tones, teal shadows",
      cutInterval: 1.5,
      hookSec: 0.5,
    },
    reels: {
      composition: "Cinematic asymmetry, product in left/right third, shallow depth of field with bokeh",
      gaze: "Smooth orbital camera around product, emotional atmospheric build",
      lighting: "Golden hour warmth, volumetric light rays, soft diffusion, backlight halo",
      transition: "Smooth speed-ramp transitions, seamless 3D match-action, minimal hard cuts",
      colorGrade: "Filmic teal-orange, muted mid-tones, warm highlights, deep blacks",
      cutInterval: 2.0,
      hookSec: 2.5,
    },
    naverclip: {
      composition: "Product-centric center, clean uncluttered background, info-dense framing",
      gaze: "Product hero shot with clean 3D rotation, info-graphic overlay style",
      lighting: "Clean bright studio, even key+fill ratio, minimal shadows for clarity",
      transition: "Information cuts, 3D text overlay transitions, clean wipe synced to VO",
      colorGrade: "Neutral natural colors, accurate product representation, slight warmth",
      cutInterval: 2.5,
      hookSec: 3.0,
    },
  };
  const benchmark = platformBenchmarks[platform] ?? platformBenchmarks.shorts;

  const scenePhases = [
    {
      phase: "LOSS_AVERSION_HOOK",
      scene: `Cinematic 3D product reveal — ${productName ?? "product"} emerges from darkness with particle dispersion, volumetric light shafts, and dramatic slow-motion materialization. Visual metaphor: product appears as the ONE thing the viewer is about to miss. Dark crimson rim lighting creates sense of urgency and danger-of-missing-out.`,
      camera: `Dolly-in from black 1.05x→1.3x over ${benchmark.hookSec}s, shallow DOF, bokeh particles drifting through foreground. Camera pushes toward product as if viewer is being pulled in by curiosity.`,
      lighting: `Single motivated key light 45° camera-left, crimson rim light revealing product silhouette, ambient glow buildup. Shadow-heavy to create tension and loss-aversion feeling.`,
    },
    {
      phase: "PROBLEM_SOLUTION",
      scene: `Dynamic AI art showcase — ${productName ?? "product"} floating in 3D space with animated graphic elements. Split-screen before/after visual: left side shows problem state (desaturated, chaotic), right side shows solution state (vibrant, ordered with product). Cognitive friction resolved through clear visual contrast. Feature callout text materializes in air pointing to key product benefits.`,
      camera: `Orbital arc 90° clockwise around product, radius 1.5x product width, ease-in-out cubic, parallax background drift. Camera pauses at 45° to emphasize before/after split, then continues to full product reveal.`,
      lighting: `Color-shifting key light: starts cool/blue (problem state) transitions to warm/golden (solution state), simulating the transformation the product provides. Studio practicals pulsing to beat.`,
    },
    {
      phase: "SOCIAL_PROOF_URGENCY",
      scene: `Cinematic commercial sequence — ${productName ?? "product"} in aspirational lifestyle context with floating social proof elements (animated star ratings, review count badges, "1만+ 판매" counters materializing in 3D space). 3D environment morph into lifestyle context. Urgency elements: countdown timer overlay, "한정" badge pulsing, stock bar depleting. CTA text burns in with kinetic typography.`,
      camera: `Tilt reveal +8° on Y-axis, ascending crane move revealing full lifestyle context. Depth layers separating foreground product from social proof badges in midground. Final 2s: camera locks to hero frame for CTA text overlay.`,
      lighting: `Motivated lighting shift: warm key → bright approachable, simulating time-of-day passage from problem to solution. Lens flare accents at transition peaks. Final CTA frame: even key+fill, bright approachable, no dramatic shadows for CTA clarity, soft bloom on product edges.`,
    },
  ];

  const moodGrades: Record<string, string> = {
    "하이텐션": "High-energy: saturation +25%, contrast +20%, punchy highlights, motion blur on fast cuts, neon accent glow",
    "시네마틱": "Cinematic: teal-orange split tone, film grain 15%, anamorphic lens flare, letterbox safe, volumetric atmosphere",
    "ASMR": "Soft intimate: warm muted tones, f/1.4 shallow DOF, gentle glow on highlights, slow ethereal motion",
    "감성": "Emotional: warm golden tones, soft contrast, bloom on highlights, gentle vignette, dreamy particle drift",
    "로파이": "Lofi: desaturated -10%, warm tint, slight grain, vintage film emulation, retro color palette",
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

  const segmentDirectives = scenePhases.slice(0, Math.min(effectiveCutCount, scenePhases.length)).map((spec, i) => {
    const phaseRanges = ["0-2s", "3-9s", "10-15s"];
    const timeRange = phaseRanges[i] ?? `${i * 5}-${(i + 1) * 5}s`;
    return `[${timeRange}] ${spec.phase}: ${spec.scene}. Camera: ${spec.camera}. Lighting: ${spec.lighting}.`;
  }).join("\n");

  const hookDirective =
    `HOOK (0-2s): LOSS AVERSION + CURIOSITY. Cinematic 3D product materialization from darkness. ` +
    `Motion: Slow dolly-in with particle dispersion and volumetric light reveal. ` +
    `Psychology: Create immediate sense that viewer is about to miss something important. Dark crimson rim lighting = danger/urgency. ` +
    `Text: "${hookText}" materializes at 0.3s with kinetic 3D typography, 120% pop-in, depth shadow. ` +
    `ZERO scene changes in first ${benchmark.hookSec}s — escalating visual intensity only.`;

  const retentionDirective =
    `PSYCHOLOGY TIMELINE: [0-2s] Loss Aversion Hook → [3-9s] Problem/Solution Before-After → [10-15s] Social Proof + Urgency CTA. ` +
    `Cut interval ${benchmark.cutInterval}s accelerating. 3D scene morphs every 3-4s. ` +
    `Kinetic captions 0.3s before audio peaks. Last 3s: locked hero frame for CTA with urgency text. ` +
    `Audio-visual sync: 0.1s max desync.`;

  const captionHint = captionText ? `\nCaption context: "${captionText.slice(0, 80)}".` : "";

  const visionSection = productVision ? buildVisionPromptSection(productVision) : "";

  const promptParts = [
    `### PURCHASE-CONVERSION PSYCHOLOGY COMMERCIAL — TOP-1% AI-GENERATED VIDEO (no source photos)`,
    ``,
    `Create a completely new 10-second AI-generated commercial video featuring ${productName ?? "the product"}.`,
    `Do NOT use any input photographs as video frames. The 5 captured product photos were used ONLY for Vision AI metadata extraction.`,
    `All visual content must be freshly generated as dynamic AI artwork and cinematic 3D commercial scenes.`,
    ``,
    `### CONVERSION PSYCHOLOGY FRAMEWORK (3-Phase Timeline)`,
    `Phase 1 [0-2s] VISUAL HOOK: Loss Aversion + Curiosity — make viewer feel they're about to miss something critical`,
    `Phase 2 [3-9s] PROBLEM & SOLUTION: Cognitive Friction Resolution — before/after contrast, product as the clear solution`,
    `Phase 3 [10-15s] SOCIAL PROOF & URGENCY: Scarcity + Immediate Action CTA — social proof badges, countdown, stock urgency`,
    ``,
    `Subject: ${userPrompt}${productName ? ` featuring ${productName}` : ""}.`,
    `Format: ${orientation}.`,
    ``,
    `### HOOK STRUCTURE (0-2s) — LOSS AVERSION`,
    hookDirective,
    ``,
    `### CINEMATIC SCENE SEQUENCE — PSYCHOLOGY-DRIVEN 3D COMMERCIAL SCENES`,
    segmentDirectives,
    ``,
    `### PLATFORM OPTIMIZATION — ${platform.toUpperCase()}`,
    `Composition: ${benchmark.composition}. Visual style: ${benchmark.gaze}. Transition: ${benchmark.transition}.`,
    ``,
    `### COLOR GRADING & MOOD`,
    `${moodGrade}. Base: ${benchmark.colorGrade}.`,
    ``,
    `### RETENTION ENGINE — CONVERSION OPTIMIZED`,
    retentionDirective,
  ];

  if (visionSection) {
    promptParts.push(``, visionSection);
  }

  promptParts.push(
    ``,
    `### QUALITY LOCK`,
    `Fully AI-generated 3D cinematic visuals, 4K quality, professional commercial-grade rendering, no source photo frames, no slideshow, no image-to-image transitions. All scenes must be newly created digital artwork with product-accurate appearance derived from Vision AI metadata. Psychology framework: loss aversion → problem/solution → social proof/urgency must be visually evident throughout.${captionHint}`,
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

  return [
    `### VISION AI PRODUCT METADATA — AI ART CREATION REFERENCE (no source photos in output)`,
    ``,
    `The following product metadata was extracted from 5 reference photos via Vision AI analysis.`,
    `These photos are NOT used as video frames. Use this metadata to generate entirely new AI artwork depicting the product accurately.`,
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
    `### AI ART SCENE GENERATION — PRODUCT-ACCURATE CINEMATIC COMMERCIAL`,
    `Generate all visual scenes as original 3D-rendered AI artwork that accurately depicts the product using the metadata above.`,
    `Product appearance must match: shape (${vision.shapeDescription}), material (${vision.materialGuess}), color palette, and texture.`,
    `Do NOT reproduce the reference photographs. Create new cinematic commercial scenes from imagination guided by product metadata.`,
    ``,
    `### 3D ORBITAL CAMERA TRAJECTORY — PSYCHOLOGY-DRIVEN (15s timeline)`,
    `  [0-2s] LOSS AVERSION HOOK: Product materializes from darkness — particle dispersion reveals product shape, dark crimson rim lighting, tension buildup`,
    `  [3-5s] PROBLEM STATE: Orbital arc clockwise 45° — desaturated cool tones, chaotic background elements suggesting the problem. Parallax depth layers: ${depthLayers}`,
    `  [5-9s] SOLUTION REVEAL: Arc continues to 90° — lighting shifts warm/golden, background orders itself, product becomes hero. Before/after visual contrast resolved.`,
    `  [10-13s] SOCIAL PROOF: Reverse arc returning to hero frontal — floating star ratings, review badges, sales counters materialize in 3D space around product`,
    `  [13-15s] URGENCY CTA: Locked hero frame, product centered, countdown timer overlay, "한정" badge, CTA text burn-in with kinetic typography`,
    ``,
    `Maintain product as visual anchor at all times. Environment and background are fully AI-generated, not from source photos.`,
    `Depth separation: foreground product razor-sharp, midground 50% blur, background 85% bokeh blur.`,
    ``,
    `### DYNAMIC COMMERCIAL LIGHTING & PARTICLE EFFECTS`,
    `  • Studio key light: 3-point setup — soft key 45° camera-left, rim light 135° camera-right, fill 1:3 ratio`,
    `  • Product-matched color temperature: warm key (3200K) for lifestyle products, cool key (5600K) for tech products`,
    `  • Motivated lighting shift: key light rotates with orbital camera, simulating real studio arc`,
    `  • Particle effects: subtle dust motes in background bokeh (8-12 particles, 2-4px, drifting upward 0.5px/frame)`,
    `  • Lens flare: anamorphic horizontal flare on rim light peaks at 4s and 10s, 15% opacity, 2px height`,
    `  • Specular highlights: controlled highlights on product surfaces following material properties (${vision.materialGuess})`,
    ``,
    `### KINETIC COPYWRITING LAYERS (3D Z-AXIS TEXT)`,
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
