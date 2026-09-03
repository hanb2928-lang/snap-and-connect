/**
 * Browser-based video renderer using Canvas + MediaRecorder API.
 * Takes a stock video clip + edit plan and produces a rendered video with:
 * - Cut segments with text overlays
 * - Hook captions at timed intervals
 * - Last 2s reserved for affiliate CTA + FTC disclosure
 * - Zoom/pan motion effects
 */

import type { EditPlan, CutSegment } from '@/lib/videoEditPlan';
import type { StockVideoClip } from '@/lib/pexelsVideo';

export interface RenderOptions {
  clip: StockVideoClip;
  plan: EditPlan;
  ctaText?: string;
  disclosureText?: string;
  productName?: string;
  onProgress?: (progress: number) => void;
}

export interface RenderResult {
  blob: Blob;
  url: string;
  durationSec: number;
}

function getCanvasSize(ratio: string): { width: number; height: number } {
  if (ratio.includes('9:16')) return { width: 720, height: 1280 };
  if (ratio.includes('16:9')) return { width: 1280, height: 720 };
  return { width: 720, height: 720 };
}

function getActiveSegment(segments: CutSegment[], elapsedSec: number): CutSegment | null {
  for (const seg of segments) {
    if (elapsedSec >= seg.startSec && elapsedSec < seg.endSec) return seg;
  }
  return segments[segments.length - 1] || null;
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  fontSize: number,
  color: string,
  align: CanvasTextAlign = 'center',
  weight: string = '700',
  shadow: boolean = true,
) {
  ctx.save();
  ctx.font = `${weight} ${fontSize}px sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  if (shadow) {
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 2;
  }
  ctx.fillStyle = color;
  const lines = text.split('\n');
  lines.forEach((line, i) => {
    ctx.fillText(line, x, y + i * fontSize * 1.2);
  });
  ctx.restore();
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, w, h, r);
  } else {
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
}

function drawSegmentLabel(
  ctx: CanvasRenderingContext2D,
  segment: CutSegment,
  canvasW: number,
  canvasH: number,
) {
  const labelY = canvasH * 0.12;
  drawText(ctx, segment.label, canvasW / 2, labelY, 28, '#FFFFFF', 'center', '700');
  if (segment.purpose) {
    drawText(ctx, segment.purpose, canvasW / 2, labelY + 36, 18, 'rgba(255,255,255,0.75)', 'center', '500');
  }
}

function drawCtaSegment(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number,
  ctaText: string,
  disclosureText: string,
  productName: string,
  elapsedInSegment: number,
) {
  // Dark overlay
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.72)';
  ctx.fillRect(0, 0, canvasW, canvasH);
  ctx.restore();

  const fadeIn = Math.min(elapsedInSegment * 2, 1);
  ctx.save();
  ctx.globalAlpha = fadeIn;

  // Product name
  drawText(ctx, productName, canvasW / 2, canvasH * 0.35, 36, '#fbbf24', 'center', '700');

  // CTA pill
  const ctaY = canvasH * 0.48;
  const ctaFontSize = 24;
  ctx.font = `700 ${ctaFontSize}px sans-serif`;
  const ctaW = ctx.measureText(ctaText).width + 60;
  const ctaH = 54;
  const ctaX = (canvasW - ctaW) / 2;
  ctx.fillStyle = '#f59e0b';
  drawRoundedRect(ctx, ctaX, ctaY - ctaH / 2, ctaW, ctaH, ctaH / 2);
  ctx.fill();
  drawText(ctx, ctaText, canvasW / 2, ctaY, ctaFontSize, '#0a0f1e', 'center', '700', false);

  // Disclosure text
  const discY = canvasH * 0.62;
  drawText(ctx, disclosureText, canvasW / 2, discY, 16, 'rgba(255,255,255,0.7)', 'center', '400');

  ctx.restore();
}

function drawProgressBar(
  ctx: CanvasRenderingContext2D,
  elapsedSec: number,
  totalSec: number,
  canvasW: number,
  canvasH: number,
) {
  const barY = canvasH - 12;
  const barH = 4;
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.fillRect(0, barY, canvasW, barH);
  ctx.fillStyle = '#fbbf24';
  ctx.fillRect(0, barY, canvasW * (elapsedSec / totalSec), barH);
  ctx.restore();
}

export async function renderVideo(opts: RenderOptions): Promise<RenderResult> {
  const { clip, plan, ctaText, disclosureText, productName, onProgress } = opts;
  const cta = ctaText || '지금 바로 확인 →';
  const disclosure = disclosureText || '이 포스팅은 제휴마케팅이 포함된 광고입니다.';
  const pName = productName || '제품';

  const { width: canvasW, height: canvasH } = getCanvasSize(clip.ratio);
  const totalSec = plan.duration;
  const fps = 30;

  // Create canvas
  const canvas = document.createElement('canvas');
  canvas.width = canvasW;
  canvas.height = canvasH;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('Canvas 2D 컨텍스트를 생성할 수 없습니다.');

  // Load video with retry
  const video = document.createElement('video');
  video.crossOrigin = 'anonymous';
  video.muted = true;
  video.playsInline = true;
  video.loop = true;

  const loadVideoOnce = (url: string, timeoutMs: number): Promise<void> => {
    return new Promise((resolve, reject) => {
      const v = document.createElement('video');
      v.crossOrigin = 'anonymous';
      v.muted = true;
      v.playsInline = true;
      v.loop = true;
      const loadTimeout = setTimeout(() => {
        v.onerror = null;
        v.onloadeddata = null;
        reject(new Error('영상 로딩 시간 초과'));
      }, timeoutMs);
      v.onloadeddata = () => { clearTimeout(loadTimeout); resolve(); };
      v.onerror = () => { clearTimeout(loadTimeout); reject(new Error('원본 영상을 불러올 수 없습니다.')); };
      v.src = url;
    });
  };

  let videoLoaded = false;
  for (let attempt = 0; attempt < 3 && !videoLoaded; attempt++) {
    try {
      await loadVideoOnce(clip.videoUrl, 30000);
      videoLoaded = true;
    } catch (e) {
      if (attempt === 2) throw e;
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
  video.src = clip.videoUrl;

  // Setup MediaRecorder
  const stream = canvas.captureStream(fps);
  const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
    ? 'video/webm;codecs=vp9'
    : MediaRecorder.isTypeSupported('video/webm;codecs=vp8')
      ? 'video/webm;codecs=vp8'
      : 'video/webm';

  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: 4_000_000,
  });

  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  const donePromise = new Promise<Blob>((resolve, reject) => {
    const stopTimeout = setTimeout(() => reject(new Error('영상 인코딩 시간 초과')), 180000);
    recorder.onstop = () => {
      clearTimeout(stopTimeout);
      resolve(new Blob(chunks, { type: mimeType }));
    };
    recorder.onerror = () => {
      clearTimeout(stopTimeout);
      reject(new Error('영상 인코딩 중 오류가 발생했습니다.'));
    };
  });

  await video.play().catch((playErr) => {
    throw new Error(`영상 재생을 시작할 수 없습니다: ${playErr instanceof Error ? playErr.message : '알 수 없는 오류'}`);
  });
  recorder.start(100);

  const startTime = performance.now();
  const totalMs = totalSec * 1000;

  // Render loop
  await new Promise<void>((resolve) => {
    function renderFrame() {
      const elapsed = performance.now() - startTime;
      const elapsedSec = elapsed / 1000;

      if (elapsed >= totalMs) {
        if (recorder.state === 'recording') recorder.stop();
        video.pause();
        resolve();
        return;
      }

      if (video.paused || video.readyState < 2) {
        requestAnimationFrame(renderFrame);
        return;
      }

      // Calculate zoom/pan based on motion preset
      const zoomCycle = (elapsedSec * 0.3) % 1;
      const zoomFactor = 1.05 + easeInOut(Math.sin(zoomCycle * Math.PI)) * 0.08;

      // Draw video frame with cover-fit + zoom
      ctx!.fillStyle = '#000';
      ctx!.fillRect(0, 0, canvasW, canvasH);

      const vw = video.videoWidth || canvasW;
      const vh = video.videoHeight || canvasH;
      const scale = Math.max(canvasW / vw, canvasH / vh) * zoomFactor;
      const dw = vw * scale;
      const dh = vh * scale;
      const dx = (canvasW - dw) / 2 + Math.sin(elapsedSec * 0.4) * 10;
      const dy = (canvasH - dh) / 2;

      ctx!.drawImage(video, dx, dy, dw, dh);

      // Get active segment
      const segment = getActiveSegment(plan.segments, elapsedSec);
      if (!segment) {
        requestAnimationFrame(renderFrame);
        return;
      }

      const isCtaSegment = segment.label.includes('CTA') && segment.startSec >= totalSec - 2;
      const elapsedInSegment = elapsedSec - segment.startSec;

      if (isCtaSegment) {
        drawCtaSegment(ctx!, canvasW, canvasH, cta, disclosure, pName, elapsedInSegment);
      } else {
        // Draw segment label with fade in/out
        const segDuration = segment.endSec - segment.startSec;
        const segProgress = elapsedInSegment / segDuration;
        let labelAlpha = 1;
        if (segProgress < 0.15) labelAlpha = segProgress / 0.15;
        else if (segProgress > 0.85) labelAlpha = (1 - segProgress) / 0.15;

        ctx!.save();
        ctx!.globalAlpha = Math.max(0, Math.min(1, labelAlpha));
        drawSegmentLabel(ctx!, segment, canvasW, canvasH);
        ctx!.restore();

        // Draw hook text from first copy variant during first 3 seconds
        if (elapsedSec < 3 && plan.copyVariants[0]?.hook) {
          const hookAlpha = elapsedSec < 0.5 ? elapsedSec * 2 : 1;
          ctx!.save();
          ctx!.globalAlpha = hookAlpha;
          drawText(ctx!, plan.copyVariants[0].hook, canvasW / 2, canvasH * 0.82, 26, '#FFE082', 'center', '700');
          ctx!.restore();
        }
      }

      // Progress bar
      drawProgressBar(ctx!, elapsedSec, totalSec, canvasW, canvasH);

      // Report progress
      if (onProgress) onProgress(elapsed / totalMs);

      requestAnimationFrame(renderFrame);
    }
    renderFrame();
  });

  const blob = await donePromise;
  const url = URL.createObjectURL(blob);

  return { blob, url, durationSec: totalSec };
}

export function downloadRenderedVideo(url: string, filename: string) {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export function isVideoRenderingSupported(): boolean {
  if (typeof document === 'undefined') return false;
  if (typeof MediaRecorder === 'undefined') return false;
  const canvas = document.createElement('canvas');
  return typeof canvas.captureStream === 'function';
}
