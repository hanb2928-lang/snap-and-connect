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
  Sliders,
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

const STEP_META = [
  { key: 'synthesis', label: 'AI 입체 볼륨 합성', icon: Box, color: theme.colors.primary[400] },
  { key: 'directing', label: '심리 리듬 연출', icon: Radio, color: theme.colors.accent[400] },
  { key: 'rendering', label: '플랫폼 렌더링 & 메타데이터', icon: Upload, color: theme.colors.warning[400] },
] as const;

const HOOK_EFFECTS: { key: HookEffectType; label: string }[] = [
  { key: 'rotation_zoom', label: '사물 회전' },
  { key: 'dramatic_zoom_in', label: '극적 줌인' },
  { key: 'paradox_reveal', label: '호기심 유발' },
  { key: 'context_cut', label: '맥락 컷 전환' },
  { key: 'detail_punch', label: '디테일 클로즈업' },
];

const SFX_STYLES = ['감성', '하이텐션', 'ASMR', '시네마틱', '미니멀'];

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
  processingSteps,
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
  const [openStep, setOpenStep] = useState<number | null>(null);
  const [step3Open, setStep3Open] = useState(false);

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

  const toggleStep = (idx: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpenStep((prev) => (prev === idx ? null : idx));
  };

  const toggleStep3 = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setStep3Open((prev) => !prev);
  };

  const confidencePct = Math.round(volumeConfidence * 100);
  const isProcessing = analysisStatus === 'processing';
  const hookLabel = HOOK_LABELS[editState.hookEffect] ?? editState.hookEffect;

  const aspectLabel = renderWidth >= renderHeight
    ? '1:1'
    : renderHeight / renderWidth > 1.3
      ? '9:16'
      : '4:5';

  const beatSensitivityPct = Math.round(editState.beatSyncSensitivity * 100);

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
          {/* Step 3: Pinned to top, auto-expand on complete */}
          <View style={styles.step3Card}>
            <TouchableOpacity
              style={styles.step3Header}
              onPress={toggleStep3}
              activeOpacity={0.7}
            >
              <View style={styles.step3HeaderLeft}>
                <View style={[styles.step3Number, { backgroundColor: theme.colors.warning[400] + '25' }]}>
                  <Text style={[styles.step3NumberText, { color: theme.colors.warning[400] }]}>3</Text>
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
                <View style={styles.stepContent}>
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

                  <View style={styles.inlineEditBox}>
                    <View style={styles.inlineEditHeader}>
                      <Video size={12} color={theme.colors.accent[300]} strokeWidth={2} />
                      <Text style={styles.inlineEditLabel}>영상 템플릿 스타일</Text>
                    </View>
                    <View style={styles.effectChipRow}>
                      {VIDEO_TEMPLATES.map((tmpl) => (
                        <TouchableOpacity
                          key={tmpl}
                          style={[styles.effectChip, editState.videoTemplate === tmpl && styles.effectChipActive]}
                          onPress={() => onEditChange({ videoTemplate: tmpl })}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.effectChipText, editState.videoTemplate === tmpl && styles.effectChipTextActive]}>
                            {tmpl}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  <View style={styles.inlineEditBox}>
                    <View style={styles.inlineEditHeader}>
                      <Type size={12} color={theme.colors.accent[300]} strokeWidth={2} />
                      <Text style={styles.inlineEditLabel}>자막 스타일</Text>
                    </View>
                    <View style={styles.effectChipRow}>
                      {CAPTION_FONTS.map((font) => (
                        <TouchableOpacity
                          key={font}
                          style={[styles.effectChip, editState.captionFont === font && styles.effectChipActive]}
                          onPress={() => onEditChange({ captionFont: font })}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.effectChipText, editState.captionFont === font && styles.effectChipTextActive]}>
                            {font}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <View style={styles.effectChipRow}>
                      {CAPTION_POSITIONS.map((pos) => (
                        <TouchableOpacity
                          key={pos}
                          style={[styles.effectChip, editState.captionPosition === pos && styles.effectChipActive]}
                          onPress={() => onEditChange({ captionPosition: pos })}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.effectChipText, editState.captionPosition === pos && styles.effectChipTextActive]}>
                            {pos}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  <View style={styles.inlineEditBox}>
                    <View style={styles.inlineEditHeader}>
                      <Music size={12} color={theme.colors.accent[300]} strokeWidth={2} />
                      <Text style={styles.inlineEditLabel}>BGM 분위기</Text>
                    </View>
                    <View style={styles.effectChipRow}>
                      {BGM_MOODS.map((mood) => (
                        <TouchableOpacity
                          key={mood}
                          style={[styles.effectChip, editState.bgmMood === mood && styles.effectChipActive]}
                          onPress={() => onEditChange({ bgmMood: mood })}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.effectChipText, editState.bgmMood === mood && styles.effectChipTextActive]}>
                            {mood}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  <View style={styles.inlineEditBox}>
                    <View style={styles.inlineEditHeader}>
                      <Wand2 size={12} color={theme.colors.primary[300]} strokeWidth={2} />
                      <Text style={styles.inlineEditLabel}>AI 가상 영상 프롬프트</Text>
                    </View>
                    <TextInput
                      style={styles.textInput}
                      value={editState.aiPrompt}
                      onChangeText={(text) => onEditChange({ aiPrompt: text })}
                      placeholder="원하는 연출 분위기나 강조 사항을 입력하세요 (예: 따뜻한 색감, 천천히 줌인)"
                      placeholderTextColor={theme.colors.dark.textFaint}
                      multiline
                      numberOfLines={3}
                      textAlignVertical="top"
                    />
                    <TouchableOpacity
                      style={[styles.regenerateBtn, isRegenerating && styles.regenerateBtnDisabled]}
                      onPress={onRegenerate}
                      disabled={isRegenerating}
                      activeOpacity={0.7}
                    >
                      <RefreshCw size={13} color={isRegenerating ? theme.colors.dark.textFaint : '#fff'} strokeWidth={2} />
                      <Text style={[styles.regenerateBtnText, isRegenerating && styles.regenerateBtnTextDisabled]}>
                        {isRegenerating ? '재생성 중...' : '재생성'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.inlineEditBox}>
                    <Text style={styles.inlineEditLabel}>타이틀 (유튜브/릴스용)</Text>
                    <TextInput
                      style={styles.textInputSingle}
                      value={editState.titleText}
                      onChangeText={(text) => onEditChange({ titleText: text })}
                      placeholder="AI가 생성한 타이틀을 여기서 바로 수정하세요"
                      placeholderTextColor={theme.colors.dark.textFaint}
                      numberOfLines={1}
                    />
                  </View>

                  <View style={styles.inlineEditBox}>
                    <Text style={styles.inlineEditLabel}>설명 문구 직접 수정</Text>
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

                  {editState.hashtags.length > 0 && (
                    <View style={styles.inlineEditBox}>
                      <Text style={styles.inlineEditLabel}>해시태그 (탭하여 삭제)</Text>
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
              </View>
            )}
          </View>

          {/* Completed steps: compact summary chips below */}
          <View style={styles.summaryRow}>
            <View style={styles.summaryChip}>
              <CheckCircle2 size={13} color={theme.colors.success[400]} strokeWidth={2.5} />
              <Text style={styles.summaryChipText}>3D 볼륨 합성 완료 · 신뢰도 {confidencePct}%</Text>
            </View>
            <TouchableOpacity
              style={styles.summaryChip}
              onPress={() => toggleStep(0)}
              activeOpacity={0.7}
            >
              <Box size={13} color={theme.colors.primary[400]} strokeWidth={2} />
              <Text style={styles.summaryChipLink}>상세</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.summaryRow}>
            <View style={styles.summaryChip}>
              <CheckCircle2 size={13} color={theme.colors.success[400]} strokeWidth={2.5} />
              <Text style={styles.summaryChipText} numberOfLines={1}>훅 연출 완료 · {hookLabel} · BPM {beatSyncBpm}</Text>
            </View>
            <TouchableOpacity
              style={styles.summaryChip}
              onPress={() => toggleStep(1)}
              activeOpacity={0.7}
            >
              <Radio size={13} color={theme.colors.accent[400]} strokeWidth={2} />
              <Text style={styles.summaryChipLink}>상세</Text>
            </TouchableOpacity>
          </View>

          {/* Expandable Step 1 (hidden by default, toggleable from summary) */}
          {openStep === 0 && (
            <StepCard
              index={0}
              label={STEP_META[0].label}
              icon={STEP_META[0].icon}
              color={STEP_META[0].color}
              isOpen={true}
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
                <View style={styles.inlineEditBox}>
                  <View style={styles.inlineEditHeader}>
                    <Sliders size={12} color={theme.colors.primary[300]} strokeWidth={2} />
                    <Text style={styles.inlineEditLabel}>입체감 강도</Text>
                    <Text style={styles.inlineEditValue}>{Math.round(editState.volumeIntensity * 100)}%</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.sliderTrack}
                    onPress={(e) => {
                      const { locationX } = e.nativeEvent;
                      const w = (e.currentTarget as any).clientWidth || (e.nativeEvent as any).layout?.width || 200;
                      const ratio = Math.max(0, Math.min(1, locationX / w));
                      onEditChange({ volumeIntensity: Math.round(ratio * 100) / 100 });
                    }}
                    activeOpacity={1}
                  >
                    <View style={[styles.sliderFill, { width: `${Math.round(editState.volumeIntensity * 100)}%` }]} />
                    <View style={[styles.sliderThumb, { left: `${Math.round(editState.volumeIntensity * 100)}%` }]} />
                  </TouchableOpacity>
                </View>
              </View>
            </StepCard>
          )}

          {/* Expandable Step 2 (hidden by default, toggleable from summary) */}
          {openStep === 1 && (
            <StepCard
              index={1}
              label={STEP_META[1].label}
              icon={STEP_META[1].icon}
              color={STEP_META[1].color}
              isOpen={true}
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
                <View style={styles.inlineEditBox}>
                  <Text style={styles.inlineEditLabel}>훅 효과 변경</Text>
                  <View style={styles.effectChipRow}>
                    {HOOK_EFFECTS.map((eff) => (
                      <TouchableOpacity
                        key={eff.key}
                        style={[
                          styles.effectChip,
                          editState.hookEffect === eff.key && styles.effectChipActive,
                        ]}
                        onPress={() => onEditChange({ hookEffect: eff.key })}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.effectChipText,
                            editState.hookEffect === eff.key && styles.effectChipTextActive,
                          ]}
                        >
                          {eff.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
                <View style={styles.inlineEditBox}>
                  <View style={styles.inlineEditHeader}>
                    <Text style={styles.inlineEditLabel}>비트 싱크 감도</Text>
                    <Text style={styles.inlineEditValue}>{beatSensitivityPct}%</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.sliderTrack}
                    onPress={(e) => {
                      const { locationX } = e.nativeEvent;
                      const w = (e.currentTarget as any).clientWidth || (e.nativeEvent as any).layout?.width || 200;
                      const ratio = Math.max(0, Math.min(1, locationX / w));
                      onEditChange({ beatSyncSensitivity: Math.round(ratio * 100) / 100 });
                    }}
                    activeOpacity={1}
                  >
                    <View style={[styles.sliderFill, { width: `${beatSensitivityPct}%`, backgroundColor: theme.colors.accent[400] }]} />
                    <View style={[styles.sliderThumb, { left: `${beatSensitivityPct}%` }]} />
                  </TouchableOpacity>
                </View>
                <View style={styles.inlineEditBox}>
                  <Text style={styles.inlineEditLabel}>SFX 효과음 스타일</Text>
                  <View style={styles.effectChipRow}>
                    {SFX_STYLES.map((style) => (
                      <TouchableOpacity
                        key={style}
                        style={[
                          styles.effectChip,
                          editState.sfxStyle === style && styles.effectChipActive,
                        ]}
                        onPress={() => onEditChange({ sfxStyle: style })}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.effectChipText,
                            editState.sfxStyle === style && styles.effectChipTextActive,
                          ]}
                        >
                          {style}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>
            </StepCard>
          )}
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
  // Inline edit
  inlineEditBox: {
    backgroundColor: theme.colors.dark.bg + '50',
    borderRadius: theme.radius.sm,
    padding: 10,
    marginTop: 2,
    gap: 8,
  },
  inlineEditHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  inlineEditLabel: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.textDim,
    flex: 1,
  },
  inlineEditValue: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.primary[300],
  },
  // Slider
  sliderTrack: {
    height: 24,
    borderRadius: 12,
    backgroundColor: theme.colors.dark.border,
    position: 'relative',
    justifyContent: 'center',
  },
  sliderFill: {
    position: 'absolute',
    height: '100%',
    borderRadius: 12,
    backgroundColor: theme.colors.primary[400],
    opacity: 0.5,
  },
  sliderThumb: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#fff',
    marginLeft: -8,
    marginTop: -8,
    top: '50%',
    ...({
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 4,
      elevation: 2,
    } as object),
  },
  // Effect chips
  effectChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  effectChip: {
    backgroundColor: theme.colors.dark.border + '60',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  effectChipActive: {
    backgroundColor: theme.colors.primary[400],
  },
  effectChipText: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.textDim,
  },
  effectChipTextActive: {
    color: '#fff',
  },
  // Text input
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
  // Hashtag chips
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
  // Regenerate button
  regenerateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.colors.primary[400],
    borderRadius: theme.radius.md,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  regenerateBtnDisabled: {
    backgroundColor: theme.colors.dark.border,
  },
  regenerateBtnText: {
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: '#fff',
  },
  regenerateBtnTextDisabled: {
    color: theme.colors.dark.textFaint,
  },
  // Single-line text input
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
  // Summary chips for collapsed Step 1 & 2
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.dark.surfaceLight,
    borderRadius: theme.radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  summaryChip: {
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
  summaryChipLink: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.primary[300],
  },
  // Step 3 prominent card
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  step3NumberText: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.bold,
  },
  step3Label: {
    fontSize: 15,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
  },
  step3Body: {
    paddingHorizontal: 12,
    paddingBottom: 14,
  },
});
