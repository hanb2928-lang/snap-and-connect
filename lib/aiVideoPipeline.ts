import { supabase } from './supabase';
import type { ProductVisionResult } from './productVision';

export type VideoGenPhase = 'submitting' | 'generating' | 'completed' | 'error' | 'hd_upgrading' | 'hd_completed';

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
  isDraft?: boolean;
}

interface GenerateAiVideoOptions {
  durationSec?: number;
  aspectRatio?: '9:16' | '16:9' | '1:1' | '4:5';
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
  stylePreset?: string;
  detailRestoration?: boolean;
  hdUpscale?: boolean;
  qualityTier?: 'standard' | 'pro';
  resolution?: string;
  fps?: number;
}


const SUBMIT_MAX_RETRIES = 2;
const SUBMIT_RETRY_DELAY_MS = 2000;
const REALTIME_TIMEOUT_MS = 300_000;
const REALTIME_SOFT_WARN_MS = 120_000;
const FALLBACK_POLL_INTERVAL_MS = 5000;
const RUNWAY_POLL_FALLBACK_INTERVAL_MS = 15000;
const RUNWAY_POLL_FALLBACK_START_MS = 30_000;


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
          stylePreset: options.stylePreset,
          detailRestoration: options.detailRestoration,
          hdUpscale: options.hdUpscale,
          qualityTier: options.hdUpscale ? 'pro' : (options.qualityTier ?? 'standard'),
          resolution: options.resolution ?? (options.hdUpscale ? '1080p' : '720p'),
          fps: options.fps ?? (options.hdUpscale ? 30 : 24),
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

  // Phase 2: Wait for completion via Supabase Realtime on video_jobs table.
  // Runway's webhook writes the result to video_jobs — we subscribe to that DB
  // change instead of polling the Runway API in a tight loop. A low-frequency
  // fallback poll guards against missed realtime events.
  return waitForVideoCompletion(submitData, options.scanId, startTime, report);
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

interface VideoJobRow {
  status: string;
  video_url: string | null;
  error_message: string | null;
  hd_status?: string | null;
  hd_video_url?: string | null;
  hd_task_id?: string | null;
}

/**
 * Subscribe to the video_jobs table via Supabase Realtime and resolve when the
 * job transitions to SUCCESS or FAILED. A low-frequency DB poll runs in parallel
 * as a safety net in case the realtime event is missed.
 */
