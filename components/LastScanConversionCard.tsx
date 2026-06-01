import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native'
import { useState } from 'react'
import { Ionicons } from '@expo/vector-icons'
import type { PaywallContext } from '../lib/buildPaywallContext'
import { colors, radius, spacing, typography } from '../constants/theme'
import { showPaywall, trackUpgradeCtaTapped } from '../services/paywallService'

type Props = {
  context: PaywallContext
  onDismiss?: () => void
}

export function LastScanConversionCard({ context, onDismiss }: Props) {
  const [loading, setLoading] = useState(false)

  const onUpgrade = async () => {
    setLoading(true)
    try {
      await trackUpgradeCtaTapped('last_scan_product_card', context)
      await showPaywall({
        context,
        skipContextAlert: true,
        metricSource: 'last_scan_product_card',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Ionicons name="diamond-outline" size={22} color={colors.accent} />
        <Text style={styles.kicker}>Free scans used</Text>
        {onDismiss ? (
          <Pressable onPress={onDismiss} hitSlop={10} accessibilityLabel="Dismiss">
            <Ionicons name="close" size={20} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>
      <Text style={styles.headline}>
        You decoded {context.productName ?? 'this product'} — keep going with Premium
      </Text>
      {context.verdict ? <Text style={styles.verdict}>{context.verdict}</Text> : null}
      {(context.flaggedIngredientCount ?? 0) > 0 ? (
        <Text style={styles.stat}>
          {context.flaggedIngredientCount} ingredient
          {context.flaggedIngredientCount === 1 ? '' : 's'} flagged for your profile
        </Text>
      ) : null}
      {context.profileLabels && context.profileLabels.length > 0 ? (
        <Text style={styles.profile}>
          Unlock unlimited scans for {context.profileLabels.join(', ')}
        </Text>
      ) : null}
      <Pressable
        onPress={() => void onUpgrade()}
        disabled={loading}
        style={({ pressed }) => [styles.cta, pressed && { opacity: 0.9 }, loading && { opacity: 0.7 }]}
        accessibilityRole="button"
        accessibilityLabel="Upgrade to Fillr Premium"
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Ionicons name="diamond" size={16} color="#fff" />
            <Text style={styles.ctaText}>Upgrade to Fillr Premium</Text>
          </>
        )}
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.xl,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#86efac',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  kicker: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: colors.accent,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  headline: {
    ...typography.h3,
    fontSize: 18,
    color: colors.text,
    marginBottom: spacing.sm,
    lineHeight: 24,
  },
  verdict: {
    fontSize: 15,
    fontWeight: '700',
    color: '#166534',
    marginBottom: 6,
  },
  stat: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  profile: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: spacing.md,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.accent,
    paddingVertical: 14,
    borderRadius: radius.lg,
  },
  ctaText: { fontSize: 15, fontWeight: '800', color: '#fff' },
})
