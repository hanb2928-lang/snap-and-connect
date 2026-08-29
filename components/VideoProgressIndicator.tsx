import { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, type DimensionValue } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
  withTiming,
  withSequence,
  withRepeat,
  withDelay,
  Easing,
  useDerivedValue,
  cancelAnimation,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, Path, Ellipse, Defs, RadialGradient, Stop, LinearGradient } from 'react-native-svg';
import { theme } from '@/lib/theme';
import { getUserSettings } from '@/lib/settings';

type ProgressStyle = 'circular' | 'baby-run' | 'status-bar';

interface VideoProgressIndicatorProps {
  progress: number;
  label: string;
  color?: string;
  hint?: string;
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse);

const TIPS = [
  '팁: 9:16 세로형이 숏폼에서 조회수가 2배 높아요',
  '팁: 첫 3초에 후킹 장면을 넣으면 이탈이 줄어요',
  '팁: 자막이 있으면 소음 끄고 시청하는 유저도 끝까지 봐요',
  '팁: 트렌딩 음악을 입히면 노출이 늘어나요',
  '팁: 상품 클로즈업 샷은 구매 전환율을 높여요',
  '팁: 마지막에 CTA 링크를 꼭 남겨주세요',
  '곧 완성됩니다. 조금만 더 기다려주세요!',
  'AI가 화면을 분석하고 최적의 컷을 배치하는 중이에요',
];

export function VideoProgressIndicator({
  progress,
  label,
  color = theme.colors.primary[400],
  hint,
}: VideoProgressIndicatorProps) {
  const [style, setStyle] = useState<ProgressStyle>('circular');

  useEffect(() => {
    let mounted = true;
    getUserSettings()
      .then((s) => { if (mounted && s?.progress_style) setStyle(s.progress_style as ProgressStyle); })
      .catch(() => {});
    return () => { mounted = false; };
  }, []);

  if (style === 'baby-run') {
    return <BabyRunProgress progress={progress} label={label} color={color} hint={hint} />;
  }
  if (style === 'status-bar') {
    return <StatusBarProgress progress={progress} label={label} color={color} hint={hint} />;
  }
  return <CircularProgress progress={progress} label={label} color={color} hint={hint} />;
}

function useRotatingTip(progress: number) {
  const [tipIndex, setTipIndex] = useState(0);
  const lastChangeRef = useRef(0);

  useEffect(() => {
    if (progress >= 100) return;
    lastChangeRef.current = Date.now();
    const interval = setInterval(() => {
      setTipIndex((prev) => (prev + 1) % TIPS.length);
      lastChangeRef.current = Date.now();
    }, 3000);
    return () => clearInterval(interval);
  }, [progress]);

  return TIPS[tipIndex];
}

function useElapsedSeconds(active: boolean) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!active) return;
    const interval = setInterval(() => {
      setElapsed((e) => e + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [active]);

  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  return mins > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : `0:${secs.toString().padStart(2, '0')}`;
}

function CircularProgress({ progress, label, color, hint }: VideoProgressIndicatorProps) {
  const progressSV = useSharedValue(0);
  const progressWidth = useSharedValue(0);
  const shimmerX = useSharedValue(-100);
  const glowOpacity = useSharedValue(0.3);
  const tip = useRotatingTip(progress);
  const elapsed = useElapsedSeconds(progress < 100);

  useEffect(() => {
    progressSV.value = withTiming(progress / 100, { duration: 300, easing: Easing.out(Easing.quad) });
    progressWidth.value = withTiming(progress, { duration: 300, easing: Easing.out(Easing.quad) });
  }, [progress, progressSV, progressWidth]);

  useEffect(() => {
    if (progress >= 100) {
      cancelAnimation(shimmerX);
      cancelAnimation(glowOpacity);
      return;
    }
    shimmerX.value = withRepeat(
      withTiming(200, { duration: 1500, easing: Easing.inOut(Easing.sin) }),
      -1, false,
    );
    glowOpacity.value = withRepeat(
      withSequence(
        withTiming(0.7, { duration: 800, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.3, { duration: 800, easing: Easing.inOut(Easing.sin) }),
      ),
      -1, false,
    );
    return () => {
      cancelAnimation(shimmerX);
      cancelAnimation(glowOpacity);
    };
  }, [progress, shimmerX, glowOpacity]);

  const barStyle = useAnimatedStyle(() => ({ width: `${progressWidth.value}%` as unknown as DimensionValue }));
  const pctStyle = useAnimatedStyle(() => ({ opacity: progressSV.value > 0.02 ? 1 : 0.4 }));
  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shimmerX.value }],
  }));
  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  return (
    <View style={styles.wrap}>
      <View style={styles.circularBarBg}>
        <Animated.View style={[styles.circularBarFill, { backgroundColor: color }, barStyle]}>
          <Animated.View style={[styles.shimmer, shimmerStyle]} />
        </Animated.View>
        <Animated.View
          style={[styles.glowOverlay, { backgroundColor: color }, glowStyle, barStyle]}
          pointerEvents="none"
        />
      </View>
      <View style={styles.circularLabelRow}>
        <Animated.Text style={[styles.circularPct, { color }, pctStyle]}>{Math.round(progress)}%</Animated.Text>
        <Text style={styles.labelText}>{label}</Text>
        <Text style={styles.elapsedText}>{elapsed}</Text>
      </View>
      {hint && <Text style={styles.hintText}>{hint}</Text>}
      {progress < 100 && (
        <View style={styles.tipRow}>
          <Text style={styles.tipText}>{tip}</Text>
        </View>
      )}
    </View>
  );
}

