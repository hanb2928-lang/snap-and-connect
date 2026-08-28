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
import { Camera, Sparkles, Info, ExternalLink, Link2, Check, Send, Zap, ChevronDown, ChevronRight, ChartBar as BarChart3, Flame, FolderOpen, ClipboardList, CalendarDays, MessageSquare, Bug, Wallet, Plus, Trash2, TrendingUp, Film, LayoutTemplate, BookOpen, PenLine, Image as ImageIcon, Scissors, Type, Stamp, Upload, Share2, Lightbulb, Smartphone, Clapperboard, Music2, Instagram, Youtube, Globe, Shirt, Wand as Wand2, Target, Users, Layers, Store, Video, Palette, Shuffle, Key, Eye, EyeOff, Crown, Rocket, Building2, Coins, CircleDot, Baby, Activity } from 'lucide-react-native';
import { theme } from '@/lib/theme';
import { getItem, setItem } from '@/lib/storage';
import { getUserSettings, updateUserSettings } from '@/lib/settings';
import { uploadAssetBlob } from '@/lib/savedAssets';
import { clearLogoCache } from '@/lib/logoWatermark';
import { TTS_VOICES, DEFAULT_TTS_VOICE } from '@/lib/ttsVoices';
import { SUBSCRIPTION_PLANS, TOKEN_PACKS, formatKRW as formatPlanKRW } from '@/lib/subscriptionPlans';
import type { UserSettings, RevenueRecord } from '@/types/database';
import { useTabBarHeight } from '@/hooks/useTabBarHeight';
import { useSafeTop } from '@/hooks/useSafeTop';
import { addRevenueRecord, fetchRevenueRecords, deleteRevenueRecord } from '@/lib/revenue';
import { formatKRW } from '@/lib/dashboard';
import { OnboardingModal } from '@/components/OnboardingModal';

