import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  Platform,
  Modal,
} from 'react-native'
import { BlurView } from 'expo-blur'
import { LinearGradient } from 'expo-linear-gradient'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { useFocusEffect } from '@react-navigation/native'
import { router, useNavigation } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import {
  CameraView,
  useCameraPermissions,
  type BarcodeScanningResult,
  type BarcodeType,
} from 'expo-camera'
import { useUserStore } from '../../store/userStore'
import { useAuthStore } from '../../store/authStore'
import { useScanHistoryStore } from '../../store/scanHistoryStore'
import { useCurrentScanStore } from '../../store/currentScanStore'
import { enrichScanResultWithAI, scanProductFast } from '../../services/productService'
import { colors, spacing, typography } from '../../constants/theme'
import { FREE_SCAN_LIMIT } from '../../constants/subscription'
import { finalizeReferralBonusIfEligible, fetchProfile, incrementScanUsageOnServer } from '../../lib/authService'
import { runAfterInteractionsAndNextFrame, runOnNextFrameInTransition } from '../../lib/scheduleUIWork'
import { canUserScan, getRemainingScans, incrementScanCount } from '../../store/scanStore'
import { showPaywall } from '../../services/paywallService'
import { isDemoScanBarcode } from '../../services/mockProducts'
import { trackScanResultMetric } from '../../lib/scanResultMetrics'

/** Tab bar is `position: 'absolute'` + floating pill — keep sheet + disclaimer above it. */
const SCAN_TAB_BAR_CLEARANCE = 88

const VIEWFINDER_W = 220
const VIEWFINDER_H = 180

const RETAIL_BARCODE_TYPES: BarcodeType[] = [
  'ean13',
  'ean8',
  'upc_a',
  'upc_e',
  'code128',
  'code39',
  'itf14',
  'codabar',
]

