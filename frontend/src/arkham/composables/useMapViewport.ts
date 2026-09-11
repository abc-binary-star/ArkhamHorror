import { nextTick, ref, watch, type Ref } from 'vue'
import { getGameLocalStorageItem, setGameLocalStorageItem } from '@/arkham/localStorage'

const DOUBLE_ZOOM_LEVEL = 3

export interface MapViewportOptions {
  gameId: () => string
  scroller: Ref<HTMLElement | null>
  /** The grid element (a component ref, so `$el` may need unwrapping). */
  grid: Ref<Element | null>
  /** Where the double-click zoom parks when the click did not land on a card. */
  investigatorLocationId: () => string | null
}

// The map's zoom level and the scroll bookkeeping that keeps it usable. The map
// is scaled with `transform: scale()` rather than CSS `zoom` because browsers
// report `getBoundingClientRect()` consistently for the former; the scroll area
// does not follow a transform, so margins are re-applied after every change.
export function useMapViewport(options: MapViewportOptions) {
  const zoom = ref(
    parseFloat(getGameLocalStorageItem(options.gameId(), 'locationsZoom') ?? '1'),
  )

  const doubleZoomActive = ref(false)
  const doubleZoomPrevValue = ref(1)
  const doubleZoomPrevScroll = { left: 0, top: 0 }

  watch(zoom, async (value) => {
    setGameLocalStorageItem(options.gameId(), 'locationsZoom', String(value))
    await updateScrollMargins()
  })

  function gridElement(): HTMLElement | null {
    const grid = options.grid.value as { $el?: HTMLElement } | HTMLElement | null
    return (grid as { $el?: HTMLElement } | null)?.$el ?? (grid as HTMLElement | null)
  }

  async function updateScrollMargins() {
    await nextTick()
    const grid = gridElement()
    if (!grid) return
    const z = zoom.value
    // offsetWidth/Height exclude margins, so we always read the natural grid size directly.
    if (z >= 1) {
      grid.style.marginRight = `${grid.offsetWidth * (z - 1)}px`
      grid.style.marginBottom = `${grid.offsetHeight * (z - 1)}px`
    } else {
      grid.style.marginRight = ''
      grid.style.marginBottom = ''
    }
  }

  function zoomStep(value: number): number {
    const center = 1.5 // peak step around the middle of the normal range
    const sigma = 1.0 // controls how quickly the step tapers off
    const max = 0.15
    const min = 0.01
    return Math.max(min, max * Math.exp(-Math.pow(value - center, 2) / (2 * sigma * sigma)))
  }

  function onWheel(event: WheelEvent) {
    const delta = event.deltaY < 0 ? zoomStep(zoom.value) : -zoomStep(zoom.value)
    zoom.value = parseFloat(Math.min(6, Math.max(0.25, zoom.value + delta)).toFixed(3))
  }

  async function toggleZoom(event: MouseEvent) {
    const scroller = options.scroller.value
    const gridEl = gridElement()
    if (!scroller || !gridEl) return

    if (doubleZoomActive.value) {
      doubleZoomActive.value = false
      zoom.value = doubleZoomPrevValue.value
      await updateScrollMargins()
      scroller.scrollLeft = doubleZoomPrevScroll.left
      scroller.scrollTop = doubleZoomPrevScroll.top
      return
    }

    // Find what to focus on: the clicked location, or the investigator's location
    const target = event.target as HTMLElement
    let focusEl: HTMLElement | null = target.closest('[data-id]')
    if (!focusEl) {
      const locationId = options.investigatorLocationId()
      if (locationId) {
        focusEl = document.querySelector<HTMLElement>(`[data-id="${locationId}"]`)
      }
    }
    if (!focusEl) return

    const currentZ = zoom.value
    const scrollerRect = scroller.getBoundingClientRect()
    const gridRect = gridEl.getBoundingClientRect()
    const focusRect = focusEl.getBoundingClientRect()

    // Compute the grid's layout position in scroller content space. This is invariant across zoom
    // levels since flex sizes items by their natural dimensions. We must account for transform-origin:
    //   z >= 1  → origin 0 0: visual top-left === layout top-left, so read directly.
    //   z <  1  → origin center: visual top-left is shifted inward; subtract the shift to get layout.
    const gridW = gridEl.offsetWidth
    const gridH = gridEl.offsetHeight
    const gridLayoutLeft =
      currentZ >= 1
        ? gridRect.left - scrollerRect.left + scroller.scrollLeft
        : gridRect.left - scrollerRect.left + scroller.scrollLeft - (gridW * (1 - currentZ)) / 2
    const gridLayoutTop =
      currentZ >= 1
        ? gridRect.top - scrollerRect.top + scroller.scrollTop
        : gridRect.top - scrollerRect.top + scroller.scrollTop - (gridH * (1 - currentZ)) / 2

    // Natural (unscaled) center of focus within the grid.
    // Visual delta from the grid's visual top-left = natural offset × scale, for any transform-origin.
    const natX = (focusRect.left + focusRect.width / 2 - gridRect.left) / currentZ
    const natY = (focusRect.top + focusRect.height / 2 - gridRect.top) / currentZ

    // Save current state
    doubleZoomPrevValue.value = currentZ
    doubleZoomPrevScroll.left = scroller.scrollLeft
    doubleZoomPrevScroll.top = scroller.scrollTop

    // Apply new zoom and wait for margins to update
    doubleZoomActive.value = true
    zoom.value = DOUBLE_ZOOM_LEVEL
    await updateScrollMargins()

    // At new zoom (origin 0 0), focus sits at gridLayoutLeft + natX * newZ in content space.
    // gridLayoutLeft is invariant (flex uses natural dimensions), so it's the same before and after.
    // Use clientWidth/Height (viewport area, excludes scrollbars) for accurate centering.
    scroller.scrollLeft = gridLayoutLeft + natX * DOUBLE_ZOOM_LEVEL - scroller.clientWidth / 2
    scroller.scrollTop = gridLayoutTop + natY * DOUBLE_ZOOM_LEVEL - scroller.clientHeight / 2
  }

  return { zoom, onWheel, toggleZoom, updateScrollMargins, doubleZoomActive }
}
