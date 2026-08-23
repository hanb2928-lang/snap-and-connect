import { Tabs } from 'expo-router';
import { ScrollableTabBar } from '@/components/ScrollableTabBar';

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <ScrollableTabBar {...props} />}
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
