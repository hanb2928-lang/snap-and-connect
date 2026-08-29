import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { Flame, TrendingUp, ArrowRight, Eye, MousePointerClick } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { theme } from '@/lib/theme';

interface ViralProduct {
  id: string;
  name: string;
  category: string;
  priceRange: string;
  trendScore: number;
  clickGrowth: number;
  platform: string;
  thumbnailUrl?: string;
}

// Curated viral products — in production these would come from an API
const SAMPLE_VIRAL_PRODUCTS: ViralProduct[] = [
  { id: '1', name: '음파 칫솔', category: '뷰티/케어', priceRange: '1~3만원', trendScore: 94, clickGrowth: 320, platform: '쿠팡' },
  { id: '2', name: '젤리 팝 백', category: '패션 액세서리', priceRange: '5천~2만원', trendScore: 88, clickGrowth: 210, platform: '알리' },
  { id: '3', name: '미니 무선 선풍기', category: '계절/가전', priceRange: '1~4만원', trendScore: 85, clickGrowth: 180, platform: '쿠팡' },
  { id: '4', name: '실리콘 다이어트 도시락', category: '주방/생활', priceRange: '8천~2만원', trendScore: 82, clickGrowth: 150, platform: '아마존' },
  { id: '5', name: 'LED 감성 야간 조명', category: '인테리어', priceRange: '1~3만원', trendScore: 79, clickGrowth: 130, platform: '알리' },
  { id: '6', name: '접이식 노트북 거치대', category: 'IT/오피스', priceRange: '1~5만원', trendScore: 76, clickGrowth: 110, platform: '쿠팡' },
];

interface ViralProductFeedProps {
  products?: ViralProduct[];
}

export function ViralProductFeed({ products = SAMPLE_VIRAL_PRODUCTS }: ViralProductFeedProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleQuickCreate = useCallback(async (product: ViralProduct) => {
    setLoading(true);
    try {
      router.push({
        pathname: '/result/manual',
        params: {
          productName: product.name,
          category: product.category,
          priceRange: product.priceRange,
        },
      });
    } catch {
      // navigate fails silently
    }
    setLoading(false);
  }, [router]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Flame size={18} color='#ff6b35' strokeWidth={2} />
        <Text style={styles.headerTitle}>실시간 떡상 꿀템 TOP 20</Text>
      </View>

      <Text style={styles.description}>
        쿠팡·아마존·알리에서 클릭 급상승 중인 상품입니다. 10초 만에 숏폼으로 만들어보세요.
      </Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.feedScroll}>
        {products.map((product) => (
          <View key={product.id} style={styles.productCard}>
            {/* Trend score badge */}
            <View style={styles.trendBadge}>
              <TrendingUp size={10} color='#fff' strokeWidth={2.5} />
              <Text style={styles.trendScore}>{product.trendScore}</Text>
            </View>

            {/* Product info */}
            <Text style={styles.productName} numberOfLines={2}>{product.name}</Text>
            <Text style={styles.productCategory}>{product.category}</Text>

            {/* Stats row */}
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <MousePointerClick size={10} color={theme.colors.success[400]} strokeWidth={2} />
                <Text style={styles.statText}>+{product.clickGrowth}%</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.platformText}>{product.platform}</Text>
              </View>
            </View>

            <Text style={styles.priceText}>{product.priceRange}</Text>

            {/* Quick create button */}
            <TouchableOpacity
              style={styles.createBtn}
              onPress={() => handleQuickCreate(product)}
              disabled={loading}
              activeOpacity={0.7}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Text style={styles.createBtnText}>10초 만에 만들기</Text>
                  <ArrowRight size={12} color="#fff" strokeWidth={2.5} />
                </>
              )}
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>
    </View>
  );
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
    alignItems: 'center',
    gap: 8,
    marginBottom: theme.spacing.sm,
  },
  headerTitle: {
    fontSize: 15,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.dark.text,
  },
  description: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    lineHeight: 18,
    marginBottom: theme.spacing.md,
  },
  feedScroll: {
    flexDirection: 'row',
    marginHorizontal: -4,
  },
  productCard: {
    width: 160,
    backgroundColor: theme.colors.dark.surfaceLight,
    borderRadius: theme.radius.md,
    padding: 12,
    marginRight: 10,
    position: 'relative',
  },
  trendBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: theme.radius.sm,
    backgroundColor: '#ff6b35',
  },
  trendScore: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.bold,
    color: '#fff',
  },
  productName: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
    marginBottom: 4,
    paddingRight: 32,
    minHeight: 36,
  },
  productCategory: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    marginBottom: 8,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  statText: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.success[400],
  },
  platformText: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textFaint,
  },
  priceText: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.warning[400],
    marginBottom: 10,
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.accent[500],
  },
  createBtnText: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.bold,
    color: '#fff',
  },
});
