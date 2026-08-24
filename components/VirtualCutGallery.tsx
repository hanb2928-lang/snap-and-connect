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
} from 'react-native';
import { Camera, Sparkles, RefreshCw, ChevronRight } from 'lucide-react-native';
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

export function VirtualCutGallery({ imageDataUrl, productName, productCategory, onUseImage }: VirtualCutGalleryProps) {
  const [cuts, setCuts] = useState<VirtualCut[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [selectedCut, setSelectedCut] = useState<VirtualCut | null>(null);
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
      const response = await fetch(VIRTUAL_CUTS_FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({
          imageDataUrl: preparedImage,
          mimeType: 'image/png',
          productName,
          productCategory,
        }),
      });

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
      if (Platform.OS === 'web') {
        window.open(cut.imageUrl, '_blank');
      }
    },
    [onUseImage],
  );

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
                {cuts.map((cut) => (
                  <TouchableOpacity
                    key={cut.angle}
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
});
