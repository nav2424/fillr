import { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Linking,
  Pressable,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { FillrButton } from '../../components'
import { TERMS_OF_SERVICE_URL } from '../../constants/legalUrls'
import {
  HEALTH_DISCLAIMER_ONBOARDING_PREFIX,
  HEALTH_DISCLAIMER_ONBOARDING_SUFFIX,
} from '../../constants/healthDisclaimer'
import { setDisclaimerAcknowledged } from '../../lib/disclaimerStorage'
import { recordDisclaimerAcknowledgment } from '../../lib/userAcknowledgments'
import { useAuthStore } from '../../store/authStore'

const BG = '#f8fdf9'

export default function DisclaimerAcknowledgmentScreen() {
  const { next } = useLocalSearchParams<{ next?: string | string[] }>()
  const nextRoute = Array.isArray(next) ? next[0] : next
  const userId = useAuthStore((s) => s.userId)
  const [submitting, setSubmitting] = useState(false)

  const onContinue = () => {
    if (submitting) return
    void (async () => {
      setSubmitting(true)
      try {
        if (userId) {
          try {
            await recordDisclaimerAcknowledgment(userId)
          } catch (e) {
            console.warn('[Fillr] Could not save acknowledgment to server', e)
          }
        }
        await setDisclaimerAcknowledged()
        const dest = nextRoute === 'referral-success' ? '/referral-success' : '/(tabs)'
        router.replace(dest)
      } finally {
        setSubmitting(false)
      }
    })()
  }

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.iconWrap}>
            <Ionicons name="information-circle" size={48} color="#0ea5e9" />
          </View>
          <Text style={styles.title}>Before you start</Text>

          <View style={styles.row}>
            <Text style={styles.rowEmoji}>🗄️</Text>
            <Text style={styles.rowText}>
              Ingredient data comes from food databases that may occasionally be incomplete or
              outdated. We&apos;re always improving coverage.
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowEmoji}>🔬</Text>
            <Text style={styles.rowText}>
              Ingredient ratings and allergen highlights reflect general food-science context—not
              personalized medical advice or a guarantee of safety for you.
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowEmoji}>🏷️</Text>
            <Text style={styles.rowText}>
              Always read the physical label and manufacturer allergen statements yourself—especially
              for serious allergies, celiac disease, or other medical conditions.
            </Text>
          </View>

          <View style={styles.divider} />

          <Text style={styles.disclaimer}>
            {HEALTH_DISCLAIMER_ONBOARDING_PREFIX}
            {HEALTH_DISCLAIMER_ONBOARDING_SUFFIX}
            <Text
              style={styles.link}
              onPress={() => {
                void Linking.openURL(TERMS_OF_SERVICE_URL)
              }}
            >
              Terms of Service
            </Text>
            .
          </Text>
        </ScrollView>

        <View style={styles.footer}>
          <FillrButton
            title={submitting ? 'Continuing…' : "I understand — let's go"}
            onPress={onContinue}
            disabled={submitting}
            fullWidth
          />
        </View>
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BG,
  },
  safe: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 24,
  },
  iconWrap: {
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0a0a0a',
    textAlign: 'center',
    marginBottom: 28,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 18,
  },
  rowEmoji: {
    fontSize: 20,
    marginTop: 2,
  },
  rowText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    color: '#374151',
  },
  divider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 20,
  },
  disclaimer: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 18,
  },
  link: {
    color: '#16a34a',
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
})
