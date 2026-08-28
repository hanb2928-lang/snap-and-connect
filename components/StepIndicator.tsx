import { View, Text, StyleSheet, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { theme } from '@/lib/theme';

const STEP_COLORS = [
  theme.colors.primary[400],
  theme.colors.accent[400],
  theme.colors.warning[400],
  theme.colors.success[400],
];

const STEPS = [
  { num: '1', label: '촬영', route: '/' },
  { num: '2', label: 'AI분석', route: '/' },
  { num: '3', label: '편집', route: '/assets' },
  { num: '4', label: '공유', route: '/affiliate' },
];

interface StepIndicatorProps {
  activeStep?: number;
}

export function StepIndicator({ activeStep = 1 }: StepIndicatorProps) {
  const router = useRouter();

  return (
    <View style={styles.container}>
      {STEPS.map((step, index) => {
        const isActive = activeStep === index + 1;
        const isDone = activeStep > index + 1;
        const color = isActive
          ? STEP_COLORS[index]
          : isDone
            ? STEP_COLORS[index]
            : theme.colors.dark.textFaint;
        const glowStyle = isActive
          ? { shadowColor: STEP_COLORS[index], shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 8, elevation: 0 }
          : undefined;

        return (
          <View key={step.num} style={styles.stepItem}>
            <View
              style={[
                styles.dot,
                { borderColor: isActive || isDone ? STEP_COLORS[index] : 'rgba(255,255,255,0.12)' },
                (isActive || isDone) && { backgroundColor: STEP_COLORS[index] },
                glowStyle,
              ]}
            >
              <Text style={[styles.dotText, { color: isActive || isDone ? '#fff' : theme.colors.dark.textFaint }]}>
                {step.num}
              </Text>
            </View>
            <Text style={[styles.label, { color }]} numberOfLines={1}>
              {step.label}
            </Text>
            {index < STEPS.length - 1 && (
              <View style={styles.barWrap}>
                <View
                  style={[
                    styles.bar,
                    isDone && { backgroundColor: STEP_COLORS[index] + '80' },
                  ]}
                />
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.glass.surface,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: theme.glass.border,
    ...(Platform.OS === 'web'
      ? { backdropFilter: 'blur(12px)' as unknown as undefined }
      : {}),
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  dot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
  },
  dotText: {
    fontSize: 8,
    fontFamily: theme.typography.fontFamily.bold,
  },
  label: {
    fontSize: 9,
    fontFamily: theme.typography.fontFamily.medium,
    marginLeft: 4,
  },
  barWrap: {
    flex: 1,
    marginHorizontal: 4,
    height: 6,
    justifyContent: 'center',
  },
  bar: {
    flex: 1,
    height: 2,
    borderRadius: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
});
