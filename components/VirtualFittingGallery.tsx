import { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Modal,
  Pressable,
  Platform,
  Share,
} from 'react-native';
import { User, Sparkles, RefreshCw, ChevronRight, Shirt, X, Download, ChevronLeft, Maximize2, Check, PackageCheck, Share2 } from 'lucide-react-native';
import { theme } from '@/lib/theme';
import { supabaseAnonKey, VIRTUAL_FITTING_FUNCTION_URL } from '@/lib/supabase';
import { urlToDataUrl } from '@/lib/base64';
import { normalizeImageDataUrl, prepareImageForEdit } from '@/lib/imageEdit';

type ModelType = 'asian-female-young' | 'asian-male-young' | 'western-female' | 'asian-female-30s';

interface FittingImage {
  modelType: ModelType;
  label: string;
  imageUrl: string;
}

interface VirtualFittingGalleryProps {
  imageDataUrl: string;
  productName?: string;
  productCategory?: string;
  onUseImage?: (url: string) => void;
}

const PROGRESS_MESSAGES = [
  '이미지를 준비하는 중...',
  'AI 모델이 다양한 모델 착용 컷을 생성 중입니다...',
  '아시아 여성, 남성, 서양 여성 등 다양한 모델을 만들고 있어요...',
  '거의 완성되었습니다. 조금만 기다려주세요...',
];

