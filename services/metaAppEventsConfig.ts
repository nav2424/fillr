type MetaAppEventsEnv = Record<string, string | undefined>

export function hasMetaAppEventsConfig(env: MetaAppEventsEnv = process.env): boolean {
  return Boolean(
    env.EXPO_PUBLIC_FACEBOOK_APP_ID?.trim() &&
      env.EXPO_PUBLIC_FACEBOOK_CLIENT_TOKEN?.trim()
  )
}
