import { Platform } from 'react-native'
import { typography } from './theme'

const tabBarFloatShadow = Platform.select({
  ios: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
  },
  android: {
    elevation: 16,
  },
  default: {},
})

/**
 * Floating pill tab bar (white) — horizontal margin + bottom inset applied in `Tabs` layout.
 */
export const DEFAULT_TAB_BAR_STYLE = {
  position: 'absolute' as const,
  backgroundColor: '#ffffff',
  borderTopWidth: 0,
  borderRadius: 28,
  paddingTop: 8,
  paddingBottom: 10,
  paddingHorizontal: 6,
  overflow: 'visible' as const,
  ...tabBarFloatShadow,
}

export const DEFAULT_TAB_BAR_LABEL_STYLE = {
  ...typography.labelSmall,
  fontSize: 11,
  fontWeight: '600' as const,
}

export const DEFAULT_TAB_BAR_ITEM_STYLE = { paddingTop: 4 }
