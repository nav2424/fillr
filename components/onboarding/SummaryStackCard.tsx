import { View, Text, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { ob } from '../../constants/onboardingTheme'

type Props = {
  title: string
  body: string
  icon: keyof typeof Ionicons.glyphMap
  tint: string
  tintBg: string
}

export function SummaryStackCard({ title, body, icon, tint, tintBg }: Props) {
  return (
    <View style={[styles.card, ob.shadow.soft]}>
      <View style={[styles.iconWrap, { backgroundColor: tintBg }]}>
        <Ionicons name={icon} size={20} color={tint} />
      </View>
      <View style={styles.textCol}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body}>{body}</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    backgroundColor: ob.surface,
    borderRadius: ob.radiusLg,
    borderWidth: 1,
    borderColor: ob.border,
    padding: 16,
    marginBottom: 12,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.9,
    color: ob.inkFaint,
    textTransform: 'uppercase',
  },
  body: {
    fontSize: 15,
    fontWeight: '600',
    color: ob.ink,
    lineHeight: 22,
    letterSpacing: -0.1,
  },
})
