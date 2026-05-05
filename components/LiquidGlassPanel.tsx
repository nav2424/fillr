import { View, StyleSheet, Platform } from 'react-native'
import { BlurView } from 'expo-blur'
import { LinearGradient } from 'expo-linear-gradient'

export type LiquidGlassPadding = number | { horizontal: number; vertical: number }

/**
 * Shared “liquid glass” stack (blur, gradients, rim, depth) used on Home and Overview.
 */
export function LiquidGlassPanel({
  children,
  borderRadius = 20,
  padding = 12,
  shadowMuted = false,
  innerMuted = false,
  style,
  minHeight,
}: {
  children: React.ReactNode
  borderRadius?: number
  padding?: LiquidGlassPadding
  shadowMuted?: boolean
  innerMuted?: boolean
  style?: object
  minHeight?: number
}) {
  const padStyle =
    typeof padding === 'number'
      ? { padding }
      : { paddingHorizontal: padding.horizontal, paddingVertical: padding.vertical }
  const rimInset = typeof padding === 'number' ? padding : padding.horizontal

  return (
    <View
      style={[
        styles.shadowHost,
        { borderRadius },
        shadowMuted && styles.shadowHostMuted,
        style,
      ]}
    >
      <View
        style={[
          styles.inner,
          { borderRadius },
          innerMuted && styles.innerMuted,
          padStyle,
          minHeight != null ? { minHeight } : null,
        ]}
      >
        {Platform.OS === 'web' ? (
          <View style={[styles.blur, styles.webFallback]} pointerEvents="none" />
        ) : (
          <BlurView
            intensity={innerMuted ? 36 : Platform.OS === 'ios' ? 50 : 58}
            tint="light"
            style={styles.blur}
            pointerEvents="none"
          />
        )}
        <LinearGradient
          pointerEvents="none"
          colors={[
            'rgba(255,255,255,0.72)',
            'rgba(255,255,255,0.14)',
            'rgba(255,255,255,0.28)',
          ]}
          locations={[0, 0.42, 1]}
          start={{ x: 0.08, y: 0 }}
          end={{ x: 0.92, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(255,255,255,0.55)', 'rgba(255,255,255,0)', 'rgba(255,255,255,0)']}
          locations={[0, 0.55, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.85, y: 0.55 }}
          style={styles.sheen}
        />
        <View style={[styles.topRim, { left: rimInset, right: rimInset }]} pointerEvents="none" />
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(220,252,231,0.35)', 'rgba(255,255,255,0)', 'rgba(187,247,208,0.2)']}
          start={{ x: 0, y: 1 }}
          end={{ x: 1, y: 0 }}
          style={styles.liquidWash}
        />
        <View style={styles.tint} pointerEvents="none" />
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(10,40,24,0)', 'rgba(10,40,24,0.03)', 'rgba(10,40,24,0.09)']}
          locations={[0, 0.55, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.innerDepth}
        />
        <View style={styles.content}>{children}</View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  shadowHost: {
    borderRadius: 20,
    backgroundColor: 'transparent',
    shadowColor: '#0a2810',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.14,
    shadowRadius: 26,
    elevation: 12,
  },
  shadowHostMuted: {
    shadowOpacity: 0.07,
    shadowRadius: 18,
    elevation: 6,
  },
  inner: {
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.88)',
  },
  innerMuted: {
    borderColor: 'rgba(255,255,255,0.55)',
  },
  innerDepth: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  blur: {
    ...StyleSheet.absoluteFillObject,
  },
  webFallback: {
    backgroundColor: 'rgba(255,255,255,0.26)',
  },
  sheen: {
    ...StyleSheet.absoluteFillObject,
  },
  liquidWash: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.85,
  },
  topRim: {
    position: 'absolute',
    top: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.95)',
    opacity: 0.92,
    zIndex: 2,
  },
  tint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  content: {
    position: 'relative',
    zIndex: 3,
  },
})
