/** Linear onboarding: welcome (0) → … → account (7). */
export const ONBOARDING_STEP_TOTAL = 8

/** 0-based step index for `GlassProgressBar` `current` prop. */
export const ONBOARDING_STEP = {
  welcome: 0,
  allergies: 1,
  sensitivities: 2,
  preferences: 3,
  goal: 4,
  camera: 5,
  summary: 6,
  account: 7,
} as const
