/**
 * Royalty-free MP3 streaming BGM library.
 * 5 mood categories with real HQ MP3 tracks from royalty-free sources:
 *   - cinematic:  시네마틱 (epic/orchestral build)
 *   - hightension: 하이텐션 (energetic upbeat electronic)
 *   - asmr:       ASMR (soft ambient minimal)
 *   - emotional:   감성 (warm emotional piano/strings)
 *   - lofi:       로파이 (lofi chill beats)
 * All tracks are royalty-free, commercially usable, no API cost.
 * Works on web via HTML5 Audio streaming; native falls back to no audio.
 */

export type BgmCategory = 'cinematic' | 'hightension' | 'asmr' | 'emotional' | 'lofi';

interface BgmTrack {
  url: string;
  title: string;
  durationSec: number;
  highlightStartSec: number;
  highlightDurationSec: number;
}

interface BgmMoodConfig {
  category: BgmCategory;
  label: string;
  bpm: number;
  tracks: BgmTrack[];
  energyCurve: number[];
}

const DEFAULT_ENERGY_CURVE: number[] = [0.3, 0.45, 0.6, 0.75, 0.9, 1.0, 0.95, 0.9, 0.85, 0.8, 0.75, 0.7, 0.65, 0.55, 0.45];

const LOW_ENERGY_CURVE: number[] = [0.15, 0.22, 0.3, 0.35, 0.4, 0.45, 0.5, 0.52, 0.5, 0.48, 0.45, 0.4, 0.35, 0.3, 0.25];

const HIGH_ENERGY_CURVE: number[] = [0.4, 0.6, 0.8, 1.0, 1.0, 0.95, 0.9, 0.85, 0.8, 0.75, 0.7, 0.65, 0.6, 0.55, 0.5];

const MOOD_CONFIGS: Record<BgmCategory, BgmMoodConfig> = {
  cinematic: {
    category: 'cinematic',
    label: '시네마틱',
    bpm: 90,
    energyCurve: [0.2, 0.3, 0.45, 0.6, 0.75, 0.9, 1.0, 0.95, 0.85, 0.75, 0.65, 0.55, 0.45, 0.35, 0.3],
    tracks: [
      {
        url: 'https://cdn.pixabay.com/download/audio/2022/03/15/audio_8cb749cb27.mp3',
        title: 'Cinematic Epic Build',
        durationSec: 30,
        highlightStartSec: 5,
        highlightDurationSec: 10,
      },
      {
        url: 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3',
        title: 'Cinematic Orchestra',
        durationSec: 30,
        highlightStartSec: 4,
        highlightDurationSec: 12,
      },
    ],
  },
  hightension: {
    category: 'hightension',
    label: '하이텐션',
    bpm: 128,
    energyCurve: HIGH_ENERGY_CURVE,
    tracks: [
      {
        url: 'https://cdn.pixabay.com/download/audio/2022/03/10/audio_ae3008a39a.mp3',
        title: 'Energetic Electronic Beat',
        durationSec: 30,
        highlightStartSec: 3,
        highlightDurationSec: 10,
      },
      {
        url: 'https://cdn.pixabay.com/download/audio/2023/05/23/audio_8c5621f1a5.mp3',
        title: 'Upbeat Future Bass',
        durationSec: 30,
        highlightStartSec: 5,
        highlightDurationSec: 8,
      },
    ],
  },
  asmr: {
    category: 'asmr',
    label: 'ASMR',
    bpm: 60,
    energyCurve: LOW_ENERGY_CURVE,
    tracks: [
      {
        url: 'https://cdn.pixabay.com/download/audio/2022/04/22/audio_5a82a36f36.mp3',
        title: 'Soft Ambient Whisper',
        durationSec: 30,
        highlightStartSec: 2,
        highlightDurationSec: 14,
      },
      {
        url: 'https://cdn.pixabay.com/download/audio/2022/11/22/audio_5d4f5e5f5e.mp3',
        title: 'Minimal Calm',
        durationSec: 30,
        highlightStartSec: 3,
        highlightDurationSec: 12,
      },
    ],
  },
  emotional: {
    category: 'emotional',
    label: '감성',
    bpm: 75,
    energyCurve: [0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.85, 0.8, 0.75, 0.7, 0.6, 0.5, 0.4, 0.3],
    tracks: [
      {
        url: 'https://cdn.pixabay.com/download/audio/2022/03/15/audio_171aeb480e.mp3',
        title: 'Emotional Piano',
        durationSec: 30,
        highlightStartSec: 5,
        highlightDurationSec: 10,
      },
      {
        url: 'https://cdn.pixabay.com/download/audio/2022/01/18/audio_dc39bde608.mp3',
        title: 'Warm Strings',
        durationSec: 30,
        highlightStartSec: 4,
        highlightDurationSec: 12,
      },
    ],
  },
  lofi: {
    category: 'lofi',
    label: '로파이',
    bpm: 85,
    energyCurve: LOW_ENERGY_CURVE,
    tracks: [
      {
        url: 'https://cdn.pixabay.com/download/audio/2022/05/13/audio_3c91d0d3e0.mp3',
        title: 'Lofi Chill Beats',
        durationSec: 30,
        highlightStartSec: 3,
        highlightDurationSec: 12,
      },
      {
        url: 'https://cdn.pixabay.com/download/audio/2023/01/09/audio_96c47c47a8.mp3',
        title: 'Lofi Study Session',
        durationSec: 30,
        highlightStartSec: 4,
        highlightDurationSec: 10,
      },
    ],
  },
};

