import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  ActivityIndicator,
  Switch,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import {
  FillrButton,
  GlassChip,
  GlassOptionCard,
  GradientBackground,
} from '../components'
import { colors, spacing, typography } from '../constants/theme'
import {
  PRESET_ALLERGIES,
  PRESET_AVOIDING,
  PRESET_PREFERENCES,
  PRESET_SENSITIVITIES,
} from '../constants/dietProfilePresets'
import { GOAL_OPTIONS } from '../types'
import { useUserStore } from '../store/userStore'
import { validateAllergenInput, getAllergyLabel } from '../lib/knownAllergens'
import {
  allergyKeyToSlug,
  preferenceKeyToSlug,
  sensitivityKeyToSlug,
} from '../lib/getUserProfileForScan'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const {
  getUserProfile,
  saveUserProfile,
} = require('../store/userProfileStore.js') as {
  getUserProfile: () => Promise<{
    allergies: string[]
    sensitivities: string[]
    avoiding: string[]
    preferences: string[]
    goal?: string
    celiacStrictGluten?: boolean
  }>
  saveUserProfile: (p: {
    allergies: string[]
    sensitivities: string[]
    avoiding: string[]
    preferences: string[]
    goal?: string
    celiacStrictGluten?: boolean
  }) => Promise<void>
}

const PRESET_ALLERGY_SLUGS = new Set(PRESET_ALLERGIES.map((a) => a.slug))

/** Diet slug → zustand sensitivity keys (partial; rest live only in profile store). */
const DIET_SLUG_TO_Z_SENS: Record<string, string> = {
  lactose: 'lactose',
  msg: 'msg',
  gluten: 'gluten_sensitivity',
  'artificial sweeteners': 'artificial_sweeteners',
  sulfites: 'sulfites',
}

/** Diet slug → zustand preference keys (partial). */
const DIET_SLUG_TO_Z_PREF: Record<string, string> = {
  vegan: 'vegan',
  vegetarian: 'vegetarian',
  keto: 'low_carb',
  paleo: 'less_processed',
  'diabetic-friendly': 'low_sugar',
}

function normSlug(s: string): string {
  return String(s || '')
    .toLowerCase()
    .trim()
}

function mergeUnique(xs: string[]): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const x of xs) {
    const n = normSlug(x)
    if (!n || seen.has(n)) continue
    seen.add(n)
    out.push(n)
  }
  return out
}

const EDIT_SECTION_KEYS = [
  'allergies',
  'sensitivities',
  'avoiding',
  'preferences',
  'goal',
] as const
type EditSectionKey = (typeof EDIT_SECTION_KEYS)[number]

function isEditSectionKey(s: string | undefined): s is EditSectionKey {
  return !!s && (EDIT_SECTION_KEYS as readonly string[]).includes(s)
}

const SECTION_TITLES: Record<EditSectionKey, string> = {
  allergies: 'Edit allergies',
  sensitivities: 'Edit sensitivities',
  avoiding: 'Edit avoiding',
  preferences: 'Edit preferences',
  goal: 'Edit goal',
}

function slugsToZustandAllergies(slugs: string[]): string[] {
  const keys: string[] = []
  for (const slug of slugs) {
    const n = normSlug(slug)
    const preset = PRESET_ALLERGIES.find((a) => a.slug === n)
    if (preset?.userStoreAllergyKey) keys.push(preset.userStoreAllergyKey)
    else keys.push(n.replace(/\s+/g, '_'))
  }
  return [...new Set(keys)]
}

