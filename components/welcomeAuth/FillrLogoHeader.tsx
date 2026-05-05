import { View, Text, StyleSheet, Image } from 'react-native'
import { useFonts, DMSans_800ExtraBold } from '@expo-google-fonts/dm-sans'
import { wa } from '../../constants/welcomeAuthTheme'

const MARK = require('../../assets/fillr-logo-mark.png')

export function FillrLogoHeader() {
  const [fontsLoaded] = useFonts({ DMSans_800ExtraBold })
  const wordFont = fontsLoaded ? { fontFamily: 'DMSans_800ExtraBold' as const } : { fontWeight: '800' as const }

  return (
    <View style={styles.row}>
      <Image source={MARK} style={styles.mark} resizeMode="contain" accessibilityLabel="Fillr" />
      <Text style={[styles.wordmark, wordFont]}>fillr</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    gap: 10,
    paddingTop: 6,
    paddingBottom: 4,
  },
  mark: {
    width: 42,
    height: 42,
    borderRadius: 11,
  },
  wordmark: {
    fontSize: 28,
    letterSpacing: -0.9,
    color: wa.ink,
    textTransform: 'lowercase' as const,
  },
})
