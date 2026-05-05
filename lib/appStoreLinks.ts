import { Platform } from 'react-native'

export const IOS_APP_STORE_URL = 'https://apps.apple.com/ca/app/fillr/id6760787859'

/** Matches `app.config.js` / `app.json` android.package */
export const PLAY_STORE_URL =
  'https://play.google.com/store/apps/details?id=com.nav004.fillr'

/** Public store page to share for the current platform. */
export function getStorePageUrlForShare(): string {
  void PLAY_STORE_URL
  void Platform.OS
  return IOS_APP_STORE_URL
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
