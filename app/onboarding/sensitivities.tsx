import { useState } from 'react'
import { View, Text, StyleSheet, ScrollView } from 'react-native'
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
import { SENSITIVITY_OPTIONS } from '../../types'
import { useUserStore } from '../../store/userStore'

export default function OnboardingSensitivities() {
  const [selected, setSelected] = useState<string[]>(useUserStore.getState().sensitivities)

  const toggle = (key: string) => {
    setSelected((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    )
  }

  const handleNext = () => {
    useUserStore.getState().setSensitivities(selected)
    router.push('/onboarding/preferences')
  }

  return (
    <OnboardingLayout>
      <ProgressHeader
        stepIndex={ONBOARDING_STEP.sensitivities}
        onBack={() => router.push('/onboarding/allergies')}
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.inner}
        showsVerticalScrollIndicator={false}
      >
        <OnboardingStepHero
          eyebrow="Score signal"
          title="Sensitivities"
          lead="We soften scores when a label likely includes a trigger."
          detail="Still softer than allergies — a hard unsafe only fires when an allergy rule matches."
        />

        <OnboardingStepSection
          showTopRule={false}
          label="How Fillr uses these"
          hint="Context, not diagnosis."
        >
          <SectionCard>
            <Text style={styles.callout}>
              Sensitivities nudge your score when wording suggests the ingredient. They never replace
              medical guidance.
            </Text>
          </SectionCard>
        </OnboardingStepSection>

        <OnboardingStepSection
          label="Your triggers"
          hint="Optional — leave blank if nothing applies."
        >
          <View style={[styles.chips, { gap: ob.step.chipGap }]}>
            {SENSITIVITY_OPTIONS.map((opt) => (
              <SelectableChip
                key={opt.key}
                label={opt.label}
                selected={selected.includes(opt.key)}
                tone="sensitivity"
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
  callout: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 21,
    color: ob.inkMuted,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
})
