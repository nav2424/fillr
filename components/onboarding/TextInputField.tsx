import { View, Text, TextInput, StyleSheet, Pressable } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { ob } from '../../constants/onboardingTheme'

type Props = {
  label: string
  value: string
  onChangeText: (t: string) => void
  placeholder?: string
  secureTextEntry?: boolean
  keyboardType?: 'default' | 'email-address'
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters'
  error?: string | null
  helper?: string
  onToggleSecure?: () => void
  secureVisible?: boolean
}

export function TextInputField({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  keyboardType = 'default',
  autoCapitalize = 'sentences',
  error,
  helper,
  onToggleSecure,
  secureVisible,
}: Props) {
  const hidden = secureTextEntry && !secureVisible
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.fieldRow, error ? styles.fieldErr : null]}>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={ob.inkFaint}
          secureTextEntry={hidden}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
        />
        {secureTextEntry && onToggleSecure ? (
          <Pressable onPress={onToggleSecure} hitSlop={10} accessibilityRole="button">
            <Ionicons name={secureVisible ? 'eye-off-outline' : 'eye-outline'} size={22} color={ob.inkMuted} />
          </Pressable>
        ) : null}
      </View>
      {helper && !error ? <Text style={styles.helper}>{helper}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: ob.inkMuted,
    marginBottom: 8,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: ob.radiusMd,
    borderWidth: 1.5,
    borderColor: ob.border,
    backgroundColor: ob.surface,
    paddingHorizontal: 14,
    minHeight: 52,
  },
  fieldErr: {
    borderColor: ob.allergy,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: ob.ink,
    paddingVertical: 12,
    fontWeight: '500',
  },
  helper: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '500',
    color: ob.inkFaint,
    lineHeight: 16,
  },
  error: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '600',
    color: ob.allergy,
  },
})