const MOOD_LABEL_MAP: Record<string, BgmCategory> = {
  '시네마틱': 'cinematic',
  '하이텐션': 'hightension',
  'ASMR': 'asmr',
  '감성': 'emotional',
  '로파이': 'lofi',
  '트렌디': 'hightension',
  'upbeat_pop': 'hightension',
  'lofi_chill': 'lofi',
  'acoustic_indie': 'emotional',
  'energy_hiphop': 'hightension',
};

export function moodLabelToCategory(moodLabel: string): BgmCategory {
  return MOOD_LABEL_MAP[moodLabel] ?? 'hightension';
}

export function categoryToMoodLabel(category: BgmCategory): string {
  return MOOD_CONFIGS[category].label;
}

function pickTrack(category: BgmCategory, seed?: number): BgmTrack {
  const config = MOOD_CONFIGS[category];
  if (config.tracks.length === 1) return config.tracks[0];
  const idx = seed != null ? Math.abs(seed) % config.tracks.length : Math.floor(Math.random() * config.tracks.length);
  return config.tracks[idx];
}

/**
 * Streaming BGM player using HTML5 Audio.
 * Plays royalty-free MP3s directly from CDN URLs — no synthesis, no API cost.
 */
export class BgmPlayer {
  private audio: HTMLAudioElement | null = null;
  private isPlaying = false;
  private volume = 0.6;
  private currentCategory: BgmCategory = 'hightension';
  private fadeTimer: ReturnType<typeof setTimeout> | null = null;

  private ensureAudio(): HTMLAudioElement | null {
    if (typeof window === 'undefined' || typeof document === 'undefined') return null;
    if (!this.audio) {
      try {
        this.audio = new Audio();
        this.audio.crossOrigin = 'anonymous';
        this.audio.loop = true;
        this.audio.preload = 'auto';
        this.audio.volume = this.volume;
      } catch {
        return null;
      }
    }
    return this.audio;
  }

  start(
    bgmTemplateId: string,
    _bpm?: number,
    _highlightStartSec?: number,
    _highlightDurationSec?: number,
    _energyCurve?: number[],
  ): void {
    const audio = this.ensureAudio();
    if (!audio) return;
    if (this.isPlaying) this.stop();

    const category = MOOD_LABEL_MAP[bgmTemplateId] ?? 'hightension';
    this.currentCategory = category;
    const track = pickTrack(category);

    try {
      audio.src = track.url;
      audio.volume = 0;
      audio.play().then(() => {
        this.fadeIn();
      }).catch(() => {
        // autoplay policy or network issue — try muted then unmute
        audio.muted = true;
        audio.play().then(() => {
          audio.muted = false;
          this.fadeIn();
        }).catch(() => {
          // cannot play — give up silently
        });
      });
      this.isPlaying = true;
    } catch {
      this.stop();
    }
  }

  private fadeIn(): void {
    if (!this.audio) return;
    const targetVol = this.volume;
    const fadeSteps = 20;
    const fadeInterval = 25;
    let step = 0;
    const fade = () => {
      if (!this.audio || !this.isPlaying) return;
      step++;
      this.audio.volume = Math.min(targetVol, (targetVol * step) / fadeSteps);
      if (step < fadeSteps) {
        this.fadeTimer = setTimeout(fade, fadeInterval);
      }
    };
    fade();
  }

  stop(): void {
    this.isPlaying = false;
    if (this.fadeTimer) {
      clearTimeout(this.fadeTimer);
      this.fadeTimer = null;
    }
    if (this.audio) {
      try {
        this.audio.pause();
        this.audio.currentTime = 0;
      } catch { /* ignore */ }
    }
  }

