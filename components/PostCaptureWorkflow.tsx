import { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Linking,
  Platform,
  Share as RNShare,
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
  Youtube,
  Music as MusicIcon,
  Monitor as MonitorIcon,
  ArrowRight,
  Shield,
  Clock,
  Eye,
  Type,
  Crop,
  Wand2,
  Cloud,
} from 'lucide-react-native';
import { theme } from '@/lib/theme';
import { getDeepLink, type UploadPlatformKey } from '@/lib/platformUpload';
import { supabase } from '@/lib/supabase';
import {
  buildShortFormEditPlan,
  generateHookOptions,
  getPlatformInfo,
  type ShortFormPlatform,
  type ShortFormEditPlan,
  type HookOption,
  type AutoEnhancement,
} from '@/lib/shortFormEditEngine';
import { ShortFormPreviewPlayer } from '@/components/ShortFormPreviewPlayer';

type PlatformOption = {
  key: UploadPlatformKey;
  platformKey: ShortFormPlatform;
  label: string;
  icon: typeof Instagram;
  color: string;
};

const PLATFORM_OPTIONS: PlatformOption[] = [
  { key: 'instagram', platformKey: 'instagram', label: '인스타그램', icon: Instagram, color: theme.colors.accent[500] },
  { key: 'tiktok', platformKey: 'tiktok', label: '틱톡', icon: MusicIcon, color: theme.colors.dark.text },
  { key: 'youtube', platformKey: 'youtube', label: '유튜브 쇼츠', icon: Youtube, color: theme.colors.error[500] },
  { key: 'naver_clip', platformKey: 'naver_clip', label: '네이버 클립', icon: MonitorIcon, color: theme.colors.primary[400] },
];

interface PostCaptureWorkflowProps {
  visible: boolean;
  videoUri: string | null;
  onProceedToAnalysis: (customPrompt: string, platform: UploadPlatformKey, editPlan: ShortFormEditPlan) => void;
  onClose: () => void;
}

type WorkflowStep = 0 | 1 | 2 | 3;

