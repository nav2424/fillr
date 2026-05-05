import { View, TextInput, StyleSheet, Pressable } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { wa } from '../../constants/welcomeAuthTheme'

const ICON = 'rgba(34, 197, 94, 0.72)'

type Props = {
  icon: keyof typeof Ionicons.glyphMap
  value: string
  onChangeText: (t: string) => void
  placeholder: string
  secureTextEntry?: boolean
  keyboardType?: 'default' | 'email-address'
  autoCapitalize?: 'none' | 'sentences'
  textContentType?: 'emailAddress' | 'password'
  autoComplete?: 'email' | 'password'
  returnKeyType?: 'next' | 'done'
  onSubmitEditing?: () => void
  rightSlot?: React.ReactNode
  error?: boolean
}

export function InputField({
  icon,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  keyboardType = 'default',
  autoCapitalize = 'none',
  textContentType,
  autoComplete,
  returnKeyType = 'done',
  onSubmitEditing,
  rightSlot,
  error,
}: Props) {
  return (
    <View style={[styles.wrap, error && styles.wrapErr]}>
      <Ionicons name={icon} size={20} color={error ? wa.danger : ICON} style={styles.leftIcon} />
      <TextInput
        style={[styles.input, rightSlot ? styles.inputPadRight : null]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={wa.muted}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        textContentType={textContentType}
        autoComplete={autoComplete}
        returnKeyType={returnKeyType}
        onSubmitEditing={onSubmitEditing}
      />
      {rightSlot ? <View style={styles.right}>{rightSlot}</View> : null}
    </View>
  )
}

export function PasswordToggle({ visible, onToggle }: { visible: boolean; onToggle: () => void }) {
  return (
    <Pressable
      onPress={onToggle}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel={visible ? 'Hide password' : 'Show password'}
      style={({ pressed }) => [styles.eye, pressed && { opacity: 0.7 }]}
    >
      <Ionicons name={visible ? 'eye-off-outline' : 'eye-outline'} size={22} color={wa.accentDeep} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: wa.radiusMd,
    borderWidth: 1,
    borderColor: wa.border,
    backgroundColor: wa.inputBg,
    minHeight: 56,
    paddingRight: 8,
  },
  wrapErr: {
    borderColor: 'rgba(220, 38, 38, 0.45)',
    backgroundColor: '#FFFBFB',
  },
  leftIcon: {
    marginLeft: 14,
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: wa.ink,
    paddingVertical: 15,
    paddingRight: 8,
    letterSpacing: -0.15,
  },
  inputPadRight: {
    paddingRight: 4,
  },
  right: {
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 44,
  },
  eye: {
    padding: 8,
  },
})
