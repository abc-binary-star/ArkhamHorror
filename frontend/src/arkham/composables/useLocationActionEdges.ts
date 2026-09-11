import { computed, nextTick, onBeforeUnmount, onMounted, ref, type Ref } from 'vue'

export function useLocationActionEdges(container: Ref<Element | null>) {
  const hiddenLocationActionEdges = ref({ top: false, right: false, bottom: false, left: false })
  const hasHiddenLocationActionEdge = computed(() =>
    Object.values(hiddenLocationActionEdges.value).some(Boolean),
  )

  let hiddenLocationActionObserver: MutationObserver | null = null
  let hiddenLocationActionResizeObserver: ResizeObserver | null = null
  let hiddenLocationActionRaf: number | null = null

  function updateHiddenLocationActionEdges() {
    const el = container.value
    if (!el) return

    const bounds = el.getBoundingClientRect()
    const next = { top: false, right: false, bottom: false, left: false }
    const actionEls = Array.from(
      el.querySelectorAll<HTMLElement>(
        '.location-cell--can-interact, .can-interact, [class*="--can-interact"]',
      ),
    )

    for (const actionEl of actionEls) {
      const rect = actionEl.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) continue

      const style = getComputedStyle(actionEl)
      if (style.visibility === 'hidden' || style.display === 'none') continue

      const isPartiallyVisible =
        rect.right > bounds.left &&
        rect.left < bounds.right &&
        rect.bottom > bounds.top &&
        rect.top < bounds.bottom
      if (isPartiallyVisible) continue

      if (rect.right <= bounds.left) next.left = true
      if (rect.left >= bounds.right) next.right = true
      if (rect.bottom <= bounds.top) next.top = true
      if (rect.top >= bounds.bottom) next.bottom = true
    }

    const current = hiddenLocationActionEdges.value
    if (
      current.top !== next.top ||
      current.right !== next.right ||
      current.bottom !== next.bottom ||
      current.left !== next.left
    ) {
      hiddenLocationActionEdges.value = next
    }
  }

  function scheduleHiddenLocationActionEdgesUpdate() {
    if (hiddenLocationActionRaf !== null) cancelAnimationFrame(hiddenLocationActionRaf)
    hiddenLocationActionRaf = requestAnimationFrame(() => {
      hiddenLocationActionRaf = null
      updateHiddenLocationActionEdges()
    })
  }

  onMounted(() => {
    window.addEventListener('resize', scheduleHiddenLocationActionEdgesUpdate)
    window.addEventListener('scroll', scheduleHiddenLocationActionEdgesUpdate, true)
    nextTick(scheduleHiddenLocationActionEdgesUpdate)
    if (container.value) {
      hiddenLocationActionObserver = new MutationObserver(scheduleHiddenLocationActionEdgesUpdate)
      hiddenLocationActionObserver.observe(container.value, {
        attributes: true,
        attributeFilter: ['class', 'style'],
        childList: true,
        subtree: true,
      })

      hiddenLocationActionResizeObserver = new ResizeObserver(scheduleHiddenLocationActionEdgesUpdate)
      hiddenLocationActionResizeObserver.observe(container.value)
    }
  })

  onBeforeUnmount(() => {
    window.removeEventListener('resize', scheduleHiddenLocationActionEdgesUpdate)
    window.removeEventListener('scroll', scheduleHiddenLocationActionEdgesUpdate, true)
    hiddenLocationActionObserver?.disconnect()
    hiddenLocationActionObserver = null
    hiddenLocationActionResizeObserver?.disconnect()
    hiddenLocationActionResizeObserver = null
    if (hiddenLocationActionRaf !== null) cancelAnimationFrame(hiddenLocationActionRaf)
    hiddenLocationActionRaf = null
  })

  return {
    hiddenLocationActionEdges,
    hasHiddenLocationActionEdge,
    scheduleHiddenLocationActionEdgesUpdate,
  }
}
