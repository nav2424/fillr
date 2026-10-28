import { useUserStore } from '../store/userStore'
import {
  clearAccountDietaryProfile,
  dietarySnapshotFromUserState,
  loadAccountDietaryProfile,
  restoredDietaryFields,
  saveAccountDietaryProfile,
} from './accountDietaryProfile'

async function waitForUserStoreHydration(): Promise<void> {
  if (useUserStore.persist.hasHydrated()) return
  await Promise.race([
    new Promise<void>((resolve) => {
      if (useUserStore.persist.hasHydrated()) {
        resolve()
        return
      }
      const unsub = useUserStore.persist.onFinishHydration(() => {
        unsub()
        resolve()
      })
      if (useUserStore.persist.hasHydrated()) {
        unsub()
        resolve()
      }
    }),
    new Promise<void>((resolve) => setTimeout(resolve, 1500)),
  ])
}

/** Persist the live dietary profile before sign-out wipes Zustand. */
export async function captureAccountDietaryProfile(userId: string | null | undefined): Promise<void> {
  const id = String(userId ?? '').trim()
  if (!id) return
  await waitForUserStoreHydration()
  await saveAccountDietaryProfile(id, dietarySnapshotFromUserState(useUserStore.getState()))
}

/**
 * After sign-in, put back the profile captured at sign-out when the live store is empty.
 * A profile the user already has on this device is left alone.
 */
export async function restoreAccountDietaryProfileIfBlank(userId: string | null | undefined): Promise<void> {
  const id = String(userId ?? '').trim()
  if (!id) return
  await waitForUserStoreHydration()
  const current = dietarySnapshotFromUserState(useUserStore.getState())
  const saved = await loadAccountDietaryProfile(id)
  const next = restoredDietaryFields(current, saved)
  if (!next) return
  useUserStore.setState({
    allergies: next.allergies,
    sensitivities: next.sensitivities,
    preferences: next.preferences,
    goal: next.goal,
    celiacStrictGluten: next.celiacStrictGluten,
    nutritionTargets: next.nutritionTargets,
  })
}

export async function clearCapturedAccountDietaryProfile(userId: string | null | undefined): Promise<void> {
  await clearAccountDietaryProfile(userId)
}
