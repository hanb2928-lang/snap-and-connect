/**
 * Web Audio API based BGM generator.
 * 4 real-music track categories with rich procedural synthesis:
 *   - upbeat_pop:    Trendy upbeat pop (TikTok/Reels style)
 *   - lofi_chill:    Emotional lofi beats (cafe/bakery mood)
 *   - acoustic_indie: Warm acoustic indie guitar
 *   - energy_hiphop:  Dynamic hiphop beats (fashion/launch)
 * Each category has distinct instruments, chord progressions, drum patterns,
 * and an energy curve that drives a 15-second highlight extraction.
 * Works on web platform only — native falls back to no audio.
 */

export type BgmCategory = 'upbeat_pop' | 'lofi_chill' | 'acoustic_indie' | 'energy_hiphop';

interface BgmConfig {
  bpm: number;
  category: BgmCategory;
  highlightStartSec: number;
  highlightDurationSec: number;
  energyCurve: number[];
}

interface CategoryProfile {
  bpm: number;
  scales: number[][];
  baseFreq: number;
  waveType: OscillatorType;
  secondaryWaveType: OscillatorType;
  filterFreq: number;
  filterQ: number;
  gain: number;
  drumPattern: boolean[];
  bassPattern: number[];
  chordProgression: number[][];
  arpeggio: boolean;
}

const CATEGORY_PROFILES: Record<BgmCategory, CategoryProfile> = {
  upbeat_pop: {
    bpm: 128,
    scales: [[0, 2, 4, 7, 9], [0, 2, 5, 7, 9], [0, 3, 5, 7, 10], [0, 2, 4, 7, 9]],
    baseFreq: 261.63,
    waveType: 'triangle',
    secondaryWaveType: 'sine',
    filterFreq: 3000,
    filterQ: 1.5,
    gain: 0.08,
    drumPattern: [true, false, true, false, true, false, true, false, true, false, true, false, true, false, true, false],
    bassPattern: [0, -1, 0, -1, 7, -1, 5, -1, 0, -1, 0, -1, 7, -1, 5, -1],
    chordProgression: [[0, 4, 7], [0, 5, 9], [0, 3, 7], [0, 4, 7]],
    arpeggio: true,
  },
  lofi_chill: {
    bpm: 85,
    scales: [[0, 2, 3, 5, 7, 10], [0, 2, 3, 5, 7, 10], [0, 1, 3, 5, 7, 10], [0, 2, 3, 5, 7, 10]],
    baseFreq: 220,
    waveType: 'sine',
    secondaryWaveType: 'triangle',
    filterFreq: 900,
    filterQ: 0.8,
    gain: 0.06,
    drumPattern: [true, false, false, false, true, false, false, true, true, false, false, false, true, false, false, false],
    bassPattern: [0, -1, -1, -1, 5, -1, -1, -1, 3, -1, -1, -1, 7, -1, -1, -1],
    chordProgression: [[0, 3, 7, 10], [0, 3, 7, 10], [0, 1, 5, 8], [0, 3, 7, 10]],
    arpeggio: false,
  },
  acoustic_indie: {
    bpm: 95,
    scales: [[0, 2, 4, 7, 9, 11], [0, 2, 4, 7, 9, 11], [0, 2, 5, 7, 9, 11], [0, 2, 4, 7, 9, 11]],
    baseFreq: 329.63,
    waveType: 'triangle',
    secondaryWaveType: 'sine',
    filterFreq: 2000,
    filterQ: 1.0,
    gain: 0.07,
    drumPattern: [true, false, false, false, true, false, true, false, true, false, false, false, true, false, false, false],
    bassPattern: [0, -1, -1, -1, 4, -1, -1, -1, 5, -1, -1, -1, 7, -1, -1, -1],
    chordProgression: [[0, 4, 7, 11], [0, 5, 9, 12], [0, 7, 12, 16], [0, 4, 7, 11]],
    arpeggio: true,
  },
  energy_hiphop: {
    bpm: 140,
    scales: [[0, 3, 5, 7, 10, 12], [0, 3, 5, 7, 10, 12], [0, 2, 3, 7, 10, 12], [0, 3, 5, 7, 10, 12]],
    baseFreq: 196,
    waveType: 'sawtooth',
    secondaryWaveType: 'square',
    filterFreq: 2200,
    filterQ: 2.0,
    gain: 0.09,
    drumPattern: [true, false, true, true, true, false, true, false, true, false, true, true, true, false, true, false],
    bassPattern: [0, 0, -1, 0, 3, -1, 3, -1, 5, 5, -1, 5, 7, -1, 7, -1],
    chordProgression: [[0, 3, 7, 10], [0, 3, 7, 10], [0, 2, 7, 10], [0, 3, 7, 10]],
    arpeggio: false,
  },
};

