import { onBeforeUnmount } from 'vue'

// Dragging the act/agenda card sideways pages through its resolved history: the
// dot strip is a small target, and the card is the largest thing on the seat.
// Mouse only, and only where the strip itself is drawn (the tabletop seats): on
// touch, capturing the gesture here would fight the cards' own gestures, and
// everywhere else the stack popover is the way in.
const STEP_PX = 28

export function useHistoryDrag(enabled: () => boolean, step: (direction: 1 | -1) => void) {
  let active: HTMLElement | null = null
  let pointerId: number | null = null
  let startX = 0
  let dragging = false
  // How many cards the gesture has already paged, so a long drag walks the whole
  // history instead of only turning one page.
  let paged = 0

  function onPointerDown(event: PointerEvent) {
    if (!enabled() || event.pointerType !== 'mouse' || event.button !== 0) return
    active = event.currentTarget as HTMLElement | null
    pointerId = event.pointerId
    startX = event.clientX
    dragging = false
    paged = 0
  }

  function onPointerMove(event: PointerEvent) {
    if (!active || event.pointerId !== pointerId) return
    const travelled = Math.trunc((startX - event.clientX) / STEP_PX)

    if (!dragging) {
      if (travelled === 0) return
      dragging = true
      active.setPointerCapture(pointerId)
    }

    const delta = travelled - paged
    if (delta === 0) return

    paged = travelled
    for (let i = 0; i < Math.abs(delta); i++) step(delta > 0 ? 1 : -1)
    event.preventDefault()
  }

  function endDrag() {
    if (active && dragging && pointerId !== null) {
      if (active.hasPointerCapture(pointerId)) active.releasePointerCapture(pointerId)
      // Swallow the click this drag would otherwise land on the card as.
      const box = active
      const swallow = (click: MouseEvent) => click.stopPropagation()
      box.addEventListener('click', swallow, { capture: true, once: true })
      setTimeout(() => box.removeEventListener('click', swallow, { capture: true }), 0)
    }
    active = null
    pointerId = null
    dragging = false
    paged = 0
  }

  onBeforeUnmount(endDrag)

  return { onPointerDown, onPointerMove, onPointerUp: endDrag }
}
