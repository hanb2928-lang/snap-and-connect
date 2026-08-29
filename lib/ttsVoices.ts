export type VoiceCategory = 'bright' | 'narration' | 'viral';

export interface TtsVoice {
  key: string;
  label: string;
  gender: 'male' | 'female';
  style: 'shopping' | 'announcer';
  category: VoiceCategory;
  desc: string;
  openaiVoice: string;
  speed: number;
  instructions?: string;
}

export const VOICE_CATEGORIES: Record<VoiceCategory, { label: string; desc: string }> = {
  bright: {
    label: '밝고 경쾌한 20대 남/녀',
    desc: '일반적인 제휴 상품 리뷰용',
  },
  narration: {
    label: '차분한 톤 / 나레이션',
    desc: 'Premium 브랜딩용',
  },
  viral: {
    label: 'B급 억양 / 사투리 톤',
    desc: '바이럴 숏폼용',
  },
};

export const TTS_VOICES: TtsVoice[] = [
  // 밝고 경쾌한 20대 남/녀 — 일반 제휴 상품 리뷰용
  { key: 'bright_female_1', label: '밝은 20대 여성', gender: 'female', style: 'shopping', category: 'bright', desc: '밝고 경쾌한 20대 여성 톤', openaiVoice: 'shimmer', speed: 1.1, instructions: 'Speak in a bright, cheerful, energetic tone like a friendly 20-something Korean woman reviewing a product.' },
  { key: 'bright_female_2', label: '활발한 뷰티 언니', gender: 'female', style: 'shopping', category: 'bright', desc: '친근한 뷰티 추천 멘트', openaiVoice: 'alloy', speed: 1.05, instructions: 'Speak in a lively, friendly tone like a beauty influencer recommending products.' },
  { key: 'bright_male_1', label: '열정 호스트', gender: 'male', style: 'shopping', category: 'bright', desc: '밝고 에너지 넘치는 쇼핑 호스트', openaiVoice: 'onyx', speed: 1.1, instructions: 'Speak in an energetic, enthusiastic tone like a shopping show host.' },
  { key: 'bright_male_2', label: '친근 이웃 오빠', gender: 'male', style: 'shopping', category: 'bright', desc: '편안하고 친근한 추천 멘트', openaiVoice: 'echo', speed: 1.0, instructions: 'Speak in a warm, friendly tone like a neighbor recommending a good find.' },

  // 차분한 톤 / 나레이션 — Premium 브랜딩용
  { key: 'narration_female_1', label: '감성 스토리텔러', gender: 'female', style: 'announcer', category: 'narration', desc: '따뜻하고 부드러운 화법', openaiVoice: 'shimmer', speed: 0.9, instructions: 'Speak in a calm, warm, emotional tone like a premium brand narrator.' },
  { key: 'narration_female_2', label: '다큐 내레이터', gender: 'female', style: 'announcer', category: 'narration', desc: '차분하고 깊이 있는 내레이션', openaiVoice: 'shimmer', speed: 0.88, instructions: 'Speak in a deep, calm, documentary-style narration tone.' },
  { key: 'narration_male_1', label: '다큐멘터리 내레이터', gender: 'male', style: 'announcer', category: 'narration', desc: '차분하고 신뢰감 있는 내레이션', openaiVoice: 'echo', speed: 0.9, instructions: 'Speak in a calm, trustworthy documentary narrator tone.' },
  { key: 'narration_male_2', label: '메인 아나운서', gender: 'male', style: 'announcer', category: 'narration', desc: '정통 뉴스 아나운서 톤', openaiVoice: 'onyx', speed: 0.95, instructions: 'Speak in a clear, professional news anchor tone with measured pace.' },

  // B급 억양 / 사투리 톤 — 바이럴 숏폼용
  { key: 'viral_female_1', label: '사투리 언니', gender: 'female', style: 'shopping', category: 'viral', desc: '경상도 사투리 바이럴 톤', openaiVoice: 'shimmer', speed: 1.15, instructions: 'Speak in an exaggerated, funny Busan/Kyeongsang dialect tone, like a viral short-form comedy. Add dramatic emphasis and quirky intonation.' },
  { key: 'viral_female_2', label: 'B급 텐션 언니', gender: 'female', style: 'shopping', category: 'viral', desc: '과장된 B급 호쾌한 톤', openaiVoice: 'alloy', speed: 1.2, instructions: 'Speak in an exaggerated, over-the-top comedic tone with high energy and dramatic pauses, like a viral meme video.' },
  { key: 'viral_male_1', label: 'B급 텐션 형', gender: 'male', style: 'shopping', category: 'viral', desc: '과장된 B급 호쾌한 톤', openaiVoice: 'echo', speed: 1.15, instructions: 'Speak in an exaggerated, boisterous comedic tone with dramatic emphasis, like a viral short-form comedian.' },
  { key: 'viral_male_2', label: '사투리 형', gender: 'male', style: 'shopping', category: 'viral', desc: '경상도 사투리 바이럴 톤', openaiVoice: 'onyx', speed: 1.1, instructions: 'Speak in an exaggerated, funny Busan/Kyeongsang dialect tone with high energy, like a viral comedy sketch.' },
];

