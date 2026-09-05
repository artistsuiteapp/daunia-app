import { Tabs } from 'expo-router';

import { FloatingTabBar } from '../../components/FloatingTabBar';

/**
 * Le schede usano una barra propria, galleggiante e arrotondata: quella di
 * sistema resta ancorata al bordo e non si puo staccare.
 */
export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="matches" options={{ title: 'Partite' }} />
      <Tabs.Screen name="squad" options={{ title: 'Rosa' }} />
      <Tabs.Screen name="stadium" options={{ title: 'Stadio' }} />
      <Tabs.Screen name="shop" options={{ title: 'Store' }} />
      <Tabs.Screen name="news" options={{ title: 'News' }} />
    </Tabs>
  );
}
