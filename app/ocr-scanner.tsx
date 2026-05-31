import { useCallback, useEffect, useRef, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Modal,
  TextInput,
  useWindowDimensions,
  Animated,
  Platform,
  Alert,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { storage } from '../lib/storage'
import { extractIngredientsFromPhoto, isOcrSupportedOnDevice } from '../lib/ocrScanner'
import { parseIngredients } from '../lib/fillrAdapter'
import {
  backfillBarcodeIngredientData,
  createScanResultFromIngredientText,
  runScanAiEnrichment,
} from '../services/productService'
import type { ScanResult } from '../types'
import { useUserStore } from '../store/userStore'
import { useAuthStore } from '../store/authStore'
import { useScanHistoryStore } from '../store/scanHistoryStore'
import { useCurrentScanStore } from '../store/currentScanStore'
import { canUserScan, incrementScanCount } from '../store/scanStore'
import { showPaywall } from '../services/paywallService'
import { finalizeReferralBonusIfEligible, fetchProfile, incrementScanUsageOnServer } from '../lib/authService'
import { runAfterInteractionsAndNextFrame, runOnNextFrameInTransition } from '../lib/scheduleUIWork'
import { trackScanResultMetric } from '../lib/scanResultMetrics'
import type { OcrTelemetrySummary } from '../lib/ocrScanner'

const OCR_TIPS_KEY = 'fillr_ocr_tips_shown'
const LIVE_CAPTURE_HINTS = [
  'Move closer to the ingredients panel',
  'Reduce glare by tilting the package slightly',
  'Hold still to avoid blur',
] as const

function ocrTelemetryPayload(telemetry?: OcrTelemetrySummary): Record<string, unknown> {
  if (!telemetry) return {}
  return {
    ocr_candidate_count: telemetry.candidateCount,
    ocr_selected_resize_width: telemetry.selectedResizeWidth,
    ocr_selected_roi_pad: telemetry.selectedRoiPad,
    ocr_selected_base_score: telemetry.selectedBaseScore,
    ocr_selected_quality_penalty: telemetry.selectedQualityPenalty,
    ocr_selected_final_score: telemetry.selectedFinalScore,
    ocr_used_cropped_second_pass: telemetry.usedCroppedSecondPass,
  }
}

function devTimeLog(label: string, ...args: unknown[]) {
  if (!__DEV__) return
  try {
    console.timeLog(label, ...args)
  } catch {
    // React Native can throw if the timer was ended by an earlier async branch.
  }
}

function devTimeEnd(label: string) {
  if (!__DEV__) return
  try {
    console.timeEnd(label)
  } catch {
    // Keep debug instrumentation from crashing the camera flow.
  }
}

export default function OcrScannerScreen() {
  const { barcode: fallbackBarcode } = useLocalSearchParams<{ barcode?: string }>()
  const insets = useSafeAreaInsets()
  const { width, height } = useWindowDimensions()
  const [permission, requestPermission] = useCameraPermissions()
  const cameraRef = useRef<InstanceType<typeof CameraView>>(null)
  const [cameraReady, setCameraReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [tipsVisible, setTipsVisible] = useState(false)
  const [nameModalVisible, setNameModalVisible] = useState(false)
  const [pendingIngredientsBlob, setPendingIngredientsBlob] = useState('')
  const [productNameDraft, setProductNameDraft] = useState('')
  const [liveCaptureHint, setLiveCaptureHint] = useState<string>(LIVE_CAPTURE_HINTS[0])
  const scanLineAnim = useRef(new Animated.Value(0)).current

  const allergies = useUserStore((s) => s.allergies)
  const sensitivities = useUserStore((s) => s.sensitivities)
  const preferences = useUserStore((s) => s.preferences)
  const goal = useUserStore((s) => s.goal)
  const celiacStrictGluten = useUserStore((s) => s.celiacStrictGluten)
  const userId = useAuthStore((s) => s.userId)
  const setReferralData = useUserStore((s) => s.setReferralData)
  const addScan = useScanHistoryStore((s) => s.addScan)
  const setCurrentScan = useCurrentScanStore((s) => s.setResult)

  const frameW = width * 0.85
  const frameH = height * 0.45

  useEffect(() => {
    if (Platform.OS === 'web') return
    void (async () => {
      const shown = await storage.getItem(OCR_TIPS_KEY)
      if (shown !== 'true') setTipsVisible(true)
    })()
  }, [])

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scanLineAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(scanLineAnim, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    )
    loop.start()
    return () => loop.stop()
  }, [scanLineAnim])

  useEffect(() => {
    if (busy) return
    let idx = 0
    const timer = setInterval(() => {
      idx = (idx + 1) % LIVE_CAPTURE_HINTS.length
      setLiveCaptureHint(LIVE_CAPTURE_HINTS[idx]!)
    }, 2600)
    return () => clearInterval(timer)
  }, [busy])

  const dismissTips = useCallback(async () => {
    setTipsVisible(false)
    await storage.setItem(OCR_TIPS_KEY, 'true')
  }, [])

  const finalizeOcrScan = useCallback(
    async (ingredientsBlob: string, productDisplayName: string) => {
      void trackScanResultMetric({
        name: 'scan_started',
        payload: { source: 'ocr' },
      })
      const allowed = await canUserScan()
      if (!allowed) {
        const purchased = await showPaywall()
        if (!purchased) {
          void trackScanResultMetric({
            name: 'scan_failed',
            payload: { source: 'ocr', reason: 'paywall_not_purchased' },
          })
          Alert.alert('Scans', 'You need an available scan or Premium to analyze ingredients.')
          return
        }
      }
      const { result, dietaryProfile } = await createScanResultFromIngredientText({
        allergies,
        sensitivities,
        preferences,
        goal,
        celiacStrictGluten,
        ingredientsList: ingredientsBlob,
        productDisplayName,
        scanSource: 'ocr',
      })
      const shouldConsumeCredit = Boolean(result.product.id?.trim()) && result.ingredientBreakdown.length > 0
      if (!shouldConsumeCredit) {
        void trackScanResultMetric({
          name: 'scan_failed',
          payload: { source: 'ocr', reason: 'insufficient_ingredient_data' },
        })
        Alert.alert('Scan incomplete', 'We could not build a reliable ingredient result from this photo.')
        return
      }
      if (typeof fallbackBarcode === 'string' && fallbackBarcode.trim()) {
        void backfillBarcodeIngredientData({
          barcode: fallbackBarcode.trim(),
          ingredientText: ingredientsBlob,
          productDisplayName,
          source: 'photo_ocr',
        }).then((ok) => {
          if (!ok) return
          void trackScanResultMetric({
            name: 'barcode_backfilled_from_ocr',
            barcode: fallbackBarcode.trim(),
            payload: {
              source: 'ocr',
              ingredient_chars: ingredientsBlob.length,
            },
          })
        })
      }
      const productId = result.product.id
      setCurrentScan(result)
      if (Platform.OS === 'ios') {
        // iOS stability path: navigate immediately, then enrich in background.
        const productRouteId = result.product.id
        try {
          router.replace({ pathname: '/product/[id]', params: { id: productRouteId } })
        } catch (e) {
          console.warn('[Fillr] OCR navigate to product failed', e)
        }
        void runScanAiEnrichment(
          result,
          dietaryProfile,
          { fromOcr: true, ingredientParseSource: 'ocr' },
          (enriched) => {
            try {
              const cur = useCurrentScanStore.getState().result
              if (cur?.product.id === productId) {
                setCurrentScan(enriched)
              }
            } catch (e) {
              console.warn('[Fillr][decode] apply enrich to current scan failed', e)
            }
          }
        ).catch((err) => {
          console.warn('AI enrichment failed:', err)
        })
        void incrementScanCount()
        if (userId) {
          void (async () => {
            await incrementScanUsageOnServer(userId)
            await finalizeReferralBonusIfEligible(userId).catch(() => {
              // Retry flag is handled inside finalizeReferralBonusIfEligible.
            })
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
        return
      }
      const scanId = `scan_ocr_${Date.now()}`
      addScan({
        id: scanId,
        productId,
        productName: result.product.name,
        barcode: result.product.barcode,
        safetyStatus: result.safetyStatus,
        date: new Date().toISOString(),
        result,
        source: 'ocr',
      })
      void trackScanResultMetric({
        name: 'scan_succeeded',
        productId: result.product.id,
        barcode: result.product.barcode,
        payload: { source: 'ocr', ingredient_count: result.ingredientBreakdown.length },
      })
      const applyOcrEnriched = (enriched: ScanResult, stage: 'ingredients' | 'product') => {
        runAfterInteractionsAndNextFrame(() => {
          try {
            const cur = useCurrentScanStore.getState().result
            if (cur?.product.id === productId) {
              if (__DEV__) {
                console.log(
                  stage === 'ingredients'
                    ? '[Fillr][decode] decode_merged_to_store'
                    : '[Fillr][decode] product_analysis_merged',
                  { productId }
                )
              }
              setCurrentScan(enriched)
            } else if (__DEV__) {
              console.log('[Fillr][decode] decode_store_mismatch', {
                expectedProductId: productId,
                currentProductId: cur?.product.id ?? null,
                stage,
              })
            }
            runOnNextFrameInTransition(() => {
              try {
                useScanHistoryStore.getState().updateScanResultByProductId(productId, enriched)
              } catch (e) {
                console.warn('[Fillr][decode] history update after enrich failed', e)
              }
            })
          } catch (e) {
            console.warn('[Fillr][decode] apply enrich to current scan failed', e)
          }
        })
      }
      void runScanAiEnrichment(
        result,
        dietaryProfile,
        { fromOcr: true, ingredientParseSource: 'ocr' },
        applyOcrEnriched
      ).catch(() => {})
      await incrementScanCount()
      if (userId) {
        void (async () => {
          await incrementScanUsageOnServer(userId)
          await finalizeReferralBonusIfEligible(userId).catch(() => {
            // Retry flag is handled inside finalizeReferralBonusIfEligible.
          })
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
      const productRouteId = result.product.id
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          try {
            router.replace({ pathname: '/product/[id]', params: { id: productRouteId } })
          } catch (e) {
            console.warn('[Fillr] OCR navigate to product failed', e)
          }
        })
      })
    },
    [
      allergies,
      sensitivities,
      preferences,
      goal,
      celiacStrictGluten,
      fallbackBarcode,
      userId,
      addScan,
      setCurrentScan,
      setReferralData,
    ]
  )

  const submitOcrName = useCallback(async () => {
    const productName = productNameDraft.trim()
    const blob = pendingIngredientsBlob.trim()
    if (!productName || !blob) return
    setNameModalVisible(false)
    if (Platform.OS === 'ios') {
      // iOS emergency mode: never block touches with the loading modal.
      setPendingIngredientsBlob('')
      setProductNameDraft('')
      setBusy(false)
      void finalizeOcrScan(blob, productName).catch((err) => {
        console.warn('[Fillr] OCR scan finalization failed:', err)
        setToast('Could not create scan result. Please try again.')
      })
      return
    }
    setBusy(true)
    try {
      await finalizeOcrScan(blob, productName)
    } catch (err) {
      console.warn('[Fillr] OCR scan finalization failed:', err)
      setToast('Could not create scan result. Please try again.')
    } finally {
      setPendingIngredientsBlob('')
      setProductNameDraft('')
      setBusy(false)
    }
  }, [finalizeOcrScan, pendingIngredientsBlob, productNameDraft])

  const onCapture = useCallback(async () => {
    if (!cameraRef.current || !cameraReady || busy) return
    if (__DEV__) console.time('ocr-total')
    setToast(null)
    setBusy(true)
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.9 })
      devTimeLog('ocr-total', 'photo captured')
      if (!photo?.uri) {
        setToast("Couldn't read the label. Try better lighting or hold still.")
        return
      }
      const ocr = await extractIngredientsFromPhoto(photo.uri)

      if (!ocr.success) {
        const hints = ocr.confidence?.guidance ?? []
        if (hints.length > 0) setLiveCaptureHint(hints[0]!)
        const guidanceLine = hints.length ? ` ${hints.join(' ')}` : ''
        const telemetryPayload = ocrTelemetryPayload(ocr.telemetry)
        if (ocr.error === 'no_ingredients_found') {
          void trackScanResultMetric({
            name: 'scan_failed',
            payload: { source: 'ocr', reason: 'ocr_no_ingredients_found', ...telemetryPayload },
          })
          setToast(
            `Couldn't find the ingredients list.${guidanceLine || " Make sure 'INGREDIENTS:' is visible in frame."}`
          )
          return
        }
        void trackScanResultMetric({
          name: 'scan_failed',
          payload: { source: 'ocr', reason: 'ocr_read_failed', error: ocr.error, ...telemetryPayload },
        })
        setToast(`Couldn't read the label.${guidanceLine || ' Try better lighting or hold still.'}`)
        return
      }

      if (ocr.confidence.level === 'low') {
        if (ocr.confidence.guidance.length > 0) setLiveCaptureHint(ocr.confidence.guidance[0]!)
        void trackScanResultMetric({
          name: 'scan_failed',
          payload: {
            source: 'ocr',
            reason: 'ocr_low_confidence',
            ocr_confidence_score: ocr.confidence.score,
            ...ocrTelemetryPayload(ocr.telemetry),
          },
        })
        const lowGuidance = ocr.confidence.guidance.length
          ? ocr.confidence.guidance.join(' ')
          : 'Move closer to the label. Reduce glare.'
        setToast(`Low confidence scan. Please retake. ${lowGuidance}`)
        return
      }

      const blob = ocr.ingredientsText.trim()
      if (__DEV__) {
        devTimeLog('ocr-total', 'ocr extraction complete')
        console.log('OCR extracted text length:', blob.length)
        console.log('OCR extracted text preview:', blob.slice(0, 200))
      }
      const parsedIngredients = parseIngredients(blob, 'ocr')
      const parsedCount = parsedIngredients.length
      if (__DEV__) {
        devTimeLog('ocr-total', 'ingredients parsed')
        console.log('Parsed ingredient count:', parsedCount)
      }
      if (parsedCount < 2) {
        void trackScanResultMetric({
          name: 'scan_failed',
          payload: {
            source: 'ocr',
            reason: 'ocr_low_parsed_ingredient_count',
            parsed_count: parsedCount,
            ocr_confidence_score: ocr.confidence.score,
            ...ocrTelemetryPayload(ocr.telemetry),
          },
        })
        const guidanceLine = ocr.confidence.guidance.length
          ? ` ${ocr.confidence.guidance.join(' ')}`
          : ' Try moving closer or improving lighting.'
        setToast(
          parsedCount === 0
            ? `We didn't find ingredients.${guidanceLine}`
            : `We only found ${parsedCount} ingredient(s).${guidanceLine}`
        )
        return
      }

      void trackScanResultMetric({
        name: 'scan_succeeded',
        payload: {
          source: 'ocr',
          reason: 'ocr_capture_accepted',
          parsed_count: parsedCount,
          ocr_confidence_score: ocr.confidence.score,
          ...ocrTelemetryPayload(ocr.telemetry),
        },
      })
      setPendingIngredientsBlob(blob)
      setProductNameDraft('')
      setNameModalVisible(true)
    } catch {
      setToast("Couldn't read the label. Try better lighting or hold still.")
    } finally {
      devTimeEnd('ocr-total')
      setBusy(false)
    }
  }, [cameraReady, busy, finalizeOcrScan])

  if (Platform.OS === 'web' || !isOcrSupportedOnDevice()) {
    return (
      <SafeAreaView style={styles.unsupported}>
        <Text style={styles.unsupportedTitle}>Photo ingredients</Text>
        <Text style={styles.unsupportedBody}>
          Label photo scanning needs the Fillr app on iOS or Android (with a dev/production build that
          includes on-device text recognition).
        </Text>
        <Pressable onPress={() => router.back()} style={styles.unsupportedBtn}>
          <Text style={styles.unsupportedBtnText}>Go back</Text>
        </Pressable>
      </SafeAreaView>
    )
  }

  const needsPerm = permission && !permission.granted

  return (
    <View style={styles.root}>
      {!needsPerm && (
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing="back"
          mode="picture"
          onCameraReady={() => setCameraReady(true)}
        />
      )}

      <SafeAreaView style={styles.overlay} edges={['top']}>
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.iconHit}>
            <Ionicons name="close" size={28} color="#fff" />
          </Pressable>
          <Text style={styles.topTitle}>Photo the ingredients list</Text>
          <View style={styles.iconHit} />
        </View>
      </SafeAreaView>

      <View style={styles.frameWrap} pointerEvents="none">
        <View style={[styles.frameBox, { width: frameW, height: frameH }]}>
          <View style={styles.frameGuideFill} />
          <Text style={styles.frameGuideLabel} pointerEvents="none">
            Align ingredients list inside the box
          </Text>
          <View style={[styles.corner, styles.cTL]} />
          <View style={[styles.corner, styles.cTR]} />
          <View style={[styles.corner, styles.cBL]} />
          <View style={[styles.corner, styles.cBR]} />
          <Animated.View
            style={[
              styles.scanLine,
              {
                transform: [
                  {
                    translateY: scanLineAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [8, frameH - 12],
                    }),
                  },
                ],
              },
            ]}
          />
        </View>
      </View>

      <SafeAreaView style={styles.bottomSafe} edges={['bottom']}>
        <View style={styles.bottomBar}>
          {needsPerm ? (
            <>
              <Text style={styles.bottomHint}>Camera access is required to photograph the label.</Text>
              <Pressable onPress={() => void requestPermission()} style={styles.permBtn}>
                <Text style={styles.permBtnText}>Allow camera</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.bottomHint}>{liveCaptureHint}</Text>
              <Pressable
                onPress={() => void onCapture()}
                disabled={!cameraReady || busy}
                style={({ pressed }) => [
                  styles.captureOuter,
                  pressed && { opacity: 0.9 },
                  (!cameraReady || busy) && { opacity: 0.5 },
                ]}
              >
                <View style={styles.captureInner} />
              </Pressable>
            </>
          )}
          {!!toast && <Text style={styles.toast}>{toast}</Text>}
        </View>
      </SafeAreaView>

      <Modal visible={Platform.OS !== 'ios' && busy} transparent animationType="fade">
        <View style={styles.loadingRoot}>
          <ActivityIndicator size="large" color="#22c55e" />
          <Text style={styles.loadingText}>Reading ingredients…</Text>
        </View>
      </Modal>

      <Modal visible={tipsVisible} transparent animationType="fade">
        <View style={styles.tipsBackdrop}>
          <View style={[styles.tipsCard, { marginBottom: insets.bottom + 16 }]}>
            <Text style={styles.tipsTitle}>Get the best results:</Text>
            <Text style={styles.tipsLine}>1. Hold 20–30cm from the label</Text>
            <Text style={styles.tipsLine}>2. Make sure &quot;INGREDIENTS:&quot; is in frame</Text>
            <Text style={styles.tipsLine}>3. Avoid shadows and glare</Text>
            <Pressable onPress={() => void dismissTips()} style={styles.tipsCta}>
              <Text style={styles.tipsCtaText}>Got it →</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={nameModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (busy) return
          setNameModalVisible(false)
          setPendingIngredientsBlob('')
          setProductNameDraft('')
        }}
      >
        <View style={styles.nameBackdrop}>
          <View style={styles.nameCard}>
            <Text style={styles.nameTitle}>Name this product</Text>
            <Text style={styles.nameBody}>
              Add a product name so you can easily recognize this OCR scan later.
            </Text>
            <TextInput
              value={productNameDraft}
              onChangeText={setProductNameDraft}
              placeholder="e.g. Protein granola bar"
              placeholderTextColor="rgba(255,255,255,0.45)"
              style={styles.nameInput}
              editable={!busy}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={() => void submitOcrName()}
            />
            <View style={styles.nameActions}>
              <Pressable
                onPress={() => {
                  if (busy) return
                  setNameModalVisible(false)
                  setPendingIngredientsBlob('')
                  setProductNameDraft('')
                }}
                style={({ pressed }) => [styles.nameCancelBtn, pressed && { opacity: 0.85 }]}
              >
                <Text style={styles.nameCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => void submitOcrName()}
                disabled={!productNameDraft.trim() || busy}
                style={({ pressed }) => [
                  styles.nameSaveBtn,
                  pressed && { opacity: 0.92 },
                  (!productNameDraft.trim() || busy) && { opacity: 0.55 },
                ]}
              >
                <Text style={styles.nameSaveText}>Continue</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 2,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  iconHit: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  frameWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  frameBox: {
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
  },
  frameGuideFill: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.28)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  frameGuideLabel: {
    position: 'absolute',
    top: 10,
    left: 12,
    right: 12,
    zIndex: 2,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.95)',
    textShadowColor: 'rgba(0,0,0,0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  corner: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  cTL: {
    top: 0,
    left: 0,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderTopLeftRadius: 10,
  },
  cTR: {
    top: 0,
    right: 0,
    borderTopWidth: 2,
    borderRightWidth: 2,
    borderTopRightRadius: 10,
  },
  cBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 2,
    borderLeftWidth: 2,
    borderBottomLeftRadius: 10,
  },
  cBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 2,
    borderRightWidth: 2,
    borderBottomRightRadius: 10,
  },
  scanLine: {
    position: 'absolute',
    left: '8%',
    right: '8%',
    height: 2,
    backgroundColor: '#22c55e',
    opacity: 0.85,
  },
  bottomSafe: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 2,
  },
  bottomBar: {
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingTop: 16,
    paddingBottom: 20,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  bottomHint: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    marginBottom: 16,
  },
  captureOuter: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 2,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureInner: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#fff',
  },
  toast: {
    marginTop: 14,
    fontSize: 14,
    color: '#fecaca',
    textAlign: 'center',
  },
  loadingRoot: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#fff',
    fontWeight: '500',
  },
  nameBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  nameCard: {
    backgroundColor: '#0f172a',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    padding: 16,
  },
  nameTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  nameBody: {
    marginTop: 6,
    color: 'rgba(255,255,255,0.75)',
    fontSize: 13,
    lineHeight: 18,
  },
  nameInput: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    borderRadius: 10,
    color: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  nameActions: {
    marginTop: 14,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  nameCancelBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  nameCancelText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    fontWeight: '600',
  },
  nameSaveBtn: {
    backgroundColor: '#22c55e',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  nameSaveText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  permBtn: {
    backgroundColor: '#22c55e',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 100,
  },
  permBtnText: {
    color: '#fff',
    fontWeight: '700',
  },
  tipsBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
  },
  tipsCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
  },
  tipsTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 12,
    color: '#0a0a0a',
  },
  tipsLine: {
    fontSize: 15,
    color: '#374151',
    marginBottom: 8,
    lineHeight: 22,
  },
  tipsCta: {
    marginTop: 16,
    alignSelf: 'flex-end',
  },
  tipsCtaText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#22c55e',
  },
  unsupported: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    backgroundColor: '#f8fdf9',
  },
  unsupportedTitle: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 12,
    color: '#0a0a0a',
  },
  unsupportedBody: {
    fontSize: 15,
    color: '#4b5563',
    lineHeight: 22,
    marginBottom: 24,
  },
  unsupportedBtn: {
    backgroundColor: '#22c55e',
    paddingVertical: 14,
    borderRadius: 100,
    alignItems: 'center',
  },
  unsupportedBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
})
