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
  isCleanVideoMode?: boolean;
  promptStrength?: number;
  negativePrompt?: string;
  bgStyle?: string;
  outfitIntensity?: number;
  zoomSpeed?: number;
  cameraRotation?: number;
  transitionEffect?: string;
}

interface PollResponse {
  status: string;
  videoUrl?: string;
  progress?: string;
  error?: string;
  persisted?: boolean;
}

const POLL_INTERVAL_ULTRA_MS = 500;
const POLL_INTERVAL_NORMAL_MS = 1000;
const ULTRA_POLL_DURATION_MS = 5000;
const MAX_POLL_ATTEMPTS = 360;
const SUBMIT_MAX_RETRIES = 2;
const SUBMIT_RETRY_DELAY_MS = 2000;
const MAX_BACKOFF_MS = 8000;
const MAX_CONSECUTIVE_POLL_ERRORS = 8;
const POLL_DEADLINE_MS = 150_000;

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
          durationSec: options.durationSec ?? 5,
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
          isCleanVideoMode: options.isCleanVideoMode ?? false,
          promptStrength: options.promptStrength,
          negativePrompt: options.negativePrompt,
          bgStyle: options.bgStyle,
          outfitIntensity: options.outfitIntensity,
          zoomSpeed: options.zoomSpeed,
          cameraRotation: options.cameraRotation,
          transitionEffect: options.transitionEffect,
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

  // Phase 2: Poll until complete (ultra-fast 0.5s for first 5s, then 1s with exponential backoff on errors)
  let consecutiveErrors = 0;
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    const elapsed = Date.now() - pollStartTime;
    if (elapsed > POLL_DEADLINE_MS) {
      const deadlineMsg = `비디오 생성 대기 시간이 ${Math.round(POLL_DEADLINE_MS / 1000)}초를 초과했습니다. 네트워크 상태가 불안정할 수 있습니다. 다시 시도해주세요.`;
      report('error', 0, deadlineMsg);
      throw new Error(deadlineMsg);
    }
    const baseInterval = elapsed < ULTRA_POLL_DURATION_MS ? POLL_INTERVAL_ULTRA_MS : POLL_INTERVAL_NORMAL_MS;
    const backoffMultiplier = consecutiveErrors > 0 ? Math.min(Math.pow(2, consecutiveErrors), MAX_BACKOFF_MS / baseInterval) : 1;
    await delay(Math.round(baseInterval * backoffMultiplier));

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
      // Network blip — keep polling with exponential backoff
      consecutiveErrors++;
      const msg = err instanceof Error ? err.message : '폴링 오류';

      if (consecutiveErrors >= MAX_CONSECUTIVE_POLL_ERRORS) {
        const deadlineMsg = `네트워크 연결이 반복적으로 실패하여 비디오 생성 상태를 확인할 수 없습니다. Wi-Fi 또는 셀룴러 연결을 확인 후 다시 시도해주세요. (오류: ${msg})`;
        report('error', 0, deadlineMsg);
        throw new Error(deadlineMsg);
      }

      report('generating', 0.1 + attempt * 0.005, `연결 재시도 중 (${consecutiveErrors}/${MAX_CONSECUTIVE_POLL_ERRORS}): ${msg}`);
      continue;
    }

    consecutiveErrors = 0;
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
      const text = await cloned.text();
      if (contentType.includes('application/json') || text.trim().startsWith('{')) {
        const payload = JSON.parse(text) as { error?: unknown; message?: unknown; step?: unknown; provider?: unknown };
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
      }
      if (text.trim().startsWith('<!') || text.trim().startsWith('<html') || contentType.includes('text/html')) {
        return new Error('AI 비디오 서버가 올바른 응답을 반환하지 않았습니다. 잠시 후 다시 시도해주세요.');
      }
      return new Error(fallback);
    } catch {
      return new Error(fallback);
    }
  }

  return new Error(fallback);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
