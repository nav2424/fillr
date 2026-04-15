import { useCallback, useEffect, useRef, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  Platform,
  TextInput,
  Keyboard,
  Modal,
} from 'react-native'
import { BlurView } from 'expo-blur'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { useFocusEffect } from '@react-navigation/native'
import { router } from 'expo-router'
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
import { HEALTH_DISCLAIMER_MICRO } from '../../constants/healthDisclaimer'
import { colors, spacing, typography } from '../../constants/theme'
import { FREE_SCAN_LIMIT } from '../../constants/subscription'
import { finalizeReferralBonusIfEligible, fetchProfile, incrementScanUsageOnServer } from '../../lib/authService'
import { canUserScan, getRemainingScans, incrementScanCount } from '../../store/scanStore'
import { showPaywall } from '../../services/paywallService'
import { isDemoScanBarcode } from '../../services/mockProducts'

/** Tab bar is `position: 'absolute'` — keep hint card + disclaimer above it. */
const SCAN_TAB_BAR_CLEARANCE = 72

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
  const [permission, requestPermission] = useCameraPermissions()
  const [scanning, setScanning] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)
  const [torchOn, setTorchOn] = useState(false)
  const [manualCode, setManualCode] = useState('')
  const [manualOpen, setManualOpen] = useState(false)
  const [cameraFailed, setCameraFailed] = useState(false)
  // Prevent duplicate scan handler execution before React state updates propagate.
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
            return
          }
        }
      }

      // Immediately stop further scans as soon as we get one.
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
          const productId = result.result.product.id
          setCurrentScan(result.result)
          addScan({
            id: `scan_${Date.now()}`,
            productId,
            productName: result.result.product.name,
            barcode: result.result.product.barcode,
            safetyStatus: result.result.safetyStatus,
            date: new Date().toLocaleDateString(),
            result: result.result,
          })

          if (!isDemo && result.result.product.ingredientText.trim()) {
            void enrichScanResultWithAI(result.result, result.dietaryProfile)
              .then((enriched) => {
                const cur = useCurrentScanStore.getState().result
                if (cur?.product.id === productId) {
                  setCurrentScan(enriched)
                }
                useScanHistoryStore.getState().updateScanResultByProductId(productId, enriched)
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
          router.push({
            pathname: '/product/[id]',
            params: { id: result.result.product.id },
          })
        } else {
          router.push({
            pathname: '/product/error',
            params: {
              error: result.error,
              ...(result.reason ? { reason: result.reason } : {}),
              ...(result.productName ? { productName: result.productName } : {}),
            },
          })
        }
      } catch {
        router.push({
          pathname: '/product/error',
          params: { error: 'Something went wrong. Please try again.' },
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

  const submitManualCode = useCallback(() => {
    Keyboard.dismiss()
    const code = manualCode.replace(/\s/g, '').trim()
    if (!code) return
    void handleBarcodeScanned({ type: 'ean13', data: code } as BarcodeScanningResult)
  }, [manualCode, handleBarcodeScanned])

  const permissionLoading = !outOfScans && permission === null
  const canUseCamera = !outOfScans && permission?.granted === true && !cameraFailed
  const needsPermission = !outOfScans && permission !== null && !permission.granted
  const permissionCanAskAgain = permission?.canAskAgain !== false

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

      <SafeAreaView style={styles.overlay} edges={['top', 'bottom']}>
        <View style={styles.topBar}>
          <View style={styles.topBarRow}>
            <View style={styles.iconBtnPlaceholder} />
            <View style={styles.topBarSpacer} />
            {canUseCamera && !scanning ? (
              <Pressable
                onPress={() => setTorchOn((t) => !t)}
                style={({ pressed }) => [styles.iconBtn, pressed && styles.demoButtonPressed]}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel={torchOn ? 'Turn flash off' : 'Turn flash on'}
              >
                <Ionicons name={torchOn ? 'flash' : 'flash-outline'} size={26} color="#ffffff" />
              </Pressable>
            ) : (
              <View style={styles.iconBtnPlaceholder} />
            )}
          </View>
        </View>

        <View style={styles.scanArea}>
          <View style={styles.corner} />
          <View style={[styles.corner, styles.cornerTopRight]} />
          <View style={[styles.corner, styles.cornerBottomLeft]} />
          <View style={[styles.corner, styles.cornerBottomRight]} />
        </View>

        <View
          style={[
            styles.hintBox,
            { paddingBottom: spacing.lg + SCAN_TAB_BAR_CLEARANCE + insets.bottom },
          ]}
        >
          {outOfScans ? (
            <>
              <Text style={styles.hintTitle}>No scans left</Text>
              <Text style={styles.scanError}>
                No free scans left. Invite a friend or upgrade to keep scanning.
              </Text>
              <Pressable
                onPress={() => {
                  void showPaywall()
                }}
                style={({ pressed }) => [styles.premiumCtaBtn, pressed && styles.demoButtonPressed]}
                accessibilityRole="button"
                accessibilityLabel="Get Fillr premium"
              >
                <Ionicons name="diamond-outline" size={16} color="#ffffff" />
                <Text style={styles.premiumCtaText}>Get Fillr Premium</Text>
              </Pressable>
            </>
          ) : permissionLoading ? (
            <View style={styles.permissionLoading}>
              <ActivityIndicator color="#ffffff" />
              <Text style={[styles.hintText, styles.hintMarginTop]}>Preparing camera…</Text>
            </View>
          ) : needsPermission ? (
            <>
              <Text style={styles.hintTitle}>Camera access</Text>
              <Text style={styles.hintText}>
                Fillr needs the camera to scan barcodes on product packaging.
              </Text>
              <Pressable
                onPress={() => void requestPermission()}
                style={({ pressed }) => [styles.premiumCtaBtn, pressed && styles.demoButtonPressed]}
                accessibilityRole="button"
                accessibilityLabel="Allow camera access"
              >
                <Ionicons name="camera-outline" size={16} color="#ffffff" />
                <Text style={styles.premiumCtaText}>Allow camera</Text>
              </Pressable>
              {!permissionCanAskAgain && (
                <Text style={styles.hintTextMuted}>
                  Camera is off in system settings. Enable it for Fillr, then return here.
                </Text>
              )}
            </>
          ) : cameraFailed ? (
            <>
              <Text style={styles.hintTitle}>Camera unavailable</Text>
              <Text style={styles.hintText}>
                {Platform.OS === 'ios'
                  ? 'The camera could not start (common on some simulators). Type a barcode below or use a physical device.'
                  : 'The camera could not start. Try again or enter a barcode manually.'}
              </Text>
              <Pressable
                onPress={() => setCameraFailed(false)}
                style={({ pressed }) => [styles.referralCtaBtn, pressed && styles.demoButtonPressed]}
              >
                <Text style={styles.premiumCtaText}>Retry camera</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.hintTitle}>Point at a barcode</Text>
              <Text style={styles.hintText}>
                Hold steady — we read EAN and UPC codes automatically.
              </Text>
            </>
          )}

          {!outOfScans &&
            Platform.OS !== 'web' &&
            canUseCamera &&
            !permissionLoading &&
            !cameraFailed && (
            <Pressable
              onPress={() => router.push('/ocr-scanner')}
              style={({ pressed }) => [styles.ocrLinkWrap, pressed && { opacity: 0.85 }]}
            >
              <Text style={styles.ocrLinkText}>
                Can&apos;t scan the barcode?{'\n'}Photograph the ingredients instead →
              </Text>
            </Pressable>
          )}

          {!outOfScans && (
            <>
              {!manualOpen ? (
                <Pressable
                  onPress={() => setManualOpen(true)}
                  style={({ pressed }) => [styles.manualLink, pressed && styles.demoButtonPressed]}
                  accessibilityRole="button"
                  accessibilityLabel="Enter barcode manually"
                >
                  <Text style={styles.manualLinkText}>Enter barcode manually</Text>
                </Pressable>
              ) : (
                <View style={styles.manualRow}>
                  <TextInput
                    style={styles.manualInput}
                    value={manualCode}
                    onChangeText={setManualCode}
                    placeholder="Barcode digits"
                    placeholderTextColor="rgba(255,255,255,0.45)"
                    keyboardType="number-pad"
                    returnKeyType="done"
                    onSubmitEditing={() => submitManualCode()}
                    autoCorrect={false}
                    accessibilityLabel="Barcode number"
                  />
                  <Pressable
                    onPress={() => submitManualCode()}
                    style={({ pressed }) => [styles.manualGo, pressed && styles.demoButtonPressed]}
                  >
                    <Text style={styles.manualGoText}>Go</Text>
                  </Pressable>
                  <Pressable onPress={() => setManualOpen(false)} hitSlop={10}>
                    <Text style={styles.manualCancel}>Cancel</Text>
                  </Pressable>
                </View>
              )}
            </>
          )}

          {!outOfScans && (
            <Pressable
              onPress={() => router.push('/manage-subscription')}
              style={({ pressed }) => [styles.planLink, pressed && styles.demoButtonPressed]}
              accessibilityRole="button"
              accessibilityLabel="Open plan and scans"
            >
              <Text style={styles.planLinkText}>Plan & scans</Text>
            </Pressable>
          )}

          {!!scanError && !outOfScans && <Text style={styles.scanError}>{scanError}</Text>}
          <Text style={styles.scanLegalMicro}>{HEALTH_DISCLAIMER_MICRO}</Text>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  cameraPlaceholder: {
    backgroundColor: '#0a0a0a',
  },
  overlay: {
    flex: 1,
    justifyContent: 'space-between',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    minHeight: 44,
  },
  topBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  topBarSpacer: {
    flex: 1,
  },
  iconBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnPlaceholder: {
    width: 44,
    height: 44,
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
  scanArea: {
    flex: 1,
    margin: spacing.xxl,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    borderRadius: 16,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderLeftWidth: 4,
    borderTopWidth: 4,
    borderColor: colors.accent,
    borderRadius: 2,
    top: 0,
    left: 0,
  },
  cornerTopRight: {
    left: undefined,
    right: 0,
    borderLeftWidth: 0,
    borderRightWidth: 4,
    borderTopWidth: 4,
  },
  cornerBottomLeft: {
    top: undefined,
    bottom: 0,
    borderTopWidth: 0,
    borderBottomWidth: 4,
  },
  cornerBottomRight: {
    top: undefined,
    left: undefined,
    right: 0,
    bottom: 0,
    borderLeftWidth: 0,
    borderRightWidth: 4,
    borderTopWidth: 0,
    borderBottomWidth: 4,
  },
  hintBox: {
    margin: spacing.xl,
    padding: spacing.lg,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  permissionWrap: {
    margin: spacing.xl,
    padding: spacing.lg,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  referralCtaBtn: {
    marginTop: spacing.md,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    backgroundColor: '#0ea5e9',
  },
  hintTitle: {
    ...typography.label,
    color: '#ffffff',
    marginBottom: spacing.xs,
  },
  hintText: {
    ...typography.bodySmall,
    color: 'rgba(255,255,255,0.9)',
    marginBottom: spacing.sm,
  },
  hintTextMuted: {
    ...typography.bodySmall,
    color: 'rgba(255,255,255,0.65)',
    marginTop: spacing.sm,
  },
  hintMarginTop: {
    marginTop: spacing.sm,
  },
  ocrLinkWrap: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignSelf: 'stretch',
  },
  ocrLinkText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
    lineHeight: 19,
  },
  permissionLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  manualLink: {
    marginTop: spacing.md,
    alignSelf: 'flex-start',
  },
  manualLinkText: {
    ...typography.bodySmall,
    color: 'rgba(255,255,255,0.85)',
    textDecorationLine: 'underline',
  },
  manualRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    flexWrap: 'wrap',
  },
  manualInput: {
    flex: 1,
    minWidth: 120,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
    color: '#ffffff',
    fontSize: 16,
  },
  manualGo: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: 10,
  },
  manualGoText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 15,
  },
  manualCancel: {
    ...typography.bodySmall,
    color: 'rgba(255,255,255,0.75)',
  },
  planLink: {
    marginTop: spacing.md,
    alignSelf: 'center',
    paddingVertical: spacing.xs,
  },
  planLinkText: {
    ...typography.bodySmall,
    color: 'rgba(255,255,255,0.65)',
    textDecorationLine: 'underline',
  },
  demoButtonPressed: {
    opacity: 0.7,
  },
  scanError: {
    marginTop: 10,
    color: '#fecaca',
    fontSize: 13,
    fontWeight: '600',
  },
  scanLegalMicro: {
    marginTop: spacing.md,
    marginBottom: spacing.xs,
    fontSize: 11,
    lineHeight: 16,
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'center',
  },
  premiumCtaBtn: {
    marginTop: spacing.md,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    backgroundColor: colors.accent,
  },
  premiumCtaText: {
    ...typography.bodySmall,
    color: '#ffffff',
    fontWeight: '800',
  },
})
