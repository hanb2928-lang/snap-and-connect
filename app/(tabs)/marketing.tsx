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
  Dimensions,
} from 'react-native';
import { Megaphone, TrendingUp, Zap, Link2, Flame, Check, Lightbulb, Timer, QrCode, Shuffle, ShoppingBag, Users, Sparkles, ArrowRight, Film, Dna, Tag, Globe, Smartphone, LayoutGrid as Layout, Clock, Type, Music, ChevronDown, Settings, CreditCard as Edit3, Stamp } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { theme } from '@/lib/theme';
import { useSafeTop } from '@/hooks/useSafeTop';
import { useTabBarHeight } from '@/hooks/useTabBarHeight';
import { useI18n } from '@/hooks/useI18n';
import { fetchDashboardSummary, type DashboardSummary } from '@/lib/affiliateDashboard';
import { ErrorRetryBanner } from '@/components/ErrorRetryBanner';
import { friendlyError } from '@/lib/errors';
import { getItem, setItem } from '@/lib/storage';
import { getUserSettings } from '@/lib/settings';
import { ViralProductFeed } from '@/components/ViralProductFeed';
import { TrendMatchCard } from '@/components/TrendMatchCard';
import { QRCodeDisplay } from '@/components/QRCodeDisplay';
import { LinkInBioCard } from '@/components/LinkInBioCard';
import { ClipboardAffiliateBanner } from '@/components/ClipboardAffiliateBanner';
import { validateAffiliateUrl } from '@/lib/affiliate';
import { extractProductMeta } from '@/lib/analysis';
import { getPlatformSpec } from '@/lib/platformSpecs';
import { fetchEnabledPlatforms, type ManagedPlatform } from '@/lib/platformManager';

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

const QUICK_NAV_ITEMS = [
  { key: 'platform', labelKey: 'nav.platform', icon: Smartphone, color: theme.colors.primary[300] },
  { key: 'viral', labelKey: 'nav.viralProduct', icon: Flame, color: theme.colors.warning[400] },
  { key: 'url', labelKey: 'nav.urlInput', icon: Link2, color: theme.colors.accent[400] },
  { key: 'hook', labelKey: 'nav.hook', icon: Zap, color: theme.colors.warning[400] },
  { key: 'ab', labelKey: 'nav.abTest', icon: Dna, color: theme.colors.accent[400] },
  { key: 'render', labelKey: 'nav.render', icon: Film, color: theme.colors.primary[400] },
];

type PipelineStep = 1 | 2 | 3;

const VIDEO_LENGTH_PRESETS = [
  { key: '7s', label: '7초 폭발 바이럴', desc: '틱톡·릴스 최적', icon: Zap, color: theme.colors.warning[400], seconds: 7 },
  { key: '15s', label: '15초 리뷰형', desc: '유튜브 숏츠 최적', icon: Film, color: theme.colors.primary[400], seconds: 15 },
] as const;

const CAPTION_TONE_PRESETS = [
  { key: 'hook', label: '파격 훅', desc: '호기심 유발', icon: Flame, color: theme.colors.warning[400] },
  { key: 'emotional', label: '감성/브랜드', desc: '고급 분위기', icon: Sparkles, color: theme.colors.accent[400] },
  { key: 'info', label: '정보 전달', desc: '리뷰·팩트', icon: Lightbulb, color: theme.colors.primary[400] },
] as const;

const BGM_MOOD_PRESETS = [
  { key: 'pop', label: '트렌디 팝', desc: '빠른 템포', icon: Music, color: theme.colors.accent[400] },
  { key: 'lofi', label: '릴렉스 Lofi', desc: '감성 무드', icon: Music, color: theme.colors.primary[400] },
  { key: 'none', label: '자막 전용', desc: '음성 없음', icon: Type, color: theme.colors.dark.textFaint },
] as const;

