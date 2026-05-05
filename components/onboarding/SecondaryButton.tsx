import { Pressable, Text, StyleSheet, type ViewStyle } from 'react-native'
import { ob } from '../../constants/onboardingTheme'

type Props = {
  title: string
  onPress: () => void
  disabled?: boolean
  style?: ViewStyle
}

export function SecondaryButton({ title, onPress, disabled, style }: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.btn,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
        style,
      ]}
      accessibilityRole="button"
    >
      <Text style={styles.text}>{title}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  btn: {
    borderRadius: ob.radiusLg,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
    borderWidth: 1.5,
    borderColor: ob.borderStrong,
    backgroundColor: ob.surfaceTint,
  },
  pressed: {
    backgroundColor: ob.bgElevated,
    opacity: 0.92,
  },
  disabled: {
    opacity: 0.45,
  },
  text: {
    color: ob.ink,
    fontSize: 16,
    fontWeight: '600',
  },
})
