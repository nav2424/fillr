import { useEffect, useMemo, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as Linking from 'expo-linking'
import { router } from 'expo-router'
import { useAuthStore } from '../store/authStore'
import { useUserStore } from '../store/userStore'
import {
  setOnboardingCompletedOnServer,
  signInWithEmail,
  signOutSupabase,
} from '../lib/authService'
import { logInToRevenueCat } from '../services/revenuecatService'
import { PRIVACY_POLICY_URL, TERMS_OF_SERVICE_URL } from '../constants/legalUrls'
import { wa } from '../constants/welcomeAuthTheme'
import { WelcomeTopBar, HeroScanSection, AuthCard, CTAInfoCard } from '../components/welcomeAuth'

export default function WelcomeScreen() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const setAuth = useAuthStore((s) => s.setAuth)
  const setOnboardingComplete = useAuthStore((s) => s.setOnboardingFromServer)
  const setReferralData = useUserStore((s) => s.setReferralData)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)
  const [loading, setLoading] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/')
    }
  }, [isAuthenticated])

  const emailInvalid = useMemo(() => {
    if (!email.trim()) return false
    return !/^\S+@\S+\.\S+$/.test(email.trim())
  }, [email])

  const openUrl = (url: string) => {
    void Linking.openURL(url)
  }

  const handleContinue = async () => {
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
    Keyboard.dismiss()
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
      void logInToRevenueCat(userId)
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
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.flex}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
          <ScrollView
            style={styles.flex}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.inner}>
              <WelcomeTopBar />
              <HeroScanSection />
              <View style={styles.authBlock}>
                <AuthCard
                  email={email}
                  password={password}
                  onChangeEmail={(t) => {
                    setEmail(t)
                    if (formError) setFormError(null)
                  }}
                  onChangePassword={(t) => {
                    setPassword(t)
                    if (formError) setFormError(null)
                  }}
                  showPassword={showPassword}
                  onTogglePassword={() => setShowPassword((v) => !v)}
                  rememberMe={rememberMe}
                  onToggleRememberMe={() => setRememberMe((v) => !v)}
                  onContinue={() => void handleContinue()}
                  onForgotPassword={() => router.push('/forgot-password')}
                  loading={loading}
                  formError={formError}
                  emailInvalid={emailInvalid}
                />
              </View>
              <CTAInfoCard onPress={() => router.push('/onboarding')} />
              <View style={styles.footer}>
                <Text style={styles.legal}>
                  <Text
                    onPress={() => openUrl(TERMS_OF_SERVICE_URL)}
                    style={styles.legalLink}
                    accessibilityRole="link"
                  >
                    Terms
                  </Text>
                  <Text style={styles.legalSep}> · </Text>
                  <Text
                    onPress={() => openUrl(PRIVACY_POLICY_URL)}
                    style={styles.legalLink}
                    accessibilityRole="link"
                  >
                    Privacy
                  </Text>
                </Text>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: wa.bg,
  },
  safe: {
    flex: 1,
    backgroundColor: wa.bg,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  inner: {
    paddingHorizontal: wa.padX,
    paddingTop: 16,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
    alignItems: 'stretch',
  },
  /** Clear separation between marketing hero and sign-in card */
  authBlock: {
    marginTop: 36,
  },
  footer: {
    marginTop: 14,
    paddingBottom: 6,
    alignItems: 'center',
  },
  legal: {
    fontSize: 12,
    fontWeight: '500',
    color: wa.muted,
    textAlign: 'center',
    lineHeight: 18,
  },
  legalLink: {
    color: wa.slate,
    fontWeight: '600',
  },
  legalSep: {
    color: 'rgba(148, 163, 184, 0.9)',
  },
})
