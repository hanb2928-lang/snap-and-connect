import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Store, Link2, Flame, QrCode, Copy, Check, ArrowRight } from 'lucide-react-native';
import { theme } from '@/lib/theme';
import type { HybridMapping } from '@/types/database';

interface HybridBannerCardProps {
  hybridMapping: HybridMapping;
}

export function HybridBannerCard({ hybridMapping }: HybridBannerCardProps) {
  const [copied, setCopied] = useState(false);
  const ctx = hybridMapping.localStoreContext;
  if (!ctx) return null;

  const handleCopy = () => {
    const text = `${hybridMapping.combinedHook}\n\n${hybridMapping.combinedCaption}`;
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }).catch(() => {});
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <Flame size={16} color={theme.colors.warning[400]} strokeWidth={2.5} />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.title}>하이브리드 매핑 완성</Text>
          <Text style={styles.subtitle}>동네 매장 홍보 + 온라인 제휴 수익을 동시에</Text>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Store size={14} color={theme.colors.accent[400]} strokeWidth={2} />
          <Text style={styles.sectionLabel}>로컬 매장 인식</Text>
        </View>
        <View style={styles.storeInfoRow}>
          <View style={styles.storeTypeBadge}>
            <Text style={styles.storeTypeText}>{ctx.storeType}</Text>
          </View>
          <Text style={styles.neighborhoodTag}>#{ctx.neighborhoodTag}</Text>
        </View>
        {ctx.detectedItems.length > 0 && (
          <View style={styles.itemsRow}>
            {ctx.detectedItems.map((item, i) => (
              <View key={i} style={styles.itemChip}>
                <Text style={styles.itemChipText}>{item}</Text>
              </View>
            ))}
          </View>
        )}
        {ctx.suggestedOffer ? (
          <View style={styles.offerBox}>
            <Flame size={12} color={theme.colors.warning[400]} strokeWidth={2} />
            <Text style={styles.offerText}>{ctx.suggestedOffer}</Text>
          </View>
        ) : null}
      </View>

      {hybridMapping.affiliateMatch && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Link2 size={14} color={theme.colors.primary[300]} strokeWidth={2} />
            <Text style={styles.sectionLabel}>온라인 제휴 매칭</Text>
          </View>
          <View style={styles.affiliateCard}>
            <View style={styles.affiliatePlatformBadge}>
              <Text style={styles.affiliatePlatformText}>{hybridMapping.affiliateMatch.platform}</Text>
            </View>
            <View style={styles.affiliateInfo}>
              <Text style={styles.affiliateProductName} numberOfLines={2}>
                {hybridMapping.affiliateMatch.productName}
              </Text>
              {hybridMapping.affiliateMatch.price ? (
                <Text style={styles.affiliatePrice}>{hybridMapping.affiliateMatch.price}</Text>
              ) : null}
            </View>
          </View>
        </View>
      )}

      <View style={styles.combinedSection}>
        <Text style={styles.combinedHook}>{hybridMapping.combinedHook}</Text>
        <Text style={styles.combinedCaption}>{hybridMapping.combinedCaption}</Text>
      </View>

      <View style={styles.qrBanner}>
        <QrCode size={20} color={theme.colors.dark.text} strokeWidth={2} />
        <Text style={styles.qrText}>{hybridMapping.qrCouponText}</Text>
      </View>

      <TouchableOpacity style={styles.copyBtn} onPress={handleCopy} activeOpacity={0.7}>
        {copied ? (
          <Check size={14} color={theme.colors.success[400]} strokeWidth={2.5} />
        ) : (
          <Copy size={14} color="#fff" strokeWidth={2} />
        )}
        <Text style={styles.copyBtnText}>
          {copied ? '복사됨' : '하이브리드 카피 복사'}
        </Text>
        <ArrowRight size={14} color="#fff" strokeWidth={2.5} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.dark.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    borderWidth: 1.5,
    borderColor: theme.colors.warning[400] + '40',
    gap: theme.spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerIcon: {
    width: 32,
    height: 32,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.warning[500] + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.warning[400],
  },
  subtitle: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    marginTop: 2,
  },
  section: {
    gap: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionLabel: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
  },
  storeInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  storeTypeBadge: {
    backgroundColor: theme.colors.accent[500] + '20',
    borderRadius: theme.radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  storeTypeText: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.accent[300],
  },
  neighborhoodTag: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
  },
  itemsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  itemChip: {
    backgroundColor: theme.colors.dark.bg,
    borderRadius: theme.radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: theme.colors.dark.border,
  },
  itemChipText: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.text,
  },
  offerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.colors.warning[500] + '15',
    borderRadius: theme.radius.md,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  offerText: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.warning[400],
  },
  affiliateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: theme.colors.dark.bg,
    borderRadius: theme.radius.md,
    padding: 10,
    borderWidth: 1,
    borderColor: theme.colors.primary[400] + '30',
  },
  affiliatePlatformBadge: {
    backgroundColor: theme.colors.primary[500] + '20',
    borderRadius: theme.radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  affiliatePlatformText: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.primary[300],
  },
  affiliateInfo: {
    flex: 1,
    gap: 2,
  },
  affiliateProductName: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
  },
  affiliatePrice: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.primary[300],
  },
  combinedSection: {
    backgroundColor: theme.colors.dark.bg,
    borderRadius: theme.radius.md,
    padding: 12,
    gap: 6,
  },
  combinedHook: {
    fontSize: 15,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.warning[400],
  },
  combinedCaption: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.text,
    lineHeight: 20,
  },
  qrBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: theme.colors.dark.text,
    borderRadius: theme.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  qrText: {
    flex: 1,
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.bg,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.colors.warning[500],
    borderRadius: theme.radius.md,
    paddingVertical: 12,
  },
  copyBtnText: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: '#fff',
  },
});
