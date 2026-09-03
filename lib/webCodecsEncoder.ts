/**
 * WebCodecs-based video encoder.
 *
 * Unlike MediaRecorder (which captures frames in real-time and is subject to
 * background-tab throttling), this encoder draws frames deterministically:
 * the caller controls exactly when each frame is drawn and at what timestamp.
 * The encoder then uses VideoEncoder + webm-muxer to produce the final WebM.
 *
 * This eliminates the root cause of "frozen frame" / "single color" videos:
 * no matter what the browser does to timers, only frames we explicitly submit
 * end up in the output.
 */

import { Muxer, ArrayBufferTarget as MuxerArrayBufferTarget } from 'webm-muxer';

export type WebCodecsEncoderResult = {
  blob: Blob;
  mimeType: string;
  width: number;
  height: number;
  durationMs: number;
  frameCount: number;
};

export function isWebCodecsSupported(): boolean {
  return typeof (window as any).VideoEncoder !== 'undefined' &&
    typeof (window as any).VideoFrame !== 'undefined';
}

export function isWebCodecsEncoderConfigSupported(width: number, height: number): boolean {
  if (!isWebCodecsSupported()) return false;
  try {
    const testEncoder = new (window as any).VideoEncoder({ output: () => {}, error: () => {} });
    testEncoder.configure({
      codec: 'vp9',
      width,
      height,
      bitrate: 6_000_000,
      framerate: 30,
    });
    testEncoder.close();
    return true;
  } catch {
    return false;
  }
}

type EncodeCallbacks = {
  onProgress?: (pct: number) => void;
  signal?: AbortSignal;
};

/**
 * Encode a sequence of canvas frames into a WebM video.
 *
 * The caller provides a `drawFrame` function that draws a single frame at
 * a given progress (0..1) onto the provided canvas context. This function
 * handles the encoding pipeline:
 *
 * 1. Create a VideoEncoder with VP9 (or VP8 fallback)
 * 2. For each frame: draw it, create a VideoFrame, encode it, await completion
 * 3. Flush, finalize muxer, return Blob
 *
 * Because we control the timing of each frame submission, browser throttling
 * cannot inject empty/duplicate frames. The output is deterministic.
 */
export async function encodeCanvasToWebM(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
  fps: number,
  durationMs: number,
  drawFrame: (ctx: CanvasRenderingContext2D, progress: number, frameIndex: number) => void,
  callbacks?: EncodeCallbacks,
): Promise<WebCodecsEncoderResult> {
  const { onProgress, signal } = callbacks ?? {};

  if (!isWebCodecsSupported()) {
    throw new Error('WebCodecs가 지원되지 않는 브라우저입니다.');
  }

  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D 컨텍스트를 생성할 수 없습니다.');

  const totalFrames = Math.max(1, Math.ceil((durationMs / 1000) * fps));
  const frameDurationUs = Math.round(1_000_000 / fps);

  const muxer = new Muxer({
    target: new MuxerArrayBufferTarget(),
    video: {
      codec: 'V_VP9',
      width,
      height,
      frameRate: fps,
    },
  });

  let codec = 'vp9';
  let encoderConfig: Record<string, unknown> = {
    codec: 'vp9',
    width,
    height,
    bitrate: 6_000_000,
    framerate: fps,
  };

  let encoder: any;
  try {
    encoder = new (window as any).VideoEncoder({
      output: (chunk: any, metadata: any) => muxer.addVideoChunk(chunk, metadata),
      error: (e: Error) => { throw e; },
    });
    encoder.configure(encoderConfig);
  } catch {
    try {
      codec = 'vp8';
      encoderConfig = { ...encoderConfig, codec: 'vp8' };
      encoder = new (window as any).VideoEncoder({
        output: (chunk: any, metadata: any) => muxer.addVideoChunk(chunk, metadata),
        error: (e: Error) => { throw e; },
      });
      encoder.configure(encoderConfig);
    } catch {
      throw new Error('VideoEncoder 설정에 실패했습니다. 브라우저가 VP9/VP8을 지원하지 않을 수 있습니다.');
    }
  }

  let encodedFrames = 0;
  let encodeError: Error | null = null;

  const checkEncodeQueue = (): Promise<void> => {
    return new Promise((resolve) => {
      if (encoder.encodeQueueSize === 0) {
        resolve();
        return;
      }
      const check = () => {
        if (encodeError) { resolve(); return; }
        if (encoder.encodeQueueSize <= 2) {
          resolve();
        } else {
          setTimeout(check, 1);
        }
      };
      check();
    });
  };

  for (let i = 0; i < totalFrames; i++) {
    if (signal?.aborted) {
      try { encoder.close(); } catch {}
      throw new Error('렌더링이 취소되었습니다.');
    }

    const progress = totalFrames === 1 ? 1 : i / (totalFrames - 1);
    drawFrame(ctx, progress, i);

    const timestamp = i * frameDurationUs;
    const frame = new (window as any).VideoFrame(canvas, {
      timestamp,
      duration: frameDurationUs,
    });

    encoder.encode(frame, { keyFrame: i === 0 || i % (fps * 2) === 0 });
    frame.close();

    encodedFrames++;
    if (onProgress && i % 3 === 0) {
      onProgress(Math.round((i / totalFrames) * 100));
    }

    if (i % 8 === 0) {
      await checkEncodeQueue();
    }
  }

  onProgress?.(95);

  await new Promise<void>((resolve, reject) => {
    const check = () => {
      if (encodeError) { reject(encodeError); return; }
      if (encoder.encodeQueueSize === 0) {
        resolve();
      } else {
        setTimeout(check, 2);
      }
    };
    check();
  });

  try { encoder.close(); } catch {}

  onProgress?.(98);

  muxer.finalize();

  const { buffer } = muxer.target as unknown as { buffer: ArrayBuffer };
  const blob = new Blob([buffer], { type: 'video/webm' });

  onProgress?.(100);

  return {
    blob,
    mimeType: 'video/webm',
    width,
    height,
    durationMs,
    frameCount: encodedFrames,
  };
}