export function PostCaptureWorkflow({
  visible,
  videoUri,
  onProceedToAnalysis,
  onClose,
}: PostCaptureWorkflowProps) {
  const [activeStep, setActiveStep] = useState<WorkflowStep>(1);
  const [selectedPlatformKey, setSelectedPlatformKey] = useState<UploadPlatformKey>('instagram');
  const [customPrompt, setCustomPrompt] = useState('');
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

  const selectedOption = PLATFORM_OPTIONS.find((o) => o.key === selectedPlatformKey) ?? PLATFORM_OPTIONS[0];
  const platformInfo = useMemo(() => getPlatformInfo(selectedOption.platformKey), [selectedOption.platformKey]);

  const hookOptions = useMemo(() => generateHookOptions(customPrompt), [customPrompt]);
  const selectedHook = useMemo(
    () => hookOptions.find((h) => h.id === selectedHookId) ?? hookOptions[0] ?? null,
    [hookOptions, selectedHookId],
  );

  const editPlan = useMemo(
    () => buildShortFormEditPlan(
      selectedOption.platformKey,
      customPrompt,
      selectedHook?.text ?? null,
      customPrompt.trim().split(/[,.]/)[0]?.trim() || undefined,
      [],
      true,
      disclosureEnabled,
    ),
    [selectedOption.platformKey, customPrompt, selectedHook, disclosureEnabled],
  );

  const handleStepToggle = useCallback((step: WorkflowStep) => {
    setActiveStep((prev) => (prev === step ? 0 : step));
  }, []);

  const handleSaveToGallery = useCallback(async () => {
    if (!videoUri) return;
    setSavingToGallery(true);
    try {
      if (Platform.OS === 'web') {
        const a = document.createElement('a');
        a.href = videoUri;
        a.download = `shortform-${Date.now()}.mp4`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } else {
        await MediaLibrary.requestPermissionsAsync();
        await MediaLibrary.saveToLibraryAsync(videoUri);
      }
      setGallerySaved(true);
    } catch {
      // ignore — user can retry
    }
    setSavingToGallery(false);
  }, [videoUri]);

  const handleLaunchPlatform = useCallback(async () => {
    const deepLink = getDeepLink(selectedPlatformKey);
    setPlatformLaunched(true);
    try {
      const canOpen = await Linking.canOpenURL(deepLink.appUrl);
      if (canOpen) {
        await Linking.openURL(deepLink.appUrl);
      } else {
        await Linking.openURL(deepLink.webUrl);
      }
    } catch {
      // fallback
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
          .upload(fileName, blob, { contentType: 'video/mp4', upsert: false });
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

    if (videoUri) {
      try {
        const blob = await uriToBlob(videoUri);
        const fileName = `shortform-${Date.now()}.mp4`;
        cloudSuccess = await uploadWithRetry(blob, fileName, 3);
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
      const canOpen = await Linking.canOpenURL(deepLink.appUrl);
      if (canOpen) {
        await Linking.openURL(deepLink.appUrl);
      } else {
        await Linking.openURL(deepLink.webUrl);
      }
      setPlatformLaunched(true);
    } catch {
      // platform launch is best-effort
    }

    onProceedToAnalysis(customPrompt.trim(), selectedPlatformKey, editPlan);
    setIsUploading(false);
  }, [isUploading, uploadDone, videoUri, selectedPlatformKey, customPrompt, editPlan, onProceedToAnalysis, uriToBlob, uploadWithRetry]);

  const handleShareText = useCallback(async () => {
    const text = customPrompt.trim() || '새로운 숏폼 영상이 완성되었습니다!';
    if (Platform.OS === 'web') {
      try {
        await navigator.clipboard.writeText(text);
      } catch { /* ignore */ }
    } else {
      try {
        await RNShare.share({ message: text });
      } catch { /* ignore */ }
    }
  }, [customPrompt]);

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
              {PLATFORM_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const isActive = selectedPlatformKey === opt.key;
                return (
                  <TouchableOpacity
                    key={opt.key}
                    style={[styles.platformChip, isActive && { borderColor: opt.color, backgroundColor: opt.color + '15' }]}
                    onPress={() => { setSelectedPlatformKey(opt.key); setSelectedHookId(null); }}
                    activeOpacity={0.7}
                  >
                    <Icon size={20} color={isActive ? opt.color : theme.colors.dark.textDim} strokeWidth={2} />
                    <Text style={[styles.platformChipText, isActive && { color: opt.color }]}>{opt.label}</Text>
                    {isActive && <Check size={14} color={opt.color} strokeWidth={2.5} />}
                  </TouchableOpacity>
                );
              })}
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
                <Text style={styles.metaVal}>{editPlan.bgmTemplate.label} ({editPlan.bgmTemplate.mood}, {editPlan.bgmTemplate.bpm} BPM)</Text>
              </View>
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

            <ShortFormPreviewPlayer editPlan={editPlan} videoUri={videoUri} />

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
                    <Shield size={11} color="#fff" strokeWidth={2.2} />
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
                {platformLaunched ? `${platformLabel} 앱 실행됨` : `${platformLabel} 앱에서 발행`}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.actionBtnSecondary} onPress={handleShareText} activeOpacity={0.7}>
              <Share2 size={16} color={theme.colors.dark.textDim} strokeWidth={2} />
              <Text style={styles.actionBtnSecondaryText}>공유 문구 복사</Text>
            </TouchableOpacity>

            {!gallerySaved && (
              <Text style={styles.stepHint}>갤러리 저장 후 플랫폼 발행이 활성화됩니다.</Text>
            )}

            <TouchableOpacity
              style={[styles.proceedBtn, uploadDone && styles.actionBtnDone, fallbackUsed && styles.proceedBtnFallback]}
              onPress={handleProceed}
              disabled={isUploading || uploadDone}
              activeOpacity={0.85}
            >
              {uploadDone ? (
                <Check size={18} color="#fff" strokeWidth={2.5} />
              ) : fallbackUsed ? (
                <Share2 size={18} color="#fff" strokeWidth={2.2} />
              ) : (
                <Cloud size={18} color="#fff" strokeWidth={2.2} />
              )}
              <Text style={styles.proceedBtnText}>
                {isUploading && !uploadRetrying
                  ? '클라우드 저장 중...'
                  : uploadRetrying
                  ? `재시도 중 (${uploadRetryCount}/3)...`
                  : uploadDone
                  ? '클라우드 저장 & 공유 완료'
                  : fallbackUsed
                  ? '로컬 공유로 전환됨'
                  : `클라우드 저장 & ${platformLabel} 공유`}
              </Text>
            </TouchableOpacity>
            {fallbackUsed && !uploadDone && (
              <Text style={styles.fallbackHint}>
                클라우드 업로드 실패 — 로컬 다운로드 및 {platformLabel} 공유로 자동 전환되었습니다. 발행을 계속 진행하세요.
              </Text>
            )}
          </StepCard>
        </ScrollView>
      </View>
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
  actionBtnSecondary: {
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
  actionBtnSecondaryText: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.textDim,
  },
  stepHint: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.warning[400],
    textAlign: 'center',
  },
  proceedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.warning[500],
    marginTop: 4,
  },
  proceedBtnText: {
    fontSize: 15,
    fontFamily: theme.typography.fontFamily.bold,
    color: '#fff',
  },
  proceedBtnFallback: {
    backgroundColor: theme.colors.accent[500],
  },
  fallbackHint: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.warning[400],
    textAlign: 'center',
    lineHeight: 16,
  },
});
