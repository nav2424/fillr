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
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleSave = useCallback(() => {
    setError(null)
    const trimmedName = name.trim()
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
    updateAccount({ fullName: trimmedName, email: email || '' })
    router.back()
  }, [name, newPassword, confirmPassword, updateAccount, email])

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
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {error && <Text style={styles.error}>{error}</Text>}

            <View style={styles.formCard}>
              <Text style={styles.sectionTitle}>Basic info</Text>

              <Text style={styles.label}>Full name</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="person-outline" size={17} color={colors.textMuted} />
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
              </View>

              <Text style={styles.label}>Email</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="mail-outline" size={17} color={colors.textMuted} />
                <TextInput
                  style={styles.input}
                  value={email || ''}
                  placeholder="Email"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={false}
                  selectTextOnFocus={false}
                />
              </View>
            </View>

            <View style={styles.formCard}>
              <Text style={styles.sectionTitle}>Security</Text>
              <Text style={styles.sectionHint}>
                To change password, enter a new one below. Leave blank to keep your current password.
              </Text>

              <Text style={styles.label}>New password</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="lock-closed-outline" size={17} color={colors.textMuted} />
                <TextInput
                  style={styles.input}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder="Optional"
                  placeholderTextColor={colors.textMuted}
                  secureTextEntry
                  autoCapitalize="none"
                />
              </View>

              <Text style={styles.label}>Confirm new password</Text>
              <View style={styles.inputWrap}>
                <Ionicons name="checkmark-circle-outline" size={17} color={colors.textMuted} />
                <TextInput
                  style={styles.input}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Optional"
                  placeholderTextColor={colors.textMuted}
                  secureTextEntry
                  autoCapitalize="none"
                />
              </View>
            </View>

            <Pressable
              onPress={() => router.push('/delete-account')}
              style={({ pressed }) => [styles.deleteRow, pressed && styles.deleteRowPressed]}
              accessibilityRole="button"
              accessibilityLabel="Delete account"
            >
              <Ionicons name="trash-outline" size={18} color={colors.danger} />
              <Text style={styles.deleteRowText}>Delete account</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>
          </ScrollView>

          <View style={styles.footer}>
            <FillrButton title="Save changes" onPress={handleSave} variant="liquid" fullWidth />
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
    backgroundColor: '#f4f8f5',
  },
  keyboard: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    marginLeft: -spacing.sm,
    borderRadius: 0,
    backgroundColor: 'transparent',
  },
  backBtnPressed: {
    opacity: 0.7,
  },
  backBtnText: {
    ...typography.body,
    color: colors.text,
    marginLeft: spacing.xs,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.xl,
  },
  formCard: {
    borderRadius: 20,
    padding: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: 'transparent',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.07,
    shadowRadius: 14,
    elevation: 3,
  },
  sectionTitle: {
    ...typography.label,
    color: colors.text,
    fontSize: 16,
    marginBottom: spacing.xs,
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
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.08)',
    borderRadius: 14,
    paddingHorizontal: spacing.md,
  },
  input: {
    flex: 1,
    ...typography.body,
    color: colors.text,
    paddingVertical: spacing.md,
  },
  sectionHint: {
    ...typography.bodySmall,
    color: colors.textMuted,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
    lineHeight: 20,
  },
  footer: {
    paddingVertical: spacing.lg,
  },
  deleteRow: {
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: 14,
    paddingHorizontal: spacing.md,
    backgroundColor: 'transparent',
  },
  deleteRowPressed: {
    opacity: 0.72,
  },
  deleteRowText: {
    ...typography.label,
    color: colors.danger,
    flex: 1,
  },
})
