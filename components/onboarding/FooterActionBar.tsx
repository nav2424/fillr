import { View, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ob } from '../../constants/onboardingTheme'

type Props = {
  children: React.ReactNode
  /** Extra space above safe-area home indicator */
  extraBottom?: number
}

/**
 * Bottom action slot — transparent so the shell gradient reads continuously;
 * no white “dock” behind the primary CTA.
 */
export function FooterActionBar({ children, extraBottom = 8 }: Props) {
  const insets = useSafeAreaInsets()
  return (
    <View
      style={[
        styles.wrap,
        {
          paddingBottom: Math.max(insets.bottom, 12) + extraBottom,
          paddingTop: ob.footerGap + 8,
        },
      ]}
    >
      <View style={styles.inner}>{children}</View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: 'transparent',
  },
  inner: {
    gap: 10,
  },
})
