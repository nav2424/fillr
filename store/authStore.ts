import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { storage } from '../lib/storage'

interface AuthState {
  isAuthenticated: boolean
  userId: string | null
  email: string | null
  fullName: string | null
  hasCompletedOnboarding: boolean
  setAuth: (user: { id: string; email: string; fullName: string } | null) => void
  setOnboardingComplete: (complete: boolean) => void
  setOnboardingFromServer: (complete: boolean) => void
  /** Update signed-in name/email (local until Supabase profile sync exists). */
  updateAccount: (patch: { email?: string; fullName?: string }) => void
  signOut: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      isAuthenticated: false,
      userId: null,
      email: null,
      fullName: null,
      hasCompletedOnboarding: false,
      setAuth: (user) =>
        set({
          isAuthenticated: !!user,
          userId: user?.id ?? null,
          email: user?.email ?? null,
          fullName: user?.fullName ?? null,
        }),
      setOnboardingComplete: (complete) =>
        set({ hasCompletedOnboarding: complete }),
      setOnboardingFromServer: (complete) =>
        set({ hasCompletedOnboarding: complete }),
      updateAccount: (patch) =>
        set((s) => {
          if (!s.isAuthenticated) return {}
          return {
            email: patch.email !== undefined ? patch.email.trim() || s.email : s.email,
            fullName:
              patch.fullName !== undefined ? patch.fullName.trim() || s.fullName : s.fullName,
          }
        }),
      signOut: () =>
        set({
          isAuthenticated: false,
          userId: null,
          email: null,
          fullName: null,
          hasCompletedOnboarding: false,
        }),
    }),
    {
      name: 'fillr-auth',
      storage: createJSONStorage(() => storage),
      partialize: (s) => ({
        isAuthenticated: s.isAuthenticated,
        userId: s.userId,
        email: s.email,
        fullName: s.fullName,
        hasCompletedOnboarding: s.hasCompletedOnboarding,
      }),
    }
  )
)
