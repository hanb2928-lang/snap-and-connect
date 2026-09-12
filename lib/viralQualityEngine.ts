/**
 * Top-1% Viral Quality Engine
 *
 * Analyzes and applies the success factors of top-1% viral short-form videos
 * across YouTube Shorts, TikTok, Instagram Reels, and Naver Clip.
 *
 * Three core pillars:
 * 1. Visual Impact — cinematic composition, gaze focus, lighting, transitions
 * 2. Hook & Retention — first 1-3s visual/textual hook structure, zero-churn design
 * 3. Prompt Augmentation — auto-expand user prompts into top-1% level camera
 *    walking, micro-motion, lens, and lighting instructions
 */

export type ViralPlatform = 'shorts' | 'tiktok' | 'reels' | 'naverclip';

export interface CinematicCameraSpec {
  shotType: string;
  lensMm: string;
  aperture: string;
  lightingSetup: string;
  cameraMovement: string;
  microMotion: string;
}

export interface HookStructure {
  visualHook: string;
  textHook: string;
  durationSec: number;
  gazeAnchor: string;
  motionTrigger: string;
  retentionTechniques: string[];
}

export interface Top1VisualBenchmark {
  platform: ViralPlatform;
  compositionRule: string;
  gazeFocus: string;
  lightingStyle: string;
  transitionStyle: string;
  colorGrading: string;
  avgCutIntervalSec: number;
  hookDurationSec: number;
  retentionCurve: number[];
}

const PLATFORM_VISUAL_BENCHMARKS: Record<ViralPlatform, Top1VisualBenchmark> = {
  shorts: {
    platform: 'shorts',
    compositionRule: 'Rule of thirds with subject placed in upper-third for vertical 9:16; negative space in lower third for captions',
    gazeFocus: 'Direct eye contact with camera lens in first frame; subject fills 60-70% of frame width',
    lightingStyle: 'Soft key light at 45° camera-left, subtle rim light for depth separation; no harsh shadows',
    transitionStyle: 'Match-cut on motion, whip-pan transitions at beat peaks, zero cross-dissolves',
    colorGrading: 'Warm highlights (5600K shifted +200K), crushed blacks for contrast, saturation +15%',
    avgCutIntervalSec: 1.8,
    hookDurationSec: 2.0,
    retentionCurve: [1.0, 0.92, 0.85, 0.78, 0.72, 0.68, 0.65, 0.62, 0.6, 0.58, 0.56, 0.55, 0.54, 0.53, 0.52],
  },
  tiktok: {
    platform: 'tiktok',
    compositionRule: 'Center-weighted composition for FYP thumb-stop; subject fills 70-80% frame; high contrast against background',
    gazeFocus: 'Immediate direct-to-camera gaze; fast subject movement within first 0.5s to trigger dopamine response',
    lightingStyle: 'High-key bright lighting, ring light primary, ambient fill; no moody low-key looks',
    transitionStyle: 'Jump cuts every 1.5s, zoom-punch on beat drops, screen-shake on impact moments',
    colorGrading: 'Vibrant pop, saturation +25%, warm skin tones, blue-teal shadows for separation',
    avgCutIntervalSec: 1.5,
    hookDurationSec: 0.5,
    retentionCurve: [1.0, 0.88, 0.75, 0.65, 0.58, 0.52, 0.48, 0.45, 0.43, 0.41, 0.4, 0.39, 0.38, 0.37, 0.36],
  },
  reels: {
    platform: 'reels',
    compositionRule: 'Cinematic asymmetry, subject in left or right third; shallow depth of field for subject isolation',
    gazeFocus: 'Soft gaze, not always direct to camera; storytelling expression; emotional micro-expressions in first 2s',
    lightingStyle: 'Golden hour warmth, natural window light, soft diffusion; backlight for halo effect on subject',
    transitionStyle: 'Smooth speed-ramp transitions, seamless match-action, minimal hard cuts',
    colorGrading: 'Filmic teal-orange, muted mid-tones, warm highlights, deep but not crushed blacks',
    avgCutIntervalSec: 2.0,
    hookDurationSec: 2.5,
    retentionCurve: [1.0, 0.94, 0.88, 0.82, 0.76, 0.71, 0.67, 0.64, 0.61, 0.59, 0.57, 0.56, 0.55, 0.54, 0.53],
  },
  naverclip: {
    platform: 'naverclip',
    compositionRule: 'Product-centric center composition; clean uncluttered background; information-dense framing',
    gazeFocus: 'Product hero shot first; presenter gaze to product, not camera; trust-building angle',
    lightingStyle: 'Clean bright studio lighting, even key+fill ratio, minimal shadows for product clarity',
    transitionStyle: 'Information cuts, text-overlay transitions, clean wipe transitions synced to VO',
    colorGrading: 'Neutral natural colors, accurate product representation, slight warmth for approachability',
    avgCutIntervalSec: 2.5,
    hookDurationSec: 3.0,
    retentionCurve: [1.0, 0.93, 0.86, 0.80, 0.75, 0.70, 0.66, 0.63, 0.60, 0.58, 0.56, 0.55, 0.54, 0.53, 0.52],
  },
};