export default function MarketingScreen() {
  const router = useRouter();
  const safeTop = useSafeTop();
  const tabBarHeight = useTabBarHeight();
  const { t, isRTL } = useI18n();
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
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [watermarkEnabled, setWatermarkEnabled] = useState(true);
  const [tweakToast, setTweakToast] = useState<string | null>(null);

  // Video style presets
  const [videoLength, setVideoLength] = useState<string>('7s');
  const [captionTone, setCaptionTone] = useState<string>('hook');
  const [bgmMood, setBgmMood] = useState<string>('pop');

  // Step 1: Platform selection state
  const [availablePlatforms, setAvailablePlatforms] = useState<ManagedPlatform[]>([]);
  const [selectedPlatform, setSelectedPlatform] = useState<ManagedPlatform | null>(null);

  // Step 2: Product input & hook state
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

  useEffect(() => {
    (async () => {
      try {
        const settings = await getUserSettings();
        if (settings?.default_caption_tone) {
          const toneMap: Record<string, string> = {
            casual: 'hook',
            professional: 'info',
            emotional: 'emotional',
            humorous: 'hook',
          };
          setCaptionTone(toneMap[settings.default_caption_tone] || 'hook');
        }
        if (settings?.fixed_hook_phrase) {
          await setItem('marketing_fixed_hook', settings.fixed_hook_phrase);
        }
      } catch {
        // settings load failure is non-fatal — keep preset defaults
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const platforms = await fetchEnabledPlatforms();
        setAvailablePlatforms(platforms);
      } catch {
        setAvailablePlatforms([]);
      }
    })();
  }, []);

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

  const handlePlatformSelect = (spec: ManagedPlatform) => {
    setSelectedPlatform(spec);
    setActiveStep(2);
    scrollToSection('viral');
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
      setActiveStep(3);
      scrollToSection('render');
    } catch {
      setProductMeta(null);
      setExtractError('상품 정보를 자동으로 가져오지 못했습니다. 직접 입력하거나 다른 링크를 시도해주세요.');
    } finally {
      setExtracting(false);
    }
  };

  const handleQuickProductSelect = (productName: string) => {
    setSelectedProduct(productName);
    setActiveStep(3);
    scrollToSection('render');
  };

  const handleHookSelect = (hookKey: string) => {
    setSelectedHook(hookKey);
    setActiveStep(3);
    scrollToSection('render');
  };

  const fireTweakToast = useCallback((msg: string) => {
    setTweakToast(msg);
    setTimeout(() => setTweakToast(null), 2000);
  }, []);

  const handleStartGeneration = () => {
    (async () => {
      await setItem('marketing_video_length', videoLength);
      await setItem('marketing_caption_tone', captionTone);
      await setItem('marketing_bgm_mood', bgmMood);
      await setItem('marketing_watermark', watermarkEnabled ? 'true' : 'false');
      try {
        const settings = await getUserSettings();
        if (settings?.brand_persona) {
          await setItem('marketing_brand_persona', settings.brand_persona);
        }
        if (settings?.fixed_hook_phrase) {
          await setItem('marketing_fixed_hook', settings.fixed_hook_phrase);
        }
        if (settings?.affiliate_priority_mapping) {
          await setItem('marketing_affiliate_priority', 'true');
        } else {
          await setItem('marketing_affiliate_priority', 'false');
        }
      } catch {
        // non-fatal
      }
    })();
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
        <View style={[styles.headerIconRow, isRTL && styles.headerIconRowRTL]}>
          <View style={styles.headerIconBox}>
            <Megaphone size={22} color={theme.colors.primary[300]} strokeWidth={2.5} />
          </View>
          <View style={styles.headerTextBox}>
            <Text style={styles.headerTitle}>{t('marketing.title')}</Text>
            <Text style={styles.headerSubtext}>
              {t('marketing.subtitle')}
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
              <Text style={styles.quickNavLabel}>{t(item.labelKey)}</Text>
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
                    {step === 1 ? t('marketing.step.platform') : step === 2 ? t('marketing.step.template') : t('marketing.step.render')}
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
                <Text style={styles.statPillLabel}>{t('marketing.revenue')}</Text>
              </View>
              <View style={styles.statPill}>
                <Link2 size={14} color={theme.colors.primary[400]} strokeWidth={2} />
                <Text style={styles.statPillValue}>{totalClicks}</Text>
                <Text style={styles.statPillLabel}>{t('marketing.clicks')}</Text>
              </View>
              <View style={styles.statPill}>
                <ShoppingBag size={14} color={theme.colors.accent[400]} strokeWidth={2} />
                <Text style={styles.statPillValue}>{totalLinks}</Text>
                <Text style={styles.statPillLabel}>{t('marketing.links')}</Text>
              </View>
            </View>

            {/* ========== STEP 1: Platform Selection ========== */}
            <View
              ref={(ref) => { sectionRefs.current['platform'] = ref; }}
              collapsable={false}
            >
              <View style={styles.phaseBanner}>
                <View style={[styles.phaseNum, { backgroundColor: theme.colors.primary[500] }]}>
                  <Text style={styles.phaseNumText}>1</Text>
                </View>
                <View style={styles.phaseHeaderText}>
                  <Text style={styles.phaseTitle}>{t('marketing.targetPlatform')}</Text>
                  <Text style={styles.phaseDesc}>{t('marketing.targetPlatformDesc')}</Text>
                </View>
              </View>

              <View style={styles.platformGrid}>
                {availablePlatforms.map((spec) => {
                  const selected = selectedPlatform?.key === spec.key;
                  return (
                    <TouchableOpacity
                      key={spec.key}
                      style={[styles.platformCard, selected && { borderColor: spec.color, backgroundColor: spec.color + '12' }]}
                      onPress={() => handlePlatformSelect(spec)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.platformIconBox, { backgroundColor: spec.color + '20' }]}>
                        <Smartphone size={20} color={spec.color} strokeWidth={2.2} />
                      </View>
                      <Text style={styles.platformLabel}>{spec.label}</Text>
                      <Text style={styles.platformRatio}>{spec.ratio}</Text>
                      {selected && (
                        <View style={[styles.platformCheck, { backgroundColor: spec.color }]}>
                          <Check size={12} color="#fff" strokeWidth={2.5} />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Safe Zone Preview */}
              {selectedPlatform && (() => {
                const spec = selectedPlatform;
                const previewH = 160;
                const previewW = previewH * (spec.width / spec.height);
                const scale = previewH / spec.height;
                const szTop = spec.safeZoneTop * scale;
                const szBottom = spec.safeZoneBottom * scale;
                const szSide = spec.safeZoneSides * scale;
                return (
                  <View style={styles.safeZoneCard}>
                    <View style={styles.safeZoneHeader}>
                      <Layout size={16} color={spec.color} strokeWidth={2} />
                      <Text style={styles.safeZoneTitle}>{spec.label} {t('marketing.safeZonePreview')}</Text>
                    </View>
                    <View style={styles.safeZonePreviewRow}>
                      <View style={[styles.safeZoneFrame, { width: previewW, height: previewH }]}>
                        <View style={[styles.safeZoneDanger, {
                          top: 0, left: 0, right: 0, height: szTop,
                        }]} />
                        <View style={[styles.safeZoneDanger, {
                          bottom: 0, left: 0, right: 0, height: szBottom,
                        }]} />
                        <View style={[styles.safeZoneDanger, {
                          top: szTop, bottom: szBottom, left: 0, width: szSide,
                        }]} />
                        <View style={[styles.safeZoneDanger, {
                          top: szTop, bottom: szBottom, right: 0, width: szSide,
                        }]} />
                        <View style={[styles.safeZoneSafe, {
                          top: szTop, bottom: szBottom, left: szSide, right: szSide,
                        }]} />
                      </View>
                      <View style={styles.safeZoneInfo}>
                        <Text style={styles.safeZoneInfoTitle}>{t('marketing.aspectRatio')} {spec.ratio}</Text>
                        <Text style={styles.safeZoneInfoDesc}>{spec.desc}</Text>
                        <Text style={styles.safeZoneInfoDim}>{spec.width}×{spec.height}px</Text>
                      </View>
                    </View>
                  </View>
                );
              })()}
            </View>

            {/* ========== STEP 2: Template & Hook Selection ========== */}
            <View
              ref={(ref) => { sectionRefs.current['viral'] = ref; }}
              collapsable={false}
            >
              <View style={styles.phaseBanner}>
                <View style={[styles.phaseNum, { backgroundColor: theme.colors.warning[500] }]}>
                  <Text style={styles.phaseNumText}>2</Text>
                </View>
                <View style={styles.phaseHeaderText}>
                  <Text style={styles.phaseTitle}>{t('marketing.templateHook')}</Text>
                  <Text style={styles.phaseDesc}>
                    {selectedPlatform
                      ? `${selectedPlatform.label} · ${selectedPlatform.ratio} ${t('marketing.templateForRatio')}`
                      : t('marketing.selectPlatformFirst')}
                  </Text>
                </View>
              </View>

              {/* Track 1a: Viral Products */}
              <View style={styles.trackCard}>
                <View style={styles.trackCardHeader}>
                  <View style={[styles.trackIconSmall, { backgroundColor: theme.colors.warning[500] + '22' }]}>
                    <Flame size={20} color={theme.colors.warning[400]} strokeWidth={2} />
                  </View>
                  <View style={styles.trackCardInfo}>
                    <Text style={styles.trackCardTitle}>{t('marketing.viralTop20')}</Text>
                    <Text style={styles.trackCardDesc}>{t('marketing.viralTop20Desc')}</Text>
                  </View>
                  <View style={[styles.beginnerBadge, { backgroundColor: theme.colors.warning[500] + '18' }]}>
                    <Text style={[styles.beginnerBadgeText, { color: theme.colors.warning[400] }]}>{t('marketing.recommendedTrack')}</Text>
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
                      <Text style={styles.trackCardTitle}>{t('marketing.urlDirectInput')}</Text>
                      <Text style={styles.trackCardDesc}>{t('marketing.urlDirectInputDesc')}</Text>
                    </View>
                    <View style={[styles.beginnerBadge, { backgroundColor: theme.colors.accent[500] + '18' }]}>
                      <Text style={[styles.beginnerBadgeText, { color: theme.colors.accent[300] }]}>{t('marketing.manualTrack')}</Text>
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
                    placeholder={t('marketing.urlPlaceholder')}
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
                      {extracting ? t('marketing.extracting') : t('marketing.extractBtn')}
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
                      <Text style={styles.trackCardTitle}>{t('marketing.categoryCatalog')}</Text>
                      <Text style={styles.trackCardDesc}>{t('marketing.categoryCatalogDesc')}</Text>
                    </View>
                    <View style={[styles.beginnerBadge, { backgroundColor: theme.colors.primary[500] + '18' }]}>
                      <Text style={[styles.beginnerBadgeText, { color: theme.colors.primary[300] }]}>{t('marketing.exploreTrack')}</Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.categoryExploreBtn}
                    onPress={() => router.push('/affiliate/trending' as never)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.categoryExploreText}>{t('marketing.categoryExplore')}</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.trendMatchWrap}>
                  <TrendMatchCard productCategory="라이프스타일" />
                </View>
              </View>
            </View>

            {/* ========== (Step 2 continued: Hook & Strategy) ========== */}
            <View
              ref={(ref) => { sectionRefs.current['hook'] = ref; }}
              collapsable={false}
            >
              {/* 2a: Hook Studio */}
              <View style={styles.sectionHeader}>
                <View style={styles.sectionHeaderLeft}>
                  <Flame size={20} color={theme.colors.warning[400]} strokeWidth={2.5} />
                  <Text style={styles.sectionTitleText}>{t('marketing.hookStudio')}</Text>
                </View>
              </View>
              <Text style={styles.sectionDesc}>{t('marketing.hookStudioDesc')}</Text>
              <View style={[styles.beginnerBadge, { backgroundColor: theme.colors.warning[500] + '18' }]}>
                <Text style={[styles.beginnerBadgeText, { color: theme.colors.warning[400] }]}>{t('marketing.hookFlowBadge')}</Text>
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

              {/* 2a-2: Video Style Presets — Collapsible Advanced Options */}
              <View style={styles.presetSection}>
                <TouchableOpacity
                  style={styles.advancedToggle}
                  onPress={() => setShowAdvancedOptions(!showAdvancedOptions)}
                  activeOpacity={0.7}
                >
                  <View style={styles.advancedToggleLeft}>
                    <View style={styles.advancedToggleIcon}>
                      <Settings size={16} color={theme.colors.primary[400]} strokeWidth={2} />
                    </View>
                    <View>
                      <Text style={styles.advancedToggleTitle}>{t('marketing.advancedOptions')}</Text>
                      <Text style={styles.advancedToggleDesc}>{t('marketing.advancedOptionsDesc')}</Text>
                    </View>
                  </View>
                  <ChevronDown
                    size={20}
                    color={theme.colors.dark.textDim}
                    strokeWidth={2}
                    style={{ transform: [{ rotate: showAdvancedOptions ? '180deg' : '0deg' }] }}
                  />
                </TouchableOpacity>

                {showAdvancedOptions && (
                  <>
                    {/* Video Length */}
                    <View style={styles.presetGroup}>
                      <View style={styles.presetLabelRow}>
                        <Clock size={14} color={theme.colors.warning[400]} strokeWidth={2} />
                        <Text style={styles.presetLabel}>{t('marketing.presetLength')}</Text>
                      </View>
                      <View style={styles.chipRow}>
                        {VIDEO_LENGTH_PRESETS.map((preset) => {
                          const Icon = preset.icon;
                          const selected = videoLength === preset.key;
                          return (
                            <TouchableOpacity
                              key={preset.key}
                              style={[styles.chipPill, selected && { borderColor: preset.color, backgroundColor: preset.color + '15' }]}
                              onPress={() => setVideoLength(preset.key)}
                              activeOpacity={0.7}
                            >
                              <Icon size={14} color={selected ? preset.color : theme.colors.dark.textDim} strokeWidth={2} />
                              <Text style={[styles.chipPillLabel, selected && { color: preset.color }]}>{preset.label}</Text>
                              <Text style={styles.chipPillDesc}>{preset.desc}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>

                    {/* Caption Tone */}
                    <View style={styles.presetGroup}>
                      <View style={styles.presetLabelRow}>
                        <Type size={14} color={theme.colors.accent[400]} strokeWidth={2} />
                        <Text style={styles.presetLabel}>{t('marketing.presetTone')}</Text>
                      </View>
                      <View style={styles.chipRow}>
                        {CAPTION_TONE_PRESETS.map((preset) => {
                          const Icon = preset.icon;
                          const selected = captionTone === preset.key;
                          return (
                            <TouchableOpacity
                              key={preset.key}
                              style={[styles.chipPill, selected && { borderColor: preset.color, backgroundColor: preset.color + '15' }]}
                              onPress={() => setCaptionTone(preset.key)}
                              activeOpacity={0.7}
                            >
                              <Icon size={14} color={selected ? preset.color : theme.colors.dark.textDim} strokeWidth={2} />
                              <Text style={[styles.chipPillLabel, selected && { color: preset.color }]}>{preset.label}</Text>
                              <Text style={styles.chipPillDesc}>{preset.desc}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>

                    {/* BGM Mood */}
                    <View style={styles.presetGroup}>
                      <View style={styles.presetLabelRow}>
                        <Music size={14} color={theme.colors.primary[400]} strokeWidth={2} />
                        <Text style={styles.presetLabel}>{t('marketing.presetBgm')}</Text>
                      </View>
                      <View style={styles.chipRow}>
                        {BGM_MOOD_PRESETS.map((preset) => {
                          const Icon = preset.icon;
                          const selected = bgmMood === preset.key;
                          return (
                            <TouchableOpacity
                              key={preset.key}
                              style={[styles.chipPill, selected && { borderColor: preset.color, backgroundColor: preset.color + '15' }]}
                              onPress={() => setBgmMood(preset.key)}
                              activeOpacity={0.7}
                            >
                              <Icon size={14} color={selected ? preset.color : theme.colors.dark.textDim} strokeWidth={2} />
                              <Text style={[styles.chipPillLabel, selected && { color: preset.color }]}>{preset.label}</Text>
                              <Text style={styles.chipPillDesc}>{preset.desc}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  </>
                )}
              </View>

              {/* 2b: A/B Persona Tones */}
              <View
                ref={(ref) => { sectionRefs.current['ab'] = ref; }}
                collapsable={false}
              >
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionHeaderLeft}>
                    <Users size={20} color={theme.colors.accent[400]} strokeWidth={2.5} />
                    <Text style={styles.sectionTitleText}>{t('marketing.abPersona')}</Text>
                  </View>
                </View>
                <Text style={styles.sectionDesc}>{t('marketing.abPersonaDesc')}</Text>
                <View style={[styles.beginnerBadge, { backgroundColor: theme.colors.accent[500] + '18' }]}>
                  <Text style={[styles.beginnerBadgeText, { color: theme.colors.accent[300] }]}>{t('marketing.abBadge')}</Text>
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
                        <Text style={[styles.personaGenText, { color: tone.color }]}>{t('marketing.generate')}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* 2c: Trending Keywords & CTA */}
              <View style={styles.sectionHeader}>
                <View style={styles.sectionHeaderLeft}>
                  <TrendingUp size={20} color={theme.colors.primary[400]} strokeWidth={2.5} />
                  <Text style={styles.sectionTitleText}>{t('marketing.trendingKeywords')}</Text>
                </View>
                <TouchableOpacity onPress={shuffleTags} activeOpacity={0.7} style={styles.shuffleBtn}>
                  <Shuffle size={14} color={theme.colors.primary[300]} strokeWidth={2} />
                  <Text style={styles.shuffleBtnText}>{t('marketing.shuffle')}</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.sectionDesc}>{t('marketing.trendingDesc')}</Text>
              <View style={[styles.beginnerBadge, { backgroundColor: theme.colors.primary[500] + '18' }]}>
                <Text style={[styles.beginnerBadgeText, { color: theme.colors.primary[300] }]}>{t('marketing.hashtagBadge')}</Text>
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
                  <Text style={styles.sectionTitleText}>{t('marketing.smartCta')}</Text>
                </View>
              </View>
              <Text style={styles.sectionDesc}>{t('marketing.smartCtaDesc')}</Text>
              <View style={[styles.beginnerBadge, { backgroundColor: theme.colors.success[500] + '18' }]}>
                <Text style={[styles.beginnerBadgeText, { color: theme.colors.success[400] }]}>{t('marketing.qrBadge')}</Text>
              </View>

              <View style={styles.countdownCard}>
                <View style={styles.countdownHeader}>
                  <Timer size={18} color={theme.colors.warning[400]} strokeWidth={2.2} />
                  <Text style={styles.countdownTitle}>{t('marketing.countdown')}</Text>
                </View>
                <Text style={styles.countdownTimer}>{formatCountdown(countdownSeconds)}</Text>
                <Text style={styles.countdownDesc}>
                  {t('marketing.countdownDesc')}
                </Text>
                <TouchableOpacity
                  style={styles.countdownResetBtn}
                  onPress={() => setCountdownSeconds(3600)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.countdownResetText}>{t('marketing.countdownReset')}</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.qrCard}>
                <View style={styles.qrHeader}>
                  <QrCode size={18} color={theme.colors.primary[400]} strokeWidth={2.2} />
                  <Text style={styles.qrTitle}>{t('marketing.qrWatermark')}</Text>
                </View>
                <View style={styles.qrDisplayWrap}>
                  <QRCodeDisplay value={qrValue} size={140} />
                </View>
                <Text style={styles.qrDesc}>
                  {t('marketing.qrDesc')}
                </Text>
                <TouchableOpacity
                  style={styles.qrEditBtn}
                  onPress={() => router.push('/affiliate/links' as never)}
                  activeOpacity={0.7}
                >
                  <Link2 size={14} color={theme.colors.primary[300]} strokeWidth={2} />
                  <Text style={styles.qrEditText}>{t('marketing.qrEditLink')}</Text>
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
                  <Text style={styles.phaseTitle}>{t('marketing.renderTitle')}</Text>
                  <Text style={styles.phaseDesc}>
                    {selectedHook ? t('marketing.renderHookReady') : t('marketing.renderHookPending')}
                  </Text>
                </View>
              </View>

              <View style={styles.renderSummaryCard}>
                {selectedPlatform && (() => {
                  const spec = selectedPlatform;
                  return (
                    <>
                      <View style={styles.renderSummaryRow}>
                        <View style={styles.renderSummaryItem}>
                          <Smartphone size={16} color={spec.color} strokeWidth={2} />
                          <Text style={styles.renderSummaryLabel}>{t('marketing.renderPlatform')}</Text>
                          <Text style={styles.renderSummaryValue} numberOfLines={1}>
                            {spec.label} · {spec.ratio}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.renderSummaryDivider} />
                    </>
                  );
                })()}
                <View style={styles.renderSummaryRow}>
                  <View style={styles.renderSummaryItem}>
                    <ShoppingBag size={16} color={theme.colors.warning[400]} strokeWidth={2} />
                    <Text style={styles.renderSummaryLabel}>{t('marketing.renderProduct')}</Text>
                    <Text style={styles.renderSummaryValue} numberOfLines={1}>
                      {selectedProduct || t('marketing.notSelected')}
                    </Text>
                  </View>
                </View>
                <View style={styles.renderSummaryDivider} />
                <View style={styles.renderSummaryRow}>
                  <View style={styles.renderSummaryItem}>
                    <Zap size={16} color={theme.colors.accent[400]} strokeWidth={2} />
                    <Text style={styles.renderSummaryLabel}>{t('marketing.renderHook')}</Text>
                    <Text style={styles.renderSummaryValue} numberOfLines={1}>
                      {selectedHook ? HOOK_TYPES.find((h) => h.key === selectedHook)?.label : t('marketing.notSelected')}
                    </Text>
                  </View>
                </View>
                <View style={styles.renderSummaryDivider} />
                <View style={styles.renderSummaryRow}>
                  <View style={styles.renderSummaryItem}>
                    <Clock size={16} color={theme.colors.warning[400]} strokeWidth={2} />
                    <Text style={styles.renderSummaryLabel}>{t('marketing.presetLength')}</Text>
                    <Text style={styles.renderSummaryValue} numberOfLines={1}>
                      {VIDEO_LENGTH_PRESETS.find((p) => p.key === videoLength)?.label || t('marketing.notSelected')}
                    </Text>
                  </View>
                </View>
                <View style={styles.renderSummaryDivider} />
                <View style={styles.renderSummaryRow}>
                  <View style={styles.renderSummaryItem}>
                    <Type size={16} color={theme.colors.accent[400]} strokeWidth={2} />
                    <Text style={styles.renderSummaryLabel}>{t('marketing.presetTone')}</Text>
                    <Text style={styles.renderSummaryValue} numberOfLines={1}>
                      {CAPTION_TONE_PRESETS.find((p) => p.key === captionTone)?.label || t('marketing.notSelected')}
                    </Text>
                  </View>
                </View>
                <View style={styles.renderSummaryDivider} />
                <View style={styles.renderSummaryRow}>
                  <View style={styles.renderSummaryItem}>
                    <Music size={16} color={theme.colors.primary[400]} strokeWidth={2} />
                    <Text style={styles.renderSummaryLabel}>{t('marketing.presetBgm')}</Text>
                    <Text style={styles.renderSummaryValue} numberOfLines={1}>
                      {BGM_MOOD_PRESETS.find((p) => p.key === bgmMood)?.label || t('marketing.notSelected')}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Quick-Tweak Bar — instant adjustments after render */}
              {selectedPlatform && selectedProduct && (
                <View style={styles.quickTweakBar}>
                  <Text style={styles.quickTweakTitle}>{t('marketing.quickTweak')}</Text>
                  <View style={styles.quickTweakRow}>
                    <TouchableOpacity
                      style={styles.quickTweakBtn}
                      onPress={() => {
                        setShowAdvancedOptions(true);
                        scrollToSection('hook');
                        fireTweakToast(t('marketing.tweakCaption'));
                      }}
                      activeOpacity={0.7}
                    >
                      <Edit3 size={16} color={theme.colors.accent[400]} strokeWidth={2} />
                      <Text style={styles.quickTweakBtnText}>{t('marketing.tweakCaption')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.quickTweakBtn}
                      onPress={() => {
                        setShowAdvancedOptions(true);
                        scrollToSection('hook');
                        fireTweakToast(t('marketing.tweakBgm'));
                      }}
                      activeOpacity={0.7}
                    >
                      <Music size={16} color={theme.colors.primary[400]} strokeWidth={2} />
                      <Text style={styles.quickTweakBtnText}>{t('marketing.tweakBgm')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.quickTweakBtn, watermarkEnabled && styles.quickTweakBtnActive]}
                      onPress={() => {
                        setWatermarkEnabled(!watermarkEnabled);
                        fireTweakToast(`${t('marketing.tweakWatermark')} ${watermarkEnabled ? t('marketing.tweakWatermarkOff') : t('marketing.tweakWatermarkOn')}`);
                      }}
                      activeOpacity={0.7}
                    >
                      <Stamp size={16} color={watermarkEnabled ? theme.colors.success[400] : theme.colors.dark.textDim} strokeWidth={2} />
                      <Text style={[styles.quickTweakBtnText, watermarkEnabled && styles.quickTweakBtnTextActive]}>
                        {t('marketing.tweakWatermark')} {watermarkEnabled ? t('marketing.tweakWatermarkOn') : t('marketing.tweakWatermarkOff')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Tweak toast */}
              {tweakToast && (
                <View style={styles.tweakToast}>
                  <Check size={14} color={theme.colors.success[400]} strokeWidth={2.5} />
                  <Text style={styles.tweakToastText}>{tweakToast}</Text>
                </View>
              )}
            </View>
            <View style={styles.divider} />
            <Text style={styles.toolsSectionTitle}>{t('marketing.allTools')}</Text>
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
                  <Text style={styles.toolLabel}>{t('marketing.toolLinkMgmt')}</Text>
                  <Text style={styles.toolDesc} numberOfLines={2}>{t('marketing.toolLinkMgmtDesc')}</Text>
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
                  <Text style={styles.toolLabel}>{t('marketing.toolShortLink')}</Text>
                  <Text style={styles.toolDesc} numberOfLines={2}>{t('marketing.toolShortLinkDesc')}</Text>
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
                  <Text style={styles.toolLabel}>{t('marketing.toolScheduler')}</Text>
                  <Text style={styles.toolDesc} numberOfLines={2}>{t('marketing.toolSchedulerDesc')}</Text>
                </View>
                <ArrowRight size={16} color={theme.colors.dark.textFaint} strokeWidth={2} />
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>

      {/* Sticky Floating CTA — appears when platform + product + hook selected */}
      {selectedPlatform && selectedProduct && selectedHook && (
        <View style={[styles.stickyCtaWrap, { bottom: tabBarHeight + theme.spacing.sm }]}>
          <TouchableOpacity
            style={styles.stickyCtaBtn}
            onPress={handleStartGeneration}
            activeOpacity={0.85}
          >
            <Film size={24} color="#fff" strokeWidth={2.5} />
            <Text style={styles.stickyCtaText}>{t('marketing.stickyCta')}</Text>
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
  headerIconRowRTL: {
    flexDirection: 'row-reverse',
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
  platformGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: theme.spacing.md,
  },
  platformCard: {
    width: (screenWidth - theme.spacing.lg * 2 - 16) / 3,
    backgroundColor: theme.colors.dark.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1.5,
    borderColor: theme.colors.dark.border,
    padding: 12,
    alignItems: 'center',
    gap: 6,
  },
  platformIconBox: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  platformLabel: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
  },
  platformRatio: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
  },
  platformCheck: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  safeZoneCard: {
    backgroundColor: theme.colors.dark.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1.5,
    borderColor: theme.colors.dark.border,
    padding: 16,
    marginBottom: theme.spacing.md,
    gap: 12,
  },
  safeZoneHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  safeZoneTitle: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
  },
  safeZonePreviewRow: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  safeZoneFrame: {
    backgroundColor: theme.colors.dark.surfaceLight,
    borderRadius: 8,
    position: 'relative',
    overflow: 'hidden',
  },
  safeZoneDanger: {
    position: 'absolute',
    backgroundColor: theme.colors.error[500] + '25',
  },
  safeZoneSafe: {
    position: 'absolute',
    backgroundColor: theme.colors.success[500] + '20',
    borderWidth: 1.5,
    borderColor: theme.colors.success[400] + '50',
    borderRadius: 4,
  },
  safeZoneInfo: {
    flex: 1,
    gap: 4,
  },
  safeZoneInfoTitle: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.dark.text,
  },
  safeZoneInfoDesc: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    lineHeight: 15,
  },
  safeZoneInfoDim: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.primary[300],
    marginTop: 2,
  },
  presetSection: {
    marginBottom: theme.spacing.md,
  },
  presetGroup: {
    marginBottom: theme.spacing.sm + 2,
  },
  presetLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  presetLabel: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 6,
  },
  chipPill: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.dark.surface,
    borderWidth: 1.5,
    borderColor: theme.colors.dark.border,
    gap: 3,
  },
  chipPillLabel: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
    textAlign: 'center',
  },
  chipPillDesc: {
    fontSize: 9,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textFaint,
  },
  advancedToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.dark.surface,
    borderWidth: 1.5,
    borderColor: theme.colors.dark.border,
  },
  advancedToggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  advancedToggleIcon: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primary[500] + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  advancedToggleTitle: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
  },
  advancedToggleDesc: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    marginTop: 2,
  },
  quickTweakBar: {
    backgroundColor: theme.colors.dark.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1.5,
    borderColor: theme.colors.primary[400] + '30',
    padding: 14,
    marginBottom: theme.spacing.md,
    gap: 10,
  },
  quickTweakTitle: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.primary[300],
  },
  quickTweakRow: {
    flexDirection: 'row',
    gap: 8,
  },
  quickTweakBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.dark.surfaceLight,
    borderWidth: 1.5,
    borderColor: theme.colors.dark.border,
  },
  quickTweakBtnActive: {
    borderColor: theme.colors.success[400],
    backgroundColor: theme.colors.success[500] + '12',
  },
  quickTweakBtnText: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.textDim,
    textAlign: 'center',
  },
  quickTweakBtnTextActive: {
    color: theme.colors.success[400],
  },
  tweakToast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.success[500] + '15',
    borderWidth: 1,
    borderColor: theme.colors.success[400] + '30',
    marginBottom: theme.spacing.md,
    alignSelf: 'center',
  },
  tweakToastText: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.success[400],
  },
});
