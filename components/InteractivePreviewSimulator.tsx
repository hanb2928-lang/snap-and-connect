import { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  Animated,
  Easing,
  StyleSheet,
  Platform,
} from 'react-native';
import { Play, Pause, Eye, ChevronDown, ChevronUp, Film as FilmIcon } from 'lucide-react-native';
import { theme } from '@/lib/theme';

interface InteractivePreviewSimulatorProps {
  promptText: string;
  cutImages: string[];
  captionText: string;
  moodLabel?: string;
  productName?: string;
  durationSec?: number;
}

const STEP_LABELS = ['시선 후킹', '닉즈 발견', '제품 체험', '변화 순간', 'CTA 전달'];

export function InteractivePreviewSimulator({
  promptText,
  cutImages,
  captionText,
  moodLabel,
  productName,
  durationSec = 15,
}: InteractivePreviewSimulatorProps) {
  const [expanded, setExpanded] = useState(true);
  const [simulating, setSimulating] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const stepTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stepCount = Math.max(cutImages.length, 1);
  const stepDurationMs = (durationSec * 1000) / stepCount;

  const liveCaption = useMemo(() => {
    if (captionText) return captionText;
    if (promptText) return promptText;
    if (productName) return `${productName} 리얼 후기`;
    return '프롬프트를 입력하면 실시간으로 자막이 반영됩니다';
  }, [captionText, promptText, productName]);

  useEffect(() => {
    if (simulating) {
      setActiveStep(0);
      progressAnim.setValue(0);
      Animated.loop(
        Animated.timing(progressAnim, {
          toValue: 1,
          duration: durationSec * 1000,
          easing: Easing.linear,
          useNativeDriver: false,
        }),
      ).start();

      stepTimerRef.current = setInterval(() => {
        setActiveStep((prev) => (prev + 1) % stepCount);
      }, stepDurationMs);
    } else {
      progressAnim.stopAnimation();
      if (stepTimerRef.current) {
        clearInterval(stepTimerRef.current);
        stepTimerRef.current = null;
      }
    }

    return () => {
      progressAnim.stopAnimation();
      if (stepTimerRef.current) clearInterval(stepTimerRef.current);
    };
  }, [simulating, stepCount, stepDurationMs, durationSec, progressAnim]);

  const currentImage = cutImages[activeStep] || cutImages[0] || null;
  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.header}
        onPress={() => setExpanded((v) => !v)}
        activeOpacity={0.7}
      >
        <View style={styles.headerLeft}>
          <Eye size={15} color={theme.colors.primary[300]} strokeWidth={2} />
          <Text style={styles.headerTitle}>실시간 프리뷰 시뮬레이터</Text>
        </View>
        {expanded ? (
          <ChevronUp size={16} color={theme.colors.dark.textDim} strokeWidth={2} />
        ) : (
          <ChevronDown size={16} color={theme.colors.dark.textDim} strokeWidth={2} />
        )}
      </TouchableOpacity>

      {expanded && (
        <View style={styles.body}>
          {/* Live prompt overlay */}
          <View style={styles.livePromptBar}>
            <View style={styles.liveDot} />
            <Text style={styles.livePromptText} numberOfLines={1}>
              {promptText || '프롬프트 대기 중...'}
            </Text>
            {moodLabel && (
              <View style={styles.moodBadge}>
                <Text style={styles.moodBadgeText}>{moodLabel}</Text>
              </View>
            )}
          </View>

          {/* Preview area with current cut */}
          <View style={styles.previewArea}>
            {currentImage ? (
              <Image
                source={{ uri: currentImage }}
                style={styles.previewImage}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.previewPlaceholder}>
                <FilmIcon size={28} color={theme.colors.dark.textFaint} strokeWidth={2} />
                <Text style={styles.previewPlaceholderText}>원본 컷을 불러오는 중</Text>
              </View>
            )}

            {/* Live caption overlay */}
            <View style={styles.captionOverlay}>
              <Text style={styles.captionOverlayText} numberOfLines={2}>
                {liveCaption}
              </Text>
            </View>

            {/* Step indicator badge */}
            <View style={styles.stepBadge}>
              <Text style={styles.stepBadgeText}>
                {activeStep + 1}/{stepCount} · {STEP_LABELS[activeStep % STEP_LABELS.length]}
              </Text>
            </View>

            {/* Simulation progress bar */}
            {simulating && (
              <View style={styles.progressBar}>
                <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
              </View>
            )}
          </View>

          {/* 5-cut step timeline */}
          <View style={styles.stepBar}>
            {Array.from({ length: stepCount }).map((_, i) => (
              <TouchableOpacity
                key={i}
                style={[
                  styles.stepNode,
                  activeStep === i && styles.stepNodeActive,
                  i < stepCount - 1 && styles.stepNodeWithLine,
                ]}
                onPress={() => setActiveStep(i)}
                activeOpacity={0.7}
              >
                <View style={[
                  styles.stepDot,
                  activeStep === i && styles.stepDotActive,
                  simulating && i < activeStep && styles.stepDotDone,
                ]} />
                <Text style={[
                  styles.stepLabel,
                  activeStep === i && styles.stepLabelActive,
                ]} numberOfLines={1}>
                  {STEP_LABELS[i % STEP_LABELS.length]}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Simulation toggle */}
          <TouchableOpacity
            style={[styles.simBtn, simulating && styles.simBtnActive]}
            onPress={() => setSimulating((v) => !v)}
            activeOpacity={0.7}
          >
            {simulating ? (
              <Pause size={15} color="#fff" strokeWidth={2} />
            ) : (
              <Play size={15} color="#fff" strokeWidth={2} />
            )}
            <Text style={styles.simBtnText}>
              {simulating ? '시뮬레이션 일시정지' : '적용 결과 시뮬레이션'}
            </Text>
          </TouchableOpacity>

          <Text style={styles.hintText}>
            프롬프트와 무드 칩이 실시간으로 위 프리뷰에 반영됩니다
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: theme.spacing.md,
    marginVertical: theme.spacing.sm,
    backgroundColor: theme.colors.dark.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1.5,
    borderColor: theme.colors.primary[400] + '25',
    overflow: 'hidden',
    ...theme.shadows.card,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: theme.colors.dark.surfaceLight,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
  },
  body: {
    padding: 12,
    gap: 10,
  },
  livePromptBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.colors.dark.surfaceLight,
    borderRadius: theme.radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: theme.colors.error[400],
  },
  livePromptText: {
    flex: 1,
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
  },
  moodBadge: {
    backgroundColor: theme.colors.accent[500] + '20',
    borderRadius: theme.radius.full,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  moodBadgeText: {
    fontSize: 9,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.accent[300],
  },
  previewArea: {
    position: 'relative',
    width: '100%',
    aspectRatio: 9 / 16,
    maxHeight: 220,
    borderRadius: theme.radius.md,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  previewImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  previewPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  previewPlaceholderText: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textFaint,
  },
  captionOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  captionOverlayText: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: '#fff',
    lineHeight: 15,
  },
  stepBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: theme.radius.full,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  stepBadgeText: {
    fontSize: 8,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.primary[300],
  },
  progressBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  progressFill: {
    height: '100%',
    backgroundColor: theme.colors.primary[400],
  },
  stepBar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  stepNode: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  stepNodeActive: {},
  stepNodeWithLine: {},
  stepDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: theme.colors.dark.border,
    borderWidth: 1.5,
    borderColor: theme.colors.dark.border,
  },
  stepDotActive: {
    backgroundColor: theme.colors.primary[400],
    borderColor: theme.colors.primary[300],
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  stepDotDone: {
    backgroundColor: theme.colors.primary[500] + '40',
  },
  stepLabel: {
    fontSize: 8,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textFaint,
    textAlign: 'center',
  },
  stepLabelActive: {
    color: theme.colors.primary[300],
    fontFamily: theme.typography.fontFamily.semiBold,
  },
  simBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.colors.primary[500],
    borderRadius: theme.radius.md,
    paddingVertical: 11,
  },
  simBtnActive: {
    backgroundColor: theme.colors.dark.border,
  },
  simBtnText: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: '#fff',
  },
  hintText: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textFaint,
    textAlign: 'center',
  },
});
