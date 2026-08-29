import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'expo-router';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
  Linking,
  TextInput,
  Alert,
  Modal,
  KeyboardAvoidingView,
} from 'react-native';
import { Camera, Sparkles, Info, ExternalLink, Link2, Check, Zap, ChevronDown, ChevronRight, Wallet, Plus, Trash2, Film, LayoutTemplate, BookOpen, Stamp, Upload, Key, Eye, EyeOff, Crown, Rocket, Building2, Coins, CircleDot, Baby, Activity, Sun, Palette, Smartphone, Layers, Wifi, Circle as XCircle, TriangleAlert as AlertTriangle, Play, Target, X } from 'lucide-react-native';
import { theme } from '@/lib/theme';
import { getItem, setItem } from '@/lib/storage';
import { getUserSettings, updateUserSettings } from '@/lib/settings';
import { uploadAssetBlob } from '@/lib/savedAssets';
import { clearLogoCache } from '@/lib/logoWatermark';
import { TTS_VOICES, DEFAULT_TTS_VOICE } from '@/lib/ttsVoices';
import { SUBSCRIPTION_PLANS, TOKEN_PACKS, formatKRW as formatPlanKRW } from '@/lib/subscriptionPlans';
import type { UserSettings, RevenueRecord } from '@/types/database';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { addRevenueRecord, fetchRevenueRecords, deleteRevenueRecord } from '@/lib/revenue';
import { formatKRW } from '@/lib/dashboard';
import { useMascotSettings, type MascotStyle } from '@/hooks/useMascotSettings';
import { invalidateSettingsCache, updateUserSettings as persistUserSettings } from '@/lib/settings';
import { useI18n } from '@/hooks/useI18n';
import { SUPPORTED_LANGUAGES, type AppLanguage } from '@/lib/i18n';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { t, language, setLanguage } = useI18n();
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const [coupangId, setCoupangId] = useState('');
  const [naverId, setNaverId] = useState('');
  const [tossId, setTossId] = useState('');
  const [savingIds, setSavingIds] = useState(false);
  const [savedIds, setSavedIds] = useState(false);

  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);

  const [revenues, setRevenues] = useState<RevenueRecord[]>([]);
  const [revModalVisible, setRevModalVisible] = useState(false);
  const [revPlatform, setRevPlatform] = useState('Coupang');
  const [revAmount, setRevAmount] = useState('');
  const [revMonth, setRevMonth] = useState(new Date().toISOString().slice(0, 7));
  const [revNote, setRevNote] = useState('');
  const [revSaving, setRevSaving] = useState(false);
  const [openaiKey, setOpenaiKey] = useState('');
  const [savingKey, setSavingKey] = useState(false);
  const [savedKey, setSavedKey] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const mascot = useMascotSettings();
  const [savingMascot, setSavingMascot] = useState(false);
  const [savedMascot, setSavedMascot] = useState(false);
  const [defaultVideoDuration, setDefaultVideoDuration] = useState('15s');
  const [defaultTtsVoice, setDefaultTtsVoice] = useState(DEFAULT_TTS_VOICE);
  const [ttsSpeed, setTtsSpeed] = useState(1.0);
  const [ttsPitch, setTtsPitch] = useState(0);
  const [progressStyle, setProgressStyle] = useState<'circular' | 'baby-run' | 'status-bar'>('circular');
  const [autoDisclosure, setAutoDisclosure] = useState(true);
  const [captureGuideMode, setCaptureGuideMode] = useState<'beginner' | 'pro'>('beginner');
  const [uiPerformance, setUiPerformance] = useState<'high' | 'lite'>('high');
  const [themeMode, setThemeMode] = useState<'dark' | 'light'>('dark');
  const [displayDensity, setDisplayDensity] = useState<'compact' | 'standard' | 'wide'>('standard');
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [savedPrefs, setSavedPrefs] = useState(false);
  const [savingDefaults, setSavingDefaults] = useState(false);
  const [savedDefaults, setSavedDefaults] = useState(false);
  const [brandPersona, setBrandPersona] = useState('');
  const [savingPersona, setSavingPersona] = useState(false);
  const [savedPersona, setSavedPersona] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<'basic' | 'pro' | 'business'>('pro');
  const [showTokenPacks, setShowTokenPacks] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);
  const [tutorialLinkInput, setTutorialLinkInput] = useState('');
  const router = useRouter();

  const loadSettings = useCallback(async () => {
    try {
      const data = await getUserSettings();
      setSettings(data);
      setCoupangId(data?.coupang_partners_id || '');
      setNaverId(data?.naver_shopping_id || '');
      setTossId(data?.toss_share_id || '');
      setLogoUrl(data?.logo_url || null);
      setOpenaiKey(data?.openai_api_key || '');
      setDefaultVideoDuration(data?.default_video_duration || '15s');
      setDefaultTtsVoice(data?.default_tts_voice || DEFAULT_TTS_VOICE);
      setTtsSpeed(data?.tts_speed ?? 1.0);
      setTtsPitch(data?.tts_pitch ?? 0);
      setProgressStyle((data?.progress_style as 'circular' | 'baby-run' | 'status-bar') || 'circular');
      setAutoDisclosure(data?.auto_disclosure ?? true);
      setCaptureGuideMode((data?.capture_guide_mode as 'beginner' | 'pro') || 'beginner');
      setUiPerformance((data?.ui_performance as 'high' | 'lite') || 'high');
      setThemeMode((data?.theme_mode as 'dark' | 'light') || 'dark');
      setDisplayDensity((data?.display_density as 'compact' | 'standard' | 'wide') || 'standard');
      setBrandPersona(data?.brand_persona || '');
    } catch {
      setSettings(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadRevenues = useCallback(async () => {
    try {
      const data = await fetchRevenueRecords(20);
      setRevenues(data);
    } catch {
      setRevenues([]);
    }
  }, []);

  useEffect(() => {
    loadSettings();
    loadRevenues();
  }, [loadSettings, loadRevenues]);

  const handleSaveIds = async () => {
    setSavingIds(true);
    setSavedIds(false);
    try {
      await updateUserSettings({
        coupang_partners_id: coupangId || null,
        naver_shopping_id: naverId || null,
        toss_share_id: tossId || null,
      });
      setSavedIds(true);
      setTimeout(() => setSavedIds(false), 2500);
    } catch (err) {
      Alert.alert('저장 실패', err instanceof Error ? err.message : '알 수 없는 오류');
    }
    setSavingIds(false);
  };

  const handleUploadLogo = async () => {
    if (Platform.OS !== 'web') {
      Alert.alert('안내', '로고 업로드는 웹에서 지원됩니다. 곧 모바일도 지원될 예정이에요');
      return;
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png,image/jpeg';
    input.onchange = async (e: any) => {
      const file = e.target?.files?.[0];
      if (!file) return;
      if (file.size > 2 * 1024 * 1024) {
        Alert.alert('파일 크기', '로고 이미지는 2MB 이하의 PNG 또는 JPG 파일을 사용해주세요');
        return;
      }
      setLogoUploading(true);
      try {
        const fileName = `logo-${Date.now()}.png`;
        const fileUrl = await uploadAssetBlob(file, fileName, file.type || 'image/png');
        if (!fileUrl) {
          Alert.alert('업로드 실패', '이미지 업로드에 실패했어요. 다시 시도해주세요');
          setLogoUploading(false);
          return;
        }
        await updateUserSettings({ logo_url: fileUrl });
        setLogoUrl(fileUrl);
        clearLogoCache();
      } catch {
        Alert.alert('업로드 실패', '로고 업로드 중 오류가 발생했어요');
      }
      setLogoUploading(false);
    };
    input.click();
  };

  const handleRemoveLogo = async () => {
    Alert.alert('로고 삭제', '등록된 로고를 삭제하시겠어요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          try {
            await updateUserSettings({ logo_url: null });
            setLogoUrl(null);
            clearLogoCache();
          } catch {
            Alert.alert('오류', '로고 삭제 중 오류가 발생했어요');
          }
        },
      },
    ]);
  };

  const handleSaveRevenue = async () => {
    const amount = parseInt(revAmount, 10);
    if (!amount || amount <= 0) {
      Alert.alert('입력 오류', '수익 금액을 정확히 입력해주세요');
      return;
    }
    setRevSaving(true);
    try {
      await addRevenueRecord(revPlatform, amount, revMonth, revNote || undefined);
      setRevModalVisible(false);
      setRevAmount('');
      setRevNote('');
      await loadRevenues();
    } catch (err) {
      Alert.alert('저장 실패', err instanceof Error ? err.message : '알 수 없는 오류');
    }
    setRevSaving(false);
  };

  const handleDeleteRevenue = (id: string) => {
    Alert.alert('삭제', '이 수익 기록을 삭제하시겠어요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteRevenueRecord(id);
            await loadRevenues();
          } catch (err) {
            Alert.alert('삭제 실패', err instanceof Error ? err.message : '오류');
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary[400]} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24, paddingTop: 16 }]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      {/* API Health Check Badges */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>API 연동 상태</Text>
        <View style={styles.healthCheckRow}>
          {[
            { label: '쿠팡', value: coupangId, color: '#FF3E3E', icon: 'C' },
            { label: '네이버', value: naverId, color: '#03C75A', icon: 'N' },
            { label: '토스', value: tossId, color: '#0064FF', icon: 'T' },
            { label: 'OpenAI', value: openaiKey, color: theme.colors.primary[400], icon: 'AI' },
          ].map((item, i) => {
            const isSet = item.value && item.value.trim().length > 0;
            return (
              <View key={i} style={[styles.healthBadge, isSet ? styles.healthBadgeOk : styles.healthBadgeErr]}>
                <View style={[styles.healthBadgeIcon, { backgroundColor: isSet ? item.color + '20' : theme.colors.dark.surfaceLight }]}>
                  {isSet ? (
                    <Check size={12} color={item.color} strokeWidth={2.5} />
                  ) : (
                    <XCircle size={12} color={theme.colors.error[400]} strokeWidth={2} />
                  )}
                </View>
                <Text style={[styles.healthBadgeLabel, isSet ? { color: theme.colors.dark.text } : { color: theme.colors.dark.textDim }]}>
                  {item.label}
                </Text>
                <Text style={[styles.healthBadgeStatus, isSet ? styles.healthBadgeStatusOk : styles.healthBadgeStatusErr]}>
                  {isSet ? '연결됨' : '미설정'}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* Interactive Onboarding Tutorial */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>신규 유저 튜토리얼</Text>
        <Text style={styles.sectionDesc}>
          가상 상품 데이터로 15초 만에 '링크 입력 ➔ AI 숏폼 ➔ 공정위 문구 완성'을 직접 체험해 볼 수 있어요
        </Text>
        <TouchableOpacity
          style={styles.tutorialBtn}
          onPress={() => setTutorialStep(1)}
          activeOpacity={0.8}
        >
          <Play size={18} color="#fff" strokeWidth={2} />
          <Text style={styles.tutorialBtnText}>튜토리얼 시작하기</Text>
        </TouchableOpacity>
      </View>

      {/* Tutorial Modal */}
      <Modal
        visible={tutorialStep > 0}
        transparent
        animationType="fade"
        onRequestClose={() => setTutorialStep(0)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.tutorialModalContent}>
            <TouchableOpacity
              style={styles.modalClose}
              onPress={() => setTutorialStep(0)}
              activeOpacity={0.7}
            >
              <X size={20} color={theme.colors.dark.text} strokeWidth={2} />
            </TouchableOpacity>

            {tutorialStep === 1 && (
              <View style={styles.tutorialStepWrap}>
                <View style={styles.tutorialStepIndicator}>
                  <View style={[styles.tutorialDot, styles.tutorialDotActive]} />
                  <View style={styles.tutorialDot} />
                  <View style={styles.tutorialDot} />
                </View>
                <View style={styles.tutorialIconWrap}>
                  <Link2 size={32} color={theme.colors.primary[400]} strokeWidth={2} />
                </View>
                <Text style={styles.tutorialStepTitle}>1단계: 제휴 링크 입력</Text>
                <Text style={styles.tutorialStepDesc}>
                  가상 상품 '무선 블루투스 이어폰'의 제휴 링크를 입력해보세요. 쿠팡 파트너스 링크를 자동으로 생성하거나 직접 입력할 수 있어요.
                </Text>
                <View style={styles.tutorialMockCard}>
                  <Text style={styles.tutorialMockLabel}>가상 상품</Text>
                  <Text style={styles.tutorialMockProduct}>무선 블루투스 이어폰</Text>
                  <Text style={styles.tutorialMockPrice}>예상가 ₩29,900</Text>
                  <View style={styles.tutorialMockLinkRow}>
                    <TextInput
                      style={styles.tutorialMockInput}
                      value={tutorialLinkInput}
                      onChangeText={setTutorialLinkInput}
                      placeholder="https://coupang.com/..."
                      placeholderTextColor={theme.colors.dark.textFaint}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    <TouchableOpacity
                      style={styles.tutorialMockBtn}
                      onPress={() => {
                        if (!tutorialLinkInput.trim()) {
                          setTutorialLinkInput('https://coupang.com/p/1234567?ref=affiliate');
                        }
                        setTutorialStep(2);
                      }}
                      activeOpacity={0.7}
                    >
                      <Check size={16} color="#fff" strokeWidth={2} />
                    </TouchableOpacity>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.tutorialNextBtn}
                  onPress={() => setTutorialStep(2)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.tutorialNextBtnText}>다음 단계</Text>
                  <ChevronRight size={16} color="#fff" strokeWidth={2} />
                </TouchableOpacity>
              </View>
            )}

            {tutorialStep === 2 && (
              <View style={styles.tutorialStepWrap}>
                <View style={styles.tutorialStepIndicator}>
                  <View style={[styles.tutorialDot, styles.tutorialDotDone]} />
                  <View style={[styles.tutorialDot, styles.tutorialDotActive]} />
                  <View style={styles.tutorialDot} />
                </View>
                <View style={styles.tutorialIconWrap}>
                  <Sparkles size={32} color={theme.colors.accent[400]} strokeWidth={2} />
                </View>
                <Text style={styles.tutorialStepTitle}>2단계: AI 숏폼 생성</Text>
                <Text style={styles.tutorialStepDesc}>
                  AI가 상품 사진을 분석하고 자동으로 마케팅 카피, 만화 시나리오, 숏폼 영상 시나리오를 생성합니다.
                </Text>
                <View style={styles.tutorialMockCard}>
                  <View style={styles.tutorialMockAiRow}>
                    <Target size={14} color={theme.colors.primary[400]} strokeWidth={2} />
                    <Text style={styles.tutorialMockAiText}>제품 분석: 무선 블루투스 이어폰 / 전자기기</Text>
                  </View>
                  <View style={styles.tutorialMockAiRow}>
                    <Sparkles size={14} color={theme.colors.accent[400]} strokeWidth={2} />
                    <Text style={styles.tutorialMockAiText}>카피: "한 번 쓰면 못 놓는 무선 자유"</Text>
                  </View>
                  <View style={styles.tutorialMockAiRow}>
                    <Film size={14} color={theme.colors.warning[400]} strokeWidth={2} />
                    <Text style={styles.tutorialMockAiText}>숏폼 시나리오: 15초 / 4컷 구성 생성됨</Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.tutorialNextBtn}
                  onPress={() => setTutorialStep(3)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.tutorialNextBtnText}>다음 단계</Text>
                  <ChevronRight size={16} color="#fff" strokeWidth={2} />
                </TouchableOpacity>
              </View>
            )}

            {tutorialStep === 3 && (
              <View style={styles.tutorialStepWrap}>
                <View style={styles.tutorialStepIndicator}>
                  <View style={[styles.tutorialDot, styles.tutorialDotDone]} />
                  <View style={[styles.tutorialDot, styles.tutorialDotDone]} />
                  <View style={[styles.tutorialDot, styles.tutorialDotActive]} />
                </View>
                <View style={styles.tutorialIconWrap}>
                  <Check size={32} color={theme.colors.success[400]} strokeWidth={2} />
                </View>
                <Text style={styles.tutorialStepTitle}>3단계: 공정위 문구 완성</Text>
                <Text style={styles.tutorialStepDesc}>
                  생성된 콘텐츠에 공정거래위원회 광고 표시 문구가 자동으로 포함됩니다. 이것으로 전체 흐름이 완성됩니다.
                </Text>
                <View style={styles.tutorialMockCard}>
                  <View style={styles.tutorialDisclosureBox}>
                    <Check size={14} color={theme.colors.success[400]} strokeWidth={2} />
                    <Text style={styles.tutorialDisclosureText}>
                      "이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다."
                    </Text>
                  </View>
                  <Text style={styles.tutorialCompleteHint}>
                    모든 단계를 완료했습니다! 실제 제품으로 바로 시작해보세요.
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.tutorialCompleteBtn}
                  onPress={() => {
                    setTutorialStep(0);
                    setTutorialLinkInput('');
                    router.push('/(tabs)/');
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.tutorialCompleteBtnText}>실제 제품 분석 시작하기</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>구독 플랜 및 결제</Text>
        <Text style={styles.sectionDesc}>
          월 구독 플랜을 선택하면 매월 정해진 횟수만큼 AI 콘텐츠를 제작할 수 있습니다. 기본 쿼터를 모두 소진하면 충전 팩으로 추가할 수 있어요.
        </Text>

        {SUBSCRIPTION_PLANS.map((plan) => {
          const isPro = plan.id === 'pro';
          const isSelected = selectedPlan === plan.id;
          const PlanIcon = plan.id === 'basic' ? Rocket : plan.id === 'pro' ? Crown : Building2;
          return (
            <TouchableOpacity
              key={plan.id}
              style={[styles.planCard, isSelected && { borderColor: plan.accentColor, backgroundColor: plan.accentColor + '0D' }]}
              onPress={() => setSelectedPlan(plan.id)}
              activeOpacity={0.8}
            >
              <View style={styles.planHeader}>
                <View style={[styles.planIconWrap, { backgroundColor: plan.accentColor + '20' }]}>
                  <PlanIcon size={20} color={plan.accentColor} strokeWidth={2} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.planNameRow}>
                    <Text style={styles.planName}>{plan.name} 플랜</Text>
                    {plan.badge && (
                      <View style={[styles.planBadge, { backgroundColor: plan.accentColor }]}>
                        <Text style={styles.planBadgeText}>{plan.badge}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.planTagline}>{plan.tagline}</Text>
                </View>
                <View style={[styles.planRadio, isSelected && { borderColor: plan.accentColor, backgroundColor: plan.accentColor }]}>
                  {isSelected && <Check size={14} color="#fff" strokeWidth={2} />}
                </View>
              </View>
              <View style={styles.planPriceRow}>
                <Text style={[styles.planPrice, { color: plan.accentColor }]}>{formatPlanKRW(plan.monthlyPrice)}</Text>
                <Text style={styles.planPriceUnit}>/ 월</Text>
              </View>
              <Text style={styles.planQuota}>월간 AI 콘텐츠 {plan.quota.toLocaleString()}회 제공</Text>
              <View style={styles.planFeatureList}>
                {plan.features.map((feat, i) => (
                  <View key={i} style={styles.planFeatureRow}>
                    <Check size={14} color={plan.accentColor} strokeWidth={2} />
                    <Text style={styles.planFeatureText}>{feat}</Text>
                  </View>
                ))}
              </View>
            </TouchableOpacity>
          );
        })}

        <TouchableOpacity
          style={styles.subscribeBtn}
          onPress={() => Alert.alert('결제 안내', `${SUBSCRIPTION_PLANS.find(p => p.id === selectedPlan)?.name ?? ''} 플랜(${formatPlanKRW(SUBSCRIPTION_PLANS.find(p => p.id === selectedPlan)?.monthlyPrice ?? 0)}/월) 구독을 시작하시겠어요?\n\n결제 시스템 연동 후 실제 결제가 진행됩니다.`, [
            { text: '취소', style: 'cancel' },
            { text: '구독하기', onPress: () => Alert.alert('준비 중', '결제 시스템 연동 후 이용할 수 있어요. 곧 지원될 예정입니다.') },
          ])}
          activeOpacity={0.8}
        >
          <Crown size={18} color="#fff" strokeWidth={2} />
          <Text style={styles.subscribeBtnText}>{SUBSCRIPTION_PLANS.find(p => p.id === selectedPlan)?.name ?? ''} 플랜 구독하기</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tokenPackToggle}
          onPress={() => setShowTokenPacks(!showTokenPacks)}
          activeOpacity={0.7}
        >
          <Coins size={18} color={theme.colors.warning[400]} strokeWidth={2} />
          <Text style={styles.tokenPackToggleText}>토큰 추가 충전 팩 (Pay-as-you-go)</Text>
          {showTokenPacks ? <ChevronDown size={18} color={theme.colors.dark.textDim} strokeWidth={2} /> : <ChevronRight size={18} color={theme.colors.dark.textDim} strokeWidth={2} />}
        </TouchableOpacity>

        {showTokenPacks && (
          <View style={styles.tokenPackContainer}>
            <Text style={styles.tokenPackHint}>기본 월간 쿼터를 모두 소진한 경우 추가 충전할 수 있어요. 구독 해지나 상위 플랜 업그레이드 없이 유연하게 이용 가능합니다.</Text>
            {TOKEN_PACKS.map((pack) => (
              <View key={pack.id} style={styles.tokenPackCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.tokenPackName}>{pack.name}</Text>
                  <Text style={styles.tokenPackQuota}>AI 콘텐츠 {pack.quota}회 추가</Text>
                </View>
                <Text style={styles.tokenPackPrice}>{formatPlanKRW(pack.price)}</Text>
                <TouchableOpacity
                  style={styles.tokenPackBuyBtn}
                  onPress={() => Alert.alert('충전 안내', `${pack.name}(${formatPlanKRW(pack.price)})을 충전하시겠어요?`, [
                    { text: '취소', style: 'cancel' },
                    { text: '충전하기', onPress: () => Alert.alert('준비 중', '결제 시스템 연동 후 이용할 수 있어요.') },
                  ])}
                  activeOpacity={0.7}
                >
                  <Text style={styles.tokenPackBuyBtnText}>충전</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>제휴 파트너스 ID 설정</Text>
        <Text style={styles.sectionDesc}>
          각 플랫폼의 파트너스 ID를 입력하면 상품 분석 시 자동으로 수수료 링크가 생성됩니다. ID는 안전하게 저장됩니다.
        </Text>
        <View style={styles.card}>
          <View style={styles.idInputRow}>
            <View style={[styles.idIconWrap, { backgroundColor: '#FF3E3E20' }]}>
              <Text style={[styles.idIconText, { color: '#FF3E3E' }]}>C</Text>
            </View>
            <View style={styles.idInputBody}>
              <Text style={styles.idInputLabel}>쿠팡 파트너스 ID</Text>
              <TextInput
                style={styles.idInput}
                value={coupangId}
                onChangeText={setCoupangId}
                placeholder="예: ATTP1234567"
                placeholderTextColor={theme.colors.dark.textFaint}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>
          <Divider />
          <View style={styles.idInputRow}>
            <View style={[styles.idIconWrap, { backgroundColor: '#03C75A20' }]}>
              <Text style={[styles.idIconText, { color: '#03C75A' }]}>N</Text>
            </View>
            <View style={styles.idInputBody}>
              <Text style={styles.idInputLabel}>네이버 쇼핑 ID</Text>
              <TextInput
                style={styles.idInput}
                value={naverId}
                onChangeText={setNaverId}
                placeholder="예: naver_shop_123"
                placeholderTextColor={theme.colors.dark.textFaint}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>
          <Divider />
          <View style={styles.idInputRow}>
            <View style={[styles.idIconWrap, { backgroundColor: '#0064FF20' }]}>
              <Text style={[styles.idIconText, { color: '#0064FF' }]}>T</Text>
            </View>
            <View style={styles.idInputBody}>
              <Text style={styles.idInputLabel}>토스 쉐어링크 ID</Text>
              <TextInput
                style={styles.idInput}
                value={tossId}
                onChangeText={setTossId}
                placeholder="예: toss_share_abc"
                placeholderTextColor={theme.colors.dark.textFaint}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={styles.tossSignupLink}
                onPress={() => {
                  const tossUrl = 'https://business.toss.im/account/sign-in?client_id=ajvm9wq2t0p1ttet13y3qzb3rvjxhacn&redirect_uri=https%3A%2F%2Fsharelink.toss.im%2Fsignup-start';
                  if (Platform.OS === 'web') {
                    window.open(tossUrl, '_blank');
                  } else {
                    Linking.openURL(tossUrl).catch(() => {});
                  }
                }}
                activeOpacity={0.7}
              >
                <ExternalLink size={13} color="#0064FF" strokeWidth={2} />
                <Text style={styles.tossSignupLinkText}>토스 제휴링크 가입하기</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.saveIdButton, savedIds && styles.saveIdButtonDone]}
          onPress={handleSaveIds}
          disabled={savingIds}
          activeOpacity={0.8}
        >
          {savingIds ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : savedIds ? (
            <>
              <Check size={18} color="#fff" strokeWidth={2} />
              <Text style={styles.saveIdButtonText}>저장됨</Text>
            </>
          ) : (
            <>
              <Check size={18} color="#fff" strokeWidth={2} />
              <Text style={styles.saveIdButtonText}>파트너스 ID 저장</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>내 가게 로고 / 스탬프</Text>
        <Text style={styles.sectionDesc}>
          매장 로고(PNG)를 등록하면 생성되는 템플릿 카드, 숏폼 영상, 만화 콘텐츠 구석에 자동으로 워터마크처럼 박힙니다. 공유되어도 내 매장 브랜드가 홍보됩니다.
        </Text>
        <View style={styles.card}>
          {logoUrl ? (
            <View style={styles.logoPreviewWrap}>
              {Platform.OS === 'web' ? (
                // @ts-ignore img element on web
                <img src={logoUrl} style={styles.logoPreviewImg as any} />
              ) : null}
              <View style={styles.logoInfo}>
                <Text style={styles.logoRegisteredText}>로고가 등록되어 있어요</Text>
                <Text style={styles.logoHintText}>모든 콘텐츠에 자동으로 워터마크가 적용됩니다</Text>
              </View>
              <TouchableOpacity style={styles.logoRemoveBtn} onPress={handleRemoveLogo} activeOpacity={0.7}>
                <Trash2 size={14} color={theme.colors.error[400]} strokeWidth={2} />
                <Text style={styles.logoRemoveText}>삭제</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.logoEmptyWrap}>
              <View style={styles.logoEmptyIcon}>
                <Stamp size={28} color={theme.colors.dark.textDim} strokeWidth={2} />
              </View>
              <Text style={styles.logoEmptyText}>등록된 로고가 없어요</Text>
              <Text style={styles.logoEmptyHint}>PNG 파일을 업로드하면 자동으로 적용됩니다</Text>
            </View>
          )}
        </View>
        <TouchableOpacity
          style={[styles.logoUploadBtn, logoUploading && { opacity: 0.5 }]}
          onPress={handleUploadLogo}
          disabled={logoUploading}
          activeOpacity={0.8}
        >
          {logoUploading ? (
            <ActivityIndicator size="small" color={theme.colors.primary[300]} />
          ) : (
            <Upload size={18} color={theme.colors.primary[300]} strokeWidth={2} />
          )}
          <Text style={styles.logoUploadBtnText}>
            {logoUploading ? '업로드 중...' : logoUrl ? '로고 변경하기' : '로고 업로드하기'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>수익 기록</Text>
        <Text style={styles.sectionDesc}>
          제휴 수수료 수익을 직접 기록하면 분석 대시보드에 자동 반영됩니다. 어떤 콘텐츠가 얼마를 벌었는지 추적하세요.
        </Text>
        <TouchableOpacity
          style={styles.addRevenueButton}
          onPress={() => setRevModalVisible(true)}
          activeOpacity={0.8}
        >
          <Plus size={18} color="#fff" strokeWidth={2} />
          <Text style={styles.addRevenueButtonText}>수익 추가 기록</Text>
        </TouchableOpacity>

        {revenues.length > 0 && (
          <View style={styles.revenueList}>
            {revenues.map((rev) => (
              <View key={rev.id} style={styles.revenueRow}>
                <View style={styles.revenueInfo}>
                  <Text style={styles.revenuePlatform}>{rev.platform}</Text>
                  <Text style={styles.revenueAmount}>{formatKRW(Number(rev.amount))}</Text>
                  <Text style={styles.revenueMeta}>{rev.period_month}{rev.note ? ` · ${rev.note}` : ''}</Text>
                </View>
                <TouchableOpacity
                  style={styles.revenueDeleteBtn}
                  onPress={() => handleDeleteRevenue(rev.id)}
                  activeOpacity={0.7}
                >
                  <Trash2 size={16} color={theme.colors.error[400]} strokeWidth={2} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>콘텐츠 기본 설정</Text>
        <Text style={styles.sectionDesc}>
          만화 숏폼, 숏폼 영상 생성 시 기본으로 사용될 옵션을 미리 설정하세요
        </Text>
        <View style={styles.card}>
          <Text style={styles.idInputLabel}>기본 영상 길이</Text>
          <View style={styles.platformPickerRow}>
            {['10s', '15s', '20s', '30s'].map((d) => (
              <TouchableOpacity
                key={d}
                style={[styles.platformChip, defaultVideoDuration === d && styles.platformChipActive]}
                onPress={() => setDefaultVideoDuration(d)}
                activeOpacity={0.7}
              >
                <Text style={[styles.platformChipText, defaultVideoDuration === d && styles.platformChipTextActive]}>
                  {d}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Divider />
          <Text style={styles.idInputLabel}>기본 TTS 음성</Text>
          <Text style={styles.ttsCategoryLabel}>남성 - 쇼핑호스트</Text>
          <View style={styles.platformPickerRow}>
            {TTS_VOICES.filter((v) => v.gender === 'male' && v.style === 'shopping').map((v) => (
              <TouchableOpacity
                key={v.key}
                style={[styles.platformChip, defaultTtsVoice === v.key && styles.platformChipActive]}
                onPress={() => setDefaultTtsVoice(v.key)}
                activeOpacity={0.7}
              >
                <Text style={[styles.platformChipText, defaultTtsVoice === v.key && styles.platformChipTextActive]}>
                  {v.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.ttsCategoryLabel}>남성 - 아나운서</Text>
          <View style={styles.platformPickerRow}>
            {TTS_VOICES.filter((v) => v.gender === 'male' && v.style === 'announcer').map((v) => (
              <TouchableOpacity
                key={v.key}
                style={[styles.platformChip, defaultTtsVoice === v.key && styles.platformChipActive]}
                onPress={() => setDefaultTtsVoice(v.key)}
                activeOpacity={0.7}
              >
                <Text style={[styles.platformChipText, defaultTtsVoice === v.key && styles.platformChipTextActive]}>
                  {v.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.ttsCategoryLabel}>여성 - 쇼핑호스트</Text>
          <View style={styles.platformPickerRow}>
            {TTS_VOICES.filter((v) => v.gender === 'female' && v.style === 'shopping').map((v) => (
              <TouchableOpacity
                key={v.key}
                style={[styles.platformChip, defaultTtsVoice === v.key && styles.platformChipActive]}
                onPress={() => setDefaultTtsVoice(v.key)}
                activeOpacity={0.7}
              >
                <Text style={[styles.platformChipText, defaultTtsVoice === v.key && styles.platformChipTextActive]}>
                  {v.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.ttsCategoryLabel}>여성 - 아나운서</Text>
          <View style={styles.platformPickerRow}>
            {TTS_VOICES.filter((v) => v.gender === 'female' && v.style === 'announcer').map((v) => (
              <TouchableOpacity
                key={v.key}
                style={[styles.platformChip, defaultTtsVoice === v.key && styles.platformChipActive]}
                onPress={() => setDefaultTtsVoice(v.key)}
                activeOpacity={0.7}
              >
                <Text style={[styles.platformChipText, defaultTtsVoice === v.key && styles.platformChipTextActive]}>
                  {v.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Divider />
          <Text style={styles.idInputLabel}>내레이션 속도</Text>
          <Text style={styles.sliderValueText}>{ttsSpeed.toFixed(1)}x{ttsSpeed === 1.0 ? ' (기본)' : ttsSpeed < 1.0 ? ' (느림)' : ' (빠름)'}</Text>
          <View style={styles.sliderRow}>
            <Text style={styles.sliderLabel}>0.5x</Text>
            <View style={styles.sliderTrack}>
              <View style={[styles.sliderFill, { width: `${((ttsSpeed - 0.5) / 1.5) * 100}%` }]} />
              <View style={[styles.sliderThumb, { left: `${((ttsSpeed - 0.5) / 1.5) * 100}%` }]} />
            </View>
            <Text style={styles.sliderLabel}>2.0x</Text>
          </View>
          <View style={styles.sliderChipsRow}>
            {[0.5, 0.75, 1.0, 1.25, 1.5, 2.0].map((s) => (
              <TouchableOpacity
                key={s}
                style={[styles.sliderChip, ttsSpeed === s && styles.sliderChipActive]}
                onPress={() => setTtsSpeed(s)}
                activeOpacity={0.7}
              >
                <Text style={[styles.sliderChipText, ttsSpeed === s && styles.sliderChipTextActive]}>{s.toFixed(2).replace(/\.?0+$/, '')}x</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Divider />
          <Text style={styles.idInputLabel}>내레이션 피치 (음조)</Text>
          <Text style={styles.sliderValueText}>{ttsPitch > 0 ? `+${ttsPitch}` : ttsPitch}{ttsPitch === 0 ? ' (기본)' : ttsPitch > 0 ? ' (높음)' : ' (낮음)'}</Text>
          <View style={styles.sliderRow}>
            <Text style={styles.sliderLabel}>-12</Text>
            <View style={styles.sliderTrack}>
              <View style={[styles.sliderFill, { width: `${((ttsPitch + 12) / 24) * 100}%` }]} />
              <View style={[styles.sliderThumb, { left: `${((ttsPitch + 12) / 24) * 100}%` }]} />
            </View>
            <Text style={styles.sliderLabel}>+12</Text>
          </View>
          <View style={styles.sliderChipsRow}>
            {[-12, -6, -3, 0, 3, 6, 12].map((p) => (
              <TouchableOpacity
                key={p}
                style={[styles.sliderChip, ttsPitch === p && styles.sliderChipActive]}
                onPress={() => setTtsPitch(p)}
                activeOpacity={0.7}
              >
                <Text style={[styles.sliderChipText, ttsPitch === p && styles.sliderChipTextActive]}>{p > 0 ? `+${p}` : p}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Divider />
          <Text style={styles.idInputLabel}>진행 상태 표시 스타일</Text>
          <Text style={styles.ttsCategoryLabel}>영상 제작 중 표시되는 로딩 UI를 선택하세요</Text>
          <View style={styles.progressStyleRow}>
            <TouchableOpacity
              style={[styles.progressStyleCard, progressStyle === 'circular' && styles.progressStyleCardActive]}
              onPress={() => setProgressStyle('circular')}
              activeOpacity={0.7}
            >
              <View style={[styles.progressStyleIcon, progressStyle === 'circular' && styles.progressStyleIconActive]}>
                <CircleDot size={22} color={progressStyle === 'circular' ? '#fff' : theme.colors.dark.textDim} strokeWidth={2} />
              </View>
              <Text style={[styles.progressStyleName, progressStyle === 'circular' && styles.progressStyleNameActive]}>원형 회전형</Text>
              <Text style={styles.progressStyleDesc}>클래식한 원형 로딩</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.progressStyleCard, progressStyle === 'baby-run' && styles.progressStyleCardActive]}
              onPress={() => setProgressStyle('baby-run')}
              activeOpacity={0.7}
            >
              <View style={[styles.progressStyleIcon, progressStyle === 'baby-run' && styles.progressStyleIconActive]}>
                <Baby size={22} color={progressStyle === 'baby-run' ? '#fff' : theme.colors.dark.textDim} strokeWidth={2} />
              </View>
              <Text style={[styles.progressStyleName, progressStyle === 'baby-run' && styles.progressStyleNameActive]}>아기 달리기형</Text>
              <Text style={styles.progressStyleDesc}>트랙을 달리는 아기</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.progressStyleCard, progressStyle === 'status-bar' && styles.progressStyleCardActive]}
              onPress={() => setProgressStyle('status-bar')}
              activeOpacity={0.7}
            >
              <View style={[styles.progressStyleIcon, progressStyle === 'status-bar' && styles.progressStyleIconActive]}>
                <Activity size={22} color={progressStyle === 'status-bar' ? '#fff' : theme.colors.dark.textDim} strokeWidth={2} />
              </View>
              <Text style={[styles.progressStyleName, progressStyle === 'status-bar' && styles.progressStyleNameActive]}>실시간 상태 바형</Text>
              <Text style={styles.progressStyleDesc}>옹알이 표정 변화</Text>
            </TouchableOpacity>
          </View>
          <Divider />
          <View style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.featureTitle}>제휴 공시문 자동 포함</Text>
              <Text style={styles.featureDesc}>생성되는 카드와 공유 콘텐츠에 제휴 광고 표시를 자동으로 추가합니다</Text>
            </View>
            <TouchableOpacity
              onPress={() => setAutoDisclosure(!autoDisclosure)}
              activeOpacity={0.7}
              hitSlop={12}
            >
              <View style={[styles.toggleSwitch, autoDisclosure && styles.toggleSwitchActive]}>
                <View style={[styles.toggleKnob, autoDisclosure && styles.toggleKnobActive]} />
              </View>
            </TouchableOpacity>
          </View>
        </View>
        <TouchableOpacity
          style={[styles.saveIdButton, savedDefaults && styles.saveIdButtonDone]}
          onPress={async () => {
            setSavingDefaults(true);
            setSavedDefaults(false);
            try {
              await updateUserSettings({
                default_video_duration: defaultVideoDuration,
                default_tts_voice: defaultTtsVoice,
                tts_speed: ttsSpeed,
                tts_pitch: ttsPitch,
                progress_style: progressStyle,
                auto_disclosure: autoDisclosure,
              });
              setSavedDefaults(true);
              setTimeout(() => setSavedDefaults(false), 2500);
            } catch (err) {
              Alert.alert('저장 실패', err instanceof Error ? err.message : '알 수 없는 오류');
            }
            setSavingDefaults(false);
          }}
          disabled={savingDefaults}
          activeOpacity={0.8}
        >
          {savingDefaults ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : savedDefaults ? (
            <>
              <Check size={18} color="#fff" strokeWidth={2} />
              <Text style={styles.saveIdButtonText}>저장됨</Text>
            </>
          ) : (
            <>
              <Check size={18} color="#fff" strokeWidth={2} />
              <Text style={styles.saveIdButtonText}>기본 설정 저장</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>마스코트 캐릭터 설정</Text>
        <Text style={styles.sectionDesc}>
          영상과 화면에 표시되는 아기 캐릭터 마스코트를 켜거나 끌 수 있습니다. 비즈니스 계정이나 전문적인 톤이 필요하다면 마스코트를 끄거나 심플한 스타일로 변경하세요.
        </Text>
        <View style={styles.card}>
          <View style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.featureTitle}>마스코트 표시</Text>
              <Text style={styles.featureDesc}>아기 캐릭터를 영상 오버레이, 진행 바, 화면 UI에 표시합니다</Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                const next = !mascot.enabled;
                mascot.updateEnabled(next);
                setSavingMascot(true);
                persistUserSettings({ mascot_enabled: next }).then(() => {
                  invalidateSettingsCache();
                  setSavingMascot(false);
                  setSavedMascot(true);
                  setTimeout(() => setSavedMascot(false), 2000);
                }).catch(() => setSavingMascot(false));
              }}
              activeOpacity={0.7}
              hitSlop={12}
            >
              <View style={[styles.toggleSwitch, mascot.enabled && styles.toggleSwitchActive]}>
                <View style={[styles.toggleKnob, mascot.enabled && styles.toggleKnobActive]} />
              </View>
            </TouchableOpacity>
          </View>

          {mascot.enabled && (
            <>
              <Divider />
              <Text style={styles.idInputLabel}>마스코트 스타일</Text>
              <Text style={styles.ttsCategoryLabel}>표시할 캐릭터 스타일을 선택하세요</Text>
              <View style={styles.progressStyleRow}>
                <TouchableOpacity
                  style={[styles.progressStyleCard, mascot.style === 'cute-crawler' && styles.progressStyleCardActive]}
                  onPress={() => {
                    mascot.updateStyle('cute-crawler');
                    persistUserSettings({ mascot_style: 'cute-crawler' }).then(() => invalidateSettingsCache()).catch(() => {});
                  }}
                  activeOpacity={0.7}
                >
                  <View style={[styles.progressStyleIcon, mascot.style === 'cute-crawler' && styles.progressStyleIconActive]}>
                    <Baby size={22} color={mascot.style === 'cute-crawler' ? '#fff' : theme.colors.dark.textDim} strokeWidth={2} />
                  </View>
                  <Text style={[styles.progressStyleName, mascot.style === 'cute-crawler' && styles.progressStyleNameActive]}>아기 크롤러</Text>
                  <Text style={styles.progressStyleDesc}>귀여운 3D 아기</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.progressStyleCard, mascot.style === 'minimal-dot' && styles.progressStyleCardActive]}
                  onPress={() => {
                    mascot.updateStyle('minimal-dot');
                    persistUserSettings({ mascot_style: 'minimal-dot' }).then(() => invalidateSettingsCache()).catch(() => {});
                  }}
                  activeOpacity={0.7}
                >
                  <View style={[styles.progressStyleIcon, mascot.style === 'minimal-dot' && styles.progressStyleIconActive]}>
                    <CircleDot size={22} color={mascot.style === 'minimal-dot' ? '#fff' : theme.colors.dark.textDim} strokeWidth={2} />
                  </View>
                  <Text style={[styles.progressStyleName, mascot.style === 'minimal-dot' && styles.progressStyleNameActive]}>심플 닷</Text>
                  <Text style={styles.progressStyleDesc}>미니멀 인디케이터</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.progressStyleCard, mascot.style === 'none' && styles.progressStyleCardActive]}
                  onPress={() => {
                    mascot.updateStyle('none');
                    persistUserSettings({ mascot_style: 'none' }).then(() => invalidateSettingsCache()).catch(() => {});
                  }}
                  activeOpacity={0.7}
                >
                  <View style={[styles.progressStyleIcon, mascot.style === 'none' && styles.progressStyleIconActive]}>
                    <Activity size={22} color={mascot.style === 'none' ? '#fff' : theme.colors.dark.textDim} strokeWidth={2} />
                  </View>
                  <Text style={[styles.progressStyleName, mascot.style === 'none' && styles.progressStyleNameActive]}>표시 안 함</Text>
                  <Text style={styles.progressStyleDesc}>마스코트 없음</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
        {savingMascot && (
          <Text style={styles.mascotSavingHint}>저장 중...</Text>
        )}
        {savedMascot && (
          <Text style={styles.mascotSavedHint}>마스코트 설정이 저장되었습니다</Text>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>앱 환경 설정</Text>
        <Text style={styles.sectionDesc}>
          촬영 가이드 모드, 화면 효과, 테마를 기기 사양과 선호에 맞게 조절하세요
        </Text>
        <View style={styles.card}>
          {/* Capture Guide Mode */}
          <Text style={styles.idInputLabel}>AI 정밀도 및 촬영 가이드 모드</Text>
          <View style={styles.progressStyleRow}>
            <TouchableOpacity
              style={[styles.progressStyleCard, captureGuideMode === 'beginner' && styles.progressStyleCardActive]}
              onPress={() => setCaptureGuideMode('beginner')}
              activeOpacity={0.7}
            >
              <View style={[styles.progressStyleIcon, captureGuideMode === 'beginner' && styles.progressStyleIconActive]}>
                <Camera size={22} color={captureGuideMode === 'beginner' ? '#fff' : theme.colors.dark.textDim} strokeWidth={2} />
              </View>
              <Text style={[styles.progressStyleName, captureGuideMode === 'beginner' && styles.progressStyleNameActive]}>초보자용 간편</Text>
              <Text style={styles.progressStyleDesc}>사진 한 장으로 시작</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.progressStyleCard, captureGuideMode === 'pro' && styles.progressStyleCardActive]}
              onPress={() => setCaptureGuideMode('pro')}
              activeOpacity={0.7}
            >
              <View style={[styles.progressStyleIcon, captureGuideMode === 'pro' && styles.progressStyleIconActive]}>
                <Layers size={22} color={captureGuideMode === 'pro' ? '#fff' : theme.colors.dark.textDim} strokeWidth={2} />
              </View>
              <Text style={[styles.progressStyleName, captureGuideMode === 'pro' && styles.progressStyleNameActive]}>프로 다각도</Text>
              <Text style={styles.progressStyleDesc}>정면·측면·디테일</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.ttsCategoryLabel}>
            {captureGuideMode === 'beginner'
              ? '간편 모드: 기본 촬영 팁만 표시되고, 사진 한 장으로 빠르게 AI 분석을 시작합니다'
              : '프로 모드: 다각도 촬영 가이드(정면·측면·후면·디테일)가 표시되고, 여러 각도 사진으로 AI 정밀도가 극대화됩니다'}
          </Text>

          <Divider />

          {/* UI Performance */}
          <Text style={styles.idInputLabel}>UI 성능 (글래스모피즘 & 블러)</Text>
          <View style={styles.progressStyleRow}>
            <TouchableOpacity
              style={[styles.progressStyleCard, uiPerformance === 'high' && styles.progressStyleCardActive]}
              onPress={() => setUiPerformance('high')}
              activeOpacity={0.7}
            >
              <View style={[styles.progressStyleIcon, uiPerformance === 'high' && styles.progressStyleIconActive]}>
                <Sparkles size={22} color={uiPerformance === 'high' ? '#fff' : theme.colors.dark.textDim} strokeWidth={2} />
              </View>
              <Text style={[styles.progressStyleName, uiPerformance === 'high' && styles.progressStyleNameActive]}>고화질 블러</Text>
              <Text style={styles.progressStyleDesc}>반투명 유리 효과</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.progressStyleCard, uiPerformance === 'lite' && styles.progressStyleCardActive]}
              onPress={() => setUiPerformance('lite')}
              activeOpacity={0.7}
            >
              <View style={[styles.progressStyleIcon, uiPerformance === 'lite' && styles.progressStyleIconActive]}>
                <Smartphone size={22} color={uiPerformance === 'lite' ? '#fff' : theme.colors.dark.textDim} strokeWidth={2} />
              </View>
              <Text style={[styles.progressStyleName, uiPerformance === 'lite' && styles.progressStyleNameActive]}>저사양 최적화</Text>
              <Text style={styles.progressStyleDesc}>단색 배경 대체</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.ttsCategoryLabel}>
            {uiPerformance === 'high'
              ? '고화질: 반투명 유리 질감(글래스모피즘)과 블러 효과가 적용되어 프리미엄 느낌을 줍니다'
              : '최적화: 블러 효과 대신 단색 배경을 사용하여 구형 기기에서도 부드럽게 작동합니다'}
          </Text>

          <Divider />

          {/* Theme Mode */}
          <Text style={styles.idInputLabel}>테마 및 디스플레이 모드</Text>
          <View style={styles.progressStyleRow}>
            <TouchableOpacity
              style={[styles.progressStyleCard, themeMode === 'dark' && styles.progressStyleCardActive]}
              onPress={() => setThemeMode('dark')}
              activeOpacity={0.7}
            >
              <View style={[styles.progressStyleIcon, themeMode === 'dark' && styles.progressStyleIconActive]}>
                <Palette size={22} color={themeMode === 'dark' ? '#fff' : theme.colors.dark.textDim} strokeWidth={2} />
              </View>
              <Text style={[styles.progressStyleName, themeMode === 'dark' && styles.progressStyleNameActive]}>다크 크리에이터</Text>
              <Text style={styles.progressStyleDesc}>딥 다크 그라데이션</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.progressStyleCard, themeMode === 'light' && styles.progressStyleCardActive]}
              onPress={() => setThemeMode('light')}
              activeOpacity={0.7}
            >
              <View style={[styles.progressStyleIcon, themeMode === 'light' && styles.progressStyleIconActive]}>
                <Sun size={22} color={themeMode === 'light' ? '#fff' : theme.colors.dark.textDim} strokeWidth={2} />
              </View>
              <Text style={[styles.progressStyleName, themeMode === 'light' && styles.progressStyleNameActive]}>라이트 클린</Text>
              <Text style={styles.progressStyleDesc}>밝고 화사한 모드</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.ttsCategoryLabel}>
            {themeMode === 'dark'
              ? '다크 모드: 딥 다크 그라데이션의 세련된 감성을 유지합니다. 야외나 밝은 곳에서는 라이트 모드를 추천합니다'
              : '라이트 모드: 밝고 화사한 분위기로, 야외 촬영이나 밝은 환경에서 가시성이 좋습니다'}
          </Text>

          <Divider />

          {/* Display Density */}
          <Text style={styles.idInputLabel}>화면 밀도 및 텍스트 가독성</Text>
          <View style={styles.progressStyleRow}>
            <TouchableOpacity
              style={[styles.progressStyleCard, displayDensity === 'compact' && styles.progressStyleCardActive]}
              onPress={() => setDisplayDensity('compact')}
              activeOpacity={0.7}
            >
              <View style={[styles.progressStyleIcon, displayDensity === 'compact' && styles.progressStyleIconActive]}>
                <Smartphone size={22} color={displayDensity === 'compact' ? '#fff' : theme.colors.dark.textDim} strokeWidth={2} />
              </View>
              <Text style={[styles.progressStyleName, displayDensity === 'compact' && styles.progressStyleNameActive]}>컴팩트</Text>
              <Text style={styles.progressStyleDesc}>작은 화면 최적화</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.progressStyleCard, displayDensity === 'standard' && styles.progressStyleCardActive]}
              onPress={() => setDisplayDensity('standard')}
              activeOpacity={0.7}
            >
              <View style={[styles.progressStyleIcon, displayDensity === 'standard' && styles.progressStyleIconActive]}>
                <LayoutTemplate size={22} color={displayDensity === 'standard' ? '#fff' : theme.colors.dark.textDim} strokeWidth={2} />
              </View>
              <Text style={[styles.progressStyleName, displayDensity === 'standard' && styles.progressStyleNameActive]}>스탠다드</Text>
              <Text style={styles.progressStyleDesc}>균형 잡힌 여백</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.progressStyleCard, displayDensity === 'wide' && styles.progressStyleCardActive]}
              onPress={() => setDisplayDensity('wide')}
              activeOpacity={0.7}
            >
              <View style={[styles.progressStyleIcon, displayDensity === 'wide' && styles.progressStyleIconActive]}>
                <BookOpen size={22} color={displayDensity === 'wide' ? '#fff' : theme.colors.dark.textDim} strokeWidth={2} />
              </View>
              <Text style={[styles.progressStyleName, displayDensity === 'wide' && styles.progressStyleNameActive]}>와이드 텍스트</Text>
              <Text style={styles.progressStyleDesc}>큰 폰트 가독성</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.ttsCategoryLabel}>
            {displayDensity === 'compact'
              ? '컴팩트 모드: 아이폰 미니/SE 등 작은 화면에서 여백을 줄여 한눈에 더 많은 정보를 볼 수 있습니다'
              : displayDensity === 'wide'
                ? '와이드 텍스트 모드: 본문 폰트 크기가 확대되고 여백이 넓어져 가독성이 크게 향상됩니다'
                : '스탠다드 모드: 모든 화면 크기에서 균형 잡힌 여백과 폰트 크기를 제공합니다'}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.saveIdButton, savedPrefs && styles.saveIdButtonDone]}
          onPress={async () => {
            setSavingPrefs(true);
            setSavedPrefs(false);
            try {
              await updateUserSettings({
                capture_guide_mode: captureGuideMode,
                ui_performance: uiPerformance,
                theme_mode: themeMode,
                display_density: displayDensity,
              });
              setSavedPrefs(true);
              setTimeout(() => setSavedPrefs(false), 2500);
            } catch (err) {
              Alert.alert('저장 실패', err instanceof Error ? err.message : '알 수 없는 오류');
            }
            setSavingPrefs(false);
          }}
          disabled={savingPrefs}
          activeOpacity={0.8}
        >
          {savingPrefs ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : savedPrefs ? (
            <>
              <Check size={18} color="#fff" strokeWidth={2} />
              <Text style={styles.saveIdButtonText}>저장됨</Text>
            </>
          ) : (
            <>
              <Check size={18} color="#fff" strokeWidth={2} />
              <Text style={styles.saveIdButtonText}>환경 설정 저장</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* App Language Selector */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('settings.appLanguage')}</Text>
        <Text style={styles.sectionDesc}>{t('settings.appLanguageDesc')}</Text>
        <View style={styles.langSelectorRow}>
          {SUPPORTED_LANGUAGES.map((lang) => (
            <TouchableOpacity
              key={lang.code}
              style={[styles.langChip, language === lang.code && styles.langChipActive]}
              onPress={async () => {
                await setLanguage(lang.code);
                try {
                  await updateUserSettings({ app_language: lang.code });
                } catch {}
              }}
              activeOpacity={0.7}
            >
              <Text style={[styles.langChipText, language === lang.code && styles.langChipTextActive]}>
                {lang.nativeName}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>브랜드 톤앤매너 (페르소나)</Text>
        <Text style={styles.sectionDesc}>
          우리 매장/브랜드만의 말투와 분위기를 설정하면, AI가 생성하는 모든 카피에 이 톤앤매너가 자동으로 반영됩니다. 비워두면 기본 톤(친근한 존댓말)으로 생성됩니다.
        </Text>
        <View style={styles.card}>
          <View style={styles.idInputRow}>
            <View style={[styles.idIconWrap, { backgroundColor: theme.colors.accent[400] + '20' }]}>
              <Sparkles size={18} color={theme.colors.accent[400]} strokeWidth={2} />
            </View>
            <View style={styles.idInputBody}>
              <Text style={styles.idInputLabel}>브랜드 톤앤매너</Text>
              <TextInput
                style={[styles.idInput, { minHeight: 80, textAlignVertical: 'top' }]}
                value={brandPersona}
                onChangeText={setBrandPersona}
                placeholder="예: 친근하고 발랄한 2030 화장품 브랜드, 반말 톤, 이모지 적극 활용, 가격보다 감성 어필 우선"
                placeholderTextColor={theme.colors.dark.textFaint}
                autoCorrect={false}
                multiline
                maxLength={500}
              />
              <Text style={styles.charCount}>{brandPersona.length}/500</Text>
            </View>
          </View>
        </View>
        <TouchableOpacity
          style={[styles.saveIdButton, savedPersona && styles.saveIdButtonDone]}
          onPress={async () => {
            setSavingPersona(true);
            setSavedPersona(false);
            try {
              await updateUserSettings({ brand_persona: brandPersona.trim() || null });
              setSavedPersona(true);
              setTimeout(() => setSavedPersona(false), 2500);
            } catch (err) {
              Alert.alert('저장 실패', err instanceof Error ? err.message : '알 수 없는 오류');
            }
            setSavingPersona(false);
          }}
          disabled={savingPersona}
          activeOpacity={0.8}
        >
          {savingPersona ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : savedPersona ? (
            <>
              <Check size={18} color="#fff" strokeWidth={2} />
              <Text style={styles.saveIdButtonText}>저장됨</Text>
            </>
          ) : (
            <>
              <Check size={18} color="#fff" strokeWidth={2} />
              <Text style={styles.saveIdButtonText}>톤앤매너 저장</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>OpenAI API 키 설정</Text>
        <Text style={styles.sectionDesc}>
          가상 컷 생성, 가상 피팅 등 AI 이미지 기능에 사용됩니다. 키는 안전하게 저장되며 서버에서만 사용됩니다.
        </Text>
        <View style={styles.card}>
          <View style={styles.idInputRow}>
            <View style={[styles.idIconWrap, { backgroundColor: theme.colors.primary[500] + '20' }]}>
              <Key size={18} color={theme.colors.primary[400]} strokeWidth={2} />
            </View>
            <View style={styles.idInputBody}>
              <Text style={styles.idInputLabel}>OpenAI API Key</Text>
              <TextInput
                style={styles.idInput}
                value={openaiKey}
                onChangeText={setOpenaiKey}
                placeholder="sk-..."
                placeholderTextColor={theme.colors.dark.textFaint}
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry={!showApiKey}
              />
            </View>
            <TouchableOpacity onPress={() => setShowApiKey(!showApiKey)} style={styles.idIconWrap} hitSlop={12}>
              {showApiKey ? <EyeOff size={18} color={theme.colors.dark.textDim} strokeWidth={2} /> : <Eye size={18} color={theme.colors.dark.textDim} strokeWidth={2} />}
            </TouchableOpacity>
          </View>
        </View>
        <TouchableOpacity
          style={[styles.saveIdButton, savedKey && styles.saveIdButtonDone]}
          onPress={async () => {
            setSavingKey(true);
            setSavedKey(false);
            try {
              await updateUserSettings({ openai_api_key: openaiKey || null });
              setSavedKey(true);
              setTimeout(() => setSavedKey(false), 2500);
            } catch (err) {
              Alert.alert('저장 실패', err instanceof Error ? err.message : '알 수 없는 오류');
            }
            setSavingKey(false);
          }}
          disabled={savingKey}
          activeOpacity={0.8}
        >
          {savingKey ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : savedKey ? (
            <>
              <Check size={18} color="#fff" strokeWidth={2} />
              <Text style={styles.saveIdButtonText}>저장됨</Text>
            </>
          ) : (
            <>
              <Check size={18} color="#fff" strokeWidth={2} />
              <Text style={styles.saveIdButtonText}>API 키 저장</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>AI 분석</Text>
        <View style={styles.aiBuiltInCard}>
          <View style={styles.aiBuiltInIcon}>
            <Zap size={22} color="#fff" strokeWidth={2} />
          </View>
          <View style={styles.aiBuiltInBody}>
            <Text style={styles.aiBuiltInTitle}>AI 분석 내장됨</Text>
            <Text style={styles.aiBuiltInDesc}>
              별도 설정 없이 사진을 찍으면 AI가 자동으로 제품을 식별하고 마케팅 카피를 생성합니다.
            </Text>
          </View>
          <Check size={18} color={theme.colors.success[400]} strokeWidth={2} />
        </View>
      </View>

      <Text style={styles.footer}>ShortConnect (숏커넥트) — 온·오프라인 셀러를 위한 올인원 AI 커머스</Text>

      <Modal
        visible={revModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRevModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={{ width: '100%' }}
          >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderLeft}>
                <Wallet size={18} color={theme.colors.success[400]} strokeWidth={2} />
                <Text style={styles.modalTitle}>수익 기록 추가</Text>
              </View>
              <TouchableOpacity onPress={() => setRevModalVisible(false)} activeOpacity={0.7}>
                <Text style={styles.modalCloseText}>취소</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.modalLabel}>플랫폼</Text>
            <View style={styles.platformPickerRow}>
              {['Coupang', 'BrandConnect', 'Toss', '기타'].map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[styles.platformChip, revPlatform === p && styles.platformChipActive]}
                  onPress={() => setRevPlatform(p)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.platformChipText, revPlatform === p && styles.platformChipTextActive]}>
                    {p}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.modalLabel}>금액 (원)</Text>
            <TextInput
              style={styles.modalInput}
              value={revAmount}
              onChangeText={setRevAmount}
              placeholder="예: 15000"
              placeholderTextColor={theme.colors.dark.textFaint}
              keyboardType="numeric"
            />

            <Text style={styles.modalLabel}>정산 월</Text>
            <TextInput
              style={styles.modalInput}
              value={revMonth}
              onChangeText={setRevMonth}
              placeholder="YYYY-MM"
              placeholderTextColor={theme.colors.dark.textFaint}
            />

            <Text style={styles.modalLabel}>메모 (선택)</Text>
            <TextInput
              style={[styles.modalInput, { minHeight: 60 }]}
              value={revNote}
              onChangeText={setRevNote}
              placeholder="어떤 콘텐츠 수익인지 메모"
              placeholderTextColor={theme.colors.dark.textFaint}
              multiline
            />

            <TouchableOpacity
              style={styles.modalSaveButton}
              onPress={handleSaveRevenue}
              disabled={revSaving}
              activeOpacity={0.8}
            >
              {revSaving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.modalSaveButtonText}>기록 저장</Text>
              )}
            </TouchableOpacity>
          </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Divider() {
  return <View style={styles.divider} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.dark.bg,
  },
  centerContainer: {
    flex: 1,
    backgroundColor: theme.colors.dark.bg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    maxWidth: 600,
    alignSelf: 'center',
    width: '100%',
  },
  section: {
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.xl,
  },
  sectionTitle: {
    fontSize: theme.typography.micro,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.textDim,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: theme.spacing.sm,
  },
  sectionDesc: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    lineHeight: 20,
    marginBottom: theme.spacing.md,
  },
  card: {
    backgroundColor: theme.colors.dark.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    ...theme.shadows.card,
  },
  featureRow: {
    flexDirection: 'row',
    paddingVertical: theme.spacing.sm,
  },
  featureIconWrap: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.dark.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureBody: {
    flex: 1,
    marginLeft: theme.spacing.md,
  },
  featureTitle: {
    fontSize: theme.typography.body,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
  },
  featureDesc: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    lineHeight: 20,
    marginTop: 4,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.dark.border,
    marginVertical: theme.spacing.sm,
  },
  usageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
  },
  usageSteps: {
    paddingLeft: 48,
    paddingBottom: theme.spacing.sm,
    gap: 8,
  },
  usageStepRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  usageStepBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: theme.colors.primary[500] + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  usageStepNum: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.primary[400],
  },
  usageStepText: {
    flex: 1,
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    lineHeight: 20,
  },
  flowContainer: {
    backgroundColor: theme.colors.dark.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    ...theme.shadows.card,
  },
  flowStep: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.md,
  },
  flowStepIcon: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  flowStepBody: {
    flex: 1,
  },
  flowStepNum: {
    fontSize: 9,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.dark.textFaint,
    letterSpacing: 1,
  },
  flowStepTitle: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
    marginTop: 2,
  },
  flowStepDesc: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    lineHeight: 18,
    marginTop: 4,
  },
  flowConnector: {
    width: 2,
    height: 20,
    backgroundColor: theme.colors.dark.border,
    marginLeft: 21,
    marginVertical: 2,
  },
  aiBuiltInCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    backgroundColor: theme.colors.dark.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    ...theme.shadows.card,
  },
  aiBuiltInIcon: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.success[500],
    justifyContent: 'center',
    alignItems: 'center',
  },
  aiBuiltInBody: {
    flex: 1,
  },
  aiBuiltInTitle: {
    fontSize: theme.typography.body,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
  },
  aiBuiltInDesc: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    lineHeight: 20,
    marginTop: 2,
  },
  footer: {
    textAlign: 'center',
    fontSize: theme.typography.micro,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textFaint,
  },
  guideCard: {
    backgroundColor: theme.colors.dark.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    ...theme.shadows.card,
  },
  guideStepTitle: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
    marginBottom: theme.spacing.sm,
  },
  guideStepText: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    lineHeight: 22,
  },
  guideLinkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primary[500] + '15',
    marginBottom: theme.spacing.md,
  },
  guideLinkText: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.primary[400],
  },
  noticeCard: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.warning[500] + '10',
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.warning[400],
  },
  noticeText: {
    flex: 1,
    fontSize: theme.typography.micro,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    lineHeight: 20,
  },
  feedbackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
  },
  idInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
  },
  idIconWrap: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  idIconText: {
    fontSize: 18,
    fontFamily: theme.typography.fontFamily.bold,
  },
  idInputBody: {
    flex: 1,
    marginLeft: theme.spacing.md,
  },
  idInputLabel: {
    fontSize: theme.typography.micro,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.textDim,
    marginBottom: 4,
  },
  idInput: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.text,
    backgroundColor: theme.colors.dark.surfaceLight,
    borderRadius: theme.radius.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 8,
  },
  charCount: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textFaint,
    textAlign: 'right',
    marginTop: 4,
  },
  tossSignupLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 8,
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: theme.radius.sm,
    backgroundColor: '#0064FF10',
  },
  tossSignupLinkText: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: '#0064FF',
  },
  saveIdButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primary[600],
    marginTop: theme.spacing.md,
  },
  saveIdButtonDone: {
    backgroundColor: theme.colors.success[500],
  },
  saveIdButtonText: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: '#fff',
  },
  logoPreviewWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logoPreviewImg: {
    width: 60,
    height: 60,
    borderRadius: theme.radius.md,
    objectFit: 'contain',
    backgroundColor: theme.colors.dark.bg,
  },
  logoInfo: {
    flex: 1,
  },
  logoRegisteredText: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
  },
  logoHintText: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    marginTop: 2,
  },
  logoRemoveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.error[500] + '15',
  },
  logoRemoveText: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.error[400],
  },
  logoEmptyWrap: {
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
  },
  logoEmptyIcon: {
    width: 56,
    height: 56,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.dark.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  logoEmptyText: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.textDim,
  },
  logoEmptyHint: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textFaint,
    marginTop: 2,
  },
  logoUploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primary[500] + '15',
    borderWidth: 1.5,
    borderColor: theme.colors.primary[400] + '30',
    marginTop: theme.spacing.sm,
  },
  logoUploadBtnText: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.primary[300],
  },
  addRevenueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.success[500],
  },
  addRevenueButtonText: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: '#fff',
  },
  revenueList: {
    marginTop: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  revenueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.dark.surface,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
  },
  revenueInfo: {
    flex: 1,
  },
  revenuePlatform: {
    fontSize: theme.typography.micro,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.textDim,
  },
  revenueAmount: {
    fontSize: theme.typography.body,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.success[400],
    marginTop: 2,
  },
  revenueMeta: {
    fontSize: theme.typography.micro,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textFaint,
    marginTop: 2,
  },
  revenueDeleteBtn: {
    padding: theme.spacing.sm,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  modalContainer: {
    width: '100%',
    maxHeight: '85%',
    backgroundColor: theme.colors.dark.surface,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalTitle: {
    fontSize: theme.typography.heading,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.dark.text,
  },
  modalCloseText: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.textDim,
  },
  modalLabel: {
    fontSize: theme.typography.micro,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.textDim,
    marginBottom: 6,
    marginTop: theme.spacing.sm,
  },
  platformPickerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  ttsCategoryLabel: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.textDim,
    marginTop: 10,
    marginBottom: 6,
  },
  sliderValueText: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.accent[300],
    marginBottom: 8,
  },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  sliderLabel: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textFaint,
  },
  sliderTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.dark.surfaceLight,
    position: 'relative',
  },
  sliderFill: {
    position: 'absolute',
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.accent[500],
  },
  sliderThumb: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#fff',
    marginLeft: -8,
    marginTop: -5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  sliderChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 4,
  },
  sliderChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.dark.surfaceLight,
    borderWidth: 1.5,
    borderColor: theme.colors.dark.border,
  },
  sliderChipActive: {
    backgroundColor: theme.colors.accent[500],
    borderColor: theme.colors.accent[500],
  },
  sliderChipText: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.textDim,
  },
  sliderChipTextActive: {
    color: '#fff',
  },
  platformChip: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 8,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.dark.surfaceLight,
    borderWidth: 1.5,
    borderColor: theme.colors.dark.border,
  },
  platformChipActive: {
    backgroundColor: theme.colors.primary[600],
    borderColor: theme.colors.primary[600],
  },
  platformChipText: {
    fontSize: theme.typography.micro,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.textDim,
  },
  platformChipTextActive: {
    color: '#fff',
  },
  modalInput: {
    fontSize: theme.typography.body,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.text,
    backgroundColor: theme.colors.dark.surfaceLight,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 10,
  },
  modalSaveButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.success[500],
    marginTop: theme.spacing.lg,
  },
  modalSaveButtonText: {
    fontSize: theme.typography.body,
    fontFamily: theme.typography.fontFamily.bold,
    color: '#fff',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    gap: theme.spacing.md,
  },
  toggleSwitch: {
    width: 48,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.colors.dark.surfaceLight,
    borderWidth: 1.5,
    borderColor: theme.colors.dark.border,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleSwitchActive: {
    backgroundColor: theme.colors.success[500],
    borderColor: theme.colors.success[500],
  },
  toggleKnob: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: theme.colors.dark.textDim,
    marginLeft: 0,
  },
  toggleKnobActive: {
    backgroundColor: '#fff',
    marginLeft: 22,
  },
  planCard: {
    backgroundColor: theme.colors.dark.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md + 4,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: theme.colors.dark.border,
  },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  planIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  planName: {
    fontSize: 18,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.dark.text,
  },
  planBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.radius.full,
  },
  planBadgeText: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.bold,
    color: '#fff',
  },
  planTagline: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    marginTop: 2,
  },
  planRadio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: theme.colors.dark.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planPriceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginBottom: 4,
  },
  planPrice: {
    fontSize: 24,
    fontFamily: theme.typography.fontFamily.bold,
  },
  planPriceUnit: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
  },
  planQuota: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
    marginBottom: 10,
  },
  planFeatureList: {
    gap: 8,
  },
  planFeatureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  planFeatureText: {
    flex: 1,
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    lineHeight: 18,
  },
  subscribeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primary[500],
    marginBottom: 12,
  },
  subscribeBtnText: {
    fontSize: 15,
    fontFamily: theme.typography.fontFamily.bold,
    color: '#fff',
  },
  tokenPackToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.dark.surfaceLight,
  },
  tokenPackToggleText: {
    flex: 1,
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
  },
  tokenPackContainer: {
    marginTop: 10,
    gap: 10,
  },
  tokenPackHint: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textFaint,
    lineHeight: 16,
  },
  tokenPackCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.dark.surface,
    borderWidth: 1.5,
    borderColor: theme.colors.dark.border,
  },
  tokenPackName: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
  },
  tokenPackQuota: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    marginTop: 2,
  },
  tokenPackPrice: {
    fontSize: 15,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.warning[400],
  },
  tokenPackBuyBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.warning[400] + '20',
    borderWidth: 1.5,
    borderColor: theme.colors.warning[400],
  },
  tokenPackBuyBtnText: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.warning[400],
  },
  progressStyleRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  progressStyleCard: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.dark.surfaceLight,
    borderWidth: 1.5,
    borderColor: theme.colors.dark.border,
  },
  progressStyleCardActive: {
    backgroundColor: theme.colors.primary[600] + '15',
    borderColor: theme.colors.primary[500],
  },
  progressStyleIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.dark.surface,
    borderWidth: 1.5,
    borderColor: theme.colors.dark.border,
  },
  progressStyleIconActive: {
    backgroundColor: theme.colors.primary[500],
    borderColor: theme.colors.primary[500],
  },
  progressStyleName: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.textDim,
    textAlign: 'center',
  },
  progressStyleNameActive: {
    color: theme.colors.primary[300],
  },
  progressStyleDesc: {
    fontSize: 9,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textFaint,
    textAlign: 'center',
  },
  mascotSavingHint: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    textAlign: 'center',
    marginTop: 8,
  },
  mascotSavedHint: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.success[400],
    textAlign: 'center',
    marginTop: 8,
  },
  healthCheckRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  healthBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: theme.radius.md,
    borderWidth: 1.5,
  },
  healthBadgeOk: {
    backgroundColor: theme.colors.success[500] + '0D',
    borderColor: theme.colors.success[500] + '40',
  },
  healthBadgeErr: {
    backgroundColor: theme.colors.error[500] + '08',
    borderColor: theme.colors.error[500] + '30',
  },
  healthBadgeIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  healthBadgeLabel: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.semiBold,
  },
  healthBadgeStatus: {
    fontSize: 9,
    fontFamily: theme.typography.fontFamily.medium,
  },
  healthBadgeStatusOk: {
    color: theme.colors.success[400],
  },
  healthBadgeStatusErr: {
    color: theme.colors.error[400],
  },
  modalClose: {
    position: "absolute",
    top: theme.spacing.md,
    right: theme.spacing.md,
    width: 32,
    height: 32,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.dark.surfaceLight,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  tutorialBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.accent[500],
  },
  tutorialBtnText: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: '#fff',
  },
  tutorialModalContent: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: theme.colors.dark.surface,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.lg,
    position: 'relative',
    ...theme.shadows.elevated,
  },
  tutorialStepWrap: {
    alignItems: 'center',
    gap: 14,
  },
  tutorialStepIndicator: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4,
  },
  tutorialDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.dark.surfaceLight,
  },
  tutorialDotActive: {
    backgroundColor: theme.colors.primary[400],
  },
  tutorialDotDone: {
    backgroundColor: theme.colors.success[400],
  },
  tutorialIconWrap: {
    width: 64,
    height: 64,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.dark.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tutorialStepTitle: {
    fontSize: theme.typography.heading,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.dark.text,
    textAlign: 'center',
  },
  tutorialStepDesc: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    textAlign: 'center',
    lineHeight: 20,
  },
  tutorialMockCard: {
    width: '100%',
    backgroundColor: theme.colors.dark.surfaceLight,
    borderRadius: theme.radius.md,
    padding: 14,
    gap: 10,
  },
  tutorialMockLabel: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.textDim,
  },
  tutorialMockProduct: {
    fontSize: theme.typography.body,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.dark.text,
  },
  tutorialMockPrice: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.success[400],
  },
  tutorialMockLinkRow: {
    flexDirection: 'row',
    gap: 8,
  },
  tutorialMockInput: {
    flex: 1,
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.text,
    backgroundColor: theme.colors.dark.bg,
    borderRadius: theme.radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  tutorialMockBtn: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.success[500],
    justifyContent: 'center',
    alignItems: 'center',
  },
  tutorialMockAiRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tutorialMockAiText: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.text,
  },
  tutorialDisclosureBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: theme.colors.success[500] + '10',
    borderRadius: theme.radius.sm,
    padding: 10,
  },
  tutorialDisclosureText: {
    flex: 1,
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    lineHeight: 16,
  },
  tutorialCompleteHint: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.success[400],
    textAlign: 'center',
  },
  tutorialNextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    width: '100%',
    paddingVertical: 12,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primary[500],
  },
  tutorialNextBtnText: {
    fontSize: theme.typography.body,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: '#fff',
  },
  tutorialCompleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingVertical: 14,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.success[500],
  },
  tutorialCompleteBtnText: {
    fontSize: theme.typography.body,
    fontFamily: theme.typography.fontFamily.bold,
    color: '#fff',
  },
  langSelectorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: theme.spacing.sm,
  },
  langChip: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.dark.surface,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  langChipActive: {
    backgroundColor: theme.colors.primary[600],
    borderColor: theme.colors.primary[500],
  },
  langChipText: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.textDim,
  },
  langChipTextActive: {
    color: '#fff',
    fontFamily: theme.typography.fontFamily.semiBold,
  },
});
