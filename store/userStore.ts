import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { storage } from '../lib/storage'
import { FREE_SCAN_LIMIT } from '../constants/subscription'

interface UserState {
  allergies: string[]
  sensitivities: string[]
  preferences: string[]
  goal: string
  celiacStrictGluten: boolean
  /** Fillr Pro — unlocks Label vs Reality and related premium sections. */
  isPro: boolean
  /** From Supabase `profiles.lifetime_pro` — never removed by RevenueCat sync. */
  lifetimePro: boolean
  /** Persisted usage counters synced with Supabase profile. */
  totalScansUsed: number
  bonusScansEarned: number
  referralCode: string
  referredBy: string | null
  referralsConverted: number
  setAllergies: (allergies: string[]) => void
  setSensitivities: (sensitivities: string[]) => void
  setPreferences: (preferences: string[]) => void
  setGoal: (goal: string) => void
  setCeliacMode: (enabled: boolean) => void
  setIsPro: (isPro: boolean) => void
  setReferralData: (data: {
    referralCode?: string
    referredBy?: string | null
    bonusScansEarned?: number
    totalScansUsed?: number
    referralsConverted?: number
    isPro?: boolean
    lifetimePro?: boolean
  }) => void
  /** Available scans for free users: base + bonus - used. */
  getAvailableScans: () => number
  /** Call after successful product scan. */
  incrementFreeTierScanIfNeeded: () => void
  /** Local wipe when user deletes account (no server call yet). */
  resetForAccountDeletion: () => void
  /** Empty onboarding chip selections (fresh flow; stale persisted keys otherwise pre-fill screens). */
  clearOnboardingDraft: () => void
  setFromOnboarding: (data: {
    allergies: string[]
    sensitivities: string[]
    preferences: string[]
    goal: string
  }) => void
}

export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      allergies: [],
      sensitivities: [],
      preferences: [],
      goal: '',
      celiacStrictGluten: false,
      isPro: false,
      lifetimePro: false,
      totalScansUsed: 0,
      bonusScansEarned: 0,
      referralCode: '',
      referredBy: null,
      referralsConverted: 0,
      setAllergies: (allergies) => set({ allergies }),
      setSensitivities: (sensitivities) => set({ sensitivities }),
      setPreferences: (preferences) => set({ preferences }),
      setGoal: (goal) => set({ goal }),
      setCeliacMode: (enabled) => set({ celiacStrictGluten: enabled }),
      setIsPro: (isPro) => set({ isPro }),
      setReferralData: (data) =>
        set((s) => {
          const lifetimePro =
            data.lifetimePro !== undefined ? data.lifetimePro : s.lifetimePro
          const serverIsPro = data.isPro !== undefined ? data.isPro : s.isPro
          const isPro =
            data.isPro !== undefined || data.lifetimePro !== undefined
              ? Boolean(serverIsPro) || lifetimePro
              : s.isPro
          return {
            referralCode: data.referralCode ?? s.referralCode,
            referredBy: data.referredBy !== undefined ? data.referredBy : s.referredBy,
            bonusScansEarned: data.bonusScansEarned ?? s.bonusScansEarned,
            totalScansUsed: data.totalScansUsed ?? s.totalScansUsed,
            referralsConverted: data.referralsConverted ?? s.referralsConverted,
            lifetimePro,
            isPro,
          }
        }),
      getAvailableScans: () => {
        const s = get()
        if (s.isPro) return Number.POSITIVE_INFINITY
        return Math.max(
          0,
          FREE_SCAN_LIMIT + (s.bonusScansEarned ?? 0) - (s.totalScansUsed ?? 0)
        )
      },
      incrementFreeTierScanIfNeeded: () =>
        set((s) => {
          if (s.isPro) return {}
          const used = s.totalScansUsed ?? 0
          const available = Math.max(0, FREE_SCAN_LIMIT + (s.bonusScansEarned ?? 0) - used)
          if (available <= 0) return {}
          return { totalScansUsed: used + 1 }
        }),
      resetForAccountDeletion: () =>
        set({
          allergies: [],
          sensitivities: [],
          preferences: [],
          goal: '',
          celiacStrictGluten: false,
          isPro: false,
          lifetimePro: false,
          totalScansUsed: 0,
          bonusScansEarned: 0,
          referralCode: '',
          referredBy: null,
          referralsConverted: 0,
        }),
      clearOnboardingDraft: () =>
        set({
          allergies: [],
          sensitivities: [],
          preferences: [],
          goal: '',
          celiacStrictGluten: false,
        }),
      setFromOnboarding: (data) => set(data),
    }),
    {
      name: 'fillr-user',
      storage: createJSONStorage(() => storage),
    }
  )
)
