import {
  Pressable,
  Text,
  StyleSheet,
  ActivityIndicator,
  View,
  Platform,
  type ViewStyle,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { ob } from '../../constants/onboardingTheme'

type Props = {
  title: string
  onPress: () => void
  disabled?: boolean
  loading?: boolean
  style?: ViewStyle
}

export function PrimaryButton({ title, onPress, disabled, loading, style }: Props) {
  const inactive = disabled || loading
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      style={({ pressed }) => [
        styles.shell,
        inactive && styles.btnDisabled,
        pressed && !inactive && styles.btnPressed,
        style,
      ]}
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive }}
    >
      <LinearGradient
        colors={[...ob.ctaGradient]}
        locations={[0, 0.5, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <View style={styles.inner}>
          {loading ? (
            <ActivityIndicator color={ob.ctaText} />
          ) : (
            <Text style={styles.text}>{title}</Text>
          )}
        </View>
      </LinearGradient>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  shell: {
    borderRadius: ob.radiusLg,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#0fb86a',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.35,
        shadowRadius: 20,
      },
      android: { elevation: 6 },
    }),
  },
  gradient: {
    borderRadius: ob.radiusLg,
  },
  inner: {
    minHeight: 54,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPressed: {
    opacity: 0.94,
    transform: [{ scale: 0.99 }],
  },
  btnDisabled: {
    opacity: 0.55,
  },
  text: {
    color: ob.ctaText,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.25,
  },
})
