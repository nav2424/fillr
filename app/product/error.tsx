import { useLocalSearchParams, router } from 'expo-router'
import { View, Text, StyleSheet, Pressable } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import { HEALTH_DISCLAIMER_MICRO } from '../../constants/healthDisclaimer'
import { spacing, typography } from '../../constants/theme'

export default function ProductErrorScreen() {
  const { error, reason, productName, barcode } = useLocalSearchParams<{
    error?: string
    reason?: 'not_found' | 'insufficient_data'
    productName?: string
    barcode?: string
  }>()
  const isInsufficientData = reason === 'insufficient_data'
  const title = isInsufficientData
    ? productName?.trim()
      ? `Limited data for ${productName}`
      : 'Limited ingredient data'
    : "Couldn't find this product"
  const message = isInsufficientData
    ? "We found this product but don't have enough ingredient information to give you a reliable analysis. Photograph the ingredients panel for a full decode."
    : error || 'No match in our database for that barcode. You can still decode ingredients from the package.'

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.illustrationWrap}>
          <View style={styles.illustrationCircle}>
            <View style={styles.packIconWrap}>
              <Ionicons name="barcode-outline" size={58} color="#4b5563" />
            </View>
            <View style={styles.searchIconWrap}>
              <Ionicons name="search" size={28} color="#111111" />
            </View>
          </View>
        </View>

        <Text style={styles.title}>{title}</Text>
        <Text style={styles.message}>{message}</Text>

        <Pressable
          onPress={() =>
            router.push({
              pathname: '/ocr-scanner',
              ...(typeof barcode === 'string' && barcode.trim() ? { params: { barcode } } : {}),
            })
          }
          style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
        >
          <Ionicons name="camera-outline" size={20} color="#ffffff" />
          <Text style={styles.primaryBtnText}>Photo ingredients label</Text>
        </Pressable>

        <View style={styles.disclaimerCard}>
          <View style={styles.disclaimerIconWrap}>
            <Ionicons name="shield-checkmark-outline" size={22} color="#4b5563" />
          </View>
          <View style={styles.disclaimerTextBlock}>
            <Text style={styles.disclaimerTitle}>Your health comes first</Text>
            <Text style={styles.disclaimer}>{HEALTH_DISCLAIMER_MICRO}</Text>
          </View>
        </View>
      </View>

      <View style={styles.buttons}>
        <Pressable
          onPress={() => router.replace('/(tabs)')}
          style={({ pressed }) => [styles.ghostBtn, pressed && styles.pressed]}
        >
          <View style={styles.homeIconWrap}>
            <Ionicons name="home-outline" size={18} color="#6b7280" />
          </View>
          <Text style={styles.ghostBtnText}>Home</Text>
        </Pressable>
        <Pressable
          onPress={() => router.replace('/(tabs)/scan')}
          style={({ pressed }) => [styles.scanAgain, pressed && styles.pressed]}
        >
          <Ionicons name="scan-outline" size={18} color="#111111" />
          <Text style={styles.scanAgainText}>Scan another barcode</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f7',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    justifyContent: 'space-between',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  illustrationWrap: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  illustrationCircle: {
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: '#eaf4ed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  packIconWrap: {
    width: 92,
    height: 92,
    borderRadius: 24,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  searchIconWrap: {
    position: 'absolute',
    right: 32,
    bottom: 32,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#d9efe0',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#b9dfc8',
  },
  buttons: {
    gap: spacing.lg,
  },
  title: {
    ...typography.h2,
    color: '#111111',
    marginBottom: spacing.md,
    fontWeight: '700',
    letterSpacing: -0.2,
    textAlign: 'center',
  },
  message: {
    ...typography.bodySmall,
    color: '#636366',
    marginBottom: spacing.xl,
    lineHeight: 21,
    textAlign: 'center',
  },
  primaryBtn: {
    backgroundColor: '#1d9b52',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
    marginBottom: spacing.lg,
    justifyContent: 'center',
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  disclaimerCard: {
    backgroundColor: '#e7f2ec',
    borderRadius: 18,
    padding: spacing.lg,
    flexDirection: 'row',
    gap: spacing.md,
  },
  disclaimerIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#d8ebe1',
  },
  disclaimerTextBlock: {
    flex: 1,
  },
  disclaimerTitle: {
    ...typography.label,
    color: '#1f6f48',
    marginBottom: 4,
  },
  disclaimer: {
    ...typography.bodySmall,
    color: '#335e49',
    lineHeight: 19,
  },
  ghostBtn: {
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: 'transparent',
    gap: 6,
  },
  homeIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e7f2ec',
  },
  ghostBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1f2937',
  },
  scanAgain: {
    backgroundColor: '#ffffff',
    paddingVertical: 15,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: '#1d9b52',
  },
  scanAgainText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1d9b52',
  },
  pressed: {
    opacity: 0.82,
  },
})
