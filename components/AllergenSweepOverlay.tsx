import { useEffect, useRef } from 'react'
import { Animated, Dimensions, Easing, StyleSheet } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'

const BAND = 88

type AllergenSweepOverlayProps = {
  /** New scan / product → new key replays the sweep once. */
  playKey: string
}

/**
 * One-shot horizontal highlight sweep (shimmer) for drawing attention once when
 * an allergen match is present. Renders nothing interactive; parent should clip (overflow: hidden).
 */
export function AllergenSweepOverlay({ playKey }: AllergenSweepOverlayProps) {
  const x = useRef(new Animated.Value(-BAND)).current

  useEffect(() => {
    const screenW = Dimensions.get('window').width
    const travel = screenW + BAND * 2
    x.setValue(-BAND * 1.25)
    Animated.timing(x, {
      toValue: travel,
      duration: 980,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start()
  }, [playKey, x])

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.band, { transform: [{ translateX: x }] }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <LinearGradient
        colors={['transparent', 'rgba(255,255,255,0.62)', 'transparent']}
        locations={[0, 0.5, 1]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={StyleSheet.absoluteFillObject}
      />
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  band: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: BAND,
    zIndex: 6,
  },
})
