import { FREE_SCAN_LIMIT } from '../constants/subscription'
import type { ScanResult } from '../types'

export type ScanAllowanceSnapshot = {
  used: number
  bonus: number
  allowance: number
  remaining: number
}

export function getScanAllowance(input: {
  isPro: boolean
  totalScansUsed: number
  bonusScansEarned: number
}): ScanAllowanceSnapshot {
  if (input.isPro) {
    return { used: 0, bonus: 0, allowance: Number.POSITIVE_INFINITY, remaining: Number.POSITIVE_INFINITY }
  }
  const used = input.totalScansUsed ?? 0
  const bonus = input.bonusScansEarned ?? 0
  const allowance = FREE_SCAN_LIMIT + bonus
  const remaining = Math.max(0, allowance - used)
  return { used, bonus, allowance, remaining }
}

export function countProfileFlaggedIngredients(result: ScanResult): number {
  const breakdown = result.ingredientBreakdown ?? []
  let n = 0
  for (const ing of breakdown) {
    if (ing.actionability === 'avoid' || ing.actionability === 'limit') n += 1
    else if (ing.verdict === 'LIMIT') n += 1
  }
  if (n > 0) return n
  return (result.matchedAllergens?.length ?? 0) + (result.matchedSensitivities?.length ?? 0)
}

export function formatProfileLabels(input: {
  allergies: string[]
  sensitivities: string[]
  celiacStrictGluten: boolean
  max?: number
}): string[] {
  const labels: string[] = []
  for (const a of input.allergies ?? []) {
    const t = String(a).trim()
    if (t) labels.push(t)
  }
  for (const s of input.sensitivities ?? []) {
    const t = String(s).trim()
    if (t) labels.push(t)
  }
  if (input.celiacStrictGluten) labels.push('strict gluten / celiac')
  const max = input.max ?? 4
  return labels.slice(0, max)
}