function waitForVideoCompletion(
  submitData: { taskId: string; motionPrompt: string; durationSec: number; aspectRatio: string; variationSeed: number },
  scanId: string | undefined,
  startTime: number,
  report: (phase: VideoGenPhase, progress: number, message: string) => void,
): Promise<VideoGenResult> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let timeoutTimer: ReturnType<typeof setTimeout> | null = null;
    let elapsedTick = 0;

    const cleanup = () => {
      if (channel) supabase.removeChannel(channel);
      if (pollTimer) clearInterval(pollTimer);
      if (timeoutTimer) clearTimeout(timeoutTimer);
      if (softWarnTimer) clearTimeout(softWarnTimer);
      if (runwayPollTimer) clearTimeout(runwayPollTimer);
    };

    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      cleanup();
      fn();
    };

    const handleRow = (row: VideoJobRow) => {
      if (row.status === 'SUCCESS' && row.video_url) {
        report('completed', 1.0, 'AI 비디오 생성 완료');
        finish(() => resolve({
          videoUrl: row.video_url!,
          jobId: submitData.taskId,
          motionPrompt: submitData.motionPrompt,
          durationSec: submitData.durationSec,
          aspectRatio: submitData.aspectRatio,
          variationSeed: submitData.variationSeed,
          persisted: true,
          provider: 'runway',
        }));
        return true;
      }
      if (row.status === 'FAILED') {
        const msg = row.error_message ?? 'Runway 비디오 생성에 실패했습니다.';
        report('error', 0, msg);
        finish(() => reject(new Error(msg)));
        return true;
      }
      return false;
    };

    // Check video_jobs table directly (used for initial check + fallback polling)
    const checkDb = async () => {
      if (settled || !scanId) return;
      try {
        const { data, error } = await supabase
          .from('video_jobs')
          .select('status, video_url, error_message')
          .eq('scan_id', scanId)
          .eq('task_id', submitData.taskId)
          .maybeSingle();
        if (error || !data) return;
        handleRow(data as VideoJobRow);
      } catch {
        // ignore — realtime subscription is the primary path
      }
    };

    // Also check scans.video_url for the persisted URL (webhook writes here too)
    const checkScanVideoUrl = async () => {
      if (settled || !scanId) return;
      try {
        const { data, error } = await supabase
          .from('scans')
          .select('video_url')
          .eq('id', scanId)
          .maybeSingle();
        if (error || !data?.video_url) return;
        report('completed', 1.0, 'AI 비디오 생성 완료');
        finish(() => resolve({
          videoUrl: data.video_url!,
          jobId: submitData.taskId,
          motionPrompt: submitData.motionPrompt,
          durationSec: submitData.durationSec,
          aspectRatio: submitData.aspectRatio,
          variationSeed: submitData.variationSeed,
          persisted: true,
          provider: 'runway',
        }));
      } catch {
        // ignore
      }
    };

    // Primary path: Realtime subscription on video_jobs
    if (scanId) {
      channel = supabase
        .channel(`video-job:${scanId}:${submitData.taskId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'video_jobs', filter: `scan_id=eq.${scanId}` },
          (payload) => {
            if (!payload.new) return;
            handleRow(payload.new as VideoJobRow);
          },
        )
        .subscribe();
    }

    // Safety-net: low-frequency DB poll every 5s (vs. old 0.5s tight loop)
    pollTimer = setInterval(() => {
      if (settled) return;
      elapsedTick++;
      checkDb();
      checkScanVideoUrl();
      // Progress hint based on elapsed time
      const elapsedSec = Math.round((Date.now() - startTime) / 1000);
      const timeProgress = Math.min(0.1 + (elapsedSec / 180) * 0.8, 0.95);
      report('generating', timeProgress, `AI가 영상을 렌더링하고 있어요 (${elapsedSec}초)...`);
    }, FALLBACK_POLL_INTERVAL_MS);

    // Runway API direct-poll fallback: after 30s, if DB still shows no result,
    // poll the Runway API directly every 15s as a second safety net.
    // This catches cases where the webhook fails but Runway has the video ready.
    let runwayPollTimer: ReturnType<typeof setTimeout> | null = null;
    const startRunwayPollFallback = () => {
      if (settled || runwayPollTimer) return;
      const runwayPoll = async () => {
        if (settled) return;
        try {
          const { data, error } = await supabase.functions.invoke('generate-video', {
            body: { mode: 'poll', taskId: submitData.taskId, scanId },
          });
          if (error) { scheduleNext(); return; }
          const resp = data as { status?: string; videoUrl?: string; error?: string };
          if (resp.status === 'SUCCESS' && resp.videoUrl) {
            report('completed', 1.0, 'AI 비디오 생성 완료');
            finish(() => resolve({
              videoUrl: resp.videoUrl!,
              jobId: submitData.taskId,
              motionPrompt: submitData.motionPrompt,
              durationSec: submitData.durationSec,
              aspectRatio: submitData.aspectRatio,
              variationSeed: submitData.variationSeed,
              persisted: true,
              provider: 'runway',
            }));
            return;
          }
          if (resp.status === 'FAILED') {
            const msg = resp.error ?? 'Runway 비디오 생성에 실패했습니다.';
            report('error', 0, msg);
            finish(() => reject(new Error(msg)));
            return;
          }
        } catch {
          // ignore — DB poll and realtime are still running
        }
        scheduleNext();
      };
      const scheduleNext = () => {
        if (settled) return;
        runwayPollTimer = setTimeout(runwayPoll, RUNWAY_POLL_FALLBACK_INTERVAL_MS);
      };
      runwayPoll();
    };
    setTimeout(startRunwayPollFallback, RUNWAY_POLL_FALLBACK_START_MS);

    // Soft warning at 120s — don't reject, just inform the user
    let softWarnTimer: ReturnType<typeof setTimeout> | null = setTimeout(() => {
      if (settled) return;
      const elapsedSec = Math.round((Date.now() - startTime) / 1000);
      report('generating', 0.85, `렌더링이 조금 오래 걸리고 있어요 (${elapsedSec}초). 백그라운드에서 계속 진행 중입니다...`);
    }, REALTIME_SOFT_WARN_MS);

    // Overall timeout — 5 minutes. Don't orphan the job; inform the user.
    timeoutTimer = setTimeout(() => {
      const msg = `비디오 생성이 5분을 초과했습니다. 서버에서는 계속 렌더링 중일 수 있어요. 잠시 후 이 페이지를 다시 방문하면 완성된 영상을 확인할 수 있습니다.`;
      report('error', 0, msg);
      finish(() => reject(new Error(msg)));
    }, REALTIME_TIMEOUT_MS);

    // Initial DB check in case the webhook already completed before we subscribed
    checkDb();
    checkScanVideoUrl();
  });
}

/**
 * Stage 1: Submit a fast draft video (low-res, 3sec) and wait for it via Realtime.
 * Returns as soon as the draft is ready so the user can preview it immediately.
 */
export async function submitVideoDraft(
  prompt: string,
  options: GenerateAiVideoOptions,
  onProgress?: (progress: VideoGenProgress) => void,
): Promise<VideoGenResult> {
  return generateAiVideo(prompt, { ...options, draft: true }, onProgress);
}

/**
 * Stage 2: Submit an HD upgrade job for an existing draft and return immediately
 * with the HD task ID. The caller should then call subscribeHdUpgrade to listen
 * for completion and swap the video URL when ready.
 */
export async function upgradeVideoToHd(
  scanId: string,
  draftJobId: string,
  prompt: string,
  options: GenerateAiVideoOptions,
): Promise<{ hdTaskId: string; hdJobId: string }> {
  const { data, error } = await supabase.functions.invoke('generate-video', {
    body: {
      mode: 'submit',
      prompt,
      durationSec: options.durationSec ?? 5,
      aspectRatio: options.aspectRatio ?? '9:16',
      productName: options.productName,
      scanId,
      variationSeed: options.variationSeed ?? 0,
      bgmMood: options.bgmMood,
      captionText: options.captionText,
      platform: options.platform ?? 'shorts',
      hookCategory: options.hookCategory ?? 'curiosity',
      cutCount: options.cutCount,
      productVision: options.productVision ?? null,
      draft: false,
      isCleanVideoMode: options.isCleanVideoMode ?? false,
      promptStrength: options.promptStrength,
      negativePrompt: options.negativePrompt,
      bgStyle: options.bgStyle,
      outfitIntensity: options.outfitIntensity,
      zoomSpeed: options.zoomSpeed,
      cameraRotation: options.cameraRotation,
      transitionEffect: options.transitionEffect,
      stylePreset: options.stylePreset,
      detailRestoration: options.detailRestoration,
      hdUpscale: true,
      qualityTier: 'pro',
      resolution: options.resolution ?? '1080p',
      fps: options.fps ?? 30,
    },
  });

  if (error) throw await buildVideoFunctionError(error);
  if (!data || typeof data.taskId !== 'string') {
    throw new Error('서버가 HD 작업 ID를 반환하지 않았습니다.');
  }

  const hdTaskId = data.taskId as string;

  // Record the HD task on the existing video_jobs row
  try {
    await supabase
      .from('video_jobs')
      .update({ hd_task_id: hdTaskId, hd_status: 'PENDING' })
      .eq('scan_id', scanId)
      .eq('task_id', draftJobId);
  } catch {
    // non-fatal — the HD job still runs on Runway's side
  }

  return { hdTaskId, hdJobId: hdTaskId };
}

export type HdUpgradeCallback = (result: { status: 'SUCCESS' | 'FAILED'; videoUrl?: string; error?: string }) => void;

/**
 * Subscribe to the HD upgrade job via Supabase Realtime. Calls the callback
 * when the hd_status column transitions to SUCCESS or FAILED. Returns an
 * unsubscribe function.
 */
export function subscribeHdUpgrade(
  scanId: string,
  draftJobId: string,
  callback: HdUpgradeCallback,
): () => void {
  let settled = false;
  let pollTimer: ReturnType<typeof setInterval> | null = null;

  const checkAndNotify = async () => {
    if (settled) return;
    try {
      const { data, error } = await supabase
        .from('video_jobs')
        .select('hd_status, hd_video_url, error_message')
        .eq('scan_id', scanId)
        .eq('task_id', draftJobId)
        .maybeSingle();
      if (error || !data) return;
      const row = data as VideoJobRow;
      if (row.hd_status === 'SUCCESS' && row.hd_video_url) {
        settled = true;
        cleanup();
        callback({ status: 'SUCCESS', videoUrl: row.hd_video_url });
      } else if (row.hd_status === 'FAILED') {
        settled = true;
        cleanup();
        callback({ status: 'FAILED', error: row.error_message ?? 'HD 업그레이드에 실패했습니다.' });
      }
    } catch {
      // ignore
    }
  };

  const channel = supabase
    .channel(`hd-upgrade:${scanId}:${draftJobId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'video_jobs', filter: `scan_id=eq.${scanId}` },
      (payload) => {
        if (!payload.new) return;
        const row = payload.new as VideoJobRow;
        if (row.hd_status === 'SUCCESS' && row.hd_video_url) {
          if (settled) return;
          settled = true;
          cleanup();
          callback({ status: 'SUCCESS', videoUrl: row.hd_video_url });
        } else if (row.hd_status === 'FAILED') {
          if (settled) return;
          settled = true;
          cleanup();
          callback({ status: 'FAILED', error: row.error_message ?? 'HD 업그레이드에 실패했습니다.' });
        }
      },
    )
    .subscribe();

  const cleanup = () => {
    supabase.removeChannel(channel);
    if (pollTimer) clearInterval(pollTimer);
  };

  // Safety-net poll every 5s
  pollTimer = setInterval(checkAndNotify, FALLBACK_POLL_INTERVAL_MS);

  // Initial check
  checkAndNotify();

  return () => {
    settled = true;
    cleanup();
  };
}