export const DEFAULT_TTS_VOICE = 'bright_female_1';

export function getTtsVoiceByKey(key: string): TtsVoice | undefined {
  return TTS_VOICES.find((v) => v.key === key);
}

export function getVoicesByCategory(category: VoiceCategory): TtsVoice[] {
  return TTS_VOICES.filter((v) => v.category === category);
}

export function getOpenAiVoiceParams(key: string, speedOverride?: number | null): { voice: string; speed: number; instructions?: string } {
  const v = getTtsVoiceByKey(key);
  const baseSpeed = v?.speed ?? 1.0;
  const speed = speedOverride != null ? Math.min(Math.max(speedOverride, 0.5), 2.0) : baseSpeed;
  return { voice: v?.openaiVoice ?? 'alloy', speed, instructions: v?.instructions };
}

export interface MultilingualVoice {
  code: string;
  label: string;
  nativeName: string;
  openaiVoice: string;
  instructions: string;
}

export const MULTILINGUAL_VOICES: MultilingualVoice[] = [
  { code: 'en', label: 'English', nativeName: 'English', openaiVoice: 'alloy', instructions: 'Speak in a natural, engaging American English tone like a social media influencer reviewing a product.' },
  { code: 'ja', label: '日本語', nativeName: '日本語', openaiVoice: 'nova', instructions: 'Speak in a natural, energetic Japanese tone like a TikTok creator reviewing a product.' },
  { code: 'zh', label: '中文', nativeName: '中文', openaiVoice: 'echo', instructions: 'Speak in a natural, engaging Mandarin Chinese tone like a social media product reviewer.' },
  { code: 'es', label: 'Español', nativeName: 'Español', openaiVoice: 'shimmer', instructions: 'Speak in a natural, energetic Latin American Spanish tone like a product reviewer on TikTok.' },
  { code: 'vi', label: 'Tiếng Việt', nativeName: 'Tiếng Việt', openaiVoice: 'alloy', instructions: 'Speak in a natural, engaging Vietnamese tone like a TikTok product reviewer.' },
  { code: 'th', label: 'ภาษาไทย', nativeName: 'ภาษาไทย', openaiVoice: 'nova', instructions: 'Speak in a natural, friendly Thai tone like a social media product reviewer.' },
  { code: 'id', label: 'Bahasa', nativeName: 'Bahasa Indonesia', openaiVoice: 'echo', instructions: 'Speak in a natural, engaging Indonesian tone like a TikTok product reviewer.' },
  { code: 'pt', label: 'Português', nativeName: 'Português', openaiVoice: 'shimmer', instructions: 'Speak in a natural, energetic Brazilian Portuguese tone like a product reviewer on TikTok.' },
  { code: 'fr', label: 'Français', nativeName: 'Français', openaiVoice: 'alloy', instructions: 'Speak in a natural, engaging French tone like a social media product reviewer.' },
  { code: 'de', label: 'Deutsch', nativeName: 'Deutsch', openaiVoice: 'echo', instructions: 'Speak in a natural, clear German tone like a product reviewer on social media.' },
  { code: 'ar', label: 'العربية', nativeName: 'العربية', openaiVoice: 'nova', instructions: 'Speak in a natural, engaging Modern Standard Arabic tone like a social media product reviewer.' },
  { code: 'hi', label: 'हिन्दी', nativeName: 'हिन्दी', openaiVoice: 'shimmer', instructions: 'Speak in a natural, energetic Hindi tone like a TikTok product reviewer in India.' },
];

export function getMultilingualVoice(code: string): MultilingualVoice | undefined {
  return MULTILINGUAL_VOICES.find((v) => v.code === code);
}