const CINEMATIC_CAMERA_PRESETS: Record<string, CinematicCameraSpec> = {
  gaze_hook: {
    shotType: 'Extreme close-up (ECU), subject eyes fill upper third of frame',
    lensMm: '85mm equivalent, shallow depth of field f/1.8',
    aperture: 'f/1.8 — bokeh background isolation',
    lightingSetup: 'Rembrandt key light 45° camera-left at eye level, subtle fill 1:4 ratio, rim light for separation',
    cameraMovement: 'Slow dolly-in from 1.05x to 1.22x over 2 seconds, handheld micro-tremor for organic feel',
    microMotion: '0.5° rotation drift, natural breathing sway, 2px vertical drift simulating human hold',
  },
  need_discovery: {
    shotType: 'Medium close-up (MCU), product visible with environmental context',
    lensMm: '50mm equivalent, moderate depth of field f/2.8',
    aperture: 'f/2.8 — context visible but subject prioritized',
    lightingSetup: 'Practical lighting integrated, soft bounce fill, ambient atmosphere visible',
    cameraMovement: 'Lateral pan from +4 to -4 on X axis, ease-in-out cubic, 1.5s duration',
    microMotion: 'Parallax shift on background, focus pull from foreground to product at midpoint',
  },
  transformation: {
    shotType: 'Medium shot (MS), full product-in-use context visible',
    lensMm: '35mm equivalent, deeper depth of field f/4.0',
    aperture: 'f/4.0 — full scene sharp for transformation reveal',
    lightingSetup: 'Motivated lighting shift — warm key transforms to cool key, simulating time/usage passage',
    cameraMovement: 'Tilt reveal from +4 to -4 on Y axis, ease-out quart, ascending motion',
    microMotion: 'Subtle rack focus from hands to product to face, 0.3s each beat',
  },
  cta_call: {
    shotType: 'Medium-wide shot, subject + product + CTA text space in lower third',
    lensMm: '35mm equivalent, balanced depth of field f/3.5',
    aperture: 'f/3.5 — subject and product both in focus',
    lightingSetup: 'Even key+fill, bright and approachable, no dramatic shadows for CTA clarity',
    cameraMovement: 'Slow pull-back from 1.3x to 1.0x, stabilizing to fixed frame for text overlay',
    microMotion: 'Settling motion, zero drift after 0.5s, locked frame for final CTA text burn-in',
  },
};

const HOOK_TEXT_PATTERNS: Record<string, string[]> = {
  curiosity: [
    '이거 진짜였어?', '다들 놀라는 중', '알고 보니 이런 거였어',
    '이거 모르면 손해', '왜 이제야 알았지', '이거 때문에 달라졌어',
  ],
  problem: [
    '이거 때문에 스트레스받았어', '다들 이걸로 고생함', '해결책 찾았어',
    '이거 하나면 끝', '더 이상 고민 안 해도 돼', '이걸로 해결됐어',
  ],
  transformation: [
    'before: 이랬는데 after: 이렇게 됐어', '사용 전후 비교 충격',
    '이거 쓰고 나서 달라졌어', '변화가 진짜임', '이거 쓰면 이렇게 돼',
  ],
  social_proof: [
    '이 동네 1위', '다들 이거 사감', '리뷰 1만 개',
    '이거 산 사람들 반응', '베스트셀러 확정', '판매 1위 품목',
  ],
  fomo: [
    '품절 전에 확인', '선찹순 마감 임박', '이번 주까지만',
    '놓치면 다시 없어', '재입고 언제 될지 모름', '지금 아니면 손해',
  ],
};

