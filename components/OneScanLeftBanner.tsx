import { View, Text, StyleSheet, Pressable } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { colors, radius, spacing, typography } from '../constants/theme'
import { buildPaywallContextAtLimit } from '../lib/buildPaywallContext'
import { showPaywall, trackUpgradeCtaTapped } from '../services/paywallService'

type Props = {
  onDismiss?: () => void
  variant?: 'light' | 'dark'
}

export function OneScanLeftBanner({ onDismiss, variant = 'light' }: Props) {
  const dark = variant === 'dark'

  return (
    <View style={[styles.wrap, dark && styles.wrapDark]}>
      <View style={styles.copy}>
        <Ionicons name="scan-outline" size={18} color={dark ? '#bbf7d0' : colors.accent} />
        <Text style={[styles.title, dark && styles.titleDark]}>1 free scan left</Text>
        <Text style={[styles.sub, dark && styles.subDark]}>Upgrade for unlimited decoding anytime.</Text>
      </View>
      <View style={styles.actions}>
        <Pressable
          onPress={() => {
            void trackUpgradeCtaTapped('one_scan_left_banner')
            const ctx = buildPaywallContextAtLimit('one_scan_left')
            void showPaywall({ context: ctx, metricSource: 'one_scan_left_banner' })
          }}
          style={({ pressed }) => [styles.upgradeBtn, pressed && { opacity: 0.88 }]}
          accessibilityRole="button"
          accessibilityLabel="Upgrade to Fillr Premium"
        >
          <Text style={styles.upgradeText}>Upgrade</Text>
        </Pressable>
        {onDismiss ? (
          <Pressable onPress={onDismiss} hitSlop={8} accessibilityRole="button" accessibilityLabel="Dismiss">
            <Ionicons name="close" size={20} color={dark ? '#d1d5db' : colors.textMuted} />
          </Pressable>
        ) : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  wrapDark: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderColor: 'rgba(255,255,255,0.2)',
  },
  copy: { flex: 1, gap: 2 },
  title: { ...typography.body, fontWeight: '800', color: colors.text },
  titleDark: { color: '#f0fdf4' },
  sub: { fontSize: 12, fontWeight: '500', color: colors.textSecondary, lineHeight: 16 },
  subDark: { color: '#d1d5db' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  upgradeBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.md,
  },
  upgradeText: { fontSize: 13, fontWeight: '800', color: '#fff' },
})
