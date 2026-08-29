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
import { ZoomIn, ZoomOut, Move, Film, Check, Loader, Download } from 'lucide-react-native';
import { theme } from '@/lib/theme';
import { buildDataUrl, cleanBase64 } from '@/lib/base64';

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
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const dataUrl = imageUrl.startsWith('data:')
    ? imageUrl
    : imageUrl.startsWith('http')
      ? imageUrl
      : buildDataUrl(cleanBase64(imageUrl), 'image/jpeg');

  const cleanup = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }
    chunksRef.current = [];
  }, []);

  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  const getMotionParams = useCallback((motion: MotionPreset, t: number) => {
    // t: 0..1 progress through the video
    switch (motion) {
      case 'zoom-in':
        return { scale: 1.0 + t * 0.5, panX: 0, panY: 0 };
      case 'zoom-out':
        return { scale: 1.5 - t * 0.5, panX: 0, panY: 0 };
      case 'pan-left':
        return { scale: 1.3, panX: -t * 200, panY: 0 };
      case 'pan-right':
        return { scale: 1.3, panX: t * 200, panY: 0 };
      case 'tilt-up':
        return { scale: 1.3, panX: 0, panY: -t * 200 };
      case 'cinematic': {
        const scale = 1.1 + t * 0.4;
        const panX = Math.sin(t * Math.PI) * 80;
        const panY = -t * 60;
        return { scale, panX, panY };
      }
      default:
        return { scale: 1.2, panX: 0, panY: 0 };
    }
  }, []);

  const generateVideo = useCallback(async () => {
    if (generating || Platform.OS !== 'web') return;
    setGenerating(true);
    setError(null);
    setVideoUrl(null);
    setProgress(0);
    cleanup();

    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new (global as unknown as { Image: typeof HTMLImageElement }).Image();
        el.crossOrigin = 'anonymous';
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error('이미지를 불러올 수 없습니다'));
        el.src = dataUrl;
      });

      const W = 1080;
      const H = 1920;
      const FPS = 30;
      const DURATION_SEC = 5;
      const totalFrames = FPS * DURATION_SEC;

      const canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('캔버스를 생성할 수 없습니다');
      canvasRef.current = canvas;

      // Set up MediaRecorder
      const stream = canvas.captureStream(FPS);
      const mimeType = 'video/webm;codecs=vp9';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        throw new Error('이 브라우저는 영상 생성을 지원하지 않습니다');
      }
      const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 4_000_000 });
      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      const done = new Promise<void>((resolve) => {
        recorder.onstop = () => resolve();
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

        const { scale, panX, panY } = getMotionParams(selectedMotion, t);
        const drawW = baseW * scale;
        const drawH = baseH * scale;
        const drawX = (W - drawW) / 2 + panX;
        const drawY = (H - drawH) / 2 + panY;

        ctx.drawImage(img, drawX, drawY, drawW, drawH);

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

      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      setVideoUrl(url);
      if (onVideoReady) onVideoReady(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : '영상 생성 실패');
    } finally {
      setGenerating(false);
      setProgress(0);
    }
  }, [generating, dataUrl, selectedMotion, getMotionParams, cleanup, onVideoReady]);

  const handleDownload = useCallback(() => {
    if (!videoUrl) return;
    if (Platform.OS === 'web') {
      const a = document.createElement('a');
      a.href = videoUrl;
      a.download = `${fileName || productName || 'motion-zoom'}.webm`;
      a.click();
    }
  }, [videoUrl, fileName, productName]);

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
