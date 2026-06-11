import { useCallback, useEffect, useMemo, useRef, useState, type ComponentProps } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import { useLocalSearchParams, router } from 'expo-router'
import {
  AccessibilityInfo,
  Animated,
  Easing,
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Share,
  Platform,
  Modal,
  Image,
  type ViewStyle,
} from 'react-native'
import ViewShot, { captureRef } from 'react-native-view-shot'
import * as Sharing from 'expo-sharing'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  IngredientCard,
  ShareCard,
  ProfileReasoningCard,
  resolveIngredientDisplayRating,
  ScoreDisplay,
  AllergenEvidenceChips,
  ProductIntelligenceSection,
  type ShareCardProps,
} from '../../components'
import { FILLR_LOGO_MARK } from '../../components/FillrHeaderLogo'
import { colors, theme } from '../../constants/theme'
import { toTitleCase } from '../../lib/formatProductTitle'
import { buildIngredientCardViewModel } from '../../lib/buildIngredientCardViewModel'
import { buildScoreExplainability, type ScoreContributor } from '../../lib/buildScoreExplainability'
import { trackScanResultMetric } from '../../lib/scanResultMetrics'
import { useCurrentScanStore } from '../../store/currentScanStore'
import { useScanHistoryStore } from '../../store/scanHistoryStore'
import { useUserStore } from '../../store/userStore'
import {
  type CeliacSignal,
  type FillrScoringDataSnapshot,
  type IngredientExplanation,
  type MatchedAllergen,
  type MatchedSensitivity,
  type ScanResult,
} from '../../types'
import { ingredientSortRank } from '../../lib/scanResultHook'
import { attachFillrFitToScanResult } from '../../lib/attachFillrFit'
import {
  isIngredientEnrichInFlight,
  runScanAiEnrichment,
  scanNeedsIngredientDecode,
} from '../../services/productService'
import { getDietProfileSnapshotSync } from '../../lib/getUserProfileForScan'
import { personalizeScanResult, refreshScanSafetyForProfile } from '../../lib/personalizationEngine'
import type { UserProfile } from '../../lib/personalizationEngine'
import { buildProfileReasoningModel } from '../../lib/buildProfileReasoning'
import { playSafeScanSound } from '../../lib/playSafeScanSound'
import { textMatchesIngredientGenericPattern } from '../../lib/ingredientCopyQuality'
import { isIngredientLevelGoal } from '../../lib/goalApplicability'
import { migrateGoalKey } from '../../lib/goalKeyMigration'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getUserProfile } = require('../../store/userProfileStore.js') as {
  getUserProfile: () => Promise<{
    allergies: string[]
    sensitivities: string[]
    avoiding: string[]
    preferences: string[]
  }>
}

const TAB_DISCLAIMER =
  'Informational only — not medical advice or a medical device. Always verify the physical label.'

function lastBarcodeSix(barcode: string): string {
  const digits = barcode.replace(/\D/g, '')
  if (digits.length >= 6) return digits.slice(-6)
  return barcode.slice(-Math.min(6, barcode.length))
}

function ingredientHitsAllergen(ing: IngredientExplanation, matches: MatchedAllergen[]): boolean {
  if (!matches.length) return false
  const n = ing.name.toLowerCase()
  return matches.some((m) => {
    const t = m.matchedIngredient.toLowerCase().trim()
    if (!t) return false
    return n.includes(t) || t.includes(n)
  })
}

function ingredientHitsSensitivity(ing: IngredientExplanation, matches: MatchedSensitivity[]): boolean {
  if (!matches.length) return false
  const n = ing.name.toLowerCase()
  return matches.some((m) => {
    const t = m.matchedIngredient.toLowerCase().trim()
    if (!t) return false
    return n.includes(t) || t.includes(n)
  })
}

function matchedAllergenLabelForIngredient(
  ing: IngredientExplanation,
  matches: MatchedAllergen[]
): string | undefined {
  if (!matches.length) return undefined
  const n = ing.name.toLowerCase()
  return matches.find((m) => {
    const t = m.matchedIngredient.toLowerCase().trim()
    if (!t) return false
    return n.includes(t) || t.includes(n)
  })?.allergenName
}

function matchedSensitivityLabelForIngredient(
  ing: IngredientExplanation,
  matches: MatchedSensitivity[]
): string | undefined {
  if (!matches.length) return undefined
  const n = ing.name.toLowerCase()
  return matches.find((m) => {
    const t = m.matchedIngredient.toLowerCase().trim()
    if (!t) return false
    return n.includes(t) || t.includes(n)
  })?.sensitivityName
}

function ingredientHitsCeliac(ing: IngredientExplanation, matches: CeliacSignal[]): CeliacSignal | null {
  if (!matches.length) return null
  const n = ing.name.toLowerCase()
  return (
    matches.find((m) => {
      const t = m.ingredient.toLowerCase().trim()
      if (!t) return false
      return n.includes(t) || t.includes(n)
    }) ?? null
  )
}

function isPossibleMatchIngredient(ing: IngredientExplanation): boolean {
  if (ing.sourceAmbiguity && ing.sourceAmbiguity.confidence !== 'high') return true
  if (ing.intelligenceConfidence === 'medium') return true
  return false
}

function sortIngredientsList(
  items: IngredientExplanation[],
  matchedAllergens: MatchedAllergen[],
  matchedSensitivities: MatchedSensitivity[]
): IngredientExplanation[] {
  return [...items].sort((a, b) => {
    const aa = ingredientHitsAllergen(a, matchedAllergens)
    const ab = ingredientHitsAllergen(b, matchedAllergens)
    const sa = ingredientHitsSensitivity(a, matchedSensitivities)
    const sb = ingredientHitsSensitivity(b, matchedSensitivities)
    const ra = resolveIngredientDisplayRating(a, aa, sa)
    const rb = resolveIngredientDisplayRating(b, ab, sb)
    const pa =
      aa ||
      sa ||
      a.personalFlag === 'avoiding' ||
      a.personalFlag === 'preference_conflict' ||
      a.personalFlag === 'allergy' ||
      a.personalFlag === 'sensitivity'
    const pb =
      ab ||
      sb ||
      b.personalFlag === 'avoiding' ||
      b.personalFlag === 'preference_conflict' ||
      b.personalFlag === 'allergy' ||
      b.personalFlag === 'sensitivity'
    const [ka, xa] = ingredientSortRank(ra, pa)
    const [kb, xb] = ingredientSortRank(rb, pb)
    if (ka !== kb) return ka - kb
    if (xa !== xb) return xa - xb
    return 0
  })
}

/** Scan control in footer — proportions aligned with home `scanTile` / `scanMark`, scaled down. */
/** Same proportions as home `scanTile` / `scanMark` (112px tile → 76px mark). */
const FOOTER_SCAN_TILE = 76
const FOOTER_SCAN_MARK = Math.round(FOOTER_SCAN_TILE * (76 / 112))

function displayIngredientName(name: string): string {
  const t = name.trim()
  if (!t) return ''
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase()
}

function reasonChipForIngredient(
  ing: IngredientExplanation,
  goalKey: string,
  allergyMatch: boolean,
  sensitivityMatch: boolean,
  hasUserAllergies: boolean,
  hasUserSensitivities: boolean
): string | null {
  const n = `${ing.name} ${ing.shortLabel ?? ''} ${ing.systemJudgment ?? ''}`.toLowerCase()
  if (hasUserAllergies && (allergyMatch || ing.flagDriver === 'allergy' || ing.personalFlag === 'allergy')) {
    return 'Conflicts with your allergy'
  }
  if (
    hasUserSensitivities &&
    (sensitivityMatch || ing.flagDriver === 'sensitivity' || ing.personalFlag === 'sensitivity')
  ) {
    return 'Conflicts with your sensitivity'
  }
  if (ing.flagDriver === 'preference' || ing.personalFlag === 'preference_conflict') {
    return 'Preference conflict'
  }
  if (ing.flagDriver === 'goal' && isIngredientLevelGoal(migrateGoalKey(goalKey))) {
    return 'Flagged for your goal'
  }
  if (/red\s*40|yellow\s*5|yellow\s*6|blue\s*1|tartrazine|allura|dye|color|colour/.test(n)) {
    return 'Artificial dye risk'
  }
  if (/benzoate|sorbate|nitrite|nitrate|bht|bha|tbhq|edta|preserv/.test(n)) {
    return 'Preservative risk'
  }
  if (/sucralose|aspartame|acesulfame|saccharin|sweetener|fructose|corn syrup|hfcs|sugar/.test(n)) {
    return 'Sweetener load'
  }
  if (/polysorbate|lecithin|mono|diglyceride|carrageenan|xanthan|emulsif/.test(n)) {
    return 'Emulsifier risk'
  }
  if (/hydrogenated|seed oil|canola|soybean oil|sunflower oil|palm oil/.test(n)) {
    return 'Refined oil risk'
  }
  if ((ing.ingredientRating ?? 'okay') === 'avoid' || (ing.ingredientRating ?? 'okay') === 'concerning') {
    return 'Processing risk'
  }
  return null
}

