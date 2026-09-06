import { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Linking,
  Platform,
  Modal,
} from 'react-native';
import * as MediaLibrary from 'expo-media-library';
import {
  ChevronDown,
  ChevronUp,
  Check,
  Share2,
  Download,
  Sparkles,
  PenLine,
  Instagram,
  Facebook,
  AtSign,
  Pin,
  Music as MusicIcon,
  ArrowRight,
  Shield,
  Clock,
  Eye,
  Type,
  Crop,
  Wand2,
  Plus,
  Trash2,
  Smartphone,
} from 'lucide-react-native';
import { theme } from '@/lib/theme';
import { getDeepLink } from '@/lib/platformUpload';
import { supabase } from '@/lib/supabase';
import {
  buildShortFormEditPlan,
  generateHookOptions,
  getPlatformInfo,
  type ShortFormEditPlan,
  type HookOption,
  type AutoEnhancement,
} from '@/lib/shortFormEditEngine';
import { ShortFormPreviewPlayer } from '@/components/ShortFormPreviewPlayer';
import {
  fetchEnabledPlatforms,
  addCustomPlatform,
  deleteCustomPlatform,
  type ManagedPlatform,
  AVAILABLE_RATIOS,
} from '@/lib/platformManager';
import type { PlatformSpec } from '@/lib/platformSpecs';
import { mixBgmIntoVideo, fetchBgmRecommendation, type BgmRecommendation } from '@/lib/bgmEngine';

type PlatformOption = {
  key: string;
  label: string;
  icon: typeof Instagram;
  color: string;
  isCustom?: boolean;
  customSpec?: PlatformSpec;
  dbId?: string;
};

const BUILTIN_OPTIONS: PlatformOption[] = [
  { key: 'instagram', label: '인스타그램', icon: Instagram, color: theme.colors.accent[500] },
  { key: 'threads', label: '스레드', icon: AtSign, color: theme.colors.dark.text },
  { key: 'pinterest', label: '핀터레스트', icon: Pin, color: theme.colors.error[500] },
  { key: 'tiktok', label: '틱톡', icon: MusicIcon, color: theme.colors.dark.text },
  { key: 'facebook', label: '페이스북', icon: Facebook, color: theme.colors.primary[600] },
];

function managedToOption(mp: ManagedPlatform): PlatformOption {
  const spec: PlatformSpec = {
    key: mp.key as any,
    label: mp.label,
    ratio: mp.ratio,
    width: mp.width,
    height: mp.height,
    color: mp.color,
    safeZoneTop: mp.safeZoneTop,
    safeZoneBottom: mp.safeZoneBottom,
    safeZoneSides: mp.safeZoneSides,
    desc: mp.desc,
  };
  return {
    key: mp.key,
    label: mp.label,
    icon: Smartphone,
    color: mp.color,
    isCustom: !mp.isBuiltin,
    customSpec: spec,
    dbId: mp.id,
  };
}

interface PostCaptureWorkflowProps {
  visible: boolean;
  videoUri: string | null;
  imageUri?: string | null;
  onProceedToAnalysis: (customPrompt: string, platform: string, editPlan: ShortFormEditPlan) => void;
  onClose: () => void;
}

type WorkflowStep = 0 | 1 | 2 | 3;

