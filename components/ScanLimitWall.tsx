import { useState } from 'react'
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native'
import { REFERRAL_REFERRER_BONUS } from '../constants/subscription'
import { colors, spacing } from '../constants/theme'
import { conversionUi } from './conversion/conversionUi'
import { buildPaywallContextAtLimit } from '../lib/buildPaywallContext'
import { ensureReferralCodeForUser } from '../lib/authService'
import { shareReferralLink } from '../lib/referrals'
import { showPaywall, trackUpgradeCtaTapped } from '../services/paywallService'
import { trackScanResultMetric } from '../lib/scanResultMetrics'
import { useAuthStore } from '../store/authStore'
import { useUserStore } from '../store/userStore'

type Props = {
  variant?: 'glass' | 'light'
}

export function ScanLimitWall({ variant = 'glass' }: Props) {
  const glass = variant === 'glass'
  const userId = useAuthStore((s) => s.userId)
  const referralCode = useUserStore((s) => s.referralCode)
  const setReferralData = useUserStore((s) => s.setReferralData)
  const [sharing, setSharing] = useState(false)
  const [upgrading, setUpgrading] = useState(false)

  const onUpgrade = async () => {
    setUpgrading(true)
    try {
      const ctx = buildPaywallContextAtLimit('scan_blocked')
      await trackUpgradeCtaTapped('scan_limit_empty', ctx)
      await showPaywall({ context: ctx, metricSource: 'scan_limit_empty' })
    } finally {
      setUpgrading(false)
    }
  }

  const onShareReferral = async () => {
    if (sharing) return
    setSharing(true)
    try {
      void trackScanResultMetric({ name: 'referral_cta_at_limit' })
      let code = referralCode?.trim() || ''
      if (!code && userId) {
        code = (await ensureReferralCodeForUser(userId)) ?? ''
        if (code) setReferralData({ referralCode: code })
      }
      if (!code) return
      await shareReferralLink(code)
    } finally {
      setSharing(false)
    }
  }

  return (
    <View style={[styles.wrap, glass && styles.wrapGlass]}>
      <Text style={[conversionUi.title, glass && conversionUi.titleOnDark]}>Out of scans</Text>
      <Text style={[conversionUi.body, glass && conversionUi.bodyOnDark]}>
        Go Premium for unlimited decoding, or invite a friend for {REFERRAL_REFERRER_BONUS} bonus scans.
      </Text>
      <Pressable
        onPress={() => void onUpgrade()}
        disabled={upgrading}
        style={({ pressed }) => [
          styles.primaryBtn,
          glass && styles.primaryBtnGlass,
          pressed && { opacity: 0.92 },
          upgrading && { opacity: 0.6 },
        ]}
        accessibilityRole="button"
        accessibilityLabel="View Premium plans"
      >
        {upgrading ? (
          <ActivityIndicator color={glass ? colors.text : '#fff'} size="small" />
        ) : (
          <Text style={[styles.primaryBtnText, glass && styles.primaryBtnTextGlass]}>Premium</Text>
        )}
      </Pressable>
      <Pressable
        onPress={() => void onShareReferral()}
        disabled={sharing}
        hitSlop={6}
        style={({ pressed }) => [pressed && { opacity: 0.7 }, sharing && { opacity: 0.5 }]}
        accessibilityRole="button"
        accessibilityLabel="Share invite link"
      >
        <Text style={[conversionUi.textLink, glass && conversionUi.textLinkOnDark]}>
          {sharing ? 'Opening…' : `Invite a friend (+${REFERRAL_REFERRER_BONUS} scans)`}
        </Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.md,
    padding: 0,
  },
  wrapGlass: {
    padding: 0,
  },
  primaryBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm + 2,
    borderRadius: 999,
    backgroundColor: colors.accent,
  },
  primaryBtnGlass: {
    backgroundColor: colors.backgroundElevated,
  },
  primaryBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  primaryBtnTextGlass: {
    color: colors.text,
  },
})
