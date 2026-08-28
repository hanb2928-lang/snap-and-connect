import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { theme } from '@/lib/theme';

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
        const color = isActive ? theme.colors.primary[400] : isDone ? theme.colors.success[400] : theme.colors.dark.textFaint;
        return (
          <View key={step.num} style={styles.stepItem}>
            <View style={[styles.dot, isActive && { backgroundColor: theme.colors.primary[400] }, isDone && { backgroundColor: theme.colors.success[400] }]}>
              <Text style={[styles.dotText, { color: isActive || isDone ? '#fff' : theme.colors.dark.textFaint }]}>
                {step.num}
              </Text>
            </View>
            <Text style={[styles.label, { color }]} numberOfLines={1}>
              {step.label}
            </Text>
            {index < STEPS.length - 1 && (
              <View style={[styles.bar, isDone && { backgroundColor: theme.colors.success[400] + '60' }]} />
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
    backgroundColor: 'rgba(10, 15, 30, 0.6)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
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
    backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dotText: {
    fontSize: 8,
    fontFamily: theme.typography.fontFamily.bold,
  },
  label: {
    fontSize: 9,
    fontFamily: theme.typography.fontFamily.medium,
    marginLeft: 3,
  },
  bar: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginHorizontal: 4,
  },
});
