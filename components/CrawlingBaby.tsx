import { useEffect } from 'react';
import Svg, { Circle, Ellipse, Path, Defs, RadialGradient, Stop, LinearGradient } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withRepeat,
  withSequence,
  withTiming,
  useAnimatedStyle,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse);

type CrawlingBabyProps = {
  size?: number;
  color?: string;
  crawlWidth?: number;
  speed?: number;
};

export function CrawlingBaby({
  size = 64,
  color = '#5b9bd5',
  crawlWidth = 120,
  speed = 1800,
}: CrawlingBabyProps) {
  const bodyBob = useSharedValue(0);
  const armLeft = useSharedValue(0);
  const armRight = useSharedValue(0);
  const legLeft = useSharedValue(0);
  const legRight = useSharedValue(0);
  const headBob = useSharedValue(0);
  const translateX = useSharedValue(0);

  useEffect(() => {
    const halfCycle = speed / 2;

    bodyBob.value = withRepeat(
      withSequence(
        withTiming(-1.5, { duration: halfCycle, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: halfCycle, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );

    armLeft.value = withRepeat(
      withSequence(
        withTiming(1, { duration: halfCycle, easing: Easing.inOut(Easing.sin) }),
        withTiming(-1, { duration: halfCycle, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );

    armRight.value = withRepeat(
      withSequence(
        withTiming(-1, { duration: halfCycle, easing: Easing.inOut(Easing.sin) }),
        withTiming(1, { duration: halfCycle, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );

    legLeft.value = withRepeat(
      withSequence(
        withTiming(1, { duration: halfCycle, easing: Easing.inOut(Easing.sin) }),
        withTiming(-1, { duration: halfCycle, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );

    legRight.value = withRepeat(
      withSequence(
        withTiming(-1, { duration: halfCycle, easing: Easing.inOut(Easing.sin) }),
        withTiming(1, { duration: halfCycle, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );

    headBob.value = withRepeat(
      withSequence(
        withTiming(-0.8, { duration: halfCycle, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: halfCycle, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );

    const crawlDuration = speed * 4;
    translateX.value = withRepeat(
      withSequence(
        withTiming(crawlWidth, { duration: crawlDuration, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: crawlDuration, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    );

    return () => {
      cancelAnimation(bodyBob);
      cancelAnimation(armLeft);
      cancelAnimation(armRight);
      cancelAnimation(legLeft);
      cancelAnimation(legRight);
      cancelAnimation(headBob);
      cancelAnimation(translateX);
    };
  }, [bodyBob, armLeft, armRight, legLeft, legRight, headBob, translateX, speed, crawlWidth]);

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const headProps = useAnimatedProps(() => ({
    cy: 14 + headBob.value,
  }));

  const headShadowProps = useAnimatedProps(() => ({
    cy: 26 + bodyBob.value,
  }));

  const bodyProps = useAnimatedProps(() => ({
    cy: 30 + bodyBob.value,
  }));

  const leftArmProps = useAnimatedProps(() => {
    const offset = armLeft.value * 4;
    return {
      d: `M14 28 Q${10 + offset} ${23 - offset} ${12 + offset} ${18 - offset}`,
    };
  });

  const rightArmProps = useAnimatedProps(() => {
    const offset = armRight.value * 4;
    return {
      d: `M34 28 Q${38 + offset} ${23 - offset} ${36 + offset} ${18 - offset}`,
    };
  });

  const leftLegProps = useAnimatedProps(() => {
    const offset = legLeft.value * 4;
    return {
      d: `M20 35 Q${17 + offset} ${40 + offset} ${15 + offset} ${44 + offset}`,
    };
  });

  const rightLegProps = useAnimatedProps(() => {
    const offset = legRight.value * 4;
    return {
      d: `M28 35 Q${31 + offset} ${40 + offset} ${33 + offset} ${44 + offset}`,
    };
  });

  const skinBase = '#F4C4A8';
  const skinShadow = '#E0A884';

  return (
    <Animated.View style={containerStyle}>
      <Svg width={size} height={size} viewBox="0 0 48 48" fill="none">
        <Defs>
          <RadialGradient id="cbHeadGrad" cx="40%" cy="35%" r="65%">
            <Stop offset="0%" stopColor="#FFE4D0" />
            <Stop offset="60%" stopColor={skinBase} />
            <Stop offset="100%" stopColor={skinShadow} />
          </RadialGradient>
          <RadialGradient id="cbBodyGrad" cx="50%" cy="30%" r="70%">
            <Stop offset="0%" stopColor="#FFFFFF" />
            <Stop offset="50%" stopColor={color} />
            <Stop offset="100%" stopColor="rgba(0,0,0,0.15)" />
          </RadialGradient>
          <LinearGradient id="cbHairGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#B07A4F" />
            <Stop offset="100%" stopColor="#8B5E3C" />
          </LinearGradient>
        </Defs>

        {/* Head shadow on body */}
        <AnimatedEllipse cx="24" cy={26} rx="7" ry="2" fill="rgba(0,0,0,0.12)" animatedProps={headShadowProps} />

        {/* Body — filled onesie with gradient */}
        <AnimatedEllipse cx="24" cy={30} rx="13" ry="6.5" fill="url(#cbBodyGrad)" animatedProps={bodyProps} />

        {/* Arms — filled skin tone */}
        <AnimatedPath stroke={skinBase} strokeWidth={3.2} strokeLinecap="round" fill="none" animatedProps={leftArmProps} />
        <AnimatedPath stroke={skinBase} strokeWidth={3.2} strokeLinecap="round" fill="none" animatedProps={rightArmProps} />

        {/* Legs — filled skin tone */}
        <AnimatedPath stroke={skinBase} strokeWidth={3} strokeLinecap="round" fill="none" animatedProps={leftLegProps} />
        <AnimatedPath stroke={skinBase} strokeWidth={3} strokeLinecap="round" fill="none" animatedProps={rightLegProps} />

        {/* Head — 3D sphere */}
        <AnimatedCircle cx="24" cy={14} r="7.5" fill="url(#cbHeadGrad)" stroke={skinShadow} strokeWidth={0.6} animatedProps={headProps} />

        {/* Hair tuft */}
        <Path
          d="M16 11 Q18 5 24 5.5 Q30 5 32 11 Q28 8 24 8.5 Q20 8 16 11 Z"
          fill="url(#cbHairGrad)"
        />

        {/* Cheeks */}
        <Circle cx="19" cy="16" r="2" fill="#FF9999" opacity={0.5} />
        <Circle cx="29" cy="16" r="2" fill="#FF9999" opacity={0.5} />

        {/* Eyes with highlight */}
        <Circle cx="21" cy="13.5" r="1" fill="#2D2D2D" />
        <Circle cx="27" cy="13.5" r="1" fill="#2D2D2D" />
        <Circle cx="21.3" cy="13.2" r="0.35" fill="#FFFFFF" />
        <Circle cx="27.3" cy="13.2" r="0.35" fill="#FFFFFF" />

        {/* Smile */}
        <Path d="M21 16 Q24 18.5 27 16" stroke="#C47070" strokeWidth={1.2} strokeLinecap="round" fill="none" />
      </Svg>
    </Animated.View>
  );
}
