import { View, StyleSheet, Platform } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { ob } from '../../constants/onboardingTheme'

/** UPC-A style 95-module pattern (L + R digit encodings + guards) — renders as black/white slices. */
const L7: Record<number, string> = {
  0: '0001101',
  1: '0011001',
  2: '0010011',
  3: '0111101',
  4: '0100011',
  5: '0110001',
  6: '0101111',
  7: '0111011',
  8: '0110111',
  9: '0001011',
}

const R7: Record<number, string> = {
  0: '1110010',
  1: '1100110',
  2: '1101100',
  3: '1000010',
  4: '1011100',
  5: '1001110',
  6: '1010000',
  7: '1000100',
  8: '1001000',
  9: '1110100',
}

function upcAModules(left: number[], right: number[]): boolean[] {
  const bits: boolean[] = []
  const push = (s: string) => {
    for (const c of s) bits.push(c === '1')
  }
  push('101')
  for (const d of left) push(L7[d] ?? L7[0]!)
  push('01010')
  for (const d of right) push(R7[d] ?? R7[0]!)
  push('101')
  return bits
}

/** Demo digits that scan as a plausible product code on screen. */
const DEMO_LEFT = [0, 7, 8, 5, 0, 2]
const DEMO_RIGHT = [1, 9, 3, 6, 4, 8]

/** Abstract scan hero — glass stage, viewfinder corners, luminous beam. */
export function HeroBarcodeVisual() {
  const modules = upcAModules(DEMO_LEFT, DEMO_RIGHT)
  return (
    <View style={styles.root} accessibilityLabel="Decorative scan graphic">
      <LinearGradient
        colors={['rgba(34, 197, 94, 0.2)', 'rgba(14, 165, 233, 0.1)', 'rgba(255,255,255,0.55)']}
        locations={[0, 0.4, 1]}
        style={styles.stage}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.95, y: 1 }}
      >
        <View style={[styles.corner, styles.tl]} />
        <View style={[styles.corner, styles.tr]} />
        <View style={[styles.corner, styles.bl]} />
        <View style={[styles.corner, styles.br]} />

        <View style={styles.phone}>
          <LinearGradient
            colors={['rgba(255,255,255,0.95)', 'rgba(255,255,255,0.72)']}
            style={styles.phoneFace}
          >
            <View style={styles.notch} />
            <View style={styles.screen}>
              <View style={styles.pkg}>
                <LinearGradient
                  colors={['rgba(34, 197, 94, 0.45)', 'rgba(34, 197, 94, 0.2)']}
                  style={styles.pkgStripe}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                />
                <View style={styles.pkgBody}>
                  <View style={styles.barQuiet}>
                    <View style={styles.barTrack}>
                      {modules.map((isBlack, i) => (
                        <View
                          key={i}
                          style={[
                            styles.module,
                            {
                              width: MODULE_W,
                              backgroundColor: isBlack ? 'rgba(10,22,40,0.96)' : 'transparent',
                            },
                          ]}
                        />
                      ))}
                    </View>
                  </View>
                  <View style={styles.meta}>
                    <View style={styles.metaLineWide} />
                    <View style={styles.metaLine} />
                  </View>
                </View>
              </View>
              <View style={styles.scanGlow} />
              <View style={styles.scanBeam} />
            </View>
          </LinearGradient>
        </View>
      </LinearGradient>
    </View>
  )
}

/** ~1.28px per module @ typical device width — reads as retail barcode density */
const MODULE_W = 1.28
const BAR_H = 46

const styles = StyleSheet.create({
  root: {
    minHeight: 248,
    marginBottom: 12,
    marginTop: 4,
  },
  stage: {
    flex: 1,
    minHeight: 248,
    borderRadius: 36,
    paddingVertical: 22,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.85)',
    overflow: 'hidden',
    ...ob.shadow.card,
  },
  corner: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderColor: 'rgba(10, 22, 40, 0.18)',
    zIndex: 2,
  },
  tl: {
    top: 16,
    left: 16,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderTopLeftRadius: 8,
  },
  tr: {
    top: 16,
    right: 16,
    borderTopWidth: 2,
    borderRightWidth: 2,
    borderTopRightRadius: 8,
  },
  bl: {
    bottom: 16,
    left: 16,
    borderBottomWidth: 2,
    borderLeftWidth: 2,
    borderBottomLeftRadius: 8,
  },
  br: {
    bottom: 16,
    right: 16,
    borderBottomWidth: 2,
    borderRightWidth: 2,
    borderBottomRightRadius: 8,
  },
  phone: {
    width: 208,
    height: 208,
    borderRadius: 30,
    padding: 3,
    ...Platform.select({
      ios: {
        shadowColor: '#0a1628',
        shadowOffset: { width: 0, height: 20 },
        shadowOpacity: 0.14,
        shadowRadius: 28,
      },
      android: { elevation: 10 },
    }),
  },
  phoneFace: {
    flex: 1,
    borderRadius: 27,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
  },
  notch: {
    alignSelf: 'center',
    width: 56,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(10,22,40,0.1)',
    marginBottom: 8,
  },
  screen: {
    flex: 1,
    borderRadius: 18,
    backgroundColor: ob.surface,
    borderWidth: 1,
    borderColor: ob.border,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pkg: {
    width: '86%',
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: ob.border,
  },
  pkgStripe: {
    height: 10,
  },
  pkgBody: {
    paddingHorizontal: 10,
    paddingBottom: 12,
    paddingTop: 8,
    gap: 10,
  },
  /** Quiet zones left/right (UPC requires margin before first bar). */
  barQuiet: {
    backgroundColor: '#ffffff',
    borderRadius: 4,
    paddingVertical: 8,
    paddingHorizontal: 6,
    alignSelf: 'center',
    width: '100%',
    maxWidth: '100%',
  },
  barTrack: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    height: BAR_H,
    overflow: 'hidden',
  },
  module: {
    height: BAR_H,
  },
  meta: {
    gap: 6,
  },
  metaLineWide: {
    height: 6,
    borderRadius: 3,
    width: '72%',
    backgroundColor: 'rgba(10,22,40,0.08)',
  },
  metaLine: {
    height: 6,
    borderRadius: 3,
    width: '48%',
    backgroundColor: 'rgba(10,22,40,0.06)',
  },
  scanGlow: {
    position: 'absolute',
    left: '6%',
    right: '6%',
    bottom: 34,
    height: 14,
    borderRadius: 8,
    backgroundColor: 'rgba(34, 197, 94, 0.22)',
    ...Platform.select({
      ios: {
        shadowColor: ob.accentBar,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.55,
        shadowRadius: 12,
      },
    }),
  },
  scanBeam: {
    position: 'absolute',
    left: '8%',
    right: '8%',
    height: 3,
    borderRadius: 2,
    bottom: 40,
    backgroundColor: ob.accentBar,
    zIndex: 3,
    ...Platform.select({
      ios: {
        shadowColor: ob.accentBar,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.65,
        shadowRadius: 10,
      },
      android: { elevation: 4 },
    }),
  },
})
