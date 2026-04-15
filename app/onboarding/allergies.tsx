import { useState } from 'react'
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
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import {
  FillrButton,
  GlassChip,
  GlassProgressBar,
  GradientBackground,
} from '../../components'
import { colors, spacing, typography, radius } from '../../constants/theme'
import { ALLERGY_OPTIONS } from '../../types'
import { useUserStore } from '../../store/userStore'
import { validateAllergenInput, getAllergyLabel } from '../../lib/knownAllergens'
import {
  ONBOARDING_ALLERGY_PRESETS,
  isPresetFullySelected,
  togglePresetSelection,
} from '../../constants/onboardingAllergyPresets'

export default function OnboardingAllergies() {
  const { width: windowWidth } = useWindowDimensions()
  const horizontalPad = spacing.xxl * 2
  const presetGap = spacing.md
  const presetCardWidth = Math.floor((windowWidth - horizontalPad - presetGap) / 2)

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

  const handleAddCustom = () => {
    setCustomError(null)
    const result = validateAllergenInput(customInput)
    if (!result.valid) {
      setCustomError(result.error ?? 'Not a recognized allergen')
      return
    }
    if (result.key && !selected.includes(result.key)) {
      setSelected((prev) => [...prev, result.key!])
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

  const hasLactosePreset = sensitivitiesHere.includes('lactose')

  return (
    <GradientBackground variant="minimal">
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.navRow}>
          <Pressable
            onPress={() => router.push('/onboarding')}
            hitSlop={10}
            style={({ pressed }) => [styles.backBtn, pressed && styles.backBtnPressed]}
            accessibilityRole="button"
            accessibilityLabel="Back to previous question"
          >
            <Ionicons name="chevron-back" size={20} color={colors.textSecondary} />
            <Text style={styles.backText}>Back</Text>
          </Pressable>
        </View>
        <GlassProgressBar total={7} current={2} />
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.step}>Step 2 of 7</Text>
          <Text style={styles.title}>Allergies & intolerances</Text>
          <Text style={styles.helper}>
            Start with a quick preset, then fine-tune below. We flag matches on every scan.
          </Text>

          <Text style={styles.sectionKicker}>Quick presets</Text>
          <Text style={styles.sectionSubtitle}>
            Tap to add or remove a bundle. Works alongside Celiac Mode (you can turn that on later in
            Preferences).
          </Text>

          <View style={styles.presetGrid}>
            {ONBOARDING_ALLERGY_PRESETS.map((preset) => {
              const active = isPresetFullySelected(preset, selected, sensitivitiesHere)
              return (
                <Pressable
                  key={preset.id}
                  onPress={() => onTogglePreset(preset.id)}
                  style={({ pressed }) => [
                    styles.presetCard,
                    { width: presetCardWidth },
                    active && styles.presetCardSelected,
                    pressed && styles.presetCardPressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`${preset.title}. ${active ? 'Selected' : 'Not selected'}. ${preset.subtitle}`}
                >
                  <Text style={styles.presetEmoji}>{preset.emoji}</Text>
                  <Text style={[styles.presetTitle, active && styles.presetTitleSelected]}>
                    {preset.title}
                  </Text>
                  <Text style={styles.presetSubtitle}>{preset.subtitle}</Text>
                  {active ? (
                    <View style={styles.presetCheckRow}>
                      <Ionicons name="checkmark-circle" size={18} color={colors.accent} />
                      <Text style={styles.presetCheckLabel}>On</Text>
                    </View>
                  ) : (
                    <Text style={styles.presetTapHint}>Tap to add</Text>
                  )}
                </Pressable>
              )
            })}
          </View>

          {hasLactosePreset && (
            <View style={styles.lactoseNote}>
              <Ionicons name="information-circle-outline" size={18} color={colors.caution} />
              <Text style={styles.lactoseNoteText}>
                Lactose is tracked as a <Text style={styles.lactoseNoteStrong}>sensitivity</Text> (next
                step shows all sensitivities). For immune milk allergy, also add{' '}
                <Text style={styles.lactoseNoteStrong}>Milk</Text> below.
              </Text>
            </View>
          )}

          <View style={styles.celiacCallout}>
            <View style={styles.celiacCalloutIcon}>
              <Text style={styles.celiacCalloutEmoji}>🌾</Text>
            </View>
            <View style={styles.celiacCalloutBody}>
              <Text style={styles.celiacCalloutTitle}>Celiac disease?</Text>
              <Text style={styles.celiacCalloutText}>
                Turn on <Text style={styles.celiacCalloutStrong}>Celiac Mode</Text> on the Preferences
                step. It is stricter than choosing wheat alone and checks ambiguous gluten wording.
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          <Text style={styles.sectionKicker}>All allergens</Text>
          <Text style={styles.sectionSubtitle}>
            FDA-style top allergens — tap any combination.
          </Text>
          <View style={styles.chips}>
            {ALLERGY_OPTIONS.map((opt) => (
              <GlassChip
                key={opt.key}
                label={opt.label}
                selected={selected.includes(opt.key)}
                variant="danger"
                onPress={() => toggle(opt.key)}
              />
            ))}
          </View>

          <View style={styles.customSection}>
            <Text style={styles.customLabel}>Add another allergen</Text>
            <Text style={styles.customHint}>E.g. Apple, Banana, Chocolate, Cheese</Text>
            <View style={styles.customRow}>
              <TextInput
                style={[styles.input, customError && styles.inputError]}
                placeholder="Enter known allergen"
                placeholderTextColor={colors.textMuted}
                value={customInput}
                onChangeText={(t) => {
                  setCustomInput(t)
                  setCustomError(null)
                }}
                onSubmitEditing={handleAddCustom}
                returnKeyType="done"
                autoCapitalize="words"
                autoCorrect={false}
              />
              <Pressable
                style={({ pressed }) => [styles.addBtn, pressed && styles.addBtnPressed]}
                onPress={handleAddCustom}
              >
                <Ionicons name="add" size={22} color="#fff" />
              </Pressable>
            </View>
            {customError && <Text style={styles.errorText}>{customError}</Text>}
            {customAllergies.length > 0 && (
              <View style={styles.customChips}>
                {customAllergies.map((key) => (
                  <GlassChip
                    key={key}
                    label={getAllergyLabel(key)}
                    selected
                    variant="danger"
                    onPress={() => toggle(key)}
                  />
                ))}
              </View>
            )}
          </View>
        </ScrollView>
        <FillrButton title="Continue" onPress={handleNext} fullWidth />
      </SafeAreaView>
    </GradientBackground>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.lg,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  backBtnPressed: {
    opacity: 0.9,
  },
  backText: {
    ...typography.bodySmall,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  title: {
    ...typography.h1,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  step: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: spacing.sm,
    fontWeight: '700',
  },
  helper: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
    lineHeight: 22,
  },
  sectionKicker: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: '800',
    marginBottom: spacing.xs,
  },
  sectionSubtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
    lineHeight: 20,
  },
  presetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  presetCard: {
    backgroundColor: colors.backgroundElevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    minHeight: 148,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 10,
      },
      android: { elevation: 2 },
    }),
  },
  presetCardSelected: {
    borderColor: colors.accent,
    borderWidth: 2,
    backgroundColor: colors.accentMuted,
  },
  presetCardPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.98 }],
  },
  presetEmoji: {
    fontSize: 28,
    marginBottom: spacing.sm,
  },
  presetTitle: {
    ...typography.label,
    color: colors.text,
    marginBottom: 4,
  },
  presetTitleSelected: {
    color: colors.text,
  },
  presetSubtitle: {
    ...typography.caption,
    color: colors.textMuted,
    lineHeight: 17,
    flex: 1,
  },
  presetTapHint: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.sm,
    fontWeight: '600',
  },
  presetCheckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: spacing.sm,
  },
  presetCheckLabel: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.accent,
  },
  lactoseNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.cautionMuted,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  lactoseNoteText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    flex: 1,
    lineHeight: 20,
  },
  lactoseNoteStrong: {
    fontWeight: '700',
    color: colors.text,
  },
  celiacCallout: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    backgroundColor: colors.safeMuted,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.25)',
    padding: spacing.lg,
    marginBottom: spacing.xl,
  },
  celiacCalloutIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.backgroundElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  celiacCalloutEmoji: {
    fontSize: 22,
  },
  celiacCalloutBody: {
    flex: 1,
  },
  celiacCalloutTitle: {
    ...typography.label,
    color: colors.safe,
    marginBottom: 4,
  },
  celiacCalloutText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  celiacCalloutStrong: {
    fontWeight: '700',
    color: colors.text,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginBottom: spacing.xl,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  customSection: {
    marginTop: spacing.xl,
    paddingTop: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  customLabel: {
    ...typography.label,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  customHint: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  customRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    ...typography.body,
    color: colors.text,
    backgroundColor: colors.backgroundInput,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  inputError: {
    borderColor: colors.danger,
  },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnPressed: {
    opacity: 0.9,
  },
  errorText: {
    ...typography.caption,
    color: colors.danger,
    marginTop: spacing.sm,
  },
  customChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.md,
  },
})
