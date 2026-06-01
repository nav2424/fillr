import { useUserStore } from '../store/userStore'
import type { ScanResult } from '../types'
import { countProfileFlaggedIngredients, formatProfileLabels, getScanAllowance } from './scanAllowance'

export type PaywallContextTrigger =
  | 'last_scan'
  | 'scan_blocked'
  | 'one_scan_left'
  | 'manual'
  | 'subscription_screen'

export type PaywallContext = {
  trigger: PaywallContextTrigger
  headline: string
  body: string
  productName?: string
  safetyStatus?: string
  verdict?: string
  totalScansUsed?: number
  flaggedIngredientCount?: number
  profileLabels?: string[]
}

export function buildPaywallContextFromScan(
  result: ScanResult,
  trigger: PaywallContextTrigger
): PaywallContext {
  const s = useUserStore.getState()
  const allowance = getScanAllowance({
    isPro: s.isPro,
    totalScansUsed: s.totalScansUsed ?? 0,
    bonusScansEarned: s.bonusScansEarned ?? 0,
  })
  const profileLabels = formatProfileLabels({
    allergies: s.allergies,
    sensitivities: s.sensitivities,
    celiacStrictGluten: s.celiacStrictGluten,
  })
  const flagged = countProfileFlaggedIngredients(result)
  const productName = result.product.name?.trim() || 'this product'
  const verdict = result.productVerdict?.trim() || result.fillrFit?.verdict?.trim() || ''
  const safetyStatus = result.safetyStatus ?? ''

  const profileLine =
    profileLabels.length > 0
      ? `Personalized for ${profileLabels.join(', ')}.`
      : 'Unlimited scans keep every product decoded for your profile.'

  const flaggedLine =
    flagged > 0
      ? `${flagged} ingredient${flagged === 1 ? '' : 's'} flagged on this scan.`
      : null

  const bodyParts = [
    trigger === 'last_scan'
      ? `You just decoded ${productName}. Keep going with Premium.`
      : null,
    verdict ? `Verdict: ${verdict}` : safetyStatus ? `Status: ${safetyStatus}` : null,
    flaggedLine,
    `You've scanned ${allowance.used} product${allowance.used === 1 ? '' : 's'} on the free plan.`,
    profileLine,
  ].filter(Boolean) as string[]
  const body = bodyParts.join(' ')

  return {
    trigger,
    headline:
      trigger === 'last_scan'
        ? `Unlock unlimited scans`
        : trigger === 'one_scan_left'
          ? `1 free scan left`
          : `Fillr Premium`,
    body,
    productName,
    safetyStatus,
    verdict: verdict || undefined,
    totalScansUsed: allowance.used,
    flaggedIngredientCount: flagged,
    profileLabels,
  }
}

export function buildPaywallContextAtLimit(trigger: PaywallContextTrigger): PaywallContext {
  const s = useUserStore.getState()
  const allowance = getScanAllowance({
    isPro: s.isPro,
    totalScansUsed: s.totalScansUsed ?? 0,
    bonusScansEarned: s.bonusScansEarned ?? 0,
  })
  const profileLabels = formatProfileLabels({
    allergies: s.allergies,
    sensitivities: s.sensitivities,
    celiacStrictGluten: s.celiacStrictGluten,
  })
  const profileLine =
    profileLabels.length > 0
      ? `Unlock unlimited scans for ${profileLabels.join(', ')} and more.`
      : 'Unlock unlimited barcode scans and full breakdowns.'

  return {
    trigger,
    headline: 'No free scans left',
    body: [`You've used all ${allowance.allowance} free scans.`, profileLine].join('\n\n'),
    totalScansUsed: allowance.used,
    profileLabels,
  }
}
