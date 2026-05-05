import { View, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { ob } from '../../constants/onboardingTheme'

export function PermissionCameraVisual() {
  return (
    <View style={styles.root} accessibilityLabel="Camera access illustration">
      <LinearGradient
        colors={['rgba(14, 165, 233, 0.15)', 'rgba(22, 217, 122, 0.2)']}
        style={styles.ring}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.inner}>
          <Ionicons name="scan-outline" size={56} color={ob.ink} style={{ opacity: 0.85 }} />
          <View style={styles.cornerTL} />
          <View style={styles.cornerTR} />
          <View style={styles.cornerBL} />
          <View style={styles.cornerBR} />
        </View>
      </LinearGradient>
    </View>
  )
}

const corner = {
  position: 'absolute' as const,
  width: 22,
  height: 22,
  borderColor: ob.cta,
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    marginVertical: 24,
  },
  ring: {
    width: 168,
    height: 168,
    borderRadius: 36,
    padding: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inner: {
    width: '100%',
    height: '100%',
    borderRadius: 33,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: ob.border,
  },
  cornerTL: {
    ...corner,
    top: 18,
    left: 18,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 8,
  },
  cornerTR: {
    ...corner,
    top: 18,
    right: 18,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 8,
  },
  cornerBL: {
    ...corner,
    bottom: 18,
    left: 18,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 8,
  },
  cornerBR: {
    ...corner,
    bottom: 18,
    right: 18,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 8,
  },
})
