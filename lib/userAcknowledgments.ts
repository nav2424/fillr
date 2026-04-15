import { Platform } from 'react-native'
import * as Application from 'expo-application'
import Constants from 'expo-constants'
import { supabase } from './supabase'

const DEFAULT_VERSION = '1.0'

/** True if this user already acknowledged any disclaimer version on the server (new device sync). */
export async function hasServerDisclaimerAcknowledgment(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('user_acknowledgments')
    .select('id')
    .eq('user_id', userId)
    .limit(1)
  if (error) return false
  return Array.isArray(data) && data.length > 0
}

export async function recordDisclaimerAcknowledgment(
  userId: string,
  disclaimerVersion: string = DEFAULT_VERSION
): Promise<void> {
  const platform =
    Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web'
  const appVersion =
    Application.nativeApplicationVersion ??
    Constants.expoConfig?.version ??
    'unknown'

  const { error } = await supabase.from('user_acknowledgments').insert({
    user_id: userId,
    disclaimer_version: disclaimerVersion,
    platform,
    app_version: appVersion,
    acknowledged_at: new Date().toISOString(),
  })

  if (error) {
    // Unique violation: already recorded for this version
    if (error.code === '23505') return
    throw error
  }
}