export default function SettingsScreen() {
  const tabBarHeight = useTabBarHeight();
  const safeTop = useSafeTop();
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
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [defaultVideoDuration, setDefaultVideoDuration] = useState('15s');
  const [defaultTtsVoice, setDefaultTtsVoice] = useState(DEFAULT_TTS_VOICE);
  const [ttsSpeed, setTtsSpeed] = useState(1.0);
  const [ttsPitch, setTtsPitch] = useState(0);
  const [progressStyle, setProgressStyle] = useState<'circular' | 'baby-run' | 'status-bar'>('circular');
  const [autoDisclosure, setAutoDisclosure] = useState(true);
  const [savingDefaults, setSavingDefaults] = useState(false);
  const [savedDefaults, setSavedDefaults] = useState(false);
  const [brandPersona, setBrandPersona] = useState('');
  const [savingPersona, setSavingPersona] = useState(false);
  const [savedPersona, setSavedPersona] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<'basic' | 'pro' | 'business'>('pro');
  const [showTokenPacks, setShowTokenPacks] = useState(false);
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
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingBottom: tabBarHeight + 24 }]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <View style={[styles.header, { paddingTop: safeTop + 12 }]}>
        <View style={styles.logoWrap}>
          <Camera size={32} color={theme.colors.primary[400]} strokeWidth={2} />
        </View>
        <Text style={styles.appName} numberOfLines={1} adjustsFontSizeToFit>ShortConnect</Text>
        <Text style={styles.appTagline}>사진 한 장으로 끝내는 숏폼 마케팅</Text>
        <Text style={styles.appVersion}>Version 1.0.0</Text>
      </View>

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
                  {isSelected && <Check size={14} color="#fff" strokeWidth={3} />}
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
                    <Check size={14} color={plan.accentColor} strokeWidth={2.5} />
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
        <Text style={styles.sectionTitle}>네이버 쇼핑커넥트 안내</Text>
        <Text style={styles.sectionDesc}>
          네이버 쇼핑커넥트는 브랜드커넥트(banner.naver.com)에서 크리에이터로 가입 후, 상품별로 전용 수수료 링크를 직접 발급받는 시스템입니다. 단순한 ID 입력으로는 자동 추적 링크를 만들 수 없습니다.
        </Text>

        <View style={styles.guideCard}>
          <Text style={styles.guideStepTitle} numberOfLines={2}>이용 방법</Text>
          <Text style={styles.guideStepText}>
            1. 네이버 브랜드커넥트에 크리에이터로 가입합니다{'\n'}
            2. 채널(블로그/인스타/유튜브)을 연동합니다{'\n'}
            3. 상품 찾기에서 홍보할 상품을 선택합니다{'\n'}
            4. 링크 발급 버튼으로 전용 수수료 링크를 받습니다{'\n'}
            5. 발급받은 링크를 콘텐츠에 삽입합니다
          </Text>
        </View>

        <TouchableOpacity
          style={styles.guideLinkButton}
          onPress={() => Linking.openURL('https://brandconnect.naver.com/about/creator/').catch(() => {})}
          activeOpacity={0.8}
        >
          <ExternalLink size={18} color={theme.colors.primary[400]} strokeWidth={2} />
          <Text style={styles.guideLinkText}>네이버 브랜드커넥트 바로가기</Text>
        </TouchableOpacity>

        <View style={styles.noticeCard}>
          <Info size={16} color={theme.colors.warning[400]} strokeWidth={2} />
          <Text style={styles.noticeText}>
            본 앱은 AI가 상품을 식별하고 네이버 쇼핑 검색 링크를 자동 생성합니다. 정확한 수수료 추적을 위해서는 브랜드커넥트에서 발급받은 개별 링크를 직접 사용하세요.
          </Text>
        </View>
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
              <Check size={18} color="#fff" strokeWidth={2.5} />
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
          <Plus size={18} color="#fff" strokeWidth={2.5} />
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
              <Check size={18} color="#fff" strokeWidth={2.5} />
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
              <Check size={18} color="#fff" strokeWidth={2.5} />
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
        <Text style={styles.sectionTitle}>소리 펀치 (사운드 효과) 사용법</Text>
        <Text style={styles.sectionDesc}>
          인기 밈 효과음을 직접 녹음해서 만화 숏폼에 타이밍별로 추가하는 기능입니다
        </Text>
        <View style={styles.card}>
          <UsageGuide
            icon={<Music2 size={20} color={theme.colors.accent[400]} strokeWidth={2} />}
            title="소리 펀치 편집기 사용법"
            steps={[
              '만화 숏폼 생성기에서 "고급 옵션"을 펼칩니다',
              '"소리 펀치 컷 편집" 토글을 켭니다 (웹 브라우저에서만 사용 가능)',
              '녹음 버튼을 누르고 마이크에 소리를 내면 실시간으로 음파가 표시됩니다',
              '큰 소리가 감지되면 자동으로 효과 마커가 추가됩니다 (빵, 줌, 코믹 등)',
              '음성 명령으로 효과를 지정할 수도 있습니다 ("빵", "줌 인", "코믹" 등)',
              '녹음을 중지하면 타임라인에 마커가 표시되고 재생할 수 있습니다',
              '마커를 탭하면 효과 종류를 변경하거나 삭제할 수 있습니다',
              '만화 숏폼 생성 시 녹음된 효과가 영상에 자동으로 합성됩니다',
              '모바일에서는 "웹 브라우저에서만 사용할 수 있어요" 메시지가 표시됩니다',
            ]}
          />
        </View>
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
              <Check size={18} color="#fff" strokeWidth={2.5} />
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

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>콘텐츠 제작 순서 가이드</Text>
        <Text style={styles.sectionDesc}>
          앱에서 만들 수 있는 콘텐츠의 전체 제작 흐름을 한눈에 보여줍니다
        </Text>
        <View style={styles.flowContainer}>
          {/* Step 1: 촬영 & 분석 */}
          <View style={styles.flowStep}>
            <View style={[styles.flowStepIcon, { backgroundColor: theme.colors.primary[500] }]}>
              <Camera size={22} color="#fff" strokeWidth={2} />
            </View>
            <View style={styles.flowStepBody}>
              <Text style={styles.flowStepNum}>STEP 1</Text>
              <Text style={styles.flowStepTitle}>촬영 & AI 분석</Text>
              <Text style={styles.flowStepDesc}>
                상품을 촬영하면 AI가 제품명, 카테고리, 가격대를 자동 식별합니다
              </Text>
            </View>
          </View>

          <View style={styles.flowConnector} />

          {/* Step 2: 매칭 & 링크 */}
          <View style={styles.flowStep}>
            <View style={[styles.flowStepIcon, { backgroundColor: theme.colors.accent[500] }]}>
              <Link2 size={22} color="#fff" strokeWidth={2} />
            </View>
            <View style={styles.flowStepBody}>
              <Text style={styles.flowStepNum}>STEP 2</Text>
              <Text style={styles.flowStepTitle}>쇼핑 매칭 & 제휴 링크</Text>
              <Text style={styles.flowStepDesc}>
                네이버/쿠팡에서 동일 상품을 찾고 제휴 수수료 링크를 자동 생성합니다
              </Text>
            </View>
          </View>

          <View style={styles.flowConnector} />

          {/* Step 3: 템플릿 */}
          <View style={styles.flowStep}>
            <View style={[styles.flowStepIcon, { backgroundColor: theme.colors.warning[400] }]}>
              <LayoutTemplate size={22} color="#fff" strokeWidth={2} />
            </View>
            <View style={styles.flowStepBody}>
              <Text style={styles.flowStepNum}>STEP 3</Text>
              <Text style={styles.flowStepTitle}>숏폼 카드 & 템플릿</Text>
              <Text style={styles.flowStepDesc}>
                사진 위에 가격, 한줄평 스티커를 합성한 카드를 만듭니다
              </Text>
            </View>
          </View>

          <View style={styles.flowConnector} />

          {/* Step 4: 캐러셀/영상 */}
          <View style={styles.flowStep}>
            <View style={[styles.flowStepIcon, { backgroundColor: theme.colors.error[400] }]}>
              <Film size={22} color="#fff" strokeWidth={2} />
            </View>
            <View style={styles.flowStepBody}>
              <Text style={styles.flowStepNum}>STEP 4</Text>
              <Text style={styles.flowStepTitle}>캐러셀 & 숏폼 영상</Text>
              <Text style={styles.flowStepDesc}>
                여러 장의 카드를 슬라이드 캐러셀이나 숏폼 영상으로 제작합니다
              </Text>
            </View>
          </View>

          <View style={styles.flowConnector} />

          {/* Step 5: 만화 */}
          <View style={styles.flowStep}>
            <View style={[styles.flowStepIcon, { backgroundColor: theme.colors.success[500] }]}>
              <BookOpen size={22} color="#fff" strokeWidth={2} />
            </View>
            <View style={styles.flowStepBody}>
              <Text style={styles.flowStepNum}>STEP 5</Text>
              <Text style={styles.flowStepTitle}>만화 콘텐츠 제작</Text>
              <Text style={styles.flowStepDesc}>
                상품을 활용한 4컷 만화 시나리오를 AI로 생성하고 이미지로 완성합니다
              </Text>
            </View>
          </View>

          <View style={styles.flowConnector} />

          {/* Step 6: 공유 */}
          <View style={styles.flowStep}>
            <View style={[styles.flowStepIcon, { backgroundColor: theme.colors.primary[400] }]}>
              <Send size={22} color="#fff" strokeWidth={2} />
            </View>
            <View style={styles.flowStepBody}>
              <Text style={styles.flowStepNum}>STEP 6</Text>
              <Text style={styles.flowStepTitle}>공유 & 수익 추적</Text>
              <Text style={styles.flowStepDesc}>
                인스타, 틱톡, 카카오톡으로 공유하고 클릭수와 수익을 추적합니다
              </Text>
            </View>
          </View>

          <View style={styles.flowConnector} />

          {/* Step 7: 가상 피팅 & 컷 */}
          <View style={styles.flowStep}>
            <View style={[styles.flowStepIcon, { backgroundColor: theme.colors.accent[500] }]}>
              <Shirt size={22} color="#fff" strokeWidth={2} />
            </View>
            <View style={styles.flowStepBody}>
              <Text style={styles.flowStepNum}>STEP 7</Text>
              <Text style={styles.flowStepTitle}>가상 피팅 & 컷 갤러리</Text>
              <Text style={styles.flowStepDesc}>
                상품 사진으로 가상 착용 컷과 다양한 각도의 컷을 AI로 생성합니다
              </Text>
            </View>
          </View>

          <View style={styles.flowConnector} />

          {/* Step 8: 분석 & 인사이트 */}
          <View style={styles.flowStep}>
            <View style={[styles.flowStepIcon, { backgroundColor: theme.colors.success[500] }]}>
              <Target size={22} color="#fff" strokeWidth={2} />
            </View>
            <View style={styles.flowStepBody}>
              <Text style={styles.flowStepNum}>STEP 8</Text>
              <Text style={styles.flowStepTitle}>바이럴 예측 & 트렌드 분석</Text>
              <Text style={styles.flowStepDesc}>
                콘텐츠의 바이럴 잠재력을 예측하고 트렌드 매칭으로 최적화합니다
              </Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>콘텐츠 제작 기능 설명서</Text>
        <Text style={styles.sectionDesc}>
          각 제작 기능을 탭하면 상세 사용법이 펼쳐집니다
        </Text>
        <View style={styles.card}>
          <UsageGuide
            icon={<ImageIcon size={20} color={theme.colors.warning[400]} strokeWidth={2} />}
            title="숏폼 카드 (템플릿) 만들기"
            steps={[
              '결과 화면에서 "숏폼 카드" 버튼을 탭합니다',
              'AI가 제공한 한줄평과 가격이 사진 위에 스티커로 자동 합성됩니다',
              '스타일(매거진/볼드/미니멀/피드)을 선택해 디자인을 바꿀 수 있습니다',
              '가격, 한줄평, 해시태그 텍스트를 직접 수정할 수 있습니다',
              '배경 제거 버튼으로 깔끔한 상품 이미지를 만들 수 있습니다',
              '색상 테마를 변경해 브랜드에 맞는 디자인을 적용합니다',
              '완성된 카드를 저장하거나 바로 공유할 수 있습니다',
            ]}
          />
          <Divider />
          <UsageGuide
            icon={<LayoutTemplate size={20} color={theme.colors.accent[400]} strokeWidth={2} />}
            title="캐러셀 (여러 장 슬라이드) 만들기"
            steps={[
              '결과 화면에서 "캐러셀" 버튼을 탭합니다',
              '여러 상품이나 여러 각도의 사진을 순서대로 배치합니다',
              '각 슬라이드마다 개별 텍스트와 가격을 입력할 수 있습니다',
              '슬라이드 순서를 드래그하여 변경할 수 있습니다',
              '전체 슬라이드에 통일된 스타일을 적용합니다',
              '인스타그램 게시물용으로 세로 크기에 맞춰 자동 조정됩니다',
              '완성된 캐러셀을 이미지로 저장하거나 공유합니다',
            ]}
          />
          <Divider />
          <UsageGuide
            icon={<Film size={20} color={theme.colors.error[400]} strokeWidth={2} />}
            title="숏폼 영상 (클립) 만들기"
            steps={[
              '결과 화면에서 "숏폼 영상" 버튼을 탭합니다',
              '상품 사진과 텍스트를 이어붙여 짧은 영상을 만듭니다',
              '화면 전환 효과와 텍스트 애니메이션이 자동 적용됩니다',
              '배경 음악(업비트/차분/에너지/없음)과 모션 효과(켄번스/줌/팬)를 선택할 수 있습니다',
              '고급 설정에서 화면 비율(세로/가로/정사각형)과 템플릿 스타일을 바꿀 수 있습니다',
              '하이브리드 모드(사진→만화 전환)를 켜면 영상 중반에 만화 효과가 적용됩니다',
              '영상 길이(10초/15초/20초/30초)를 선택합니다 - 기본 15초',
              '세로(9:16) 비율로 틱톡/인스타 릴스/유튜브 쇼츠에 최적화됩니다',
              '완성된 영상을 갤러리에 저장하거나 클라우드에 저장 후 각 플랫폼에 업로드합니다',
            ]}
          />
          <Divider />
          <UsageGuide
            icon={<BookOpen size={20} color={theme.colors.success[500]} strokeWidth={2} />}
            title="만화 숏폼 (만화 영상) 만들기"
            steps={[
              '결과 화면에서 "만화 숏폼" 버튼을 탭합니다',
              'AI가 상품을 활용한 만화 시나리오를 자동 생성합니다 (싱글/2컷/3컷 분할)',
              '각 컷의 대사와 상황을 직접 수정할 수 있습니다',
              '무드 템플릿(귀여운 웹툰/시크한 느와르/세일 팝업/레트로/프리미엄 미니멀/에너지 팝아트)을 선택합니다',
              '시크한 느와르 템플릿을 선택하면 흑백 만화 스타일로 제작됩니다',
              '고급 설정에서 영상 길이(10초/15초/20초/30초)를 선택합니다 - 컷 수에 따라 자동 추천',
              'AI 내레이션 더빙, 감정 표정 오버레이, MBTI 맞춤형 해설을 추가할 수 있습니다',
              '연작 에피소드 모드를 켜면 "1일차-3일차-7일차" 시간 흐름 스토리로 만들어집니다',
              '사운드 펀치 효과로 만화 효과음을 시간대별로 추가할 수 있습니다',
              '완성된 만화 숏폼을 저장하거나 틱톡/인스타/쇼츠로 바로 공유합니다',
            ]}
          />
          <Divider />
          <UsageGuide
            icon={<PenLine size={20} color={theme.colors.accent[300]} strokeWidth={2} />}
            title="카피라이팅 (글 자동 생성)"
            steps={[
              '결과 화면에서 "카피 작성" 버튼을 탭합니다',
              'AI가 상품 분석 결과를 바탕으로 마케팅 문구를 생성합니다',
              '톤앤매너(캐주얼/전문/감성/유머)를 선택할 수 있습니다',
              '생성된 카피를 그대로 복사하거나 수정 후 사용합니다',
              '해시태그 추천도 함께 제공됩니다',
              '여러 버전의 카피를 비교하고 가장 좋은 것을 선택합니다',
            ]}
          />
          <Divider />
          <UsageGuide
            icon={<Type size={20} color={theme.colors.primary[300]} strokeWidth={2} />}
            title="리뷰 & 한줄평 작성"
            steps={[
              '결과 화면에서 "리뷰 입력" 버튼을 탭합니다',
              '직접 상품에 대한 한줄평을 작성하거나 AI 추천을 받습니다',
              '작성한 리뷰는 숏폼 카드와 캐러셀에 자동 반영됩니다',
              '리뷰를 수정하면 연결된 모든 콘텐츠가 업데이트됩니다',
            ]}
          />
          <Divider />
          <UsageGuide
            icon={<Scissors size={20} color={theme.colors.warning[400]} strokeWidth={2} />}
            title="배경 제거 & 이미지 편집"
            steps={[
              '결과 화면에서 "배경 제거" 버튼을 탭합니다',
              'AI가 상품의 배경을 자동으로 감지하고 제거합니다',
              '투명 배경 이미지로 저장되어 다양한 디자인에 활용 가능합니다',
              '제거된 이미지는 숏폼 카드, 캐러셀, 만화에 자동 적용됩니다',
              '필요시 배경 색상을 직접 변경할 수 있습니다',
            ]}
          />
          <Divider />
          <UsageGuide
            icon={<Shirt size={20} color={theme.colors.accent[400]} strokeWidth={2} />}
            title="가상 피팅 갤러리"
            steps={[
              '결과 화면에서 "가상 피팅" 섹션을 확인합니다',
              'AI가 상품 사진을 바탕으로 다양한 착용 장면을 자동 생성합니다',
              '의류, 액세서리 등 착용 가능한 상품에 최적화되어 있습니다',
              '생성된 피팅 이미지를 탭하면 확대해서 볼 수 있습니다',
              '"이 이미지 사용" 버튼으로 피팅 이미지를 메인으로 설정할 수 있습니다',
              '생성된 이미지를 저장하거나 숏폼 카드에 활용할 수 있습니다',
            ]}
          />
          <Divider />
          <UsageGuide
            icon={<Layers size={20} color={theme.colors.primary[300]} strokeWidth={2} />}
            title="가상 컷 갤러리"
            steps={[
              '결과 화면에서 "가상 컷" 섹션을 확인합니다',
              'AI가 상품을 다양한 각도와 배경에서 촬영한 것 같은 컷을 생성합니다',
              '스튜디오, 자연, 매장, 그라데이션 등 다양한 배경으로 자동 합성합니다',
              '생성된 컷을 탭하면 확대해서 확인할 수 있습니다',
              '"이 이미지 사용" 버튼으로 원하는 컷을 메인 이미지로 설정합니다',
              '여러 컷을 캐러셀이나 숏폼 영상에 활용할 수 있습니다',
            ]}
          />
          <Divider />
          <UsageGuide
            icon={<Wand2 size={20} color={theme.colors.warning[400]} strokeWidth={2} />}
            title="AI 스타일 추천"
            steps={[
              '결과 화면에서 "AI 스타일" 섹션을 확인합니다',
              'AI가 상품 카테고리와 분위기에 맞는 디자인 스타일을 추천합니다',
              '추천된 스타일을 탭하면 숏폼 카드에 즉시 적용됩니다',
              '스타일을 변경하면 텍스트 배치, 색상, 폰트가 자동으로 조정됩니다',
              '마음에 드는 스타일을 선택하면 모든 콘텐츠에 일관되게 적용됩니다',
            ]}
          />
          <Divider />
          <UsageGuide
            icon={<Target size={20} color={theme.colors.error[400]} strokeWidth={2} />}
            title="바이럴 예측"
            steps={[
              '결과 화면에서 "바이럴 예측" 섹션을 확인합니다',
              'AI가 콘텐츠의 바이럴 잠재력을 점수로 예측합니다',
              '예측 점수는 후킹력, 트렌드 적합도, 공유 가능성을 종합 평가합니다',
              '개선 제안을 탭하면 점수를 높일 수 있는 팁을 확인할 수 있습니다',
              '제안에 따라 카피나 스타일을 수정하면 예측 점수가 다시 계산됩니다',
            ]}
          />
          <Divider />
          <UsageGuide
            icon={<Users size={20} color={theme.colors.accent[300]} strokeWidth={2} />}
            title="페르소나 시뮬레이터"
            steps={[
              '결과 화면에서 "페르소나 시뮬레이터" 섹션을 확인합니다',
              '타겟 고객의 페르소나(연령, 성별, 관심사)를 선택합니다',
              'AI가 해당 페르소나 관점에서 상품을 어떻게 평가할지 시뮬레이션합니다',
              '예상 반응, 구매 확률, 주요 어필 포인트를 확인할 수 있습니다',
              '시뮬레이션 결과를 바탕으로 마케팅 카피를 최적화할 수 있습니다',
            ]}
          />
          <Divider />
          <UsageGuide
            icon={<Globe size={20} color={theme.colors.primary[400]} strokeWidth={2} />}
            title="글로벌 현지화"
            steps={[
              '결과 화면에서 "글로벌 현지화" 섹션을 확인합니다',
              '마케팅 카피를 영어, 일본어, 중국어 등 다국어로 번역합니다',
              '단순 번역이 아닌 각국 문화와 SNS 트렌드에 맞게 현지화합니다',
              '국가별 인기 해시태그와 마케팅 톤을 자동 반영합니다',
              '번역된 카피를 탭하면 클립보드에 복사됩니다',
              '해외 진출 시 각국 플랫폼에 맞춘 콘텐츠를 빠르게 제작할 수 있습니다',
            ]}
          />
          <Divider />
          <UsageGuide
            icon={<Shuffle size={20} color={theme.colors.success[500]} strokeWidth={2} />}
            title="멀티 플랫폼 익스포트"
            steps={[
              '결과 화면에서 "멀티 플랫폼 익스포트" 섹션을 확인합니다',
              '인스타그램, 틱톡, 유튜브 쇼츠 세 플랫폼에 맞춘 이미지를 한 번에 생성합니다',
              '각 플랫폼별 최적 화면 비율과 텍스트 위치가 자동 조정됩니다',
              '플랫폼별 권장 해시태그와 캡션 스타일이 자동 적용됩니다',
              '생성된 이미지를 각 플랫폼에 맞춰 개별 저장할 수 있습니다',
              '세 플랫폼 동시 업로드로 노출을 극대화할 수 있습니다',
            ]}
          />
          <Divider />
          <UsageGuide
            icon={<TrendingUp size={20} color={theme.colors.accent[400]} strokeWidth={2} />}
            title="트렌드 매칭"
            steps={[
              '결과 화면에서 "트렌드 매칭" 섹션을 확인합니다',
              'AI가 현재 SNS에서 유행하는 키워드와 상품을 자동 매칭합니다',
              '실시간 트렌드 키워드를 탭하면 관련 마케팅 카피가 자동 생성됩니다',
              '트렌드에 맞춘 해시태그 추천도 함께 제공됩니다',
              '시의성 있는 콘텐츠로 알고리즘 노출을 높일 수 있습니다',
            ]}
          />
          <Divider />
          <UsageGuide
            icon={<Store size={20} color={theme.colors.warning[400]} strokeWidth={2} />}
            title="내 가게 정보"
            steps={[
              '결과 화면에서 "내 가게 정보" 섹션을 확인합니다',
              '오프라인 매장 정보(주소, 영업시간, 전화번호)를 등록할 수 있습니다',
              '등록한 가게 정보가 숏폼 카드와 공유 콘텐츠에 자동 포함됩니다',
              '고객이 콘텐츠를 보고 매장 위치를 바로 확인할 수 있습니다',
              '온·오프라인 연계 마케팅에 활용하세요',
            ]}
          />
          <Divider />
          <UsageGuide
            icon={<Video size={20} color={theme.colors.error[400]} strokeWidth={2} />}
            title="비디오 임포트"
            steps={[
              '결과 화면에서 "비디오 임포트" 기능을 사용합니다',
              '기존에 촬영한 영상을 불러와 숏폼 콘텐츠로 변환합니다',
              '영상에서 핵심 구간을 자동 추출하여 숏폼으로 만듭니다',
              '추출된 구간에 텍스트와 스티커를 추가할 수 있습니다',
              '기존 영상 자산을 재활용하여 콘텐츠 제작 시간을 단축하세요',
            ]}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>기능 소개</Text>
        <View style={styles.card}>
          <FeatureRow
            icon={<Camera size={20} color={theme.colors.primary[400]} strokeWidth={2} />}
            title="실물 촬영 & 쇼핑 매칭"
            desc="신발, 조명, 옷 등을 촬영하면 AI가 제품을 식별하고 네이버 쇼핑 상품을 매칭합니다"
          />
          <Divider />
          <FeatureRow
            icon={<Link2 size={20} color={theme.colors.accent[400]} strokeWidth={2} />}
            title="제휴 링크 자동 생성"
            desc="설정한 파트너스 ID로 수수료 링크를 즉시 생성합니다"
          />
          <Divider />
          <FeatureRow
            icon={<Sparkles size={20} color={theme.colors.warning[400]} strokeWidth={2} />}
            title="숏폼 템플릿 자동 완성"
            desc="사진 위에 가격과 추천 한줄평 스티커가 합성된 카드를 자동 생성합니다"
          />
          <Divider />
          <FeatureRow
            icon={<Send size={20} color={theme.colors.success[500]} strokeWidth={2} />}
            title="SNS 원터치 공유 (아코디언)"
            desc="공유 버튼을 탭하면 네이버클립·네이버TV·인스타·카카오톡·블로그 버튼이 펼쳐집니다. 한 번 더 탭하면 접혀서 화면을 깔끔하게 유지합니다"
          />
          <Divider />
          <FeatureRow
            icon={<Shirt size={20} color={theme.colors.accent[400]} strokeWidth={2} />}
            title="가상 피팅 & 컷 갤러리"
            desc="상품 사진으로 AI가 다양한 착용 장면과 각도의 컷을 자동 생성합니다"
          />
          <Divider />
          <FeatureRow
            icon={<Wand2 size={20} color={theme.colors.warning[400]} strokeWidth={2} />}
            title="AI 스타일 추천"
            desc="상품에 맞는 디자인 스타일을 AI가 추천하고 원탭으로 적용합니다"
          />
          <Divider />
          <FeatureRow
            icon={<Target size={20} color={theme.colors.error[400]} strokeWidth={2} />}
            title="바이럴 예측 & 페르소나 시뮬레이터"
            desc="콘텐츠의 바이럴 잠재력을 예측하고 타겟 고객 관점의 반응을 시뮬레이션합니다"
          />
          <Divider />
          <FeatureRow
            icon={<Globe size={20} color={theme.colors.primary[400]} strokeWidth={2} />}
            title="글로벌 현지화 & 멀티 플랫폼 익스포트"
            desc="마케팅 카피를 다국어로 현지화하고, 인스타·틱톡·쇼츠 맞춤 이미지를 한 번에 생성합니다"
          />
          <Divider />
          <FeatureRow
            icon={<TrendingUp size={20} color={theme.colors.accent[400]} strokeWidth={2} />}
            title="트렌드 매칭 & 트렌드 카피"
            desc="실시간 SNS 트렌드 키워드와 상품을 자동 매칭하여 시의성 있는 카피를 생성합니다"
          />
          <Divider />
          <FeatureRow
            icon={<Store size={20} color={theme.colors.warning[400]} strokeWidth={2} />}
            title="내 가게 정보 & 오프라인 연계"
            desc="매장 정보를 등록하면 숏폼 카드와 공유 콘텐츠에 자동으로 포함됩니다"
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>기능별 앱 사용법</Text>
        <Text style={styles.sectionDesc}>
          각 기능을 탭하면 단계별 사용 방법이 펼쳐집니다
        </Text>
        <View style={styles.card}>
          <UsageGuide
            icon={<Camera size={20} color={theme.colors.primary[400]} strokeWidth={2} />}
            title="실물 촬영 & 제품 분석"
            steps={[
              '카메라 탭에서 제품을 촬영하거나 갤러리에서 사진을 선택합니다',
              'AI가 자동으로 제품명, 카테고리, 가격대를 식별합니다',
              '네이버 쇼핑에서 동일 상품을 검색하고 매칭 결과를 보여줍니다',
              '원하는 상품을 선택하면 제휴 링크가 자동 생성됩니다',
            ]}
          />
          <Divider />
          <UsageGuide
            icon={<Sparkles size={20} color={theme.colors.warning[400]} strokeWidth={2} />}
            title="숏폼 카드 & 캐러셀 만들기"
            steps={[
              '결과 화면에서 "숏폼 카드" 또는 "캐러셀" 버튼을 탭합니다',
              'AI가 제공한 한줄평과 가격이 사진 위에 스티커로 합성됩니다',
              '스타일(매거진/볼드/미니멀/피드)을 선택해 디자인을 바꿀 수 있습니다',
              '배경 제거 버튼으로 깔끔한 상품 이미지를 만들 수 있습니다',
              '완성된 카드를 저장하거나 바로 공유할 수 있습니다',
            ]}
          />
          <Divider />
          <UsageGuide
            icon={<Link2 size={20} color={theme.colors.accent[400]} strokeWidth={2} />}
            title="제휴 링크 적용 & 공유"
            steps={[
              '결과 화면에서 "내 수수료 링크 붙여넣기" 버튼을 탭합니다',
              '브랜드커넥트에서 발급받은 개별 링크를 붙여넣습니다',
              '적용하면 숏폼 카드, 공유 링크, 단축 URL에 자동 반영됩니다',
              '하단 "SNS 원터치 공유" 헤더를 탭하면 공유 버튼들이 아코디언으로 펼쳐집니다',
              '네이버클립, 네이버TV, 인스타, 카카오톡, 블로그 중 원하는 플랫폼을 탭합니다',
              '홍보 문구와 이미지가 클립보드에 복사되고 해당 SNS가 새 창에서 열립니다',
              '다시 헤더를 탭하면 버튼이 접혀서 화면을 깔끔하게 유지합니다',
            ]}
          />
          <Divider />
          <UsageGuide
            icon={<Link2 size={20} color={theme.colors.success[500]} strokeWidth={2} />}
            title="단축 URL"
            steps={[
              '결과 화면에서 단축 URL이 자동 생성되어 제휴 링크가 인코딩됩니다',
              '단축 URL은 공유하기 편리하고 링크 클릭수를 추적할 수 있습니다',
              '링크 클릭수는 분석 탭에 자동으로 집계됩니다',
            ]}
          />
          <Divider />
          <UsageGuide
            icon={<Clapperboard size={20} color={theme.colors.accent[400]} strokeWidth={2} />}
            title="만화 숏폼 & 멀티 업로드 꿀팁"
            steps={[
              '결과 화면에서 "만화 숏폼" 버튼을 탭합니다',
              '만화 무드 템플릿(귀여운 웹툰/시크한 느와르/세일 팝업/레트로/프리미엄 미니멀/에너지 팝아트)을 선택합니다',
              '컷 분할(싱글/2컷/3컷)을 선택하면 컷 수에 따라 영상 길이가 자동 추천됩니다 (1컷 10초, 2컷 15초, 3컷 20초)',
              '영상 길이(10초/15초/20초/30초)를 직접 선택할 수도 있습니다',
              'AI 내레이션 더빙, 감정 표정 오버레이, MBTI 맞춤형 해설을 추가할 수 있습니다',
              '생성 버튼을 탭하면 AI가 만화 숏폼을 자동으로 완성합니다',
              '완성 화면에서 틱톡·인스타·쇼츠 버튼으로 각 플랫폼에 바로 공유할 수 있습니다',
              '완성 화면의 멀티 업로드 꿀팁 박스에서 화면 비율(9:16), 핵심 텍스트 위치, 영상 길이(60초 이하) 조언을 확인하세요',
              '갤러리 저장 또는 클라우드 저장 후 세 플랫폼에 동시 업로드하면 최고의 마케팅 효과를 얻을 수 있습니다',
            ]}
          />
          <Divider />
          <UsageGuide
            icon={<Share2 size={20} color={theme.colors.success[500]} strokeWidth={2} />}
            title="SNS 공유 아코디언 사용법"
            steps={[
              '결과 화면 하단의 "SNS 원터치 공유" 헤더를 탭합니다',
              '버튼들이 부드러운 애니메이션과 함께 펼쳐집니다 (기본은 접혀 있음)',
              '네이버클립, 네이버TV, 인스타, 카카오톡, 블로그 버튼 중 하나를 탭합니다',
              '홍보 문구와 캡처 이미지가 클립보드에 복사되고 해당 SNS가 열립니다',
              'SNS에서 붙여넣기(Ctrl+V)만 하면 글과 이미지가 한 번에 업로드됩니다',
              '제휴 링크 복사, 갤러리 저장, 클라우드 저장 버튼은 항상 보이는 상태로 유지됩니다',
              '헤더를 다시 탭하면 공유 버튼이 접혀서 화면을 깔끔하게 만듭니다',
            ]}
          />
          <Divider />
          <UsageGuide
            icon={<Lightbulb size={20} color={theme.colors.warning[400]} strokeWidth={2} />}
            title="멀티 업로드 꿀팁"
            steps={[
              '화면 비율 9:16: 1080x1920 세로 비율로 스마트폰 전체 화면에 딱 맞습니다',
              '핵심 텍스트 위치: 릴스·틱톡·쇼츠는 좋아요 버튼과 댓글창이 하단에 겹쳐 표시되므로, 중요한 상품명이나 후킹 문구는 상단·정중앙에 배치하는 것이 좋습니다',
              '영상 길이 60초 이하: 세 플랫폼에 동시 업로드할 때 60초 이하로 유지하면 알고리즘 노출에 유리합니다',
              '만화 숏폼 완성 화면에서 이 꿀팁이 자동으로 표시됩니다',
            ]}
          />
          <Divider />
          <UsageGuide
            icon={<Flame size={20} color={theme.colors.error[400]} strokeWidth={2} />}
            title="인기 상품 탭"
            steps={[
              '인기 상품 탭에서 현재 트렌드인 키워드를 확인합니다',
              '네이버 쇼핑 인기 검색어와 실시간 트렌드를 볼 수 있습니다',
              '트렌드 키워드를 탭하면 관련 상품을 바로 검색합니다',
            ]}
          />
          <Divider />
          <UsageGuide
            icon={<FolderOpen size={20} color={theme.colors.accent[300]} strokeWidth={2} />}
            title="내 제작물 관리"
            steps={[
              '내 제작물 탭에서 저장한 모든 카드와 캐러셀을 확인합니다',
              '제작물을 탭하면 원본 결과 페이지로 이동합니다',
              '불필요한 제작물은 스와이프 또는 삭제 버튼으로 제거할 수 있습니다',
            ]}
          />
          <Divider />
          <UsageGuide
            icon={<BarChart3 size={20} color={theme.colors.primary[300]} strokeWidth={2} />}
            title="통합 분석 대시보드"
            steps={[
              '분석 탭에서 제품 분석부터 수익까지 전체 성과를 한눈에 봅니다',
              '성과 퍼널에서 각 단계별 전환율과 이탈률을 확인합니다',
              '일별 클릭 추이 차트로 트래픽 패턴을 파악합니다',
              '플랫폼별 수익과 클릭수를 비교합니다',
              '성과가 높은 콘텐츠를 탭하면 해당 결과 페이지로 이동합니다',
            ]}
          />
          <Divider />
          <UsageGuide
            icon={<CalendarDays size={20} color={theme.colors.success[400]} strokeWidth={2} />}
            title="계정 육성 (웜업)"
            steps={[
              '육성 탭에서 "웜업 스케줄 만들기" 버튼을 탭합니다',
              '플랫폼(인스타/틱톡/트위터/블로그)과 계정 이름, 웜업 기간(7~30일)을 선택합니다',
              '스케줄을 생성하면 일자별 체크리스트가 자동으로 만들어집니다',
              '1~3일차는 게시물 없이 좋아요와 댓글로 활동을 알립니다 (안정화 단계)',
              '4~7일차는 게시물 업로드를 시작하고 관련 계정과 소통합니다 (기초 체력 단계)',
              '8일차 이후부터 본격적으로 게시물에 제휴 링크를 포함합니다 (본격 활동 단계)',
              '매일 완료한 활동을 체크하면 진행률이 자동으로 업데이트됩니다',
              '일시정지/재개 버튼으로 스케줄을 잠시 멈추거나 다시 시작할 수 있습니다',
              '하단 웜업 가이드라인에서 계정 성장 팁을 확인하세요',
            ]}
          />
          <Divider />
          <UsageGuide
            icon={<Shirt size={20} color={theme.colors.accent[400]} strokeWidth={2} />}
            title="가상 피팅 & 컷 갤러리 활용"
            steps={[
              '결과 화면 상단에서 "가상 피팅"과 "가상 컷" 섹션을 확인합니다',
              '가상 피팅: 의류나 액세서리 상품을 AI가 다양한 착용 장면으로 생성합니다',
              '가상 컷: 상품을 스튜디오, 자연, 매장 등 다양한 배경에서 촬영한 컷을 생성합니다',
              '생성된 이미지를 탭하면 확대해서 확인할 수 있습니다',
              '"이 이미지 사용" 버튼으로 원하는 이미지를 메인으로 설정합니다',
              '선택한 이미지가 숏폼 카드, 캐러셀, 숏폼 영상에 자동 반영됩니다',
              '여러 컷을 조합하여 캐러셀이나 영상으로 제작하면 풍부한 콘텐츠가 됩니다',
            ]}
          />
          <Divider />
          <UsageGuide
            icon={<Wand2 size={20} color={theme.colors.warning[400]} strokeWidth={2} />}
            title="AI 스타일 추천 활용"
            steps={[
              '결과 화면에서 "AI 스타일" 섹션을 확인합니다',
              'AI가 상품 카테고리와 분위기에 맞는 디자인 스타일을 자동 추천합니다',
              '추천 스타일을 탭하면 숏폼 카드에 즉시 적용됩니다',
              '스타일 적용 시 텍스트 배치, 색상 테마, 폰트가 자동으로 조정됩니다',
              '여러 스타일을 비교해보고 가장 마음에 드는 것을 선택하세요',
            ]}
          />
          <Divider />
          <UsageGuide
            icon={<Target size={20} color={theme.colors.error[400]} strokeWidth={2} />}
            title="바이럴 예측 & 페르소나 시뮬레이터"
            steps={[
              '결과 화면에서 "바이럴 예측" 섹션에서 콘텐츠의 바이럴 점수를 확인합니다',
              '후킹력, 트렌드 적합도, 공유 가능성을 종합한 점수가 표시됩니다',
              '개선 제안을 확인하고 카피나 스타일을 수정하면 점수가 재계산됩니다',
              '"페르소나 시뮬레이터"에서 타겟 고객의 연령, 성별, 관심사를 선택합니다',
              'AI가 해당 페르소나 관점에서 예상 반응과 구매 확률을 시뮬레이션합니다',
              '주요 어필 포인트를 확인하고 마케팅 카피에 반영하세요',
            ]}
          />
          <Divider />
          <UsageGuide
            icon={<Globe size={20} color={theme.colors.primary[400]} strokeWidth={2} />}
            title="글로벌 현지화"
            steps={[
              '결과 화면에서 "글로벌 현지화" 섹션을 확인합니다',
              '번역할 국가(영어, 일본어, 중국어 등)를 선택합니다',
              'AI가 마케팅 카피를 단순 번역이 아닌 현지화하여 생성합니다',
              '각국 SNS 트렌드와 문화에 맞는 톤앤매너가 자동 반영됩니다',
              '국가별 인기 해시태그도 함께 추천됩니다',
              '번역된 카피를 탭하면 클립보드에 복사되어 바로 사용할 수 있습니다',
            ]}
          />
          <Divider />
          <UsageGuide
            icon={<Shuffle size={20} color={theme.colors.success[500]} strokeWidth={2} />}
            title="멀티 플랫폼 익스포트"
            steps={[
              '결과 화면에서 "멀티 플랫폼 익스포트" 섹션을 확인합니다',
              '인스타그램, 틱톡, 유튜브 쇼츠 세 플랫폼 맞춤 이미지를 한 번에 생성합니다',
              '각 플랫폼별 최적 화면 비율과 텍스트 위치가 자동 조정됩니다',
              '플랫폼별 권장 해시태그와 캡션 스타일이 자동 적용됩니다',
              '생성된 이미지를 각 플랫폼에 맞춰 개별 저장할 수 있습니다',
              '세 플랫폼에 동시 업로드하여 노출을 극대화하세요',
            ]}
          />
          <Divider />
          <UsageGuide
            icon={<TrendingUp size={20} color={theme.colors.accent[400]} strokeWidth={2} />}
            title="트렌드 매칭 & 트렌드 카피"
            steps={[
              '결과 화면에서 "트렌드 매칭" 섹션을 확인합니다',
              'AI가 현재 SNS에서 유행하는 키워드와 상품을 자동 매칭합니다',
              '실시간 트렌드 키워드를 탭하면 관련 마케팅 카피가 자동 생성됩니다',
              '"트렌드 카피" 바에서 상품명과 카테고리를 바탕으로 유행 문구를 추천받습니다',
              '추천된 문구를 탭하면 마케팅 카피에 즉시 적용됩니다',
              '시의성 있는 콘텐츠로 알고리즘 노출을 높이세요',
            ]}
          />
          <Divider />
          <UsageGuide
            icon={<Store size={20} color={theme.colors.warning[400]} strokeWidth={2} />}
            title="내 가게 정보 등록"
            steps={[
              '결과 화면에서 "내 가게 정보" 섹션을 확인합니다',
              '매장 이름, 주소, 영업시간, 전화번호를 입력합니다',
              '등록한 정보가 숏폼 카드와 공유 콘텐츠에 자동으로 포함됩니다',
              '고객이 콘텐츠를 보고 매장 위치를 바로 확인할 수 있습니다',
              '온라인 제휴 링크와 오프라인 매장 정보를 함께 홍보하세요',
            ]}
          />
          <Divider />
          <UsageGuide
            icon={<Video size={20} color={theme.colors.error[400]} strokeWidth={2} />}
            title="비디오 임포트"
            steps={[
              '결과 화면에서 "비디오 임포트" 기능을 사용합니다',
              '기존에 촬영한 영상을 불러와 숏폼 콘텐츠로 변환합니다',
              '영상에서 핵심 구간을 자동 추출하여 숏폼으로 만듭니다',
              '추출된 구간에 텍스트와 스티커를 추가할 수 있습니다',
              '기존 영상 자산을 재활용하여 콘텐츠 제작 시간을 단축하세요',
            ]}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>플랫폼별 영상 게시 방법</Text>
        <Text style={styles.sectionDesc}>
          완성된 숏폼 영상을 각 플랫폼에 업로드하는 방법을 단계별로 설명합니다
        </Text>
        <View style={styles.card}>
          <UsageGuide
            icon={<Music2 size={20} color="#000000" strokeWidth={2} />}
            title="틱톡 (TikTok) 업로드"
            steps={[
              '완성 화면에서 "틱톡" 공유 버튼을 탭하거나, 갤러리에 저장한 영상을 사용합니다',
              '틱톡 앱을 실행하고 하단 중앙의 "+" 버튼을 탭합니다',
              '갤러리에서 저장한 숏폼 영상을 선택합니다',
              '편집 화면에서 텍스트, 스티커, 효과를 추가할 수 있습니다 (선택사항)',
              '다음 버튼을 탭하고 영상 제목(캡션)을 입력합니다',
              '관련 해시태그를 추가합니다 (앱에서 추천받은 해시태그 활용)',
              '제휴 링크는 틱톡 프로필 바이오에 넣거나, 댓글에 고정하는 것이 효과적입니다',
              '공개 범위를 "공개"로 설정하고 게시 버튼을 탭합니다',
            ]}
          />
          <Divider />
          <UsageGuide
            icon={<Instagram size={20} color="#E1306C" strokeWidth={2} />}
            title="인스타그램 릴스 (Instagram Reels) 업로드"
            steps={[
              '완성 화면에서 "인스타" 공유 버튼을 탭하거나, 갤러리에 저장한 영상을 사용합니다',
              '인스타그램 앱을 실행하고 하단의 "+" 버튼을 탭한 후 "릴스"를 선택합니다',
              '갤러리에서 저장한 숏폼 영상을 선택합니다',
              '음악 추가: 인스타그램 내장 음악이나 원본 영상의 오디오를 선택합니다',
              '필요시 텍스트 스티커를 추가합니다 (상품명이나 후킹 문구를 화면에 표시)',
              '다음 버튼을 탭하고 캡션을 입력합니다',
              '제휴 링크는 캡션에 직접 넣거나, 프로필 바이오 링크를 통해 유도합니다',
              '관련 해시태그를 추가하고 "공개"로 설정한 후 공유 버튼을 탭합니다',
              '릴스 업로드 후 프로필의 "링크" 버튼에 제휴 링크를 등록해 두면 클릭률이 높아집니다',
            ]}
          />
          <Divider />
          <UsageGuide
            icon={<Youtube size={20} color="#FF0000" strokeWidth={2} />}
            title="유튜브 쇼츠 (YouTube Shorts) 업로드"
            steps={[
              '완성 화면에서 "쇼츠" 공유 버튼을 탭하거나, 갤러리에 저장한 영상을 사용합니다',
              '유튜브 앱을 실행하고 하단 중앙의 "+" 버튼을 탭한 후 "쇼츠 만들기"를 선택합니다',
              '갤러리에서 저장한 숏폼 영상을 선택합니다',
              '편집 화면에서 텍스트, 필터, 음악을 추가할 수 있습니다 (선택사항)',
              '다음 버튼을 탭하고 영상 제목을 입력합니다',
              '제목에 #Shorts 해시태그를 포함하면 쇼츠 피드에 더 잘 노출됩니다',
              '제휴 링크는 영상 설명란에 넣거나, 채널 프로필 링크에 등록합니다',
              '공개 설정을 "공개"로 하고 업로드 버튼을 탭합니다',
            ]}
          />
          <Divider />
          <UsageGuide
            icon={<Share2 size={20} color={theme.colors.success[500]} strokeWidth={2} />}
            title="네이버클립 & 카카오톡 공유"
            steps={[
              '네이버클립: 완성 화면에서 "공유" 버튼을 탭하면 홍보 문구와 이미지가 클립보드에 복사됩니다',
              '네이버클립 앱 또는 네이버TV에서 새 클립 만들기를 선택합니다',
              '저장한 영상을 업로드하고 복사된 홍보 문구를 붙여넣습니다',
              '카카오톡: 공유 버튼으로 메시지에 이미지와 링크를 함께 보낼 수 있습니다',
              '카카오톡 채널이나 오픈채팅방에 영상과 제휴 링크를 공유하면 직접 클릭 유도가 가능합니다',
            ]}
          />
          <Divider />
          <UsageGuide
            icon={<Lightbulb size={20} color={theme.colors.warning[400]} strokeWidth={2} />}
            title="멀티 플랫폼 동시 업로드 전략"
            steps={[
              '하나의 숏폼 영상을 틱톡, 인스타 릴스, 유튜브 쇼츠 세 곳에 모두 업로드하면 노출이 3배 늘어납니다',
              '각 플랫폼마다 캡션과 해시태그를 조금씩 다르게 작성하는 것이 알고리즘에 유리합니다',
              '틱톡은 트렌드 해시태그, 인스타는 상품 관련 해시태그, 쇼츠는 #Shorts를 함께 사용하세요',
              '제휴 링크는 각 플랫폼의 프로필 바이오에 동일하게 등록해 두면 관리가 편합니다',
              '업로드 시간대는 저녁 6시~10시(한국 시간)가 가장 시청률이 높습니다',
              '영상 길이는 15~30초로 설정하면 시청 지속 시간이 충분하면서도 알고리즘 노출에 유리합니다',
            ]}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>도움말</Text>
        <View style={styles.card}>
          <FeatureRow
            icon={<Info size={20} color={theme.colors.dark.textDim} strokeWidth={2} />}
            title="사용 방법"
            desc="사진을 찍거나 업로드하면 AI가 제품을 분석합니다. 결과 화면에서 쇼핑 매칭, 숏폼 카드, 공유를 한 번에 이용하세요."
          />
          <Divider />
          <FeatureRow
            icon={<Link2 size={20} color={theme.colors.accent[400]} strokeWidth={2} />}
            title="수수료 링크 적용"
            desc="결과 화면에서 '내 수수료 링크 붙여넣기' 버튼으로 브랜드커넥트 링크를 적용하세요. 공유와 카드에 자동 반영됩니다."
          />
          <Divider />
          <TouchableOpacity
            style={styles.feedbackRow}
            onPress={() => setShowOnboarding(true)}
            activeOpacity={0.7}
          >
            <View style={styles.featureIconWrap}>
              <Sparkles size={20} color={theme.colors.primary[400]} strokeWidth={2} />
            </View>
            <View style={styles.featureBody}>
              <Text style={styles.featureTitle}>앱 둘러보기 다시 보기</Text>
              <Text style={styles.featureDesc}>처음 안내를 다시 확인하고 싶다면 눌러주세요</Text>
            </View>
            <ChevronRight size={18} color={theme.colors.dark.textDim} strokeWidth={2} />
          </TouchableOpacity>
        </View>
      </View>

      <OnboardingModal
        visible={showOnboarding}
        onComplete={() => setShowOnboarding(false)}
      />

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>피드백 & 오류 신고</Text>
        <Text style={styles.sectionDesc}>
          사용 중 불편한 점이나 오류를 발견하면 알려주세요. 여러분의 의견이 앱을 더 좋게 만듭니다.
        </Text>
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.feedbackRow}
            onPress={() => Linking.openURL('https://forms.gle/shortconnect-feedback').catch(() => {})}
            activeOpacity={0.7}
          >
            <View style={styles.featureIconWrap}>
              <MessageSquare size={20} color={theme.colors.accent[400]} strokeWidth={2} />
            </View>
            <View style={styles.featureBody}>
              <Text style={styles.featureTitle}>의견 보내기</Text>
              <Text style={styles.featureDesc}>구글 설문지로 피드백을 남겨주세요</Text>
            </View>
            <ExternalLink size={18} color={theme.colors.dark.textDim} strokeWidth={2} />
          </TouchableOpacity>
          <Divider />
          <TouchableOpacity
            style={styles.feedbackRow}
            onPress={() => Linking.openURL('https://open.kakao.com/o/shortconnect').catch(() => {})}
            activeOpacity={0.7}
          >
            <View style={styles.featureIconWrap}>
              <Bug size={20} color={theme.colors.error[400]} strokeWidth={2} />
            </View>
            <View style={styles.featureBody}>
              <Text style={styles.featureTitle}>오류 신고 & 오픈채팅</Text>
              <Text style={styles.featureDesc}>카카오톡 오픈채팅방에서 빠르게 도움받기</Text>
            </View>
            <ExternalLink size={18} color={theme.colors.dark.textDim} strokeWidth={2} />
          </TouchableOpacity>
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

