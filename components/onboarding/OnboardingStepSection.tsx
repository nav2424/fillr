import { View, Text, StyleSheet } from 'react-native'
import { ob, obType } from '../../constants/onboardingTheme'

type Props = {
  label: string
  hint?: string
  children: React.ReactNode
  /** Hairline + top padding before this block (off for the first block under the hero) */
  showTopRule?: boolean
}

export function OnboardingStepSection({ label, hint, children, showTopRule = true }: Props) {
  return (
    <View style={[styles.wrap, showTopRule && styles.wrapRuled]}>
      <Text style={obType.stepSectionLabel}>{label}</Text>
      {hint ? <Text style={obType.stepSectionHint}>{hint}</Text> : null}
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: ob.step.sectionBlockBottom,
  },
  wrapRuled: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(10, 22, 40, 0.08)',
    paddingTop: ob.step.sectionAfterRule,
  },
})
