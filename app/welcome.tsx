import { View, Text, StyleSheet, Pressable } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Link } from 'expo-router'
import { GradientBackground } from '../components'
import { colors, spacing, typography } from '../constants/theme'

export default function WelcomeScreen() {
  return (
    <GradientBackground variant="welcome">
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.content}>
          <View style={styles.brandWrap}>
            <Text style={styles.brand}>fillr</Text>
            <View style={styles.brandLine} />
          </View>
          <Text style={styles.tagline}>Know what's filling your food.</Text>
          <Text style={styles.subtitle}>
            Scan barcodes. Understand ingredients. Make smarter choices.
          </Text>
        </View>

        <View style={styles.actions}>
          <Link href="/login" asChild>
            <Pressable style={({ pressed }) => [styles.getStartedBtn, pressed && styles.pressed]}>
              <Text style={styles.getStartedText}>Get started</Text>
            </Pressable>
          </Link>
        </View>
      </SafeAreaView>
    </GradientBackground>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing.xxl,
    justifyContent: 'space-between',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  brandWrap: {
    marginBottom: spacing.lg,
  },
  brand: {
    ...typography.display,
    color: colors.text,
    letterSpacing: -1,
  },
  brandLine: {
    width: 48,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.accent,
    marginTop: spacing.sm,
    opacity: 0.8,
  },
  tagline: {
    ...typography.h2,
    color: colors.text,
    marginBottom: spacing.md,
    maxWidth: 280,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    maxWidth: 320,
    lineHeight: 26,
  },
  actions: {
    paddingBottom: spacing.xxl,
    width: '100%',
    alignItems: 'flex-end',
  },
  getStartedBtn: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  getStartedText: {
    ...typography.label,
    fontSize: 16,
    color: colors.text,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.85,
  },
})
