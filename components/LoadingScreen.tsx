import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { theme } from '@/lib/theme';

type LoadingScreenProps = {
  message?: string;
  fullScreen?: boolean;
};

export function LoadingScreen({ message = '불러오는 중...', fullScreen = true }: LoadingScreenProps) {
  return (
    <View style={[styles.container, !fullScreen && styles.inline]}>
      <ActivityIndicator size="large" color={theme.colors.primary[400]} />
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
  text: {
    fontSize: theme.typography.caption,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
  },
});
