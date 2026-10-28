import type { NutritionTargets } from './nutritionTargets'

/**
 * Dietary settings the scanner reads from Zustand. They are not columns on `profiles`,
 * so a sign-out that clears the in-memory store cannot be rebuilt from the server.
 * Keep a per-account copy and put it back on the next sign-in.
 */
export type AccountDietarySnapshot = {
  allergies: string[]
  sensitivities: string[]
  preferences: string[]
  goal: string
  celiacStrictGluten: boolean
  nutritionTargets: NutritionTargets
}

type DietStore = {
  getItem: (key: string) => Promise<string | null>
  setItem: (key: string, value: string) => Promise<void>
  removeItem: (key: string) => Promise<void>
}

const KEY_PREFIX = 'fillr-account-diet-v1:'

export function accountDietStorageKey(userId: string): string {
  return `${KEY_PREFIX}${userId.trim()}`
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => String(item ?? '').trim()).filter(Boolean)
}

function nutritionTargetsFrom(value: unknown): NutritionTargets {
  if (!value || typeof value !== 'object') return {}
  const raw = value as NutritionTargets
  const next: NutritionTargets = {}
  if (typeof raw.maxSugarG === 'number' && Number.isFinite(raw.maxSugarG)) next.maxSugarG = raw.maxSugarG
  if (typeof raw.minProteinG === 'number' && Number.isFinite(raw.minProteinG)) next.minProteinG = raw.minProteinG
  if (typeof raw.maxSodiumMg === 'number' && Number.isFinite(raw.maxSodiumMg)) next.maxSodiumMg = raw.maxSodiumMg
  if (
    raw.trackingStyle === 'general' ||
    raw.trackingStyle === 'weight_loss' ||
    raw.trackingStyle === 'muscle' ||
    raw.trackingStyle === 'blood_sugar'
  ) {
    next.trackingStyle = raw.trackingStyle
  }
  return next
}

export function dietarySnapshotFromUserState(state: {
  allergies?: string[] | null
  sensitivities?: string[] | null
  preferences?: string[] | null
  goal?: string | null
  celiacStrictGluten?: boolean | null
  nutritionTargets?: NutritionTargets | null
}): AccountDietarySnapshot {
  return {
    allergies: stringList(state.allergies),
    sensitivities: stringList(state.sensitivities),
    preferences: stringList(state.preferences),
    goal: String(state.goal ?? '').trim(),
    celiacStrictGluten: state.celiacStrictGluten === true,
    nutritionTargets: nutritionTargetsFrom(state.nutritionTargets),
  }
}

export function isAccountDietarySnapshotBlank(snapshot: AccountDietarySnapshot): boolean {
  const targets = snapshot.nutritionTargets ?? {}
  const hasTargets =
    targets.maxSugarG != null ||
    targets.minProteinG != null ||
    targets.maxSodiumMg != null ||
    (targets.trackingStyle != null && targets.trackingStyle !== 'general')
  return (
    snapshot.allergies.length === 0 &&
    snapshot.sensitivities.length === 0 &&
    snapshot.preferences.length === 0 &&
    snapshot.goal.length === 0 &&
    !snapshot.celiacStrictGluten &&
    !hasTargets
  )
}

/** Keep a live profile. Otherwise return the saved one so sign-in does not scan as if allergies were cleared. */
export function restoredDietaryFields(
  current: AccountDietarySnapshot,
  saved: AccountDietarySnapshot | null
): AccountDietarySnapshot | null {
  if (!isAccountDietarySnapshotBlank(current)) return null
  if (!saved || isAccountDietarySnapshotBlank(saved)) return null
  return saved
}

export function parseAccountDietarySnapshot(raw: string | null): AccountDietarySnapshot | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return null
    return dietarySnapshotFromUserState(parsed as AccountDietarySnapshot)
  } catch {
    return null
  }
}

async function resolveStore(store?: DietStore): Promise<DietStore> {
  if (store) return store
  const { storage } = await import('./storage')
  return storage
}

export async function saveAccountDietaryProfile(
  userId: string | null | undefined,
  snapshot: AccountDietarySnapshot,
  store?: DietStore
): Promise<void> {
  const id = String(userId ?? '').trim()
  if (!id) return
  const target = await resolveStore(store)
  await target.setItem(accountDietStorageKey(id), JSON.stringify(dietarySnapshotFromUserState(snapshot)))
}

export async function loadAccountDietaryProfile(
  userId: string | null | undefined,
  store?: DietStore
): Promise<AccountDietarySnapshot | null> {
  const id = String(userId ?? '').trim()
  if (!id) return null
  const target = await resolveStore(store)
  return parseAccountDietarySnapshot(await target.getItem(accountDietStorageKey(id)))
}

export async function clearAccountDietaryProfile(
  userId: string | null | undefined,
  store?: DietStore
): Promise<void> {
  const id = String(userId ?? '').trim()
  if (!id) return
  const target = await resolveStore(store)
  await target.removeItem(accountDietStorageKey(id))
}
