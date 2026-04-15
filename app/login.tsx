import { useMemo, useState } from 'react'
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
import { FillrButton } from '../components'
import { Link, router } from 'expo-router'
import { useAuthStore } from '../store/authStore'
import { colors, spacing, typography } from '../constants/theme'
import {
  setOnboardingCompletedOnServer,
  signInWithEmail,
  signOutSupabase,
} from '../lib/authService'
import { useUserStore } from '../store/userStore'
import { syncPremiumStatusFromRevenueCat } from '../services/revenuecatService'

/** Same shell as `sign-up.tsx` (plain View + KAV). Blur/card/ScrollView stacks broke TextInput on iOS Simulator. */
export default function LoginScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [focusedField, setFocusedField] = useState<'email' | 'password' | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const setAuth = useAuthStore((s) => s.setAuth)
  const setOnboardingComplete = useAuthStore((s) => s.setOnboardingFromServer)
  const setReferralData = useUserStore((s) => s.setReferralData)

  const emailIsValid = useMemo(() => {
    if (!email.trim()) return true
    return /^\S+@\S+\.\S+$/.test(email.trim())
  }, [email])

  const handleLogin = async () => {
    setFormError(null)

    const trimmedEmail = email.trim()
    const trimmedPassword = password.trim()

    if (!trimmedEmail || !trimmedPassword) {
      setFormError('Please enter your email and password.')
      return
    }

    if (!/^\S+@\S+\.\S+$/.test(trimmedEmail)) {
      setFormError('Please enter a valid email address.')
      return
    }

    setLoading(true)
    try {
      const { userId, profile, resolvedFullName, emailVerified } = await signInWithEmail({
        email: trimmedEmail,
        password: trimmedPassword,
      })
      if (!profile) {
        await signOutSupabase()
        setFormError('Could not load your profile. Check your connection and try again.')
        return
      }
      setAuth({
        id: userId,
        email: trimmedEmail,
        fullName: resolvedFullName,
      })
      // Anyone who can sign in with a verified email and a profile row has finished signup;
      // `onboarding_completed` is sometimes still false in DB (legacy / failed writes) — don’t trap them in onboarding.
      const onboardingDone =
        profile.onboarding_completed === true || (emailVerified && Boolean(profile.id))
      if (onboardingDone && profile.onboarding_completed !== true) {
        void setOnboardingCompletedOnServer(userId)
      }
      setOnboardingComplete(onboardingDone)
      setReferralData({
        referralCode: profile.referral_code ?? '',
        referredBy: profile.referred_by ?? null,
        bonusScansEarned: profile.bonus_scans_earned ?? 0,
        totalScansUsed: profile.total_scans_used ?? 0,
        isPro: profile.is_pro ?? false,
        lifetimePro: profile.lifetime_pro ?? false,
      })
      void syncPremiumStatusFromRevenueCat()
      if (!onboardingDone) {
        useUserStore.getState().clearOnboardingDraft()
      }
      router.replace('/')
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Sign in failed. Please try again.'
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
          <View style={styles.middle}>
          <View style={styles.contentWrap}>
          <View style={styles.header}>
            <Text style={styles.title}>Welcome back</Text>
            <Text style={styles.subtitle}>Sign in to continue</Text>
          </View>

          <View style={styles.form}>
            <TextInput
              style={[
                styles.input,
                focusedField === 'email' && styles.inputFocused,
                !emailIsValid && email.trim().length > 0 && styles.inputError,
              ]}
              placeholder="Email"
              placeholderTextColor={colors.textMuted}
              value={email}
              onChangeText={(t) => {
                setEmail(t)
                if (formError) setFormError(null)
              }}
              keyboardType="email-address"
              textContentType="emailAddress"
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
              onFocus={() => setFocusedField('email')}
              onBlur={() => setFocusedField((v) => (v === 'email' ? null : v))}
            />

            <View style={styles.passwordWrap}>
              <TextInput
                style={[
                  styles.input,
                  styles.inputPassword,
                  focusedField === 'password' && styles.inputFocused,
                ]}
                placeholder="Password"
                placeholderTextColor={colors.textMuted}
                value={password}
                onChangeText={(t) => {
                  setPassword(t)
                  if (formError) setFormError(null)
                }}
                secureTextEntry={!showPassword}
                textContentType="password"
                autoComplete="password"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
                onFocus={() => setFocusedField('password')}
                onBlur={() => setFocusedField((v) => (v === 'password' ? null : v))}
              />
              <Pressable
                onPress={() => setShowPassword((v) => !v)}
                accessibilityRole="button"
                accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                hitSlop={12}
                style={styles.eyeBtn}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={colors.textMuted}
                />
              </Pressable>
            </View>

            <Pressable onPress={() => router.push('/forgot-password')} style={styles.forgotInline}>
              <Text style={styles.forgotInlineText}>Forgot password?</Text>
            </Pressable>

            {(formError || (!emailIsValid && email.trim().length > 0)) && (
              <Text style={styles.errorText}>
                {formError ?? 'Please enter a valid email address.'}
              </Text>
            )}

            <View style={styles.actions}>
              <FillrButton
                title={loading ? 'Signing in...' : 'Sign in'}
                onPress={handleLogin}
                disabled={loading}
                fullWidth
                variant="primary"
              />

              <Link href="/onboarding" asChild>
                <Pressable style={styles.linkBtn}>
                  <Text style={styles.linkText}>New here? Create an account</Text>
                </Pressable>
              </Link>
            </View>
          </View>
          </View>
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
  middle: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'stretch',
  },
  contentWrap: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    transform: [{ translateY: spacing.xxxl + spacing.sm }],
    paddingBottom: spacing.xl,
  },
  logo: {
    marginTop: spacing.lg,
    textAlign: 'center',
    fontSize: 28,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.5,
    marginBottom: spacing.sm,
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
    gap: spacing.md,
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
  inputFocused: {
    borderColor: 'rgba(34, 197, 94, 0.55)',
  },
  inputError: {
    borderColor: 'rgba(255, 69, 58, 0.6)',
  },
  passwordWrap: {
    position: 'relative',
    justifyContent: 'center',
  },
  inputPassword: {
    paddingRight: 48,
  },
  eyeBtn: {
    position: 'absolute',
    right: spacing.xs,
    top: 0,
    bottom: 0,
    width: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    ...typography.bodySmall,
    color: colors.danger,
    marginTop: -spacing.sm,
  },
  actions: {
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  forgotInline: {
    alignSelf: 'flex-end',
    marginTop: -spacing.xs,
  },
  forgotInlineText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  linkBtn: {
    alignSelf: 'flex-end',
    paddingVertical: spacing.sm,
  },
  linkText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
})
