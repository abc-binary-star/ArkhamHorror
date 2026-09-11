type LogValue = string | number | boolean | null | undefined
type LogEntry = { time: string; elapsedMs: number; event: string; level: 'info' | 'error'; details: Record<string, LogValue> }

declare global {
  interface Window { __ARKHAM_LOGS__: LogEntry[] }
}

const started = performance.now()
const entries: LogEntry[] = []
window.__ARKHAM_LOGS__ = entries

// Keep scalar snapshots: logging a reactive object can show a later state,
// and request/game objects can contain tokens or private cards.
export function clientLog(event: string, details: Record<string, LogValue> = {}, level: 'info' | 'error' = 'info') {
  const entry: LogEntry = { time: new Date().toISOString(), elapsedMs: Math.round(performance.now() - started), event, level, details }
  entries.push(entry)
  if (entries.length > 200) entries.shift()
  console[level](`[Arkham] +${entry.elapsedMs}ms ${event}`, details)
}

export function clientError(event: string, cause: unknown, details: Record<string, LogValue> = {}) {
  const error = cause instanceof Error ? cause : null
  const redact = (text: string) => text.replace(/([?&](?:token|access_token|authorization)=)[^&#\s]+/gi, '$1[redacted]')
  clientLog(event, {
    ...details,
    name: error?.name ?? typeof cause,
    message: redact(error?.message ?? (typeof cause === 'string' ? cause : 'Non-Error rejection')).slice(0, 2000),
    stack: error?.stack ? redact(error.stack).slice(0, 6000) : undefined,
  }, 'error')
}

let installed = false
export function installClientLogging() {
  if (installed) return
  installed = true
  clientLog('startup', { width: window.innerWidth, height: window.innerHeight, userAgent: navigator.userAgent, online: navigator.onLine })
  window.addEventListener('error', (event) => {
    clientError('window.error', event.error ?? event.message, { line: event.lineno, column: event.colno })
  })
  window.addEventListener('unhandledrejection', (event) => clientError('promise.unhandled', event.reason))
  window.addEventListener('pageshow', (event) => clientLog('page.show', { restored: event.persisted }))
  window.addEventListener('pagehide', (event) => clientLog('page.hide', { cached: event.persisted }))
  document.addEventListener('visibilitychange', () => clientLog('page.visibility', { state: document.visibilityState }))
  window.addEventListener('online', () => clientLog('network.online'))
  window.addEventListener('offline', () => clientLog('network.offline'))
}
