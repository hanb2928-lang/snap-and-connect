import type { VideoGenProgress } from './aiVideoPipeline';

export type VideoGenStepStatus = 'pending' | 'active' | 'done';

export interface VideoGenStep {
  id: string;
  label: string;
  description: string;
  threshold: number;
  status: VideoGenStepStatus;
}

export const VIDEO_GEN_STEPS: readonly Omit<VideoGenStep, 'status'>[] = [
  {
    id: 'analyze',
    label: '다각도 컷 분석',
    description: '캡처된 이미지에서 제품 특징과 각도를 추출합니다',
    threshold: 0.05,
  },
  {
    id: 'hook',
    label: '훅 문구 추출',
    description: '심리학적 후킹 문구와 자막을 생성합니다',
    threshold: 0.15,
  },
  {
    id: 'plan',
    label: '편집 플랜 구성',
    description: '플랫폼에 맞춰 컷 전환·BGM·자막 타이밍을 설계합니다',
    threshold: 0.25,
  },
  {
    id: 'submit',
    label: 'AI 렌더링 요청',
    description: '생성 모델에 프롬프트를 전송하고 작업을 시작합니다',
    threshold: 0.35,
  },
  {
    id: 'render',
    label: '영상 렌더링',
    description: 'AI가 프레임을 생성하고 영상을 합성하는 중입니다',
    threshold: 0.90,
  },
  {
    id: 'finalize',
    label: '최종 자막 합성',
    description: '자막 오버레이와 공시문구를 영상에 입힙니다',
    threshold: 1.0,
  },
];

export function resolveVideoGenSteps(progress: VideoGenProgress | null): VideoGenStep[] {
  if (!progress) {
    return VIDEO_GEN_STEPS.map((s) => ({ ...s, status: 'pending' as VideoGenStepStatus }));
  }

  const p = progress.progress;

  if (progress.phase === 'error') {
    return VIDEO_GEN_STEPS.map((s) => {
      if (p >= s.threshold) {
        return { ...s, status: 'done' as VideoGenStepStatus };
      }
      const activeStep = VIDEO_GEN_STEPS.find((step) => p < step.threshold);
      if (activeStep && s.id === activeStep.id) {
        return { ...s, status: 'active' as VideoGenStepStatus };
      }
      return { ...s, status: 'pending' as VideoGenStepStatus };
    });
  }

  if (progress.phase === 'completed') {
    return VIDEO_GEN_STEPS.map((s) => ({ ...s, status: 'done' as VideoGenStepStatus }));
  }

  let activeFound = false;

  return VIDEO_GEN_STEPS.map((s) => {
    if (p >= s.threshold) {
      return { ...s, status: 'done' as VideoGenStepStatus };
    }
    if (!activeFound) {
      activeFound = true;
      return { ...s, status: 'active' as VideoGenStepStatus };
    }
    return { ...s, status: 'pending' as VideoGenStepStatus };
  });
}

export function getCurrentStepIndex(progress: VideoGenProgress | null): number {
  const steps = resolveVideoGenSteps(progress);
  const idx = steps.findIndex((s) => s.status === 'active');
  return idx >= 0 ? idx : steps.filter((s) => s.status === 'done').length - 1;
}