/**
 * Check the database for a previously-submitted video job that may have
 * completed after the client timed out or the user navigated away.
 * Returns the video URL if the job is already done, or null if it's still
 * pending or was never submitted. Also checks scans.video_url as a fallback
 * since the webhook writes there too.
 */
export async function recoverVideoJob(
  scanId: string,
): Promise<{ videoUrl: string; isHd: boolean; status: string } | null> {
  try {
    const { data, error } = await supabase
      .from('video_jobs')
      .select('status, video_url, error_message, is_hd, hd_status, hd_video_url')
      .eq('scan_id', scanId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      // Fallback: check scans.video_url directly
      const { data: scanData } = await supabase
        .from('scans')
        .select('video_url')
        .eq('id', scanId)
        .maybeSingle();
      if (scanData?.video_url) {
        return { videoUrl: scanData.video_url, isHd: false, status: 'SUCCESS' };
      }
      return null;
    }

    const row = data as VideoJobRow & { is_hd?: boolean };

    // Check HD result first (if HD was requested)
    if (row.hd_status === 'SUCCESS' && row.hd_video_url) {
      return { videoUrl: row.hd_video_url, isHd: true, status: 'SUCCESS' };
    }

    // Check standard result
    if (row.status === 'SUCCESS' && row.video_url) {
      return { videoUrl: row.video_url, isHd: row.is_hd ?? false, status: 'SUCCESS' };
    }

    if (row.status === 'FAILED') {
      return { videoUrl: '', isHd: false, status: 'FAILED' };
    }

    return null;
  } catch {
    return null;
  }
}

