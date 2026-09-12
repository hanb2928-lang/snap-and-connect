/**
 * Web Audio API BGM synthesizer.
 * Generates music in-browser — no external URLs, no CORS, no dead links.
 * 5 mood categories with distinct chord progressions, tempos, and waveforms.
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
      { url: '', title: 'Cinematic Epic Build', durationSec: 30, highlightStartSec: 5, highlightDurationSec: 10 },
      { url: '', title: 'Cinematic Orchestra', durationSec: 30, highlightStartSec: 4, highlightDurationSec: 12 },
    ],
  },
  hightension: {
    category: 'hightension',
    label: '하이텐션',
    bpm: 128,
    energyCurve: HIGH_ENERGY_CURVE,
    tracks: [
      { url: '', title: 'Energetic Electronic Beat', durationSec: 30, highlightStartSec: 3, highlightDurationSec: 10 },
      { url: '', title: 'Upbeat Future Bass', durationSec: 30, highlightStartSec: 5, highlightDurationSec: 8 },
    ],
  },
  asmr: {
    category: 'asmr',
    label: 'ASMR',
    bpm: 60,
    energyCurve: LOW_ENERGY_CURVE,
    tracks: [
      { url: '', title: 'Soft Ambient Whisper', durationSec: 30, highlightStartSec: 2, highlightDurationSec: 14 },
      { url: '', title: 'Minimal Calm', durationSec: 30, highlightStartSec: 3, highlightDurationSec: 12 },
    ],
  },
  emotional: {
    category: 'emotional',
    label: '감성',
    bpm: 75,
    energyCurve: [0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.85, 0.8, 0.75, 0.7, 0.6, 0.5, 0.4, 0.3],
    tracks: [
      { url: '', title: 'Emotional Piano', durationSec: 30, highlightStartSec: 5, highlightDurationSec: 10 },
      { url: '', title: 'Warm Strings', durationSec: 30, highlightStartSec: 4, highlightDurationSec: 12 },
    ],
  },
  lofi: {
    category: 'lofi',
    label: '로파이',
    bpm: 85,
    energyCurve: LOW_ENERGY_CURVE,
    tracks: [
      { url: '', title: 'Lofi Chill Beats', durationSec: 30, highlightStartSec: 3, highlightDurationSec: 12 },
      { url: '', title: 'Lofi Study Session', durationSec: 30, highlightStartSec: 4, highlightDurationSec: 10 },
    ],
  },
};

const FALLBACK_TRACK_URL = '';

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

const CATEGORY_TO_BGM_CATEGORY: Record<string, BgmCategory> = {
  cinematic: 'cinematic',
  hightension: 'hightension',
  asmr: 'asmr',
  emotional: 'emotional',
  lofi: 'lofi',
};

export function moodLabelToCategory(moodLabel: string): BgmCategory {
  if (MOOD_LABEL_MAP[moodLabel]) return MOOD_LABEL_MAP[moodLabel];
  if (CATEGORY_TO_BGM_CATEGORY[moodLabel]) return CATEGORY_TO_BGM_CATEGORY[moodLabel];
  return 'hightension';
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

const NOTE_FREQS: Record<string, number> = {
  'C2': 65.41, 'D2': 73.42, 'E2': 82.41, 'F2': 87.31, 'G2': 98.00, 'A2': 110.00, 'B2': 123.47,
  'C3': 130.81, 'D3': 146.83, 'E3': 164.81, 'F3': 174.61, 'G3': 196.00, 'A3': 220.00, 'B3': 246.94,
  'C4': 261.63, 'D4': 293.66, 'E4': 329.63, 'F4': 349.23, 'G4': 392.00, 'A4': 440.00, 'B4': 493.88,
  'C5': 523.25, 'D5': 587.33, 'E5': 659.25, 'F5': 698.46, 'G5': 783.99, 'A5': 880.00,
};

interface MoodSynthConfig {
  chordProgression: string[][];
  bassOctave: number;
  waveform: OscillatorType;
  bassWaveform: OscillatorType;
  hasDrums: boolean;
  hasArp: boolean;
  filterFreq: number;
  reverbWet: number;
  attackSec: number;
  releaseSec: number;
}

const MOOD_SYNTH_CONFIGS: Record<BgmCategory, MoodSynthConfig> = {
  cinematic: {
    chordProgression: [
      ['C3', 'Eb3', 'G3', 'C4'],
      ['Ab2', 'C3', 'Eb3', 'Ab3'],
      ['F2', 'A2', 'C3', 'F3'],
      ['G2', 'B2', 'D3', 'G3'],
    ],
    bassOctave: 2,
    waveform: 'sine',
    bassWaveform: 'triangle',
    hasDrums: false,
    hasArp: true,
    filterFreq: 2000,
    reverbWet: 0.35,
    attackSec: 0.15,
    releaseSec: 1.2,
  },
  hightension: {
    chordProgression: [
      ['A3', 'C4', 'E4', 'A4'],
      ['F3', 'A3', 'C4', 'F4'],
      ['G3', 'B3', 'D4', 'G4'],
      ['E3', 'G3', 'B3', 'E4'],
    ],
    bassOctave: 2,
    waveform: 'sawtooth',
    bassWaveform: 'square',
    hasDrums: true,
    hasArp: true,
    filterFreq: 3000,
    reverbWet: 0.15,
    attackSec: 0.02,
    releaseSec: 0.3,
  },
  asmr: {
    chordProgression: [
      ['C4', 'E4', 'G4'],
      ['A3', 'C4', 'E4'],
      ['F3', 'A3', 'C4'],
      ['G3', 'B3', 'D4'],
    ],
    bassOctave: 2,
    waveform: 'sine',
    bassWaveform: 'sine',
    hasDrums: false,
    hasArp: false,
    filterFreq: 800,
    reverbWet: 0.5,
    attackSec: 0.5,
    releaseSec: 2.0,
  },
  emotional: {
    chordProgression: [
      ['C3', 'E3', 'G3', 'B3'],
      ['A2', 'C3', 'E3', 'G3'],
      ['F2', 'A2', 'C3', 'E3'],
      ['G2', 'B2', 'D3', 'F3'],
    ],
    bassOctave: 2,
    waveform: 'triangle',
    bassWaveform: 'sine',
    hasDrums: false,
    hasArp: true,
    filterFreq: 1500,
    reverbWet: 0.3,
    attackSec: 0.08,
    releaseSec: 0.8,
  },
  lofi: {
    chordProgression: [
      ['D3', 'F3', 'A3', 'C4'],
      ['Bb2', 'D3', 'F3', 'A3'],
      ['G2', 'B2', 'D3', 'F3'],
      ['A2', 'C3', 'E3', 'G3'],
    ],
    bassOctave: 2,
    waveform: 'sine',
    bassWaveform: 'triangle',
    hasDrums: true,
    hasArp: false,
    filterFreq: 1200,
    reverbWet: 0.25,
    attackSec: 0.06,
    releaseSec: 0.6,
  },
};

export class BgmPlayer {
  private audioCtx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private filterNode: BiquadFilterNode | null = null;
  private isPlaying = false;
  private volume = 0.75;
  private currentCategory: BgmCategory = 'hightension';
  private schedulerTimer: ReturnType<typeof setInterval> | null = null;
  private nextNoteTime = 0;
  private currentStep = 0;
  private stepCounter = 0;

  private getOrCreateContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.audioCtx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return null;
      this.audioCtx = new AudioCtx();
      this.masterGain = this.audioCtx.createGain();
      this.masterGain.gain.value = this.volume;
      this.filterNode = this.audioCtx.createBiquadFilter();
      this.filterNode.type = 'lowpass';
      this.filterNode.frequency.value = 2000;
      this.filterNode.Q.value = 0.5;
      this.filterNode.connect(this.masterGain);
      this.masterGain.connect(this.audioCtx.destination);
    }
    return this.audioCtx;
  }

  unlockAudio(): void {
    const ctx = this.getOrCreateContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
  }

  start(
    bgmTemplateId: string,
    bpm?: number,
    _highlightStartSec?: number,
    _highlightDurationSec?: number,
    _energyCurve?: number[],
  ): void {
    const ctx = this.getOrCreateContext();
    if (!ctx || !this.masterGain || !this.filterNode) return;
    if (this.isPlaying) this.stop();

    this.unlockAudio();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const category = moodLabelToCategory(bgmTemplateId);
    this.currentCategory = category;
    const config = MOOD_SYNTH_CONFIGS[category];
    const effectiveBpm = bpm ?? MOOD_CONFIGS[category].bpm;
    this.filterNode.frequency.value = config.filterFreq;

    this.isPlaying = true;
    this.currentStep = 0;
    this.stepCounter = 0;
    this.nextNoteTime = ctx.currentTime + 0.05;

    const stepDurSec = 60 / effectiveBpm / 2;

    const scheduleNotes = () => {
      if (!this.isPlaying || !this.audioCtx || !this.filterNode) return;

      while (this.nextNoteTime < this.audioCtx.currentTime + 0.15) {
        this.playStep(config, this.currentStep, this.nextNoteTime, stepDurSec, effectiveBpm);
        this.currentStep = (this.currentStep + 1) % (config.chordProgression.length * 4);
        this.stepCounter++;
        this.nextNoteTime += stepDurSec;
      }
    };

    scheduleNotes();
    this.schedulerTimer = setInterval(scheduleNotes, 25);
  }

  private playStep(
    config: MoodSynthConfig,
    step: number,
    time: number,
    stepDur: number,
    bpm: number,
  ): void {
    if (!this.audioCtx || !this.filterNode) return;

    const chordIndex = Math.floor(step / 4) % config.chordProgression.length;
    const beatInChord = step % 4;
    const chord = config.chordProgression[chordIndex];

    if (beatInChord === 0) {
      const bassNote = chord[0].replace(/\d/, (d) => String(Math.max(1, parseInt(d) - 1)));
      this.playNote(bassNote, time, stepDur * 4, config.bassWaveform, 0.35, config);
    }

    if (config.hasArp) {
      const arpNote = chord[beatInChord % chord.length];
      this.playNote(arpNote, time, stepDur * 0.9, config.waveform, 0.15, config);
    } else if (beatInChord === 0) {
      chord.forEach((note) => {
        this.playNote(note, time, stepDur * 3.5, config.waveform, 0.08, config);
      });
    }

    if (config.hasDrums) {
      if (beatInChord === 0 || beatInChord === 2) {
        this.playKick(time);
      }
      if (beatInChord === 1 || beatInChord === 3) {
        this.playHihat(time);
      }
    }
  }

  private playNote(
    noteName: string,
    time: number,
    durationSec: number,
    waveform: OscillatorType,
    gainValue: number,
    config: MoodSynthConfig,
  ): void {
    if (!this.audioCtx || !this.filterNode) return;
    const freq = NOTE_FREQS[noteName];
    if (!freq) return;

    const osc = this.audioCtx.createOscillator();
    osc.type = waveform;
    osc.frequency.value = freq;

    const gain = this.audioCtx.createGain();
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(gainValue, time + config.attackSec);
    gain.gain.linearRampToValueAtTime(0, time + durationSec);

    osc.connect(gain);
    gain.connect(this.filterNode);
    osc.start(time);
    osc.stop(time + durationSec + 0.05);
  }

  private playKick(time: number): void {
    if (!this.audioCtx || !this.filterNode) return;
    const osc = this.audioCtx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, time);
    osc.frequency.exponentialRampToValueAtTime(40, time + 0.1);

    const gain = this.audioCtx.createGain();
    gain.gain.setValueAtTime(0.4, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);

    osc.connect(gain);
    gain.connect(this.filterNode);
    osc.start(time);
    osc.stop(time + 0.2);
  }

  private playHihat(time: number): void {
    if (!this.audioCtx || !this.filterNode) return;
    const bufferSize = this.audioCtx.sampleRate * 0.05;
    const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.3;
    }
    const noise = this.audioCtx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.audioCtx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 6000;

    const gain = this.audioCtx.createGain();
    gain.gain.setValueAtTime(0.08, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.04);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.filterNode);
    noise.start(time);
    noise.stop(time + 0.06);
  }

  private fadeIn(): void {
    if (!this.masterGain || !this.audioCtx) return;
    const now = this.audioCtx.currentTime;
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setValueAtTime(0, now);
    this.masterGain.gain.linearRampToValueAtTime(this.volume, now + 0.3);
  }

  pause(): void {
    if (this.schedulerTimer) {
      clearInterval(this.schedulerTimer);
      this.schedulerTimer = null;
    }
    if (this.masterGain && this.audioCtx) {
      this.masterGain.gain.cancelScheduledValues(this.audioCtx.currentTime);
      this.masterGain.gain.linearRampToValueAtTime(0, this.audioCtx.currentTime + 0.1);
    }
    this.isPlaying = false;
  }

  resume(): void {
    if (!this.audioCtx) return;
    this.unlockAudio();
    if (this.masterGain) {
      this.masterGain.gain.cancelScheduledValues(this.audioCtx.currentTime);
      this.masterGain.gain.linearRampToValueAtTime(this.volume, this.audioCtx.currentTime + 0.2);
    }
    this.isPlaying = true;
    this.nextNoteTime = this.audioCtx.currentTime + 0.05;
    const config = MOOD_SYNTH_CONFIGS[this.currentCategory];
    const bpm = MOOD_CONFIGS[this.currentCategory].bpm;
    const stepDurSec = 60 / bpm / 2;
    const scheduleNotes = () => {
      if (!this.isPlaying || !this.audioCtx || !this.filterNode) return;
      while (this.nextNoteTime < this.audioCtx.currentTime + 0.15) {
        this.playStep(config, this.currentStep, this.nextNoteTime, stepDurSec, bpm);
        this.currentStep = (this.currentStep + 1) % (config.chordProgression.length * 4);
        this.stepCounter++;
        this.nextNoteTime += stepDurSec;
      }
    };
    scheduleNotes();
    this.schedulerTimer = setInterval(scheduleNotes, 25);
  }

  stop(): void {
    this.isPlaying = false;
    if (this.schedulerTimer) {
      clearInterval(this.schedulerTimer);
      this.schedulerTimer = null;
    }
    if (this.masterGain && this.audioCtx) {
      this.masterGain.gain.cancelScheduledValues(this.audioCtx.currentTime);
      this.masterGain.gain.linearRampToValueAtTime(0, this.audioCtx.currentTime + 0.15);
    }
  }

  setVolume(vol: number): void {
    this.volume = vol;
    if (this.masterGain && this.audioCtx) {
      this.masterGain.gain.cancelScheduledValues(this.audioCtx.currentTime);
      this.masterGain.gain.linearRampToValueAtTime(vol, this.audioCtx.currentTime + 0.05);
    }
  }

  dispose(): void {
    this.stop();
    if (this.audioCtx) {
      try { this.audioCtx.close(); } catch { /* ignore */ }
      this.audioCtx = null;
      this.masterGain = null;
      this.filterNode = null;
    }
  }

  get playing(): boolean {
    return this.isPlaying;
  }

  get category(): BgmCategory {
    return this.currentCategory;
  }
}

export function getBgmStreamUrl(_moodLabel: string, _trackIndex?: number): string {
  return '';
}

export function getBgmTemplateForMood(moodLabel: string): {
  id: string;
  label: string;
  mood: string;
  bpm: number;
  highlightStartSec: number;
  highlightDurationSec: number;
  energyCurve: number[];
} {
  const category = moodLabelToCategory(moodLabel);
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

export async function mixBgmIntoVideo(
  _videoUri: string,
  _bgmTemplateId: string,
  _bpm?: number,
  _durationSec?: number,
  _highlightStartSec?: number,
  _highlightDurationSec?: number,
  _energyCurve?: number[],
): Promise<string> {
  return _videoUri;
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
    const mappedCategory: BgmCategory = moodLabelToCategory(rawCategory);

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