const TRACK_W = 200;
const BABY_SIZE = 36;

function BabyRunProgress({ progress, label, color, hint }: VideoProgressIndicatorProps) {
  const progressSV = useSharedValue(0);
  const bodyBob = useSharedValue(0);
  const armLeft = useSharedValue(0);
  const armRight = useSharedValue(0);
  const legLeft = useSharedValue(0);
  const legRight = useSharedValue(0);
  const headBob = useSharedValue(0);
  const isComplete = progress >= 100;
  const tip = useRotatingTip(progress);
  const elapsed = useElapsedSeconds(progress < 100);

  useEffect(() => {
    progressSV.value = withTiming(progress / 100, { duration: 300, easing: Easing.out(Easing.quad) });
  }, [progress, progressSV]);

  useEffect(() => {
    if (isComplete) {
      cancelAnimation(bodyBob);
      cancelAnimation(armLeft);
      cancelAnimation(armRight);
      cancelAnimation(legLeft);
      cancelAnimation(legRight);
      cancelAnimation(headBob);
      return;
    }
    const hc = 600;
    bodyBob.value = withRepeat(withSequence(withTiming(-1.2, { duration: hc, easing: Easing.inOut(Easing.sin) }), withTiming(0, { duration: hc, easing: Easing.inOut(Easing.sin) })), -1, false);
    armLeft.value = withRepeat(withSequence(withTiming(1, { duration: hc, easing: Easing.inOut(Easing.sin) }), withTiming(-1, { duration: hc, easing: Easing.inOut(Easing.sin) })), -1, false);
    armRight.value = withRepeat(withSequence(withTiming(-1, { duration: hc, easing: Easing.inOut(Easing.sin) }), withTiming(1, { duration: hc, easing: Easing.inOut(Easing.sin) })), -1, false);
    legLeft.value = withRepeat(withSequence(withTiming(1, { duration: hc, easing: Easing.inOut(Easing.sin) }), withTiming(-1, { duration: hc, easing: Easing.inOut(Easing.sin) })), -1, false);
    legRight.value = withRepeat(withSequence(withTiming(-1, { duration: hc, easing: Easing.inOut(Easing.sin) }), withTiming(1, { duration: hc, easing: Easing.inOut(Easing.sin) })), -1, false);
    headBob.value = withRepeat(withSequence(withTiming(-0.6, { duration: hc, easing: Easing.inOut(Easing.sin) }), withTiming(0, { duration: hc, easing: Easing.inOut(Easing.sin) })), -1, false);
    return () => {
      cancelAnimation(bodyBob);
      cancelAnimation(armLeft);
      cancelAnimation(armRight);
      cancelAnimation(legLeft);
      cancelAnimation(legRight);
      cancelAnimation(headBob);
    };
  }, [isComplete, bodyBob, armLeft, armRight, legLeft, legRight, headBob]);

  const maxRange = TRACK_W - BABY_SIZE - 4;
  const babyX = useDerivedValue(() => Math.max(0, Math.min(progressSV.value, 1)) * maxRange);
  const babyStyle = useAnimatedStyle(() => ({ transform: [{ translateX: babyX.value }] }));
  const headProps = useAnimatedProps(() => ({ cy: 14 + headBob.value }));
  const bodyProps = useAnimatedProps(() => ({ cy: 30 + bodyBob.value }));
  const leftArmProps = useAnimatedProps(() => { const o = armLeft.value * 4; return { d: `M14 28 Q${10 + o} ${23 - o} ${12 + o} ${18 - o}` }; });
  const rightArmProps = useAnimatedProps(() => { const o = armRight.value * 4; return { d: `M34 28 Q${38 + o} ${23 - o} ${36 + o} ${18 - o}` }; });
  const leftLegProps = useAnimatedProps(() => { const o = legLeft.value * 4; return { d: `M20 35 Q${17 + o} ${40 + o} ${15 + o} ${44 + o}` }; });
  const rightLegProps = useAnimatedProps(() => { const o = legRight.value * 4; return { d: `M28 35 Q${31 + o} ${40 + o} ${33 + o} ${44 + o}` }; });

  return (
    <View style={styles.wrap}>
      <View style={styles.babyTrackWrap}>
        <View style={styles.babyTrackLine} />
        <View style={styles.babyStartDot} />
        <View style={[styles.babyEndDot, { borderColor: color }]} />
        <Animated.View style={[styles.babyWrap, babyStyle]}>
          <Svg width={BABY_SIZE} height={BABY_SIZE} viewBox="0 0 48 48" fill="none">
            <Defs>
              <RadialGradient id="vbrHead" cx="40%" cy="35%" r="65%">
                <Stop offset="0%" stopColor="#FFE4D0" />
                <Stop offset="60%" stopColor="#F4C4A8" />
                <Stop offset="100%" stopColor="#E0A884" />
              </RadialGradient>
              <RadialGradient id="vbrBody" cx="50%" cy="30%" r="70%">
                <Stop offset="0%" stopColor="#FFFFFF" />
                <Stop offset="50%" stopColor={color} />
                <Stop offset="100%" stopColor="rgba(0,0,0,0.15)" />
              </RadialGradient>
              <LinearGradient id="vbrHair" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0%" stopColor="#B07A4F" />
                <Stop offset="100%" stopColor="#8B5E3C" />
              </LinearGradient>
            </Defs>
            <AnimatedEllipse cx="24" rx="13" ry="6.5" fill="url(#vbrBody)" animatedProps={bodyProps} />
            <AnimatedPath stroke="#F4C4A8" strokeWidth={3.2} strokeLinecap="round" fill="none" animatedProps={leftArmProps} />
            <AnimatedPath stroke="#F4C4A8" strokeWidth={3.2} strokeLinecap="round" fill="none" animatedProps={rightArmProps} />
            <AnimatedPath stroke="#F4C4A8" strokeWidth={3} strokeLinecap="round" fill="none" animatedProps={leftLegProps} />
            <AnimatedPath stroke="#F4C4A8" strokeWidth={3} strokeLinecap="round" fill="none" animatedProps={rightLegProps} />
            <AnimatedCircle cx="24" r="7.5" fill="url(#vbrHead)" stroke="#E0A884" strokeWidth={0.6} animatedProps={headProps} />
            <Path d="M16 11 Q18 5 24 5.5 Q30 5 32 11 Q28 8 24 8.5 Q20 8 16 11 Z" fill="url(#vbrHair)" />
            <Circle cx="19" cy="16" r="2" fill="#FF9999" opacity={0.5} />
            <Circle cx="29" cy="16" r="2" fill="#FF9999" opacity={0.5} />
            <Circle cx="21" cy="13.5" r="1" fill="#2D2D2D" />
            <Circle cx="27" cy="13.5" r="1" fill="#2D2D2D" />
            <Path d="M21 15.5 Q24 18 27 15.5" stroke="#C47070" strokeWidth={1.2} strokeLinecap="round" fill="none" />
          </Svg>
        </Animated.View>
      </View>
      <View style={styles.labelRow}>
        <Text style={[styles.labelText, { textAlign: 'center' }]}>{label} {progress}%</Text>
        <Text style={styles.elapsedText}>{elapsed}</Text>
      </View>
      {hint && <Text style={styles.hintText}>{hint}</Text>}
      {progress < 100 && (
        <View style={styles.tipRow}>
          <Text style={styles.tipText}>{tip}</Text>
        </View>
      )}
    </View>
  );
}

