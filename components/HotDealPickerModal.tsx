import { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  RefreshControl,
} from 'react-native';
import { Flame, X, Star, ShoppingBag, Globe, Send, ShoppingBasket, Hop as Home, Ticket, TreePalm as Palmtree, ArrowRight, TrendingUp } from 'lucide-react-native';
import { theme } from '@/lib/theme';
import { supabase } from '@/lib/supabase';

type Marketplace = 'coupang' | 'naver' | 'toss';

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
  marketplace?: Marketplace;
  rating?: number;
  reviewCount?: number;
}

interface TrendingCategory {
  id: string;
  label: string;
  products: TrendingProduct[];
}

const PLATFORM_META: Record<Marketplace, { label: string; color: string; icon: typeof ShoppingBag }> = {
  coupang: { label: '쿠팡', color: '#FF3E3E', icon: ShoppingBag },
  naver: { label: '네이버', color: '#03C75A', icon: Globe },
  toss: { label: '토스', color: '#0064FF', icon: Send },
};

const MARKETPLACES: Marketplace[] = ['coupang', 'naver', 'toss'];

const productCache = new Map<Marketplace, { data: TrendingCategory[]; ts: number }>();
const CACHE_TTL = 5 * 60 * 1000;

interface HotDealPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (product: TrendingProduct) => void;
}

