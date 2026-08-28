import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Linking,
  Platform,
  RefreshControl,
} from 'react-native';
import { ShoppingBag, Send, Globe, ShoppingBasket, Hop as Home, Ticket, TreePalm as Palmtree, Store, ExternalLink, Settings as SettingsIcon, ChevronRight, TrendingUp, Link2, Copy, Check } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { theme } from '@/lib/theme';
import { getUserSettings } from '@/lib/settings';
import { fetchRevenueRecords } from '@/lib/revenue';
import { useSafeTop } from '@/hooks/useSafeTop';
import { useSubTabBarHeight } from '@/hooks/useSubTabBarHeight';
import type { UserSettings, RevenueRecord } from '@/types/database';

const PLATFORMS = [
  { key: 'Coupang', label: '쿠팡 파트너스', icon: ShoppingBag, color: '#FF3E3E', signupUrl: 'https://partners.coupang.com/', desc: '쿠팡 상품 링크를 공유하고 수수료를 받으세요' },
  { key: 'Toss', label: '토스 쉐어링크', icon: Send, color: '#0064FF', signupUrl: 'https://sharelink.toss.im/', desc: '토스로 링크를 공유하고 보상을 받으세요' },
  { key: 'BrandConnect', label: '네이버 브랜드커넥트', icon: Globe, color: '#03C75A', signupUrl: 'https://brandconnect.naver.com/about/creator', desc: '네이버 쇼핑 제휴 링크를 발급받으세요' },
  { key: 'OliveYoung', label: '올리브영', icon: ShoppingBasket, color: '#1A1A1A', signupUrl: 'https://www.oliveyoung.co.kr/', desc: '올리브영 상품 링크를 공유하세요' },
  { key: 'TodayHouse', label: '오늘의집', icon: Home, color: '#35C5F0', signupUrl: 'https://ohou.se/', desc: '오늘의집 상품 링크를 공유하세요' },
  { key: 'Kurly', label: '컬리', icon: ShoppingBasket, color: '#5F0080', signupUrl: 'https://kurly.com/', desc: '컬리 상품 링크를 공유하세요' },
  { key: 'MyRealTrip', label: '마이리얼트립', icon: Palmtree, color: '#FF6B35', signupUrl: 'https://www.myrealtrip.com/', desc: '여행 상품 링크를 공유하세요' },
  { key: 'Klook', label: '클룩', icon: Ticket, color: '#FF5722', signupUrl: 'https://www.klook.com/', desc: '여행 활동 링크를 공유하세요' },
] as const;

