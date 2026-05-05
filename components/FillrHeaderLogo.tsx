import { View, Text, StyleSheet, Image } from 'react-native'
import { useFonts, DMSans_700Bold } from '@expo-google-fonts/dm-sans'

/**
 * In-app **Fillr logo** (leaf + corner brackets) for headers, scan hub, tab bar, etc.
 * This is not the store / launcher **app icon** — that lives in `app.config.js` (`expo.icon` → `./assets/icon.png`) and the Android adaptive foreground assets.
 */
export const FILLR_LOGO_MARK = require('../assets/fillr-logo-mark.png')

/** Matches `HomeScreen` top brand row (icon + wordmark). */
const INK = '#0f172a'

export type FillrHeaderLogoProps = {
  /**
   * `onDark`: white wordmark for camera / dark overlays (same mark asset as home).
   * `default`: same as home white canvas.
   */
  variant?: 'default' | 'onDark'
}

export function FillrHeaderLogo({ variant = 'default' }: FillrHeaderLogoProps) {
  const [fontsLoaded] = useFonts({ DMSans_700Bold })
  const onDark = variant === 'onDark'

  const wordmarkTypography = fontsLoaded
    ? { fontFamily: 'DMSans_700Bold' as const }
    : { fontWeight: '700' as const }

  return (
    <View style={styles.brand} accessibilityLabel="Fillr">
      <Image source={FILLR_LOGO_MARK} style={styles.mark} resizeMode="contain" accessible={false} />
      <Text style={[styles.wordmark, onDark && styles.wordmarkOnDark, wordmarkTypography]}>fillr</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  mark: {
    width: 44,
    height: 44,
    borderRadius: 11,
  },
  wordmark: {
    fontSize: 25,
    letterSpacing: -0.6,
    color: INK,
    textTransform: 'lowercase',
  },
  wordmarkOnDark: {
    color: '#ffffff',
  },
})
