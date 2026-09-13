import { memo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ViewStyle } from 'react-native';
import { Zap, Wrench, Sliders, ChevronDown, ChevronUp, Loader2 } from 'lucide-react-native';
import { theme } from '@/lib/theme';

export type GenMode = 'auto' | 'manual';

interface Props {
  mode: GenMode;
  onModeChange: (mode: GenMode) => void;
  isGenerating: boolean;
  onGenerate: () => void;
  manualPrompt: string;
  onManualPromptChange: (text: string) => void;
  cameraSpeed: number;
  onCameraSpeedChange: (speed: number) => void;
  ttsSyncOffset: number;
  onTtsSyncOffsetChange: (offset: number) => void;
  captionText: string;
  onCaptionTextChange: (text: string) => void;
}

function GenerationModePanelInner({
  mode,
  onModeChange,
  isGenerating,
  onGenerate,
  manualPrompt,
  onManualPromptChange,
  cameraSpeed,
  onCameraSpeedChange,
  ttsSyncOffset,
  onTtsSyncOffsetChange,
  captionText,
  onCaptionTextChange,
}: Props) {
  const [manualExpanded, setManualExpanded] = useState(false);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.stepBadge}>
          <Text style={styles.stepBadgeText}>4</Text>
        </View>
        <Text style={styles.title}>제작 모드 &amp; 실행</Text>
      </View>

      <View style={styles.modeTabs}>
        <TouchableOpacity
          style={[styles.modeTab, mode === 'auto' && styles.modeTabActive]}
          onPress={() => onModeChange('auto')}
          activeOpacity={0.7}
        >
          <Zap size={16} color={mode === 'auto' ? '#fff' : theme.colors.dark.textDim} strokeWidth={2} />
          <Text style={[styles.modeTabText, mode === 'auto' && styles.modeTabTextActive]}>AI 자동생성</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeTab, mode === 'manual' && styles.modeTabActive]}
          onPress={() => onModeChange('manual')}
          activeOpacity={0.7}
        >
          <Wrench size={16} color={mode === 'manual' ? '#fff' : theme.colors.dark.textDim} strokeWidth={2} />
          <Text style={[styles.modeTabText, mode === 'manual' && styles.modeTabTextActive]}>수동 모드</Text>
        </TouchableOpacity>
      </View>

      {mode === 'manual' && (
        <View style={styles.manualPanel}>
          <TouchableOpacity
            style={styles.manualToggle}
            onPress={() => setManualExpanded((v) => !v)}
            activeOpacity={0.7}
          >
            <Text style={styles.manualToggleText}>상세 편집 패널</Text>
            {manualExpanded ? (
              <ChevronUp size={16} color={theme.colors.dark.textDim} strokeWidth={2} />
            ) : (
              <ChevronDown size={16} color={theme.colors.dark.textDim} strokeWidth={2} />
            )}
          </TouchableOpacity>

          {manualExpanded && (
            <View style={styles.manualContent}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>프롬프트</Text>
                <TextInput
                  style={styles.promptInput}
                  value={manualPrompt}
                  onChangeText={onManualPromptChange}
                  placeholder="AI에게 전달할 제작 지시사항을 입력하세요"
                  placeholderTextColor={theme.colors.dark.textFaint}
                  multiline
                  numberOfLines={3}
                />
              </View>

              <View style={styles.inputGroup}>
                <View style={styles.sliderHeader}>
                  <Text style={styles.inputLabel}>카메라 무빙 속도</Text>
                  <Text style={styles.sliderValue}>{cameraSpeed.toFixed(1)}x</Text>
                </View>
                <View style={styles.sliderTrack}>
                  <View style={[styles.sliderFill, { width: `${((cameraSpeed - 0.5) / 2) * 100}%` }]} />
                  {[0.5, 1.0, 1.5, 2.0, 2.5].map((val) => (
                    <TouchableOpacity
                      key={val}
                      style={[styles.sliderTick, cameraSpeed === val && styles.sliderTickActive]}
                      onPress={() => onCameraSpeedChange(val)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.sliderTickLabel}>{val.toFixed(1)}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.inputGroup}>
                <View style={styles.sliderHeader}>
                  <Text style={styles.inputLabel}>TTS 싱크 오프셋</Text>
                  <Text style={styles.sliderValue}>{ttsSyncOffset > 0 ? `+${ttsSyncOffset}` : ttsSyncOffset}ms</Text>
                </View>
                <View style={styles.sliderTrack}>
                  <View style={[styles.sliderFill, { width: `${((ttsSyncOffset + 500) / 1000) * 100}%` }]} />
                  {[-500, -250, 0, 250, 500].map((val) => (
                    <TouchableOpacity
                      key={val}
                      style={[styles.sliderTick, ttsSyncOffset === val && styles.sliderTickActive]}
                      onPress={() => onTtsSyncOffsetChange(val)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.sliderTickLabel}>{val > 0 ? `+${val}` : val}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>자막 텍스트</Text>
                <TextInput
                  style={styles.captionInput}
                  value={captionText}
                  onChangeText={onCaptionTextChange}
                  placeholder="화면에 표시할 자막"
                  placeholderTextColor={theme.colors.dark.textFaint}
                  multiline
                  numberOfLines={2}
                />
              </View>
            </View>
          )}
        </View>
      )}

      <TouchableOpacity
        style={[styles.generateBtn, isGenerating && styles.generateBtnDisabled]}
        onPress={onGenerate}
        disabled={isGenerating}
        activeOpacity={0.8}
      >
        {isGenerating ? (
          <Loader2 size={20} color="#fff" strokeWidth={2.5} />
        ) : (
          <Zap size={20} color="#fff" strokeWidth={2.5} />
        )}
        <Text style={styles.generateBtnText}>
          {isGenerating ? '생성 중...' : mode === 'auto' ? '원클릭 AI 자동생성' : '수동 설정으로 생성'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

export const GenerationModePanel = memo(GenerationModePanelInner);

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.dark.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  } as ViewStyle,
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  stepBadge: {
    width: 24,
    height: 24,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.primary[500],
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepBadgeText: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.bold,
    color: '#fff',
  },
  title: {
    fontSize: 15,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
  },
  modeTabs: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
    backgroundColor: theme.colors.dark.bg,
    borderRadius: theme.radius.md,
    padding: 4,
  },
  modeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: theme.radius.sm,
  },
  modeTabActive: {
    backgroundColor: theme.colors.primary[600],
  },
  modeTabText: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.textDim,
  },
  modeTabTextActive: {
    color: '#fff',
    fontFamily: theme.typography.fontFamily.semiBold,
  },
  manualPanel: {
    gap: theme.spacing.xs,
  },
  manualToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.dark.surfaceLight,
    borderRadius: theme.radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  manualToggleText: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.textDim,
  },
  manualContent: {
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.dark.bg,
    borderRadius: theme.radius.md,
    padding: theme.spacing.sm,
  },
  inputGroup: {
    gap: 4,
  },
  inputLabel: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.textDim,
  },
  promptInput: {
    backgroundColor: theme.colors.dark.surfaceLight,
    borderRadius: theme.radius.md,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.text,
    minHeight: 60,
  },
  captionInput: {
    backgroundColor: theme.colors.dark.surfaceLight,
    borderRadius: theme.radius.md,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.text,
    minHeight: 40,
  },
  sliderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sliderValue: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.primary[300],
  },
  sliderTrack: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: 32,
    backgroundColor: theme.colors.dark.surfaceLight,
    borderRadius: theme.radius.sm,
    paddingHorizontal: 4,
    position: 'relative',
  },
  sliderFill: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    left: 4,
    backgroundColor: theme.colors.primary[500] + '22',
    borderRadius: theme.radius.sm,
  },
  sliderTick: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: theme.radius.sm,
    zIndex: 1,
  },
  sliderTickActive: {
    backgroundColor: theme.colors.primary[500],
  },
  sliderTickLabel: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.textDim,
  },
  generateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: theme.spacing.md + 2,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.primary[600],
  },
  generateBtnDisabled: {
    opacity: 0.6,
  },
  generateBtnText: {
    fontSize: 15,
    fontFamily: theme.typography.fontFamily.bold,
    color: '#fff',
  },
});
