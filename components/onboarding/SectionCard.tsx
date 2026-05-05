import { View, Text, StyleSheet } from 'react-native'
import { ob } from '../../constants/onboardingTheme'

type Props = {
  title?: string
  subtitle?: string
  children: React.ReactNode
  variant?: 'default' | 'highlight'
}

/**
 * Quiet callout — hairline border, no drop shadow (reads lighter on mesh).
 */
export function SectionCard({ title, subtitle, children, variant = 'default' }: Props) {
  return (
    <View style={[styles.card, variant === 'highlight' && styles.highlight]}>
      {title ? <Text style={[styles.title, variant === 'highlight' && styles.titleHighlight]}>{title}</Text> : null}
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.62)',
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(10, 22, 40, 0.08)',
    padding: 16,
  },
  highlight: {
    backgroundColor: 'rgba(255, 255, 255, 0.72)',
    borderColor: 'rgba(34, 197, 94, 0.2)',
    borderLeftWidth: 2,
    borderLeftColor: ob.accentBar,
  },
  title: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2.2,
    color: ob.inkMuted,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  titleHighlight: {
    color: ob.accentBar,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '500',
    color: ob.inkMuted,
    lineHeight: 19,
    marginBottom: 10,
  },
})
