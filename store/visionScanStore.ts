import { create } from 'zustand'
import type { VisionProductIdentification } from '../types'

export type VisionScanDraft = {
  photoUri: string
  identification: VisionProductIdentification
  /** When launched from a failed barcode scan, for optional backfill. */
  fallbackBarcode?: string
}

interface VisionScanState {
  draft: VisionScanDraft | null
  setDraft: (draft: VisionScanDraft) => void
  clearDraft: () => void
}

export const useVisionScanStore = create<VisionScanState>((set) => ({
  draft: null,
  setDraft: (draft) => set({ draft }),
  clearDraft: () => set({ draft: null }),
}))