export function PostCaptureWorkflow({
  visible,
  videoUri,
  imageUri,
  onProceedToAnalysis,
  onClose,
}: PostCaptureWorkflowProps) {
  const [activeStep, setActiveStep] = useState<WorkflowStep>(1);
  const [selectedPlatformKey, setSelectedPlatformKey] = useState<string>('instagram');
  const [customPrompt, setCustomPrompt] = useState('');
  const [platformLink, setPlatformLink] = useState('');
  const [selectedHookId, setSelectedHookId] = useState<number | null>(null);
  const [disclosureEnabled, setDisclosureEnabled] = useState(false);
  const [gallerySaved, setGallerySaved] = useState(false);
  const [savingToGallery, setSavingToGallery] = useState(false);
  const [platformLaunched, setPlatformLaunched] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadDone, setUploadDone] = useState(false);
  const [uploadRetrying, setUploadRetrying] = useState(false);
  const [uploadRetryCount, setUploadRetryCount] = useState(0);
  const [fallbackUsed, setFallbackUsed] = useState(false);
  const [uploadErrorMsg, setUploadErrorMsg] = useState<string | null>(null);
  const [customPlatforms, setCustomPlatforms] = useState<PlatformOption[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newPlatformName, setNewPlatformName] = useState('');
  const [newPlatformRatio, setNewPlatformRatio] = useState<string>('9:16');
  const [addingPlatform, setAddingPlatform] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [bgmRecommendation, setBgmRecommendation] = useState<BgmRecommendation | null>(null);
  const [bgmLoading, setBgmLoading] = useState(false);

  const allPlatformOptions = useMemo(() => [...BUILTIN_OPTIONS, ...customPlatforms], [customPlatforms]);

  useEffect(() => {
    if (selectedPlatformKey === 'instagram' && !platformLink) {
      setPlatformLink('https://www.instagram.com/reel/');
    } else if (selectedPlatformKey === 'threads' && !platformLink) {
      setPlatformLink('https://www.threads.net/');
    } else if (selectedPlatformKey === 'pinterest' && !platformLink) {
      setPlatformLink('https://www.pinterest.com/');
    } else if (selectedPlatformKey === 'tiktok' && !platformLink) {
      setPlatformLink('https://www.tiktok.com/trending');
    } else if (selectedPlatformKey === 'facebook' && !platformLink) {
      setPlatformLink('https://www.facebook.com/');
    }
  }, [selectedPlatformKey, platformLink]);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    (async () => {
      try {
        const managed = await fetchEnabledPlatforms();
        if (cancelled) return;
        const customOpts = managed
          .filter((mp) => !BUILTIN_OPTIONS.some((b) => b.key === mp.key))
          .map(managedToOption);
        setCustomPlatforms(customOpts);
      } catch {
        // ignore — builtins still work
      }
    })();
    return () => { cancelled = true; };
  }, [visible]);

  useEffect(() => {
    if (!visible || !imageUri) return;
    let cancelled = false;
    setBgmLoading(true);
    (async () => {
      try {
        const rec = await fetchBgmRecommendation(imageUri);
        if (cancelled) return;
        setBgmRecommendation(rec);
      } catch {
        // fallback to keyword-based recommendation
      } finally {
        if (!cancelled) setBgmLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [visible, imageUri]);

  const handleAddPlatform = useCallback(async () => {
    const trimmed = newPlatformName.trim();
    if (!trimmed) {
      setAddError('플랫폼 이름을 입력해주세요.');
      return;
    }
    setAddingPlatform(true);
    setAddError(null);
    try {
      const mp = await addCustomPlatform({ label: trimmed, ratio: newPlatformRatio });
      const opt = managedToOption(mp);
      setCustomPlatforms((prev) => [...prev, opt]);
      setSelectedPlatformKey(opt.key);
      setNewPlatformName('');
      setNewPlatformRatio('9:16');
      setShowAddModal(false);
    } catch (err) {
      setAddError(err instanceof Error ? err.message : '플랫폼 추가에 실패했습니다.');
    }
    setAddingPlatform(false);
  }, [newPlatformName, newPlatformRatio]);

  const handleDeletePlatform = useCallback(async (dbId: string, key: string) => {
    try {
      await deleteCustomPlatform(dbId);
      setCustomPlatforms((prev) => prev.filter((o) => o.key !== key));
      if (selectedPlatformKey === key) {
        setSelectedPlatformKey('instagram');
      }
    } catch {
      // ignore
    }
  }, [selectedPlatformKey]);

  const selectedOption = allPlatformOptions.find((o) => o.key === selectedPlatformKey) ?? BUILTIN_OPTIONS[0];
  const platformInfo = useMemo(
    () => getPlatformInfo(selectedOption.key, selectedOption.customSpec),
    [selectedOption.key, selectedOption.customSpec],
  );

  const hookOptions = useMemo(() => generateHookOptions(customPrompt), [customPrompt]);
  const selectedHook = useMemo(
    () => hookOptions.find((h) => h.id === selectedHookId) ?? hookOptions[0] ?? null,
    [hookOptions, selectedHookId],
  );

  const editPlan = useMemo(
    () => buildShortFormEditPlan(
      selectedOption.key,
      customPrompt,
      selectedHook?.text ?? null,
      customPrompt.trim().split(/[,.]/)[0]?.trim() || undefined,
      [],
      true,
      disclosureEnabled,
      selectedOption.customSpec,
      bgmRecommendation
        ? {
            templateId: bgmRecommendation.templateId,
            label: bgmRecommendation.label,
            mood: bgmRecommendation.description,
            bpm: bgmRecommendation.bpm,
            reason: bgmRecommendation.reason,
            highlightStartSec: bgmRecommendation.highlightStartSec,
            highlightDurationSec: bgmRecommendation.highlightDurationSec,
            energyCurve: bgmRecommendation.energyCurve,
          }
        : undefined,
    ),
    [selectedOption.key, selectedOption.customSpec, customPrompt, selectedHook, disclosureEnabled, bgmRecommendation],
  );

  const handleStepToggle = useCallback((step: WorkflowStep) => {
    setActiveStep((prev) => (prev === step ? 0 : step));
  }, []);

  const handleSaveToGallery = useCallback(async () => {
    const uri = videoUri || (imageUri || null);
    if (!uri) return;
    setSavingToGallery(true);
    try {
      if (Platform.OS === 'web' && videoUri) {
        const mixedUri = await mixBgmIntoVideo(
          videoUri,
          editPlan.bgmTemplate.id,
          editPlan.pacingBpm,
          15,
          bgmRecommendation?.highlightStartSec,
          bgmRecommendation?.highlightDurationSec,
          bgmRecommendation?.energyCurve,
        );
        const a = document.createElement('a');
        a.href = mixedUri;
        a.download = `shortform-${Date.now()}.webm`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } else {
        if (Platform.OS === 'web') {
          const a = document.createElement('a');
          a.href = uri;
          a.download = `shortform-${Date.now()}.${imageUri ? 'jpg' : 'mp4'}`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        } else {
          await MediaLibrary.requestPermissionsAsync();
          await MediaLibrary.saveToLibraryAsync(uri);
        }
      }
      setGallerySaved(true);
    } catch {
      // ignore — user can retry
    }
    setSavingToGallery(false);
  }, [videoUri, imageUri, editPlan.bgmTemplate.id, editPlan.pacingBpm, bgmRecommendation]);

  const handleLaunchPlatform = useCallback(async () => {
    const deepLink = getDeepLink(selectedPlatformKey);
    setPlatformLaunched(true);
    try {
      const canOpen = await Linking.canOpenURL(deepLink.uploadAppUrl);
      if (canOpen) {
        await Linking.openURL(deepLink.uploadAppUrl);
      } else {
        await Linking.openURL(deepLink.uploadWebUrl);
      }
    } catch {
      try {
        const canOpenFallback = await Linking.canOpenURL(deepLink.appUrl);
        if (canOpenFallback) {
          await Linking.openURL(deepLink.appUrl);
        } else {
          await Linking.openURL(deepLink.webUrl);
        }
      } catch { /* ignore */ }
    }
  }, [selectedPlatformKey]);

  const uriToBlob = useCallback(async (uri: string): Promise<Blob> => {
    if (uri.startsWith('data:')) {
      const resp = await fetch(uri);
      return resp.blob();
    }
    if (uri.startsWith('blob:') || uri.startsWith('http') || uri.startsWith('file:')) {
      const resp = await fetch(uri);
      return resp.blob();
    }
    const resp = await fetch(uri);
    return resp.blob();
  }, []);

  const uploadWithRetry = useCallback(async (
    blob: Blob,
    fileName: string,
    maxRetries: number,
    contentType: string = 'video/mp4',
  ): Promise<boolean> => {
    let lastError: string | null = null;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          setUploadRetrying(true);
          setUploadRetryCount(attempt);
          const delayMs = Math.min(1000 * Math.pow(2, attempt), 8000);
          await new Promise((r) => setTimeout(r, delayMs));
        }
        const { error } = await supabase.storage
          .from('videos')
          .upload(fileName, blob, { contentType, upsert: false });
        if (error) throw error;
        setUploadRetrying(false);
        return true;
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        setUploadErrorMsg(lastError);
      }
    }
    setUploadRetrying(false);
    return false;
  }, []);

  const handleProceed = useCallback(async () => {
    if (isUploading || uploadDone) return;
    setIsUploading(true);
    setUploadErrorMsg(null);
    setUploadRetryCount(0);

    let cloudSuccess = false;

    let uploadUri = videoUri || (imageUri || null);
    if (uploadUri && videoUri && Platform.OS === 'web') {
      try {
        uploadUri = await mixBgmIntoVideo(
          videoUri,
          editPlan.bgmTemplate.id,
          editPlan.pacingBpm,
          15,
          bgmRecommendation?.highlightStartSec,
          bgmRecommendation?.highlightDurationSec,
          bgmRecommendation?.energyCurve,
        );
      } catch {
        uploadUri = videoUri;
      }
    }
    if (uploadUri) {
      try {
        const blob = await uriToBlob(uploadUri);
        const ext = imageUri ? 'jpg' : 'mp4';
        const contentType = imageUri ? 'image/jpeg' : 'video/mp4';
        const fileName = `shortform-${Date.now()}.${ext}`;
        cloudSuccess = await uploadWithRetry(blob, fileName, 3, contentType);
      } catch {
        cloudSuccess = false;
      }
    }

    if (cloudSuccess) {
      setUploadDone(true);
    } else {
      setFallbackUsed(true);
    }

    const deepLink = getDeepLink(selectedPlatformKey);
    try {
      const canOpen = await Linking.canOpenURL(deepLink.uploadAppUrl);
      if (canOpen) {
        await Linking.openURL(deepLink.uploadAppUrl);
      } else {
        await Linking.openURL(deepLink.uploadWebUrl);
      }
      setPlatformLaunched(true);
    } catch {
      try {
        const canOpenFallback = await Linking.canOpenURL(deepLink.appUrl);
        if (canOpenFallback) {
          await Linking.openURL(deepLink.appUrl);
        } else {
          await Linking.openURL(deepLink.webUrl);
        }
        setPlatformLaunched(true);
      } catch { /* best-effort */ }
    }

    onProceedToAnalysis(customPrompt.trim(), selectedPlatformKey, editPlan);
    setIsUploading(false);
  }, [isUploading, uploadDone, videoUri, imageUri, selectedPlatformKey, customPrompt, editPlan.bgmTemplate.id, editPlan.pacingBpm, editPlan, onProceedToAnalysis, uriToBlob, uploadWithRetry, bgmRecommendation]);

  if (!visible) return null;

  const platformLabel = selectedOption.label;
  const spec = editPlan.spec;

  return (
    <View style={styles.overlay}>
      <View style={styles.sheet}>
        <View style={styles.header}>
          <Text style={styles.title}>촬영 완료! 3단계로 숏폼 완성</Text>
          <TouchableOpacity onPress={onClose} activeOpacity={0.7} style={styles.closeBtn}>
            <Text style={styles.closeText}>건너뛰기</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Step 1: Platform Selection + Safe Zone */}
          <StepCard
            stepNum={1}
            title="플랫폼 선택"
            subtitle={`${platformLabel} · ${spec ? spec.ratio : '9:16'} · 안전지대 자동 적용`}
            expanded={activeStep === 1}
            onToggle={() => handleStepToggle(1)}
          >
            <View style={styles.platformGrid}>
              {allPlatformOptions.map((opt) => {
                const Icon = opt.icon;
                const isActive = selectedPlatformKey === opt.key;
                return (
                  <View key={opt.key} style={styles.platformChipWrap}>
                    <TouchableOpacity
                      style={[styles.platformChip, isActive && { borderColor: opt.color, backgroundColor: opt.color + '15' }]}
                      onPress={() => { setSelectedPlatformKey(opt.key); setSelectedHookId(null); }}
                      activeOpacity={0.7}
                    >
                      <Icon size={20} color={isActive ? opt.color : theme.colors.dark.textDim} strokeWidth={2} />
                      <Text style={[styles.platformChipText, isActive && { color: opt.color }]}>{opt.label}</Text>
                      {isActive && <Check size={14} color={opt.color} strokeWidth={2.5} />}
                    </TouchableOpacity>
                    {opt.isCustom && opt.dbId && (
                      <TouchableOpacity
                        style={styles.platformDeleteBtn}
                        onPress={() => handleDeletePlatform(opt.dbId!, opt.key)}
                        activeOpacity={0.6}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Trash2 size={13} color={theme.colors.error[400]} strokeWidth={2} />
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
              <TouchableOpacity
                style={styles.platformAddChip}
                onPress={() => setShowAddModal(true)}
                activeOpacity={0.7}
              >
                <Plus size={20} color={theme.colors.primary[400]} strokeWidth={2} />
                <Text style={styles.platformAddText}>플랫폼 추가</Text>
              </TouchableOpacity>
            </View>

            {spec && (
              <View style={styles.specBox}>
                <View style={styles.specRow}>
                  <Type size={13} color={theme.colors.primary[400]} strokeWidth={2} />
                  <Text style={styles.specKey}>해상도</Text>
                  <Text style={styles.specVal}>{spec.width}×{spec.height} ({spec.ratio})</Text>
                </View>
                <View style={styles.specRow}>
                  <Eye size={13} color={theme.colors.primary[400]} strokeWidth={2} />
                  <Text style={styles.specKey}>안전지대</Text>
                  <Text style={styles.specVal}>상 {spec.safeZoneTop}px · 하 {spec.safeZoneBottom}px · 좌우 {spec.safeZoneSides}px</Text>
                </View>
                <View style={styles.specRow}>
                  <Clock size={13} color={theme.colors.primary[400]} strokeWidth={2} />
                  <Text style={styles.specKey}>최대 길이</Text>
                  <Text style={styles.specVal}>15초</Text>
                </View>
              </View>
            )}
            <Text style={styles.safeZoneHint}>
              선택한 플랫폼의 안전지대(Safe Zone)가 AI 편집에 자동 적용되어 자막이 UI 영역과 겹치지 않습니다.
            </Text>
            <TouchableOpacity style={styles.stepNextBtn} onPress={() => setActiveStep(2)} activeOpacity={0.8}>
              <Text style={styles.stepNextBtnText}>다음 단계: AI 편집</Text>
              <ArrowRight size={16} color="#fff" strokeWidth={2.5} />
            </TouchableOpacity>
          </StepCard>

          {/* Step 2: AI Semi-Auto Editing + Hook Selection */}
          <StepCard
            stepNum={2}
            title="AI 반자동 편집"
            subtitle={`후킹 ${hookOptions.length}개 자동 도출 · ${editPlan.captionStyle.slice(0, 12)}...`}
            expanded={activeStep === 2}
            onToggle={() => handleStepToggle(2)}
          >
            <View style={styles.promptLabelRow}>
              <PenLine size={14} color={theme.colors.accent[400]} strokeWidth={2} />
              <Text style={styles.promptLabel}>맞춤 프롬프트 (선택)</Text>
            </View>
            <TextInput
              style={styles.promptInput}
              value={customPrompt}
              onChangeText={(t) => { setCustomPrompt(t); setSelectedHookId(null); }}
              placeholder="예: 오늘 갓 구운 소금빵 30% 할인, 절대 놓치지 마세요!"
              placeholderTextColor={theme.colors.dark.textFaint}
              multiline
              maxLength={200}
            />

            <View style={styles.hookLabelWrap}>
              <Sparkles size={14} color={theme.colors.warning[400]} strokeWidth={2} />
              <Text style={styles.hookLabel}>심리학 기반 후킹 문구 (1개 선택)</Text>
            </View>
            {hookOptions.map((hook: HookOption) => {
              const isSelected = (selectedHookId ?? hookOptions[0]?.id) === hook.id;
              return (
                <TouchableOpacity
                  key={hook.id}
                  style={[styles.hookCard, isSelected && styles.hookCardSelected]}
                  onPress={() => setSelectedHookId(hook.id)}
                  activeOpacity={0.7}
                >
                  <View style={styles.hookCardLeft}>
                    <View style={[styles.hookBadge, isSelected && styles.hookBadgeSelected]}>
                      <Text style={[styles.hookBadgeText, isSelected && styles.hookBadgeTextSelected]}>{hook.id}</Text>
                    </View>
                    <View style={styles.hookTextWrap}>
                      <Text style={[styles.hookText, isSelected && styles.hookTextSelected]}>{hook.text}</Text>
                      <Text style={styles.hookPsych}>{hook.psychology}</Text>
                    </View>
                  </View>
                  {isSelected && <Check size={18} color={theme.colors.warning[400]} strokeWidth={2.5} />}
                </TouchableOpacity>
              );
            })}

            <View style={styles.enhanceLabelWrap}>
              <Wand2 size={14} color={theme.colors.success[500]} strokeWidth={2} />
              <Text style={styles.enhanceLabel}>AI 자동 보정 (배경 편집 불필요)</Text>
            </View>
            <Text style={styles.enhanceHint}>
              스마트폰으로 촬영한 날것의 영상이 가장 리얼합니다. 복잡한 배경 제거/가상 스튜디오 합성 없이, 아래 3가지만 AI가 자동으로 잡아줍니다.
            </Text>
            {editPlan.autoEnhancements.map((enh: AutoEnhancement, idx: number) => {
              const EnhIcon = enh.id === 'safe_zone_crop' ? Crop : enh.id === 'hook_overlay' ? Type : MusicIcon;
              return (
                <View key={enh.id} style={styles.enhanceCard}>
                  <View style={styles.enhanceIconWrap}>
                    <EnhIcon size={16} color={theme.colors.success[500]} strokeWidth={2} />
                  </View>
                  <View style={styles.enhanceTextWrap}>
                    <Text style={styles.enhanceTitle}>{idx + 1}. {enh.label}</Text>
                    <Text style={styles.enhanceDesc}>{enh.description}</Text>
                  </View>
                  <Check size={16} color={theme.colors.success[500]} strokeWidth={2.5} />
                </View>
              );
            })}

            <View style={styles.metaInfoBox}>
              <View style={styles.metaRow}>
                <Text style={styles.metaKey}>비율</Text>
                <Text style={styles.metaVal}>{spec ? spec.ratio : '9:16'} 세로형</Text>
              </View>
              <View style={styles.metaRow}>
                <Text style={styles.metaKey}>플랫폼</Text>
                <Text style={styles.metaVal}>{platformLabel}</Text>
              </View>
              <View style={styles.metaRow}>
                <Text style={styles.metaKey}>자막 스타일</Text>
                <Text style={styles.metaVal}>{editPlan.captionStyle}</Text>
              </View>
              <View style={styles.metaRow}>
                <Text style={styles.metaKey}>템포</Text>
                <Text style={styles.metaVal}>{editPlan.pacingBpm} BPM</Text>
              </View>
              <View style={styles.metaRow}>
                <Text style={styles.metaKey}>안전지대</Text>
                <Text style={styles.metaVal}>상하단 자막 영역 확보</Text>
              </View>
              <View style={styles.metaRow}>
                <Text style={styles.metaKey}>BGM</Text>
                <Text style={styles.metaVal}>{bgmLoading ? 'AI 음악 분석 중...' : `${editPlan.bgmTemplate.label} · ${editPlan.bgmTemplate.bpm} BPM`}</Text>
              </View>
              {bgmRecommendation?.description && !bgmLoading && (
                <View style={styles.bgReasonRow}>
                  <MusicIcon size={12} color={theme.colors.accent[400]} strokeWidth={2} />
                  <Text style={styles.bgReasonText}>{bgmRecommendation.description}</Text>
                </View>
              )}
              {bgmRecommendation?.reason && !bgmLoading && (
                <View style={styles.bgReasonRow}>
                  <Sparkles size={12} color={theme.colors.accent[400]} strokeWidth={2} />
                  <Text style={styles.bgReasonText}>AI 추천: {bgmRecommendation.reason}</Text>
                </View>
              )}
              {bgmRecommendation && !bgmLoading && (
                <View style={styles.bgReasonRow}>
                  <Wand2 size={12} color={theme.colors.warning[400]} strokeWidth={2} />
                  <Text style={styles.bgReasonText}>핵심 구간: {bgmRecommendation.highlightStartSec}초~{bgmRecommendation.highlightStartSec + bgmRecommendation.highlightDurationSec}초 (에너지 피크 싱크)</Text>
                </View>
              )}
            </View>

            <View style={styles.disclosureToggleRow}>
              <View style={styles.disclosureToggleLeft}>
                <Shield size={15} color={disclosureEnabled ? theme.colors.warning[500] : theme.colors.dark.textDim} strokeWidth={2} />
                <View style={styles.disclosureToggleText}>
                  <Text style={styles.disclosureToggleTitle}>유료 광고/협찬 표기</Text>
                  <Text style={styles.disclosureToggleSub}>후반부 2초(13~15초) 공정위 문구 자동 삽입</Text>
                </View>
              </View>
              <TouchableOpacity
                style={[styles.toggleSwitch, disclosureEnabled && styles.toggleSwitchOn]}
                onPress={() => setDisclosureEnabled((v) => !v)}
                activeOpacity={0.8}
              >
                <View style={[styles.toggleThumb, disclosureEnabled && styles.toggleThumbOn]} />
              </TouchableOpacity>
            </View>

            <ShortFormPreviewPlayer editPlan={editPlan} videoUri={videoUri} imageUri={imageUri} />

            <View style={styles.timelinePreview}>
              {editPlan.segments.map((seg) => (
                <View key={seg.index} style={styles.timelineSeg}>
                  <View style={[styles.timelineBar, { flex: seg.endSec - seg.startSec }]}>
                    <Text style={styles.timelineLabel}>{seg.label}</Text>
                    <Text style={styles.timelineTime}>{seg.startSec}-{seg.endSec}s</Text>
                  </View>
                </View>
              ))}
              {disclosureEnabled && (
                <View style={[styles.timelineSeg]}>
                  <View style={[styles.timelineBar, styles.timelineDisclosure, { flex: 2 }]}>
                    <Text style={styles.timelineLabel}>공정위 문구</Text>
                    <Text style={styles.timelineTime}>13-15s</Text>
                  </View>
                </View>
              )}
              {!disclosureEnabled && (
                <View style={[styles.timelineSeg]}>
                  <View style={[styles.timelineBar, styles.timelineExtraSeg, { flex: 2 }]}>
                    <Text style={styles.timelineLabel}>여유</Text>
                    <Text style={styles.timelineTime}>13-15s</Text>
                  </View>
                </View>
              )}
            </View>

            <TouchableOpacity style={styles.stepNextBtn} onPress={() => setActiveStep(3)} activeOpacity={0.8}>
              <Text style={styles.stepNextBtnText}>다음 단계: 저장 & 발행</Text>
              <ArrowRight size={16} color="#fff" strokeWidth={2.5} />
            </TouchableOpacity>
          </StepCard>

          {/* Step 3: Gallery Save + Platform Share + Disclosure */}
          <StepCard
            stepNum={3}
            title="갤러리 저장 & 플랫폼 발행"
            subtitle="기기에 저장하고 SNS로 바로 발행하세요"
            expanded={activeStep === 3}
            onToggle={() => handleStepToggle(3)}
          >
            {disclosureEnabled ? (
              <View style={styles.disclosurePreviewBox}>
                <View style={styles.disclosurePreviewHeader}>
                  <Shield size={14} color={theme.colors.warning[400]} strokeWidth={2.2} />
                  <Text style={styles.disclosurePreviewTitle}>공정위 의무 표기 (13~15초, 2초간 자동 삽입)</Text>
                </View>
                <Text style={styles.disclosurePreviewText}>{editPlan.disclosureOverlay.text}</Text>
                <Text style={styles.disclosurePreviewMeta}>
                  위치: {editPlan.disclosureOverlay.position === 'bottom-center' ? '하단 중앙' : '상단 중앙'} ·
                  배경 투명도: {Math.round(editPlan.disclosureOverlay.bgOpacity * 100)}%
                </Text>
              </View>
            ) : (
              <View style={styles.disclosureOffBox}>
                <Shield size={14} color={theme.colors.dark.textDim} strokeWidth={2} />
                <Text style={styles.disclosureOffText}>공정위 문구 삽입 없이 순수 15초 홍보 영상으로 완성됩니다.</Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.actionBtn, gallerySaved && styles.actionBtnDone]}
              onPress={handleSaveToGallery}
              disabled={savingToGallery || gallerySaved}
              activeOpacity={0.8}
            >
              {gallerySaved ? (
                <Check size={18} color="#fff" strokeWidth={2.5} />
              ) : (
                <Download size={18} color="#fff" strokeWidth={2.5} />
              )}
              <Text style={styles.actionBtnText}>
                {savingToGallery ? '저장 중...' : gallerySaved ? '갤러리에 저장됨' : '기기 갤러리에 저장'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnShare, platformLaunched && styles.actionBtnDone]}
              onPress={handleLaunchPlatform}
              disabled={!gallerySaved}
              activeOpacity={0.8}
            >
              <Share2 size={18} color="#fff" strokeWidth={2.5} />
              <Text style={styles.actionBtnText}>
                {platformLaunched ? `${platformLabel} 업로드 열림` : `${platformLabel} 동영상 업로드`}
              </Text>
            </TouchableOpacity>

            <View style={styles.platformLinkBox}>
                <Text style={styles.platformLinkLabel}>플랫폼 링크 직접 입력</Text>
                <TextInput
                  style={styles.platformLinkInput}
                  value={platformLink}
                  onChangeText={setPlatformLink}
                  placeholder="https://..."
                  placeholderTextColor={theme.colors.dark.textFaint}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  returnKeyType="done"
                />
                <Text style={styles.platformLinkHint}>입력한 링크는 플랫폼 업로드와 함께 사용할 수 있습니다.</Text>
            </View>

            {fallbackUsed && !uploadDone && (
              <Text style={styles.fallbackHint}>
                클라우드 업로드 실패 — 로컬 다운로드 및 {platformLabel} 공유로 자동 전환되었습니다. 발행을 계속 진행하세요.
              </Text>
            )}
          </StepCard>
        </ScrollView>
      </View>

      <Modal visible={showAddModal} transparent animationType="fade" onRequestClose={() => setShowAddModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>플랫폼 추가</Text>
            <Text style={styles.modalHint}>원하는 플랫폼 이름을 입력하고 비율을 선택하세요. 무제한으로 추가할 수 있습니다.</Text>

            <Text style={styles.modalLabel}>플랫폼 이름</Text>
            <TextInput
              style={styles.modalInput}
              value={newPlatformName}
              onChangeText={setNewPlatformName}
              placeholder="예: 스레드, 카카오스토리, 위챗..."
              placeholderTextColor={theme.colors.dark.textFaint}
              maxLength={20}
              autoFocus
            />

            <Text style={styles.modalLabel}>화면 비율</Text>
            <View style={styles.ratioRow}>
              {AVAILABLE_RATIOS.map((r) => {
                const isSelected = newPlatformRatio === r;
                return (
                  <TouchableOpacity
                    key={r}
                    style={[styles.ratioChip, isSelected && styles.ratioChipSelected]}
                    onPress={() => setNewPlatformRatio(r)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.ratioChipText, isSelected && styles.ratioChipTextSelected]}>{r}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {addError && <Text style={styles.modalError}>{addError}</Text>}

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => { setShowAddModal(false); setAddError(null); setNewPlatformName(''); }}
                activeOpacity={0.7}
              >
                <Text style={styles.modalCancelText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirmBtn, addingPlatform && { opacity: 0.6 }]}
                onPress={handleAddPlatform}
                disabled={addingPlatform}
                activeOpacity={0.8}
              >
                <Text style={styles.modalConfirmText}>{addingPlatform ? '추가 중...' : '추가'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

interface StepCardProps {
  stepNum: number;
  title: string;
  subtitle: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

function StepCard({ stepNum, title, subtitle, expanded, onToggle, children }: StepCardProps) {
  return (
    <View style={styles.stepCard}>
      <TouchableOpacity style={styles.stepHeader} onPress={onToggle} activeOpacity={0.7}>
        <View style={styles.stepNumWrap}>
          <Text style={styles.stepNumText}>{stepNum}</Text>
        </View>
        <View style={styles.stepHeaderText}>
          <Text style={styles.stepTitle}>{title}</Text>
          <Text style={styles.stepSubtitle} numberOfLines={expanded ? 0 : 1}>{subtitle}</Text>
        </View>
        {expanded ? (
          <ChevronUp size={20} color={theme.colors.dark.textDim} strokeWidth={2} />
        ) : (
          <ChevronDown size={20} color={theme.colors.dark.textDim} strokeWidth={2} />
        )}
      </TouchableOpacity>
      {expanded && <View style={styles.stepBody}>{children}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(5, 8, 18, 0.92)',
    zIndex: 200,
  },
  sheet: {
    flex: 1,
    paddingTop: 60,
    paddingHorizontal: theme.spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.lg,
  },
  title: {
    fontSize: 18,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.dark.text,
  },
  closeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  closeText: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
    gap: theme.spacing.md,
  },
  stepCard: {
    backgroundColor: theme.colors.dark.surface,
    borderRadius: theme.radius.xl,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: theme.colors.dark.border,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md + 2,
  },
  stepNumWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.primary[500],
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNumText: {
    fontSize: 15,
    fontFamily: theme.typography.fontFamily.bold,
    color: '#fff',
  },
  stepHeaderText: {
    flex: 1,
    gap: 2,
  },
  stepTitle: {
    fontSize: 15,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.dark.text,
  },
  stepSubtitle: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
  },
  stepBody: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.lg,
    gap: 12,
  },
  platformGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  platformChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.dark.surfaceLight,
    borderWidth: 1.5,
    borderColor: theme.colors.dark.border,
  },
  platformChipText: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.textDim,
  },
  platformChipWrap: {
    position: 'relative',
  },
  platformDeleteBtn: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: theme.colors.dark.surface,
    borderWidth: 1,
    borderColor: theme.colors.error[400] + '50',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  platformAddChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: theme.radius.lg,
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: theme.colors.primary[400] + '50',
    borderStyle: 'dashed',
  },
  platformAddText: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.primary[400],
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: theme.colors.dark.surface,
    borderRadius: theme.radius.xl,
    padding: 20,
    gap: 8,
    borderWidth: 1.5,
    borderColor: theme.colors.dark.border,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.dark.text,
  },
  modalHint: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    lineHeight: 17,
    marginBottom: 4,
  },
  modalLabel: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
    marginTop: 4,
  },
  modalInput: {
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.dark.surfaceLight,
    borderWidth: 1.5,
    borderColor: theme.colors.dark.border,
    padding: 12,
    fontSize: 15,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.text,
  },
  ratioRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  ratioChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.dark.surfaceLight,
    borderWidth: 1.5,
    borderColor: theme.colors.dark.border,
  },
  ratioChipSelected: {
    borderColor: theme.colors.primary[500],
    backgroundColor: theme.colors.primary[500] + '15',
  },
  ratioChipText: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.textDim,
  },
  ratioChipTextSelected: {
    color: theme.colors.primary[400],
  },
  modalError: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.error[400],
    marginTop: 4,
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.dark.surfaceLight,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.textDim,
  },
  modalConfirmBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primary[600],
    alignItems: 'center',
  },
  modalConfirmText: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.bold,
    color: '#fff',
  },
  specBox: {
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.dark.surfaceLight,
    padding: theme.spacing.md,
    gap: 8,
  },
  specRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  specKey: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    minWidth: 52,
  },
  specVal: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
    flex: 1,
  },
  safeZoneHint: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textFaint,
    lineHeight: 16,
  },
  stepNextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primary[600],
  },
  stepNextBtnText: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.bold,
    color: '#fff',
  },
  promptLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  promptLabel: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.accent[400],
  },
  promptInput: {
    minHeight: 60,
    maxHeight: 100,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.dark.surfaceLight,
    borderWidth: 1.5,
    borderColor: theme.colors.dark.border,
    padding: 12,
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.text,
    textAlignVertical: 'top',
  },
  promptHint: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textFaint,
    lineHeight: 16,
  },
  hookLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  hookLabel: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.warning[400],
  },
  enhanceLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  enhanceLabel: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.success[500],
  },
  enhanceHint: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textFaint,
    lineHeight: 16,
  },
  enhanceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.dark.surfaceLight,
    borderWidth: 1.5,
    borderColor: theme.colors.success[500] + '30',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  enhanceIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.colors.success[500] + '18',
    justifyContent: 'center',
    alignItems: 'center',
  },
  enhanceTextWrap: {
    flex: 1,
    gap: 2,
  },
  enhanceTitle: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
  },
  enhanceDesc: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    lineHeight: 15,
  },
  hookCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.dark.surfaceLight,
    borderWidth: 1.5,
    borderColor: theme.colors.dark.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  hookCardSelected: {
    borderColor: theme.colors.warning[500],
    backgroundColor: theme.colors.warning[500] + '12',
  },
  hookCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  hookBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.colors.dark.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  hookBadgeSelected: {
    backgroundColor: theme.colors.warning[500],
  },
  hookBadgeText: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.dark.textDim,
  },
  hookBadgeTextSelected: {
    color: '#fff',
  },
  hookTextWrap: {
    flex: 1,
    gap: 2,
  },
  hookText: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
  },
  hookTextSelected: {
    color: theme.colors.warning[400],
  },
  hookPsych: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textFaint,
  },
  metaInfoBox: {
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.dark.surfaceLight,
    padding: theme.spacing.md,
    gap: 6,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metaKey: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
  },
  metaVal: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
    flex: 1,
    textAlign: 'right',
  },
  bgReasonRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 5,
    marginTop: 4,
    paddingHorizontal: 2,
  },
  bgReasonText: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.accent[400],
    flex: 1,
    lineHeight: 15,
  },
  timelinePreview: {
    flexDirection: 'row',
    gap: 2,
    borderRadius: theme.radius.md,
    overflow: 'hidden',
    height: 44,
  },
  timelineSeg: {
    flexDirection: 'row',
  },
  timelineBar: {
    backgroundColor: theme.colors.primary[600],
    justifyContent: 'center',
    alignItems: 'center',
    gap: 1,
  },
  timelineDisclosure: {
    backgroundColor: theme.colors.warning[500],
  },
  timelineExtraSeg: {
    backgroundColor: theme.colors.dark.border,
  },
  disclosureToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.dark.surfaceLight,
    borderWidth: 1.5,
    borderColor: theme.colors.dark.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  disclosureToggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  disclosureToggleText: {
    gap: 2,
    flex: 1,
  },
  disclosureToggleTitle: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
  },
  disclosureToggleSub: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textFaint,
  },
  toggleSwitch: {
    width: 44,
    height: 26,
    borderRadius: 13,
    backgroundColor: theme.colors.dark.border,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleSwitchOn: {
    backgroundColor: theme.colors.warning[500],
  },
  toggleThumb: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#fff',
    alignSelf: 'flex-start',
  },
  toggleThumbOn: {
    alignSelf: 'flex-end',
  },
  disclosureOffBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.dark.surfaceLight,
    borderWidth: 1.5,
    borderColor: theme.colors.dark.border,
    padding: 12,
  },
  disclosureOffText: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    flex: 1,
  },
  timelineLabel: {
    fontSize: 9,
    fontFamily: theme.typography.fontFamily.bold,
    color: '#fff',
  },
  timelineTime: {
    fontSize: 8,
    fontFamily: theme.typography.fontFamily.regular,
    color: 'rgba(255,255,255,0.8)',
  },
  disclosurePreviewBox: {
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.warning[500] + '15',
    borderWidth: 1.5,
    borderColor: theme.colors.warning[500] + '40',
    padding: 12,
    gap: 6,
  },
  disclosurePreviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  disclosurePreviewTitle: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.warning[400],
  },
  disclosurePreviewText: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.text,
    lineHeight: 18,
  },
  disclosurePreviewMeta: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textFaint,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primary[600],
  },
  actionBtnDone: {
    backgroundColor: theme.colors.success[500],
  },
  actionBtnText: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.bold,
    color: '#fff',
  },
  actionBtnShare: {
    backgroundColor: theme.colors.accent[500],
    opacity: 1,
  },
  fallbackHint: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.warning[400],
    textAlign: 'center',
    lineHeight: 16,
  },
  platformLinkBox: {
    backgroundColor: theme.colors.dark.surfaceLight,
    borderRadius: theme.radius.lg,
    borderWidth: 1.5,
    borderColor: theme.colors.dark.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
    marginTop: 4,
  },
  platformLinkLabel: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
  },
  platformLinkInput: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.text,
    borderWidth: 1.5,
    borderColor: theme.colors.dark.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: theme.colors.dark.surface,
  },
  platformLinkHint: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
  },
});
