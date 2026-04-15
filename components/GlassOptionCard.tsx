import { Platform, Pressable, Text, StyleSheet, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { BlurView } from 'expo-blur'
import { colors, spacing, radius, typography } from '../constants/theme'

interface GlassOptionCardProps {
  label: string
  selected?: boolean
  onPress?: () => void
}

export function GlassOptionCard({
  label,
  selected = false,
  onPress,
}: GlassOptionCardProps) {
  const cardContent = (
    <View style={styles.content}>
      {selected && (
        <View style={styles.checkWrap}>
          <Ionicons name="checkmark" size={14} color="#fff" />
        </View>
      )}
      <Text
        style={[
          styles.text,
          selected ? styles.textSelected : styles.textDefault,
        ]}
      >
        {label}
      </Text>
    </View>
  )

  const cardStyle = [
    styles.card,
    selected && styles.cardSelected,
  ]

  if (Platform.OS === 'web') {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          cardStyle,
          { backgroundColor: selected ? colors.accentMuted : 'rgba(255,255,255,0.85)' },
          pressed && styles.pressed,
        ]}
      >
        {cardContent}
      </Pressable>
    )
  }

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.wrapper, pressed && styles.pressed]}>
      <BlurView
        intensity={selected ? 70 : 50}
        tint="light"
        style={[styles.blur, ...cardStyle]}
      >
        {cardContent}
      </BlurView>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: 'rgba(0,0,0,0.06)',
    overflow: 'hidden',
  },
  blur: {
    overflow: 'hidden',
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkWrap: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  cardSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accentMuted,
  },
  pressed: {
    opacity: 0.95,
    transform: [{ scale: 0.99 }],
  },
  text: {
    ...typography.body,
    flex: 1,
  },
  textDefault: {
    color: colors.textSecondary,
  },
  textSelected: {
    color: colors.text,
    fontWeight: '600',
  },
})
