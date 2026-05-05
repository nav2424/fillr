import { useLayoutEffect } from 'react'
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { Stack, router, useNavigation } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { GradientBackground, FillrButton, StackBackButton } from '../components'
import { colors, spacing, typography } from '../constants/theme'
import { useAuthStore } from '../store/authStore'
import { useUserStore } from '../store/userStore'
import { useScanHistoryStore } from '../store/scanHistoryStore'
import { clearDisclaimerKeysOnSignOut } from '../lib/disclaimerStorage'
import { clearPendingSignupAfterOnboarding } from '../lib/pendingSignup'
import { signOutSupabase } from '../lib/authService'
import { logOutOfRevenueCat } from '../services/revenuecatService'

const LIGHT_GREEN = colors.backgroundLightGreen

const screenOptions = {
  title: 'Delete account',
  headerShown: true,
  headerStyle: { backgroundColor: LIGHT_GREEN },
  headerShadowVisible: false,
  headerTintColor: colors.text,
  headerTitleStyle: { fontWeight: '700' as const, color: colors.text },
  headerBackVisible: false,
  headerLeft: () => <StackBackButton />,
}

export default function DeleteAccountScreen() {
  const navigation = useNavigation()
  const insets = useSafeAreaInsets()
  const signOut = useAuthStore((s) => s.signOut)

  useLayoutEffect(() => {
    navigation.setOptions(screenOptions)
  }, [navigation])

  const performDelete = () => {
    void (async () => {
      await clearDisclaimerKeysOnSignOut()
      await clearPendingSignupAfterOnboarding()
      await logOutOfRevenueCat()
      void signOutSupabase()
      useScanHistoryStore.getState().clearAll()
      useUserStore.getState().resetForAccountDeletion()
      signOut()
      router.replace('/welcome')
    })()
  }

  const onDeletePress = () => {
    Alert.alert(
      'Delete this account?',
      'This removes your profile, scan history, and saved products from this device. If you use cloud sign-in, you may also need to delete data from your provider or contact support.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () =>
            Alert.alert('Are you sure?', 'This cannot be undone on this device.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Delete forever', style: 'destructive', onPress: performDelete },
            ]),
        },
      ]
    )
  }

  return (
    <>
      <Stack.Screen options={screenOptions} />
      <GradientBackground variant="home">
        <SafeAreaView style={styles.screen} edges={['bottom']}>
          <ScrollView
            contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + spacing.xxl }]}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.warnIcon}>
              <Ionicons name="warning" size={32} color={colors.danger} />
            </View>
            <Text style={styles.title}>Delete your Fillr account</Text>
            <Text style={styles.body}>
              You will be signed out and all local Fillr data on this device will be erased: preferences,
              allergies, scan history, and saved products.
            </Text>
            <Text style={styles.body}>
              Subscription billing is not live yet. When it is, cancel renewal in the App Store or Google
              Play if you had an active plan.
            </Text>

            <FillrButton title="Delete my account" onPress={onDeletePress} variant="danger" fullWidth />
          </ScrollView>
        </SafeAreaView>
      </GradientBackground>
    </>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: {
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.xl,
  },
  warnIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: colors.dangerMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.3,
    marginBottom: spacing.md,
  },
  body: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
})
