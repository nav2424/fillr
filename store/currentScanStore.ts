import { create } from 'zustand'
import type { ScanResult } from '../types'

interface CurrentScanState {
  result: ScanResult | null
  setResult: (result: ScanResult | null) => void
}

export const useCurrentScanStore = create<CurrentScanState>((set) => ({
  result: null,
  setResult: (result) => set({ result }),
}))
