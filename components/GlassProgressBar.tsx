import { Platform, View, StyleSheet } from 'react-native'
import { BlurView } from 'expo-blur'
import { colors, spacing, radius } from '../constants/theme'

interface GlassProgressBarProps {
  total: number
  current: number
}

export function GlassProgressBar({ total, current }: GlassProgressBarProps) {
  const progress = ((current + 1) / total) * 100

  const trackContent = (
    <View style={styles.trackInner}>
      <View style={[styles.fill, { width: `${progress}%` }]} />
    </View>
  )

  return (
    <View style={styles.container}>
      <View style={styles.trackWrapper}>
        {Platform.OS === 'web' ? (
          <View style={[styles.trackInner, styles.trackFallback]}>
            <View style={[styles.fill, { width: `${progress}%` }]} />
          </View>
        ) : (
          <BlurView intensity={50} tint="light" style={styles.trackBlur}>
            <View style={styles.trackInner}>
              <View style={[styles.fill, { width: `${progress}%` }]} />
            </View>
          </BlurView>
        )}
      </View>
      <View style={styles.dots}>
        {Array.from({ length: total }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              i === current && styles.dotActive,
              i < current && styles.dotCompleted,
            ]}
          />
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.xl,
  },
  trackWrapper: {
    borderRadius: radius.full,
    overflow: 'hidden',
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  trackBlur: {
    height: 8,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  trackInner: {
    height: 8,
    borderRadius: radius.full,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  trackFallback: {
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  fill: {
    height: '100%',
    backgroundColor: colors.accent,
    borderRadius: radius.full,
  },
  dots: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(0,0,0,0.08)',
  },
  dotActive: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.accent,
  },
  dotCompleted: {
    backgroundColor: colors.accent,
  },
})
