import { Platform } from 'react-native';

export interface OnDeviceTtsResult {
  audioUrl: string | null;
  usedFallback: boolean;
  message: string;
}

/**
 * On-Device TTS via Web Speech API (browser) or platform speech.
 *
 * When the external TTS API (OpenAI) is unavailable or too expensive,
 * this generates speech locally at zero cost. The audio quality is
 * simpler than neural TTS but sufficient for draft previews.
 */

let currentUtterance: SpeechSynthesisUtterance | null = null;

export function isOnDeviceTtsAvailable(): boolean {
  if (Platform.OS !== 'web') return false;
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

/**
 * Speak text using the browser's built-in speech synthesis.
 * Returns immediately — the audio plays through the browser.
 * Does NOT produce a downloadable file (Web Speech API limitation).
 */
export function speakOnDevice(
  text: string,
  options?: {
    rate?: number;
    pitch?: number;
    voiceURI?: string;
    onEnd?: () => void;
    onError?: (err: string) => void;
  },
): boolean {
  if (!isOnDeviceTtsAvailable()) return false;

  try {
    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);

    // Korean language hint
    utterance.lang = 'ko-KR';

    // Human-like prosody: rate jitter (±0.08) + pitch variation (±0.04)
    // to avoid the flat, mechanical cadence of default browser TTS
    const baseRate = options?.rate ?? 1.0;
    const rateJitter = (Math.random() - 0.5) * 0.16;
    utterance.rate = Math.min(Math.max(baseRate + rateJitter, 0.5), 2.0);
    const basePitch = options?.pitch ?? 1.0;
    const pitchJitter = (Math.random() - 0.5) * 0.08;
    utterance.pitch = Math.min(Math.max(basePitch + pitchJitter, 0.0), 2.0);

    // Try to find a Korean voice
    const voices = window.speechSynthesis.getVoices();
    if (options?.voiceURI) {
      const match = voices.find((v) => v.voiceURI === options.voiceURI);
      if (match) utterance.voice = match;
    } else {
      const koreanVoice = voices.find((v) => v.lang.startsWith('ko'));
      if (koreanVoice) utterance.voice = koreanVoice;
    }

    if (options?.onEnd) utterance.onend = options.onEnd;
    if (options?.onError) utterance.onerror = () => options.onError?.('Speech synthesis failed');

    currentUtterance = utterance;
    window.speechSynthesis.speak(utterance);
    return true;
  } catch {
    return false;
  }
}

export function stopOnDeviceTts(): void {
  if (isOnDeviceTtsAvailable()) {
    window.speechSynthesis.cancel();
    currentUtterance = null;
  }
}

/**
 * Get available on-device voices, filtered to Korean if possible.
 */
export function getOnDeviceVoices(): SpeechSynthesisVoice[] {
  if (!isOnDeviceTtsAvailable()) return [];
  return window.speechSynthesis.getVoices();
}

/**
 * Try on-device TTS first. If unavailable, the caller should
 * fall back to the external API.
 */
export async function tryOnDeviceTts(
  text: string,
  options?: {
    rate?: number;
    pitch?: number;
    voiceURI?: string;
  },
): Promise<OnDeviceTtsResult> {
  if (!isOnDeviceTtsAvailable()) {
    return {
      audioUrl: null,
      usedFallback: false,
      message: 'On-device TTS is not available on this platform.',
    };
  }

  const success = speakOnDevice(text, options);
  if (success) {
    return {
      audioUrl: null, // Web Speech API doesn't produce a URL
      usedFallback: true,
      message: '온디바이스 음성으로 재생 중입니다. 다운로드가 필요하면 AI 음성을 사용하세요.',
    };
  }

  return {
    audioUrl: null,
    usedFallback: false,
    message: '온디바이스 음성 생성에 실패했습니다.',
  };
}
