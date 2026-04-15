import { useLocalSearchParams, router } from 'expo-router'
import { View, Text, StyleSheet, Pressable } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { HEALTH_DISCLAIMER_MICRO } from '../../constants/healthDisclaimer'
import { colors, spacing, typography } from '../../constants/theme'

export default function ProductErrorScreen() {
  const { error, reason, productName } = useLocalSearchParams<{
    error?: string
    reason?: 'not_found' | 'insufficient_data'
    productName?: string
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
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.message}>{message}</Text>

        <View style={styles.card}>
          <Pressable
            onPress={() => router.push('/ocr-scanner')}
            style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.92 }]}
          >
            <Text style={styles.primaryBtnText}>📷 Photo the ingredients label</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push('/manual-ingredients')}
            style={({ pressed }) => [styles.secondaryBtn, pressed && { opacity: 0.92 }]}
          >
            <Text style={styles.secondaryBtnText}>✏️ Type ingredients manually</Text>
          </Pressable>
        </View>

        <Text style={styles.disclaimer}>{HEALTH_DISCLAIMER_MICRO}</Text>
      </View>

      <View style={styles.buttons}>
        <Pressable
          onPress={() => router.replace('/(tabs)')}
          style={({ pressed }) => [styles.ghostBtn, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.ghostBtnText}>Home</Text>
        </Pressable>
        <Pressable
          onPress={() => router.replace('/(tabs)/scan')}
          style={({ pressed }) => [styles.scanAgain, pressed && { opacity: 0.92 }]}
        >
          <Text style={styles.scanAgainText}>Scan another barcode</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.xxl,
    justifyContent: 'space-between',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  buttons: {
    gap: spacing.md,
  },
  title: {
    ...typography.h1,
    color: colors.text,
    marginBottom: spacing.md,
  },
  message: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
  },
  card: {
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  primaryBtn: {
    backgroundColor: colors.accent,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 100,
    alignItems: 'center',
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  secondaryBtn: {
    backgroundColor: '#ffffff',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 100,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#d1d5db',
  },
  secondaryBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  disclaimer: {
    ...typography.bodySmall,
    marginTop: spacing.md,
    color: colors.textMuted,
    lineHeight: 18,
  },
  ghostBtn: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  ghostBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  scanAgain: {
    backgroundColor: colors.accent,
    paddingVertical: 16,
    borderRadius: 100,
    alignItems: 'center',
  },
  scanAgainText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
})
