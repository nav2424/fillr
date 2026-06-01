import { View, Text, StyleSheet, Pressable } from 'react-native'
import type { PaywallContext } from '../lib/buildPaywallContext'
import { colors, spacing } from '../constants/theme'
import { conversionUi } from './conversion/conversionUi'
import { FillrButton } from './FillrButton'
import { showPaywall, trackUpgradeCtaTapped } from '../services/paywallService'

type Props = {
  context: PaywallContext
  onDismiss?: () => void
}

export function LastScanConversionCard({ context, onDismiss }: Props) {
  const productName = context.productName ?? 'this product'
  const detailParts: string[] = []
  if (context.verdict) detailParts.push(context.verdict)
  if ((context.flaggedIngredientCount ?? 0) > 0) {
    detailParts.push(
      `${context.flaggedIngredientCount} flagged for your profile`
    )
  }

  return (
    <View style={[styles.wrap, conversionUi.lightCard]}>
      <View style={styles.topRow}>
        <Text style={conversionUi.caption}>All free scans used</Text>
        {onDismiss ? (
          <Pressable onPress={onDismiss} hitSlop={12} accessibilityLabel="Dismiss">
            <Text style={styles.dismiss}>×</Text>
          </Pressable>
        ) : null}
      </View>
      <Text style={styles.headline}>
        You decoded {productName}
      </Text>
      <Text style={conversionUi.body}>
        {detailParts.length > 0 ? detailParts.join(' · ') : 'Keep decoding every label with Premium.'}
      </Text>
      {context.profileLabels && context.profileLabels.length > 0 ? (
        <Text style={styles.profile} numberOfLines={2}>
          Unlimited scans for {context.profileLabels.join(', ')}
        </Text>
      ) : null}
      <FillrButton
        title="Continue with Premium"
        onPress={() => {
          void trackUpgradeCtaTapped('last_scan_product_card', context)
          void showPaywall({
            context,
            skipContextAlert: true,
            metricSource: 'last_scan_product_card',
          })
        }}
        variant="liquid"
        fullWidth
        style={styles.cta}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dismiss: {
    fontSize: 22,
    lineHeight: 22,
    fontWeight: '300',
    color: colors.textMuted,
  },
  headline: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text,
    lineHeight: 24,
    letterSpacing: -0.2,
  },
  profile: {
    ...conversionUi.body,
    marginTop: -2,
  },
  cta: { marginTop: spacing.xs },
})
