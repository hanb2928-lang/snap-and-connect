import { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  ScrollView,
  Platform,
  Modal,
  Dimensions,
  Pressable,
  Share,
} from 'react-native';
import { Camera, Sparkles, RefreshCw, ChevronRight, X, Download, ChevronLeft, Maximize2 } from 'lucide-react-native';
import { theme } from '@/lib/theme';
import { supabaseAnonKey, VIRTUAL_CUTS_FUNCTION_URL } from '@/lib/supabase';
import { prepareImageForApi } from '@/lib/imageEdit';

type CutAngle = 'front' | 'side' | 'detail' | 'full';

interface VirtualCut {
  angle: CutAngle;
  label: string;
  imageUrl: string;
}

interface VirtualCutGalleryProps {
  imageDataUrl: string;
  productName?: string;
  productCategory?: string;
  onUseImage?: (url: string) => void;
}

const PROGRESS_MESSAGES = [
  '이미지를 준비하는 중...',
  'AI 모델이 각도별 컷을 생성 중입니다...',
  '정면, 측면, 디테일, 전체 샷을 만들고 있어요...',
  '거의 완성되었습니다. 조금만 기다려주세요...',
];

const SCREEN_WIDTH = Dimensions.get('window').width;

export function VirtualCutGallery({ imageDataUrl, productName, productCategory, onUseImage }: VirtualCutGalleryProps) {
  const [cuts, setCuts] = useState<VirtualCut[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [selectedCut, setSelectedCut] = useState<VirtualCut | null>(null);
  const [previewIndex, setPreviewIndex] = useState<number>(-1);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [downloaded, setDownloaded] = useState<number | null>(null);
  const [progressMessage, setProgressMessage] = useState(PROGRESS_MESSAGES[0]);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressStepRef = useRef(0);

  useEffect(() => {
    return () => {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    };
  }, []);

  const startProgressCycle = useCallback(() => {
    progressStepRef.current = 0;
    setProgressMessage(PROGRESS_MESSAGES[0]);
    if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    progressTimerRef.current = setInterval(() => {
      progressStepRef.current = Math.min(progressStepRef.current + 1, PROGRESS_MESSAGES.length - 1);
      setProgressMessage(PROGRESS_MESSAGES[progressStepRef.current]);
    }, 4000);
  }, []);

  const stopProgressCycle = useCallback(() => {
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
  }, []);

  const generateCuts = useCallback(async () => {
    if (loading || !imageDataUrl) return;
    setLoading(true);
    setError(null);
    setCuts([]);
    setExpanded(true);
    startProgressCycle();
    try {
      const preparedImage = await prepareImageForApi(imageDataUrl);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 180000);
      let response: Response;
      try {
        response = await fetch(VIRTUAL_CUTS_FUNCTION_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${supabaseAnonKey}`,
          },
          signal: controller.signal,
          body: JSON.stringify({
            imageDataUrl: preparedImage,
            mimeType: 'image/png',
            productName,
            productCategory,
          }),
        });
      } finally {
        clearTimeout(timeout);
      }

      if (!response.ok) {
        const errText = await response.text().catch(() => 'Unknown error');
        throw new Error(`가상 컷 생성 실패 (${response.status}): ${errText}`);
      }

      const data = await response.json();
      if (data.error) throw new Error(data.error);

      const cutsFromServer: Array<{ angle: CutAngle; label: string; imageUrl: string }> = data.cuts || [];
      const validCuts: VirtualCut[] = cutsFromServer.filter((c) => c.imageUrl);

      if (validCuts.length === 0) {
        throw new Error('가상 컷을 생성하지 못했습니다. 다시 시도해주세요.');
      }

      setCuts(validCuts);
    } catch (err) {
      setError(err instanceof Error ? err.message : '가상 컷 생성 실패');
    } finally {
      stopProgressCycle();
    }
    setLoading(false);
  }, [imageDataUrl, loading, productName, productCategory]);

  const handleUseCut = useCallback(
    (cut: VirtualCut) => {
      setSelectedCut(cut);
      if (onUseImage) {
        onUseImage(cut.imageUrl);
      }
    },
    [onUseImage],
  );

  const openPreview = useCallback((index: number) => {
    setPreviewIndex(index);
    setImageLoaded(false);
  }, []);

  const closePreview = useCallback(() => {
    setPreviewIndex(-1);
    setImageLoaded(false);
    setDownloaded(null);
  }, []);

  const goPrev = useCallback(() => {
    setImageLoaded(false);
    setDownloaded(null);
    setPreviewIndex((i) => (i > 0 ? i - 1 : cuts.length - 1));
  }, [cuts.length]);

  const goNext = useCallback(() => {
    setImageLoaded(false);
    setDownloaded(null);
    setPreviewIndex((i) => (i < cuts.length - 1 ? i + 1 : 0));
  }, [cuts.length]);

  const handleDownload = useCallback(async (url: string, index: number) => {
    try {
      if (Platform.OS === 'web') {
        const a = document.createElement('a');
        a.href = url;
        a.download = `virtual-cut-${index + 1}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } else {
        await Share.share({ url, message: '가상 컷 이미지' });
      }
      setDownloaded(index);
      setTimeout(() => setDownloaded(null), 2000);
    } catch {
      // download failed silently
    }
  }, []);

  const handlePreviewUse = useCallback(() => {
    if (previewIndex < 0 || previewIndex >= cuts.length) return;
    const cut = cuts[previewIndex];
    setSelectedCut(cut);
    if (onUseImage) onUseImage(cut.imageUrl);
    closePreview();
  }, [previewIndex, cuts, onUseImage, closePreview]);

  const previewVisible = previewIndex >= 0 && previewIndex < cuts.length;
  const previewCut = previewVisible ? cuts[previewIndex] : null;

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.header}
        onPress={generateCuts}
        disabled={loading}
        activeOpacity={0.7}
      >
        <View style={styles.headerLeft}>
          <View style={styles.iconWrap}>
            <Camera size={18} color={theme.colors.accent[400]} strokeWidth={2} />
          </View>
          <View style={styles.headerText}>
            <Text style={styles.title}>가상 컷 생성</Text>
            <Text style={styles.subtitle}>사진 1장으로 다양한 각도의 상품 컷 자동 생성</Text>
          </View>
        </View>
        {loading ? (
          <ActivityIndicator size="small" color={theme.colors.accent[400]} />
        ) : (
          <View style={styles.generateBadge}>
            <Sparkles size={14} color="#fff" strokeWidth={2} />
            <Text style={styles.generateBadgeText}>생성</Text>
          </View>
        )}
      </TouchableOpacity>

      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => setError(null)}>
            <Text style={styles.errorDismiss}>닫기</Text>
          </TouchableOpacity>
        </View>
      )}

      {expanded && (
        <View style={styles.gallerySection}>
          {loading && cuts.length === 0 && (
            <View style={styles.loadingContainer}>
              <View style={styles.loadingRow}>
                {[0, 1, 2, 3].map((i) => (
                  <View key={i} style={styles.skeletonCard}>
                    <View style={styles.skeletonImage}>
                      <ActivityIndicator size="small" color={theme.colors.dark.textDim} />
                    </View>
                    <View style={styles.skeletonLabel} />
                  </View>
                ))}
              </View>
              <View style={styles.progressWrap}>
                <ActivityIndicator size="small" color={theme.colors.accent[400]} />
                <Text style={styles.progressText}>{progressMessage}</Text>
              </View>
            </View>
          )}

          {cuts.length > 0 && (
            <>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.cutRow}
              >
                {cuts.map((cut, idx) => (
                  <View key={cut.angle} style={styles.cutCardOuter}>
                    <TouchableOpacity
                      style={[
                        styles.cutCard,
                        selectedCut?.angle === cut.angle && styles.cutCardSelected,
                      ]}
                      onPress={() => handleUseCut(cut)}
                      activeOpacity={0.8}
                    >
                      <Image
                        source={{ uri: cut.imageUrl }}
                        style={styles.cutImage}
                        resizeMode="cover"
                      />
                      <View style={styles.cutLabelWrap}>
                        <Text style={styles.cutLabel}>{cut.label}</Text>
                      </View>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.previewBtn}
                      onPress={() => openPreview(idx)}
                      activeOpacity={0.7}
                    >
                      <Maximize2 size={11} color="#fff" strokeWidth={2.5} />
                      <Text style={styles.previewBtnText}>미리보기</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>

              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={styles.refreshBtn}
                  onPress={generateCuts}
                  disabled={loading}
                  activeOpacity={0.7}
                >
                  <RefreshCw size={14} color={theme.colors.dark.textDim} strokeWidth={2} />
                  <Text style={styles.refreshText}>다시 생성</Text>
                </TouchableOpacity>
                {selectedCut && onUseImage && (
                  <TouchableOpacity
                    style={styles.useBtn}
                    onPress={() => onUseImage(selectedCut.imageUrl)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.useBtnText}>선택한 컷 사용</Text>
                    <ChevronRight size={14} color="#fff" strokeWidth={2} />
                  </TouchableOpacity>
                )}
              </View>
            </>
          )}
        </View>
      )}

      <Modal visible={previewVisible} transparent animationType="fade" onRequestClose={closePreview}>
        <Pressable style={styles.previewOverlay} onPress={closePreview}>
          <View style={styles.previewHeader}>
            <TouchableOpacity onPress={closePreview} style={styles.previewHeaderBtn} hitSlop={12}>
              <X size={22} color="#fff" strokeWidth={2.5} />
            </TouchableOpacity>
            <Text style={styles.previewTitle}>{previewCut?.label || '미리보기'}</Text>
            <View style={styles.previewHeaderSpacer} />
          </View>

          <Pressable style={styles.previewImageWrap} onPress={(e) => e.stopPropagation()}>
            {!imageLoaded && (
              <View style={styles.previewLoadingWrap}>
                <ActivityIndicator size="large" color={theme.colors.accent[400]} />
              </View>
            )}
            {previewCut && (
              <Image
                source={{ uri: previewCut.imageUrl }}
                style={styles.previewImage}
                resizeMode="contain"
                onLoad={() => setImageLoaded(true)}
              />
            )}

            {cuts.length > 1 && (
              <>
                <TouchableOpacity
                  style={[styles.previewNavBtn, styles.previewNavLeft]}
                  onPress={goPrev}
                  activeOpacity={0.7}
                >
                  <ChevronLeft size={26} color="#fff" strokeWidth={2.5} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.previewNavBtn, styles.previewNavRight]}
                  onPress={goNext}
                  activeOpacity={0.7}
                >
                  <ChevronRight size={26} color="#fff" strokeWidth={2.5} />
                </TouchableOpacity>
              </>
            )}
          </Pressable>

          <Pressable style={styles.previewFooter} onPress={(e) => e.stopPropagation()}>
            {cuts.length > 1 && (
              <View style={styles.previewDots}>
                {cuts.map((c, i) => (
                  <View
                    key={c.angle}
                    style={[styles.previewDot, i === previewIndex && styles.previewDotActive]}
                  />
                ))}
              </View>
            )}
            <View style={styles.previewActions}>
              <TouchableOpacity
                style={styles.previewActionBtn}
                onPress={() => previewCut && handleDownload(previewCut.imageUrl, previewIndex)}
                activeOpacity={0.7}
              >
                {downloaded === previewIndex ? (
                  <Text style={styles.previewActionText}>저장됨</Text>
                ) : (
                  <>
                    <Download size={15} color="#fff" strokeWidth={2} />
                    <Text style={styles.previewActionText}>저장</Text>
                  </>
                )}
              </TouchableOpacity>
              {onUseImage && (
                <TouchableOpacity
                  style={[styles.previewActionBtn, styles.previewActionPrimary]}
                  onPress={handlePreviewUse}
                  activeOpacity={0.7}
                >
                  <Text style={styles.previewActionText}>이 컷 사용</Text>
                  <ChevronRight size={15} color="#fff" strokeWidth={2} />
                </TouchableOpacity>
              )}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.dark.surface,
    borderRadius: theme.radius.lg,
    ...theme.shadows.card,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    flex: 1,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.accent[500] + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: theme.typography.body,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.dark.text,
  },
  subtitle: {
    fontSize: theme.typography.micro,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
  },
  generateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.colors.accent[500],
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 6,
    borderRadius: theme.radius.full,
  },
  generateBadgeText: {
    fontSize: theme.typography.micro,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: '#fff',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.error[500] + '20',
    marginHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.sm,
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.error[400],
  },
  errorText: {
    flex: 1,
    color: theme.colors.error[400],
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.regular,
  },
  errorDismiss: {
    fontSize: theme.typography.micro,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.error[400],
  },
  gallerySection: {
    paddingBottom: theme.spacing.md,
  },
  loadingContainer: {
    gap: theme.spacing.md,
  },
  loadingRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
  },
  progressWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
  },
  progressText: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.accent[400],
  },
  skeletonCard: {
    width: 100,
    gap: 6,
  },
  skeletonImage: {
    width: 100,
    height: 100,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.dark.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  skeletonLabel: {
    height: 14,
    borderRadius: 4,
    backgroundColor: theme.colors.dark.surfaceLight,
  },
  cutRow: {
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
  },
  cutCardOuter: {
    alignItems: 'center',
    gap: 6,
  },
  cutCard: {
    width: 110,
    borderRadius: theme.radius.md,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: theme.colors.dark.surfaceLight,
  },
  cutCardSelected: {
    borderColor: theme.colors.accent[400],
  },
  cutImage: {
    width: '100%',
    height: 110,
  },
  cutLabelWrap: {
    paddingVertical: 6,
    paddingHorizontal: theme.spacing.sm,
    alignItems: 'center',
  },
  cutLabel: {
    fontSize: theme.typography.micro,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
  },
  previewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: theme.colors.accent[500] + '30',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.accent[400] + '50',
  },
  previewBtnText: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.accent[400],
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  refreshText: {
    fontSize: theme.typography.micro,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.textDim,
  },
  useBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.colors.accent[500],
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 8,
    borderRadius: theme.radius.md,
  },
  useBtnText: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: '#fff',
  },
  previewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
  },
  previewHeaderBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewTitle: {
    fontSize: theme.typography.body,
    fontFamily: theme.typography.fontFamily.bold,
    color: '#fff',
  },
  previewHeaderSpacer: {
    width: 36,
  },
  previewImageWrap: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewLoadingWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH,
  },
  previewNavBtn: {
    position: 'absolute',
    top: '50%',
    marginTop: -22,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewNavLeft: {
    left: theme.spacing.sm,
  },
  previewNavRight: {
    right: theme.spacing.sm,
  },
  previewFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: 40,
    paddingHorizontal: theme.spacing.lg,
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  previewDots: {
    flexDirection: 'row',
    gap: 6,
  },
  previewDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  previewDotActive: {
    backgroundColor: theme.colors.accent[400],
    width: 20,
    borderRadius: 3.5,
  },
  previewActions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  previewActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 10,
    borderRadius: theme.radius.md,
  },
  previewActionPrimary: {
    backgroundColor: theme.colors.accent[500],
  },
  previewActionText: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: '#fff',
  },
});
