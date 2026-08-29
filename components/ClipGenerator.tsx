import { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Film, Download, Loader as Loader2, Play, RefreshCw, CircleAlert as AlertCircle, Music, Volume2, VolumeX, CloudUpload, Lightbulb, Mic, Sparkles, ChevronDown, Clock, X } from 'lucide-react-native';
import { theme } from '@/lib/theme';
import { getDisclosureShortForPlatforms } from '@/lib/disclosure';
import { uploadAssetBlobWithProgress, saveAssetRecord } from '@/lib/savedAssets';
import { urlToDataUrl } from '@/lib/base64';
import { getLogoUrl, drawLogoWatermark } from '@/lib/logoWatermark';
import { MobileClipGenerator } from '@/components/MobileClipGenerator';
import { RoamingBabyOverlay } from '@/components/RoamingBabyOverlay';
import { VideoProgressIndicator } from '@/components/VideoProgressIndicator';
import { TemplateBadge } from '@/components/TemplateBadge';
import { useHybridTemplate } from '@/hooks/useHybridTemplate';
import { drawRoamingBabyWithLink, preloadBabyImage } from '@/lib/canvasOverlay';
import { getUserSettings } from '@/lib/settings';
import { DEFAULT_DURATION, getRecommendedDuration } from '@/lib/durationPresets';
import type { PlatformKey, PlatformVariant, CustomReview } from '@/types/database';
import type { StyleRecommendation } from '@/lib/styleRecommend';

interface ClipGeneratorProps {
  imageUrl: string;
  hook: string;
  title: string;
  hashtags: string[];
  accentColor: string;
  category: string;
  fileName: string;
  affiliatePlatforms?: string[];
  platform?: PlatformKey;
  templateData?: {
    targetAudience?: string;
    emotionAngle?: string;
    platformVariants?: Record<PlatformKey, PlatformVariant>;
  } | null;
  customReview?: CustomReview | null;
  shortUrl?: string;
  recommendedStyle?: StyleRecommendation | null;
  styleAppliedKey?: string | null;
}

type GenState = 'idle' | 'generating' | 'done' | 'error';
type VideoFormat = 'vertical' | 'horizontal';
type CardStyleKey = 'bold' | 'magazine' | 'feed' | 'minimal';
type MusicMood = 'none' | 'upbeat' | 'calm' | 'emotional';
type MotionPreset = 'kenburns' | 'zoom-in' | 'zoom-out' | 'slide-in' | 'slow-motion';
type HybridMode = 'off' | 'photo-to-comic';

const MOTION_PRESETS: { label: string; value: MotionPreset; desc: string }[] = [
  { label: '켄번즈', value: 'kenburns', desc: '부드러운 줌인 + 위로 패닝. 기본 연출.' },
  { label: '줌인', value: 'zoom-in', desc: '빠르게 당기는 줌인으로 시선 집중.' },
  { label: '줌아웃', value: 'zoom-out', desc: '축소되며 전체가 드러나는 효과.' },
  { label: '슬라이드인', value: 'slide-in', desc: '왼쪽에서 슬라이드하며 등장.' },
  { label: '슬로우모션', value: 'slow-motion', desc: '느린 줌 + 페이드로 감성 연출.' },
];

const HYBRID_PRESETS: { label: string; value: HybridMode; desc: string }[] = [
  { label: '사용 안 함', value: 'off', desc: '실사만으로 동영상 생성.' },
  { label: '실사→만화', value: 'photo-to-comic', desc: '처음 1.5초 실사 후킹 → 만화 스타일 전환. 초반 3초 시선 사로잡기.' },
];

function getMotionParams(motion: MotionPreset, t: number): { scale: number; panX: number; panY: number; alpha: number } {
  switch (motion) {
    case 'zoom-in':
      return { scale: 1.05 + easeOutCubic(t) * 0.35, panX: 0, panY: -easeOutCubic(t) * 20, alpha: 1 };
    case 'zoom-out': {
      const zt = easeOutCubic(t);
      return { scale: 1.5 - zt * 0.35, panX: 0, panY: -zt * 15, alpha: 1 };
    }
    case 'slide-in': {
      const slideT = Math.min(t * 2.5, 1);
      const eased = easeOutCubic(slideT);
      return { scale: 1 + easeOutCubic(t) * 0.15, panX: (1 - eased) * -300, panY: -easeOutCubic(t) * 20, alpha: 1 };
    }
    case 'slow-motion': {
      const slowT = Math.pow(t, 0.6);
      return { scale: 1.02 + slowT * 0.12, panX: 0, panY: -slowT * 25, alpha: Math.min(t * 3, 1) };
    }
    default:
      return { scale: 1 + easeOutCubic(t) * 0.18, panX: 0, panY: -easeOutCubic(t) * 30, alpha: 1 };
  }
}



const PLATFORM_FORMAT_DEFAULT: Record<PlatformKey, VideoFormat> = {
  naverBlog: 'horizontal',
  shortform: 'vertical',
  instagram: 'vertical',
  threads: 'vertical',
  twitter: 'horizontal',
  pinterest: 'vertical',
  smartstore: 'horizontal',
};

const FORMAT_PRESETS: { label: string; value: VideoFormat; aspect: string }[] = [
  { label: '세로형', value: 'vertical', aspect: '9:16' },
  { label: '가로형', value: 'horizontal', aspect: '16:9' },
];

const STYLE_PRESETS: { label: string; value: CardStyleKey; tag: string; desc: string }[] = [
  { label: '볼드', value: 'bold', tag: 'REELS', desc: '숏폼 전용 · 큰 텍스트와 강렬한 색상 배지로 시선을 사로잡는 스타일. 릴스·쇼츠·틱톡에 최적화.' },
  { label: '매거진', value: 'magazine', tag: 'BLOG', desc: '블로그 전용 · 잡지처럼 우아한 레이아웃과 상세한 설명으로 신뢰감을 주는 스타일. 네이버 블로그에 최적화.' },
  { label: '피드', value: 'feed', tag: 'FEED', desc: '인스타 전용 · 사각형 비율에 리뷰 별점을 강조하여 구매를 유도하는 스타일. 인스타그램 피드에 최적화.' },
  { label: '미니멀', value: 'minimal', tag: 'X', desc: 'X(트위터) 전용 · 여백이 많은 깔끔한 디자인으로 핵심만 전달하는 스타일. 스레드·X 게시에 최적화.' },
];

const PLATFORM_STYLE_MAP: Record<PlatformKey, CardStyleKey> = {
  naverBlog: 'magazine',
  shortform: 'bold',
  twitter: 'minimal',
  instagram: 'feed',
  threads: 'minimal',
  pinterest: 'magazine',
  smartstore: 'magazine',
};

const MUSIC_PRESETS: { label: string; value: MusicMood }[] = [
  { label: '없음', value: 'none' },
  { label: '업비트', value: 'upbeat' },
  { label: '차분', value: 'calm' },
  { label: '감성', value: 'emotional' },
];

interface MusicPattern {
  notes: number[];
  noteDuration: number;
  waveType: string;
  volume: number;
  harmony: number[];
}

const MUSIC_PATTERNS: Record<Exclude<MusicMood, 'none'>, MusicPattern> = {
  upbeat: {
    notes: [261.63, 329.63, 392.0, 523.25, 392.0, 329.63, 392.0, 523.25],
    noteDuration: 180,
    waveType: 'triangle',
    volume: 0.12,
    harmony: [130.81, 196.0, 196.0, 261.63],
  },
  calm: {
    notes: [220.0, 277.18, 329.63, 277.18, 220.0, 277.18, 329.63, 440.0],
    noteDuration: 400,
    waveType: 'sine',
    volume: 0.1,
    harmony: [110.0, 164.81, 110.0, 164.81],
  },
  emotional: {
    notes: [196.0, 233.08, 293.66, 349.23, 293.66, 233.08, 196.0, 174.61],
    noteDuration: 320,
    waveType: 'sine',
    volume: 0.11,
    harmony: [98.0, 146.83, 98.0, 146.83],
  },
};

