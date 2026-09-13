import { useStorage } from '@vueuse/core'

export const TABLETOP_WIDTH = 1472
export const TABLETOP_HEIGHT = 920
export const TABLETOP_MESSAGE = 'arkham-tabletop-navigation'
export const TABLETOP_DISMISS = 'arkham-tabletop-dismiss'

// Only a frame created by our host may render the inner game. A URL parameter
// alone must not enable this, otherwise opening a copied link could recurse.
export function isTabletopFrame(): boolean {
  try {
    return window.parent !== window &&
      window.frameElement?.getAttribute('data-arkham-tabletop') === 'true'
  } catch {
    return false
  }
}

export function tabletopDocument(): Document {
  return isTabletopFrame() ? window.parent.document : document
}

export function useFixedTabletop() {
  return useStorage('arkhamFixedTabletop16x10', false)
}

export function fitTabletop(width: number, height: number) {
  return Math.max(0, Math.min(width / TABLETOP_WIDTH, height / TABLETOP_HEIGHT))
}
