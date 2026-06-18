import type { User } from '@supabase/supabase-js'
import * as Application from 'expo-application'
import { storage } from './storage'
import { supabase } from './supabase'
import { normalizeReferralCode } from './referrals'

const DEVICE_ID_KEY = 'fillr-device-id'
const REFERRAL_PENDING_KEY = 'fillr-referral-pending'
const TERMINAL_REFERRAL_REASONS = new Set([
  'already_granted',
  'no_referral',
  'self_referral',
  'invalid_referrer',
  'unauthorized',
  'user_not_found',
])

function debugReferralLog(message: string, extra?: Record<string, unknown>): void {
  if (!__DEV__) return
  if (extra) {
    console.log(`[referral] ${message}`, extra)
    return
  }
  console.log(`[referral] ${message}`)
}

export interface ProfileRow {
  id: string
  email: string | null
  full_name: string | null
  onboarding_completed: boolean | null
  referral_code: string | null
  referred_by: string | null
  total_scans_used: number | null
  bonus_scans_earned: number | null
  is_pro: boolean | null
  lifetime_pro: boolean | null
  pro_expiry: string | null
}

function randomSuffix(len = 8): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let out = ''
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)]
  return out
}

export async function getDeviceIdForReferral(): Promise<string> {
  const existing = await storage.getItem(DEVICE_ID_KEY)
  if (existing) return existing
  let appId = ''
  try {
    if (Application.getIosIdForVendorAsync) {
      appId = (await Application.getIosIdForVendorAsync()) ?? ''
    }
  } catch {
    // ignore
  }
  if (!appId) {
    let androidId = ''
    try {
      if (Application.getAndroidId) {
        androidId = (await Application.getAndroidId()) ?? ''
      }
    } catch {
      // ignore
    }
    appId =
      androidId ||
      Application.applicationId ||
      `${Date.now().toString(36)}-${randomSuffix(6)}`
  }
  const id = `dev-${String(appId).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 48)}`
  await storage.setItem(DEVICE_ID_KEY, id)
  return id
}

/** Prefer `profiles.full_name`, then signup metadata (`full_name` / `fullName`). */
export function resolveDisplayFullName(
  profile: ProfileRow | null,
  authUser: User | null | undefined
): string {
  const fromProfile = profile?.full_name?.trim()
  if (fromProfile) return fromProfile
  const m = authUser?.user_metadata as Record<string, unknown> | undefined
  const fromMeta =
    (typeof m?.full_name === 'string' && m.full_name.trim()) ||
    (typeof m?.fullName === 'string' && m.fullName.trim()) ||
    ''
  if (fromMeta) return fromMeta
  return 'User'
}

export async function fetchProfile(userId: string): Promise<ProfileRow | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select(
      'id,email,full_name,onboarding_completed,referral_code,referred_by,total_scans_used,bonus_scans_earned,is_pro,lifetime_pro,pro_expiry'
    )
    .eq('id', userId)
    .single()
  if (error) return null
  return data as ProfileRow
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

/**
 * Load profile after sign-in or session restore: session may not be attached on the first query.
 * Retries, then ensures a profile row exists (referral backfill upsert) and fetches again.
 */
export async function fetchProfileReliable(userId: string): Promise<ProfileRow | null> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (session?.user?.id === userId) {
      const row = await fetchProfile(userId)
      if (row) return row
    }
    if (attempt < 5) await sleep(50 + attempt * 60)
  }
  await ensureReferralCodeForUser(userId)
  return fetchProfile(userId)
}

export async function getCurrentAuthUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser()
  return data.user?.id ?? null
}

function generateReferralCodeCandidate(): string {
  return `FLR-${randomSuffix(4)}`
}

/**
 * Backfill referral code for legacy/migrated users where trigger assignment was missed.
 * Returns the current code after repair attempts, or null if still unavailable.
 */
export async function ensureReferralCodeForUser(userId: string): Promise<string | null> {
  let profile = await fetchProfile(userId)
  if (profile?.referral_code) return normalizeReferralCode(profile.referral_code)

  // If profile row is missing entirely, upsert a minimal one from auth user.
  if (!profile) {
    const { data } = await supabase.auth.getUser()
    const authUser = data.user
    if (authUser?.id === userId) {
      const meta = authUser.user_metadata as Record<string, unknown> | undefined
      const fullName =
        (typeof meta?.full_name === 'string' && meta.full_name.trim()) ||
        (typeof meta?.fullName === 'string' && meta.fullName.trim()) ||
        null
      await supabase.from('profiles').upsert(
        {
          id: userId,
          email: authUser.email ?? null,
          full_name: fullName,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      )
      profile = await fetchProfile(userId)
      if (profile?.referral_code) return normalizeReferralCode(profile.referral_code)
    }
  }

  // Retry on uniqueness collisions.
  for (let i = 0; i < 8; i++) {
    const latestBeforeUpdate = await fetchProfile(userId)
    if (latestBeforeUpdate?.referral_code) return normalizeReferralCode(latestBeforeUpdate.referral_code)
    const candidate = generateReferralCodeCandidate()
    const { error } = await supabase
      .from('profiles')
      .update({ referral_code: candidate, updated_at: new Date().toISOString() })
      .eq('id', userId)
    if (!error) {
      const latest = await fetchProfile(userId)
      if (latest?.referral_code) return normalizeReferralCode(latest.referral_code)
    }
  }

  const latest = await fetchProfile(userId)
  return latest?.referral_code ? normalizeReferralCode(latest.referral_code) : null
}

export async function signUpWithEmail(args: {
  email: string
  password: string
  fullName: string
  referralCode?: string | null
}): Promise<{ userId: string; profile: ProfileRow | null }> {
  const deviceId = await getDeviceIdForReferral()
  const referredBy = args.referralCode ? normalizeReferralCode(args.referralCode) : undefined
  const { data, error } = await supabase.auth.signUp({
    email: args.email.trim(),
    password: args.password,
    options: {
      data: {
        full_name: args.fullName.trim(),
        ...(referredBy ? { referred_by: referredBy } : {}),
        signup_device_id: deviceId,
      },
    },
  })
  if (error) throw error
  const userId = data.user?.id
  if (!userId) throw new Error('Signup succeeded but user is missing')
  const profile = await fetchProfile(userId)
  return { userId, profile }
}

/** Resends the same “Confirm sign up” email as the initial signup (not the Magic Link template). */
export async function sendEmailVerificationCode(email: string): Promise<void> {
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: email.trim(),
  })
  if (error) throw error
}

