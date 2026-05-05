/** Public site hostname (no scheme) — share footers, short marketing copy. */
export const FILLR_WEB_HOST = 'usefillr.com'

/** Canonical marketing origin (www) — referrals, server-side expectations. */
export const FILLR_WEB_ORIGIN = 'https://www.usefillr.com'

/** Override with EXPO_PUBLIC_TERMS_URL / EXPO_PUBLIC_PRIVACY_URL in .env if needed. */
export const TERMS_OF_SERVICE_URL =
  process.env.EXPO_PUBLIC_TERMS_URL ?? 'https://www.usefillr.com/terms.html'

export const PRIVACY_POLICY_URL =
  process.env.EXPO_PUBLIC_PRIVACY_URL ?? 'https://www.usefillr.com/privacy.html'
