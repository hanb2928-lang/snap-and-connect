import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Linking,
} from 'react-native';
import {
  Megaphone,
  TrendingUp,
  Zap,
  Link2,
  Calendar,
  Globe,
  Type,
  Hash,
  Sparkles,
  Film,
  Palette,
  Volume2,
  Users,
  Rocket,
  ArrowRight,
  Flame,
  Check,
  Lightbulb,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { theme } from '@/lib/theme';
import { useSafeTop } from '@/hooks/useSafeTop';
import { useTabBarHeight } from '@/hooks/useTabBarHeight';
import { fetchDashboardSummary, type DashboardSummary } from '@/lib/affiliateDashboard';
import { ErrorRetryBanner } from '@/components/ErrorRetryBanner';
import { friendlyError } from '@/lib/errors';
import { getItem, setItem } from '@/lib/storage';

interface MarketingTool {
  key: string;
  label: string;
  desc: string;
  icon: typeof Megaphone;
  color: string;
  route?: string;
  externalUrl?: string;
}

const HOOK_TYPES = [
  { key: 'curiosity', label: '호기심 유발', desc: '이거 모르면 손해? 3초 멈춤 보장', icon: Lightbulb, color: theme.colors.warning[400] },
  { key: 'contrarian', label: '역발상', desc: '다들 이렇게 하는데, 난 반대로', icon: Zap, color: theme.colors.accent[400] },
  { key: 'emotional', label: '감정 자극', desc: '이걸 알고 나니 눈물이...', icon: Flame, color: theme.colors.primary[400] },
];

const TEMPLATE_TYPES = [
  { key: 'shortform', label: '숏폼 영상', desc: '릴스·쇼츠·틱톡 세로형', icon: Film, color: theme.colors.primary[400] },
  { key: 'comic', label: '웹툰 만화', desc: '4컷 스토리텔링 만화', icon: Palette, color: theme.colors.accent[400] },
  { key: 'variants', label: 'A/B 변형', desc: '정보·유머·감성 3가지 동시', icon: Sparkles, color: theme.colors.warning[400] },
];

const MARKETING_TOOLS: MarketingTool[] = [
  {
    key: 'copywriter',
    label: '마케팅 문구 생성',
    desc: 'AI가 제품에 맞춘 바이럴 카피를 자동 작성',
    icon: Type,
    color: theme.colors.primary[400],
    route: '/affiliate',
  },
  {
    key: 'hashtag',
    label: '해시태그 추천',
    desc: '트렌드 기반 최적 해시태그 자동 생성',
    icon: Hash,
    color: theme.colors.accent[400],
    route: '/affiliate',
  },
  {
    key: 'hook',
    label: '역발상 훅 생성기',
    desc: '3초 후킹 오프닝 3가지 타입으로 즉시 생성',
    icon: Zap,
    color: theme.colors.warning[400],
    route: '/affiliate',
  },
  {
    key: 'shortlink',
    label: '단축 링크 관리',
    desc: '제휴 링크를 단축하고 클릭 추적',
    icon: Link2,
    color: theme.colors.success[400],
    route: '/affiliate/links',
  },
  {
    key: 'scheduler',
    label: '스마트 예약',
    desc: '최적 업로드 시간대 자동 추천 및 예약',
    icon: Calendar,
    color: theme.colors.primary[300],
    route: '/affiliate/warmup',
  },
  {
    key: 'localizer',
    label: '글로벌 현지화',
    desc: '다국어 번역 및 현지 해시태그 자동 적용',
    icon: Globe,
    color: theme.colors.accent[300],
    route: '/affiliate',
  },
  {
    key: 'tts',
    label: '감정 곡선 TTS',
    desc: '3단계 감정 변화로 자연스러운 AI 성우 음성',
    icon: Volume2,
    color: theme.colors.success[400],
    route: '/affiliate',
  },
  {
    key: 'persona',
    label: '크리에이터 페르소나',
    desc: '상위 1% 마케터 페르소나 시뮬레이션',
    icon: Users,
    color: theme.colors.warning[400],
    route: '/affiliate',
  },
];

const TEMPLATE_TOOLS: MarketingTool[] = [
  {
    key: 'shortform',
    label: '숏폼 영상 템플릿',
    desc: '릴스·쇼츠·틱톡 최적화 템플릿',
    icon: Film,
    color: theme.colors.primary[400],
    route: '/affiliate',
  },
  {
    key: 'comic',
    label: '웹툰형 만화 템플릿',
    desc: '스토리텔링 4컷 만화 자동 생성',
    icon: Palette,
    color: theme.colors.accent[400],
    route: '/affiliate',
  },
  {
    key: 'variants',
    label: 'A/B 변형 생성기',
    desc: '정보형·유머형·감성형 3가지 변형 동시 생성',
    icon: Sparkles,
    color: theme.colors.warning[400],
    route: '/affiliate',
  },
];

export default function MarketingScreen() {
  const router = useRouter();
  const safeTop = useSafeTop();
  const tabBarHeight = useTabBarHeight();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedHook, setSelectedHook] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [handoffMode, setHandoffMode] = useState(false);

  useEffect(() => {
    (async () => {
      const flag = await getItem('marketing_handoff');
      if (flag === 'true') {
        setHandoffMode(true);
        await setItem('marketing_handoff', 'false');
      }
    })();
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await fetchDashboardSummary();
      setSummary(data);
    } catch (err) {
      setSummary(null);
      setLoadError(friendlyError(err, '마케팅 데이터를 불러오지 못했습니다.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleRefresh = () => {
    setRefreshing(true);
    load();
  };

  const handleToolPress = (tool: MarketingTool) => {
    if (tool.externalUrl) {
      Linking.openURL(tool.externalUrl).catch(() => {});
    } else if (tool.route) {
      router.push(tool.route as never);
    }
  };

  const handleStartGeneration = () => {
    router.push('/affiliate' as never);
  };

  const totalRevenue = summary?.totalRevenue ?? 0;
  const totalClicks = summary?.totalClicks ?? 0;
  const totalLinks = summary?.totalLinks ?? 0;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: safeTop + 12 }]}>
        <View style={styles.headerIconRow}>
          <View style={styles.headerIconBox}>
            <Megaphone size={22} color={theme.colors.primary[300]} strokeWidth={2.5} />
          </View>
          <View style={styles.headerTextBox}>
            <Text style={styles.headerTitle}>마케팅</Text>
            <Text style={styles.headerSubtext}>
              AI 마케팅 도구로 바이럴 콘텐츠를 한곳에서
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: tabBarHeight + 24 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.colors.primary[400]} />
        }
      >
        {loadError ? (
          <ErrorRetryBanner message={loadError} onRetry={load} />
        ) : (
          <>
            {/* Handoff Hero — shown when arriving from camera/affiliate */}
            {handoffMode && (
              <View style={styles.handoffHero}>
                <View style={styles.handoffHeroIcon}>
                  <Flame size={28} color={theme.colors.warning[400]} strokeWidth={2.2} />
                </View>
                <Text style={styles.handoffHeroTitle}>
                  소재가 준비되었습니다!
                </Text>
                <Text style={styles.handoffHeroDesc}>
                  훅과 템플릿을 선택하고 마케팅 숏폼을 완성하세요
                </Text>
              </View>
            )}

            {/* Hook Selection */}
            <Text style={styles.sectionTitle}>1. 훅 선택 — 3초 후킹 오프닝</Text>
            <View style={styles.selectGrid}>
              {HOOK_TYPES.map((hook) => {
                const Icon = hook.icon;
                const selected = selectedHook === hook.key;
                return (
                  <TouchableOpacity
                    key={hook.key}
                    style={[styles.selectCard, selected && styles.selectCardActive]}
                    onPress={() => setSelectedHook(hook.key)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.selectIcon, { backgroundColor: hook.color + '20' }]}>
                      <Icon size={18} color={hook.color} strokeWidth={2.2} />
                    </View>
                    <View style={styles.selectInfo}>
                      <Text style={styles.selectLabel}>{hook.label}</Text>
                      <Text style={styles.selectDesc} numberOfLines={2}>{hook.desc}</Text>
                    </View>
                    {selected && (
                      <View style={styles.selectCheck}>
                        <Check size={14} color="#fff" strokeWidth={2.5} />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Template Selection */}
            <Text style={styles.sectionTitle}>2. 템플릿 선택</Text>
            <View style={styles.selectGrid}>
              {TEMPLATE_TYPES.map((tmpl) => {
                const Icon = tmpl.icon;
                const selected = selectedTemplate === tmpl.key;
                return (
                  <TouchableOpacity
                    key={tmpl.key}
                    style={[styles.selectCard, selected && styles.selectCardActive]}
                    onPress={() => setSelectedTemplate(tmpl.key)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.selectIcon, { backgroundColor: tmpl.color + '20' }]}>
                      <Icon size={18} color={tmpl.color} strokeWidth={2.2} />
                    </View>
                    <View style={styles.selectInfo}>
                      <Text style={styles.selectLabel}>{tmpl.label}</Text>
                      <Text style={styles.selectDesc} numberOfLines={2}>{tmpl.desc}</Text>
                    </View>
                    {selected && (
                      <View style={styles.selectCheck}>
                        <Check size={14} color="#fff" strokeWidth={2.5} />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Generate Button */}
            <TouchableOpacity
              style={[
                styles.generateBtn,
                (!selectedHook || !selectedTemplate) && styles.generateBtnDisabled,
              ]}
              onPress={handleStartGeneration}
              disabled={!selectedHook || !selectedTemplate}
              activeOpacity={0.85}
            >
              <Sparkles size={20} color={(!selectedHook || !selectedTemplate) ? theme.colors.dark.textFaint : '#fff'} strokeWidth={2.2} />
              <Text
                style={[
                  styles.generateBtnText,
                  (!selectedHook || !selectedTemplate) && styles.generateBtnTextDisabled,
                ]}
              >
                {selectedHook && selectedTemplate
                  ? '마케팅 콘텐츠 생성 시작'
                  : '훅과 템플릿을 선택해주세요'}
              </Text>
              {selectedHook && selectedTemplate && (
                <ArrowRight size={18} color="#fff" strokeWidth={2.2} />
              )}
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.divider} />

            {/* Quick Stats */}
            <View style={styles.statsRow}>
              <View style={styles.statPill}>
                <TrendingUp size={14} color={theme.colors.success[400]} strokeWidth={2} />
                <Text style={styles.statPillValue}>
                  {totalRevenue.toLocaleString('ko-KR')}원
                </Text>
                <Text style={styles.statPillLabel}>수익</Text>
              </View>
              <View style={styles.statPill}>
                <Link2 size={14} color={theme.colors.primary[400]} strokeWidth={2} />
                <Text style={styles.statPillValue}>{totalClicks}</Text>
                <Text style={styles.statPillLabel}>클릭</Text>
              </View>
              <View style={styles.statPill}>
                <Rocket size={14} color={theme.colors.accent[400]} strokeWidth={2} />
                <Text style={styles.statPillValue}>{totalLinks}</Text>
                <Text style={styles.statPillLabel}>링크</Text>
              </View>
            </View>

            {/* AI Marketing Tools */}
            <Text style={styles.sectionTitle}>AI 마케팅 도구</Text>
            <View style={styles.toolGrid}>
              {MARKETING_TOOLS.map((tool) => {
                const Icon = tool.icon;
                return (
                  <TouchableOpacity
                    key={tool.key}
                    style={styles.toolCard}
                    onPress={() => handleToolPress(tool)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.toolIcon, { backgroundColor: tool.color + '20' }]}>
                      <Icon size={20} color={tool.color} strokeWidth={2.2} />
                    </View>
                    <View style={styles.toolInfo}>
                      <Text style={styles.toolLabel} numberOfLines={1}>
                        {tool.label}
                      </Text>
                      <Text style={styles.toolDesc} numberOfLines={2}>
                        {tool.desc}
                      </Text>
                    </View>
                    <ArrowRight
                      size={16}
                      color={theme.colors.dark.textFaint}
                      strokeWidth={2}
                    />
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Template Tools */}
            <Text style={styles.sectionTitle}>콘텐츠 템플릿</Text>
            <View style={styles.toolGrid}>
              {TEMPLATE_TOOLS.map((tool) => {
                const Icon = tool.icon;
                return (
                  <TouchableOpacity
                    key={tool.key}
                    style={styles.toolCard}
                    onPress={() => handleToolPress(tool)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.toolIcon, { backgroundColor: tool.color + '20' }]}>
                      <Icon size={20} color={tool.color} strokeWidth={2.2} />
                    </View>
                    <View style={styles.toolInfo}>
                      <Text style={styles.toolLabel} numberOfLines={1}>
                        {tool.label}
                      </Text>
                      <Text style={styles.toolDesc} numberOfLines={2}>
                        {tool.desc}
                      </Text>
                    </View>
                    <ArrowRight
                      size={16}
                      color={theme.colors.dark.textFaint}
                      strokeWidth={2}
                    />
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* CTA Card */}
            <TouchableOpacity
              style={styles.ctaCard}
              onPress={() => router.push('/affiliate' as never)}
              activeOpacity={0.7}
            >
              <View style={styles.ctaIconBox}>
                <Sparkles size={20} color={theme.colors.warning[400]} strokeWidth={2.2} />
              </View>
              <View style={styles.ctaTextWrap}>
                <Text style={styles.ctaTitle}>지금 바로 제휴 콘텐츠 만들기</Text>
                <Text style={styles.ctaDesc}>
                  제품 링크 입력 → AI 분석 → 마케팅 콘텐츠 생성까지 한 번에
                </Text>
              </View>
              <ArrowRight size={18} color={theme.colors.warning[400]} strokeWidth={2.2} />
            </TouchableOpacity>
          </>
        )}
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
  headerIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIconBox: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.primary[500] + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTextBox: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.dark.text,
  },
  headerSubtext: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    marginTop: 2,
  },
  scroll: {
    flex: 1,
    paddingHorizontal: theme.spacing.lg,
  },
  handoffHero: {
    alignItems: 'center',
    backgroundColor: theme.colors.warning[500] + '12',
    borderRadius: theme.radius.lg,
    padding: 20,
    marginBottom: theme.spacing.md,
    borderWidth: 1.5,
    borderColor: theme.colors.warning[400] + '30',
    gap: 8,
  },
  handoffHeroIcon: {
    width: 56,
    height: 56,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.warning[500] + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  handoffHeroTitle: {
    fontSize: 18,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.dark.text,
  },
  handoffHeroDesc: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.dark.text,
    marginBottom: 10,
    marginTop: theme.spacing.sm,
  },
  selectGrid: {
    gap: 8,
    marginBottom: theme.spacing.md,
  },
  selectCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.dark.surface,
    borderRadius: theme.radius.lg,
    padding: 12,
    gap: 12,
    borderWidth: 1.5,
    borderColor: theme.colors.dark.border,
  },
  selectCardActive: {
    borderColor: theme.colors.primary[400],
    backgroundColor: theme.colors.primary[500] + '12',
  },
  selectIcon: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectInfo: {
    flex: 1,
    gap: 2,
  },
  selectLabel: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
  },
  selectDesc: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    lineHeight: 15,
  },
  selectCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.colors.primary[400],
    justifyContent: 'center',
    alignItems: 'center',
  },
  generateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: theme.colors.primary[500],
    borderRadius: theme.radius.lg,
    paddingVertical: 16,
    marginBottom: theme.spacing.md,
  },
  generateBtnDisabled: {
    backgroundColor: theme.colors.dark.surfaceLight,
    borderWidth: 1.5,
    borderColor: theme.colors.dark.border,
  },
  generateBtnText: {
    fontSize: 15,
    fontFamily: theme.typography.fontFamily.bold,
    color: '#fff',
  },
  generateBtnTextDisabled: {
    color: theme.colors.dark.textFaint,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.dark.border,
    marginVertical: theme.spacing.sm,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: theme.spacing.md,
  },
  statPill: {
    flex: 1,
    backgroundColor: theme.colors.dark.surface,
    borderRadius: theme.radius.md,
    paddingVertical: 10,
    paddingHorizontal: 10,
    alignItems: 'center',
    gap: 2,
    borderWidth: 1.5,
    borderColor: theme.colors.dark.border,
  },
  statPillValue: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.dark.text,
  },
  statPillLabel: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
  },
  toolGrid: {
    gap: 8,
    marginBottom: theme.spacing.md,
  },
  toolCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.dark.surface,
    borderRadius: theme.radius.lg,
    padding: 12,
    gap: 12,
    borderWidth: 1.5,
    borderColor: theme.colors.dark.border,
  },
  toolIcon: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  toolInfo: {
    flex: 1,
    gap: 2,
  },
  toolLabel: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
  },
  toolDesc: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    lineHeight: 15,
  },
  ctaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.warning[500] + '12',
    borderRadius: theme.radius.lg,
    padding: 14,
    gap: 12,
    borderWidth: 1.5,
    borderColor: theme.colors.warning[500] + '30',
    marginTop: theme.spacing.xs,
  },
  ctaIconBox: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.warning[500] + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ctaTextWrap: {
    flex: 1,
    gap: 2,
  },
  ctaTitle: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
  },
  ctaDesc: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    lineHeight: 15,
  },
});
