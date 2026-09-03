/**
 * Canvas overlay utilities for drawing baby character and link sticker
 * directly into video frames during canvas recording.
 *
 * The baby character is now rendered from a realistic 3D image asset
 * instead of vector drawing.
 */

const BABY_IMAGE_SRC = '/baby-crawl.webp';

let babyImageCache: HTMLImageElement | null = null;
let babyLoadPromise: Promise<HTMLImageElement> | null = null;

export function getBabyImageUrl(): string {
  return BABY_IMAGE_SRC;
}

export async function preloadBabyImage(): Promise<HTMLImageElement> {
  if (babyImageCache && babyImageCache.complete) return babyImageCache;
  if (babyLoadPromise) return babyLoadPromise;

  babyLoadPromise = new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      babyImageCache = img;
      resolve(img);
    };
    img.onerror = () => reject(new Error('baby image load failed'));
    img.src = BABY_IMAGE_SRC;
  });

  return babyLoadPromise;
}

export function getBabyImageSync(): HTMLImageElement | null {
  return babyImageCache && babyImageCache.complete ? babyImageCache : null;
}

export interface BabyOverlayState {
  x: number;
  y: number;
  scale: number;
  crawlPhase: number;
  alpha: number;
}

export interface LinkStickerStyle {
  bg: string;
  border: string | null;
  labelColor: string;
  arrowColor: string;
  radius: number;
  paddingH: number;
  paddingV: number;
}

export function computeBabyPosition(
  elapsed: number,
  canvasW: number,
  canvasH: number,
  formatWidth: number,
  formatHeight: number,
): BabyOverlayState {
  const t = elapsed / 1000;

  const padding = 40;
  const stickerW = 200;
  const stickerH = 80;
  const maxX = Math.max(0, formatWidth - stickerW - padding * 2);
  const maxY = Math.max(0, formatHeight * 0.7 - stickerH - padding);

  const x = padding + (Math.sin(t * 0.9) * 0.4 + Math.sin(t * 1.8) * 0.3 + 0.5) * maxX;
  const y = padding + (Math.sin(t * 0.7 + 1) * 0.3 + Math.sin(t * 1.3 + 2) * 0.4 + 0.4) * maxY;

  const bob = Math.sin(t * 4) * 4;
  const scale = 1.5 + Math.sin(t * 1.5) * 0.08;
  const crawlPhase = t * 1.5;

  return { x, y: y + bob, scale, crawlPhase, alpha: 1 };
}

const BABY_NATIVE_SIZE = 128;

/**
 * Draw the baby image at the given position on a 2D canvas context.
 * Falls back to a simple circle if the image hasn't loaded yet.
 */
