import { useCallback, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { createScanResultFromIngredientText } from '../services/productService'
import { useUserStore } from '../store/userStore'
import { useAuthStore } from '../store/authStore'
import { useScanHistoryStore } from '../store/scanHistoryStore'
import { useCurrentScanStore } from '../store/currentScanStore'
import { canUserScan, incrementScanCount } from '../store/scanStore'
import { showPaywall } from '../services/paywallService'
import { finalizeReferralBonusIfEligible, fetchProfile, incrementScanUsageOnServer } from '../lib/authService'

export default function ManualIngredientsScreen() {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)

  const allergies = useUserStore((s) => s.allergies)
  const sensitivities = useUserStore((s) => s.sensitivities)
  const preferences = useUserStore((s) => s.preferences)
  const goal = useUserStore((s) => s.goal)
  const celiacStrictGluten = useUserStore((s) => s.celiacStrictGluten)
  const userId = useAuthStore((s) => s.userId)
  const setReferralData = useUserStore((s) => s.setReferralData)
  const addScan = useScanHistoryStore((s) => s.addScan)
  const setCurrentScan = useCurrentScanStore((s) => s.setResult)

  const onAnalyze = useCallback(async () => {
    const pasted = text.trim()
    if (pasted.length < 8) {
      Alert.alert('Add ingredients', 'Paste or type the ingredient list from the package.')
      return
    }
    const allowed = await canUserScan()
    if (!allowed) {
      const purchased = await showPaywall()
      if (!purchased) {
        Alert.alert('Scans', 'You need an available scan or Premium to analyze ingredients.')
        return
      }
    }
    setBusy(true)
    try {
      const result = await createScanResultFromIngredientText({
        allergies,
        sensitivities,
        preferences,
        goal,
        celiacStrictGluten,
        ingredientsList: pasted,
        scanSource: 'manual',
      })
      setCurrentScan(result)
      addScan({
        id: `scan_manual_${Date.now()}`,
        productId: result.product.id,
        productName: result.product.name,
        barcode: result.product.barcode,
        safetyStatus: result.safetyStatus,
        date: new Date().toLocaleDateString(),
        result,
        source: 'manual',
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
      router.replace({ pathname: '/product/[id]', params: { id: result.product.id } })
    } catch {
      Alert.alert('Something went wrong', 'Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }, [
    text,
    allergies,
    sensitivities,
    preferences,
    goal,
    celiacStrictGluten,
    userId,
    addScan,
    setCurrentScan,
    setReferralData,
  ])

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backHit}>
            <Ionicons name="chevron-back" size={24} color="#0a0a0a" />
          </Pressable>
          <Text style={styles.headerTitle}>Type ingredients</Text>
          <View style={styles.backHit} />
        </View>
        <Text style={styles.sub}>
          Paste the ingredient list from the package (commas or line breaks are fine).
        </Text>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="e.g. Sugar, enriched flour, palm oil, cocoa…"
          placeholderTextColor="#9ca3af"
          multiline
          textAlignVertical="top"
          editable={!busy}
        />
        <Pressable
          onPress={() => void onAnalyze()}
          disabled={busy}
          style={({ pressed }) => [
            styles.cta,
            pressed && { opacity: 0.92 },
            busy && { opacity: 0.6 },
          ]}
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.ctaText}>Analyze ingredients</Text>
          )}
        </Pressable>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f8fdf9',
  },
  flex: {
    flex: 1,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  backHit: {
    width: 44,
    height: 44,
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0a0a0a',
  },
  sub: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 12,
    lineHeight: 20,
  },
  input: {
    flex: 1,
    minHeight: 200,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 16,
    fontSize: 16,
    color: '#0a0a0a',
    marginBottom: 16,
  },
  cta: {
    height: 52,
    borderRadius: 100,
    backgroundColor: '#22c55e',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  ctaText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
})
