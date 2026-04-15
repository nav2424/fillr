/** Public legal URLs — set EXPO_PUBLIC_TERMS_URL / EXPO_PUBLIC_PRIVACY_URL in .env */

export const TERMS_OF_SERVICE_URL =
  process.env.EXPO_PUBLIC_TERMS_URL ?? 'https://fillr.app/terms'

export const PRIVACY_POLICY_URL =
  process.env.EXPO_PUBLIC_PRIVACY_URL ?? 'https://fillr.app/privacy'
