import { View, StyleSheet, Platform } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { BottomTabHeaderProps } from '@react-navigation/bottom-tabs'
import { colors, homeWordmarkLayout } from '../constants/theme'
import { FillrHeaderLogo } from './FillrHeaderLogo'

const MINT = colors.backgroundLightGreen
const WHITE = '#ffffff'
const HEADER_LINE_MINT = 'rgba(10, 40, 24, 0.08)'
const HEADER_LINE_SLATE = 'rgba(15, 23, 42, 0.08)'

/**
 * Tab bar header that mirrors `HomeScreen` wordmark placement: same horizontal inset,
 * same top offset under the status bar (`max(insets.top, minStatusPad)`), and a
 * standard header row height so History / Profile match Home.
 */
export function TabTopWordmarkHeader({ options, route }: BottomTabHeaderProps) {
  const insets = useSafeAreaInsets()
  /** +4 matches `HomeScreen` scroll wrapper under the status bar. */
  const padTop = Math.max(insets.top, homeWordmarkLayout.minStatusPad) + 4
  const isScan = route.name === 'scan'
  const whiteCanvas =
    route.name === 'history' || route.name === 'overview' || route.name === 'profile'
  const headerBg = isScan ? 'transparent' : whiteCanvas ? WHITE : MINT
  const headerLine = isScan ? 'transparent' : whiteCanvas ? HEADER_LINE_SLATE : HEADER_LINE_MINT
  const tint = isScan ? '#ffffff' : whiteCanvas ? '#0f172a' : colors.text
  const right = options.headerRight?.({ tintColor: tint } as never)

  return (
    <View
      style={[
        styles.shell,
        isScan && styles.shellScan,
        { paddingTop: padTop, backgroundColor: headerBg, borderBottomColor: headerLine },
      ]}
    >
      <View style={[styles.row, { paddingHorizontal: homeWordmarkLayout.horizontalPad }]}>
        <FillrHeaderLogo variant={isScan ? 'onDark' : 'default'} />
        <View style={styles.spacer} />
        {right != null ? <View style={styles.rightSlot}>{right}</View> : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  shell: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  shellScan: {
    borderBottomWidth: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: Platform.select({ ios: 44, default: 56 }),
    paddingBottom: 8,
  },
  spacer: { flex: 1 },
  rightSlot: {
    flexDirection: 'row',
    alignItems: 'center',
  },
})
