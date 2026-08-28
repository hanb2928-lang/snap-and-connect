import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Camera,
  Palette,
  LayoutTemplate,
  Share2,
} from 'lucide-react-native';
import { theme } from '@/lib/theme';

interface StepDef {
  num: string;
  title: string;
  desc: string;
  icon: typeof Camera;
  color: string;
  route: string;
}

const STEPS: StepDef[] = [
  {
    num: '1',
    title: '사진 촬영',
    desc: '제품 사진을 찍거나 갤러리에서 불러오세요',
    icon: Camera,
    color: theme.colors.primary[400],
    route: '/',
  },
  {
    num: '2',
    title: 'AI 분석 & 스타일',
    desc: 'AI가 자동 분석하고 템플릿 스타일을 적용합니다',
    icon: Palette,
    color: theme.colors.accent[400],
    route: '/',
  },
  {
    num: '3',
    title: '템플릿 편집',
    desc: '문구·디자인을 수정하고 카드뉴스를 꾸밉니다',
    icon: LayoutTemplate,
    color: theme.colors.warning[400],
    route: '/assets',
  },
  {
    num: '4',
    title: '제휴 링크 & 배포',
    desc: '링크 삽입 후 SNS에 공유하세요',
    icon: Share2,
    color: theme.colors.success[400],
    route: '/affiliate',
  },
];

interface StepIndicatorProps {
  activeStep?: number;
}

export function StepIndicator({ activeStep = 1 }: StepIndicatorProps) {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={styles.stepsRow}>
        {STEPS.map((step, index) => {
          const isActive = activeStep === index + 1;
          const isDone = activeStep > index + 1;
          const Icon = step.icon;
          return (
            <View key={step.num} style={styles.stepWrapper}>
              {index > 0 && (
                <View style={[styles.connector, isDone && styles.connectorDone]} />
              )}
              <TouchableOpacity
                style={[
                  styles.stepCircle,
                  isActive && { borderColor: step.color, backgroundColor: step.color + '20' },
                  isDone && { borderColor: step.color + '60', backgroundColor: step.color + '15' },
                ]}
                onPress={() => router.push(step.route as never)}
                activeOpacity={0.7}
              >
                <Icon
                  size={16}
                  color={isActive || isDone ? step.color : theme.colors.dark.textFaint}
                  strokeWidth={2.2}
                />
                <View style={styles.numBadge}>
                  <Text style={[styles.numText, { color: isActive || isDone ? step.color : theme.colors.dark.textFaint }]}>
                    {step.num}
                  </Text>
                </View>
              </TouchableOpacity>
              <Text
                style={[
                  styles.stepLabel,
                  isActive && { color: step.color },
                ]}
                numberOfLines={1}
              >
                {step.title}
              </Text>
            </View>
          );
        })}
      </View>
      <Text style={styles.activeDesc}>
        {STEPS[activeStep - 1]?.desc || STEPS[0].desc}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(10, 15, 30, 0.75)',
    borderRadius: theme.radius.lg,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  stepsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepWrapper: {
    flex: 1,
    alignItems: 'center',
  },
  connector: {
    position: 'absolute',
    left: '-50%',
    top: 18,
    width: '100%',
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  connectorDone: {
    backgroundColor: theme.colors.success[400] + '60',
  },
  stepCircle: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.full,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  numBadge: {
    position: 'absolute',
    bottom: -6,
    right: -6,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: theme.colors.dark.bg,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  numText: {
    fontSize: 9,
    fontFamily: theme.typography.fontFamily.bold,
  },
  stepLabel: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.textDim,
    marginTop: 8,
    textAlign: 'center',
  },
  activeDesc: {
    fontSize: 11,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 15,
  },
});
