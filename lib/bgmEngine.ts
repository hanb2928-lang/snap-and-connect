/**
 * Web Audio API BGM synthesizer — rich layered sound engine.
 * 16-step sequencer with independent bass, melody, pad, and drum tracks.
 * Dual detuned oscillators, filter LFO, algorithmic reverb, swing, humanization.
 * No external URLs, no CORS, no dead links.
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

/* ─── Note frequency computation ─── */

const SEMITONE_MAP: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

function noteFreq(note: string): number {
  const match = note.match(/^([A-G])([#b]?)(\d)$/);
  if (!match) return 0;
  const [, letter, accidental, octaveStr] = match;
  let semitone = SEMITONE_MAP[letter] ?? 0;
  if (accidental === '#') semitone += 1;
  if (accidental === 'b') semitone -= 1;
  const midi = (parseInt(octaveStr) + 1) * 12 + semitone;
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/* ─── Synth configuration ─── */

interface DrumPattern {
  kick: number[];
  snare: number[];
  hh: number[];
  hhOpen: number[];
}

interface MoodSynthConfig {
  chords: string[][];
  padWaveform: OscillatorType;
  padGain: number;
  padAttack: number;
  padRelease: number;
  padDetune: number;
  melodyWaveform: OscillatorType;
  melodyGain: number;
  melodyDetune: number;
  bassWaveform: OscillatorType;
  bassGain: number;
  bassDetune: number;
  bassPattern: number[];
  melodyPattern: number[];
  drums: DrumPattern | null;
  filterFreq: number;
  filterQ: number;
  filterLfoFreq: number;
  filterLfoDepth: number;
  reverbDuration: number;
  reverbDecay: number;
  reverbWet: number;
  swing: number;
  humanize: number;
}

const REST = -1;

const MOOD_SYNTH_CONFIGS: Record<BgmCategory, MoodSynthConfig> = {
  cinematic: {
    chords: [
      ['C3', 'Eb3', 'G3', 'Bb3'],
      ['Ab2', 'C3', 'Eb3', 'G3'],
      ['F2', 'Ab2', 'C3', 'Eb3'],
      ['G2', 'B2', 'D3', 'F3'],
    ],
    padWaveform: 'sine',
    padGain: 0.07,
    padAttack: 0.4,
    padRelease: 1.8,
    padDetune: 6,
    melodyWaveform: 'sine',
    melodyGain: 0.12,
    melodyDetune: 4,
    bassWaveform: 'triangle',
    bassGain: 0.2,
    bassDetune: 3,
    bassPattern: [0, REST, REST, REST, REST, REST, 7, REST, REST, REST, REST, REST, 5, REST, REST, REST],
    melodyPattern: [REST, REST, REST, 12, REST, REST, 15, REST, REST, 12, REST, REST, 10, REST, 7, REST],
    drums: null,
    filterFreq: 1600,
    filterQ: 0.8,
    filterLfoFreq: 0.3,
    filterLfoDepth: 400,
    reverbDuration: 3.5,
    reverbDecay: 2.5,
    reverbWet: 0.35,
    swing: 0,
    humanize: 0.03,
  },
  hightension: {
    chords: [
      ['A3', 'C4', 'E4', 'G4'],
      ['F3', 'A3', 'C4', 'E4'],
      ['G3', 'B3', 'D4', 'F4'],
      ['E3', 'G3', 'B3', 'D4'],
    ],
    padWaveform: 'sawtooth',
    padGain: 0.05,
    padAttack: 0.03,
    padRelease: 0.4,
    padDetune: 8,
    melodyWaveform: 'sawtooth',
    melodyGain: 0.1,
    melodyDetune: 7,
    bassWaveform: 'square',
    bassGain: 0.18,
    bassDetune: 5,
    bassPattern: [0, 0, REST, 0, 7, REST, 0, 0, 0, REST, 5, REST, 0, 0, 3, REST],
    melodyPattern: [12, REST, 15, REST, 12, 10, REST, 12, 15, REST, 12, REST, 10, 7, REST, REST],
    drums: {
      kick:  [1,0,0,0, 0,0,1,0, 1,0,0,0, 0,0,1,0],
      snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,1],
      hh:    [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,1],
      hhOpen:[0,0,0,0, 0,0,0,0, 0,0,1,0, 0,0,0,0],
    },
    filterFreq: 2800,
    filterQ: 1.2,
    filterLfoFreq: 0.5,
    filterLfoDepth: 700,
    reverbDuration: 1.2,
    reverbDecay: 3,
    reverbWet: 0.12,
    swing: 0,
    humanize: 0.02,
  },
  asmr: {
    chords: [
      ['C4', 'E4', 'G4', 'D5'],
      ['A3', 'C4', 'E4', 'B4'],
      ['F3', 'A3', 'C4', 'E4'],
      ['G3', 'B3', 'D4', 'F4'],
    ],
    padWaveform: 'sine',
    padGain: 0.06,
    padAttack: 1.0,
    padRelease: 3.0,
    padDetune: 8,
    melodyWaveform: 'sine',
    melodyGain: 0.08,
    melodyDetune: 5,
    bassWaveform: 'sine',
    bassGain: 0.12,
    bassDetune: 2,
    bassPattern: [0, REST, REST, REST, REST, REST, REST, REST, REST, REST, REST, REST, REST, REST, REST, REST],
    melodyPattern: [REST, REST, REST, REST, 12, REST, REST, REST, REST, REST, REST, REST, REST, 10, REST, REST],
    drums: null,
    filterFreq: 700,
    filterQ: 0.4,
    filterLfoFreq: 0.08,
    filterLfoDepth: 150,
    reverbDuration: 5,
    reverbDecay: 2,
    reverbWet: 0.55,
    swing: 0,
    humanize: 0.04,
  },
  emotional: {
    chords: [
      ['C3', 'E3', 'G3', 'B3'],
      ['A2', 'C3', 'E3', 'G3'],
      ['F2', 'A2', 'C3', 'E3'],
      ['G2', 'B2', 'D3', 'F3'],
    ],
    padWaveform: 'triangle',
    padGain: 0.08,
    padAttack: 0.15,
    padRelease: 1.2,
    padDetune: 5,
    melodyWaveform: 'triangle',
    melodyGain: 0.13,
    melodyDetune: 4,
    bassWaveform: 'sine',
    bassGain: 0.18,
    bassDetune: 3,
    bassPattern: [0, REST, REST, 7, REST, REST, 5, REST, REST, 3, REST, REST, 7, REST, REST, REST],
    melodyPattern: [REST, REST, 12, REST, 10, REST, 12, REST, 15, REST, 12, REST, 10, REST, 7, REST],
    drums: null,
    filterFreq: 1400,
    filterQ: 0.6,
    filterLfoFreq: 0.2,
    filterLfoDepth: 250,
    reverbDuration: 2.5,
    reverbDecay: 2.5,
    reverbWet: 0.3,
    swing: 0,
    humanize: 0.03,
  },
  lofi: {
    chords: [
      ['D3', 'F3', 'A3', 'C4'],
      ['Bb2', 'D3', 'F3', 'A3'],
      ['G2', 'Bb2', 'D3', 'F3'],
      ['A2', 'C3', 'E3', 'G3'],
    ],
    padWaveform: 'sine',
    padGain: 0.07,
    padAttack: 0.12,
    padRelease: 0.9,
    padDetune: 10,
    melodyWaveform: 'sine',
    melodyGain: 0.1,
    melodyDetune: 6,
    bassWaveform: 'triangle',
    bassGain: 0.16,
    bassDetune: 4,
    bassPattern: [0, REST, REST, 3, REST, 5, REST, 3, REST, REST, 7, REST, 5, REST, 3, REST],
    melodyPattern: [REST, REST, 15, REST, 12, REST, REST, 10, REST, 12, REST, REST, 7, REST, REST, REST],
    drums: {
      kick:  [1,0,0,0, 0,0,0,0, 1,0,0,0, 0,0,0,0],
      snare: [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
      hh:    [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,0],
      hhOpen:[0,0,0,0, 0,0,0,1, 0,0,0,0, 0,0,0,1],
    },
    filterFreq: 1100,
    filterQ: 0.7,
    filterLfoFreq: 0.12,
    filterLfoDepth: 180,
    reverbDuration: 1.8,
    reverbDecay: 2.8,
    reverbWet: 0.22,
    swing: 0.15,
    humanize: 0.05,
  },
};

/* ─── BgmPlayer ─── */

export class BgmPlayer {
  private audioCtx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private filterNode: BiquadFilterNode | null = null;
  private dryGain: GainNode | null = null;
  private reverbConvolver: ConvolverNode | null = null;
  private reverbGain: GainNode | null = null;
  private lfoOsc: OscillatorNode | null = null;
  private lfoDepthGain: GainNode | null = null;
  private isPlaying = false;
  private volume = 0.75;
  private currentCategory: BgmCategory = 'hightension';
  private schedulerTimer: ReturnType<typeof setInterval> | null = null;
  private nextNoteTime = 0;
  private currentStep = 0;

  private getOrCreateContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.audioCtx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return null;
      const ctx = new AudioCtx();

      this.masterGain = ctx.createGain();
      this.masterGain.gain.value = 0;
      this.masterGain.connect(ctx.destination);

      this.filterNode = ctx.createBiquadFilter();
      this.filterNode.type = 'lowpass';
      this.filterNode.frequency.value = 2000;
      this.filterNode.Q.value = 0.7;

      this.dryGain = ctx.createGain();
      this.dryGain.gain.value = 0.7;
      this.filterNode.connect(this.dryGain);
      this.dryGain.connect(this.masterGain);

      this.reverbGain = ctx.createGain();
      this.reverbGain.gain.value = 0;
      this.reverbConvolver = ctx.createConvolver();
      this.reverbConvolver.connect(this.reverbGain);
      this.reverbGain.connect(this.masterGain);

      this.lfoDepthGain = ctx.createGain();
      this.lfoDepthGain.gain.value = 0;
      this.lfoOsc = ctx.createOscillator();
      this.lfoOsc.type = 'sine';
      this.lfoOsc.frequency.value = 0.3;
      this.lfoOsc.connect(this.lfoDepthGain);
      this.lfoDepthGain.connect(this.filterNode.frequency);
      this.lfoOsc.start();

      this.audioCtx = ctx;
    }
    return this.audioCtx;
  }

  private createReverbImpulse(ctx: AudioContext, durationSec: number, decay: number): AudioBuffer {
    const sampleRate = ctx.sampleRate;
    const length = Math.floor(sampleRate * durationSec);
    const impulse = ctx.createBuffer(2, length, sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = impulse.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
      }
    }
    return impulse;
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
    if (!ctx || !this.masterGain || !this.filterNode || !this.reverbConvolver || !this.reverbGain || !this.lfoOsc || !this.lfoDepthGain) return;
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
    this.filterNode.Q.value = config.filterQ;
    this.lfoOsc.frequency.value = config.filterLfoFreq;
    this.lfoDepthGain.gain.value = config.filterLfoDepth;
    this.reverbConvolver.buffer = this.createReverbImpulse(ctx, config.reverbDuration, config.reverbDecay);
    this.reverbGain.gain.value = config.reverbWet;

    this.isPlaying = true;
    this.currentStep = 0;
    this.nextNoteTime = ctx.currentTime + 0.05;

    const stepDurSec = 60 / effectiveBpm / 4;
    const totalSteps = config.chords.length * 16;

    const scheduleNotes = () => {
      if (!this.isPlaying || !this.audioCtx || !this.filterNode) return;
      while (this.nextNoteTime < this.audioCtx.currentTime + 0.15) {
        const swungTime = this.applySwing(this.currentStep, this.nextNoteTime, stepDurSec, config.swing);
        this.playStep(config, this.currentStep, swungTime, stepDurSec, totalSteps);
        this.currentStep = (this.currentStep + 1) % totalSteps;
        this.nextNoteTime += stepDurSec;
      }
    };

    this.masterGain.gain.cancelScheduledValues(ctx.currentTime);
    this.masterGain.gain.setValueAtTime(0, ctx.currentTime);
    this.masterGain.gain.linearRampToValueAtTime(this.volume, ctx.currentTime + 0.4);

    scheduleNotes();
    this.schedulerTimer = setInterval(scheduleNotes, 25);
  }

  private applySwing(step: number, time: number, stepDur: number, swing: number): number {
    if (swing <= 0) return time;
    const barStep = step % 16;
    if (barStep % 2 === 1) {
      return time + stepDur * swing;
    }
    return time;
  }

  private playStep(
    config: MoodSynthConfig,
    step: number,
    time: number,
    stepDur: number,
    totalSteps: number,
  ): void {
    if (!this.audioCtx || !this.filterNode || !this.masterGain) return;

    const barStep = step % 16;
    const chordIndex = Math.floor(step / 16) % config.chords.length;
    const chord = config.chords[chordIndex];
    const rootFreq = noteFreq(chord[0]);
    if (rootFreq <= 0) return;

    if (barStep === 0) {
      this.playPad(chord, time, stepDur * 16, config);
    }

    const bassOffset = config.bassPattern[barStep];
    if (bassOffset !== undefined && bassOffset >= 0) {
      const freq = rootFreq * Math.pow(2, bassOffset / 12);
      const humanizedGain = config.bassGain * (1 - config.humanize + Math.random() * config.humanize * 2);
      this.playNoteLayered(freq, time, stepDur * 2.2, config.bassWaveform, humanizedGain, config.bassDetune, config, false);
    }

    const melodyOffset = config.melodyPattern[barStep];
    if (melodyOffset !== undefined && melodyOffset >= 0) {
      const freq = rootFreq * Math.pow(2, melodyOffset / 12);
      const humanizedGain = config.melodyGain * (1 - config.humanize + Math.random() * config.humanize * 2);
      this.playNoteLayered(freq, time, stepDur * 1.8, config.melodyWaveform, humanizedGain, config.melodyDetune, config, true);
    }

    if (config.drums) {
      if (config.drums.kick[barStep]) this.playKick(time);
      if (config.drums.snare[barStep]) this.playSnare(time);
      if (config.drums.hh[barStep]) this.playHihat(time, config.drums.hhOpen[barStep] === 1);
    }
  }

  private playPad(chord: string[], time: number, durationSec: number, config: MoodSynthConfig): void {
    if (!this.audioCtx || !this.filterNode) return;
    for (const note of chord) {
      const freq = noteFreq(note);
      if (freq <= 0) continue;
      this.playNoteLayered(freq, time, durationSec, config.padWaveform, config.padGain, config.padDetune, config, true);
    }
  }

  private playNoteLayered(
    freq: number,
    time: number,
    durationSec: number,
    waveform: OscillatorType,
    gainValue: number,
    detuneCents: number,
    config: MoodSynthConfig,
    useFilter: boolean,
  ): void {
    if (!this.audioCtx) return;
    const dest = useFilter && this.filterNode ? this.filterNode : this.masterGain;
    if (!dest) return;

    const gain = this.audioCtx.createGain();
    const attackSec = Math.min(config.padAttack, durationSec * 0.5);
    const releaseSec = Math.min(config.padRelease, durationSec * 0.5);

    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(gainValue, time + attackSec);
    gain.gain.setValueAtTime(gainValue, time + durationSec - releaseSec);
    gain.gain.linearRampToValueAtTime(0, time + durationSec);

    const osc1 = this.audioCtx.createOscillator();
    osc1.type = waveform;
    osc1.frequency.value = freq;
    osc1.detune.value = -detuneCents / 2;
    osc1.connect(gain);

    const osc2 = this.audioCtx.createOscillator();
    osc2.type = waveform;
    osc2.frequency.value = freq;
    osc2.detune.value = detuneCents / 2;
    osc2.connect(gain);

    gain.connect(dest);
    osc1.start(time);
    osc2.start(time);
    osc1.stop(time + durationSec + 0.05);
    osc2.stop(time + durationSec + 0.05);
  }

  private playKick(time: number): void {
    if (!this.audioCtx || !this.masterGain) return;
    const osc = this.audioCtx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(130, time);
    osc.frequency.exponentialRampToValueAtTime(38, time + 0.12);

    const gain = this.audioCtx.createGain();
    gain.gain.setValueAtTime(0.5, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.18);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(time);
    osc.stop(time + 0.22);
  }

  private playSnare(time: number): void {
    if (!this.audioCtx || !this.masterGain) return;

    const bufferSize = Math.floor(this.audioCtx.sampleRate * 0.15);
    const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }
    const noise = this.audioCtx.createBufferSource();
    noise.buffer = buffer;

    const noiseFilter = this.audioCtx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = 1800;
    noiseFilter.Q.value = 0.8;

    const noiseGain = this.audioCtx.createGain();
    noiseGain.gain.setValueAtTime(0.25, time);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.12);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.masterGain);

    const toneOsc = this.audioCtx.createOscillator();
    toneOsc.type = 'triangle';
    toneOsc.frequency.value = 180;
    const toneGain = this.audioCtx.createGain();
    toneGain.gain.setValueAtTime(0.15, time);
    toneGain.gain.exponentialRampToValueAtTime(0.001, time + 0.08);
    toneOsc.connect(toneGain);
    toneGain.connect(this.masterGain);

    noise.start(time);
    noise.stop(time + 0.16);
    toneOsc.start(time);
    toneOsc.stop(time + 0.1);
  }

  private playHihat(time: number, open: boolean): void {
    if (!this.audioCtx || !this.masterGain) return;
    const dur = open ? 0.12 : 0.04;
    const bufferSize = Math.floor(this.audioCtx.sampleRate * dur);
    const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }
    const noise = this.audioCtx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.audioCtx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 7000;

    const gain = this.audioCtx.createGain();
    const peakGain = open ? 0.06 : 0.09;
    gain.gain.setValueAtTime(peakGain, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    noise.start(time);
    noise.stop(time + dur + 0.02);
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
    if (!this.audioCtx || !this.masterGain) return;
    this.unlockAudio();
    this.masterGain.gain.cancelScheduledValues(this.audioCtx.currentTime);
    this.masterGain.gain.linearRampToValueAtTime(this.volume, this.audioCtx.currentTime + 0.2);
    this.isPlaying = true;
    this.nextNoteTime = this.audioCtx.currentTime + 0.05;

    const config = MOOD_SYNTH_CONFIGS[this.currentCategory];
    const bpm = MOOD_CONFIGS[this.currentCategory].bpm;
    const stepDurSec = 60 / bpm / 4;
    const totalSteps = config.chords.length * 16;

    const scheduleNotes = () => {
      if (!this.isPlaying || !this.audioCtx || !this.filterNode) return;
      while (this.nextNoteTime < this.audioCtx.currentTime + 0.15) {
        const swungTime = this.applySwing(this.currentStep, this.nextNoteTime, stepDurSec, config.swing);
        this.playStep(config, this.currentStep, swungTime, stepDurSec, totalSteps);
        this.currentStep = (this.currentStep + 1) % totalSteps;
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
    if (this.masterGain && this.audioCtx && this.isPlaying) {
      this.masterGain.gain.cancelScheduledValues(this.audioCtx.currentTime);
      this.masterGain.gain.linearRampToValueAtTime(vol, this.audioCtx.currentTime + 0.05);
    }
  }

  dispose(): void {
    this.stop();
    if (this.lfoOsc) {
      try { this.lfoOsc.stop(); } catch { /* ignore */ }
      this.lfoOsc = null;
    }
    if (this.audioCtx) {
      try { this.audioCtx.close(); } catch { /* ignore */ }
      this.audioCtx = null;
      this.masterGain = null;
      this.filterNode = null;
      this.dryGain = null;
      this.reverbConvolver = null;
      this.reverbGain = null;
      this.lfoDepthGain = null;
    }
  }

  get playing(): boolean {
    return this.isPlaying;
  }

  get category(): BgmCategory {
    return this.currentCategory;
  }
}

/* ─── Utility exports ─── */

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
