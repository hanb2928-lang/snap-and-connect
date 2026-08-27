import { useState, useEffect } from 'react';
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
          setBadges({ warmup: hasPending });
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

  return (
    <Tabs
      tabBar={(props) => <ScrollableTabBar {...props} badges={badges} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="trending" />
      <Tabs.Screen name="history" />
      <Tabs.Screen name="assets" />
      <Tabs.Screen name="analytics" />
      <Tabs.Screen name="warmup" />
      <Tabs.Screen name="settings" />
    </Tabs>
  );
}
