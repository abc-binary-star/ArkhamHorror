import { ref, onMounted, onBeforeUnmount } from 'vue'

const mobileQuery = '(max-width: 800px), (max-width: 1199px) and (pointer: coarse)'

export function IsMobile() {
  // Preserve the existing setup contract: mobile-only branches become active
  // after the component has initialized all of its refs and watchers.
  const isMobile = ref(false)
  let query: MediaQueryList | undefined
  const update = () => { isMobile.value = query?.matches ?? false }

  onMounted(() => {
    query = window.matchMedia(mobileQuery)
    update()
    query.addEventListener('change', update)
  })
  onBeforeUnmount(() => query?.removeEventListener('change', update))
  return { isMobile }
}
