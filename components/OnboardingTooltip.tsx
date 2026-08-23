import { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withRepeat,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { theme } from '@/lib/theme';

interface OnboardingTooltipProps {
  visible: boolean;
  onDismiss: () => void;
  message: string;
  /** anchor position from bottom of screen */
  bottom?: number;
  /** horizontal offset from center, 0 = centered */
  offsetX?: number;
  /** point direction: 'down' = arrow points down (tooltip above anchor), 'up' = arrow points up (tooltip below anchor) */
  direction?: 'down' | 'up';
  duration?: number;
}

export function OnboardingTooltip({
  visible,
  onDismiss,
  message,
  bottom = 200,
  offsetX = 0,
  direction = 'down',
  duration = 3000,
}: OnboardingTooltipProps) {
  const opacity = useSharedValue(0);
  const glow = useSharedValue(0);

  useEffect(() => {
    if (!visible) return;
    opacity.value = withSequence(
      withTiming(0, { duration: 0 }),
      withTiming(1, { duration: 400, easing: Easing.out(Easing.cubic) }),
    );
    glow.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 800, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.4, { duration: 800, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );

    const timer = setTimeout(() => {
      opacity.value = withTiming(0, { duration: 400, easing: Easing.in(Easing.cubic) });
      setTimeout(onDismiss, 450);
    }, duration);

    return () => clearTimeout(timer);
  }, [visible, onDismiss, opacity, glow, duration]);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateY: (1 - opacity.value) * (direction === 'down' ? 12 : -12) },
    ],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glow.value * 0.6,
  }));

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        { bottom, transform: [{ translateX: offsetX }] },
        containerStyle,
      ]}
      pointerEvents="none"
    >
      <Animated.View style={[styles.glow, glowStyle]} />
      <View style={styles.bubble}>
        <View style={[styles.arrow, direction === 'down' ? styles.arrowDown : styles.arrowUp]} />
        <Text style={styles.text}>{message}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    alignSelf: 'center',
    zIndex: 100,
  },
  glow: {
    position: 'absolute',
    top: -8,
    left: -8,
    right: -8,
    bottom: -8,
    borderRadius: 20,
    backgroundColor: theme.colors.primary[400],
  },
  bubble: {
    backgroundColor: theme.colors.dark.surface,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm + 2,
    borderWidth: 1.5,
    borderColor: theme.colors.primary[400],
    ...theme.shadows.elevated,
  },
  arrow: {
    position: 'absolute',
    width: 0,
    height: 0,
    left: '50%',
    marginLeft: -7,
  },
  arrowDown: {
    bottom: -7,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderTopWidth: 7,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: theme.colors.primary[400],
  },
  arrowUp: {
    top: -7,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderBottomWidth: 7,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: theme.colors.primary[400],
  },
  text: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.primary[300],
    textAlign: 'center',
    lineHeight: 20,
  },
});
