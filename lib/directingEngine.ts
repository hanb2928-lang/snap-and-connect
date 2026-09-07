import type { BgmTemplate, EditSegment } from './shortFormEditEngine';
import type { UsageContext } from './aiSynthesisEngine';

export type TransitionType = 'rotation_zoom' | 'dramatic_zoom_in' | 'paradox_reveal' | 'context_cut' | 'detail_punch';

export interface TransitionPlan {
  segmentIndex: number;
  type: TransitionType;
  startSec: number;
  durationSec: number;
  description: string;
}

export interface KillPointCaption {
  startSec: number;
  endSec: number;
  text: string;
  position: 'top' | 'center' | 'bottom';
  emphasis: boolean;
}

export interface SfxPlan {
  startSec: number;
  type: 'whoosh' | 'impact' | 'pop' | 'glitch' | 'sparkle';
  label: string;
}

export interface BeatSyncPlan {
  bpm: number;
  beatIntervalSec: number;
  cutPoints: number[];
  highlightStartSec: number;
  highlightDurationSec: number;
}

export interface DirectingPlan {
  hookTransition: TransitionPlan;
  transitions: TransitionPlan[];
  killPointCaptions: KillPointCaption[];
  sfxPlans: SfxPlan[];
  beatSync: BeatSyncPlan;
  rhythmPattern: 'rapid' | 'medium' | 'slow';
  totalDurationSec: number;
}

const HOOK_TRANSITIONS: Record<string, TransitionType> = {
  unboxing: 'paradox_reveal',
  desk_setup: 'rotation_zoom',
  outdoor: 'dramatic_zoom_in',
  kitchen: 'context_cut',
  beauty: 'dramatic_zoom_in',
  fashion: 'rotation_zoom',
  general: 'paradox_reveal',
};

const KILL_POINT_TEMPLATES: Record<UsageContext, string[]> = {
  unboxing: ['이거 진짜였어?', '다들 놀라는 중', '품절 전에 확인'],
  desk_setup: ['작업 효율 200%', '이게 되네?', '데스크 필수템'],
  outdoor: ['이런 디테일이', '야외에서 빛남', '왜 이제야 알았지'],
  kitchen: ['주방이 달라졌어요', '이거 없이 어떻게?', '사용감 최고'],
  beauty: ['피부가 달라졌어요', '이거 진짜 효과 있네', '모공이 사라졌어'],
  fashion: ['이 핏 실화?', '코디 완성템', '사이즈 고민 끝'],
  general: ['이거 진짜였어?', '다들 주목하는 중', '놓치면 손해'],
};

function buildHookTransition(context: UsageContext, segments: EditSegment[]): TransitionPlan {
  const hookSeg = segments[0];
  const type = HOOK_TRANSITIONS[context] ?? 'paradox_reveal';
  const descriptions: Record<TransitionType, string> = {
    rotation_zoom: '3D 입체 회전 + 줌인으로 사물의 입체감 강조',
    dramatic_zoom_in: '극적인 줌인으로 시선 집중 후 패러독스 훅 폭발',
    paradox_reveal: '호기심 유발 타이포그래피 + 사물 등장 반전',
    context_cut: '사용 맥락으로 즉시 전환, 훅 텍스트 오버레이',
    detail_punch: '디테일 클로즈업 + 임팩트 SFX로 시선 강탈',
  };
  return {
    segmentIndex: 0,
    type,
    startSec: hookSeg?.startSec ?? 0,
    durationSec: 3,
    description: descriptions[type],
  };
}

function buildTransitions(segments: EditSegment[], context: UsageContext): TransitionPlan[] {
  const plans: TransitionPlan[] = [];
  for (let i = 1; i < segments.length; i++) {
    const seg = segments[i];
    let type: TransitionType = 'context_cut';
    if (i === 1) type = 'rotation_zoom';
    else if (i === 2) type = context === 'beauty' || context === 'fashion' ? 'detail_punch' : 'context_cut';
    else if (i === 3) type = 'dramatic_zoom_in';

    const descMap: Record<TransitionType, string> = {
      rotation_zoom: '입체 회전 전환으로 다각도 합성 결과를 자연스럽게 노출',
      dramatic_zoom_in: '줌인으로 감정 고조 후 CTA 전달',
      paradox_reveal: '반전 타이포그래피로 시선 재포착',
      context_cut: '사용 맥락 컷으로 몰입 유지',
      detail_punch: '디테일 클로즈업 + SFX로 킬링 포인트 강조',
    };

    plans.push({
      segmentIndex: i,
      type,
      startSec: seg.startSec,
      durationSec: 1.5,
      description: descMap[type],
    });
  }
  return plans;
}

