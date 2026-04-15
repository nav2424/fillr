import { useMemo, useState } from 'react'
import { View, Text, StyleSheet, TextInput, Pressable, KeyboardAvoidingView, Platform } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import { FillrButton } from '../components'
import { colors, spacing, typography } from '../constants/theme'
import { sendEmailVerificationCode, setOnboardingCompletedOnServer, verifyEmailWithCode } from '../lib/authService'
import { useAuthStore } from '../store/authStore'
import { useUserStore } from '../store/userStore'
import { syncPremiumStatusFromRevenueCat } from '../services/revenuecatService'

export default function VerifyEmailScreen() {
  const params = useLocalSearchParams<{ email?: string }>()
  const email = String(params.email ?? '').trim()
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  const setAuth = useAuthStore((s) => s.setAuth)
  const setOnboardingComplete = useAuthStore((s) => s.setOnboardingComplete)
  const setReferralData = useUserStore((s) => s.setReferralData)

  const normalizedCode = useMemo(() => code.replace(/\D/g, '').slice(0, 6), [code])

  const handleVerify = async () => {
    setError(null)
    setInfo(null)

    if (!email) {
      setError('Missing email address. Please sign up again.')
      return
    }
    if (normalizedCode.length !== 6) {
      setError('Enter the 6-digit code from your email.')
      return
    }

    setLoading(true)
    try {
      const { userId, profile, resolvedFullName } = await verifyEmailWithCode({
        email,
        code: normalizedCode,
      })
      setAuth({
        id: userId,
        email: email.trim(),
        fullName: resolvedFullName,
      })
      setReferralData({
        referralCode: profile?.referral_code ?? '',
        referredBy: profile?.referred_by ?? null,
        bonusScansEarned: profile?.bonus_scans_earned ?? 0,
        totalScansUsed: profile?.total_scans_used ?? 0,
        isPro: profile?.is_pro ?? false,
        lifetimePro: profile?.lifetime_pro ?? false,
      })
      void syncPremiumStatusFromRevenueCat()
      await setOnboardingCompletedOnServer(userId)
      setOnboardingComplete(true)
      useUserStore.getState().clearOnboardingDraft()
      router.replace({
        pathname: '/onboarding/disclaimer',
        params: {
          next: profile?.referred_by ? 'referral-success' : 'tabs',
        },
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Verification failed. Please try again.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const handleResendCode = async () => {
    setError(null)
    setInfo(null)
    if (!email) {
      setError('Missing email address. Please sign up again.')
      return
    }
    setResending(true)
    try {
      await sendEmailVerificationCode(email)
      setInfo('We sent a new 6-digit code to your email.')
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not resend code. Please try again.'
      setError(msg)
    } finally {
      setResending(false)
    }
  }

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboard}
        >
          <View style={styles.header}>
            <Text style={styles.title}>Verify your email</Text>
            <Text style={styles.subtitle}>
              Enter the 6-digit code sent to {email || 'your email'}.
            </Text>
          </View>

          <View style={styles.form}>
            <TextInput
              style={styles.codeInput}
              value={normalizedCode}
              onChangeText={(text) => {
                setCode(text)
                if (error) setError(null)
              }}
              placeholder="000000"
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              autoComplete="one-time-code"
              maxLength={6}
            />
            {!!error && <Text style={styles.errorText}>{error}</Text>}
            {!!info && <Text style={styles.infoText}>{info}</Text>}
          </View>

          <View style={styles.actions}>
            <FillrButton
              title={loading ? 'Verifying...' : 'Verify email'}
              onPress={handleVerify}
              disabled={loading || normalizedCode.length !== 6}
              fullWidth
            />
            <Pressable
              onPress={handleResendCode}
              disabled={resending || loading}
              style={styles.resendBtn}
            >
              <Text style={styles.resendText}>
                {resending ? 'Sending code...' : 'Resend code'}
              </Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f8fdf9',
  },
  container: {
    flex: 1,
    paddingHorizontal: spacing.xxl,
  },
  keyboard: {
    flex: 1,
    justifyContent: 'center',
  },
  header: {
    marginBottom: spacing.xl,
  },
  title: {
    ...typography.h1,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
  },
  form: {
    gap: spacing.sm,
  },
  codeInput: {
    height: 56,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#d1d5db',
    backgroundColor: '#ffffff',
    textAlign: 'center',
    letterSpacing: 12,
    fontSize: 26,
    fontWeight: '700',
    color: colors.text,
    paddingHorizontal: spacing.md,
  },
  actions: {
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
  resendBtn: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  resendText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  errorText: {
    ...typography.bodySmall,
    color: colors.danger,
  },
  infoText: {
    ...typography.bodySmall,
    color: '#16a34a',
  },
})
