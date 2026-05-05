import { View, Text, StyleSheet, useWindowDimensions } from 'react-native'
import { useFonts, DMSans_800ExtraBold, DMSans_500Medium, DMSans_700Bold } from '@expo-google-fonts/dm-sans'
import { wa, waType } from '../../constants/welcomeAuthTheme'

function HeroBackdrop() {
  return (
    <View style={backdrop.root} pointerEvents="none">
      <View style={[backdrop.arc, backdrop.a1]} />
      <View style={[backdrop.arc, backdrop.a2]} />
      <View style={[backdrop.arc, backdrop.a3]} />
    </View>
  )
}

export function HeroScanSection() {
  const { width: winW } = useWindowDimensions()
  const [fontsLoaded] = useFonts({
    DMSans_800ExtraBold,
    DMSans_500Medium,
    DMSans_700Bold,
  })
  const displayFont = fontsLoaded ? { fontFamily: 'DMSans_800ExtraBold' as const } : { fontWeight: '800' as const }
  const subFont = fontsLoaded ? { fontFamily: 'DMSans_500Medium' as const } : { fontWeight: '500' as const }
  const eyebrowFont = fontsLoaded ? { fontFamily: 'DMSans_700Bold' as const } : { fontWeight: '700' as const }

  const narrow = winW < 420

  return (
    <View style={styles.block}>
      <HeroBackdrop />
      <View style={[styles.copyBlock, narrow && styles.copyBlockNarrow]}>
        <Text style={[styles.welcomeEyebrow, eyebrowFont]}>WELCOME TO FILLR</Text>
        <Text style={[waType.heroDisplay, displayFont, styles.title]}>
          <Text style={[waType.heroAccent, displayFont]}>Decode</Text>
          {' what you eat.'}
        </Text>
        <Text style={[waType.heroSub, subFont, styles.sub]}>
          Instant ingredient, allergen, and health clarity.
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  block: {
    position: 'relative',
    marginTop: 8,
    marginBottom: 8,
    alignSelf: 'stretch',
    overflow: 'hidden',
  },
  copyBlock: {
    zIndex: 1,
    maxWidth: 360,
    paddingRight: 8,
  },
  copyBlockNarrow: {
    maxWidth: '100%',
  },
  welcomeEyebrow: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2.6,
    color: wa.accent,
    marginBottom: 10,
    textAlign: 'left',
    marginTop: 2,
  },
  title: {
    textAlign: 'left',
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: -1,
  },
  sub: {
    textAlign: 'left',
    marginTop: 10,
    fontSize: 15,
    lineHeight: 22,
    maxWidth: 320,
  },
})

const backdrop = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  arc: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.06)',
    borderRadius: 999,
  },
  a1: {
    width: 420,
    height: 420,
    right: -140,
    top: -120,
  },
  a2: {
    width: 280,
    height: 280,
    right: -40,
    top: 40,
    opacity: 0.7,
  },
  a3: {
    width: 180,
    height: 180,
    left: -60,
    bottom: -20,
    opacity: 0.5,
  },
})
