import type { FrameRenderer } from './offlineVideoRenderer';

export interface ComicRenderPanel {
  imageUri: string;
  speech: string;
  sfx: string;
  emotion: string;
  episodeLabel?: string;
}

export interface ComicVideoOptions {
  panels: ComicRenderPanel[];
  durationSec: number;
  width: number;
  height: number;
  accentColor: string;
  episodeLabel?: string;
}

async function loadImage(uri: string): Promise<HTMLImageElement | null> {
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        if (img.complete && img.naturalWidth > 0) resolve(img);
        else reject(new Error('empty image'));
      };
      img.onerror = () => reject(new Error('image load failed'));
      img.src = uri;
    });
  } catch {
    return null;
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
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

function drawSpeechBubble(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  fontSize: number,
) {
  if (!text) return;
  ctx.font = `700 ${fontSize}px sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  const lines: string[] = [];
  let current = '';
  for (const ch of text) {
    if ((current + ch).length > 14) {
      lines.push(current);
      current = ch;
    } else {
      current += ch;
    }
  }
  if (current) lines.push(current);

  const lineH = fontSize + 8;
  const bubbleH = Math.max(lines.length * lineH + 24, 48);
  const bubbleW = maxWidth;
  const bubbleX = x;
  const bubbleY = y;

  ctx.globalAlpha = 0.95;
  ctx.fillStyle = '#FFFEF7';
  ctx.strokeStyle = '#2D1B3D';
  ctx.lineWidth = 4;
  ctx.beginPath();
  roundRect(ctx, bubbleX, bubbleY, bubbleW, bubbleH, 16);
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(bubbleX + bubbleW * 0.3, bubbleY + bubbleH);
  ctx.lineTo(bubbleX + bubbleW * 0.4, bubbleY + bubbleH + 20);
  ctx.lineTo(bubbleX + bubbleW * 0.5, bubbleY + bubbleH);
  ctx.closePath();
  ctx.fillStyle = '#FFFEF7';
  ctx.fill();

  ctx.fillStyle = '#2D1B3D';
  lines.slice(0, 5).forEach((line, i) => {
    ctx.fillText(line, bubbleX + 14, bubbleY + 12 + i * lineH);
  });
  ctx.globalAlpha = 1;
}

function drawSfxSticker(ctx: CanvasRenderingContext2D, sfx: string, x: number, y: number, alpha: number) {
  if (!sfx) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.rotate(-0.08);

  ctx.font = '900 28px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const padding = 16;
  const textW = ctx.measureText(sfx).width;
  const stickerW = textW + padding * 2;
  const stickerH = 44;

  ctx.fillStyle = '#FF6B35';
  ctx.strokeStyle = '#FFF';
  ctx.lineWidth = 4;
  ctx.beginPath();
  roundRect(ctx, -stickerW / 2, -stickerH / 2, stickerW, stickerH, 22);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#FFF';
  ctx.fillText(sfx, 0, 0);
  ctx.restore();
}

export async function createComicRenderFrame(opts: ComicVideoOptions): Promise<FrameRenderer> {
  const { panels, durationSec, width: W, height: H, accentColor, episodeLabel } = opts;

  const loadedImages = await Promise.all(panels.map((p) => loadImage(p.imageUri)));
  const totalPanels = panels.length;
  const panelDuration = durationSec / totalPanels;

  return (ctx: CanvasRenderingContext2D, globalT: number) => {
    const elapsedSec = globalT * durationSec;
    const panelIdx = Math.min(Math.floor(globalT * totalPanels), totalPanels - 1);
    const panelLocalT = (globalT * totalPanels) - panelIdx;
    const panel = panels[panelIdx];
    const img = loadedImages[panelIdx];

    const fadeIn = Math.min(panelLocalT * 6, 1);
    const fadeOut = Math.min((1 - panelLocalT) * 6, 1);
    const alpha = Math.min(fadeIn * fadeOut, 1);

    ctx.fillStyle = '#0F0F12';
    ctx.fillRect(0, 0, W, H);

    if (img) {
      const imgAspect = img.naturalWidth / img.naturalHeight;
      const canvasAspect = W / H;
      let drawW: number, drawH: number;
      if (imgAspect > canvasAspect) {
        drawW = W;
        drawH = W / imgAspect;
      } else {
        drawH = H;
        drawW = H * imgAspect;
      }
      const scale = 1.0 + panelLocalT * 0.1;
      const scaledW = drawW * scale;
      const scaledH = drawH * scale;
      const drawX = (W - scaledW) / 2;
      const drawY = (H - scaledH) / 2;

      ctx.globalAlpha = alpha;
      ctx.drawImage(img, drawX, drawY, scaledW, scaledH);
      ctx.globalAlpha = 1;
    } else {
      const grads = ['#1a1428', '#0a0f1e', '#1e0a0a', '#0f0f12', '#1e1410'];
      const grad = ctx.createLinearGradient(0, 0, W, H);
      grad.addColorStop(0, grads[panelIdx % grads.length]);
      grad.addColorStop(1, '#0F0F12');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
    }

    const vignette = ctx.createRadialGradient(W / 2, H / 2, W * 0.3, W / 2, H / 2, W * 0.75);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.5)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, W, H);

    if (episodeLabel || panel.episodeLabel) {
      const label = panel.episodeLabel || episodeLabel || '';
      ctx.globalAlpha = alpha * 0.8;
      ctx.font = '700 16px sans-serif';
      ctx.fillStyle = accentColor;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(label, 20, 20);
      ctx.globalAlpha = 1;
    }

    if (panel.emotion) {
      ctx.globalAlpha = alpha * 0.6;
      ctx.font = '600 14px sans-serif';
      ctx.fillStyle = '#FFF';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      ctx.fillText(`[${panel.emotion}]`, W - 20, 20);
      ctx.globalAlpha = 1;
    }

    const bubbleY = H * 0.55;
    ctx.globalAlpha = alpha;
    drawSpeechBubble(ctx, panel.speech, W * 0.08, bubbleY, W * 0.84, 22);
    ctx.globalAlpha = 1;

    drawSfxSticker(ctx, panel.sfx, W * 0.82, H * 0.25, alpha);

    const progressW = W * globalT;
    ctx.fillStyle = accentColor;
    ctx.globalAlpha = 0.7;
    ctx.fillRect(0, H - 4, progressW, 4);
    ctx.globalAlpha = 1;
  };
}
