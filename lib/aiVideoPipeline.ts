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
  imageUrl?: string;
  cutImages?: string[];
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
}

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1500;

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

  report('submitting', 0.05, 'AI 비디오 생성 요청 전송 중...');

  let lastErr: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const { data, error } = await supabase.functions.invoke('generate-video', {
        body: {
          prompt,
          imageUrl: options.imageUrl,
          cutImages: options.cutImages,
          durationSec: options.durationSec ?? 15,
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
        },
      });

      if (error) {
        throw new Error(error.message ?? '비디오 생성 실패');
      }

      if (!data || !data.videoUrl) {
        throw new Error('비디오 URL을 받지 못했습니다');
      }

      report('completed', 1.0, 'AI 비디오 생성 완료');

      return {
        videoUrl: data.videoUrl as string,
        jobId: data.jobId as string,
        motionPrompt: data.motionPrompt as string,
        durationSec: data.durationSec as number,
        aspectRatio: data.aspectRatio as string,
        variationSeed: data.variationSeed as number,
        persisted: (data.persisted as boolean) ?? false,
        provider: (data.provider as string) ?? 'unknown',
      };
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err));
      if (attempt < MAX_RETRIES) {
        report('generating', 0.1 + attempt * 0.05, `재시도 중 (${attempt + 1}/${MAX_RETRIES})...`);
        await delay(RETRY_DELAY_MS * (attempt + 1));
      }
    }
  }

  const msg = lastErr?.message ?? '비디오 생성 중 오류 발생';
  report('error', 0, msg);
  throw new Error(msg);
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

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
