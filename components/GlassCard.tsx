import { Platform, View, StyleSheet, StyleProp, ViewStyle } from 'react-native'
import { BlurView } from 'expo-blur'
import { colors, spacing, radius } from '../constants/theme'

export type GlassCardVariant = 'liquid' | 'light'

interface GlassCardProps {
  children: React.ReactNode
  style?: StyleProp<ViewStyle>
  /** Inner padding area (liquid variant only) */
  contentStyle?: StyleProp<ViewStyle>
  /** Kept for API compatibility; light cards no longer use native blur. */
  intensity?: number
  variant?: GlassCardVariant
}

export function GlassCard({
  children,
  style,
  contentStyle,
  intensity: _intensity = 60,
  variant = 'light',
}: GlassCardProps) {
  if (variant === 'liquid') {
    const cardStyle = [styles.liquidShell, style]
    return (
      <View style={cardStyle}>
        {Platform.OS === 'web' ? (
          <View style={[StyleSheet.absoluteFillObject, styles.liquidWebFallback]} pointerEvents="none" />
        ) : (
          <BlurView
            intensity={20}
            tint="light"
            style={StyleSheet.absoluteFillObject}
            pointerEvents="none"
          />
        )}
        <View style={[StyleSheet.absoluteFillObject, styles.liquidTint]} pointerEvents="none" />
        <View style={styles.liquidTopHighlight} pointerEvents="none" />
        <View style={[styles.liquidContent, contentStyle]}>{children}</View>
      </View>
    )
  }

  // Solid frosted panel — native BlurView breaks TextInput focus/hits on some RN + iOS builds.
  const cardStyle = [styles.cardLight, styles.cardLightSolid, style]
  return <View style={cardStyle}>{children}</View>
}

const styles = StyleSheet.create({
  liquidShell: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 10,
  },
  liquidWebFallback: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  liquidTint: {
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
  },
  liquidTopHighlight: {
    position: 'absolute',
    top: 0,
    left: 16,
    right: 16,
    height: 1,
    borderRadius: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    zIndex: 1,
  },
  liquidContent: {
    position: 'relative',
    zIndex: 2,
  },
  cardLight: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 6,
  },
  cardLightSolid: {
    backgroundColor: colors.backgroundCard,
  },
  fallback: {
    backgroundColor: colors.backgroundCard,
  },
})
