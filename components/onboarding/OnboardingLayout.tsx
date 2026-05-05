import { View, StyleSheet } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ob } from '../../constants/onboardingTheme'

type Props = {
  children: React.ReactNode
  /** Main column (scroll + optional footer lives outside if needed) */
  edges?: ('top' | 'bottom')[]
}

/**
 * Full-screen shell + horizontal padding. Soft vertical mesh reads more “product”
 * than a flat mint wash. Pair with `ProgressHeader` and `FooterActionBar`.
 */
export function OnboardingLayout({ children, edges = ['top', 'bottom'] }: Props) {
  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[ob.bgTop, ob.bgMid, ob.bgBottom]}
        locations={[0, 0.45, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      <SafeAreaView style={styles.safe} edges={edges}>
        <View style={styles.pad}>{children}</View>
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: ob.bgMid,
  },
  safe: {
    flex: 1,
  },
  pad: {
    flex: 1,
    paddingHorizontal: ob.padX,
    paddingTop: ob.padTop,
  },
})
