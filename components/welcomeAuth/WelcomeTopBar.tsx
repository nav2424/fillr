import { View, Text, StyleSheet, Image } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useFonts, DMSans_800ExtraBold, DMSans_600SemiBold } from '@expo-google-fonts/dm-sans'
import { wa } from '../../constants/welcomeAuthTheme'

const MARK = require('../../assets/fillr-logo-mark.png')

export function WelcomeTopBar() {
  const [fontsLoaded] = useFonts({ DMSans_800ExtraBold, DMSans_600SemiBold })
  const wordFont = fontsLoaded ? { fontFamily: 'DMSans_800ExtraBold' as const } : { fontWeight: '800' as const }
  const pillFont = fontsLoaded ? { fontFamily: 'DMSans_600SemiBold' as const } : { fontWeight: '600' as const }

  return (
    <View style={styles.row}>
      <View style={styles.brand}>
        <Image source={MARK} style={styles.mark} resizeMode="contain" accessibilityLabel="Fillr" />
        <Text style={[styles.wordmark, wordFont]}>fillr</Text>
      </View>
      <View style={styles.pill}>
        <Ionicons name="shield-checkmark" size={15} color={wa.accentDeep} />
        <Text style={[styles.pillText, pillFont]}>Secure & private</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
    paddingTop: 4,
    paddingBottom: 8,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  mark: {
    width: 40,
    height: 40,
    borderRadius: 10,
  },
  wordmark: {
    fontSize: 26,
    letterSpacing: -0.85,
    color: wa.ink,
    textTransform: 'lowercase' as const,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 11,
    borderRadius: 999,
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.22)',
  },
  pillText: {
    fontSize: 11,
    fontWeight: '600',
    color: wa.accentDeep,
    letterSpacing: -0.1,
  },
})
