/**
 * Canvas overlay utilities for drawing baby character and link sticker
 * directly into video frames during canvas recording.
 *
 * These functions are used by the web canvas-based video generators to
 * ensure the baby character and purchase link are permanently composited
 * into the output video file (not just DOM overlays).
 */

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

/**
 * Compute roaming baby position based on time progression.
 * The baby moves in a smooth pseudo-random path across the frame.
 */
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

/**
 * Draw a crawling baby character at the given position on a 2D canvas context.
 * Matches the visual style of the CrawlingBaby React component.
 */
export function drawBabyOnCanvas(
  ctx: any,
  cx: number,
  cy: number,
  scale: number,
  crawlPhase: number,
  color: string,
) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const bob = Math.sin(crawlPhase * Math.PI * 2) * 1.5;
  const armL = Math.sin(crawlPhase * Math.PI * 2) * 4;
  const armR = -armL;
  const legL = -armL;
  const legR = armL;
  const headBob = Math.sin(crawlPhase * Math.PI * 2 + 0.3) * 0.8;

  // Head
  ctx.beginPath();
  ctx.arc(24, 14 + headBob, 7, 0, Math.PI * 2);
  ctx.stroke();

  // Eyes
  ctx.beginPath();
  ctx.arc(21.5, 13 + headBob, 0.9, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(26.5, 13 + headBob, 0.9, 0, Math.PI * 2);
  ctx.fill();

  // Cheeks
  ctx.globalAlpha = 0.3;
  ctx.beginPath();
  ctx.arc(19, 16 + headBob, 1.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(29, 16 + headBob, 1.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // Smile
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(21, 15.5 + headBob);
  ctx.quadraticCurveTo(24, 18 + headBob, 27, 15.5 + headBob);
  ctx.stroke();
  ctx.lineWidth = 2;

  // Body
  ctx.beginPath();
  ctx.ellipse(24, 30 + bob, 12, 5, 0, 0, Math.PI * 2);
  ctx.stroke();

  // Arms
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(14, 28 + bob);
  ctx.quadraticCurveTo(10 + armL, 23 - armL, 12 + armL, 18 - armL);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(34, 28 + bob);
  ctx.quadraticCurveTo(38 + armR, 23 - armR, 36 + armR, 18 - armR);
  ctx.stroke();

  // Legs
  ctx.beginPath();
  ctx.moveTo(20, 35 + bob);
  ctx.quadraticCurveTo(17 + legL, 40 + legL, 15 + legL, 44 + legL);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(28, 35 + bob);
  ctx.quadraticCurveTo(31 + legR, 40 + legR, 33 + legR, 44 + legR);
  ctx.stroke();
  ctx.lineWidth = 2;

  ctx.restore();
}

/**
 * Draw a baby badge: white circle with baby inside, matching RoamingBabyOverlay style.
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

  drawBabyOnCanvas(ctx, cx - 24 * scale, cy - 24 * scale, scale * 0.7, crawlPhase, color);
  ctx.restore();
}

/**
 * Draw a link sticker pill: baby circle + "구매하기" label + arrow,
 * matching the RoamingBabyOverlay DOM component visual style.
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

  // Shadow
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

  // Pill background (with fallback for browsers without roundRect)
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

  // Baby circle inside
  const circleCx = x + padH + iconR;
  const circleCy = y + stickerH / 2;
  ctx.fillStyle = 'rgba(47,157,255,0.08)';
  ctx.beginPath();
  ctx.arc(circleCx, circleCy, iconR, 0, Math.PI * 2);
  ctx.fill();

  drawBabyOnCanvas(ctx, circleCx - 12 * scale, circleCy - 12 * scale, scale * 0.38, crawlPhase, color);

  // Label text
  const textX = x + padH + iconR * 2 + gap;
  ctx.fillStyle = '#1267e8';
  ctx.font = `600 ${labelFS}px sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.fillText(label, textX, y + stickerH / 2);

  // Arrow
  ctx.fillStyle = '#1267e8';
  ctx.font = `700 ${arrowFS}px sans-serif`;
  ctx.fillText('\u2192', textX + textW + gap, y + stickerH / 2);
  ctx.textBaseline = 'alphabetic';

  // Pulse dot
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

/**
 * Draw the short URL text below the link sticker.
 */
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

/**
 * Full roaming baby + link sticker overlay for a video frame.
 * Call this at the end of each frame draw, just before the recorder captures.
 */
export function drawRoamingBabyWithLink(
  ctx: any,
  elapsed: number,
  canvasW: number,
  canvasH: number,
  shortUrl: string,
  color: string,
): void {
  if (!shortUrl) return;

  const baby = computeBabyPosition(elapsed, canvasW, canvasH, canvasW, canvasH);
  const pulseT = (elapsed / 1000) * 0.7;

  // Draw link sticker
  drawLinkSticker(ctx, baby.x, baby.y, baby.scale, baby.crawlPhase, color, baby.alpha, pulseT);

  // Draw short URL text below
  drawShortUrlText(ctx, baby.x, baby.y + 50 * baby.scale, shortUrl, baby.alpha);
}

/**
 * Returns a JS string body that can be embedded in a WebView <script> to draw
 * the roaming baby + link overlay. This avoids duplicating the drawing logic
 * for the WebView-based mobile generators.
 */
export function getWebViewOverlayScript(): string {
  return `
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

  function __drawBabyOnCanvas(ctx, cx, cy, scale, crawlPhase, color) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    var bob = Math.sin(crawlPhase * Math.PI * 2) * 1.5;
    var armL = Math.sin(crawlPhase * Math.PI * 2) * 4;
    var armR = -armL;
    var legL = -armL;
    var legR = armL;
    var headBob = Math.sin(crawlPhase * Math.PI * 2 + 0.3) * 0.8;
    ctx.beginPath(); ctx.arc(24, 14 + headBob, 7, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(21.5, 13 + headBob, 0.9, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(26.5, 13 + headBob, 0.9, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 0.3;
    ctx.beginPath(); ctx.arc(19, 16 + headBob, 1.2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(29, 16 + headBob, 1.2, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(21, 15.5 + headBob);
    ctx.quadraticCurveTo(24, 18 + headBob, 27, 15.5 + headBob); ctx.stroke();
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(24, 30 + bob, 12, 5, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(14, 28 + bob);
    ctx.quadraticCurveTo(10 + armL, 23 - armL, 12 + armL, 18 - armL); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(34, 28 + bob);
    ctx.quadraticCurveTo(38 + armR, 23 - armR, 36 + armR, 18 - armR); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(20, 35 + bob);
    ctx.quadraticCurveTo(17 + legL, 40 + legL, 15 + legL, 44 + legL); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(28, 35 + bob);
    ctx.quadraticCurveTo(31 + legR, 40 + legR, 33 + legR, 44 + legR); ctx.stroke();
    ctx.lineWidth = 2;
    ctx.restore();
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
    __drawBabyOnCanvas(ctx, circleCx - 12 * scale, circleCy - 12 * scale, scale * 0.38, crawlPhase, color);
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