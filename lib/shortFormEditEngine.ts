import { PLATFORM_SPECS, getPlatformSpec, type PlatformSpec, type SafeZoneRect } from '@/lib/platformSpecs';
import { getDisclosureForPlatforms, getDisclosureShortForPlatforms } from '@/lib/disclosure';
import { type EmotionPhase } from '@/lib/psychologyEngine';

export type ShortFormPlatform = 'instagram' | 'tiktok' | 'youtube' | 'naver_clip';

interface PlatformMapEntry {
  specKey: Parameters<typeof getPlatformSpec>[0];
  label: string;
}

const PLATFORM_MAP: Record<ShortFormPlatform, PlatformMapEntry> = {
  instagram: { specKey: 'reels', label: '인스타그램 릴스' },
  tiktok: { specKey: 'tiktok', label: '틱톡' },
  youtube: { specKey: 'shorts', label: '유튜브 쇼츠' },
  naver_clip: { specKey: 'naverclip', label: '네이버 클립' },
};

export interface HookOption {
  id: number;
  text: string;
  psychology: string;
  emotion: EmotionPhase;
}

const PSYCHOLOGY_TRIGGERS: Record<EmotionPhase, { label: string; templates: string[] }> = {
  curiosity: {
    label: '정보 갭 자극',
    templates: [
      '이거 모르면 손해인데?',
      '알 사람은 다 아는 그 집',
      '잠깐, 이거 진짜야?',
    ],
  },
  shock: {
    label: '손실 회피 역전',
    templates: [
      '지금 안 보면 품절',
      '이 가격 실화?',
      '매진 직전이라는데',
    ],
  },
  empathy: {
    label: '거울 뉴런 활성화',
    templates: [
      '이거 쓰는 분들 공감 100%',
      '나만 몰랐던 꿀템',
      '쓰면 진짜 편해요',
    ],
  },
  desire: {
    label: '즉각적 보상 추구',
    templates: [
      '단 15초 만에 해결',
      '이거 사면 삶이 바뀜',
      '왜 이제야 알았지?',
    ],
  },
  action: {
    label: '사회적 증거 폭발',
    templates: [
      '다들 사니까 나도',
      '리뷰 수 폭발 중',
      '이미 10만 명이 선택',
    ],
  },
};

export function generateHookOptions(customPrompt: string, productName?: string): HookOption[] {
  const pName = productName?.trim() || '이 제품';
  const nameShort = pName.length > 10 ? pName.slice(0, 10) + '...' : pName;

  const promptLower = customPrompt.toLowerCase();
  let preferredEmotions: EmotionPhase[] = ['curiosity', 'shock', 'desire'];

  if (promptLower.includes('할인') || promptLower.includes('재고') || promptLower.includes('품절')) {
    preferredEmotions = ['shock', 'action', 'desire'];
  } else if (promptLower.includes('공감') || promptLower.includes('일상') || promptLower.includes('꿀템')) {
    preferredEmotions = ['empathy', 'curiosity', 'desire'];
  } else if (promptLower.includes('빠른') || promptLower.includes('해결') || promptLower.includes('꿀팁')) {
    preferredEmotions = ['desire', 'curiosity', 'action'];
  }

  const hooks: HookOption[] = [];
  const usedTexts = new Set<string>();

  for (const emotion of preferredEmotions) {
    const trigger = PSYCHOLOGY_TRIGGERS[emotion];
    for (const template of trigger.templates) {
      if (hooks.length >= 3) break;
      let text = template.replace('이거', nameShort);
      if (customPrompt.trim()) {
        const promptHint = customPrompt.trim().split(/[,.]/)[0].trim();
        if (promptHint.length <= 15) {
          text = `${text} · ${promptHint}`;
        }
      }
      if (!usedTexts.has(text)) {
        usedTexts.add(text);
        hooks.push({
          id: hooks.length + 1,
          text,
          psychology: trigger.label,
          emotion,
        });
      }
    }
  }

  while (hooks.length < 3) {
    const fallbackEmotions: EmotionPhase[] = ['curiosity', 'shock', 'empathy'];
    const emotion = fallbackEmotions[hooks.length];
    const trigger = PSYCHOLOGY_TRIGGERS[emotion];
    const template = trigger.templates[hooks.length % trigger.templates.length];
    const text = template.replace('이거', nameShort);
    if (!usedTexts.has(text)) {
      usedTexts.add(text);
      hooks.push({ id: hooks.length + 1, text, psychology: trigger.label, emotion });
    } else {
      hooks.push({ id: hooks.length + 1, text: `${text}!`, psychology: trigger.label, emotion });
    }
  }

  return hooks.slice(0, 3);
}

export interface DisclosureOverlayPlan {
  startSec: number;
  endSec: number;
  durationSec: number;
  text: string;
  shortText: string;
  position: 'bottom-center' | 'top-center';
  fontSize: number;
  bgOpacity: number;
}

export interface BgmTemplate {
  id: string;
  label: string;
  mood: string;
  bpm: number;
}

export interface AutoEnhancement {
  id: 'safe_zone_crop' | 'hook_overlay' | 'bgm_sync';
  label: string;
  description: string;
  icon: string;
}

export interface ShortFormEditPlan {
  platform: ShortFormPlatform;
  platformLabel: string;
  spec: PlatformSpec | undefined;
  safeZone: SafeZoneRect | undefined;
  totalDurationSec: number;
  hookOptions: HookOption[];
  selectedHook: string | null;
  customPrompt: string;
  segments: EditSegment[];
  disclosureOverlay: DisclosureOverlayPlan;
  disclosureEnabled: boolean;
  captionStyle: string;
  pacingBpm: number;
  bgmTemplate: BgmTemplate;
  autoEnhancements: AutoEnhancement[];
}

