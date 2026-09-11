import { onMounted, onUnmounted, ref } from 'vue'

// The table's two light effects. A flashlight follows the pointer across the play
// area, and a focus light parks on whichever card ability is currently
// highlighted. Both are driven by the pointer position and by class changes
// anywhere in the DOM, so the listeners and their bookkeeping live here instead
// of in the view.
export function useFocusLight() {
  // Last pointer position, in client coordinates. Read by callers that need to
  // know what is under the cursor (the debug 'e' shortcut).
  const pointer = { x: 0, y: 0 }

  const flashlightX = ref(0)
  const flashlightY = ref(0)
  const focusLightX = ref(-1000)
  const focusLightY = ref(-1000)

  let observer: MutationObserver | null = null
  let animationFrame: number | null = null

  function updateFocusLight() {
    const highlighted = [
      ...document.querySelectorAll<HTMLElement>(
        '.source-highlight, .ability-target, .card-frame-inner.highlighted, .cards-under-indicator--highlighted',
      ),
    ].find((el) => {
      if (el.closest('.scenario-cards')) return false
      const rect = el.getBoundingClientRect()
      return (
        rect.width > 0 &&
        rect.height > 0 &&
        rect.bottom >= 0 &&
        rect.right >= 0 &&
        rect.top <= window.innerHeight &&
        rect.left <= window.innerWidth
      )
    })

    if (!highlighted) {
      focusLightX.value = -1000
      focusLightY.value = -1000
      return
    }

    const rect = highlighted.getBoundingClientRect()
    focusLightX.value = rect.left + rect.width / 2
    focusLightY.value = rect.top + rect.height / 2
  }

  function scheduleUpdate() {
    if (animationFrame !== null) return
    animationFrame = requestAnimationFrame(() => {
      animationFrame = null
      updateFocusLight()
    })
  }

  function onMove(event: MouseEvent) {
    pointer.x = event.clientX
    pointer.y = event.clientY
    flashlightX.value = event.clientX
    flashlightY.value = event.clientY
    scheduleUpdate()
  }

  onMounted(() => {
    flashlightX.value = window.innerWidth / 2
    flashlightY.value = window.innerHeight / 2
    document.addEventListener('mousemove', onMove, { passive: true })
    observer = new MutationObserver(scheduleUpdate)
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['class'],
      subtree: true,
    })
    scheduleUpdate()
  })

  onUnmounted(() => {
    document.removeEventListener('mousemove', onMove)
    observer?.disconnect()
    observer = null
    if (animationFrame !== null) cancelAnimationFrame(animationFrame)
  })

  return { pointer, flashlightX, flashlightY, focusLightX, focusLightY, updateFocusLight }
}
