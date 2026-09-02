import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  TextInput,
  Modal,
  LayoutAnimation,
  Platform,
  UIManager,
  ViewStyle,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Flame, Zap, ArrowRight, Settings, Check, Lightbulb, Clock, Type, Music, Film, Sparkles, X, Store, Tag, TrendingUp, PenLine, ChevronDown, ChevronUp, Mic, Square, Trash2, Play, Save, Video, Camera, Clapperboard, Download, Shirt, Wand as Wand2, Image as ImageIcon } from 'lucide-react-native';
import { Image } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { theme } from '@/lib/theme';
import { useSafeTop } from '@/hooks/useSafeTop';
import { useTabBarHeight } from '@/hooks/useTabBarHeight';
import { getItem, setItem } from '@/lib/storage';
import { getUserSettings } from '@/lib/settings';
import { useVoiceRecording } from '@/hooks/useVoiceRecording';
import { PillNavCard } from '@/components/PillNavCard';
import { VirtualFitting } from '@/components/VirtualFitting';
import { AIImageComposite } from '@/components/AIImageComposite';
import { RoadmapPreview } from '@/components/RoadmapPreview';

const MAX_PROMPT_LENGTH = 200;
const MAX_STORE_INPUT_LENGTH = 80;

function sanitizeTextInput(raw: string, maxLength: number): string {
  const stripped = raw
    .replace(/<\/?[a-zA-Z][^>]*>/g, '')
    .replace(/[<>]/g, '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  return stripped.slice(0, maxLength);
}

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
  { key: 'none', label: '자막 전용', desc: '음악 없음', icon: Type, color: theme.colors.dark.textFaint },
] as const;

const WAVEFORM_BARS = Array.from({ length: 28 }, (_, i) => i);

function getWaveformHeight(index: number, duration: number): number {
  const seed = (index * 7 + duration * 13) % 10;
  const base = 8 + (seed * 3);
  return Math.min(base + (duration > 0 ? (index % 3) * 4 : 0), 40);
}

function getWaveformOpacity(index: number, duration: number): number {
  const activeBars = Math.min(Math.floor(duration * 4), 28);
  return index < activeBars ? 1 : 0.25;
}

const BUSINESS_TYPES = [
  { key: 'fnb', label: 'F&B / 음식점', icon: Store, color: theme.colors.warning[400] },
  { key: 'beauty', label: '뷰티 / 미용', icon: Sparkles, color: theme.colors.accent[400] },
  { key: 'retail', label: '로컬 숍 / 소매', icon: Tag, color: theme.colors.primary[400] },
] as const;

