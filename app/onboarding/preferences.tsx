import { useState } from 'react'
import { View, Text, StyleSheet, ScrollView, Pressable, Switch } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import {
  FillrButton,
  GlassChip,
  GlassProgressBar,
  GradientBackground,
} from '../../components'
import { Ionicons } from '@expo/vector-icons'
import { colors, spacing, typography } from '../../constants/theme'
import { PREFERENCE_OPTIONS } from '../../types'
import { useUserStore } from '../../store/userStore'

export default function OnboardingPreferences() {
  const initialCeliac = useUserStore.getState().celiacStrictGluten
  const [selected, setSelected] = useState<string[]>(
    useUserStore.getState().preferences
  )
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
    <GradientBackground variant="minimal">
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.navRow}>
        <Pressable
          onPress={() => router.push('/onboarding/sensitivities')}
          hitSlop={10}
          style={({ pressed }) => [styles.backBtn, pressed && styles.backBtnPressed]}
          accessibilityRole="button"
          accessibilityLabel="Back to previous question"
        >
          <Ionicons name="chevron-back" size={20} color={colors.textSecondary} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>
      </View>
      <GlassProgressBar total={7} current={4} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.step}>Step 4 of 7</Text>
        <Text style={styles.title}>Preferences</Text>
        <Text style={styles.helper}>
          We'll highlight products that match your diet
        </Text>
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
        <View style={styles.chips}>
          {PREFERENCE_OPTIONS.map((opt) => (
            <GlassChip
              key={opt.key}
              label={opt.label}
              selected={selected.includes(opt.key)}
              variant="safe"
              onPress={() => toggle(opt.key)}
            />
          ))}
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
    paddingTop: spacing.xxl,
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
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
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
})