function FeatureRow({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <View style={styles.featureRow}>
      <View style={styles.featureIconWrap}>{icon}</View>
      <View style={styles.featureBody}>
        <Text style={styles.featureTitle} numberOfLines={2}>{title}</Text>
        <Text style={styles.featureDesc}>{desc}</Text>
      </View>
    </View>
  );
}

function Divider() {
  return <View style={styles.divider} />;
}

function UsageGuide({
  icon,
  title,
  steps,
}: {
  icon: React.ReactNode;
  title: string;
  steps: string[];
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <View>
      <TouchableOpacity
        style={styles.usageHeader}
        onPress={() => setExpanded((v) => !v)}
        activeOpacity={0.7}
      >
        <View style={styles.featureIconWrap}>{icon}</View>
        <Text style={styles.featureTitle} numberOfLines={2}>{title}</Text>
        <ChevronDown
          size={18}
          color={theme.colors.dark.textDim}
          strokeWidth={2}
          style={{ transform: [{ rotate: expanded ? '180deg' : '0deg' }] }}
        />
      </TouchableOpacity>
      {expanded && (
        <View style={styles.usageSteps}>
          {steps.map((step, i) => (
            <View key={i} style={styles.usageStepRow}>
              <View style={styles.usageStepBadge}>
                <Text style={styles.usageStepNum}>{i + 1}</Text>
              </View>
              <Text style={styles.usageStepText}>{step}</Text>
            </View>
          ))}
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
  centerContainer: {
    flex: 1,
    backgroundColor: theme.colors.dark.bg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    paddingBottom: 140,
    maxWidth: 600,
    alignSelf: 'center',
    width: '100%',
  },
  header: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: theme.spacing.xl,
  },
  logoWrap: {
    width: 64,
    height: 64,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.primary[500] + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  appName: {
    fontSize: theme.typography.heading,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.dark.text,
  },
  appTagline: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.primary[400],
    marginTop: 4,
  },
  appVersion: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textFaint,
    marginTop: 4,
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
});
