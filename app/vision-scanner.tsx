import { useCallback, useRef, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Modal,
  Platform,
  Linking,
  Alert,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { CameraView, useCameraPermissions } from 'expo-camera'
import {
  identifyProductFromPhotoBase64,
  identifyProductFromPhotoUri,
  visionMeetsConfidenceThreshold,
} from '../services/openaiProductVision'
import { exitVisionFlowToHome } from '../lib/navigationHelpers'
import { useVisionScanStore } from '../store/visionScanStore'
import { canUserScan } from '../store/scanStore'
import { showPaywall } from '../services/paywallService'

export default function VisionScannerScreen() {
  const { barcode: fallbackBarcode } = useLocalSearchParams<{ barcode?: string }>()
  const insets = useSafeAreaInsets()
  const [permission, requestPermission] = useCameraPermissions()
  const cameraRef = useRef<InstanceType<typeof CameraView>>(null)
  const [cameraReady, setCameraReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const setDraft = useVisionScanStore((s) => s.setDraft)

  const onCapture = useCallback(async () => {
    if (!cameraRef.current || !cameraReady || busy) return
    setBusy(true)
    try {
      const allowed = await canUserScan()
      if (!allowed) {
        const purchased = await showPaywall()
        if (!purchased) {
          Alert.alert('Scans', 'You need an available scan or Premium to identify this product.')
          return
        }
      }

      const photo = await cameraRef.current.takePictureAsync({ quality: 0.85, base64: true })
      if (!photo?.uri && !photo?.base64) {
        Alert.alert('Photo failed', 'Could not capture the image. Try again.')
        return
      }

      const result = photo.base64
        ? await identifyProductFromPhotoBase64(photo.base64, 'image/jpeg')
        : await identifyProductFromPhotoUri(photo.uri!)
      if (!result.ok) {
        Alert.alert("Couldn't identify product", result.message, [{ text: 'Try again', style: 'cancel' }])
        return
      }

      setDraft({
        photoUri: photo.uri,
        identification: result.identification,
        fallbackBarcode: typeof fallbackBarcode === 'string' ? fallbackBarcode.trim() : undefined,
      })

      if (!visionMeetsConfidenceThreshold(result.identification)) {
        Alert.alert(
          "Couldn't identify product",
          "We couldn't read a clear product name from that photo. Try better lighting and move closer to the label.",
          [{ text: 'Try again', style: 'cancel' }]
        )
        return
      }

      router.push('/vision-confirm')
    } catch (err) {
      console.warn('[Fillr] vision capture failed', err)
      Alert.alert('Something went wrong', 'Try taking another photo.', [{ text: 'Try again', style: 'cancel' }])
    } finally {
      setBusy(false)
    }
  }, [busy, cameraReady, fallbackBarcode, setDraft])

  if (!permission) {
    return (
      <SafeAreaView style={styles.root}>
        <ActivityIndicator color="#0f766e" />
      </SafeAreaView>
    )
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.permissionCard}>
          <Ionicons name="camera-outline" size={40} color="#0f766e" />
          <Text style={styles.permissionTitle}>Camera access needed</Text>
          <Text style={styles.permissionBody}>
            Fillr needs the camera to photograph the front of the package.
          </Text>
          <Pressable
            style={styles.primaryBtn}
            onPress={() => {
              if (permission.canAskAgain) {
                void requestPermission()
              } else {
                void Linking.openSettings()
              }
            }}
          >
            <Text style={styles.primaryBtnText}>
              {permission.canAskAgain ? 'Allow camera' : 'Open settings'}
            </Text>
          </Pressable>
          <Pressable onPress={() => exitVisionFlowToHome()} style={styles.ghostBtn}>
            <Text style={styles.ghostBtnText}>Go back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <View style={styles.root}>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing="back"
        onCameraReady={() => setCameraReady(true)}
      />
      <SafeAreaView style={styles.overlay} edges={['top', 'bottom']}>
        <View style={[styles.topBar, { paddingTop: insets.top > 0 ? 4 : 12 }]}>
          <Pressable onPress={() => exitVisionFlowToHome()} hitSlop={12} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </Pressable>
          <Text style={styles.topTitle}>Identify product</Text>
          <View style={styles.backBtn} />
        </View>

        <View style={styles.centerHint}>
          <Text style={styles.hintTitle}>Point at the front of the package</Text>
          <Text style={styles.hintBody}>Include the product name and brand in the frame.</Text>
        </View>

        <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <Pressable
            onPress={() => void onCapture()}
            disabled={!cameraReady || busy}
            style={({ pressed }) => [
              styles.shutterOuter,
              (pressed || busy) && { opacity: 0.88 },
              (!cameraReady || busy) && { opacity: 0.5 },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Take product photo"
          >
            <View style={styles.shutterInner} />
          </Pressable>
        </View>
      </SafeAreaView>

      <Modal visible={busy} transparent animationType="fade">
        <View style={styles.loadingRoot}>
          <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color="#0f766e" />
            <Text style={styles.loadingTitle}>Identifying product…</Text>
            <Text style={styles.loadingBody}>Reading the package with GPT-4o vision.</Text>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  overlay: { flex: 1, justifyContent: 'space-between' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  topTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  centerHint: {
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.45)',
    maxWidth: 320,
  },
  hintTitle: { color: '#fff', fontSize: 17, fontWeight: '800', textAlign: 'center' },
  hintBody: {
    marginTop: 6,
    color: 'rgba(255,255,255,0.88)',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  bottomBar: { alignItems: 'center', gap: 14, paddingHorizontal: 20 },
  shutterOuter: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 4,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: '#fff',
  },
  permissionCard: {
    flex: 1,
    margin: 24,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  permissionTitle: { fontSize: 20, fontWeight: '800', color: '#111' },
  permissionBody: { fontSize: 15, lineHeight: 22, color: '#475569', textAlign: 'center' },
  primaryBtn: {
    marginTop: 8,
    backgroundColor: '#0f766e',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  ghostBtn: { padding: 12 },
  ghostBtnText: { color: '#64748b', fontWeight: '600' },
  loadingRoot: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingCard: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    gap: 10,
  },
  loadingTitle: { fontSize: 17, fontWeight: '800', color: '#111' },
  loadingBody: { fontSize: 14, lineHeight: 20, color: '#64748b', textAlign: 'center' },
})
