import { useEffect, useRef } from 'react'
import { View, Text, StyleSheet, Animated, Easing } from 'react-native'
import type { FillrFitSnapshot } from '../types'

export type FillrFitCardProps = {
  fillrFit: FillrFitSnapshot | null
  isLoading?: boolean
}

function EditorialSkeleton() {
  const o = useRef(new Animated.Value(0.4)).current
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(o, { toValue: 0.75, duration: 700, useNativeDriver: true }),
        Animated.timing(o, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    )
    loop.start()
    return () => loop.stop()
  }, [o])
  return (
    <View style={styles.editorialRoot} accessibilityLabel="Loading Fillr Fit score">
      <View style={styles.scoreTopRow}>
        <Animated.View style={[styles.skelBar, { width: 88, height: 44, opacity: o }]} />
        <Animated.View style={[styles.skelBar, { width: 120, height: 40, opacity: o }]} />
      </View>
      <Animated.View style={[styles.skelBar, { width: '100%', height: 3, marginTop: 8, opacity: o }]} />
      <Animated.View style={[styles.skelBar, { width: '90%', height: 14, marginTop: 8, opacity: o }]} />
    </View>
  )
}

export function FillrFitCard({ fillrFit, isLoading }: FillrFitCardProps) {
  const progressAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (!fillrFit) {
      progressAnim.setValue(0)
      return
    }
    progressAnim.setValue(0)
    Animated.timing(progressAnim, {
      toValue: fillrFit.score,
      duration: 900,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start()
  }, [fillrFit, progressAnim])

  if (isLoading) {
    return <EditorialSkeleton />
  }

  if (!fillrFit) {
    return null
  }

  let reasonDisplay = fillrFit.reason
  if (fillrFit.tier === 1) reasonDisplay = `⚠ ${reasonDisplay}`
  else if (fillrFit.tier === 2) reasonDisplay = `~ ${reasonDisplay}`

  const barWidth = progressAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  })

  const vc = fillrFit.verdictColor

  return (
    <View
      style={styles.editorialRoot}
      accessibilityLabel={`Your Fillr Fit ${fillrFit.score} out of 100. ${fillrFit.verdict}. ${fillrFit.reason}`}
    >
      <View style={styles.scoreTopRow}>
        <View style={styles.scoreLeftCluster}>
          <View style={styles.scoreNumRow}>
            <Text style={[styles.scoreHuge, { color: vc }]}>{fillrFit.score}</Text>
            <Text style={styles.scoreSlash}>/100</Text>
          </View>
        </View>
        <View style={styles.scoreRightCluster}>
          <Text style={styles.fitKicker}>Your Fillr Fit</Text>
          <Text style={[styles.fitVerdict, { color: vc }]}>{fillrFit.verdict}</Text>
        </View>
      </View>

      <View style={styles.progressTrack}>
        <Animated.View
          style={[styles.progressFill, { width: barWidth, backgroundColor: fillrFit.progressColor }]}
        />
      </View>

      <Text style={styles.reasonText}>{reasonDisplay}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  editorialRoot: {
    marginBottom: 0,
  },
  scoreTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  scoreLeftCluster: {
    flexShrink: 0,
  },
  scoreNumRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  scoreHuge: {
    fontSize: 44,
    fontWeight: '900',
    lineHeight: 44,
    letterSpacing: -2.2,
  },
  scoreSlash: {
    fontSize: 14,
    fontWeight: '500',
    color: '#9ca3af',
    paddingBottom: 6,
    marginLeft: 2,
  },
  scoreRightCluster: {
    alignItems: 'flex-end',
    paddingBottom: 6,
  },
  fitKicker: {
    fontSize: 11,
    fontWeight: '500',
    color: '#9ca3af',
    marginBottom: 2,
  },
  fitVerdict: {
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'right',
  },
  progressTrack: {
    marginTop: 8,
    height: 3,
    borderRadius: 100,
    backgroundColor: 'rgba(0,0,0,0.07)',
    overflow: 'hidden',
  },
  progressFill: {
    height: 3,
    borderRadius: 100,
  },
  reasonText: {
    marginTop: 8,
    marginBottom: 20,
    fontSize: 12,
    color: '#9ca3af',
    lineHeight: 16.8,
  },
  skelBar: {
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
  },
})
