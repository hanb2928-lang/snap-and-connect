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

export interface FrameBuffer {
  angleKey: string;
  width: number;
  height: number;
  channels: number;
  aspectRatio: string;
  orderIndex: number;
}

export interface CloudSynthesisResult {
  strategy: string;
  volumeEstimate: { widthRatio: number; heightRatio: number; depthRatio: number; confidence: number };
  contextMatch: { context: string; label: string; description: string; confidence: number };
  interpolationGaps: { fromAngle: string; toAngle: string; steps: number }[];
  spatialDepthHint: string;
  primaryAngle: string;
  processingSteps: string[];
}

export interface CloudDirectingResult {
  hookTransition: { type: string; description: string; startSec: number; durationSec: number };
  transitions: { type: string; description: string; startSec: number; durationSec: number }[];
  killPointCaptions: { startSec: number; endSec: number; text: string; position: string; emphasis: boolean }[];
  sfxPlans: { startSec: number; type: string; label: string }[];
  beatSync: { bpm: number; beatIntervalSec: number; cutPoints: number[]; highlightStartSec: number; highlightDurationSec: number };
  rhythmPattern: string;
  totalDurationSec: number;
}

export interface CloudPublishPlan {
  target: string;
  render: { target: string; width: number; height: number; aspectRatio: string; codec: string; bitrateMbps: number; fps: number; maxDurationSec: number; label: string };
  metadata: { title: string; description: string; hashtags: string[]; category: string };
  scheduledAt: string | null;
  directPublishAvailable: boolean;
}

export interface CloudPipelineResult {
  status: 'ok';
  jobId: string;
  scanId: string | null;
  synthesis: CloudSynthesisResult;
  directing: CloudDirectingResult;
  publishPlans: CloudPublishPlan[];
  renderPlan: {
    quality: string;
    resolution: { width: number; height: number };
    aspectRatio: string;
    fps: number;
    bitrate: number;
    durationSec: number;
    scenes: unknown[];
    frameBuffers: FrameBuffer[];
  };
  estimatedProcessingSec: number;
  cloudEndpoint: string;
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

const INVOKE_TIMEOUT_MS = 60000;
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 2000;

const STANDARD_ASPECT_RATIO = '9:16';
const STANDARD_WIDTH = 1080;
const STANDARD_HEIGHT = 1920;
const STANDARD_CHANNELS = 4;

function buildFrameBuffers(angles: AngleImagePayload[]): FrameBuffer[] {
  return angles.map((a) => ({
    angleKey: a.key,
    width: STANDARD_WIDTH,
    height: STANDARD_HEIGHT,
    channels: STANDARD_CHANNELS,
    aspectRatio: STANDARD_ASPECT_RATIO,
    orderIndex: a.orderIndex,
  }));
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

  const frameBuffers = buildFrameBuffers(angles);

  report('uploading', 0.05, `${angles.length}각도 이미지 메타데이터 고정: ${STANDARD_ASPECT_RATIO} ${STANDARD_WIDTH}x${STANDARD_HEIGHT}`);

  const requestBody = {
    angles,
    productName,
    customPrompt,
    scanId,
    targetPlatforms: ['youtube', 'instagram', 'tiktok'],
    frameBuffers,
    aspectRatio: STANDARD_ASPECT_RATIO,
  };

  let lastError: Error | null = null;
  let attempt = 0;

  while (attempt <= MAX_RETRIES) {
    attempt++;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), INVOKE_TIMEOUT_MS);

    report('uploading', Math.min(0.1 + attempt * 0.02, 0.15), attempt > 1 ? `재시도 중 (${attempt}/${MAX_RETRIES + 1})...` : '클라우드로 전송 중...');

    try {
      const { data, error } = await supabase.functions.invoke('stereo-cut-auto', {
        body: requestBody,
      });

      clearTimeout(timeoutId);

      if (error || !data || data.status !== 'ok') {
        const msg = error?.message ?? '클라우드 처리 실패';
        if (attempt <= MAX_RETRIES) {
          report('uploading', 0.05, `응답 오류, ${RETRY_DELAY_MS / 1000}초 후 재시도...`);
          await delay(RETRY_DELAY_MS);
          lastError = new Error(msg);
          continue;
        }
        report('error', 0, msg);
        throw new Error(msg);
      }

      report('synthesizing', 0.4, data.synthesis?.spatialDepthHint ?? 'AI 입체 분석 완료');
      report('directing', 0.7, `오프닝 훅: ${data.directing?.hookTransition?.description ?? ''}`);
      report('rendering', 0.9, `예상 렌더링 시간: ${data.estimatedProcessingSec ?? 8}초`);
      report('done', 1.0, data.message ?? '클라우드 AI 파이프라인 완료');

      const result = data as CloudPipelineResult;
      if (!result.renderPlan.frameBuffers || result.renderPlan.frameBuffers.length === 0) {
        result.renderPlan.frameBuffers = frameBuffers;
      }
      if (!result.renderPlan.aspectRatio) {
        result.renderPlan.aspectRatio = STANDARD_ASPECT_RATIO;
      }

      return result;
    } catch (err) {
      clearTimeout(timeoutId);
      const isAbort = err instanceof Error && err.name === 'AbortError';

      if (isAbort && attempt <= MAX_RETRIES) {
        report('uploading', 0.05, `타임아웃 발생, 재시도 중 (${attempt}/${MAX_RETRIES + 1})...`);
        await delay(RETRY_DELAY_MS);
        lastError = new Error('클라우드 응답 시간 초과');
        continue;
      }

      if (!isAbort && attempt <= MAX_RETRIES) {
        report('uploading', 0.05, `오류 발생, 재시도 중 (${attempt}/${MAX_RETRIES + 1})...`);
        await delay(RETRY_DELAY_MS);
        lastError = err instanceof Error ? err : new Error(String(err));
        continue;
      }

      const errMsg = isAbort
        ? '클라우드 렌더링 서버 응답 시간이 초과되었습니다. 네트워크 상태를 확인하고 다시 시도해주세요.'
        : err instanceof Error ? err.message : '클라우드 AI 파이프라인 호출 실패';
      report('error', 0, errMsg);
      throw new Error(errMsg);
    }
  }

  const finalMsg = lastError?.message ?? '클라우드 AI 파이프라인 호출 실패';
  report('error', 0, finalMsg);
  throw new Error(finalMsg);
}

export function createRenderProgressTracker(
  onProgress: (progress: CloudPipelineProgress) => void,
): {
  update: (progress: number, message: string) => void;
  error: (message: string) => void;
  done: (message: string) => void;
} {
  return {
    update: (progress: number, message: string) => {
      const pct = Math.round(progress * 100);
      let phase: CloudPipelinePhase = 'rendering';
      if (progress < 0.15) phase = 'uploading';
      else if (progress < 0.45) phase = 'synthesizing';
      else if (progress < 0.75) phase = 'directing';
      else if (progress < 1.0) phase = 'rendering';
      else phase = 'done';
      onProgress({
        phase,
        phaseLabel: PHASE_LABELS[phase],
        progress,
        message: `${message} (${pct}%)`,
      });
    },
    error: (message: string) => {
      onProgress({ phase: 'error', phaseLabel: PHASE_LABELS.error, progress: 0, message });
    },
    done: (message: string) => {
      onProgress({ phase: 'done', phaseLabel: PHASE_LABELS.done, progress: 1.0, message });
    },
  };
}