export default function EditPreferencesScreen() {
  const { section: sectionParam } = useLocalSearchParams<{ section?: string | string[] }>()
  const sectionStr = Array.isArray(sectionParam) ? sectionParam[0] : sectionParam
  const singleSection: EditSectionKey | null = isEditSectionKey(sectionStr)
    ? sectionStr
    : null

  const [hydrated, setHydrated] = useState(false)
  const [allergySlugs, setAllergySlugs] = useState<string[]>([])
  const [sensitivitySlugs, setSensitivitySlugs] = useState<string[]>([])
  const [avoidingSlugs, setAvoidingSlugs] = useState<string[]>([])
  const [preferenceSlugs, setPreferenceSlugs] = useState<string[]>([])
  const [goal, setGoal] = useState<string>('')
  const [celiacMode, setCeliacMode] = useState(false)

  const [customAllergenInput, setCustomAllergenInput] = useState('')
  const [customAllergenError, setCustomAllergenError] = useState<string | null>(null)

  const customAllergies = useMemo(
    () => allergySlugs.filter((s) => !PRESET_ALLERGY_SLUGS.has(s)),
    [allergySlugs]
  )

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const p = await getUserProfile()
        const z = useUserStore.getState()
        if (!alive) return

        const storedHasAny =
          p.allergies.length > 0 ||
          p.sensitivities.length > 0 ||
          p.avoiding.length > 0 ||
          p.preferences.length > 0

        if (storedHasAny) {
          setAllergySlugs(mergeUnique(p.allergies))
          setSensitivitySlugs(mergeUnique(p.sensitivities))
          setAvoidingSlugs(mergeUnique(p.avoiding))
          setPreferenceSlugs(mergeUnique(p.preferences))
        } else {
          const a = z.allergies
            .map((k) => allergyKeyToSlug(k))
            .filter((x): x is string => Boolean(x))
          setAllergySlugs(mergeUnique(a))
          setSensitivitySlugs(
            mergeUnique(z.sensitivities.map((k) => sensitivityKeyToSlug(k)))
          )
          setAvoidingSlugs([])
          setPreferenceSlugs(
            mergeUnique(z.preferences.map((k) => preferenceKeyToSlug(k)))
          )
        }
        const storedGoal = (p.goal ?? '').trim()
        setGoal(storedGoal || z.goal || '')
        // Disk `false` must not wipe Zustand `true`: profile reads Zustand for "Celiac Mode",
        // but older saves / partial writes can leave JSON false while the session store is still on.
        const mergedCeliac = Boolean(p.celiacStrictGluten === true || z.celiacStrictGluten)
        setCeliacMode(mergedCeliac)
        if (mergedCeliac !== z.celiacStrictGluten) {
          useUserStore.getState().setCeliacMode(mergedCeliac)
        }
      } finally {
        if (alive) setHydrated(true)
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  const toggleSlug = useCallback(
    (setArr: (fn: (p: string[]) => string[]) => void, slug: string) => {
      const n = normSlug(slug)
      setArr((prev) =>
        prev.some((x) => normSlug(x) === n)
          ? prev.filter((x) => normSlug(x) !== n)
          : [...prev, n]
      )
    },
    []
  )

  const addCustomAllergen = useCallback(() => {
    setCustomAllergenError(null)
    const result = validateAllergenInput(customAllergenInput)
    if (!result.valid) {
      setCustomAllergenError(result.error ?? 'Not a recognized allergen')
      return
    }
    if (!result.key) return
    const slug = allergyKeyToSlug(result.key) ?? normSlug(result.key)
    if (!slug) return
    setAllergySlugs((prev) => mergeUnique([...prev, slug]))
    setCustomAllergenInput('')
  }, [customAllergenInput])

  const handleDone = useCallback(async () => {
    const profile = {
      allergies: mergeUnique(allergySlugs),
      sensitivities: mergeUnique(sensitivitySlugs),
      avoiding: mergeUnique(avoidingSlugs),
      preferences: mergeUnique(preferenceSlugs),
    }
    await saveUserProfile({ ...profile, goal, celiacStrictGluten: celiacMode })

    const zAllergies = slugsToZustandAllergies(profile.allergies)
    const zSens = mergeUnique(
      profile.sensitivities
        .map((s) => DIET_SLUG_TO_Z_SENS[normSlug(s)])
        .filter((x): x is string => Boolean(x))
    )
    const zPrefs = mergeUnique(
      profile.preferences
        .map((s) => DIET_SLUG_TO_Z_PREF[normSlug(s)])
        .filter((x): x is string => Boolean(x))
    )

    useUserStore.getState().setAllergies(zAllergies)
    useUserStore.getState().setSensitivities(zSens)
    useUserStore.getState().setPreferences(zPrefs)
    useUserStore.getState().setGoal(goal)
    useUserStore.getState().setCeliacMode(celiacMode)
    router.back()
  }, [allergySlugs, sensitivitySlugs, avoidingSlugs, preferenceSlugs, goal, celiacMode])

  const showAllergies = !singleSection || singleSection === 'allergies'
  const showSensitivities = !singleSection || singleSection === 'sensitivities'
  const showAvoiding = !singleSection || singleSection === 'avoiding'
  const showPreferences = !singleSection || singleSection === 'preferences'
  const showGoal = !singleSection || singleSection === 'goal'
  const headerTitle = singleSection ? SECTION_TITLES[singleSection] : 'Edit preferences'

  if (!hydrated) {
    return (
      <GradientBackground variant="minimal">
        <SafeAreaView style={[styles.container, styles.centered]} edges={['top', 'bottom']}>
          <ActivityIndicator color={colors.accent} />
        </SafeAreaView>
      </GradientBackground>
    )
  }

  return (
    <GradientBackground variant="minimal">
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backBtn, pressed && styles.backBtnPressed]}
          >
            <Ionicons name="chevron-back" size={24} color={colors.text} />
            <Text style={styles.backBtnText}>Back</Text>
          </Pressable>
          <Text style={styles.headerTitle}>{headerTitle}</Text>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.celiacCard}>
            <View style={styles.celiacHeader}>
              <View style={styles.celiacIconWrap}>
                <Text style={styles.celiacIcon}>🌾</Text>
              </View>
              <View style={styles.celiacTextWrap}>
                <Text style={styles.celiacTitle}>Celiac Mode</Text>
                <Text style={styles.celiacSubtitle}>
                  Strict gluten detection — flags all gluten sources, ambiguous ingredients, and
                  cross-contact risks
                </Text>
              </View>
              <Switch
                value={celiacMode}
                onValueChange={setCeliacMode}
                trackColor={{ false: '#d1d5db', true: '#22c55e' }}
              />
            </View>
            {celiacMode && (
              <View style={styles.celiacNote}>
                <Text style={styles.celiacNoteText}>
                  ⚠ This mode is stricter than a standard gluten allergy. Always follow your
                  clinician&apos;s guidance.
                </Text>
              </View>
            )}
          </View>

          {/* Allergies */}
          {showAllergies && (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View
                style={[styles.sectionIconWrap, { backgroundColor: colors.dangerMuted }]}
              >
                <Ionicons name="warning" size={18} color={colors.danger} />
              </View>
              <View style={styles.sectionTitleWrap}>
                <Text style={styles.sectionTitle}>Allergies</Text>
                <Text style={styles.sectionHelper}>
                  Serious — we flag these as avoid for you
                </Text>
              </View>
            </View>
            <View style={styles.chips}>
              {PRESET_ALLERGIES.map((opt) => (
                <GlassChip
                  key={opt.slug}
                  label={opt.label}
                  selected={allergySlugs.some((s) => normSlug(s) === opt.slug)}
                  variant="danger"
                  onPress={() =>
                    toggleSlug(setAllergySlugs, opt.slug)
                  }
                />
              ))}
            </View>
            <View style={styles.customRow}>
              <TextInput
                style={[styles.input, customAllergenError && styles.inputError]}
                placeholder="Add allergen (e.g. Mustard, Apple)"
                placeholderTextColor={colors.textMuted}
                value={customAllergenInput}
                onChangeText={(t) => {
                  setCustomAllergenInput(t)
                  setCustomAllergenError(null)
                }}
                onSubmitEditing={addCustomAllergen}
                returnKeyType="done"
                autoCapitalize="words"
                autoCorrect={false}
              />
              <Pressable
                style={({ pressed }) => [styles.addBtn, pressed && styles.addBtnPressed]}
                onPress={addCustomAllergen}
              >
                <Ionicons name="add" size={22} color="#fff" />
              </Pressable>
            </View>
            {customAllergenError && (
              <Text style={styles.errorText}>{customAllergenError}</Text>
            )}
            {customAllergies.length > 0 && (
              <View style={styles.chips}>
                {customAllergies.map((slug) => (
                  <GlassChip
                    key={slug}
                    label={getAllergyLabel(slug.replace(/\s+/g, '_'))}
                    selected
                    variant="danger"
                    onPress={() =>
                      toggleSlug(setAllergySlugs, slug)
                    }
                  />
                ))}
              </View>
            )}
          </View>
          )}

          {/* Sensitivities */}
          {showSensitivities && (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View
                style={[styles.sectionIconWrap, { backgroundColor: colors.cautionMuted }]}
              >
                <Ionicons name="alert-circle" size={18} color={colors.caution} />
              </View>
              <View style={styles.sectionTitleWrap}>
                <Text style={styles.sectionTitle}>Sensitivities</Text>
                <Text style={styles.sectionHelper}>
                  We upgrade clean/okay items to concerning when they match
                </Text>
              </View>
            </View>
            <View style={styles.chips}>
              {PRESET_SENSITIVITIES.map((opt) => (
                <GlassChip
                  key={opt.slug}
                  label={opt.label}
                  selected={sensitivitySlugs.some((s) => normSlug(s) === opt.slug)}
                  variant="caution"
                  onPress={() =>
                    toggleSlug(setSensitivitySlugs, opt.slug)
                  }
                />
              ))}
            </View>
          </View>
          )}

          {/* Avoiding */}
          {showAvoiding && (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View
                style={[styles.sectionIconWrap, { backgroundColor: colors.textMuted + '33' }]}
              >
                <Text style={styles.avoidEmoji}>🚫</Text>
              </View>
              <View style={styles.sectionTitleWrap}>
                <Text style={styles.sectionTitle}>Avoiding</Text>
                <Text style={styles.sectionHelper}>
                  Personal choice — shown with a prefer-to-avoid note
                </Text>
              </View>
            </View>
            <View style={styles.chips}>
              {PRESET_AVOIDING.map((opt) => (
                <GlassChip
                  key={opt.slug}
                  label={opt.label}
                  selected={avoidingSlugs.some((s) => normSlug(s) === opt.slug)}
                  variant="default"
                  onPress={() =>
                    toggleSlug(setAvoidingSlugs, opt.slug)
                  }
                />
              ))}
            </View>
          </View>
          )}

          {/* Preferences */}
          {showPreferences && (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIconWrap, { backgroundColor: colors.safeMuted }]}>
                <Ionicons name="heart" size={18} color={colors.safe} />
              </View>
              <View style={styles.sectionTitleWrap}>
                <Text style={styles.sectionTitle}>Diet preferences</Text>
                <Text style={styles.sectionHelper}>
                  Context for conflicts (e.g. vegan) — no automatic rating change
                </Text>
              </View>
            </View>
            <View style={styles.chips}>
              {PRESET_PREFERENCES.map((opt) => (
                <GlassChip
                  key={opt.slug}
                  label={opt.label}
                  selected={preferenceSlugs.some((s) => normSlug(s) === opt.slug)}
                  variant="safe"
                  onPress={() =>
                    toggleSlug(setPreferenceSlugs, opt.slug)
                  }
                />
              ))}
            </View>
          </View>
          )}

          {/* Goal */}
          {showGoal && (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIconWrap, { backgroundColor: colors.accentMuted }]}>
                <Ionicons name="flag" size={18} color={colors.accent} />
              </View>
              <View style={styles.sectionTitleWrap}>
                <Text style={styles.sectionTitle}>Your goal</Text>
                <Text style={styles.sectionHelper}>What do you want to achieve?</Text>
              </View>
            </View>
            <View style={styles.cards}>
              {GOAL_OPTIONS.map((opt) => (
                <GlassOptionCard
                  key={opt.key}
                  label={opt.label}
                  selected={goal === opt.key}
                  onPress={() => setGoal(opt.key)}
                />
              ))}
            </View>
          </View>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <FillrButton
            title={singleSection === 'allergies' ? 'Save' : 'Done'}
            onPress={() => {
              void handleDone()
            }}
            fullWidth
            style={styles.doneBtn}
          />
        </View>
      </SafeAreaView>
    </GradientBackground>
  )
}

