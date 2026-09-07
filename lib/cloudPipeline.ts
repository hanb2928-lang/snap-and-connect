import { supabase } from './supabase';

export type CloudPipelinePhase = 'uploading' | 'synthesizing' | 'directing' | 'rendering' | 'done' | 'error';

export interface CloudPipelineProgress {
  phase: CloudPipelinePhase;
  phaseLabel: string;
  progress: number;
  message: string;
}

export interface AngleImagePayload {
  key: string;
  label: string;
  base64: string;
  mimeType: string;
  orderIndex: number;
}

export interface CloudPipelineResult {
  jobId: string;
  scanId: string | null;
  synthesisResult: {
    strategy: string;
    volumeEstimate: { widthRatio: number; heightRatio: number; depthRatio: number; confidence: number };
    contextMatch: { context: string; label: string; description: string; confidence: number };
    spatialDepthHint: string;
    processingSteps: string[];
  };
  directingPlan: {
    hookTransition: { type: string; description: string };
    transitions: { type: string; description: string; startSec: number }[];
    killPointCaptions: { startSec: number; endSec: number; text: string; emphasis: boolean }[];
    sfxPlans: { startSec: number; type: string; label: string }[];
    beatSync: { bpm: number; cutPoints: number[] };
  };
  publishPlans: {
    target: string;
    render: { label: string; width: number; height: number; codec: string; fps: number };
    metadata: { title: string; description: string; hashtags: string[] };
  }[];
  renderPlan: {
    resolution: { width: number; height: number };
    fps: number;
    durationSec: number;
  };
  estimatedProcessingSec: number;
  message: string;
}

const PHASE_LABELS: Record<CloudPipelinePhase, string> = {
  uploading: '이미지 업로드 중',
  synthesizing: 'AI 입체 분석 (3D 신세시스)',
  directing: '심리 리듬 연출 설계',
  rendering: '클라우드 렌더링 대기',
  done: '완료',
  error: '오류',
};

export async function invokeStereoCutAuto(
  angles: AngleImagePayload[],
  productName: string,
  customPrompt: string,
  scanId: string | null,
  onProgress?: (progress: CloudPipelineProgress) => void,
): Promise<CloudPipelineResult> {
  const report = (phase: CloudPipelinePhase, progress: number, message: string) => {
    onProgress?.({ phase, phaseLabel: PHASE_LABELS[phase], progress, message });
  };

  report('uploading', 0.1, '5각도 이미지를 클라우드로 전송 중...');

  const { data, error } = await supabase.functions.invoke('stereo-cut-auto', {
    body: {
      angles,
      productName,
      customPrompt,
      scanId,
      targetPlatforms: ['youtube', 'instagram', 'tiktok'],
    },
  });

  if (error || !data || data.status !== 'ok') {
    report('error', 0, error?.message ?? '클라우드 처리 실패');
    throw new Error(error?.message ?? '클라우드 AI 파이프라인 호출 실패');
  }

  report('synthesizing', 0.4, data.synthesis?.spatialDepthHint ?? 'AI 입체 분석 완료');
  report('directing', 0.7, `오프닝 훅: ${data.directing?.hookTransition?.description ?? ''}`);
  report('rendering', 0.9, `예상 렌더링 시간: ${data.estimatedProcessingSec ?? 8}초`);
  report('done', 1.0, data.message ?? '클라우드 AI 파이프라인 완료');

  return data as CloudPipelineResult;
}