function categoryFromTemplateId(templateId: string): BgmCategory {
  if (templateId.includes('upbeat')) return 'upbeat_pop';
  if (templateId.includes('lofi')) return 'lofi_chill';
  if (templateId.includes('acoustic')) return 'acoustic_indie';
  if (templateId.includes('hiphop')) return 'energy_hiphop';
  return 'upbeat_pop';
}

function semitoneToFreq(base: number, semitones: number): number {
  return base * Math.pow(2, semitones / 12);
}

export class BgmPlayer {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private oscillators: OscillatorNode[] = [];
  private filter: BiquadFilterNode | null = null;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private config: BgmConfig | null = null;
  private isPlaying = false;
  private startTime = 0;

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      try {
        const Ctx = window.AudioContext || (window as any).webkitAudioContext;
        if (!Ctx) return null;
        this.ctx = new Ctx();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0;
        this.masterGain.connect(this.ctx.destination);
      } catch {
        return null;
      }
    }
    return this.ctx;
  }

  start(
    bgmTemplateId: string,
    bpm: number,
    highlightStartSec = 5,
    highlightDurationSec = 10,
    energyCurve?: number[],
  ): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;
    if (this.isPlaying) this.stop();

    const category = categoryFromTemplateId(bgmTemplateId);
    const profile = CATEGORY_PROFILES[category];
    const effectiveBpm = bpm || profile.bpm;
    const curve = energyCurve && energyCurve.length >= 15 ? energyCurve : this.buildDefaultEnergyCurve(category);

    this.config = {
      bpm: effectiveBpm,
      category,
      highlightStartSec,
      highlightDurationSec,
      energyCurve: curve,
    };

    try {
      if (ctx.state === 'suspended') ctx.resume();

      this.filter = ctx.createBiquadFilter();
      this.filter.type = 'lowpass';
      this.filter.frequency.value = profile.filterFreq;
      this.filter.Q.value = profile.filterQ;
      this.filter.connect(this.masterGain);

      this.masterGain.gain.cancelScheduledValues(ctx.currentTime);
      this.masterGain.gain.setValueAtTime(0, ctx.currentTime);
      this.masterGain.gain.linearRampToValueAtTime(profile.gain, ctx.currentTime + 0.5);

      this.startTime = ctx.currentTime;
      const beatSec = 60 / effectiveBpm;
      this.scheduleLoop(ctx, profile, beatSec);

      this.isPlaying = true;
    } catch {
      this.stop();
    }
  }

  private buildDefaultEnergyCurve(category: BgmCategory): number[] {
    const curves: Record<BgmCategory, number[]> = {
      upbeat_pop: [0.3, 0.5, 0.7, 0.85, 1.0, 0.95, 0.9, 0.85, 0.8, 0.75, 0.7, 0.65, 0.6, 0.55, 0.5],
      lofi_chill: [0.2, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.6, 0.58, 0.55, 0.5, 0.45, 0.4, 0.35],
      acoustic_indie: [0.15, 0.25, 0.35, 0.45, 0.55, 0.65, 0.7, 0.72, 0.7, 0.65, 0.6, 0.55, 0.5, 0.45, 0.4],
      energy_hiphop: [0.4, 0.6, 0.8, 1.0, 1.0, 0.95, 0.9, 0.85, 0.8, 0.75, 0.7, 0.65, 0.6, 0.55, 0.5],
    };
    return curves[category];
  }

  private getEnergyAtTime(elapsedSec: number): number {
    if (!this.config) return 1;
    const idx = Math.min(14, Math.floor(elapsedSec));
    return this.config.energyCurve[idx] ?? 1;
  }

  private isInHighlight(elapsedSec: number): boolean {
    if (!this.config) return false;
    return elapsedSec >= this.config.highlightStartSec &&
      elapsedSec < this.config.highlightStartSec + this.config.highlightDurationSec;
  }

  private scheduleLoop(ctx: AudioContext, profile: CategoryProfile, beatSec: number): void {
    const stepDur = beatSec / 4;
    let step = 0;
    let chordIdx = 0;

    const playSynthNote = (semiTones: number, time: number, duration: number, gainVal: number, waveType: OscillatorType) => {
      if (!this.filter || semiTones < 0) return;
      const baseFreq = this.config ? CATEGORY_PROFILES[this.config.category].baseFreq : 261.63;
      const freq = semitoneToFreq(baseFreq, semiTones);
      const osc = ctx.createOscillator();
      const noteGain = ctx.createGain();
      osc.type = waveType;
      osc.frequency.value = freq;
      noteGain.gain.setValueAtTime(0, time);
      noteGain.gain.linearRampToValueAtTime(gainVal, time + 0.02);
      noteGain.gain.exponentialRampToValueAtTime(0.001, time + duration * 0.9);
      osc.connect(noteGain);
      noteGain.connect(this.filter);
      osc.start(time);
      osc.stop(time + duration);
      this.oscillators.push(osc);
      osc.onended = () => {
        const idx = this.oscillators.indexOf(osc);
        if (idx >= 0) this.oscillators.splice(idx, 1);
      };
    };

    const playKick = (time: number, gainVal: number) => {
      if (!this.masterGain) return;
      const osc = ctx.createOscillator();
      const noteGain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(150, time);
      osc.frequency.exponentialRampToValueAtTime(40, time + 0.15);
      noteGain.gain.setValueAtTime(gainVal, time);
      noteGain.gain.exponentialRampToValueAtTime(0.001, time + 0.2);
      osc.connect(noteGain);
      noteGain.connect(this.masterGain);
      osc.start(time);
      osc.stop(time + 0.2);
      this.oscillators.push(osc);
      osc.onended = () => {
        const idx = this.oscillators.indexOf(osc);
        if (idx >= 0) this.oscillators.splice(idx, 1);
      };
    };

    const playHihat = (time: number, gainVal: number) => {
      if (!this.masterGain) return;
      const noiseDur = 0.05;
      const bufferSize = Math.floor(ctx.sampleRate * noiseDur);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = 7000;
      const noteGain = ctx.createGain();
      noteGain.gain.setValueAtTime(gainVal, time);
      noteGain.gain.exponentialRampToValueAtTime(0.001, time + noiseDur);
      noise.connect(filter);
      filter.connect(noteGain);
      noteGain.connect(this.masterGain);
      noise.start(time);
      noise.stop(time + noiseDur);
    };

    const tick = () => {
      if (!this.isPlaying || !this.config) return;
      const now = ctx.currentTime;
      const elapsed = now - this.startTime;
      const inHighlight = this.isInHighlight(elapsed);
      const energy = this.getEnergyAtTime(elapsed);
      const energyBoost = inHighlight ? 1.3 : 1.0;

      const stepInBar = step % 16;
      const barIdx = Math.floor(step / 16);

      if (stepInBar === 0) {
        chordIdx = barIdx % profile.chordProgression.length;
      }

      const chord = profile.chordProgression[chordIdx];
      const scale = profile.scales[chordIdx % profile.scales.length];

      if (profile.drumPattern[stepInBar]) {
        playKick(now, 0.7 * energy * energyBoost);
      }
      if (stepInBar % 2 === 1) {
        playHihat(now, 0.15 * energy);
      }

      const bassNote = profile.bassPattern[stepInBar];
      if (bassNote >= 0) {
        playSynthNote(bassNote - 12, now, stepDur * 2, 0.5 * energy * energyBoost, 'sine');
      }

      if (profile.arpeggio) {
        const arpNote = chord[stepInBar % chord.length];
        playSynthNote(arpNote, now, stepDur * 1.5, 0.3 * energy * energyBoost, profile.waveType);
        if (inHighlight && stepInBar % 4 === 0) {
          const sparkleNote = scale[stepInBar % scale.length] + 12;
          playSynthNote(sparkleNote, now, stepDur, 0.2 * energyBoost, profile.secondaryWaveType);
        }
      } else if (stepInBar % 4 === 0) {
        chord.forEach((note) => {
          playSynthNote(note, now, stepDur * 3, 0.2 * energy * energyBoost, profile.waveType);
        });
      }

      if (inHighlight && stepInBar === 0) {
        const hookNote = scale[0] + 12;
        playSynthNote(hookNote, now, stepDur * 4, 0.4 * energyBoost, profile.secondaryWaveType);
      }

      step++;
    };

    tick();
    this.intervalId = setInterval(tick, stepDur * 1000);
  }

  stop(): void {
    this.isPlaying = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.ctx && this.masterGain) {
      try {
        this.masterGain.gain.cancelScheduledValues(this.ctx.currentTime);
        this.masterGain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.3);
      } catch { /* ignore */ }
    }
    setTimeout(() => {
      this.oscillators.forEach((o) => { try { o.stop(); } catch { /* ignore */ } });
      this.oscillators = [];
    }, 400);
  }

  setVolume(vol: number): void {
    if (this.ctx && this.masterGain && this.config) {
      const profile = CATEGORY_PROFILES[this.config.category];
      this.masterGain.gain.setValueAtTime(profile.gain * vol, this.ctx.currentTime);
    }
  }

  dispose(): void {
    this.stop();
    if (this.ctx) {
      try { this.ctx.close(); } catch { /* ignore */ }
      this.ctx = null;
      this.masterGain = null;
      this.filter = null;
    }
  }

  get playing(): boolean {
    return this.isPlaying;
  }
}

