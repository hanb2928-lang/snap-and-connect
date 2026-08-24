import { useState, useCallback } from 'react';
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
import { User, Sparkles, RefreshCw, ChevronRight, Shirt } from 'lucide-react-native';
import { theme } from '@/lib/theme';
import { supabaseAnonKey, VIRTUAL_FITTING_FUNCTION_URL } from '@/lib/supabase';
import { cleanBase64 } from '@/lib/base64';
import { uploadEditedImage, prepareImageForApi } from '@/lib/imageEdit';

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

  const generate = useCallback(async () => {
    if (loading || !imageDataUrl) return;
    setLoading(true);
    setError(null);
    setResults([]);
    setExpanded(true);
    try {
      const preparedImage = await prepareImageForApi(imageDataUrl);
      const response = await fetch(VIRTUAL_FITTING_FUNCTION_URL, {
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
        throw new Error(`가상 피팅 실패 (${response.status}): ${errText}`);
      }

      const data = await response.json();
      if (data.error) throw new Error(data.error);

      const raw: Array<{ modelType: ModelType; label: string; imageBase64: string; mimeType: string }> =
        data.results || [];
      const uploaded: FittingImage[] = [];

      for (const item of raw) {
        const base64 = cleanBase64(item.imageBase64);
        const url = await uploadEditedImage(base64, item.mimeType || 'image/png');
        uploaded.push({ modelType: item.modelType, label: item.label, imageUrl: url });
      }

      setResults(uploaded);
    } catch (err) {
      setError(err instanceof Error ? err.message : '가상 피팅 생성 실패');
    }
    setLoading(false);
  }, [imageDataUrl, loading, productName, productCategory]);

  const handleSelect = useCallback(
    (item: FittingImage) => {
      setSelected(item);
      if (onUseImage) {
        onUseImage(item.imageUrl);
      }
    },
    [onUseImage],
  );

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
          )}

          {results.length > 0 && (
            <>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.resultRow}
              >
                {results.map((item) => (
                  <TouchableOpacity
                    key={item.modelType}
                    style={[
                      styles.resultCard,
                      selected?.modelType === item.modelType && styles.resultCardSelected,
                    ]}
                    onPress={() => handleSelect(item)}
                    activeOpacity={0.8}
                  >
                    <Image
                      source={{ uri: item.imageUrl }}
                      style={styles.resultImage}
                      resizeMode="cover"
                    />
                    <View style={styles.resultLabelWrap}>
                      <User size={10} color={theme.colors.success[400]} strokeWidth={2} />
                      <Text style={styles.resultLabel}>{item.label}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>

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
  loadingRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
  },
  skeletonCard: {
    width: 100,
    gap: 6,
  },
  skeletonImage: {
    width: 100,
    height: 130,
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
  resultRow: {
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
  },
  resultCard: {
    width: 110,
    borderRadius: theme.radius.md,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: theme.colors.dark.surfaceLight,
  },
  resultCardSelected: {
    borderColor: theme.colors.success[400],
  },
  resultImage: {
    width: '100%',
    height: 140,
  },
  resultLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: theme.spacing.sm,
  },
  resultLabel: {
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
});
