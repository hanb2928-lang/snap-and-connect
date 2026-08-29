export type EmotionPhase = 'doubt' | 'surprise' | 'conviction';

export interface EmotionSegment {
  phase: EmotionPhase;
  startSec: number;
  endSec: number;
  speed: number;
  pitch: number;
  pauseSec: number;
  styleExaggeration: number;
  description: string;
}

export interface EmotionCurve {
  segments: EmotionSegment[];
  totalDurationSec: number;
  voiceCloningReady: boolean;
}

export const EMOTION_PHASES: Record<EmotionPhase, Omit<EmotionSegment, 'startSec' | 'endSec'>> = {
  doubt: {
    phase: 'doubt',
    speed: 1.1,
    pitch: 1.05,
    pauseSec: 0,
    styleExaggeration: 0,
    description: '의구심 — 호기심 자극을 위한 약간 빠른 속도와 상승 톤',
  },
  surprise: {
    phase: 'surprise',
    speed: 0.95,
    pitch: 0.92,
    pauseSec: 0.3,
    styleExaggeration: 0.05,
    description: '놀람 — 0.3초 쉼표 후 낮아지는 톤으로 진지함과 공감 유발',
  },
  conviction: {
    phase: 'conviction',
    speed: 1.05,
    pitch: 1.0,
    pauseSec: 0,
    styleExaggeration: 0.15,
    description: '확신 — 스타일 강조 +15% 또렷한 톤으로 구매 욕구 자극',
  },
};

export function generateEmotionCurve(totalDurationSec: number): EmotionCurve {
  const openingEnd = Math.min(3, totalDurationSec * 0.25);
  const problemEnd = Math.min(7, totalDurationSec * 0.6);
  const finalEnd = totalDurationSec;

  return {
    segments: [
      {
        ...EMOTION_PHASES.doubt,
        startSec: 0,
        endSec: openingEnd,
      },
      {
        ...EMOTION_PHASES.surprise,
        startSec: openingEnd,
        endSec: problemEnd,
      },
      {
        ...EMOTION_PHASES.conviction,
        startSec: problemEnd,
        endSec: finalEnd,
      },
    ],
    totalDurationSec,
    voiceCloningReady: false,
  };
}

export function getEmotionParamsAtTime(curve: EmotionCurve, timeSec: number): EmotionSegment | null {
  return curve.segments.find((s) => timeSec >= s.startSec && timeSec < s.endSec) ?? null;
}

export function buildTtsInstructionsForPhase(
  phase: EmotionPhase,
  baseInstructions?: string,
): string {
  const phaseConfig = EMOTION_PHASES[phase];
  const phaseGuide: Record<EmotionPhase, string> = {
    doubt: 'Start with a questioning, curious tone. Speak slightly faster with a rising pitch as if wondering about something. Engage the listener\'s curiosity.',
    surprise: 'Shift to a more serious, empathetic tone. Add a brief pause (0.3s) before key points. Lower your pitch slightly to convey sincerity and genuine surprise.',
    conviction: 'End with confident, clear conviction. Increase style exaggeration by about 15%. Speak clearly and persuasively to drive action.',
  };

  const parts = [phaseGuide[phase]];
  if (baseInstructions) {
    parts.push(baseInstructions);
  }
  return parts.join('\n');
}

export interface TtsSegmentRequest {
  text: string;
  voice: string;
  speed: number;
  instructions: string;
  startSec: number;
  endSec: number;
}

export function splitTextForEmotionCurve(
  fullText: string,
  curve: EmotionCurve,
  voice: string,
  baseInstructions?: string,
): TtsSegmentRequest[] {
  const sentences = fullText.split(/(?<=[.!?。！？])\s+/).filter((s) => s.trim());
  const totalChars = sentences.reduce((sum, s) => sum + s.length, 0) || 1;
  let charAccum = 0;

  return curve.segments.map((segment) => {
    const startRatio = segment.startSec / curve.totalDurationSec;
    const endRatio = segment.endSec / curve.totalDurationSec;
    const startChar = Math.floor(startRatio * totalChars);
    const endChar = Math.floor(endRatio * totalChars);

    const segmentSentences: string[] = [];
    let charCount = 0;
    for (const sentence of sentences) {
      if (charCount >= startChar && charCount < endChar) {
        segmentSentences.push(sentence);
      }
      charCount += sentence.length;
    }

    charAccum += segmentSentences.join(' ').length;

    return {
      text: segmentSentences.join(' ') || fullText.slice(startChar, endChar),
      voice,
      speed: segment.speed,
      instructions: buildTtsInstructionsForPhase(segment.phase, baseInstructions),
      startSec: segment.startSec,
      endSec: segment.endSec,
    };
  });
}

export function enableVoiceCloning(curve: EmotionCurve): EmotionCurve {
  return { ...curve, voiceCloningReady: true };
}

export function getPhaseLabel(phase: EmotionPhase): string {
  const labels: Record<EmotionPhase, string> = {
    doubt: '의구심',
    surprise: '놀람',
    conviction: '확신',
  };
  return labels[phase];
}

export function getPhaseEmoji(phase: EmotionPhase): string {
  const emojis: Record<EmotionPhase, string> = {
    doubt: '🤔',
    surprise: '😱',
    conviction: '💪',
  };
  return emojis[phase];
}
