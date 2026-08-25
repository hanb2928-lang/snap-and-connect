import { View, Text, StyleSheet } from 'react-native';
import { theme } from '@/lib/theme';
import { CrawlingBaby } from '@/components/CrawlingBaby';

type LoadingScreenProps = {
  message?: string;
  fullScreen?: boolean;
};

export function LoadingScreen({ message = '불러오는 중...', fullScreen = true }: LoadingScreenProps) {
  return (
    <View style={[styles.container, !fullScreen && styles.inline]}>
      <View style={styles.babyWrap}>
        <CrawlingBaby size={56} color={theme.colors.primary[400]} crawlWidth={80} speed={1600} />
      </View>
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.dark.bg,
    justifyContent: 'center',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  inline: {
    flex: undefined,
    paddingVertical: theme.spacing.xl,
  },
  babyWrap: {
    width: 160,
    height: 64,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
  },
});