function createBgmStream(mood: Exclude<MusicMood, 'none'>, durationMs: number, playThroughSpeakers = false): { stream: any; stop: () => void } | null {
  if (typeof window === 'undefined' || !(window as any).AudioContext) return null;
  const audioCtx = new (window as any).AudioContext();
  const dest = audioCtx.createMediaStreamDestination();
  const masterGain = audioCtx.createGain();
  masterGain.gain.value = 0;
  masterGain.connect(dest);
  if (playThroughSpeakers) {
    masterGain.connect(audioCtx.destination);
  }

  const pattern = MUSIC_PATTERNS[mood];
  const totalNotes = Math.ceil(durationMs / pattern.noteDuration);
  const oscillators: any[] = [];

  const fadeInTime = Math.min(0.3, durationMs / 1000 / 3);
  const fadeOutStart = Math.max(0, durationMs / 1000 - 0.5);
  masterGain.gain.setValueAtTime(0, 0);
  masterGain.gain.linearRampToValueAtTime(pattern.volume, fadeInTime);
  masterGain.gain.setValueAtTime(pattern.volume, fadeOutStart);
  masterGain.gain.linearRampToValueAtTime(0, durationMs / 1000);

  for (let i = 0; i < totalNotes; i++) {
    const startTime = i * (pattern.noteDuration / 1000);
    const freq = pattern.notes[i % pattern.notes.length];
    const harmFreq = pattern.harmony[i % pattern.harmony.length];

    const osc = audioCtx.createOscillator();
    const noteGain = audioCtx.createGain();
    osc.type = pattern.waveType;
    osc.frequency.value = freq;
    noteGain.gain.setValueAtTime(0, startTime);
    noteGain.gain.linearRampToValueAtTime(0.6, startTime + 0.02);
    noteGain.gain.exponentialRampToValueAtTime(0.001, startTime + pattern.noteDuration / 1000 * 0.9);
    osc.connect(noteGain);
    noteGain.connect(masterGain);
    osc.start(startTime);
    osc.stop(startTime + pattern.noteDuration / 1000);
    oscillators.push(osc);

    const harmOsc = audioCtx.createOscillator();
    const harmGain = audioCtx.createGain();
    harmOsc.type = 'sine';
    harmOsc.frequency.value = harmFreq;
    harmGain.gain.setValueAtTime(0, startTime);
    harmGain.gain.linearRampToValueAtTime(0.3, startTime + 0.05);
    harmGain.gain.exponentialRampToValueAtTime(0.001, startTime + pattern.noteDuration / 1000);
    harmOsc.connect(harmGain);
    harmGain.connect(masterGain);
    harmOsc.start(startTime);
    harmOsc.stop(startTime + pattern.noteDuration / 1000);
    oscillators.push(harmOsc);
  }

  const stop = () => {
    try {
      oscillators.forEach((o) => { try { o.stop(); } catch { /* already stopped */ } });
      audioCtx.close();
    } catch { /* already closed */ }
  };

  return { stream: dest.stream, stop };
}

const FPS = 30;

const FORMATS: Record<VideoFormat, { width: number; height: number }> = {
  vertical: { width: 1080, height: 1920 },
  horizontal: { width: 1920, height: 1080 },
};

interface Layout {
  width: number;
  height: number;
  badge: { x: number; y: number; w: number; h: number; r: number };
  badgeText: { x: number; y: number; font: string };
  catTag: { x: number; y: number; w: number; h: number; r: number };
  catText: { x: number; y: number };
  hookBox: { x: number; yBase: number; w: number; h: number; r: number };
  hookText: { x: number; yOffset: number; maxWidth: number; lineHeight: number; font: string };
  title: { x: number; yBase: number; maxWidth: number; lineHeight: number; font: string };
  hashtags: { x: number; yBase: number; maxWidth: number; lineHeight: number; font: string };
  cta: { x: number; y: number; w: number; h: number; r: number };
  ctaText: { x: number; y: number; font: string };
  ctaDisclosure: { x: number; y: number };
  ctaShortUrl: { x: number; y: number };
  outro: {
    captionY: number;
    captionFont: string;
    urlY: number;
    urlFont: string;
  };
}

function getLayout(format: VideoFormat): Layout {
  const { width: W, height: H } = FORMATS[format];

  if (format === 'vertical') {
    return {
      width: W,
      height: H,
      badge: { x: 60, y: 120, w: 300, h: 56, r: 28 },
      badgeText: { x: 82, y: 148, font: '600 24px sans-serif' },
      catTag: { x: W - 200, y: 128, w: 140, h: 44, r: 10 },
      catText: { x: W - 188, y: 150 },
      hookBox: { x: 50, yBase: 0.52, w: W - 100, h: 140, r: 16 },
      hookText: { x: 84, yOffset: -48, maxWidth: W - 168, lineHeight: 64, font: '700 54px sans-serif' },
      title: { x: 60, yBase: 0.7, maxWidth: W - 120, lineHeight: 48, font: '600 38px sans-serif' },
      hashtags: { x: 60, yBase: 0.76, maxWidth: W - 120, lineHeight: 38, font: '500 30px sans-serif' },
      cta: { x: 60, y: H - 220, w: W - 120, h: 68, r: 16 },
      ctaText: { x: W / 2, y: H - 186, font: '700 30px sans-serif' },
      ctaDisclosure: { x: W / 2, y: H - 130 },
      ctaShortUrl: { x: W / 2, y: H - 104 },
      outro: {
        captionY: Math.round(H * 0.42),
        captionFont: '700 52px sans-serif',
        urlY: Math.round(H * 0.52),
        urlFont: '500 40px sans-serif',
      },
    };
  }

  return {
    width: W,
    height: H,
    badge: { x: 60, y: 80, w: 280, h: 52, r: 26 },
    badgeText: { x: 80, y: 106, font: '600 22px sans-serif' },
    catTag: { x: W - 200, y: 88, w: 140, h: 42, r: 10 },
    catText: { x: W - 188, y: 109 },
    hookBox: { x: 60, yBase: 0.42, w: 700, h: 120, r: 16 },
    hookText: { x: 90, yOffset: -40, maxWidth: 600, lineHeight: 56, font: '700 48px sans-serif' },
    title: { x: 60, yBase: 0.6, maxWidth: 800, lineHeight: 44, font: '600 36px sans-serif' },
    hashtags: { x: 60, yBase: 0.7, maxWidth: W - 120, lineHeight: 36, font: '500 28px sans-serif' },
    cta: { x: 60, y: H - 160, w: 480, h: 60, r: 16 },
    ctaText: { x: 300, y: H - 130, font: '700 26px sans-serif' },
    ctaDisclosure: { x: 300, y: H - 80 },
    ctaShortUrl: { x: 300, y: H - 56 },
    outro: {
      captionY: Math.round(H * 0.4),
      captionFont: '700 44px sans-serif',
      urlY: Math.round(H * 0.5),
      urlFont: '500 34px sans-serif',
    },
  };
}

