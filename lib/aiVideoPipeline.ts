import { supabase } from './supabase';
import type { ProductVisionResult } from './productVision';

export type VideoGenPhase = 'submitting' | 'generating' | 'completed' | 'error';

export interface VideoGenProgress {
  phase: VideoGenPhase;
  progress: number;
  message: string;
  elapsedSec: number;
}

export interface VideoGenResult {
  videoUrl: string;
  jobId: string;
  motionPrompt: string;
  durationSec: number;
  aspectRatio: string;
  variationSeed: number;
  persisted: boolean;
  provider: string;
}

interface GenerateAiVideoOptions {
  durationSec?: number;
  aspectRatio?: '9:16' | '16:9' | '1:1';
  productName?: string;
  scanId?: string;
  variationSeed?: number;
  bgmMood?: string;
  captionText?: string;
  platform?: string;
  hookCategory?: string;
  cutCount?: number;
  productVision?: ProductVisionResult | null;
  draft?: boolean;
}

interface PollResponse {
  status: string;
  videoUrl?: string;
  progress?: string;
  error?: string;
  persisted?: boolean;
}

const POLL_INTERVAL_FAST_MS = 3000;
const POLL_INTERVAL_NORMAL_MS = 5000;
const FAST_POLL_DURATION_MS = 10000;
const MAX_POLL_ATTEMPTS = 72;
const SUBMIT_MAX_RETRIES = 2;
const SUBMIT_RETRY_DELAY_MS = 2000;

const STATUS_MESSAGES: Record<string, string> = {
  THROTTLED: 'Runway 서버 대기 중 (순서 대기)...',
  PENDING: '작업 대기 중...',
  RUNNING: 'AI가 영상을 렌더링하고 있어요',
  PROCESSING: 'AI가 영상을 렌더링하고 있어요',
  QUEUED: '작업 대기 중...',
};

export async function generateAiVideo(
  prompt: string,
  options: GenerateAiVideoOptions,
  onProgress?: (progress: VideoGenProgress) => void,
): Promise<VideoGenResult> {
  const startTime = Date.now();

  const report = (phase: VideoGenPhase, progress: number, message: string) => {
    onProgress?.({
      phase,
      progress,
      message,
      elapsedSec: Math.round((Date.now() - startTime) / 1000),
    });
  };

  const isDraft = options.draft === true;

  report('submitting', 0.05, isDraft ? '빠른 미리보기 생성 요청 중...' : 'AI 비디오 생성 요청 전송 중...');

  // Phase 1: Submit task
  let submitData: { taskId: string; motionPrompt: string; durationSec: number; aspectRatio: string; variationSeed: number } | null = null;
  let lastSubmitErr: Error | null = null;

  for (let attempt = 0; attempt <= SUBMIT_MAX_RETRIES; attempt++) {
    try {
      const { data, error } = await supabase.functions.invoke('generate-video', {
        body: {
          mode: 'submit',
          prompt,
          durationSec: options.durationSec ?? 10,
          aspectRatio: options.aspectRatio ?? '9:16',
          productName: options.productName,
          scanId: options.scanId,
          variationSeed: options.variationSeed ?? 0,
          bgmMood: options.bgmMood,
          captionText: options.captionText,
          platform: options.platform ?? 'shorts',
          hookCategory: options.hookCategory ?? 'curiosity',
          cutCount: options.cutCount,
          productVision: options.productVision ?? null,
          draft: isDraft,
        },
      });

      if (error) {
        throw await buildVideoFunctionError(error);
      }

      if (!data || typeof data !== 'object' || typeof data.taskId !== 'string') {
        throw new Error('서버가 작업 ID를 반환하지 않았습니다.');
      }

      submitData = {
        taskId: data.taskId as string,
        motionPrompt: data.motionPrompt as string,
        durationSec: data.durationSec as number,
        aspectRatio: data.aspectRatio as string,
        variationSeed: data.variationSeed as number,
      };
      break;
    } catch (err) {
      lastSubmitErr = err instanceof Error ? err : new Error(String(err));
      if (attempt < SUBMIT_MAX_RETRIES) {
        report('submitting', 0.05 + attempt * 0.02, `생성 요청 재시도 중 (${attempt + 1}/${SUBMIT_MAX_RETRIES})...`);
        await delay(SUBMIT_RETRY_DELAY_MS * (attempt + 1));
      }
    }
  }

  if (!submitData) {
    const msg = lastSubmitErr?.message ?? '비디오 생성 요청 실패';
    report('error', 0, msg);
    throw new Error(msg);
  }

  const draftLabel = isDraft ? '빠른 미리보기' : 'AI 비디오';
  report('generating', 0.1, `${draftLabel} 작업이 접수되었습니다. 완료되면 알려드릴게요...`);

  const pollStartTime = Date.now();

  // Phase 2: Poll until complete (adaptive interval: 3s for first 10s, then 5s)
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    const elapsed = Date.now() - pollStartTime;
    const interval = elapsed < FAST_POLL_DURATION_MS ? POLL_INTERVAL_FAST_MS : POLL_INTERVAL_NORMAL_MS;
    await delay(interval);

    let pollData: PollResponse | null = null;

    try {
      const { data, error } = await supabase.functions.invoke('generate-video', {
        body: {
          mode: 'poll',
          taskId: submitData.taskId,
          scanId: options.scanId,
        },
      });

      if (error) {
        throw await buildVideoFunctionError(error);
      }

      pollData = data as PollResponse;
    } catch (err) {
      // Network blip — keep polling
      const msg = err instanceof Error ? err.message : '폴링 오류';
      report('generating', 0.1 + attempt * 0.005, `연결 재시도 중: ${msg}`);
      continue;
    }

    if (!pollData) continue;

    if (pollData.status === 'SUCCESS' && pollData.videoUrl) {
      report('completed', 1.0, 'AI 비디오 생성 완료');
      return {
        videoUrl: pollData.videoUrl,
        jobId: submitData.taskId,
        motionPrompt: submitData.motionPrompt,
        durationSec: submitData.durationSec,
        aspectRatio: submitData.aspectRatio,
        variationSeed: submitData.variationSeed,
        persisted: pollData.persisted ?? false,
        provider: 'runway',
      };
    }

    if (pollData.status === 'FAILED') {
      const msg = pollData.error ?? 'Runway 비디오 생성에 실패했습니다.';
      report('error', 0, msg);
      throw new Error(msg);
    }

    // Map Runway progress (0.0–1.0) to our 0.1–0.95 range
    const rawProgress = pollData.progress ? parseFloat(pollData.progress) : NaN;
    const numericProgress = !isNaN(rawProgress)
      ? 0.1 + rawProgress * 0.85
      : 0.1 + (attempt / MAX_POLL_ATTEMPTS) * 0.85;

    const statusMsg = STATUS_MESSAGES[pollData.status] ?? `Runway 상태: ${pollData.status}`;
    const pctLabel = !isNaN(rawProgress) ? ` (${Math.round(rawProgress * 100)}%)` : '';
    report('generating', Math.min(numericProgress, 0.95), `${statusMsg}${pctLabel}`);
  }

  report('error', 0, 'Runway 비디오 생성 시간이 초과되었습니다. 다시 시도해주세요.');
  throw new Error('Runway 비디오 생성 시간이 초과되었습니다. 다시 시도해주세요.');
}

