import { View, Text, StyleSheet } from 'react-native'
import { ob, obType } from '../../constants/onboardingTheme'

type Props = {
  /** Small caps label above the title (e.g. “Safety”) */
  eyebrow?: string
  title: string
  /** Primary line under the title */
  lead: string
  /** Optional supporting line — keep short */
  detail?: string
}

export function OnboardingStepHero({ eyebrow, title, lead, detail }: Props) {
  return (
    <View style={styles.wrap}>
      {eyebrow ? <Text style={obType.stepEyebrow}>{eyebrow}</Text> : null}
      <Text style={obType.heroDisplay}>{title}</Text>
      <Text style={obType.heroLead}>{lead}</Text>
      {detail ? <Text style={obType.heroDetail}>{detail}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: ob.step.heroBottom,
  },
})
