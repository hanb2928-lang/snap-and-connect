import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, ActivityIndicator, Linking } from 'react-native';
import { ShoppingBag, ExternalLink, Link2 } from 'lucide-react-native';
import { useLocalSearchParams } from 'expo-router';
import { theme } from '@/lib/theme';
import { getLinkInBioBySlug, getProductsForLinkInBio, type LinkInBioPage, type LinkInBioProduct } from '@/lib/linkInBio';

export default function LinkInBioPage() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const [page, setPage] = useState<LinkInBioPage | null>(null);
  const [products, setProducts] = useState<LinkInBioProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!slug) {
        setLoading(false);
        return;
      }
      const p = await getLinkInBioBySlug(slug);
      if (!p) {
        setLoading(false);
        return;
      }
      setPage(p);
      const prods = await getProductsForLinkInBio(p.scan_ids);
      setProducts(prods);
      setLoading(false);
    })();
  }, [slug]);

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={theme.colors.accent[400]} />
      </View>
    );
  }

  if (!page) {
    return (
      <View style={styles.centerContainer}>
        <Link2 size={48} color={theme.colors.dark.textFaint} strokeWidth={1.5} />
        <Text style={styles.notFoundTitle}>페이지를 찾을 수 없어요</Text>
        <Text style={styles.notFoundDesc}>링크를 다시 확인해주세요.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.avatarWrap}>
          <ShoppingBag size={24} color="#fff" strokeWidth={2} />
        </View>
        <Text style={styles.pageTitle}>{page.title}</Text>
        {page.bio ? <Text style={styles.pageBio}>{page.bio}</Text> : null}
        <Text style={styles.productCount}>상품 {products.length}개</Text>
      </View>

      {/* Product grid */}
      <View style={styles.grid}>
        {products.map((product) => (
          <TouchableOpacity
            key={product.scan_id}
            style={styles.card}
            onPress={() => {
              const url = product.short_url || product.affiliate_url;
              if (url) Linking.openURL(url).catch(() => {});
            }}
            activeOpacity={0.8}
          >
            <Image
              source={{ uri: product.image_url }}
              style={styles.cardImage}
              resizeMode="cover"
            />
            <View style={styles.cardBody}>
              <Text style={styles.cardTitle} numberOfLines={2}>{product.product_name || '상품'}</Text>
              {product.price_estimate ? (
                <Text style={styles.cardPrice}>{product.price_estimate}</Text>
              ) : null}
              <View style={styles.cardLinkRow}>
                <ExternalLink size={11} color={theme.colors.accent[400]} strokeWidth={2} />
                <Text style={styles.cardLinkText}>구매하러 가기</Text>
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {products.length === 0 && (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>아직 등록된 상품이 없어요.</Text>
        </View>
      )}

      <Text style={styles.footer}>숏커넥트로 생성됨</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.dark.bg,
  },
  scrollContent: {
    maxWidth: 600,
    alignSelf: 'center',
    width: '100%',
    paddingBottom: 40,
  },
  centerContainer: {
    flex: 1,
    backgroundColor: theme.colors.dark.bg,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 30,
    paddingHorizontal: 20,
    gap: 8,
  },
  avatarWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: theme.colors.accent[500],
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  pageTitle: {
    fontSize: 22,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.dark.text,
  },
  pageBio: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    textAlign: 'center',
  },
  productCount: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.accent[400],
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    gap: 12,
  },
  card: {
    width: '47%',
    flexGrow: 1,
    backgroundColor: theme.colors.dark.surface,
    borderRadius: theme.radius.lg,
    overflow: 'hidden',
    ...theme.shadows.card,
  },
  cardImage: {
    width: '100%',
    aspectRatio: 1,
  },
  cardBody: {
    padding: 12,
    gap: 4,
  },
  cardTitle: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
    lineHeight: 18,
  },
  cardPrice: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.accent[400],
  },
  cardLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  cardLinkText: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.accent[400],
  },
  emptyBox: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
  },
  notFoundTitle: {
    fontSize: 18,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.dark.text,
  },
  notFoundDesc: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
  },
  footer: {
    textAlign: 'center',
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textFaint,
    marginTop: 30,
  },
});
