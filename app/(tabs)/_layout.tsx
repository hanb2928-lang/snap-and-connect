import { useState, useEffect, lazy, Suspense } from 'react';
import { Platform, View } from 'react-native';
import { Tabs } from 'expo-router';
import type { TabBadgeMap } from '@/components/ScrollableTabBar';

const ScrollableTabBar = lazy(() =>
  import('@/components/ScrollableTabBar').then((m) => ({ default: m.ScrollableTabBar })),
);

export default function TabLayout() {
  const [badges, setBadges] = useState<TabBadgeMap>({});

  useEffect(() => {
    let cancelled = false;
    const checkBadges = async () => {
      try {
        const { fetchActiveSchedules } = await import('@/lib/warmup');
        const schedules = await fetchActiveSchedules();
        const hasPending = schedules.some((s) =>
          s.tasks.some((t) => t.status === 'pending')
        );
        if (!cancelled) {
          setBadges({ marketing: hasPending });
        }
      } catch {
        if (!cancelled) setBadges({});
      }
    };
    const timeoutId = setTimeout(checkBadges, 2000);
    const interval = setInterval(checkBadges, 60000);
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
      clearInterval(interval);
    };
  }, []);

  const screenOptions = Platform.select({
    ios: {
      headerShown: false,
      tabBarShowLabel: false,
      animation: 'fade' as const,
      transitionSpec: {
        animation: 'timing' as const,
        config: { duration: 200 },
      },
    },
    default: {
      headerShown: false,
      animation: 'none' as const,
    },
  });

  return (
    <Tabs
      initialRouteName="index"
      tabBar={(props) => (
        <Suspense fallback={<View style={{ height: 0 }} />}>
          <ScrollableTabBar {...props} badges={badges} />
        </Suspense>
      )}
      screenOptions={screenOptions}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="marketing" />
      <Tabs.Screen name="assets" />
      {/* Hidden tabs — kept in route config but not shown in tab bar */}
      <Tabs.Screen name="analytics" options={{ href: null }} />
      <Tabs.Screen name="affiliate" options={{ href: null }} />
    </Tabs>
  );
}
