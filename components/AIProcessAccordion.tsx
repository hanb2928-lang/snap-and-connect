import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  LayoutAnimation,
  Platform as RNPlatform,
  UIManager,
} from 'react-native';
import {
  ChevronDown,
  ChevronUp,
  Box,
  Radio,
  Upload,
  CheckCircle2,
} from 'lucide-react-native';
import { theme } from '@/lib/theme';
import type { PlatformKey } from '@/types/database';

if (RNPlatform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface AIProcessAccordionProps {
  synthesisStrategy: string;
  volumeConfidence: number;
  contextLabel: string;
  processingSteps: string[];
  hookTransitionType: string;
  hookDescription: string;
  sfxCount: number;
  killPointCount: number;
  beatSyncBpm: number;
  cutPointCount: number;
  activePlatform: PlatformKey;
  platformLabel: string;
  renderWidth: number;
  renderHeight: number;
  renderCodec: string;
  renderFps: number;
  hashtags: string[];
  captionPreview: string;
  analysisStatus: 'idle' | 'processing' | 'done' | 'error';
}

const STEP_META = [
  { key: 'synthesis', label: 'AI 입체 볼륨 합성', icon: Box, color: theme.colors.primary[400] },
  { key: 'directing', label: '심리 리듬 연출', icon: Radio, color: theme.colors.accent[400] },
  { key: 'rendering', label: '플랫폼 렌더링 & 메타데이터', icon: Upload, color: theme.colors.warning[400] },
] as const;

export function AIProcessAccordion({
  synthesisStrategy,
  volumeConfidence,
  contextLabel,
  processingSteps,
  hookTransitionType,
  hookDescription,
  sfxCount,
  killPointCount,
  beatSyncBpm,
  cutPointCount,
  platformLabel,
  renderWidth,
  renderHeight,
  renderCodec,
  renderFps,
  hashtags,
  captionPreview,
  analysisStatus,
}: AIProcessAccordionProps) {
  const [expanded, setExpanded] = useState(false);
  const [openStep, setOpenStep] = useState<number | null>(0);

  const toggleExpanded = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((prev) => !prev);
  };

  const toggleStep = (idx: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpenStep((prev) => (prev === idx ? null : idx));
  };

  const confidencePct = Math.round(volumeConfidence * 100);
  const isProcessing = analysisStatus === 'processing';

  const hookTypeLabel: Record<string, string> = {
    rotation_zoom: '3D 회전 줌인',
    dramatic_zoom_in: '극적 줌인',
    paradox_reveal: '패러독스 반전',
    context_cut: '맥락 컷 전환',
    detail_punch: '디테일 클로즈업',
  };
  const hookLabel = hookTypeLabel[hookTransitionType] ?? hookTransitionType;

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.header}
        onPress={toggleExpanded}
        activeOpacity={0.7}
      >
        <View style={styles.headerLeft}>
          <View style={styles.headerIconWrap}>
            <Box size={18} color={theme.colors.primary[400]} strokeWidth={2} />
          </View>
          <View>
            <Text style={styles.headerTitle}>AI 연산 및 숏폼 고도화 프로세스</Text>
            <Text style={styles.headerSub} numberOfLines={1}>
              {isProcessing
                ? '클라우드 AI 처리 중...'
                : `3단계 완료 · ${synthesisStrategy}`}
            </Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          {!isProcessing && (
            <View style={styles.doneBadge}>
              <CheckCircle2 size={11} color={theme.colors.success[400]} strokeWidth={2.5} />
              <Text style={styles.doneBadgeText}>완료</Text>
            </View>
          )}
          {expanded ? (
            <ChevronUp size={20} color={theme.colors.dark.textDim} strokeWidth={2} />
          ) : (
            <ChevronDown size={20} color={theme.colors.dark.textDim} strokeWidth={2} />
          )}
        </View>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.body}>
          {/* Step 1: Synthesis */}
          <StepCard
            index={0}
            label={STEP_META[0].label}
            icon={STEP_META[0].icon}
            color={STEP_META[0].color}
            isOpen={openStep === 0}
            onToggle={() => toggleStep(0)}
          >
            <View style={styles.stepContent}>
              <View style={styles.chipRow}>
                <View style={styles.chip}>
                  <Text style={styles.chipText}>전략: {synthesisStrategy}</Text>
                </View>
                <View style={styles.chip}>
                  <Text style={styles.chipText}>맥락: {contextLabel}</Text>
                </View>
              </View>
              <View style={styles.confidenceBar}>
                <View style={styles.confidenceBarHeader}>
                  <Text style={styles.confidenceLabel}>볼륨 신뢰도</Text>
                  <Text style={styles.confidenceValue}>{confidencePct}%</Text>
                </View>
                <View style={styles.confidenceTrack}>
                  <View
                    style={[
                      styles.confidenceFill,
                      {
                        width: `${confidencePct}%`,
                        backgroundColor: confidencePct >= 70
                          ? theme.colors.success[400]
                          : confidencePct >= 40
                            ? theme.colors.warning[400]
                            : theme.colors.error[400],
                      },
                    ]}
                  />
                </View>
              </View>
              <View style={styles.angleRow}>
                {['정면', '좌측', '우측', '후면', '상부'].map((angle, i) => (
                  <View key={angle} style={styles.angleChip}>
                    <View style={[styles.angleDot, { backgroundColor: i < 3 ? theme.colors.primary[400] : theme.colors.dark.border }]} />
                    <Text style={[styles.angleText, { color: i < 3 ? theme.colors.dark.text : theme.colors.dark.textFaint }]}>
                      {angle}
                    </Text>
                  </View>
                ))}
              </View>
              {processingSteps.length > 0 && (
                <View style={styles.stepList}>
                  {processingSteps.map((step, i) => (
                    <View key={i} style={styles.stepListItem}>
                      <View style={styles.stepListDot} />
                      <Text style={styles.stepListText}>{step}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </StepCard>

          {/* Step 2: Directing */}
          <StepCard
            index={1}
            label={STEP_META[1].label}
            icon={STEP_META[1].icon}
            color={STEP_META[1].color}
            isOpen={openStep === 1}
            onToggle={() => toggleStep(1)}
          >
            <View style={styles.stepContent}>
              <View style={styles.directingRow}>
                <View style={styles.directingCard}>
                  <Text style={styles.directingCardLabel}>오프닝 훅</Text>
                  <Text style={styles.directingCardValue}>{hookLabel}</Text>
                  <Text style={styles.directingCardDesc} numberOfLines={2}>{hookDescription}</Text>
                </View>
              </View>
              <View style={styles.chipRow}>
                <View style={styles.chip}>
                  <Text style={styles.chipText}>BPM {beatSyncBpm}</Text>
                </View>
                <View style={styles.chip}>
                  <Text style={styles.chipText}>컷 전환 {cutPointCount}회</Text>
                </View>
                <View style={styles.chip}>
                  <Text style={styles.chipText}>SFX {sfxCount}종</Text>
                </View>
                <View style={styles.chip}>
                  <Text style={styles.chipText}>킬링 자막 {killPointCount}개</Text>
                </View>
              </View>
              <View style={styles.timelineBar}>
                <View style={[styles.timelineSegment, { flex: 3, backgroundColor: theme.colors.primary[500] }]}>
                  <Text style={styles.timelineSegmentText}>3s 훅</Text>
                </View>
                <View style={[styles.timelineSegment, { flex: 4, backgroundColor: theme.colors.accent[500] }]}>
                  <Text style={styles.timelineSegmentText}>소개</Text>
                </View>
                <View style={[styles.timelineSegment, { flex: 4, backgroundColor: theme.colors.warning[500] }]}>
                  <Text style={styles.timelineSegmentText}>혜택</Text>
                </View>
                <View style={[styles.timelineSegment, { flex: 2, backgroundColor: theme.colors.success[500] }]}>
                  <Text style={styles.timelineSegmentText}>CTA</Text>
                </View>
              </View>
              <Text style={styles.timelineHint}>0s ─────────── 15s</Text>
            </View>
          </StepCard>

          {/* Step 3: Rendering & Metadata */}
          <StepCard
            index={2}
            label={STEP_META[2].label}
            icon={STEP_META[2].icon}
            color={STEP_META[2].color}
            isOpen={openStep === 2}
            onToggle={() => toggleStep(2)}
          >
            <View style={styles.stepContent}>
              <View style={styles.renderBox}>
                <View style={styles.renderRow}>
                  <Text style={styles.renderLabel}>타겟 플랫폼</Text>
                  <Text style={styles.renderValue}>{platformLabel}</Text>
                </View>
                <View style={styles.renderRow}>
                  <Text style={styles.renderLabel}>해상도</Text>
                  <Text style={styles.renderValue}>{renderWidth}×{renderHeight} ({renderWidth >= renderHeight ? '1:1' : renderHeight / renderWidth > 1.3 ? '9:16' : '4:5'})</Text>
                </View>
                <View style={styles.renderRow}>
                  <Text style={styles.renderLabel}>코덱 / 프레임</Text>
                  <Text style={styles.renderValue}>{renderCodec} · {renderFps}fps</Text>
                </View>
              </View>
              {hashtags.length > 0 && (
                <View style={styles.metadataPreview}>
                  <Text style={styles.metadataPreviewLabel}>AI 자동 해시태그</Text>
                  <View style={styles.hashtagWrap}>
                    {hashtags.slice(0, 8).map((tag, i) => (
                      <View key={i} style={styles.hashtagChip}>
                        <Text style={styles.hashtagChipText}>#{tag}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
              {captionPreview ? (
                <View style={styles.metadataPreview}>
                  <Text style={styles.metadataPreviewLabel}>AI 생성 설명 미리보기</Text>
                  <Text style={styles.captionPreviewText} numberOfLines={3}>{captionPreview}</Text>
                </View>
              ) : null}
            </View>
          </StepCard>
        </View>
      )}
    </View>
  );
}

interface StepCardProps {
  index: number;
  label: string;
  icon: typeof Box;
  color: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

function StepCard({ index, label, icon: Icon, color, isOpen, onToggle, children }: StepCardProps) {
  return (
    <View style={styles.stepCard}>
      <TouchableOpacity
        style={styles.stepHeader}
        onPress={onToggle}
        activeOpacity={0.7}
      >
        <View style={styles.stepHeaderLeft}>
          <View style={[styles.stepNumber, { backgroundColor: color + '20' }]}>
            <Text style={[styles.stepNumberText, { color }]}>{index + 1}</Text>
          </View>
          <Icon size={16} color={color} strokeWidth={2} />
          <Text style={styles.stepLabel}>{label}</Text>
        </View>
        {isOpen ? (
          <ChevronUp size={16} color={theme.colors.dark.textDim} strokeWidth={2} />
        ) : (
          <ChevronDown size={16} color={theme.colors.dark.textDim} strokeWidth={2} />
        )}
      </TouchableOpacity>
      {isOpen && <View style={styles.stepBody}>{children}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.dark.surface,
    borderRadius: theme.radius.lg,
    marginVertical: theme.spacing.xs,
    ...theme.shadows.card,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: theme.spacing.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  headerIconWrap: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primary[500] + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
  },
  headerSub: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  doneBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: theme.colors.success[400] + '18',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  doneBadgeText: {
    fontSize: 9,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.success[400],
  },
  body: {
    paddingHorizontal: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
    gap: 8,
  },
  // Step card
  stepCard: {
    backgroundColor: theme.colors.dark.surfaceLight,
    borderRadius: theme.radius.md,
    overflow: 'hidden',
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  stepHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  stepNumber: {
    width: 22,
    height: 22,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNumberText: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.bold,
  },
  stepLabel: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.text,
  },
  stepBody: {
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  stepContent: {
    gap: 10,
  },
  // Chips
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    backgroundColor: theme.colors.dark.border + '60',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  chipText: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
  },
  // Confidence bar
  confidenceBar: {
    gap: 4,
  },
  confidenceBarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  confidenceLabel: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.textDim,
  },
  confidenceValue: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
  },
  confidenceTrack: {
    height: 6,
    backgroundColor: theme.colors.dark.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  confidenceFill: {
    height: '100%',
    borderRadius: 3,
  },
  // Angle chips
  angleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  angleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  angleDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  angleText: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.regular,
  },
  // Step list
  stepList: {
    gap: 4,
    marginTop: 2,
  },
  stepListItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  stepListDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.primary[400],
    marginTop: 5,
  },
  stepListText: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    flex: 1,
  },
  // Directing
  directingRow: {
    gap: 6,
  },
  directingCard: {
    backgroundColor: theme.colors.dark.border + '40',
    borderRadius: theme.radius.sm,
    padding: 10,
  },
  directingCardLabel: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textFaint,
  },
  directingCardValue: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.accent[400],
    marginTop: 2,
  },
  directingCardDesc: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    marginTop: 3,
  },
  // Timeline
  timelineBar: {
    flexDirection: 'row',
    height: 24,
    borderRadius: 6,
    overflow: 'hidden',
    gap: 2,
  },
  timelineSegment: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  timelineSegmentText: {
    fontSize: 9,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: '#fff',
  },
  timelineHint: {
    fontSize: 9,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textFaint,
    textAlign: 'center',
  },
  // Render
  renderBox: {
    backgroundColor: theme.colors.dark.border + '40',
    borderRadius: theme.radius.sm,
    padding: 10,
    gap: 6,
  },
  renderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  renderLabel: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textFaint,
  },
  renderValue: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
  },
  // Metadata preview
  metadataPreview: {
    marginTop: 4,
  },
  metadataPreviewLabel: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.textDim,
    marginBottom: 6,
  },
  hashtagWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  hashtagChip: {
    backgroundColor: theme.colors.warning[400] + '18',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  hashtagChipText: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.warning[400],
  },
  captionPreviewText: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    lineHeight: 16,
  },
});
