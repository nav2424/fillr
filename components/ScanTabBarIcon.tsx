import { View, Image, StyleSheet, Platform } from 'react-native'
import { FILLR_LOGO_MARK } from './FillrHeaderLogo'

const OUTER = 60
/** Slight lift so the FAB reads above the pill; less negative = sits lower. */
const FAB_NUDGE = -6

/** Almost fills the white circle (~87% of diameter) with a thin inset so the mark doesn’t clip the edge. */
const MARK = Math.round(OUTER * 0.87)

const fabShadow = Platform.select({
  ios: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
  },
  android: { elevation: 14 },
  default: {},
})

type ScanTabBarIconProps = {
  focused: boolean
}

export function ScanTabBarIcon({ focused: _focused }: ScanTabBarIconProps) {
  return (
    <View style={[styles.outer, styles.outerWhite, styles.fabNudge, fabShadow]} accessibilityElementsHidden>
      <Image source={FILLR_LOGO_MARK} style={styles.mark} resizeMode="contain" accessible={false} />
    </View>
  )
}

const styles = StyleSheet.create({
  outer: {
    width: OUTER,
    height: OUTER,
    borderRadius: OUTER / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabNudge: {
    marginTop: FAB_NUDGE,
  },
  outerWhite: {
    backgroundColor: '#ffffff',
  },
  mark: {
    width: MARK,
    height: MARK,
  },
})
