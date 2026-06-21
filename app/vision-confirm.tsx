import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Platform,
  Alert,
  LayoutAnimation,
  UIManager,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { useVisionScanStore } from '../store/visionScanStore'
import {
  createScanResultFromVisionProduct,
  runScanAiEnrichment,
} from '../services/productService'
import { visionDisplayName, visionIngredientsText } from '../services/openaiProductVision'
import {
  findCatalogProductMatch,
  type CatalogProductMatch,
} from '../lib/visionProductDb'
import { useUserStore } from '../store/userStore'
import { useAuthStore } from '../store/authStore'
import { useScanHistoryStore } from '../store/scanHistoryStore'
import { useCurrentScanStore } from '../store/currentScanStore'
import { canUserScan, incrementScanCount } from '../store/scanStore'
import { showPaywall } from '../services/paywallService'
import { finalizeReferralBonusIfEligible, fetchProfile, incrementScanUsageOnServer } from '../lib/authService'
import { runAfterInteractionsAndNextFrame, runOnNextFrameInTransition } from '../lib/scheduleUIWork'
import { trackScanResultMetric } from '../lib/scanResultMetrics'
import type { ScanResult } from '../types'
import { exitFromScanResult } from '../lib/navigationHelpers'
import { toTitleCase } from '../lib/formatProductTitle'
import { FillrButton } from '../components/FillrButton'
import { GradientBackground } from '../components/GradientBackground'
import { colors, radius, spacing, theme, typography } from '../constants/theme'
import { isNutritionFocusedGoal, mergedNutritionTargets } from '../lib/nutritionTargets'

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true)
}

const INGREDIENT_PREVIEW_COUNT = 8

function shouldShowVariant(name: string, variant: string): boolean {
  const v = variant.trim()
  if (!v) return false
  return !name.toLowerCase().includes(v.toLowerCase())
}

function flattenIngredientItems(lines: string[]): string[] {
  return lines
    .flatMap((line) => {
      const trimmed = line.trim()
      if (!trimmed) return []
      if (trimmed.includes(',')) {
        return trimmed.split(',').map((part) => part.trim()).filter(Boolean)
      }
      return [trimmed]
    })
    .filter(Boolean)
}

function confidenceMeta(confidence: number) {
  const pct = Math.round(Math.min(1, Math.max(0, confidence)) * 100)
  if (pct >= 85) {
    return { pct, label: 'High confidence', color: theme.green700, bg: theme.green50, track: theme.greenBorder }
  }
  if (pct >= 65) {
    return { pct, label: 'Good match', color: '#b45309', bg: '#fffbeb', track: '#fde68a' }
  }
  return { pct, label: 'Verify details', color: theme.flagged.text, bg: theme.flagged.bg, track: '#fecaca' }
}

function QuickStat({
  icon,
  value,
  label,
}: {
  icon: keyof typeof Ionicons.glyphMap
  value: string
  label: string
}) {
  return (
    <View style={styles.quickStat}>
      <View style={styles.quickStatIcon}>
        <Ionicons name={icon} size={14} color={theme.green700} />
      </View>
      <Text style={styles.quickStatValue}>{value}</Text>
      <Text style={styles.quickStatLabel}>{label}</Text>
    </View>
  )
}

function IngredientChipList({ items }: { items: string[] }) {
  const [showAll, setShowAll] = useState(false)
  const visible = showAll ? items : items.slice(0, INGREDIENT_PREVIEW_COUNT)
  const hiddenCount = items.length - INGREDIENT_PREVIEW_COUNT

  return (
    <>
      <View style={styles.chipWrap}>
        {visible.map((item, i) => {
          const isPrimary = i === 0
          return (
            <View
              key={`ing-${item}-${i}`}
              style={[styles.ingredientChip, isPrimary && styles.ingredientChipPrimary]}
            >
              {isPrimary ? (
                <Ionicons name="leaf" size={12} color={theme.green700} style={styles.ingredientChipIcon} />
              ) : null}
              <Text
                style={[styles.ingredientChipText, isPrimary && styles.ingredientChipTextPrimary]}
                numberOfLines={2}
              >
                {item}
              </Text>
            </View>
          )
        })}
      </View>
      {items.length > INGREDIENT_PREVIEW_COUNT ? (
        <Pressable
          onPress={() => {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
            setShowAll((v) => !v)
          }}
          style={({ pressed }) => [styles.showMoreBtn, pressed && { opacity: 0.75 }]}
          accessibilityRole="button"
          accessibilityLabel={showAll ? 'Show fewer ingredients' : `Show ${hiddenCount} more ingredients`}
        >
          <Text style={styles.showMoreText}>
            {showAll ? 'Show less' : `+${hiddenCount} more ingredients`}
          </Text>
          <Ionicons name={showAll ? 'chevron-up' : 'chevron-down'} size={16} color={theme.green700} />
        </Pressable>
      ) : null}
    </>
  )
}

