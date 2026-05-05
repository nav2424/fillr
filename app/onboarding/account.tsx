import { useEffect, useMemo, useRef, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TextInput,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Linking from 'expo-linking'
import { Link, router, useGlobalSearchParams, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import {
  OnboardingLayout,
  ProgressHeader,
  PrimaryButton,
  TextInputField,
  FooterActionBar,
} from '../../components/onboarding'
import { ONBOARDING_STEP } from '../../constants/onboardingFlow'
import { ob, obType } from '../../constants/onboardingTheme'
import { looksLikeReferralCode, normalizeReferralCode, getRefFromUrl } from '../../lib/referrals'
import { signUpWithEmail, validateReferralCodeOnServer } from '../../lib/authService'
import { clearPendingSignupAfterOnboarding } from '../../lib/pendingSignup'
import { useAuthStore } from '../../store/authStore'

export default function OnboardingAccount() {
  const params = useLocalSearchParams<{ ref?: string }>()
  const globalParams = useGlobalSearchParams<{ ref?: string }>()
  const insets = useSafeAreaInsets()
  const scrollRef = useRef<ScrollView>(null)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [referralCode, setReferralCode] = useState('')
  const [referralTouched, setReferralTouched] = useState(false)
  const [referralLocked, setReferralLocked] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
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
    void (async () => {
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

  const handleCreate = async () => {
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
    if (password.length < 8 || !hasLower || !hasUpper || !hasNumber || !hasSymbol) {
      setFormError('Use a strong password: upper, lower, number, and symbol (8+ characters).')
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
      await clearPendingSignupAfterOnboarding()
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

  const scrollReferralIntoView = () => {
    const run = () => scrollRef.current?.scrollToEnd({ animated: true })
    requestAnimationFrame(run)
    setTimeout(run, 120)
    setTimeout(run, 400)
  }

  return (
    <View style={styles.screen}>
      <View style={styles.flex}>
      <OnboardingLayout edges={['top']}>
        <ProgressHeader
          stepIndex={ONBOARDING_STEP.account}
          onBack={() => router.push('/onboarding/summary')}
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.flex}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
        >
          <ScrollView
            ref={scrollRef}
            style={styles.flex}
            contentContainerStyle={[{ paddingBottom: 120 + insets.bottom }]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.title}>Create your account</Text>
            <Text style={[obType.body, styles.sub]}>
              Save your preferences so Fillr can personalize every scan.
            </Text>

            <TextInputField label="Full name" value={fullName} onChangeText={setFullName} autoCapitalize="words" />
            <TextInputField
              label="Email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <TextInputField
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              onToggleSecure={() => setShowPassword((s) => !s)}
              secureVisible={showPassword}
              helper="8+ characters with upper, lower, number, and symbol."
            />
            <TextInputField
              label="Confirm password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              autoCapitalize="none"
              onToggleSecure={() => setShowConfirm((s) => !s)}
              secureVisible={showConfirm}
            />

            <View style={styles.referralCard}>
              <Text style={styles.referralTitle}>Referral bonus</Text>
              <Text style={styles.referralSub}>Optional — 3 bonus scans when you join with a friend’s code.</Text>
              <View
                style={[
                  styles.referralRow,
                  referralFormatValid && styles.referralRowOk,
                  referralTouched && normalizedRef.length > 0 && !referralFormatValid && styles.referralRowBad,
                  referralLocked && styles.referralRowLocked,
                ]}
              >
                <TextInput
                  style={styles.referralInput}
                  placeholder="e.g. FLR-K7NP"
                  placeholderTextColor={ob.inkFaint}
                  value={referralCode}
                  onChangeText={(t) => {
                    if (referralLocked) return
                    setReferralCode(t.toUpperCase())
                    setReferralError(null)
                  }}
                  onFocus={() => {
                    if (!referralLocked) scrollReferralIntoView()
                  }}
                  onBlur={() => setReferralTouched(true)}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  editable={!referralLocked}
                />
                {referralLocked ? (
                  <Ionicons name="lock-closed" size={18} color={ob.preference} />
                ) : referralFormatValid ? (
                  <Ionicons name="checkmark-circle" size={18} color={ob.preference} />
                ) : null}
              </View>
              {referralLocked ? (
                <Text style={styles.referralHint}>Applied from your invite link.</Text>
              ) : referralFormatValid ? (
                <Text style={styles.referralHint}>Valid format — bonus applies after signup.</Text>
              ) : referralTouched && normalizedRef.length > 0 ? (
                <Text style={styles.referralErr}>Invalid format — check with your friend.</Text>
              ) : null}
              {referralError ? <Text style={styles.referralErr}>{referralError}</Text> : null}
            </View>

            {formError ? <Text style={styles.formError}>{formError}</Text> : null}
          </ScrollView>
        </KeyboardAvoidingView>
      </OnboardingLayout>
      </View>

      <SafeAreaView edges={['bottom']} style={styles.footerSafe}>
        <FooterActionBar extraBottom={4}>
          <PrimaryButton
            title={loading ? 'Creating…' : 'Create account'}
            onPress={() => void handleCreate()}
            loading={loading}
          />
          <Link href="/login" asChild>
            <Pressable style={styles.linkBtn} accessibilityRole="link">
              <Text style={styles.linkText}>Already have an account? Sign in</Text>
            </Pressable>
          </Link>
        </FooterActionBar>
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: ob.bg,
  },
  flex: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    paddingTop: 4,
  },
  title: { ...obType.title, marginBottom: 8 },
  sub: { marginBottom: 20 },
  referralCard: {
    borderRadius: ob.radiusLg,
    borderWidth: 1,
    borderColor: 'rgba(22, 217, 122, 0.25)',
    backgroundColor: 'rgba(22, 217, 122, 0.06)',
    padding: 16,
    marginBottom: 12,
  },
  referralTitle: { fontSize: 14, fontWeight: '800', color: ob.ink, marginBottom: 4 },
  referralSub: { fontSize: 13, fontWeight: '500', color: ob.inkMuted, marginBottom: 12, lineHeight: 18 },
  referralRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: ob.radiusMd,
    borderWidth: 1.5,
    borderColor: ob.border,
    backgroundColor: ob.surface,
    paddingHorizontal: 14,
    minHeight: 48,
  },
  referralRowOk: { borderColor: ob.preference },
  referralRowBad: { borderColor: ob.allergy },
  referralRowLocked: { backgroundColor: ob.bgElevated },
  referralInput: { flex: 1, fontSize: 15, fontWeight: '600', color: ob.ink, paddingVertical: 12 },
  referralHint: { marginTop: 8, fontSize: 12, fontWeight: '600', color: ob.preference },
  referralErr: { marginTop: 8, fontSize: 12, fontWeight: '600', color: ob.allergy },
  formError: { color: ob.allergy, fontWeight: '700', marginTop: 8 },
  footerSafe: {
    backgroundColor: 'rgba(247, 252, 250, 0.98)',
  },
  linkBtn: { alignItems: 'center', paddingVertical: 8 },
  linkText: { fontSize: 15, fontWeight: '600', color: ob.inkMuted },
})
