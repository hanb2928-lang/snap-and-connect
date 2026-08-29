import { memo, useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ViewStyle, Platform, TouchableOpacity, LayoutAnimation, Pressable } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming, Easing } from 'react-native-reanimated';
import { Check, ChevronDown } from 'lucide-react-native';
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
  /** Beginner-friendly explanation badge, e.g. "옷 사진 → 모델 착샷 변환" */
  beginnerBadge?: string;
  /** When true, the card auto-expands to reveal its children */
  autoExpand?: boolean;
  /** Controlled expanded state; if not provided, the card manages its own */
  expanded?: boolean;
  /** Called when the user taps the header to toggle */
  onToggle?: () => void;
}

function VerticalSectionCardInner({
  icon,
  title,
  desc,
  iconBg,
  children,
  style,
  accentColor,
  stepNumber,
  completed,
  beginnerBadge,
  autoExpand,
  expanded: controlledExpanded,
  onToggle,
}: VerticalSectionCardProps) {
  const glowStyle = useMemo(
    () => accentColor && Platform.OS === 'web'
      ? { shadowColor: accentColor, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.12, shadowRadius: 16, elevation: 0 }
      : undefined,
    [accentColor],
  );

  const wasCompleted = useRef(false);
  const checkScale = useSharedValue(0);
  const checkOpacity = useSharedValue(0);
  const cardShift = useSharedValue(0);

  const [internalExpanded, setInternalExpanded] = useState(autoExpand ?? false);
  const isControlled = controlledExpanded !== undefined;
  const isExpanded = isControlled ? controlledExpanded : internalExpanded;

  useEffect(() => {
    if (autoExpand !== undefined && !isControlled) {
      setInternalExpanded(autoExpand);
    }
  }, [autoExpand, isControlled]);

  const handleToggle = useCallback(() => {
    if (onToggle) {
      onToggle();
    } else if (!isControlled) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setInternalExpanded((prev) => !prev);
    }
  }, [onToggle, isControlled]);

  useEffect(() => {
    if (completed && !wasCompleted.current) {
      wasCompleted.current = true;
      checkScale.value = withSpring(1, { damping: 12, stiffness: 200 });
      checkOpacity.value = withTiming(1, { duration: 200, easing: Easing.out(Easing.ease) });
      cardShift.value = withTiming(0, { duration: 400, easing: Easing.out(Easing.ease) });
    } else if (!completed && wasCompleted.current) {
      wasCompleted.current = false;
      checkScale.value = withTiming(0, { duration: 150 });
      checkOpacity.value = withTiming(0, { duration: 150 });
    }
  }, [completed]);

  const checkAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }],
    opacity: checkOpacity.value,
  }));

  const chevronAnim = useAnimatedStyle(() => ({
    transform: [{ rotate: `${isExpanded ? 180 : 0}deg` }],
  }));

  return (
    <Animated.View style={[styles.section, isExpanded && styles.sectionExpanded, glowStyle, style]}>
      {accentColor && <View style={[styles.accentLine, { backgroundColor: accentColor }]} />}
      {completed && <View style={styles.completedOverlay} pointerEvents="none" />}

      <Pressable style={styles.headerRow} onPress={handleToggle}>
        <View style={[styles.iconWrap, { backgroundColor: iconBg }]}>
          {icon}
          {typeof stepNumber === 'number' && (
            <View style={styles.stepBadge}>
              <Text style={styles.stepBadgeText}>{stepNumber}</Text>
            </View>
          )}
          {completed && (
            <Animated.View style={[styles.completedCheck, checkAnimStyle]}>
              <Check size={12} color="#fff" strokeWidth={3} />
            </Animated.View>
          )}
        </View>
        <View style={styles.textWrap}>
          <Text style={[styles.title, completed && styles.titleCompleted]}>{title}</Text>
          <Text style={styles.desc}>{desc}</Text>
          {beginnerBadge ? (
            <View style={[styles.beginnerBadge, { backgroundColor: (accentColor || theme.colors.primary[400]) + '18' }]}>
              <Text style={[styles.beginnerBadgeText, { color: accentColor || theme.colors.primary[300] }]}>
                {beginnerBadge}
              </Text>
            </View>
          ) : null}
        </View>
        <Animated.View style={[styles.chevronWrap, chevronAnim]}>
          <ChevronDown size={20} color={theme.colors.dark.textDim} strokeWidth={2} />
        </Animated.View>
      </Pressable>

      {isExpanded && <View style={styles.body}>{children}</View>}
    </Animated.View>
  );
}

export const VerticalSectionCard = memo(VerticalSectionCardInner);

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
    ...(Platform.OS === 'web')
      ? { backdropFilter: 'blur(12px)' as unknown as undefined }
      : {},
  },
  sectionExpanded: {
    borderColor: (theme.colors.primary[400] + '40') as string,
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.sm + 2,
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
  completedCheck: {
    position: 'absolute',
    bottom: -5,
    right: -5,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: theme.colors.success[500],
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.colors.dark.bg,
  },
  titleCompleted: {
    color: theme.colors.success[400],
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
  beginnerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: 6,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: theme.radius.full,
  },
  beginnerBadgeText: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.semiBold,
  },
  chevronWrap: {
    paddingTop: 10,
  },
  body: {
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },
});
