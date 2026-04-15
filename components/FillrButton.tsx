import { Pressable, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native'
import { colors, spacing, radius, typography } from '../constants/theme'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

interface FillrButtonProps {
  title: string
  onPress: () => void
  variant?: Variant
  disabled?: boolean
  fullWidth?: boolean
  style?: ViewStyle
}

export function FillrButton({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  fullWidth,
  style,
}: FillrButtonProps) {
  const variantStyles = {
    primary: [styles.primary, styles.primaryText],
    secondary: [styles.secondary, styles.secondaryText],
    ghost: [styles.ghost, styles.ghostText],
    danger: [styles.danger, styles.dangerText],
  }
  const [btnStyle, textStyle] = variantStyles[variant]

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) =>
        [
          styles.base,
          btnStyle,
          fullWidth && styles.fullWidth,
          disabled && styles.disabled,
          pressed && styles.pressed,
          style,
        ].filter(Boolean) as ViewStyle[]
      }
    >
      <Text style={[styles.text, textStyle]}>{title}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  base: {
    height: 56,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullWidth: {
    width: '100%',
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.9,
  },
  text: {
    ...typography.label,
    fontSize: 16,
  },
  primary: {
    backgroundColor: colors.accent,
  },
  primaryText: {
    color: '#ffffff',
  },
  secondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  secondaryText: {
    color: colors.textSecondary,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  ghostText: {
    color: colors.textSecondary,
  },
  danger: {
    backgroundColor: colors.danger,
  },
  dangerText: {
    color: '#ffffff',
  },
})
