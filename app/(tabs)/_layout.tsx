import { View, StyleSheet, Pressable } from 'react-native'
import { Tabs, router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { colors, homeWordmarkLayout } from '../../constants/theme'
import { useScanHistoryStore } from '../../store/scanHistoryStore'
import { FillrHeaderLogo, ScanTabBarIcon } from '../../components'
import {
  DEFAULT_TAB_BAR_ITEM_STYLE,
  DEFAULT_TAB_BAR_LABEL_STYLE,
  DEFAULT_TAB_BAR_STYLE,
} from '../../constants/tabBarOptions'

const LIGHT_GREEN = colors.backgroundLightGreen

const tabIcons: Record<string, { active: keyof typeof Ionicons.glyphMap; inactive: keyof typeof Ionicons.glyphMap }> = {
  index: { active: 'home', inactive: 'home-outline' },
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
        color={savedCount > 0 ? colors.accent : '#0f172a'}
      />
    </Pressable>
  )
}

const historyHeaderBtn = StyleSheet.create({
  wrap: {
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
})

export default function TabLayout() {
  const insets = useSafeAreaInsets()

  return (
    <Tabs
      screenOptions={({ route }) => {
        const isScan = route.name === 'scan'
        const whiteHeader = route.name === 'history' || route.name === 'overview' || route.name === 'profile'
        return {
        headerShown: route.name !== 'index',
        headerShadowVisible: false,
        headerBackVisible: false,
        headerTitle: '',
        headerTitleAlign: 'left',
        headerTransparent: isScan,
        headerStyle: {
          backgroundColor: isScan ? 'transparent' : whiteHeader ? '#ffffff' : LIGHT_GREEN,
          shadowColor: 'transparent',
          elevation: 0,
        },
        headerTintColor: isScan ? '#ffffff' : '#0f172a',
        headerLeftContainerStyle: {
          paddingLeft: homeWordmarkLayout.horizontalPad,
        },
        headerRightContainerStyle: {
          paddingRight: homeWordmarkLayout.horizontalPad,
        },
        headerLeft: () => <FillrHeaderLogo variant={isScan ? 'onDark' : 'default'} />,
        sceneStyle: {
          backgroundColor:
            route.name === 'scan'
              ? '#000000'
              : route.name === 'index' ||
                  route.name === 'history' ||
                  route.name === 'profile' ||
                  route.name === 'overview'
                ? '#ffffff'
                : LIGHT_GREEN,
        },
        tabBarStyle: {
          ...DEFAULT_TAB_BAR_STYLE,
          marginHorizontal: Math.max(20, insets.left, insets.right),
          marginBottom: 4 + insets.bottom,
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: '#64748b',
        tabBarLabelStyle: DEFAULT_TAB_BAR_LABEL_STYLE,
        tabBarItemStyle: DEFAULT_TAB_BAR_ITEM_STYLE,
        }
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          headerShown: false,
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
          tabBarLabel: () => null,
          tabBarAccessibilityLabel: 'Scan',
          headerTransparent: true,
          headerStyle: { backgroundColor: 'transparent', shadowColor: 'transparent', elevation: 0 },
          headerTitleStyle: {
            fontSize: 22,
            fontWeight: '700',
            color: '#ffffff',
            letterSpacing: -0.5,
          },
          tabBarIcon: ({ focused }) => <ScanTabBarIcon focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="overview"
        options={{
          title: 'Overview',
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
