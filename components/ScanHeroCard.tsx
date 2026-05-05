import { useMemo } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  Platform,
  useWindowDimensions,
  type ImageSourcePropType,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'

/** Visual tokens for ScanHeroCard (Fillr home hero). */
export const scanHeroTokens = {
  primaryGreen: '#22C55E',
  darkGreen: '#14532D',
  bgDeep: '#031B12',
  bgDeepLeft: '#010806',
  textWhite: '#FFFFFF',
  buttonWhite: '#FFFFFF',
  bodyMuted: 'rgba(255,255,255,0.82)',
  buttonLabel: '#0F172A',
  cardRadius: 30,
} as const

export type ScanHeroCardProps = {
  title?: string
  highlightedWord?: string
  description?: string
  buttonLabel?: string
  onPress?: () => void
  imageSource?: ImageSourcePropType
  style?: StyleProp<ViewStyle>
}

const DEFAULT_TITLE = "Know what's really in your food."
const DEFAULT_HIGHLIGHT = 'really'
const DEFAULT_DESCRIPTION =
  'Scan any product to instantly understand ingredients, allergens, and health impact.'
const DEFAULT_BUTTON = 'Scan a product'

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function HeroTitle({
  title,
  highlightedWord,
}: {
  title: string
  highlightedWord: string
}) {
  const segments = useMemo(() => {
    if (!highlightedWord.trim()) {
      return [{ key: 'full', text: title, highlight: false as const }]
    }
    const re = new RegExp(`(${escapeRegExp(highlightedWord)})`, 'gi')
    const parts = title.split(re)
    return parts.map((text, i) => ({
      key: `p-${i}`,
      text,
      highlight: text.toLowerCase() === highlightedWord.toLowerCase(),
    }))
  }, [title, highlightedWord])

  return (
    <Text style={styles.headline}>
      {segments.map((seg) => (
        <Text key={seg.key} style={seg.highlight ? styles.headlineHighlight : undefined}>
          {seg.text}
        </Text>
      ))}
    </Text>
  )
}

/** Placeholder jar + barcode when `imageSource` is omitted. TODO: swap for real asset. */
function ProductHeroPlaceholder() {
  return (
    <View style={placeholderStyles.jar} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <LinearGradient
        colors={['#f8fafc', '#e2e8f0', '#cbd5e1']}
        style={placeholderStyles.jarBody}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.85, y: 1 }}
      >
        <LinearGradient
          colors={['#94a3b8', '#64748b', '#475569']}
          style={placeholderStyles.lid}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        <View style={placeholderStyles.labelBand}>
          <View style={placeholderStyles.labelStripe} />
          <View style={placeholderStyles.labelStripeMuted} />
        </View>
        <View style={placeholderStyles.barcodeBlock}>
          {Array.from({ length: 18 }).map((_, i) => (
            <View
              key={i}
              style={[
                placeholderStyles.barStripe,
                { width: i % 3 === 0 ? 2 : 1, opacity: i % 4 === 0 ? 1 : 0.85 },
              ]}
            />
          ))}
        </View>
      </LinearGradient>
    </View>
  )
}

function BarcodeScanOverlay() {
  return (
    <View style={overlayStyles.region} pointerEvents="none" accessibilityElementsHidden>
      <View style={[overlayStyles.corner, overlayStyles.cornerTL]} />
      <View style={[overlayStyles.corner, overlayStyles.cornerTR]} />
      <View style={[overlayStyles.corner, overlayStyles.cornerBL]} />
      <View style={[overlayStyles.corner, overlayStyles.cornerBR]} />
      <View style={overlayStyles.lineGlow} />
      <View style={overlayStyles.scanLine} />
    </View>
  )
}

