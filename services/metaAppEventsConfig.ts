export function hasMetaAppEventsConfig(
  appId = process.env.EXPO_PUBLIC_FACEBOOK_APP_ID,
  clientToken = process.env.EXPO_PUBLIC_FACEBOOK_CLIENT_TOKEN
): boolean {
  return Boolean(appId?.trim() && clientToken?.trim())
}