function personalImpactRank(
  ing: IngredientExplanation,
  allergyMatch: boolean,
  sensitivityMatch: boolean,
  hasUserAllergies: boolean,
  hasUserSensitivities: boolean,
  goalKey: string
): number {
  if (hasUserAllergies && (allergyMatch || ing.personalFlag === 'allergy' || ing.flagDriver === 'allergy'))
    return 0
  if (
    hasUserSensitivities &&
    (sensitivityMatch || ing.personalFlag === 'sensitivity' || ing.flagDriver === 'sensitivity')
  )
    return 1
  if (ing.flagDriver === 'goal' && isIngredientLevelGoal(migrateGoalKey(goalKey))) return 2
  if (ing.flagDriver === 'preference' || ing.personalFlag === 'preference_conflict') return 3
  const r = ing.ingredientRating ?? 'okay'
  if (r === 'avoid' || r === 'concerning' || ing.flagDriver === 'processing') return 4
  return 5
}

function firstSentence(text: string): string {
  const clean = text.trim()
  if (!clean) return ''
  return clean.split(/(?<=[.!?])\s+/)[0]?.trim() ?? clean
}

function productAnalysisHasIntel(
  analysis: ScanResult['productAnalysis']
): boolean {
  if (!analysis) return false
  return Boolean(
    analysis.viralHook?.trim() ||
      analysis.bottomLine?.trim() ||
      (analysis.regulatoryFlags?.length ?? 0) > 0 ||
      (analysis.labelVsReality?.length ?? 0) > 0 ||
      (analysis.redFlags?.length ?? 0) > 0 ||
      (analysis.hiddenIngredients?.length ?? 0) > 0 ||
      (analysis.sugarSources?.length ?? 0) > 1 ||
      analysis.ingredientOrderInsight?.trim() ||
      analysis.whatTheyDontTellYou?.trim()
  )
}

function TabSectionHeader({
  dotColor,
  label,
  icon,
  containerStyle,
}: {
  dotColor: string
  label: string
  icon?: ComponentProps<typeof Ionicons>['name']
  containerStyle?: ViewStyle
}) {
  return (
    <View style={[styles.sectionHeaderRow, containerStyle]}>
      {icon ? (
        <Ionicons name={icon} size={15} color={dotColor} style={styles.sectionHeaderIcon} />
      ) : (
        <View style={[styles.sectionHeaderDot, { backgroundColor: dotColor }]} />
      )}
      <Text style={[styles.sectionHeaderLabel, { color: dotColor }]}>{label}</Text>
    </View>
  )
}

type ScoreDriverRow = {
  sign: '+' | '-' | '!'
  label: string
  tone: 'good' | 'warn' | 'bad'
}

function titleCaseDriver(raw: string): string {
  const t = raw.trim()
  if (!t) return ''
  return t.charAt(0).toUpperCase() + t.slice(1)
}

function scoreDriverFromContributor(c: ScoreContributor): ScoreDriverRow {
  if (c.capMaxScore != null) {
    return { sign: '!', label: `${titleCaseDriver(c.label)} cap`, tone: 'bad' }
  }
  return {
    sign: c.delta >= 0 ? '+' : '-',
    label: titleCaseDriver(c.label),
    tone: c.delta >= 0 ? 'good' : Math.abs(c.delta) >= 18 ? 'bad' : 'warn',
  }
}

function positiveScoreDrivers(scoringData?: FillrScoringDataSnapshot): ScoreDriverRow[] {
  if (!scoringData) return []
  const counts = scoringData.ingredientCounts
  const total = Math.max(1, scoringData.totalIngredients ?? 0)
  const rows: ScoreDriverRow[] = []
  if ((counts?.natural ?? 0) >= Math.max(2, total * 0.45)) {
    rows.push({ sign: '+', label: 'Whole-food base', tone: 'good' })
  }
  if (scoringData.productCategory === 'whole_food' || scoringData.productCategory === 'clean_snack') {
    rows.push({ sign: '+', label: 'Simple formula', tone: 'good' })
  }
  if ((counts?.additive ?? 0) === 0 && (counts?.flagged ?? 0) === 0 && total > 0) {
    rows.push({ sign: '+', label: 'No major additive load', tone: 'good' })
  }
  return rows
}

