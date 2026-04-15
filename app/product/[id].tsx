import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import { useLocalSearchParams, router } from 'expo-router'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Share,
  Platform,
  Modal,
  Animated,
  ActivityIndicator,
} from 'react-native'
import ViewShot, { captureRef } from 'react-native-view-shot'
import * as Sharing from 'expo-sharing'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  IngredientCard,
  ShareCard,
  resolveIngredientDisplayRating,
  ScoreDisplay,
  AllergenPill,
  RatioBar,
  type RatioCounts,
  type ShareCardProps,
} from '../../components'
import { colors, theme } from '../../constants/theme'
import { formatAllergenTagsForDisplay } from '../../lib/fillrAdapter'
import { toTitleCase } from '../../lib/formatProductTitle'
import { useCurrentScanStore } from '../../store/currentScanStore'
import { useScanHistoryStore } from '../../store/scanHistoryStore'
import { useUserStore } from '../../store/userStore'
import {
  type CeliacSignal,
  type IngredientExplanation,
  type MatchedAllergen,
  type MatchedSensitivity,
  type ScanResult,
} from '../../types'
import { rescanWithManualIngredients } from '../../services/productService'
import { ingredientSortRank } from '../../lib/scanResultHook'
import { attachFillrFitToScanResult } from '../../lib/attachFillrFit'
import { getDietProfileSnapshotSync } from '../../lib/getUserProfileForScan'
import { personalizeScanResult } from '../../lib/personalizationEngine'
import type { UserProfile } from '../../lib/personalizationEngine'
import { formatGoalName } from '../../lib/fillrScoring'
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

function TabSectionHeader({ dotColor, label }: { dotColor: string; label: string }) {
  return (
    <View style={styles.sectionHeaderRow}>
      <View style={[styles.sectionHeaderDot, { backgroundColor: dotColor }]} />
      <Text style={[styles.sectionHeaderLabel, { color: dotColor }]}>{label}</Text>
    </View>
  )
}

function ProductTabs({
  active,
  onChange,
}: {
  active: 'summary' | 'ingredients'
  onChange: (t: 'summary' | 'ingredients') => void
}) {
  const aSummary = useRef(new Animated.Value(active === 'summary' ? 1 : 0)).current
  const aIng = useRef(new Animated.Value(active === 'ingredients' ? 1 : 0)).current

  useEffect(() => {
    Animated.parallel([
      Animated.timing(aSummary, {
        toValue: active === 'summary' ? 1 : 0,
        duration: 200,
        useNativeDriver: false,
      }),
      Animated.timing(aIng, {
        toValue: active === 'ingredients' ? 1 : 0,
        duration: 200,
        useNativeDriver: false,
      }),
    ]).start()
  }, [active, aSummary, aIng])

  const inactiveBg = 'rgba(255,255,255,0)'
  const summaryBg = aSummary.interpolate({
    inputRange: [0, 1],
    outputRange: [inactiveBg, '#ffffff'],
  })
  const summaryColor = aSummary.interpolate({
    inputRange: [0, 1],
    outputRange: [theme.textMuted, theme.green800],
  })
  const ingBg = aIng.interpolate({
    inputRange: [0, 1],
    outputRange: [inactiveBg, '#ffffff'],
  })
  const ingColor = aIng.interpolate({
    inputRange: [0, 1],
    outputRange: [theme.textMuted, theme.green800],
  })

  return (
    <View style={styles.tabBarWrap}>
      <View style={styles.tabRow}>
        <Pressable style={styles.tabFlex} onPress={() => onChange('summary')}>
          <Animated.View
            style={[
              styles.tabInner,
              { backgroundColor: summaryBg },
              active === 'summary' ? styles.tabInnerActiveShadow : null,
            ]}
          >
            <Animated.Text style={[styles.tabLabel, { color: summaryColor }]}>Summary</Animated.Text>
          </Animated.View>
        </Pressable>
        <Pressable style={styles.tabFlex} onPress={() => onChange('ingredients')}>
          <Animated.View
            style={[
              styles.tabInner,
              { backgroundColor: ingBg },
              active === 'ingredients' ? styles.tabInnerActiveShadow : null,
            ]}
          >
            <Animated.Text style={[styles.tabLabel, { color: ingColor }]}>Ingredients</Animated.Text>
          </Animated.View>
        </Pressable>
      </View>
    </View>
  )
}

