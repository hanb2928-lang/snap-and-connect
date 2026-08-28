import { View, Text, StyleSheet, ViewStyle, Platform } from 'react-native';
import { theme } from '@/lib/theme';

interface VerticalSectionCardProps {
  icon: React.ReactNode;
  title: string;
  desc: string;
  iconBg: string;
  children: React.ReactNode;
  style?: ViewStyle;
  accentColor?: string;
  stepNumber?: number;
  completed?: boolean;
}

export function VerticalSectionCard({
  icon,
  title,
  desc,
  iconBg,
  children,
  style,
  accentColor,
  stepNumber,
  completed,
}: VerticalSectionCardProps) {
  const glowStyle = accentColor && Platform.OS === 'web'
    ? { shadowColor: accentColor, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.12, shadowRadius: 16, elevation: 0 }
    : undefined;

  return (
    <View style={[styles.section, glowStyle, style]}>
      {accentColor && <View style={[styles.accentLine, { backgroundColor: accentColor }]} />}
      {completed && <View style={styles.completedOverlay} pointerEvents="none" />}

      <View style={styles.header}>
        <View style={[styles.iconWrap, { backgroundColor: iconBg }]}>
          {icon}
          {typeof stepNumber === 'number' && (
            <View style={styles.stepBadge}>
              <Text style={styles.stepBadgeText}>{stepNumber}</Text>
            </View>
          )}
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
    backgroundColor: theme.glass.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1.5,
    borderColor: theme.glass.border,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    overflow: 'visible',
    ...(Platform.OS === 'web'
      ? { backdropFilter: 'blur(12px)' as unknown as undefined }
      : {}),
  },
  accentLine: {
    position: 'absolute',
    left: 0,
    top: theme.radius.lg,
    bottom: theme.radius.lg,
    width: 3,
    borderRadius: 3,
    opacity: 0.8,
  },
  completedOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: theme.radius.lg,
    backgroundColor: 'rgba(52, 211, 153, 0.04)',
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
  stepBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: theme.colors.dark.surfaceLight,
    borderWidth: 1.5,
    borderColor: theme.colors.dark.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepBadgeText: {
    fontSize: 9,
    fontFamily: theme.typography.fontFamily.bold,
    color: theme.colors.dark.textDim,
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
