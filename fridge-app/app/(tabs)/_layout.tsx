import { Tabs } from "expo-router";
import { Refrigerator, BarChart3, Settings2 } from "lucide-react-native";
import { Platform } from "react-native";
import { colors, fonts } from "@/lib/theme";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: "#8A8478",
        tabBarStyle: {
          backgroundColor: colors.bgBase,
          borderTopColor: "#E5DFD3",
          borderTopWidth: 1,
          height: Platform.OS === "ios" ? 84 : 64,
          paddingBottom: Platform.OS === "ios" ? 28 : 10,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontFamily: fonts.bodyMedium,
          fontSize: 11,
          letterSpacing: 0.2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Fridge",
          tabBarIcon: ({ color, size }) => (
            <Refrigerator color={color} size={size ?? 22} strokeWidth={1.75} />
          ),
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: "Stats",
          tabBarIcon: ({ color, size }) => (
            <BarChart3 color={color} size={size ?? 22} strokeWidth={1.75} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color, size }) => (
            <Settings2 color={color} size={size ?? 22} strokeWidth={1.75} />
          ),
        }}
      />
      {/* Category detail — hide from tab bar, navigated to programmatically */}
      <Tabs.Screen name="category/[name]" options={{ href: null }} />
    </Tabs>
  );
}
