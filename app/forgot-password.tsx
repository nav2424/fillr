import { useMemo, useState } from 'react'
import { View, Text, StyleSheet, TextInput, KeyboardAvoidingView, Platform, Pressable } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { FillrButton } from '../components'
import { router } from 'expo-router'
import { supabase } from '../lib/supabase'
import { colors, spacing, typography } from '../constants/theme'

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const emailIsValid = useMemo(() => {
    if (!email.trim()) return true
    return /^\S+@\S+\.\S+$/.test(email.trim())
  }, [email])

  const handleReset = async () => {
    setError(null)
    setMessage(null)

    const trimmedEmail = email.trim()
    if (!trimmedEmail) {
      setError('Please enter your email.')
      return
    }
    if (!/^\S+@\S+\.\S+$/.test(trimmedEmail)) {
      setError('Please enter a valid email address.')
      return
    }

    setLoading(true)
    try {
      const { error: supaError } = await supabase.auth.resetPasswordForEmail(trimmedEmail)

      if (supaError) {
        setMessage('If an account exists for this email, we’ll send password reset instructions shortly.')
        return
      }

      setMessage('If an account exists for this email, we’ll send password reset instructions shortly.')
    } catch {
      setMessage('If an account exists for this email, we’ll send password reset instructions shortly.')
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
            <Text style={styles.title}>Reset password</Text>
            <Text style={styles.subtitle}>Enter your email and we’ll send instructions</Text>
          </View>

          <View style={styles.form}>
            <TextInput
              style={[
                styles.input,
                !emailIsValid && email.trim().length > 0 && styles.inputError,
              ]}
              placeholder="Email"
              placeholderTextColor={colors.textMuted}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              textContentType="emailAddress"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              returnKeyType="done"
            />

            {!!error && <Text style={styles.errorText}>{error}</Text>}
            {!!message && <Text style={styles.successText}>{message}</Text>}

            <View style={styles.actions}>
              <FillrButton
                title={loading ? 'Sending...' : 'Send reset link'}
                onPress={handleReset}
                disabled={loading}
                fullWidth
                variant="primary"
              />

              <Pressable onPress={() => router.push('/login')} style={styles.backBtn}>
                <Text style={styles.backText}>Back to sign in</Text>
              </Pressable>
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
  inputError: {
    borderColor: 'rgba(255, 69, 58, 0.6)',
  },
  errorText: {
    ...typography.bodySmall,
    color: colors.danger,
    marginTop: -spacing.sm,
  },
  successText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: -spacing.sm,
  },
  actions: {
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  backBtn: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  backText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontWeight: '600',
  },
})
