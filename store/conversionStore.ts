import { create } from 'zustand'
import type { PaywallContext } from '../lib/buildPaywallContext'

type PendingLastScan = {
  productId: string
  context: PaywallContext
}

type ConversionState = {
  showOneScanLeftBanner: boolean
  pendingLastScanPaywall: PendingLastScan | null
  setShowOneScanLeftBanner: (show: boolean) => void
  setPendingLastScanPaywall: (pending: PendingLastScan | null) => void
  clearConversionPrompts: () => void
}

export const useConversionStore = create<ConversionState>((set) => ({
  showOneScanLeftBanner: false,
  pendingLastScanPaywall: null,
  setShowOneScanLeftBanner: (show) => set({ showOneScanLeftBanner: show }),
  setPendingLastScanPaywall: (pending) => set({ pendingLastScanPaywall: pending }),
  clearConversionPrompts: () =>
    set({ showOneScanLeftBanner: false, pendingLastScanPaywall: null }),
}))