export default function MarketingScreen() {
  const router = useRouter();
  const safeTop = useSafeTop();
  const tabBarHeight = useTabBarHeight();
  const [advancedVisible, setAdvancedVisible] = useState(false);
  const [storeName, setStoreName] = useState('');
  const [signatureMenu, setSignatureMenu] = useState('');
  const [promoText, setPromoText] = useState('');
  const [storeSaved, setStoreSaved] = useState(false);
  const [videoLength, setVideoLength] = useState('15s');
  const [captionTone, setCaptionTone] = useState('hook');
  const [bgmMood, setBgmMood] = useState('pop');
  const [watermarkEnabled, setWatermarkEnabled] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedHook, setSelectedHook] = useState<string | null>(null);
  const [manualPromptOpen, setManualPromptOpen] = useState(false);
  const [customPrompt, setCustomPrompt] = useState('');
  const [marketingStep, setMarketingStep] = useState<string | null>('store');
  const [selectedBusinessType, setSelectedBusinessType] = useState<string>('fnb');
  const [aiVideoGenEnabled, setAiVideoGenEnabled] = useState(false);
  const [aiFittingEnabled, setAiFittingEnabled] = useState(false);
  const [aiFittingImage, setAiFittingImage] = useState<string | null>(null);
  const [aiCompositeImage, setAiCompositeImage] = useState<string | null>(null);
  const [productionMode, setProductionMode] = useState<'template' | 'video'>('template');
  const lastActionRef = useRef(0);
  const voice = useVoiceRecording();
  const [voiceDataUrl, setVoiceDataUrl] = useState<string | null>(null);
  const [voicePlaying, setVoicePlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const STORE_HOOK_CHIPS = [
    { key: 'new_menu', label: '오늘 우리 동네 신메뉴 특가!', icon: Store, color: theme.colors.warning[400] },
    { key: 'limited', label: '재료 소진 전 마지막 기회', icon: Flame, color: theme.colors.error[400] },
    { key: 'best_seller', label: '이 동네 1위 베스트셀러', icon: TrendingUp, color: theme.colors.primary[400] },
    { key: 'seasonal', label: '계절 한정! 이맘때만 맛볼 수 있어요', icon: Tag, color: theme.colors.accent[400] },
    { key: 'combo', label: '꿀조합 발견! 같이 시키면 최고', icon: Sparkles, color: theme.colors.success[400] },
  ] as const;

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
        const savedStoreName = await getItem('marketing_store_name');
        const savedMenu = await getItem('marketing_signature_menu');
        const savedPromo = await getItem('marketing_promo_text');
        if (savedStoreName) setStoreName(savedStoreName);
        if (savedMenu) setSignatureMenu(savedMenu);
        if (savedPromo) setPromoText(savedPromo);
        const savedMode = await getItem('marketing_production_mode');
        if (savedMode === 'video' || savedMode === 'template') setProductionMode(savedMode);
      } catch {}
    })();
  }, []);

  const handleModeSwitch = async (mode: 'template' | 'video') => {
    setProductionMode(mode);
    try { await setItem('marketing_production_mode', mode); } catch {}
  };

  const voiceCommandHandledRef = useRef(false);
  const voiceAutoGenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingVoiceGenRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        if (voiceCommandHandledRef.current) return;
        try {
          const active = await getItem('marketing_voice_command_active');
          if (active !== 'true') return;

          const promptText = await getItem('marketing_voice_command_prompt');
          const intent = await getItem('marketing_voice_command_intent');

          await setItem('marketing_voice_command_active', 'false');
          voiceCommandHandledRef.current = true;

          if (cancelled) return;
          if (promptText && promptText.trim()) {
            setCustomPrompt(promptText.trim());
            setManualPromptOpen(true);

            const capturedImage = await getItem('marketing_voice_captured_image');
            const capturedMime = await getItem('marketing_voice_captured_mime');
            if (capturedImage) {
              await setItem('marketing_voice_image', capturedImage);
              await setItem('marketing_voice_image_mime', capturedMime || 'image/jpeg');
              await setItem('marketing_voice_captured_image', '');
              await setItem('marketing_voice_captured_mime', '');
            }

            const intentHookMap: Record<string, string> = {
              closing: 'limited',
              new_menu: 'new_menu',
              discount: 'new_menu',
              service: 'combo',
              best_seller: 'best_seller',
            };
            if (intent && intentHookMap[intent]) {
              setSelectedHook(intentHookMap[intent]);
            }

            const savedStore = await getItem('marketing_store_name');
            if (!savedStore) {
              setPromoText(promptText.trim());
            }

            pendingVoiceGenRef.current = true;
          }
        } catch {}
      })();
      return () => {
        cancelled = true;
        voiceCommandHandledRef.current = false;
        if (voiceAutoGenTimerRef.current) {
          clearTimeout(voiceAutoGenTimerRef.current);
          voiceAutoGenTimerRef.current = null;
        }
        pendingVoiceGenRef.current = false;
      };
    }, []),
  );

  const canGenerate = storeName.trim().length > 0 || signatureMenu.trim().length > 0;

  useEffect(() => {
    if (!pendingVoiceGenRef.current) return;
    if (!customPrompt.trim()) return;
    if (!canGenerate) return;
    pendingVoiceGenRef.current = false;
    voiceAutoGenTimerRef.current = setTimeout(() => {
      voiceAutoGenTimerRef.current = null;
      lastActionRef.current = 0;
      handleStartGeneration();
    }, 1200);
  }, [customPrompt, selectedHook, canGenerate]);

  const handleVoiceRecord = async () => {
    if (voice.state === 'recording') {
      const dataUrl = await voice.stop();
      if (dataUrl) setVoiceDataUrl(dataUrl);
    } else {
      setVoiceDataUrl(null);
      await voice.start();
    }
  };

  const handleVoicePlay = () => {
    if (!voiceDataUrl) return;
    if (voicePlaying) {
      audioRef.current?.pause();
      setVoicePlaying(false);
    } else {
      if (Platform.OS === 'web') {
        if (!audioRef.current) {
          audioRef.current = new Audio(voiceDataUrl);
          audioRef.current.onended = () => setVoicePlaying(false);
        } else {
          audioRef.current.src = voiceDataUrl;
        }
        audioRef.current.play().catch(() => setVoicePlaying(false));
        setVoicePlaying(true);
      }
    }
  };

  const handleVoiceDelete = () => {
    setVoiceDataUrl(null);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setVoicePlaying(false);
  };

  const handleStartGeneration = async () => {
    const now = Date.now();
    if (now - lastActionRef.current < 800) return;
    lastActionRef.current = now;

    setGenerating(true);
    try {
      await setItem('marketing_store_name', storeName.trim());
      await setItem('marketing_signature_menu', signatureMenu.trim());
      await setItem('marketing_promo_text', promoText.trim());
      await setItem('marketing_video_length', videoLength);
      await setItem('marketing_caption_tone', captionTone);
      await setItem('marketing_bgm_mood', bgmMood);
      await setItem('marketing_watermark', watermarkEnabled ? 'true' : 'false');
      await setItem('marketing_handoff', 'false');
      await setItem('marketing_capture_mode', 'oneclick');
      try {
        const settings = await getUserSettings();
        if (settings?.brand_persona) {
          await setItem('marketing_brand_persona', settings.brand_persona);
        }
        if (settings?.fixed_hook_phrase) {
          await setItem('marketing_fixed_hook', settings.fixed_hook_phrase);
        }
      } catch {}
      if (customPrompt.trim()) {
        await setItem('marketing_custom_prompt', customPrompt.trim());
        await setItem('marketing_selected_hook', customPrompt.trim());
      } else {
        await setItem('marketing_custom_prompt', '');
        if (selectedHook) {
          await setItem('marketing_selected_hook', selectedHook);
        }
      }
      await setItem('marketing_affiliate_priority', 'false');
      await setItem('marketing_ai_video_gen', aiVideoGenEnabled ? 'true' : 'false');
      await setItem('marketing_ai_fitting', aiFittingEnabled ? 'true' : 'false');
      if (aiFittingImage) {
        await setItem('marketing_ai_fitting_image', aiFittingImage);
      }
      if (aiCompositeImage) {
        await setItem('marketing_ai_composite_image', aiCompositeImage);
      }
      if (voiceDataUrl) {
        await setItem('marketing_voice_recording', voiceDataUrl);
      } else {
        await setItem('marketing_voice_recording', '');
      }
      const voiceImage = await getItem('marketing_voice_image');
      const voiceImageMime = await getItem('marketing_voice_image_mime');
      if (voiceImage) {
        await setItem('marketing_selected_image', voiceImage);
        await setItem('marketing_selected_image_mime', voiceImageMime || 'image/jpeg');
      }
      router.replace('/(tabs)/');
    } catch {
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveStoreInfo = async () => {
    try {
      await setItem('marketing_store_name', storeName.trim());
      await setItem('marketing_signature_menu', signatureMenu.trim());
      await setItem('marketing_promo_text', promoText.trim());
      setStoreSaved(true);
      setTimeout(() => setStoreSaved(false), 2000);
    } catch {}
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingTop: safeTop + theme.spacing.lg, paddingBottom: tabBarHeight + 120 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => setRefreshing(false)} tintColor={theme.colors.primary[400]} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.headerIcon}>
              <Clapperboard size={24} color={theme.colors.primary[300]} strokeWidth={2.5} />
            </View>
            <View>
              <Text style={styles.headerTitle}>숏폼 제작</Text>
              <Text style={styles.headerSub}>매장 홍보 15초 숏폼 올인원 프로덕션</Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.settingsBtn}
            onPress={() => setAdvancedVisible(true)}
            activeOpacity={0.7}
          >
            <Settings size={22} color={theme.colors.dark.textDim} strokeWidth={2} />
          </TouchableOpacity>
        </View>

        {/* V2 Roadmap Preview */}
        <RoadmapPreview />

        {/* Mode Switcher */}
        <View style={styles.modeSwitcherWrap}>
          <Text style={styles.modeSwitcherLabel}>제작 모드 선택</Text>
          <View style={styles.modeSwitcher}>
            <TouchableOpacity
              style={[styles.modeTab, productionMode === 'template' && styles.modeTabActive]}
              onPress={() => handleModeSwitch('template')}
              activeOpacity={0.7}
            >
              <Sparkles size={18} color={productionMode === 'template' ? '#fff' : theme.colors.dark.textDim} strokeWidth={2.5} />
              <Text style={[styles.modeTabText, productionMode === 'template' && styles.modeTabTextActive]}>템플릿 모드</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeTab, productionMode === 'video' && styles.modeTabActiveVideo]}
              onPress={() => handleModeSwitch('video')}
              activeOpacity={0.7}
            >
              <Video size={18} color={productionMode === 'video' ? '#fff' : theme.colors.dark.textDim} strokeWidth={2.5} />
              <Text style={[styles.modeTabText, productionMode === 'video' && styles.modeTabTextActive]}>동영상 촬영 모드</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.modeHint}>
            {productionMode === 'template'
              ? 'AI 심리 템플릿과 가상영상/가상핏 옵션에만 집중합니다. 촬영 기능은 숨겨집니다.'
              : '현장감 있는 영상 촬영에만 집중합니다. 템플릿·성우·심리 전략은 숨겨집니다.'}
          </Text>
        </View>

        {/* === VIDEO MODE: Camera recording only === */}
        {productionMode === 'video' && (
          <View style={styles.videoModeContainer}>
            <View style={styles.videoModeCard}>
              <View style={[styles.videoModeIconWrap, { backgroundColor: theme.colors.error[500] + '20' }]}>
                <Video size={40} color={theme.colors.error[400]} strokeWidth={2.5} />
              </View>
              <Text style={styles.videoModeTitle}>동영상 직접 촬영</Text>
              <Text style={styles.videoModeDesc}>
                스마트폰 카메라로 현장감 있는 오프닝 영상을 촬영하세요. 촬영 후 숏폼에 바로 적용할 수 있습니다.
              </Text>
              <View style={styles.videoModeSpecRow}>
                <View style={styles.videoModeSpec}>
                  <Clock size={14} color={theme.colors.warning[400]} strokeWidth={2} />
                  <Text style={styles.videoModeSpecText}>최대 60초</Text>
                </View>
                <View style={styles.videoModeSpec}>
                  <Film size={14} color={theme.colors.accent[400]} strokeWidth={2} />
                  <Text style={styles.videoModeSpecText}>오프닝 후킹</Text>
                </View>
                <View style={styles.videoModeSpec}>
                  <Camera size={14} color={theme.colors.primary[300]} strokeWidth={2} />
                  <Text style={styles.videoModeSpecText}>직접 촬영</Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* === TEMPLATE MODE: AI template pipeline only === */}
        {productionMode === 'template' && (
          <>
        {/* Template 3-step pipeline */}
        <Text style={styles.sectionLabel}>템플릿 렌더링 파이프라인</Text>

        {/* STEP 1: Source Selection */}
        <PillNavCard
          icon={<Camera size={22} color={theme.colors.accent[400]} strokeWidth={2.5} />}
          title="소스 선택"
          subtitle="카메라 촬영 또는 매장/상품 이미지"
          accentColor={theme.colors.accent[400]}
          iconBg={theme.colors.accent[500] + '22'}
          stepNumber={1}
          completed={storeSaved}
          expanded={marketingStep === 'store'}
          onToggle={() => setMarketingStep(marketingStep === 'store' ? null : 'store')}
        >
          <Text style={styles.storeDesc}>가게 이름과 대표 메뉴만 적어도 AI가 알아서 숏폼을 만들어드려요</Text>

          {/* Business type selector */}
          <View style={styles.bizTypeRow}>
            {BUSINESS_TYPES.map((bt) => {
              const Icon = bt.icon;
              const selected = selectedBusinessType === bt.key;
              return (
                <TouchableOpacity
                  key={bt.key}
                  style={[styles.bizTypeChip, selected && { borderColor: bt.color, backgroundColor: bt.color + '15' }]}
                  onPress={() => setSelectedBusinessType(bt.key)}
                  activeOpacity={0.7}
                >
                  <Icon size={13} color={selected ? bt.color : theme.colors.dark.textDim} strokeWidth={2} />
                  <Text style={[styles.bizTypeText, selected && { color: bt.color }]}>{bt.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>매장 이름</Text>
            <TextInput
              style={styles.textInput}
              value={storeName}
              onChangeText={(t) => setStoreName(sanitizeTextInput(t, MAX_STORE_INPUT_LENGTH))}
              placeholder="예: 한승식당, 카페 블룸, 킹스버거"
              placeholderTextColor={theme.colors.dark.textFaint}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>대표 메뉴 / 상품</Text>
            <TextInput
              style={styles.textInput}
              value={signatureMenu}
              onChangeText={(t) => setSignatureMenu(sanitizeTextInput(t, MAX_STORE_INPUT_LENGTH))}
              placeholder="예: 명란 아보카도 비빔밥, 수제망고주스"
              placeholderTextColor={theme.colors.dark.textFaint}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>특가 / 홍보 멘트 (선택)</Text>
            <TextInput
              style={[styles.textInput, { minHeight: 70 }]}
              value={promoText}
              onChangeText={(t) => setPromoText(sanitizeTextInput(t, MAX_PROMPT_LENGTH))}
              placeholder="예: 오늘 저녁 한정 2천원 할인, 선찹순 10명 서비스 음료"
              placeholderTextColor={theme.colors.dark.textFaint}
              multiline
              textAlignVertical="top"
            />
          </View>

          <TouchableOpacity
            style={[styles.storeSaveBtn, storeSaved && styles.storeSaveBtnDone]}
            onPress={handleSaveStoreInfo}
            activeOpacity={0.8}
          >
            {storeSaved ? (
              <Check size={16} color="#fff" strokeWidth={2.5} />
            ) : (
              <Save size={16} color="#fff" strokeWidth={2.5} />
            )}
            <Text style={styles.storeSaveBtnText}>
              {storeSaved ? '저장됨' : '매장 정보 저장'}
            </Text>
          </TouchableOpacity>
        </PillNavCard>

        {/* STEP 2: AI Template Matching */}
        <PillNavCard
          icon={<Sparkles size={22} color={theme.colors.warning[400]} strokeWidth={2.5} />}
          title="AI 심리 템플릿 매칭"
          subtitle="업종별 후킹 문구 · 성우 보이스 자동 결합"
          accentColor={theme.colors.warning[400]}
          iconBg={theme.colors.warning[500] + '22'}
          stepNumber={2}
          completed={!!selectedHook || !!customPrompt.trim()}
          expanded={marketingStep === 'hook'}
          onToggle={() => setMarketingStep(marketingStep === 'hook' ? null : 'hook')}
        >
          <Text style={styles.hookDesc}>사장님 매장에 맞는 오프닝 문구를 선택하세요</Text>
          <View style={styles.hookChipRow}>
            {STORE_HOOK_CHIPS.map((chip) => {
              const Icon = chip.icon;
              const selected = selectedHook === chip.key;
              return (
                <TouchableOpacity
                  key={chip.key}
                  style={[styles.hookChip, selected && { borderColor: chip.color, backgroundColor: chip.color + '15' }]}
                  onPress={() => setSelectedHook(selected ? null : chip.key)}
                  activeOpacity={0.7}
                >
                  <Icon size={13} color={selected ? chip.color : theme.colors.dark.textDim} strokeWidth={2} />
                  <Text style={[styles.hookChipText, selected && { color: chip.color }]} numberOfLines={1}>{chip.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            style={styles.manualToggle}
            onPress={() => {
              if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
                UIManager.setLayoutAnimationEnabledExperimental(true);
              }
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setManualPromptOpen((v) => !v);
            }}
            activeOpacity={0.7}
          >
            <PenLine size={14} color={theme.colors.accent[400]} strokeWidth={2} />
            <Text style={styles.manualToggleText}>직접 프롬프트/문구 입력하기</Text>
            {manualPromptOpen ? (
              <ChevronUp size={16} color={theme.colors.dark.textDim} strokeWidth={2} />
            ) : (
              <ChevronDown size={16} color={theme.colors.dark.textDim} strokeWidth={2} />
            )}
          </TouchableOpacity>

          {manualPromptOpen && (
            <View style={styles.manualInputWrap}>
              <TextInput
                style={styles.manualInput}
                value={customPrompt}
                onChangeText={(t) => setCustomPrompt(sanitizeTextInput(t, MAX_PROMPT_LENGTH))}
                placeholder="예: 매콤한 아보카도 명란 비빔밥, 오늘 저녁 한정 2천원 할인, 선찹순 10명 서비스 음료 제공"
                placeholderTextColor={theme.colors.dark.textFaint}
                multiline
                textAlignVertical="top"
              />
              {customPrompt.trim().length > 0 && (
                <TouchableOpacity
                  style={styles.manualClearBtn}
                  onPress={() => setCustomPrompt('')}
                  activeOpacity={0.7}
                >
                  <X size={14} color={theme.colors.dark.textDim} strokeWidth={2} />
                  <Text style={styles.manualClearText}>지우기</Text>
                </TouchableOpacity>
              )}
              <Text style={[styles.manualHint, customPrompt.trim().length > 0 && { color: theme.colors.success[400] }]}>
                {customPrompt.trim().length > 0
                  ? '입력하신 문구가 AI 생성에 반영됩니다'
                  : 'AI가 놓친 가격·할인·강조 내용을 직접 넣으세요'}
              </Text>
            </View>
          )}

          {/* AI Source Enhancement Toggle Cards */}
          <Text style={styles.aiEnhanceLabel}>AI 소스 강화 (선택)</Text>

          {/* AI Virtual Video Generation */}
          <TouchableOpacity
            style={[styles.aiToggleCard, aiVideoGenEnabled && styles.aiToggleCardActive]}
            onPress={() => setAiVideoGenEnabled(!aiVideoGenEnabled)}
            activeOpacity={0.7}
          >
            <View style={[styles.aiToggleIconWrap, { backgroundColor: theme.colors.primary[500] + '20' }]}>
              <Wand2 size={20} color={theme.colors.primary[300]} strokeWidth={2.5} />
            </View>
            <View style={styles.aiToggleBody}>
              <Text style={styles.aiToggleTitle}>AI 가상영상 생성</Text>
              <Text style={styles.aiToggleDesc}>촬영 없이 AI가 매장 분위기 영상을 자동 생성해 숏폼 소스로 활용</Text>
            </View>
            <View style={[styles.toggleSwitch, aiVideoGenEnabled && styles.toggleSwitchActive]}>
              <View style={[styles.toggleKnob, aiVideoGenEnabled && styles.toggleKnobActive]} />
            </View>
          </TouchableOpacity>

          {/* AI Virtual Fitting */}
          <TouchableOpacity
            style={[styles.aiToggleCard, aiFittingEnabled && styles.aiToggleCardActive]}
            onPress={() => setAiFittingEnabled(!aiFittingEnabled)}
            activeOpacity={0.7}
          >
            <View style={[styles.aiToggleIconWrap, { backgroundColor: theme.colors.accent[500] + '20' }]}>
              <Shirt size={20} color={theme.colors.accent[400]} strokeWidth={2.5} />
            </View>
            <View style={styles.aiToggleBody}>
              <Text style={styles.aiToggleTitle}>AI 가상핏</Text>
              <Text style={styles.aiToggleDesc}>의류 사진과 모델 사진으로 가상 착장 합성, 뷰티·패션 숏폼에 활용</Text>
            </View>
            <View style={[styles.toggleSwitch, aiFittingEnabled && styles.toggleSwitchActive]}>
              <View style={[styles.toggleKnob, aiFittingEnabled && styles.toggleKnobActive]} />
            </View>
          </TouchableOpacity>

          {/* Virtual Fitting Panel */}
          {aiFittingEnabled && (
            <View style={styles.aiPanel}>
              <VirtualFitting onResult={(imgBase64: string) => setAiFittingImage(imgBase64)} />
            </View>
          )}

          {/* AI Image Composite Panel */}
          {aiVideoGenEnabled && (
            <View style={styles.aiPanel}>
              <AIImageComposite onResult={(imgBase64: string) => setAiCompositeImage(imgBase64)} />
            </View>
          )}
        </PillNavCard>

        {/* STEP 3: Voice Recording (optional) */}
        <PillNavCard
          icon={<Mic size={22} color={theme.colors.accent[400]} strokeWidth={2.5} />}
          title="내 목소리 얹기 (선택)"
          subtitle="짧은 녹음 → AI 잡음 제거 + BGM 믹싱"
          accentColor={theme.colors.accent[400]}
          iconBg={theme.colors.accent[500] + '22'}
          stepNumber={3}
          completed={!!voiceDataUrl}
          expanded={marketingStep === 'voice'}
          onToggle={() => setMarketingStep(marketingStep === 'voice' ? null : 'voice')}
        >
          <Text style={styles.voiceDesc}>짧게 한마디하면 AI가 잡음 제거 + BGM 믹싱으로 프로급 숏폼을 만들어드려요</Text>

          {Platform.OS !== 'web' ? (
            <View style={styles.voiceWebOnlyNotice}>
              <Text style={styles.voiceWebOnlyNoticeText}>
                음성 녹음은 웹 브라우저에서 지원됩니다. 모바일에서는 AI 보이스만 사용할 수 있어요.
              </Text>
            </View>
          ) : (
            <>
              {voice.error && (
                <View style={styles.voiceErrorBox}>
                  <Text style={styles.voiceErrorText}>{voice.error}</Text>
                </View>
              )}

              {!voiceDataUrl ? (
                <>
                  <TouchableOpacity
                    style={[
                      styles.voiceRecordBtn,
                      voice.state === 'recording' && styles.voiceRecordBtnActive,
                    ]}
                    onPress={handleVoiceRecord}
                    activeOpacity={0.8}
                  >
                    {voice.state === 'recording' ? (
                      <>
                        <Square size={20} color="#fff" fill="#fff" strokeWidth={2} />
                        <Text style={styles.voiceRecordBtnText}>녹음 중... {voice.duration}초</Text>
                      </>
                    ) : (
                      <>
                        <Mic size={20} color={theme.colors.accent[400]} strokeWidth={2.5} />
                        <Text style={[styles.voiceRecordBtnText, { color: theme.colors.accent[400] }]}>녹음 시작</Text>
                      </>
                    )}
                  </TouchableOpacity>
                  {voice.state === 'recording' && (
                    <View style={styles.waveformContainer}>
                      {WAVEFORM_BARS.map((_, i) => (
                        <View
                          key={i}
                          style={[
                            styles.waveformBar,
                            { height: getWaveformHeight(i, voice.duration), opacity: getWaveformOpacity(i, voice.duration) } as ViewStyle,
                          ]}
                        />
                      ))}
                    </View>
                  )}
                </>
              ) : (
                <View style={styles.voicePlayerRow}>
                  <TouchableOpacity style={styles.voicePlayBtn} onPress={handleVoicePlay} activeOpacity={0.7}>
                    {voicePlaying ? (
                      <Square size={16} color="#fff" fill="#fff" strokeWidth={2} />
                    ) : (
                      <Play size={16} color="#fff" fill="#fff" strokeWidth={2} />
                    )}
                    <Text style={styles.voicePlayBtnText}>{voicePlaying ? '일시정지' : '재생'}</Text>
                  </TouchableOpacity>
                  <Text style={styles.voiceRecordedLabel}>녹음 완료! AI 보이스에 활용됩니다</Text>
                  <TouchableOpacity style={styles.voiceDeleteBtn} onPress={handleVoiceDelete} activeOpacity={0.7}>
                    <Trash2 size={16} color={theme.colors.error[400]} strokeWidth={2} />
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}
        </PillNavCard>

        {/* Ready summary */}
        {canGenerate && (
          <View style={styles.readySummary}>
            <Check size={16} color={theme.colors.success[400]} strokeWidth={2.5} />
            <Text style={styles.readySummaryText} numberOfLines={1}>
              {storeName.trim() ? storeName.trim() : '매장'} 홍보 숏폼 준비 완료!
            </Text>
          </View>
        )}
          </>
        )}
      </ScrollView>

      {/* Advanced Settings Modal */}
      <Modal visible={advancedVisible} transparent animationType="slide" onRequestClose={() => setAdvancedVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>세부 옵션</Text>
              <TouchableOpacity onPress={() => setAdvancedVisible(false)} activeOpacity={0.7}>
                <X size={22} color={theme.colors.dark.textDim} strokeWidth={2} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll} contentContainerStyle={{ gap: theme.spacing.md, paddingBottom: 20 }}>
              <View style={styles.presetGroup}>
                <View style={styles.presetLabelRow}>
                  <Clock size={14} color={theme.colors.warning[400]} strokeWidth={2} />
                  <Text style={styles.presetLabel}>영상 길이</Text>
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

              <View style={styles.presetGroup}>
                <View style={styles.presetLabelRow}>
                  <Type size={14} color={theme.colors.accent[400]} strokeWidth={2} />
                  <Text style={styles.presetLabel}>자막 톤앤매너</Text>
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

              <View style={styles.presetGroup}>
                <View style={styles.presetLabelRow}>
                  <Music size={14} color={theme.colors.primary[400]} strokeWidth={2} />
                  <Text style={styles.presetLabel}>BGM 분위기</Text>
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

              <TouchableOpacity
                style={styles.watermarkToggle}
                onPress={() => setWatermarkEnabled(!watermarkEnabled)}
                activeOpacity={0.7}
              >
                <View style={styles.watermarkToggleLeft}>
                  <Check size={16} color={watermarkEnabled ? theme.colors.success[400] : theme.colors.dark.textDim} strokeWidth={2.5} />
                  <Text style={styles.watermarkToggleLabel}>워터마크 삽입</Text>
                </View>
                <View style={[styles.toggleSwitch, watermarkEnabled && styles.toggleSwitchActive]}>
                  <View style={[styles.toggleKnob, watermarkEnabled && styles.toggleKnobActive]} />
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.fullSettingsBtn}
                onPress={() => {
                  setAdvancedVisible(false);
                  router.push('/settings' as never);
                }}
                activeOpacity={0.7}
              >
                <Settings size={18} color={theme.colors.primary[300]} strokeWidth={2} />
                <Text style={styles.fullSettingsText}>전체 설정 열기</Text>
                <ArrowRight size={16} color={theme.colors.dark.textFaint} strokeWidth={2.5} />
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {generating && (
        <View style={styles.generatingOverlay}>
          <View style={styles.generatingCard}>
            <ActivityIndicator size="large" color={theme.colors.primary[400]} />
            <Text style={styles.generatingTitle}>홍보 숏폼 생성 준비 중...</Text>
            <Text style={styles.generatingSub}>매장 정보를 저장하고 AI 분석을 시작합니다</Text>
            <View style={styles.generatingSteps}>
              <View style={styles.generatingStepRow}>
                <Check size={14} color={theme.colors.success[400]} strokeWidth={2.5} />
                <Text style={styles.generatingStepText}>매장 정보 저장</Text>
              </View>
              <View style={styles.generatingStepRow}>
                <ActivityIndicator size={14} color={theme.colors.primary[400]} />
                <Text style={styles.generatingStepTextActive}>AI 분석 준비 중</Text>
              </View>
              <View style={styles.generatingStepRowDim}>
                <Text style={styles.generatingStepTextPending}>15초 하이브리드 인코딩 대기</Text>
              </View>
            </View>
          </View>
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
  scroll: {
    flex: 1,
    paddingHorizontal: theme.spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.lg,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIcon: {
    width: 48,
    height: 48,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.primary[500] + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 22,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.dark.text,
  },
  headerSub: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    marginTop: 2,
  },
  settingsBtn: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.dark.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modeSwitcherWrap: {
    marginBottom: theme.spacing.lg,
  },
  modeSwitcherLabel: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.textDim,
    marginBottom: 8,
  },
  modeSwitcher: {
    flexDirection: 'row',
    backgroundColor: theme.colors.dark.surface,
    borderRadius: theme.radius.lg,
    padding: 4,
    gap: 4,
  },
  modeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: theme.radius.md,
    backgroundColor: 'transparent',
  },
  modeTabActive: {
    backgroundColor: theme.colors.primary[500],
  },
  modeTabActiveVideo: {
    backgroundColor: theme.colors.error[500],
  },
  modeTabText: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.textDim,
  },
  modeTabTextActive: {
    color: '#fff',
    fontFamily: theme.typography.fontFamily.bold,
  },
  modeHint: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textFaint,
    marginTop: 8,
    lineHeight: 16,
  },
  videoModeContainer: {
    marginBottom: theme.spacing.lg,
  },
  videoModeCard: {
    backgroundColor: theme.colors.dark.surface,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.xl,
    borderWidth: 1.5,
    borderColor: theme.colors.dark.border,
    alignItems: 'center',
    gap: 14,
    ...theme.shadows.card,
  },
  videoModeIconWrap: {
    width: 72,
    height: 72,
    borderRadius: theme.radius.xl,
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoModeTitle: {
    fontSize: 20,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.dark.text,
  },
  videoModeDesc: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    textAlign: 'center',
    lineHeight: 19,
  },
  videoModeSpecRow: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  videoModeSpec: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.dark.bg,
  },
  videoModeSpecText: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.textDim,
  },
  sectionLabel: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.dark.text,
    marginBottom: theme.spacing.sm,
  },
  storeDesc: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    marginBottom: theme.spacing.sm,
  },
  bizTypeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: theme.spacing.sm,
  },
  bizTypeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.dark.bg,
    borderWidth: 1.5,
    borderColor: theme.colors.dark.border,
  },
  bizTypeText: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.textDim,
  },
  storeSaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: theme.colors.primary[500],
    borderRadius: theme.radius.md,
    paddingVertical: 12,
    marginTop: theme.spacing.sm,
    ...theme.shadows.card,
  },
  storeSaveBtnDone: {
    backgroundColor: theme.colors.success[500],
  },
  storeSaveBtnText: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.bold,
    color: '#fff',
  },
  inputGroup: {
    gap: 6,
    marginBottom: theme.spacing.sm,
  },
  inputLabel: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.textDim,
  },
  textInput: {
    backgroundColor: theme.colors.dark.bg,
    borderRadius: theme.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.text,
    borderWidth: 1.5,
    borderColor: theme.colors.dark.border,
  },
  hookDesc: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
  },
  hookChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  hookChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.dark.bg,
    borderWidth: 1.5,
    borderColor: theme.colors.dark.border,
    maxWidth: '100%',
  },
  hookChipText: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.textDim,
    flexShrink: 1,
  },
  manualToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.dark.bg,
    borderWidth: 1.5,
    borderColor: theme.colors.accent[400] + '30',
    marginTop: 4,
  },
  manualToggleText: {
    flex: 1,
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.accent[400],
  },
  manualInputWrap: {
    marginTop: 8,
    gap: 6,
  },
  manualInput: {
    backgroundColor: theme.colors.dark.bg,
    borderRadius: theme.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.text,
    borderWidth: 1.5,
    borderColor: theme.colors.accent[400] + '40',
    minHeight: 80,
  },
  manualClearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.dark.surfaceLight,
  },
  manualClearText: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.textDim,
  },
  manualHint: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
  },
  voiceDesc: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    lineHeight: 16,
  },
  voiceErrorBox: {
    backgroundColor: theme.colors.error[500] + '18',
    borderRadius: theme.radius.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  voiceErrorText: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.error[400],
  },
  voiceWebOnlyNotice: {
    backgroundColor: theme.colors.dark.surfaceLight,
    borderRadius: theme.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  voiceWebOnlyNoticeText: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    textAlign: 'center',
    lineHeight: 17,
  },
  voiceRecordBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.colors.accent[500] + '15',
    borderRadius: theme.radius.md,
    paddingVertical: 14,
    borderWidth: 1.5,
    borderColor: theme.colors.accent[400] + '40',
  },
  voiceRecordBtnActive: {
    backgroundColor: theme.colors.error[500],
    borderColor: theme.colors.error[500],
  },
  voiceRecordBtnText: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: '#fff',
  },
  waveformContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    height: 48,
    marginTop: theme.spacing.sm,
  },
  waveformBar: {
    width: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.accent[400],
  },
  voicePlayerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  voicePlayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.colors.accent[500],
    borderRadius: theme.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  voicePlayBtnText: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: '#fff',
  },
  voiceRecordedLabel: {
    flex: 1,
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.success[400],
  },
  voiceDeleteBtn: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.error[500] + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  readySummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.colors.success[500] + '12',
    borderRadius: theme.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  readySummaryText: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.success[400],
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: theme.colors.dark.surface,
    borderTopLeftRadius: theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
    paddingTop: theme.spacing.md,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.dark.border,
  },
  modalTitle: {
    fontSize: 17,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.dark.text,
  },
  modalScroll: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
  },
  presetGroup: {
    gap: 8,
  },
  presetLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  presetLabel: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chipPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.dark.bg,
    borderWidth: 1.5,
    borderColor: theme.colors.dark.border,
  },
  chipPillLabel: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.textDim,
  },
  chipPillDesc: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textFaint,
  },
  watermarkToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.dark.bg,
    borderRadius: theme.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderWidth: 1.5,
    borderColor: theme.colors.dark.border,
  },
  watermarkToggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  watermarkToggleLabel: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
  },
  toggleSwitch: {
    width: 44,
    height: 26,
    borderRadius: 13,
    backgroundColor: theme.colors.dark.border,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleSwitchActive: {
    backgroundColor: theme.colors.success[500],
  },
  toggleKnob: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#fff',
  },
  toggleKnobActive: {
    transform: [{ translateX: 18 }],
  },
  fullSettingsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: theme.colors.dark.bg,
    borderRadius: theme.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderWidth: 1.5,
    borderColor: theme.colors.primary[400] + '30',
  },
  fullSettingsText: {
    flex: 1,
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.primary[300],
  },
  generatingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  generatingCard: {
    backgroundColor: theme.colors.dark.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.xl,
    alignItems: 'center',
    gap: theme.spacing.sm,
    width: '85%',
    maxWidth: 320,
    ...theme.shadows.elevated,
  },
  generatingTitle: {
    fontSize: 16,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.dark.text,
    marginTop: theme.spacing.xs,
  },
  generatingSub: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    textAlign: 'center',
  },
  generatingSteps: {
    marginTop: theme.spacing.md,
    gap: 10,
    alignSelf: 'stretch',
  },
  generatingStepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  generatingStepRowDim: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 22,
  },
  generatingStepText: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.text,
  },
  generatingStepTextActive: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.primary[300],
  },
  generatingStepTextPending: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textFaint,
  },
  aiEnhanceLabel: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.textDim,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.xs,
  },
  aiToggleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: theme.colors.dark.bg,
    borderRadius: theme.radius.md,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1.5,
    borderColor: theme.colors.dark.border,
    marginBottom: 8,
  },
  aiToggleCardActive: {
    borderColor: theme.colors.primary[400] + '60',
    backgroundColor: theme.colors.primary[500] + '08',
  },
  aiToggleIconWrap: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  aiToggleBody: {
    flex: 1,
    gap: 2,
  },
  aiToggleTitle: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
  },
  aiToggleDesc: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    lineHeight: 15,
  },
  aiPanel: {
    marginTop: 8,
    marginBottom: 8,
    backgroundColor: theme.colors.dark.surfaceLight,
    borderRadius: theme.radius.md,
    padding: 12,
  },
});
