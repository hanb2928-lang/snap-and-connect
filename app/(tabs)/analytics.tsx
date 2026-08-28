import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  RefreshControl,
  Image,
} from 'react-native';
import {
  ChartBar as BarChart3,
  MousePointerClick,
  TrendingUp,
  TrendingDown,
  Clock,
  ShoppingBag,
  Globe,
  Send,
  Zap,
  Image as ImageIcon,
  Target,
  Layers,
  ArrowRight,
  Flame,
  DollarSign,
  Sparkles,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { theme } from '@/lib/theme';
import {
  fetchDashboardSummary,
  formatKRW,
  formatClickTime,
  type DashboardSummary,
} from '@/lib/dashboard';
import { LoadingScreen } from '@/components/LoadingScreen';
import { useTabBarHeight } from '@/hooks/useTabBarHeight';
import { useSafeTop } from '@/hooks/useSafeTop';

const PLATFORM_META: Record<string, { label: string; icon: typeof ShoppingBag; color: string }> = {
  Coupang: { label: '쿠팡', icon: ShoppingBag, color: '#FF3E3E' },
  BrandConnect: { label: '네이버', icon: Globe, color: '#03C75A' },
  Toss: { label: '토스', icon: Send, color: '#0064FF' },
  기타: { label: '기타', icon: BarChart3, color: '#8B5CF6' },
};

function getPlatformMeta(key: string) {
  return PLATFORM_META[key] || PLATFORM_META['기타'];
}

const FUNNEL_STAGES = [
  { key: 'scans', label: '제품 분석', icon: Target, color: theme.colors.primary[400] },
  { key: 'assets', label: '콘텐츠 제작', icon: ImageIcon, color: theme.colors.accent[400] },
  { key: 'clicks', label: '링크 클릭', icon: MousePointerClick, color: theme.colors.warning[400] },
  { key: 'revenue', label: '수익 발생', icon: DollarSign, color: theme.colors.success[400] },
];

export default function AnalyticsScreen() {
  const router = useRouter();
  const tabBarHeight = useTabBarHeight();
  const safeTop = useSafeTop();
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoadError(null);
      const d = await fetchDashboardSummary();
      setData(d);
    } catch {
      setLoadError('성과 데이터를 불러오는 중 오류가 발생했어요');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const maxDailyClicks = useMemo(() => {
    if (!data || data.dailyClicks.length === 0) return 1;
    return Math.max(...data.dailyClicks.map((d) => d.clicks), 1);
  }, [data]);

  if (loading) {
    return <LoadingScreen message="성과 데이터를 불러오는 중..." />;
  }

  if (loadError || !data) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{loadError || '데이터를 불러올 수 없습니다'}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => { setLoading(true); loadData(); }} activeOpacity={0.8}>
            <Text style={styles.retryText}>다시 시도</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const d = data!;
  const isEmpty = d.totalScans === 0 && d.totalAssets === 0 && d.totalClicks === 0 && d.totalRevenue === 0;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.colors.primary[400]} />}
      contentContainerStyle={[styles.scrollContent, { paddingBottom: tabBarHeight + 24 }]}
    >
      <View style={[styles.header, { paddingTop: safeTop + 12 }]}>
        <Text style={styles.headerTitle} numberOfLines={1} adjustsFontSizeToFit>통합 성과 대시보드</Text>
        <Text style={styles.headerSubtext}>
          제품 분석부터 콘텐츠 제작, 클릭, 수익까지 한눈에 추적합니다
        </Text>
      </View>

      {/* Hero summary row */}
      <View style={styles.heroRow}>
        <View style={styles.heroCard}>
          <View style={[styles.heroIconWrap, { backgroundColor: theme.colors.primary[400] + '20' }]}>
            <Target size={16} color={theme.colors.primary[400]} strokeWidth={2} />
          </View>
          <Text style={styles.heroLabel}>분석</Text>
          <Text style={styles.heroValue}>{d.totalScans.toLocaleString()}</Text>
        </View>
        <View style={styles.heroCard}>
          <View style={[styles.heroIconWrap, { backgroundColor: theme.colors.accent[400] + '20' }]}>
            <ImageIcon size={16} color={theme.colors.accent[400]} strokeWidth={2} />
          </View>
          <Text style={styles.heroLabel}>콘텐츠</Text>
          <Text style={styles.heroValue}>{d.totalAssets.toLocaleString()}</Text>
        </View>
        <View style={styles.heroCard}>
          <View style={[styles.heroIconWrap, { backgroundColor: theme.colors.warning[400] + '20' }]}>
            <MousePointerClick size={16} color={theme.colors.warning[400]} strokeWidth={2} />
          </View>
          <Text style={styles.heroLabel}>클릭</Text>
          <Text style={styles.heroValue}>{d.totalClicks.toLocaleString()}</Text>
        </View>
        <View style={styles.heroCard}>
          <View style={[styles.heroIconWrap, { backgroundColor: theme.colors.success[400] + '20' }]}>
            <DollarSign size={16} color={theme.colors.success[400]} strokeWidth={2} />
          </View>
          <Text style={styles.heroLabel}>수익</Text>
          <Text style={styles.heroValueSm}>{d.totalRevenue > 0 ? formatKRW(d.totalRevenue) : '—'}</Text>
        </View>
      </View>

      {isEmpty ? (
        <View style={styles.emptyState}>
          <BarChart3 size={48} color={theme.colors.dark.textFaint} strokeWidth={1.5} />
          <Text style={styles.emptyTitle}>아직 성과 데이터가 없습니다</Text>
          <Text style={styles.emptyText}>
            제품을 촬영하고 콘텐츠를 만들어 공유하면 여기에 통합 성과가 자동으로 표시됩니다
          </Text>
          <TouchableOpacity
            style={styles.emptyButton}
            onPress={() => router.push('/(tabs)/')}
            activeOpacity={0.8}
          >
            <Sparkles size={16} color="#fff" strokeWidth={2} />
            <Text style={styles.emptyButtonText}>제품 분석 시작</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {/* Conversion Funnel */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Layers size={14} color={theme.colors.primary[400]} strokeWidth={2} />
              <Text style={styles.sectionLabel}>성과 퍼널</Text>
            </View>
            <View style={styles.funnelCard}>
              {FUNNEL_STAGES.map((stage, i) => {
                const Icon = stage.icon;
                const value = d.platformFunnel[i]?.value || 0;
                const pct = d.platformFunnel[i]?.pct || 0;
                const prevValue = i > 0 ? d.platformFunnel[i - 1]?.value || 0 : value;
                const dropOff = i > 0 && prevValue > 0 ? ((prevValue - value) / prevValue) * 100 : 0;
                return (
                  <View key={stage.key} style={styles.funnelRow}>
                    <View style={styles.funnelLeft}>
                      <View style={[styles.funnelIcon, { backgroundColor: stage.color + '20' }]}>
                        <Icon size={14} color={stage.color} strokeWidth={2} />
                      </View>
                      <View style={styles.funnelInfo}>
                        <Text style={styles.funnelLabel}>{stage.label}</Text>
                        <Text style={styles.funnelValue}>{value.toLocaleString()}</Text>
                      </View>
                    </View>
                    <View style={styles.funnelRight}>
                      <View style={styles.funnelBarTrack}>
                        <View style={[styles.funnelBarFill, { width: `${Math.max(pct, 3)}%`, backgroundColor: stage.color }]} />
                      </View>
                      <Text style={styles.funnelPct}>{pct.toFixed(0)}%</Text>
                      {i > 0 && dropOff > 0 && (
                        <View style={styles.funnelDropOff}>
                          <TrendingDown size={9} color={theme.colors.error[400]} strokeWidth={2} />
                          <Text style={styles.funnelDropText}>{dropOff.toFixed(0)}% 이탈</Text>
                        </View>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          </View>

          {/* Key metrics row */}
          <View style={styles.metricsRow}>
            <View style={styles.metricCard}>
              <View style={styles.metricHeader}>
                <Target size={12} color={theme.colors.dark.textDim} strokeWidth={2} />
                <Text style={styles.metricLabel}>평균 CTR</Text>
              </View>
              <Text style={styles.metricValue}>{d.avgCtr.toFixed(1)}%</Text>
              <Text style={styles.metricSub}>분석당 클릭률</Text>
            </View>
            <View style={styles.metricCard}>
              <View style={styles.metricHeader}>
                <Zap size={12} color={theme.colors.dark.textDim} strokeWidth={2} />
                <Text style={styles.metricLabel}>전환율</Text>
              </View>
              <Text style={styles.metricValue}>{d.conversionRate.toFixed(1)}%</Text>
              <Text style={styles.metricSub}>클릭 대비 수익</Text>
            </View>
            <View style={styles.metricCard}>
              <View style={styles.metricHeader}>
                <DollarSign size={12} color={theme.colors.dark.textDim} strokeWidth={2} />
                <Text style={styles.metricLabel}>클릭단가</Text>
              </View>
              <Text style={styles.metricValueSm}>
                {d.totalClicks > 0 ? formatKRW(Math.round(d.totalRevenue / d.totalClicks)) : '—'}
              </Text>
              <Text style={styles.metricSub}>클릭당 수익</Text>
            </View>
          </View>

          {/* Daily clicks + revenue chart */}
          {d.dailyClicks.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <TrendingUp size={14} color={theme.colors.primary[400]} strokeWidth={2} />
                <Text style={styles.sectionLabel}>일별 클릭 추이 (14일)</Text>
              </View>
              <View style={styles.chartCard}>
                <View style={styles.barChartRow}>
                  {d.dailyClicks.map((item, i) => {
                    const heightPct = (item.clicks / maxDailyClicks) * 100;
                    const day = new Date(item.date).getDate();
                    return (
                      <View key={i} style={styles.barCol}>
                        <View style={styles.barTrack}>
                          <View
                            style={[
                              styles.barFill,
                              { height: `${Math.max(heightPct, 2)}%` },
                              item.clicks > 0 && styles.barFillActive,
                            ]}
                          />
                        </View>
                        <Text style={styles.barLabel}>{day}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            </View>
          )}

          {/* Platform revenue breakdown */}
          {d.revenueByPlatform.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Flame size={14} color={theme.colors.accent[400]} strokeWidth={2} />
                <Text style={styles.sectionLabel}>플랫폼별 수익 & 클릭</Text>
              </View>
              <View style={styles.breakdownCard}>
                {d.revenueByPlatform.map((item, i) => {
                  const meta = getPlatformMeta(item.platform);
                  const Icon = meta.icon;
                  const maxAmount = Math.max(...d.revenueByPlatform.map((r) => r.amount), 1);
                  const pct = (item.amount / maxAmount) * 100;
                  return (
                    <View key={i} style={styles.breakdownRow}>
                      <View style={[styles.breakdownIcon, { backgroundColor: meta.color + '20' }]}>
                        <Icon size={14} color={meta.color} strokeWidth={2} />
                      </View>
                      <View style={styles.breakdownInfo}>
                        <View style={styles.breakdownHeader}>
                          <Text style={styles.breakdownLabel}>{meta.label}</Text>
                          <Text style={styles.breakdownAmount}>
                            {item.amount > 0 ? formatKRW(item.amount) : `${item.clicks}클릭`}
                          </Text>
                        </View>
                        <View style={styles.breakdownBarTrack}>
                          <View style={[styles.breakdownBarFill, { width: `${pct}%`, backgroundColor: meta.color }]} />
                        </View>
                        <Text style={styles.breakdownClicks}>{item.clicks}클릭 · {pct.toFixed(0)}%</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* Top performing content */}
          {d.topContent.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Zap size={14} color={theme.colors.warning[400]} strokeWidth={2} />
                <Text style={styles.sectionLabel}>성과 높은 콘텐츠</Text>
              </View>
              <View style={styles.topCard}>
                {d.topContent.map((item, i) => (
                  <TouchableOpacity
                    key={item.scan_id}
                    style={styles.contentRow}
                    onPress={() => router.push({ pathname: '/result/[id]', params: { id: item.scan_id } })}
                    activeOpacity={0.7}
                  >
                    <View style={styles.contentRank}>
                      <Text style={styles.contentRankText}>{i + 1}</Text>
                    </View>
                    <Image source={{ uri: item.image_url }} style={styles.contentThumb} />
                    <View style={styles.contentInfo}>
                      <Text style={styles.contentTitle} numberOfLines={1}>{item.product_name}</Text>
                      <View style={styles.contentMetaRow}>
                        {item.asset_count > 0 && (
                          <View style={styles.contentMetaChip}>
                            <ImageIcon size={9} color={theme.colors.accent[400]} strokeWidth={2} />
                            <Text style={styles.contentMetaText}>{item.asset_count} 콘텐츠</Text>
                          </View>
                        )}
                        <View style={styles.contentMetaChip}>
                          <MousePointerClick size={9} color={theme.colors.warning[400]} strokeWidth={2} />
                          <Text style={styles.contentMetaText}>{item.clicks} 클릭</Text>
                        </View>
                      </View>
                      <Text style={styles.contentLastClick}>
                        {item.last_clicked_at ? `최근 ${formatClickTime(item.last_clicked_at)}` : '클릭 없음'}
                      </Text>
                    </View>
                    <View style={styles.contentClickWrap}>
                      <Text style={styles.contentClickCount}>{item.clicks}</Text>
                      <Text style={styles.contentClickLabel}>클릭</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Recent content */}
          {d.recentContent.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Clock size={14} color={theme.colors.success[400]} strokeWidth={2} />
                <Text style={styles.sectionLabel}>최근 만든 콘텐츠</Text>
              </View>
              <View style={styles.recentCard}>
                {d.recentContent.map((item, i) => (
                  <TouchableOpacity
                    key={i}
                    style={styles.recentContentRow}
                    onPress={() => router.push({ pathname: '/result/[id]', params: { id: item.scan_id } })}
                    activeOpacity={0.7}
                  >
                    <Image source={{ uri: item.image_url }} style={styles.recentThumb} />
                    <View style={styles.recentInfo}>
                      <Text style={styles.recentTitle} numberOfLines={1}>{item.product_name}</Text>
                      <Text style={styles.recentDate}>{formatClickTime(item.created_at)}</Text>
                    </View>
                    {item.clicks > 0 ? (
                      <View style={styles.recentClickBadge}>
                        <MousePointerClick size={10} color={theme.colors.warning[400]} strokeWidth={2} />
                        <Text style={styles.recentClickText}>{item.clicks}</Text>
                      </View>
                    ) : (
                      <View style={styles.recentNoClick}>
                        <Text style={styles.recentNoClickText}>미클릭</Text>
                      </View>
                    )}
                    <ArrowRight size={14} color={theme.colors.dark.textFaint} strokeWidth={2} />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </>
      )}

      <Text style={styles.footer}>새로고침하여 최신 데이터를 불러올 수 있습니다</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.dark.bg,
  },
  scrollContent: {
    paddingBottom: 140,
    maxWidth: 600,
    alignSelf: 'center',
    width: '100%',
  },
  header: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: 12,
    paddingBottom: theme.spacing.md,
  },
  headerTitle: {
    fontSize: theme.typography.title,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.dark.text,
  },
  headerSubtext: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    marginTop: 4,
    lineHeight: 20,
  },
  heroRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
  },
  heroCard: {
    flex: 1,
    backgroundColor: theme.colors.dark.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    ...theme.shadows.card,
  },
  heroIconWrap: {
    width: 28,
    height: 28,
    borderRadius: theme.radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
    ...theme.shadows.glowPrimary,
  },
  heroLabel: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.textDim,
  },
  heroValue: {
    fontSize: theme.typography.heading,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.dark.text,
    marginTop: 2,
  },
  heroValueSm: {
    fontSize: theme.typography.body,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.success[400],
    marginTop: 2,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
  },
  metricCard: {
    flex: 1,
    backgroundColor: theme.colors.dark.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    ...theme.shadows.card,
  },
  metricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  metricLabel: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.textDim,
  },
  metricValue: {
    fontSize: theme.typography.heading,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.dark.text,
  },
  metricValueSm: {
    fontSize: theme.typography.body,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.dark.text,
  },
  metricSub: {
    fontSize: 9,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textFaint,
    marginTop: 2,
  },
  section: {
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: theme.spacing.sm,
  },
  sectionLabel: {
    fontSize: theme.typography.micro,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.textDim,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  funnelCard: {
    backgroundColor: theme.colors.dark.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    gap: theme.spacing.md,
    ...theme.shadows.card,
  },
  funnelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  funnelLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    flex: 1,
  },
  funnelIcon: {
    width: 28,
    height: 28,
    borderRadius: theme.radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  funnelInfo: {
    gap: 1,
  },
  funnelLabel: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.textDim,
  },
  funnelValue: {
    fontSize: theme.typography.body,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.dark.text,
  },
  funnelRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    justifyContent: 'flex-end',
  },
  funnelBarTrack: {
    width: 60,
    height: 5,
    backgroundColor: theme.colors.dark.surfaceLight,
    borderRadius: 3,
    overflow: 'hidden',
  },
  funnelBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  funnelPct: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
    minWidth: 28,
  },
  funnelDropOff: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  funnelDropText: {
    fontSize: 9,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.error[400],
  },
  chartCard: {
    backgroundColor: theme.colors.dark.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    ...theme.shadows.card,
  },
  barChartRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
    height: 120,
  },
  barCol: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  barTrack: {
    width: '100%',
    flex: 1,
    backgroundColor: theme.colors.dark.surfaceLight,
    borderRadius: 4,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
    backgroundColor: theme.colors.dark.border,
    borderRadius: 4,
  },
  barFillActive: {
    backgroundColor: theme.colors.primary[400],
  },
  barLabel: {
    fontSize: 8,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textFaint,
  },
  breakdownCard: {
    backgroundColor: theme.colors.dark.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    gap: theme.spacing.md,
    ...theme.shadows.card,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  breakdownIcon: {
    width: 30,
    height: 30,
    borderRadius: theme.radius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  breakdownInfo: {
    flex: 1,
  },
  breakdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  breakdownLabel: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
  },
  breakdownAmount: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.success[400],
  },
  breakdownBarTrack: {
    height: 5,
    backgroundColor: theme.colors.dark.surfaceLight,
    borderRadius: 3,
    overflow: 'hidden',
  },
  breakdownBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  breakdownClicks: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textFaint,
    marginTop: 3,
  },
  topCard: {
    backgroundColor: theme.colors.dark.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
    ...theme.shadows.card,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingVertical: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: theme.colors.dark.border,
  },
  contentRank: {
    width: 22,
    height: 22,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.warning[500] + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentRankText: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.warning[400],
  },
  contentThumb: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.dark.surfaceLight,
  },
  contentInfo: {
    flex: 1,
    gap: 3,
  },
  contentTitle: {
    fontSize: theme.typography.micro,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
  },
  contentMetaRow: {
    flexDirection: 'row',
    gap: 6,
  },
  contentMetaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  contentMetaText: {
    fontSize: 9,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.textDim,
  },
  contentLastClick: {
    fontSize: 9,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textFaint,
  },
  contentClickWrap: {
    alignItems: 'center',
  },
  contentClickCount: {
    fontSize: theme.typography.body,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.primary[300],
  },
  contentClickLabel: {
    fontSize: 8,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textFaint,
  },
  recentCard: {
    backgroundColor: theme.colors.dark.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
    ...theme.shadows.card,
  },
  recentContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingVertical: 4,
  },
  recentThumb: {
    width: 32,
    height: 32,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.dark.surfaceLight,
  },
  recentInfo: {
    flex: 1,
  },
  recentTitle: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
  },
  recentDate: {
    fontSize: 9,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textFaint,
    marginTop: 2,
  },
  recentClickBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: theme.colors.warning[400] + '15',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  recentClickText: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.warning[400],
  },
  recentNoClick: {
    backgroundColor: theme.colors.dark.surfaceLight,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  recentNoClickText: {
    fontSize: 9,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textFaint,
  },
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.xxl,
    gap: theme.spacing.md,
  },
  emptyTitle: {
    fontSize: theme.typography.heading,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
    marginTop: theme.spacing.md,
  },
  emptyText: {
    fontSize: theme.typography.body,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    textAlign: 'center',
    lineHeight: 24,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.colors.primary[600],
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.md,
    marginTop: theme.spacing.sm,
  },
  emptyButtonText: {
    fontSize: theme.typography.body,
    fontFamily: theme.typography.fontFamily.bold,
    color: '#fff',
  },
  footer: {
    textAlign: 'center',
    fontSize: theme.typography.micro,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textFaint,
    marginTop: theme.spacing.lg,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: theme.spacing.lg,
    paddingHorizontal: theme.spacing.xl,
  },
  errorText: {
    fontSize: theme.typography.body,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: theme.colors.primary[500],
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.md,
  },
  retryText: {
    fontSize: theme.typography.body,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: '#fff',
  },
});
