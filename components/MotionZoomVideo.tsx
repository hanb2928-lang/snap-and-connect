import { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image as RNImage,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { ZoomIn, ZoomOut, Move, Film, Check, Loader, Download, Shuffle } from 'lucide-react-native';
import { theme } from '@/lib/theme';
import { buildDataUrl, cleanBase64, urlToDataUrl } from '@/lib/base64';
import { generateVisualParams, type VisualRandomizationParams } from '@/lib/humanLikeEngine';

type MotionPreset = 'zoom-in' | 'zoom-out' | 'pan-left' | 'pan-right' | 'tilt-up' | 'cinematic';

interface MotionOption {
  id: MotionPreset;
  label: string;
  desc: string;
  icon: typeof ZoomIn;
}

const MOTION_OPTIONS: MotionOption[] = [
  { id: 'zoom-in', label: '줌인', desc: '서서히 다가오는 듯한 클로즈업', icon: ZoomIn },
  { id: 'zoom-out', label: '줌아웃', desc: '멀어지며 전체가 보이는 연출', icon: ZoomOut },
  { id: 'pan-left', label: '팬 레프트', desc: '왼쪽으로 부드럽게 이동', icon: Move },
  { id: 'pan-right', label: '팬 라이트', desc: '오른쪽으로 부드럽게 이동', icon: Move },
  { id: 'tilt-up', label: '틸트 업', desc: '아래에서 위로 올라가는 연출', icon: Move },
  { id: 'cinematic', label: '시네마틱', desc: '줌+팬 조합, 영화 같은 느낌', icon: Film },
];

interface MotionZoomVideoProps {
  imageUrl: string;
  productName?: string;
  fileName?: string;
  onVideoReady?: (videoDataUrl: string) => void;
}

export function MotionZoomVideo({
  imageUrl,
  productName,
  fileName,
  onVideoReady,
}: MotionZoomVideoProps) {
  const [selectedMotion, setSelectedMotion] = useState<MotionPreset>('zoom-in');
  const [generating, setGenerating] = useState(false);
  const generatingRef = useRef(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoMime, setVideoMime] = useState<string>('video/webm');
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [visualParams, setVisualParams] = useState<VisualRandomizationParams | null>(null);
  const [randomizeEnabled, setRandomizeEnabled] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const rawImageUrl = imageUrl || '';
  const [dataUrl, setDataUrl] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    if (rawImageUrl.startsWith('data:')) {
      setDataUrl(rawImageUrl);
    } else if (rawImageUrl.startsWith('http')) {
      urlToDataUrl(rawImageUrl).then((d) => { if (!cancelled) setDataUrl(d); }).catch(() => {
        if (!cancelled) setDataUrl(rawImageUrl);
      });
    } else {
      setDataUrl(buildDataUrl(cleanBase64(rawImageUrl), 'image/jpeg'));
    }
    return () => { cancelled = true; };
  }, [rawImageUrl]);

  const videoUrlRef = useRef<string | null>(null);

  const cleanup = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
    chunksRef.current = [];
    if (videoUrlRef.current) {
      URL.revokeObjectURL(videoUrlRef.current);
      videoUrlRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  const getMotionParams = useCallback((motion: MotionPreset, t: number, vp: VisualRandomizationParams | null) => {
    // Apply human-like zoom speed randomization
    const speedMul = vp ? vp.zoomSpeed : 1.0;
    const tAdj = Math.min(t * speedMul, 1);
    // t: 0..1 progress through the video (with randomization)
    switch (motion) {
      case 'zoom-in':
        return { scale: 1.0 + tAdj * 0.5, panX: 0, panY: 0 };
      case 'zoom-out':
        return { scale: 1.5 - tAdj * 0.5, panX: 0, panY: 0 };
      case 'pan-left':
        return { scale: 1.3, panX: -tAdj * (200 + (vp?.textXOffset ?? 0) * 4), panY: 0 };
      case 'pan-right':
        return { scale: 1.3, panX: tAdj * (200 + (vp?.textXOffset ?? 0) * 4), panY: 0 };
      case 'tilt-up':
        return { scale: 1.3, panX: 0, panY: -tAdj * (200 + (vp?.textYOffset ?? 0) * 4) };
      case 'cinematic': {
        const scale = 1.1 + tAdj * 0.4;
        const panX = Math.sin(tAdj * Math.PI) * (80 + (vp?.textXOffset ?? 0) * 2);
        const panY = -tAdj * (60 + (vp?.textYOffset ?? 0) * 2);
        return { scale, panX, panY };
      }
      default:
        return { scale: 1.2, panX: 0, panY: 0 };
    }
  }, []);

  const generateVideo = useCallback(async () => {
    if (generatingRef.current || generating || Platform.OS !== 'web') return;
    generatingRef.current = true;
    if (!dataUrl) {
      setError('이미지를 준비하는 중입니다. 잠시 후 다시 시도해주세요.');
      return;
    }
    setGenerating(true);
    setError(null);
    setVideoUrl(null);
    setProgress(0);
    cleanup();

    // Generate human-like visual randomization params
    const vp = randomizeEnabled ? generateVisualParams() : null;
    setVisualParams(vp);

    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new (global as unknown as { Image: typeof HTMLImageElement }).Image();
        el.crossOrigin = 'anonymous';
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error('이미지를 불러올 수 없습니다. 네트워크 문제일 수 있어요.'));
        el.src = dataUrl;
      });

      const W = 1080;
      const H = 1920;
      const FPS = 30;
      const DURATION_SEC = 5;

      const canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('캔버스를 생성할 수 없습니다');
      canvasRef.current = canvas;

      // Set up MediaRecorder with codec fallback
      const stream = canvas.captureStream(FPS);
      const codecCandidates = [
        'video/webm;codecs=vp9',
        'video/webm;codecs=vp8',
        'video/webm',
        'video/mp4;codecs=h264',
        'video/mp4',
      ];
      let mimeType = '';
      for (const candidate of codecCandidates) {
        try {
          if ((window as unknown as { MediaRecorder: typeof MediaRecorder }).MediaRecorder.isTypeSupported(candidate)) {
            mimeType = candidate;
            break;
          }
        } catch {
          // continue to next candidate
        }
      }
      if (!mimeType) {
        throw new Error('이 브라우저는 영상 생성을 지원하지 않습니다');
      }
      const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 4_000_000 });
      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      const done = new Promise<void>((resolve, reject) => {
        const stopTimeout = setTimeout(() => reject(new Error('영상 인코딩 시간 초과')), 60000);
        recorder.onstop = () => { clearTimeout(stopTimeout); resolve(); };
        recorder.onerror = () => { clearTimeout(stopTimeout); reject(new Error('영상 인코딩 중 오류')); };
      });

      recorder.start();

      // Calculate image draw dimensions (contain fit)
      const imgAspect = img.naturalWidth / img.naturalHeight;
      const canvasAspect = W / H;
      let baseW: number, baseH: number;
      if (imgAspect > canvasAspect) {
        baseW = W;
        baseH = W / imgAspect;
      } else {
        baseH = H;
        baseW = H * imgAspect;
      }

      const startTime = performance.now();
      const durationMs = DURATION_SEC * 1000;

      const drawFrame = () => {
        const elapsed = performance.now() - startTime;
        const t = Math.min(elapsed / durationMs, 1);
        setProgress(Math.round(t * 100));

        // Clear with black
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, W, H);

        const { scale, panX, panY } = getMotionParams(selectedMotion, t, vp);
        const drawW = baseW * scale;
        const drawH = baseH * scale;
        const drawX = (W - drawW) / 2 + panX;
        const drawY = (H - drawH) / 2 + panY;

        ctx.drawImage(img, drawX, drawY, drawW, drawH);

        // Apply subtle pixel noise for fingerprint randomization
        if (vp && Math.abs(vp.hueShift) > 0.01 && t > 0.98) {
          try {
            const noiseStrength = vp.hueShift / 100;
            const imageData = ctx.getImageData(0, 0, W, H);
            const data = imageData.data;
            for (let i = 0; i < data.length; i += 4) {
              data[i] = Math.max(0, Math.min(255, data[i] + noiseStrength * 2));
            }
            ctx.putImageData(imageData, 0, 0);
          } catch {
            // getImageData may fail if tainted, skip noise
          }
        }

        // Subtle cinematic vignette for cinematic mode
        if (selectedMotion === 'cinematic') {
          const vignette = ctx.createRadialGradient(W / 2, H / 2, W * 0.3, W / 2, H / 2, W * 0.7);
          vignette.addColorStop(0, 'rgba(0,0,0,0)');
          vignette.addColorStop(1, 'rgba(0,0,0,0.3)');
          ctx.fillStyle = vignette;
          ctx.fillRect(0, 0, W, H);
        }

        if (t < 1) {
          animFrameRef.current = requestAnimationFrame(drawFrame);
        } else {
          // Stop recording
          setTimeout(() => {
            if (recorderRef.current && recorderRef.current.state === 'recording') {
              recorderRef.current.stop();
            }
          }, 100);
        }
      };

      animFrameRef.current = requestAnimationFrame(drawFrame);

      await done;

      const blob = new Blob(chunksRef.current, { type: mimeType });
      if (videoUrlRef.current) URL.revokeObjectURL(videoUrlRef.current);
      const url = URL.createObjectURL(blob);
      videoUrlRef.current = url;
      setVideoUrl(url);
      setVideoMime(mimeType);
      if (onVideoReady) onVideoReady(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : '영상 생성 실패');
    } finally {
      generatingRef.current = false;
      setGenerating(false);
      setProgress(0);
    }
  }, [generating, dataUrl, selectedMotion, getMotionParams, cleanup, onVideoReady, randomizeEnabled]);

  const handleDownload = useCallback(() => {
    if (!videoUrl) return;
    if (Platform.OS === 'web') {
      const ext = videoMime.includes('mp4') ? 'mp4' : 'webm';
      const a = document.createElement('a');
      a.href = videoUrl;
      a.download = `${fileName || productName || 'motion-zoom'}.${ext}`;
      a.click();
    }
  }, [videoUrl, videoMime, fileName, productName]);

  if (Platform.OS !== 'web') {
    return (
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <Film size={18} color={theme.colors.primary[400]} strokeWidth={2} />
          <View style={styles.headerText}>
            <Text style={styles.title}>2.5D 모션 줌 & 팬</Text>
            <Text style={styles.desc}>
              원본 1장 사진으로 줌/팬/틸트 효과를 적용한 시네마틱 숏폼을 만듭니다.
            </Text>
          </View>
        </View>
        <View style={styles.nativeNotice}>
          <Text style={styles.nativeNoticeText}>
            이 기능은 웹 브라우저에서만 사용할 수 있습니다. 웹에서 접속해 주세요.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Film size={18} color={theme.colors.primary[400]} strokeWidth={2} />
        <View style={styles.headerText}>
          <Text style={styles.title}>2.5D 모션 줌 & 팬</Text>
          <Text style={styles.desc}>
            원본 1장 사진으로 줌/팬/틸트 효과를 적용한 시네마틱 숏폼을 만듭니다
          </Text>
        </View>
      </View>

      {/* Motion selector */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.motionList}>
        {MOTION_OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const isActive = selectedMotion === opt.id;
          return (
            <TouchableOpacity
              key={opt.id}
              style={[styles.motionCard, isActive && styles.motionCardActive]}
              onPress={() => setSelectedMotion(opt.id)}
              activeOpacity={0.7}
            >
              <Icon size={15} color={isActive ? '#fff' : theme.colors.dark.textDim} strokeWidth={2} />
              <Text style={[styles.motionLabel, isActive && styles.motionLabelActive]}>{opt.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Selected motion desc */}
      <Text style={styles.selectedDesc}>
        {MOTION_OPTIONS.find((m) => m.id === selectedMotion)?.desc} · 5초 · 1080×1920
      </Text>

      {/* Randomization toggle */}
      <TouchableOpacity
        style={[styles.randomToggle, randomizeEnabled && styles.randomToggleActive]}
        onPress={() => setRandomizeEnabled((v) => !v)}
        activeOpacity={0.7}
      >
        <Shuffle size={13} color={randomizeEnabled ? theme.colors.accent[400] : theme.colors.dark.textDim} strokeWidth={2} />
        <Text style={[styles.randomToggleText, randomizeEnabled && { color: theme.colors.accent[400] }]}>
          {randomizeEnabled ? '인간형 무작위화 적용 중' : '무작위화 끄기'}
        </Text>
      </TouchableOpacity>

      {/* Generate button */}
      {!generating && !videoUrl && (
        <TouchableOpacity style={styles.generateBtn} onPress={generateVideo} activeOpacity={0.7}>
          <Film size={18} color="#fff" strokeWidth={2} />
          <Text style={styles.generateBtnText}>모션 영상 생성</Text>
        </TouchableOpacity>
      )}

      {/* Progress */}
      {generating && (
        <View style={styles.progressBox}>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
          </View>
          <View style={styles.progressRow}>
            <ActivityIndicator size="small" color={theme.colors.primary[400]} />
            <Text style={styles.progressText}>영상 생성 중... {progress}%</Text>
          </View>
        </View>
      )}

      {/* Error */}
      {error && <Text style={styles.errorText}>{error}</Text>}

      {/* Video preview */}
      {videoUrl && !generating && (
        <View style={styles.videoBox}>
          <video
            src={videoUrl}
            controls
            autoPlay
            loop
            muted
            style={{
              width: '100%',
              maxHeight: 300,
              borderRadius: 12,
              backgroundColor: '#000',
            }}
          />
          <View style={styles.videoActions}>
            <TouchableOpacity style={styles.downloadBtn} onPress={handleDownload} activeOpacity={0.7}>
              <Download size={15} color="#fff" strokeWidth={2} />
              <Text style={styles.downloadBtnText}>다운로드</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.regenBtn}
              onPress={() => {
                setVideoUrl(null);
                generateVideo();
              }}
              activeOpacity={0.7}
            >
              <Loader size={15} color={theme.colors.dark.text} strokeWidth={2} />
              <Text style={styles.regenBtnText}>다시 생성</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Original preview */}
      {!generating && !videoUrl && (
        <View style={styles.previewBox}>
          <RNImage source={{ uri: dataUrl }} style={styles.previewImage} resizeMode="contain" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: theme.spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 15,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.dark.text,
  },
  desc: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    lineHeight: 17,
  },
  motionList: {
    gap: 8,
    paddingRight: theme.spacing.md,
  },
  motionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.dark.surface,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  motionCardActive: {
    borderColor: theme.colors.primary[400],
    backgroundColor: theme.colors.primary[500],
  },
  motionLabel: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.textDim,
  },
  motionLabelActive: {
    color: '#fff',
    fontFamily: theme.typography.fontFamily.bold,
  },
  selectedDesc: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textFaint,
  },
  randomToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.dark.surface,
    borderWidth: 1.5,
    borderColor: theme.colors.dark.border,
    alignSelf: 'flex-start',
  },
  randomToggleActive: {
    borderColor: theme.colors.accent[400] + '60',
    backgroundColor: theme.colors.accent[500] + '10',
  },
  randomToggleText: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.textDim,
  },
  generateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.primary[500],
  },
  generateBtnText: {
    fontSize: 15,
    fontFamily: theme.typography.fontFamily.bold,
    color: '#fff',
  },
  progressBox: {
    gap: 10,
  },
  progressBarBg: {
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.dark.surfaceLight,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: theme.colors.primary[400],
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  progressText: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
  },
  errorText: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.error[400],
    textAlign: 'center',
    paddingVertical: 12,
  },
  videoBox: {
    gap: theme.spacing.sm,
  },
  videoActions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  downloadBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primary[500],
  },
  downloadBtnText: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.bold,
    color: '#fff',
  },
  regenBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.dark.surfaceLight,
  },
  regenBtnText: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.text,
  },
  previewBox: {
    borderRadius: theme.radius.md,
    overflow: 'hidden',
  },
  previewImage: {
    width: '100%',
    height: 200,
    backgroundColor: theme.colors.dark.surfaceLight,
  },
  nativeNotice: {
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.dark.surface,
    alignItems: 'center',
  },
  nativeNoticeText: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    textAlign: 'center',
    lineHeight: 19,
  },
});