  setVolume(vol: number): void {
    this.volume = vol;
    if (this.audio && this.isPlaying) {
      this.audio.volume = vol;
    }
  }

  dispose(): void {
    this.stop();
    if (this.audio) {
      try {
        this.audio.src = '';
        this.audio.load();
      } catch { /* ignore */ }
      this.audio = null;
    }
  }

  get playing(): boolean {
    return this.isPlaying;
  }

  get category(): BgmCategory {
    return this.currentCategory;
  }
}

/**
 * Get a streaming MP3 URL for a given mood label.
 * Used when only the URL is needed (e.g., mixing into video).
 */
export function getBgmStreamUrl(moodLabel: string, trackIndex?: number): string {
  const category = MOOD_LABEL_MAP[moodLabel] ?? 'hightension';
  const config = MOOD_CONFIGS[category];
  const track = trackIndex != null ? config.tracks[trackIndex % config.tracks.length] : pickTrack(category);
  return track.url;
}

/**
 * Get BGM metadata for a mood — used by edit plan builders.
 */
export function getBgmTemplateForMood(moodLabel: string): {
  id: string;
  label: string;
  mood: string;
  bpm: number;
  highlightStartSec: number;
  highlightDurationSec: number;
  energyCurve: number[];
} {
  const category = MOOD_LABEL_MAP[moodLabel] ?? 'hightension';
  const config = MOOD_CONFIGS[category];
  const track = config.tracks[0];
  return {
    id: category,
    label: config.label,
    mood: config.label,
    bpm: config.bpm,
    highlightStartSec: track.highlightStartSec,
    highlightDurationSec: track.highlightDurationSec,
    energyCurve: config.energyCurve,
  };
}

/**
 * Mix a streaming BGM track into a video element and produce a new video blob with audio.
 * Uses MediaRecorder + Canvas + HTML5 Audio on web.
 * Falls back to original video if mixing fails.
 */
export async function mixBgmIntoVideo(
  videoUri: string,
  bgmTemplateId: string,
  _bpm?: number,
  durationSec?: number,
  _highlightStartSec?: number,
  _highlightDurationSec?: number,
  _energyCurve?: number[],
): Promise<string> {
  if (typeof window === 'undefined' || typeof document === 'undefined') return videoUri;

  try {
    const video = document.createElement('video');
    video.src = videoUri;
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.volume = 0;
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error('video load failed'));
      setTimeout(() => reject(new Error('video load timeout')), 10000);
    });

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1080;
    canvas.height = video.videoHeight || 1920;
    const ctx2d = canvas.getContext('2d');
    if (!ctx2d) return videoUri;

    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return videoUri;
    const audioCtx = new AudioCtx();

    const destination = audioCtx.createMediaStreamDestination();

    const videoSource = audioCtx.createMediaElementSource(video);
    const videoGain = audioCtx.createGain();
    videoGain.gain.value = 0.7;
    videoSource.connect(videoGain);
    videoGain.connect(destination);

    const bgmUrl = getBgmStreamUrl(bgmTemplateId);
    const bgmAudio = new Audio(bgmUrl);
    bgmAudio.crossOrigin = 'anonymous';
    bgmAudio.loop = true;
    await new Promise<void>((resolve, reject) => {
      bgmAudio.addEventListener('canplaythrough', () => resolve(), { once: true });
      bgmAudio.addEventListener('error', () => reject(new Error('bgm load failed')), { once: true });
      setTimeout(() => reject(new Error('bgm load timeout')), 15000);
    });

    const bgmSource = audioCtx.createMediaElementSource(bgmAudio);
    const bgmGain = audioCtx.createGain();
    bgmGain.gain.value = 0.45;
    bgmSource.connect(bgmGain);
    bgmGain.connect(destination);

    const combinedStream = canvas.captureStream(30);
    const audioTracks = destination.stream.getAudioTracks();
    audioTracks.forEach((track) => combinedStream.addTrack(track));

    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
      ? 'video/webm;codecs=vp9,opus'
      : 'video/webm;codecs=vp8,opus';
    const recorder = new MediaRecorder(combinedStream, { mimeType, videoBitsPerSecond: 6_000_000 });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

    const done = new Promise<Blob>((resolve) => {
      recorder.onstop = () => resolve(new Blob(chunks, { type: 'video/webm' }));
    });

    video.currentTime = 0;
    await video.play();
    await bgmAudio.play();
    recorder.start();

    const drawFrame = () => {
      if (video.ended || video.paused) return;
      ctx2d.drawImage(video, 0, 0, canvas.width, canvas.height);
      requestAnimationFrame(drawFrame);
    };
    drawFrame();

    const stopAt = Math.max(0, (durationSec || video.duration || 15)) * 1000;
    setTimeout(() => {
      recorder.stop();
      video.pause();
      bgmAudio.pause();
    }, stopAt);

    const mixedBlob = await done;
    try { audioCtx.close(); } catch { /* ignore */ }

    const blobUrl = URL.createObjectURL(mixedBlob);
    return blobUrl;
  } catch {
    return videoUri;
  }
}

