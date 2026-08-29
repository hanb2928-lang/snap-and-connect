import { useState, useEffect } from 'react';
import { Platform } from 'react-native';
import { Tabs } from 'expo-router';
import { ScrollableTabBar, type TabBadgeMap } from '@/components/ScrollableTabBar';
import { fetchActiveSchedules } from '@/lib/warmup';

export default function TabLayout() {
  const [badges, setBadges] = useState<TabBadgeMap>({});

  useEffect(() => {
    let cancelled = false;
    const checkBadges = async () => {
      try {
        const schedules = await fetchActiveSchedules();
        const hasPending = schedules.some((s) =>
          s.tasks.some((t) => t.status === 'pending')
        );
        if (!cancelled) {
          setBadges({ affiliate: hasPending });
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
      tabBar={(props) => <ScrollableTabBar {...props} badges={badges} />}
      screenOptions={screenOptions}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="affiliate" />
      <Tabs.Screen name="marketing" />
      <Tabs.Screen name="assets" />
      <Tabs.Screen name="analytics" />
    </Tabs>
  );
}
