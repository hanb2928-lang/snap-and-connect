import { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { Layers, Download, ChevronLeft, ChevronRight, Check, Loader as Loader2, Film, RefreshCw } from 'lucide-react-native';
import { theme } from '@/lib/theme';
import { captureRef } from 'react-native-view-shot';
import * as MediaLibrary from 'expo-media-library';
import { TemplateCard } from '@/components/TemplateCard';
import type { StickerPosition } from '@/components/TemplateCard';
import type { DetectedProduct, PlatformKey, CustomReview } from '@/types/database';

const { width: screenWidth } = Dimensions.get('window');

const VIDEO_DURATION = 20000;
const FPS = 30;
const VIDEO_W = 1080;
const VIDEO_H = 1920;

interface CarouselSlide {
  imageUrl: string;
  templateData: DetectedProduct['templateData'];
  title: string;
  affiliatePlatforms: string[];
  platform: PlatformKey;
  customReview: CustomReview | null;
  shortUrl: string;
}

interface CarouselGeneratorProps {
  imageUrl: string;
  detectedProducts: DetectedProduct[];
  platform: PlatformKey;
  customReview: CustomReview | null;
  affiliatePlatforms: string[];
  fileName: string;
  shortUrl: string;
  stickerPosition?: StickerPosition;
}

type ExportState = 'idle' | 'capturing' | 'generating' | 'done' | 'error';

export function CarouselGenerator({
  imageUrl,
  detectedProducts,
  platform,
  customReview,
  affiliatePlatforms,
  fileName,
  shortUrl,
  stickerPosition = 'top-left',
}: CarouselGeneratorProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [exportState, setExportState] = useState<ExportState>('idle');
  const [exportProgress, setExportProgress] = useState(0);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const cardRefs = useRef<(View | null)[]>([]);
  const scrollRef = useRef<ScrollView | null>(null);
  const lastScrollUpdate = useRef(0);
  const rafRef = useRef<number | null>(null);
  const recorderRef = useRef<any>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        try { recorderRef.current.stop(); } catch { /* ignore */ }
      }
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 4000);
  }, []);

  const slides: CarouselSlide[] = detectedProducts.map((product) => ({
    imageUrl,
    templateData: product.templateData,
    title: product.productName || `상품 ${product.id}`,
    affiliatePlatforms,
    platform,
    customReview,
    shortUrl,
  }));

  const handleScroll = useCallback((event: { nativeEvent: { contentOffset: { x: number } } }) => {
    const now = Date.now();
    if (now - lastScrollUpdate.current < 66) return;
    lastScrollUpdate.current = now;
    const x = event.nativeEvent.contentOffset.x;
    const index = Math.round(x / screenWidth);
    if (index !== currentIndex && index >= 0 && index < slides.length) {
      setCurrentIndex(index);
    }
  }, [currentIndex, slides.length]);

  const goToSlide = useCallback((index: number) => {
    if (index < 0 || index >= slides.length) return;
    scrollRef.current?.scrollTo({ x: index * screenWidth, animated: true });
    setCurrentIndex(index);
  }, [slides.length]);

  const handleGenerateVideo = useCallback(async () => {
    if (Platform.OS !== 'web') {
      showToast('동영상 생성은 웹에서 지원됩니다');
      return;
    }
    setExportState('capturing');
    setExportProgress(0);
    setVideoUrl(null);

    try {
      const slideDataUrls: string[] = [];
      for (let i = 0; i < slides.length; i++) {
        const ref = cardRefs.current[i];
        if (!ref) continue;
        try {
          const uri = await captureRef(ref, { format: 'png', quality: 1 });
          slideDataUrls.push(uri);
        } catch {
          // skip failed slide
        }
        setExportProgress(Math.round(((i + 1) / slides.length) * 30));
      }

      if (slideDataUrls.length === 0) {
        setExportState('error');
        showToast('슬라이드 캡처에 실패했어요');
        return;
      }

      setExportState('generating');

      const slideDuration = VIDEO_DURATION / slideDataUrls.length;
      const images: HTMLImageElement[] = [];
      for (const url of slideDataUrls) {
        const img = await loadImage(url);
        images.push(img);
      }

      const canvas = document.createElement('canvas');
      canvas.width = VIDEO_W;
      canvas.height = VIDEO_H;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('canvas unsupported');

      const hasRecorder = typeof (window as any).MediaRecorder !== 'undefined' && typeof (canvas as any).captureStream === 'function';
      if (!hasRecorder) {
        setExportState('error');
        showToast('이 브라우저는 동영상 생성을 지원하지 않아요');
        return;
      }

      const canvasStream = (canvas as any).captureStream(FPS);
      const mimeType = (window as any).MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : (window as any).MediaRecorder.isTypeSupported('video/webm;codecs=vp8')
          ? 'video/webm;codecs=vp8'
          : 'video/webm';
      const recorder = new (window as any).MediaRecorder(canvasStream, {
        mimeType,
        videoBitsPerSecond: 8000000,
      });
      recorderRef.current = recorder;
      const chunks: any[] = [];
      recorder.ondataavailable = (e: any) => { if (e.data.size > 0) chunks.push(e.data); };

      const done = new Promise<Blob>((resolve) => {
        recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
      });

      recorder.start();
      const startTime = performance.now();
      let lastPct = -1;

      const drawFrame = () => {
        const elapsed = performance.now() - startTime;
        if (elapsed >= VIDEO_DURATION) {
          recorder.stop();
          return;
        }

        const globalT = elapsed / VIDEO_DURATION;
        const pct = Math.round(globalT * 100);
        if (pct !== lastPct) {
          lastPct = pct;
          setExportProgress(30 + Math.round(pct * 0.7));
        }

        const slideIndex = Math.min(Math.floor(elapsed / slideDuration), images.length - 1);
        const localT = (elapsed - slideIndex * slideDuration) / slideDuration;
        const img = images[slideIndex];

        ctx.fillStyle = '#0a0f1e';
        ctx.fillRect(0, 0, VIDEO_W, VIDEO_H);

        const scale = 1.05 + localT * 0.12;
        const imgRatio = img.width / img.height;
        const canvasRatio = VIDEO_W / VIDEO_H;
        let drawW: number, drawH: number;
        if (imgRatio > canvasRatio) {
          drawH = VIDEO_H * scale;
          drawW = drawH * imgRatio;
        } else {
          drawW = VIDEO_W * scale;
          drawH = drawW / imgRatio;
        }
        const panY = (VIDEO_H - drawH) / 2 - localT * 20;
        const panX = (VIDEO_W - drawW) / 2;

        const transitionWidth = 0.08;
        let alpha = 1;
        if (localT < transitionWidth) {
          alpha = localT / transitionWidth;
        } else if (localT > 1 - transitionWidth) {
          alpha = (1 - localT) / transitionWidth;
        }
        ctx.globalAlpha = alpha;
        ctx.drawImage(img, panX, panY, drawW, drawH);
        ctx.globalAlpha = 1;

        if (slideIndex < images.length - 1 && localT > 0.92) {
          const nextImg = images[slideIndex + 1];
          const nextAlpha = (localT - 0.92) / 0.08;
          const nextScale = 1.05;
          const nextImgRatio = nextImg.width / nextImg.height;
          let nDrawW: number, nDrawH: number;
          if (nextImgRatio > canvasRatio) {
            nDrawH = VIDEO_H * nextScale;
            nDrawW = nDrawH * nextImgRatio;
          } else {
            nDrawW = VIDEO_W * nextScale;
            nDrawH = nDrawW / nextImgRatio;
          }
          const nPanY = (VIDEO_H - nDrawH) / 2;
          const nPanX = (VIDEO_W - nDrawW) / 2;
          ctx.globalAlpha = nextAlpha;
          ctx.drawImage(nextImg, nPanX, nPanY, nDrawW, nDrawH);
          ctx.globalAlpha = 1;
        }

        ctx.fillStyle = 'rgba(10,15,30,0.55)';
        ctx.fillRect(0, 0, VIDEO_W, VIDEO_H);

        const dotY = VIDEO_H - 60;
        const dotSpacing = 40;
        const totalDotsW = (images.length - 1) * dotSpacing;
        const dotStartX = (VIDEO_W - totalDotsW) / 2;
        for (let d = 0; d < images.length; d++) {
          const dx = dotStartX + d * dotSpacing;
          const isActive = d === slideIndex;
          ctx.fillStyle = isActive ? '#FFD600' : 'rgba(255,255,255,0.35)';
          ctx.beginPath();
          ctx.arc(dx, dotY, isActive ? 8 : 5, 0, Math.PI * 2);
          ctx.fill();
        }

        rafRef.current = requestAnimationFrame(drawFrame);
      };
      rafRef.current = requestAnimationFrame(drawFrame);

      const blob = await done;
      recorderRef.current = null;
      const url = URL.createObjectURL(blob);
      setVideoUrl(url);
      setExportState('done');
      setExportProgress(100);
      showToast('20초 동영상이 생성됐어요');
    } catch {
      recorderRef.current = null;
      setExportState('error');
      showToast('동영상 생성에 실패했어요');
    }
  }, [slides, showToast]);

  const handleDownload = useCallback(() => {
    if (!videoUrl) return;
    const a = document.createElement('a');
    a.href = videoUrl;
    a.download = `${fileName.replace(/\.png$/, '')}-carousel.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [videoUrl, fileName]);

  const handleReset = useCallback(() => {
    if (videoUrl) {
      URL.revokeObjectURL(videoUrl);
    }
    setVideoUrl(null);
    setExportState('idle');
    setExportProgress(0);
  }, [videoUrl]);

  if (detectedProducts.length <= 1) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Layers size={18} color={theme.colors.accent[400]} strokeWidth={2} />
          <Text style={styles.headerTitle}>멀티 제품 캐러셀</Text>
        </View>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{currentIndex + 1} / {slides.length}</Text>
        </View>
      </View>

      <Text style={styles.description}>
        감지된 {slides.length}개 상품을 20초 동영상으로 만들어요. 각 상품이 순서대로 전환되며 한 번에 저장하세요.
      </Text>

      <View style={styles.carouselWrap}>
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={64}
          style={styles.scrollView}
        >
          {slides.map((slide, index) => (
            <View key={index} style={styles.slideWrap} collapsable={false}>
              <View
                ref={(ref) => { cardRefs.current[index] = ref; }}
                collapsable={false}
              >
                <TemplateCard
                  imageUrl={slide.imageUrl}
                  templateData={slide.templateData}
                  title={slide.title}
                  affiliatePlatforms={slide.affiliatePlatforms}
                  platform={slide.platform}
                  customReview={slide.customReview}
                  shortUrl={slide.shortUrl}
                  stickerPosition={stickerPosition}
                />
              </View>
            </View>
          ))}
        </ScrollView>

        {currentIndex > 0 && (
          <TouchableOpacity
            style={[styles.navButton, styles.navLeft]}
            onPress={() => goToSlide(currentIndex - 1)}
            activeOpacity={0.7}
          >
            <ChevronLeft size={20} color="#fff" strokeWidth={2.5} />
          </TouchableOpacity>
        )}
        {currentIndex < slides.length - 1 && (
          <TouchableOpacity
            style={[styles.navButton, styles.navRight]}
            onPress={() => goToSlide(currentIndex + 1)}
            activeOpacity={0.7}
          >
            <ChevronRight size={20} color="#fff" strokeWidth={2.5} />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.dotsRow}>
        {slides.map((_, index) => (
          <View
            key={index}
            style={[styles.dot, index === currentIndex && styles.dotActive]}
          />
        ))}
      </View>

      {exportState === 'idle' && (
        <TouchableOpacity
          style={styles.generateButton}
          onPress={handleGenerateVideo}
          activeOpacity={0.8}
        >
          <Film size={18} color="#fff" strokeWidth={2} />
          <Text style={styles.generateButtonText}>20초 동영상 만들기</Text>
        </TouchableOpacity>
      )}

      {(exportState === 'capturing' || exportState === 'generating') && (
        <View style={styles.progressWrap}>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${exportProgress}%` }]} />
          </View>
          <View style={styles.progressLabelRow}>
            {exportState === 'capturing' ? (
              <Loader2 size={14} color={theme.colors.accent[400]} strokeWidth={2.5} />
            ) : (
              <ActivityIndicator size="small" color={theme.colors.accent[400]} />
            )}
            <Text style={styles.progressText}>
              {exportState === 'capturing' ? '슬라이드 캡처 중... ' : '동영상 생성 중... '}
              {exportProgress}%
            </Text>
          </View>
        </View>
      )}

      {exportState === 'done' && videoUrl && (
        <View style={styles.resultWrap}>
          {/* @ts-ignore video element on web */}
          <video
            src={videoUrl}
            style={styles.videoPreview}
            controls
            autoPlay
            loop
            playsInline
          />
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

      {exportState === 'error' && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>생성 실패. 다시 시도해주세요.</Text>
        </View>
      )}

      {toast && (
        <View style={styles.toastBox}>
          <Check size={14} color={theme.colors.success[400]} strokeWidth={2} />
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      )}
    </View>
  );
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const timeout = setTimeout(() => {
      img.onload = null;
      img.onerror = null;
      reject(new Error('image load timeout'));
    }, 10000);
    img.onload = () => { clearTimeout(timeout); resolve(img); };
    img.onerror = () => { clearTimeout(timeout); reject(new Error('image load failed')); };
    img.src = src;
  });
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.dark.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
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
    gap: 8,
  },
  headerTitle: {
    fontSize: theme.typography.body,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.dark.text,
  },
  countBadge: {
    backgroundColor: theme.colors.accent[500] + '20',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.radius.full,
  },
  countText: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.accent[300],
  },
  description: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    lineHeight: 20,
    marginBottom: theme.spacing.md,
  },
  carouselWrap: {
    position: 'relative',
  },
  scrollView: {
    marginLeft: -theme.spacing.lg,
    marginRight: -theme.spacing.lg,
  },
  slideWrap: {
    width: screenWidth,
    paddingHorizontal: theme.spacing.lg,
    alignItems: 'center',
  },
  navButton: {
    position: 'absolute',
    top: '50%',
    marginTop: -22,
    width: 40,
    height: 40,
    borderRadius: theme.radius.full,
    backgroundColor: 'rgba(10, 15, 30, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  navLeft: {
    left: 4,
  },
  navRight: {
    right: 4,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: theme.spacing.md,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.dark.border,
  },
  dotActive: {
    width: 20,
    borderRadius: 3,
    backgroundColor: theme.colors.accent[400],
  },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: theme.spacing.md,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.accent[500],
    ...theme.shadows.card,
  },
  generateButtonText: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.bold,
    color: '#fff',
  },
  progressWrap: {
    marginTop: theme.spacing.md,
  },
  progressBarBg: {
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.dark.surfaceLight,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.accent[400],
  },
  progressLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  progressText: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.textDim,
  },
  resultWrap: {
    marginTop: theme.spacing.md,
    alignItems: 'center',
  },
  videoPreview: {
    width: '100%',
    maxWidth: 300,
    aspectRatio: 9 / 16,
    borderRadius: theme.radius.md,
    marginBottom: theme.spacing.md,
  },
  resultButtons: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.accent[500],
  },
  downloadButtonText: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.bold,
    color: '#fff',
  },
  remakeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.dark.surfaceLight,
  },
  remakeButtonText: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.textDim,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: theme.spacing.md,
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.error[500] + '15',
  },
  errorText: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.error[400],
  },
  toastBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: theme.spacing.sm,
    padding: theme.spacing.sm,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.success[500] + '15',
  },
  toastText: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.success[400],
  },
});
