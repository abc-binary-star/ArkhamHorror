// Phase banners, reveals and board snapshots share one stream. In particular,
// never coalesce snapshots across a phase boundary while decoding asynchronously.
export function orderedGameEvents<T>(
  blocked: () => boolean,
  apply: (event: T, isCurrent: () => boolean) => Promise<void>,
  onError: (error: unknown) => void,
) {
  const pending: T[] = []
  let draining = false
  let generation = 0

  async function drain() {
    if (draining) return
    draining = true
    try {
      while (pending.length && !blocked()) {
        const run = generation
        await apply(pending.shift()!, () => run === generation)
      }
    } catch (error) {
      pending.length = 0
      onError(error)
    } finally {
      draining = false
    }
  }

  return {
    push(event: T) {
      pending.push(event)
      void drain()
    },
    drain,
    clear() { generation++; pending.length = 0 },
  }
}
