import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Pressable,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type {
  BottomTabBarProps,
} from '@react-navigation/bottom-tabs';
import { theme } from '@/lib/theme';
import { useI18n } from '@/hooks/useI18n';
import {
  Camera,
  Folder,
  Zap,
  BookMarked,
  Settings,
  MoreHorizontal,
  type LucideIcon,
} from 'lucide-react-native';

const TAB_ICONS: Record<string, LucideIcon> = {
  index: Camera,
  marketing: Zap,
  assets: Folder,
};

const TAB_KEYS: Record<string, string> = {
  index: 'tab.camera',
  marketing: 'tab.create',
  assets: 'tab.library',
};

const TAB_WIDTH = 76;
const HIT_SLOP = { top: 8, bottom: 8, left: 4, right: 4 };

export type TabBadgeMap = Record<string, boolean>;

const MORE_ITEMS = [
  { key: 'guide', labelKey: 'tab.guide', icon: BookMarked, color: theme.colors.primary[400] },
  { key: 'settings', labelKey: 'tab.settings', icon: Settings, color: theme.colors.accent[400] },
];

export function ScrollableTabBar({ state, navigation, badges }: BottomTabBarProps & { badges?: TabBadgeMap }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useI18n();
  const [moreOpen, setMoreOpen] = useState(false);
  const [popupScale] = useState(new Animated.Value(0));

  const bottomPadding = Math.max(insets.bottom, 0);
  const tabBarTotalHeight = 94 + bottomPadding;

  useEffect(() => {
    if (moreOpen) {
      Animated.spring(popupScale, {
        toValue: 1,
        useNativeDriver: true,
        friction: 8,
        tension: 80,
      }).start();
    } else {
      popupScale.setValue(0);
    }
  }, [moreOpen, popupScale]);

  const handleMoreItem = (key: string) => {
    setMoreOpen(false);
    setTimeout(() => router.push(`/${key}` as never), 100);
  };

  return (
    <>
      <View style={[styles.container, { paddingBottom: 8 + bottomPadding, minHeight: 62 + bottomPadding }]}>
        <View style={styles.tabRow}>
          {state.routes
            .filter((route) => TAB_ICONS[route.name] !== undefined)
            .map((route) => {
            const isFocused = state.index === state.routes.findIndex((r) => r.name === route.name);
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

          {/* 더보기 버튼 */}
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => setMoreOpen(true)}
            activeOpacity={0.6}
            hitSlop={HIT_SLOP}
            style={styles.tabItem}
          >
            <View style={[styles.iconWrap, moreOpen && styles.iconWrapActive]}>
              <MoreHorizontal
                size={26}
                color={moreOpen ? theme.colors.primary[400] : theme.colors.dark.textDim}
                strokeWidth={moreOpen ? 2.5 : 2.2}
                fill={moreOpen ? theme.colors.primary[400] + '3C' : 'transparent'}
              />
            </View>
            <Text style={[styles.tabLabel, moreOpen && styles.tabLabelActive]} numberOfLines={1}>
              {t('tab.more', 'More')}
            </Text>
            {moreOpen && <View style={styles.activeBar} />}
          </TouchableOpacity>
        </View>
      </View>

      {/* 더보기 팝업 */}
      <Modal visible={moreOpen} transparent animationType="none" onRequestClose={() => setMoreOpen(false)}>
        <Pressable style={styles.popupOverlay} onPress={() => setMoreOpen(false)}>
          <Animated.View
            style={[
              styles.popupCard,
              {
                transform: [{ scale: popupScale }],
                marginBottom: tabBarTotalHeight + 8,
              },
            ]}
          >
            <View style={styles.popupArrow} />
            <Text style={styles.popupTitle}>{t('tab.more', 'More')}</Text>
            {MORE_ITEMS.map((item) => {
              const ItemIcon = item.icon;
              const itemLabel = t(item.labelKey, item.key);
              return (
                <TouchableOpacity
                  key={item.key}
                  style={styles.popupItem}
                  onPress={() => handleMoreItem(item.key)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.popupItemIcon, { backgroundColor: item.color + '20' }]}>
                    <ItemIcon size={22} color={item.color} strokeWidth={2} />
                  </View>
                  <Text style={styles.popupItemLabel}>{itemLabel}</Text>
                </TouchableOpacity>
              );
            })}
          </Animated.View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.dark.surface,
    borderTopColor: theme.colors.dark.border,
    borderTopWidth: 1,
    paddingTop: 10,
  },
  tabRow: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    paddingHorizontal: 4,
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
  popupOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  popupCard: {
    backgroundColor: theme.colors.dark.surface,
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 12,
    width: 200,
    borderWidth: 1,
    borderColor: theme.colors.dark.border,
  },
  popupArrow: {
    position: 'absolute',
    bottom: -8,
    right: 24,
    width: 16,
    height: 16,
    backgroundColor: theme.colors.dark.surface,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: theme.colors.dark.border,
    transform: [{ rotate: '45deg' }],
  },
  popupTitle: {
    fontSize: 12,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.textFaint,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
    textAlign: 'center',
  },
  popupItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  popupItemIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  popupItemLabel: {
    fontSize: 15,
    fontFamily: theme.typography.fontFamily.semiBold,
    color: theme.colors.dark.text,
  },
});
