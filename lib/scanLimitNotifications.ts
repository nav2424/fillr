import { Platform } from 'react-native'
import * as Notifications from 'expo-notifications'
import * as Linking from 'expo-linking'

const ONE_SCAN_LEFT_ID = 'fillr-one-scan-left'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
})

export async function ensureNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === 'web') return false
  const existing = await Notifications.getPermissionsAsync()
  if (existing.granted) return true
  const requested = await Notifications.requestPermissionsAsync()
  return requested.granted
}

/** Schedule a local reminder when the user has exactly one free scan left. */
export async function scheduleOneScanLeftNotification(enabled: boolean): Promise<void> {
  if (!enabled || Platform.OS === 'web') return
  const granted = await ensureNotificationPermissions()
  if (!granted) return

  await Notifications.cancelScheduledNotificationAsync(ONE_SCAN_LEFT_ID).catch(() => {})

  const scanUrl = Linking.createURL('/(tabs)/scan')
  await Notifications.scheduleNotificationAsync({
    identifier: ONE_SCAN_LEFT_ID,
    content: {
      title: '1 free scan left on Fillr',
      body: 'Use it before you run out — or upgrade for unlimited decoding.',
      data: { url: scanUrl },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 60 * 60 * 4,
      repeats: false,
    },
  })
}

export async function cancelOneScanLeftNotification(): Promise<void> {
  if (Platform.OS === 'web') return
  await Notifications.cancelScheduledNotificationAsync(ONE_SCAN_LEFT_ID).catch(() => {})
}

/** Deep-link when user taps the notification (call once from root layout). */
export function registerScanLimitNotificationResponseHandler(): () => void {
  if (Platform.OS === 'web') return () => {}

  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    const url = response.notification.request.content.data?.url
    if (typeof url === 'string' && url.length > 0) {
      void Linking.openURL(url)
    }
  })

  return () => sub.remove()
}