export default function AffiliateScreen() {
  const router = useRouter();
  const safeTop = useSafeTop();
  const tabBarHeight = useSubTabBarHeight();
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [revenue, setRevenue] = useState<RevenueRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [copiedPlatform, setCopiedPlatform] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [s, r] = await Promise.all([getUserSettings(), fetchRevenueRecords(10)]);
      setSettings(s);
      setRevenue(r);
    } catch {
      // ignore
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

  const handleOpenUrl = (url: string) => {
    Linking.openURL(url).catch(() => {});
  };

  const handleCopySignup = async (platform: string, url: string) => {
    try {
      if (Platform.OS === 'web') {
        await navigator.clipboard.writeText(url);
      } else {
        const { default: Clipboard } = await import('expo-clipboard');
        await Clipboard.setStringAsync(url);
      }
      setCopiedPlatform(platform);
      setTimeout(() => setCopiedPlatform(null), 2000);
    } catch {
      // clipboard failed
    }
  };

  const isConfigured = (key: string): boolean => {
    if (!settings) return false;
    if (key === 'Coupang') return !!settings.coupang_partners_id;
    if (key === 'Toss') return !!settings.toss_share_id;
    if (key === 'BrandConnect') return !!settings.naver_shopping_id;
    return false;
  };

  const totalRevenue = revenue.reduce((sum, r) => sum + (r.amount || 0), 0);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: safeTop + 12 }]}>
        <Text style={styles.headerTitle}>제휴쇼핑</Text>
        <Text style={styles.headerSubtext}>
          제휴 링크를 관리하고 수익을 확인하세요
        </Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: tabBarHeight + 24 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={theme.colors.primary[400]}
          />
        }
      >
        <View style={styles.summaryCard}>
          <View style={styles.summaryLeft}>
            <TrendingUp size={20} color={theme.colors.success[400]} strokeWidth={2} />
            <View>
              <Text style={styles.summaryLabel}>총 수익</Text>
              <Text style={styles.summaryValue}>
                {totalRevenue.toLocaleString('ko-KR')}원
              </Text>
            </View>
          </View>
          <View style={styles.summaryRight}>
            <Text style={styles.summaryCount}>{revenue.length}건</Text>
            <Text style={styles.summaryCountLabel}>최근 기록</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.settingsLink}
          onPress={() => router.push('/settings')}
          activeOpacity={0.7}
        >
          <View style={styles.settingsLinkLeft}>
            <SettingsIcon size={18} color={theme.colors.primary[400]} strokeWidth={2} />
            <View>
              <Text style={styles.settingsLinkTitle}>제휴 ID 설정</Text>
              <Text style={styles.settingsLinkDesc}>
                쿠팡·토스·네이버 파트너스 ID를 등록하면 링크에 자동으로 적용됩니다
              </Text>
            </View>
          </View>
          <ChevronRight size={18} color={theme.colors.dark.textDim} strokeWidth={2} />
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>제휴 플랫폼</Text>
        <Text style={styles.sectionDesc}>
          각 플랫폼에 가입하고 링크 발급 자격을 얻으세요. ID를 설정하면 촬영 후 자동으로 제휴 링크가 생성됩니다.
        </Text>

        {PLATFORMS.map((p) => {
  const Icon = p.icon;
  const configured = isConfigured(p.key);
  return (
    <View key={p.key} style={styles.platformCard}>
      <View style={styles.platformHeader}>
        <View style={[styles.platformIcon, { backgroundColor: p.color + '20' }]}>
          <Icon size={20} color={p.color} strokeWidth={2} />
        </View>
        <View style={styles.platformInfo}>
          <View style={styles.platformTitleRow}>
            <Text style={styles.platformLabel}>{p.label}</Text>
            {configured ? (
              <View style={styles.configuredBadge}>
                <Check size={10} color="#fff" strokeWidth={3} />
                <Text style={styles.configuredBadgeText}>설정됨</Text>
              </View>
            ) : (
              <View style={styles.unconfiguredBadge}>
                <Text style={styles.unconfiguredBadgeText}>미설정</Text>
              </View>
            )}
          </View>
          <Text style={styles.platformDesc}>{p.desc}</Text>
        </View>
      </View>

      <View style={styles.platformActions}>
        <TouchableOpacity
          style={styles.signupBtn}
          onPress={() => handleOpenUrl(p.signupUrl)}
          activeOpacity={0.7}
        >
          <ExternalLink size={14} color={theme.colors.primary[300]} strokeWidth={2} />
          <Text style={styles.signupBtnText}>가입하기</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.copyBtn}
          onPress={() => handleCopySignup(p.key, p.signupUrl)}
          activeOpacity={0.7}
        >
          {copiedPlatform === p.key ? (
            <Check size={14} color={theme.colors.success[400]} strokeWidth={2} />
          ) : (
            <Copy size={14} color={theme.colors.dark.textDim} strokeWidth={2} />
          )}
          <Text style={styles.copyBtnText}>
            {copiedPlatform === p.key ? '복사됨' : '링크 복사'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
})}

        <Text style={styles.sectionTitle}>최근 수익 기록</Text>
        {revenue.length === 0 ? (
          <View style={styles.emptyRevenue}>
            <Link2 size={40} color={theme.colors.dark.textFaint} strokeWidth={1.5} />
            <Text style={styles.emptyRevenueTitle}>아직 수익 기록이 없습니다</Text>
            <Text style={styles.emptyRevenueDesc}>
              제휴 링크를 공유하고 수익이 발생하면 여기에 표시됩니다
            </Text>
          </View>
        ) : (
          <View style={styles.revenueList}>
            {revenue.map((r) => (
              <View key={r.id} style={styles.revenueItem}>
                <View style={styles.revenueItemLeft}>
                  <Store size={16} color={theme.colors.dark.textDim} strokeWidth={2} />
                  <View>
                    <Text style={styles.revenuePlatform}>{r.platform}</Text>
                    {r.note ? (
                      <Text style={styles.revenueNote} numberOfLines={1}>{r.note}</Text>
                    ) : null}
                  </View>
                </View>
                <Text style={styles.revenueAmount}>
                  {r.amount.toLocaleString('ko-KR')}원
                </Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.tipBox}>
          <ShoppingBag size={16} color={theme.colors.accent[400]} strokeWidth={2} />
          <Text style={styles.tipText}>
            팁: 촬영 후 결과 화면에서 '쇼핑커넥트' 섹션을 열어 제휴 링크를 직접 추가하면, 단축 URL과 마케팅 문구가 자동으로 생성됩니다.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.dark.bg,
  },
  header: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
  },
  headerTitle: {
    fontSize: 24,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.dark.text,
  },
  headerSubtext: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    marginTop: 4,
  },
  scroll: {
    flex: 1,
    paddingHorizontal: theme.spacing.lg,
  },
  summaryCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: theme.colors.dark.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md + 4,
    marginBottom: theme.spacing.md,
    ...theme.shadows.elevated,
  },
  summaryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  summaryLabel: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
  },
  summaryValue: {
    fontSize: 20,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.success[400],
    marginTop: 2,
  },
  summaryRight: {
    alignItems: 'flex-end',
  },
  summaryCount: {
    fontSize: 18,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
  },
  summaryCountLabel: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    marginTop: 2,
  },
  settingsLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.primary[500] + '12',
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.lg,
    borderWidth: 1.5,
    borderColor: theme.colors.primary[400] + '30',
  },
  settingsLinkLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  settingsLinkTitle: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
  },
  settingsLinkDesc: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.dark.text,
    marginBottom: 4,
  },
  sectionDesc: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    lineHeight: 17,
    marginBottom: theme.spacing.md,
  },
  platformCard: {
    backgroundColor: theme.colors.dark.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    borderWidth: 1.5,
    borderColor: theme.colors.dark.border,
  },
  platformHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: theme.spacing.sm,
  },
  platformIcon: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  platformInfo: {
    flex: 1,
  },
  platformTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  platformLabel: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
  },
  configuredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: theme.colors.success[500],
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: theme.radius.full,
  },
  configuredBadgeText: {
    fontSize: 9,
    fontFamily: theme.typography.fontFamily.bold,
    color: '#fff',
  },
  unconfiguredBadge: {
    backgroundColor: theme.colors.dark.surfaceLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: theme.radius.full,
  },
  unconfiguredBadgeText: {
    fontSize: 9,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.textDim,
  },
  platformDesc: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    marginTop: 4,
    lineHeight: 16,
  },
  platformActions: {
    flexDirection: 'row',
    gap: 8,
  },
  signupBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primary[500] + '15',
    borderWidth: 1.5,
    borderColor: theme.colors.primary[400] + '40',
  },
  signupBtnText: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.primary[300],
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.dark.surfaceLight,
    borderWidth: 1.5,
    borderColor: theme.colors.dark.border,
  },
  copyBtnText: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.textDim,
  },
  emptyRevenue: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xl + 8,
    gap: 8,
  },
  emptyRevenueTitle: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.textDim,
  },
  emptyRevenueDesc: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textFaint,
    textAlign: 'center',
    lineHeight: 17,
  },
  revenueList: {
    gap: 6,
    marginTop: 4,
  },
  revenueItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.dark.surface,
    borderRadius: theme.radius.md,
    paddingVertical: 12,
    paddingHorizontal: theme.spacing.md,
  },
  revenueItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  revenuePlatform: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
  },
  revenueNote: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    marginTop: 2,
  },
  revenueAmount: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.success[400],
  },
  tipBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: theme.colors.accent[500] + '12',
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    marginTop: theme.spacing.lg,
  },
  tipText: {
    flex: 1,
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.accent[300],
    lineHeight: 17,
  },
});
