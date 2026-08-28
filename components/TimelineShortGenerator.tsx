import { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import {
  Film,
  Download,
  Loader as Loader2,
  Play,
  RefreshCw,
  CircleAlert as AlertCircle,
  Clock,
  Baby,
  CloudUpload,
} from 'lucide-react-native';
import { theme } from '@/lib/theme';
import { getDisclosureShortForPlatforms } from '@/lib/disclosure';
import { uploadAssetBlob, saveAssetRecord } from '@/lib/savedAssets';
import { urlToDataUrl } from '@/lib/base64';
import { getLogoUrl, drawLogoWatermark } from '@/lib/logoWatermark';
import { drawRoamingBabyWithLink, preloadBabyImage, getBabyImageSync } from '@/lib/canvasOverlay';
import { getUserSettings } from '@/lib/settings';
import { friendlyError } from '@/lib/errors';
import { RoamingBabyOverlay } from '@/components/RoamingBabyOverlay';
import { VideoProgressIndicator } from '@/components/VideoProgressIndicator';
import { TemplateBadge } from '@/components/TemplateBadge';
import { useHybridTemplate } from '@/hooks/useHybridTemplate';
import type { PlatformKey } from '@/types/database';

interface TimelineShortGeneratorProps {
  imageUrl: string;
  hook: string;
  title: string;
  hashtags: string[];
  accentColor: string;
  fileName: string;
  affiliatePlatforms?: string[];
  platform?: PlatformKey;
  shortUrl?: string;
  productAdvantages?: string[];
  oneLiner?: string;
}

type TimelineMode = '30s' | '60s';
type GenState = 'idle' | 'generating' | 'done' | 'error';

const FPS = 30;
const CANVAS_W = 1080;
const CANVAS_H = 1920;

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}
function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

