import { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Linking,
  Dimensions,
  Image,
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
  Timer,
  QrCode,
  Shuffle,
  Copy,
  ShoppingBag,
  Scissors,
  Music,
  Play,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { theme } from '@/lib/theme';
import { useSafeTop } from '@/hooks/useSafeTop';
import { useTabBarHeight } from '@/hooks/useTabBarHeight';
import { fetchDashboardSummary, type DashboardSummary } from '@/lib/affiliateDashboard';
import { ErrorRetryBanner } from '@/components/ErrorRetryBanner';
import { friendlyError } from '@/lib/errors';
import { getItem, setItem } from '@/lib/storage';
import { ViralProductFeed } from '@/components/ViralProductFeed';
import { TrendMatchCard } from '@/components/TrendMatchCard';
import { QRCodeDisplay } from '@/components/QRCodeDisplay';
import { LinkInBioCard } from '@/components/LinkInBioCard';
import { VariantGenerator } from '@/components/VariantGenerator';
import { CopyWriter } from '@/components/CopyWriter';
import { HashtagCopyBar } from '@/components/HashtagCopyBar';
import { AICutGenerator } from '@/components/AICutGenerator';
import type { PlatformKey } from '@/types/database';

const { width: screenWidth } = Dimensions.get('window');

const HOOK_TYPES = [
  { key: 'curiosity', label: '호기심 유발', desc: '이거 모르면 손해? 3초 멈춤 보장', icon: Lightbulb, color: theme.colors.warning[400] },
  { key: 'contrarian', label: '역발상', desc: '다들 이렇게 하는데, 난 반대로', icon: Zap, color: theme.colors.accent[400] },
  { key: 'emotional', label: '감정 자극', desc: '이걸 알고 나니 눈물이...', icon: Flame, color: theme.colors.primary[400] },
];

const PERSONA_TONES = [
  { key: 'z', label: 'Z세대 트렌드', desc: '요즘 그 시절 감성, 인싸 템플릿', emoji: '🔥', color: theme.colors.accent[400] },
  { key: 'practical', label: '3040 실용', desc: '가성비 끝판왕, 실사용 리뷰', emoji: '💡', color: theme.colors.primary[400] },
  { key: 'honest', label: '내돈내산 팩트', desc: '돈 주고 산 진짜 후기, 거름 없이', emoji: '✅', color: theme.colors.success[400] },
] as const;

const TRENDING_KEYWORDS = [
  { tag: '#떡상템', category: '트렌드', heat: 98 },
  { tag: '#가성비갑', category: '가성비', heat: 95 },
  { tag: '#꿀템', category: '트렌드', heat: 93 },
  { tag: '#신상', category: '신상', heat: 90 },
  { tag: '#내돈내산', category: '리뷰', heat: 88 },
  { tag: '#혼술', category: '라이프', heat: 85 },
  { tag: '#자취방', category: '라이프', heat: 82 },
  { tag: '#원룸꾸미기', category: '라이프', heat: 80 },
  { tag: '#데스크셋업', category: '라이프', heat: 78 },
  { tag: '#더운날시원하게', category: '시즌', heat: 75 },
  { tag: '#여름휴가', category: '시즌', heat: 72 },
  { tag: '#스트랩', category: '악세', heat: 70 },
];

interface MarketingTool {
  key: string;
  label: string;
  desc: string;
  icon: typeof Megaphone;
  color: string;
  route?: string;
}

const MARKETING_TOOLS: MarketingTool[] = [
  { key: 'copywriter', label: '마케팅 문구 생성', desc: 'AI가 제품에 맞춘 바이럴 카피를 자동 작성', icon: Type, color: theme.colors.primary[400], route: '/affiliate' },
  { key: 'hashtag', label: '해시태그 추천', desc: '트렌드 기반 최적 해시태그 자동 생성', icon: Hash, color: theme.colors.accent[400], route: '/affiliate' },
  { key: 'hook', label: '역발상 훅 생성기', desc: '3초 후킹 오프닝 3가지 타입으로 즉시 생성', icon: Zap, color: theme.colors.warning[400], route: '/affiliate' },
  { key: 'shortlink', label: '단축 링크 관리', desc: '제휴 링크를 단축하고 클릭 추적', icon: Link2, color: theme.colors.success[400], route: '/affiliate/links' },
  { key: 'scheduler', label: '스마트 예약', desc: '최적 업로드 시간대 자동 추천 및 예약', icon: Calendar, color: theme.colors.primary[300], route: '/affiliate/warmup' },
  { key: 'localizer', label: '글로벌 현지화', desc: '다국어 번역 및 현지 해시태그 자동 적용', icon: Globe, color: theme.colors.accent[300], route: '/affiliate' },
  { key: 'tts', label: '감정 곡선 TTS', desc: '3단계 감정 변화로 자연스러운 AI 성우 음성', icon: Volume2, color: theme.colors.success[400], route: '/affiliate' },
  { key: 'persona', label: '크리에이터 페르소나', desc: '상위 1% 마케터 페르소나 시뮬레이션', icon: Users, color: theme.colors.warning[400], route: '/affiliate' },
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
  const [handoffMode, setHandoffMode] = useState(false);
  const [handoffImage, setHandoffImage] = useState<string | null>(null);
  const [handoffMime, setHandoffMime] = useState<string>('image/jpeg');
  const [shuffledTags, setShuffledTags] = useState<string[]>([]);
  const [copiedTag, setCopiedTag] = useState<string | null>(null);
  const [countdownSeconds, setCountdownSeconds] = useState(3600);
  const [qrValue, setQrValue] = useState('https://example.com/your-link');
  const linkInBioRef = useRef<View>(null);

  useEffect(() => {
    (async () => {
      const flag = await getItem('marketing_handoff');
      if (flag === 'true') {
        setHandoffMode(true);
        await setItem('marketing_handoff', 'false');
        const img = await getItem('marketing_handoff_image');
        const mime = await getItem('marketing_handoff_mime');
        if (img) {
          setHandoffImage(img);
          setHandoffMime(mime || 'image/jpeg');
          await setItem('marketing_handoff_image', '');
          await setItem('marketing_handoff_mime', '');
        }
      }
      shuffleTags();
    })();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdownSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const shuffleTags = useCallback(() => {
    const shuffled = [...TRENDING_KEYWORDS].sort(() => Math.random() - 0.5).slice(0, 8);
    setShuffledTags(shuffled.map((k) => k.tag));
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
    shuffleTags();
  };

  const handleToolPress = (tool: MarketingTool) => {
    if (tool.route) {
      router.push(tool.route as never);
    }
  };

  const handleCopyTag = (tag: string) => {
    setCopiedTag(tag);
    setTimeout(() => setCopiedTag(null), 2000);
  };

  const handleStartGeneration = () => {
    router.push('/affiliate' as never);
  };

  const formatCountdown = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
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
              소재를 구매로 전환시키는 핵심 마케팅 엔진
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
            {/* Handoff Hero */}
            {handoffMode && (
              <View style={styles.handoffHero}>
                <View style={styles.handoffHeroIcon}>
                  <Flame size={28} color={theme.colors.warning[400]} strokeWidth={2.2} />
                </View>
                <Text style={styles.handoffHeroTitle}>소재가 준비되었습니다!</Text>
                <Text style={styles.handoffHeroDesc}>
                  훅을 선택하고 마케팅 숏폼을 완성하세요
                </Text>
                {handoffImage && (
                  <Image
                    source={{ uri: `data:${handoffMime};base64,${handoffImage}` }}
                    style={styles.handoffHeroImage}
                    resizeMode="cover"
                  />
                )}
              </View>
            )}

            {/* Quick Stats */}
            <View style={styles.statsRow}>
              <View style={styles.statPill}>
                <TrendingUp size={14} color={theme.colors.success[400]} strokeWidth={2} />
                <Text style={styles.statPillValue}>{totalRevenue.toLocaleString('ko-KR')}원</Text>
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

            {/* 1. Hook Studio */}
            <View style={styles.sectionHeader}>
              <View style={styles.sectionHeaderLeft}>
                <View style={[styles.sectionNumBadge, { backgroundColor: theme.colors.warning[500] + '20' }]}>
                  <Text style={styles.sectionNumText}>1</Text>
                </View>
                <Flame size={16} color={theme.colors.warning[400]} strokeWidth={2.2} />
                <Text style={styles.sectionTitleText}>마케팅 훅 스튜디오</Text>
              </View>
            </View>
            <Text style={styles.sectionDesc}>3초 후킹 오프닝 — 시청자가 스크롤을 멈추게 만드는 첫 문장</Text>
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
            <TouchableOpacity
              style={[styles.startBtn, !selectedHook && styles.startBtnDisabled]}
              onPress={handleStartGeneration}
              disabled={!selectedHook}
              activeOpacity={0.85}
            >
              <Sparkles size={18} color={selectedHook ? '#fff' : theme.colors.dark.textFaint} strokeWidth={2.2} />
              <Text style={[styles.startBtnText, !selectedHook && styles.startBtnTextDisabled]}>
                {selectedHook ? '훅으로 콘텐츠 생성 시작' : '훅을 선택해주세요'}
              </Text>
              {selectedHook && <ArrowRight size={16} color="#fff" strokeWidth={2.2} />}
            </TouchableOpacity>

            {/* 2. AI Cut Generation */}
            <View style={styles.sectionHeader}>
              <View style={styles.sectionHeaderLeft}>
                <View style={[styles.sectionNumBadge, { backgroundColor: theme.colors.primary[500] + '20' }]}>
                  <Text style={styles.sectionNumText}>2</Text>
                </View>
                <Scissors size={16} color={theme.colors.primary[400]} strokeWidth={2.2} />
                <Text style={styles.sectionTitleText}>AI 컷 생성</Text>
              </View>
            </View>
            <Text style={styles.sectionDesc}>0.8초 템포 컷 분할 · 마이크로 비트 동기화 · 하이라이트 자동 추출</Text>
            <AICutGenerator />

            {/* 3. A/B Variant Personas */}
            <View style={styles.sectionHeader}>
              <View style={styles.sectionHeaderLeft}>
                <View style={[styles.sectionNumBadge, { backgroundColor: theme.colors.accent[500] + '20' }]}>
                  <Text style={styles.sectionNumText}>3</Text>
                </View>
                <Users size={16} color={theme.colors.accent[400]} strokeWidth={2.2} />
                <Text style={styles.sectionTitleText}>A/B 테스트 3종 페르소나</Text>
              </View>
            </View>
            <Text style={styles.sectionDesc}>Z세대 / 3040 실용 / 내돈내산 — 3가지 톤으로 1클릭 동시 생성</Text>
            <View style={styles.personaGrid}>
              {PERSONA_TONES.map((tone) => (
                <TouchableOpacity
                  key={tone.key}
                  style={[styles.personaCard, { borderColor: tone.color + '40' }]}
                  onPress={handleStartGeneration}
                  activeOpacity={0.7}
                >
                  <Text style={styles.personaEmoji}>{tone.emoji}</Text>
                  <Text style={styles.personaLabel}>{tone.label}</Text>
                  <Text style={styles.personaDesc} numberOfLines={2}>{tone.desc}</Text>
                  <View style={[styles.personaGenBtn, { backgroundColor: tone.color + '18' }]}>
                    <Sparkles size={12} color={tone.color} strokeWidth={2} />
                    <Text style={[styles.personaGenText, { color: tone.color }]}>생성</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            {/* 4. Trending Keyword Feed */}
            <View style={styles.sectionHeader}>
              <View style={styles.sectionHeaderLeft}>
                <View style={[styles.sectionNumBadge, { backgroundColor: theme.colors.primary[500] + '20' }]}>
                  <Text style={styles.sectionNumText}>4</Text>
                </View>
                <TrendingUp size={16} color={theme.colors.primary[400]} strokeWidth={2.2} />
                <Text style={styles.sectionTitleText}>실시간 떡상 키워드 피드</Text>
              </View>
              <TouchableOpacity onPress={shuffleTags} activeOpacity={0.7} style={styles.shuffleBtn}>
                <Shuffle size={14} color={theme.colors.primary[300]} strokeWidth={2} />
                <Text style={styles.shuffleBtnText}>셔플</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.sectionDesc}>SNS 인기 해시태드 무작위 믹스 — 복사해서 바로 사용</Text>
            <View style={styles.tagCloud}>
              {(shuffledTags.length > 0 ? shuffledTags : TRENDING_KEYWORDS.slice(0, 8).map((k) => k.tag)).map((tag, i) => {
                const keyword = TRENDING_KEYWORDS.find((k) => k.tag === tag);
                const heat = keyword?.heat ?? 70;
                return (
                  <TouchableOpacity
                    key={`${tag}-${i}`}
                    style={[
                      styles.tagChip,
                      copiedTag === tag && styles.tagChipCopied,
                    ]}
                    onPress={() => handleCopyTag(tag)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.tagChipText}>{tag}</Text>
                    <View style={styles.tagHeatBadge}>
                      <Flame size={8} color={heat >= 90 ? theme.colors.warning[400] : theme.colors.dark.textFaint} strokeWidth={2} />
                      <Text style={[styles.tagHeatText, heat >= 90 && styles.tagHeatTextHot]}>{heat}</Text>
                    </View>
                    {copiedTag === tag && (
                      <Check size={10} color={theme.colors.success[400]} strokeWidth={2.5} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={styles.trendingFeedWrap}>
              <ViralProductFeed />
            </View>
            <View style={styles.trendMatchWrap}>
              <TrendMatchCard productCategory="라이프스타일" />
            </View>

            {/* 5. Smart CTA & Link-in-Bio */}
            <View style={styles.sectionHeader}>
              <View style={styles.sectionHeaderLeft}>
                <View style={[styles.sectionNumBadge, { backgroundColor: theme.colors.success[500] + '20' }]}>
                  <Text style={styles.sectionNumText}>5</Text>
                </View>
                <Link2 size={16} color={theme.colors.success[400]} strokeWidth={2.2} />
                <Text style={styles.sectionTitleText}>스마트 CTA & Link-in-Bio</Text>
              </View>
            </View>
            <Text style={styles.sectionDesc}>카운트다운 타이머 & QR/자막 워터마크로 전환율 극대화</Text>

            {/* Countdown Timer Card */}
            <View style={styles.countdownCard}>
              <View style={styles.countdownHeader}>
                <Timer size={18} color={theme.colors.warning[400]} strokeWidth={2.2} />
                <Text style={styles.countdownTitle}>긴급 카운트다운</Text>
              </View>
              <Text style={styles.countdownTimer}>{formatCountdown(countdownSeconds)}</Text>
              <Text style={styles.countdownDesc}>
                제한 시간 느낌으로 구매 긴장감 조성 — CTA 클릭률 평균 23% 상승
              </Text>
              <TouchableOpacity
                style={styles.countdownResetBtn}
                onPress={() => setCountdownSeconds(3600)}
                activeOpacity={0.7}
              >
                <Text style={styles.countdownResetText}>1시간으로 리셋</Text>
              </TouchableOpacity>
            </View>

            {/* QR Code Card */}
            <View style={styles.qrCard}>
              <View style={styles.qrHeader}>
                <QrCode size={18} color={theme.colors.primary[400]} strokeWidth={2.2} />
                <Text style={styles.qrTitle}>QR 워터마크</Text>
              </View>
              <View style={styles.qrDisplayWrap}>
                <QRCodeDisplay value={qrValue} size={140} />
              </View>
              <Text style={styles.qrDesc}>
                영상에 QR을 워터마크로 삽입 — 시청자가 스캔하면 바로 구매
              </Text>
              <TouchableOpacity
                style={styles.qrEditBtn}
                onPress={() => router.push('/affiliate/links' as never)}
                activeOpacity={0.7}
              >
                <Link2 size={14} color={theme.colors.primary[300]} strokeWidth={2} />
                <Text style={styles.qrEditText}>단축 링크 관리에서 QR 연결</Text>
              </TouchableOpacity>
            </View>

            {/* Link-in-Bio Card */}
            <View style={styles.linkInBioWrap}>
              <LinkInBioCard scanId="" scanTitle="마케팅 허브" />
            </View>

            {/* Divider */}
            <View style={styles.divider} />

            {/* All Marketing Tools */}
            <Text style={styles.toolsSectionTitle}>전체 마케팅 도구</Text>
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
                      <Text style={styles.toolLabel} numberOfLines={1}>{tool.label}</Text>
                      <Text style={styles.toolDesc} numberOfLines={2}>{tool.desc}</Text>
                    </View>
                    <ArrowRight size={16} color={theme.colors.dark.textFaint} strokeWidth={2} />
                  </TouchableOpacity>
                );
              })}
            </View>
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
  handoffHeroImage: {
    width: 120,
    height: 120,
    borderRadius: theme.radius.md,
    marginTop: 12,
    borderWidth: 2,
    borderColor: theme.colors.warning[400] + '40',
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
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: theme.spacing.md,
    marginBottom: 4,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionNumBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionNumText: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.dark.text,
  },
  sectionTitleText: {
    fontSize: 16,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.dark.text,
  },
  sectionDesc: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    marginBottom: 10,
    lineHeight: 17,
  },
  selectGrid: {
    gap: 8,
    marginBottom: theme.spacing.sm,
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
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: theme.colors.primary[500],
    borderRadius: theme.radius.lg,
    paddingVertical: 14,
    marginBottom: theme.spacing.md,
  },
  startBtnDisabled: {
    backgroundColor: theme.colors.dark.surfaceLight,
    borderWidth: 1.5,
    borderColor: theme.colors.dark.border,
  },
  startBtnText: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.bold,
    color: '#fff',
  },
  startBtnTextDisabled: {
    color: theme.colors.dark.textFaint,
  },
  personaGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: theme.spacing.md,
  },
  personaCard: {
    flex: 1,
    backgroundColor: theme.colors.dark.surface,
    borderRadius: theme.radius.lg,
    padding: 12,
    gap: 6,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  personaEmoji: {
    fontSize: 24,
  },
  personaLabel: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
    textAlign: 'center',
  },
  personaDesc: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    textAlign: 'center',
    lineHeight: 14,
  },
  personaGenBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: theme.radius.full,
    marginTop: 2,
  },
  personaGenText: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.semiBold,
  },
  shuffleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.primary[500] + '15',
  },
  shuffleBtnText: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.primary[300],
  },
  tagCloud: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: theme.spacing.md,
  },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.colors.dark.surface,
    borderRadius: theme.radius.full,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 1.5,
    borderColor: theme.colors.dark.border,
  },
  tagChipCopied: {
    borderColor: theme.colors.success[400] + '60',
    backgroundColor: theme.colors.success[500] + '12',
  },
  tagChipText: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
  },
  tagHeatBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  tagHeatText: {
    fontSize: 9,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.textFaint,
  },
  tagHeatTextHot: {
    color: theme.colors.warning[400],
  },
  trendingFeedWrap: {
    marginBottom: theme.spacing.md,
  },
  trendMatchWrap: {
    marginBottom: theme.spacing.md,
  },
  countdownCard: {
    backgroundColor: theme.colors.warning[500] + '10',
    borderRadius: theme.radius.lg,
    padding: 16,
    marginBottom: theme.spacing.sm,
    borderWidth: 1.5,
    borderColor: theme.colors.warning[400] + '30',
    alignItems: 'center',
    gap: 8,
  },
  countdownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  countdownTitle: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
  },
  countdownTimer: {
    fontSize: 32,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.warning[400],
    letterSpacing: 2,
  },
  countdownDesc: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    textAlign: 'center',
    lineHeight: 15,
  },
  countdownResetBtn: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.warning[500] + '15',
  },
  countdownResetText: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.warning[400],
  },
  qrCard: {
    backgroundColor: theme.colors.dark.surface,
    borderRadius: theme.radius.lg,
    padding: 16,
    marginBottom: theme.spacing.sm,
    borderWidth: 1.5,
    borderColor: theme.colors.dark.border,
    alignItems: 'center',
    gap: 10,
  },
  qrHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
  },
  qrTitle: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
  },
  qrDisplayWrap: {
    padding: 12,
    borderRadius: theme.radius.md,
    backgroundColor: '#fff',
  },
  qrDesc: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    textAlign: 'center',
    lineHeight: 15,
  },
  qrEditBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.primary[500] + '15',
  },
  qrEditText: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.primary[300],
  },
  linkInBioWrap: {
    marginBottom: theme.spacing.md,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.dark.border,
    marginVertical: theme.spacing.sm,
  },
  toolsSectionTitle: {
    fontSize: 16,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.dark.text,
    marginBottom: 10,
    marginTop: theme.spacing.sm,
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
});
