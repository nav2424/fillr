import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { createDebouncedPersistStorage } from '../lib/debouncedPersistStorage'
import { storage } from '../lib/storage'
import { persistScanHistoryRemote } from '../lib/overviewScanRemote'
import { lightenScanResultForPersistence } from '../lib/lightenScanResultForPersistence'
import type { SafetyStatus, ScanIngredientSource, ScanResult } from '../types'

export interface ScanRecord {
  id: string
  productId: string
  productName: string
  barcode: string
  safetyStatus: SafetyStatus
  date: string
  result?: ScanResult
  /** Optional; omitted = barcode scan. */
  source?: ScanIngredientSource
}

interface ScanHistoryState {
  scans: ScanRecord[]
  savedProductIds: string[]
  addScan: (scan: ScanRecord) => void
  /** Overwrites stored full result when user re-analyzes (e.g. pasted ingredients). */
  updateScanResultByProductId: (productId: string, result: ScanResult) => void
  getResultByProductId: (productId: string) => ScanResult | null
  toggleSaved: (productId: string) => void
  isSaved: (productId: string) => boolean
  clearAll: () => void
}

type ScanHistoryPersistedState = Pick<ScanHistoryState, 'scans' | 'savedProductIds'>

export const useScanHistoryStore = create<ScanHistoryState>()(
  persist(
    (set, get) => ({
      scans: [],
      savedProductIds: [],
      addScan: (scan) => {
        set((s) => ({
          scans: [scan, ...s.scans.filter((x) => x.id !== scan.id)].slice(0, 50),
        }))
        void persistScanHistoryRemote(scan)
      },
      updateScanResultByProductId: (productId, result) =>
        set((s) => ({
          scans: s.scans.map((rec) =>
            rec.productId === productId
              ? {
                  ...rec,
                  result,
                  safetyStatus: result.safetyStatus,
                  productName: result.product.name,
                  source: result.scanSource ?? rec.source,
                }
              : rec
          ),
        })),
      getResultByProductId: (productId) => {
        const scan = get().scans.find((s) => s.productId === productId)
        return scan?.result ?? null
      },
      toggleSaved: (productId) =>
        set((s) => ({
          savedProductIds: s.savedProductIds.includes(productId)
            ? s.savedProductIds.filter((id) => id !== productId)
            : [...s.savedProductIds, productId],
        })),
      isSaved: (productId) => get().savedProductIds.includes(productId),
      clearAll: () => set({ scans: [], savedProductIds: [] }),
    }),
    {
      name: 'fillr-scan-history',
      storage: createJSONStorage<ScanHistoryPersistedState>(() =>
        createDebouncedPersistStorage(storage, 700)
      ),
      partialize: (state) => ({
        scans: state.scans.map((rec) => ({
          ...rec,
          result: rec.result ? lightenScanResultForPersistence(rec.result) : rec.result,
        })),
        savedProductIds: state.savedProductIds,
      }),
    }
  )
)
