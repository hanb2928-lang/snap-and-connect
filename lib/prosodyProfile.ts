/**
 * Prosody Profile System
 *
 * Captures a speaker's vocal characteristics as a structured vector.
 * Instead of ML-based voice cloning (which requires GPU clusters),
 * this system uses OpenAI TTS `instructions` parameter to encode
 * prosody features: speech rate, stress pattern, intonation contour,
 * micro-pause distribution, and breath frequency.
 */

export interface ProsodyVector {
  baseSpeed: number;
  speedVariation: number;
  stressIntensity: number;
  intonationRange: number;
  microPauseFrequency: number;
  microPauseDurationSec: number;
  breathMarkerFrequency: number;
  warmth: number;
  clarity: number;
}

export interface ProsodyProfile {
  id: string;
  label: string;
  vector: ProsodyVector;
  baseInstructions: string;
}

const PROSODY_PRESETS: Record<string, ProsodyProfile> = {
  energetic_reviewer: {
    id: 'energetic_reviewer',
    label: '에너제틱 리뷰어',
    vector: {
      baseSpeed: 1.1,
      speedVariation: 0.12,
      stressIntensity: 0.7,
      intonationRange: 0.6,
      microPauseFrequency: 0.3,
      microPauseDurationSec: 0.15,
      breathMarkerFrequency: 0.15,
      warmth: 0.5,
      clarity: 0.8,
    },
    baseInstructions: 'Speak with high energy and enthusiasm. Vary your pace dynamically — faster for exciting features, slower for key benefits. Add natural emphasis on product names and price points.',
  },
  trustworthy_narrator: {
    id: 'trustworthy_narrator',
    label: '신뢰감 내레이터',
    vector: {
      baseSpeed: 0.92,
      speedVariation: 0.06,
      stressIntensity: 0.4,
      intonationRange: 0.3,
      microPauseFrequency: 0.45,
      microPauseDurationSec: 0.25,
      breathMarkerFrequency: 0.2,
      warmth: 0.7,
      clarity: 0.9,
    },
    baseInstructions: 'Speak in a calm, measured, trustworthy tone. Pause deliberately between key points. Let each sentence land before moving to the next. Convey sincerity and expertise.',
  },
  viral_comedian: {
    id: 'viral_comedian',
    label: '바이럴 코미디',
    vector: {
      baseSpeed: 1.18,
      speedVariation: 0.18,
      stressIntensity: 0.85,
      intonationRange: 0.8,
      microPauseFrequency: 0.25,
      microPauseDurationSec: 0.1,
      breathMarkerFrequency: 0.1,
      warmth: 0.3,
      clarity: 0.6,
    },
    baseInstructions: 'Speak with exaggerated, over-the-top energy. Use dramatic emphasis and sudden pace changes. Make it feel like a viral short-form comedy — punchy, fun, and attention-grabbing.',
  },
  intimate_whisper: {
    id: 'intimate_whisper',
    label: '친밀한 속삭임',
    vector: {
      baseSpeed: 0.95,
      speedVariation: 0.08,
      stressIntensity: 0.3,
      intonationRange: 0.25,
      microPauseFrequency: 0.5,
      microPauseDurationSec: 0.3,
      breathMarkerFrequency: 0.3,
      warmth: 0.9,
      clarity: 0.7,
    },
    baseInstructions: 'Speak softly and intimately, as if sharing a secret with a close friend. Use warm, breathy tones. Pause frequently to create anticipation and closeness.',
  },
};

export function getProsodyProfile(id: string): ProsodyProfile {
  return PROSODY_PRESETS[id] ?? PROSODY_PRESETS.energetic_reviewer;
}

export function getAllProsodyProfiles(): ProsodyProfile[] {
  return Object.values(PROSODY_PRESETS);
}

export function mapVoiceKeyToProsody(voiceKey: string): ProsodyProfile {
  if (voiceKey.startsWith('viral')) return PROSODY_PRESETS.viral_comedian;
  if (voiceKey.startsWith('narration')) return PROSODY_PRESETS.trustworthy_narrator;
  if (voiceKey.includes('whisper') || voiceKey.includes('intimate')) return PROSODY_PRESETS.intimate_whisper;
  return PROSODY_PRESETS.energetic_reviewer;
}

export function applySpeedJitter(baseSpeed: number, variation: number): number {
  const jitter = (Math.random() - 0.5) * 2 * variation;
  return Math.min(Math.max(baseSpeed + jitter, 0.5), 2.0);
}

export function buildProsodyInstructions(
  profile: ProsodyProfile,
  contextModifiers?: {
    increaseWarmth?: boolean;
    increaseClarity?: boolean;
    increaseEnergy?: boolean;
  },
): string {
  const v = profile.vector;
  const parts: string[] = [profile.baseInstructions];

  if (contextModifiers?.increaseWarmth || v.warmth >= 0.8) {
    parts.push('Add extra warmth and breathiness to your voice.');
  }
  if (contextModifiers?.increaseClarity || v.clarity >= 0.85) {
    parts.push('Enunciate each word with crisp clarity.');
  }
  if (contextModifiers?.increaseEnergy || (v.stressIntensity >= 0.7 && v.baseSpeed >= 1.1)) {
    parts.push('Inject bursts of energy on key phrases.');
  }
  if (v.microPauseFrequency >= 0.4) {
    parts.push('Insert natural micro-pauses between clauses to mimic thoughtful speech.');
  }

  return parts.join(' ');
}

export function getProsodyAdjustedSpeed(
  profile: ProsodyProfile,
  phaseSpeed: number,
): number {
  const blended = profile.vector.baseSpeed * 0.3 + phaseSpeed * 0.7;
  return applySpeedJitter(blended, profile.vector.speedVariation);
}

export function insertBreathMarkers(text: string, frequency: number): string {
  if (frequency <= 0) return text;
  const sentences = text.split(/(?<=[.!?。！？])\s+/);
  const result: string[] = [];
  for (let i = 0; i < sentences.length; i++) {
    result.push(sentences[i]);
    if (i < sentences.length - 1 && Math.random() < frequency) {
      result.push('... ');
    }
  }
  return result.join(' ');
}

export function insertMicroPauses(text: string, frequency: number, _durationSec: number): string {
  if (frequency <= 0) return text;
  const clauses = text.split(/,\s*/);
  if (clauses.length <= 1) return text;
  const result: string[] = [];
  for (let i = 0; i < clauses.length; i++) {
    result.push(clauses[i]);
    if (i < clauses.length - 1 && Math.random() < frequency) {
      result.push(', ');
    } else if (i < clauses.length - 1) {
      result.push(', ');
    }
  }
  return result.join('');
}
