import { View, Text, StyleSheet, ScrollView, Switch, Pressable } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { GradientBackground } from '../components'
import { colors, spacing, typography } from '../constants/theme'
import { useUserStore } from '../store/userStore'

export default function NotificationsSettingsScreen() {
  const notifyAllergenAlerts = useUserStore((s) => s.notifyAllergenAlerts)
  const notifyWeeklyDigest = useUserStore((s) => s.notifyWeeklyDigest)
  const notifyProductTips = useUserStore((s) => s.notifyProductTips)
  const setNotificationPrefs = useUserStore((s) => s.setNotificationPrefs)

  return (
    <GradientBackground variant="home">
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.back, pressed && { opacity: 0.7 }]}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
            <Text style={styles.backText}>Back</Text>
          </Pressable>
          <Text style={styles.title}>Notifications</Text>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.intro}>
            Choose what Fillr can notify you about. Delivery depends on your device settings and future email/push
            support.
          </Text>

          <View style={styles.card}>
            <View style={styles.row}>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>Allergen alerts</Text>
                <Text style={styles.rowSub}>When a scan matches something you avoid</Text>
              </View>
              <Switch
                value={notifyAllergenAlerts}
                onValueChange={(v) => setNotificationPrefs({ notifyAllergenAlerts: v })}
                trackColor={{ false: '#d1d5db', true: colors.accentMuted }}
                thumbColor={notifyAllergenAlerts ? colors.accent : '#f4f4f5'}
              />
            </View>
            <View style={styles.divider} />
            <View style={styles.row}>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>Weekly digest</Text>
                <Text style={styles.rowSub}>Summary of your scans and trends</Text>
              </View>
              <Switch
                value={notifyWeeklyDigest}
                onValueChange={(v) => setNotificationPrefs({ notifyWeeklyDigest: v })}
                trackColor={{ false: '#d1d5db', true: colors.accentMuted }}
                thumbColor={notifyWeeklyDigest ? colors.accent : '#f4f4f5'}
              />
            </View>
            <View style={styles.divider} />
            <View style={styles.row}>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>Tips & updates</Text>
                <Text style={styles.rowSub}>Product news and how to get more from Fillr</Text>
              </View>
              <Switch
                value={notifyProductTips}
                onValueChange={(v) => setNotificationPrefs({ notifyProductTips: v })}
                trackColor={{ false: '#d1d5db', true: colors.accentMuted }}
                thumbColor={notifyProductTips ? colors.accent : '#f4f4f5'}
              />
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </GradientBackground>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
  },
  back: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', marginBottom: spacing.md },
  backText: { ...typography.body, marginLeft: 2, color: colors.text },
  title: { ...typography.h1, color: colors.text },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.xxxl * 2,
  },
  intro: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: spacing.xl,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.06)',
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    gap: spacing.lg,
  },
  rowText: { flex: 1, minWidth: 0 },
  rowTitle: { ...typography.label, fontSize: 16, color: colors.text, marginBottom: 4 },
  rowSub: { ...typography.bodySmall, color: colors.textMuted, lineHeight: 18 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(15,23,42,0.08)', marginLeft: spacing.lg },
})
