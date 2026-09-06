import { useState, useCallback } from 'react';
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
} from 'lucide-react-native';
import { theme } from '@/lib/theme';
import { getDeepLink, type UploadPlatformKey } from '@/lib/platformUpload';

type PlatformOption = {
  key: UploadPlatformKey;
  label: string;
  icon: typeof Instagram;
  color: string;
};

const PLATFORM_OPTIONS: PlatformOption[] = [
  { key: 'instagram', label: '인스타그램', icon: Instagram, color: theme.colors.accent[500] },
  { key: 'tiktok', label: '틱톡', icon: MusicIcon, color: theme.colors.dark.text },
  { key: 'youtube', label: '유튜브 쇼츠', icon: Youtube, color: theme.colors.error[500] },
  { key: 'naver_clip', label: '네이버 클립', icon: MonitorIcon, color: theme.colors.primary[400] },
];

interface PostCaptureWorkflowProps {
  visible: boolean;
  videoUri: string | null;
  onProceedToAnalysis: (customPrompt: string, platform: UploadPlatformKey) => void;
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
  const [selectedPlatform, setSelectedPlatform] = useState<UploadPlatformKey>('instagram');
  const [customPrompt, setCustomPrompt] = useState('');
  const [gallerySaved, setGallerySaved] = useState(false);
  const [savingToGallery, setSavingToGallery] = useState(false);
  const [platformLaunched, setPlatformLaunched] = useState(false);

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
    const deepLink = getDeepLink(selectedPlatform);
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
  }, [selectedPlatform]);

  const handleProceed = useCallback(() => {
    onProceedToAnalysis(customPrompt.trim(), selectedPlatform);
  }, [customPrompt, selectedPlatform, onProceedToAnalysis]);

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

  const platformLabel = PLATFORM_OPTIONS.find((p) => p.key === selectedPlatform)?.label ?? '';

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
          {/* Step 1: Platform Selection */}
          <StepCard
            stepNum={1}
            title="플랫폼 선택"
            subtitle={platformLabel ? `선택됨: ${platformLabel}` : '발행할 SNS 플랫폼을 선택하세요'}
            expanded={activeStep === 1}
            onToggle={() => handleStepToggle(1)}
          >
            <View style={styles.platformGrid}>
              {PLATFORM_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const isActive = selectedPlatform === opt.key;
                return (
                  <TouchableOpacity
                    key={opt.key}
                    style={[styles.platformChip, isActive && { borderColor: opt.color, backgroundColor: opt.color + '15' }]}
                    onPress={() => setSelectedPlatform(opt.key)}
                    activeOpacity={0.7}
                  >
                    <Icon size={20} color={isActive ? opt.color : theme.colors.dark.textDim} strokeWidth={2} />
                    <Text style={[styles.platformChipText, isActive && { color: opt.color }]}>{opt.label}</Text>
                    {isActive && <Check size={14} color={opt.color} strokeWidth={2.5} />}
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={styles.safeZoneHint}>
              선택한 플랫폼의 자막 안전지대(Safe Zone) 및 9:16 세로 비율이 AI 편집에 자동 적용됩니다.
            </Text>
            <TouchableOpacity style={styles.stepNextBtn} onPress={() => setActiveStep(2)} activeOpacity={0.8}>
              <Text style={styles.stepNextBtnText}>다음 단계: AI 편집</Text>
              <ArrowRight size={16} color="#fff" strokeWidth={2.5} />
            </TouchableOpacity>
          </StepCard>

          {/* Step 2: AI Semi-Auto Editing */}
          <StepCard
            stepNum={2}
            title="AI 반자동 편집"
            subtitle="홍보 포인트를 입력하면 AI가 자막·톤앤매너에 반영합니다"
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
              onChangeText={setCustomPrompt}
              placeholder="예: 오늘 갓 구운 소금빵 30% 할인, 절대 놓치지 마세요!"
              placeholderTextColor={theme.colors.dark.textFaint}
              multiline
              maxLength={200}
            />
            <Text style={styles.promptHint}>
              입력한 키워드가 AI 메타데이터에 실시간 반영되어 후킹 문구와 자막 스타일에 적용됩니다.
            </Text>
            <View style={styles.metaInfoBox}>
              <View style={styles.metaRow}>
                <Text style={styles.metaKey}>비율</Text>
                <Text style={styles.metaVal}>9:16 세로형</Text>
              </View>
              <View style={styles.metaRow}>
                <Text style={styles.metaKey}>플랫폼</Text>
                <Text style={styles.metaVal}>{platformLabel}</Text>
              </View>
              <View style={styles.metaRow}>
                <Text style={styles.metaKey}>안전지대</Text>
                <Text style={styles.metaVal}>상하단 자막 영역 확보</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.stepNextBtn} onPress={() => setActiveStep(3)} activeOpacity={0.8}>
              <Text style={styles.stepNextBtnText}>다음 단계: 저장 & 발행</Text>
              <ArrowRight size={16} color="#fff" strokeWidth={2.5} />
            </TouchableOpacity>
          </StepCard>

          {/* Step 3: Gallery Save + Platform Share */}
          <StepCard
            stepNum={3}
            title="갤러리 저장 & 플랫폼 발행"
            subtitle="기기에 저장하고 SNS로 바로 발행하세요"
            expanded={activeStep === 3}
            onToggle={() => handleStepToggle(3)}
          >
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

            <TouchableOpacity style={styles.proceedBtn} onPress={handleProceed} activeOpacity={0.85}>
              <Sparkles size={18} color="#fff" strokeWidth={2.2} />
              <Text style={styles.proceedBtnText}>AI 분석으로 최종 숏폼 생성</Text>
            </TouchableOpacity>
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
});