const styles = StyleSheet.create({
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    flex: 1,
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    marginLeft: -spacing.sm,
  },
  backBtnPressed: {
    opacity: 0.7,
  },
  backBtnText: {
    ...typography.body,
    color: colors.text,
    marginLeft: spacing.xs,
  },
  headerTitle: {
    ...typography.h3,
    color: colors.text,
    marginLeft: spacing.md,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.xxxl,
  },
  sectionCard: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 20,
    padding: spacing.xl,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.lg,
  },
  sectionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  avoidEmoji: {
    fontSize: 18,
  },
  sectionTitleWrap: {
    flex: 1,
  },
  sectionTitle: {
    ...typography.h3,
    fontSize: 17,
    color: colors.text,
    marginBottom: 2,
  },
  sectionHelper: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  customRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  input: {
    flex: 1,
    ...typography.body,
    color: colors.text,
    backgroundColor: colors.backgroundLightGreen,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  inputError: {
    borderColor: colors.danger,
  },
  addBtn: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  addBtnPressed: {
    opacity: 0.9,
  },
  errorText: {
    ...typography.caption,
    color: colors.danger,
    marginTop: spacing.sm,
  },
  cards: {
    gap: 0,
  },
  celiacCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  celiacHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  celiacIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#fef3c7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  celiacIcon: {
    fontSize: 18,
  },
  celiacTextWrap: {
    flex: 1,
  },
  celiacTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 2,
  },
  celiacSubtitle: {
    fontSize: 13,
    color: '#6b7280',
    lineHeight: 18,
  },
  celiacNote: {
    marginTop: 10,
    backgroundColor: '#fffbeb',
    borderRadius: 8,
    padding: 8,
  },
  celiacNoteText: {
    fontSize: 12,
    color: '#92400e',
    lineHeight: 16,
  },
  footer: {
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.lg,
    paddingBottom: spacing.xxl,
    backgroundColor: 'transparent',
  },
  doneBtn: {
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
})
