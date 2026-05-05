import { Pressable, Text, View, StyleSheet, Platform } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { ob } from '../../constants/onboardingTheme'

type Props = {
  title: string
  subtitle?: string
  icon?: React.ReactNode
  selected: boolean
  onPress: () => void
  style?: object
  accent?: 'allergy' | 'default'
}

const idleShadow = Platform.select({
  ios: {
    shadowColor: '#0a1628',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
  },
  android: { elevation: 0 },
})

const selectedShadow = (accentColor: string) =>
  Platform.select({
    ios: {
      shadowColor: accentColor,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.12,
      shadowRadius: 12,
    },
    android: { elevation: 2 },
  })

export function SelectableCard({
  title,
  subtitle,
  icon,
  selected,
  onPress,
  style,
  accent = 'allergy',
}: Props) {
  const accentColor = accent === 'allergy' ? ob.allergy : ob.cta
  const accentMuted = accent === 'allergy' ? 'rgba(255, 250, 250, 0.92)' : 'rgba(236, 253, 245, 0.88)'

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        selected
          ? {
              borderColor: accentColor,
              borderWidth: 1.5,
              backgroundColor: accentMuted,
              ...selectedShadow(accentColor),
            }
          : {
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: 'rgba(10, 22, 40, 0.1)',
              backgroundColor: 'rgba(255, 255, 255, 0.72)',
              ...idleShadow,
            },
        pressed && { opacity: 0.94, transform: [{ scale: 0.992 }] },
        style,
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      <View style={styles.top}>
        {icon ? <View style={styles.iconSlot}>{icon}</View> : null}
        <View style={styles.textCol}>
          <Text style={styles.cardTitle}>{title}</Text>
          {subtitle ? <Text style={styles.sub}>{subtitle}</Text> : null}
        </View>
        {selected ? (
          <Ionicons name="checkmark-circle" size={20} color={accentColor} />
        ) : (
          <View style={styles.radioOuter}>
            <View style={styles.radioInner} />
          </View>
        )}
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    padding: 14,
    minHeight: 88,
    justifyContent: 'center',
  },
  top: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  iconSlot: {
    marginTop: 1,
  },
  textCol: {
    flex: 1,
    gap: 3,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: ob.ink,
    letterSpacing: -0.3,
  },
  sub: {
    fontSize: 12,
    fontWeight: '500',
    color: ob.inkMuted,
    lineHeight: 16,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(15, 23, 42, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  radioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'transparent',
  },
})
