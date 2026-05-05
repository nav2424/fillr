import { Text, Pressable, StyleSheet } from 'react-native'
import { useFonts, DMSans_500Medium, DMSans_600SemiBold } from '@expo-google-fonts/dm-sans'
import { wa } from '../../constants/welcomeAuthTheme'

type Props = {
  onPress: () => void
}

/** Quiet secondary path — text only, no card chrome. */
export function CTAInfoCard({ onPress }: Props) {
  const [fontsLoaded] = useFonts({ DMSans_500Medium, DMSans_600SemiBold })
  const muted = fontsLoaded ? { fontFamily: 'DMSans_500Medium' as const } : { fontWeight: '500' as const }
  const action = fontsLoaded ? { fontFamily: 'DMSans_600SemiBold' as const } : { fontWeight: '600' as const }

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.wrap, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel="New to Fillr? Create an account"
    >
      <Text style={[styles.line, muted]}>
        <Text style={styles.mutedPart}>New to Fillr? </Text>
        <Text style={[styles.action, action]}>Create an account</Text>
      </Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'center',
    marginTop: 22,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  pressed: {
    opacity: 0.72,
  },
  line: {
    fontSize: 15,
    lineHeight: 22,
    color: wa.slate,
    textAlign: 'center',
  },
  mutedPart: {
    color: wa.muted,
  },
  action: {
    color: wa.accentDeep,
    textDecorationLine: 'underline',
    textDecorationColor: 'rgba(21, 128, 61, 0.35)',
  },
})
