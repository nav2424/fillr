import { AppState, type AppStateStatus } from 'react-native'
import type { StateStorage } from 'zustand/middleware'

/**
 * Wraps a zustand `StateStorage` so repeated writes coalesce (large scan history JSON was blocking the JS thread).
 * Flushes when the app moves to background so the latest state is still persisted.
 */
export function createDebouncedPersistStorage(inner: StateStorage, delayMs = 400): StateStorage {
  let timeoutId: ReturnType<typeof setTimeout> | null = null
  let pending: { name: string; value: string } | null = null

  const flush = () => {
    if (timeoutId) {
      clearTimeout(timeoutId)
      timeoutId = null
    }
    if (!pending) return
    const { name, value } = pending
    pending = null
    void inner.setItem(name, value)
  }

  const onAppState = (state: AppStateStatus) => {
    if (state === 'background' || state === 'inactive') flush()
  }

  AppState.addEventListener('change', onAppState)

  return {
    getItem: (name) => inner.getItem(name),
    setItem: (name, value) => {
      pending = { name, value }
      if (timeoutId) clearTimeout(timeoutId)
      timeoutId = setTimeout(flush, delayMs)
    },
    removeItem: (name) => {
      if (timeoutId) {
        clearTimeout(timeoutId)
        timeoutId = null
      }
      pending = null
      void inner.removeItem(name)
    },
  }
}
