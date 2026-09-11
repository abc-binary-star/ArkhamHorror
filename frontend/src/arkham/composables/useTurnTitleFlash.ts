import { onMounted, onUnmounted } from 'vue'

// "Your turn" tab-title flash: a player idling in another tab or window gets no
// audio and no toast, so blink the title until they come back. The toast covers
// the visible case; the sound cue is the caller's business.
export function useTurnTitleFlash() {
  let base = ''
  let interval: ReturnType<typeof setInterval> | null = null

  function stop() {
    if (interval) {
      clearInterval(interval)
      interval = null
    }
    if (base) {
      document.title = base
      base = ''
    }
  }

  function flashTurnTitle() {
    if (!document.hidden) return
    stop()
    base = document.title
    let on = true
    const apply = () => {
      document.title = (on ? '▶ ' : '') + base
      on = !on
    }
    apply()
    interval = setInterval(apply, 1200)
  }

  onMounted(() => {
    document.addEventListener('visibilitychange', onVisibilityChange)
  })

  onUnmounted(() => {
    document.removeEventListener('visibilitychange', onVisibilityChange)
    stop()
  })

  function onVisibilityChange() {
    if (!document.hidden) stop()
  }

  return { flashTurnTitle, stopTurnTitleFlash: stop }
}
