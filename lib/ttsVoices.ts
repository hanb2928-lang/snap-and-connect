export interface TtsVoice {
  key: string;
  label: string;
  gender: 'male' | 'female';
  style: 'shopping' | 'announcer';
  desc: string;
  openaiVoice: string;
  speed: number;
}

export const TTS_VOICES: TtsVoice[] = [
  // 남성 - 쇼핑호스트 스타일 (5개)
  { key: 'male_shop_1', label: '열정 호스트', gender: 'male', style: 'shopping', desc: '밝고 에너지 넘치는 쇼핑 호스트', openaiVoice: 'onyx', speed: 1.1 },
  { key: 'male_shop_2', label: '친근 이웃 오빠', gender: 'male', style: 'shopping', desc: '편안하고 친근한 추천 멘트', openaiVoice: 'echo', speed: 1.0 },
  { key: 'male_shop_3', label: '프로 먹방 호스트', gender: 'male', style: 'shopping', desc: '먹방·리빙 전문 호스트 톤', openaiVoice: 'onyx', speed: 1.05 },
  { key: 'male_shop_4', label: '트렌드 픽커', gender: 'male', style: 'shopping', desc: '절친한 트렌드 소개 스타일', openaiVoice: 'echo', speed: 1.1 },
  { key: 'male_shop_5', label: '가성비 달인', gender: 'male', style: 'shopping', desc: '가성비 강조 호스트 멘트', openaiVoice: 'onyx', speed: 1.0 },
  // 남성 - 아나운서 스타일 (5개)
  { key: 'male_ann_1', label: '메인 아나운서', gender: 'male', style: 'announcer', desc: '정통 뉴스 아나운서 톤', openaiVoice: 'onyx', speed: 0.95 },
  { key: 'male_ann_2', label: '다큐멘터리 내레이터', gender: 'male', style: 'announcer', desc: '차분하고 신뢰감 있는 내레이션', openaiVoice: 'echo', speed: 0.9 },
  { key: 'male_ann_3', label: '정보 전달자', gender: 'male', style: 'announcer', desc: '명확하고 정확한 정보 전달', openaiVoice: 'onyx', speed: 0.95 },
  { key: 'male_ann_4', label: '감성 내레이터', gender: 'male', style: 'announcer', desc: '따뜻하고 부드러운 화법', openaiVoice: 'echo', speed: 0.9 },
  { key: 'male_ann_5', label: '시사 프로그램 진행자', gender: 'male', style: 'announcer', desc: '격식 있고 절제된 톤', openaiVoice: 'onyx', speed: 0.92 },
  // 여성 - 쇼핑호스트 스타일 (5개)
  { key: 'female_shop_1', label: '홈쇼핑 여신', gender: 'female', style: 'shopping', desc: '밝고 설레는 홈쇼핑 호스트', openaiVoice: 'shimmer', speed: 1.1 },
  { key: 'female_shop_2', label: '뷰티 픽커 언니', gender: 'female', style: 'shopping', desc: '친근한 뷰티 추천 멘트', openaiVoice: 'alloy', speed: 1.05 },
  { key: 'female_shop_3', label: '라이프 스타일러', gender: 'female', style: 'shopping', desc: '라이프스타일 전문 호스트', openaiVoice: 'shimmer', speed: 1.0 },
  { key: 'female_shop_4', label: '트렌드 헌터', gender: 'female', style: 'shopping', desc: '트렌디한 소개 스타일', openaiVoice: 'alloy', speed: 1.1 },
  { key: 'female_shop_5', label: '프리미엄 호스트', gender: 'female', style: 'shopping', desc: '고급스러운 프리미엄 추천', openaiVoice: 'shimmer', speed: 0.98 },
  // 여성 - 아나운서 스타일 (5개)
  { key: 'female_ann_1', label: '메인 앵커', gender: 'female', style: 'announcer', desc: '정통 뉴스 앵커 톤', openaiVoice: 'alloy', speed: 0.95 },
  { key: 'female_ann_2', label: '다큐 내레이터', gender: 'female', style: 'announcer', desc: '차분하고 깊이 있는 내레이션', openaiVoice: 'shimmer', speed: 0.9 },
  { key: 'female_ann_3', label: '정보 리포터', gender: 'female', style: 'announcer', desc: '명료한 정보 전달 스타일', openaiVoice: 'alloy', speed: 0.95 },
  { key: 'female_ann_4', label: '감성 스토리텔러', gender: 'female', style: 'announcer', desc: '따뜻하고 부드러운 화법', openaiVoice: 'shimmer', speed: 0.9 },
  { key: 'female_ann_5', label: '교양 진행자', gender: 'female', style: 'announcer', desc: '격식 있고 절제된 톤', openaiVoice: 'alloy', speed: 0.92 },
];

export const DEFAULT_TTS_VOICE = 'female_shop_1';

export function getTtsVoiceByKey(key: string): TtsVoice | undefined {
  return TTS_VOICES.find((v) => v.key === key);
}

export function getOpenAiVoiceParams(key: string, speedOverride?: number | null): { voice: string; speed: number } {
  const v = getTtsVoiceByKey(key);
  const baseSpeed = v?.speed ?? 1.0;
  const speed = speedOverride != null ? Math.min(Math.max(speedOverride, 0.5), 2.0) : baseSpeed;
  return { voice: v?.openaiVoice ?? 'alloy', speed };
}
