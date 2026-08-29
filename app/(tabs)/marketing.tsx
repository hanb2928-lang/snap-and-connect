import { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  TextInput,
  Linking,
  Platform,
  Image,
} from 'react-native';
import {
  Megaphone,
  TrendingUp,
  Zap,
  Link2,
  Flame,
  Check,
  Lightbulb,
  Timer,
  QrCode,
  Shuffle,
  ShoppingBag,
  Users,
  Sparkles,
  ArrowRight,
  Film,
  Dna,
  Tag,
  Globe,
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
import { ClipboardAffiliateBanner } from '@/components/ClipboardAffiliateBanner';
import { validateAffiliateUrl } from '@/lib/affiliate';
import { extractProductMeta } from '@/lib/analysis';

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

const QUICK_NAV_ITEMS = [
  { key: 'viral', label: '떡상 꿀템', icon: Flame, color: theme.colors.warning[400] },
  { key: 'url', label: 'URL 입력', icon: Link2, color: theme.colors.accent[400] },
  { key: 'category', label: '카테고리', icon: Tag, color: theme.colors.primary[300] },
  { key: 'hook', label: '3초 훅', icon: Zap, color: theme.colors.warning[400] },
  { key: 'ab', label: 'A/B 테스트', icon: Dna, color: theme.colors.accent[400] },
  { key: 'render', label: '영상 만들기', icon: Film, color: theme.colors.primary[400] },
];

type PipelineStep = 1 | 2 | 3;

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
  const [activeStep, setActiveStep] = useState<PipelineStep>(1);

  // Step 1: Product input state
  const [affiliateUrl, setAffiliateUrl] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [productMeta, setProductMeta] = useState<{
    productName: string;
    description: string;
    price: string;
    image: string;
    platform: string;
    brand: string;
  } | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);

  const scrollRef = useRef<ScrollView>(null);
  const sectionRefs = useRef<Record<string, View | null>>({});

  const scrollToSection = (key: string) => {
    setTimeout(() => {
      const targetRef = sectionRefs.current[key];
      if (targetRef && scrollRef.current) {
        targetRef.measureLayout(
          scrollRef.current as any,
          (_x, y) => { scrollRef.current?.scrollTo({ y: y - 20, animated: true }); },
          () => {},
        );
      }
    }, 100);
  };

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

  useEffect(() => { load(); }, [load]);

  const handleRefresh = () => {
    setRefreshing(true);
    load();
    shuffleTags();
  };

  const handleCopyTag = (tag: string) => {
    setCopiedTag(tag);
    setTimeout(() => setCopiedTag(null), 2000);
  };

  const formatCountdown = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleSaveAffiliate = async () => {
    if (!affiliateUrl.trim()) return;
    const validation = validateAffiliateUrl(affiliateUrl);
    if (!validation.valid) {
      setExtractError(validation.error);
      return;
    }
    setAffiliateUrl(validation.normalizedUrl);
    setExtracting(true);
    setExtractError(null);
    try {
      const meta = await extractProductMeta(affiliateUrl.trim());
      setProductMeta({
        productName: meta.productName || '',
        description: meta.description || '',
        price: meta.price || '',
        image: meta.image || '',
        platform: meta.platform || '',
        brand: meta.brand || '',
      });
      setSelectedProduct(meta.productName || '선택된 상품');
      setActiveStep(2);
      scrollToSection('hook');
    } catch {
      setProductMeta(null);
      setExtractError('상품 정보를 자동으로 가져오지 못했습니다. 직접 입력하거나 다른 링크를 시도해주세요.');
    } finally {
      setExtracting(false);
    }
  };

  const handleQuickProductSelect = (productName: string) => {
    setSelectedProduct(productName);
    setActiveStep(2);
    scrollToSection('hook');
  };

  const handleHookSelect = (hookKey: string) => {
    setSelectedHook(hookKey);
    setActiveStep(3);
    scrollToSection('render');
  };

  const handleStartGeneration = () => {
    if (productMeta?.productName || selectedProduct) {
      router.push('/affiliate' as never);
    } else {
      router.push('/affiliate' as never);
    }
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
            <Text style={styles.headerTitle}>마케팅 &amp; 제휴쇼핑</Text>
            <Text style={styles.headerSubtext}>
              상품 선택 → 훅/전략 → 영상 생성, 한 화면에서 끝내세요
            </Text>
          </View>
        </View>
      </View>

      {/* Quick Nav Bar */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickNav} contentContainerStyle={styles.quickNavContent}>
        {QUICK_NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <TouchableOpacity
              key={item.key}
              style={styles.quickNavItem}
              onPress={() => scrollToSection(item.key)}
              activeOpacity={0.7}
            >
              <View style={[styles.quickNavIcon, { backgroundColor: item.color + '18' }]}>
                <Icon size={16} color={item.color} strokeWidth={2} />
              </View>
              <Text style={styles.quickNavLabel}>{item.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: tabBarHeight + 100 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.colors.primary[400]} />
        }
      >
        {loadError ? (
          <ErrorRetryBanner message={loadError} onRetry={load} />
        ) : (
          <>
            {/* Pipeline Step Indicator */}
            <View style={styles.pipelineIndicator}>
              {([1, 2, 3] as PipelineStep[]).map((step, idx) => (
                <View key={step} style={styles.pipelineStepWrap}>
                  <View style={[styles.pipelineDot, activeStep >= step && styles.pipelineDotActive]}>
                    <Text style={[styles.pipelineDotText, activeStep >= step && styles.pipelineDotTextActive]}>{step}</Text>
                  </View>
                  <Text style={[styles.pipelineLabel, activeStep >= step && styles.pipelineLabelActive]}>
                    {step === 1 ? '상품 수집' : step === 2 ? '전략 가공' : '영상 렌더링'}
                  </Text>
                  {idx < 2 && <View style={[styles.pipelineConnector, activeStep > step && styles.pipelineConnectorActive]} />}
                </View>
              ))}
            </View>

            {/* Handoff Hero */}
            {handoffMode && (
              <View style={styles.handoffHero}>
                <View style={styles.handoffHeroIcon}>
                  <Flame size={28} color={theme.colors.warning[400]} strokeWidth={2.2} />
                </View>
                <Text style={styles.handoffHeroTitle}>소재가 준비되었습니다!</Text>
                <Text style={styles.handoffHeroDesc}>
                  아래에서 상품을 선택하고 훅을 고르면 영상이 완성됩니다
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
                <ShoppingBag size={14} color={theme.colors.accent[400]} strokeWidth={2} />
                <Text style={styles.statPillValue}>{totalLinks}</Text>
                <Text style={styles.statPillLabel}>링크</Text>
              </View>
            </View>

            {/* ========== STEP 1: Product Input Track ========== */}
            <View
              ref={(ref) => { sectionRefs.current['viral'] = ref; }}
              collapsable={false}
            >
              <View style={styles.phaseBanner}>
                <View style={[styles.phaseNum, { backgroundColor: theme.colors.warning[500] }]}>
                  <Text style={styles.phaseNumText}>1</Text>
                </View>
                <View style={styles.phaseHeaderText}>
                  <Text style={styles.phaseTitle}>상품 소재 수집</Text>
                  <Text style={styles.phaseDesc}>마케팅할 상품을 선택하세요 — 3가지 방법 중 하나</Text>
                </View>
              </View>

              {/* Track 1a: Viral Products */}
              <View style={styles.trackCard}>
                <View style={styles.trackCardHeader}>
                  <View style={[styles.trackIconSmall, { backgroundColor: theme.colors.warning[500] + '22' }]}>
                    <Flame size={20} color={theme.colors.warning[400]} strokeWidth={2} />
                  </View>
                  <View style={styles.trackCardInfo}>
                    <Text style={styles.trackCardTitle}>실시간 떡상 꿀템 TOP 20</Text>
                    <Text style={styles.trackCardDesc}>쿠팡·아마존·알리 클릭 급상승 상품</Text>
                  </View>
                  <View style={[styles.beginnerBadge, { backgroundColor: theme.colors.warning[500] + '18' }]}>
                    <Text style={[styles.beginnerBadgeText, { color: theme.colors.warning[400] }]}>추천 트랙</Text>
                  </View>
                </View>
              </View>
              <View style={styles.viralFeedWrap}>
                <ViralProductFeed />
              </View>

              {/* Track 1b: URL Input */}
              <View
                ref={(ref) => { sectionRefs.current['url'] = ref; }}
                collapsable={false}
              >
                <View style={styles.trackCard}>
                  <View style={styles.trackCardHeader}>
                    <View style={[styles.trackIconSmall, { backgroundColor: theme.colors.accent[500] + '22' }]}>
                      <Link2 size={20} color={theme.colors.accent[400]} strokeWidth={2} />
                    </View>
                    <View style={styles.trackCardInfo}>
                      <Text style={styles.trackCardTitle}>제휴 URL 직접 입력</Text>
                      <Text style={styles.trackCardDesc}>클립보드 자동 인식 &amp; 상품 정보 추출</Text>
                    </View>
                    <View style={[styles.beginnerBadge, { backgroundColor: theme.colors.accent[500] + '18' }]}>
                      <Text style={[styles.beginnerBadgeText, { color: theme.colors.accent[300] }]}>직접 트랙</Text>
                    </View>
                  </View>

                  <ClipboardAffiliateBanner
                    onInsert={(url) => setAffiliateUrl(url)}
                    currentUrl={affiliateUrl}
                  />

                  <TextInput
                    style={styles.urlInput}
                    value={affiliateUrl}
                    onChangeText={setAffiliateUrl}
                    placeholder="제휴 링크 URL을 여기에 붙여넣으세요"
                    placeholderTextColor={theme.colors.dark.textFaint}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                    multiline
                  />

                  <TouchableOpacity
                    style={[styles.urlSubmitBtn, (!affiliateUrl.trim() || extracting) && styles.urlSubmitBtnDisabled]}
                    onPress={handleSaveAffiliate}
                    disabled={!affiliateUrl.trim() || extracting}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.urlSubmitBtnText}>
                      {extracting ? '상품 정보 추출 중...' : '링크에서 상품 정보 추출 →'}
                    </Text>
                    <ArrowRight size={16} color="#fff" strokeWidth={2.5} />
                  </TouchableOpacity>

                  {extractError && (
                    <View style={styles.extractErrorBox}>
                      <Text style={styles.extractErrorText}>{extractError}</Text>
                    </View>
                  )}

                  {productMeta && (productMeta.productName || productMeta.price) && (
                    <View style={styles.productMetaCard}>
                      {productMeta.image ? (
                        <Image
                          source={{ uri: productMeta.image }}
                          style={styles.productMetaImage}
                          resizeMode="cover"
                        />
                      ) : null}
                      <View style={styles.productMetaInfo}>
                        {productMeta.productName ? (
                          <Text style={styles.productMetaName} numberOfLines={2}>{productMeta.productName}</Text>
                        ) : null}
                        {productMeta.price ? (
                          <Text style={styles.productMetaPrice}>{productMeta.price}</Text>
                        ) : null}
                        {productMeta.brand ? (
                          <Text style={styles.productMetaBrand}>{productMeta.brand}</Text>
                        ) : null}
                      </View>
                      <View style={styles.productMetaCheck}>
                        <Check size={16} color={theme.colors.success[400]} strokeWidth={2.5} />
                      </View>
                    </View>
                  )}
                </View>
              </View>

              {/* Track 1c: Category Catalog */}
              <View
                ref={(ref) => { sectionRefs.current['category'] = ref; }}
                collapsable={false}
              >
                <View style={styles.trackCard}>
                  <View style={styles.trackCardHeader}>
                    <View style={[styles.trackIconSmall, { backgroundColor: theme.colors.primary[500] + '22' }]}>
                      <Tag size={20} color={theme.colors.primary[300]} strokeWidth={2} />
                    </View>
                    <View style={styles.trackCardInfo}>
                      <Text style={styles.trackCardTitle}>카테고리별 카탈로그</Text>
                      <Text style={styles.trackCardDesc}>패션·뷰티·자취·IT 기기 묶음 상품</Text>
                    </View>
                    <View style={[styles.beginnerBadge, { backgroundColor: theme.colors.primary[500] + '18' }]}>
                      <Text style={[styles.beginnerBadgeText, { color: theme.colors.primary[300] }]}>탐색 트랙</Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.categoryExploreBtn}
                    onPress={() => router.push('/affiliate/trending' as never)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.categoryExploreText}>카테고리별 꿀조합 보기 →</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.trendMatchWrap}>
                  <TrendMatchCard productCategory="라이프스타일" />
                </View>
              </View>
            </View>

            {/* ========== STEP 2: Marketing Strategy Track ========== */}
            <View
              ref={(ref) => { sectionRefs.current['hook'] = ref; }}
              collapsable={false}
            >
              <View style={styles.phaseBanner}>
                <View style={[styles.phaseNum, { backgroundColor: theme.colors.accent[500] }]}>
                  <Text style={styles.phaseNumText}>2</Text>
                </View>
                <View style={styles.phaseHeaderText}>
                  <Text style={styles.phaseTitle}>마케팅 전환율 전략 가공</Text>
                  <Text style={styles.phaseDesc}>
                    {selectedProduct ? `선택 상품: ${selectedProduct}` : '1단계에서 상품을 먼저 선택하세요'}
                  </Text>
                </View>
              </View>

              {/* 2a: Hook Studio */}
              <View style={styles.sectionHeader}>
                <View style={styles.sectionHeaderLeft}>
                  <Flame size={20} color={theme.colors.warning[400]} strokeWidth={2.5} />
                  <Text style={styles.sectionTitleText}>3초 오프닝 훅 스튜디오</Text>
                </View>
              </View>
              <Text style={styles.sectionDesc}>시청자가 스크롤을 멈추게 만드는 첫 문장을 선택하세요</Text>
              <View style={[styles.beginnerBadge, { backgroundColor: theme.colors.warning[500] + '18' }]}>
                <Text style={[styles.beginnerBadgeText, { color: theme.colors.warning[400] }]}>사진 선택 → 3초 훅 문구 → 영상 생성</Text>
              </View>
              <View style={styles.selectGrid}>
                {HOOK_TYPES.map((hook) => {
                  const Icon = hook.icon;
                  const selected = selectedHook === hook.key;
                  return (
                    <TouchableOpacity
                      key={hook.key}
                      style={[styles.selectCard, selected && styles.selectCardActive]}
                      onPress={() => handleHookSelect(hook.key)}
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

              {/* 2b: A/B Persona Tones */}
              <View
                ref={(ref) => { sectionRefs.current['ab'] = ref; }}
                collapsable={false}
              >
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionHeaderLeft}>
                    <Users size={20} color={theme.colors.accent[400]} strokeWidth={2.5} />
                    <Text style={styles.sectionTitleText}>A/B 테스트 3종 페르소나</Text>
                  </View>
                </View>
                <Text style={styles.sectionDesc}>Z세대 / 3040 실용 / 내돈내산 — 1클릭 동시 적용</Text>
                <View style={[styles.beginnerBadge, { backgroundColor: theme.colors.accent[500] + '18' }]}>
                  <Text style={[styles.beginnerBadgeText, { color: theme.colors.accent[300] }]}>1클릭 → 3가지 톤 영상 동시 생성</Text>
                </View>
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
              </View>

              {/* 2c: Trending Keywords & CTA */}
              <View style={styles.sectionHeader}>
                <View style={styles.sectionHeaderLeft}>
                  <TrendingUp size={20} color={theme.colors.primary[400]} strokeWidth={2.5} />
                  <Text style={styles.sectionTitleText}>실시간 떡상 키워드 &amp; 스마트 CTA</Text>
                </View>
                <TouchableOpacity onPress={shuffleTags} activeOpacity={0.7} style={styles.shuffleBtn}>
                  <Shuffle size={14} color={theme.colors.primary[300]} strokeWidth={2} />
                  <Text style={styles.shuffleBtnText}>셔플</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.sectionDesc}>SNS 인기 해시태그 무작위 믹스 — 복사해서 바로 사용</Text>
              <View style={[styles.beginnerBadge, { backgroundColor: theme.colors.primary[500] + '18' }]}>
                <Text style={[styles.beginnerBadgeText, { color: theme.colors.primary[300] }]}>인기 해시태그 → 1탭 복사 → 영상에 붙여넣기</Text>
              </View>
              <View style={styles.tagCloud}>
                {(shuffledTags.length > 0 ? shuffledTags : TRENDING_KEYWORDS.slice(0, 8).map((k) => k.tag)).map((tag, i) => {
                  const keyword = TRENDING_KEYWORDS.find((k) => k.tag === tag);
                  const heat = keyword?.heat ?? 70;
                  return (
                    <TouchableOpacity
                      key={`${tag}-${i}`}
                      style={[styles.tagChip, copiedTag === tag && styles.tagChipCopied]}
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

              {/* Smart CTA: Countdown + QR */}
              <View style={styles.sectionHeader}>
                <View style={styles.sectionHeaderLeft}>
                  <Link2 size={20} color={theme.colors.success[400]} strokeWidth={2.5} />
                  <Text style={styles.sectionTitleText}>스마트 CTA &amp; Link-in-Bio</Text>
                </View>
              </View>
              <Text style={styles.sectionDesc}>카운트다운 타이머 &amp; QR/자막 워터마크로 전환율 극대화</Text>
              <View style={[styles.beginnerBadge, { backgroundColor: theme.colors.success[500] + '18' }]}>
                <Text style={[styles.beginnerBadgeText, { color: theme.colors.success[400] }]}>QR 코드 → 영상에 삽입 → 스캔 시 구매</Text>
              </View>

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

              <View style={styles.linkInBioWrap}>
                <LinkInBioCard scanId="" scanTitle="마케팅 허브" />
              </View>
            </View>

            {/* ========== STEP 3: AI Video Rendering CTA ========== */}
            <View
              ref={(ref) => { sectionRefs.current['render'] = ref; }}
              collapsable={false}
            >
              <View style={styles.phaseBanner}>
                <View style={[styles.phaseNum, { backgroundColor: theme.colors.primary[500] }]}>
                  <Text style={styles.phaseNumText}>3</Text>
                </View>
                <View style={styles.phaseHeaderText}>
                  <Text style={styles.phaseTitle}>AI 마케팅 숏폼 생성 &amp; 렌더링</Text>
                  <Text style={styles.phaseDesc}>
                    {selectedHook ? '훅 선택 완료 — 아래 버튼을 눌러 영상을 생성하세요' : '2단계에서 훅을 먼저 선택하세요'}
                  </Text>
                </View>
              </View>

              <View style={styles.renderSummaryCard}>
                <View style={styles.renderSummaryRow}>
                  <View style={styles.renderSummaryItem}>
                    <ShoppingBag size={16} color={theme.colors.warning[400]} strokeWidth={2} />
                    <Text style={styles.renderSummaryLabel}>상품</Text>
                    <Text style={styles.renderSummaryValue} numberOfLines={1}>
                      {selectedProduct || '미선택'}
                    </Text>
                  </View>
                </View>
                <View style={styles.renderSummaryDivider} />
                <View style={styles.renderSummaryRow}>
                  <View style={styles.renderSummaryItem}>
                    <Zap size={16} color={theme.colors.accent[400]} strokeWidth={2} />
                    <Text style={styles.renderSummaryLabel}>훅</Text>
                    <Text style={styles.renderSummaryValue} numberOfLines={1}>
                      {selectedHook ? HOOK_TYPES.find((h) => h.key === selectedHook)?.label : '미선택'}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {/* All Marketing Tools */}
            <View style={styles.divider} />
            <Text style={styles.toolsSectionTitle}>전체 마케팅 도구</Text>
            <View style={styles.toolGrid}>
              <TouchableOpacity
                style={styles.toolCard}
                onPress={() => router.push('/affiliate' as never)}
                activeOpacity={0.7}
              >
                <View style={[styles.toolIcon, { backgroundColor: theme.colors.accent[500] + '20' }]}>
                  <Link2 size={20} color={theme.colors.accent[400]} strokeWidth={2.2} />
                </View>
                <View style={styles.toolInfo}>
                  <Text style={styles.toolLabel}>제휴 링크 관리</Text>
                  <Text style={styles.toolDesc} numberOfLines={2}>제휴 링크 발급, 단축, 클릭 추적</Text>
                </View>
                <ArrowRight size={16} color={theme.colors.dark.textFaint} strokeWidth={2} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.toolCard}
                onPress={() => router.push('/affiliate/links' as never)}
                activeOpacity={0.7}
              >
                <View style={[styles.toolIcon, { backgroundColor: theme.colors.success[500] + '20' }]}>
                  <Link2 size={20} color={theme.colors.success[400]} strokeWidth={2.2} />
                </View>
                <View style={styles.toolInfo}>
                  <Text style={styles.toolLabel}>단축 링크 관리</Text>
                  <Text style={styles.toolDesc} numberOfLines={2}>제휴 링크 단축 및 클릭 추적</Text>
                </View>
                <ArrowRight size={16} color={theme.colors.dark.textFaint} strokeWidth={2} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.toolCard}
                onPress={() => router.push('/affiliate/warmup' as never)}
                activeOpacity={0.7}
              >
                <View style={[styles.toolIcon, { backgroundColor: theme.colors.primary[500] + '20' }]}>
                  <Globe size={20} color={theme.colors.primary[300]} strokeWidth={2.2} />
                </View>
                <View style={styles.toolInfo}>
                  <Text style={styles.toolLabel}>스마트 예약</Text>
                  <Text style={styles.toolDesc} numberOfLines={2}>최적 업로드 시간대 자동 추천</Text>
                </View>
                <ArrowRight size={16} color={theme.colors.dark.textFaint} strokeWidth={2} />
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>

      {/* Sticky Floating CTA — appears when product + hook selected */}
      {selectedProduct && selectedHook && (
        <View style={[styles.stickyCtaWrap, { bottom: tabBarHeight + theme.spacing.sm }]}>
          <TouchableOpacity
            style={styles.stickyCtaBtn}
            onPress={handleStartGeneration}
            activeOpacity={0.85}
          >
            <Film size={24} color="#fff" strokeWidth={2.5} />
            <Text style={styles.stickyCtaText}>선택한 상품으로 AI 마케팅 영상 만들기</Text>
            <ArrowRight size={22} color="#fff" strokeWidth={2.5} />
          </TouchableOpacity>
        </View>
      )}
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
    paddingBottom: theme.spacing.sm,
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
    fontSize: 22,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.dark.text,
  },
  headerSubtext: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    marginTop: 2,
  },
  quickNav: {
    maxHeight: 56,
    marginBottom: theme.spacing.sm,
  },
  quickNavContent: {
    paddingHorizontal: theme.spacing.lg,
    gap: 8,
  },
  quickNavItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.dark.surface,
    borderWidth: 1.5,
    borderColor: theme.colors.dark.border,
    marginRight: 6,
  },
  quickNavIcon: {
    width: 28,
    height: 28,
    borderRadius: theme.radius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickNavLabel: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
  },
  scroll: {
    flex: 1,
    paddingHorizontal: theme.spacing.lg,
  },
  pipelineIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    gap: 0,
  },
  pipelineStepWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pipelineDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.colors.dark.surface,
    borderWidth: 2,
    borderColor: theme.colors.dark.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pipelineDotActive: {
    backgroundColor: theme.colors.primary[500],
    borderColor: theme.colors.primary[400],
  },
  pipelineDotText: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.dark.textFaint,
  },
  pipelineDotTextActive: {
    color: '#fff',
  },
  pipelineLabel: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textFaint,
    marginLeft: 6,
  },
  pipelineLabelActive: {
    color: theme.colors.dark.text,
    fontFamily: theme.typography.fontFamily.semiBold,
  },
  pipelineConnector: {
    width: 24,
    height: 2,
    backgroundColor: theme.colors.dark.border,
    marginHorizontal: 8,
  },
  pipelineConnectorActive: {
    backgroundColor: theme.colors.primary[400],
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
  phaseBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  phaseNum: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  phaseNumText: {
    fontSize: 16,
    fontFamily: theme.typography.fontFamily.bold,
    color: '#fff',
  },
  phaseHeaderText: {
    flex: 1,
  },
  phaseTitle: {
    fontSize: 17,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.dark.text,
  },
  phaseDesc: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    marginTop: 2,
  },
  trackCard: {
    backgroundColor: theme.colors.dark.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1.5,
    borderColor: theme.colors.dark.border,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  trackCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  trackIconSmall: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  trackCardInfo: {
    flex: 1,
  },
  trackCardTitle: {
    fontSize: 15,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.dark.text,
  },
  trackCardDesc: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    marginTop: 2,
  },
  beginnerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: theme.radius.full,
  },
  beginnerBadgeText: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.semiBold,
  },
  viralFeedWrap: {
    marginBottom: theme.spacing.md,
  },
  urlInput: {
    backgroundColor: theme.colors.dark.surfaceLight,
    borderRadius: theme.radius.md,
    padding: theme.spacing.sm + 2,
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.text,
    borderWidth: 1.5,
    borderColor: theme.colors.dark.border,
    marginBottom: theme.spacing.sm,
    minHeight: 60,
  },
  urlSubmitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.colors.accent[500],
    borderRadius: theme.radius.md,
    paddingVertical: 14,
  },
  urlSubmitBtnDisabled: {
    backgroundColor: theme.colors.dark.surfaceLight,
    borderWidth: 1.5,
    borderColor: theme.colors.dark.border,
  },
  urlSubmitBtnText: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.bold,
    color: '#fff',
  },
  extractErrorBox: {
    backgroundColor: theme.colors.error[500] + '20',
    borderRadius: theme.radius.md,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    marginTop: theme.spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.error[400],
  },
  extractErrorText: {
    color: theme.colors.error[400],
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.regular,
    lineHeight: 17,
  },
  productMetaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.success[500] + '10',
    borderRadius: theme.radius.md,
    padding: 12,
    marginTop: theme.spacing.sm,
    borderWidth: 1.5,
    borderColor: theme.colors.success[400] + '30',
    gap: 12,
  },
  productMetaImage: {
    width: 56,
    height: 56,
    borderRadius: theme.radius.md,
  },
  productMetaInfo: {
    flex: 1,
  },
  productMetaName: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
  },
  productMetaPrice: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.warning[400],
    marginTop: 2,
  },
  productMetaBrand: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    marginTop: 2,
  },
  productMetaCheck: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.colors.success[500] + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryExploreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primary[500] + '15',
    marginTop: theme.spacing.sm,
  },
  categoryExploreText: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.primary[300],
  },
  trendMatchWrap: {
    marginBottom: theme.spacing.md,
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
  renderSummaryCard: {
    backgroundColor: theme.colors.dark.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1.5,
    borderColor: theme.colors.dark.border,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  renderSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  renderSummaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  renderSummaryLabel: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
  },
  renderSummaryValue: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
    flex: 1,
  },
  renderSummaryDivider: {
    height: 1,
    backgroundColor: theme.colors.dark.border,
    marginVertical: 10,
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
  stickyCtaWrap: {
    position: 'absolute',
    left: theme.spacing.lg,
    right: theme.spacing.lg,
    zIndex: 50,
  },
  stickyCtaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: theme.spacing.md + 2,
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.warning[500],
    ...theme.shadows.elevated,
  },
  stickyCtaText: {
    fontSize: 15,
    fontFamily: theme.typography.fontFamily.bold,
    color: '#fff',
  },
});
