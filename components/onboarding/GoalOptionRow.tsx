import { Pressable, Text, View, StyleSheet, Platform } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { ob } from '../../constants/onboardingTheme'

type Props = {
  label: string
  description?: string
  selected: boolean
  onPress: () => void
}

const idleShadow = Platform.select({
  ios: {
    shadowColor: '#0a1628',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.035,
    shadowRadius: 8,
  },
  android: { elevation: 0 },
})

const selShadow = Platform.select({
  ios: {
    shadowColor: ob.accentBar,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  android: { elevation: 2 },
})

export function GoalOptionRow({ label, description, selected, onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        selected
          ? {
              borderColor: ob.accentBar,
              borderWidth: 1.5,
              backgroundColor: 'rgba(236, 253, 245, 0.9)',
              ...selShadow,
            }
          : {
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: 'rgba(10, 22, 40, 0.1)',
              backgroundColor: 'rgba(255, 255, 255, 0.72)',
              ...idleShadow,
            },
        pressed && { opacity: 0.94, transform: [{ scale: 0.993 }] },
      ]}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
    >
      <View style={styles.textWrap}>
        <Text style={styles.title}>{label}</Text>
        {description ? <Text style={styles.desc}>{description}</Text> : null}
      </View>
      {selected ? (
        <Ionicons name="checkmark-circle" size={20} color={ob.accentBar} />
      ) : (
        <View style={styles.radioOuter}>
          <View style={styles.radioInner} />
        </View>
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 18,
    marginBottom: 10,
  },
  textWrap: {
    flex: 1,
    paddingRight: 10,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: ob.ink,
    letterSpacing: -0.3,
  },
  desc: {
    marginTop: 3,
    fontSize: 12,
    fontWeight: '500',
    color: ob.inkMuted,
    lineHeight: 17,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(15, 23, 42, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  radioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'transparent',
  },
})