export interface EditSegment {
  index: number;
  startSec: number;
  endSec: number;
  label: string;
  purpose: string;
  textOverlay: string;
  position: 'top' | 'center' | 'bottom';
}

export function getPlatformInfo(platform: ShortFormPlatform) {
  const entry = PLATFORM_MAP[platform];
  const spec = getPlatformSpec(entry.specKey);
  const safeZone = spec ? { top: spec.safeZoneTop, bottom: spec.safeZoneBottom, left: spec.safeZoneSides, right: spec.safeZoneSides } : undefined;
  return { label: entry.label, spec, safeZone };
}

export function buildShortFormEditPlan(
  platform: ShortFormPlatform,
  customPrompt: string,
  selectedHook: string | null,
  productName?: string,
  affiliatePlatforms: string[] = [],
  autoDisclosure = true,
  disclosureEnabled = false,
): ShortFormEditPlan {
  const { label, spec, safeZone } = getPlatformInfo(platform);
  const totalDurationSec = 15;
  const hookOptions = generateHookOptions(customPrompt, productName);
  const hook = selectedHook || hookOptions[0]?.text || '';

  const segments: EditSegment[] = [
    { index: 0, startSec: 0, endSec: 3, label: '후킹', purpose: '시청자 이탈 방지', textOverlay: hook, position: 'center' },
    { index: 1, startSec: 3, endSec: 7, label: '제품 소개', purpose: '핵심 가치 전달', textOverlay: productName || '제품 소개', position: 'top' },
    { index: 2, startSec: 7, endSec: 11, label: '사용/혜택', purpose: '체감 효과 시각화', textOverlay: customPrompt.trim() || '지금 확인하세요', position: 'center' },
    { index: 3, startSec: 11, endSec: 13, label: 'CTA', purpose: '행동 유도', textOverlay: '프로필 링크에서 확인', position: 'bottom' },
  ];

  const disclosureText = getDisclosureForPlatforms(affiliatePlatforms, autoDisclosure && disclosureEnabled);
  const disclosureShort = getDisclosureShortForPlatforms(affiliatePlatforms, autoDisclosure && disclosureEnabled);

  const disclosureOverlay: DisclosureOverlayPlan = {
    startSec: 13,
    endSec: 15,
    durationSec: 2,
    text: disclosureEnabled ? (disclosureText || '본 영상은 광고/협찬/업체 지원을 받아 제작되었습니다.') : '',
    shortText: disclosureEnabled ? (disclosureShort || '광고·협찬 포함') : '',
    position: 'bottom-center',
    fontSize: 14,
    bgOpacity: 0.75,
  };

  const pacingBpm = platform === 'tiktok' ? 140 : platform === 'youtube' ? 90 : platform === 'naver_clip' ? 110 : 100;

  const bgmTemplate: BgmTemplate = (() => {
    const promptLower = customPrompt.toLowerCase();
    if (promptLower.includes('할인') || promptLower.includes('재고') || promptLower.includes('매진') || promptLower.includes('품절')) {
      return { id: 'urgent_upbeat', label: '업비트 긴장감', mood: '긴박·액션', bpm: pacingBpm };
    }
    if (promptLower.includes('감성') || promptLower.includes('따뜻') || promptLower.includes('힐링') || promptLower.includes('일상')) {
      return { id: 'warm_acoustic', label: '따뜻한 어쿠스틱', mood: '감성·일상', bpm: Math.round(pacingBpm * 0.7) };
    }
    if (promptLower.includes('빠른') || promptLower.includes('꿀팁') || promptLower.includes('해결')) {
      return { id: 'snappy_pop', label: '스내피 팝', mood: '경쾌·정보', bpm: pacingBpm };
    }
    return { id: 'trendy_neutral', label: '트렌디 중간 템포', mood: '범용·무드', bpm: pacingBpm };
  })();

  const autoEnhancements: AutoEnhancement[] = [
    {
      id: 'safe_zone_crop',
      label: '안전지대 9:16 자동 크롭',
      description: '플랫폼 규격에 맞춰 불필요한 여백 제거, 화면 중심 자동 정렬',
      icon: 'crop',
    },
    {
      id: 'hook_overlay',
      label: '후킹 자막 오버레이',
      description: '날것 영상 위에 트렌디 폰트 + 심리학적 후킹 문구 자동 얹기',
      icon: 'type',
    },
    {
      id: 'bgm_sync',
      label: 'BGM 템플릿 싱크',
      description: '프롬프트 분석 기반 업종 분위기 BGM 자동 매칭',
      icon: 'music',
    },
  ];

  const captionStyle = platform === 'tiktok'
    ? '대담한 산세리프, 중앙 대형, 2줄 이내'
    : platform === 'instagram'
    ? '우아한 산세리프, 하단 배치, 그라데이션'
    : platform === 'youtube'
    ? '굵은 산세리프, 상단 배치, 고대비'
    : '굵은 산세리프, 하단 배치, 한국어 가독성 우선';

  return {
    platform,
    platformLabel: label,
    spec,
    safeZone,
    totalDurationSec,
    hookOptions,
    selectedHook: hook,
    customPrompt,
    segments,
    disclosureOverlay,
    disclosureEnabled,
    captionStyle,
    pacingBpm,
    bgmTemplate,
    autoEnhancements,
  };
}

export function getAvailablePlatforms(): { key: ShortFormPlatform; label: string; spec: PlatformSpec | undefined }[] {
  return (Object.keys(PLATFORM_MAP) as ShortFormPlatform[]).map((key) => {
    const { label, spec } = getPlatformInfo(key);
    return { key, label, spec };
  });
}

export { PLATFORM_SPECS };
