import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import type {
  BottomTabBarProps,
} from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '@/lib/theme';
import { useI18n } from '@/hooks/useI18n';
import {
  Camera,
  Folder,
  Zap,
  ShoppingBag,
  type LucideIcon,
} from 'lucide-react-native';

const TAB_ICONS: Record<string, LucideIcon> = {
  index: Camera,
  marketing: Zap,
  affiliate: ShoppingBag,
  assets: Folder,
};

const TAB_KEYS: Record<string, string> = {
  index: 'tab.camera',
  marketing: 'tab.create',
  affiliate: 'tab.affiliate',
  assets: 'tab.library',
};

const HIT_SLOP = { top: 8, bottom: 8, left: 4, right: 4 };

export type TabBadgeMap = Record<string, boolean>;

export function ScrollableTabBar({ state, navigation, badges }: BottomTabBarProps & { badges?: TabBadgeMap }) {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const bottomPadding = Math.max(insets.bottom, 0);

  const visibleRoutes = state.routes.filter((route) => TAB_ICONS[route.name] !== undefined);

  return (
    <View style={[styles.container, { paddingBottom: 8 + bottomPadding }]}>
      <View style={styles.tabRow}>
        {visibleRoutes.map((route) => {
          const routeIndex = state.routes.findIndex((r) => r.name === route.name);
          const isFocused = state.index === routeIndex;
          const Icon = TAB_ICONS[route.name];
          const label = t(TAB_KEYS[route.name] || '', route.name);
          const hasBadge = badges?.[route.name] === true;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name as never);
            }
          };

          return (
            <TouchableOpacity
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              onPress={onPress}
              activeOpacity={0.6}
              hitSlop={HIT_SLOP}
              style={styles.tabItem}
            >
              <View style={[styles.iconWrap, isFocused && styles.iconWrapActive]}>
                <Icon
                  size={26}
                  color={isFocused ? theme.colors.primary[400] : theme.colors.dark.textDim}
                  strokeWidth={isFocused ? 2.5 : 2.2}
                  fill={isFocused ? theme.colors.primary[400] + '3C' : 'transparent'}
                />
                {hasBadge && <View style={styles.tabBadgeDot} />}
              </View>
              <Text
                style={[
                  styles.tabLabel,
                  isFocused && styles.tabLabelActive,
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.82}
              >
                {label}
              </Text>
              {isFocused && <View style={styles.activeBar} />}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.dark.surface,
    borderTopColor: theme.colors.dark.border,
    borderTopWidth: 1,
    paddingTop: 10,
    paddingBottom: 8,
  },
  tabRow: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  tabItem: {
    flex: 1,
    maxWidth: 120,
    alignItems: 'center',
    paddingVertical: 6,
  },
  iconWrap: {
    width: 54,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: theme.radius.full,
  },
  iconWrapActive: {
    backgroundColor: theme.colors.primary[500] + '2E',
  },
  tabBadgeDot: {
    position: 'absolute',
    top: 4,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.error[400],
    borderWidth: 1.5,
    borderColor: theme.colors.dark.surface,
  },
  tabLabel: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.textFaint,
    marginTop: 6,
  },
  tabLabelActive: {
    color: theme.colors.primary[400],
    fontFamily: theme.typography.fontFamily.semiBold,
  },
  activeBar: {
    width: 24,
    height: 3,
    borderRadius: 2,
    backgroundColor: theme.colors.primary[400],
    marginTop: 4,
  },
});