/**
 * Mix BGM into a video element and produce a new video blob with audio.
 * Uses MediaRecorder + Canvas + AudioContext on web.
 * The BGM is played with the AI-recommended highlight segment aligned
 * to the video's hook moment for maximum impact.
 */
export async function mixBgmIntoVideo(
  videoUri: string,
  bgmTemplateId: string,
  bpm: number,
  durationSec: number,
  highlightStartSec = 5,
  highlightDurationSec = 10,
  energyCurve?: number[],
): Promise<string> {
  if (typeof window === 'undefined' || typeof document === 'undefined') return videoUri;

  try {
    const video = document.createElement('video');
    video.src = videoUri;
    video.crossOrigin = 'anonymous';
    video.muted = false;
    video.volume = 1;
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
    videoGain.gain.value = 1.0;
    videoSource.connect(videoGain);
    videoGain.connect(destination);
    videoGain.connect(audioCtx.destination);

    const bgmPlayer = new BgmPlayer();
    const bgmGain = audioCtx.createGain();
    bgmGain.gain.value = 0.5;
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
    bgmPlayer.start(bgmTemplateId, bpm, highlightStartSec, highlightDurationSec, energyCurve);
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
      bgmPlayer.stop();
    }, stopAt);

    const mixedBlob = await done;
    bgmPlayer.dispose();
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
  category: 'upbeat_pop',
  templateId: 'upbeat_pop',
  label: '트렌디 업비트 팝',
  description: '틱톡 및 릴스에서 가장 인기 있는 경쾌한 리듬의 보컬/악기 믹스',
  bpm: 128,
  reason: '이미지 분석 없이 트렌디 업비트 팝을 기본 추천했습니다.',
  highlightStartSec: 7,
  highlightDurationSec: 8,
  energyCurve: [0.3, 0.5, 0.7, 0.85, 1.0, 0.95, 0.9, 0.85, 0.8, 0.75, 0.7, 0.65, 0.6, 0.55, 0.5],
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
    return data as BgmRecommendation;
  } catch {
    return FALLBACK_RECOMMENDATION;
  }
}

export const BGM_CATEGORY_LABELS: Record<BgmCategory, string> = {
  upbeat_pop: '트렌디 업비트 팝',
  lofi_chill: '감성 로파이 비트',
  acoustic_indie: '어쿠스틱 인디 기타',
  energy_hiphop: '다이나믹 힙합 비트',
};