function InfoCard({
  icon,
  title,
  subtitle,
  tone = 'default',
  collapsible = false,
  defaultExpanded = true,
  preview,
  children,
}: {
  icon: keyof typeof Ionicons.glyphMap
  title: string
  subtitle?: string
  tone?: 'default' | 'warn'
  collapsible?: boolean
  defaultExpanded?: boolean
  preview?: string
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultExpanded)
  const iconColor = tone === 'warn' ? theme.flagged.text : theme.green700
  const iconBg = tone === 'warn' ? theme.flagged.bg : theme.green50

  const toggle = () => {
    if (!collapsible) return
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    setOpen((v) => !v)
  }

  const header = (
    <View style={[styles.infoCardHeader, collapsible && !open && styles.infoCardHeaderTight]}>
      <View style={[styles.infoCardIcon, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>
      <View style={styles.infoCardHeaderText}>
        <Text style={styles.infoCardTitle}>{title}</Text>
        {subtitle ? <Text style={styles.infoCardSubtitle}>{subtitle}</Text> : null}
      </View>
      {collapsible ? (
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={theme.textFaint} />
      ) : null}
    </View>
  )

  return (
    <View style={styles.infoCard}>
      {collapsible ? (
        <Pressable
          onPress={toggle}
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          accessibilityLabel={open ? `Collapse ${title}` : `Expand ${title}`}
        >
          {header}
          {!open && preview ? (
            <Text style={styles.cardPreview} numberOfLines={2}>
              {preview}
            </Text>
          ) : null}
        </Pressable>
      ) : (
        header
      )}
      {(!collapsible || open) ? children : null}
    </View>
  )
}

function NutritionStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.nutritionStat}>
      <Text style={styles.nutritionStatValue}>{value}</Text>
      <Text style={styles.nutritionStatLabel}>{label}</Text>
    </View>
  )
}

