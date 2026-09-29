import { Tabs } from 'expo-router';
import { BarChart3, CalendarDays, FileDown, NotebookPen, Settings } from 'lucide-react-native';
import { useTheme } from '@/theme';

export default function TabsLayout() {
  const t = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: t.brand,
        tabBarInactiveTintColor: t.muted,
        tabBarStyle: { backgroundColor: t.surface, borderTopColor: t.line },
        sceneStyle: { backgroundColor: t.bg },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Сьогодні', tabBarIcon: ({ color, size }) => <NotebookPen color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="schedule"
        options={{ title: 'Розклад', tabBarIcon: ({ color, size }) => <CalendarDays color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="dashboard"
        options={{ title: 'Дашборд', tabBarIcon: ({ color, size }) => <BarChart3 color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="export"
        options={{ title: 'Експорт', tabBarIcon: ({ color, size }) => <FileDown color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: 'Налаштування', tabBarIcon: ({ color, size }) => <Settings color={color} size={size} /> }}
      />
    </Tabs>
  );
}
