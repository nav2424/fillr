import { View, Text, StyleSheet, ScrollView } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useFonts, DMSans_800ExtraBold, DMSans_500Medium, DMSans_600SemiBold } from '@expo-google-fonts/dm-sans'
import { router } from 'expo-router'
import {
  OnboardingLayout,
  ProgressHeader,
  PrimaryButton,
  HeroBarcodeVisual,
  FooterActionBar,
} from '../../components/onboarding'
import { ONBOARDING_STEP } from '../../constants/onboardingFlow'
import { ob, obType } from '../../constants/onboardingTheme'
import { useUserStore } from '../../store/userStore'

export default function OnboardingWelcome() {
  const [fontsLoaded] = useFonts({
    DMSans_800ExtraBold,
    DMSans_600SemiBold,
    DMSans_500Medium,
  })
  const display = fontsLoaded ? { fontFamily: 'DMSans_800ExtraBold' as const } : { fontWeight: '800' as const }
  const sub = fontsLoaded ? { fontFamily: 'DMSans_500Medium' as const } : { fontWeight: '500' as const }
  const chip = fontsLoaded ? { fontFamily: 'DMSans_600SemiBold' as const } : { fontWeight: '600' as const }

  return (
    <OnboardingLayout>
      <ProgressHeader stepIndex={ONBOARDING_STEP.welcome} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <HeroBarcodeVisual />

        <View style={styles.copyBlock}>
          <View style={styles.accentRail}>
            <LinearGradient
              colors={[ob.accentBar, ob.cta, '#4ade80']}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={StyleSheet.absoluteFillObject}
            />
          </View>
          <View style={styles.copyInner}>
            <View style={styles.chip}>
              <Text style={[styles.chipText, chip]}>INGREDIENT INTELLIGENCE</Text>
            </View>
            <Text style={[obType.display, display, styles.title]}>
              Know what’s{' '}
              <Text style={[obType.displayAccent, display]}>really</Text>
              {' in your food.'}
            </Text>
            <Text style={[obType.subtitle, sub, styles.sub]}>
              Scan barcodes, decode ingredients, and get insights tuned to your allergies, sensitivities, and goals.
            </Text>
          </View>
        </View>
      </ScrollView>
      <FooterActionBar>
        <PrimaryButton
          title="Get started"
          onPress={() => {
            useUserStore.getState().clearOnboardingDraft()
            router.push('/onboarding/allergies')
          }}
        />
      </FooterActionBar>
    </OnboardingLayout>
  )
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 28,
    flexGrow: 1,
  },
  copyBlock: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 16,
    marginTop: 8,
    maxWidth: 400,
    alignSelf: 'center',
    width: '100%',
  },
  accentRail: {
    width: 4,
    borderRadius: 4,
    marginTop: 6,
    overflow: 'hidden',
  },
  copyInner: {
    flex: 1,
    gap: 12,
  },
  chip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.22)',
  },
  chipText: {
    fontSize: 9,
    letterSpacing: 1.8,
    color: ob.inkMuted,
  },
  title: {
    textAlign: 'left',
  },
  sub: {
    textAlign: 'left',
    maxWidth: 360,
    opacity: 0.98,
  },
})