const RETENTION_TECHNIQUES = [
  'First 2 seconds: zero scene change, locked gaze anchor, escalating audio intensity',
  'Cut interval accelerates from 2.5s to 1.5s by midpoint, creating rhythmic urgency',
  'Visual pattern interrupt every 3-4 seconds: color shift, angle change, or motion direction reversal',
  'Kill-point captions appear 0.3s before audio emphasis peak, pre-loading viewer attention',
  'Last 3 seconds: camera locks to fixed frame, CTA text burns in, audio holds at peak intensity',
  'Audio-visual sync tolerance: 0.1s maximum desync between cut points and beat peaks',
  'BGM ducked to -6dB during VO, raised to -3dB during instrumental breaks for energy recovery',
];

/**
 * Build a structured visual hook for the first 1-3 seconds.
 * Combines platform-specific gaze anchor with motion trigger and text hook.
 */
export function buildVisualHook(
  platform: ViralPlatform,
  hookCategory: keyof typeof HOOK_TEXT_PATTERNS = 'curiosity',
  productName?: string,
): HookStructure {
  const benchmark = PLATFORM_VISUAL_BENCHMARKS[platform];
  const textHooks = HOOK_TEXT_PATTERNS[hookCategory] ?? HOOK_TEXT_PATTERNS.curiosity;
  const textHook = textHooks[Math.floor(Math.random() * textHooks.length)];
  const cameraSpec = CINEMATIC_CAMERA_PRESETS.gaze_hook;

  const platformGazeAnchor: Record<ViralPlatform, string> = {
    shorts: 'Direct eye contact with camera lens, subject upper-third, expression: subtle surprise transitioning to confidence',
    tiktok: 'Fast head turn to camera at 0.3s, eyes wide, micro-expression of discovery, body language: leaning in',
    reels: 'Soft gaze slightly off-camera then slow turn to lens at 1.5s, expression: vulnerability to empowerment',
    naverclip: 'Product hero shot centered, presenter hand enters frame at 0.5s pointing to product key feature',
  };

  const platformMotionTrigger: Record<ViralPlatform, string> = {
    shorts: 'Slow dolly-in 1.05x→1.22x over 2s with handheld micro-tremor, depth compression intensifies gaze',
    tiktok: 'Snap zoom to 1.3x at 0.2s then settle to 1.15x by 1s, screen-shake impact on beat 1',
    reels: 'Gentle push-in 1.0x→1.1x over 2.5s, parallax drift on background bokeh, dreamy motion',
    naverclip: 'Static locked frame first 1s, then 5° tilt-down reveal of product detail at 1.5s',
  };

  return {
    visualHook: cameraSpec.shotType,
    textHook,
    durationSec: benchmark.hookDurationSec,
    gazeAnchor: platformGazeAnchor[platform],
    motionTrigger: platformMotionTrigger[platform],
    retentionTechniques: RETENTION_TECHNIQUES,
  };
}

/**
 * Augment a user's basic prompt into a top-1% level cinematic prompt
 * with camera walking, micro-motion, lens, and lighting instructions.
 *
 * This is the core prompt augmentation function — it takes a simple user
 * instruction like "망고주스 30% 할인" and expands it into a detailed
 * cinematographic prompt that matches or exceeds top-1% viral quality.
 */
