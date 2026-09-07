import { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Platform,
  Share,
} from 'react-native';
import * as Sharing from 'expo-sharing';
import * as MediaLibrary from 'expo-media-library';
import * as Linking from 'expo-linking';
import { Check, Loader, AlertCircle, Sparkles, Download, Share2, ArrowRight, Zap, Box, Film, Rocket } from 'lucide-react-native';
import { theme } from '@/lib/theme';
import { useSafeTop } from '@/hooks/useSafeTop';
import { useTabBarHeight } from '@/hooks/useTabBarHeight';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  type StereoPipelineProgress,
  type StereoPipelineResult,
  type StereoStepKey,
  openPublishDeepLink,
} from '@/lib/stereoPipeline';

interface StereoPipelineOverlayProps {
  visible: boolean;
  progress: StereoPipelineProgress;
  result: StereoPipelineResult | null;
  onDismiss: () => void;
  onGoToEditor: (scanId: string) => void;
  firstImageDataUrl?: string | null;
}

const STEP_ICONS: Record<StereoStepKey, typeof Box> = {
  upload: Box,
  synthesis: Sparkles,
  directing: Film,
  render: Rocket,
  publish: Share2,
};

export function StereoPipelineOverlay({
  visible,
  progress,
  result,
  onDismiss,
  onGoToEditor,
  firstImageDataUrl,
}: StereoPipelineOverlayProps) {
  const safeTop = useSafeTop();
  const tabBarHeight = useTabBarHeight();
  const safeInsets = useSafeAreaInsets();
  const bottomInset = Math.max(safeInsets.bottom, 0);
  const [gallerySaved, setGallerySaved] = useState(false);
  const [savingGallery, setSavingGallery] = useState(false);
  const [publishClicked, setPublishClicked] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const handleSaveToGallery = useCallback(async () => {
    if (!firstImageDataUrl || savingGallery) return;
    setSavingGallery(true);
    try {
      if (Platform.OS === 'web') {
        // Web: trigger download
        const link = document.createElement('a');
        link.href = firstImageDataUrl;
        link.download = `snapconnect-stereo-${Date.now()}.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        // Native: save to media library via sharing
        try {
          const { status } = await MediaLibrary.requestPermissionsAsync();
          if (status === 'granted') {
            // Use Sharing API as fallback for web-compatible builds
            await Sharing.shareAsync(firstImageDataUrl.replace(/^data:[^;]+;base64,/, ''), {
              mimeType: 'image/jpeg',
              dialogTitle: '갤러리에 저장',
            });
          }
        } catch {
          // Non-blocking — gallery save failure doesn't block the pipeline
        }
      }
      if (mountedRef.current) setGallerySaved(true);
    } catch {
      // Non-blocking — gallery save failure doesn't block the pipeline
    } finally {
      if (mountedRef.current) setSavingGallery(false);
    }
  }, [firstImageDataUrl, savingGallery]);

  const handlePublish = useCallback(async (platformKey: string) => {
    setPublishClicked(platformKey);
    try {
      await openPublishDeepLink(platformKey);
    } catch {
      // Ignore — deep link may not be available
    } finally {
      if (mountedRef.current) setPublishClicked(null);
    }
  }, []);

  const isComplete = progress.currentStep >= 4 && result !== null;
  const hasError = progress.error !== null;
  const currentStepData = progress.currentStep >= 0 ? progress.steps[progress.currentStep] : null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={[styles.overlay, { paddingTop: safeTop + theme.spacing.lg }]}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerIconWrap}>
              <Sparkles size={22} color={theme.colors.primary[400]} strokeWidth={2} />
            </View>
            <View style={styles.headerTextWrap}>
              <Text style={styles.headerTitle}>입체컷 오토 · AI 영상 파이프라인</Text>
              <Text style={styles.headerSub}>
                {hasError ? '오류가 발생했습니다' : isComplete ? '파이프라인 완료' : '처리 중...'}
              </Text>
            </View>
            {isComplete && (
              <TouchableOpacity style={styles.closeBtn} onPress={onDismiss} activeOpacity={0.7}>
                <Text style={styles.closeBtnText}>닫기</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Overall progress bar */}
          <View style={styles.overallProgressWrap}>
            <View style={styles.overallProgressTrack}>
              <View
                style={[
                  styles.overallProgressFill,
                  { width: `${Math.round(progress.overallProgress * 100)}%` },
                  hasError && styles.overallProgressFillError,
                ]}
              />
            </View>
            <Text style={styles.overallProgressPct}>
              {hasError ? '오류' : `${Math.round(progress.overallProgress * 100)}%`}
            </Text>
          </View>

          <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Steps */}
            {progress.steps.map((step, idx) => {
              const Icon = STEP_ICONS[step.key];
              const isActive = step.status === 'active';
              const isDone = step.status === 'done';
              const isPending = step.status === 'pending';
              const isError = step.status === 'error';

              return (
                <View
                  key={step.key}
                  style={[
                    styles.stepCard,
                    isActive && styles.stepCardActive,
                    isDone && styles.stepCardDone,
                    isError && styles.stepCardError,
                  ]}
                >
                  <View style={styles.stepHeader}>
                    <View style={[
                      styles.stepIconWrap,
                      isDone && styles.stepIconDone,
                      isActive && styles.stepIconActive,
                      isError && styles.stepIconError,
                    ]}>
                      {isDone ? (
                        <Check size={16} color="#fff" strokeWidth={2.5} />
                      ) : isActive ? (
                        <Loader size={16} color="#fff" strokeWidth={2.5} />
                      ) : isError ? (
                        <AlertCircle size={16} color="#fff" strokeWidth={2.5} />
                      ) : (
                        <Icon size={16} color={theme.colors.dark.textDim} strokeWidth={2} />
                      )}
                    </View>
                    <View style={styles.stepTextWrap}>
                      <Text style={[
                        styles.stepLabel,
                        isPending && styles.stepLabelPending,
                      ]}>
                        STEP {idx + 1}
                      </Text>
                      <Text style={[
                        styles.stepTitle,
                        isPending && styles.stepTitlePending,
                      ]}>
                        {step.label}
                      </Text>
                    </View>
                  </View>
                  {step.detail ? (
                    <Text style={[
                      styles.stepDetail,
                      isActive && styles.stepDetailActive,
                    ]}>
                      {step.detail}
                    </Text>
                  ) : null}
                </View>
              );
            })}

            {/* Error display */}
            {hasError && (
              <View style={styles.errorBox}>
                <AlertCircle size={18} color={theme.colors.error[400]} strokeWidth={2} />
                <Text style={styles.errorText}>{progress.error}</Text>
              </View>
            )}

            {/* Result: synthesis + directing summary */}
            {result && (
              <View style={styles.resultSection}>
                <Text style={styles.resultSectionTitle}>AI 분석 결과 요약</Text>
                <View style={styles.resultCard}>
                  <View style={styles.resultCardHeader}>
                    <Box size={15} color={theme.colors.primary[400]} strokeWidth={2} />
                    <Text style={styles.resultCardTitle}>3D 입체 합성</Text>
                  </View>
                  <Text style={styles.resultCardContent}>{result.synthesisSummary}</Text>
                </View>
                <View style={styles.resultCard}>
                  <View style={styles.resultCardHeader}>
                    <Film size={15} color={theme.colors.primary[400]} strokeWidth={2} />
                    <Text style={styles.resultCardTitle}>심리 리듬 연출</Text>
                  </View>
                  <Text style={styles.resultCardContent}>{result.directingSummary}</Text>
                </View>
              </View>
            )}

            {/* Result: publish plans preview */}
            {result && (
              <View style={styles.resultSection}>
                <Text style={styles.resultSectionTitle}>플랫폼별 메타데이터 미리보기</Text>
                {result.publishPlans.map((plan) => (
                  <View key={plan.target} style={styles.publishPlanCard}>
                    <View style={styles.publishPlanHeader}>
                      <Text style={styles.publishPlanTarget}>{plan.render.label}</Text>
                      <Text style={styles.publishPlanSpec}>
                        {plan.render.width}×{plan.render.height} · {plan.render.codec} · {plan.render.fps}fps
                      </Text>
                    </View>
                    <Text style={styles.publishPlanTitle} numberOfLines={2}>{plan.metadata.title}</Text>
                    <Text style={styles.publishPlanDesc} numberOfLines={2}>{plan.metadata.description}</Text>
                    <View style={styles.hashtagRow}>
                      {plan.metadata.hashtags.slice(0, 5).map((tag) => (
                        <Text key={tag} style={styles.hashtagChip}>{tag}</Text>
                      ))}
                    </View>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>

          {/* Bottom actions */}
          {isComplete && result && (
            <View style={[styles.bottomBar, { paddingBottom: tabBarHeight + bottomInset + theme.spacing.sm }]}>
              {/* Gallery save — non-blocking, always available */}
              <TouchableOpacity
                style={[styles.actionBtn, styles.galleryBtn, gallerySaved && styles.galleryBtnDone]}
                onPress={handleSaveToGallery}
                disabled={savingGallery || gallerySaved}
                activeOpacity={0.7}
              >
                {savingGallery ? (
                  <Loader size={18} color="#fff" strokeWidth={2} />
                ) : gallerySaved ? (
                  <Check size={18} color="#fff" strokeWidth={2.5} />
                ) : (
                  <Download size={18} color="#fff" strokeWidth={2} />
                )}
                <Text style={styles.actionBtnText}>
                  {gallerySaved ? '갤러리 저장됨' : savingGallery ? '저장 중...' : '갤러리 저장'}
                </Text>
              </TouchableOpacity>

              {/* Publish deep links */}
              {result.publishTargets.map((target) => (
                <TouchableOpacity
                  key={target.key}
                  style={[styles.actionBtn, styles.publishBtn]}
                  onPress={() => handlePublish(target.key)}
                  disabled={publishClicked === target.key}
                  activeOpacity={0.7}
                >
                  {publishClicked === target.key ? (
                    <Loader size={16} color="#fff" strokeWidth={2} />
                  ) : (
                    <Share2 size={16} color="#fff" strokeWidth={2} />
                  )}
                  <Text style={styles.publishBtnText}>{target.label}</Text>
                </TouchableOpacity>
              ))}

              {/* Go to editor */}
              <TouchableOpacity
                style={[styles.actionBtn, styles.editorBtn]}
                onPress={() => onGoToEditor(result.scanId)}
                activeOpacity={0.7}
              >
                <Zap size={18} color="#fff" strokeWidth={2.5} />
                <Text style={styles.actionBtnText}>편집 화면으로</Text>
                <ArrowRight size={16} color="#fff" strokeWidth={2} />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(3, 5, 15, 0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    flex: 1,
    width: '100%',
    backgroundColor: theme.colors.dark.bg,
    borderRadius: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  headerIconWrap: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.primary[500] + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTextWrap: {
    flex: 1,
    gap: 2,
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.dark.text,
  },
  headerSub: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
  },
  closeBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: theme.colors.dark.surface,
    borderRadius: theme.radius.md,
  },
  closeBtnText: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.textDim,
  },
  overallProgressWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  overallProgressTrack: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.dark.surfaceLight,
    overflow: 'hidden',
  },
  overallProgressFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: theme.colors.primary[500],
  },
  overallProgressFillError: {
    backgroundColor: theme.colors.error[500],
  },
  overallProgressPct: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.primary[400],
    minWidth: 40,
    textAlign: 'right',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  stepCard: {
    backgroundColor: theme.colors.dark.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.dark.border,
    gap: theme.spacing.xs,
  },
  stepCardActive: {
    borderColor: theme.colors.primary[500] + '60',
    backgroundColor: theme.colors.primary[500] + '0A',
  },
  stepCardDone: {
    borderColor: theme.colors.success[500] + '30',
  },
  stepCardError: {
    borderColor: theme.colors.error[500] + '50',
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  stepIconWrap: {
    width: 30,
    height: 30,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.dark.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepIconDone: {
    backgroundColor: theme.colors.success[500],
  },
  stepIconActive: {
    backgroundColor: theme.colors.primary[500],
  },
  stepIconError: {
    backgroundColor: theme.colors.error[500],
  },
  stepTextWrap: {
    flex: 1,
    gap: 1,
  },
  stepLabel: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.primary[400],
    letterSpacing: 0.5,
  },
  stepLabelPending: {
    color: theme.colors.dark.textFaint,
  },
  stepTitle: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
  },
  stepTitlePending: {
    color: theme.colors.dark.textDim,
  },
  stepDetail: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    lineHeight: 17,
    paddingLeft: 38,
  },
  stepDetailActive: {
    color: theme.colors.dark.text,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.colors.error[500] + '15',
    borderRadius: theme.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: theme.spacing.sm,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.error[400],
    lineHeight: 18,
  },
  resultSection: {
    marginTop: theme.spacing.md,
    gap: theme.spacing.xs,
  },
  resultSectionTitle: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
    marginBottom: 4,
  },
  resultCard: {
    backgroundColor: theme.colors.dark.surface,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.dark.border,
    gap: 6,
  },
  resultCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  resultCardTitle: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
  },
  resultCardContent: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    lineHeight: 17,
  },
  publishPlanCard: {
    backgroundColor: theme.colors.dark.surface,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.dark.border,
    gap: 6,
  },
  publishPlanHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  publishPlanTarget: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.primary[400],
  },
  publishPlanSpec: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textFaint,
  },
  publishPlanTitle: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
    lineHeight: 18,
  },
  publishPlanDesc: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    lineHeight: 16,
  },
  hashtagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 2,
  },
  hashtagChip: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.primary[300],
    backgroundColor: theme.colors.primary[500] + '15',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.radius.sm,
    overflow: 'hidden',
  },
  bottomBar: {
    backgroundColor: theme.colors.dark.surface,
    borderTopWidth: 1,
    borderTopColor: theme.colors.dark.border,
    paddingTop: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    gap: theme.spacing.xs,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: theme.radius.lg,
  },
  galleryBtn: {
    backgroundColor: theme.colors.success[600],
  },
  galleryBtnDone: {
    backgroundColor: theme.colors.dark.surfaceLight,
  },
  publishBtn: {
    backgroundColor: theme.colors.primary[600],
    paddingVertical: 11,
  },
  publishBtnText: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: '#fff',
  },
  editorBtn: {
    backgroundColor: theme.colors.warning[500],
  },
  actionBtnText: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: '#fff',
  },
});
