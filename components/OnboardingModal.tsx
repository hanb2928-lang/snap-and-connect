import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Modal,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withDelay,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import {
  Camera,
  Sparkles,
  Share2,
  TrendingUp,
  Check,
} from 'lucide-react-native';
import { theme } from '@/lib/theme';

const { width: screenWidth } = Dimensions.get('window');

interface OnboardingStep {
  icon: React.ReactNode;
  title: string;
  desc: string;
  accentColor: string;
}

const STEPS: OnboardingStep[] = [
  {
    icon: <Camera size={40} color={theme.colors.primary[400]} strokeWidth={1.8} />,
    title: '사진 한 장으로 시작',
    desc: '제품 사진을 찍거나 업로드하면 AI가 자동으로 상품을 분석합니다. 단품과 다각도 모드를 지원해요.',
    accentColor: theme.colors.primary[400],
  },
  {
    icon: <Sparkles size={40} color={theme.colors.accent[400]} strokeWidth={1.8} />,
    title: 'AI 자동 콘텐츠 생성',
    desc: '분석 결과에서 숏폼 카드, 카피라이팅, 해시태그, 제휴 링크까지 한 번에 만들어집니다. 플랫폼별 맞춤 스타일도 지원해요.',
    accentColor: theme.colors.accent[400],
  },
  {
    icon: <Share2 size={40} color={theme.colors.success[400]} strokeWidth={1.8} />,
    title: '원클릭 멀티 공유',
    desc: '인스타, 틱톡, 블로그 등 여러 플랫폼용으로 동시에 내보낼 수 있습니다. 숏링크로 클릭 추적까지 한 번에.',
    accentColor: theme.colors.success[400],
  },
  {
    icon: <TrendingUp size={40} color={theme.colors.warning[400]} strokeWidth={1.8} />,
    title: '트렌드 & 수익 분석',
    desc: '실시간 인기 상품과 키워드 트렌드를 확인하고, 클릭 및 수익 데이터를 한 곳에서 관리하세요.',
    accentColor: theme.colors.warning[400],
  },
];

interface OnboardingModalProps {
  visible: boolean;
  onComplete: () => void;
}

export function OnboardingModal({ visible, onComplete }: OnboardingModalProps) {
  const [step, setStep] = useState(0);
  const progress = useSharedValue(0);
  const contentOpacity = useSharedValue(0);
  const contentTranslate = useSharedValue(20);
  const mountAnim = useSharedValue(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (visible) {
      setStep(0);
      mountAnim.value = withTiming(1, { duration: 300, easing: Easing.out(Easing.cubic) });
      animateStep(0);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [visible]);

  const animateStep = (targetStep: number) => {
    contentOpacity.value = withSequence(
      withTiming(0, { duration: 150 }),
      withTiming(1, { duration: 300, easing: Easing.out(Easing.cubic) }),
    );
    contentTranslate.value = withSequence(
      withTiming(15, { duration: 150 }),
      withTiming(0, { duration: 300, easing: Easing.out(Easing.cubic) }),
    );
    progress.value = withTiming((targetStep + 1) / STEPS.length, { duration: 400 });
  };

  const handleNext = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (step < STEPS.length - 1) {
      const next = step + 1;
      setStep(next);
      animateStep(next);
    } else {
      handleComplete();
    }
  };

  const handleSkip = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    handleComplete();
  };

  const handleComplete = () => {
    mountAnim.value = withTiming(0, { duration: 200 }, () => {
      runOnJS(onComplete)();
    });
  };

  const mountStyle = useAnimatedStyle(() => ({
    opacity: mountAnim.value,
  }));

  const contentStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
    transform: [{ translateY: contentTranslate.value }],
  }));

  const progressStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  if (!visible) return null;

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={handleSkip}>
      <Animated.View style={[styles.overlay, mountStyle]}>
        <View style={styles.card}>
          <View style={styles.progressTrack}>
            <Animated.View style={[styles.progressBar, progressStyle]} />
          </View>

          <TouchableOpacity style={styles.skipButton} onPress={handleSkip} activeOpacity={0.7}>
            <Text style={styles.skipText}>건너뛰기</Text>
          </TouchableOpacity>

          <Animated.View style={contentStyle} key={step}>
            <View style={[styles.iconWrap, { backgroundColor: current.accentColor + '18' }]}>
              {current.icon}
            </View>
            <Text style={styles.title}>{current.title}</Text>
            <Text style={styles.desc}>{current.desc}</Text>
          </Animated.View>

          <View style={styles.dotsRow}>
            {STEPS.map((_, i) => (
              <View
                key={i}
                style={[styles.dot, i === step && styles.dotActive, i < step && styles.dotDone]}
              >
                {i < step && <Check size={8} color="#fff" strokeWidth={3} />}
              </View>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: current.accentColor }]}
            onPress={handleNext}
            activeOpacity={0.8}
          >
            <Text style={styles.actionText}>
              {isLast ? '시작하기' : '다음'}
            </Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </Modal>
  );
}

const cardWidth = Math.min(screenWidth - 48, 380);

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    width: cardWidth,
    backgroundColor: theme.colors.dark.surface,
    borderRadius: theme.radius.xl,
    padding: theme.spacing.xl,
    borderWidth: 1,
    borderColor: theme.colors.dark.border,
    ...theme.shadows.elevated,
  },
  progressTrack: {
    height: 4,
    backgroundColor: theme.colors.dark.surfaceLight,
    borderRadius: 2,
    marginBottom: theme.spacing.lg,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: theme.colors.primary[400],
    borderRadius: 2,
  },
  skipButton: {
    position: 'absolute',
    top: theme.spacing.md,
    right: theme.spacing.lg,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  skipText: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.textDim,
  },
  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: theme.radius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
    alignSelf: 'center',
  },
  title: {
    fontSize: theme.typography.heading,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.dark.text,
    textAlign: 'center',
    marginBottom: theme.spacing.sm,
  },
  desc: {
    fontSize: theme.typography.body,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: theme.spacing.xl,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: theme.spacing.xl,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.colors.dark.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dotActive: {
    backgroundColor: theme.colors.primary[400],
    transform: [{ scale: 1.2 }],
  },
  dotDone: {
    backgroundColor: theme.colors.success[500],
  },
  actionButton: {
    paddingVertical: 14,
    borderRadius: theme.radius.md,
    alignItems: 'center',
  },
  actionText: {
    fontSize: theme.typography.body,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: '#fff',
  },
});
