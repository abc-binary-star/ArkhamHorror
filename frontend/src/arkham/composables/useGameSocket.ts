import { useWebSocket, type MaybeRefOrGetter } from '@vueuse/core'

export interface GameSocketOptions<T> {
  url: MaybeRefOrGetter<string>
  onResult: (result: T) => void
  /** The socket errored or dropped: the caller surfaces it and undoes optimistic state. */
  onDisconnect: () => void
  /** `reconnected` is true only for a connect after the first: anything published
   *  while the socket was down is gone, since the server drops updates for rooms
   *  with no subscriber rather than buffering them. */
  onConnect: (reconnected: boolean) => void
}

// The one socket a game listens on. It owns nothing about the board: every
// message is handed to `onResult` as-is, and the connection bookkeeping the
// caller would otherwise have to repeat lives here.
export function useGameSocket<T>(options: GameSocketOptions<T>) {
  let hasConnectedOnce = false

  const { send, close } = useWebSocket(options.url, {
    autoReconnect: true,
    onError: () => options.onDisconnect(),
    onConnected: () => {
      options.onConnect(hasConnectedOnce)
      hasConnectedOnce = true
    },
    onMessage: (_ws, event) => options.onResult(JSON.parse(event.data) as T),
  })

  return { send, close }
}

/**
 * Runs one payload through `decode` at a time, keeping only the newest payload
 * that arrived mid-decode. Updates can outpace a full decode, and applying them
 * out of order would show a board that never existed; dropping the stale ones is
 * deliberate — the newest payload is the whole game state, not a patch.
 */
export function useSingleFlight<T>(
  decode: (payload: string) => Promise<T>,
  onDecoded: (value: T) => void,
  onError: (error: unknown) => void,
): (payload: string) => void {
  let decoding = false
  let pending: string | null = null

  function run(payload: string) {
    if (decoding) {
      pending = payload
      return
    }
    decoding = true
    decode(payload)
      .then(onDecoded)
      .catch(onError)
      .finally(() => {
        decoding = false
        if (pending !== null) {
          const next = pending
          pending = null
          run(next)
        }
      })
  }

  return run
}