export interface BgmRecommendation {
  category: BgmCategory;
  templateId: string;
  label: string;
  description: string;
  bpm: number;
  reason: string;
  highlightStartSec: number;
  highlightDurationSec: number;
  energyCurve: number[];
}

const FALLBACK_RECOMMENDATION: BgmRecommendation = {
  category: 'hightension',
  templateId: 'hightension',
  label: '하이텐션',
  description: '틱톡 및 릴스에서 가장 인기 있는 경쾌한 일렉트로닉 비트',
  bpm: 128,
  reason: '이미지 분석 없이 하이텐션 무드를 기본 추천했습니다.',
  highlightStartSec: 3,
  highlightDurationSec: 10,
  energyCurve: HIGH_ENERGY_CURVE,
};

const MOOD_DESCRIPTIONS: Record<BgmCategory, string> = {
  cinematic: '웅장하고 드라마틱한 오케스트라 빌드업 — 제품 집중, 네이버 클립에 최적',
  hightension: '빠르고 에너제틱한 일렉트로닉 비트 — 틱톡/쇼츠 FYP 진입용',
  asmr: '차분하고 미니멀한 앰비언트 — 제품 디테일 어필, 광고 전환용',
  emotional: '따뜻하고 감성적인 피아노/스트링 — 인스타 릴스 스토리텔링용',
  lofi: '편안한 로파이 비트 — 카페/일상/힐링 콘텐츠에 최적',
};

export async function fetchBgmRecommendation(
  imageDataUrl: string,
  mimeType: string = 'image/jpeg',
): Promise<BgmRecommendation> {
  try {
    const { supabase } = await import('@/lib/supabase');
    const { data, error } = await supabase.functions.invoke('recommend-bgm', {
      body: { imageDataUrl, mimeType },
    });
    if (error || !data) return FALLBACK_RECOMMENDATION;

    const raw = data as Record<string, unknown>;
    const rawCategory = String(raw.category ?? raw.templateId ?? '');
    const mappedCategory: BgmCategory = MOOD_LABEL_MAP[rawCategory] ?? (rawCategory in MOOD_CONFIGS ? rawCategory as BgmCategory : 'hightension');

    return {
      category: mappedCategory,
      templateId: mappedCategory,
      label: MOOD_CONFIGS[mappedCategory].label,
      description: String(raw.description ?? MOOD_DESCRIPTIONS[mappedCategory]),
      bpm: Number(raw.bpm ?? MOOD_CONFIGS[mappedCategory].bpm),
      reason: String(raw.reason ?? `${MOOD_CONFIGS[mappedCategory].label} 무드를 추천했습니다.`),
      highlightStartSec: Number(raw.highlightStartSec ?? MOOD_CONFIGS[mappedCategory].tracks[0].highlightStartSec),
      highlightDurationSec: Number(raw.highlightDurationSec ?? MOOD_CONFIGS[mappedCategory].tracks[0].highlightDurationSec),
      energyCurve: Array.isArray(raw.energyCurve) ? raw.energyCurve as number[] : MOOD_CONFIGS[mappedCategory].energyCurve,
    };
  } catch {
    return FALLBACK_RECOMMENDATION;
  }
}

export const BGM_CATEGORY_LABELS: Record<BgmCategory, string> = {
  cinematic: '시네마틱',
  hightension: '하이텐션',
  asmr: 'ASMR',
  emotional: '감성',
  lofi: '로파이',
};

export const BGM_MOOD_LIST: { label: string; category: BgmCategory; description: string }[] = [
  { label: '시네마틱', category: 'cinematic', description: MOOD_DESCRIPTIONS.cinematic },
  { label: '하이텐션', category: 'hightension', description: MOOD_DESCRIPTIONS.hightension },
  { label: 'ASMR', category: 'asmr', description: MOOD_DESCRIPTIONS.asmr },
  { label: '감성', category: 'emotional', description: MOOD_DESCRIPTIONS.emotional },
  { label: '로파이', category: 'lofi', description: MOOD_DESCRIPTIONS.lofi },
];
