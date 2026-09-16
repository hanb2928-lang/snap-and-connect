import { PLATFORM_SPECS, getPlatformSpec, type PlatformSpec, type SafeZoneRect } from '@/lib/platformSpecs';
import { getDisclosureForPlatforms, getDisclosureShortForPlatforms } from '@/lib/disclosure';
import { type EmotionPhase } from '@/lib/psychologyEngine';
import { getBgmTemplateForMood, type BgmCategory } from '@/lib/bgmEngine';

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
      '아무도 안 알려주는 진짜 단점',
      '잠깐, 이거 진짜야? 직접 열어봄',
    ],
  },
  shock: {
    label: '손실 회피 역전',
    templates: [
      '지금 안 보면 품절임',
      '이 가격 실화? 매진 직전',
      '이거 모르면 호구 되는 거',
    ],
  },
  empathy: {
    label: '거울 뉴런 활성화',
    templates: [
      '나만 빼고 다 쓰더라',
      '이거 쓰는 사람들 공감 100%',
      '쓰면 진짜 편해서 못 버림',
    ],
  },
  desire: {
    label: '즉각적 보상 추구',
    templates: [
      '귀찮은 거 1초 만에 해결됨',
      '이거 사고 나서 다른 거 다 버렸음',
      '왜 이제야 알았지 진짜',
    ],
  },
  action: {
    label: '사회적 증거 폭발',
    templates: [
      '리뷰 수 폭발 중이라는데',
      '다들 사니까 나도 샀음',
      '실시간 품절 캡처 봄',
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

  if (hooks.length === 0) {
    hooks.push({ id: 1, text: `${nameShort} 진짜인지 확인하셈`, psychology: '호기심', emotion: 'curiosity' });
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
  highlightStartSec?: number;
  highlightDurationSec?: number;
  energyCurve?: number[];
}

export interface AutoEnhancement {
  id: 'safe_zone_crop' | 'hook_overlay' | 'bgm_sync';
  label: string;
  description: string;
  icon: string;
}

export interface ShortFormEditPlan {
  platform: ShortFormPlatform | string;
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

export type StoryPhase = 'gaze_hook' | 'need_discovery' | 'transformation' | 'cta_call';

export interface EditSegment {
  index: number;
  startSec: number;
  endSec: number;
  label: string;
  purpose: string;
  textOverlay: string;
  position: 'top' | 'center' | 'bottom';
  storyPhase: StoryPhase;
  narrationCue: string;
}

export function getPlatformInfo(platform: ShortFormPlatform | string, customSpec?: PlatformSpec) {
  if (customSpec) {
    const safeZone = { top: customSpec.safeZoneTop, bottom: customSpec.safeZoneBottom, left: customSpec.safeZoneSides, right: customSpec.safeZoneSides };
    return { label: customSpec.label, spec: customSpec, safeZone };
  }
  const entry = PLATFORM_MAP[platform as ShortFormPlatform];
  if (!entry) {
    const spec = getPlatformSpec('reels');
    const safeZone = spec ? { top: spec.safeZoneTop, bottom: spec.safeZoneBottom, left: spec.safeZoneSides, right: spec.safeZoneSides } : undefined;
    return { label: platform, spec, safeZone };
  }
  const spec = getPlatformSpec(entry.specKey);
  const safeZone = spec ? { top: spec.safeZoneTop, bottom: spec.safeZoneBottom, left: spec.safeZoneSides, right: spec.safeZoneSides } : undefined;
  return { label: entry.label, spec, safeZone };
}

const PRODUCT_INTRO_TEMPLATES: Record<EmotionPhase, string[]> = {
  curiosity: ['이게 왜 인기인지 알겠더라', '직접 열어봤는데 진짜임', '처음엔 반신반의했는데 결과가'],
  shock: ['이 가격 실화 맞나요', '품절 전에 확인하셈', '재입고 알림 설정 안 하면 손해'],
  empathy: ['써본 사람만 암', '원래 이런 거 안 믿는데 얘는', '왜 진작 몰랐을까 진짜'],
  desire: ['귀찮은 거 1초 만에 끝남', '이거 하나로 끝이라니', '삶의 질이 확 달라짐'],
  action: ['리뷰 수 폭발 중이라는데', '구매자들 반응이 미쳤음', '실시간 품절 캡처 봄'],
};

const BENEFIT_TEMPLATES: Record<EmotionPhase, string[]> = {
  curiosity: ['직접 확인하면 더 놀라옴', '알면 알수록 좋은 거 맞음', '디테일이 다르긴 다름'],
  shock: ['이 기회 놓치면 다시 없음', '지금이 진짜 최적 타이밍', '선착순이라 빨라야 됨'],
  empathy: ['쓰는 순간 실감함', '매일 쓰는 분들 추천 맞음', '진짜 후기가 말해줌'],
  desire: ['간편하지만 확실한 효과', '이거 하나면 해결됨', '경험해보면 차이 느껴짐'],
  action: ['주문 전에 미리 확인하셈', '누구나 만족하는 선택임', '같이 확인해보셈'],
};

const CTA_TEMPLATES: Record<EmotionPhase, string[]> = {
  curiosity: ['여기서 샀더니 편하더라', '링크 남겨둠 — 알아서들', '이거 진짜였음 진짜'],
  shock: ['고민하는 사이 품절됨 ㅋㅋ', '이거 아직 모르면 손해인데', '지금 이 가격 유지되는 동안만'],
  empathy: ['쓸 분들은 주목하셈', '진짜 후기가 말해줌', '경험해보면 알게 됨'],
  desire: ['지금 시작하면 진짜 편해짐', '이 순간이 시작임', '경험해보면 차이 느껴짐'],
  action: ['좋은 거 먼저 아는 사람이 임자', '링크는 여기에 남겨둠', '지금이 진짜 최적 타이밍'],
};

export interface StoryNarrative {
  gazeHook: string;
  needDiscovery: string;
  transformation: string;
  ctaCall: string;
  narrationCues: {
    gazeHook: string;
    needDiscovery: string;
    transformation: string;
    ctaCall: string;
  };
}

const STORY_GAZE_HOOKS: string[] = [
  '스마트폰으로 대충 찍은 거 솔직 공개',
  '언박싱하다가 손 떨린 거 진짜임',
  '이거 쓰는 거 촬영하는데 충격받음',
  '잠깐, 이거 진짜야? 직접 열어봄',
];

const STORY_NEED_DISCOVERY: string[] = [
  '원래 이런 거 안 믿는데 얘는 다름',
  '일상에서 진짜 불편했던 거 해결됨',
  '이거 없을 때 vs 있을 때 차이가 미쳤음',
  '귀찮은 거 1초 만에 해결되는 거 실화',
];

const STORY_TRANSFORMATION: string[] = [
  '쓰고 나서 다른 거 다 버렸음',
  '이거 사고 나서 삶이 확 달라짐',
  '돌아갈 수 없는 진짜 갓템',
  '왜 진작 몰랐을까 진짜',
];

const STORY_CTA: string[] = [
  '지금이 바로 그 순간입니다',
  '여러분의 일상도 바뀔 수 있어요',
  '이 경험, 직접 확인하세요',
  '다음은 당신의 차례입니다',
];

const NARRATION_CUES = {
  gazeHook: 'VO: 스마트폰으로 대충 찍은 듯한 거친 비주얼로 시작 — 0~3초, 언박싱 또는 실제 사용 환경으로 경계심 허물기. 자연스러운 구어체로 손실 회피 자극 멘트',
  needDiscovery: 'VO: 일상의 불편함 폭로 — 3~7초, 치명적인 귀찮음 해결 시연. ASMR 요소 활용, 실용적 효용 1초 만에 보여주기',
  transformation: 'VO: 사용 후 변화 — 7~11초, before/after 비교로 압도적 시간/비용 절감 효과. 디테일 클로즈업, 구매자 리액션 삽입',
  ctaCall: 'VO: 은근한 구매 유도 — 11~15초, 광고 느낌 쏙 빼고 "여기서 샀더니 편하더라" 식 정보 공유. 링크 남겨두기, CTA 자막 번인',
};

function pickStoryText(pool: string[], productHint: string): string {
  const idx = Math.floor(Math.random() * pool.length);
  return pool[idx].replace('이 제품', productHint).replace('이거', productHint);
}

function buildStoryNarrative(
  hook: string,
  emotion: EmotionPhase,
  productName?: string,
): StoryNarrative {
  const pName = productName?.trim() || '';
  const productHint = pName.length > 8 ? pName.slice(0, 8) + '...' : pName || '이 제품';

  return {
    gazeHook: hook || pickStoryText(STORY_GAZE_HOOKS, productHint),
    needDiscovery: pickStoryText(STORY_NEED_DISCOVERY, productHint),
    transformation: pickStoryText(STORY_TRANSFORMATION, productHint),
    ctaCall: pickStoryText(STORY_CTA, productHint),
    narrationCues: NARRATION_CUES,
  };
}

function pickTemplate(
  pool: Record<EmotionPhase, string[]>,
  emotion: EmotionPhase,
  customPrompt: string,
  productHint: string,
): string {
  const promptTrim = customPrompt.trim();
  if (promptTrim) {
    const shortPrompt = promptTrim.split(/[,.]/)[0].trim();
    if (shortPrompt.length >= 4 && shortPrompt.length <= 24) {
      return shortPrompt;
    }
  }
  const templates = pool[emotion];
  const idx = Math.floor(Math.random() * templates.length);
  return templates[idx].replace('이거', productHint);
}

function buildSegmentTexts(
  hook: string,
  hookOptions: HookOption[],
  customPrompt: string,
  productName?: string,
): { intro: string; benefit: string; cta: string } {
  const matchedHook = hookOptions.find((h) => h.text === hook);
  const emotion: EmotionPhase = matchedHook?.emotion ?? 'curiosity';
  const pName = productName?.trim() || '';
  const productHint = pName.length > 8 ? pName.slice(0, 8) + '...' : pName || '이 제품';

  const intro = pName || customPrompt.trim()
    ? pName || pickTemplate(PRODUCT_INTRO_TEMPLATES, emotion, customPrompt, productHint)
    : pickTemplate(PRODUCT_INTRO_TEMPLATES, emotion, customPrompt, productHint);

  const benefit = pickTemplate(BENEFIT_TEMPLATES, emotion, customPrompt, productHint);
  const cta = pickTemplate(CTA_TEMPLATES, emotion, '', productHint);

  return { intro, benefit, cta };
}

export function buildShortFormEditPlan(
  platform: ShortFormPlatform | string,
  customPrompt: string,
  selectedHook: string | null,
  productName?: string,
  affiliatePlatforms: string[] = [],
  autoDisclosure = true,
  disclosureEnabled = false,
  customSpec?: PlatformSpec,
  bgmOverride?: { templateId: string; label: string; mood: string; bpm: number; reason?: string; highlightStartSec?: number; highlightDurationSec?: number; energyCurve?: number[] },
): ShortFormEditPlan {
  const { label, spec, safeZone } = getPlatformInfo(platform, customSpec);
  const totalDurationSec = 15;
  const hookOptions = generateHookOptions(customPrompt, productName);
  const fallbackHook = hookOptions[0]?.text || '이거 보면 무조건 클릭';
  const hook = selectedHook || fallbackHook;
  const matchedHook = hookOptions.find((h) => h.text === hook);
  const emotion: EmotionPhase = matchedHook?.emotion ?? 'curiosity';
  const story = buildStoryNarrative(hook, emotion, productName);
  const segmentTexts = buildSegmentTexts(hook, hookOptions, customPrompt, productName);

  const segments: EditSegment[] = [
    {
      index: 0,
      startSec: 0,
      endSec: 3,
      label: '시선 포착',
      purpose: '상위 1% 후킹: 0~3초 시선 강탈, 화면 전환 없음, 오디오 빌드업으로 이탈 방지',
      textOverlay: story.gazeHook,
      position: 'center',
      storyPhase: 'gaze_hook',
      narrationCue: story.narrationCues.gazeHook,
    },
    {
      index: 1,
      startSec: 3,
      endSec: 7,
      label: '서사 전개',
      purpose: '왜 이 제품이 필요한지 리얼리티 서사로 연결, 다각도 입체 컷 전환',
      textOverlay: story.needDiscovery,
      position: 'top',
      storyPhase: 'need_discovery',
      narrationCue: story.narrationCues.needDiscovery,
    },
    {
      index: 2,
      startSec: 7,
      endSec: 11,
      label: '변화·몰입',
      purpose: '사용 후 일상적 변화를 감성적으로 전달, 디테일 클로즈업 전환',
      textOverlay: story.transformation,
      position: 'center',
      storyPhase: 'transformation',
      narrationCue: story.narrationCues.transformation,
    },
    {
      index: 3,
      startSec: 11,
      endSec: 13,
      label: 'CTA',
      purpose: '시청자를 향한 직접적 행동 유도, 감정 최고점에서 클로징',
      textOverlay: disclosureEnabled ? story.ctaCall : segmentTexts.cta,
      position: 'bottom',
      storyPhase: 'cta_call',
      narrationCue: story.narrationCues.ctaCall,
    },
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
    if (bgmOverride) {
      return {
        id: bgmOverride.templateId,
        label: bgmOverride.label,
        mood: bgmOverride.mood,
        bpm: bgmOverride.bpm,
        highlightStartSec: bgmOverride.highlightStartSec,
        highlightDurationSec: bgmOverride.highlightDurationSec,
        energyCurve: bgmOverride.energyCurve,
      };
    }
    const promptLower = customPrompt.toLowerCase();
    if (promptLower.includes('의류') || promptLower.includes('신발') || promptLower.includes('런칭') || promptLower.includes('새제품') || promptLower.includes('패션')) {
      return getBgmTemplateForMood('하이텐션');
    }
    if (promptLower.includes('카페') || promptLower.includes('베이커리') || promptLower.includes('소품') || promptLower.includes('힐링') || promptLower.includes('일상')) {
      return getBgmTemplateForMood('로파이');
    }
    if (promptLower.includes('수제') || promptLower.includes('디저트') || promptLower.includes('자연') || promptLower.includes('친환경') || promptLower.includes('따뜻')) {
      return getBgmTemplateForMood('감성');
    }
    if (promptLower.includes('할인') || promptLower.includes('재고') || promptLower.includes('매진') || promptLower.includes('품절') || promptLower.includes('꿀팁') || promptLower.includes('해결')) {
      return getBgmTemplateForMood('하이텐션');
    }
    return getBgmTemplateForMood('하이텐션');
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
      description: 'AI 이미지 분석 기반 실제 음악 트랙 카테고리 자동 매칭 + 핵심 구간 추출 싱크',
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

export interface MultiAngleFusionResult {
  primaryBase64: string;
  additionalBase64s: string[];
  spatialDepthHint: string;
  fusionStrategy: 'five_angle_stereo' | 'three_angle_partial' | 'single_fallback';
}

export function describeMultiAngleFusion(shotCount: number): MultiAngleFusionResult | null {
  if (shotCount >= 5) {
    return {
      primaryBase64: '',
      additionalBase64s: [],
      spatialDepthHint: '정면·좌측·우측·후면·상부 5각도 입체 융합',
      fusionStrategy: 'five_angle_stereo',
    };
  }
  if (shotCount >= 3) {
    return {
      primaryBase64: '',
      additionalBase64s: [],
      spatialDepthHint: `${shotCount}각도 부분 입체 융합`,
      fusionStrategy: 'three_angle_partial',
    };
  }
  return null;
}

export interface RetentionFormula {
  hookDurationSec: number;
  cutIntervalSec: number;
  rhythmPattern: 'rapid' | 'medium' | 'slow';
  techniques: string[];
}

export function getRetentionFormula(platform: ShortFormPlatform | string): RetentionFormula {
  const isTikTok = platform === 'tiktok';
  const isYouTube = platform === 'youtube';
  return {
    hookDurationSec: 3,
    cutIntervalSec: isTikTok ? 1.5 : isYouTube ? 2.5 : 2,
    rhythmPattern: isTikTok ? 'rapid' : isYouTube ? 'medium' : 'medium',
    techniques: [
      '초반 3초 훅: 시청자 이탈 방지',
      '사용 맥락 중심 다이내믹 컷 전환: 몰입 유지',
      '시각적 리듬감 부여: BGM 비트에 맞춘 전환',
    ],
  };
}

export function getAvailablePlatforms(): { key: ShortFormPlatform; label: string; spec: PlatformSpec | undefined }[] {
  return (Object.keys(PLATFORM_MAP) as ShortFormPlatform[]).map((key) => {
    const { label, spec } = getPlatformInfo(key);
    return { key, label, spec };
  });
}

export { PLATFORM_SPECS };
