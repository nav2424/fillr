import { View, Text, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { FillrButton } from '../components'
import { REFERRAL_INVITEE_STARTING_SCANS } from '../constants/subscription'
import { colors, spacing } from '../constants/theme'

export default function ReferralSuccessScreen() {
  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.content}>
          <Text style={styles.emoji}>🎉</Text>
          <Text style={styles.title}>You're in!</Text>
          <Text style={styles.subtitle}>Your account is ready</Text>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>🎁 Bonus scans added</Text>
            <Text style={styles.cardBody}>
              You have {REFERRAL_INVITEE_STARTING_SCANS} scans to start with
            </Text>
            <View style={styles.divider} />
            <Text style={styles.referredBy}>Referred by a friend</Text>
          </View>
        </View>

        <FillrButton
          title="Start scanning →"
          onPress={() => router.replace('/')}
          fullWidth
          variant="primary"
        />
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f8fdf9' },
  container: { flex: 1, paddingHorizontal: spacing.xxl, justifyContent: 'space-between' },
  content: { alignItems: 'center', paddingTop: spacing.xxxl * 1.25 },
  emoji: { fontSize: 64, marginBottom: spacing.md },
  title: { fontSize: 28, fontWeight: '800', color: colors.text, marginBottom: 6 },
  subtitle: { fontSize: 15, color: colors.textSecondary, marginBottom: spacing.xxl },
  card: {
    width: '100%',
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 20,
    padding: 20,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 8 },
  cardBody: { fontSize: 14, color: '#6b7280', marginBottom: 14 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: '#bbf7d0', marginBottom: 10 },
  referredBy: { fontSize: 13, color: '#16a34a', fontWeight: '600' },
})

