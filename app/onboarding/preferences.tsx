import { useState } from 'react'
import { View, Text, StyleSheet, ScrollView, Switch } from 'react-native'
import { router } from 'expo-router'
import {
  OnboardingLayout,
  ProgressHeader,
  PrimaryButton,
  OnboardingStepHero,
  OnboardingStepSection,
  SelectableChip,
  SectionCard,
  FooterActionBar,
} from '../../components/onboarding'
import { ONBOARDING_STEP } from '../../constants/onboardingFlow'
import { ob } from '../../constants/onboardingTheme'
import { PREFERENCE_OPTIONS } from '../../types'
import { useUserStore } from '../../store/userStore'

export default function OnboardingPreferences() {
  const initialCeliac = useUserStore.getState().celiacStrictGluten
  const [selected, setSelected] = useState<string[]>(useUserStore.getState().preferences)
  const [celiacMode, setCeliacMode] = useState<boolean>(initialCeliac)

  const toggle = (key: string) => {
    setSelected((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    )
  }

  const handleNext = () => {
    useUserStore.getState().setPreferences(selected)
    useUserStore.getState().setCeliacMode(celiacMode)
    router.push('/onboarding/goal')
  }

  return (
    <OnboardingLayout>
      <ProgressHeader
        stepIndex={ONBOARDING_STEP.preferences}
        onBack={() => router.push('/onboarding/sensitivities')}
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.inner}
        showsVerticalScrollIndicator={false}
      >
        <OnboardingStepHero
          eyebrow="Lifestyle"
          title="Preferences"
          lead="We surface conflicts without drowning the safety story."
          detail="Diet values sit on top of allergies — they never override a true allergen hit."
        />

        <OnboardingStepSection
          showTopRule={false}
          label="Celiac mode"
          hint="Stricter gluten parsing for ambiguous lines and cross-contact wording."
        >
          <SectionCard variant="highlight">
            <View style={styles.celiacRow}>
              <View style={styles.celiacCopy}>
                <Text style={styles.celiacTitle}>Strict gluten detection</Text>
                <Text style={styles.celiacSub}>
                  Beyond a basic wheat toggle — flags gluten sources and fuzzy label phrasing.
                </Text>
              </View>
              <Switch
                value={celiacMode}
                onValueChange={setCeliacMode}
                trackColor={{ false: '#d1d5db', true: ob.cta }}
                thumbColor="#fff"
              />
            </View>
            {celiacMode ? (
              <Text style={styles.celiacWarn}>
                Label intelligence only — follow your clinician for medical decisions.
              </Text>
            ) : null}
          </SectionCard>
        </OnboardingStepSection>

        <OnboardingStepSection
          label="Diet preferences"
          hint="Tap what you want surfaced — allergies still win on safety."
        >
          <View style={[styles.chips, { gap: ob.step.chipGap }]}>
            {PREFERENCE_OPTIONS.map((opt) => (
              <SelectableChip
                key={opt.key}
                label={opt.label}
                selected={selected.includes(opt.key)}
                tone="preference"
                onPress={() => toggle(opt.key)}
              />
            ))}
          </View>
        </OnboardingStepSection>
      </ScrollView>
      <FooterActionBar>
        <PrimaryButton title="Continue" onPress={handleNext} />
      </FooterActionBar>
    </OnboardingLayout>
  )
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  inner: { paddingBottom: 112 },
  celiacRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  celiacCopy: { flex: 1 },
  celiacTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: ob.ink,
    marginBottom: 5,
    letterSpacing: -0.2,
  },
  celiacSub: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 19,
    color: ob.inkMuted,
  },
  celiacWarn: {
    marginTop: 12,
    fontSize: 12,
    fontWeight: '600',
    color: ob.sensitivity,
    lineHeight: 17,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
})
