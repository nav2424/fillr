import { Pressable, Text, StyleSheet, ActivityIndicator, View, Platform } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { useFonts, DMSans_700Bold } from '@expo-google-fonts/dm-sans'
import { wa, waButtonGradient } from '../../constants/welcomeAuthTheme'

type Props = {
  title: string
  onPress: () => void
  disabled?: boolean
  loading?: boolean
  /** Match marketing welcome — arrow on primary */
  showArrow?: boolean
}

export function PrimaryButton({ title, onPress, disabled, loading, showArrow }: Props) {
  const [fontsLoaded] = useFonts({ DMSans_700Bold })
  const labelFont = fontsLoaded ? { fontFamily: 'DMSans_700Bold' as const } : { fontWeight: '700' as const }
  const off = disabled || loading

  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      style={({ pressed }) => [styles.shell, off && styles.off, pressed && !off && styles.pressed]}
      accessibilityRole="button"
      accessibilityState={{ disabled: off }}
    >
      <LinearGradient
        colors={[...waButtonGradient]}
        locations={[0, 0.45, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <View style={styles.inner}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={[styles.label, labelFont]}>{title}</Text>
              {showArrow ? (
                <View style={styles.arrowCircle}>
                  <Ionicons name="arrow-forward" size={18} color="#fff" />
                </View>
              ) : null}
            </>
          )}
        </View>
      </LinearGradient>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  shell: {
    borderRadius: wa.radiusPill,
    overflow: 'hidden',
    ...wa.shadowButton,
  },
  gradient: {
    borderRadius: wa.radiusPill,
  },
  inner: {
    minHeight: 54,
    paddingVertical: 14,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    ...Platform.select({
      android: {
        elevation: 0,
      },
    }),
  },
  pressed: {
    opacity: 0.94,
    transform: [{ scale: 0.99 }],
  },
  off: {
    opacity: 0.55,
  },
  label: {
    color: '#fff',
    fontSize: 17,
    letterSpacing: -0.25,
  },
  arrowCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(0,0,0,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
})
