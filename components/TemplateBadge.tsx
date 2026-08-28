import { View, Text, StyleSheet } from 'react-native';
import { Sparkles } from 'lucide-react-native';
import { theme } from '@/lib/theme';

interface TemplateBadgeProps {
  label: string | null;
}

export function TemplateBadge({ label }: TemplateBadgeProps) {
  if (!label) return null;
  return (
    <View style={styles.badge}>
      <Sparkles size={11} color={theme.colors.success[400]} strokeWidth={2.5} />
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.success[500] + '15',
    alignSelf: 'center',
    marginBottom: 4,
  },
  text: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.success[400],
  },
});