export function drawBabyOnCanvas(
  ctx: any,
  cx: number,
  cy: number,
  scale: number,
  _crawlPhase: number,
  _color: string,
) {
  const img = getBabyImageSync();
  const size = BABY_NATIVE_SIZE * scale * 0.5;

  ctx.save();
  if (img) {
    ctx.drawImage(img, cx - size / 2, cy - size / 2, size, size);
  } else {
    ctx.fillStyle = '#F4C4A8';
    ctx.beginPath();
    ctx.arc(cx, cy, size * 0.3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/**
 * Draw a baby badge: white circle with baby image inside.
 */
export function drawBabyBadge(
  ctx: any,
  cx: number,
  cy: number,
  scale: number,
  crawlPhase: number,
  color: string,
) {
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.beginPath();
  ctx.arc(cx, cy, 28 * scale, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2 * scale;
  ctx.stroke();

  const badgeSize = 36 * scale;
  drawBabyOnCanvas(ctx, cx - badgeSize / 2, cy - badgeSize / 2 - 4 * scale, scale * 0.55, crawlPhase, color);
  ctx.restore();
}

/**
 * Draw a link sticker pill: baby image + "구매하기" label + arrow.
 */
export function drawLinkSticker(
  ctx: any,
  x: number,
  y: number,
  scale: number,
  crawlPhase: number,
  color: string,
  alpha: number,
  pulseT: number,
) {
  ctx.save();
  ctx.globalAlpha = alpha;

  ctx.shadowColor = 'rgba(0,0,0,0.18)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 2;

  const label = '\uAD6C\uB9E4\uD558\uAE30';
  const labelFS = Math.round(10 * scale);
  const iconR = 16 * scale;
  const arrowFS = Math.round(9 * scale);
  const padH = 6 * scale;
  const padV = 4 * scale;
  const gap = 4 * scale;

  ctx.font = `600 ${labelFS}px sans-serif`;
  const textW = ctx.measureText(label).width;
  const arrowW = arrowFS * 0.8;
  const stickerW = padH + iconR * 2 + gap + textW + gap + arrowW + padH;
  const stickerH = padV * 2 + Math.max(iconR * 2, labelFS);

  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, stickerW, stickerH, stickerH / 2);
  } else {
    const r = stickerH / 2;
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + stickerW, y, x + stickerW, y + stickerH, r);
    ctx.arcTo(x + stickerW, y + stickerH, x, y + stickerH, r);
    ctx.arcTo(x, y + stickerH, x, y, r);
    ctx.arcTo(x, y, x + stickerW, y, r);
    ctx.closePath();
  }
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  const circleCx = x + padH + iconR;
  const circleCy = y + stickerH / 2;
  ctx.fillStyle = 'rgba(47,157,255,0.08)';
  ctx.beginPath();
  ctx.arc(circleCx, circleCy, iconR, 0, Math.PI * 2);
  ctx.fill();

  const babySize = iconR * 1.5;
  drawBabyOnCanvas(ctx, circleCx - babySize / 2, circleCy - babySize / 2, scale * 0.38, crawlPhase, color);

  const textX = x + padH + iconR * 2 + gap;
  ctx.fillStyle = '#1267e8';
  ctx.font = `600 ${labelFS}px sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.fillText(label, textX, y + stickerH / 2);

  ctx.fillStyle = '#1267e8';
  ctx.font = `700 ${arrowFS}px sans-serif`;
  ctx.fillText('\u2192', textX + textW + gap, y + stickerH / 2);
  ctx.textBaseline = 'alphabetic';

  const pulseScale = 1 + Math.sin(pulseT * Math.PI * 2) * 0.3;
  const pulseAlpha = 0.4 + Math.sin(pulseT * Math.PI * 2) * 0.4;
  ctx.globalAlpha = alpha * Math.max(0.2, pulseAlpha);
  ctx.fillStyle = '#22ccec';
  ctx.beginPath();
  ctx.arc(x + stickerW - 2, y - 2, 4 * scale * pulseScale, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1.5 * scale;
  ctx.stroke();

  ctx.globalAlpha = 1;
  ctx.restore();
}

export function drawShortUrlText(
  ctx: any,
  x: number,
  y: number,
  shortUrl: string,
  alpha: number,
) {
  if (!shortUrl) return;
  ctx.save();
  ctx.globalAlpha = alpha * 0.7;
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.font = '400 16px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(shortUrl, x, y);
  ctx.restore();
}

export function drawRoamingBabyWithLink(
  ctx: any,
  elapsed: number,
  canvasW: number,
  canvasH: number,
  shortUrl: string,
  color: string,
  enabled: boolean = true,
): void {
  if (!shortUrl || !enabled) return;

  const baby = computeBabyPosition(elapsed, canvasW, canvasH, canvasW, canvasH);
  const pulseT = (elapsed / 1000) * 0.7;

  drawLinkSticker(ctx, baby.x, baby.y, baby.scale, baby.crawlPhase, color, baby.alpha, pulseT);
  drawShortUrlText(ctx, baby.x, baby.y + 50 * baby.scale, shortUrl, baby.alpha);
}

/**
 * Returns a JS string body for WebView-based generators.
 * The baby image is loaded from the provided URL (babyImgUrl).
 */
export function getWebViewOverlayScript(babyImgUrl: string = '/baby-crawl.webp'): string {
  const isDataUrl = babyImgUrl.startsWith('data:');
  const staticUrl = babyImgUrl.replace(/[''\\\n\r\u2028\u2029]/g, '');
  return `
  var __babyImg = null;
  (function() {
    var src = (typeof P !== 'undefined' && P.babyImgUrl) || ${JSON.stringify(isDataUrl ? '' : staticUrl)};
    if (!src) return;
    var img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = function() { __babyImg = img; };
    img.onerror = function() { __babyImg = null; };
    img.src = src;
  })();

  function __computeBabyPosition(elapsed, W, H) {
    var t = elapsed / 1000;
    var padding = 40;
    var stickerW = 200;
    var stickerH = 80;
    var maxX = Math.max(0, W - stickerW - padding * 2);
    var maxY = Math.max(0, H * 0.7 - stickerH - padding);
    var x = padding + (Math.sin(t * 0.9) * 0.4 + Math.sin(t * 1.8) * 0.3 + 0.5) * maxX;
    var y = padding + (Math.sin(t * 0.7 + 1) * 0.3 + Math.sin(t * 1.3 + 2) * 0.4 + 0.4) * maxY;
    var bob = Math.sin(t * 4) * 4;
    var scale = 1.5 + Math.sin(t * 1.5) * 0.08;
    var crawlPhase = t * 1.5;
    return { x: x, y: y + bob, scale: scale, crawlPhase: crawlPhase, alpha: 1 };
  }

  function __drawBabyOnCanvas(ctx, cx, cy, scale) {
    if (__babyImg && __babyImg.complete) {
      var size = 64 * scale;
      ctx.drawImage(__babyImg, cx - size / 2, cy - size / 2, size, size);
    } else {
      ctx.fillStyle = '#F4C4A8';
      ctx.beginPath();
      ctx.arc(cx, cy, 12 * scale, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function __drawLinkSticker(ctx, x, y, scale, crawlPhase, color, alpha, pulseT) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.shadowColor = 'rgba(0,0,0,0.18)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 2;
    var label = '\\uAD6C\\uB9E4\\uD558\\uAE30';
    var labelFS = Math.round(10 * scale);
    var iconR = 16 * scale;
    var arrowFS = Math.round(9 * scale);
    var padH = 6 * scale;
    var padV = 4 * scale;
    var gap = 4 * scale;
    ctx.font = '600 ' + labelFS + 'px sans-serif';
    var textW = ctx.measureText(label).width;
    var arrowW = arrowFS * 0.8;
    var stickerW = padH + iconR * 2 + gap + textW + gap + arrowW + padH;
    var stickerH = padV * 2 + Math.max(iconR * 2, labelFS);
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.beginPath();
    if (ctx.roundRect) { ctx.roundRect(x, y, stickerW, stickerH, stickerH / 2); }
    else {
      var r = stickerH / 2;
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + stickerW, y, x + stickerW, y + stickerH, r);
      ctx.arcTo(x + stickerW, y + stickerH, x, y + stickerH, r);
      ctx.arcTo(x, y + stickerH, x, y, r);
      ctx.arcTo(x, y, x + stickerW, y, r);
      ctx.closePath();
    }
    ctx.fill();
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    var circleCx = x + padH + iconR;
    var circleCy = y + stickerH / 2;
    ctx.fillStyle = 'rgba(47,157,255,0.08)';
    ctx.beginPath(); ctx.arc(circleCx, circleCy, iconR, 0, Math.PI * 2); ctx.fill();
    var babySize = iconR * 1.5;
    __drawBabyOnCanvas(ctx, circleCx, circleCy, scale * 0.38);
    var textX = x + padH + iconR * 2 + gap;
    ctx.fillStyle = '#1267e8';
    ctx.font = '600 ' + labelFS + 'px sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, textX, y + stickerH / 2);
    ctx.fillStyle = '#1267e8';
    ctx.font = '700 ' + arrowFS + 'px sans-serif';
    ctx.fillText('\\u2192', textX + textW + gap, y + stickerH / 2);
    ctx.textBaseline = 'alphabetic';
    var pulseScale = 1 + Math.sin(pulseT * Math.PI * 2) * 0.3;
    var pulseAlpha = 0.4 + Math.sin(pulseT * Math.PI * 2) * 0.4;
    ctx.globalAlpha = alpha * Math.max(0.2, pulseAlpha);
    ctx.fillStyle = '#22ccec';
    ctx.beginPath(); ctx.arc(x + stickerW - 2, y - 2, 4 * scale * pulseScale, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5 * scale; ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function __drawRoamingBabyWithLink(ctx, elapsed, W, H, shortUrl, color) {
    if (!shortUrl) return;
    var baby = __computeBabyPosition(elapsed, W, H, W, H);
    var pulseT = (elapsed / 1000) * 0.7;
    __drawLinkSticker(ctx, baby.x, baby.y, baby.scale, baby.crawlPhase, color, baby.alpha, pulseT);
    if (shortUrl) {
      ctx.save();
      ctx.globalAlpha = baby.alpha * 0.7;
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.font = '400 16px sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(shortUrl, baby.x, baby.y + 50 * baby.scale);
      ctx.textBaseline = 'alphabetic';
      ctx.restore();
    }
  }
  `;
}
