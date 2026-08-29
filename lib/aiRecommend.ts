import { fetchStyleRecommendation, type StyleRecommendation } from '@/lib/styleRecommend';
import { resolveHybridTemplate, type HybridTemplateResult } from '@/lib/hybridTemplate';
import { getTtsVoiceByKey, type VoiceCategory, type TtsVoice } from '@/lib/ttsVoices';

export interface AiRecommendBundle {
  style: StyleRecommendation;
  template: HybridTemplateResult;
  voice: TtsVoice;
  templateLabel: string;
  summary: string;
}

function pickVoiceCategory(style: StyleRecommendation, category: string): VoiceCategory {
  const cat = (category || '').toLowerCase();
  if (style.cardStyle === 'bold') return 'viral';
  if (style.cardStyle === 'magazine') return 'narration';
  if (style.musicMood === 'calm' || style.musicMood === 'emotional') return 'narration';
  if (cat.includes('beauty') || cat.includes('fashion') || cat.includes('뷰티') || cat.includes('패션')) return 'bright';
  if (cat.includes('tech') || cat.includes('electronic') || cat.includes('전자') || cat.includes('가전')) return 'viral';
  return 'bright';
}

function mapStyleToTemplateLabel(style: StyleRecommendation): string {
  if (style.hybridMode === 'photo-to-comic') return '웹툰형 만화';
  if (style.format === 'horizontal') return '카드뉴스';
  return '숏폼 영상';
}

export async function fetchAiRecommendBundle(params: {
  productName: string;
  productCategory: string;
  accentColor?: string;
  hook?: string;
  oneLiner?: string;
  platform?: string;
  fallbackHashtags?: string[];
}): Promise<AiRecommendBundle> {
  const [style, template] = await Promise.all([
    fetchStyleRecommendation({
      productName: params.productName,
      productCategory: params.productCategory,
      accentColor: params.accentColor,
      hook: params.hook,
      oneLiner: params.oneLiner,
      platform: params.platform,
    }),
    resolveHybridTemplate({
      category: params.productCategory,
      platform: params.platform,
      productName: params.productName,
      fallbackHook: params.hook,
      fallbackHashtags: params.fallbackHashtags,
      fallbackAccentColor: params.accentColor,
    }),
  ]);

  const voiceCategory = pickVoiceCategory(style, params.productCategory);
  const voices = { bright: 'bright_female_1', narration: 'narration_female_1', viral: 'viral_female_1' } as const;
  const voice = getTtsVoiceByKey(voices[voiceCategory])!;

  const templateLabel = mapStyleToTemplateLabel(style);
  const summary = `${templateLabel} · ${style.cardStyle} 스타일 · ${style.musicMood} BGM · ${voice.label} 내레이션 · ${style.duration}초`;

  return { style, template, voice, templateLabel, summary };
}
