/**
 * Web Audio API based BGM generator.
 * Creates simple procedural music loops matched to mood and BPM.
 * Works on web platform only — native falls back to no audio.
 */

export type BgmMood = 'urgent' | 'warm' | 'snappy' | 'neutral';

interface BgmConfig {
  bpm: number;
  mood: BgmMood;
}

interface MoodProfile {
  scale: number[];
  baseFreq: number;
  waveType: OscillatorType;
  filterFreq: number;
  gain: number;
}

const MOOD_PROFILES: Record<BgmMood, MoodProfile> = {
  urgent: {
    scale: [0, 3, 5, 7, 10, 12],
    baseFreq: 220,
    waveType: 'sawtooth',
    filterFreq: 1800,
    gain: 0.08,
  },
  warm: {
    scale: [0, 2, 4, 7, 9, 12],
    baseFreq: 261.63,
    waveType: 'sine',
    filterFreq: 1200,
    gain: 0.06,
  },
  snappy: {
    scale: [0, 2, 3, 5, 7, 10],
    baseFreq: 293.66,
    waveType: 'triangle',
    filterFreq: 2400,
    gain: 0.07,
  },
  neutral: {
    scale: [0, 2, 4, 5, 7, 9],
    baseFreq: 261.63,
    waveType: 'sine',
    filterFreq: 1500,
    gain: 0.05,
  },
};

function moodFromTemplateId(templateId: string): BgmMood {
  if (templateId.includes('urgent')) return 'urgent';
  if (templateId.includes('warm')) return 'warm';
  if (templateId.includes('snappy')) return 'snappy';
  return 'neutral';
}

function semitoneToFreq(base: number, semitones: number): number {
  return base * Math.pow(2, semitones / 12);
}

export class BgmPlayer {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private oscillators: OscillatorNode[] = [];
  private filter: BiquadFilterNode | null = null;
  private lfo: OscillatorNode | null = null;
  private lfoGain: GainNode | null = null;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private config: BgmConfig | null = null;
  private isPlaying = false;

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

  start(bgmTemplateId: string, bpm: number): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;
    if (this.isPlaying) this.stop();

    const mood = moodFromTemplateId(bgmTemplateId);
    const profile = MOOD_PROFILES[mood];
    this.config = { bpm, mood };

    try {
      if (ctx.state === 'suspended') ctx.resume();

      this.filter = ctx.createBiquadFilter();
      this.filter.type = 'lowpass';
      this.filter.frequency.value = profile.filterFreq;
      this.filter.Q.value = 1;
      this.filter.connect(this.masterGain);

      this.masterGain.gain.cancelScheduledValues(ctx.currentTime);
      this.masterGain.gain.setValueAtTime(0, ctx.currentTime);
      this.masterGain.gain.linearRampToValueAtTime(profile.gain, ctx.currentTime + 0.5);

      const beatSec = 60 / bpm;
      const pattern = this.buildNotePattern(profile, beatSec);
      this.scheduleLoop(ctx, pattern, beatSec);

      this.isPlaying = true;
    } catch {
      this.stop();
    }
  }

  private buildNotePattern(profile: MoodProfile, beatSec: number): number[] {
    const notes: number[] = [];
    const stepsPerBeat = 2;
    const totalSteps = 16;
    for (let i = 0; i < totalSteps; i++) {
      if (i % stepsPerBeat === 0) {
        const scaleIdx = Math.floor(Math.random() * profile.scale.length);
        notes.push(profile.scale[scaleIdx]);
      } else if (Math.random() > 0.6) {
        const scaleIdx = Math.floor(Math.random() * profile.scale.length);
        notes.push(profile.scale[scaleIdx]);
      } else {
        notes.push(-1);
      }
    }
    return notes;
  }

  private scheduleLoop(ctx: AudioContext, notes: number[], beatSec: number): void {
    const stepDur = beatSec / 2;
    let step = 0;

    const playNote = (semiTones: number, time: number, duration: number) => {
      if (!this.filter || semiTones < 0) return;
      const freq = semitoneToFreq(this.config ? MOOD_PROFILES[this.config.mood].baseFreq : 261.63, semiTones);
      const osc = ctx.createOscillator();
      const noteGain = ctx.createGain();
      osc.type = MOOD_PROFILES[this.config?.mood ?? 'neutral'].waveType;
      osc.frequency.value = freq;
      noteGain.gain.setValueAtTime(0, time);
      noteGain.gain.linearRampToValueAtTime(0.7, time + 0.02);
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

    const tick = () => {
      if (!this.isPlaying || !this.config) return;
      const now = ctx.currentTime;
      const note = notes[step % notes.length];
      if (note >= 0) playNote(note, now, stepDur * 1.5);
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
      const profile = MOOD_PROFILES[this.config.mood];
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
 * Returns a new video URI (blob URL) with BGM mixed in, or the original URI if mixing fails.
 */
export async function mixBgmIntoVideo(
  videoUri: string,
  bgmTemplateId: string,
  bpm: number,
  durationSec: number,
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
    bgmPlayer.start(bgmTemplateId, bpm);
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