export default function VisionConfirmScreen() {
  const { mode } = useLocalSearchParams<{ mode?: string }>()
  const isCorrectionMode = mode === 'correction'
  const insets = useSafeAreaInsets()
  const draft = useVisionScanStore((s) => s.draft)
  const clearDraft = useVisionScanStore((s) => s.clearDraft)
  const goal = useUserStore((s) => s.goal)
  const nutritionTargets = useUserStore((s) => s.nutritionTargets)
  const nutritionFocused = isNutritionFocusedGoal(goal)
  const personalTargets = mergedNutritionTargets(goal, nutritionTargets)

  const allergies = useUserStore((s) => s.allergies)
  const sensitivities = useUserStore((s) => s.sensitivities)
  const preferences = useUserStore((s) => s.preferences)
  const celiacStrictGluten = useUserStore((s) => s.celiacStrictGluten)
  const userId = useAuthStore((s) => s.userId)
  const setReferralData = useUserStore((s) => s.setReferralData)
  const addScan = useScanHistoryStore((s) => s.addScan)
  const setCurrentScan = useCurrentScanStore((s) => s.setResult)

  const [catalogMatch, setCatalogMatch] = useState<CatalogProductMatch | null>(null)
  const [confirmBusy, setConfirmBusy] = useState(false)
  const [actualProductName, setActualProductName] = useState('')
  const [actualBrand, setActualBrand] = useState('')
  const [correctionNotes, setCorrectionNotes] = useState('')
  const [correctionSubmitted, setCorrectionSubmitted] = useState(false)
  const [correctionBusy, setCorrectionBusy] = useState(false)
  const suppressDraftGuardRef = useRef(false)

  const identification = draft?.identification ?? null
  const displayName = identification ? visionDisplayName(identification) : ''
  const ingredientItems = useMemo(
    () => flattenIngredientItems(identification?.ingredients ?? []),
    [identification?.ingredients]
  )
  const nutritionFacts = identification?.nutrition_facts
  const hasNutrition =
    Boolean(nutritionFacts?.serving_size?.trim()) ||
    Boolean(nutritionFacts?.calories) ||
    Boolean(nutritionFacts?.fat_g) ||
    Boolean(nutritionFacts?.protein_g)
  const containsAllergens = identification?.allergens ?? []
  const mayContainAllergens = identification?.may_contain_allergens ?? []
  const showVariant =
    identification != null && shouldShowVariant(displayName, identification.variant)
  const confidence = confidenceMeta(identification?.confidence ?? 0)
  const nutritionPreview = useMemo(() => {
    if (!hasNutrition || !nutritionFacts) return ''
    const bits: string[] = []
    if (nutritionFacts.calories) bits.push(`${nutritionFacts.calories} cal`)
    if (nutritionFacts.protein_g) bits.push(`${nutritionFacts.protein_g}g protein`)
    if (nutritionFacts.fat_g) bits.push(`${nutritionFacts.fat_g}g fat`)
    return bits.join(' · ')
  }, [hasNutrition, nutritionFacts])
  const allergenPreview = useMemo(() => {
    const bits: string[] = []
    if (containsAllergens.length > 0) bits.push(`Contains ${containsAllergens.slice(0, 3).join(', ')}`)
    if (mayContainAllergens.length > 0) bits.push(`May contain ${mayContainAllergens.slice(0, 2).join(', ')}`)
    return bits.join(' · ')
  }, [containsAllergens, mayContainAllergens])
  const hasQuickStats =
    ingredientItems.length > 0 || hasNutrition || containsAllergens.length + mayContainAllergens.length > 0

  const goalMacroHighlight = useMemo(() => {
    if (!nutritionFacts || !nutritionFocused) return null
    const g = (goal ?? '').toLowerCase()
    if (/less_sugar|low_sugar|blood/.test(g) && nutritionFacts.sugars_g) {
      const v = nutritionFacts.sugars_g
      const over = personalTargets.maxSugarG != null && v > personalTargets.maxSugarG
      return {
        label: 'Sugar',
        value: `${v}g`,
        caption: over ? `Over your ${personalTargets.maxSugarG}g target` : 'Per serving',
        tone: v >= 10 || over ? 'warn' : 'neutral',
      }
    }
    if (/more_protein|muscle|high_protein/.test(g) && nutritionFacts.protein_g) {
      const v = nutritionFacts.protein_g
      const under = personalTargets.minProteinG != null && v < personalTargets.minProteinG
      return {
        label: 'Protein',
        value: `${v}g`,
        caption: under ? `Below your ${personalTargets.minProteinG}g target` : 'Per serving',
        tone: v >= 10 && !under ? 'good' : 'warn',
      }
    }
    if (/lower_sodium/.test(g) && nutritionFacts.sodium_mg) {
      const v = nutritionFacts.sodium_mg
      const over = personalTargets.maxSodiumMg != null && v > personalTargets.maxSodiumMg
      return {
        label: 'Sodium',
        value: `${v}mg`,
        caption: over ? `Over your ${personalTargets.maxSodiumMg}mg target` : 'Per serving',
        tone: v >= 400 || over ? 'warn' : 'neutral',
      }
    }
    if (nutritionFacts.sugars_g) {
      return { label: 'Sugar', value: `${nutritionFacts.sugars_g}g`, caption: 'Per serving', tone: 'neutral' as const }
    }
    return null
  }, [nutritionFacts, nutritionFocused, goal, personalTargets])

  useEffect(() => {
    if (!identification || isCorrectionMode) return
    void findCatalogProductMatch(identification.product_name, identification.brand).then(setCatalogMatch)
  }, [identification, isCorrectionMode])

  useEffect(() => {
    if (isCorrectionMode || draft || suppressDraftGuardRef.current) return
    exitFromScanResult()
  }, [draft, isCorrectionMode])

  const heroImageUri = useMemo(() => {
    if (catalogMatch?.imageUrl) return catalogMatch.imageUrl
    return draft?.photoUri ?? null
  }, [catalogMatch?.imageUrl, draft?.photoUri])

  const finalizeVisionScan = useCallback(async () => {
    if (!identification) return
    void trackScanResultMetric({ name: 'scan_started', payload: { source: 'vision' } })

    const allowed = await canUserScan()
    if (!allowed) {
      const purchased = await showPaywall()
      if (!purchased) {
        void trackScanResultMetric({
          name: 'scan_failed',
          payload: { source: 'vision', reason: 'paywall_not_purchased' },
        })
        Alert.alert('Scans', 'You need an available scan or Premium to analyze this product.')
        return
      }
    }

    const { result, dietaryProfile } = await createScanResultFromVisionProduct({
      allergies,
      sensitivities,
      preferences,
      goal,
      celiacStrictGluten,
      identification,
    })

    if (!result.product.id?.trim()) {
      void trackScanResultMetric({
        name: 'scan_failed',
        payload: { source: 'vision', reason: 'missing_product_id' },
      })
      Alert.alert('Something went wrong', 'Try again or retake the photo.')
      return
    }

    const visionIngredientText = visionIngredientsText(identification)
    const hasAdequateIngredientData =
      visionIngredientText.trim().length > 20 && result.ingredientBreakdown.length >= 3

    if (!hasAdequateIngredientData) {
      void trackScanResultMetric({
        name: 'scan_failed',
        payload: { source: 'vision', reason: 'insufficient_ingredient_data' },
      })
      Alert.alert(
        'Ingredients needed',
        "We identified the product but need the ingredients list to score it. Scan the ingredients label next.",
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Scan label',
            onPress: () => {
              clearDraft()
              router.replace({
                pathname: '/ocr-scanner',
                params: { prefillName: result.product.name },
              })
            },
          },
          {
            text: 'Enter manually',
            onPress: () => {
              clearDraft()
              router.push({
                pathname: '/manual-ingredients',
                params: {
                  prefillName: result.product.name,
                  prefillIngredients: visionIngredientText,
                },
              })
            },
          },
        ]
      )
      return
    }

    const productId = result.product.id
    setCurrentScan(result)
    addScan({
      id: `scan_vision_${Date.now()}`,
      productId,
      productName: result.product.name,
      barcode: result.product.barcode,
      safetyStatus: result.safetyStatus,
      date: new Date().toISOString(),
      result,
      source: 'vision',
      scanMethod: 'vision',
    })

    void trackScanResultMetric({
      name: 'scan_succeeded',
      productId,
      barcode: result.product.barcode,
      payload: { source: 'vision', ingredient_count: result.ingredientBreakdown.length },
    })

    const applyEnriched = (enriched: ScanResult) => {
      runAfterInteractionsAndNextFrame(() => {
        const cur = useCurrentScanStore.getState().result
        if (cur?.product.id === productId) setCurrentScan(enriched)
        runOnNextFrameInTransition(() => {
          useScanHistoryStore.getState().updateScanResultByProductId(productId, enriched)
        })
      })
    }

    void runScanAiEnrichment(
      result,
      dietaryProfile,
      {
        skipIngredientRepair: true,
        requestTimeoutMs: 55_000,
        maxTokens: 4096,
      },
      (enriched, stage) => {
        if (stage === 'ingredients' || stage === 'product') applyEnriched(enriched)
      }
    ).catch((err) => console.warn('[Fillr] vision enrichment failed', err))

    await incrementScanCount()
    if (userId) {
      void (async () => {
        await incrementScanUsageOnServer(userId)
        await finalizeReferralBonusIfEligible(userId).catch(() => {})
        const latest = await fetchProfile(userId)
        if (latest) {
          setReferralData({
            bonusScansEarned: latest.bonus_scans_earned ?? 0,
            totalScansUsed: latest.total_scans_used ?? 0,
            referredBy: latest.referred_by ?? null,
            referralCode: latest.referral_code ?? '',
          })
        }
      })()
    }

    suppressDraftGuardRef.current = true
    clearDraft()
    router.replace({ pathname: '/product/[id]', params: { id: productId } })
  }, [
    identification,
    allergies,
    sensitivities,
    preferences,
    goal,
    celiacStrictGluten,
    addScan,
    setCurrentScan,
    userId,
    setReferralData,
    clearDraft,
  ])

  const onConfirm = useCallback(async () => {
    setConfirmBusy(true)
    try {
      await finalizeVisionScan()
    } catch (err) {
      console.warn('[Fillr] vision confirm failed', err)
      Alert.alert('Something went wrong', 'Try again or retake the photo.')
    } finally {
      setConfirmBusy(false)
    }
  }, [finalizeVisionScan])

  const submitCorrectionFeedback = useCallback(async () => {
    const actualName = actualProductName.trim()
    if (!actualName) {
      Alert.alert('Product name needed', 'Tell us what product you actually scanned.')
      return
    }
    if (!identification) return

    setCorrectionBusy(true)
    try {
      await trackScanResultMetric({
        name: 'scan_result_correctness_feedback',
        payload: {
          response: 'wrong',
          source: 'vision_confirm',
          proposed_product_name: identification.product_name,
          proposed_brand: identification.brand,
          proposed_variant: identification.variant,
          proposed_display_name: displayName,
          proposed_ingredients: ingredientItems.slice(0, 30),
          actual_product_name: actualName,
          actual_brand: actualBrand.trim(),
          user_notes: correctionNotes.trim(),
        },
      })
      setCorrectionSubmitted(true)
    } finally {
      setCorrectionBusy(false)
    }
  }, [
    actualProductName,
    actualBrand,
    correctionNotes,
    identification,
    displayName,
    ingredientItems,
  ])

  if (isCorrectionMode) {
    if (!identification) {
      return (
        <SafeAreaView style={styles.root}>
          <ActivityIndicator color={theme.green700} />
        </SafeAreaView>
      )
    }

    const proposedSummary = [
      identification.brand.trim() ? toTitleCase(identification.brand) : null,
      toTitleCase(displayName),
      identification.variant.trim() ? identification.variant.trim() : null,
    ]
      .filter(Boolean)
      .join(' · ')

    return (
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={styles.correctionContent} keyboardShouldPersistTaps="handled">
          <Pressable
            onPress={() => router.back()}
            style={styles.backRow}
            accessibilityRole="button"
            accessibilityLabel="Back to proposed match"
          >
            <Ionicons name="chevron-back" size={22} color={theme.textPrimary} />
            <Text style={styles.backText}>Back</Text>
          </Pressable>

          <Text style={styles.correctionTitle}>Tell us what you scanned</Text>
          <Text style={styles.correctionSubtitle}>
            Fillr proposed a match from your photo. Help us improve by sharing what the product actually was.
          </Text>

          <View style={styles.correctionCard}>
            <Text style={styles.correctionCardLabel}>Fillr proposed</Text>
            <Text style={styles.correctionProposedName}>{toTitleCase(displayName)}</Text>
            {identification.brand.trim() ? (
              <Text style={styles.correctionProposedMeta}>{toTitleCase(identification.brand)}</Text>
            ) : null}
            {showVariant ? (
              <Text style={styles.correctionProposedMeta}>{identification.variant.trim()}</Text>
            ) : null}
            {ingredientItems.length > 0 ? (
              <Text style={styles.correctionProposedIngredients} numberOfLines={3}>
                {ingredientItems.slice(0, 6).join(' · ')}
                {ingredientItems.length > 6 ? ` · +${ingredientItems.length - 6} more` : ''}
              </Text>
            ) : null}
          </View>

          <View style={styles.correctionCard}>
            <Text style={styles.correctionCardLabel}>What you actually scanned</Text>
            <Text style={styles.correctionFieldLabel}>Product name</Text>
            <TextInput
              value={actualProductName}
              onChangeText={setActualProductName}
              placeholder="e.g. Terra Mediterranean Vegetable Chips"
              placeholderTextColor={theme.textFaint}
              style={styles.correctionInput}
              autoCapitalize="words"
              autoCorrect={false}
            />
            <Text style={styles.correctionFieldLabel}>Brand (optional)</Text>
            <TextInput
              value={actualBrand}
              onChangeText={setActualBrand}
              placeholder="e.g. Terra"
              placeholderTextColor={theme.textFaint}
              style={styles.correctionInput}
              autoCapitalize="words"
              autoCorrect={false}
            />
            <Text style={styles.correctionFieldLabel}>Anything else we got wrong? (optional)</Text>
            <TextInput
              value={correctionNotes}
              onChangeText={setCorrectionNotes}
              placeholder="Wrong flavor, missing ingredients, etc."
              placeholderTextColor={theme.textFaint}
              style={[styles.correctionInput, styles.correctionInputMultiline]}
              multiline
              textAlignVertical="top"
            />
          </View>

          {correctionSubmitted ? (
            <View style={styles.correctionAck}>
              <Ionicons name="checkmark-circle" size={18} color={theme.green700} />
              <Text style={styles.correctionAckText}>Thanks — your feedback was saved.</Text>
            </View>
          ) : null}

          <FillrButton
            title={correctionSubmitted ? 'Update feedback' : 'Send feedback'}
            onPress={() => void submitCorrectionFeedback()}
            fullWidth
            variant="liquid"
            disabled={correctionBusy}
          />

          <Pressable
            style={styles.searchSecondaryBtn}
            onPress={() => {
              router.push({
                pathname: '/manual-ingredients',
                params: {
                  prefillName: actualProductName.trim() || proposedSummary,
                  prefillIngredients: visionIngredientsText(identification),
                },
              })
            }}
          >
            <Ionicons name="create-outline" size={18} color={theme.green700} />
            <Text style={styles.searchSecondaryBtnText}>Enter ingredients manually</Text>
          </Pressable>

          <Pressable style={styles.ghostBtn} onPress={() => router.replace('/vision-scanner')}>
            <Text style={styles.ghostBtnText}>Retake photo</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    )
  }

  if (!identification) {
    return (
      <SafeAreaView style={styles.root}>
        <ActivityIndicator color={theme.green700} />
      </SafeAreaView>
    )
  }

  const footerPad = Math.max(insets.bottom, spacing.md)

  return (
    <GradientBackground variant="home">
      <SafeAreaView style={styles.root} edges={['top']}>
        <View style={styles.topBar}>
          <Pressable
            onPress={() => router.replace('/vision-scanner')}
            style={({ pressed }) => [styles.topBarBtn, pressed && { opacity: 0.75 }]}
            accessibilityRole="button"
            accessibilityLabel="Retake photo"
          >
            <Ionicons name="chevron-back" size={22} color={theme.textPrimary} />
          </Pressable>
          <View style={styles.topBarCenter}>
            <Text style={styles.topBarTitle}>Confirm product</Text>
            <Text style={styles.topBarStep}>Step 2 of 2 · Review & score</Text>
          </View>
          <View style={styles.topBarSpacer} />
        </View>

        <ScrollView
          contentContainerStyle={[styles.confirmContent, { paddingBottom: 140 + footerPad }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.matchRow}>
            <View style={styles.matchBadge}>
              <Ionicons name="sparkles" size={14} color={theme.green700} />
              <Text style={styles.matchBadgeText}>We found a match</Text>
            </View>
            <View style={[styles.confidencePill, { backgroundColor: confidence.bg, borderColor: confidence.track }]}>
              <View style={[styles.confidenceDot, { backgroundColor: confidence.color }]} />
              <Text style={[styles.confidenceText, { color: confidence.color }]}>{confidence.label}</Text>
            </View>
          </View>

          <View style={styles.heroCard}>
            <LinearGradient
              colors={[theme.green50, '#ffffff']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroCardGlow}
            />
            {heroImageUri ? (
              <View style={styles.heroImageFrame}>
                <View style={styles.heroImageShadow} />
                <Image source={{ uri: heroImageUri }} style={styles.heroImage} resizeMode="contain" />
              </View>
            ) : (
              <View style={[styles.heroImageFrame, styles.heroImagePlaceholder]}>
                <Ionicons name="cube-outline" size={36} color={theme.textFaint} />
              </View>
            )}

            <View style={styles.heroTextBlock}>
              <View style={styles.heroMetaRow}>
                {identification.brand.trim() ? (
                  <Text style={styles.heroBrand}>{toTitleCase(identification.brand).toUpperCase()}</Text>
                ) : null}
                {catalogMatch ? (
                  <View style={styles.catalogBadge}>
                    <Ionicons name="checkmark-circle" size={12} color={theme.green700} />
                    <Text style={styles.catalogBadgeText}>In catalog</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.productName}>{toTitleCase(displayName)}</Text>
              {showVariant ? (
                <View style={styles.variantPill}>
                  <Text style={styles.variantPillText}>{identification.variant.trim()}</Text>
                </View>
              ) : null}
            </View>
          </View>

          {hasQuickStats ? (
            <View style={styles.quickStatsRow}>
              {ingredientItems.length > 0 ? (
                <QuickStat icon="list-outline" value={`${ingredientItems.length}`} label="Ingredients" />
              ) : null}
              {nutritionFacts?.calories ? (
                <QuickStat icon="flame-outline" value={`${nutritionFacts.calories}`} label="Calories" />
              ) : null}
              {containsAllergens.length + mayContainAllergens.length > 0 ? (
                <QuickStat
                  icon="alert-circle-outline"
                  value={`${containsAllergens.length + mayContainAllergens.length}`}
                  label="Allergens"
                />
              ) : null}
            </View>
          ) : null}

          {goalMacroHighlight ? (
            <View
              style={[
                styles.goalMacroHero,
                goalMacroHighlight.tone === 'good'
                  ? styles.goalMacroGood
                  : goalMacroHighlight.tone === 'warn'
                    ? styles.goalMacroWarn
                    : styles.goalMacroNeutral,
              ]}
            >
              <Text style={styles.goalMacroLabel}>{goalMacroHighlight.label}</Text>
              <Text style={styles.goalMacroValue}>{goalMacroHighlight.value}</Text>
              <Text style={styles.goalMacroCaption}>{goalMacroHighlight.caption}</Text>
            </View>
          ) : null}

          {nutritionFocused && hasNutrition ? (
            <InfoCard
              icon="nutrition-outline"
              title="Nutrition"
              subtitle={
                nutritionFacts?.serving_size?.trim()
                  ? `Per ${nutritionFacts.serving_size}`
                  : 'Per serving (estimated)'
              }
              defaultExpanded
            >
              <View style={styles.nutritionGrid}>
                {nutritionFacts?.calories ? (
                  <NutritionStat label="Calories" value={`${nutritionFacts.calories}`} />
                ) : null}
                {nutritionFacts?.protein_g ? (
                  <NutritionStat label="Protein" value={`${nutritionFacts.protein_g}g`} />
                ) : null}
                {nutritionFacts?.carbohydrates_g ? (
                  <NutritionStat label="Carbs" value={`${nutritionFacts.carbohydrates_g}g`} />
                ) : null}
                {nutritionFacts?.fat_g ? (
                  <NutritionStat label="Fat" value={`${nutritionFacts.fat_g}g`} />
                ) : null}
                {nutritionFacts?.sugars_g ? (
                  <NutritionStat label="Sugar" value={`${nutritionFacts.sugars_g}g`} />
                ) : null}
                {nutritionFacts?.sodium_mg ? (
                  <NutritionStat label="Sodium" value={`${nutritionFacts.sodium_mg}mg`} />
                ) : null}
              </View>
            </InfoCard>
          ) : null}

          <InfoCard
            icon="list-outline"
            title="Ingredients"
            subtitle={
              ingredientItems.length > 0
                ? `${ingredientItems.length} detected from label`
                : 'Not read from photo'
            }
          >
            {ingredientItems.length > 0 ? (
              <IngredientChipList items={ingredientItems} />
            ) : (
              <Text style={styles.emptyCopy}>
                Ingredient list wasn&apos;t available. You can still confirm the name, or scan the label for exact
                ingredients.
              </Text>
            )}
          </InfoCard>

          {!nutritionFocused && hasNutrition ? (
            <InfoCard
              icon="nutrition-outline"
              title="Nutrition"
              subtitle={
                nutritionFacts?.serving_size?.trim()
                  ? `Per ${nutritionFacts.serving_size}`
                  : 'Per serving (estimated)'
              }
              collapsible
              defaultExpanded={false}
              preview={nutritionPreview}
            >
              <View style={styles.nutritionGrid}>
                {nutritionFacts?.calories ? (
                  <NutritionStat label="Calories" value={`${nutritionFacts.calories}`} />
                ) : null}
                {nutritionFacts?.protein_g ? (
                  <NutritionStat label="Protein" value={`${nutritionFacts.protein_g}g`} />
                ) : null}
                {nutritionFacts?.fat_g ? (
                  <NutritionStat label="Fat" value={`${nutritionFacts.fat_g}g`} />
                ) : null}
                {nutritionFacts?.carbohydrates_g ? (
                  <NutritionStat label="Carbs" value={`${nutritionFacts.carbohydrates_g}g`} />
                ) : null}
                {nutritionFacts?.sugars_g ? (
                  <NutritionStat label="Sugar" value={`${nutritionFacts.sugars_g}g`} />
                ) : null}
                {nutritionFacts?.sodium_mg ? (
                  <NutritionStat label="Sodium" value={`${nutritionFacts.sodium_mg}mg`} />
                ) : null}
              </View>
            </InfoCard>
          ) : null}

          {containsAllergens.length > 0 || mayContainAllergens.length > 0 ? (
            <InfoCard
              icon="warning-outline"
              title="Allergens"
              tone="warn"
              collapsible
              defaultExpanded={containsAllergens.length > 0}
              preview={allergenPreview}
            >
              {containsAllergens.length > 0 ? (
                <View style={styles.allergenGroup}>
                  <Text style={styles.allergenGroupLabel}>Contains</Text>
                  <View style={styles.chipWrap}>
                    {containsAllergens.map((a) => (
                      <View key={`c-${a}`} style={styles.allergenChipStrong}>
                        <Text style={styles.allergenChipStrongText}>{a}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}
              {mayContainAllergens.length > 0 ? (
                <View style={[styles.allergenGroup, containsAllergens.length > 0 && { marginTop: spacing.sm }]}>
                  <Text style={styles.allergenGroupLabel}>May contain</Text>
                  <View style={styles.chipWrap}>
                    {mayContainAllergens.map((a) => (
                      <View key={`m-${a}`} style={styles.allergenChipMuted}>
                        <Text style={styles.allergenChipMutedText}>{a}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}
            </InfoCard>
          ) : null}
        </ScrollView>

        <LinearGradient
          colors={['rgba(240, 253, 244, 0)', 'rgba(240, 253, 244, 0.92)', colors.backgroundLightGreen]}
          style={styles.footerFade}
          pointerEvents="none"
        />
        <View style={[styles.footer, { paddingBottom: footerPad }]}>
          {confirmBusy ? (
            <View style={styles.footerLoading}>
              <ActivityIndicator color="#fff" />
            </View>
          ) : (
            <FillrButton title="Yes, that's it" onPress={() => void onConfirm()} fullWidth variant="liquid" />
          )}
          <Pressable
            style={({ pressed }) => [styles.footerSecondary, pressed && { opacity: 0.7 }]}
            disabled={confirmBusy}
            onPress={() => router.push({ pathname: '/vision-confirm', params: { mode: 'correction' } })}
          >
            <Text style={styles.footerSecondaryText}>That&apos;s not right</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </GradientBackground>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  topBarBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.backgroundCard,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.cardBorder,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  topBarCenter: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  topBarTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.textPrimary,
    letterSpacing: -0.2,
  },
  topBarStep: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.textFaint,
    letterSpacing: 0.2,
  },
  topBarSpacer: {
    width: 40,
  },
  confirmContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  matchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  matchBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.full,
    backgroundColor: theme.green50,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.greenBorder,
  },
  matchBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.green800,
    letterSpacing: 0.1,
  },
  confidencePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
  },
  confidenceDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  confidenceText: {
    fontSize: 11,
    fontWeight: '700',
  },
  heroCard: {
    backgroundColor: colors.backgroundCard,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.cardBorder,
    overflow: 'hidden',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.07,
    shadowRadius: 28,
    elevation: 4,
  },
  heroCardGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 120,
    opacity: 0.7,
  },
  heroImageFrame: {
    width: '100%',
    height: 200,
    borderRadius: radius.lg,
    backgroundColor: '#ffffff',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#eef2f7',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  heroImageShadow: {
    position: 'absolute',
    bottom: 16,
    width: '55%',
    height: 14,
    borderRadius: radius.full,
    backgroundColor: 'rgba(15, 23, 42, 0.08)',
  },
  heroImagePlaceholder: {
    backgroundColor: '#f1f5f9',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroTextBlock: {
    gap: spacing.sm,
  },
  heroMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  heroBrand: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.1,
    color: theme.green700,
  },
  catalogBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: theme.green50,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.greenBorder,
  },
  catalogBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.green800,
  },
  productName: {
    ...typography.h1,
    fontSize: 26,
    color: theme.textPrimary,
  },
  variantPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.full,
    backgroundColor: '#f8fafc',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e2e8f0',
  },
  variantPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.textMuted,
  },
  quickStatsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: spacing.md,
  },
  quickStat: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: radius.lg,
    backgroundColor: colors.backgroundCard,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.cardBorder,
  },
  quickStatIcon: {
    width: 28,
    height: 28,
    borderRadius: 10,
    backgroundColor: theme.green50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  quickStatValue: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.textPrimary,
    letterSpacing: -0.4,
  },
  quickStatLabel: {
    marginTop: 2,
    fontSize: 10,
    fontWeight: '600',
    color: theme.textFaint,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  goalMacroHero: {
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  goalMacroGood: {
    backgroundColor: theme.green50,
    borderColor: theme.greenBorder,
  },
  goalMacroWarn: {
    backgroundColor: theme.processed.bg,
    borderColor: '#fde68a',
  },
  goalMacroNeutral: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
  },
  goalMacroLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: theme.textFaint,
  },
  goalMacroValue: {
    marginTop: 4,
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: -1,
    color: theme.textPrimary,
  },
  goalMacroCaption: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '600',
    color: theme.textMuted,
  },
  infoCard: {
    backgroundColor: colors.backgroundCard,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.cardBorder,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 14,
    elevation: 2,
  },
  infoCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  infoCardHeaderTight: {
    marginBottom: 0,
  },
  infoCardIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoCardHeaderText: {
    flex: 1,
    gap: 2,
  },
  infoCardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.textPrimary,
    letterSpacing: -0.2,
  },
  infoCardSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    color: theme.textFaint,
  },
  cardPreview: {
    marginTop: spacing.sm,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '500',
    color: theme.textMuted,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  ingredientChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.full,
    backgroundColor: '#f8fafc',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e8edf2',
    maxWidth: '100%',
  },
  ingredientChipPrimary: {
    backgroundColor: theme.green50,
    borderColor: theme.greenBorder,
  },
  ingredientChipIcon: {
    marginRight: 4,
  },
  ingredientChipText: {
    flexShrink: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
    color: theme.textSecondary,
  },
  ingredientChipTextPrimary: {
    fontWeight: '700',
    color: theme.green800,
  },
  showMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: spacing.sm,
    paddingVertical: 8,
  },
  showMoreText: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.green700,
  },
  emptyCopy: {
    fontSize: 14,
    lineHeight: 21,
    color: theme.textMuted,
  },
  nutritionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  nutritionStat: {
    minWidth: '30%',
    flexGrow: 1,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: '#f8fafc',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e8edf2',
    alignItems: 'center',
  },
  nutritionStatValue: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.textPrimary,
    letterSpacing: -0.4,
  },
  nutritionStatLabel: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: '600',
    color: theme.textFaint,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  allergenGroup: {
    gap: 8,
  },
  allergenGroupLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: theme.textFaint,
  },
  allergenChipStrong: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.full,
    backgroundColor: theme.flagged.bg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#fecaca',
  },
  allergenChipStrongText: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.flagged.text,
  },
  allergenChipMuted: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.full,
    backgroundColor: theme.allergenBg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.allergenBorder,
  },
  allergenChipMutedText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.allergenText,
  },
  footerFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 120,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: 'rgba(240, 253, 244, 0.94)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(15, 23, 42, 0.05)',
    gap: spacing.sm,
  },
  footerLoading: {
    height: 56,
    borderRadius: radius.lg,
    backgroundColor: theme.green700,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerSecondary: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  footerSecondaryText: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.textMuted,
  },
  correctionContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
    gap: spacing.md,
  },
  correctionTitle: {
    ...typography.h1,
    color: theme.textPrimary,
  },
  correctionSubtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: theme.textMuted,
  },
  correctionCard: {
    backgroundColor: colors.backgroundCard,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.cardBorder,
    gap: spacing.sm,
  },
  correctionCardLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: theme.textFaint,
  },
  correctionProposedName: {
    fontSize: 20,
    fontWeight: '800',
    color: theme.textPrimary,
    letterSpacing: -0.3,
  },
  correctionProposedMeta: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textMuted,
  },
  correctionProposedIngredients: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '500',
    color: theme.textSecondary,
  },
  correctionFieldLabel: {
    marginTop: spacing.sm,
    fontSize: 13,
    fontWeight: '700',
    color: theme.textSecondary,
  },
  correctionInput: {
    backgroundColor: '#fff',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 14 : 10,
    fontSize: 16,
    color: theme.textPrimary,
  },
  correctionInputMultiline: {
    minHeight: 96,
    paddingTop: 12,
  },
  correctionAck: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  correctionAckText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.green800,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: spacing.lg,
  },
  backText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  searchSecondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 48,
    borderRadius: radius.sm,
    backgroundColor: theme.green50,
    marginTop: spacing.lg,
  },
  searchSecondaryBtnText: {
    color: theme.green700,
    fontSize: 15,
    fontWeight: '700',
  },
  ghostBtn: {
    marginTop: spacing.lg,
    alignItems: 'center',
    padding: spacing.md,
  },
  ghostBtnText: {
    color: theme.textMuted,
    fontWeight: '600',
  },
})