export async function verifyEmailWithCode(args: {
  email: string
  code: string
}): Promise<{ userId: string; profile: ProfileRow | null; resolvedFullName: string }> {
  const { data, error } = await supabase.auth.verifyOtp({
    email: args.email.trim(),
    token: args.code.trim(),
    type: 'email',
  })
  if (error) throw error
  const userId = data.user?.id
  if (!userId) throw new Error('Verification succeeded but user is missing')
  const profile = await fetchProfile(userId)
  const resolvedFullName = resolveDisplayFullName(profile, data.user)
  return { userId, profile, resolvedFullName }
}

export async function signInWithEmail(args: {
  email: string
  password: string
}): Promise<{
  userId: string
  profile: ProfileRow | null
  resolvedFullName: string
  /** Confirmed in Supabase Auth — returning users always have this after the current signup flow. */
  emailVerified: boolean
}> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: args.email.trim(),
    password: args.password,
  })
  if (error) throw error
  const userId = data.user?.id
  if (!userId) throw new Error('Login succeeded but user is missing')
  const profile = await fetchProfileReliable(userId)
  const resolvedFullName = resolveDisplayFullName(profile, data.user)
  const emailVerified = Boolean(data.user?.email_confirmed_at)
  return { userId, profile, resolvedFullName, emailVerified }
}

export async function signOutSupabase(): Promise<void> {
  await supabase.auth.signOut()
}

export async function setOnboardingCompletedOnServer(userId: string): Promise<void> {
  await supabase
    .from('profiles')
    .update({ onboarding_completed: true, updated_at: new Date().toISOString() })
    .eq('id', userId)
}

export async function incrementScanUsageOnServer(userId: string): Promise<void> {
  const currentUserId = await getCurrentAuthUserId()
  if (currentUserId !== userId) return
  await supabase.rpc('increment_my_scan_usage')
}

export async function setReferralFinalizationPending(pending: boolean): Promise<void> {
  if (pending) {
    await storage.setItem(REFERRAL_PENDING_KEY, 'true')
    debugReferralLog('pending flag set', { key: REFERRAL_PENDING_KEY })
    return
  }
  await storage.removeItem(REFERRAL_PENDING_KEY)
  debugReferralLog('pending flag cleared', { key: REFERRAL_PENDING_KEY })
}

export async function getReferralFinalizationPending(): Promise<boolean> {
  const val = await storage.getItem(REFERRAL_PENDING_KEY)
  return val === 'true'
}

export async function finalizeReferralBonusIfEligible(userId: string): Promise<void> {
  debugReferralLog('finalize attempt started', { userId })
  try {
    const { data, error } = await supabase.rpc('finalize_referral_bonus', {
      target_user_id: userId,
    })

    if (error) {
      debugReferralLog('rpc error; scheduling retry', { userId, error: error.message })
      await setReferralFinalizationPending(true)
      return
    }

    const row = Array.isArray(data) ? (data[0] as { granted?: boolean; reason?: string } | undefined) : undefined
    if (!row) {
      debugReferralLog('empty rpc response; leaving pending as-is', { userId })
      return
    }

    if (row.granted) {
      debugReferralLog('bonus granted; clearing pending', { userId })
      await setReferralFinalizationPending(false)
      return
    }

    if (row.reason && TERMINAL_REFERRAL_REASONS.has(row.reason)) {
      debugReferralLog('terminal reason; clearing pending', { userId, reason: row.reason })
      await setReferralFinalizationPending(false)
      return
    }

    debugReferralLog('non-terminal reason; scheduling retry', { userId, reason: row.reason ?? 'unknown' })
    await setReferralFinalizationPending(true)
  } catch {
    debugReferralLog('exception during finalize; scheduling retry', { userId })
    await setReferralFinalizationPending(true)
  }
}

export async function getReferralStatsForCode(referralCode: string): Promise<{
  convertedCount: number
}> {
  const normalized = normalizeReferralCode(referralCode)
  const { data, error } = await supabase.rpc('get_my_referral_stats')
  if (error || !Array.isArray(data) || data.length === 0) return { convertedCount: 0 }
  const row = data[0] as {
    referral_code?: string | null
    referrals_joined?: number | null
  }
  if ((row.referral_code ?? '') !== normalized) return { convertedCount: 0 }
  return { convertedCount: row.referrals_joined ?? 0 }
}

export async function validateReferralCodeOnServer(code: string): Promise<boolean> {
  const normalized = normalizeReferralCode(code)
  const { data, error } = await supabase.rpc('validate_referral_code', { code: normalized })
  if (error || !Array.isArray(data) || data.length === 0) return false
  const row = data[0] as { valid?: boolean }
  return Boolean(row.valid)
}