function buildKillPointCaptions(segments: EditSegment[], context: UsageContext): KillPointCaption[] {
  const templates = KILL_POINT_TEMPLATES[context] ?? KILL_POINT_TEMPLATES.general;
  const captions: KillPointCaption[] = [];

  if (segments[1]) {
    captions.push({
      startSec: segments[1].startSec + 1,
      endSec: segments[1].startSec + 2.5,
      text: templates[0],
      position: 'center',
      emphasis: true,
    });
  }
  if (segments[2]) {
    captions.push({
      startSec: segments[2].startSec + 1,
      endSec: segments[2].startSec + 2.5,
      text: templates[1] ?? templates[0],
      position: 'top',
      emphasis: false,
    });
  }
  if (segments[3]) {
    captions.push({
      startSec: segments[3].startSec,
      endSec: segments[3].endSec,
      text: templates[2] ?? templates[0],
      position: 'bottom',
      emphasis: true,
    });
  }
  return captions;
}

function buildSfxPlans(transitions: TransitionPlan[]): SfxPlan[] {
  const sfxMap: Record<TransitionType, SfxPlan['type']> = {
    rotation_zoom: 'whoosh',
    dramatic_zoom_in: 'impact',
    paradox_reveal: 'glitch',
    context_cut: 'pop',
    detail_punch: 'sparkle',
  };
  const sfxLabels: Record<SfxPlan['type'], string> = {
    whoosh: '회전 전환 SFX',
    impact: '임팩트 SFX',
    pop: '팝 전환 SFX',
    glitch: '글리치 SFX',
    sparkle: '스파클 SFX',
  };
  return transitions.map((t) => ({
    startSec: t.startSec,
    type: sfxMap[t.type],
    label: sfxLabels[sfxMap[t.type]],
  }));
}

function buildBeatSync(bgmTemplate: BgmTemplate, totalDurationSec: number, platform: string): BeatSyncPlan {
  const bpm = bgmTemplate.bpm;
  const beatInterval = 60 / bpm;
  const cutPoints: number[] = [];
  const interval = platform === 'tiktok' ? beatInterval * 1.5 : platform === 'youtube' ? beatInterval * 2 : beatInterval * 1.75;

  for (let t = 0; t <= totalDurationSec; t += interval) {
    cutPoints.push(Math.round(t * 10) / 10);
  }

  return {
    bpm,
    beatIntervalSec: beatInterval,
    cutPoints,
    highlightStartSec: bgmTemplate.highlightStartSec ?? 5,
    highlightDurationSec: bgmTemplate.highlightDurationSec ?? 10,
  };
}

export function buildDirectingPlan(
  segments: EditSegment[],
  bgmTemplate: BgmTemplate,
  context: UsageContext,
  platform: string,
): DirectingPlan {
  const totalDurationSec = segments[segments.length - 1]?.endSec ?? 15;
  const hookTransition = buildHookTransition(context, segments);
  const transitions = buildTransitions(segments, context);
  const killPointCaptions = buildKillPointCaptions(segments, context);
  const sfxPlans = buildSfxPlans([hookTransition, ...transitions]);
  const beatSync = buildBeatSync(bgmTemplate, totalDurationSec, platform);
  const rhythmPattern = platform === 'tiktok' ? 'rapid' : platform === 'youtube' ? 'medium' : 'medium';

  return {
    hookTransition,
    transitions,
    killPointCaptions,
    sfxPlans,
    beatSync,
    rhythmPattern,
    totalDurationSec,
  };
}

export function getDirectingSummary(plan: DirectingPlan): string {
  const hookLabel = plan.hookTransition.type === 'paradox_reveal' ? '패러독스 훅' :
    plan.hookTransition.type === 'rotation_zoom' ? '3D 회전 줌인' :
    plan.hookTransition.type === 'dramatic_zoom_in' ? '극적 줌인' : '맥락 컷';
  return `오프닝: ${hookLabel} · 컷 전환 ${plan.beatSync.cutPoints.length}회 · SFX ${plan.sfxPlans.length}종 · 킬링 포인트 자막 ${plan.killPointCaptions.length}개`;
}
