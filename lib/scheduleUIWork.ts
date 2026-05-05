/**
 * Schedules work after the current stack and the next paint. Avoids `startTransition` here:
 * zustand uses `useSyncExternalStore`, and mixing transitions with external-store updates on RN
 * 0.83 + React 19 has been linked to hard-to-reproduce native stalls on iOS.
 */
export function runAfterInteractionsAndNextFrame(fn: () => void): void {
  setTimeout(() => {
    requestAnimationFrame(() => {
      fn()
    })
  }, 0)
}

/**
 * History / persist updates — delayed so they do not run in the same frame as `setCurrentScan`.
 */
export function runOnNextFrameInTransition(fn: () => void): void {
  setTimeout(fn, 64)
}