const STAGES = [
  { bubble: '...', label: '준비 중' },
  { bubble: '음마?', label: '분석 중' },
  { bubble: '까꿍!', label: '제작 중' },
  { bubble: '완성!', label: '완료' },
];

function StatusBarProgress({ progress, label, color, hint }: VideoProgressIndicatorProps) {
  const progressSV = useSharedValue(0);
  const bodyBob = useSharedValue(0);
  const eyeScale = useSharedValue(1);
  const mouthOpen = useSharedValue(0);
  const progressWidth = useSharedValue(0);
  const shimmerX = useSharedValue(-100);
  const tip = useRotatingTip(progress);
  const elapsed = useElapsedSeconds(progress < 100);

  const stageIdx = Math.min(Math.floor(progress / 25), 3);
  const stage = STAGES[stageIdx];
  const isComplete = progress >= 100;

  useEffect(() => {
    progressSV.value = withTiming(progress / 100, { duration: 300, easing: Easing.out(Easing.quad) });
    progressWidth.value = withTiming(progress, { duration: 300, easing: Easing.out(Easing.quad) });
  }, [progress, progressSV, progressWidth]);

  useEffect(() => {
    bodyBob.value = withRepeat(withSequence(withTiming(-1, { duration: 1000, easing: Easing.inOut(Easing.sin) }), withTiming(0, { duration: 1000, easing: Easing.inOut(Easing.sin) })), -1, false);
    eyeScale.value = withRepeat(withSequence(withTiming(0.2, { duration: 80, easing: Easing.inOut(Easing.quad) }), withTiming(1, { duration: 120 }), withTiming(1, { duration: 2000 }), withTiming(0.2, { duration: 80 }), withTiming(1, { duration: 120 })), -1, false);
    if (isComplete) {
      mouthOpen.value = withRepeat(withSequence(withTiming(2.5, { duration: 200 }), withTiming(0, { duration: 300 })), -1, false);
    }
    return () => {
      cancelAnimation(bodyBob);
      cancelAnimation(eyeScale);
      cancelAnimation(mouthOpen);
    };
  }, [bodyBob, eyeScale, mouthOpen, isComplete]);

  useEffect(() => {
    if (isComplete) {
      cancelAnimation(shimmerX);
      return;
    }
    shimmerX.value = withRepeat(
      withTiming(200, { duration: 1500, easing: Easing.inOut(Easing.sin) }),
      -1, false,
    );
    return () => { cancelAnimation(shimmerX); };
  }, [isComplete, shimmerX]);

  const headProps = useAnimatedProps(() => ({ cy: 14 + bodyBob.value }));
  const bodyProps = useAnimatedProps(() => ({ cy: 30 + bodyBob.value }));
  const leftEyeProps = useAnimatedProps(() => ({ r: 0.9 * eyeScale.value }));
  const rightEyeProps = useAnimatedProps(() => ({ r: 0.9 * eyeScale.value }));
  const mouthProps = useAnimatedProps(() => ({
    d: mouthOpen.value > 0.5 ? `M21 ${16 - mouthOpen.value} Q24 ${19 + mouthOpen.value} 27 ${16 - mouthOpen.value}` : `M21 15.5 Q24 18 27 15.5`,
  }));
  const barStyle = useAnimatedStyle(() => ({ width: `${progressWidth.value}%` as unknown as DimensionValue }));
  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shimmerX.value }],
  }));

  return (
    <View style={styles.wrap}>
      <View style={styles.statusRow}>
        <View style={styles.babyFaceWrap}>
          <Svg width={44} height={44} viewBox="0 0 48 48" fill="none">
            <Defs>
              <RadialGradient id="vsbHead" cx="40%" cy="35%" r="65%">
                <Stop offset="0%" stopColor="#FFE4D0" />
                <Stop offset="60%" stopColor="#F4C4A8" />
                <Stop offset="100%" stopColor="#E0A884" />
              </RadialGradient>
              <RadialGradient id="vsbBody" cx="50%" cy="30%" r="70%">
                <Stop offset="0%" stopColor="#FFFFFF" />
                <Stop offset="50%" stopColor={color} />
                <Stop offset="100%" stopColor="rgba(0,0,0,0.15)" />
              </RadialGradient>
              <LinearGradient id="vsbHair" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0%" stopColor="#B07A4F" />
                <Stop offset="100%" stopColor="#8B5E3C" />
              </LinearGradient>
            </Defs>
            <AnimatedEllipse cx="24" rx="13" ry="6.5" fill="url(#vsbBody)" animatedProps={bodyProps} />
            <AnimatedCircle cx="24" r="7.5" fill="url(#vsbHead)" stroke="#E0A884" strokeWidth={0.6} animatedProps={headProps} />
            <Path d="M16 11 Q18 5 24 5.5 Q30 5 32 11 Q28 8 24 8.5 Q20 8 16 11 Z" fill="url(#vsbHair)" />
            <Circle cx="19" cy="16" r="2" fill="#FF9999" opacity={0.5} />
            <Circle cx="29" cy="16" r="2" fill="#FF9999" opacity={0.5} />
            <AnimatedCircle cx="21" cy="13.5" fill="#2D2D2D" animatedProps={leftEyeProps} />
            <AnimatedCircle cx="27" cy="13.5" fill="#2D2D2D" animatedProps={rightEyeProps} />
            <AnimatedPath stroke="#C47070" strokeWidth={1.2} strokeLinecap="round" fill="none" animatedProps={mouthProps} />
          </Svg>
        </View>
        <View style={styles.bubbleWrap}>
          <View style={[styles.bubble, { backgroundColor: color }]}>
            <Text style={styles.bubbleText}>{stage.bubble}</Text>
          </View>
        </View>
      </View>
      <View style={styles.barBg}>
        <Animated.View style={[styles.barFill, { backgroundColor: color }, barStyle]}>
          <Animated.View style={[styles.shimmer, shimmerStyle]} />
        </Animated.View>
      </View>
      <View style={styles.labelRow}>
        <Text style={[styles.labelText, { textAlign: 'center' }]}>{label} {progress}%</Text>
        <Text style={styles.elapsedText}>{elapsed}</Text>
      </View>
      {hint && <Text style={styles.hintText}>{hint}</Text>}
      {progress < 100 && (
        <View style={styles.tipRow}>
          <Text style={styles.tipText}>{tip}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  barBg: {
    width: '100%',
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.dark.surfaceLight,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 3,
    overflow: 'hidden',
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  circularBarBg: {
    width: '100%',
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.dark.surfaceLight,
    overflow: 'hidden',
  },
  circularBarFill: {
    height: '100%',
    borderRadius: 4,
    overflow: 'hidden',
  },
  circularLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  circularPct: {
    fontSize: 18,
    fontFamily: theme.typography.fontFamily.bold,
    minWidth: 48,
    textAlign: 'right',
  },
  labelText: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
  },
  elapsedText: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    marginLeft: 'auto',
  },
  hintText: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    textAlign: 'center',
  },
  tipRow: {
    marginTop: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: theme.colors.dark.surfaceLight,
    maxWidth: 280,
  },
  tipText: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    textAlign: 'center',
    lineHeight: 14,
  },
  shimmer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 60,
    backgroundColor: 'rgba(255,255,255,0.25)',
    transform: [{ skewX: '-20deg' }],
  },
  glowOverlay: {
    position: 'absolute',
    top: -2,
    height: 12,
    borderRadius: 6,
    opacity: 0.3,
  },
  babyTrackWrap: {
    width: TRACK_W,
    height: 48,
    justifyContent: 'center',
  },
  babyTrackLine: {
    position: 'absolute',
    left: 6,
    right: 6,
    top: 30,
    height: 2,
    backgroundColor: theme.colors.dark.border,
    borderRadius: 1,
  },
  babyStartDot: {
    position: 'absolute',
    left: 2,
    top: 26,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.dark.border,
  },
  babyEndDot: {
    position: 'absolute',
    right: 2,
    top: 26,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.primary[400] + '30',
    borderWidth: 2,
  },
  babyWrap: {
    position: 'absolute',
    left: 2,
    top: 6,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  babyFaceWrap: {
    width: 44,
    height: 44,
  },
  bubbleWrap: {
    flex: 1,
  },
  bubble: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderTopLeftRadius: 4,
  },
  bubbleText: {
    fontSize: 13,
    fontFamily: theme.typography.fontFamily.bold,
    color: '#fff',
  },
});
