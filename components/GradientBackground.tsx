import { View, StyleSheet } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { colors } from '../constants/theme'

/** Scan / light screens — matches product results polish */
const MINIMAL_MINT = '#f8fdf9'
const LIGHT_GREEN = colors.backgroundLightGreen

/** Home tab — aligned with tab header (`backgroundLightGreen`) so header + body read as one surface */
const HOME_GRADIENT = [
  colors.backgroundLightGreen,
  '#f4fdf7',
  '#f2faf8',
  '#f8fdf9',
] as const

interface GradientBackgroundProps {
  children: React.ReactNode
  variant?: 'default' | 'welcome' | 'minimal' | 'home' | 'homePremium'
}

export function GradientBackground({ children, variant = 'default' }: GradientBackgroundProps) {
  if (variant === 'home') {
    return (
      <View style={styles.container}>
        <LinearGradient colors={[...HOME_GRADIENT]} locations={[0, 0.35, 0.65, 1]} style={StyleSheet.absoluteFill} />
        {children}
      </View>
    )
  }

  if (variant === 'homePremium') {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={['#0f1419', '#131a21', '#0f1419']}
          locations={[0, 0.5, 1]}
          style={StyleSheet.absoluteFill}
        />
        {children}
      </View>
    )
  }

  const bg = variant === 'minimal' ? MINIMAL_MINT : LIGHT_GREEN
  return (
    <View style={styles.container}>
      {/* Ensure the decorative background never blocks touches */}
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: bg }]} />
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
})
