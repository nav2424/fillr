type AsyncWriteTask<T> = () => Promise<T>

const lanes = new Map<string, Promise<unknown>>()
const laneDepth = new Map<string, number>()

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function enqueueNonCriticalWrite<T>(
  lane: string,
  task: AsyncWriteTask<T>,
  retries = 1
): Promise<{ value: T; attempts: number; queuedAhead: number }> {
  const prior = lanes.get(lane) ?? Promise.resolve()
  const queuedAhead = laneDepth.get(lane) ?? 0
  laneDepth.set(lane, queuedAhead + 1)
  let release: () => void = () => {}
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  lanes.set(lane, prior.finally(() => gate))

  await prior.catch(() => {})

  let attempt = 0
  let lastError: unknown = null
  while (attempt <= retries) {
    try {
      const value = await task()
      release()
      if (lanes.get(lane) === gate) lanes.delete(lane)
      const remaining = Math.max((laneDepth.get(lane) ?? 1) - 1, 0)
      if (remaining === 0) laneDepth.delete(lane)
      else laneDepth.set(lane, remaining)
      return { value, attempts: attempt + 1, queuedAhead }
    } catch (err) {
      lastError = err
      attempt += 1
      if (attempt <= retries) {
        await sleep(180 * attempt)
      }
    }
  }

  release()
  if (lanes.get(lane) === gate) lanes.delete(lane)
  const remaining = Math.max((laneDepth.get(lane) ?? 1) - 1, 0)
  if (remaining === 0) laneDepth.delete(lane)
  else laneDepth.set(lane, remaining)
  throw lastError
}

