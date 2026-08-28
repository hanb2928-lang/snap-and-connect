import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { theme } from '@/lib/theme';

interface VerticalSectionCardProps {
  icon: React.ReactNode;
  title: string;
  desc: string;
  iconBg: string;
  children: React.ReactNode;
  style?: ViewStyle;
}

export function VerticalSectionCard({
  icon,
  title,
  desc,
  iconBg,
  children,
  style,
}: VerticalSectionCardProps) {
  return (
    <View style={[styles.section, style]}>
      <View style={styles.header}>
        <View style={[styles.iconWrap, { backgroundColor: iconBg }]}>
          {icon}
        </View>
        <View style={styles.textWrap}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.desc}>{desc}</Text>
        </View>
      </View>
      <View style={styles.body}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    width: '100%',
    maxWidth: 460,
    alignSelf: 'center',
    backgroundColor: theme.colors.dark.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1.5,
    borderColor: theme.colors.dark.border,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm + 2,
    marginBottom: theme.spacing.md - 2,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textWrap: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.dark.text,
  },
  desc: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.regular,
    color: theme.colors.dark.textDim,
    marginTop: 2,
    lineHeight: 17,
  },
  body: {
    gap: theme.spacing.sm,
  },
});