export function createVideoGenProgressTracker(
  onProgress: (progress: VideoGenProgress) => void,
): { update: (progress: number, message: string) => void; error: (message: string) => void; done: (message: string) => void } {
  const startTime = Date.now();
  return {
    update: (progress: number, message: string) => {
      const phase: VideoGenPhase = progress < 0.15 ? 'submitting' : progress < 1.0 ? 'generating' : 'completed';
      onProgress({
        phase,
        progress,
        message: `${message} (${Math.round(progress * 100)}%)`,
        elapsedSec: Math.round((Date.now() - startTime) / 1000),
      });
    },
    error: (message: string) => {
      onProgress({ phase: 'error', progress: 0, message, elapsedSec: Math.round((Date.now() - startTime) / 1000) });
    },
    done: (message: string) => {
      onProgress({ phase: 'completed', progress: 1.0, message, elapsedSec: Math.round((Date.now() - startTime) / 1000) });
    },
  };
}

async function buildVideoFunctionError(error: unknown): Promise<Error> {
  const fallback = error instanceof Error ? error.message : '비디오 생성 요청에 실패했습니다.';
  const response = (error as { context?: unknown } | null)?.context;

  if (response && typeof response === 'object' && 'clone' in response) {
    try {
      const cloned = (response as Response).clone();
      const contentType = cloned.headers.get('content-type') ?? '';
      const payload = contentType.includes('application/json')
        ? await cloned.json() as { error?: unknown; message?: unknown; step?: unknown; provider?: unknown }
        : { error: await cloned.text() };
      const message = typeof payload.error === 'string'
        ? payload.error
        : typeof payload.message === 'string'
          ? payload.message
          : fallback;
      const details = [
        typeof payload.step === 'string' ? `단계: ${payload.step}` : '',
        typeof payload.provider === 'string' ? `프로바이더: ${payload.provider}` : '',
      ].filter(Boolean).join(' · ');
      return new Error(details ? `${message} (${details})` : message);
    } catch {
      return new Error(fallback);
    }
  }

  return new Error(fallback);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
