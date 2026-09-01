import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Image,
  StyleSheet,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { Search, Film, Check, X, RefreshCw } from 'lucide-react-native';
import { theme } from '@/lib/theme';
import { StockVideoClip, searchStockVideos } from '@/lib/pexelsVideo';

interface StockVideoPickerProps {
  productName?: string;
  productCategory?: string;
  orientation?: 'portrait' | 'landscape' | 'square';
  selectedClip: StockVideoClip | null;
  onSelectClip: (clip: StockVideoClip | null) => void;
}

export function StockVideoPicker({
  productName,
  productCategory,
  orientation = 'portrait',
  selectedClip,
  onSelectClip,
}: StockVideoPickerProps) {
  const [clips, setClips] = useState<StockVideoClip[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const buildQuery = useCallback(() => {
    if (searchQuery.trim()) return searchQuery.trim();
    if (productName && productCategory) return `${productName} ${productCategory}`;
    if (productName) return productName;
    if (productCategory) return productCategory;
    return '';
  }, [searchQuery, productName, productCategory]);

  const handleSearch = useCallback(async () => {
    const query = buildQuery();
    if (!query) {
      setError('검색어를 입력하거나 제품 정보를 먼저 불러와주세요.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const results = await searchStockVideos(query, orientation, 12);
      setClips(results);
      if (results.length === 0) {
        setError('검색된 영상이 없습니다. 다른 키워드로 시도해보세요.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '영상 검색에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, [buildQuery, orientation]);

  const initialQuery = productName || productCategory || '';
  const hasSearched = clips.length > 0 || error !== null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerIconWrap}>
          <Film size={16} color={theme.colors.success[400]} strokeWidth={2.5} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>제품 테마 영상 가져오기</Text>
          <Text style={styles.subtitle}>
            제품과 관련된 무료 재사용 영상을 검색해서 숏폼에 활용하세요
          </Text>
        </View>
      </View>

      <View style={styles.searchRow}>
        <View style={styles.searchInputWrap}>
          <Search size={15} color={theme.colors.dark.textDim} strokeWidth={2} />
          <TextInput
            style={styles.searchInput}
            placeholder={initialQuery || '예: 운동화 러닝, 스킨케어 화장품'}
            placeholderTextColor={theme.colors.dark.textDim}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
            onSubmitEditing={handleSearch}
          />
        </View>
        <TouchableOpacity
          style={styles.searchBtn}
          onPress={handleSearch}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Search size={16} color="#fff" strokeWidth={2.5} />
          )}
        </TouchableOpacity>
      </View>

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {selectedClip && (
        <View style={styles.selectedBox}>
          <Image
            source={{ uri: selectedClip.thumbnailUrl }}
            style={styles.selectedThumb}
            resizeMode="cover"
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.selectedTitle} numberOfLines={1}>
              선택된 영상 #{selectedClip.id}
            </Text>
            <Text style={styles.selectedMeta}>
              {selectedClip.ratio} · {selectedClip.duration}초 · {selectedClip.author}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => onSelectClip(null)}
            style={styles.selectedRemoveBtn}
            activeOpacity={0.7}
          >
            <X size={16} color={theme.colors.dark.textDim} strokeWidth={2} />
          </TouchableOpacity>
        </View>
      )}

      {hasSearched && !loading && clips.length > 0 && (
        <View style={styles.clipGridLabel}>
          <Text style={styles.clipGridLabelText}>
            {clips.length}개 영상 · 탭하여 선택
          </Text>
          <TouchableOpacity onPress={handleSearch} activeOpacity={0.7}>
            <View style={styles.refreshRow}>
              <RefreshCw size={12} color={theme.colors.dark.textDim} strokeWidth={2} />
              <Text style={styles.refreshText}>새로고침</Text>
            </View>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={clips}
        keyExtractor={(item) => String(item.id)}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.clipList}
        renderItem={({ item }) => {
          const isSelected = selectedClip?.id === item.id;
          return (
            <TouchableOpacity
              style={[styles.clipCard, isSelected && styles.clipCardActive]}
              onPress={() => onSelectClip(isSelected ? null : item)}
              activeOpacity={0.85}
            >
              <Image
                source={{ uri: item.thumbnailUrl }}
                style={styles.clipThumb}
                resizeMode="cover"
              />
              <View style={styles.clipOverlay}>
                <View style={styles.clipBadge}>
                  <Text style={styles.clipBadgeText}>{item.duration}초</Text>
                </View>
                {isSelected && (
                  <View style={styles.clipSelectedBadge}>
                    <Check size={14} color="#fff" strokeWidth={2.5} />
                  </View>
                )}
                <View style={styles.clipPlayBadge}>
                  <Film size={20} color="#fff" strokeWidth={2} />
                </View>
              </View>
              <View style={styles.clipMetaBox}>
                <Text style={styles.clipRatio}>{item.ratio}</Text>
                <Text style={styles.clipAuthor} numberOfLines={1}>{item.author}</Text>
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          loading ? null : error ? null : (
            <View style={styles.emptyState}>
              <Film size={24} color={theme.colors.dark.textDim} strokeWidth={1.5} />
              <Text style={styles.emptyText}>검색 버튼을 눌러 영상을 찾아보세요</Text>
            </View>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.dark.surfaceLight,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    marginTop: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.colors.success[400] + '25',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: theme.spacing.sm + 2,
  },
  headerIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.success[400] + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.dark.text,
  },
  subtitle: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    marginTop: 2,
  },
  searchRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: theme.spacing.sm,
  },
  searchInputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.colors.dark.surface,
    borderRadius: theme.radius.md,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: theme.colors.dark.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.text,
    paddingVertical: 10,
  },
  searchBtn: {
    backgroundColor: theme.colors.success[500],
    borderRadius: theme.radius.md,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorBox: {
    backgroundColor: theme.colors.error[400] + '12',
    borderRadius: theme.radius.sm,
    padding: 10,
    marginBottom: theme.spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.error[400] + '60',
  },
  errorText: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.error[400],
    lineHeight: 17,
  },
  selectedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: theme.colors.success[500] + '12',
    borderRadius: theme.radius.md,
    padding: 10,
    marginBottom: theme.spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.success[400] + '60',
  },
  selectedThumb: {
    width: 48,
    height: 48,
    borderRadius: theme.radius.sm,
  },
  selectedTitle: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
  },
  selectedMeta: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    marginTop: 2,
  },
  selectedRemoveBtn: {
    padding: 6,
  },
  clipGridLabel: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  clipGridLabelText: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.textDim,
  },
  refreshRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  refreshText: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
  },
  clipList: {
    gap: 10,
  },
  clipCard: {
    width: 120,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.dark.surface,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  clipCardActive: {
    borderColor: theme.colors.success[400],
  },
  clipThumb: {
    width: 120,
    height: 180,
  },
  clipOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  clipBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  clipBadgeText: {
    fontSize: 9,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: '#fff',
  },
  clipSelectedBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: theme.colors.success[500],
    justifyContent: 'center',
    alignItems: 'center',
  },
  clipPlayBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  clipMetaBox: {
    paddingHorizontal: 6,
    paddingVertical: 4,
    backgroundColor: theme.colors.dark.surface,
  },
  clipRatio: {
    fontSize: 9,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
  },
  clipAuthor: {
    fontSize: 8,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    marginTop: 1,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
    gap: 8,
  },
  emptyText: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
  },
});
