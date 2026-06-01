import { useState } from 'react'
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { REFERRAL_REFERRER_BONUS } from '../constants/subscription'
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
    <View style={[styles.card, glass && styles.cardGlass]}>
      <Text style={[styles.title, glass && styles.titleGlass]}>No scans left</Text>
      <Text style={[styles.body, glass && styles.bodyGlass]}>
        Upgrade for unlimited decoding, or invite a friend for {REFERRAL_REFERRER_BONUS} bonus scans each.
      </Text>
      <Pressable
        onPress={() => void onUpgrade()}
        disabled={upgrading}
        style={({ pressed }) => [styles.primaryCta, pressed && { opacity: 0.9 }, upgrading && { opacity: 0.7 }]}
        accessibilityRole="button"
        accessibilityLabel="Get Fillr Premium"
      >
        {upgrading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Ionicons name="diamond-outline" size={16} color="#ffffff" />
            <Text style={styles.primaryCtaText}>Get Fillr Premium</Text>
          </>
        )}
      </Pressable>
      <Pressable
        onPress={() => void onShareReferral()}
        disabled={sharing}
        style={({ pressed }) => [styles.secondaryCta, pressed && { opacity: 0.9 }, sharing && { opacity: 0.7 }]}
        accessibilityRole="button"
        accessibilityLabel="Share referral link"
      >
        <Ionicons name="gift-outline" size={16} color={glass ? '#ffffff' : '#166534'} />
        <Text style={[styles.secondaryCtaText, glass && styles.secondaryCtaTextGlass]}>
          {sharing ? 'Opening share…' : `Share invite — +${REFERRAL_REFERRER_BONUS} scans per friend`}
        </Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    padding: 18,
    gap: 12,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  cardGlass: {
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderColor: 'rgba(255,255,255,0.22)',
  },
  title: { fontSize: 18, fontWeight: '800', color: '#0a0a0a' },
  titleGlass: { color: '#ffffff' },
  body: { fontSize: 14, fontWeight: '500', color: '#4b5563', lineHeight: 20 },
  bodyGlass: { color: 'rgba(255,255,255,0.88)' },
  primaryCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#16a34a',
    paddingVertical: 14,
    borderRadius: 14,
  },
  primaryCtaText: { fontSize: 15, fontWeight: '800', color: '#fff' },
  secondaryCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#86efac',
    backgroundColor: '#ecfdf5',
  },
  secondaryCtaText: { fontSize: 14, fontWeight: '700', color: '#166534' },
  secondaryCtaTextGlass: { color: '#ffffff' },
})
