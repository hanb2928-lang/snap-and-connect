import { Muxer, ArrayBufferTarget } from 'webm-muxer';

export type FrameRenderer = (ctx: CanvasRenderingContext2D, globalT: number) => void;

export interface OfflineRenderOptions {
  canvas: HTMLCanvasElement;
  fps: number;
  durationSec: number;
  bitrate: number;
  renderFrame: FrameRenderer;
  onProgress?: (progress: number) => void;
  signal?: { cancelled: boolean };
}

export interface OfflineRenderResult {
  blob: Blob;
  mimeType: string;
  durationSec: number;
  frameCount: number;
}

function pickVideoCodec(): string {
  const candidates = [
    'vp09.00.10.08',
    'vp09.00.10.00',
    'vp8',
    'avc1.42001f',
  ];
  for (const c of candidates) {
    try {
      if (typeof VideoEncoder !== 'undefined') {
        return c;
      }
    } catch {
      // try next
    }
  }
  return 'vp09.00.10.08';
}

export async function renderVideoOffline(opts: OfflineRenderOptions): Promise<OfflineRenderResult> {
  const { canvas, fps, durationSec, bitrate, renderFrame, onProgress, signal } = opts;
  const W = canvas.width;
  const H = canvas.height;

  if (typeof VideoEncoder === 'undefined' || typeof VideoFrame === 'undefined') {
    throw new Error('이 브라우저는 WebCodecs API를 지원하지 않습니다. Chrome 최신 버전을 사용해주세요.');
  }

  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('캔버스 2D 컨텍스트를 생성할 수 없습니다.');

  const totalFrames = Math.ceil(durationSec * fps);
  const frameDurationUs = Math.round(1_000_000 / fps);
  const codec = pickVideoCodec();

  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: {
      codec: 'V_VP9',
      width: W,
      height: H,
      frameRate: fps,
    },
    firstTimestampBehavior: 'offset',
  });

  let encoderError: Error | null = null;
  const encodedChunks: Array<{ chunk: EncodedVideoChunk; meta?: EncodedVideoChunkMetadata }> = [];

  const encoder = new VideoEncoder({
    output: (chunk, meta) => {
      encodedChunks.push({ chunk, meta });
    },
    error: (e) => {
      encoderError = e;
    },
  });

  encoder.configure({
    codec,
    width: W,
    height: H,
    bitrate,
    framerate: fps,
  });

  // Encode frames sequentially — no real-time constraint
  for (let i = 0; i < totalFrames; i++) {
    if (signal?.cancelled) {
      encoder.close();
      throw new Error('렌더링이 취소되었습니다.');
    }
    if (encoderError) {
      encoder.close();
      throw encoderError;
    }

    const globalT = i / totalFrames;

    // Draw frame to canvas
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, W, H);
    renderFrame(ctx, globalT);

    // Create VideoFrame from canvas
    const frame = new VideoFrame(canvas, {
      timestamp: i * frameDurationUs,
      duration: frameDurationUs,
    });

    encoder.encode(frame, { keyFrame: i % fps === 0 });
    frame.close();

    // Drain encoder periodically to avoid memory buildup
    if (encodedChunks.length > 0 && (i + 1) % 10 === 0) {
      await encoder.flush();
      // Feed all buffered chunks to muxer
      while (encodedChunks.length > 0) {
        const { chunk, meta } = encodedChunks.shift()!;
        muxer.addVideoChunk(chunk, meta);
      }
    }

    if (onProgress) {
      onProgress(Math.round((i / totalFrames) * 100));
    }

    // Yield to event loop every frame to keep UI responsive
    await new Promise<void>((r) => setTimeout(r, 0));
  }

  // Flush remaining frames
  await encoder.flush();
  while (encodedChunks.length > 0) {
    const { chunk, meta } = encodedChunks.shift()!;
    muxer.addVideoChunk(chunk, meta);
  }

  encoder.close();
  muxer.finalize();

  if (encoderError) throw encoderError;

  const target = muxer.target as ArrayBufferTarget;
  if (!target.buffer || target.buffer.byteLength < 1000) {
    throw new Error('영상 인코딩에 실패했습니다. 브라우저 호환성 문제일 수 있습니다.');
  }

  const blob = new Blob([target.buffer], { type: 'video/webm' });

  if (onProgress) onProgress(100);

  return {
    blob,
    mimeType: 'video/webm',
    durationSec,
    frameCount: totalFrames,
  };
}

export function isOfflineRenderingSupported(): boolean {
  return typeof VideoEncoder !== 'undefined' && typeof VideoFrame !== 'undefined';
}
