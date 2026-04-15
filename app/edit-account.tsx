import { useState, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { GradientBackground, FillrButton } from '../components'
import { colors, spacing, typography } from '../constants/theme'
import { useAuthStore } from '../store/authStore'

export default function EditAccountScreen() {
  const { email, fullName, updateAccount } = useAuthStore()
  const [name, setName] = useState(fullName || '')
  const [emailInput, setEmailInput] = useState(email || '')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleSave = useCallback(() => {
    setError(null)
    const trimmedEmail = emailInput.trim()
    const trimmedName = name.trim()
    if (!trimmedEmail || !/^\S+@\S+\.\S+$/.test(trimmedEmail)) {
      setError('Enter a valid email address.')
      return
    }
    if (!trimmedName) {
      setError('Please enter your name.')
      return
    }
    if (newPassword || confirmPassword) {
      if (newPassword.length < 8) {
        setError('New password must be at least 8 characters.')
        return
      }
      if (newPassword !== confirmPassword) {
        setError('New passwords do not match.')
        return
      }
      Alert.alert(
        'Password',
        'Password changes will use your sign-in provider when Supabase auth is connected. Your name and email were saved on this device.'
      )
    }
    updateAccount({ fullName: trimmedName, email: trimmedEmail })
    router.back()
  }, [emailInput, name, newPassword, confirmPassword, updateAccount])

  return (
    <GradientBackground variant="minimal">
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboard}
        >
          <View style={styles.header}>
            <Pressable
              onPress={() => router.back()}
              style={({ pressed }) => [styles.backBtn, pressed && styles.backBtnPressed]}
            >
              <Ionicons name="chevron-back" size={24} color={colors.text} />
              <Text style={styles.backBtnText}>Back</Text>
            </Pressable>
            <Text style={styles.headerTitle}>Account details</Text>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {error && <Text style={styles.error}>{error}</Text>}

            <Text style={styles.label}>Full name</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={(t) => {
                setName(t)
                setError(null)
              }}
              placeholder="Your name"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="words"
            />

            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={emailInput}
              onChangeText={(t) => {
                setEmailInput(t)
                setError(null)
              }}
              placeholder="Email"
              placeholderTextColor={colors.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Text style={styles.sectionHint}>
              To change password, enter a new one below. Leave blank to keep your current password.
            </Text>
            <Text style={styles.label}>New password</Text>
            <TextInput
              style={styles.input}
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="Optional"
              placeholderTextColor={colors.textMuted}
              secureTextEntry
              autoCapitalize="none"
            />
            <Text style={styles.label}>Confirm new password</Text>
            <TextInput
              style={styles.input}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Optional"
              placeholderTextColor={colors.textMuted}
              secureTextEntry
              autoCapitalize="none"
            />
          </ScrollView>

          <View style={styles.footer}>
            <FillrButton title="Save changes" onPress={handleSave} fullWidth />
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </GradientBackground>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.md,
  },
  keyboard: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    marginLeft: -spacing.sm,
  },
  backBtnPressed: {
    opacity: 0.7,
  },
  backBtnText: {
    ...typography.body,
    color: colors.text,
    marginLeft: spacing.xs,
  },
  headerTitle: {
    ...typography.h3,
    color: colors.text,
    marginLeft: spacing.md,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.xl,
  },
  error: {
    ...typography.bodySmall,
    color: colors.danger,
    marginBottom: spacing.md,
  },
  label: {
    ...typography.labelSmall,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    marginTop: spacing.md,
    fontWeight: '600',
  },
  input: {
    ...typography.body,
    color: colors.text,
    backgroundColor: colors.backgroundLightGreen,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  sectionHint: {
    ...typography.bodySmall,
    color: colors.textMuted,
    marginTop: spacing.lg,
    lineHeight: 20,
  },
  footer: {
    paddingVertical: spacing.lg,
  },
})
