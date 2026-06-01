import { View, Text, StyleSheet, Pressable } from 'react-native'
import { colors, radius, spacing } from '../constants/theme'
import { conversionUi } from './conversion/conversionUi'
import { buildPaywallContextAtLimit } from '../lib/buildPaywallContext'
import { showPaywall, trackUpgradeCtaTapped } from '../services/paywallService'

type Props = {
  onDismiss?: () => void
  variant?: 'light' | 'dark'
}

export function OneScanLeftBanner({ onDismiss, variant = 'light' }: Props) {
  const dark = variant === 'dark'

  return (
    <View style={[styles.wrap, dark ? conversionUi.darkCard : conversionUi.lightCard]}>
      <View style={styles.copy}>
        <Text style={[conversionUi.caption, dark && conversionUi.captionOnDark]}>Free plan</Text>
        <Text style={[conversionUi.title, dark && conversionUi.titleOnDark]}>1 scan left</Text>
        <Text style={[conversionUi.body, dark && conversionUi.bodyOnDark]}>
          Upgrade anytime for unlimited scans.
        </Text>
      </View>
      <View style={styles.actions}>
        <Pressable
          onPress={() => {
            void trackUpgradeCtaTapped('one_scan_left_banner')
            void showPaywall({
              context: buildPaywallContextAtLimit('one_scan_left'),
              metricSource: 'one_scan_left_banner',
            })
          }}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="View Premium plans"
        >
          <Text style={[conversionUi.textLink, dark && conversionUi.textLinkOnDark]}>Premium</Text>
        </Pressable>
        {onDismiss ? (
          <Pressable onPress={onDismiss} hitSlop={12} accessibilityLabel="Dismiss">
            <Text style={[styles.dismiss, dark && styles.dismissDark]}>×</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  copy: { flex: 1, gap: 2 },
  actions: {
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingTop: 2,
  },
  dismiss: {
    fontSize: 22,
    lineHeight: 22,
    fontWeight: '300',
    color: colors.textMuted,
  },
  dismissDark: { color: 'rgba(255,255,255,0.5)' },
})
