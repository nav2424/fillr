import { Platform } from 'react-native'

/** Matches `app.config.js` / `app.json` android.package */
export const PLAY_STORE_URL =
  'https://play.google.com/store/apps/details?id=com.nav004.fillr'

/**
 * App Store product page. Set `EXPO_PUBLIC_IOS_APP_STORE_URL` when the app is live
 * (e.g. https://apps.apple.com/app/fillr/id1234567890).
 * If unset on iOS, we fall back to an App Store search so the share sheet still opens a useful link.
 */
const IOS_FALLBACK_SEARCH =
  'https://apps.apple.com/search?term=Fillr%20ingredient%20scanner'

function getIosAppStoreUrl(): string {
  const u = process.env.EXPO_PUBLIC_IOS_APP_STORE_URL
  return typeof u === 'string' && u.trim().startsWith('http') ? u.trim() : ''
}

/** Public store page to share for the current platform. */
export function getStorePageUrlForShare(): string {
  if (Platform.OS === 'android') return PLAY_STORE_URL
  return getIosAppStoreUrl() || IOS_FALLBACK_SEARCH
}

/** Content for React Native `Share.share`. */
export function getFillrAppShareContent(): { message: string; url?: string } {
  const link = getStorePageUrlForShare()
  const teaser =
    'Try Fillr — scan a barcode and see how the ingredients line up with your allergies and preferences.'
  if (Platform.OS === 'ios') {
    return { message: `${teaser}\n\n${link}`, url: link }
  }
  return { message: `${teaser}\n\n${link}` }
}
