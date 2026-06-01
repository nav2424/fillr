import { useEffect, useLayoutEffect, useState } from 'react'
import { View, Text, StyleSheet, ScrollView, Alert, Pressable, Linking, Platform } from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { Stack, router, useNavigation } from 'expo-router'
import Purchases, { PACKAGE_TYPE, PurchasesPackage } from 'react-native-purchases'
import Constants from 'expo-constants'
import { Ionicons } from '@expo/vector-icons'
import { GradientBackground, FillrButton } from '../components'
import { colors, spacing, typography, radius } from '../constants/theme'
import { FREE_SCAN_LIMIT, REFERRAL_REFERRER_BONUS } from '../constants/subscription'
import { useUserStore } from '../store/userStore'
import { showPaywall } from '../services/paywallService'
import {
  isRevenueCatConfigured,
  restorePurchases,
  syncPremiumStatusFromRevenueCat,
} from '../services/revenuecatService'
import { updatePremiumStatus } from '../store/scanStore'

const LIGHT_GREEN = colors.backgroundLightGreen
const PRIVACY_URL = 'https://usefillr.com/privacy'
const TERMS_URL = 'https://usefillr.com/terms'

type SubscriptionOption = {
  identifier: string
  length: string
  price: string
  package: PurchasesPackage
}

const screenOptions = {
  title: 'Subscription',
  headerShown: true,
  headerStyle: { backgroundColor: LIGHT_GREEN },
  headerShadowVisible: false,
  headerTintColor: colors.text,
  headerTitleStyle: { fontWeight: '700' as const, color: colors.text },
  headerBackVisible: true,
  headerBackTitleVisible: false,
  headerBackButtonDisplayMode: 'minimal' as const,
  headerLeft: undefined,
}