function roundRect(
  ctx: any,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

function drawTextLines(
  ctx: any,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
) {
  const chars = Array.from(text);
  let line = '';
  let currentY = y;
  for (const char of chars) {
    if (char === '\n') {
      ctx.fillText(line, x, currentY);
      line = '';
      currentY += lineHeight;
      continue;
    }
    const testLine = line + char;
    if (ctx.measureText(testLine).width > maxWidth && line !== '') {
      ctx.fillText(line, x, currentY);
      line = char;
      currentY += lineHeight;
    } else {
      line = testLine;
    }
  }
  if (line) ctx.fillText(line, x, currentY);
  return currentY;
}

function loadImage(url: string, timeoutMs = 10000): Promise<any> {
  return new Promise((resolve, reject) => {
    const img = new (window as any).Image();
    if (!url.startsWith('data:')) {
      img.crossOrigin = 'anonymous';
    }
    const timer = setTimeout(() => {
      img.src = '';
      reject(new Error('이미지 로드 시간 초과'));
    }, timeoutMs);
    img.onload = () => {
      clearTimeout(timer);
      resolve(img);
    };
    img.onerror = () => {
      clearTimeout(timer);
      reject(new Error('이미지 로드 실패 (CORS 또는 네트워크 오류)'));
    };
    img.src = url;
  });
}

export function ClipGenerator(props: ClipGeneratorProps) {
  if (Platform.OS !== 'web') {
    return <MobileClipGenerator {...props} />;
  }
  return <WebClipGenerator {...props} />;
}

function WebClipGenerator({
  imageUrl,
  hook,
  title,
  hashtags,
  accentColor,
  category,
  fileName,
  affiliatePlatforms = [],
  platform = 'shortform',
  templateData = null,
  customReview = null,
  shortUrl = '',
  recommendedStyle = null,
  styleAppliedKey = null,
}: ClipGeneratorProps) {
  const [state, setState] = useState<GenState>('idle');
  const [progress, setProgress] = useState(0);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [clipDuration, setClipDuration] = useState(DEFAULT_DURATION);
  useEffect(() => {
    let mounted = true;
    getUserSettings().then((s) => {
      if (mounted && s?.default_video_duration) setClipDuration(Number(s.default_video_duration));
    }).catch(() => {});
    return () => { mounted = false; };
  }, []);
  const [format, setFormat] = useState<VideoFormat>(PLATFORM_FORMAT_DEFAULT[platform] || 'vertical');
  const [cardStyle, setCardStyle] = useState<CardStyleKey>(PLATFORM_STYLE_MAP[platform] || 'bold');
  const [musicMood, setMusicMood] = useState<MusicMood>('upbeat');
  const [motionPreset, setMotionPreset] = useState<MotionPreset>('kenburns');
  const [hybridMode, setHybridMode] = useState<HybridMode>('off');
  const lastAppliedKey = useRef<string | null>(null);
  const tpl = useHybridTemplate(
    { category, platform: platform as string, productName: title, fallbackHook: hook, fallbackHashtags: hashtags, fallbackAccentColor: accentColor, fallbackCardStyle: PLATFORM_STYLE_MAP[platform] || 'bold' },
    accentColor,
    PLATFORM_STYLE_MAP[platform] || 'bold',
    'upbeat',
  );
  const renderAccentColor = tpl.effectiveAccentColor;
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const [livePreviewPlaying, setLivePreviewPlaying] = useState(false);
  const [mascotEnabled, setMascotEnabled] = useState(true);
  const [autoDisclosure, setAutoDisclosure] = useState(true);
  const [cloudSaving, setCloudSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [renderTimedOut, setRenderTimedOut] = useState(false);
  const [videoMime, setVideoMime] = useState<string>('video/webm');
  const bgmStopRef = useRef<(() => void) | null>(null);
  const rafRef = useRef<number | null>(null);
  const recorderRef = useRef<any>(null);
  const canvasStreamRef = useRef<any>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recorderTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const renderTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelledRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewRafRef = useRef<number | null>(null);
  const previewImgRef = useRef<any>(null);
  const previewStartTimeRef = useRef<number>(0);

  useEffect(() => {
    let mounted = true;
    getUserSettings().then((s) => {
      if (mounted && s) {
        setMascotEnabled(s.mascot_enabled ?? true);
        setAutoDisclosure(s.auto_disclosure ?? true);
      }
    }).catch(() => {});
    return () => { mounted = false; };
  }, []);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimerRef.current !== null) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 4000);
  }, []);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      if (toastTimerRef.current !== null) clearTimeout(toastTimerRef.current);
      if (previewTimerRef.current !== null) clearTimeout(previewTimerRef.current);
      if (recorderTimerRef.current !== null) clearTimeout(recorderTimerRef.current);
      if (renderTimeoutRef.current !== null) clearTimeout(renderTimeoutRef.current);
      if (retryTimerRef.current !== null) { clearTimeout(retryTimerRef.current); retryTimerRef.current = null; }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      if (bgmStopRef.current) {
        bgmStopRef.current();
        bgmStopRef.current = null;
      }
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        try { recorderRef.current.stop(); } catch {}
      }
      if (canvasStreamRef.current) {
        try { canvasStreamRef.current.getTracks().forEach((t: any) => t.stop()); } catch {}
      }
    };
  }, []);

  useEffect(() => {
    setCardStyle(PLATFORM_STYLE_MAP[platform] || 'bold');
    setFormat(PLATFORM_FORMAT_DEFAULT[platform] || 'vertical');
    lastAppliedKey.current = null;
  }, [platform]);

  useEffect(() => {
    if (!tpl.result || !tpl.result.matched) return;
    if (lastAppliedKey.current) return;
    setCardStyle(tpl.effectiveCardStyle as CardStyleKey);
    setMusicMood(tpl.effectiveBgmMood as MusicMood);
  }, [tpl.result]);

  useEffect(() => {
    if (!recommendedStyle || !styleAppliedKey) return;
    if (lastAppliedKey.current === styleAppliedKey) return;
    lastAppliedKey.current = styleAppliedKey;
    setCardStyle(recommendedStyle.cardStyle);
    setMusicMood(recommendedStyle.musicMood);
    setMotionPreset(recommendedStyle.motionPreset);
    setFormat(recommendedStyle.format);
    setClipDuration(recommendedStyle.duration);
    setHybridMode(recommendedStyle.hybridMode);
    showToast('AI 추천 스타일이 적용되었습니다!');
  }, [recommendedStyle, styleAppliedKey, showToast]);

  useEffect(() => {
    return () => {
      if (bgmStopRef.current) bgmStopRef.current();
    };
  }, []);

  useEffect(() => {
    return () => {
      setVideoUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    };
  }, []);

  const stopPreview = useCallback(() => {
    if (bgmStopRef.current) {
      bgmStopRef.current();
      bgmStopRef.current = null;
    }
    setPreviewPlaying(false);
  }, []);

  const previewMusic = useCallback(() => {
    if (Platform.OS !== 'web') return;
    if (previewPlaying) {
      stopPreview();
      return;
    }
    if (musicMood === 'none') return;
    const result = createBgmStream(musicMood, 3000, true);
    if (!result) return;
    bgmStopRef.current = result.stop;
    setPreviewPlaying(true);
    if (previewTimerRef.current !== null) clearTimeout(previewTimerRef.current);
    previewTimerRef.current = setTimeout(() => {
      stopPreview();
    }, 3000);
  }, [musicMood, previewPlaying, stopPreview]);

  const stopLivePreview = useCallback(() => {
    if (previewRafRef.current !== null) {
      cancelAnimationFrame(previewRafRef.current);
      previewRafRef.current = null;
    }
    if (bgmStopRef.current) {
      bgmStopRef.current();
      bgmStopRef.current = null;
    }
    setLivePreviewPlaying(false);
  }, []);

  const startLivePreview = useCallback(async () => {
    if (livePreviewPlaying) {
      stopLivePreview();
      return;
    }
    try {
      const safeImageUrl = await urlToDataUrl(imageUrl);
      const img = await loadImage(safeImageUrl);
      previewImgRef.current = img;
      const L = getLayout(format);
      const canvas = previewCanvasRef.current;
      if (!canvas) return;
      canvas.width = L.width;
      canvas.height = L.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      if (musicMood !== 'none') {
        const bgm = createBgmStream(musicMood, clipDuration, true);
        if (bgm) bgmStopRef.current = bgm.stop;
      }

      const cachedGrad = ctx.createLinearGradient(0, 0, 0, L.height);
      cachedGrad.addColorStop(0, 'rgba(10,15,30,0.25)');
      cachedGrad.addColorStop(0.45, 'rgba(10,15,30,0.55)');
      cachedGrad.addColorStop(1, 'rgba(10,15,30,0.95)');

      let halftoneCanvas: HTMLCanvasElement | null = null;
      if (hybridMode === 'photo-to-comic') {
        halftoneCanvas = document.createElement('canvas');
        halftoneCanvas.width = L.width;
        halftoneCanvas.height = L.height;
        const hctx = halftoneCanvas.getContext('2d');
        if (hctx) {
          hctx.fillStyle = accentColor;
          for (let dy = 0; dy < L.height; dy += 24) {
            for (let dx = 0; dx < L.width; dx += 24) {
              hctx.beginPath();
              hctx.arc(dx, dy, 3, 0, Math.PI * 2);
              hctx.fill();
            }
          }
        }
      }

      previewStartTimeRef.current = performance.now();
      setLivePreviewPlaying(true);

      const drawPreviewFrame = () => {
        const elapsed = performance.now() - previewStartTimeRef.current;
        const t = Math.min(elapsed / clipDuration, 1);
        const img = previewImgRef.current;
        if (!img || !ctx) return;

        ctx.fillStyle = '#0a0f1e';
        ctx.fillRect(0, 0, L.width, L.height);

        const motion = getMotionParams(motionPreset, t);
        const scale = motion.scale;
        const imgRatio = img.width / img.height;
        const canvasRatio = L.width / L.height;
        let drawW: number, drawH: number;
        if (imgRatio > canvasRatio) {
          drawH = L.height * scale;
          drawW = drawH * imgRatio;
        } else {
          drawW = L.width * scale;
          drawH = drawW / imgRatio;
        }
        const panY = (L.height - drawH) / 2 + motion.panY;
        const panX = (L.width - drawW) / 2 + motion.panX;

        ctx.globalAlpha = motion.alpha;
        ctx.drawImage(img, panX, panY, drawW, drawH);
        ctx.globalAlpha = 1;

        const hybridTP = 0.25;
        const isHybrid = hybridMode === 'photo-to-comic';
        const inComic = isHybrid && t >= hybridTP;
        if (inComic) {
          const comicT = Math.min((t - hybridTP) / 0.15, 1);
          const ec = easeInOutCubic(comicT);
          ctx.globalAlpha = ec * 0.45;
          ctx.fillStyle = accentColor;
          ctx.fillRect(0, 0, L.width, L.height);
          ctx.globalAlpha = 1;
          ctx.save();
          ctx.filter = 'saturate(2.0) contrast(1.4) brightness(1.05)';
          ctx.globalAlpha = ec * 0.6;
          ctx.drawImage(img, panX, panY, drawW, drawH);
          ctx.restore();
          ctx.filter = 'none';
          ctx.globalAlpha = 1;
          if (comicT > 0.3) {
            const fa = Math.min((comicT - 0.3) * 3, 1) * (1 - Math.min((comicT - 0.3) * 2, 1));
            ctx.globalAlpha = fa;
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, L.width, L.height);
            ctx.globalAlpha = 1;
          }
          if (comicT > 0.5 && halftoneCanvas) {
            const da = Math.min((comicT - 0.5) * 4, 1) * 0.08;
            ctx.globalAlpha = da;
            ctx.drawImage(halftoneCanvas, 0, 0);
            ctx.globalAlpha = 1;
          }
        }

        ctx.fillStyle = cachedGrad;
        ctx.fillRect(0, 0, L.width, L.height);

        const tagText = STYLE_PRESETS.find((s) => s.value === cardStyle)?.tag || 'PRODUCT';
        const hashtagStr = hashtags.slice(0, 8).map((h) => `#${h}`).join(' ');

        // Badge
        const badgeT = Math.max(0, (t - 0.03) / 0.12);
        if (badgeT > 0) {
          ctx.globalAlpha = Math.min(badgeT * 5, 1);
          ctx.fillStyle = accentColor;
          roundRect(ctx, L.badge.x, L.badge.y, L.badge.w, L.badge.h, L.badge.r);
          ctx.fill();
          ctx.fillStyle = '#fff';
          ctx.font = L.badgeText.font;
          ctx.textBaseline = 'middle';
          ctx.textAlign = 'left';
          ctx.fillText(tagText, L.badgeText.x, L.badgeText.y);
          ctx.textAlign = 'left';
          ctx.globalAlpha = 1;
        }

        // Hook text
        const hookT = Math.max(0, (t - 0.15) / 0.3);
        if (hookT > 0) {
          const hookAlpha = Math.min(hookT * 4, 1);
          const hookOffset = (1 - easeOutBack(Math.min(hookT, 1))) * 50;
          const hookY = L.height * L.hookBox.yBase + hookOffset;
          ctx.globalAlpha = hookAlpha;
          ctx.fillStyle = '#fff';
          ctx.font = L.hookText.font;
          ctx.textBaseline = 'top';
          ctx.shadowColor = 'rgba(0,0,0,0.85)';
          ctx.shadowBlur = 12;
          ctx.shadowOffsetY = 3;
          drawTextLines(ctx, hook, L.hookText.x, hookY + L.hookText.yOffset, L.hookText.maxWidth, L.hookText.lineHeight);
          ctx.shadowColor = 'transparent';
          ctx.shadowBlur = 0;
          ctx.shadowOffsetY = 0;
          ctx.globalAlpha = 1;
        }

        // Title text
        const titleT = Math.max(0, (t - 0.3) / 0.2);
        if (titleT > 0 && title) {
          ctx.globalAlpha = Math.min(titleT * 5, 1);
          ctx.fillStyle = 'rgba(255,255,255,0.9)';
          ctx.font = L.title.font;
          ctx.textBaseline = 'top';
          drawTextLines(ctx, title, L.title.x, L.height * L.title.yBase, L.title.maxWidth, L.title.lineHeight);
          ctx.globalAlpha = 1;
        }

        // Hashtags
        const tagTextT = Math.max(0, (t - 0.4) / 0.2);
        if (tagTextT > 0 && hashtags.length > 0) {
          ctx.globalAlpha = Math.min(tagTextT * 5, 1);
          ctx.fillStyle = accentColor;
          ctx.font = L.hashtags.font;
          ctx.textBaseline = 'top';
          drawTextLines(ctx, hashtagStr, L.hashtags.x, L.height * L.hashtags.yBase, L.hashtags.maxWidth, L.hashtags.lineHeight);
          ctx.globalAlpha = 1;
        }

        // CTA button
        const ctaT = Math.max(0, (t - 0.45) / 0.15);
        if (ctaT > 0 && shortUrl) {
          ctx.globalAlpha = Math.min(ctaT * 5, 1);
          ctx.fillStyle = accentColor;
          roundRect(ctx, L.cta.x, L.cta.y, L.cta.w, L.cta.h, L.cta.r);
          ctx.fill();
          ctx.fillStyle = '#fff';
          ctx.font = L.ctaText.font;
          ctx.textBaseline = 'middle';
          ctx.textAlign = 'center';
          ctx.fillText('자세히 보기', L.ctaText.x, L.ctaText.y);
          ctx.fillStyle = 'rgba(255,255,255,0.6)';
          ctx.font = '400 14px sans-serif';
          ctx.fillText(shortUrl, L.ctaShortUrl.x, L.ctaShortUrl.y);
          ctx.textAlign = 'left';
          ctx.globalAlpha = 1;
        }

        if (shortUrl && t < 0.667) {
          drawRoamingBabyWithLink(ctx, elapsed, L.width, L.height, shortUrl, accentColor, mascotEnabled);
        }

        if (t >= 0.667) {
          const dt = Math.min((t - 0.667) / 0.1, 1);
          ctx.globalAlpha = dt;
          ctx.fillStyle = '#0a0f1e';
          ctx.fillRect(0, 0, L.width, L.height);
          ctx.fillStyle = 'rgba(255,255,255,0.85)';
          ctx.font = '400 18px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const disclosure = getDisclosureShortForPlatforms(affiliatePlatforms, autoDisclosure);
          drawTextLines(ctx, disclosure, L.width / 2, L.height / 2 - 20, L.width - 80, 26);
          ctx.textAlign = 'left';
          ctx.globalAlpha = 1;
        }

        if (t < 1) {
          previewRafRef.current = requestAnimationFrame(drawPreviewFrame);
        } else {
          previewStartTimeRef.current = performance.now();
          previewRafRef.current = requestAnimationFrame(drawPreviewFrame);
        }
      };
      previewRafRef.current = requestAnimationFrame(drawPreviewFrame);
    } catch {
      showToast('미리보기를 시작할 수 없어요. 잠시 후 다시 시도해주세요');
    }
  }, [imageUrl, format, musicMood, clipDuration, hybridMode, accentColor, motionPreset, hook, title, hashtags, cardStyle, shortUrl, affiliatePlatforms, livePreviewPlaying, stopLivePreview, showToast, autoDisclosure]);

  useEffect(() => {
    return () => {
      if (previewRafRef.current !== null) cancelAnimationFrame(previewRafRef.current);
    };
  }, []);

  const generateClip = useCallback(async () => {
    setState('generating');
    setProgress(0);
    setRenderTimedOut(false);
    cancelledRef.current = false;
    const accentColor = renderAccentColor;
    if (videoUrl) {
      URL.revokeObjectURL(videoUrl);
      setVideoUrl(null);
    }

    try {
      if (!imageUrl) {
        throw new Error('이미지가 아직 준비되지 않았어요. 잠시 후 다시 시도해주세요');
      }
      await preloadBabyImage().catch(() => {});
      const settingsData = await getUserSettings().catch(() => null);
      const mascotEnabled = settingsData?.mascot_enabled ?? true;
      const safeImageUrl = await urlToDataUrl(imageUrl);
      const L = getLayout(format);
      const canvas = document.createElement('canvas');
      canvas.width = L.width;
      canvas.height = L.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('canvas unsupported');

      const img = await loadImage(safeImageUrl);

      const logoUrl = await getLogoUrl();
      let logoImg: any = null;
      if (logoUrl) {
        try {
          const safeLogoUrl = await urlToDataUrl(logoUrl);
          logoImg = await loadImage(safeLogoUrl);
        } catch { /* logo load failed, skip */ }
      }

      const hasRecorder = typeof (window as any).MediaRecorder !== 'undefined' && typeof (canvas as any).captureStream === 'function';
      let recorder: any = null;
      let mimeType = 'video/webm';
      let done: Promise<any> = Promise.resolve(new (window as any).Blob([], { type: 'image/png' }));
      if (hasRecorder) {
        const canvasStream = (canvas as any).captureStream(FPS);

        let bgmResult: { stream: any; stop: () => void } | null = null;
        if (musicMood !== 'none') {
          bgmResult = createBgmStream(musicMood, clipDuration, false);
          if (bgmResult) bgmStopRef.current = bgmResult.stop;
        }

        let combinedStream: any = canvasStream;
        if (bgmResult) {
          const combinedTracks = [...canvasStream.getVideoTracks()];
          const audioTracks = bgmResult.stream.getAudioTracks();
          if (audioTracks.length > 0) {
            combinedTracks.push(audioTracks[0]);
            combinedStream = new (window as any).MediaStream(combinedTracks);
          }
        }

        mimeType = (window as any).MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
          ? 'video/webm;codecs=vp9'
          : (window as any).MediaRecorder.isTypeSupported('video/webm;codecs=vp8')
            ? 'video/webm;codecs=vp8'
            : 'video/webm';
        recorder = new (window as any).MediaRecorder(combinedStream, {
          mimeType,
          videoBitsPerSecond: 6000000,
        });
        recorderRef.current = recorder;
        canvasStreamRef.current = combinedStream;
        const chunks: any[] = [];
        recorder.ondataavailable = (e: any) => {
          if (e.data.size > 0) chunks.push(e.data);
        };

        done = new Promise<any>((resolve) => {
          recorder.onstop = () => resolve(new (window as any).Blob(chunks, { type: mimeType }));
        });

        recorder.start();
      }
      const startTime = performance.now();

      // Pre-render halftone dot grid to offscreen canvas (avoids ~3600 arc/fill calls per frame)
      let halftoneCanvas: HTMLCanvasElement | null = null;
      if (hybridMode === 'photo-to-comic') {
        halftoneCanvas = document.createElement('canvas');
        halftoneCanvas.width = L.width;
        halftoneCanvas.height = L.height;
        const hctx = halftoneCanvas.getContext('2d');
        if (hctx) {
          hctx.fillStyle = accentColor;
          const dotSpacing = 24;
          const dotR = 3;
          for (let dy = 0; dy < L.height; dy += dotSpacing) {
            for (let dx = 0; dx < L.width; dx += dotSpacing) {
              hctx.beginPath();
              hctx.arc(dx, dy, dotR, 0, Math.PI * 2);
              hctx.fill();
            }
          }
        }
      }

      // Pre-build gradient (reused every frame)
      const cachedGrad = ctx.createLinearGradient(0, 0, 0, L.height);
      cachedGrad.addColorStop(0, 'rgba(10,15,30,0.25)');
      cachedGrad.addColorStop(0.45, 'rgba(10,15,30,0.55)');
      cachedGrad.addColorStop(1, 'rgba(10,15,30,0.95)');

      let lastPct = -1;

      const drawFrame = () => {
        const elapsed = performance.now() - startTime;
        const t = Math.min(elapsed / clipDuration, 1);
        const pct = Math.round(t * 100);
        if (pct !== lastPct) {
          lastPct = pct;
          setProgress(pct);
        }

        ctx.fillStyle = '#0a0f1e';
        ctx.fillRect(0, 0, L.width, L.height);

        const motion = getMotionParams(motionPreset, t);
        const scale = motion.scale;
        const imgRatio = img.width / img.height;
        const canvasRatio = L.width / L.height;
        let drawW: number, drawH: number;
        if (imgRatio > canvasRatio) {
          drawH = L.height * scale;
          drawW = drawH * imgRatio;
        } else {
          drawW = L.width * scale;
          drawH = drawW / imgRatio;
        }
        const panY = (L.height - drawH) / 2 + motion.panY;
        const panX = (L.width - drawW) / 2 + motion.panX;

        ctx.globalAlpha = motion.alpha;
        ctx.drawImage(img, panX, panY, drawW, drawH);
        ctx.globalAlpha = 1;

        // Hybrid mode: photo-to-comic transition at 1.5s (or 25% of duration)
        const hybridTransitionPoint = 0.25;
        const isHybrid = hybridMode === 'photo-to-comic';
        const inComicPhase = isHybrid && t >= hybridTransitionPoint;
        if (inComicPhase) {
          const comicT = Math.min((t - hybridTransitionPoint) / 0.15, 1);
          const easedComic = easeInOutCubic(comicT);
          ctx.globalAlpha = easedComic * 0.45;
          ctx.fillStyle = accentColor;
          ctx.fillRect(0, 0, L.width, L.height);
          ctx.globalAlpha = 1;

          ctx.save();
          ctx.filter = `saturate(2.0) contrast(1.4) brightness(1.05)`;
          ctx.globalAlpha = easedComic * 0.6;
          ctx.drawImage(img, panX, panY, drawW, drawH);
          ctx.restore();
          ctx.filter = 'none';
          ctx.globalAlpha = 1;

          if (comicT > 0.3) {
            const flashAlpha = Math.min((comicT - 0.3) * 3, 1) * (1 - Math.min((comicT - 0.3) * 2, 1));
            ctx.globalAlpha = flashAlpha;
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, L.width, L.height);
            ctx.globalAlpha = 1;
          }

          // Comic-style halftone dots overlay (cached offscreen)
          if (comicT > 0.5 && halftoneCanvas) {
            const dotAlpha = Math.min((comicT - 0.5) * 4, 1) * 0.08;
            ctx.globalAlpha = dotAlpha;
            ctx.drawImage(halftoneCanvas, 0, 0);
            ctx.globalAlpha = 1;
          }
        }

        ctx.fillStyle = cachedGrad;
        ctx.fillRect(0, 0, L.width, L.height);

        const tagText = STYLE_PRESETS.find((s) => s.value === cardStyle)?.tag || 'PRODUCT';
        const hashtagStr = hashtags.slice(0, 8).map((h) => `#${h}`).join(' ');

        // Badge (top-left, fades in early)
        const badgeT = Math.max(0, (t - 0.03) / 0.12);
        if (badgeT > 0) {
          const badgeAlpha = Math.min(badgeT * 5, 1);
          ctx.globalAlpha = badgeAlpha;
          ctx.fillStyle = accentColor;
          roundRect(ctx, L.badge.x, L.badge.y, L.badge.w, L.badge.h, L.badge.r);
          ctx.fill();
          ctx.fillStyle = '#fff';
          ctx.font = L.badgeText.font;
          ctx.textBaseline = 'middle';
          ctx.textAlign = 'left';
          ctx.fillText(tagText, L.badgeText.x, L.badgeText.y);
          ctx.textAlign = 'left';
          ctx.globalAlpha = 1;
        }

        // Hook text
        const hookT = Math.max(0, (t - 0.15) / 0.3);
        if (hookT > 0) {
          const hookAlpha = Math.min(hookT * 4, 1);
          const hookOffset = (1 - easeOutBack(Math.min(hookT, 1))) * 50;
          const hookY = L.height * L.hookBox.yBase + hookOffset;
          ctx.globalAlpha = hookAlpha;

          ctx.fillStyle = '#fff';
          ctx.font = L.hookText.font;
          ctx.textBaseline = 'top';
          ctx.shadowColor = 'rgba(0,0,0,0.85)';
          ctx.shadowBlur = 12;
          ctx.shadowOffsetY = 3;
          drawTextLines(ctx, hook, L.hookText.x, hookY + L.hookText.yOffset, L.hookText.maxWidth, L.hookText.lineHeight);
          ctx.shadowColor = 'transparent';
          ctx.shadowBlur = 0;
          ctx.shadowOffsetY = 0;
          ctx.globalAlpha = 1;
        }

        // Title text
        const titleT = Math.max(0, (t - 0.3) / 0.2);
        if (titleT > 0 && title) {
          const titleAlpha = Math.min(titleT * 5, 1);
          ctx.globalAlpha = titleAlpha;
          ctx.fillStyle = 'rgba(255,255,255,0.9)';
          ctx.font = L.title.font;
          ctx.textBaseline = 'top';
          ctx.shadowColor = 'rgba(0,0,0,0.7)';
          ctx.shadowBlur = 8;
          ctx.shadowOffsetY = 2;
          drawTextLines(ctx, title, L.title.x, L.height * L.title.yBase, L.title.maxWidth, L.title.lineHeight);
          ctx.shadowColor = 'transparent';
          ctx.shadowBlur = 0;
          ctx.shadowOffsetY = 0;
          ctx.globalAlpha = 1;
        }

        // Hashtags
        const tagTextT = Math.max(0, (t - 0.4) / 0.2);
        if (tagTextT > 0 && hashtags.length > 0) {
          ctx.globalAlpha = Math.min(tagTextT * 5, 1);
          ctx.fillStyle = accentColor;
          ctx.font = L.hashtags.font;
          ctx.textBaseline = 'top';
          drawTextLines(ctx, hashtagStr, L.hashtags.x, L.height * L.hashtags.yBase, L.hashtags.maxWidth, L.hashtags.lineHeight);
          ctx.globalAlpha = 1;
        }

        // CTA button
        const ctaT = Math.max(0, (t - 0.45) / 0.15);
        if (ctaT > 0 && shortUrl) {
          ctx.globalAlpha = Math.min(ctaT * 5, 1);
          ctx.fillStyle = accentColor;
          roundRect(ctx, L.cta.x, L.cta.y, L.cta.w, L.cta.h, L.cta.r);
          ctx.fill();
          ctx.fillStyle = '#fff';
          ctx.font = L.ctaText.font;
          ctx.textBaseline = 'middle';
          ctx.textAlign = 'center';
          ctx.fillText('자세히 보기', L.ctaText.x, L.ctaText.y);
          ctx.fillStyle = 'rgba(255,255,255,0.6)';
          ctx.font = '400 14px sans-serif';
          ctx.fillText(shortUrl, L.ctaShortUrl.x, L.ctaShortUrl.y);
          ctx.textAlign = 'left';
          ctx.globalAlpha = 1;
        }

        // Logo watermark (visible until disclosure covers screen)
        if (logoImg && t < 0.667) {
          drawLogoWatermark(ctx, logoImg, L.width, L.height, 0.65);
        }

        // Baby + link sticker composited into the video frame
        if (shortUrl && t < 0.667) {
          drawRoamingBabyWithLink(ctx, elapsed, L.width, L.height, shortUrl, accentColor, mascotEnabled);
        }

        // Disclosure text (last ~2 seconds)
        if (t >= 0.667) {
          const dt = Math.min((t - 0.667) / 0.1, 1);
          ctx.globalAlpha = dt;
          ctx.fillStyle = '#0a0f1e';
          ctx.fillRect(0, 0, L.width, L.height);
          ctx.fillStyle = 'rgba(255,255,255,0.85)';
          ctx.font = '400 18px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const disclosure = getDisclosureShortForPlatforms(affiliatePlatforms, autoDisclosure);
          drawTextLines(ctx, disclosure, L.width / 2, L.height / 2 - 20, L.width - 80, 26);
          ctx.textAlign = 'left';
          ctx.globalAlpha = 1;
        }

        if (t < 1) {
          rafRef.current = requestAnimationFrame(drawFrame);
        } else {
          recorderTimerRef.current = setTimeout(() => {
            if (recorder && recorder.state !== 'inactive') {
              try { recorder.stop(); } catch {}
            }
          }, 150);
        }
      };

      rafRef.current = requestAnimationFrame(drawFrame);

      // Overall render timeout: clipDuration + 30s buffer
      const renderTimeoutMs = (clipDuration + 30) * 1000;
      renderTimeoutRef.current = setTimeout(() => {
        if (cancelledRef.current) return;
        cancelledRef.current = true;
        if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
        if (bgmStopRef.current) { bgmStopRef.current(); bgmStopRef.current = null; }
        setRenderTimedOut(true);
        setState('error');
        showToast('렌더링 시간이 초과되었어요. 영상 길이를 줄이거나 다시 시도해주세요.');
      }, renderTimeoutMs);

      if (hasRecorder) {
        const blob = await done;
        if (cancelledRef.current) return;
        if (bgmStopRef.current) { bgmStopRef.current(); bgmStopRef.current = null; }
        if (canvasStreamRef.current) {
          try { canvasStreamRef.current.getTracks().forEach((t: any) => t.stop()); } catch {}
          canvasStreamRef.current = null;
        }
        recorderRef.current = null;
        const url = URL.createObjectURL(blob);
        setVideoUrl(url);
        setVideoMime(mimeType);
      } else {
        await new Promise<void>((resolve) => setTimeout(resolve, clipDuration + 200));
        if (cancelledRef.current) return;
        const dataUrl = canvas.toDataURL('image/png');
        const blob = await (await fetch(dataUrl)).blob();
        if (cancelledRef.current) return;
        const url = URL.createObjectURL(blob);
        setVideoUrl(url);
        setVideoMime('image/png');
      }
      if (cancelledRef.current) return;
      setState('done');
      setProgress(100);
      if (renderTimeoutRef.current !== null) { clearTimeout(renderTimeoutRef.current); renderTimeoutRef.current = null; }
    } catch (err) {
      if (renderTimeoutRef.current !== null) { clearTimeout(renderTimeoutRef.current); renderTimeoutRef.current = null; }
      if (bgmStopRef.current) { bgmStopRef.current(); bgmStopRef.current = null; }
      if (canvasStreamRef.current) {
        try { canvasStreamRef.current.getTracks().forEach((t: any) => t.stop()); } catch {}
        canvasStreamRef.current = null;
      }
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        try { recorderRef.current.stop(); } catch {}
      }
      recorderRef.current = null;
      if (cancelledRef.current) return;
      setState('error');
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('이미지 로드') || msg.includes('CORS') || msg.includes('시간 초과') || msg.includes('SecurityError')) {
        showToast('이미지를 불러올 수 없어요. 네트워크 또는 CORS 문제일 수 있어요. 잠시 후 다시 시도해주세요');
      } else {
        showToast('동영상 생성에 실패했어요');
      }
    }
  }, [imageUrl, hook, title, hashtags, accentColor, category, affiliatePlatforms, videoUrl, showToast, clipDuration, format, cardStyle, musicMood, motionPreset, hybridMode, templateData, customReview, shortUrl, setVideoMime, autoDisclosure]);

  const handleDownload = useCallback(() => {
    if (!videoUrl) return;
    const a = document.createElement('a');
    a.href = videoUrl;
    const ext = videoMime.includes('png') ? 'png' : 'webm';
    a.download = fileName.replace(/\.png$|\.webm$/, '') + '-clip.' + ext;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast('다운로드를 시작했어요. 네이버 클립에 업로드하세요');
  }, [videoUrl, fileName, videoMime, showToast]);

  const handleReset = useCallback(() => {
    stopPreview();
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    setVideoUrl(null);
    setState('idle');
    setProgress(0);
  }, [videoUrl, stopPreview]);

  const handleCancelRender = useCallback(() => {
    cancelledRef.current = true;
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    if (renderTimeoutRef.current !== null) { clearTimeout(renderTimeoutRef.current); renderTimeoutRef.current = null; }
    if (abortControllerRef.current) { abortControllerRef.current.abort(); abortControllerRef.current = null; }
    if (bgmStopRef.current) { bgmStopRef.current(); bgmStopRef.current = null; }
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      try { recorderRef.current.stop(); } catch {}
    }
    if (canvasStreamRef.current) {
      try { canvasStreamRef.current.getTracks().forEach((t: any) => t.stop()); } catch {}
      canvasStreamRef.current = null;
    }
    recorderRef.current = null;
    setState('idle');
    setProgress(0);
  }, []);

  const handleRetry = useCallback(() => {
    setRenderTimedOut(false);
    handleReset();
    retryTimerRef.current = setTimeout(() => generateClip(), 100);
  }, [handleReset, generateClip]);

  const handleSaveToCloud = useCallback(async () => {
    if (!videoUrl) return;
    setCloudSaving(true);
    setUploadProgress(0);
    const controller = new AbortController();
    abortControllerRef.current = controller;
    try {
      const res = await fetch(videoUrl, { signal: controller.signal });
      const blob = await res.blob();
      const cloudExt = videoMime.includes('png') ? 'png' : 'webm';
      const cloudFileName = fileName.replace(/\.png$|\.webm$/, '') + '-clip-' + Date.now() + '.' + cloudExt;
      const fileUrl = await uploadAssetBlobWithProgress(blob, cloudFileName, videoMime, (pct) => setUploadProgress(pct));
      if (controller.signal.aborted) return;
      if (!fileUrl) {
        showToast('클라우드 업로드에 실패했어요');
        setCloudSaving(false);
        setUploadProgress(0);
        return;
      }
      setUploadProgress(100);
      await saveAssetRecord({
        scan_id: null,
        asset_type: videoMime.includes('png') ? 'image' : 'video',
        title: title || '동영상 클립',
        file_url: fileUrl,
        file_name: cloudFileName,
        file_size: blob.size,
        mime_type: videoMime,
        thumbnail_url: imageUrl,
        platform: platform,
        affiliate_platform: affiliatePlatforms.join(',') || null,
      });
      showToast('클라우드에 저장됐어요. 내 제작물 탭에서 확인하세요');
    } catch (err) {
      if (controller.signal.aborted) return;
      showToast('저장 중 오류가 발생했어요');
      setUploadProgress(0);
    }
    abortControllerRef.current = null;
    setCloudSaving(false);
  }, [videoUrl, fileName, videoMime, title, imageUrl, platform, affiliatePlatforms, showToast]);

  const isVertical = format === 'vertical';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Film size={18} color={theme.colors.warning[400]} strokeWidth={2} />
          <Text style={styles.headerTitle}>동영상 만들기</Text>
        </View>
        {state === 'done' && (
          <TouchableOpacity onPress={handleReset} activeOpacity={0.7}>
            <RefreshCw size={16} color={theme.colors.dark.textDim} strokeWidth={2} />
          </TouchableOpacity>
        )}
      </View>

      <Text style={styles.description}>
        제품 사진과 마케팅 카피로 동영상을 자동 생성합니다. AI가 플랫폼에 맞춰 템플릿·비율·길이·음악을 자동으로 선택해요.
      </Text>

      {(platform === 'shortform' || platform === 'instagram') && (
        <View style={styles.tipCard}>
          <View style={styles.tipHeader}>
            <Lightbulb size={14} color={theme.colors.warning[400]} strokeWidth={2} />
            <Text style={styles.tipTitle}>최적 제작 가이드 (추천)</Text>
          </View>
          <Text style={styles.tipText}>
            <Text style={styles.tipStep}>1단계 (여기서): </Text>
            사진 한 장으로 템플릿 카드·제휴 링크·마케팅 카피를 뽑아내세요. 영상은 가볍게 BGM 없이 또는 작게 깔고 다운로드.
          </Text>
          <Text style={styles.tipText}>
            <Text style={styles.tipStep}>2단계 (업로드 직전): </Text>
            릴스/쇼츠 앱에서 그날의 트렌딩 BGM을 선택, 음량 1~5%로 깔고 플랫폼 내장 AI 음성이나 본인 목소리로 짧은 후킹 멘트를 얹으세요.
          </Text>
          <View style={styles.tipBenefitRow}>
            <Mic size={12} color={theme.colors.primary[300]} strokeWidth={2} />
            <Text style={styles.tipBenefitText}>앱은 가볍게, 알고리즘 부스터(BGM) + 구매 전환력(음성)은 플랫폼에서</Text>
          </View>
        </View>
      )}

      {state === 'idle' && (
        <View>
          <TemplateBadge label={tpl.badgeLabel} />
          <View style={styles.autoInfoBox}>
            <Sparkles size={14} color={theme.colors.warning[400]} strokeWidth={2} />
            <Text style={styles.autoInfoText}>
              위 설정은 AI 추천값입니다. 필요하면 고급 옵션에서 직접 조정할 수 있어요
            </Text>
          </View>

          <TouchableOpacity
            style={styles.advancedToggle}
            onPress={() => setShowAdvanced(!showAdvanced)}
            activeOpacity={0.7}
          >
            <Text style={styles.advancedToggleText}>고급 옵션</Text>
            <ChevronDown
              size={16}
              color={theme.colors.dark.textDim}
              strokeWidth={2}
              style={{ transform: [{ rotate: showAdvanced ? '180deg' : '0deg' }] }}
            />
          </TouchableOpacity>

          {showAdvanced && (
            <View>
              <View style={styles.optionRow}>
                <Text style={styles.optionLabel}>템플릿</Text>
                <View style={styles.styleScroll}>
                  {STYLE_PRESETS.map((preset) => (
                    <TouchableOpacity
                      key={preset.value}
                      style={[
                        styles.stylePill,
                        cardStyle === preset.value && styles.stylePillActive,
                      ]}
                      onPress={() => setCardStyle(preset.value)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.stylePillText,
                          cardStyle === preset.value && styles.stylePillTextActive,
                        ]}
                      >
                        {preset.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {(() => {
                const selected = STYLE_PRESETS.find((s) => s.value === cardStyle);
                if (!selected) return null;
                return (
                  <View style={styles.styleDescBox}>
                    <Text style={styles.styleDescTag}>{selected.tag}</Text>
                    <Text style={styles.styleDescText}>{selected.desc}</Text>
                  </View>
                );
              })()}

              <View style={styles.optionRow}>
                <Text style={styles.optionLabel}>화면 비율</Text>
                <View style={styles.toggleGroup}>
                  {FORMAT_PRESETS.map((preset) => (
                    <TouchableOpacity
                      key={preset.value}
                      style={[
                        styles.togglePill,
                        format === preset.value && styles.togglePillActive,
                      ]}
                      onPress={() => setFormat(preset.value)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.togglePillText,
                          format === preset.value && styles.togglePillTextActive,
                        ]}
                      >
                        {preset.label}
                      </Text>
                      <Text
                        style={[
                          styles.togglePillSub,
                          format === preset.value && styles.togglePillSubActive,
                        ]}
                      >
                        {preset.aspect}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.optionRow}>
                <Text style={styles.optionLabel}>배경 음악</Text>
                <View style={styles.musicRow}>
                  <View style={styles.toggleGroup}>
                    {MUSIC_PRESETS.map((preset) => (
                      <TouchableOpacity
                        key={preset.value}
                        style={[
                          styles.togglePill,
                          musicMood === preset.value && styles.togglePillActive,
                        ]}
                        onPress={() => {
                          setMusicMood(preset.value);
                          stopPreview();
                        }}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.togglePillText,
                            musicMood === preset.value && styles.togglePillTextActive,
                          ]}
                        >
                          {preset.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  {musicMood !== 'none' && Platform.OS === 'web' && (
                    <TouchableOpacity
                      style={[styles.previewButton, previewPlaying && styles.previewButtonActive]}
                      onPress={previewMusic}
                      activeOpacity={0.7}
                    >
                      {previewPlaying ? (
                        <VolumeX size={14} color="#fff" strokeWidth={2} />
                      ) : (
                        <Volume2 size={14} color="#fff" strokeWidth={2} />
                      )}
                      <Text style={styles.previewButtonText}>
                        {previewPlaying ? '정지' : '미리듣기'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              <View style={styles.optionRow}>
                <Text style={styles.optionLabel}>모션 효과</Text>
                <View style={styles.motionScroll}>
                  {MOTION_PRESETS.map((preset) => (
                    <TouchableOpacity
                      key={preset.value}
                      style={[
                        styles.stylePill,
                        motionPreset === preset.value && styles.stylePillActive,
                      ]}
                      onPress={() => setMotionPreset(preset.value)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.stylePillText,
                          motionPreset === preset.value && styles.stylePillTextActive,
                        ]}
                      >
                        {preset.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {(() => {
                const selected = MOTION_PRESETS.find((m) => m.value === motionPreset);
                if (!selected) return null;
                return (
                  <View style={styles.styleDescBox}>
                    <Text style={styles.styleDescText}>{selected.desc}</Text>
                  </View>
                );
              })()}

              <View style={styles.optionRow}>
                <Text style={styles.optionLabel}>하이브리드</Text>
                <View style={styles.hybridScroll}>
                  {HYBRID_PRESETS.map((preset) => (
                    <TouchableOpacity
                      key={preset.value}
                      style={[
                        styles.stylePill,
                        hybridMode === preset.value && styles.hybridPillActive,
                      ]}
                      onPress={() => setHybridMode(preset.value)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.stylePillText,
                          hybridMode === preset.value && styles.stylePillTextActive,
                        ]}
                      >
                        {preset.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {hybridMode !== 'off' && (
                <View style={styles.styleDescBox}>
                  <Text style={styles.styleDescText}>
                    {HYBRID_PRESETS.find((h) => h.value === hybridMode)?.desc}
                  </Text>
                </View>
              )}

              <View style={styles.durationInfoBox}>
                <Clock size={14} color={theme.colors.dark.textDim} strokeWidth={2} />
                <Text style={styles.durationInfoText}>
                  영상 길이: {clipDuration / 1000}초 (설정에서 변경)
                </Text>
              </View>
            </View>
          )}

          <View style={styles.livePreviewContainer}>
            <View style={styles.livePreviewWrap}>
              <canvas
                ref={previewCanvasRef as any}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  borderRadius: 12,
                  display: livePreviewPlaying ? 'block' : 'none',
                }}
              />
              {!livePreviewPlaying && (
                <View style={styles.livePreviewPlaceholder}>
                  <Play size={32} color={theme.colors.dark.textFaint} strokeWidth={1.5} />
                  <Text style={styles.livePreviewPlaceholderText}>
                    미리보기로 움직임을 확인하세요
                  </Text>
                </View>
              )}
            </View>
            <TouchableOpacity
              style={[styles.livePreviewBtn, livePreviewPlaying && styles.livePreviewBtnActive]}
              onPress={startLivePreview}
              activeOpacity={0.7}
            >
              {livePreviewPlaying ? (
                <>
                  <VolumeX size={16} color="#fff" strokeWidth={2} />
                  <Text style={styles.livePreviewBtnText}>미리보기 정지</Text>
                </>
              ) : (
                <>
                  <Play size={16} color="#fff" strokeWidth={2} />
                  <Text style={styles.livePreviewBtnText}>미리보기 재생</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.generateButton} onPress={generateClip} activeOpacity={0.8}>
            <Film size={20} color="#fff" strokeWidth={2} />
            <Text style={styles.generateButtonText}>동영상 만들기</Text>
          </TouchableOpacity>
        </View>
      )}

      {state === 'generating' && (
        <View>
          <VideoProgressIndicator progress={progress} label="생성 중..." color={theme.colors.primary[400]} />
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={handleCancelRender}
            activeOpacity={0.7}
          >
            <X size={14} color={theme.colors.error[400]} strokeWidth={2} />
            <Text style={styles.cancelButtonText}>취소</Text>
          </TouchableOpacity>
        </View>
      )}

      {state === 'done' && videoUrl && (
        <View style={styles.resultWrap}>
          <Text style={styles.doneNotice}>영상이 생성됐어요. 미리보기 후 저장하세요.</Text>
          <View style={isVertical ? styles.videoVerticalWrap : styles.videoHorizontalWrap}>
            {Platform.OS === 'web' && videoMime.includes('png') && (
              // @ts-ignore img element on web
              <img
                src={videoUrl}
                style={isVertical ? styles.videoVertical : styles.videoHorizontal}
              />
            )}
            {Platform.OS === 'web' && !videoMime.includes('png') && (
              // @ts-ignore video element on web
              <video
                src={videoUrl}
                style={isVertical ? styles.videoVertical : styles.videoHorizontal}
                controls
                loop
                playsInline
              />
            )}
            {Platform.OS === 'web' && shortUrl && (
              <RoamingBabyOverlay
                linkUrl={shortUrl}
                containerWidth={isVertical ? 280 : 440}
                containerHeight={isVertical ? 400 : 248}
              />
            )}
          </View>
          <View style={styles.resultButtons}>
            <TouchableOpacity style={styles.downloadButton} onPress={handleDownload} activeOpacity={0.8}>
              <Download size={18} color="#fff" strokeWidth={2} />
              <Text style={styles.downloadButtonText}>다운로드</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cloudSaveButton}
              onPress={handleSaveToCloud}
              disabled={cloudSaving}
              activeOpacity={0.7}
            >
              {cloudSaving ? (
                <Loader2 size={16} color={theme.colors.primary[300]} strokeWidth={2} />
              ) : (
                <CloudUpload size={16} color={theme.colors.primary[300]} strokeWidth={2} />
              )}
              <Text style={styles.cloudSaveButtonText}>
                {cloudSaving ? (uploadProgress > 0 ? `업로드 중... ${uploadProgress}%` : '저장 중...') : '클라우드 저장'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.remakeButton}
              onPress={handleReset}
              activeOpacity={0.7}
            >
              <RefreshCw size={16} color={theme.colors.dark.textDim} strokeWidth={2} />
              <Text style={styles.remakeButtonText}>다시 만들기</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {state === 'error' && (
        <View style={styles.errorBox}>
          <AlertCircle size={16} color={theme.colors.error[400]} strokeWidth={2} />
          <Text style={styles.errorText}>
            {renderTimedOut ? '렌더링 시간이 초과되었어요. 영상 길이를 줄이거나 다시 시도해주세요.' : '생성 실패. 다시 시도해주세요.'}
          </Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={handleRetry}
            activeOpacity={0.7}
          >
            <RefreshCw size={14} color="#fff" strokeWidth={2} />
            <Text style={styles.retryButtonText}>다시 시도</Text>
          </TouchableOpacity>
        </View>
      )}

      {toast && (
        <View style={styles.toastBox}>
          <Play size={14} color={theme.colors.success[400]} strokeWidth={2} />
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.dark.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    maxWidth: 500,
    alignSelf: 'center',
    width: '100%',
    ...theme.shadows.card,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: theme.typography.body,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.dark.text,
  },
  description: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    lineHeight: 20,
    marginBottom: theme.spacing.md,
  },
  tipCard: {
    backgroundColor: theme.colors.warning[500] + '0D',
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.warning[400] + '25',
  },
  tipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: theme.spacing.sm,
  },
  tipTitle: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.warning[400],
  },
  tipText: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    lineHeight: 17,
    marginBottom: 6,
  },
  tipStep: {
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
  },
  tipBenefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 4,
  },
  tipBenefitText: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.primary[300],
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
  },
  optionLabel: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.textDim,
  },
  toggleGroup: {
    flexDirection: 'row',
    backgroundColor: theme.colors.dark.surfaceLight,
    borderRadius: theme.radius.md,
    padding: 3,
    gap: 2,
  },
  togglePill: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: theme.radius.sm,
    alignItems: 'center',
  },
  togglePillActive: {
    backgroundColor: theme.colors.warning[500],
  },
  togglePillText: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.textDim,
  },
  togglePillTextActive: {
    color: '#fff',
  },
  togglePillSub: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textFaint,
    marginTop: 1,
  },
  togglePillSubActive: {
    color: 'rgba(255,255,255,0.7)',
  },
  durationInfoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: theme.spacing.md,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.dark.surfaceLight,
  },
  durationInfoText: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.textDim,
  },
  styleScroll: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: theme.colors.dark.surfaceLight,
    borderRadius: theme.radius.md,
    padding: 3,
    gap: 2,
    maxWidth: 220,
  },
  motionScroll: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: theme.colors.dark.surfaceLight,
    borderRadius: theme.radius.md,
    padding: 3,
    gap: 2,
    maxWidth: 240,
  },
  hybridScroll: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: theme.colors.dark.surfaceLight,
    borderRadius: theme.radius.md,
    padding: 3,
    gap: 2,
    maxWidth: 200,
  },
  hybridPillActive: {
    backgroundColor: theme.colors.primary[500],
  },
  stylePill: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: theme.radius.sm,
  },
  stylePillActive: {
    backgroundColor: theme.colors.warning[500],
  },
  stylePillText: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.textDim,
  },
  stylePillTextActive: {
    color: '#fff',
  },
  styleDescBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: theme.colors.dark.surfaceLight,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  styleDescTag: {
    fontSize: 9,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.warning[400],
    backgroundColor: theme.colors.warning[500] + '20',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: 2,
  },
  styleDescText: {
    flex: 1,
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    lineHeight: 16,
  },
  musicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    justifyContent: 'flex-end',
  },
  previewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.primary[600],
  },
  previewButtonActive: {
    backgroundColor: theme.colors.error[500],
  },
  previewButtonText: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: '#fff',
  },
  autoInfoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.colors.warning[500] + '12',
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  autoInfoText: {
    flex: 1,
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.warning[400],
    lineHeight: 16,
  },
  advancedToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  advancedToggleText: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.textDim,
  },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.warning[500],
    ...theme.shadows.card,
  },
  livePreviewContainer: {
    marginBottom: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  livePreviewWrap: {
    width: '100%',
    aspectRatio: 9 / 16,
    maxHeight: 360,
    borderRadius: theme.radius.md,
    overflow: 'hidden',
    backgroundColor: '#000',
    alignSelf: 'center',
  },
  livePreviewPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  livePreviewPlaceholderText: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.textFaint,
  },
  livePreviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: theme.spacing.sm + 2,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primary[600],
  },
  livePreviewBtnActive: {
    backgroundColor: theme.colors.error[500],
  },
  livePreviewBtnText: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: '#fff',
  },
  generateButtonText: {
    fontSize: theme.typography.body,
    fontFamily: theme.typography.fontFamily.bold,
    color: '#fff',
  },
  progressWrap: {
    gap: 10,
  },
  progressBarBg: {
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.dark.surfaceLight,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: theme.colors.warning[400],
  },
  progressLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  progressText: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.textDim,
  },
  doneNotice: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.success[400],
    lineHeight: 20,
  },
  resultWrap: {
    gap: theme.spacing.md,
  },
  videoVerticalWrap: {
    width: '100%',
    maxHeight: 400,
    borderRadius: theme.radius.md,
    overflow: 'hidden',
    alignSelf: 'center',
    position: 'relative',
  },
  videoHorizontalWrap: {
    width: '100%',
    maxHeight: 300,
    borderRadius: theme.radius.md,
    overflow: 'hidden',
    alignSelf: 'center',
    position: 'relative',
  },
  videoVertical: {
    width: '100%',
    aspectRatio: 9 / 16,
    maxHeight: 400,
    borderRadius: theme.radius.md,
    backgroundColor: '#000',
    alignSelf: 'center',
  },
  videoHorizontal: {
    width: '100%',
    aspectRatio: 16 / 9,
    maxHeight: 300,
    borderRadius: theme.radius.md,
    backgroundColor: '#000',
    alignSelf: 'center',
  },
  resultButtons: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  downloadButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.warning[500],
  },
  downloadButtonText: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.bold,
    color: '#fff',
  },
  remakeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.dark.surfaceLight,
  },
  remakeButtonText: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.textDim,
  },
  cloudSaveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primary[500] + '15',
    borderWidth: 1,
    borderColor: theme.colors.primary[400] + '30',
  },
  cloudSaveButtonText: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.primary[300],
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.error[500] + '15',
    flexWrap: 'wrap',
  },
  errorText: {
    flex: 1,
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.error[400],
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 8,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primary[500],
  },
  retryButtonText: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: '#fff',
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    marginTop: theme.spacing.sm,
    paddingVertical: 8,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.error[500] + '15',
    alignSelf: 'center',
  },
  cancelButtonText: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.error[400],
  },
  toastBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: theme.spacing.md,
    backgroundColor: theme.colors.success[500] + '15',
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.success[400],
  },
  toastText: {
    flex: 1,
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.success[400],
    lineHeight: 20,
  },
});
