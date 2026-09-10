import { onBeforeUnmount } from 'vue'

// Hold-to-repeat for the zoom buttons: fire immediately, then repeat the
// action every 80ms after a 400ms hold.
export function useHoldRepeat() {
  let holdTimer: ReturnType<typeof setTimeout> | null = null
  let holdInterval: ReturnType<typeof setInterval> | null = null

  function startHold(action: () => void) {
    action()
    holdTimer = setTimeout(() => {
      holdInterval = setInterval(action, 80)
    }, 400)
  }

  function stopHold() {
    if (holdTimer !== null) {
      clearTimeout(holdTimer)
      holdTimer = null
    }
    if (holdInterval !== null) {
      clearInterval(holdInterval)
      holdInterval = null
    }
  }

  onBeforeUnmount(stopHold)

  return { startHold, stopHold }
}
