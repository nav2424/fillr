import { Pressable, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { colors, spacing, radius, typography } from '../constants/theme'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'liquid' | 'dangerLiquid'

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
    liquid: [styles.liquid, styles.liquidText],
    dangerLiquid: [styles.dangerLiquid, styles.dangerLiquidText],
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
      {variant === 'liquid' || variant === 'dangerLiquid' ? (
        <LinearGradient
          colors={
            variant === 'dangerLiquid'
              ? ['rgba(255, 133, 133, 0.88)', 'rgba(255, 92, 92, 0.86)']
              : ['rgba(74, 222, 128, 0.95)', 'rgba(22, 163, 74, 0.94)']
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.liquidGradient}
        />
      ) : null}
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
    overflow: 'hidden',
    position: 'relative',
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
  liquid: {
    backgroundColor: 'rgba(34, 197, 94, 0.22)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.55)',
    shadowColor: '#16a34a',
    shadowOpacity: 0.26,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  liquidGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  liquidText: {
    color: '#f8fffb',
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  dangerLiquid: {
    backgroundColor: 'rgba(255, 107, 107, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.58)',
    shadowColor: '#ef4444',
    shadowOpacity: 0.2,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 7 },
    elevation: 3,
  },
  dangerLiquidText: {
    color: '#fff7f7',
    fontWeight: '800',
    letterSpacing: 0.2,
  },
})
