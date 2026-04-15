import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native'
import { colors, spacing, radius } from '../constants/theme'

interface FillrCardProps {
  children: React.ReactNode
  style?: StyleProp<ViewStyle>
  glass?: boolean
}

export function FillrCard({ children, style, glass = true }: FillrCardProps) {
  return (
    <View style={[styles.card, glass && styles.glass, style]}>{children}</View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 4,
  },
  glass: {
    backgroundColor: colors.backgroundCard,
    borderColor: colors.glassBorder,
  },
})