export function augmentPromptToTop1Quality(
  userPrompt: string,
  platform: ViralPlatform,
  bgmMood?: string,
  productName?: string,
  cutCount: number = 5,
  hookCategory: keyof typeof HOOK_TEXT_PATTERNS = 'curiosity',
): string {
  const benchmark = PLATFORM_VISUAL_BENCHMARKS[platform];
  const hook = buildVisualHook(platform, hookCategory, productName);

  // Build per-segment camera instructions
  const storyPhases = ['gaze_hook', 'need_discovery', 'transformation', 'cta_call'];
  const segmentDirectives: string[] = [];

  for (let i = 0; i < Math.min(cutCount, storyPhases.length); i++) {
    const phase = storyPhases[i];
    const spec = CINEMATIC_CAMERA_PRESETS[phase];
    const startSec = i === 0 ? 0 : Math.round(i * (15 / cutCount) * 10) / 10;
    const endSec = i === cutCount - 1 ? 15 : Math.round((i + 1) * (15 / cutCount) * 10) / 10;

    segmentDirectives.push(
      `[${startSec}-${endSec}s] ${spec.shotType}. ` +
      `Camera: ${spec.cameraMovement}. ` +
      `Lens: ${spec.lensMm}. ` +
      `Lighting: ${spec.lightingSetup}. ` +
      `Micro-motion: ${spec.microMotion}.`,
    );
  }

  // Mood-specific color grading and motion enhancement
  const moodEnhancements: Record<string, string> = {
    '하이텐션': 'High-energy color grade: saturation +25%, contrast +20%, punchy highlights, motion blur on fast cuts',
    '시네마틱': 'Cinematic color grade: teal-orange split tone, film grain 15%, anamorphic lens flare on light sources, letterbox safe',
    'ASMR': 'Soft intimate color grade: warm muted tones, shallow depth of field f/1.4, gentle glow on highlights, minimal motion blur',
    '감성': 'Emotional color grade: warm golden tones, soft contrast, bloom on highlights, gentle vignette, filmic curves',
    '로파이': 'Lofi color grade: desaturated -10%, warm tint, slight grain, vintage film emulation, muted blacks',
  };
  const moodGrade = bgmMood ? (moodEnhancements[bgmMood] ?? moodEnhancements['하이텐션']) : moodEnhancements['하이텐션'];

  // Platform-specific composition and pacing
  const platformDirectives: Record<ViralPlatform, string> = {
    shorts: `Composition: ${benchmark.compositionRule}. Gaze: ${benchmark.gazeFocus}. Cut interval: ${benchmark.avgCutIntervalSec}s accelerating. Transition: ${benchmark.transitionStyle}.`,
    tiktok: `Composition: ${benchmark.compositionRule}. Gaze: ${benchmark.gazeFocus}. Cut interval: ${benchmark.avgCutIntervalSec}s with jump-cut emphasis. Transition: ${benchmark.transitionStyle}. Screen-shake on impact moments.`,
    reels: `Composition: ${benchmark.compositionRule}. Gaze: ${benchmark.gazeFocus}. Cut interval: ${benchmark.avgCutIntervalSec}s with speed-ramp transitions. Transition: ${benchmark.transitionStyle}.`,
    naverclip: `Composition: ${benchmark.compositionRule}. Gaze: ${benchmark.gazeFocus}. Cut interval: ${benchmark.avgCutIntervalSec}s with information density. Transition: ${benchmark.transitionStyle}.`,
  };

  // Hook directive for first 1-3 seconds
  const hookDirective =
    `HOOK (first ${hook.durationSec}s): ${hook.gazeAnchor}. ` +
    `Motion: ${hook.motionTrigger}. ` +
    `Text overlay: "${hook.textHook}" — appears at 0.3s, kinetic typography, 120% scale pop-in. ` +
    `ZERO scene changes in first ${hook.durationSec}s — locked frame, escalating audio only.`;

  // Retention curve directive
  const retentionDirective =
    `RETENTION CURVE: Maintain visual interest with pattern interrupts every 3-4s. ` +
    `Kill-point captions appear 0.3s before audio emphasis peaks. ` +
    `Last 3 seconds: camera locks to fixed frame for CTA burn-in. ` +
    `Audio-visual sync tolerance: 0.1s max desync.`;

  // Assemble final augmented prompt
  const augmented = [
    `### CINEMATIC VIDEO GENERATION PROMPT — TOP-1% VIRAL QUALITY`,
    ``,
    `Subject: ${userPrompt}${productName ? ` featuring ${productName}` : ''}.`,
    ``,
    `### HOOK STRUCTURE (first ${hook.durationSec} seconds)`,
    hookDirective,
    ``,
    `### CINEMATOGRAPHY — PER-SEGMENT CAMERA SPECS`,
    segmentDirectives.join('\n'),
    ``,
    `### PLATFORM OPTIMIZATION — ${platform.toUpperCase()}`,
    platformDirectives[platform],
    ``,
    `### COLOR GRADING & VISUAL TONE`,
    moodGrade,
    `Color grading: ${benchmark.colorGrading}.`,
    ``,
    `### RETENTION ENGINE`,
    retentionDirective,
    RETENTION_TECHNIQUES.map((t) => `  - ${t}`).join('\n'),
    ``,
    `### QUALITY LOCK`,
    `Photorealistic, 4K resolution, natural skin tones, no text artifacts, no warped faces, ` +
    `seamless motion, clean composition, professional color science, no caption burn-in ` +
    `(text overlays are post-production layer only).`,
  ].join('\n');

  return augmented;
}

/**
 * Score a video generation prompt against top-1% quality criteria.
 * Returns a 0-100 score and factor breakdown.
 */
export interface PromptQualityScore {
  totalScore: number;
  grade: 'S' | 'A' | 'B' | 'C' | 'D';
  factors: { label: string; score: number; maxScore: number; detail: string }[];
}

