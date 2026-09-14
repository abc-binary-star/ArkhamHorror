import { onBeforeUnmount } from 'vue'

// Restores the two ways of scrolling that the native bar used to provide, for
// rows whose bar is hidden with `scrollbar-width: none`:
//   - a mouse wheel, which Chromium will not map to the horizontal axis on a
//     box with `overflow-y: hidden`;
//   - dragging the surface, which only ever gripped the bar itself.
// The row is passed in rather than read from `event.currentTarget`: these run
// through a delegated listener on an ancestor, where `currentTarget` is that
// ancestor, not the row.
// Touch is left alone: trackpads and touch screens send their own horizontal
// deltas, and capturing touch here would fight the cards' own gestures.
const DRAG_THRESHOLD_PX = 4

export function useHorizontalDragScroll() {
  let active: HTMLElement | null = null
  let pointerId: number | null = null
  let startX = 0
  let startScrollLeft = 0
  let dragging = false

  function onWheel(scroller: HTMLElement, event: WheelEvent) {
    if (scroller.scrollWidth <= scroller.clientWidth) return
    // Trackpads already deliver the right axis; only the wheel needs the
    // vertical delta re-routed, and only when it is the dominant one.
    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY
    if (delta === 0) return
    const before = scroller.scrollLeft
    scroller.scrollLeft = before + delta
    if (scroller.scrollLeft !== before) event.preventDefault()
  }

  function onPointerDown(scroller: HTMLElement, event: PointerEvent) {
    if (event.pointerType !== 'mouse' || event.button !== 0) return
    if (scroller.scrollWidth <= scroller.clientWidth) return
    active = scroller
    pointerId = event.pointerId
    startX = event.clientX
    startScrollLeft = scroller.scrollLeft
    dragging = false
  }

  function onPointerMove(scroller: HTMLElement, event: PointerEvent) {
    if (!active || active !== scroller || event.pointerId !== pointerId) return
    const dx = event.clientX - startX
    if (!dragging) {
      if (Math.abs(dx) < DRAG_THRESHOLD_PX) return
      dragging = true
      active.setPointerCapture(pointerId as number)
      active.classList.add('drag-scrolling')
    }
    active.scrollLeft = startScrollLeft - dx
    event.preventDefault()
  }

  function endDrag() {
    if (active && dragging) {
      active.classList.remove('drag-scrolling')
      if (pointerId !== null && active.hasPointerCapture(pointerId)) {
        active.releasePointerCapture(pointerId)
      }
      // Swallow the click that would otherwise fire on the card under the
      // pointer once the drag ends.
      const row = active
      const swallow = (click: MouseEvent) => click.stopPropagation()
      row.addEventListener('click', swallow, { capture: true, once: true })
      setTimeout(() => row.removeEventListener('click', swallow, { capture: true }), 0)
    }
    active = null
    pointerId = null
    dragging = false
  }

  onBeforeUnmount(endDrag)

  return { onWheel, onPointerDown, onPointerMove, onPointerUp: endDrag }
}