export function ScanHeroCard({
  title = DEFAULT_TITLE,
  highlightedWord = DEFAULT_HIGHLIGHT,
  description = DEFAULT_DESCRIPTION,
  buttonLabel = DEFAULT_BUTTON,
  onPress,
  imageSource,
  style,
}: ScanHeroCardProps) {
  const { width: winW } = useWindowDimensions()
  const visualWidth = Math.min(172, Math.max(132, winW * 0.36))

  return (
    <View style={[styles.cardShell, style]} accessibilityRole="summary">
      <LinearGradient
        pointerEvents="none"
        colors={[
          scanHeroTokens.bgDeepLeft,
          scanHeroTokens.bgDeep,
          '#052818',
          scanHeroTokens.darkGreen,
        ]}
        locations={[0, 0.28, 0.62, 1]}
        start={{ x: 0, y: 0.45 }}
        end={{ x: 1, y: 0.55 }}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={styles.inner}>
        <View style={styles.leftColumn}>
          <HeroTitle title={title} highlightedWord={highlightedWord} />
          <Text style={styles.description}>{description}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={buttonLabel}
            onPress={onPress}
            style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
          >
            <Ionicons name="scan-outline" size={22} color={scanHeroTokens.buttonLabel} style={styles.ctaScanIcon} />
            <Text style={styles.ctaLabel} numberOfLines={1}>
              {buttonLabel}
            </Text>
            <View style={styles.ctaArrowCircle}>
              <Ionicons name="chevron-forward" size={20} color={scanHeroTokens.textWhite} />
            </View>
          </Pressable>
        </View>

        <View style={[styles.visualColumn, { width: visualWidth }]}>
          <View style={styles.visualTilt}>
            {imageSource ? (
              <Image source={imageSource} style={styles.heroImage} resizeMode="contain" />
            ) : (
              // TODO: `require('../assets/hero-peanut-butter-jar.png')` — drop in a tilted product photo with visible barcode.
              <ProductHeroPlaceholder />
            )}
            <BarcodeScanOverlay />
          </View>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  cardShell: {
    borderRadius: scanHeroTokens.cardRadius,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 14 },
        shadowOpacity: 0.22,
        shadowRadius: 28,
      },
      android: {
        elevation: 10,
      },
      default: {},
    }),
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'space-between',
    minHeight: 248,
    paddingTop: 22,
    paddingBottom: 22,
    paddingLeft: 22,
    paddingRight: 14,
    gap: 8,
  },
  leftColumn: {
    flex: 1,
    flexShrink: 1,
    maxWidth: '56%',
    paddingRight: 6,
    justifyContent: 'center',
    zIndex: 2,
  },
  headline: {
    color: scanHeroTokens.textWhite,
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.35,
    lineHeight: 30,
    marginBottom: 12,
  },
  headlineHighlight: {
    color: scanHeroTokens.primaryGreen,
    fontWeight: '700',
  },
  description: {
    color: scanHeroTokens.bodyMuted,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 20,
    maxWidth: '100%',
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    minHeight: 56,
    paddingLeft: 14,
    paddingRight: 6,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: scanHeroTokens.buttonWhite,
    gap: 10,
    ...Platform.select({
      ios: {
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.12,
        shadowRadius: 12,
      },
      android: {
        elevation: 4,
      },
      default: {},
    }),
  },
  ctaPressed: {
    opacity: 0.94,
    transform: [{ scale: 0.98 }],
  },
  ctaScanIcon: {
    marginRight: -2,
  },
  ctaLabel: {
    flexShrink: 1,
    color: scanHeroTokens.buttonLabel,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.2,
    paddingRight: 4,
  },
  ctaArrowCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: scanHeroTokens.primaryGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  visualColumn: {
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    zIndex: 1,
  },
  visualTilt: {
    transform: [{ rotate: '-10deg' }],
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  heroImage: {
    width: 148,
    height: 210,
  },
})

const placeholderStyles = StyleSheet.create({
  jar: {
    width: 148,
    height: 210,
    borderRadius: 18,
    overflow: 'hidden',
  },
  jarBody: {
    flex: 1,
    borderRadius: 18,
    paddingTop: 10,
  },
  lid: {
    alignSelf: 'center',
    width: '78%',
    height: 22,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    marginBottom: 10,
  },
  labelBand: {
    marginHorizontal: 10,
    height: 52,
    borderRadius: 8,
    backgroundColor: 'rgba(255,251,235,0.95)',
    paddingHorizontal: 8,
    paddingVertical: 8,
    marginBottom: 10,
  },
  labelStripe: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(15,23,42,0.2)',
    width: '72%',
    marginBottom: 6,
  },
  labelStripeMuted: {
    height: 5,
    borderRadius: 2.5,
    backgroundColor: 'rgba(15,23,42,0.12)',
    width: '48%',
  },
  barcodeBlock: {
    flexDirection: 'row',
    alignItems: 'stretch',
    alignSelf: 'center',
    height: 56,
    width: '82%',
    paddingHorizontal: 6,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#fff',
    gap: 2,
    marginBottom: 12,
  },
  barStripe: {
    backgroundColor: '#0f172a',
    borderRadius: 0.5,
  },
})

const overlayStyles = StyleSheet.create({
  region: {
    position: 'absolute',
    left: '8%',
    right: '6%',
    bottom: '14%',
    height: 72,
    justifyContent: 'center',
    alignItems: 'center',
  },
  corner: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderColor: scanHeroTokens.textWhite,
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 2.5,
    borderLeftWidth: 2.5,
    borderTopLeftRadius: 7,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 2.5,
    borderRightWidth: 2.5,
    borderTopRightRadius: 7,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 2.5,
    borderLeftWidth: 2.5,
    borderBottomLeftRadius: 7,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 2.5,
    borderRightWidth: 2.5,
    borderBottomRightRadius: 7,
  },
  lineGlow: {
    position: 'absolute',
    alignSelf: 'center',
    width: '88%',
    height: 14,
    top: '50%',
    marginTop: -7,
    borderRadius: 8,
    backgroundColor: 'rgba(34,197,94,0.22)',
    ...Platform.select({
      ios: {
        shadowColor: scanHeroTokens.primaryGreen,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.85,
        shadowRadius: 10,
      },
      default: {},
    }),
  },
  scanLine: {
    width: '82%',
    height: 2.5,
    borderRadius: 2,
    backgroundColor: scanHeroTokens.primaryGreen,
    zIndex: 2,
    ...Platform.select({
      ios: {
        shadowColor: scanHeroTokens.primaryGreen,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.55,
        shadowRadius: 6,
      },
      default: {},
    }),
  },
})

/**
 * @example
 * ```tsx
 * import { ScanHeroCard } from '../components/ScanHeroCard'
 *
 * export function Home() {
 *   return (
 *     <ScanHeroCard
 *       onPress={() => router.push('/(tabs)/scan')}
 *     />
 *   )
 * }
 *
 * // With custom product image:
 * <ScanHeroCard
 *   imageSource={require('../assets/hero-peanut-butter-jar.png')}
 *   onPress={openScanner}
 * />
 * ```
 */
