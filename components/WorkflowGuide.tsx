import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Camera, Wand as Wand2, Film, Send, ChevronRight } from 'lucide-react-native';
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
    title: '사진 촬영 · 업로드',
    desc: '제품 사진을 촬영하거나 앨범에서 불러오고 게시할 플랫폼을 선택하세요.',
    icon: <Camera size={22} color={theme.colors.primary[400]} strokeWidth={2} />,
    color: theme.colors.primary[500],
  },
  {
    num: '2',
    title: 'AI 이미지 보정 · 합성',
    desc: 'AI 누끼(배경 제거), 조명 스튜디오 합성, AI 가상 피팅으로 전문 소재를 완성합니다.',
    icon: <Wand2 size={22} color={theme.colors.accent[400]} strokeWidth={2} />,
    color: theme.colors.accent[500],
  },
  {
    num: '3',
    title: 'AI 만화 숏폼 생성',
    desc: '상품 사진 한 장으로 만화 컷 숏폼을 자동 생성하고 미리보기로 확인하세요.',
    icon: <Film size={22} color={theme.colors.success[400]} strokeWidth={2} />,
    color: theme.colors.success[500],
  },
  {
    num: '4',
    title: '발행 · 공유',
    desc: '단축 URL을 복사하고 선택한 플랫폼에 바로 업로드하세요.',
    icon: <Send size={22} color={theme.colors.warning[400]} strokeWidth={2} />,
    color: theme.colors.warning[500],
  },
];

interface WorkflowGuideProps {
  currentStep?: number;
}

export function WorkflowGuide({ currentStep }: WorkflowGuideProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.heading}>작업 순서</Text>
      <Text style={styles.subheading}>
        4단계로 완성하는 숏폼 콘텐츠
      </Text>

      {STEPS.map((step, index) => {
        const isActive = currentStep === index + 1;
        const isDone = currentStep != null && currentStep > index + 1;
        return (
          <View
            key={step.num}
            style={[
              styles.stepCard,
              isActive && styles.stepCardActive,
              isDone && styles.stepCardDone,
            ]}
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
          </View>
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
    alignItems: 'flex-start',
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
    height: '100%',
    minHeight: 28,
    backgroundColor: theme.colors.dark.border,
  },
  stepContent: {
    flex: 1,
    gap: 6,
    paddingBottom: 4,
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
