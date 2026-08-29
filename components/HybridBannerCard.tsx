import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import {
  Store, Link2, Flame, QrCode, Copy, Check, ArrowRight,
  ShieldCheck, Search, Sparkles, ChevronRight,
} from 'lucide-react-native';
import { theme } from '@/lib/theme';
import type { HybridMapping, VisualSearchMatch, O2OCurationItem } from '@/types/database';

interface HybridBannerCardProps {
  hybridMapping: HybridMapping;
}

export function HybridBannerCard({ hybridMapping }: HybridBannerCardProps) {
  const [copied, setCopied] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState(0);
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

  const vsm = hybridMapping.visualSearchMatches || [];
  const o2o = hybridMapping.o2oCuration || [];
  const badge = hybridMapping.verifiedBadge;

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

      {/* Verified Badge */}
      {badge?.verified && (
        <View style={styles.verifiedBadge}>
          <ShieldCheck size={14} color={theme.colors.success[400]} strokeWidth={2.5} />
          <Text style={styles.verifiedLabel}>{badge.label}</Text>
          <Text style={styles.verifiedDesc}>{badge.description}</Text>
        </View>
      )}

      {/* Local Store Context */}
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

      {/* Visual Search Matches */}
      {vsm.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Search size={14} color={theme.colors.primary[300]} strokeWidth={2} />
            <Text style={styles.sectionLabel}>비주얼 유사도 검색 결과</Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.matchScroll}
            contentContainerStyle={styles.matchScrollContent}
          >
            {vsm.map((match, i) => (
              <MatchCard
                key={i}
                match={match}
                selected={selectedMatch === i}
                onPress={() => setSelectedMatch(i)}
              />
            ))}
          </ScrollView>
        </View>
      )}

      {/* O2O Curation */}
      {o2o.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Sparkles size={14} color={theme.colors.accent[400]} strokeWidth={2} />
            <Text style={styles.sectionLabel}>이유 있는 O2O 큐레이션</Text>
          </View>
          {o2o.map((item, i) => (
            <O2OCard key={i} item={item} />
          ))}
        </View>
      )}

      {/* Direct Affiliate Match */}
      {hybridMapping.affiliateMatch && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Link2 size={14} color={theme.colors.primary[300]} strokeWidth={2} />
            <Text style={styles.sectionLabel}>최종 선택 제휴 상품</Text>
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
            <ChevronRight size={16} color={theme.colors.dark.textDim} strokeWidth={2} />
          </View>
        </View>
      )}

      {/* Combined Copy */}
      <View style={styles.combinedSection}>
        <Text style={styles.combinedHook}>{hybridMapping.combinedHook}</Text>
        <Text style={styles.combinedCaption}>{hybridMapping.combinedCaption}</Text>
      </View>

      {/* QR Coupon Banner */}
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

function MatchCard({ match, selected, onPress }: {
  match: VisualSearchMatch;
  selected: boolean;
  onPress: () => void;
}) {
  const score = Math.round(match.similarityScore);
  const scoreColor = score >= 85 ? theme.colors.success[400] : score >= 70 ? theme.colors.warning[400] : theme.colors.dark.textDim;

  return (
    <TouchableOpacity
      style={[styles.matchCard, selected && styles.matchCardSelected]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.matchScoreRow}>
        <View style={[styles.scoreBar, { backgroundColor: scoreColor }]} />
        <Text style={[styles.matchScore, { color: scoreColor }]}>{score}%</Text>
      </View>
      <Text style={styles.matchPlatform}>{match.platform}</Text>
      <Text style={styles.matchProductName} numberOfLines={2}>{match.productName}</Text>
      {match.price ? <Text style={styles.matchPrice}>{match.price}</Text> : null}
      {match.imageHint ? (
        <Text style={styles.matchHint} numberOfLines={2}>{match.imageHint}</Text>
      ) : null}
      {selected && (
        <View style={styles.selectedIndicator}>
          <Check size={10} color="#fff" strokeWidth={3} />
        </View>
      )}
    </TouchableOpacity>
  );
}

function O2OCard({ item }: { item: O2OCurationItem }) {
  return (
    <View style={styles.o2oCard}>
      <View style={styles.o2oTypeBadge}>
        <Text style={styles.o2oTypeText}>{item.type}</Text>
      </View>
      <View style={styles.o2oInfo}>
        <Text style={styles.o2oLabel}>{item.label}</Text>
        <Text style={styles.o2oReason} numberOfLines={2}>{item.reason}</Text>
        <View style={styles.o2oProductRow}>
          <Text style={styles.o2oPlatform}>{item.platform}</Text>
          {item.price ? <Text style={styles.o2oPrice}>{item.price}</Text> : null}
        </View>
      </View>
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
  headerText: { flex: 1 },
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
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.colors.success[500] + '15',
    borderRadius: theme.radius.md,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexWrap: 'wrap',
  },
  verifiedLabel: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.success[400],
  },
  verifiedDesc: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    flex: 1,
  },
  section: { gap: 8 },
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
  matchScroll: {
    marginHorizontal: -4,
  },
  matchScrollContent: {
    paddingHorizontal: 4,
    gap: 8,
  },
  matchCard: {
    width: 140,
    backgroundColor: theme.colors.dark.bg,
    borderRadius: theme.radius.md,
    padding: 10,
    borderWidth: 1.5,
    borderColor: theme.colors.dark.border,
    gap: 4,
  },
  matchCardSelected: {
    borderColor: theme.colors.primary[400],
    backgroundColor: theme.colors.primary[500] + '15',
  },
  matchScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  scoreBar: {
    width: 24,
    height: 3,
    borderRadius: 2,
  },
  matchScore: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.bold,
  },
  matchPlatform: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.primary[300],
  },
  matchProductName: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
    lineHeight: 16,
  },
  matchPrice: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.primary[300],
  },
  matchHint: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    lineHeight: 14,
    marginTop: 2,
  },
  selectedIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: theme.colors.primary[400],
    justifyContent: 'center',
    alignItems: 'center',
  },
  o2oCard: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: theme.colors.dark.bg,
    borderRadius: theme.radius.md,
    padding: 10,
    borderWidth: 1,
    borderColor: theme.colors.accent[400] + '30',
  },
  o2oTypeBadge: {
    backgroundColor: theme.colors.accent[500] + '20',
    borderRadius: theme.radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 6,
    height: 28,
  },
  o2oTypeText: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.accent[300],
  },
  o2oInfo: { flex: 1, gap: 3 },
  o2oLabel: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
  },
  o2oReason: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    lineHeight: 15,
  },
  o2oProductRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
  o2oPlatform: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.primary[300],
  },
  o2oPrice: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.primary[300],
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
  affiliateInfo: { flex: 1, gap: 2 },
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
