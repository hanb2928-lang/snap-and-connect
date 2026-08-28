import { View, StyleSheet, TouchableOpacity, Text, ScrollView, Platform } from 'react-native';
import { Stack, useRouter, usePathname } from 'expo-router';
import { useEffect, useRef } from 'react';
import { ShoppingBag, Flame, History, Sprout } from 'lucide-react-native';
import { theme } from '@/lib/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const SUBTABS = [
  { key: 'index', label: '제휴', icon: ShoppingBag },
  { key: 'trending', label: '인기', icon: Flame },
  { key: 'history', label: '기록', icon: History },
  { key: 'warmup', label: '육성', icon: Sprout },
] as const;

function SubTabBar() {
  const router = useRouter();
  const pathname = usePathname();
  const scrollRef = useRef<ScrollView>(null);
  const insets = useSafeAreaInsets();

  const currentSegment = pathname.split('/').pop() || 'index';
  const activeKey = currentSegment === 'affiliate' ? 'index' : currentSegment;

  useEffect(() => {
    const activeIndex = SUBTABS.findIndex((t) => t.key === activeKey);
    if (activeIndex >= 0 && scrollRef.current) {
      scrollRef.current.scrollTo({ x: Math.max(0, activeIndex * 72 - 72), animated: true });
    }
  }, [activeKey]);

  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 0) }]}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {SUBTABS.map(({ key, label, icon: Icon }) => {
          const isActive = activeKey === key;
          return (
            <TouchableOpacity
              key={key}
              style={styles.tabItem}
              onPress={() => {
                if (key === 'index') {
                  router.push('/affiliate');
                } else {
                  router.push(`/affiliate/${key}`);
                }
              }}
              activeOpacity={0.6}
            >
              <View style={[styles.iconWrap, isActive && styles.iconWrapActive]}>
                <Icon
                  size={18}
                  color={isActive ? theme.colors.primary[400] : theme.colors.dark.textDim}
                  strokeWidth={isActive ? 2.5 : 2.2}
                  fill={isActive ? theme.colors.primary[400] + '3C' : 'transparent'}
                />
              </View>
              <Text
                style={[styles.tabLabel, isActive && styles.tabLabelActive]}
                numberOfLines={1}
              >
                {label}
              </Text>
              {isActive && <View style={styles.activeBar} />}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

export default function AffiliateLayout() {
  return (
    <>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: Platform.select({ ios: 'fade', default: 'none' }),
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="trending" />
        <Stack.Screen name="history" />
        <Stack.Screen name="warmup" />
      </Stack>
      <SubTabBar />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.dark.surface,
    borderTopColor: theme.colors.dark.border,
    borderTopWidth: 1,
    paddingTop: 8,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 100,
  },
  scrollContent: {
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  tabItem: {
    width: 72,
    alignItems: 'center',
    paddingVertical: 4,
  },
  iconWrap: {
    width: 40,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: theme.radius.full,
  },
  iconWrapActive: {
    backgroundColor: theme.colors.primary[500] + '2E',
  },
  tabLabel: {
    fontSize: 10,
    fontFamily: theme.typography.fontFamily.medium,
    color: theme.colors.dark.textFaint,
    marginTop: 4,
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