function roundRect(ctx: any, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawTextLines(
  ctx: any,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
) {
  const chars = Array.from(text);
  let line = '';
  let currentY = y;
  for (const char of chars) {
    if (char === '\n') {
      ctx.fillText(line, x, currentY);
      line = '';
      currentY += lineHeight;
      continue;
    }
    const testLine = line + char;
    if (ctx.measureText(testLine).width > maxWidth && line !== '') {
      ctx.fillText(line, x, currentY);
      line = char;
      currentY += lineHeight;
    } else {
      line = testLine;
    }
  }
  if (line) ctx.fillText(line, x, currentY);
  return currentY;
}

function loadImage(url: string, timeoutMs = 10000): Promise<any> {
  return new Promise((resolve, reject) => {
    const img = new (window as any).Image();
    if (!url.startsWith('data:')) img.crossOrigin = 'anonymous';
    const timer = setTimeout(() => {
      img.src = '';
      reject(new Error('이미지 로드 시간 초과'));
    }, timeoutMs);
    img.onload = () => {
      clearTimeout(timer);
      resolve(img);
    };
    img.onerror = () => {
      clearTimeout(timer);
      reject(new Error('이미지 로드 실패'));
    };
    img.src = url;
  });
}

function drawBabyOnCanvas(
  ctx: any,
  cx: number,
  cy: number,
  scale: number,
  _crawlPhase: number,
  _color: string,
) {
  const img = getBabyImageSync();
  const size = 48 * scale;
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

function drawBabyBadge(
  ctx: any,
  cx: number,
  cy: number,
  scale: number,
  crawlPhase: number,
  color: string,
  label: string,
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
  drawBabyOnCanvas(ctx, cx, cy - 4 * scale, scale * 0.55, crawlPhase, color);

  ctx.fillStyle = color;
  ctx.font = `700 ${14 * scale}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(label, cx, cy + 22 * scale);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.restore();
}

interface TimelinePhase {
  start: number;
  end: number;
  label: string;
}

const TIMELINE_30S: TimelinePhase[] = [
  { start: 0, end: 5, label: '훅' },
  { start: 5, end: 20, label: '본론' },
  { start: 20, end: 30, label: '클로징' },
];

const TIMELINE_60S: TimelinePhase[] = [
  { start: 0, end: 10, label: '문제 제기' },
  { start: 10, end: 40, label: '해결 & 시연' },
  { start: 40, end: 60, label: '결과 & 혜택' },
];

export function TimelineShortGenerator(props: TimelineShortGeneratorProps) {
  if (Platform.OS !== 'web') {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Clock size={18} color={theme.colors.warning[400]} strokeWidth={2} />
            <Text style={styles.headerTitle}>30초/60초 타임라인 숏폼</Text>
          </View>
        </View>
        <View style={styles.unsupportedBox}>
          <AlertCircle size={16} color={theme.colors.warning[400]} strokeWidth={2} />
          <Text style={styles.unsupportedText}>
            타임라인 숏폼 생성은 브라우저(웹)에서 지원됩니다. 스마트폰 앱에서는 일반 클립 생성을 이용해주세요.
          </Text>
        </View>
      </View>
    );
  }
  return <WebTimelineGenerator {...props} />;
}

function WebTimelineGenerator({
  imageUrl,
  hook,
  title,
  hashtags,
  accentColor,
  fileName,
  affiliatePlatforms = [],
  platform = 'shortform',
  shortUrl = '',
  productAdvantages = [],
  oneLiner = '',
}: TimelineShortGeneratorProps) {
  const [state, setState] = useState<GenState>('idle');
  const [progress, setProgress] = useState(0);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [mode, setMode] = useState<TimelineMode>('30s');
  const [cloudSaving, setCloudSaving] = useState(false);
  const [videoMime, setVideoMime] = useState('video/webm');
  const rafRef = useRef<number | null>(null);
  const tpl = useHybridTemplate(
    { category: null, platform: platform as string, productName: title, fallbackHook: hook, fallbackHashtags: hashtags, fallbackAccentColor: accentColor, fallbackCardStyle: 'bold' },
    accentColor,
    'bold',
    'upbeat',
  );

  const duration = mode === '30s' ? 30000 : 60000;
  const phases = mode === '30s' ? TIMELINE_30S : TIMELINE_60S;
  const phasesKey = mode;

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  }, []);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  useEffect(() => {
    return () => {
      setVideoUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    };
  }, []);

  const generateClip = useCallback(async () => {
    setState('generating');
    setProgress(0);
    if (videoUrl) {
      URL.revokeObjectURL(videoUrl);
      setVideoUrl(null);
    }

    try {
      if (!imageUrl) throw new Error('이미지가 준비되지 않았어요');
      await preloadBabyImage().catch(() => {});
      const settingsData = await getUserSettings().catch(() => null);
      const mascotEnabled = settingsData?.mascot_enabled ?? true;
      const autoDisclosure = settingsData?.auto_disclosure ?? true;
      const safeImageUrl = await urlToDataUrl(imageUrl);
      const canvas = document.createElement('canvas');
      canvas.width = CANVAS_W;
      canvas.height = CANVAS_H;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('canvas unsupported');

      const img = await loadImage(safeImageUrl);

      const logoUrl = await getLogoUrl();
      let logoImg: any = null;
      if (logoUrl) {
        try {
          const safeLogo = await urlToDataUrl(logoUrl);
          logoImg = await loadImage(safeLogo);
        } catch { /* skip logo */ }
      }

      const hasRecorder = typeof (window as any).MediaRecorder !== 'undefined' && typeof (canvas as any).captureStream === 'function';
      let recorder: any = null;
      let mimeType = 'video/webm';
      let done: Promise<any> = Promise.resolve(new (window as any).Blob([], { type: 'image/png' }));

      if (hasRecorder) {
        const canvasStream = (canvas as any).captureStream(FPS);
        mimeType = (window as any).MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
          ? 'video/webm;codecs=vp9'
          : (window as any).MediaRecorder.isTypeSupported('video/webm;codecs=vp8')
            ? 'video/webm;codecs=vp8'
            : 'video/webm';
        recorder = new (window as any).MediaRecorder(canvasStream, {
          mimeType,
          videoBitsPerSecond: 6000000,
        });
        const chunks: any[] = [];
        recorder.ondataavailable = (e: any) => {
          if (e.data.size > 0) chunks.push(e.data);
        };
        done = new Promise<any>((resolve) => {
          recorder.onstop = () => resolve(new (window as any).Blob(chunks, { type: mimeType }));
        });
        recorder.start();
      }

      // Pre-build gradient
      const cachedGrad = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
      cachedGrad.addColorStop(0, 'rgba(10,15,30,0.2)');
      cachedGrad.addColorStop(0.45, 'rgba(10,15,30,0.55)');
      cachedGrad.addColorStop(1, 'rgba(10,15,30,0.92)');

      const startTime = performance.now();
      let lastPct = -1;

      const advantages = (productAdvantages && productAdvantages.length > 0)
        ? productAdvantages.slice(0, 3)
        : ['핵심 장점 1', '핵심 장점 2', '핵심 장점 3'];

      const drawImageCover = (scale: number, panY: number) => {
        const imgRatio = img.width / img.height;
        let drawW: number, drawH: number;
        if (imgRatio > CANVAS_W / CANVAS_H) {
          drawH = CANVAS_H * scale;
          drawW = drawH * imgRatio;
        } else {
          drawW = CANVAS_W * scale;
          drawH = drawW / imgRatio;
        }
        const px = (CANVAS_W - drawW) / 2;
        const py = (CANVAS_H - drawH) / 2 + panY;
        ctx.drawImage(img, px, py, drawW, drawH);
      };

      const drawFrame = () => {
        const elapsed = (performance.now() - startTime) / 1000;
        const t = Math.min(elapsed / (duration / 1000), 1);
        const pct = Math.round(t * 100);
        if (pct !== lastPct) {
          lastPct = pct;
          setProgress(pct);
        }

        const timeSec = elapsed;
        const totalSec = duration / 1000;

        // Background
        ctx.fillStyle = '#0a0f1e';
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

        // Determine current phase
        const currentPhase = phases.find((p) => timeSec >= p.start && timeSec < p.end) || phases[phases.length - 1];
        const phaseIdx = phases.indexOf(currentPhase);
        const phaseProgress = Math.min((timeSec - currentPhase.start) / (currentPhase.end - currentPhase.start), 1);

        // Phase-specific rendering
        if (mode === '30s') {
          draw30sFrame(ctx, img, drawImageCover, cachedGrad, timeSec, phaseIdx, phaseProgress, {
            hook, title, hashtags, accentColor, advantages, oneLiner, logoImg, shortUrl,
          });
        } else {
          draw60sFrame(ctx, img, drawImageCover, cachedGrad, timeSec, phaseIdx, phaseProgress, {
            hook, title, hashtags, accentColor, advantages, oneLiner, logoImg, shortUrl,
          });
        }

        // Timeline progress bar at top
        const barY = 8;
        const barH = 4;
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        roundRect(ctx, 60, barY, CANVAS_W - 120, barH, 2);
        ctx.fill();
        ctx.fillStyle = accentColor;
        roundRect(ctx, 60, barY, (CANVAS_W - 120) * t, barH, 2);
        ctx.fill();

        // Phase labels on timeline
        ctx.font = '500 16px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        phases.forEach((p, i) => {
          const phaseCenter = 60 + (CANVAS_W - 120) * ((p.start + p.end) / 2) / totalSec;
          const isActive = i === phaseIdx;
          ctx.globalAlpha = isActive ? 1 : 0.4;
          ctx.fillStyle = isActive ? accentColor : 'rgba(255,255,255,0.6)';
          ctx.fillText(p.label, phaseCenter, barY + 8);
        });
        ctx.globalAlpha = 1;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';

        // Disclosure at the very end (last 2 seconds, partial overlay so CTA stays visible)
        const disclosureStart = totalSec - 2;
        if (timeSec >= disclosureStart) {
          const dt = Math.min((timeSec - disclosureStart) / 0.5, 1);
          ctx.globalAlpha = dt * 0.75;
          ctx.fillStyle = '#0a0f1e';
          ctx.fillRect(0, CANVAS_H - 80, CANVAS_W, 80);
          ctx.fillStyle = 'rgba(255,255,255,0.85)';
          ctx.font = '400 16px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const disclosure = getDisclosureShortForPlatforms(affiliatePlatforms, autoDisclosure);
          ctx.fillText(disclosure, CANVAS_W / 2, CANVAS_H - 40);
          ctx.textAlign = 'left';
          ctx.textBaseline = 'alphabetic';
          ctx.globalAlpha = 1;
        }

        // Draw roaming baby + link sticker overlay into the video frame
        if (shortUrl) {
          drawRoamingBabyWithLink(ctx, elapsed * 1000, CANVAS_W, CANVAS_H, shortUrl, accentColor, mascotEnabled);
        }

        if (t < 1) {
          rafRef.current = requestAnimationFrame(drawFrame);
        } else {
          setTimeout(() => {
            if (recorder && recorder.state !== 'inactive') recorder.stop();
          }, 150);
        }
      };

      rafRef.current = requestAnimationFrame(drawFrame);

      if (hasRecorder) {
        const blob = await done;
        const url = URL.createObjectURL(blob);
        setVideoUrl(url);
        setVideoMime(mimeType);
      } else {
        await new Promise<void>((resolve) => setTimeout(resolve, duration + 200));
        const dataUrl = canvas.toDataURL('image/png');
        const blob = await (await fetch(dataUrl)).blob();
        const url = URL.createObjectURL(blob);
        setVideoUrl(url);
        setVideoMime('image/png');
      }
      setState('done');
      setProgress(100);
    } catch (err) {
      setState('error');
      showToast(friendlyError(err, '생성에 실패했어요. 다시 시도해주세요.'));
    }
  }, [imageUrl, hook, title, hashtags, accentColor, fileName, affiliatePlatforms, shortUrl, productAdvantages, oneLiner, duration, mode, phasesKey, videoUrl, showToast]);

  const handleDownload = useCallback(() => {
    if (!videoUrl) return;
    const a = document.createElement('a');
    a.href = videoUrl;
    const ext = videoMime.includes('png') ? 'png' : 'webm';
    a.download = fileName.replace(/\.png$|\.webm$/, '') + `-timeline-${mode}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast('다운로드를 시작했어요');
  }, [videoUrl, fileName, videoMime, mode, showToast]);

  const handleReset = useCallback(() => {
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    setVideoUrl(null);
    setState('idle');
    setProgress(0);
  }, [videoUrl]);

  const handleSaveToCloud = useCallback(async () => {
    if (!videoUrl) return;
    setCloudSaving(true);
    try {
      const res = await fetch(videoUrl);
      const blob = await res.blob();
      const ext = videoMime.includes('png') ? 'png' : 'webm';
      const cloudFileName = fileName.replace(/\.png$|\.webm$/, '') + `-timeline-${mode}-${Date.now()}.${ext}`;
      const fileUrl = await uploadAssetBlob(blob, cloudFileName, videoMime);
      if (!fileUrl) {
        showToast('클라우드 업로드 실패');
        setCloudSaving(false);
        return;
      }
      await saveAssetRecord({
        scan_id: null,
        asset_type: videoMime.includes('png') ? 'image' : 'video',
        title: title || '타임라인 숏폼',
        file_url: fileUrl,
        file_name: cloudFileName,
        file_size: blob.size,
        mime_type: videoMime,
        thumbnail_url: imageUrl,
        platform: platform,
        affiliate_platform: affiliatePlatforms.join(',') || null,
      });
      showToast('클라우드에 저장됐어요');
    } catch {
      showToast('저장 중 오류가 발생했어요');
    }
    setCloudSaving(false);
  }, [videoUrl, fileName, videoMime, mode, title, imageUrl, platform, affiliatePlatforms, showToast]);

  const modeConfig: Record<TimelineMode, { label: string; desc: string; phases: { label: string; time: string }[] }> = {
    '30s': {
      label: '30초',
      desc: '스토리텔링 + 제품 심층 소개',
      phases: [
        { label: '훅', time: '0~5초' },
        { label: '본론', time: '5~20초' },
        { label: '클로징', time: '20~30초' },
      ],
    },
    '60s': {
      label: '60초',
      desc: '리뷰형 + 상세 가이드',
      phases: [
        { label: '문제 제기', time: '0~10초' },
        { label: '해결 & 시연', time: '10~40초' },
        { label: '결과 & 혜택', time: '40~60초' },
      ],
    },
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Clock size={18} color={theme.colors.warning[400]} strokeWidth={2} />
          <Text style={styles.headerTitle}>30초/60초 타임라인 숏폼</Text>
        </View>
        {state === 'done' && (
          <TouchableOpacity onPress={handleReset} activeOpacity={0.7}>
            <RefreshCw size={16} color={theme.colors.dark.textDim} strokeWidth={2} />
          </TouchableOpacity>
        )}
      </View>

      <Text style={styles.description}>
        아기 캐릭터가 구석에서 튀어나와 제품을 소개하고, 타임라인에 맞춰 단계별로 장점을 짚어준 뒤 링크 버튼 위로 쏙 들어가 구매를 유도하는 숏폼을 만듭니다.
      </Text>

      {state === 'idle' && (
        <View>
          <TemplateBadge label={tpl.badgeLabel} />
          {/* Mode selector */}
          <View style={styles.modeSelector}>
            {(Object.keys(modeConfig) as TimelineMode[]).map((key) => {
              const cfg = modeConfig[key];
              const active = mode === key;
              return (
                <TouchableOpacity
                  key={key}
                  style={[styles.modeCard, active && styles.modeCardActive]}
                  onPress={() => setMode(key)}
                  activeOpacity={0.7}
                >
                  <View style={styles.modeCardHeader}>
                    <Clock size={16} color={active ? '#fff' : theme.colors.warning[400]} strokeWidth={2} />
                    <Text style={[styles.modeCardLabel, active && styles.modeCardLabelActive]}>
                      {cfg.label}
                    </Text>
                  </View>
                  <Text style={[styles.modeCardDesc, active && styles.modeCardDescActive]}>
                    {cfg.desc}
                  </Text>
                  <View style={styles.modePhaseRow}>
                    {cfg.phases.map((p, i) => (
                      <View key={i} style={[styles.modePhasePill, active && styles.modePhasePillActive]}>
                        <Text style={[styles.modePhaseText, active && styles.modePhaseTextActive]}>
                          {p.label}
                        </Text>
                        <Text style={[styles.modePhaseTime, active && styles.modePhaseTimeActive]}>
                          {p.time}
                        </Text>
                      </View>
                    ))}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Timeline visualization */}
          <View style={styles.timelinePreview}>
            <Text style={styles.timelinePreviewTitle}>타임라인 미리보기</Text>
            <View style={styles.timelineBar}>
              {phases.map((p, i) => {
                const widthPct = ((p.end - p.start) / (duration / 1000)) * 100;
                const colors = [theme.colors.primary[500], theme.colors.accent[500], theme.colors.warning[500]];
                return (
                  <View key={i} style={[styles.timelineSegment, { width: `${widthPct}%`, backgroundColor: colors[i] + '30', borderColor: colors[i] }]}>
                    <Text style={[styles.timelineSegmentLabel, { color: colors[i] }]}>
                      {p.label}
                    </Text>
                    <Text style={styles.timelineSegmentTime}>
                      {p.start}~{p.end}초
                    </Text>
                  </View>
                );
              })}
            </View>
            <View style={styles.babyHintRow}>
              <Baby size={14} color={theme.colors.primary[300]} strokeWidth={2} />
              <Text style={styles.babyHintText}>
                아기 캐릭터가 각 단계마다 움직이며 시선을 붙잡습니다
              </Text>
            </View>
          </View>

          <TouchableOpacity style={styles.generateButton} onPress={generateClip} activeOpacity={0.8}>
            <Film size={20} color="#fff" strokeWidth={2} />
            <Text style={styles.generateButtonText}>{mode === '30s' ? '30초 숏폼 만들기' : '60초 숏폼 만들기'}</Text>
          </TouchableOpacity>
        </View>
      )}

      {state === 'generating' && (
        <VideoProgressIndicator
          progress={progress}
          label="생성 중..."
          color={theme.colors.primary[400]}
          hint={mode === '30s' ? '아기 캐릭터가 훅 → 본론 → 클로징 순서로 움직이며 영상을 만들고 있어요' : '아기 캐릭터가 문제 제기 → 시연 → 결과 순서로 가이드하며 영상을 만들고 있어요'}
        />
      )}

      {state === 'done' && videoUrl && (
        <View style={styles.resultWrap}>
          <Text style={styles.doneNotice}>영상이 생성됐어요. 미리보기 후 저장하세요.</Text>
          <View style={styles.videoVerticalWrap}>
            {videoMime.includes('png') ? (
              // @ts-ignore
              <img src={videoUrl} style={styles.videoVertical} />
            ) : (
              // @ts-ignore
              <video src={videoUrl} style={styles.videoVertical} controls loop playsInline />
            )}
            {shortUrl && (
              <RoamingBabyOverlay linkUrl={shortUrl} containerWidth={280} containerHeight={400} />
            )}
          </View>
          <View style={styles.resultButtons}>
            <TouchableOpacity style={styles.downloadButton} onPress={handleDownload} activeOpacity={0.8}>
              <Download size={18} color="#fff" strokeWidth={2} />
              <Text style={styles.downloadButtonText}>다운로드</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cloudSaveButton}
              onPress={handleSaveToCloud}
              disabled={cloudSaving}
              activeOpacity={0.7}
            >
              {cloudSaving ? (
                <Loader2 size={16} color={theme.colors.primary[300]} strokeWidth={2} />
              ) : (
                <CloudUpload size={16} color={theme.colors.primary[300]} strokeWidth={2} />
              )}
              <Text style={styles.cloudSaveButtonText}>
                {cloudSaving ? '저장 중...' : '클라우드 저장'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.remakeButton} onPress={handleReset} activeOpacity={0.7}>
              <RefreshCw size={16} color={theme.colors.dark.textDim} strokeWidth={2} />
              <Text style={styles.remakeButtonText}>다시 만들기</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {state === 'error' && (
        <View style={styles.errorBox}>
          <AlertCircle size={16} color={theme.colors.error[400]} strokeWidth={2} />
          <Text style={styles.errorText}>생성 실패. 다시 시도해주세요.</Text>
        </View>
      )}

      {toast && (
        <View style={styles.toastBox}>
          <Play size={14} color={theme.colors.success[400]} strokeWidth={2} />
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      )}
    </View>
  );
}

interface FrameDrawParams {
  hook: string;
  title: string;
  hashtags: string[];
  accentColor: string;
  advantages: string[];
  oneLiner: string;
  logoImg: any;
  shortUrl: string;
}

function draw30sFrame(
  ctx: any,
  img: any,
  drawImageCover: (scale: number, panY: number) => void,
  cachedGrad: any,
  timeSec: number,
  phaseIdx: number,
  phaseProgress: number,
  params: FrameDrawParams,
) {
  const { hook, title, hashtags, accentColor, advantages, oneLiner, logoImg, shortUrl } = params;

  // Phase 0: Hook (0-5s) — baby pops from corner
  // Phase 1: Body (5-20s) — advantages displayed one by one, baby crawls around
  // Phase 2: Closing (20-30s) — baby moves to link point, CTA emphasis

  if (phaseIdx === 0) {
    // Hook phase: zoom-in on image, baby pops from bottom-left
    const t = phaseProgress;
    const scale = 1.05 + easeOutCubic(t) * 0.2;
    const panY = -easeOutCubic(t) * 30;
    ctx.globalAlpha = 1;
    drawImageCover(scale, panY);
    ctx.fillStyle = cachedGrad;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Hook text with bounce-in
    if (t > 0.1) {
      const hookT = Math.min((t - 0.1) / 0.4, 1);
      const hookAlpha = Math.min(hookT * 3, 1);
      const hookOffset = (1 - easeOutBack(Math.min(hookT, 1))) * 60;
      ctx.globalAlpha = hookAlpha;
      ctx.fillStyle = '#fff';
      ctx.font = '700 52px sans-serif';
      ctx.textBaseline = 'top';
      ctx.shadowColor = 'rgba(0,0,0,0.85)';
      ctx.shadowBlur = 12;
      ctx.shadowOffsetY = 3;
      drawTextLines(ctx, hook, 60, CANVAS_H * 0.68 + hookOffset, CANVAS_W - 120, 60);
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
      ctx.globalAlpha = 1;
    }

    // Baby pops from bottom-left corner
    const babyT = Math.min(t * 2, 1);
    const babyOffset = (1 - easeOutBack(babyT)) * 80;
    const babyY = CANVAS_H * 0.88 - babyOffset;
    const babyX = 80 + easeOutCubic(babyT) * 40;
    const crawlPhase = timeSec * 1.5;
    drawBabyBadge(ctx, babyX, babyY, 1.2, crawlPhase, accentColor, '이거 대박!');

    // Speech bubble from baby
    if (babyT > 0.5) {
      const bubbleAlpha = Math.min((babyT - 0.5) * 2, 1);
      ctx.globalAlpha = bubbleAlpha;
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      roundRect(ctx, babyX + 20, babyY - 60, 280, 50, 12);
      ctx.fill();
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 2;
      ctx.stroke();
      // Bubble tail
      ctx.beginPath();
      ctx.moveTo(babyX + 20, babyY - 15);
      ctx.lineTo(babyX + 10, babyY - 5);
      ctx.lineTo(babyX + 30, babyY - 10);
      ctx.fill();
      ctx.fillStyle = '#0a0f1e';
      ctx.font = '700 22px sans-serif';
      ctx.textBaseline = 'middle';
      ctx.fillText('이거 진짜 대박!', babyX + 35, babyY - 35);
      ctx.textBaseline = 'alphabetic';
      ctx.globalAlpha = 1;
    }

    if (logoImg) drawLogoWatermark(ctx, logoImg, CANVAS_W, CANVAS_H, 0.6);
  } else if (phaseIdx === 1) {
    // Body phase: show advantages one by one, baby crawls around
    const t = phaseProgress;
    const scale = 1.1 + easeInOutCubic(t) * 0.1;
    const panY = -easeInOutCubic(t) * 40;
    drawImageCover(scale, panY);
    ctx.fillStyle = cachedGrad;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Determine which advantage to show (3 advantages over 15 seconds = 5s each)
    const advIdx = Math.min(Math.floor(t * advantages.length), advantages.length - 1);
    const advT = (t * advantages.length) % 1;
    const advAlpha = Math.min(advT * 4, 1) * Math.min((1 - advT) * 4 + 0.3, 1);

    // Advantage card
    ctx.globalAlpha = advAlpha;
    const cardY = CANVAS_H * 0.55;
    ctx.fillStyle = 'rgba(10,15,30,0.85)';
    roundRect(ctx, 60, cardY, CANVAS_W - 120, 200, 16);
    ctx.fill();
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Advantage number
    ctx.fillStyle = accentColor;
    ctx.font = '700 28px sans-serif';
    ctx.textBaseline = 'top';
    ctx.fillText(`#${advIdx + 1}`, 84, cardY + 20);

    // Advantage text
    ctx.fillStyle = '#fff';
    ctx.font = '600 38px sans-serif';
    drawTextLines(ctx, advantages[advIdx] || '', 84, cardY + 60, CANVAS_W - 168, 50);
    ctx.globalAlpha = 1;

    // Baby crawls across the bottom, examining the product
    const babyX = 80 + easeInOutCubic(t) * (CANVAS_W - 200);
    const babyY = CANVAS_H * 0.86 + Math.sin(timeSec * 3) * 8;
    const crawlPhase = timeSec * 1.2;
    drawBabyBadge(ctx, babyX, babyY, 1.0, crawlPhase, accentColor, '구경중...');

    // Magnifying glass effect near baby
    const magX = babyX + 50;
    const magY = babyY - 30;
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(magX, magY, 18, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(magX + 13, magY + 13);
    ctx.lineTo(magX + 22, magY + 22);
    ctx.stroke();

    // One-liner at top
    if (oneLiner) {
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = '#fff';
      ctx.font = '500 28px sans-serif';
      ctx.textBaseline = 'top';
      drawTextLines(ctx, oneLiner, 60, CANVAS_H * 0.15, CANVAS_W - 120, 36);
      ctx.globalAlpha = 1;
    }

    if (logoImg) drawLogoWatermark(ctx, logoImg, CANVAS_W, CANVAS_H, 0.5);
  } else {
    // Closing phase: CTA + baby moves to link point
    const t = phaseProgress;
    const scale = 1.15 - easeOutCubic(t) * 0.1;
    drawImageCover(scale, 0);
    ctx.fillStyle = cachedGrad;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // CTA text
    const ctaAlpha = Math.min(t * 3, 1);
    ctx.globalAlpha = ctaAlpha;
    ctx.fillStyle = accentColor;
    ctx.font = '700 48px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.85)';
    ctx.shadowBlur = 12;
    ctx.fillText('지금 바로 특가로!', CANVAS_W / 2, CANVAS_H * 0.4);
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#fff';
    ctx.font = '600 36px sans-serif';
    ctx.fillText(title, CANVAS_W / 2, CANVAS_H * 0.47);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.globalAlpha = 1;

    // Link button
    const btnY = CANVAS_H * 0.72;
    const btnW = CANVAS_W - 200;
    const btnH = 80;
    const btnX = 100;
    ctx.globalAlpha = ctaAlpha;
    ctx.fillStyle = accentColor;
    roundRect(ctx, btnX, btnY, btnW, btnH, 16);
    ctx.fill();

    // Pulsing border
    const pulse = Math.sin(timeSec * 4) * 0.3 + 0.7;
    ctx.strokeStyle = `rgba(255,255,255,${pulse})`;
    ctx.lineWidth = 3;
    roundRect(ctx, btnX, btnY, btnW, btnH, 16);
    ctx.stroke();

    ctx.fillStyle = '#fff';
    ctx.font = '700 32px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('지금 구매하기', CANVAS_W / 2, btnY + btnH / 2);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.globalAlpha = 1;

    // Baby crawls toward the link button and "dives in"
    const babyStartX = 80;
    const babyEndX = CANVAS_W / 2;
    const babyStartY = CANVAS_H * 0.88;
    const babyEndY = btnY + btnH / 2;
    const babyT = Math.min(t * 1.5, 1);
    const babyX = babyStartX + easeInOutCubic(babyT) * (babyEndX - babyStartX);
    const babyY = babyStartY + easeInOutCubic(babyT) * (babyEndY - babyStartY);

    // Baby shrinks as it "enters" the button
    const babyScale = 1.2 - easeOutCubic(babyT) * 0.8;
    const babyAlpha = babyT < 0.7 ? 1 : Math.max(0, 1 - (babyT - 0.7) / 0.3);
    ctx.globalAlpha = babyAlpha;
    const crawlPhase = timeSec * 2;
    drawBabyBadge(ctx, babyX, babyY, babyScale, crawlPhase, accentColor, '구매!');
    ctx.globalAlpha = 1;

    // Short URL
    if (shortUrl) {
      ctx.globalAlpha = ctaAlpha * 0.7;
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.font = '400 20px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(shortUrl, CANVAS_W / 2, btnY + btnH + 30);
      ctx.textAlign = 'left';
      ctx.globalAlpha = 1;
    }

    // Hashtags
    if (hashtags.length > 0) {
      ctx.globalAlpha = ctaAlpha * 0.6;
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.font = '500 24px sans-serif';
      ctx.textAlign = 'center';
      const tagText = hashtags.slice(0, 5).map((h) => `#${h}`).join(' ');
      drawTextLines(ctx, tagText, CANVAS_W / 2, CANVAS_H * 0.55, CANVAS_W - 120, 30);
      ctx.textAlign = 'left';
      ctx.globalAlpha = 1;
    }
  }
}

function draw60sFrame(
  ctx: any,
  img: any,
  drawImageCover: (scale: number, panY: number) => void,
  cachedGrad: any,
  timeSec: number,
  phaseIdx: number,
  phaseProgress: number,
  params: FrameDrawParams,
) {
  const { hook, title, hashtags, accentColor, advantages, oneLiner, logoImg, shortUrl } = params;

  // Phase 0: Problem (0-10s) — baby points out everyday inconvenience
  // Phase 1: Solution & Demo (10-40s) — product demo, baby crawls providing guidance
  // Phase 2: Result & Benefits (40-60s) — final preview + limited offer + sticker link

  if (phaseIdx === 0) {
    // Problem phase: dim image, baby highlights the problem
    const t = phaseProgress;
    const scale = 1.0 + easeOutCubic(t) * 0.08;
    drawImageCover(scale, -easeOutCubic(t) * 15);

    // Darker overlay for "problem" mood
    ctx.fillStyle = 'rgba(10,15,30,0.65)';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Problem text
    const textAlpha = Math.min(t * 3, 1);
    ctx.globalAlpha = textAlpha;
    ctx.fillStyle = '#fff';
    ctx.font = '700 44px sans-serif';
    ctx.textBaseline = 'top';
    ctx.shadowColor = 'rgba(0,0,0,0.85)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 3;
    drawTextLines(ctx, '이런 불편함 겪으신 적 있나요?', 60, CANVAS_H * 0.2, CANVAS_W - 120, 56);
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    // Sub-text
    ctx.font = '500 32px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    if (oneLiner) {
      drawTextLines(ctx, oneLiner, 60, CANVAS_H * 0.32, CANVAS_W - 120, 42);
    }
    ctx.globalAlpha = 1;

    // Baby at bottom looking concerned
    const babyX = CANVAS_W * 0.3 + Math.sin(timeSec * 0.8) * 20;
    const babyY = CANVAS_H * 0.85;
    const crawlPhase = timeSec * 0.8;
    drawBabyBadge(ctx, babyX, babyY, 1.1, crawlPhase, 'rgba(255,200,100,1)', '흠...');

    // Question marks floating
    for (let i = 0; i < 3; i++) {
      const qAlpha = 0.4 + Math.sin(timeSec * 2 + i * 1.5) * 0.3;
      const qY = babyY - 60 - i * 30 - Math.sin(timeSec * 2 + i) * 10;
      ctx.globalAlpha = qAlpha;
      ctx.fillStyle = 'rgba(255,200,100,0.8)';
      ctx.font = '700 36px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText('?', babyX + 30 + i * 20, qY);
      ctx.textAlign = 'left';
    }
    ctx.globalAlpha = 1;
    ctx.textBaseline = 'alphabetic';

    if (logoImg) drawLogoWatermark(ctx, logoImg, CANVAS_W, CANVAS_H, 0.5);
  } else if (phaseIdx === 1) {
    // Solution & Demo: show product with advantages, baby crawls as guide
    const t = phaseProgress;
    const scale = 1.05 + easeInOutCubic(t) * 0.15;
    const panY = -easeInOutCubic(t) * 50;
    drawImageCover(scale, panY);
    ctx.fillStyle = cachedGrad;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // 3 advantages over 30 seconds = 10s each
    const advIdx = Math.min(Math.floor(t * advantages.length), advantages.length - 1);
    const advT = (t * advantages.length) % 1;
    const advAlpha = Math.min(advT * 3, 1) * Math.min((1 - advT) * 3 + 0.3, 1);

    // Section title
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = accentColor;
    ctx.font = '700 30px sans-serif';
    ctx.textBaseline = 'top';
    ctx.fillText('이렇게 해결해요', 60, CANVAS_H * 0.12);
    ctx.globalAlpha = 1;

    // Advantage card
    ctx.globalAlpha = advAlpha;
    const cardY = CANVAS_H * 0.52;
    ctx.fillStyle = 'rgba(10,15,30,0.88)';
    roundRect(ctx, 60, cardY, CANVAS_W - 120, 220, 16);
    ctx.fill();
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Step number circle
    ctx.fillStyle = accentColor;
    ctx.beginPath();
    ctx.arc(110, cardY + 40, 24, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = '700 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(advIdx + 1), 110, cardY + 40);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    // Advantage text
    ctx.fillStyle = '#fff';
    ctx.font = '600 36px sans-serif';
    drawTextLines(ctx, advantages[advIdx] || '', 150, cardY + 20, CANVAS_W - 240, 48);

    // Hook text at bottom
    if (advIdx === 0 && hook) {
      ctx.font = '500 26px sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      drawTextLines(ctx, hook, 84, cardY + 120, CANVAS_W - 168, 34);
    }
    ctx.globalAlpha = 1;

    // Baby crawls across as a guide
    const babyX = 80 + easeInOutCubic(t) * (CANVAS_W - 200);
    const babyY = CANVAS_H * 0.82 + Math.sin(timeSec * 2.5) * 6;
    const crawlPhase = timeSec * 1.0;
    drawBabyBadge(ctx, babyX, babyY, 0.9, crawlPhase, accentColor, '가이드');

    // Guide arrow from baby to advantage card
    if (advAlpha > 0.3) {
      ctx.globalAlpha = advAlpha * 0.5;
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      ctx.moveTo(babyX, babyY - 30);
      ctx.lineTo(babyX, cardY + 220);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }

    ctx.textBaseline = 'alphabetic';
    if (logoImg) drawLogoWatermark(ctx, logoImg, CANVAS_W, CANVAS_H, 0.4);
  } else {
    // Result & Benefits: final preview + limited offer + sticker link
    const t = phaseProgress;
    const scale = 1.2 - easeOutCubic(t) * 0.15;
    drawImageCover(scale, 0);
    ctx.fillStyle = cachedGrad;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    const alpha = Math.min(t * 2, 1);
    ctx.globalAlpha = alpha;

    // "완성된 숏폼 미리보기" label
    ctx.fillStyle = accentColor;
    ctx.font = '700 32px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('최종 완성!', CANVAS_W / 2, CANVAS_H * 0.15);

    // Title
    ctx.fillStyle = '#fff';
    ctx.font = '700 44px sans-serif';
    ctx.shadowColor = 'rgba(0,0,0,0.85)';
    ctx.shadowBlur = 12;
    ctx.fillText(title, CANVAS_W / 2, CANVAS_H * 0.22);
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    // Hashtags
    if (hashtags.length > 0) {
      ctx.font = '500 26px sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      const tagText = hashtags.slice(0, 6).map((h) => `#${h}`).join(' ');
      drawTextLines(ctx, tagText, CANVAS_W / 2, CANVAS_H * 0.35, CANVAS_W - 120, 34);
    }

    // Limited offer badge
    const badgeY = CANVAS_H * 0.48;
    const pulse = Math.sin(timeSec * 3) * 0.15 + 0.85;
    ctx.globalAlpha = alpha * pulse;
    ctx.fillStyle = theme.colors.warning[500];
    roundRect(ctx, CANVAS_W / 2 - 180, badgeY, 360, 60, 30);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = '700 28px sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText('한정판 특가', CANVAS_W / 2, badgeY + 30);
    ctx.textBaseline = 'top';
    ctx.globalAlpha = alpha;

    // Link button
    const btnY = CANVAS_H * 0.62;
    const btnW = CANVAS_W - 200;
    const btnH = 90;
    const btnX = 100;
    ctx.fillStyle = accentColor;
    roundRect(ctx, btnX, btnY, btnW, btnH, 16);
    ctx.fill();

    const borderPulse = Math.sin(timeSec * 4) * 0.3 + 0.7;
    ctx.strokeStyle = `rgba(255,255,255,${borderPulse})`;
    ctx.lineWidth = 3;
    roundRect(ctx, btnX, btnY, btnW, btnH, 16);
    ctx.stroke();

    ctx.fillStyle = '#fff';
    ctx.font = '700 34px sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText('스티커 링크로 즉시 구매', CANVAS_W / 2, btnY + btnH / 2);
    ctx.textBaseline = 'alphabetic';

    // Baby dives into the link button
    const babyStartX = CANVAS_W * 0.2;
    const babyEndX = CANVAS_W / 2;
    const babyStartY = CANVAS_H * 0.88;
    const babyEndY = btnY + btnH / 2;
    const babyT = Math.min(t * 1.3, 1);
    const babyX = babyStartX + easeInOutCubic(babyT) * (babyEndX - babyStartX);
    const babyY = babyStartY + easeInOutCubic(babyT) * (babyEndY - babyStartY);
    const babyScale = 1.1 - easeOutCubic(babyT) * 0.7;
    const babyAlpha = babyT < 0.75 ? 1 : Math.max(0, 1 - (babyT - 0.75) / 0.25);
    ctx.globalAlpha = alpha * babyAlpha;
    const crawlPhase = timeSec * 2;
    drawBabyBadge(ctx, babyX, babyY, babyScale, crawlPhase, accentColor, '구매!');

    // Short URL
    if (shortUrl) {
      ctx.globalAlpha = alpha * 0.7;
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.font = '400 22px sans-serif';
      ctx.fillText(shortUrl, CANVAS_W / 2, btnY + btnH + 30);
    }

    ctx.textAlign = 'left';
    ctx.globalAlpha = 1;
  }
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.dark.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    maxWidth: 500,
    alignSelf: 'center',
    width: '100%',
    ...theme.shadows.card,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTitle: {
    fontSize: theme.typography.body,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.dark.text,
  },
  description: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    marginBottom: theme.spacing.md,
    lineHeight: 20,
  },
  unsupportedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.colors.warning[500] + '15',
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
  },
  unsupportedText: {
    flex: 1,
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    lineHeight: 20,
  },
  modeSelector: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  modeCard: {
    flex: 1,
    backgroundColor: theme.colors.dark.surfaceLight,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    borderWidth: 1.5,
    borderColor: theme.colors.dark.border,
  },
  modeCardActive: {
    backgroundColor: theme.colors.warning[500] + '20',
    borderColor: theme.colors.warning[400],
  },
  modeCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  modeCardLabel: {
    fontSize: theme.typography.body,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.dark.text,
  },
  modeCardLabelActive: {
    color: '#fff',
  },
  modeCardDesc: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    marginBottom: theme.spacing.sm,
  },
  modeCardDescActive: {
    color: 'rgba(255,255,255,0.8)',
  },
  modePhaseRow: {
    flexDirection: 'row',
    gap: 4,
    flexWrap: 'wrap',
  },
  modePhasePill: {
    backgroundColor: theme.colors.dark.bg,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: theme.colors.dark.border,
  },
  modePhasePillActive: {
    backgroundColor: theme.colors.warning[500] + '30',
    borderColor: theme.colors.warning[400] + '60',
  },
  modePhaseText: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.textDim,
  },
  modePhaseTextActive: {
    color: theme.colors.warning[400],
  },
  modePhaseTime: {
    fontSize: 9,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textFaint,
  },
  modePhaseTimeActive: {
    color: 'rgba(255,255,255,0.5)',
  },
  timelinePreview: {
    backgroundColor: theme.colors.dark.surfaceLight,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  timelinePreviewTitle: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
    marginBottom: theme.spacing.sm,
  },
  timelineBar: {
    flexDirection: 'row',
    gap: 2,
    height: 56,
    marginBottom: theme.spacing.sm,
  },
  timelineSegment: {
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1.5,
    paddingHorizontal: 4,
  },
  timelineSegmentLabel: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.bold,
  },
  timelineSegmentTime: {
    fontSize: 9,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    marginTop: 2,
  },
  babyHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  babyHintText: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
  },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.warning[500],
    ...theme.shadows.card,
  },
  generateButtonText: {
    fontSize: theme.typography.body,
    fontFamily: theme.typography.fontFamily.bold,
    color: '#fff',
  },
  progressWrap: {
    gap: theme.spacing.sm,
  },
  progressBarBg: {
    height: 8,
    backgroundColor: theme.colors.dark.surfaceLight,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: theme.colors.warning[400],
    borderRadius: 4,
  },
  progressLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  progressText: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
  },
  progressHint: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textFaint,
    lineHeight: 16,
  },
  doneNotice: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.success[400],
    lineHeight: 20,
  },
  resultWrap: {
    gap: theme.spacing.md,
  },
  videoVerticalWrap: {
    position: 'relative',
    alignItems: 'center',
    borderRadius: theme.radius.md,
    overflow: 'hidden',
  },
  videoVertical: {
    width: 260,
    height: 462,
    borderRadius: theme.radius.md,
  },
  resultButtons: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    flexWrap: 'wrap',
  },
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primary[600],
    flex: 1,
    minWidth: 100,
  },
  downloadButtonText: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.bold,
    color: '#fff',
  },
  cloudSaveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.dark.surfaceLight,
    borderWidth: 1.5,
    borderColor: theme.colors.primary[400] + '40',
    flex: 1,
    minWidth: 100,
  },
  cloudSaveButtonText: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.primary[300],
  },
  remakeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.dark.surfaceLight,
  },
  remakeButtonText: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.colors.error[500] + '15',
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
  },
  errorText: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.error[400],
  },
  toastBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.colors.success[500] + '15',
    borderRadius: theme.radius.md,
    padding: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  toastText: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.success[400],
    flex: 1,
  },
});