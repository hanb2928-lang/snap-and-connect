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
import { Camera, Settings, FolderOpen, BarChart3, Flame, History, Sprout, type LucideIcon } from 'lucide-react-native';

const TAB_ICONS: Record<string, LucideIcon> = {
  index: Camera,
  trending: Flame,
  history: History,
  assets: FolderOpen,
  analytics: BarChart3,
  warmup: Sprout,
  settings: Settings,
};

const TAB_LABELS: Record<string, string> = {
  index: '카메라',
  trending: '인기',
  history: '기록',
  assets: '제작물',
  analytics: '분석',
  warmup: '육성',
  settings: '설정',
};

const TAB_WIDTH = 64;

export function ScrollableTabBar({ state, navigation }: BottomTabBarProps) {
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
    <View style={[styles.container, { paddingBottom: 6 + bottomPadding }]}>
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
              activeOpacity={0.7}
              style={styles.tabItem}
            >
              <View style={[styles.iconWrap, isFocused && styles.iconWrapActive]}>
                <Icon
                  size={22}
                  color={isFocused ? theme.colors.primary[400] : theme.colors.dark.textFaint}
                  strokeWidth={2}
                />
              </View>
              <Text
                style={[
                  styles.tabLabel,
                  isFocused && styles.tabLabelActive,
                ]}
                numberOfLines={1}
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
    paddingTop: 6,
  },
  scrollContent: {
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  tabItem: {
    width: TAB_WIDTH,
    alignItems: 'center',
    paddingVertical: 4,
  },
  iconWrap: {
    width: 38,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: theme.radius.md,
  },
  iconWrapActive: {
    backgroundColor: theme.colors.primary[500] + '18',
  },
  tabLabel: {
    fontSize: 9,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.textFaint,
    marginTop: 2,
  },
  tabLabelActive: {
    color: theme.colors.primary[400],
    fontFamily: theme.typography.fontFamily.semiBold,
  },
  activeBar: {
    width: 20,
    height: 3,
    borderRadius: 2,
    backgroundColor: theme.colors.primary[400],
    marginTop: 3,
  },
});
