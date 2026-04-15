import { View, StyleSheet, Pressable } from 'react-native'
import { Tabs, router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { colors, spacing, typography } from '../../constants/theme'
import { useScanHistoryStore } from '../../store/scanHistoryStore'
import { FillrHeaderLogo } from '../../components'

const LIGHT_GREEN = colors.backgroundLightGreen

const tabIcons: Record<string, { active: keyof typeof Ionicons.glyphMap; inactive: keyof typeof Ionicons.glyphMap }> = {
  index: { active: 'home', inactive: 'home-outline' },
  scan: { active: 'camera', inactive: 'camera-outline' },
  history: { active: 'time', inactive: 'time-outline' },
  overview: { active: 'bar-chart', inactive: 'bar-chart-outline' },
  profile: { active: 'person', inactive: 'person-outline' },
}

function HistorySavedHeaderButton() {
  const savedCount = useScanHistoryStore((s) => s.savedProductIds.length)
  return (
    <Pressable
      onPress={() => router.push('/saved')}
      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      style={historyHeaderBtn.wrap}
      accessibilityRole="button"
      accessibilityLabel="Saved products"
    >
      <Ionicons
        name={savedCount > 0 ? 'heart' : 'heart-outline'}
        size={24}
        color={savedCount > 0 ? colors.accent : colors.text}
      />
    </Pressable>
  )
}

const historyHeaderBtn = StyleSheet.create({
  wrap: {
    marginRight: spacing.md,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
})

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerTitle: () => <FillrHeaderLogo />,
        headerTitleAlign: 'left',
        headerStyle: {
          backgroundColor: LIGHT_GREEN,
          shadowColor: 'transparent',
          elevation: 0,
        },
        headerTransparent: false,
        headerShadowVisible: false,
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: LIGHT_GREEN,
          borderTopWidth: 0,
          elevation: 0,
          shadowColor: 'transparent',
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: {
          ...typography.labelSmall,
          fontSize: 11,
          fontWeight: '600',
        },
        tabBarItemStyle: { paddingTop: 10 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons
              name={focused ? tabIcons.index.active : tabIcons.index.inactive}
              size={size ?? 24}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          headerRight: () => <HistorySavedHeaderButton />,
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons
              name={focused ? tabIcons.history.active : tabIcons.history.inactive}
              size={size ?? 24}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: 'Scan',
          headerTransparent: true,
          headerStyle: { backgroundColor: 'transparent', shadowColor: 'transparent', elevation: 0 },
          headerTitleStyle: {
            fontSize: 22,
            fontWeight: '700',
            color: '#ffffff',
            letterSpacing: -0.5,
          },
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons
              name={focused ? tabIcons.scan.active : tabIcons.scan.inactive}
              size={size ?? 24}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="overview"
        options={{
          title: 'Overview',
          headerShown: false,
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons
              name={focused ? tabIcons.overview.active : tabIcons.overview.inactive}
              size={size ?? 24}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons
              name={focused ? tabIcons.profile.active : tabIcons.profile.inactive}
              size={size ?? 24}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  )
}