export default function ScanScreen() {
  const insets = useSafeAreaInsets()
  const navigation = useNavigation()
  const [permission, requestPermission] = useCameraPermissions()
  const [scanning, setScanning] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)
  const [torchOn, setTorchOn] = useState(false)
  const [cameraFailed, setCameraFailed] = useState(false)
  const scannedRef = useRef(false)
  const barcodeInFlightRef = useRef(false)
  const { allergies, sensitivities, preferences, goal, celiacStrictGluten } = useUserStore()
  const isPro = useUserStore((s) => s.isPro)
  const totalScansUsed = useUserStore((s) => s.totalScansUsed ?? 0)
  const bonusScansEarned = useUserStore((s) => s.bonusScansEarned ?? 0)
  const setReferralData = useUserStore((s) => s.setReferralData)
  const userId = useAuthStore((s) => s.userId)
  const addScan = useScanHistoryStore((s) => s.addScan)
  const setCurrentScan = useCurrentScanStore((s) => s.setResult)
  const outOfScans = !isPro && totalScansUsed >= FREE_SCAN_LIMIT + bonusScansEarned

  useFocusEffect(
    useCallback(() => {
      setScanError(null)
      const t = setTimeout(() => {
        scannedRef.current = false
        barcodeInFlightRef.current = false
      }, 500)
      return () => clearTimeout(t)
    }, [])
  )

  useEffect(() => {
    if (outOfScans) return
    if (permission?.status === 'undetermined') {
      void requestPermission()
    }
  }, [outOfScans, permission?.status, requestPermission])

  const processBarcode = useCallback(
    async (rawBarcode: string) => {
      const barcode = String(rawBarcode || '').trim()
      if (!barcode || scannedRef.current) return
      setScanError(null)
      void trackScanResultMetric({
        name: 'scan_started',
        barcode,
        payload: { source: 'barcode' },
      })

      const isDemo = isDemoScanBarcode(barcode)

      if (!isDemo) {
        const allowed = await canUserScan()
        if (!allowed) {
          const purchased = await showPaywall()
          if (!purchased) {
            const remaining = await getRemainingScans()
            setScanError(
              remaining > 0
                ? `You have ${remaining} free scan${remaining === 1 ? '' : 's'} remaining.`
                : 'No free scans left. Upgrade to premium to keep scanning.'
            )
            void trackScanResultMetric({
              name: 'scan_failed',
              barcode,
              payload: { source: 'barcode', reason: 'paywall_not_purchased' },
            })
            return
          }
        }
      }

      scannedRef.current = true

      setScanning(true)
      try {
        const result = await scanProductFast({
          barcode,
          allergies,
          sensitivities,
          preferences,
          goal,
          celiacStrictGluten,
        })

        if (result.ok) {
          const shouldConsumeCredit =
            Boolean(result.result.product.id?.trim()) && result.result.ingredientBreakdown.length > 0
          if (!shouldConsumeCredit) {
            void trackScanResultMetric({
              name: 'scan_failed',
              barcode,
              payload: { source: 'barcode', reason: 'insufficient_ingredient_data' },
            })
            router.push({
              pathname: '/product/error',
              params: {
                error: 'Scan did not return enough ingredient data. Please try again.',
                barcode,
                reason: 'insufficient_data',
                productName: result.result.product.name,
              },
            })
            return
          }
          const productId = result.result.product.id
          setCurrentScan(result.result)
          addScan({
            id: `scan_${Date.now()}`,
            productId,
            productName: result.result.product.name,
            barcode: result.result.product.barcode,
            safetyStatus: result.result.safetyStatus,
            date: new Date().toISOString(),
            result: result.result,
          })

          if (result.result.product.ingredientText.trim()) {
            void enrichScanResultWithAI(result.result, result.dietaryProfile)
              .then((enriched) => {
                runAfterInteractionsAndNextFrame(() => {
                  try {
                    const cur = useCurrentScanStore.getState().result
                    if (cur?.product.id === productId) {
                      if (__DEV__) console.log('[Fillr][decode] decode_merged_to_store', { productId })
                      setCurrentScan(enriched)
                    } else if (__DEV__) {
                      console.log('[Fillr][decode] decode_store_mismatch', {
                        expectedProductId: productId,
                        currentProductId: cur?.product.id ?? null,
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
              })
              .catch((err) => {
                console.warn('AI enrichment failed:', err)
              })
          }
          if (!isDemo) {
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
          }
          void trackScanResultMetric({
            name: 'scan_succeeded',
            productId: productId,
            barcode,
            payload: { source: 'barcode', ingredient_count: result.result.ingredientBreakdown.length },
          })
          router.push({
            pathname: '/product/[id]',
            params: { id: result.result.product.id },
          })
        } else {
          void trackScanResultMetric({
            name: 'scan_failed',
            barcode,
            payload: { source: 'barcode', reason: 'scan_product_fast_error', code: result.reason ?? null },
          })
          router.push({
            pathname: '/product/error',
            params: {
              error: result.error,
              barcode,
              ...(result.reason ? { reason: result.reason } : {}),
              ...(result.productName ? { productName: result.productName } : {}),
            },
          })
        }
      } catch {
        void trackScanResultMetric({
          name: 'scan_failed',
          barcode,
          payload: { source: 'barcode', reason: 'exception' },
        })
        router.push({
          pathname: '/product/error',
          params: { error: 'Something went wrong. Please try again.', barcode },
        })
      } finally {
        setScanning(false)
      }
    },
    [
      allergies,
      sensitivities,
      preferences,
      goal,
      celiacStrictGluten,
      addScan,
      setCurrentScan,
      userId,
      setReferralData,
    ]
  )

  const handleBarcodeScanned = useCallback(
    async (result: BarcodeScanningResult) => {
      const code = String(result.data ?? '').trim()
      if (outOfScans && !isDemoScanBarcode(code)) return
      if (scannedRef.current || barcodeInFlightRef.current) return
      if (!code) return
      barcodeInFlightRef.current = true
      try {
        await processBarcode(code)
      } finally {
        barcodeInFlightRef.current = false
      }
    },
    [outOfScans, processBarcode]
  )

  const permissionLoading = !outOfScans && permission === null
  const canUseCamera = !outOfScans && permission?.granted === true && !cameraFailed
  const needsPermission = !outOfScans && permission !== null && !permission.granted
  const permissionCanAskAgain = permission?.canAskAgain !== false

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () =>
        canUseCamera && !scanning ? (
          <Pressable
            onPress={() => setTorchOn((t) => !t)}
            style={({ pressed }) => [
              styles.flashGlass,
              { marginRight: spacing.md },
              pressed && { opacity: 0.88 },
            ]}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={torchOn ? 'Turn flash off' : 'Turn flash on'}
          >
            <Ionicons name={torchOn ? 'flash' : 'flash-outline'} size={18} color="#ffffff" />
          </Pressable>
        ) : null,
    })
  }, [navigation, canUseCamera, scanning, torchOn])

  const bottomPad = SCAN_TAB_BAR_CLEARANCE + insets.bottom

  return (
    <View style={styles.container}>
      {canUseCamera && (
        <CameraView
          style={StyleSheet.absoluteFillObject}
          facing="back"
          active={!scanning}
          enableTorch={torchOn}
          barcodeScannerSettings={{ barcodeTypes: RETAIL_BARCODE_TYPES }}
          onBarcodeScanned={handleBarcodeScanned}
          onMountError={() => setCameraFailed(true)}
        />
      )}
      {!canUseCamera && !outOfScans && <View style={[StyleSheet.absoluteFillObject, styles.cameraPlaceholder]} />}

      <LinearGradient
        pointerEvents="none"
        colors={[
          'rgba(0,0,0,0.15)',
          'transparent',
          'transparent',
          'rgba(0,0,0,0.5)',
        ]}
        locations={[0, 0.3, 0.55, 1]}
        style={StyleSheet.absoluteFillObject}
      />

      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <View style={styles.midSection} pointerEvents="box-none">
          <View style={styles.viewfinder} pointerEvents="none">
            <View style={[styles.bracket, styles.bracketTL]} />
            <View style={[styles.bracket, styles.bracketTR]} />
            <View style={[styles.bracket, styles.bracketBL]} />
            <View style={[styles.bracket, styles.bracketBR]} />
            <View style={styles.scanLineWrap}>
              <LinearGradient
                colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.7)', 'rgba(255,255,255,0)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.scanLineGrad}
              />
            </View>
          </View>

          {!outOfScans && !permissionLoading && !needsPermission && !cameraFailed && (
            <View style={styles.hintTexts} pointerEvents="none">
              <Text style={styles.hintPrimary}>Point at a barcode</Text>
              <Text style={styles.hintSecondary}>EAN and UPC detected automatically</Text>
            </View>
          )}
        </View>

        <View style={[styles.bottomStack, { paddingBottom: bottomPad }]}>
          {outOfScans ? (
            <View style={styles.glassCard}>
              <Text style={styles.stateTitle}>No scans left</Text>
              <Text style={styles.stateBody}>
                No free scans left. Invite a friend or upgrade to keep scanning.
              </Text>
              <Pressable
                onPress={() => {
                  void showPaywall()
                }}
                style={({ pressed }) => [styles.primaryCta, pressed && { opacity: 0.9 }]}
                accessibilityRole="button"
                accessibilityLabel="Get Fillr premium"
              >
                <Ionicons name="diamond-outline" size={16} color="#ffffff" />
                <Text style={styles.primaryCtaText}>Get Fillr Premium</Text>
              </Pressable>
            </View>
          ) : permissionLoading ? (
            <View style={styles.glassCard}>
              <ActivityIndicator color="#ffffff" />
              <Text style={styles.stateBody}>Preparing camera…</Text>
            </View>
          ) : needsPermission ? (
            <View style={styles.glassCard}>
              <Text style={styles.stateTitle}>Camera access</Text>
              <Text style={styles.stateBody}>
                Fillr needs the camera to scan barcodes on product packaging.
              </Text>
              <Pressable
                onPress={() => void requestPermission()}
                style={({ pressed }) => [styles.primaryCta, pressed && { opacity: 0.9 }]}
                accessibilityRole="button"
                accessibilityLabel="Allow camera access"
              >
                <Ionicons name="camera-outline" size={16} color="#ffffff" />
                <Text style={styles.primaryCtaText}>Allow camera</Text>
              </Pressable>
              {!permissionCanAskAgain && (
                <Text style={styles.stateMuted}>
                  Camera is off in system settings. Enable it for Fillr, then return here.
                </Text>
              )}
            </View>
          ) : cameraFailed ? (
            <View style={styles.glassCard}>
              <Text style={styles.stateTitle}>Camera unavailable</Text>
              <Text style={styles.stateBody}>
                {Platform.OS === 'ios'
                  ? 'The camera could not start (common on some simulators). Use a physical device to scan.'
                  : 'The camera could not start. Try again in a moment.'}
              </Text>
              <Pressable
                onPress={() => setCameraFailed(false)}
                style={({ pressed }) => [styles.secondaryCta, pressed && { opacity: 0.9 }]}
              >
                <Text style={styles.secondaryCtaText}>Retry camera</Text>
              </Pressable>
            </View>
          ) : (
            <>
              {!outOfScans && Platform.OS !== 'web' && canUseCamera && (
                <Pressable
                  onPress={() => router.push('/ocr-scanner')}
                  style={({ pressed }) => [styles.bottomSheet, pressed && { opacity: 0.92 }]}
                  accessibilityRole="button"
                  accessibilityLabel="Scan ingredients with camera instead of barcode"
                >
                  <View style={styles.bottomSheetTextCol}>
                    <Text style={styles.bottomSheetKicker}>CAN&apos;T SCAN THE BARCODE?</Text>
                    <Text style={styles.bottomSheetTitle}>Scan ingredients instead</Text>
                  </View>
                  <View style={styles.chevronGlass}>
                    <Ionicons name="chevron-forward" size={22} color="#ffffff" />
                  </View>
                </Pressable>
              )}
            </>
          )}

          {!!scanError && !outOfScans && <Text style={styles.scanError}>{scanError}</Text>}
          <Text style={styles.disclaimer}>
            Not medical advice — always verify with the physical label
          </Text>
        </View>
      </SafeAreaView>

      <Modal
        visible={scanning}
        animationType="fade"
        transparent
        statusBarTranslucent
        onRequestClose={() => {}}
      >
        <View style={styles.analyzingRoot} accessibilityViewIsModal>
          <BlurView intensity={55} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={styles.analyzingScrim} pointerEvents="none" />
          <SafeAreaView style={styles.analyzingSafe} edges={['top', 'bottom']}>
            <View style={styles.analyzingCard}>
              <View style={styles.analyzingSpinnerWrap}>
                <ActivityIndicator size="large" color={colors.accent} />
              </View>
              <Text style={styles.analyzingTitle}>Analyzing product</Text>
              <Text style={styles.analyzingSubtitle}>
                Fetching label data and matching your allergies & preferences. Usually a few seconds.
              </Text>
            </View>
          </SafeAreaView>
        </View>
      </Modal>

    </View>
  )
}

