import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  LayoutAnimation,
  Platform as RNPlatform,
  UIManager,
  TextInput,
} from 'react-native';
import {
  ChevronDown,
  ChevronUp,
  Box,
  Radio,
  Upload,
  CheckCircle2,
  Video,
  Type,
  Music,
  Wand2,
  RefreshCw,
} from 'lucide-react-native';
import { theme } from '@/lib/theme';
import type { PlatformKey } from '@/types/database';

if (RNPlatform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export type HookEffectType = 'rotation_zoom' | 'dramatic_zoom_in' | 'paradox_reveal' | 'context_cut' | 'detail_punch';

export interface InlineEditState {
  volumeIntensity: number;
  hookEffect: HookEffectType;
  beatSyncSensitivity: number;
  sfxStyle: string;
  captionText: string;
  hashtags: string[];
  videoTemplate: string;
  captionFont: string;
  captionPosition: string;
  bgmMood: string;
  aiPrompt: string;
  titleText: string;
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
  editState: InlineEditState;
  onEditChange: (patch: Partial<InlineEditState>) => void;
  onRemoveHashtag: (tag: string) => void;
  onRegenerate: () => void;
  isRegenerating: boolean;
}

const VIDEO_TEMPLATES = ['트렌디 쇼핑', '라이프스타일', '제품 집중', '스토리텔링', 'ASMR 리뷰'];
const CAPTION_FONTS = ['고딕 굵게', '명조 우아', '손글씨 캐주얼', '미니멀 얇게', '스포츠 강조'];
const CAPTION_POSITIONS = ['하단 고정', '상단 고정', '중앙', '하단 + 상단 번갈', '좌측 세로'];
const BGM_MOODS = ['하이텐션', '시네마틱', 'ASMR', '감성', '로파이', '트렌디'];

const HOOK_LABELS: Record<string, string> = {
  rotation_zoom: '3D 회전 줌인',
  dramatic_zoom_in: '극적 줌인',
  paradox_reveal: '패러독스 반전',
  context_cut: '맥락 컷 전환',
  detail_punch: '디테일 클로즈업',
};

export function AIProcessAccordion({
  synthesisStrategy,
  volumeConfidence,
  contextLabel,
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
  analysisStatus,
  editState,
  onEditChange,
  onRemoveHashtag,
  onRegenerate,
  isRegenerating,
}: AIProcessAccordionProps) {
  const [expanded, setExpanded] = useState(true);
  const [step3Open, setStep3Open] = useState(true);
  const [openDetail, setOpenDetail] = useState<number | null>(null);

  useEffect(() => {
    if (analysisStatus === 'done') {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setStep3Open(true);
    }
  }, [analysisStatus]);

  const toggleExpanded = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((prev) => !prev);
  };

  const toggleStep3 = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setStep3Open((prev) => !prev);
  };

  const toggleDetail = (idx: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpenDetail((prev) => (prev === idx ? null : idx));
  };

  const confidencePct = Math.round(volumeConfidence * 100);
  const isProcessing = analysisStatus === 'processing';
  const hookLabel = HOOK_LABELS[editState.hookEffect] ?? editState.hookEffect;
  const aspectLabel = renderWidth >= renderHeight ? '1:1'
    : renderHeight / renderWidth > 1.3 ? '9:16' : '4:5';

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.header} onPress={toggleExpanded} activeOpacity={0.7}>
        <View style={styles.headerLeft}>
          <View style={styles.headerIconWrap}>
            <Box size={18} color={theme.colors.primary[400]} strokeWidth={2} />
          </View>
          <View>
            <Text style={styles.headerTitle}>AI 연산 및 숏폼 고도화 프로세스</Text>
            <Text style={styles.headerSub} numberOfLines={1}>
              {isProcessing ? '클라우드 AI 처리 중...' : `3단계 완료 · ${synthesisStrategy}`}
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
          {/* STEP 3 — pinned to top, expanded by default */}
          <View style={styles.step3Card}>
            <TouchableOpacity style={styles.step3Header} onPress={toggleStep3} activeOpacity={0.7}>
              <View style={styles.step3HeaderLeft}>
                <View style={styles.step3Number}>
                  <Text style={styles.step3NumberText}>3</Text>
                </View>
                <Upload size={18} color={theme.colors.warning[400]} strokeWidth={2} />
                <Text style={styles.step3Label}>가상 영상 편집 & 프롬프트</Text>
              </View>
              {step3Open ? (
                <ChevronUp size={18} color={theme.colors.dark.textDim} strokeWidth={2} />
              ) : (
                <ChevronDown size={18} color={theme.colors.dark.textDim} strokeWidth={2} />
              )}
            </TouchableOpacity>

            {step3Open && (
              <View style={styles.step3Body}>
                {/* Render info */}
                <View style={styles.renderBox}>
                  <View style={styles.renderRow}>
                    <Text style={styles.renderLabel}>타겟 플랫폼</Text>
                    <Text style={styles.renderValue}>{platformLabel}</Text>
                  </View>
                  <View style={styles.renderRow}>
                    <Text style={styles.renderLabel}>해상도</Text>
                    <Text style={styles.renderValue}>{renderWidth}x{renderHeight} ({aspectLabel})</Text>
                  </View>
                  <View style={styles.renderRow}>
                    <Text style={styles.renderLabel}>코덱 / 프레임</Text>
                    <Text style={styles.renderValue}>{renderCodec} . {renderFps}fps</Text>
                  </View>
                </View>

                {/* Video template chips */}
                <View style={styles.editBox}>
                  <View style={styles.editHeader}>
                    <Video size={12} color={theme.colors.accent[300]} strokeWidth={2} />
                    <Text style={styles.editLabel}>영상 템플릿 스타일</Text>
                  </View>
                  <View style={styles.chipRow}>
                    {VIDEO_TEMPLATES.map((tmpl) => (
                      <TouchableOpacity
                        key={tmpl}
                        style={[styles.chip, editState.videoTemplate === tmpl && styles.chipActive]}
                        onPress={() => onEditChange({ videoTemplate: tmpl })}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.chipText, editState.videoTemplate === tmpl && styles.chipTextActive]}>
                          {tmpl}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Caption style */}
                <View style={styles.editBox}>
                  <View style={styles.editHeader}>
                    <Type size={12} color={theme.colors.accent[300]} strokeWidth={2} />
                    <Text style={styles.editLabel}>자막 스타일</Text>
                  </View>
                  <View style={styles.chipRow}>
                    {CAPTION_FONTS.map((font) => (
                      <TouchableOpacity
                        key={font}
                        style={[styles.chip, editState.captionFont === font && styles.chipActive]}
                        onPress={() => onEditChange({ captionFont: font })}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.chipText, editState.captionFont === font && styles.chipTextActive]}>
                          {font}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <View style={styles.chipRow}>
                    {CAPTION_POSITIONS.map((pos) => (
                      <TouchableOpacity
                        key={pos}
                        style={[styles.chip, editState.captionPosition === pos && styles.chipActive]}
                        onPress={() => onEditChange({ captionPosition: pos })}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.chipText, editState.captionPosition === pos && styles.chipTextActive]}>
                          {pos}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* BGM mood */}
                <View style={styles.editBox}>
                  <View style={styles.editHeader}>
                    <Music size={12} color={theme.colors.accent[300]} strokeWidth={2} />
                    <Text style={styles.editLabel}>BGM 분위기</Text>
                  </View>
                  <View style={styles.chipRow}>
                    {BGM_MOODS.map((mood) => (
                      <TouchableOpacity
                        key={mood}
                        style={[styles.chip, editState.bgmMood === mood && styles.chipActive]}
                        onPress={() => onEditChange({ bgmMood: mood })}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.chipText, editState.bgmMood === mood && styles.chipTextActive]}>
                          {mood}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* AI prompt */}
                <View style={styles.editBox}>
                  <View style={styles.editHeader}>
                    <Wand2 size={12} color={theme.colors.primary[300]} strokeWidth={2} />
                    <Text style={styles.editLabel}>AI 가상 영상 프롬프트</Text>
                  </View>
                  <TextInput
                    style={styles.textInput}
                    value={editState.aiPrompt}
                    onChangeText={(text) => onEditChange({ aiPrompt: text })}
                    placeholder="원하는 연출 분위기나 강조 사항을 입력하세요"
                    placeholderTextColor={theme.colors.dark.textFaint}
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                  />
                  <TouchableOpacity
                    style={[styles.regenBtn, isRegenerating && styles.regenBtnDisabled]}
                    onPress={onRegenerate}
                    disabled={isRegenerating}
                    activeOpacity={0.7}
                  >
                    <RefreshCw size={13} color={isRegenerating ? theme.colors.dark.textFaint : '#fff'} strokeWidth={2} />
                    <Text style={[styles.regenBtnText, isRegenerating && styles.regenBtnTextDisabled]}>
                      {isRegenerating ? '재생성 중...' : '재생성'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Title */}
                <View style={styles.editBox}>
                  <Text style={styles.editLabel}>타이틀 (유튜브/릴스용)</Text>
                  <TextInput
                    style={styles.textInputSingle}
                    value={editState.titleText}
                    onChangeText={(text) => onEditChange({ titleText: text })}
                    placeholder="AI가 생성한 타이틀을 여기서 바로 수정하세요"
                    placeholderTextColor={theme.colors.dark.textFaint}
                    numberOfLines={1}
                  />
                </View>

                {/* Caption text */}
                <View style={styles.editBox}>
                  <Text style={styles.editLabel}>설명 문구 직접 수정</Text>
                  <TextInput
                    style={styles.textInput}
                    value={editState.captionText}
                    onChangeText={(text) => onEditChange({ captionText: text })}
                    placeholder="AI가 생성한 설명을 여기서 바로 수정하세요"
                    placeholderTextColor={theme.colors.dark.textFaint}
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                  />
                </View>

                {/* Hashtags */}
                {editState.hashtags.length > 0 && (
                  <View style={styles.editBox}>
                    <Text style={styles.editLabel}>해시태그 (탭하여 삭제)</Text>
                    <View style={styles.hashtagWrap}>
                      {editState.hashtags.map((tag) => (
                        <TouchableOpacity
                          key={tag}
                          style={styles.hashtagChip}
                          onPress={() => onRemoveHashtag(tag)}
                          activeOpacity={0.6}
                        >
                          <Text style={styles.hashtagChipText}>#{tag}</Text>
                          <Text style={styles.hashtagRemoveX}> x</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}
              </View>
            )}
          </View>

          {/* STEP 1 — collapsed summary chip */}
          <View style={styles.summaryRow}>
            <View style={styles.summaryChipLeft}>
              <CheckCircle2 size={13} color={theme.colors.success[400]} strokeWidth={2.5} />
              <Text style={styles.summaryChipText} numberOfLines={1}>
                1단계 완료 · 3D 볼륨 합성 · 신뢰도 {confidencePct}%
              </Text>
            </View>
            <TouchableOpacity style={styles.detailBtn} onPress={() => toggleDetail(0)} activeOpacity={0.7}>
              <Box size={13} color={theme.colors.primary[400]} strokeWidth={2} />
              <Text style={styles.detailBtnText}>상세</Text>
            </TouchableOpacity>
          </View>
          {openDetail === 0 && (
            <View style={styles.detailCard}>
              <View style={styles.detailChipRow}>
                <View style={styles.detailChip}>
                  <Text style={styles.detailChipText}>전략: {synthesisStrategy}</Text>
                </View>
                <View style={styles.detailChip}>
                  <Text style={styles.detailChipText}>맥락: {contextLabel}</Text>
                </View>
              </View>
              <View style={styles.confidenceBar}>
                <View style={styles.confidenceHeader}>
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
            </View>
          )}

          {/* STEP 2 — collapsed summary chip */}
          <View style={styles.summaryRow}>
            <View style={styles.summaryChipLeft}>
              <CheckCircle2 size={13} color={theme.colors.success[400]} strokeWidth={2.5} />
              <Text style={styles.summaryChipText} numberOfLines={1}>
                2단계 완료 · 훅 연출 · {hookLabel} · BPM {beatSyncBpm}
              </Text>
            </View>
            <TouchableOpacity style={styles.detailBtn} onPress={() => toggleDetail(1)} activeOpacity={0.7}>
              <Radio size={13} color={theme.colors.accent[400]} strokeWidth={2} />
              <Text style={styles.detailBtnText}>상세</Text>
            </TouchableOpacity>
          </View>
          {openDetail === 1 && (
            <View style={styles.detailCard}>
              <View style={styles.directingCard}>
                <Text style={styles.directingLabel}>오프닝 훅</Text>
                <Text style={styles.directingValue}>{hookLabel}</Text>
                <Text style={styles.directingDesc} numberOfLines={2}>{hookDescription}</Text>
              </View>
              <View style={styles.detailChipRow}>
                <View style={styles.detailChip}>
                  <Text style={styles.detailChipText}>BPM {beatSyncBpm}</Text>
                </View>
                <View style={styles.detailChip}>
                  <Text style={styles.detailChipText}>컷 전환 {cutPointCount}회</Text>
                </View>
                <View style={styles.detailChip}>
                  <Text style={styles.detailChipText}>SFX {sfxCount}종</Text>
                </View>
                <View style={styles.detailChip}>
                  <Text style={styles.detailChipText}>킬링 자막 {killPointCount}개</Text>
                </View>
              </View>
            </View>
          )}
        </View>
      )}
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
  // Step 3 card
  step3Card: {
    backgroundColor: theme.colors.warning[400] + '08',
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.warning[400] + '30',
    overflow: 'hidden',
  },
  step3Header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 12,
  },
  step3HeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  step3Number: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: theme.colors.warning[400] + '25',
    justifyContent: 'center',
    alignItems: 'center',
  },
  step3NumberText: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.warning[400],
  },
  step3Label: {
    fontSize: 15,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
  },
  step3Body: {
    paddingHorizontal: 12,
    paddingBottom: 14,
    gap: 10,
  },
  // Render info box
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
  // Edit boxes
  editBox: {
    backgroundColor: theme.colors.dark.bg + '50',
    borderRadius: theme.radius.sm,
    padding: 10,
    gap: 8,
  },
  editHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  editLabel: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.textDim,
    flex: 1,
  },
  // Chips
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    backgroundColor: theme.colors.dark.border + '60',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipActive: {
    backgroundColor: theme.colors.primary[400],
  },
  chipText: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.textDim,
  },
  chipTextActive: {
    color: '#fff',
  },
  // Text inputs
  textInput: {
    backgroundColor: theme.colors.dark.surface,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.dark.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.text,
    minHeight: 72,
  },
  textInputSingle: {
    backgroundColor: theme.colors.dark.surface,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.dark.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.text,
  },
  // Regenerate button
  regenBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.colors.primary[400],
    borderRadius: theme.radius.md,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  regenBtnDisabled: {
    backgroundColor: theme.colors.dark.border,
  },
  regenBtnText: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: '#fff',
  },
  regenBtnTextDisabled: {
    color: theme.colors.dark.textFaint,
  },
  // Hashtags
  hashtagWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  hashtagChip: {
    flexDirection: 'row',
    alignItems: 'center',
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
  hashtagRemoveX: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textFaint,
  },
  // Summary rows (collapsed Step 1 & 2)
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.dark.surfaceLight,
    borderRadius: theme.radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  summaryChipLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  summaryChipText: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.text,
    flex: 1,
  },
  detailBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailBtnText: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.primary[300],
  },
  // Detail cards (when expanded)
  detailCard: {
    backgroundColor: theme.colors.dark.surfaceLight,
    borderRadius: theme.radius.md,
    padding: 12,
    gap: 10,
  },
  detailChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  detailChip: {
    backgroundColor: theme.colors.dark.border + '60',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  detailChipText: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
  },
  confidenceBar: {
    gap: 4,
  },
  confidenceHeader: {
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
  directingCard: {
    backgroundColor: theme.colors.dark.border + '40',
    borderRadius: theme.radius.sm,
    padding: 10,
  },
  directingLabel: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textFaint,
  },
  directingValue: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.accent[400],
    marginTop: 2,
  },
  directingDesc: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    marginTop: 3,
  },
});