export default function ProductScreen() {
  const insets = useSafeAreaInsets()
  const { id, preview } = useLocalSearchParams<{ id: string; preview?: string }>()
  const isOnboardingPreview = preview === 'onboarding'
  const allergies = useUserStore((s) => s.allergies)
  const celiacStrictGluten = useUserStore((s) => s.celiacStrictGluten)
  const zSensitivities = useUserStore((s) => s.sensitivities)
  const preferences = useUserStore((s) => s.preferences)
  const goal = useUserStore((s) => s.goal)
  const currentResult = useCurrentScanStore((s) => s.result)
  const setCurrentScan = useCurrentScanStore((s) => s.setResult)
  const getResultByProductId = useScanHistoryStore((s) => s.getResultByProductId)
  const updateScanResultByProductId = useScanHistoryStore((s) => s.updateScanResultByProductId)
  const toggleSaved = useScanHistoryStore((s) => s.toggleSaved)
  const isSaved = useScanHistoryStore((s) => s.isSaved(id || ''))
  const [ingredientQuery, setIngredientQuery] = useState('')
  const [expandedIngredientKey, setExpandedIngredientKey] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'summary' | 'ingredients'>('summary')
  const [showAllNatural, setShowAllNatural] = useState(false)
  const defaultFlaggedExpanded = useRef(false)
  const [pasteValue, setPasteValue] = useState('')
  const [pasteAnalyzing, setPasteAnalyzing] = useState(false)
  const [productNameModalVisible, setProductNameModalVisible] = useState(false)
  const [productNameDraft, setProductNameDraft] = useState('')

  const scrollRef = useRef<ScrollView>(null)
  const shareCardRef = useRef<InstanceType<typeof ViewShot>>(null)

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
    return personalizeScanResult(storedResult, userProfileForPersonalize)
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
    return attachFillrFitToScanResult(viewResult, getDietProfileSnapshotSync())
  }, [viewResult, allergies, zSensitivities, preferences, goal, celiacStrictGluten])

  const displayFillrFit = displayScoredResult?.fillrFit ?? null

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

  if (!storedResult || !viewResult) {
    return (
      <SafeAreaView style={[styles.screenRoot, styles.centeredMiss]} edges={['top']}>
        <Text style={styles.error}>Product not found</Text>
        <Pressable onPress={() => router.replace('/(tabs)/scan')} style={styles.errorPrimaryBtn}>
          <Text style={styles.errorPrimaryBtnText}>Scan another</Text>
        </Pressable>
      </SafeAreaView>
    )
  }

  const {
    product,
    matchedAllergens,
    matchedSensitivities,
    celiac,
    ingredientBreakdown,
    productVerdict,
    smartSummary,
    declaredAllergensLabel,
    safetyStatus,
  } = viewResult

  const scoreLoading = useMemo(
    () => ingredientBreakdown.some((ing) => Boolean(ing.aiDecodePending)),
    [ingredientBreakdown]
  )
  const scoreDisplayFit = scoreLoading ? null : displayFillrFit

  const displayName = toTitleCase(product.name)
  const displayBrand = product.brand ? toTitleCase(product.brand) : ''

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

  const summaryRatioCounts: RatioCounts = isOnboardingPreview
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
  const scoringGoalMatches = displayScoredResult?.scoringData?.goalMatches ?? []
  const scoringGoalConflicts = displayScoredResult?.scoringData?.goalConflicts ?? []
  const userGoalKey = (goal || '').trim().toLowerCase()
  const showGoalInsight =
    userGoalKey.length > 0 &&
    (scoringGoalMatches.length > 0 || scoringGoalConflicts.length > 0)
  const goalInsightConflict = scoringGoalConflicts.length > 0
  const goalDisplayName = formatGoalName(userGoalKey)

  const uniqueAllergenNames = useMemo(
    () => [
      ...new Map(matchedAllergens.map((m) => [m.allergenKey.toLowerCase(), m.allergenName])).values(),
    ],
    [matchedAllergens]
  )

  const shareCardProps = useMemo((): ShareCardProps | null => {
    if (!displayFillrFit || ingredientBreakdown.length === 0) return null
    return {
      score: displayFillrFit.score,
      verdict: displayFillrFit.verdict,
      productName: displayName,
      brand: product.brand ?? '',
      naturalCount: ratingCounts.clean,
      totalCount: ingredientBreakdown.length,
      scanDate: new Date(),
    }
  }, [
    displayFillrFit,
    ingredientBreakdown.length,
    displayName,
    product.brand,
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
    const flagged: IngredientExplanation[] = []
    const additive: IngredientExplanation[] = []
    const processed: IngredientExplanation[] = []
    const natural: IngredientExplanation[] = []
    for (const ing of ingredientListForCards) {
      const r = resolveRate(ing)
      if (r === 'avoid') flagged.push(ing)
      else if (r === 'concerning') additive.push(ing)
      else if (r === 'okay') processed.push(ing)
      else natural.push(ing)
    }
    return { flagged, additive, processed, natural }
  }, [ingredientListForCards, resolveRate])

  const worthLookList = useMemo(() => {
    return sortedIngredientBreakdown.filter((ing) => resolveRate(ing) === 'avoid')
  }, [sortedIngredientBreakdown, resolveRate])

  useEffect(() => {
    if (defaultFlaggedExpanded.current) return
    if (worthLookList.length > 0) {
      const first = worthLookList[0]
      setExpandedIngredientKey(`sf-0-${first.name}`)
      defaultFlaggedExpanded.current = true
    }
  }, [worthLookList])

  const profileConflict = safetyStatus !== 'SAFE'

  const declaresTagsStr =
    product.allergensTags && product.allergensTags.length > 0
      ? formatAllergenTagsForDisplay(product.allergensTags)
      : null
  const declaresFromLabel = declaredAllergensLabel?.trim() || null
  const declaresLine = declaresTagsStr || declaresFromLabel
  const tracesOnlyStr =
    !declaresLine && product.tracesTags && product.tracesTags.length > 0
      ? formatAllergenTagsForDisplay(product.tracesTags)
      : null

  const shareMessage = useMemo(() => {
    const bits = matchedAllergens.map((m) => `${m.allergenName}: ${m.matchedIngredient}`)
    const flags = bits.length ? `\n${bits.join('\n')}` : ''
    const verdict = productVerdict ? `\n${productVerdict}` : ''
    return `Fillr — ${displayName}${verdict}${flags}\n\nBarcode …${lastBarcodeSix(product.barcode)}`
  }, [displayName, product.barcode, matchedAllergens, productVerdict])

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

  const runPastedAnalysis = useCallback(async () => {
    const text = pasteValue.trim()
    if (!text || pasteAnalyzing) return
    setPasteAnalyzing(true)
    try {
      const next = await rescanWithManualIngredients({
        barcode: product.barcode,
        allergies,
        sensitivities: zSensitivities,
        preferences,
        goal,
        celiacStrictGluten,
        currentResult: storedResult,
        pastedIngredients: text,
      })
      setCurrentScan(next)
      updateScanResultByProductId(product.id, next)
    } catch {
      /* keep existing */
    } finally {
      setPasteAnalyzing(false)
    }
  }, [
    pasteValue,
    pasteAnalyzing,
    product.barcode,
    product.id,
    allergies,
    zSensitivities,
    preferences,
    goal,
    celiacStrictGluten,
    storedResult,
    setCurrentScan,
    updateScanResultByProductId,
  ])

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
        expanded={expandedIngredientKey === cardKey}
        allergyMatch={allergyMatch}
        sensitivityMatch={sensitivityMatch}
        celiacMatch={celiacMatch}
        compactPreview={isOnboardingPreview}
        onToggleExpanded={() =>
          setExpandedIngredientKey((prev) => (prev === cardKey ? null : cardKey))
        }
      />
    )
  }

  const greenProfileTitle = 'Matches your profile'
  const greenProfileSubtitle =
    (smartSummary || productVerdict || displayFillrFit?.reason || '').trim() ||
    'No conflicts detected for your saved allergies and preferences on this scan.'

  const redProfileTitle = 'Heads up for your profile'
  const redProfileSubtitle =
    [
      celiacAvoid ? 'Contains gluten sources flagged for your celiac settings.' : null,
      matchedAllergens.length ? `Allergens: ${uniqueAllergenNames.join(', ')}.` : null,
      matchedSensitivities.length
        ? `Sensitivities: ${matchedSensitivities.map((m) => m.matchedIngredient || m.sensitivityName).join(', ')}.`
        : null,
      safetyStatus === 'UNKNOWN' ? 'Label detail may be incomplete — double-check packaging.' : null,
      productVerdict?.trim() || null,
    ]
      .filter(Boolean)
      .join(' ')
      .trim() || 'Review this product carefully against your dietary profile.'

  const summaryPanel = (
    <View style={styles.tabPanel}>
      <RatioBar counts={summaryRatioCounts} />
      {showGoalInsight ? (
        <View
          style={[
            styles.goalInsightCard,
            goalInsightConflict ? styles.goalInsightCardConflict : styles.goalInsightCardMatch,
          ]}
        >
          <Text style={styles.goalInsightTitle}>
            {goalInsightConflict
              ? `Not ideal for your ${goalDisplayName} goal`
              : `Good match for your ${goalDisplayName} goal`}
          </Text>
          <Text style={styles.goalInsightBody}>
            {goalInsightConflict
              ? `Contains ${scoringGoalConflicts.slice(0, 2).join(' and ')} - worth checking if this fits your plan.`
              : `Ingredient profile aligns with ${goalDisplayName}.`}
          </Text>
        </View>
      ) : null}

      {summaryRatioCounts.flagged > 0 ? (
        <>
          <TabSectionHeader dotColor={theme.flagged.accent} label="WORTH A LOOK" />
          {worthLookList.map((ing, i) => renderIngredientCard(ing, i, 'sf'))}
          <View style={styles.spacer16} />
        </>
      ) : null}

      {profileConflict ? (
        <View style={[styles.profileCard, styles.profileCardConflict]}>
          <View style={styles.profileRow}>
            <View style={[styles.profileIconCircle, styles.profileIconCircleConflict]}>
              <Text style={styles.profileIconMark}>!</Text>
            </View>
            <View style={styles.profileTextCol}>
              <Text style={styles.profileTitleConflict}>{redProfileTitle}</Text>
              <Text style={styles.profileSubtitle}>{redProfileSubtitle}</Text>
            </View>
          </View>
        </View>
      ) : (
        <LinearGradient
          colors={['#f0fdf4', '#dcfce7']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.profileCardGradient}
        >
          <View style={styles.profileRow}>
            <View style={styles.profileIconCircle}>
              <Text style={styles.profileIconCheck}>✓</Text>
            </View>
            <View style={styles.profileTextCol}>
              <Text style={styles.profileTitleOk}>{greenProfileTitle}</Text>
              <Text style={styles.profileSubtitle}>{greenProfileSubtitle}</Text>
            </View>
          </View>
        </LinearGradient>
      )}

      {!isOnboardingPreview ? (
        <Pressable
          style={({ pressed }) => [styles.viewAllIngredientsBtn, pressed && { opacity: 0.94 }]}
          onPress={() => {
            setActiveTab('ingredients')
            scrollRef.current?.scrollTo({ y: 0, animated: true })
          }}
        >
          <Text style={styles.viewAllIngredientsText}>View all ingredients</Text>
          <Text style={styles.viewAllIngredientsArrow}>→</Text>
        </Pressable>
      ) : null}

      {!isOnboardingPreview && ingredientBreakdown.length === 0 ? (
        <View style={styles.missingIngredientsCard}>
          <Text style={styles.missingIngredientsEmoji}>📋</Text>
          <Text style={styles.missingIngredientsTitle}>Ingredients not in our database</Text>
          <Text style={styles.missingIngredientsBody}>
            We found this product but don&apos;t have its ingredient list yet. Paste them from the
            packaging to get a full analysis.
          </Text>
          <TextInput
            style={styles.missingIngredientsInput}
            placeholder="Sugar, enriched flour, palm oil..."
            placeholderTextColor={theme.textFaint}
            value={pasteValue}
            onChangeText={setPasteValue}
            multiline
            editable={!pasteAnalyzing}
          />
          <Pressable
            onPress={() => void runPastedAnalysis()}
            disabled={pasteAnalyzing || !pasteValue.trim()}
            style={({ pressed }) => [
              styles.missingIngredientsAnalyzeBtn,
              pressed && { opacity: 0.92 },
              (pasteAnalyzing || !pasteValue.trim()) && { opacity: 0.5 },
            ]}
          >
            {pasteAnalyzing ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.missingIngredientsAnalyzeText}>Analyze →</Text>
            )}
          </Pressable>
        </View>
      ) : null}

      {isOnboardingPreview && matchedAllergens.length > 0 ? (
        <View style={styles.previewProfileNote}>
          <Text style={styles.previewProfileNoteLabel}>Matches your profile</Text>
          <Text style={styles.previewProfileNoteBody}>{uniqueAllergenNames.join(' · ')}</Text>
        </View>
      ) : null}

      <Text style={styles.tabDisclaimer}>{TAB_DISCLAIMER}</Text>
    </View>
  )

  const naturalCount = groupedForIngredientsTab.natural.length

  const ingredientsPanel = (
    <View style={styles.tabPanel}>
      {!isOnboardingPreview ? (
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search ingredients"
            placeholderTextColor={theme.textFaint}
            value={ingredientQuery}
            onChangeText={(t) => {
              setIngredientQuery(t)
              setExpandedIngredientKey(null)
            }}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
        </View>
      ) : null}

      {groupedForIngredientsTab.flagged.length > 0 ? (
        <>
          <TabSectionHeader dotColor={theme.flagged.accent} label="FLAGGED FIRST" />
          {groupedForIngredientsTab.flagged.map((ing, i) =>
            renderIngredientCard(ing, i, searchTokens.length > 0 ? 'q' : 'i', 'flag')
          )}
        </>
      ) : null}

      {groupedForIngredientsTab.additive.length > 0 ? (
        <>
          <TabSectionHeader dotColor={theme.additive.accent} label="ADDITIVE" />
          {groupedForIngredientsTab.additive.map((ing, i) =>
            renderIngredientCard(ing, i, searchTokens.length > 0 ? 'q' : 'i', 'add')
          )}
        </>
      ) : null}

      {groupedForIngredientsTab.processed.length > 0 ? (
        <>
          <TabSectionHeader dotColor={theme.processed.accent} label="PROCESSED" />
          {groupedForIngredientsTab.processed.map((ing, i) =>
            renderIngredientCard(ing, i, searchTokens.length > 0 ? 'q' : 'i', 'proc')
          )}
        </>
      ) : null}

      {!showAllNatural && naturalCount > 0 ? (
        <Pressable
          style={({ pressed }) => [styles.showNaturalBtn, pressed && { opacity: 0.94 }]}
          onPress={() => setShowAllNatural(true)}
        >
          <Text style={styles.showNaturalBtnText}>
            {`Show all ${naturalCount} natural ingredients ↓`}
          </Text>
        </Pressable>
      ) : null}

      {showAllNatural && naturalCount > 0 ? (
        <>
          <TabSectionHeader dotColor={theme.natural.accent} label="NATURAL" />
          {groupedForIngredientsTab.natural.map((ing, i) =>
            renderIngredientCard(ing, i, searchTokens.length > 0 ? 'q' : 'i', 'nat')
          )}
        </>
      ) : null}

      {!isOnboardingPreview && searchTokens.length > 0 && ingredientListForCards.length === 0 ? (
        <Text style={styles.searchEmptyText}>No matching ingredients.</Text>
      ) : null}

      <Text style={styles.tabDisclaimer}>{TAB_DISCLAIMER}</Text>
    </View>
  )

  const heroTitlePressable =
    !isOnboardingPreview && viewResult.scanSource === 'ocr' ? (
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
          { paddingBottom: 120 + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[1]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <View style={styles.scrollBlockA}>
          <View style={styles.navBar}>
            <Pressable
              onPress={() =>
                router.canGoBack() ? router.back() : router.replace('/(tabs)/scan')
              }
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
                    onPress={() => void shareScanFromCard()}
                    hitSlop={12}
                    style={styles.navIconBare}
                    accessibilityRole="button"
                    accessibilityLabel="Share scan"
                  >
                    <Ionicons name="share-outline" size={20} color={theme.textPrimary} />
                  </Pressable>
                  <Pressable
                    onPress={() => toggleSaved(product.id)}
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
            {(declaresLine || tracesOnlyStr) && (
              <AllergenPill declaresText={declaresLine} tracesText={tracesOnlyStr} />
            )}
            <ScoreDisplay fillrFit={scoreDisplayFit} isLoading={scoreLoading} />
          </View>
        </View>

        <ProductTabs active={activeTab} onChange={setActiveTab} />

        {activeTab === 'summary' ? summaryPanel : ingredientsPanel}
      </ScrollView>

      {!isOnboardingPreview ? (
        <View style={[styles.footerWrap, { paddingBottom: Math.max(insets.bottom, 28) }]} pointerEvents="box-none">
          <LinearGradient
            colors={['transparent', theme.screenBg]}
            style={styles.footerGradient}
            pointerEvents="none"
          />
          <View style={styles.footerBtns}>
            <Pressable
              onPress={() => void shareScanFromCard()}
              style={({ pressed }) => [styles.shareBtn, pressed && styles.shareBtnPressed]}
            >
              <Text style={styles.shareBtnText}>Share</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                useCurrentScanStore.getState().setResult(null)
                router.replace('/(tabs)/scan')
              }}
              style={({ pressed }) => [styles.scanAgainBtn, pressed && styles.scanAgainBtnPressed]}
            >
              <Text style={styles.scanAgainText}>Scan Again</Text>
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
    marginBottom: 16,
  },
  tabBarWrap: {
    backgroundColor: theme.screenBg,
    paddingTop: 12,
    paddingHorizontal: theme.screenPadding,
    paddingBottom: 0,
    borderBottomWidth: 1,
    borderBottomColor: theme.greenTrack,
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: theme.greenTabBg,
    borderRadius: 12,
    padding: 3,
    marginBottom: 0,
  },
  tabFlex: {
    flex: 1,
  },
  tabInner: {
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabInnerActiveShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  tabPanel: {
    paddingTop: 18,
    paddingHorizontal: theme.screenPadding,
    paddingBottom: 8,
    backgroundColor: theme.screenBg,
  },
  goalInsightCard: {
    marginTop: 14,
    marginBottom: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  goalInsightCardConflict: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
  },
  goalInsightCardMatch: {
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
  },
  goalInsightTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.textPrimary,
  },
  goalInsightBody: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 17,
    color: '#6b7280',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 10,
  },
  sectionHeaderDot: {
    width: 7,
    height: 7,
    borderRadius: 50,
  },
  sectionHeaderLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  spacer16: {
    height: 16,
  },
  profileCardGradient: {
    borderWidth: 1.5,
    borderColor: theme.greenBorder,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  profileCard: {
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  profileCardConflict: {
    backgroundColor: '#fef2f2',
    borderWidth: 1.5,
    borderColor: '#fecaca',
  },
  profileRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  profileIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.green500,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: theme.green500,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 3,
  },
  profileIconCircleConflict: {
    backgroundColor: theme.flagged.accent,
    shadowColor: theme.flagged.accent,
  },
  profileIconCheck: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  profileIconMark: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  profileTextCol: {
    flex: 1,
  },
  profileTitleOk: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.green800,
    marginBottom: 3,
  },
  profileTitleConflict: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.flagged.text,
    marginBottom: 3,
  },
  profileSubtitle: {
    fontSize: 11,
    color: theme.textMuted,
    lineHeight: 16,
  },
  viewAllIngredientsBtn: {
    backgroundColor: theme.cardBg,
    borderWidth: 1.5,
    borderColor: theme.cardBorderOpen,
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  viewAllIngredientsText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  viewAllIngredientsArrow: {
    fontSize: 16,
    color: theme.green500,
    fontWeight: '600',
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
    gap: 9,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  searchIcon: {
    fontSize: 15,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    color: theme.textPrimary,
    padding: 0,
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
  },
  footerWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  footerGradient: {
    height: 40,
    width: '100%',
  },
  footerBtns: {
    backgroundColor: theme.screenBg,
    paddingHorizontal: theme.screenPadding,
    paddingTop: 0,
    gap: 8,
  },
  shareBtn: {
    backgroundColor: theme.green500,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: theme.green500,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },
  shareBtnPressed: {
    backgroundColor: theme.green700,
  },
  shareBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.2,
  },
  scanAgainBtn: {
    backgroundColor: theme.cardBg,
    borderWidth: 1.5,
    borderColor: theme.cardBorderOpen,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  scanAgainBtnPressed: {
    backgroundColor: '#f9fafb',
  },
  scanAgainText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textMuted,
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
  missingIngredientsCard: {
    marginTop: 12,
    marginBottom: 12,
    padding: 18,
    borderRadius: 16,
    backgroundColor: theme.cardBg,
    borderWidth: 1.5,
    borderColor: theme.cardBorderOpen,
  },
  missingIngredientsEmoji: {
    fontSize: 28,
    marginBottom: 8,
  },
  missingIngredientsTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: theme.textPrimary,
    marginBottom: 8,
  },
  missingIngredientsBody: {
    fontSize: 14,
    lineHeight: 21,
    color: theme.textMuted,
    marginBottom: 14,
  },
  missingIngredientsInput: {
    minHeight: 100,
    borderWidth: 1.5,
    borderColor: theme.cardBorderOpen,
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    color: theme.textSecondary,
    textAlignVertical: 'top',
    marginBottom: 12,
    backgroundColor: '#fafafa',
  },
  missingIngredientsAnalyzeBtn: {
    height: 50,
    borderRadius: 100,
    backgroundColor: theme.green500,
    alignItems: 'center',
    justifyContent: 'center',
  },
  missingIngredientsAnalyzeText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
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