export function VirtualFittingGallery({
  imageDataUrl,
  productName,
  productCategory,
  onUseImage,
}: VirtualFittingGalleryProps) {
  const [results, setResults] = useState<FittingImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [selected, setSelected] = useState<FittingImage | null>(null);
  const [previewIndex, setPreviewIndex] = useState<number>(-1);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [downloaded, setDownloaded] = useState<number | null>(null);
  const [batchDownloading, setBatchDownloading] = useState(false);
  const [batchDone, setBatchDone] = useState(false);
  const [shared, setShared] = useState<number | null>(null);
  const [progressMessage, setProgressMessage] = useState(PROGRESS_MESSAGES[0]);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressStepRef = useRef(0);

  useEffect(() => {
    return () => {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    };
  }, []);

  useEffect(() => {
    setResults([]);
    setSelected(null);
    setDownloaded(null);
    setShared(null);
    setBatchDone(false);
    setError(null);
    setExpanded(false);
  }, [imageDataUrl]);

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

  const generate = useCallback(async () => {
    if (loading || !imageDataUrl) return;
    setLoading(true);
    setError(null);
    setResults([]);
    setSelected(null);
    setDownloaded(null);
    setShared(null);
    setBatchDone(false);
    setExpanded(true);
    startProgressCycle();
    try {
      const dataUrl = imageDataUrl.startsWith('data:')
        ? imageDataUrl
        : await urlToDataUrl(imageDataUrl);
      const preparedImage = await prepareImageForEdit(normalizeImageDataUrl(dataUrl));
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 180000);
      let response: Response;
      try {
        response = await fetch(VIRTUAL_FITTING_FUNCTION_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${supabaseAnonKey}`,
            apikey: supabaseAnonKey,
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
        throw new Error(`가상 피팅 실패 (${response.status}): ${errText}`);
      }

      const data = await response.json();
      if (data.error) throw new Error(data.error);

      const raw: Array<{ modelType: ModelType; label: string; imageUrl: string }> =
        data.results || [];
      const uploaded: FittingImage[] = raw.filter((r) => r.imageUrl);

      setResults(uploaded);
      if (uploaded.length === 0) {
        setError('AI가 착용 컷을 생성하지 못했어요. 다시 시도해주세요.');
      } else if (data.failedCount && data.totalRequested && data.failedCount > 0) {
        setError(`${data.totalRequested}장 중 ${data.failedCount}장 생성 실패. ${uploaded.length}장만 표시됩니다. 다시 생성해보세요.`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '가상 피팅 생성 실패';
      if (err instanceof Error && err.name === 'AbortError') {
        setError('요청 시간이 초과되었습니다. 네트워크 환경을 확인 후 다시 시도해주세요.');
      } else {
        setError(msg);
      }
    } finally {
      stopProgressCycle();
      setLoading(false);
    }
  }, [imageDataUrl, loading, productName, productCategory]);

  const handleSelect = useCallback(
    (item: FittingImage) => {
      setSelected(item);
    },
    [],
  );

  const openPreview = useCallback((index: number) => {
    setPreviewIndex(index);
    setImageLoaded(false);
  }, []);

  const closePreview = useCallback(() => {
    setPreviewIndex(-1);
    setImageLoaded(false);
    setDownloaded(null);
    setShared(null);
  }, []);

  const goPrev = useCallback(() => {
    setImageLoaded(false);
    setDownloaded(null);
    setShared(null);
    setPreviewIndex((i) => (i > 0 ? i - 1 : results.length - 1));
  }, [results.length]);

  const goNext = useCallback(() => {
    setImageLoaded(false);
    setDownloaded(null);
    setShared(null);
    setPreviewIndex((i) => (i < results.length - 1 ? i + 1 : 0));
  }, [results.length]);

  const handleDownload = useCallback(async (url: string, index: number) => {
    try {
      if (Platform.OS === 'web') {
        const res = await fetch(url);
        const blob = await res.blob();
        const objectUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = objectUrl;
        a.download = `virtual-fitting-${index + 1}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(objectUrl);
      } else {
        await Share.share({ url, message: '가상 피팅 이미지' });
      }
      setDownloaded(index);
      setTimeout(() => setDownloaded(null), 2000);
    } catch {
      // download failed silently
    }
  }, []);

  const handlePreviewUse = useCallback(() => {
    if (previewIndex < 0 || previewIndex >= results.length) return;
    const item = results[previewIndex];
    setSelected(item);
    if (onUseImage) onUseImage(item.imageUrl);
    closePreview();
  }, [previewIndex, results, onUseImage, closePreview]);

  const handleBatchDownload = useCallback(async () => {
    if (batchDownloading || results.length === 0) return;
    if (Platform.OS !== 'web') {
      setBatchDownloading(true);
      for (const item of results) {
        try {
          await Share.share({ url: item.imageUrl, message: `${item.label} - AI 가상 피팅` });
        } catch {
          // share cancelled
        }
      }
      setBatchDone(true);
      setBatchDownloading(false);
      setTimeout(() => setBatchDone(false), 2500);
      return;
    }
    setBatchDownloading(true);
    let downloadedCount = 0;
    try {
      for (let i = 0; i < results.length; i++) {
        try {
          const res = await fetch(results[i].imageUrl);
          const blob = await res.blob();
          const objectUrl = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = objectUrl;
          a.download = `virtual-fitting-${i + 1}.png`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(objectUrl);
          downloadedCount++;
          if (i < results.length - 1) await new Promise((r) => setTimeout(r, 400));
        } catch {
          // individual download failed, continue with rest
        }
      }
      if (downloadedCount > 0) {
        setBatchDone(true);
        setTimeout(() => setBatchDone(false), 2500);
      }
      if (downloadedCount < results.length) {
        setError(`${results.length}장 중 ${downloadedCount}장만 저장되었습니다. 네트워크를 확인 후 다시 시도해주세요.`);
      }
    } catch {
      setError('일괄 저장 중 오류가 발생했습니다.');
    }
    setBatchDownloading(false);
  }, [batchDownloading, results]);

  const handleShare = useCallback(async (url: string, label: string, index: number) => {
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.share) {
        const res = await fetch(url);
        const blob = await res.blob();
        const file = new File([blob], `virtual-fitting-${index + 1}.png`, { type: 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: label, text: `${label} - AI 가상 피팅` });
        } else {
          await navigator.share({ title: label, text: `${label} - AI 가상 피팅`, url });
        }
      } else if (Platform.OS !== 'web') {
        await Share.share({ url, message: `${label} - AI 가상 피팅` });
      } else {
        window.open(url, '_blank');
      }
      setShared(index);
      setTimeout(() => setShared(null), 2000);
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setError('공유 중 오류가 발생했습니다.');
      }
    }
  }, []);

  const previewVisible = previewIndex >= 0 && previewIndex < results.length;
  const previewItem = previewVisible ? results[previewIndex] : null;

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.header}
        onPress={generate}
        disabled={loading}
        activeOpacity={0.7}
      >
        <View style={styles.headerLeft}>
          <View style={styles.iconWrap}>
            <Shirt size={18} color={theme.colors.success[400]} strokeWidth={2} />
          </View>
          <View style={styles.headerText}>
            <Text style={styles.title}>AI 가상 피팅</Text>
            <Text style={styles.subtitle}>단품 사진을 다양한 모델 착용 컷으로 변환</Text>
          </View>
        </View>
        {loading ? (
          <ActivityIndicator size="small" color={theme.colors.success[400]} />
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
          {loading && results.length === 0 && (
            <View style={styles.loadingContainer}>
              <View style={styles.grid}>
                {[0, 1, 2, 3].map((i) => (
                  <View key={i} style={styles.tileCard}>
                    <View style={styles.skeletonImage}>
                      <ActivityIndicator size="small" color={theme.colors.dark.textDim} />
                    </View>
                    <View style={styles.skeletonLabel} />
                  </View>
                ))}
              </View>
              <View style={styles.progressWrap}>
                <ActivityIndicator size="small" color={theme.colors.success[400]} />
                <Text style={styles.progressText}>{progressMessage}</Text>
              </View>
            </View>
          )}

          {results.length > 0 && (
            <>
              <View style={styles.grid}>
                {results.map((item, idx) => {
                  const isSelected = selected?.modelType === item.modelType;
                  const isDownloaded = downloaded === idx;
                  return (
                    <View key={item.modelType} style={styles.tileCard}>
                      <TouchableOpacity
                        style={[styles.tileImageWrap, isSelected && styles.tileImageWrapSelected]}
                        onPress={() => handleSelect(item)}
                        activeOpacity={0.85}
                      >
                        <Image
                          source={{ uri: item.imageUrl }}
                          style={styles.tileImage}
                          resizeMode="cover"
                        />
                        <View style={styles.tileBadge}>
                          <User size={9} color="#fff" strokeWidth={2.5} />
                          <Text style={styles.tileBadgeText}>{item.label}</Text>
                        </View>
                        {isSelected && (
                          <View style={styles.tileSelectedCheck}>
                            <Check size={14} color="#fff" strokeWidth={3} />
                          </View>
                        )}
                      </TouchableOpacity>
                      <View style={styles.tileActions}>
                        <TouchableOpacity
                          style={styles.tileActionBtn}
                          onPress={() => openPreview(idx)}
                          activeOpacity={0.7}
                        >
                          <Maximize2 size={12} color={theme.colors.dark.textDim} strokeWidth={2} />
                          <Text style={styles.tileActionText}>미리보기</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.tileActionBtn}
                          onPress={() => handleShare(item.imageUrl, item.label, idx)}
                          activeOpacity={0.7}
                        >
                          {shared === idx ? (
                            <Check size={12} color={theme.colors.success[400]} strokeWidth={2.5} />
                          ) : (
                            <Share2 size={12} color={theme.colors.dark.textDim} strokeWidth={2} />
                          )}
                          <Text style={[styles.tileActionText, shared === idx && styles.tileActionTextShared]}>
                            {shared === idx ? '공유됨' : '공유'}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.tileActionBtn}
                          onPress={() => handleDownload(item.imageUrl, idx)}
                          activeOpacity={0.7}
                        >
                          {isDownloaded ? (
                            <Check size={12} color={theme.colors.success[400]} strokeWidth={2.5} />
                          ) : (
                            <Download size={12} color={theme.colors.dark.textDim} strokeWidth={2} />
                          )}
                          <Text style={[styles.tileActionText, isDownloaded && styles.tileActionTextDone]}>
                            {isDownloaded ? '완료' : '저장'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </View>

              <View style={styles.batchRow}>
                <TouchableOpacity
                  style={[styles.batchBtn, batchDone && styles.batchBtnDone]}
                  onPress={handleBatchDownload}
                  disabled={batchDownloading}
                  activeOpacity={0.7}
                >
                  {batchDone ? (
                    <Check size={14} color={theme.colors.success[400]} strokeWidth={2.5} />
                  ) : batchDownloading ? (
                    <ActivityIndicator size={14} color={theme.colors.success[400]} />
                  ) : (
                    <PackageCheck size={14} color={theme.colors.success[400]} strokeWidth={2} />
                  )}
                  <Text style={[styles.batchBtnText, batchDone && styles.batchBtnTextDone]}>
                    {batchDone ? '모두 저장됨' : batchDownloading ? '저장 중...' : `전체 ${results.length}장 저장`}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={styles.refreshBtn}
                  onPress={generate}
                  disabled={loading}
                  activeOpacity={0.7}
                >
                  <RefreshCw size={14} color={theme.colors.dark.textDim} strokeWidth={2} />
                  <Text style={styles.refreshText}>다시 생성</Text>
                </TouchableOpacity>
                {selected && onUseImage && (
                  <TouchableOpacity
                    style={styles.useBtn}
                    onPress={() => onUseImage(selected.imageUrl)}
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
            <Text style={styles.previewTitle}>{previewItem?.label || '미리보기'}</Text>
            <View style={styles.previewHeaderSpacer} />
          </View>

          <Pressable style={styles.previewImageWrap} onPress={() => {}}>
            {!imageLoaded && (
              <View style={styles.previewLoadingWrap}>
                <ActivityIndicator size="large" color={theme.colors.success[400]} />
              </View>
            )}
            {previewItem && (
              <Image
                source={{ uri: previewItem.imageUrl }}
                style={styles.previewImage}
                resizeMode="contain"
                onLoad={() => setImageLoaded(true)}
              />
            )}

            {results.length > 1 && (
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

          <Pressable style={styles.previewFooter} onPress={() => {}}>
            {results.length > 1 && (
              <View style={styles.previewDots}>
                {results.map((r, i) => (
                  <View
                    key={r.modelType}
                    style={[styles.previewDot, i === previewIndex && styles.previewDotActive]}
                  />
                ))}
              </View>
            )}
            <View style={styles.previewActions}>
              <TouchableOpacity
                style={styles.previewActionBtn}
                onPress={() => previewItem && handleDownload(previewItem.imageUrl, previewIndex)}
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
              <TouchableOpacity
                style={styles.previewActionBtn}
                onPress={() => previewItem && handleShare(previewItem.imageUrl, previewItem.label, previewIndex)}
                activeOpacity={0.7}
              >
                {shared === previewIndex ? (
                  <Text style={styles.previewActionText}>공유됨</Text>
                ) : (
                  <>
                    <Share2 size={15} color="#fff" strokeWidth={2} />
                    <Text style={styles.previewActionText}>공유</Text>
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
    borderWidth: 1.5,
    borderColor: theme.colors.success[500] + '40',
    borderRadius: theme.radius.lg,
    margin: 4,
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
    backgroundColor: theme.colors.success[500] + '20',
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
    backgroundColor: theme.colors.success[500],
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 8,
    borderRadius: theme.radius.full,
    ...theme.shadows.card,
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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  progressWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    marginTop: theme.spacing.sm,
  },
  progressText: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.success[400],
  },
  tileCard: {
    width: '48.5%',
    gap: 6,
  },
  skeletonImage: {
    width: '100%',
    aspectRatio: 0.85,
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
  tileImageWrap: {
    width: '100%',
    aspectRatio: 0.85,
    borderRadius: theme.radius.md,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: theme.colors.dark.surfaceLight,
    position: 'relative',
  },
  tileImageWrapSelected: {
    borderColor: theme.colors.success[400],
  },
  tileImage: {
    width: '100%',
    height: '100%',
  },
  tileBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: theme.radius.full,
  },
  tileBadgeText: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: '#fff',
  },
  tileSelectedCheck: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.colors.success[500],
    justifyContent: 'center',
    alignItems: 'center',
  },
  tileActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  tileActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: 3,
  },
  tileActionText: {
    fontSize: 9,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.textDim,
  },
  tileActionTextDone: {
    color: theme.colors.success[400],
  },
  tileActionTextShared: {
    color: theme.colors.success[400],
  },
  batchRow: {
    paddingHorizontal: theme.spacing.md,
    marginTop: theme.spacing.sm,
  },
  batchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: theme.colors.success[500] + '15',
    borderWidth: 1.5,
    borderColor: theme.colors.success[500] + '40',
    paddingVertical: 10,
    borderRadius: theme.radius.md,
  },
  batchBtnDone: {
    borderColor: theme.colors.success[500] + '60',
    backgroundColor: theme.colors.success[500] + '15',
  },
  batchBtnText: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.success[400],
  },
  batchBtnTextDone: {
    color: theme.colors.success[400],
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
    backgroundColor: theme.colors.success[500],
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
    width: '100%',
    aspectRatio: 1,
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
    width: '100%',
    height: '100%',
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
    backgroundColor: theme.colors.success[400],
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
    backgroundColor: theme.colors.success[500],
  },
  previewActionText: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: '#fff',
  },
});
