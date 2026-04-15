import { useCallback, useEffect, useRef, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Modal,
  useWindowDimensions,
  Animated,
  Platform,
  Alert,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { storage } from '../lib/storage'
import { extractIngredientsFromPhoto, isOcrSupportedOnDevice } from '../lib/ocrScanner'
import { parseIngredients } from '../lib/fillrAdapter'
import { createScanResultFromIngredientText } from '../services/productService'
import { useUserStore } from '../store/userStore'
import { useAuthStore } from '../store/authStore'
import { useScanHistoryStore } from '../store/scanHistoryStore'
import { useCurrentScanStore } from '../store/currentScanStore'
import { canUserScan, incrementScanCount } from '../store/scanStore'
import { showPaywall } from '../services/paywallService'
import { finalizeReferralBonusIfEligible, fetchProfile, incrementScanUsageOnServer } from '../lib/authService'

const OCR_TIPS_KEY = 'fillr_ocr_tips_shown'

export default function OcrScannerScreen() {
  const insets = useSafeAreaInsets()
  const { width, height } = useWindowDimensions()
  const [permission, requestPermission] = useCameraPermissions()
  const cameraRef = useRef<InstanceType<typeof CameraView>>(null)
  const [cameraReady, setCameraReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [tipsVisible, setTipsVisible] = useState(false)
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
  const frameH = height * 0.4

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

  const dismissTips = useCallback(async () => {
    setTipsVisible(false)
    await storage.setItem(OCR_TIPS_KEY, 'true')
  }, [])

  const finalizeOcrScan = useCallback(
    async (ingredientsBlob: string) => {
      const allowed = await canUserScan()
      if (!allowed) {
        const purchased = await showPaywall()
        if (!purchased) {
          Alert.alert('Scans', 'You need an available scan or Premium to analyze ingredients.')
          return
        }
      }
      const result = await createScanResultFromIngredientText({
        allergies,
        sensitivities,
        preferences,
        goal,
        celiacStrictGluten,
        ingredientsList: ingredientsBlob,
        scanSource: 'ocr',
      })
      setCurrentScan(result)
      const scanId = `scan_ocr_${Date.now()}`
      addScan({
        id: scanId,
        productId: result.product.id,
        productName: result.product.name,
        barcode: result.product.barcode,
        safetyStatus: result.safetyStatus,
        date: new Date().toLocaleDateString(),
        result,
        source: 'ocr',
      })
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
      if (__DEV__) console.timeLog('ocr-total', 'navigated to result')
      router.replace({ pathname: '/product/[id]', params: { id: result.product.id } })
    },
    [
      allergies,
      sensitivities,
      preferences,
      goal,
      celiacStrictGluten,
      userId,
      addScan,
      setCurrentScan,
      setReferralData,
    ]
  )

  const onCapture = useCallback(async () => {
    if (!cameraRef.current || !cameraReady || busy) return
    if (__DEV__) console.time('ocr-total')
    setToast(null)
    setBusy(true)
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.9 })
      if (__DEV__) console.timeLog('ocr-total', 'photo captured')
      if (!photo?.uri) {
        setToast("Couldn't read the label. Try better lighting or hold still.")
        return
      }
      const ocr = await extractIngredientsFromPhoto(photo.uri)

      if (!ocr.success) {
        if (ocr.error === 'no_ingredients_found') {
          setToast(
            "Couldn't find the ingredients list. Make sure 'INGREDIENTS:' is visible in frame."
          )
          return
        }
        setToast("Couldn't read the label. Try better lighting or hold still.")
        return
      }

      const blob = ocr.ingredientsText.trim()
      if (__DEV__) {
        console.timeLog('ocr-total', 'ocr extraction complete')
        console.log('OCR extracted text length:', blob.length)
        console.log('OCR extracted text preview:', blob.slice(0, 200))
      }
      const parsedIngredients = parseIngredients(blob, 'ocr')
      const parsedCount = parsedIngredients.length
      if (__DEV__) {
        console.timeLog('ocr-total', 'ingredients parsed')
        console.log('Parsed ingredient count:', parsedCount)
      }
      if (parsedCount < 2) {
        setToast(
          parsedCount === 0
            ? "We didn't find ingredients. Try moving closer or improving lighting."
            : `We only found ${parsedCount} ingredient(s). Try moving closer or improving lighting.`
        )
        return
      }

      await finalizeOcrScan(blob)
    } catch {
      setToast("Couldn't read the label. Try better lighting or hold still.")
    } finally {
      if (__DEV__) console.timeEnd('ocr-total')
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
              <Text style={styles.bottomHint}>Fill the frame with the ingredients text</Text>
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

      <Modal visible={busy} transparent animationType="fade">
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
