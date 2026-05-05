import { useState } from 'react'
import { StyleSheet, ScrollView } from 'react-native'
import { router } from 'expo-router'
import {
  OnboardingLayout,
  ProgressHeader,
  PrimaryButton,
  OnboardingStepHero,
  OnboardingStepSection,
  GoalOptionRow,
  FooterActionBar,
} from '../../components/onboarding'
import { ONBOARDING_STEP } from '../../constants/onboardingFlow'
import { GOAL_OPTIONS } from '../../types'
import { useUserStore } from '../../store/userStore'
import { migrateGoalKey } from '../../lib/goalKeyMigration'

const GOAL_HINT: Record<string, string> = {
  more_protein: 'Bias scans toward protein-forward picks.',
  less_sugar: 'Surface syrups and stealth sweeteners.',
  lose_weight: 'Highlight energy-dense traps and fillers.',
  gain_weight: 'Favor nutrient-dense calories, not noise.',
  gut_health: 'Elevate fiber signals; note irritants.',
  eat_cleaner: 'Reward short formulas vs industrial shortcuts.',
  balanced_diet: 'Practical variety — no fad language.',
  reduce_upf: 'Flag additive stacks and modified starches.',
  lower_sodium: 'Catch salt, concentrates, stealth sodium.',
  understand: 'Decode jargon on every notable line.',
}

export default function OnboardingGoal() {
  const [selected, setSelected] = useState<string>(
    migrateGoalKey(useUserStore.getState().goal || '') || ''
  )

  const handleNext = () => {
    const canonical = migrateGoalKey(selected) || selected
    useUserStore.getState().setGoal(canonical)
    router.push('/onboarding/camera')
  }

  return (
    <OnboardingLayout>
      <ProgressHeader
        stepIndex={ONBOARDING_STEP.goal}
        onBack={() => router.push('/onboarding/preferences')}
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.inner}
        showsVerticalScrollIndicator={false}
      >
        <OnboardingStepHero
          eyebrow="Scoring"
          title="Your goal"
          lead="One emphasis per pass — tune it anytime."
          detail="Goals shape copy and ranking hints. Allergies always override."
        />

        <OnboardingStepSection
          showTopRule={false}
          label="Primary focus"
          hint="Pick the lane Fillr should lean into alongside safety."
        >
          {GOAL_OPTIONS.map((opt) => (
            <GoalOptionRow
              key={opt.key}
              label={opt.label}
              description={GOAL_HINT[opt.key]}
              selected={selected === opt.key}
              onPress={() => setSelected(opt.key)}
            />
          ))}
        </OnboardingStepSection>
      </ScrollView>
      <FooterActionBar>
        <PrimaryButton title="Continue" onPress={handleNext} disabled={!selected} />
      </FooterActionBar>
    </OnboardingLayout>
  )
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  inner: { paddingBottom: 112 },
})
