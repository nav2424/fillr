/**
 * Yields so the native layer can process touches, scroll, and navigation before heavy JS continues.
 * Prefer this over deprecated `InteractionManager.runAfterInteractions` for post-async work.
 */
export function yieldToMainThread(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(() => {
      requestAnimationFrame(() => resolve())
    }, 0)
  })
}