export function HotDealPickerModal({ visible, onClose, onSelect }: HotDealPickerModalProps) {
  const [marketplace, setMarketplace] = useState<Marketplace>('coupang');
  const [categories, setCategories] = useState<TrendingCategory[]>([]);
  const [activeCategory, setActiveCategory] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reqIdRef = useRef(0);

  const fetchTrending = useCallback(async (mp: Marketplace, isRefresh = false) => {
    const reqId = ++reqIdRef.current;
    setError(null);
    if (!isRefresh) {
      const cached = productCache.get(mp);
      if (cached && Date.now() - cached.ts < CACHE_TTL) {
        if (reqIdRef.current !== reqId) return;
        setCategories(cached.data);
        setActiveCategory(0);
        setLoading(false);
        return;
      }
    }
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const { data, error: fnError } = await supabase.functions.invoke(`naver-trending?marketplace=${mp}`);
      if (reqIdRef.current !== reqId) return;
      if (fnError) throw fnError;

      const fetched: TrendingCategory[] = data.categories || [];
      if (fetched.length === 0) throw new Error('인기 상품을 불러올 수 없습니다.');

      productCache.set(mp, { data: fetched, ts: Date.now() });
      setCategories(fetched);
      setActiveCategory(0);
    } catch (err) {
      if (reqIdRef.current !== reqId) return;
      setError(err instanceof Error ? err.message : '인기 상품 로딩 실패');
    } finally {
      if (reqIdRef.current === reqId) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    if (visible) {
      fetchTrending(marketplace);
    }
  }, [visible, marketplace, fetchTrending]);

  const handleSelect = (product: TrendingProduct) => {
    onSelect(product);
    onClose();
  };

  const pm = PLATFORM_META[marketplace];
  const currentCategory = categories[activeCategory];
  const rankBadgeColors = [
    theme.colors.primary[500],
    theme.colors.accent[400],
    theme.colors.accent[500],
    theme.colors.neutral[400],
    theme.colors.neutral[500],
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <View style={[styles.headerIcon, { backgroundColor: pm.color }]}>
              <Flame size={20} color="#fff" strokeWidth={2.2} />
            </View>
            <View style={styles.headerText}>
              <Text style={styles.headerTitle}>실시간 핫딜에서 가져오기</Text>
              <Text style={styles.headerSub}>탭을 전환하지 않고 바로 소재 선택</Text>
            </View>
            <TouchableOpacity onPress={onClose} activeOpacity={0.7} style={styles.closeBtn}>
              <X size={22} color={theme.colors.dark.textDim} strokeWidth={2} />
            </TouchableOpacity>
          </View>

          <View style={styles.tabRow}>
            {MARKETPLACES.map((mp) => {
              const meta = PLATFORM_META[mp];
              const Icon = meta.icon;
              const isActive = marketplace === mp;
              return (
                <TouchableOpacity
                  key={mp}
                  style={[styles.tab, isActive && { backgroundColor: meta.color + '20', borderColor: meta.color }]}
                  onPress={() => setMarketplace(mp)}
                  activeOpacity={0.7}
                >
                  <Icon size={14} color={isActive ? meta.color : theme.colors.dark.textDim} strokeWidth={2} />
                  <Text style={[styles.tabLabel, isActive && { color: meta.color }]}>{meta.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {loading ? (
            <View style={styles.centerWrap}>
              <ActivityIndicator size="large" color={pm.color} />
              <Text style={styles.centerText}>{pm.label} 불러오는 중...</Text>
            </View>
          ) : error ? (
            <View style={styles.centerWrap}>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={() => fetchTrending(marketplace)}>
                <Text style={styles.retryText}>다시 시도</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {categories.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll} contentContainerStyle={styles.catScrollContent}>
                  {categories.map((cat, i) => (
                    <TouchableOpacity
                      key={cat.id}
                      style={[styles.catTab, activeCategory === i && styles.catTabActive]}
                      onPress={() => setActiveCategory(i)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.catTabText, activeCategory === i && styles.catTabTextActive]}>{cat.label}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}

              <ScrollView
                style={styles.productList}
                contentContainerStyle={{ paddingBottom: 20, gap: 8 }}
                showsVerticalScrollIndicator={false}
                refreshControl={
                  <RefreshControl
                    refreshing={refreshing}
                    onRefresh={() => fetchTrending(marketplace, true)}
                    tintColor={pm.color}
                    colors={[pm.color]}
                  />
                }
              >
                {currentCategory?.products.map((product, index) => {
                  const badgeColor = rankBadgeColors[Math.min(index, rankBadgeColors.length - 1)];
                  return (
                    <TouchableOpacity
                      key={`${product.rank}-${index}`}
                      style={styles.productCard}
                      onPress={() => handleSelect(product)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.rankBadge, { backgroundColor: badgeColor }]}>
                        <Text style={styles.rankText}>{product.rank}</Text>
                      </View>
                      <View style={styles.productInfo}>
                        <Text style={styles.productName} numberOfLines={1} adjustsFontSizeToFit>{product.name}</Text>
                        <View style={styles.productMetaRow}>
                          {product.rating && (
                            <View style={styles.ratingWrap}>
                              <Star size={11} color={theme.colors.warning[400]} strokeWidth={2} fill={theme.colors.warning[400]} />
                              <Text style={styles.ratingText}>{product.rating}</Text>
                              {product.reviewCount && <Text style={styles.reviewCount}>({product.reviewCount.toLocaleString()})</Text>}
                            </View>
                          )}
                          {product.discountRate && (
                            <View style={[styles.discountBadge, { backgroundColor: pm.color + '20' }]}>
                              <Text style={[styles.discountText, { color: pm.color }]}>{product.discountRate}</Text>
                            </View>
                          )}
                        </View>
                        <View style={styles.priceRow}>
                          <Text style={styles.productPrice}>{product.price}</Text>
                          {product.originalPrice && <Text style={styles.originalPrice}>{product.originalPrice}</Text>}
                        </View>
                      </View>
                      <View style={styles.selectBtn}>
                        <TrendingUp size={12} color={theme.colors.warning[400]} strokeWidth={2} />
                        <Text style={styles.selectBtnText}>선택</Text>
                        <ArrowRight size={11} color={theme.colors.warning[400]} strokeWidth={2.5} />
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  container: {
    height: '85%',
    backgroundColor: theme.colors.dark.bg,
    borderTopLeftRadius: theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
    paddingTop: theme.spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 17,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.dark.text,
  },
  headerSub: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: theme.spacing.lg,
    gap: 8,
    marginBottom: theme.spacing.sm,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 9,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.dark.surface,
    borderWidth: 1.5,
    borderColor: theme.colors.dark.border,
  },
  tabLabel: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.textDim,
  },
  centerWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  centerText: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
  },
  errorText: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.error[400],
    textAlign: 'center',
  },
  retryBtn: {
    backgroundColor: theme.colors.primary[600],
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.md,
  },
  retryText: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: '#fff',
  },
  catScroll: {
    maxHeight: 42,
    flexGrow: 0,
  },
  catScrollContent: {
    paddingHorizontal: theme.spacing.lg,
    gap: 6,
  },
  catTab: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 72,
    height: 30,
    paddingHorizontal: 10,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.dark.surface,
    borderWidth: 1,
    borderColor: theme.colors.dark.border,
  },
  catTabActive: {
    backgroundColor: theme.colors.primary[600],
    borderColor: theme.colors.primary[600],
  },
  catTabText: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.textDim,
  },
  catTabTextActive: {
    color: '#fff',
  },
  productList: {
    flex: 1,
    paddingHorizontal: theme.spacing.lg,
  },
  productCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.dark.surface,
    borderRadius: theme.radius.lg,
    padding: 12,
    gap: 12,
    borderWidth: 1.5,
    borderColor: theme.colors.dark.border,
  },
  rankBadge: {
    width: 30,
    height: 30,
    borderRadius: theme.radius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rankText: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.bold,
    color: '#fff',
  },
  productInfo: {
    flex: 1,
    gap: 3,
  },
  productName: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
  },
  productMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ratingWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  ratingText: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.warning[400],
  },
  reviewCount: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textFaint,
  },
  discountBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
  },
  discountText: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.bold,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  productPrice: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.primary[300],
  },
  originalPrice: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textFaint,
    textDecorationLine: 'line-through',
  },
  selectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.warning[500] + '18',
  },
  selectBtnText: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.warning[400],
  },
});
