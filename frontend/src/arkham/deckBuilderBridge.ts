// The embedded deck builder at /build/ is a separate SPA in its own tab. It
// saves decks straight to our API, then announces the save so any open game or
// deck list can refresh. The announcement carries only the deck id — the
// decklist itself never crosses the tab boundary.
//
// Both transports are used by the builder, so a single save arrives twice and
// is deduped by eventId.
const CHANNEL_NAME = 'arkham-deck-updates-v1'
const STORAGE_KEY = 'arkham-deck-update-v1'

export type DeckSavedEvent = {
  type: 'deck-saved'
  deckId: string
  eventId: string
  savedAt: number
}

const isDeckSavedEvent = (value: unknown): value is DeckSavedEvent =>
  !!value &&
  typeof value === 'object' &&
  (value as DeckSavedEvent).type === 'deck-saved' &&
  typeof (value as DeckSavedEvent).deckId === 'string'

// Calls `onSaved` for each deck the builder saves while subscribed, and returns
// an unsubscribe function. Stale entries left in localStorage by an earlier
// session are ignored: a freshly mounted caller has already loaded current data.
export function onDeckBuilderSave(onSaved: (event: DeckSavedEvent) => void): () => void {
  const seen = new Set<string>()

  const deliver = (value: unknown) => {
    if (!isDeckSavedEvent(value)) return
    if (seen.has(value.eventId)) return
    seen.add(value.eventId)
    onSaved(value)
  }

  const channel =
    typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(CHANNEL_NAME) : null
  const onMessage = (event: MessageEvent) => deliver(event.data)
  channel?.addEventListener('message', onMessage)

  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY || !event.newValue) return
    try {
      deliver(JSON.parse(event.newValue))
    } catch {
      // A malformed marker just means we miss one refresh; the next load is correct.
    }
  }
  window.addEventListener('storage', onStorage)

  return () => {
    channel?.removeEventListener('message', onMessage)
    channel?.close()
    window.removeEventListener('storage', onStorage)
  }
}