export function scorePromptQuality(prompt: string): PromptQualityScore {
  const factors: { label: string; score: number; maxScore: number; detail: string }[] = [];

  // Factor 1: Camera movement specificity (0-25)
  const cameraKeywords = ['dolly', 'pan', 'tilt', 'zoom', 'orbit', 'arc', 'push', 'pull', 'rack focus', 'parallax'];
  const cameraHits = cameraKeywords.filter((k) => prompt.toLowerCase().includes(k)).length;
  const cameraScore = Math.min(25, cameraHits * 5);
  factors.push({
    label: '카메라 움킹 구체성',
    score: cameraScore,
    maxScore: 25,
    detail: cameraScore >= 20 ? '다양한 카메라 무빙 명시됨' : cameraScore >= 10 ? '기본 카메라 무빙 포함' : '카메라 무빙 미흡',
  });

  // Factor 2: Lighting setup (0-20)
  const lightKeywords = ['key light', 'rim light', 'fill', 'rembrandt', 'golden hour', 'backlight', 'softbox', 'high-key', 'low-key'];
  const lightHits = lightKeywords.filter((k) => prompt.toLowerCase().includes(k)).length;
  const lightScore = Math.min(20, lightHits * 5);
  factors.push({
    label: '조명 설계',
    score: lightScore,
    maxScore: 20,
    detail: lightScore >= 15 ? '전문 조명 설계 포함' : lightScore >= 10 ? '기본 조명 명시' : '조명 미흡',
  });

  // Factor 3: Hook structure (0-25)
  const hookKeywords = ['hook', 'gaze', 'first', '0.5s', '1s', '2s', '3s', 'dopamine', 'attention', 'thumb-stop'];
  const hookHits = hookKeywords.filter((k) => prompt.toLowerCase().includes(k)).length;
  const hookScore = Math.min(25, hookHits * 4);
  factors.push({
    label: '후킹 구조',
    score: hookScore,
    maxScore: 25,
    detail: hookScore >= 20 ? '정밀 후킹 타이밍 설계' : hookScore >= 12 ? '후킹 구조 포함' : '후킹 미흡',
  });

  // Factor 4: Micro-motion & lens detail (0-15)
  const microKeywords = ['micro', 'tremor', 'sway', 'drift', 'breathing', '85mm', '50mm', '35mm', 'f/1.8', 'f/2.8', 'bokeh', 'depth of field'];
  const microHits = microKeywords.filter((k) => prompt.toLowerCase().includes(k)).length;
  const microScore = Math.min(15, microHits * 3);
  factors.push({
    label: '마이크로 모션 & 렌즈',
    score: microScore,
    maxScore: 15,
    detail: microScore >= 12 ? '마이크로 모션 및 렌즈 스펙 상세' : microScore >= 6 ? '기본 렌즈 정보' : '마이크로 모션 미흡',
  });

  // Factor 5: Retention engineering (0-15)
  const retentionKeywords = ['retention', 'cut interval', 'pattern interrupt', 'kill-point', 'sync', 'cta', 'burn-in', '0.1s'];
  const retentionHits = retentionKeywords.filter((k) => prompt.toLowerCase().includes(k)).length;
  const retentionScore = Math.min(15, retentionHits * 3);
  factors.push({
    label: '리텐션 엔지니어링',
    score: retentionScore,
    maxScore: 15,
    detail: retentionScore >= 12 ? '리텐션 곡선 및 동기화 설계 완료' : retentionScore >= 6 ? '기본 리텐션 구조' : '리텐션 미흡',
  });

  const totalScore = factors.reduce((sum, f) => sum + f.score, 0);
  const grade: PromptQualityScore['grade'] = totalScore >= 85 ? 'S' : totalScore >= 70 ? 'A' : totalScore >= 55 ? 'B' : totalScore >= 40 ? 'C' : 'D';

  return { totalScore, grade, factors };
}

export function getVisualBenchmark(platform: ViralPlatform): Top1VisualBenchmark {
  return PLATFORM_VISUAL_BENCHMARKS[platform];
}

export function getCinematicCameraSpec(phase: string): CinematicCameraSpec | null {
  return CINEMATIC_CAMERA_PRESETS[phase] ?? null;
}

export function getRetentionCurve(platform: ViralPlatform): number[] {
  return PLATFORM_VISUAL_BENCHMARKS[platform].retentionCurve;
}

export { PLATFORM_VISUAL_BENCHMARKS, CINEMATIC_CAMERA_PRESETS, RETENTION_TECHNIQUES };
