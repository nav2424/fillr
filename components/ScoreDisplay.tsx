import { useEffect, useRef } from 'react'
import { View, Text, StyleSheet, Animated, Easing } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import type { FillrFitSnapshot } from '../types'
import { theme } from '../constants/theme'

function scoreNumberColor(score: number): string {
  if (score >= 80) return theme.green500
  if (score >= 60) return theme.green700
  if (score >= 40) return theme.processed.text
  if (score >= 20) return theme.additive.text
  return theme.flagged.text
}

function isUnsafeVerdict(verdict: string): boolean {
  return /unsafe/i.test(verdict.trim())
}

function progressGradient(score: number, verdict: string): readonly [string, string] {
  if (score < 20 || isUnsafeVerdict(verdict)) {
    return ['#ef4444', '#dc2626'] as const
  }
  if (score < 40) {
    return ['#f59e0b', '#d97706'] as const
  }
  return [theme.green700, theme.green500] as const
}

function ScoreSkeleton() {
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
    <View style={styles.scoreLoadingContainer} accessibilityLabel="Analyzing ingredients score">
      <Animated.View style={[styles.scoreLoadingPulse, { opacity: o }]} />
      <Text style={styles.scoreLoadingText}>Analysing ingredients...</Text>
    </View>
  )
}

export type ScoreDisplayProps = {
  fillrFit: FillrFitSnapshot | null
  isLoading?: boolean
}

export function ScoreDisplay({ fillrFit, isLoading }: ScoreDisplayProps) {
  const progressAnim = useRef(new Animated.Value(0)).current
  const [gradLeft, gradRight] = fillrFit
    ? progressGradient(fillrFit.score, fillrFit.verdict)
    : ([theme.green700, theme.green500] as const)

  useEffect(() => {
    if (!fillrFit) {
      progressAnim.setValue(0)
      return
    }
    progressAnim.setValue(0)
    Animated.timing(progressAnim, {
      toValue: Math.min(100, Math.max(0, fillrFit.score)),
      duration: 600,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start()
  }, [fillrFit, progressAnim])

  if (isLoading) {
    return <ScoreSkeleton />
  }

  if (!fillrFit) {
    return null
  }

  const numColor = scoreNumberColor(fillrFit.score)
  const fillWidth = progressAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  })

  return (
    <View
      style={styles.root}
      accessibilityLabel={`Your Fillr Fit ${fillrFit.score} out of 100. ${fillrFit.verdict}. ${fillrFit.reason}`}
    >
      <View style={styles.topRow}>
        <View style={styles.scoreNumWrap}>
          <Text style={[styles.scoreHuge, { color: numColor }]}>{fillrFit.score}</Text>
          <Text style={styles.scoreDenom}>/100</Text>
        </View>
        <View style={styles.verdictCol}>
          <Text style={styles.fitKicker}>YOUR FILLR FIT</Text>
          <Text style={[styles.fitVerdict, { color: numColor }]}>{fillrFit.verdict}</Text>
        </View>
      </View>

      <View style={styles.progressTrack}>
        <Animated.View style={[styles.progressFillWrap, { width: fillWidth }]}>
          <LinearGradient
            colors={[gradLeft, gradRight]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      </View>

      <Text style={styles.reasonText}>{fillrFit.reason}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    paddingVertical: 4,
    paddingBottom: 16,
    minHeight: 120,
  },
  scoreLoadingContainer: {
    minHeight: 120,
    justifyContent: 'center',
    paddingVertical: 8,
  },
  scoreLoadingPulse: {
    width: '100%',
    height: 58,
    borderRadius: 12,
    backgroundColor: '#e5e7eb',
  },
  scoreLoadingText: {
    marginTop: 10,
    fontSize: 12,
    fontWeight: '500',
    color: theme.textFaint,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 8,
  },
  scoreNumWrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
  },
  scoreHuge: {
    fontSize: 42,
    fontWeight: '800',
    letterSpacing: -2,
    lineHeight: 42,
  },
  scoreDenom: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.textFaint,
    paddingBottom: 2,
  },
  verdictCol: {
    alignItems: 'flex-end',
  },
  fitKicker: {
    fontSize: 10,
    fontWeight: '600',
    color: theme.textFaint,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  fitVerdict: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3,
    textAlign: 'right',
  },
  progressTrack: {
    height: 8,
    backgroundColor: theme.greenTrack,
    borderRadius: 100,
    marginBottom: 8,
    overflow: 'hidden',
  },
  progressFillWrap: {
    height: 8,
    borderRadius: 100,
    overflow: 'hidden',
  },
  reasonText: {
    fontSize: 11,
    fontWeight: '500',
    color: theme.textFaint,
    lineHeight: 15,
  },
  skel: {
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
  },
})
