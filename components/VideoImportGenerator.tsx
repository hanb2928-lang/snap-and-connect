import { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, ScrollView } from 'react-native';
import { Film, Download, Loader as Loader2, Play, RefreshCw, CircleAlert as AlertCircle, Upload, Type, X, Check, Sparkles, Scissors, Image as ImageIcon } from 'lucide-react-native';
import { theme } from '@/lib/theme';
import { getDisclosureShortForPlatforms } from '@/lib/disclosure';
import { COPY_FUNCTION_URL, supabaseAnonKey } from '@/lib/supabase';
import { drawRoamingBabyWithLink, preloadBabyImage } from '@/lib/canvasOverlay';
import { getUserSettings } from '@/lib/settings';
import { VideoProgressIndicator } from '@/components/VideoProgressIndicator';
import { TemplateBadge } from '@/components/TemplateBadge';
import { useHybridTemplate } from '@/hooks/useHybridTemplate';

interface VideoImportGeneratorProps {
  affiliatePlatforms?: string[];
  shortUrl?: string;
  onClose: () => void;
}

interface AICopyItem {
  hook: string;
  caption: string;
}

type GenState = 'idle' | 'imported' | 'generating' | 'done' | 'error';
type VideoFormat = 'vertical' | 'horizontal';
type ImportType = 'video' | 'image';

const FORMATS: Record<VideoFormat, { width: number; height: number }> = {
  vertical: { width: 1080, height: 1920 },
  horizontal: { width: 1920, height: 1080 },
};

const FORMAT_PRESETS: { label: string; value: VideoFormat; aspect: string }[] = [
  { label: '세로형', value: 'vertical', aspect: '9:16' },
  { label: '가로형', value: 'horizontal', aspect: '16:9' },
];

const FONT_SIZES = [
  { label: '작게', value: 36 },
  { label: '보통', value: 48 },
  { label: '크게', value: 64 },
];

const DISCLOSURE_DURATION = 2;
const FPS = 30;
const HIGHLIGHT_TARGETS = [15, 20, 30];
const SAMPLE_W = 160;
const SAMPLE_H = 90;

function drawTextLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  align: CanvasTextAlign = 'left',
) {
  const chars = Array.from(text);
  let line = '';
  let currentY = y;
  ctx.textAlign = align;
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

export function VideoImportGenerator({ affiliatePlatforms = [], shortUrl = '', onClose }: VideoImportGeneratorProps) {
  const [state, setState] = useState<GenState>('idle');
  const [progress, setProgress] = useState(0);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [originalVideoUrl, setOriginalVideoUrl] = useState<string | null>(null);
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null);
  const [videoDuration, setVideoDuration] = useState(6);
  const [format, setFormat] = useState<VideoFormat>('vertical');
  const [hookText, setHookText] = useState('');
  const [subtitleText, setSubtitleText] = useState('');
  const [hookFontSize, setHookFontSize] = useState(48);
  const [subtitleFontSize, setSubtitleFontSize] = useState(36);
  const [outputUrl, setOutputUrl] = useState<string | null>(null);
  const [outputMime, setOutputMime] = useState('video/webm');
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiCopies, setAiCopies] = useState<AICopyItem[] | null>(null);
  const [aiError, setAiError] = useState(false);
  const [highlightMode, setHighlightMode] = useState(false);
  const [targetDuration, setTargetDuration] = useState(20);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeProgress, setAnalyzeProgress] = useState(0);
  const [highlightSegments, setHighlightSegments] = useState<{ start: number; end: number }[] | null>(null);
  const [importType, setImportType] = useState<ImportType>('video');
  const [imageElRef, setImageElRef] = useState<HTMLImageElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoElRef = useRef<HTMLVideoElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tpl = useHybridTemplate(
    { category: null, platform: 'shorts', fallbackHook: '', fallbackHashtags: [], fallbackAccentColor: theme.colors.primary[400], fallbackCardStyle: 'bold' },
    theme.colors.primary[400],
    'bold',
    'upbeat',
  );

  const urlsRef = useRef({ videoUrl, originalVideoUrl, outputUrl });
  urlsRef.current = { videoUrl, originalVideoUrl, outputUrl };
  useEffect(() => {
    return () => {
      const { videoUrl: v, originalVideoUrl: ov, outputUrl: o } = urlsRef.current;
      if (v) URL.revokeObjectURL(v);
      if (ov) URL.revokeObjectURL(ov);
      if (o) URL.revokeObjectURL(o);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      if (toastTimerRef.current !== null) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimerRef.current !== null) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 4000);
  }, []);

  const handleAiAutoEdit = useCallback(async () => {
    setAiGenerating(true);
    setAiError(false);
    setAiCopies(null);
    try {
      const response = await fetch(COPY_FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${supabaseAnonKey}`,
          apikey: supabaseAnonKey,
        },
        body: JSON.stringify({
          productName: '이 제품',
          productCategory: '숏폼',
          priceEstimate: '',
          oneLiner: '',
          productAdvantages: ['가성비'],
          copyType: 'viral',
          platform: 'shortform',
          count: 3,
        }),
      });
      if (!response.ok) throw new Error('AI 생성 실패');
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      setAiCopies((data.copies || []).map((c: any) => ({ hook: c.hook || '', caption: c.caption || '' })));
    } catch {
      setAiError(true);
    }
    setAiGenerating(false);
  }, []);

  const handleAnalyzeHighlights = useCallback(async () => {
    if (!videoUrl || Platform.OS !== 'web') return;
    setAnalyzing(true);
    setAnalyzeProgress(0);
    setHighlightSegments(null);

    const video = document.createElement('video');
    try {
      video.src = videoUrl;
      video.muted = true;
      video.playsInline = true;

      await new Promise<void>((resolve, reject) => {
        video.onloadeddata = () => resolve();
        video.onerror = () => reject(new Error('영상 로드 실패'));
      });

      const dur = video.duration;
      if (!isFinite(dur) || dur <= 0) throw new Error('영상 길이를 확인할 수 없습니다');

      const sampleCanvas = document.createElement('canvas');
      sampleCanvas.width = SAMPLE_W;
      sampleCanvas.height = SAMPLE_H;
      const sctx = sampleCanvas.getContext('2d');
      if (!sctx) throw new Error('canvas 미지원');

      const stepSec = 0.5;
      const samples: { time: number; score: number }[] = [];
      let prevData: Uint8ClampedArray | null = null;
      const totalSteps = Math.floor(dur / stepSec);

      for (let i = 0; i < totalSteps; i++) {
        const t = i * stepSec;
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(() => {
            video.removeEventListener('seeked', onSeeked);
            reject(new Error('영상 탐색 시간 초과'));
          }, 5000);
          const onSeeked = () => {
            clearTimeout(timer);
            video.removeEventListener('seeked', onSeeked);
            resolve();
          };
          video.addEventListener('seeked', onSeeked);
          video.currentTime = t;
        });

        sctx.drawImage(video, 0, 0, SAMPLE_W, SAMPLE_H);
        const curData = sctx.getImageData(0, 0, SAMPLE_W, SAMPLE_H).data;

        let diff = 0;
        if (prevData) {
          for (let j = 0; j < curData.length; j += 4) {
            diff += Math.abs(curData[j] - prevData[j])
                  + Math.abs(curData[j + 1] - prevData[j + 1])
                  + Math.abs(curData[j + 2] - prevData[j + 2]);
          }
          diff /= (SAMPLE_W * SAMPLE_H * 3);
        }

        samples.push({ time: t, score: diff });
        prevData = new Uint8ClampedArray(curData);
        setAnalyzeProgress(Math.round(((i + 1) / totalSteps) * 100));
      }

      const windowSec = 1.0;
      const windows: { start: number; score: number }[] = [];
      for (let ws = 0; ws + windowSec <= dur; ws += windowSec) {
        let score = 0;
        for (const s of samples) {
          if (s.time >= ws && s.time < ws + windowSec) score += s.score;
        }
        windows.push({ start: ws, score });
      }

      windows.sort((a, b) => b.score - a.score);
      const selected: { start: number; end: number }[] = [];
      let accumulated = 0;
      for (const w of windows) {
        if (accumulated >= targetDuration) break;
        const segDur = Math.min(windowSec, targetDuration - accumulated);
        const overlaps = selected.some(s => w.start < s.end && w.start + segDur > s.start);
        if (!overlaps) {
          selected.push({ start: w.start, end: w.start + segDur });
          accumulated += segDur;
        }
      }

      selected.sort((a, b) => a.start - b.start);

      const merged: { start: number; end: number }[] = [];
      for (const seg of selected) {
        const last = merged[merged.length - 1];
        if (last && seg.start <= last.end + 0.5) {
          last.end = Math.max(last.end, seg.end);
        } else {
          merged.push({ start: seg.start, end: seg.end });
        }
      }

      if (merged.length === 0) throw new Error('하이라이트 구간을 찾지 못했습니다');

      setHighlightSegments(merged);
      const totalSec = merged.reduce((sum, s) => sum + (s.end - s.start), 0);
      showToast(`${merged.length}개 하이라이트 구간 발견 (약 ${totalSec.toFixed(0)}초)`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '알 수 없는 오류';
      showToast('하이라이트 분석 실패: ' + msg);
    } finally {
      video.pause();
      video.removeAttribute('src');
      video.load();
    }
    setAnalyzing(false);
  }, [videoUrl, targetDuration, showToast]);

  const handlePickVideo = useCallback(async () => {
    if (Platform.OS !== 'web') {
      showToast('원본 영상 불러오기는 웹에서 지원됩니다');
      return;
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = importType === 'image' ? 'image/*' : 'video/*';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      if (file.size > 200 * 1024 * 1024) {
        showToast('200MB 이하의 파일만 지원됩니다');
        return;
      }
      const url = URL.createObjectURL(file);
      setVideoBlob(file);

      if (importType === 'image') {
        const img = new Image();
        img.onload = () => {
          setImageElRef(img);
          setVideoDuration(6);
          if (originalVideoUrl) URL.revokeObjectURL(originalVideoUrl);
          setOriginalVideoUrl(url);
          setVideoUrl(url);
          setState('imported');
          setError(null);
        };
        img.onerror = () => {
          showToast('이미지를 불러올 수 없습니다. 다른 파일을 시도해주세요');
          URL.revokeObjectURL(url);
        };
        img.src = url;
      } else {
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.src = url;
        video.onloadedmetadata = () => {
          const dur = video.duration;
          setVideoDuration(isFinite(dur) && dur > 0 ? Math.min(Math.round(dur), 60) : 6);
          if (originalVideoUrl) URL.revokeObjectURL(originalVideoUrl);
          setOriginalVideoUrl(url);
          setVideoUrl(url);
          setState('imported');
          setError(null);
        };
        video.onerror = () => {
          showToast('영상을 불러올 수 없습니다. 다른 파일을 시도해주세요');
          URL.revokeObjectURL(url);
        };
      }
    };
    input.click();
  }, [originalVideoUrl, showToast, importType]);

  const handleGenerate = useCallback(async () => {
    if (!videoUrl || !videoBlob) return;
    if (Platform.OS !== 'web') return;

    setState('generating');
    setProgress(0);
    setError(null);

    if (outputUrl) {
      URL.revokeObjectURL(outputUrl);
      setOutputUrl(null);
    }

    try {
      await preloadBabyImage().catch(() => {});
      const settingsData = await getUserSettings().catch(() => null);
      const mascotEnabled = settingsData?.mascot_enabled ?? true;
      const { width: W, height: H } = FORMATS[format];
      const canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('canvas를 지원하지 않습니다');

      canvasRef.current = canvas;

      const isImage = importType === 'image';
      let video: HTMLVideoElement | null = null;
      let img: HTMLImageElement | null = null;

      if (isImage) {
        img = imageElRef ?? new Image();
        if (img.src !== videoUrl) {
          img = new Image();
          img.crossOrigin = 'anonymous';
          img.src = videoUrl;
          await new Promise<void>((resolve, reject) => {
            img!.onload = () => resolve();
            img!.onerror = () => reject(new Error('이미지를 로드할 수 없습니다'));
          });
        }
      } else {
        video = document.createElement('video');
        video.src = videoUrl;
        video.muted = true;
        video.playsInline = true;
        if (!videoUrl.startsWith('blob:')) video.crossOrigin = 'anonymous';
        videoElRef.current = video;

        await new Promise<void>((resolve, reject) => {
          if (!video) { reject(new Error('영상을 로드할 수 없습니다')); return; }
          video.onloadeddata = () => resolve();
          video.onerror = () => reject(new Error('영상을 로드할 수 없습니다'));
        });
      }

      const segments = !isImage && highlightMode && highlightSegments ? highlightSegments : null;
      const contentDuration = isImage
        ? videoDuration
        : segments
          ? segments.reduce((sum, s) => sum + (s.end - s.start), 0)
          : videoDuration;
      const totalDuration = contentDuration + DISCLOSURE_DURATION;
      const disclosureStart = contentDuration;

      const hasRecorder = !isImage && typeof (window as any).MediaRecorder !== 'undefined' && typeof (canvas as any).captureStream === 'function';
      let recorder: any = null;
      let mimeType = 'video/webm';
      let done: Promise<any> = Promise.resolve(new Blob([], { type: 'video/webm' }));

      if (hasRecorder && video) {
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
          recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
        });
        recorder.start();
      }

      let segIdx = 0;
      if (video && segments && segments.length > 0) {
        video.currentTime = segments[0].start;
      } else if (video) {
        video.currentTime = 0;
      }
      if (video) await video.play();

      const startTime = performance.now();
      let segStartPerf = performance.now();
      let lastPct = -1;

      const drawContent = () => {
        if (isImage && img) {
          const iRatio = img.naturalWidth / img.naturalHeight;
          const cRatio = W / H;
          let drawW: number, drawH: number;
          if (iRatio > cRatio) {
            drawH = H;
            drawW = drawH * iRatio;
          } else {
            drawW = W;
            drawH = drawW / iRatio;
          }
          const px = (W - drawW) / 2;
          const py = (H - drawH) / 2;
          ctx.drawImage(img, px, py, drawW, drawH);
        } else if (video) {
          if (!video.videoWidth || !video.videoHeight) {
            ctx.fillStyle = '#0a0f1e';
            ctx.fillRect(0, 0, W, H);
          } else {
            const vRatio = video.videoWidth / video.videoHeight;
            const cRatio = W / H;
            let drawW: number, drawH: number;
            if (vRatio > cRatio) {
              drawH = H;
              drawW = drawH * vRatio;
            } else {
              drawW = W;
              drawH = drawW / vRatio;
            }
            const px = (W - drawW) / 2;
            const py = (H - drawH) / 2;
            ctx.drawImage(video, px, py, drawW, drawH);
          }
        }
      };

      const drawFrame = () => {
        let contentElapsed: number;

        if (segments && video) {
          const segElapsed = (performance.now() - segStartPerf) / 1000;
          const segDur = segments[segIdx].end - segments[segIdx].start;
          contentElapsed = 0;
          for (let i = 0; i < segIdx; i++) contentElapsed += (segments[i].end - segments[i].start);
          contentElapsed += Math.min(segElapsed, segDur);

          if (segElapsed >= segDur && segIdx < segments.length - 1) {
            segIdx++;
            video.currentTime = segments[segIdx].start;
            video.play().catch(() => {});
            segStartPerf = performance.now();
          }
        } else {
          contentElapsed = (performance.now() - startTime) / 1000;
        }

        const elapsed = contentElapsed;
        const totalT = Math.min(elapsed / totalDuration, 1);
        const pct = Math.round(totalT * 100);
        if (pct !== lastPct) {
          lastPct = pct;
          setProgress(pct);
        }

        ctx.fillStyle = '#0a0f1e';
        ctx.fillRect(0, 0, W, H);

        if (contentElapsed < disclosureStart) {
          drawContent();

          const grad = ctx.createLinearGradient(0, 0, 0, H);
          grad.addColorStop(0, 'rgba(10,15,30,0.15)');
          grad.addColorStop(0.5, 'rgba(10,15,30,0.3)');
          grad.addColorStop(1, 'rgba(10,15,30,0.75)');
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, W, H);

          if (hookText.trim()) {
            ctx.fillStyle = '#ffffff';
            ctx.font = `700 ${hookFontSize}px sans-serif`;
            ctx.textBaseline = 'top';
            ctx.textAlign = 'left';
            ctx.shadowColor = 'rgba(0,0,0,0.85)';
            ctx.shadowBlur = 12;
            ctx.shadowOffsetY = 3;
            drawTextLines(ctx, hookText, 60, H * 0.62, W - 120, hookFontSize + 12, 'left');
            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
            ctx.shadowOffsetY = 0;
          }

          if (subtitleText.trim()) {
            ctx.fillStyle = 'rgba(255,255,255,0.9)';
            ctx.font = `500 ${subtitleFontSize}px sans-serif`;
            ctx.textBaseline = 'top';
            ctx.textAlign = 'center';
            ctx.shadowColor = 'rgba(0,0,0,0.7)';
            ctx.shadowBlur = 8;
            ctx.shadowOffsetY = 2;
            drawTextLines(ctx, subtitleText, W / 2, H * 0.82, W - 100, subtitleFontSize + 10, 'center');
            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
            ctx.shadowOffsetY = 0;
          }
        } else {
          const dt = Math.min((contentElapsed - disclosureStart) / 0.5, 1);
          ctx.globalAlpha = dt;
          ctx.fillStyle = '#0a0f1e';
          ctx.fillRect(0, 0, W, H);
          ctx.fillStyle = 'rgba(255,255,255,0.85)';
          ctx.font = '400 20px sans-serif';
          ctx.textBaseline = 'middle';
          ctx.textAlign = 'center';
          const disclosure = getDisclosureShortForPlatforms(affiliatePlatforms);
          drawTextLines(ctx, disclosure, W / 2, H / 2 - 20, W - 80, 28, 'center');
          ctx.globalAlpha = 1;
        }

        if (shortUrl) {
          drawRoamingBabyWithLink(ctx, elapsed * 1000, W, H, shortUrl, theme.colors.primary[500], mascotEnabled);
        }

        if (elapsed < totalDuration) {
          rafRef.current = requestAnimationFrame(drawFrame);
        } else {
          rafRef.current = null;
          if (recorder && recorder.state !== 'inactive') {
            setTimeout(() => {
              if (recorder.state !== 'inactive') {
                try { recorder.stop(); } catch {}
              }
            }, 200);
          }
        }
      };

      rafRef.current = requestAnimationFrame(drawFrame);

      if (hasRecorder) {
        const blob = await done;
        const url = URL.createObjectURL(blob);
        setOutputUrl(url);
        setOutputMime(mimeType);
      } else {
        await new Promise<void>((resolve) => setTimeout(resolve, totalDuration * 1000 + 300));
        const dataUrl = canvas.toDataURL('image/png');
        const blob = await (await fetch(dataUrl)).blob();
        const url = URL.createObjectURL(blob);
        setOutputUrl(url);
        setOutputMime('image/png');
      }

      if (video) video.pause();
      setState('done');
      setProgress(100);
    } catch (err) {
      setState('error');
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      showToast('가공에 실패했어요');
    }
  }, [videoUrl, videoBlob, format, videoDuration, hookText, subtitleText, hookFontSize, subtitleFontSize, affiliatePlatforms, shortUrl, outputUrl, showToast, highlightMode, highlightSegments, importType, imageElRef]);

  const handleDownload = useCallback(() => {
    if (!outputUrl) return;
    const a = document.createElement('a');
    a.href = outputUrl;
    const ext = outputMime.includes('png') ? 'png' : 'webm';
    a.download = `imported-shortform-${Date.now()}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast('다운로드를 시작했어요');
  }, [outputUrl, outputMime, showToast]);

  const handleReset = useCallback(() => {
    if (outputUrl) URL.revokeObjectURL(outputUrl);
    setOutputUrl(null);
    setState('imported');
    setProgress(0);
    setHighlightSegments(null);
  }, [outputUrl]);

  const handleClose = useCallback(() => {
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    if (originalVideoUrl) URL.revokeObjectURL(originalVideoUrl);
    if (outputUrl) URL.revokeObjectURL(outputUrl);
    onClose();
  }, [videoUrl, originalVideoUrl, outputUrl, onClose]);

  const applyAiCopy = useCallback((item: AICopyItem) => {
    setHookText(item.hook.slice(0, 30));
    setSubtitleText(item.caption.slice(0, 40).split('\n')[0]);
    setAiCopies(null);
    showToast('AI 문구를 적용했어요');
  }, [showToast]);

  const isVertical = format === 'vertical';

  return (
    <View style={styles.overlay}>
      <View style={styles.modalCard}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Film size={18} color={theme.colors.warning[400]} strokeWidth={2} />
            <Text style={styles.headerTitle}>원본 영상 숏폼 가공</Text>
          </View>
          <TouchableOpacity onPress={handleClose} activeOpacity={0.7} style={styles.closeBtn}>
            <X size={18} color={theme.colors.dark.textDim} strokeWidth={2} />
          </TouchableOpacity>
        </View>

        <Text style={styles.description}>
          기존 영상이나 사진을 불러와서 훅 문구, 자막, 공정위 문구를 얹어 숏폼으로 완성합니다.
        </Text>

        {state === 'idle' && (
          <View style={styles.idleWrap}>
            <TemplateBadge label={tpl.badgeLabel} />
            <View style={styles.typeSelectorRow}>
              <TouchableOpacity
                style={[styles.typePill, importType === 'video' && styles.typePillActive]}
                onPress={() => setImportType('video')}
                activeOpacity={0.7}
              >
                <Film size={16} color={importType === 'video' ? '#fff' : theme.colors.dark.textDim} strokeWidth={2} />
                <Text style={[styles.typePillText, importType === 'video' && styles.typePillTextActive]}>동영상</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.typePill, importType === 'image' && styles.typePillActive]}
                onPress={() => setImportType('image')}
                activeOpacity={0.7}
              >
                <ImageIcon size={16} color={importType === 'image' ? '#fff' : theme.colors.dark.textDim} strokeWidth={2} />
                <Text style={[styles.typePillText, importType === 'image' && styles.typePillTextActive]}>사진</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.importButton} onPress={handlePickVideo} activeOpacity={0.8}>
              <Upload size={24} color="#fff" strokeWidth={2} />
              <Text style={styles.importButtonText}>
                {importType === 'image' ? '사진 불러오기' : '원본 영상 불러오기'}
              </Text>
            </TouchableOpacity>
            <Text style={styles.hintText}>
              {importType === 'image'
                ? 'JPG, PNG 등 이미지 파일을 선택하세요 (최대 200MB)'
                : 'MP4, WebM 등 동영상 파일을 선택하세요 (최대 200MB)'}
            </Text>
          </View>
        )}

        {state === 'imported' && (
          <ScrollView style={styles.optionsScroll} showsVerticalScrollIndicator={false}>
            {videoUrl && Platform.OS === 'web' && importType === 'video' && (
              // @ts-ignore video element on web
              <video
                src={videoUrl}
                style={styles.previewVideo}
                controls
                playsInline
              />
            )}
            {videoUrl && Platform.OS === 'web' && importType === 'image' && (
              // @ts-ignore img element on web
              <img
                src={videoUrl}
                style={styles.previewImage}
              />
            )}

            <View style={styles.sectionLabel}>
              <Type size={14} color={theme.colors.accent[400]} strokeWidth={2} />
              <Text style={styles.sectionLabelText}>훅 문구 (화면 중앙)</Text>
            </View>
            <input
              type="text"
              value={hookText}
              onChange={(e) => setHookText(e.target.value)}
              placeholder="직접 입력하거나 AI 자동 편집을 사용하세요"
              style={styles.textInput}
              maxLength={30}
            />

            <View style={styles.fontSizeRow}>
              {FONT_SIZES.map((s) => (
                <TouchableOpacity
                  key={s.value}
                  style={[styles.fontSizePill, hookFontSize === s.value && styles.fontSizePillActive]}
                  onPress={() => setHookFontSize(s.value)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.fontSizePillText, hookFontSize === s.value && styles.fontSizePillTextActive]}>
                    {s.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.sectionLabel}>
              <Type size={14} color={theme.colors.accent[400]} strokeWidth={2} />
              <Text style={styles.sectionLabelText}>자막 (화면 하단, 선택)</Text>
            </View>
            <input
              type="text"
              value={subtitleText}
              onChange={(e) => setSubtitleText(e.target.value)}
              placeholder="필요한 경우 자막을 입력하세요"
              style={styles.textInput}
              maxLength={40}
            />

            <View style={styles.fontSizeRow}>
              {FONT_SIZES.map((s) => (
                <TouchableOpacity
                  key={s.value}
                  style={[styles.fontSizePill, subtitleFontSize === s.value && styles.fontSizePillActive]}
                  onPress={() => setSubtitleFontSize(s.value)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.fontSizePillText, subtitleFontSize === s.value && styles.fontSizePillTextActive]}>
                    {s.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.optionRow}>
              <Text style={styles.optionLabel}>화면 비율</Text>
              <View style={styles.toggleGroup}>
                {FORMAT_PRESETS.map((preset) => (
                  <TouchableOpacity
                    key={preset.value}
                    style={[styles.togglePill, format === preset.value && styles.togglePillActive]}
                    onPress={() => setFormat(preset.value)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.togglePillText, format === preset.value && styles.togglePillTextActive]}>
                      {preset.label}
                    </Text>
                    <Text style={[styles.togglePillSub, format === preset.value && styles.togglePillSubActive]}>
                      {preset.aspect}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {importType === 'video' && (
            <View style={styles.highlightSection}>
              <TouchableOpacity
                style={styles.highlightToggle}
                onPress={() => { setHighlightMode(!highlightMode); setHighlightSegments(null); }}
                activeOpacity={0.7}
              >
                <View style={[styles.highlightCheckbox, highlightMode && styles.highlightCheckboxActive]}>
                  {highlightMode && <Check size={12} color="#fff" strokeWidth={3} />}
                </View>
                <Scissors size={14} color={theme.colors.accent[400]} strokeWidth={2} />
                <Text style={styles.highlightToggleText}>하이라이트 자동 추출</Text>
              </TouchableOpacity>
              {highlightMode && (
                <>
                  <Text style={styles.highlightDesc}>
                    AI가 영상에서 가장 임팩트 있는 구간을 찾아 이어붙입니다.
                  </Text>
                  <View style={styles.targetRow}>
                    <Text style={styles.targetLabel}>목표 길이</Text>
                    <View style={styles.targetGroup}>
                      {HIGHLIGHT_TARGETS.map((sec) => (
                        <TouchableOpacity
                          key={sec}
                          style={[styles.targetPill, targetDuration === sec && styles.targetPillActive]}
                          onPress={() => { setTargetDuration(sec); setHighlightSegments(null); }}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.targetPillText, targetDuration === sec && styles.targetPillTextActive]}>
                            {sec}초
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                  <TouchableOpacity
                    style={[styles.analyzeButton, analyzing && styles.analyzeButtonDisabled]}
                    onPress={handleAnalyzeHighlights}
                    disabled={analyzing}
                    activeOpacity={0.8}
                  >
                    {analyzing ? (
                      <Loader2 size={16} color="#fff" strokeWidth={2} />
                    ) : (
                      <Scissors size={16} color="#fff" strokeWidth={2} />
                    )}
                    <Text style={styles.analyzeText}>
                      {analyzing ? `분석 중... ${analyzeProgress}%` : '하이라이트 분석'}
                    </Text>
                  </TouchableOpacity>
                  {highlightSegments && highlightSegments.length > 0 && (
                    <View style={styles.segmentsWrap}>
                      <Text style={styles.segmentsTitle}>추출된 구간</Text>
                      {highlightSegments.map((seg, i) => (
                        <View key={i} style={styles.segmentCard}>
                          <View style={styles.segmentIndexWrap}>
                            <Text style={styles.segmentIndex}>{i + 1}</Text>
                          </View>
                          <Text style={styles.segmentTime}>
                            {seg.start.toFixed(1)}s ~ {seg.end.toFixed(1)}s ({(seg.end - seg.start).toFixed(1)}초)
                          </Text>
                        </View>
                      ))}
                      <Text style={styles.segmentsHint}>
                        총 {highlightSegments.reduce((sum, s) => sum + (s.end - s.start), 0).toFixed(0)}초 + 공정위 {DISCLOSURE_DURATION}초
                      </Text>
                    </View>
                  )}
                </>
              )}
            </View>
            )}

            <TouchableOpacity style={styles.aiEditButton} onPress={handleAiAutoEdit} disabled={aiGenerating} activeOpacity={0.8}>
              {aiGenerating ? (
                <Loader2 size={16} color="#fff" strokeWidth={2} />
              ) : (
                <Sparkles size={16} color="#fff" strokeWidth={2} />
              )}
              <Text style={styles.aiEditText}>
                {aiGenerating ? 'AI 생성 중...' : 'AI 자동 편집'}
              </Text>
            </TouchableOpacity>

            {aiError && (
              <View style={styles.aiErrorBox}>
                <AlertCircle size={14} color={theme.colors.error[400]} strokeWidth={2} />
                <Text style={styles.aiErrorText}>AI 생성에 실패했어요. 직접 입력하거나 다시 시도해주세요.</Text>
              </View>
            )}

            {aiCopies && aiCopies.length > 0 && (
              <View style={styles.aiResultsWrap}>
                <Text style={styles.aiResultsTitle}>AI 추천 문구 — 선택해서 적용하세요</Text>
                {aiCopies.map((item, i) => (
                  <TouchableOpacity key={i} style={styles.aiCopyCard} onPress={() => applyAiCopy(item)} activeOpacity={0.7}>
                    <View style={styles.aiCopyIndexWrap}>
                      <Text style={styles.aiCopyIndex}>{i + 1}</Text>
                    </View>
                    <View style={styles.aiCopyContent}>
                      <Text style={styles.aiCopyHook} numberOfLines={1}>{item.hook}</Text>
                      <Text style={styles.aiCopyCaption} numberOfLines={2}>{item.caption}</Text>
                    </View>
                    <Check size={14} color={theme.colors.success[400]} strokeWidth={2.5} />
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <View style={styles.disclosureInfo}>
              <Check size={14} color={theme.colors.success[400]} strokeWidth={2.5} />
              <Text style={styles.disclosureText}>
                마지막 {DISCLOSURE_DURATION}초에 공정위 문구가 자동으로 추가됩니다
              </Text>
            </View>

            <View style={styles.buttonRow}>
              <TouchableOpacity style={styles.reimportButton} onPress={handlePickVideo} activeOpacity={0.7}>
                <RefreshCw size={16} color={theme.colors.dark.textDim} strokeWidth={2} />
                <Text style={styles.reimportText}>{importType === 'image' ? '사진 다시 선택' : '영상 다시 선택'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.generateButton, importType === 'video' && highlightMode && !highlightSegments && styles.generateButtonDisabled]}
                onPress={handleGenerate}
                disabled={importType === 'video' && highlightMode && !highlightSegments}
                activeOpacity={0.8}
              >
                <Film size={20} color="#fff" strokeWidth={2} />
                <Text style={styles.generateButtonText}>
                  {importType === 'video' && highlightMode ? '하이라이트 숏폼 만들기' : '숏폼 만들기'}
                </Text>
              </TouchableOpacity>
              {importType === 'video' && highlightMode && !highlightSegments && (
                <Text style={styles.hintText}>먼저 하이라이트 분석을 실행해주세요</Text>
              )}
            </View>
          </ScrollView>
        )}

        {state === 'generating' && (
          <VideoProgressIndicator progress={progress} label="가공 중..." color={theme.colors.primary[400]} />
        )}

        {state === 'done' && outputUrl && (
          <View style={styles.resultWrap}>
            <Text style={styles.doneNotice}>결과가 완성됐어요. 미리보기 후 저장하세요.</Text>
            {Platform.OS === 'web' && outputMime.includes('png') && (
              // @ts-ignore img element on web
              <img src={outputUrl} style={isVertical ? styles.videoVertical : styles.videoHorizontal} />
            )}
            {Platform.OS === 'web' && !outputMime.includes('png') && (
              // @ts-ignore video element on web
              <video src={outputUrl} style={isVertical ? styles.videoVertical : styles.videoHorizontal} controls loop playsInline />
            )}
            <View style={styles.resultButtons}>
              <TouchableOpacity style={styles.downloadButton} onPress={handleDownload} activeOpacity={0.8}>
                <Download size={18} color="#fff" strokeWidth={2} />
                <Text style={styles.downloadButtonText}>다운로드</Text>
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
            <Text style={styles.errorText}>{error || '가공 실패. 다시 시도해주세요.'}</Text>
          </View>
        )}

        {toast && (
          <View style={styles.toastBox}>
            <Play size={14} color={theme.colors.success[400]} strokeWidth={2} />
            <Text style={styles.toastText}>{toast}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(10,15,30,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  modalCard: {
    backgroundColor: theme.colors.dark.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    width: '90%',
    maxWidth: 500,
    maxHeight: '90%',
    ...theme.shadows.elevated,
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
    gap: 8,
  },
  headerTitle: {
    fontSize: theme.typography.body,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.dark.text,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.dark.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  description: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    lineHeight: 20,
    marginBottom: theme.spacing.md,
  },
  idleWrap: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xl,
    gap: theme.spacing.md,
  },
  typeSelectorRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: theme.spacing.sm,
  },
  typePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.dark.surfaceLight,
  },
  typePillActive: {
    backgroundColor: theme.colors.primary[600],
  },
  typePillText: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.textDim,
  },
  typePillTextActive: {
    color: '#fff',
  },
  importButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: theme.colors.primary[600],
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: theme.radius.md,
    ...theme.shadows.card,
  },
  importButtonText: {
    fontSize: theme.typography.body,
    fontFamily: theme.typography.fontFamily.bold,
    color: '#fff',
  },
  hintText: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
  },
  optionsScroll: {
    maxHeight: 500,
  },
  previewVideo: {
    width: '100%',
    maxWidth: 240,
    height: 180,
    borderRadius: theme.radius.md,
    marginBottom: theme.spacing.md,
    alignSelf: 'center',
    backgroundColor: '#000',
  },
  previewImage: {
    width: '100%',
    maxWidth: 300,
    maxHeight: 200,
    borderRadius: theme.radius.md,
    marginBottom: theme.spacing.md,
    alignSelf: 'center',
    objectFit: 'contain' as any,
  },
  sectionLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
    marginTop: theme.spacing.sm,
  },
  sectionLabelText: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
  },
  textInput: {
    width: '100%',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.dark.surfaceLight,
    color: theme.colors.dark.text,
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.regular,
    borderWidth: 1,
    borderColor: theme.colors.dark.border,
  } as any,
  fontSizeRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    marginBottom: theme.spacing.sm,
  },
  fontSizePill: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.dark.surfaceLight,
  },
  fontSizePillActive: {
    backgroundColor: theme.colors.primary[600],
  },
  fontSizePillText: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.textDim,
  },
  fontSizePillTextActive: {
    color: '#fff',
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  optionLabel: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.textDim,
  },
  toggleGroup: {
    flexDirection: 'row',
    backgroundColor: theme.colors.dark.surfaceLight,
    borderRadius: theme.radius.md,
    padding: 3,
    gap: 2,
  },
  togglePill: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: theme.radius.sm,
    alignItems: 'center',
  },
  togglePillActive: {
    backgroundColor: theme.colors.primary[600],
  },
  togglePillText: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.textDim,
  },
  togglePillTextActive: {
    color: '#fff',
  },
  togglePillSub: {
    fontSize: 9,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textFaint,
  },
  togglePillSubActive: {
    color: 'rgba(255,255,255,0.7)',
  },
  disclosureInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.colors.success[500] + '15',
    borderRadius: theme.radius.sm,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: theme.spacing.sm,
  },
  disclosureText: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.success[400],
  },
  aiEditButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.warning[500],
    marginTop: theme.spacing.sm,
    ...theme.shadows.card,
  },
  aiEditText: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.bold,
    color: '#fff',
  },
  aiErrorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.colors.error[500] + '15',
    borderRadius: theme.radius.sm,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: 8,
  },
  aiErrorText: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.error[400],
    flex: 1,
  },
  aiResultsWrap: {
    marginTop: 12,
    gap: 8,
  },
  aiResultsTitle: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.warning[400],
    marginBottom: 4,
  },
  aiCopyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: theme.colors.dark.surfaceLight,
    borderRadius: theme.radius.md,
    padding: 12,
  },
  aiCopyIndexWrap: {
    width: 24,
    height: 24,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.warning[500] + '30',
    justifyContent: 'center',
    alignItems: 'center',
  },
  aiCopyIndex: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.warning[400],
  },
  aiCopyContent: {
    flex: 1,
    gap: 2,
  },
  aiCopyHook: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.dark.text,
  },
  aiCopyCaption: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    lineHeight: 16,
  },
  highlightSection: {
    marginTop: theme.spacing.md,
    backgroundColor: theme.colors.dark.surfaceLight,
    borderRadius: theme.radius.md,
    padding: 14,
  },
  highlightToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  highlightCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: theme.colors.dark.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  highlightCheckboxActive: {
    backgroundColor: theme.colors.accent[500],
    borderColor: theme.colors.accent[500],
  },
  highlightToggleText: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
  },
  highlightDesc: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    lineHeight: 18,
    marginTop: 8,
    marginBottom: 10,
  },
  targetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  targetLabel: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.textDim,
  },
  targetGroup: {
    flexDirection: 'row',
    gap: 6,
  },
  targetPill: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.dark.border,
  },
  targetPillActive: {
    backgroundColor: theme.colors.accent[500],
  },
  targetPillText: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.textDim,
  },
  targetPillTextActive: {
    color: '#fff',
  },
  analyzeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.accent[500],
    ...theme.shadows.card,
  },
  analyzeButtonDisabled: {
    opacity: 0.6,
  },
  analyzeText: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.bold,
    color: '#fff',
  },
  segmentsWrap: {
    marginTop: 12,
    gap: 6,
  },
  segmentsTitle: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.accent[400],
    marginBottom: 4,
  },
  segmentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: theme.colors.dark.surface,
    borderRadius: theme.radius.sm,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  segmentIndexWrap: {
    width: 22,
    height: 22,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.accent[500] + '30',
    justifyContent: 'center',
    alignItems: 'center',
  },
  segmentIndex: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.accent[400],
  },
  segmentTime: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.text,
  },
  segmentsHint: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    marginTop: 4,
  },
  generateButtonDisabled: {
    opacity: 0.5,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  reimportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.dark.surfaceLight,
  },
  reimportText: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.textDim,
  },
  generateButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primary[600],
    ...theme.shadows.card,
  },
  generateButtonText: {
    fontSize: theme.typography.body,
    fontFamily: theme.typography.fontFamily.bold,
    color: '#fff',
  },
  progressWrap: {
    paddingVertical: theme.spacing.xl,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: theme.colors.dark.surfaceLight,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: theme.colors.primary[500],
    borderRadius: 3,
  },
  progressLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    justifyContent: 'center',
  },
  progressText: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.textDim,
  },
  doneNotice: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.success[400],
    lineHeight: 20,
  },
  resultWrap: {
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  videoVertical: {
    width: 200,
    height: 356,
    borderRadius: theme.radius.md,
    backgroundColor: '#000',
  },
  videoHorizontal: {
    width: 320,
    height: 180,
    borderRadius: theme.radius.md,
    backgroundColor: '#000',
  },
  resultButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primary[600],
  },
  downloadButtonText: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.bold,
    color: '#fff',
  },
  remakeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.dark.surfaceLight,
  },
  remakeButtonText: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.textDim,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.colors.error[500] + '15',
    borderRadius: theme.radius.md,
    padding: 14,
  },
  errorText: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.error[400],
    flex: 1,
  },
  toastBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.colors.dark.surfaceLight,
    borderRadius: theme.radius.md,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginTop: 12,
  },
  toastText: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.success[400],
    flex: 1,
  },
});
