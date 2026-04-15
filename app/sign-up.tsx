import { useEffect, useMemo, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import * as Linking from 'expo-linking'
import { Link, router, useGlobalSearchParams, useLocalSearchParams } from 'expo-router'
import { FillrButton } from '../components'
import { colors, spacing, typography } from '../constants/theme'
import { looksLikeReferralCode, normalizeReferralCode, getRefFromUrl } from '../lib/referrals'
import {
  signUpWithEmail,
  validateReferralCodeOnServer,
} from '../lib/authService'
import { hasMeaningfulLocalDietProfile } from '../lib/onboardingProfile'
import {
  clearPendingSignupAfterOnboarding,
  isPendingSignupAfterOnboarding,
} from '../lib/pendingSignup'
import { useAuthStore } from '../store/authStore'
import { useUserStore } from '../store/userStore'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getUserProfileOrNull } = require('../store/userProfileStore.js') as {
  getUserProfileOrNull: () => Promise<{
    allergies: string[]
    sensitivities: string[]
    avoiding: string[]
    preferences: string[]
  } | null>
}

export default function SignUpScreen() {
  const params = useLocalSearchParams<{ ref?: string }>()
  const globalParams = useGlobalSearchParams<{ ref?: string }>()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [referralCode, setReferralCode] = useState('')
  const [referralTouched, setReferralTouched] = useState(false)
  const [referralLocked, setReferralLocked] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [referralError, setReferralError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const normalizedRef = useMemo(() => normalizeReferralCode(referralCode), [referralCode])
  const referralFormatValid = normalizedRef.length > 0 && looksLikeReferralCode(normalizedRef)

  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/')
    }
  }, [isAuthenticated])

  useEffect(() => {
    if (isAuthenticated) return
    let alive = true
    void (async () => {
      if (await isPendingSignupAfterOnboarding()) {
        if (!alive) return
        return
      }
      const profile = await getUserProfileOrNull()
      const u = useUserStore.getState()
      const fromDisk = hasMeaningfulLocalDietProfile(profile)
      const fromStore =
        Boolean(u.goal) ||
        u.allergies.length > 0 ||
        u.sensitivities.length > 0 ||
        u.preferences.length > 0
      if (!alive) return
      if (!fromDisk && !fromStore) {
        router.replace('/onboarding')
      }
    })()
    return () => {
      alive = false
    }
  }, [isAuthenticated])

  useEffect(() => {
    const raw = params.ref ?? globalParams.ref
    const fromParam = raw ? normalizeReferralCode(String(raw)) : ''
    if (fromParam && looksLikeReferralCode(fromParam)) {
      setReferralCode(fromParam)
      setReferralLocked(true)
      setReferralTouched(true)
    }
  }, [params.ref, globalParams.ref])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      const url = await Linking.getInitialURL()
      const ref = getRefFromUrl(url)
      if (!mounted || !ref) return
      setReferralCode(ref)
      setReferralLocked(true)
      setReferralTouched(true)
    })()
    const sub = Linking.addEventListener('url', ({ url }) => {
      const ref = getRefFromUrl(url)
      if (!ref) return
      setReferralCode(ref)
      setReferralLocked(true)
      setReferralTouched(true)
    })
    return () => {
      mounted = false
      sub.remove()
    }
  }, [])

  const handleSignUp = async () => {
    setFormError(null)
    setReferralError(null)
    if (!email.trim() || !password.trim() || !fullName.trim()) {
      setFormError('Please fill in all required fields.')
      return
    }
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setFormError('Please enter a valid email address.')
      return
    }
    const hasLower = /[a-z]/.test(password)
    const hasUpper = /[A-Z]/.test(password)
    const hasNumber = /\d/.test(password)
    const hasSymbol = /[^A-Za-z0-9]/.test(password)
    if (password.length < 8) {
      setFormError('Password must be at least 8 characters.')
      return
    }
    if (!hasLower || !hasUpper || !hasNumber || !hasSymbol) {
      setFormError('Use a strong password: upper, lower, number, and symbol.')
      return
    }
    if (password !== confirmPassword) {
      setFormError('Passwords do not match.')
      return
    }
    if (normalizedRef && !looksLikeReferralCode(normalizedRef)) {
      setReferralTouched(true)
      setReferralError('Invalid code format — check and try again')
      return
    }

    setLoading(true)
    try {
      if (normalizedRef) {
        const valid = await validateReferralCodeOnServer(normalizedRef)
        if (!valid) {
          setReferralError('Code not found — double check with your friend')
          return
        }
      }

      await signUpWithEmail({
        email: email.trim(),
        password,
        fullName: fullName.trim(),
        referralCode: normalizedRef || null,
      })
      router.replace({
        pathname: '/verify-email',
        params: { email: email.trim() },
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Account creation failed. Please try again.'
      setFormError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboard}
      >
        <Text style={styles.logo}>fillr</Text>
        {referralLocked && (
          <View style={styles.invitedBanner}>
            <Text style={styles.invitedTitle}>🎁 You were invited to Fillr</Text>
            <Text style={styles.invitedSub}>Sign up to claim your 3 bonus scans</Text>
          </View>
        )}
        <View style={styles.header}>
          <Text style={styles.title}>Create your account</Text>
          <Text style={styles.subtitle}>
            Save your preferences with your name, email, and password. We will verify your email next.
          </Text>
        </View>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Full name"
            placeholderTextColor={colors.textMuted}
            value={fullName}
            onChangeText={setFullName}
            autoCapitalize="words"
            autoCorrect={false}
          />
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={colors.textMuted}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor={colors.textMuted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
          <Text style={styles.passwordHelp}>
            Password must be 8+ chars and include an uppercase letter, a lowercase letter,
            a number, and a symbol.
          </Text>
          <TextInput
            style={styles.input}
            placeholder="Confirm password"
            placeholderTextColor={colors.textMuted}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
          />

          <View style={styles.referralWrap}>
            <Text style={styles.referralPrompt}>
              🎁 Get 3 bonus scans when you sign up with a friend's code
            </Text>
            <Text style={styles.referralLabel}>Have a referral code? (optional)</Text>
            <View
              style={[
                styles.referralInputWrap,
                referralFormatValid && styles.referralInputValid,
                referralTouched && normalizedRef.length > 0 && !referralFormatValid && styles.referralInputInvalid,
                referralLocked && styles.referralInputLocked,
              ]}
            >
              <TextInput
                style={styles.referralInput}
                placeholder="e.g. FLR-K7NP"
                placeholderTextColor={colors.textMuted}
                value={referralCode}
                onChangeText={(t) => {
                  if (referralLocked) return
                  setReferralCode(t.toUpperCase())
                  setReferralError(null)
                }}
                onBlur={() => setReferralTouched(true)}
                autoCapitalize="characters"
                autoCorrect={false}
                editable={!referralLocked}
              />
              {referralLocked ? (
                <Ionicons name="lock-closed" size={18} color="#16a34a" />
              ) : referralFormatValid ? (
                <Ionicons name="checkmark-circle" size={18} color="#16a34a" />
              ) : null}
            </View>
            {referralLocked ? (
              <Text style={styles.referralValid}>Applied automatically</Text>
            ) : referralFormatValid ? (
              <Text style={styles.referralValid}>✓ Valid code — you'll get 3 bonus scans on signup</Text>
            ) : referralTouched && normalizedRef.length > 0 ? (
              <Text style={styles.referralInvalid}>Invalid code format — check and try again</Text>
            ) : null}
            {!!referralError && <Text style={styles.referralInvalid}>{referralError}</Text>}
          </View>
          {!!formError && <Text style={styles.formError}>{formError}</Text>}
        </View>

        <View style={styles.actions}>
          <FillrButton
            title={loading ? 'Creating...' : 'Create account'}
            onPress={handleSignUp}
            disabled={loading}
            fullWidth
            variant="primary"
          />

          <Link href="/login" asChild>
            <Pressable style={styles.linkBtn}>
              <Text style={styles.linkText}>Already have an account? Sign in →</Text>
            </Pressable>
          </Link>
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
  },
  header: {
    marginBottom: spacing.xl,
  },
  logo: {
    marginTop: spacing.lg,
    textAlign: 'center',
    fontSize: 32,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -1,
    marginBottom: spacing.lg,
  },
  invitedBanner: {
    marginBottom: spacing.xl,
    borderRadius: 16,
    padding: 16,
    backgroundColor: '#22c55e',
  },
  invitedTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 4,
  },
  invitedSub: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
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
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  input: {
    height: 52,
    paddingHorizontal: spacing.lg,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    color: colors.text,
    ...typography.body,
  },
  passwordHelp: {
    marginTop: -spacing.sm,
    marginBottom: spacing.md,
    ...typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  referralWrap: {
    marginTop: 8,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 16,
    padding: 16,
  },
  referralPrompt: {
    fontSize: 13,
    color: '#16a34a',
    fontWeight: '600',
    marginBottom: 10,
  },
  referralLabel: {
    fontSize: 13,
    color: '#166534',
    marginBottom: 8,
  },
  referralInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
  },
  referralInputValid: {
    borderColor: '#22c55e',
  },
  referralInputInvalid: {
    borderColor: '#ef4444',
  },
  referralInputLocked: {
    backgroundColor: '#f8fafc',
  },
  referralInput: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
  },
  referralValid: {
    marginTop: 8,
    fontSize: 13,
    color: '#16a34a',
  },
  referralInvalid: {
    marginTop: 8,
    fontSize: 13,
    color: '#ef4444',
  },
  formError: {
    fontSize: 13,
    color: '#ef4444',
  },
  actions: {
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  linkBtn: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  linkText: {
    ...typography.body,
    color: colors.textSecondary,
  },
})