const BR = 2.5

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  cameraPlaceholder: {
    backgroundColor: '#0a0a0a',
  },
  safe: {
    flex: 1,
  },
  flashGlass: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  midSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewfinder: {
    width: VIEWFINDER_W,
    height: VIEWFINDER_H,
    position: 'relative',
  },
  bracket: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderColor: '#ffffff',
  },
  bracketTL: {
    top: 0,
    left: 0,
    borderLeftWidth: BR,
    borderTopWidth: BR,
    borderTopLeftRadius: 4,
  },
  bracketTR: {
    top: 0,
    right: 0,
    borderRightWidth: BR,
    borderTopWidth: BR,
    borderTopRightRadius: 4,
  },
  bracketBL: {
    bottom: 0,
    left: 0,
    borderLeftWidth: BR,
    borderBottomWidth: BR,
    borderBottomLeftRadius: 4,
  },
  bracketBR: {
    bottom: 0,
    right: 0,
    borderRightWidth: BR,
    borderBottomWidth: BR,
    borderBottomRightRadius: 4,
  },
  scanLineWrap: {
    position: 'absolute',
    left: '8%',
    right: '8%',
    top: '50%',
    marginTop: -0.75,
    height: 1.5,
    overflow: 'hidden',
    borderRadius: 1,
  },
  scanLineGrad: {
    flex: 1,
    width: '100%',
    height: 1.5,
  },
  hintTexts: {
    marginTop: 20,
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  hintPrimary: {
    fontSize: 13,
    fontWeight: '500',
    color: '#ffffff',
    marginBottom: 4,
  },
  hintSecondary: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
  },
  bottomStack: {
    paddingHorizontal: 16,
    gap: 10,
  },
  glassCard: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.3)',
    borderRadius: 20,
    padding: 16,
  },
  bottomSheet: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.3)',
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  bottomSheetTextCol: {
    flex: 1,
    paddingRight: 12,
  },
  bottomSheetKicker: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  bottomSheetTitle: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.9)',
  },
  chevronGlass: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateTitle: {
    ...typography.label,
    color: '#ffffff',
    marginBottom: spacing.xs,
  },
  stateBody: {
    ...typography.bodySmall,
    color: 'rgba(255,255,255,0.9)',
    marginBottom: spacing.sm,
  },
  stateMuted: {
    ...typography.bodySmall,
    color: 'rgba(255,255,255,0.65)',
    marginTop: spacing.sm,
  },
  primaryCta: {
    marginTop: spacing.sm,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    backgroundColor: colors.accent,
  },
  primaryCtaText: {
    ...typography.bodySmall,
    color: '#ffffff',
    fontWeight: '800',
  },
  secondaryCta: {
    marginTop: spacing.sm,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  secondaryCtaText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
  scanError: {
    marginTop: 4,
    color: '#fecaca',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  disclaimer: {
    fontSize: 10,
    lineHeight: 14,
    color: 'rgba(255,255,255,0.3)',
    textAlign: 'center',
    marginTop: 4,
  },
  analyzingRoot: {
    flex: 1,
    justifyContent: 'center',
  },
  analyzingScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  analyzingSafe: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  analyzingCard: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#fafefa',
    borderRadius: 22,
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(22,163,74,0.12)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 28,
    elevation: 12,
  },
  analyzingSpinnerWrap: {
    marginBottom: spacing.lg,
    height: 44,
    justifyContent: 'center',
  },
  analyzingTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0a0a0a',
    letterSpacing: -0.4,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  analyzingSubtitle: {
    ...typography.bodySmall,
    fontSize: 15,
    lineHeight: 22,
    color: '#4b5563',
    textAlign: 'center',
  },
})
