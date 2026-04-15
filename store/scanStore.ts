import { useUserStore } from './userStore'
import { FREE_SCAN_LIMIT } from '../constants/subscription'

const FREE_BASE_SCANS = FREE_SCAN_LIMIT

export async function canUserScan(): Promise<boolean> {
  const s = useUserStore.getState()
  if (s.isPro) return true
  const totalUsed = s.totalScansUsed ?? 0
  const bonusScans = s.bonusScansEarned ?? 0
  const availableScans = FREE_BASE_SCANS + bonusScans
  return totalUsed < availableScans
}

export async function getRemainingScans(): Promise<number> {
  const s = useUserStore.getState()
  if (s.isPro) return Number.POSITIVE_INFINITY
  const totalUsed = s.totalScansUsed ?? 0
  const bonusScans = s.bonusScansEarned ?? 0
  return Math.max(0, FREE_BASE_SCANS + bonusScans - totalUsed)
}

export async function updatePremiumStatus(isPremiumFromRevenueCat: boolean): Promise<void> {
  const { lifetimePro, setIsPro } = useUserStore.getState()
  setIsPro(Boolean(isPremiumFromRevenueCat) || lifetimePro)
}

export async function incrementScanCount(): Promise<void> {
  useUserStore.getState().incrementFreeTierScanIfNeeded()
}