export default function ManageSubscriptionScreen() {
  const navigation = useNavigation()
  const insets = useSafeAreaInsets()
  const isPro = useUserStore((s) => s.isPro)
  const [openingPaywall, setOpeningPaywall] = useState(false)
  const [openingOfferCodeSheet, setOpeningOfferCodeSheet] = useState(false)
  const [subscriptionOptions, setSubscriptionOptions] = useState<SubscriptionOption[]>([])
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null)
  const [loadingSubscriptionOptions, setLoadingSubscriptionOptions] = useState(true)
  const used = useUserStore((s) => s.totalScansUsed ?? 0)
  const bonus = useUserStore((s) => s.bonusScansEarned ?? 0)
  const totalAllowance = FREE_SCAN_LIMIT + bonus
  const remaining = Math.max(0, totalAllowance - used)
  const defaultOptionId =
    subscriptionOptions.find((option) => option.length.toLowerCase().includes('annual'))?.identifier ??
    subscriptionOptions[0]?.identifier
  const activeOptionId = selectedOptionId ?? defaultOptionId ?? null
  const selectedOption = subscriptionOptions.find((option) => option.identifier === activeOptionId) ?? null

  useLayoutEffect(() => {
    navigation.setOptions(screenOptions)
  }, [navigation])

  useEffect(() => {
    let cancelled = false

    void (async () => {
      setLoadingSubscriptionOptions(true)
      try {
        const offerings = await Purchases.getOfferings()
        const options =
          offerings.current?.availablePackages
            .filter((pkg) => pkg.product.subscriptionPeriod !== null)
            .map((pkg) => ({
              identifier: pkg.identifier,
              length: getSubscriptionLengthLabel(pkg),
              price: pkg.product.priceString,
              package: pkg,
            })) ?? []
        if (!cancelled) {
          setSubscriptionOptions(options)
          if (options.length > 0) {
            const defaultId =
              options.find((option) => option.length.toLowerCase().includes('annual'))?.identifier ??
              options[0]?.identifier ??
              null
            setSelectedOptionId((current) => current ?? defaultId)
          }
        }
      } catch (e) {
        if (__DEV__) console.log('RevenueCat offerings error:', e)
        if (!cancelled) setSubscriptionOptions([])
      } finally {
        if (!cancelled) setLoadingSubscriptionOptions(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  const onUpgrade = () => {
    if (openingPaywall) return
    void (async () => {
      setOpeningPaywall(true)
      try {
        if (selectedOption) {
          const { customerInfo } = await Purchases.purchasePackage(selectedOption.package)
          const isPremium = customerInfo.entitlements.active.premium !== undefined
          await updatePremiumStatus(isPremium)
          if (isPremium) {
            Alert.alert('You are now Premium', 'Unlimited scans are now active.')
            return
          }
        }
        const purchased = await showPaywall()
        if (purchased) {
          Alert.alert('You are now Premium', 'Unlimited scans are now active.')
          return
        }
        Alert.alert(
          'Unable to complete purchase',
          'Please try again, or tap Restore purchases if you already subscribed.'
        )
      } catch (e) {
        if (__DEV__) console.log('Upgrade purchase error:', e)
        Alert.alert(
          'Unable to complete purchase',
          'Please try again, or tap Restore purchases if you already subscribed.'
        )
      } finally {
        setOpeningPaywall(false)
      }
    })()
  }

  const onRestore = () => {
    void restorePurchases()
  }

  const onRedeemOfferCode = () => {
    if (openingOfferCodeSheet) return
    if (Platform.OS !== 'ios') {
      Alert.alert('iPhone required', 'Offer code redemption is only available on iOS.')
      return
    }
    if (Constants.appOwnership === 'expo') {
      Alert.alert(
        'Unavailable in Expo Go',
        'Offer code redemption requires your TestFlight/App Store build. Open this screen in that build and try again.'
      )
      return
    }
    if (!isRevenueCatConfigured()) {
      Alert.alert('Unavailable', 'Subscriptions are not available in this build.')
      return
    }
    void (async () => {
      setOpeningOfferCodeSheet(true)
      try {
        await Purchases.presentCodeRedemptionSheet()
        await Purchases.syncPurchases()
        await syncPremiumStatusFromRevenueCat()
        const nowPro = useUserStore.getState().isPro
        if (nowPro) {
          Alert.alert('Premium active', 'Your subscription is active. Unlimited scans are on.')
        } else {
          Alert.alert(
            'No Premium yet',
            'If you just redeemed an Apple subscription offer code, wait a few seconds and tap Restore purchases. Codes must be App Store subscription offer codes for Fillr Premium (not TestFlight invite codes or unrelated App Store codes).'
          )
        }
      } catch {
        Alert.alert('Unable to open offer code sheet', 'Please try again from the App Store.')
      } finally {
        setOpeningOfferCodeSheet(false)
      }
    })()
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
            <Text style={styles.eyebrow}>Your plan</Text>
            <View style={styles.heroRow}>
              <View style={styles.heroCopy}>
                <View style={styles.planChip}>
                  <Ionicons name="leaf-outline" size={14} color="#166534" />
                  <Text style={styles.planChipText}>{isPro ? 'Premium active' : 'Free plan'}</Text>
                </View>
                <Text style={styles.title}>{isPro ? 'Fillr Premium' : 'Free'}</Text>
                <Text style={styles.lead}>
                  {isPro
                    ? 'You have unlimited scans and premium breakdowns. Manage renewal in the App Store when billing goes live.'
                    : `Free plan includes ${FREE_SCAN_LIMIT} base scans plus bonus scans from referrals.`}
                </Text>
              </View>
              <View style={styles.heroArtWrap}>
                <View style={styles.heroArtPhone}>
                  <Ionicons name="scan-outline" size={38} color="#168345" />
                </View>
                <View style={styles.heroArtAccent} />
              </View>
            </View>

            {!isPro && (
              <View style={styles.usageCard}>
                <Text style={styles.usageLabel}>Free scans</Text>
                <Text style={styles.usageBig}>
                  {remaining} left
                  <Text style={styles.usageOf}> · {used} used · {bonus} bonus</Text>
                </Text>
                <View style={styles.track}>
                  <View
                    style={[
                      styles.trackFill,
                      {
                        width: `${Math.min(100, (used / Math.max(totalAllowance, 1)) * 100)}%`,
                      },
                    ]}
                  />
                </View>
              </View>
            )}

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Premium includes</Text>
              <View style={styles.bulletRow}>
                <View style={styles.bulletIconWrap}>
                  <Ionicons name="infinite-outline" size={18} color="#1d9b52" />
                </View>
                <Text style={styles.bullet}>Unlimited barcode scans</Text>
              </View>
              <View style={styles.bulletDivider} />
              <View style={styles.bulletRow}>
                <View style={styles.bulletIconWrap}>
                  <Ionicons name="document-text-outline" size={16} color="#1d9b52" />
                </View>
                <Text style={styles.bullet}>Full ingredient breakdowns and Label vs Reality</Text>
              </View>
              <View style={styles.bulletDivider} />
              <View style={styles.bulletRow}>
                <View style={styles.bulletIconWrap}>
                  <Ionicons name="flash-outline" size={16} color="#1d9b52" />
                </View>
                <Text style={styles.bullet}>Priority when we add new data sources</Text>
              </View>
            </View>

            {!isPro && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Fillr Premium</Text>
                {loadingSubscriptionOptions ? (
                  <Text style={styles.optionMuted}>Loading subscription options...</Text>
                ) : subscriptionOptions.length > 0 ? (
                  subscriptionOptions.map((option) => (
                    <Pressable
                      key={option.identifier}
                      onPress={() => setSelectedOptionId(option.identifier)}
                      disabled={openingPaywall}
                      accessibilityRole="button"
                      accessibilityLabel={`Select ${option.length} plan`}
                      accessibilityState={{
                        selected: option.identifier === activeOptionId,
                        disabled: openingPaywall,
                      }}
                      style={({ pressed }) => [
                        styles.subscriptionOptionRow,
                        option.identifier === activeOptionId && styles.subscriptionOptionRowFeatured,
                        pressed && styles.optionPressed,
                      ]}
                    >
                      <View style={styles.subscriptionLeft}>
                        <View
                          style={[
                            styles.radioOuter,
                            option.identifier === activeOptionId && styles.radioOuterFeatured,
                          ]}
                        >
                          {option.identifier === activeOptionId ? <View style={styles.radioInner} /> : null}
                        </View>
                        <View>
                          <Text style={styles.subscriptionOptionLength}>{option.length}</Text>
                          {option.identifier === defaultOptionId ? (
                            <Text style={styles.bestValueText}>Best value</Text>
                          ) : null}
                        </View>
                      </View>
                      <View style={styles.subscriptionPriceWrap}>
                        <Text style={styles.subscriptionOptionPrice}>{option.price}</Text>
                      </View>
                    </Pressable>
                  ))
                ) : (
                  <Text style={styles.optionMuted}>
                    Subscription options are temporarily unavailable.
                  </Text>
                )}
              </View>
            )}

            {!isPro ? (
              <View style={[styles.card, styles.promoCard]}>
                <Text style={styles.promoTitle}>Subscription offer code</Text>
                <Text style={styles.promoHelp}>
                  Apple opens a system sheet — you enter the code there (not in Fillr). Use subscription offer
                  codes created in App Store Connect for Fillr Premium.
                </Text>
                <Pressable
                  onPress={onRedeemOfferCode}
                  disabled={openingOfferCodeSheet}
                  style={({ pressed }) => [
                    styles.offerCodeButton,
                    pressed && { opacity: 0.84, transform: [{ scale: 0.99 }] },
                    openingOfferCodeSheet && { opacity: 0.55 },
                  ]}
                >
                  <Text style={styles.offerCodeButtonText}>
                    {openingOfferCodeSheet ? 'Opening…' : 'Redeem offer code'}
                  </Text>
                </Pressable>
              </View>
            ) : null}

            {!isPro && (
              <FillrButton
                title={openingPaywall ? 'Opening Premium checkout...' : 'Upgrade to Fillr Premium'}
                onPress={onUpgrade}
                disabled={openingPaywall}
                variant="liquid"
                fullWidth
                style={styles.cta}
              />
            )}
            {!isPro && (
              <>
                <View style={styles.orRow}>
                  <View style={styles.orLine} />
                  <Text style={styles.orText}>or</Text>
                  <View style={styles.orLine} />
                </View>
                <Pressable
                  onPress={() => router.replace('/(tabs)/profile')}
                  style={({ pressed }) => [styles.referralNudge, pressed && { opacity: 0.85 }]}
                >
                  <Text style={styles.referralNudgeText}>
                    Invite a friend instead — earn {REFERRAL_REFERRER_BONUS} free scans →
                  </Text>
                </Pressable>
              </>
            )}
            <View style={styles.legalLinks}>
              <Pressable
                onPress={() => void Linking.openURL(PRIVACY_URL)}
                hitSlop={8}
                accessibilityRole="link"
                accessibilityLabel="Privacy Policy"
              >
                <Text style={styles.legalLinkText}>Privacy Policy</Text>
              </Pressable>
              <Text style={styles.legalSeparator}>•</Text>
              <Pressable
                onPress={() => void Linking.openURL(TERMS_URL)}
                hitSlop={8}
                accessibilityRole="link"
                accessibilityLabel="Terms of Use"
              >
                <Text style={styles.legalLinkText}>Terms of Use</Text>
              </Pressable>
            </View>
            <FillrButton title="Restore purchases" onPress={onRestore} variant="secondary" fullWidth />
          </ScrollView>
        </SafeAreaView>
      </GradientBackground>
    </>
  )
}

function getSubscriptionLengthLabel(pkg: PurchasesPackage): string {
  switch (pkg.packageType) {
    case PACKAGE_TYPE.WEEKLY:
      return 'Weekly'
    case PACKAGE_TYPE.MONTHLY:
      return 'Monthly'
    case PACKAGE_TYPE.TWO_MONTH:
      return '2 months'
    case PACKAGE_TYPE.THREE_MONTH:
      return '3 months'
    case PACKAGE_TYPE.SIX_MONTH:
      return '6 months'
    case PACKAGE_TYPE.ANNUAL:
      return 'Annual'
    default:
      return formatSubscriptionPeriod(pkg.product.subscriptionPeriod) ?? pkg.product.title
  }
}

function formatSubscriptionPeriod(period: string | null): string | null {
  if (!period) return null
  const match = /^P(\d+)?([DWMY])$/.exec(period)
  if (!match) return period
  const count = Number(match[1] ?? '1')
  const periodUnit = match[2]
  const unitLabel =
    periodUnit === 'D'
      ? 'day'
      : periodUnit === 'W'
        ? 'week'
        : periodUnit === 'M'
          ? 'month'
          : 'year'
  if (count === 1) {
    return unitLabel === 'year' ? 'Annual' : unitLabel[0].toUpperCase() + unitLabel.slice(1) + 'ly'
  }
  return `${count} ${unitLabel}s`
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: {
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.lg,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xl,
    gap: spacing.md,
  },
  heroCopy: {
    flex: 1,
  },
  heroArtWrap: {
    width: 132,
    height: 132,
    borderRadius: 26,
    backgroundColor: 'rgba(220,252,231,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroArtPhone: {
    width: 74,
    height: 98,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(22,131,69,0.16)',
    transform: [{ rotate: '10deg' }],
    shadowColor: '#166534',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  heroArtAccent: {
    position: 'absolute',
    right: 14,
    bottom: 16,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(22,131,69,0.2)',
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  planChip: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(34,197,94,0.12)',
    borderColor: 'rgba(34,197,94,0.26)',
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  planChipText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
    color: '#166534',
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.8,
    marginBottom: spacing.sm,
  },
  lead: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 24,
    marginBottom: 0,
  },
  usageCard: {
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.06)',
    marginBottom: spacing.xl,
    shadowColor: '#0f172a',
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  usageLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: spacing.xs,
  },
  usageBig: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  usageOf: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  track: {
    height: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(15,23,42,0.08)',
    overflow: 'hidden',
  },
  trackFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: colors.accent,
    minWidth: 4,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.06)',
    marginBottom: spacing.xl,
    shadowColor: '#0f172a',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 1,
  },
  promoCard: {
    paddingBottom: spacing.lg,
  },
  promoTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  promoHelp: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  offerCodeButton: {
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(22,131,69,0.25)',
    backgroundColor: 'rgba(22,131,69,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  offerCodeButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1d9b52',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.md,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  bulletIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(34,197,94,0.12)',
  },
  bulletDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(15,23,42,0.09)',
    marginBottom: spacing.sm,
    marginLeft: 46,
  },
  subscriptionOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    backgroundColor: '#ffffff',
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.09)',
  },
  subscriptionOptionRowFeatured: {
    borderColor: 'rgba(22,131,69,0.55)',
    backgroundColor: 'rgba(240,253,244,0.85)',
  },
  optionPressed: {
    opacity: 0.86,
    transform: [{ scale: 0.995 }],
  },
  subscriptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: 'rgba(15,23,42,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  radioOuterFeatured: {
    borderColor: '#1d9b52',
  },
  radioInner: {
    width: 11,
    height: 11,
    borderRadius: 999,
    backgroundColor: '#1d9b52',
  },
  subscriptionPriceWrap: {
    alignItems: 'flex-end',
  },
  subscriptionOptionLength: {
    fontSize: 15,
    color: colors.text,
    fontWeight: '700',
  },
  subscriptionOptionPrice: {
    fontSize: 15,
    color: colors.text,
    fontWeight: '700',
  },
  bestValueText: {
    marginTop: 1,
    fontSize: 12,
    color: '#1d9b52',
    fontWeight: '600',
  },
  optionMuted: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  bullet: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textSecondary,
    lineHeight: 22,
    flex: 1,
  },
  cta: {
    marginBottom: spacing.md,
    shadowColor: '#16a34a',
    shadowOpacity: 0.25,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  orRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    marginTop: spacing.xs,
  },
  orLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(15,23,42,0.16)',
  },
  orText: {
    marginHorizontal: spacing.md,
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  referralNudge: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
  },
  referralNudgeText: {
    fontSize: 14,
    color: '#16a34a',
    fontWeight: '600',
  },
  legalLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  legalLinkText: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  legalSeparator: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '700',
  },
})
