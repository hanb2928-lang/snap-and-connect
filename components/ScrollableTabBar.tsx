import { useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type {
  BottomTabBarProps,
} from '@react-navigation/bottom-tabs';
import { theme } from '@/lib/theme';
import { Camera, Settings, FolderOpen, ChartBar as BarChart3, ShoppingBag, BookMarked, type LucideIcon } from 'lucide-react-native';

const TAB_ICONS: Record<string, LucideIcon> = {
  index: Camera,
  affiliate: ShoppingBag,
  assets: FolderOpen,
  analytics: BarChart3,
  guide: BookMarked,
  settings: Settings,
};

const TAB_LABELS: Record<string, string> = {
  index: '카메라',
  affiliate: '제휴쇼핑',
  assets: '제작물',
  analytics: '분석',
  guide: '사용설명서',
  settings: '설정',
};

const TAB_WIDTH = 72;
const HIT_SLOP = { top: 8, bottom: 8, left: 4, right: 4 };

export type TabBadgeMap = Record<string, boolean>;

export function ScrollableTabBar({ state, navigation, badges }: BottomTabBarProps & { badges?: TabBadgeMap }) {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const activeIndex = state.index;

  useEffect(() => {
    scrollRef.current?.scrollTo({
      x: Math.max(0, activeIndex * TAB_WIDTH - TAB_WIDTH * 1.5),
      animated: true,
    });
  }, [activeIndex]);

  const bottomPadding = Math.max(insets.bottom, 0);

  return (
    <View style={[styles.container, { paddingBottom: 8 + bottomPadding }]}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;
          const Icon = TAB_ICONS[route.name] || Settings;
          const label = TAB_LABELS[route.name] || route.name;
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
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.dark.surface,
    borderTopColor: theme.colors.dark.border,
    borderTopWidth: 1,
    paddingTop: 10,
  },
  scrollContent: {
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  tabItem: {
    width: TAB_WIDTH,
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
    maxWidth: TAB_WIDTH - 2,
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