function buildScoreDrivers(
  scoringData: FillrScoringDataSnapshot | undefined,
  contributors: ScoreContributor[]
): ScoreDriverRow[] {
  const rows = [
    ...positiveScoreDrivers(scoringData),
    ...contributors.map(scoreDriverFromContributor),
  ]
  const seen = new Set<string>()
  return rows
    .filter((row) => {
      const key = row.label.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .slice(0, 3)
}

function ScoreDriversBrief({
  scoringData,
  contributors,
}: {
  scoringData?: FillrScoringDataSnapshot
  contributors: ScoreContributor[]
}) {
  const rows = buildScoreDrivers(scoringData, contributors)
  if (rows.length === 0) return null
  return (
    <View style={styles.scoreDriversWrap} accessibilityLabel="Why this score">
      <Text style={styles.scoreDriversTitle}>Why this score</Text>
      <View style={styles.scoreDriversRow}>
        {rows.map((row) => (
          <View
            key={`${row.sign}-${row.label}`}
            style={[
              styles.scoreDriverPill,
              row.tone === 'good'
                ? styles.scoreDriverGood
                : row.tone === 'bad'
                  ? styles.scoreDriverBad
                  : styles.scoreDriverWarn,
            ]}
          >
            <Text
              style={[
                styles.scoreDriverSign,
                row.tone === 'good'
                  ? styles.scoreDriverGoodText
                  : row.tone === 'bad'
                    ? styles.scoreDriverBadText
                    : styles.scoreDriverWarnText,
              ]}
            >
              {row.sign}
            </Text>
            <Text
              style={[
                styles.scoreDriverText,
                row.tone === 'good'
                  ? styles.scoreDriverGoodText
                  : row.tone === 'bad'
                    ? styles.scoreDriverBadText
                    : styles.scoreDriverWarnText,
              ]}
              numberOfLines={1}
            >
              {row.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  )
}

function profileGoalLabel(goalKey: string): string {
  const map: Record<string, string> = {
    less_sugar: 'low-sugar goal',
    low_sugar: 'low-sugar goal',
    more_protein: 'protein goal',
    high_protein: 'protein goal',
    build_muscle: 'protein goal',
    gut_health: 'gut-health goal',
    eat_cleaner: 'cleaner-eating goal',
    reduce_upf: 'less-processed goal',
    lower_sodium: 'lower-sodium goal',
  }
  return map[goalKey] ?? goalKey.replace(/_/g, ' ')
}

function buildPersonalizedProductInsight(args: {
  goalKey?: string
  scoreExplainability: ReturnType<typeof buildScoreExplainability>
  matchedAllergens: MatchedAllergen[]
  matchedSensitivities: MatchedSensitivity[]
  celiacAvoid: boolean
}): string | null {
  const { goalKey = '', scoreExplainability, matchedAllergens, matchedSensitivities, celiacAvoid } = args
  if (matchedAllergens.length > 0) {
    const names = matchedAllergens.map((m) => m.allergenName).filter(Boolean).slice(0, 2).join(', ')
    return `For your profile, the main issue is the confirmed ${names || 'allergen'} match.`
  }
  if (celiacAvoid) {
    return 'For your strict gluten setting, the main issue is the gluten signal in this ingredient list.'
  }
  if (matchedSensitivities.length > 0) {
    const names = matchedSensitivities.map((m) => m.sensitivityName).filter(Boolean).slice(0, 2).join(', ')
    return `For your profile, the main issue is the ${names || 'sensitivity'} match.`
  }
  const goalConflict = scoreExplainability.goalConflicts[0]
  if (goalKey && goalConflict) {
    const ingredients = goalConflict.ingredients.length > 0 ? `: ${goalConflict.ingredients.join(', ')}` : ''
    return `For your ${profileGoalLabel(goalKey)}, the issue is ${goalConflict.title.toLowerCase()}${ingredients}.`
  }
  return null
}

export default function ProductScreen() {
  const insets = useSafeAreaInsets()
  const { id, preview } = useLocalSearchParams<{ id: string; preview?: string }>()
  const isOnboardingPreview = preview === 'onboarding'
  const allergies = useUserStore((s) => s.allergies)
  const hasUserAllergies = (allergies?.length ?? 0) > 0
  const celiacStrictGluten = useUserStore((s) => s.celiacStrictGluten)
  const zSensitivities = useUserStore((s) => s.sensitivities)
  const hasUserSensitivities = (zSensitivities?.length ?? 0) > 0
  const preferences = useUserStore((s) => s.preferences)
  const goal = useUserStore((s) => s.goal)
  const currentResult = useCurrentScanStore((s) => s.result)
  const setCurrentScan = useCurrentScanStore((s) => s.setResult)
  const getResultByProductId = useScanHistoryStore((s) => s.getResultByProductId)
  const updateScanResultByProductId = useScanHistoryStore((s) => s.updateScanResultByProductId)
  const toggleSaved = useScanHistoryStore((s) => s.toggleSaved)
  const isSaved = useScanHistoryStore((s) => s.isSaved(id || ''))
  const [ingredientQuery, setIngredientQuery] = useState('')
  const [expandedIngredientKeys, setExpandedIngredientKeys] = useState<string[]>([])
  const [showAllNatural, setShowAllNatural] = useState(false)
  const [productNameModalVisible, setProductNameModalVisible] = useState(false)
  const [productNameDraft, setProductNameDraft] = useState('')
  const [profileSectionExpanded, setProfileSectionExpanded] = useState(false)
  const [allergenEvidenceExpanded, setAllergenEvidenceExpanded] = useState(false)
  const [showIngredientSearch, setShowIngredientSearch] = useState(false)
  const [feedbackRating, setFeedbackRating] = useState<number | null>(null)

  const scrollRef = useRef<ScrollView>(null)
  const shareCardRef = useRef<InstanceType<typeof ViewShot>>(null)
  const screenOpenedAtMsRef = useRef<number>(Date.now())
  const uniqueExpandedKeysRef = useRef<Set<string>>(new Set())
  const decisionMadeRef = useRef<boolean>(false)
  const renderedEventProductIdRef = useRef<string | null>(null)
  const decodeRetryStartedRef = useRef(false)

  const storedResult =
    currentResult?.product.id === id ? currentResult : getResultByProductId(id || '')

  const userProfileForPersonalize: UserProfile = useMemo(
    () => ({
      allergies: allergies ?? [],
      sensitivities: zSensitivities ?? [],
      preferences: preferences ?? [],
      goal: goal ?? '',
      celiacStrictGluten: Boolean(celiacStrictGluten),
    }),
    [allergies, zSensitivities, preferences, goal, celiacStrictGluten]
  )

  const viewResult = useMemo(() => {
    if (!storedResult) return null
    return personalizeScanResult(
      refreshScanSafetyForProfile(storedResult, userProfileForPersonalize),
      userProfileForPersonalize
    )
  }, [storedResult, userProfileForPersonalize])

  const openProductNameModal = useCallback(() => {
    const r = currentResult?.product.id === id ? currentResult : getResultByProductId(id || '')
    if (!r) return
    setProductNameDraft(r.product.name)
    setProductNameModalVisible(true)
  }, [id, currentResult, getResultByProductId])

  const saveProductDisplayName = useCallback(() => {
    const r = currentResult?.product.id === id ? currentResult : getResultByProductId(id || '')
    if (!r) return
    const trimmed = productNameDraft.trim()
    if (!trimmed) return
    const next: ScanResult = {
      ...r,
      product: { ...r.product, name: trimmed },
    }
    setCurrentScan(next)
    updateScanResultByProductId(r.product.id, next)
    setProductNameModalVisible(false)
  }, [
    productNameDraft,
    id,
    currentResult,
    getResultByProductId,
    setCurrentScan,
    updateScanResultByProductId,
  ])

  const displayScoredResult = useMemo((): ScanResult | null => {
    if (!viewResult) return null
    // Frozen or stored score — never recompute when profile or ingredient copy changes.
    if (viewResult.fillrFit || viewResult.scoringFrozenAt) return viewResult
    return attachFillrFitToScanResult(viewResult, getDietProfileSnapshotSync())
  }, [viewResult, allergies, zSensitivities, preferences, goal, celiacStrictGluten])

  const displayFillrFit = displayScoredResult?.fillrFit ?? null
  const displayScoringData = displayScoredResult?.scoringData

  useEffect(() => {
    if (!displayScoredResult || !displayScoredResult.fillrFit || !viewResult) return
    if (viewResult.fillrFit) return
    // Persist one-time hydration so reopening from history never loses score again.
    updateScanResultByProductId(displayScoredResult.product.id, displayScoredResult)
    if (currentResult?.product.id === displayScoredResult.product.id) {
      setCurrentScan(displayScoredResult)
    }
  }, [displayScoredResult, viewResult, currentResult?.product.id, setCurrentScan, updateScanResultByProductId])

  useEffect(() => {
    if (isOnboardingPreview || !displayScoredResult || decodeRetryStartedRef.current) return
    if (!scanNeedsIngredientDecode(displayScoredResult)) return
    const productId = displayScoredResult.product.id
    if (isIngredientEnrichInFlight(productId)) return
    decodeRetryStartedRef.current = true
    void (async () => {
      try {
        const enriched = await runScanAiEnrichment(
          displayScoredResult,
          getDietProfileSnapshotSync()
        )
        setCurrentScan(enriched)
        updateScanResultByProductId(productId, enriched)
      } catch (err) {
        console.warn('[Fillr] product screen ingredient decode retry failed', err)
      }
    })()
  }, [
    displayScoredResult,
    isOnboardingPreview,
    setCurrentScan,
    updateScanResultByProductId,
  ])

  useFocusEffect(
    useCallback(() => {
      let alive = true
      void (async () => {
        try {
          await getUserProfile()
        } catch {
          if (alive) {
            /* keep defaults */
          }
        }
      })()
      return () => {
        alive = false
      }
    }, [])
  )

  const ingredientBreakdown = viewResult?.ingredientBreakdown ?? []
  const matchedAllergens = viewResult?.matchedAllergens ?? []
  const matchedSensitivities = viewResult?.matchedSensitivities ?? []
  const celiac = viewResult?.celiac
  const productVerdict = viewResult?.productVerdict ?? ''
  const productAnalysis = viewResult?.productAnalysis
  const showTrustPanels = !isOnboardingPreview && Boolean(viewResult)
  const safetyStatus = viewResult?.safetyStatus ?? 'UNKNOWN'
  const product = viewResult?.product

  const safetyFlashOpacity = useRef(new Animated.Value(0)).current
  const safetyFlashFillColor = useMemo(() => {
    switch (safetyStatus) {
      case 'SAFE':
        return colors.safe
      case 'UNSAFE':
        return colors.danger
      case 'CAUTION':
        return colors.caution
      default:
        return colors.unknown
    }
  }, [safetyStatus])

  useEffect(() => {
    if (!product?.id || isOnboardingPreview) return
    let cancelled = false
    const run = async () => {
      try {
        const reduce = await AccessibilityInfo.isReduceMotionEnabled()
        if (cancelled) return

        safetyFlashOpacity.setValue(0)

        if (safetyStatus === 'SAFE') {
          if (reduce) {
            Animated.sequence([
              Animated.timing(safetyFlashOpacity, {
                toValue: 1,
                duration: 90,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true,
              }),
              Animated.timing(safetyFlashOpacity, {
                toValue: 0,
                duration: 220,
                easing: Easing.in(Easing.quad),
                useNativeDriver: true,
              }),
            ]).start()
            return
          }
          void playSafeScanSound()
          Animated.sequence([
            Animated.timing(safetyFlashOpacity, {
              toValue: 1,
              duration: 120,
              easing: Easing.out(Easing.cubic),
              useNativeDriver: true,
            }),
            Animated.delay(520),
            Animated.timing(safetyFlashOpacity, {
              toValue: 0,
              duration: 520,
              easing: Easing.in(Easing.quad),
              useNativeDriver: true,
            }),
          ]).start()
          return
        }

        if (reduce) return

        Animated.sequence([
          Animated.timing(safetyFlashOpacity, {
            toValue: 0.44,
            duration: 150,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(safetyFlashOpacity, {
            toValue: 0,
            duration: 480,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
        ]).start()
      } catch {
        if (!cancelled) safetyFlashOpacity.setValue(0)
      }
    }
    void run()
    return () => {
      cancelled = true
      safetyFlashOpacity.stopAnimation()
      safetyFlashOpacity.setValue(0)
    }
  }, [product?.id, safetyStatus, isOnboardingPreview, safetyFlashOpacity])

  const uncertainIngredients = useMemo(
    () => ingredientBreakdown.filter((ing) => isPossibleMatchIngredient(ing)),
    [ingredientBreakdown]
  )

  const displayName = product?.name ? toTitleCase(product.name) : ''
  const displayBrand = product?.brand ? toTitleCase(product.brand) : ''

  const celiacEnabled = Boolean(celiac?.celiacModeEnabled)
  const celiacAvoid = celiacEnabled && celiac?.celiacSeverity === 'AVOID'

  const ratingCounts = useMemo(() => {
    const o = { clean: 0, okay: 0, concerning: 0, avoid: 0 }
    for (const ing of ingredientBreakdown) {
      const aa = ingredientHitsAllergen(ing, matchedAllergens)
      const ss = ingredientHitsSensitivity(ing, matchedSensitivities)
      const r = resolveIngredientDisplayRating(ing, aa, ss)
      o[r]++
    }
    return o
  }, [ingredientBreakdown, matchedAllergens, matchedSensitivities])

  const previewIngredientSlice = useMemo(
    () => ingredientBreakdown.slice(0, 3),
    [ingredientBreakdown]
  )

  const previewRatingCounts = useMemo(() => {
    const o = { clean: 0, okay: 0, concerning: 0, avoid: 0 }
    for (const ing of previewIngredientSlice) {
      const aa = ingredientHitsAllergen(ing, matchedAllergens)
      const ss = ingredientHitsSensitivity(ing, matchedSensitivities)
      const r = resolveIngredientDisplayRating(ing, aa, ss)
      o[r]++
    }
    return o
  }, [previewIngredientSlice, matchedAllergens, matchedSensitivities])

  const summaryRatioCounts = isOnboardingPreview
    ? {
        natural: previewRatingCounts.clean,
        processed: previewRatingCounts.okay,
        additive: previewRatingCounts.concerning,
        flagged: previewRatingCounts.avoid,
      }
    : {
        natural: ratingCounts.clean,
        processed: ratingCounts.okay,
        additive: ratingCounts.concerning,
        flagged: ratingCounts.avoid,
      }
  const profileReasoning = useMemo(
    () =>
      buildProfileReasoningModel({
        safetyStatus,
        matchedAllergens,
        matchedSensitivities,
        celiac,
        scoringData: displayScoringData,
        fillrFit: displayFillrFit,
        userGoalKey: goal ?? '',
      }),
    [
      safetyStatus,
      matchedAllergens,
      matchedSensitivities,
      celiac,
      displayScoringData,
      displayFillrFit,
      goal,
    ]
  )
  const scoreExplainability = useMemo(
    () =>
      buildScoreExplainability({
        scoringData: displayScoringData,
        ingredients: ingredientBreakdown,
        goalKey: goal ?? '',
      }),
    [displayScoringData, ingredientBreakdown, goal]
  )
  const personalizedProductInsight = useMemo(
    () =>
      buildPersonalizedProductInsight({
        goalKey: goal ?? '',
        scoreExplainability,
        matchedAllergens,
        matchedSensitivities,
        celiacAvoid,
      }),
    [goal, scoreExplainability, matchedAllergens, matchedSensitivities, celiacAvoid]
  )
  const verificationRecommended =
    uncertainIngredients.length > 0 &&
    (safetyStatus === 'UNSAFE' ||
      safetyStatus === 'CAUTION' ||
      matchedAllergens.length > 0 ||
      celiacAvoid ||
      profileReasoning.fit === 'poor')

  const shareCardProps = useMemo((): ShareCardProps | null => {
    if (!displayFillrFit || ingredientBreakdown.length === 0) return null
    return {
      score: displayFillrFit.score,
      verdict: displayFillrFit.verdict,
      productName: displayName,
      brand: product?.brand ?? '',
      naturalCount: ratingCounts.clean,
      totalCount: ingredientBreakdown.length,
      scanDate: new Date(),
    }
  }, [
    displayFillrFit,
    ingredientBreakdown.length,
    displayName,
    product?.brand,
    ratingCounts.clean,
  ])

  const searchTokens = useMemo(() => {
    const q = ingredientQuery.trim().toLowerCase()
    if (!q) return []
    return q.split(/\s+/).filter(Boolean)
  }, [ingredientQuery])

  function ingredientSearchHaystack(ingredient: IngredientExplanation): string {
    const parts = [
      ingredient.name,
      ingredient.shortLabel,
      ingredient.systemJudgment,
      ingredient.impactForYou,
      ingredient.whyItMattersBullets?.join(' '),
      ingredient.headline,
      ingredient.funFact,
      ingredient.explanation,
      ingredient.quickSummary,
      ingredient.whatItIs,
      ingredient.whyItsUsed,
      ingredient.whatToKnow,
      ingredient.whatItDoes,
      ingredient.bodyEffect,
      ingredient.commonName,
      ingredient.ratingReason,
      ingredient.personalizedNote,
      ingredient.whereItComeFrom,
      ingredient.whyItMatters,
      ingredient.bullets?.join(' '),
      ingredient.contextStat,
    ]
    return parts
      .filter((p): p is string => typeof p === 'string' && p.length > 0)
      .join(' ')
      .toLowerCase()
  }

  const ingredientMatchesQuery = (ingredient: IngredientExplanation) => {
    if (searchTokens.length === 0) return true
    const haystack = ingredientSearchHaystack(ingredient)
    return searchTokens.every((t) => haystack.includes(t))
  }

  const filteredIngredients =
    searchTokens.length > 0 ? ingredientBreakdown.filter(ingredientMatchesQuery) : ingredientBreakdown

  const sortedIngredientBreakdown = useMemo(
    () => sortIngredientsList(ingredientBreakdown, matchedAllergens, matchedSensitivities),
    [ingredientBreakdown, matchedAllergens, matchedSensitivities]
  )

  const filteredSorted = useMemo(
    () =>
      searchTokens.length > 0
        ? sortIngredientsList(filteredIngredients, matchedAllergens, matchedSensitivities)
        : sortedIngredientBreakdown,
    [searchTokens.length, filteredIngredients, sortedIngredientBreakdown, matchedAllergens, matchedSensitivities]
  )

  const ingredientListForCards = isOnboardingPreview
    ? sortedIngredientBreakdown.slice(0, 3)
    : filteredSorted

  const resolveRate = useCallback(
    (ing: IngredientExplanation) => {
      const aa = ingredientHitsAllergen(ing, matchedAllergens)
      const ss = ingredientHitsSensitivity(ing, matchedSensitivities)
      return resolveIngredientDisplayRating(ing, aa, ss)
    },
    [matchedAllergens, matchedSensitivities]
  )

  const groupedForIngredientsTab = useMemo(() => {
    const safety: IngredientExplanation[] = []
    const processing: IngredientExplanation[] = []
    const neutral: IngredientExplanation[] = []
    for (const ing of ingredientListForCards) {
      const aa = ingredientHitsAllergen(ing, matchedAllergens)
      const ss = ingredientHitsSensitivity(ing, matchedSensitivities)
      if (
        (hasUserAllergies && (aa || ing.personalFlag === 'allergy' || ing.flagDriver === 'allergy')) ||
        (hasUserSensitivities &&
          (ss || ing.personalFlag === 'sensitivity' || ing.flagDriver === 'sensitivity'))
      ) {
        safety.push(ing)
        continue
      }

      const displayRating = resolveIngredientDisplayRating(ing, aa, ss)
      const isProcessingBucket =
        displayRating === 'avoid' ||
        displayRating === 'concerning' ||
        displayRating === 'okay' ||
        ing.flagDriver === 'processing' ||
        (ing.flagDriver === 'goal' && isIngredientLevelGoal(migrateGoalKey(goal ?? ''))) ||
        ing.personalFlag === 'avoiding'

      if (isProcessingBucket) processing.push(ing)
      else neutral.push(ing)
    }
    return { safety, processing, neutral }
  }, [ingredientListForCards, matchedAllergens, matchedSensitivities, goal, hasUserAllergies, hasUserSensitivities])

  const autoExpandIngredientKeys = useMemo(() => {
    const prefix = searchTokens.length > 0 ? 'q' : 'i'
    const top = [
      ...groupedForIngredientsTab.safety.map((ing, i) => `${prefix}-safety-${i}-${ing.name}`),
      ...groupedForIngredientsTab.processing.map((ing, i) => `${prefix}-processing-${i}-${ing.name}`),
    ]
    return top.slice(0, 2)
  }, [searchTokens.length, groupedForIngredientsTab])

  const ingredientBreakdownIdentity = useMemo(
    () => ingredientBreakdown.map((ing) => ing.name).join('\u0001'),
    [ingredientBreakdown]
  )
  const isIngredientDecodePending = ingredientBreakdown.some((ing) => ing.aiDecodePending)

  useEffect(() => {
    screenOpenedAtMsRef.current = Date.now()
    uniqueExpandedKeysRef.current = new Set()
    decisionMadeRef.current = false
    setFeedbackRating(null)
    setExpandedIngredientKeys([])
    setProfileSectionExpanded(false)
    setAllergenEvidenceExpanded(false)
    setShowIngredientSearch(false)
    const pid = product?.id
    const bc = product?.barcode
    if (pid && bc) {
      void trackScanResultMetric({
        name: 'scan_result_opened',
        productId: pid,
        barcode: bc,
        payload: { source: viewResult?.scanSource ?? 'barcode' },
      })
    }
  }, [id, ingredientBreakdownIdentity, product?.id, product?.barcode, viewResult?.scanSource])

  useEffect(() => {
    const pid = product?.id
    const bc = product?.barcode
    if (!pid || !bc) return
    if (renderedEventProductIdRef.current === pid) return
    renderedEventProductIdRef.current = pid

    const genericCopyCount = ingredientBreakdown.reduce((count, ing) => {
      const fields = [
        ing.shortLabel,
        ing.headline,
        ing.labelDecoder,
        ing.whatItIs,
        ing.whatItDoes,
        ing.bodyEffect,
        ing.impactForYou,
        ing.systemJudgment,
      ]
      const hit = fields.some((f) => textMatchesIngredientGenericPattern(f))
      return count + (hit ? 1 : 0)
    }, 0)
    const total = ingredientBreakdown.length
    void trackScanResultMetric({
      name: 'scan_result_rendered',
      productId: pid,
      barcode: bc,
      payload: {
        source: viewResult?.scanSource ?? 'barcode',
        ingredient_count: total,
        uncertain_count: uncertainIngredients.length,
        verification_recommended: verificationRecommended,
        weak_copy_count: genericCopyCount,
        weak_copy_rate: total > 0 ? Number((genericCopyCount / total).toFixed(3)) : 0,
      },
    })
    void trackScanResultMetric({
      name: 'scan_copy_quality',
      productId: pid,
      barcode: bc,
      payload: {
        weak_copy_count: genericCopyCount,
        total_ingredients: total,
        has_weak_copy: genericCopyCount > 0,
      },
    })
  }, [
    product?.id,
    product?.barcode,
    ingredientBreakdown,
    uncertainIngredients.length,
    verificationRecommended,
    viewResult?.scanSource,
  ])

  useEffect(() => {
    if (isIngredientDecodePending) return
    if (autoExpandIngredientKeys.length === 0) return
    setExpandedIngredientKeys((prev) => (prev.length === 0 ? autoExpandIngredientKeys : prev))
  }, [autoExpandIngredientKeys, isIngredientDecodePending])

  useEffect(() => {
    const pid = product?.id
    const bc = product?.barcode
    return () => {
      if (!pid || !bc) return
      const totalShown = Math.max(ingredientListForCards.length, 1)
      const expandedUnique = uniqueExpandedKeysRef.current.size
      const expandRate = Math.min(1, expandedUnique / totalShown)
      void trackScanResultMetric({
        name: 'scan_result_summary',
        productId: pid,
        barcode: bc,
        payload: {
          ms_to_exit: Date.now() - screenOpenedAtMsRef.current,
          expanded_unique: expandedUnique,
          expand_rate: Number(expandRate.toFixed(3)),
          decision_made: decisionMadeRef.current,
          feedback_rating: feedbackRating ?? null,
        },
      })
    }
  }, [product?.id, product?.barcode, ingredientListForCards.length, feedbackRating])

  const profileTone: 'bad' | 'warn' | 'ok' =
    safetyStatus !== 'SAFE' || profileReasoning.fit === 'poor'
      ? 'bad'
      : profileReasoning.fit === 'mixed'
        ? 'warn'
        : 'ok'
  const verificationSeverity: 'unsafe' | 'caution' | null = !verificationRecommended
    ? null
    : safetyStatus === 'UNSAFE' || matchedAllergens.length > 0 || celiacAvoid
      ? 'unsafe'
      : 'caution'
  const profileCollapsedTitle =
    verificationSeverity === 'unsafe'
      ? 'High risk - verify label now'
      : verificationSeverity === 'caution'
        ? 'Caution - verify label'
        : profileReasoning.collapsedTitle
  const profileCollapsedSubtitle =
    verificationSeverity === 'unsafe'
      ? 'Potentially high-risk ingredients are uncertain. Verify the physical label before using this result.'
      : verificationSeverity === 'caution'
        ? 'Some flagged ingredients are uncertain. Double-check the package label before relying on this result.'
        : profileReasoning.collapsedSubtitle

  const heroTakeaway = useMemo(() => {
    if (matchedAllergens.length > 0) {
      const names = [...new Set(matchedAllergens.map((m) => m.allergenName).filter(Boolean))].slice(0, 3)
      return `Contains ${names.join(', ')} — not safe for your allergy profile.`
    }
    if (celiacAvoid) {
      return 'Gluten signal detected under your strict celiac setting.'
    }
    if (matchedSensitivities.length > 0) {
      const names = matchedSensitivities.map((m) => m.sensitivityName).filter(Boolean).slice(0, 2)
      return `Matches your ${names.join(' and ')} sensitivit${names.length > 1 ? 'ies' : 'y'}.`
    }
    if (displayFillrFit?.reason?.trim()) return displayFillrFit.reason.trim()
    if (productVerdict?.trim()) return firstSentence(productVerdict)
    return profileReasoning.collapsedSubtitle
  }, [
    matchedAllergens,
    celiacAvoid,
    matchedSensitivities,
    displayFillrFit?.reason,
    productVerdict,
    profileReasoning.collapsedSubtitle,
  ])

  const showProfileSection = useMemo(() => {
    if (isOnboardingPreview || isIngredientDecodePending) return false
    return (
      matchedAllergens.length > 0 ||
      matchedSensitivities.length > 0 ||
      verificationRecommended ||
      profileTone !== 'ok' ||
      celiacAvoid ||
      profileReasoning.fit !== 'good'
    )
  }, [
    isOnboardingPreview,
    isIngredientDecodePending,
    matchedAllergens.length,
    matchedSensitivities.length,
    verificationRecommended,
    profileTone,
    celiacAvoid,
    profileReasoning.fit,
  ])

  const showProductIntelPanel = productAnalysisHasIntel(productAnalysis)

  const shareMessage = useMemo(() => {
    if (!product?.barcode) return ''
    const bits = matchedAllergens.map((m) => `${m.allergenName}: ${m.matchedIngredient}`)
    const flags = bits.length ? `\n${bits.join('\n')}` : ''
    const verdict = productVerdict ? `\n${productVerdict}` : ''
    return `Fillr — ${displayName}${verdict}${flags}\n\nBarcode …${lastBarcodeSix(product.barcode)}`
  }, [displayName, product?.barcode, matchedAllergens, productVerdict])

  const shareScanFromCard = useCallback(async () => {
    if (ingredientBreakdown.length === 0 || !shareCardProps) {
      try {
        await Share.share({ message: shareMessage })
      } catch {
        /* dismissed */
      }
      return
    }
    await new Promise((r) => setTimeout(r, 160))
    let uri: string | null = null
    try {
      uri = await captureRef(shareCardRef, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
      })
    } catch {
      uri = null
    }
    if (!uri) {
      try {
        await Share.share({ message: shareMessage })
      } catch {
        /* dismissed */
      }
      return
    }
    if (Platform.OS === 'web') {
      try {
        await Share.share({ message: shareMessage })
      } catch {
        /* dismissed */
      }
      return
    }
    try {
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Share Fillr scan' })
        return
      }
    } catch {
      /* fall through */
    }
    try {
      await Share.share({ url: uri, message: shareMessage })
    } catch {
      try {
        await Share.share({ message: shareMessage })
      } catch {
        /* dismissed */
      }
    }
  }, [ingredientBreakdown.length, shareCardProps, shareMessage])

  const markDecision = useCallback(
    (kind: 'saved' | 'dismissed' | 'rescanned' | 'shared' | 'swap_click') => {
      if (!product?.id || !product.barcode) return
      if (!decisionMadeRef.current) {
        decisionMadeRef.current = true
      }
      void trackScanResultMetric({
        name: kind === 'swap_click' ? 'scan_result_swap_click' : 'scan_result_decision',
        productId: product.id,
        barcode: product.barcode,
        payload: {
          decision: kind,
          ms_from_open: Date.now() - screenOpenedAtMsRef.current,
        },
      })
    },
    [product?.id, product?.barcode]
  )

  if (!storedResult || !viewResult || !product) {
    return (
      <SafeAreaView style={[styles.screenRoot, styles.centeredMiss]} edges={['top']}>
        <Text style={styles.error}>Product not found</Text>
        <Pressable onPress={() => router.replace('/(tabs)/scan')} style={styles.errorPrimaryBtn}>
          <Text style={styles.errorPrimaryBtnText}>Scan another</Text>
        </Pressable>
      </SafeAreaView>
    )
  }

  const renderIngredientCard = (
    ing: IngredientExplanation,
    i: number,
    prefix: 'sf' | 'i' | 'q',
    sectionKey?: string
  ) => {
    const cardKey =
      sectionKey != null ? `${prefix}-${sectionKey}-${i}-${ing.name}` : `${prefix}-${i}-${ing.name}`
    const allergyMatch = ingredientHitsAllergen(ing, matchedAllergens)
    const sensitivityMatch = ingredientHitsSensitivity(ing, matchedSensitivities)
    const celiacMatch = ingredientHitsCeliac(ing, celiac?.matchedGlutenSignals ?? [])
    return (
      <IngredientCard
        key={cardKey}
        ingredient={ing}
        expanded={expandedIngredientKeys.includes(cardKey)}
        allergyMatch={allergyMatch}
        sensitivityMatch={sensitivityMatch}
        celiacMatch={celiacMatch}
        reasonChipLabel={reasonChipForIngredient(
          ing,
          goal ?? '',
          allergyMatch,
          sensitivityMatch,
          hasUserAllergies,
          hasUserSensitivities
        )}
        compactPreview={isOnboardingPreview}
        onToggleExpanded={() =>
          setExpandedIngredientKeys((prev) => {
            if (prev.includes(cardKey)) return prev.filter((k) => k !== cardKey)
            uniqueExpandedKeysRef.current.add(cardKey)
            void trackScanResultMetric({
              name: 'ingredient_expanded',
              productId: product.id,
              barcode: product.barcode,
              payload: {
                ingredient: ing.name,
                section: sectionKey ?? 'unknown',
                reason_chip:
                  reasonChipForIngredient(
                    ing,
                    goal ?? '',
                    allergyMatch,
                    sensitivityMatch,
                    hasUserAllergies,
                    hasUserSensitivities
                  ) ?? null,
              },
            })
            const next = [cardKey, ...prev]
            return next.slice(0, 2)
          })
        }
      />
    )
  }


  const feedbackRow = (
    <View style={styles.feedbackRow}>
      <Text style={styles.feedbackPrompt}>Rate this scan</Text>
      <View style={styles.feedbackStarsWrap}>
        {[1, 2, 3, 4, 5].map((v) => {
          const filled = (feedbackRating ?? 0) >= v
          return (
            <Pressable
              key={`scan-star-${v}`}
              style={({ pressed }) => [styles.feedbackStarBtn, pressed && { opacity: 0.85 }]}
              onPress={() => {
                setFeedbackRating(v)
                void trackScanResultMetric({
                  name: 'scan_result_feedback',
                  productId: product.id,
                  barcode: product.barcode,
                  payload: { rating: v, scale: 5 },
                })
              }}
              accessibilityRole="button"
              accessibilityLabel={`Rate this scan ${v} out of 5 stars`}
            >
              <Ionicons name={filled ? 'star' : 'star-outline'} size={18} color={filled ? '#f59e0b' : '#94a3b8'} />
            </Pressable>
          )
        })}
      </View>
      {feedbackRating ? (
        <View style={styles.feedbackAckWrap}>
          <Ionicons name="checkmark-circle" size={14} color={theme.green700} />
          <Text style={styles.feedbackAckText}>Saved ({feedbackRating}/5)</Text>
        </View>
      ) : null}
    </View>
  )

  const naturalCount = groupedForIngredientsTab.neutral.length

  const ingredientsPanel = (
    <View style={styles.tabPanel}>
      <View style={styles.ingredientsSectionHead}>
        <Text style={styles.ingredientsSectionTitle}>Ingredients</Text>
        <Text style={styles.ingredientsSectionMeta}>{ingredientListForCards.length} listed</Text>
      </View>

      {isIngredientDecodePending && !isOnboardingPreview ? (
        <Text style={styles.decodeStatusLine} accessibilityLiveRegion="polite">
          Decoding ingredient details…
        </Text>
      ) : null}

      {!isOnboardingPreview ? (
        showIngredientSearch ? (
          <View style={styles.searchBar}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search ingredients"
              placeholderTextColor={theme.textFaint}
              value={ingredientQuery}
              onChangeText={(t) => {
                setIngredientQuery(t)
                setExpandedIngredientKeys([])
              }}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
          </View>
        ) : (
          <Pressable
            style={({ pressed }) => [styles.searchToggle, pressed && { opacity: 0.88 }]}
            onPress={() => setShowIngredientSearch(true)}
            accessibilityRole="button"
            accessibilityLabel="Search ingredients"
          >
            <Ionicons name="search-outline" size={16} color={theme.textFaint} />
            <Text style={styles.searchToggleText}>Search</Text>
          </Pressable>
        )
      ) : null}

      {groupedForIngredientsTab.safety.length > 0 ? (
        <>
          <TabSectionHeader dotColor={theme.flagged.accent} label="Conflicts" />
          {groupedForIngredientsTab.safety.map((ing, i) =>
            renderIngredientCard(ing, i, searchTokens.length > 0 ? 'q' : 'i', 'safety')
          )}
        </>
      ) : null}

      {groupedForIngredientsTab.processing.length > 0 ? (
        <>
          <TabSectionHeader dotColor={theme.additive.accent} label="Processing" />
          {groupedForIngredientsTab.processing.map((ing, i) =>
            renderIngredientCard(ing, i, searchTokens.length > 0 ? 'q' : 'i', 'processing')
          )}
        </>
      ) : null}

      {!showAllNatural && naturalCount > 0 ? (
        <Pressable
          style={({ pressed }) => [styles.showNaturalBtn, pressed && { opacity: 0.94 }]}
          onPress={() => setShowAllNatural(true)}
        >
          <Text style={styles.showNaturalBtnText}>
            {`Show ${naturalCount} neutral ingredients`}
          </Text>
        </Pressable>
      ) : null}

      {showAllNatural && naturalCount > 0 ? (
        <>
          <TabSectionHeader dotColor={theme.natural.accent} label="Neutral" />
          {groupedForIngredientsTab.neutral.map((ing, i) =>
            renderIngredientCard(ing, i, searchTokens.length > 0 ? 'q' : 'i', 'neutral')
          )}
        </>
      ) : null}

      {!isOnboardingPreview && searchTokens.length > 0 && ingredientListForCards.length === 0 ? (
        <Text style={styles.searchEmptyText}>No matching ingredients.</Text>
      ) : null}

      {feedbackRating != null ? feedbackRow : null}
      <Text style={styles.tabDisclaimer}>{TAB_DISCLAIMER}</Text>
    </View>
  )

  const heroTitlePressable =
    !isOnboardingPreview && viewResult?.scanSource === 'ocr' ? (
      <Pressable onPress={openProductNameModal} accessibilityRole="button">
        <Text style={styles.heroTitle}>{displayName}</Text>
      </Pressable>
    ) : (
      <Text style={styles.heroTitle}>{displayName}</Text>
    )

  return (
    <SafeAreaView style={styles.screenRoot} edges={['top']}>
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          {
            /** Room for floating scan FAB + home indicator + shadow lift */
            paddingBottom:
              FOOTER_SCAN_TILE + 4 + Math.max(insets.bottom, 14) + 28,
          },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <View style={styles.scrollBlockA}>
          <View style={styles.navBar}>
            <Pressable
              onPress={() => {
                markDecision('dismissed')
                router.canGoBack() ? router.back() : router.replace('/(tabs)/scan')
              }}
              style={styles.navIconBare}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Ionicons name="chevron-back" size={20} color={theme.textPrimary} />
            </Pressable>
            <View style={styles.navRightRow}>
              {!isOnboardingPreview ? (
                <>
                  <Pressable
                    onPress={() => {
                      if (!isSaved) markDecision('saved')
                      toggleSaved(product.id)
                    }}
                    hitSlop={12}
                    style={styles.navIconBare}
                    accessibilityRole="button"
                    accessibilityLabel={isSaved ? 'Remove from saved list' : 'Save to list'}
                  >
                    <Ionicons
                      name={isSaved ? 'heart' : 'heart-outline'}
                      size={20}
                      color={isSaved ? colors.accent : theme.textPrimary}
                    />
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      markDecision('shared')
                      void shareScanFromCard()
                    }}
                    hitSlop={12}
                    style={styles.navIconBare}
                    accessibilityRole="button"
                    accessibilityLabel="Share scan result"
                  >
                    <Ionicons name="share-outline" size={20} color={theme.textPrimary} />
                  </Pressable>
                </>
              ) : null}
            </View>
          </View>

          <View style={styles.heroInner}>
            {isOnboardingPreview ? (
              <Text style={styles.heroBrand}>SAMPLE PREVIEW</Text>
            ) : displayBrand ? (
              <Text style={styles.heroBrand}>{displayBrand.toUpperCase()}</Text>
            ) : null}
            {heroTitlePressable}
            <ScoreDisplay fillrFit={displayFillrFit} isLoading={!displayFillrFit} showReason={false} />
            {heroTakeaway.trim() ? (
              <Text style={styles.heroTakeaway} numberOfLines={3}>
                {heroTakeaway}
              </Text>
            ) : null}
            {showTrustPanels && matchedAllergens.length > 0 ? (
              allergenEvidenceExpanded ? (
                <View style={styles.allergenEvidenceBlock}>
                  <AllergenEvidenceChips matches={matchedAllergens} compact />
                  <Pressable
                    onPress={() => setAllergenEvidenceExpanded(false)}
                    style={({ pressed }) => [styles.inlineLinkBtn, pressed && { opacity: 0.85 }]}
                    accessibilityRole="button"
                    accessibilityLabel="Hide allergen evidence"
                  >
                    <Text style={styles.inlineLinkText}>Hide evidence</Text>
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  style={({ pressed }) => [styles.allergenCompact, pressed && { opacity: 0.92 }]}
                  onPress={() => setAllergenEvidenceExpanded(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Show allergen match evidence"
                >
                  <Ionicons name="shield-outline" size={16} color={theme.flagged.text} />
                  <Text style={styles.allergenCompactText}>View match evidence</Text>
                  <Ionicons name="chevron-forward" size={16} color={theme.textFaint} />
                </Pressable>
              )
            ) : null}
            {showTrustPanels &&
            viewResult?.productNameHints &&
            viewResult.productNameHints.length > 0 ? (
              <View style={styles.nameHintsBanner}>
                <Text style={styles.nameHintsTitle}>Name-only hints (not confirmed)</Text>
                {viewResult.productNameHints.map((h, i) => (
                  <Text key={`hint-${i}`} style={styles.nameHintsLine}>
                    {h.allergenName}: {h.hintText}
                  </Text>
                ))}
              </View>
            ) : null}
            {showTrustPanels && showProductIntelPanel && productAnalysis ? (
              <ProductIntelligenceSection
                analysis={productAnalysis}
                productVerdict={productVerdict}
                personalizedInsight={personalizedProductInsight}
                hidePersonalizedInsight={showProfileSection}
              />
            ) : null}
            {showProfileSection ? (
              <View
                style={[
                  styles.profileUnifiedOuter,
                  profileTone === 'bad'
                    ? styles.profileUnifiedOuterConflict
                    : profileTone === 'warn'
                      ? styles.profileUnifiedOuterWarn
                      : styles.profileUnifiedOuterOk,
                ]}
              >
                <View style={styles.profileUnifiedClip}>
                  <View style={styles.profileUnifiedBody}>
                    <View style={styles.profileUnifiedBodyContent}>
                      <Pressable
                        onPress={() => setProfileSectionExpanded((v) => !v)}
                        style={({ pressed }) => [
                          styles.profileSectionHeader,
                          pressed && styles.profileSectionHeaderPressed,
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel={
                          profileSectionExpanded ? 'Collapse your profile section' : 'Expand your profile section'
                        }
                        accessibilityState={{ expanded: profileSectionExpanded }}
                        hitSlop={8}
                      >
                        <Text style={[styles.profileUnifiedKicker, styles.profileUnifiedKickerInHeader]}>
                          FOR YOU
                        </Text>
                        <Ionicons
                          name={profileSectionExpanded ? 'chevron-up' : 'chevron-down'}
                          size={20}
                          color={theme.textFaint}
                        />
                      </Pressable>
                      {!profileSectionExpanded ? (
                        <View style={styles.profileCollapsedSummary} pointerEvents="none">
                          <Text
                            style={
                              profileTone === 'bad'
                                ? styles.profileTitleConflict
                                : profileTone === 'warn'
                                  ? styles.profileTitleWarn
                                  : styles.profileTitleOk
                            }
                            numberOfLines={1}
                          >
                            {profileCollapsedTitle}
                          </Text>
                          <Text style={styles.profileUnifiedBodyText} numberOfLines={2}>
                            {profileCollapsedSubtitle}
                          </Text>
                        </View>
                      ) : (
                        <>
                          <ProfileReasoningCard
                            model={profileReasoning}
                            contributors={scoreExplainability.contributors}
                          />
                          <ScoreDriversBrief
                            scoringData={displayScoringData}
                            contributors={scoreExplainability.contributors}
                          />
                        </>
                      )}
                    </View>
                  </View>
                </View>
              </View>
            ) : null}

          </View>
          <View style={styles.heroDivider} />
        </View>
        {ingredientsPanel}
      </ScrollView>

      {!isOnboardingPreview ? (
        <View
          style={[styles.footerWrap, { paddingBottom: Math.max(insets.bottom, 14) }]}
          pointerEvents="box-none"
        >
          <View style={styles.footerFloatRow} pointerEvents="box-none">
            <Pressable
              onPress={() => {
                markDecision('rescanned')
                void trackScanResultMetric({
                  name: 'scan_result_rescan_click',
                  productId: product.id,
                  barcode: product.barcode,
                  payload: {
                    prior_product_name: displayName,
                    prior_brand: product.brand ?? '',
                  },
                })
                useCurrentScanStore.getState().setResult(null)
                router.replace('/(tabs)/scan')
              }}
              style={({ pressed }) => [styles.footerScanPressable, pressed && { transform: [{ scale: 0.96 }] }]}
              accessibilityRole="button"
              accessibilityLabel="Open scanner"
            >
              <View style={styles.footerScanTileHome}>
                <Image source={FILLR_LOGO_MARK} style={styles.footerScanFabMark} resizeMode="contain" />
              </View>
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={[styles.footerPreview, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.previewBackBtn, pressed && { opacity: 0.92 }]}
          >
            <Text style={styles.previewBackBtnText}>Back to setup</Text>
          </Pressable>
        </View>
      )}

      {!isOnboardingPreview && shareCardProps ? (
        <View style={styles.shareCardHiddenWrap} pointerEvents="none" collapsable={false}>
          <ShareCard ref={shareCardRef} {...shareCardProps} />
        </View>
      ) : null}

      {!isOnboardingPreview ? (
        <Animated.View
          pointerEvents="none"
          importantForAccessibility="no"
          accessibilityElementsHidden
          style={[StyleSheet.absoluteFillObject, styles.safetyFlashOverlay, { opacity: safetyFlashOpacity }]}
        >
          {safetyStatus === 'SAFE' ? (
            <View style={styles.safetyFlashSafeFill}>
              <Ionicons name="checkmark-circle" size={116} color="rgba(255,255,255,0.97)" />
            </View>
          ) : safetyStatus === 'UNSAFE' ? (
            <View style={styles.safetyFlashUnsafeFill}>
              <Ionicons name="close-circle" size={116} color="rgba(255,255,255,0.97)" />
            </View>
          ) : safetyStatus === 'CAUTION' ? (
            <View style={styles.safetyFlashCautionFill}>
              <Ionicons name="alert-circle" size={116} color="rgba(255,255,255,0.97)" />
            </View>
          ) : (
            <View style={[StyleSheet.absoluteFillObject, { backgroundColor: safetyFlashFillColor }]} />
          )}
        </Animated.View>
      ) : null}

      <Modal
        visible={productNameModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setProductNameModalVisible(false)}
        statusBarTranslucent
      >
        <View style={styles.nameModalRoot}>
          <Pressable
            style={[StyleSheet.absoluteFillObject, styles.nameModalBackdrop]}
            onPress={() => setProductNameModalVisible(false)}
            accessibilityRole="button"
            accessibilityLabel="Dismiss"
          />
          <View pointerEvents="box-none" style={[StyleSheet.absoluteFillObject, styles.nameModalCenter]}>
            <View style={styles.nameModalCard} pointerEvents="auto">
              <Text style={styles.nameModalTitle}>Name this product</Text>
              <TextInput
                value={productNameDraft}
                onChangeText={setProductNameDraft}
                placeholder="e.g. Organic oat milk"
                placeholderTextColor={theme.textFaint}
                style={styles.nameModalInput}
                autoFocus
                onSubmitEditing={saveProductDisplayName}
                returnKeyType="done"
              />
              <Pressable
                onPress={saveProductDisplayName}
                style={({ pressed }) => [styles.nameModalSave, pressed && { opacity: 0.92 }]}
              >
                <Text style={styles.nameModalSaveText}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  /** Brief full-screen tint on open — green / red / yellow / gray from `SafetyStatus`. */
  safetyFlashOverlay: {
    zIndex: 24,
  },
  safetyFlashSafeFill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.safe,
    justifyContent: 'center',
    alignItems: 'center',
  },
  safetyFlashUnsafeFill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.danger,
    justifyContent: 'center',
    alignItems: 'center',
  },
  safetyFlashCautionFill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.caution,
    justifyContent: 'center',
    alignItems: 'center',
  },
  screenRoot: {
    flex: 1,
    backgroundColor: theme.screenBg,
  },
  centeredMiss: {
    justifyContent: 'center',
  },
  scroll: {
    flex: 1,
    backgroundColor: theme.screenBg,
  },
  scrollContent: {
    flexGrow: 1,
  },
  scrollBlockA: {
    backgroundColor: theme.screenBg,
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    marginBottom: 8,
    paddingHorizontal: theme.screenPadding,
  },
  navIconBare: {
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navRightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  heroInner: {
    paddingHorizontal: theme.heroPadding,
  },
  profileUnifiedOuter: {
    marginTop: 12,
    marginBottom: 4,
    borderRadius: 16,
    backgroundColor: 'transparent',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  profileUnifiedOuterOk: {
    shadowOpacity: 0,
  },
  profileUnifiedOuterConflict: {
    shadowOpacity: 0,
  },
  profileUnifiedOuterWarn: {
    shadowOpacity: 0,
  },
  profileUnifiedClip: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
  },
  profileUnifiedBody: {
    flex: 1,
    position: 'relative',
  },
  profileUnifiedBodyContent: {
    paddingTop: 14,
    paddingRight: 14,
    paddingBottom: 15,
    paddingLeft: 14,
    zIndex: 1,
  },
  profileUnifiedKicker: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.6,
    color: theme.textFaint,
    opacity: 0.92,
    marginBottom: 13,
  },
  profileUnifiedKickerInHeader: {
    marginBottom: 0,
    flex: 1,
  },
  profileSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  profileSectionHeaderPressed: {
    opacity: 0.88,
  },
  profileCollapsedSummary: {
    marginTop: 0,
  },
  profileUnifiedRow: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'flex-start',
  },
  profileUnifiedIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileUnifiedIconWrapOk: {
    backgroundColor: 'rgba(45, 212, 191, 0.12)',
  },
  profileUnifiedIconWrapConflict: {
    backgroundColor: 'rgba(244, 63, 94, 0.1)',
  },
  profileUnifiedBodyText: {
    marginTop: 7,
    fontSize: 12,
    lineHeight: 19,
    color: theme.textMuted,
  },
  profileUnifiedDivider: {
    height: 1,
    marginVertical: 18,
    width: '100%',
  },
  profileUnifiedSectionKicker: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.4,
    color: theme.textFaint,
    opacity: 0.92,
    marginBottom: 9,
  },
  profileUnifiedGoalTitle: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.3,
    marginBottom: 7,
    color: theme.green800,
  },
  profileUnifiedGoalTitleWarn: {
    color: '#b45309',
  },
  profileUnifiedGoalBody: {
    fontSize: 12,
    lineHeight: 19,
    color: theme.textMuted,
  },
  heroBrand: {
    fontSize: 10,
    fontWeight: '600',
    color: theme.textFaint,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.textPrimary,
    lineHeight: 23,
    letterSpacing: -0.4,
    marginBottom: 12,
  },
  heroTakeaway: {
    marginTop: 4,
    marginBottom: 4,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    color: theme.textMuted,
  },
  heroDivider: {
    height: 8,
    marginTop: 16,
    backgroundColor: '#f1f5f9',
  },
  allergenCompact: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#fff5f5',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#fecaca',
  },
  allergenCompactText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: theme.flagged.text,
  },
  allergenEvidenceBlock: {
    marginTop: 8,
    gap: 6,
  },
  inlineLinkBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
  },
  inlineLinkText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.textFaint,
  },
  ingredientsSectionHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  ingredientsSectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: theme.textPrimary,
    letterSpacing: -0.3,
  },
  ingredientsSectionMeta: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.textFaint,
  },
  decodeStatusLine: {
    marginBottom: 12,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
    color: theme.textFaint,
  },
  searchToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    marginBottom: 12,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: '#f1f5f9',
  },
  searchToggleText: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.textFaint,
  },
  scoreDriversWrap: {
    marginTop: -4,
    marginBottom: 10,
    gap: 7,
  },
  scoreDriversTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: theme.textFaint,
    textTransform: 'uppercase',
  },
  scoreDriversRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  scoreDriverPill: {
    minHeight: 28,
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 9,
    borderWidth: StyleSheet.hairlineWidth,
  },
  scoreDriverGood: {
    backgroundColor: '#ffffff',
    borderColor: '#d1fae5',
  },
  scoreDriverWarn: {
    backgroundColor: '#ffffff',
    borderColor: '#fde68a',
  },
  scoreDriverBad: {
    backgroundColor: '#ffffff',
    borderColor: '#fecdd3',
  },
  scoreDriverSign: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '900',
  },
  scoreDriverText: {
    maxWidth: 180,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
  },
  scoreDriverGoodText: {
    color: '#166534',
  },
  scoreDriverWarnText: {
    color: '#92400e',
  },
  scoreDriverBadText: {
    color: '#9f1239',
  },
  tabPanel: {
    paddingTop: 16,
    paddingHorizontal: theme.screenPadding,
    paddingBottom: 24,
    backgroundColor: theme.screenBg,
  },
  /** Space between "WORTH A LOOK" label and the card cluster */
  worthLookSectionHeader: {
    marginBottom: 8,
  },
  summaryWorthCluster: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: theme.cardBg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.cardBorder,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 1,
  },
  worthLookTileList: {
    gap: 0,
  },
  worthLookRow: {
    paddingVertical: 12,
    paddingHorizontal: 0,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(15, 23, 42, 0.08)',
  },
  worthLookRowLast: {
    borderBottomWidth: 0,
    paddingBottom: 2,
  },
  worthLookRowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  worthLookIconOrb: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(241, 245, 249, 0.95)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(15, 23, 42, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  worthLookTextCol: {
    flex: 1,
    minWidth: 0,
  },
  worthLookTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.textPrimary,
    letterSpacing: -0.35,
    marginBottom: 2,
  },
  /** One-line “should I care” hook under the ingredient name */
  worthLookRoleTag: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.textMuted,
    lineHeight: 18,
    letterSpacing: -0.15,
    marginTop: 2,
  },
  worthLookExpanded: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(15, 23, 42, 0.1)',
    paddingLeft: 54,
    paddingRight: 0,
  },
  worthLookCategoryPill: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.85,
    textTransform: 'uppercase',
    color: theme.green800,
    opacity: 0.85,
    marginBottom: 10,
  },
  worthLookImpactList: {
    gap: 10,
  },
  worthLookImpactRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  worthLookImpactArrow: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.textMuted,
    lineHeight: 20,
    marginTop: 0,
    width: 18,
  },
  worthLookImpactText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: theme.textPrimary,
    lineHeight: 20,
    letterSpacing: -0.15,
  },
  worthLookJudgmentBlock: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(15, 23, 42, 0.08)',
  },
  worthLookIntelSectionLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.85,
    textTransform: 'uppercase',
    color: theme.textFaint,
    marginBottom: 6,
  },
  worthLookJudgmentBody: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.textSecondary,
    lineHeight: 20,
    letterSpacing: -0.12,
  },
  worthLookForYouBlock: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(15, 23, 42, 0.08)',
  },
  worthLookForYouBody: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.textMuted,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionHeaderIcon: {
    marginTop: 1,
  },
  sectionHeaderDot: {
    width: 7,
    height: 7,
    borderRadius: 50,
  },
  sectionHeaderLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.15,
    textTransform: 'uppercase',
  },
  spacer16: {
    height: 16,
  },
  profileTextCol: {
    flex: 1,
  },
  profileTitleOk: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.green800,
    letterSpacing: -0.2,
  },
  profileTitleConflict: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.flagged.text,
    letterSpacing: -0.2,
  },
  profileTitleWarn: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.processed.text,
    letterSpacing: -0.2,
  },
  viewAllIngredientsBtn: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: 'rgba(22, 163, 74, 0.22)',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 28,
    shadowColor: '#16a34a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 2,
  },
  viewAllIngredientsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  viewAllIngredientsText: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.green800,
    letterSpacing: -0.2,
  },
  searchBar: {
    backgroundColor: theme.cardBg,
    borderWidth: 1.5,
    borderColor: theme.cardBorderOpen,
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 14,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    color: theme.textPrimary,
    padding: 0,
  },
  nameHintsBanner: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    gap: 6,
  },
  nameHintsTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#92400e',
  },
  nameHintsLine: {
    fontSize: 13,
    lineHeight: 18,
    color: '#78350f',
  },
  showNaturalBtn: {
    backgroundColor: theme.green50,
    borderWidth: 1.5,
    borderColor: theme.greenBorder,
    borderRadius: 14,
    padding: 13,
    marginBottom: 8,
  },
  showNaturalBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.green800,
    textAlign: 'center',
  },
  tabDisclaimer: {
    fontSize: 10,
    color: theme.textDisabled,
    textAlign: 'center',
    lineHeight: 16,
    paddingTop: 16,
    marginBottom: 8,
  },
  feedbackRow: {
    marginTop: 8,
    marginBottom: 2,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  feedbackPrompt: {
    fontSize: 11.5,
    fontWeight: '600',
    color: theme.textMuted,
  },
  feedbackStarsWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  feedbackStarBtn: {
    paddingHorizontal: 2,
    paddingVertical: 2,
  },
  feedbackAckWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  feedbackAckText: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.green700,
  },
  footerWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: theme.screenPadding,
    paddingTop: 4,
    backgroundColor: 'transparent',
  },
  footerFloatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: FOOTER_SCAN_TILE,
  },
  footerScanPressable: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** Mirrors `HomeScreen` `scanTile` — white disc, hairline rim, soft lift (scaled to footer size). */
  footerScanTileHome: {
    width: FOOTER_SCAN_TILE,
    height: FOOTER_SCAN_TILE,
    borderRadius: FOOTER_SCAN_TILE / 2,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.08)',
    ...Platform.select({
      ios: {
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.11,
        shadowRadius: 16,
      },
      android: { elevation: 7 },
      default: {},
    }),
  },
  footerScanFabMark: {
    width: FOOTER_SCAN_MARK,
    height: FOOTER_SCAN_MARK,
  },
  footerPreview: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: theme.screenBg,
    paddingHorizontal: theme.screenPadding,
  },
  previewBackBtn: {
    height: 56,
    borderRadius: 100,
    backgroundColor: theme.green500,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewBackBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  shareCardHiddenWrap: {
    position: 'absolute',
    left: -9999,
    top: -9999,
    opacity: 0,
    backgroundColor: '#0a0a0a',
  },
  searchEmptyText: {
    fontSize: 14,
    color: theme.textMuted,
    textAlign: 'center',
    marginTop: 16,
  },
  previewProfileNote: {
    backgroundColor: '#fef2f2',
    borderWidth: 1.5,
    borderColor: '#fecaca',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  previewProfileNoteLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#991b1b',
    marginBottom: 4,
  },
  previewProfileNoteBody: {
    fontSize: 14,
    fontWeight: '400',
    color: theme.textSecondary,
    lineHeight: 20,
  },
  nameModalRoot: {
    flex: 1,
  },
  nameModalBackdrop: {
    backgroundColor: 'rgba(15,23,42,0.45)',
  },
  nameModalCenter: {
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  nameModalCard: {
    backgroundColor: theme.cardBg,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1.5,
    borderColor: theme.cardBorderOpen,
  },
  nameModalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.textPrimary,
    marginBottom: 12,
  },
  nameModalInput: {
    borderWidth: 1.5,
    borderColor: theme.cardBorderOpen,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: theme.textPrimary,
    marginBottom: 16,
  },
  nameModalSave: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  nameModalSaveText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  error: {
    fontSize: 16,
    color: colors.text,
    textAlign: 'center',
    padding: 32,
  },
  errorPrimaryBtn: {
    marginHorizontal: 24,
    height: 54,
    borderRadius: 100,
    backgroundColor: theme.green500,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorPrimaryBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
})
