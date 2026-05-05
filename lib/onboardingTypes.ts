/**
 * Onboarding selections mirror `useUserStore` fields used during the flow.
 * `customAllergenInput` is ephemeral UI state (not persisted separately).
 */
export type OnboardingData = {
  allergies: string[]
  sensitivities: string[]
  preferences: string[]
  celiacMode: boolean
  goal: string | null
  customAllergenInput: string
}
