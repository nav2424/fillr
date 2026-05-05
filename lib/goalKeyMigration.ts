/** Map legacy persisted goal keys to the current onboarding vocabulary. */
const LEGACY: Record<string, string> = {
  build_muscle: 'more_protein',
  improve_health: 'balanced_diet',
}

export function migrateGoalKey(goal: string | null | undefined): string {
  const g = String(goal ?? '').trim()
  if (!g) return ''
  return LEGACY[g] ?? g
}
