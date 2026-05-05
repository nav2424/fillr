import { useMemo, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  useWindowDimensions,
  Platform,
} from 'react-native'
import { router } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import {
  OnboardingLayout,
  ProgressHeader,
  PrimaryButton,
  OnboardingStepHero,
  OnboardingStepSection,
  SelectableCard,
  SelectableChip,
  SectionCard,
  FooterActionBar,
} from '../../components/onboarding'
import { AllergenSuggestList } from '../../components/AllergenSuggestList'
import { ONBOARDING_STEP } from '../../constants/onboardingFlow'
import { ob } from '../../constants/onboardingTheme'
import { ALLERGY_OPTIONS } from '../../types'
import { useUserStore } from '../../store/userStore'
import {
  validateAllergenInput,
  getAllergyLabel,
  suggestAllergenPickRows,
  type AllergenPickRow,
} from '../../lib/knownAllergens'
import {
  ONBOARDING_ALLERGY_PRESETS,
  isPresetFullySelected,
  togglePresetSelection,
} from '../../constants/onboardingAllergyPresets'

export default function OnboardingAllergies() {
  const { width: windowWidth } = useWindowDimensions()
  const horizontalPad = ob.padX * 2
  const g = ob.step.presetGridGap
  const presetCardWidth = Math.floor((windowWidth - horizontalPad - g) / 2)

  const [selected, setSelected] = useState<string[]>(useUserStore.getState().allergies)
  const [sensitivitiesHere, setSensitivitiesHere] = useState<string[]>(
    useUserStore.getState().sensitivities
  )
  const [customInput, setCustomInput] = useState('')
  const [customError, setCustomError] = useState<string | null>(null)

  const toggle = (key: string) => {
    setSelected((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    )
  }

  const onTogglePreset = (presetId: string) => {
    const preset = ONBOARDING_ALLERGY_PRESETS.find((p) => p.id === presetId)
    if (!preset) return
    const next = togglePresetSelection(preset, selected, sensitivitiesHere)
    setSelected(next.allergies)
    setSensitivitiesHere(next.sensitivities)
  }

  const allergenPicks = useMemo(() => suggestAllergenPickRows(customInput, 10), [customInput])

  const applyAllergenPick = (row: AllergenPickRow) => {
    setCustomError(null)
    if (!selected.includes(row.key)) {
      setSelected((prev) => [...prev, row.key])
    }
    setCustomInput('')
  }

  const handleAddCustom = () => {
    setCustomError(null)
    const result = validateAllergenInput(customInput)
    if (!result.valid) {
      setCustomError(result.error ?? 'Not a recognized allergen')
      return
    }
    const addKey = result.key
    if (addKey && !selected.includes(addKey)) {
      setSelected((prev) => [...prev, addKey])
      setCustomInput('')
    }
  }

  const handleNext = () => {
    useUserStore.getState().setAllergies(selected)
    useUserStore.getState().setSensitivities(sensitivitiesHere)
    router.push('/onboarding/sensitivities')
  }

  const presetKeys = new Set<string>(ALLERGY_OPTIONS.map((o) => o.key))
  const customAllergies = selected.filter((k) => !presetKeys.has(k))

  return (
    <OnboardingLayout>
      <ProgressHeader
        stepIndex={ONBOARDING_STEP.allergies}
        onBack={() => router.push('/onboarding')}
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollInner}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <OnboardingStepHero
          eyebrow="Safety"
          title="Allergies"
          lead="Hard unsafe matches when a label hits one of these."
          detail="Immune triggers only — intolerances live on the next step."
        />

        <OnboardingStepSection
          showTopRule={false}
          label="Quick presets"
          hint="Common clusters we see on packaging — tap to bundle."
        >
          <View style={[styles.presetGrid, { gap: g }]}>
            {ONBOARDING_ALLERGY_PRESETS.map((preset) => {
              const active = isPresetFullySelected(preset, selected, sensitivitiesHere)
              return (
                <SelectableCard
                  key={preset.id}
                  title={preset.title}
                  subtitle={preset.subtitle}
                  icon={<Text style={styles.emoji}>{preset.emoji}</Text>}
                  selected={active}
                  onPress={() => onTogglePreset(preset.id)}
                  style={{ width: presetCardWidth }}
                  accent="allergy"
                />
              )
            })}
          </View>
        </OnboardingStepSection>

        <OnboardingStepSection
          label="Gluten & celiac"
          hint="You can tighten parsing later — here is the short version."
        >
          <SectionCard variant="highlight">
            <Text style={styles.calloutBody}>
              Enable <Text style={styles.calloutStrong}>Celiac Mode</Text> on Preferences for stricter
              gluten parsing than a wheat-allergy tap alone.
            </Text>
          </SectionCard>
        </OnboardingStepSection>

        <OnboardingStepSection
          label="Allergen list"
          hint="FDA-style top allergens — combine freely."
        >
          <View style={[styles.chips, { gap: ob.step.chipGap }]}>
            {ALLERGY_OPTIONS.map((opt) => (
              <SelectableChip
                key={opt.key}
                label={opt.label}
                selected={selected.includes(opt.key)}
                tone="allergy"
                onPress={() => toggle(opt.key)}
              />
            ))}
          </View>
        </OnboardingStepSection>

        <OnboardingStepSection
          label="Custom allergen"
          hint="Search, then pick a normalized match."
        >
          <View style={styles.customRow}>
            <TextInput
              style={[styles.input, customError ? styles.inputErr : null]}
              placeholder="Type an allergen…"
              placeholderTextColor={ob.inkFaint}
              value={customInput}
              onChangeText={(t) => {
                setCustomInput(t)
                setCustomError(null)
              }}
              onSubmitEditing={() => {
                if (allergenPicks.length > 0 && allergenPicks[0].score >= 70) {
                  applyAllergenPick(allergenPicks[0].row)
                } else {
                  handleAddCustom()
                }
              }}
              returnKeyType="done"
              autoCapitalize="words"
              autoCorrect={false}
            />
            <Pressable
              style={({ pressed }) => [styles.addBtnShell, pressed && styles.addBtnPressed]}
              onPress={handleAddCustom}
              accessibilityLabel="Add allergen"
            >
              <LinearGradient
                colors={[...ob.ctaGradient]}
                locations={[0, 0.55, 1]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.addBtnGrad}
              >
                <Ionicons name="add" size={22} color={ob.ctaText} />
              </LinearGradient>
            </Pressable>
          </View>
          <AllergenSuggestList picks={allergenPicks} onPick={applyAllergenPick} />
          {customError ? <Text style={styles.err}>{customError}</Text> : null}
          {customAllergies.length > 0 ? (
            <View style={[styles.chips, styles.chipsTight, { gap: ob.step.chipGap }]}>
              {customAllergies.map((key) => (
                <SelectableChip
                  key={key}
                  label={getAllergyLabel(key)}
                  selected
                  tone="allergy"
                  onPress={() => toggle(key)}
                />
              ))}
            </View>
          ) : null}
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
  scrollInner: { paddingBottom: 112 },
  presetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  emoji: { fontSize: 24 },
  calloutBody: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 21,
    color: ob.inkMuted,
  },
  calloutStrong: { fontWeight: '800', color: ob.ink },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  chipsTight: {
    marginTop: 14,
  },
  customRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  input: {
    flex: 1,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(10, 22, 40, 0.1)',
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
    paddingHorizontal: 15,
    paddingVertical: 13,
    fontSize: 15,
    color: ob.ink,
    fontWeight: '500',
  },
  inputErr: { borderColor: ob.allergy, borderWidth: 1 },
  addBtnShell: {
    borderRadius: 16,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#0fb86a',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.22,
        shadowRadius: 10,
      },
      android: { elevation: 3 },
    }),
  },
  addBtnGrad: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnPressed: { opacity: 0.9, transform: [{ scale: 0.97 }] },
  err: { color: ob.allergy, fontWeight: '600', fontSize: 13, marginTop: 10 },
})
