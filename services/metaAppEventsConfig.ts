type MetaAppEventsEnv = {
  EXPO_PUBLIC_FACEBOOK_APP_ID?: string
  EXPO_PUBLIC_FACEBOOK_CLIENT_TOKEN?: string
}

export function isMetaAppEventsConfigured(env: MetaAppEventsEnv = process.env): boolean {
  return Boolean(
    env.EXPO_PUBLIC_FACEBOOK_APP_ID?.trim() &&
      env.EXPO_PUBLIC_FACEBOOK_CLIENT_TOKEN?.trim(),
  )
}
