import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Flame, ArrowRight, Sparkles, TrendingUp, RefreshCw } from 'lucide-react-native';
import { theme } from '@/lib/theme';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';

interface TrendingProduct {
  rank: number;
  name: string;
  price: string;
  originalPrice?: string;
  discountRate?: string;
  imageUrl: string;
  link: string;
  category: string;
  shopName?: string;
  marketplace?: string;
}

interface TrendingCategory {
  id: string;
  label: string;
  products: TrendingProduct[];
}

interface Props {
  onSelectProduct: (product: { name: string; price: string; imageUrl: string; link: string; category: string; marketplace?: string }) => void;
}

const PRODUCT_CACHE_TTL = 5 * 60 * 1000;
const cache = new Map<string, { data: TrendingCategory[]; ts: number }>();

export function TrendingProductCuration({ onSelectProduct }: Props) {
  const router = useRouter();
  const [categories, setCategories] = useState<TrendingCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState(0);

  const fetchTrending = useCallback(async (isRefresh = false) => {
    if (!isRefresh) {
      const cached = cache.get('coupang');
      if (cached && Date.now() - cached.ts < PRODUCT_CACHE_TTL) {
        setCategories(cached.data);
        setActiveCategory(0);
        setLoading(false);
        return;
      }
    }
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('naver-trending?marketplace=coupang');
      if (fnError) throw fnError;
      const fetched: TrendingCategory[] = data.categories || [];
      if (fetched.length === 0) throw new Error('데이터 없음');
      cache.set('coupang', { data: fetched, ts: Date.now() });
      setCategories(fetched);
      setActiveCategory(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : '인기 상품 로딩 실패');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchTrending();
  }, [fetchTrending]);

  const topProducts: TrendingProduct[] = categories[activeCategory]?.products.slice(0, 10) ?? [];

  const handleSelect = (product: TrendingProduct) => {
    onSelectProduct({
      name: product.name,
      price: product.price,
      imageUrl: product.imageUrl,
      link: product.link,
      category: product.category,
      marketplace: product.marketplace,
    });
  };

  const handleQuickCreate = async (product: TrendingProduct) => {
    try {
      const { data, error: insertError } = await supabase
        .from('scans')
        .insert({
          image_url: product.imageUrl || '',
          title: product.name,
          product_name: product.name,
          product_category: product.category,
          price_estimate: product.price,
          one_liner: `${product.name} - ${product.price}`,
          template_data: {
            priceLabel: product.price,
            oneLiner: product.name,
            category: product.category,
            accentColor: '#FF6B35',
            hook: `${product.name} 지금 떡상 중!`,
            hashtags: ['트렌드', '인기상품', '베스트', '쇼츠'],
            productAdvantages: [],
            caption: '',
          },
          shopping_matches: [{
            platform: product.marketplace || 'coupang',
            productName: product.name,
            price: product.price,
            url: product.link,
          }],
          affiliate_links: [{
            platform: 'Coupang',
            label: '쿠팡 파트너스',
            url: product.link,
          }],
        })
        .select('id')
        .single();

      if (insertError) throw insertError;
      if (data) {
        router.push(`/result/${data.id}`);
      }
    } catch {
      // silent fail — user can still manually select
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <Flame size={18} color={theme.colors.warning[400]} strokeWidth={2} />
          <Text style={styles.title}>지금 SNS에서 떡상 중인 제휴 상품 TOP 10</Text>
        </View>
        <View style={styles.loadingBox}>
          <ActivityIndicator size="small" color={theme.colors.warning[400]} />
          <Text style={styles.loadingText}>인기 상품 불러오는 중...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <Flame size={18} color={theme.colors.warning[400]} strokeWidth={2} />
          <Text style={styles.title}>지금 SNS에서 떡상 중인 제휴 상품 TOP 10</Text>
        </View>
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>인기 상품을 불러오지 못했습니다.</Text>
          <TouchableOpacity onPress={() => fetchTrending(true)} activeOpacity={0.7}>
            <RefreshCw size={14} color={theme.colors.primary[300]} strokeWidth={2} />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (categories.length === 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.headerIconWrap}>
          <Flame size={16} color="#fff" strokeWidth={2} />
        </View>
        <View style={styles.headerTextWrap}>
          <Text style={styles.title}>지금 SNS에서 떡상 중인 제휴 상품</Text>
          <Text style={styles.subtitle}>클릭 한 번으로 숏폼 제작 시작하기</Text>
        </View>
        <TouchableOpacity onPress={() => fetchTrending(true)} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <RefreshCw size={14} color={theme.colors.dark.textDim} strokeWidth={2} />
        </TouchableOpacity>
      </View>

      {/* Category tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoryScroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchTrending(true)}
            tintColor={theme.colors.warning[400]}
          />
        }
      >
        {categories.slice(0, 6).map((cat, i) => (
          <TouchableOpacity
            key={cat.id}
            style={[styles.categoryChip, activeCategory === i && styles.categoryChipActive]}
            onPress={() => setActiveCategory(i)}
            activeOpacity={0.7}
          >
            <Text style={[styles.categoryChipText, activeCategory === i && styles.categoryChipTextActive]}>
              {cat.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Top 10 products */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.productScroll}
      >
        {topProducts.map((product) => (
          <TouchableOpacity
            key={`${product.rank}-${product.name}`}
            style={styles.productCard}
            onPress={() => handleSelect(product)}
            activeOpacity={0.85}
          >
            <View style={styles.productImageWrap}>
              {product.imageUrl ? (
                <Image
                  source={{ uri: product.imageUrl }}
                  style={styles.productImage}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.productImagePlaceholder}>
                  <TrendingUp size={20} color={theme.colors.dark.textFaint} strokeWidth={1.5} />
                </View>
              )}
              <View style={styles.rankBadge}>
                <Text style={styles.rankText}>{product.rank}</Text>
              </View>
              {product.discountRate && (
                <View style={styles.discountBadge}>
                  <Text style={styles.discountText}>{product.discountRate}</Text>
                </View>
              )}
            </View>
            <Text style={styles.productName} numberOfLines={2}>{product.name}</Text>
            <Text style={styles.productPrice}>{product.price}</Text>
            {product.originalPrice && (
              <Text style={styles.productOriginalPrice}>{product.originalPrice}</Text>
            )}
            {/* Quick create button */}
            <TouchableOpacity
              style={styles.quickCreateBtn}
              onPress={(e) => {
                e.stopPropagation?.();
                handleQuickCreate(product);
              }}
              activeOpacity={0.7}
            >
              <Sparkles size={10} color={theme.colors.warning[400]} strokeWidth={2} />
              <Text style={styles.quickCreateText}>AI 숏폼 만들기</Text>
              <ArrowRight size={9} color={theme.colors.warning[400]} strokeWidth={2} />
            </TouchableOpacity>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Text style={styles.hint}>
        상품을 탭하면 제휴 링크로 연결되고, &quot;AI 숏폼 만들기&quot;를 누르면 바로 제작이 시작됩니다.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.glass.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    borderWidth: 1.5,
    borderColor: theme.glass.border,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: theme.spacing.sm,
  },
  headerIconWrap: {
    width: 28,
    height: 28,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.warning[500],
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTextWrap: {
    flex: 1,
    gap: 1,
  },
  title: {
    fontSize: 15,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.dark.text,
  },
  subtitle: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
  },
  categoryScroll: {
    flexDirection: 'row',
    marginBottom: theme.spacing.sm,
  },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.dark.surfaceLight,
    marginRight: 6,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  categoryChipActive: {
    backgroundColor: theme.colors.warning[500] + '20',
    borderColor: theme.colors.warning[400] + '60',
  },
  categoryChipText: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.textDim,
  },
  categoryChipTextActive: {
    color: theme.colors.warning[400],
  },
  productScroll: {
    flexDirection: 'row',
  },
  productCard: {
    width: 130,
    marginRight: 10,
    backgroundColor: theme.colors.dark.surfaceLight,
    borderRadius: theme.radius.md,
    padding: 8,
    gap: 3,
  },
  productImageWrap: {
    position: 'relative',
    width: '100%',
    height: 130,
    borderRadius: theme.radius.sm,
    overflow: 'hidden',
    marginBottom: 4,
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  productImagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: theme.colors.dark.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rankBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rankText: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.warning[400],
  },
  discountBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: theme.colors.error[500],
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  discountText: {
    fontSize: 9,
    fontFamily: theme.typography.fontFamily.bold,
    color: '#fff',
  },
  productName: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.text,
    lineHeight: 15,
    minHeight: 30,
  },
  productPrice: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.warning[400],
  },
  productOriginalPrice: {
    fontSize: 9,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textFaint,
    textDecorationLine: 'line-through',
  },
  quickCreateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    backgroundColor: theme.colors.warning[500] + '15',
    borderRadius: theme.radius.sm,
    paddingVertical: 5,
    marginTop: 4,
  },
  quickCreateText: {
    fontSize: 9,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.warning[400],
  },
  loadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: theme.spacing.md,
  },
  loadingText: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing.md,
  },
  errorText: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
  },
  hint: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textFaint,
    lineHeight: 14,
    marginTop: theme.spacing.sm,
  },
});
