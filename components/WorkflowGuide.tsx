import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import {
  Camera,
  Palette,
  LayoutTemplate,
  Share2,
  ChevronRight,
} from 'lucide-react-native';
import { theme } from '@/lib/theme';

interface WorkflowStep {
  num: string;
  title: string;
  desc: string;
  icon: React.ReactNode;
  color: string;
}

const STEPS: WorkflowStep[] = [
  {
    num: '1',
    title: '사진 촬영 또는 불러오기',
    desc: '제품의 단품 또는 다각도(앞·옆·뒤) 사진을 촬영하거나 앨범에서 불러옵니다.',
    icon: <Camera size={22} color={theme.colors.primary[400]} strokeWidth={2} />,
    color: theme.colors.primary[500],
  },
  {
    num: '2',
    title: 'AI 자동 분석 및 스타일 선택',
    desc: '업로드한 사진을 AI가 자동으로 분석하고, 원하시는 마케팅 템플릿 스타일을 적용하거나 변경합니다.',
    icon: <Palette size={22} color={theme.colors.accent[400]} strokeWidth={2} />,
    color: theme.colors.accent[500],
  },
  {
    num: '3',
    title: '콘텐츠 및 템플릿 편집',
    desc: '추천된 템플릿을 바탕으로 문구, 상세페이지, 카드뉴스 디자인을 직접 수정하고 꾸밉니다.',
    icon: <LayoutTemplate size={22} color={theme.colors.warning[400]} strokeWidth={2} />,
    color: theme.colors.warning[500],
  },
  {
    num: '4',
    title: '제휴 링크 및 배포 관리',
    desc: '제휴 마케팅 링크를 삽입하고, 완성된 콘텐츠를 블로그나 SNS에 바로 내보내거나 관리합니다.',
    icon: <Share2 size={22} color={theme.colors.success[400]} strokeWidth={2} />,
    color: theme.colors.success[500],
  },
];

interface WorkflowGuideProps {
  onStepPress?: (step: number) => void;
  currentStep?: number;
}

export function WorkflowGuide({ onStepPress, currentStep }: WorkflowGuideProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.heading}>작업 순서 가이드</Text>
      <Text style={styles.subheading}>
        1번부터 4번까지 순서대로 따라 하시면 됩니다
      </Text>

      {STEPS.map((step, index) => {
        const isActive = currentStep === index + 1;
        const isDone = currentStep != null && currentStep > index + 1;
        return (
          <TouchableOpacity
            key={step.num}
            style={[
              styles.stepCard,
              isActive && styles.stepCardActive,
              isDone && styles.stepCardDone,
            ]}
            onPress={() => onStepPress?.(index + 1)}
            activeOpacity={0.7}
            disabled={!onStepPress}
          >
            <View style={styles.stepLeft}>
              <View
                style={[
                  styles.stepNumCircle,
                  {
                    backgroundColor: step.color + '20',
                    borderColor: step.color + '60',
                  },
                ]}
              >
                <Text style={[styles.stepNum, { color: step.color }]}>
                  {step.num}
                </Text>
              </View>
              {index < STEPS.length - 1 && <View style={styles.stepConnector} />}
            </View>

            <View style={styles.stepContent}>
              <View style={styles.stepHeader}>
                <View
                  style={[
                    styles.stepIconWrap,
                    { backgroundColor: step.color + '15' },
                  ]}
                >
                  {step.icon}
                </View>
                <Text style={styles.stepTitle}>{step.title}</Text>
              </View>
              <Text style={styles.stepDesc}>{step.desc}</Text>
            </View>

            {onStepPress && (
              <ChevronRight
                size={18}
                color={theme.colors.dark.textDim}
                strokeWidth={2}
              />
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    maxWidth: 440,
    gap: theme.spacing.sm,
  },
  heading: {
    fontSize: theme.typography.body,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.dark.text,
    marginBottom: 2,
  },
  subheading: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    marginBottom: theme.spacing.sm,
  },
  stepCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    backgroundColor: theme.colors.dark.surface,
    borderRadius: theme.radius.lg,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    borderWidth: 1.5,
    borderColor: theme.colors.dark.border,
  },
  stepCardActive: {
    borderColor: theme.colors.primary[400],
    backgroundColor: theme.colors.primary[500] + '12',
  },
  stepCardDone: {
    borderColor: theme.colors.success[400] + '40',
    backgroundColor: theme.colors.success[500] + '08',
  },
  stepLeft: {
    alignItems: 'center',
  },
  stepNumCircle: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.full,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNum: {
    fontSize: 15,
    fontFamily: theme.typography.fontFamily.bold,
  },
  stepConnector: {
    position: 'absolute',
    top: 36,
    width: 2,
    height: 28,
    backgroundColor: theme.colors.dark.border,
  },
  stepContent: {
    flex: 1,
    gap: 6,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepIconWrap: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepTitle: {
    flexShrink: 1,
    fontSize: 14,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
  },
  stepDesc: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    lineHeight: 17,
  },
});
