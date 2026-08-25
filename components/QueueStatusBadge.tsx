import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
  cancelAnimation,
  useAnimatedStyle,
} from 'react-native-reanimated';
import { Clock, Loader, CircleCheck as CheckCircle, CircleAlert as AlertCircle } from 'lucide-react-native';
import type { JobStatus } from '@/lib/jobQueue';
import { theme } from '@/lib/theme';

interface QueueStatusBadgeProps {
  status: JobStatus | 'idle';
  error?: string | null;
  label?: string;
}

const STATUS_CONFIG: Record<
  JobStatus | 'idle',
  { icon: typeof Clock; color: string; text: string; bg: string }
> = {
  idle: { icon: Clock, color: theme.colors.dark.textDim, text: '대기 중', bg: theme.colors.dark.surfaceLight },
  queued: { icon: Clock, color: theme.colors.warning[400], text: '대기열에 등록됨', bg: theme.colors.warning[400] + '18' },
  processing: { icon: Loader, color: theme.colors.primary[300], text: 'AI 처리 중', bg: theme.colors.primary[600] + '18' },
  done: { icon: CheckCircle, color: theme.colors.success[400], text: '완료', bg: theme.colors.success[400] + '18' },
  error: { icon: AlertCircle, color: theme.colors.error[400], text: '오류 발생', bg: theme.colors.error[400] + '18' },
};

export function QueueStatusBadge({ status, error, label }: QueueStatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.idle;
  const Icon = config.icon;
  const spinValue = useSharedValue(0);
  const pulseValue = useSharedValue(1);

  useEffect(() => {
    if (status === 'processing') {
      spinValue.value = withRepeat(
        withTiming(360, { duration: 1200, easing: Easing.linear }),
        -1, false,
      );
    } else if (status === 'queued') {
      pulseValue.value = withRepeat(
        withSequence(
          withTiming(0.7, { duration: 700, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 700, easing: Easing.inOut(Easing.ease) }),
        ),
        -1, false,
      );
    } else {
      cancelAnimation(spinValue);
      cancelAnimation(pulseValue);
      spinValue.value = 0;
      pulseValue.value = 1;
    }
    return () => {
      cancelAnimation(spinValue);
      cancelAnimation(pulseValue);
    };
  }, [status, spinValue, pulseValue]);

  const spinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spinValue.value}deg` }],
  }));

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: pulseValue.value,
  }));

  const displayText = label ?? config.text;

  return (
    <View style={[styles.container, { backgroundColor: config.bg }]}>
      <Animated.View style={status === 'processing' ? spinStyle : (status === 'queued' ? pulseStyle : undefined)}>
        <Icon size={12} color={config.color} strokeWidth={2.5} />
      </Animated.View>
      <Text style={[styles.text, { color: config.color }]} numberOfLines={1}>
        {displayText}
      </Text>
      {status === 'error' && error ? (
        <Text style={styles.errorDetail} numberOfLines={1}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 100,
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
  text: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.semiBold,
  },
  errorDetail: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    flexShrink: 1,
  },
});
