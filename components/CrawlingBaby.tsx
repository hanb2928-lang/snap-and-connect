import { useEffect } from 'react';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';
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

  const sw = 2;

  return (
    <Animated.View style={containerStyle}>
      <Svg width={size} height={size} viewBox="0 0 48 48" fill="none">
        {/* Head */}
        <AnimatedCircle cx="24" cy={14} r="7" stroke={color} strokeWidth={sw} fill="none" animatedProps={headProps} />
        {/* Smile */}
        <Path d="M21 15.5 Q24 18 27 15.5" stroke={color} strokeWidth={sw * 0.7} strokeLinecap="round" fill="none" />
        {/* Eyes */}
        <Circle cx="21.5" cy="13" r="0.9" fill={color} />
        <Circle cx="26.5" cy="13" r="0.9" fill={color} />
        {/* Cheeks */}
        <Circle cx="19" cy="16" r="1.2" fill={color} opacity={0.3} />
        <Circle cx="29" cy="16" r="1.2" fill={color} opacity={0.3} />
        {/* Body */}
        <AnimatedEllipse cx="24" cy={30} rx="12" ry="5" stroke={color} strokeWidth={sw} fill="none" animatedProps={bodyProps} />
        {/* Arms crawling */}
        <AnimatedPath stroke={color} strokeWidth={sw * 0.8} strokeLinecap="round" fill="none" animatedProps={leftArmProps} />
        <AnimatedPath stroke={color} strokeWidth={sw * 0.8} strokeLinecap="round" fill="none" animatedProps={rightArmProps} />
        {/* Legs kicking */}
        <AnimatedPath stroke={color} strokeWidth={sw * 0.8} strokeLinecap="round" fill="none" animatedProps={leftLegProps} />
        <AnimatedPath stroke={color} strokeWidth={sw * 0.8} strokeLinecap="round" fill="none" animatedProps={rightLegProps} />
      </Svg>
    </Animated.View>
  );
}
