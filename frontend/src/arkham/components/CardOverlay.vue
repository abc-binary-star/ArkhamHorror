<script lang="ts" setup>
import {
  ComputedRef,
  reactive,
  ref,
  computed,
  watch,
  onMounted,
  onUnmounted,
} from 'vue'
import { cardImg, formatContent, imgsrc, toCamelCase } from '@/arkham/helpers'
import { originalArt } from '@/arkham/artVariants'
import { BugAntIcon } from '@heroicons/vue/20/solid'
import { useDebug } from '@/arkham/debug'
import { useI18n } from 'vue-i18n'
import { fetchCard, fetchPlayability, type PlayabilityResponse } from '@/arkham/api'
import type { CardDef } from '@/arkham/types/CardDef'
import KeyToken from '@/arkham/components/Key.vue'
import { type ArkhamKey, keyToId } from '@/arkham/types/Key'
import PoolItem from '@/arkham/components/PoolItem.vue'
import { useDbCardStore } from '@/stores/dbCards'
import { type NarrationSegment, setCurrentNarration } from '@/arkham/narration'
import { cardNarrationFromCsv } from '@/arkham/narrationCsv'
import { cardNarrationCategory } from '@/arkham/narrationCategory'
import {
  CARD_RATIO,
  OVERLAY_W,
  TAROT_H,
  VIEW_W,
  BASE_LABEL_FONT,
  normalizedCardCode,
} from '@/arkham/composables/cardOverlayShared'
import { useOverlayCustomizations } from '@/arkham/composables/useOverlayCustomizations'
import { useDbCardFallback } from '@/arkham/composables/useDbCardFallback'

/* =============================================================================
 * Constants, basic helpers, and caches
 * ========================================================================== */

// Cache natural aspect ratios (width / height) to infer sideways when needed
const imgARCache = reactive(new Map<string, number>())
const loadAR = (url: string) => {
  if (!url || imgARCache.has(url)) return
  const i = new Image()
  i.decoding = 'async'
  i.onload = () => imgARCache.set(url, i.naturalWidth / i.naturalHeight)
  i.src = url
}

// Small helpers
type Pct = { top: number; left: number }

/* =============================================================================
 * Stores & reactive top-level state
 * ========================================================================== */

const { t } = useI18n()
const showCardText = ref(false)
const overlayPinned = ref(false)
const store = useDbCardStore()
const debug = useDebug()

const cardOverlay = ref<HTMLElement | null>(null)
const hoveredElement = ref<HTMLElement | null>(null)
const isMobile = ref(false)
const overPopover = computed(() => !!hoveredElement.value?.closest('.v-popper__popper'))

const playabilityData = ref<PlayabilityResponse | null>(null)
let playabilityTimer: number | null = null
const cardDefCache = new Map<string, CardDef | null>()
const overlayCardDef = ref<CardDef | null>(null)

watch(hoveredElement, (el) => {
  showCardText.value = false
  playabilityData.value = null
  if (playabilityTimer !== null) { clearTimeout(playabilityTimer); playabilityTimer = null }

  const code = normalizedCardCode(el?.dataset.cardCode ?? el?.dataset.imageId)

  if (!debug.active || !el) return
  const playabilityGameId = el.dataset.playabilityGameId
  const investigatorId = el.dataset.playabilityInvestigatorId
  const cardId = el.dataset.playabilityCardId
  if (!playabilityGameId || !investigatorId || !cardId) return
  if (code && store.getDbCard(code)?.type_code === 'skill') return
  playabilityTimer = window.setTimeout(async () => {
    try {
      const result = await fetchPlayability(playabilityGameId, investigatorId, cardId)
      if (hoveredElement.value === el) playabilityData.value = result
    } catch { /* ignore */ }
  }, 300)
})

const mq = window.matchMedia('(hover: none) and (pointer: coarse)')
const updateIsMobile = () => (isMobile.value = mq.matches)
updateIsMobile()
onMounted(() => mq.addEventListener?.('change', updateIsMobile))
onUnmounted(() => mq.removeEventListener?.('change', updateIsMobile))

/* =============================================================================
 * Pointer/hover handling
 * ========================================================================== */

const CARD_SELECTOR = '.card,[data-image-id],[data-target],[data-image]'
const OVERLAY_BLOCKER_SELECTOR = '.draggable,.intro-text,.choice-modal-wrapper,.no-card-overlay'
let hoverTimer: number | null = null
let pressTimer: number | null = null
let canDisablePress = false
let currentPointerType = 'mouse'
let dragActive = false
const lastPointer = ref<{ clientX: number; clientY: number } | null>(null)

const clearTimer = (t: number | null) => (t !== null ? (clearTimeout(t), null) : null)

const targetFromEvent = (e: Event): HTMLElement | null => {
  const raw = e.target as HTMLElement | null
  const closest = raw ? (raw.closest(CARD_SELECTOR) as HTMLElement | null) : null
  if (closest) return closest

  // Do not fall through to the geometry fallback when a modal/story entry is
  // over the board. Otherwise hovering resolution text can still find cards
  // underneath the modal by bounding-rect and show their card overlay.
  if (raw?.closest(OVERLAY_BLOCKER_SELECTOR)) return null

  // Transformed cards can visually extend outside their untransformed layout
  // box (notably rotated enemy-as-location cards). In that case normal event
  // targeting may hit the map/background instead of the image even though the
  // pointer is over the rendered card. Fall back to a geometry check using the
  // transformed bounding rects so the full visual card surface opens overlays.
  if (!(e instanceof MouseEvent)) return null
  const { clientX, clientY } = e
  const candidates = Array.from(document.querySelectorAll<HTMLElement>('img.card,[data-image-id],[data-target],[data-image]'))
    .reverse()
  return candidates.find((el) => {
    if (el.classList.contains('dragging') || el.classList.contains('no-overlay')) return false
    const rect = el.getBoundingClientRect()
    return rect.width > 0
      && rect.height > 0
      && clientX >= rect.left
      && clientX <= rect.right
      && clientY >= rect.top
      && clientY <= rect.bottom
  }) ?? null
}

const queueHover = (el: HTMLElement) => {
  hoverTimer = clearTimer(hoverTimer)
  const delay = el.dataset.delay ? parseInt(el.dataset.delay, 10) : 0
  hoverTimer = window.setTimeout(() => {
    hoveredElement.value = el
    canDisablePress = true
  }, delay)
}

const onMouseOver = (e: MouseEvent) => {
  if (e.target instanceof Node && cardOverlay.value?.contains(e.target)) {
    hoverTimer = clearTimer(hoverTimer)
    return
  }
  if (overlayPinned.value || currentPointerType === 'touch' || dragActive) return
  lastPointer.value = { clientX: e.clientX, clientY: e.clientY }
  const el = targetFromEvent(e)
  hoverTimer = clearTimer(hoverTimer)
  if (!el || el.classList.contains('dragging') || el.classList.contains('no-overlay')) {
    hoverTimer = window.setTimeout(() => { hoveredElement.value = null }, 150)
    return
  }
  queueHover(el)
}

const onMouseLeave = () => {
  if (overlayPinned.value || currentPointerType === 'touch') return
  hoverTimer = clearTimer(hoverTimer)
  hoveredElement.value = null
}

const onPointerDown = (e: PointerEvent) => {
  currentPointerType = e.pointerType
  if (overlayPinned.value) {
    if (e.target instanceof Node && cardOverlay.value?.contains(e.target)) return
    clearOverlay()
  }
  if (e.pointerType === 'touch') {
    const el = targetFromEvent(e)
    if (!el) return
    pressTimer = clearTimer(pressTimer)
    pressTimer = window.setTimeout(() => queueHover(el), 200) // long press
  }
}

const onPointerMove = (e: PointerEvent) => {
  currentPointerType = e.pointerType
  lastPointer.value = { clientX: e.clientX, clientY: e.clientY }
  if (overlayPinned.value) return
  if (e.pointerType === 'touch') {
    if (hoveredElement.value?.classList.contains('card--locations')) {
      hoveredElement.value = null
    }
    pressTimer = clearTimer(pressTimer)
  }
}

const onPointerUp = (e: PointerEvent) => {
  if (overlayPinned.value) return
  // A control layered on top of a card can change which face that card shows (the
  // act/agenda stack popover's flip button). Clicking it must leave the overlay up,
  // otherwise every click after the first dismisses it.
  if ((e.target as HTMLElement | null)?.closest?.('[data-keep-card-overlay]')) return
  if (canDisablePress) {
    canDisablePress = false
  } else {
    hoveredElement.value = null
    pressTimer = clearTimer(pressTimer)
  }
}

const toggleCardText = () => {
  // Opening or closing the panel changes the hit target under the pointer.
  // Keep this preview until explicit dismissal, including while it repositions.
  hoverTimer = clearTimer(hoverTimer)
  pressTimer = clearTimer(pressTimer)
  overlayPinned.value = true
  showCardText.value = !showCardText.value
}

const onOverlayKeyDown = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && overlayPinned.value) clearOverlay()
}

const clearOverlay = () => {
  overlayPinned.value = false
  showCardText.value = false
  hoverTimer = clearTimer(hoverTimer)
  pressTimer = clearTimer(pressTimer)
  playabilityTimer = clearTimer(playabilityTimer)
  hoveredElement.value = null
}

const onDragStart = () => {
  dragActive = true
  clearOverlay()
}

const onDragEnd = () => {
  dragActive = false
  clearOverlay()
}

const onOverlayContextMenu = (e: MouseEvent) => {
  const t = e.target as HTMLElement
  if (t?.tagName.toLowerCase() !== 'input') e.preventDefault()
}

onMounted(() => {
  document.addEventListener('pointerdown', onPointerDown, { passive: true })
  document.addEventListener('pointermove', onPointerMove, { passive: true })
  document.addEventListener('pointerup', onPointerUp, { passive: true })
  document.addEventListener('mouseover', onMouseOver)
  document.addEventListener('keydown', onOverlayKeyDown)
  document.addEventListener('mouseleave', onMouseLeave)
  document.addEventListener('dragstart', onDragStart)
  document.addEventListener('dragend', onDragEnd)
  document.addEventListener('drop', onDragEnd)
  document.addEventListener('arkham:clear-card-overlay', clearOverlay)
  // only block context menu inside the overlay, not globally
  cardOverlay.value?.addEventListener('contextmenu', onOverlayContextMenu)
})
onUnmounted(() => {
  document.removeEventListener('pointerdown', onPointerDown)
  document.removeEventListener('pointermove', onPointerMove)
  document.removeEventListener('pointerup', onPointerUp)
  document.removeEventListener('mouseover', onMouseOver)
  document.removeEventListener('keydown', onOverlayKeyDown)
  document.removeEventListener('mouseleave', onMouseLeave)
  document.removeEventListener('dragstart', onDragStart)
  document.removeEventListener('dragend', onDragEnd)
  document.removeEventListener('drop', onDragEnd)
  document.removeEventListener('arkham:clear-card-overlay', clearOverlay)
  cardOverlay.value?.removeEventListener('contextmenu', onOverlayContextMenu)
  clearOverlay()
})

/* =============================================================================
 * Image lookup & orientation
 * ========================================================================== */

const getImage = (el: HTMLElement, depth = 0): string | null => {
  if (depth > 3) return null // avoid runaway recursion

  if (el.dataset.imageId) return cardImg(el.dataset.imageId)

  if (el instanceof HTMLImageElement && el.classList.contains('card') && !el.closest('.revelation')) {
    return el.src || null
  }

  if (el instanceof HTMLDivElement && el.classList.contains('card')) {
    const bg = el.style.backgroundImage
    if (!bg || bg === 'none') return null
    return bg.slice(4, -1).replaceAll('"', '') // strip url("...")
  }

  if (el.dataset.target) {
    const target = document.querySelector<HTMLElement>(`[data-id="${el.dataset.target}"]`)
    return target ? getImage(target, depth + 1) : null
  }

  return el.dataset.image ?? null
}

// getImage and the class/dataset readers below pull straight off the DOM, which is
// not a reactive source: a card that changes face under a stationary cursor (the
// act/agenda stack popover's flip button) left the overlay on the old image. Bump a
// counter whenever the hovered element's own attributes change and depend on it.
const hoveredVersion = ref(0)
let hoveredObserver: MutationObserver | null = null
watch(hoveredElement, (el) => {
  hoveredObserver?.disconnect()
  hoveredObserver = null
  hoveredVersion.value++
  if (!el) return
  hoveredObserver = new MutationObserver(() => { hoveredVersion.value++ })
  hoveredObserver.observe(el, {
    attributes: true,
    attributeFilter: ['src', 'style', 'class', 'data-image', 'data-image-id', 'data-card-code', 'data-errata', 'data-sideways'],
  })
})
onUnmounted(() => { hoveredObserver?.disconnect(); hoveredObserver = null })

const card = computed<string | null>(() => {
  void hoveredVersion.value
  return hoveredElement.value ? getImage(hoveredElement.value) : null
})
const overlayCardCode = computed<string | null>(() => {
  void hoveredVersion.value
  const el = hoveredElement.value
  if (!el) return null
  const direct = normalizedCardCode(el.dataset.cardCode ?? el.dataset.imageId)?.replace(/b$/, '')
  // Homebrew definitions are not served by the single-card endpoint.
  if (direct) return direct.startsWith(':') ? null : direct

  const image = card.value
  // A homebrew image path ends in /cards/<local code>, which otherwise looks
  // like an official card code to the fallback matcher below.
  if (!image || image.includes('/homebrew/')) return null

  const match = image.match(/\/cards\/c?(\d+b?)\.(?:avif|jpg|jpeg|png|webp)(?:\?.*)?$/i)
  return match ? originalArt(match[1]).replace(/b$/, '') : null
})
/* Card-def errata covers a whole card, but some errata only applies to one face —
 * and the overlay resolves both faces to the same card def. A `data-errata`
 * attribute lets whichever component knows which side is showing supply the text
 * for just that side; it wins over the card def's own errata. */
const cardErrata = computed<string | null>(() => {
  void hoveredVersion.value
  return hoveredElement.value?.dataset.errata ?? overlayCardDef.value?.errata ?? null
})

watch(overlayCardCode, async (code) => {
  showCardText.value = false
  overlayCardDef.value = null
  if (!code) return
  if (cardDefCache.has(code)) {
    overlayCardDef.value = cardDefCache.get(code) ?? null
    return
  }
  try {
    const cardDef = await fetchCard(code)
    cardDefCache.set(code, cardDef)
    if (overlayCardCode.value === code) overlayCardDef.value = cardDef
  } catch {
    cardDefCache.set(code, null)
  }
})

const upsideDown = computed<boolean>(() => {
  void hoveredVersion.value
  return hoveredElement.value?.classList.contains('Reversed') ?? false
})
const reversed = computed<boolean>(() => {
  void hoveredVersion.value
  return hoveredElement.value?.classList.contains('reversed') ?? false
})

const sideways = computed<boolean>(() => {
  void hoveredVersion.value
  const el = hoveredElement.value
  if (!el) return false

  // explicit dataset wins
  if (el.dataset.sideways === 'true') return true
  if (el.dataset.sideways === 'false') return false

  // class heuristics
  if (el.classList.contains('exhausted')) return false
  if (el.classList.contains('attached')) return false
  if (el.classList.contains('card--sideways') || el.classList.contains('sideways')) return true
  if (el.classList.contains('modifier')) return false
  if (el.tagName.toLowerCase() === 'span') return false

  // fall back to natural aspect for dataset image
  const url = el.dataset.image ?? (el.dataset.imageId ? cardImg(el.dataset.imageId) : null)
  if (url) {
    const ar = imgARCache.get(url)
    if (ar != null) return ar > 1
  }

  // final fallback: element geometry
  return el.matches('.card, [data-image-id], [data-target]') && el.offsetWidth > el.offsetHeight
})

watch(card, (src) => { if (src) loadAR(src) })

/* =============================================================================
 * Overlay positioning
 * ========================================================================== */

const overlayPosition = ref<{ top: number; left: number }>({ top: 0, left: 0 })
let posRAF: number | null = null

const getPosition = (el: HTMLElement): { top: number; left: number } => {
  const rect = el.getBoundingClientRect()
  const bounds = cardOverlay.value?.getBoundingClientRect()
  const width = bounds?.width ?? OVERLAY_W
  const height = bounds?.height ?? Math.round(OVERLAY_W / CARD_RATIO)
  const pad = 10
  const cursor = el.dataset.overlayPosition === 'cursor-right' ? lastPointer.value : null
  const right = cursor ? cursor.clientX + 18 : rect.right + 10
  const left = right + width <= window.innerWidth - pad ? right : rect.left - width - 10
  return {
    top: Math.max(pad, Math.min((cursor?.clientY ?? rect.top) - 40, window.innerHeight - height - pad)),
    left: Math.max(pad, Math.min(left, window.innerWidth - width - pad)),
  }
}

const updateOverlayPosition = () => {
  if (posRAF !== null) cancelAnimationFrame(posRAF)
  posRAF = requestAnimationFrame(() => {
    posRAF = null
    const el = hoveredElement.value
    overlayPosition.value = el ? getPosition(el) : { top: 0, left: 0 }
  })
}
watch([hoveredElement, sideways], updateOverlayPosition, { flush: 'post' })
// Localized text and extra panels arrive asynchronously; measure again as they grow.
let overlayResizeObserver: ResizeObserver | null = null
onMounted(() => {
  overlayResizeObserver = new ResizeObserver(updateOverlayPosition)
  if (cardOverlay.value) overlayResizeObserver.observe(cardOverlay.value)
  window.addEventListener('resize', updateOverlayPosition)
  document.addEventListener('fullscreenchange', updateOverlayPosition)
  document.addEventListener('scroll', updateOverlayPosition, true)
})
onUnmounted(() => {
  overlayResizeObserver?.disconnect()
  window.removeEventListener('resize', updateOverlayPosition)
  document.removeEventListener('fullscreenchange', updateOverlayPosition)
  document.removeEventListener('scroll', updateOverlayPosition, true)
  if (posRAF !== null) cancelAnimationFrame(posRAF)
})

/* =============================================================================
 * SVG sizing & transforms
 * ========================================================================== */

const svgWidth = computed(() => (tarot.value ? Math.round(TAROT_H * CARD_RATIO)
  : (sideways.value ? Math.round(OVERLAY_W / CARD_RATIO) : OVERLAY_W)))
const svgHeight = computed(() => (tarot.value ? TAROT_H
  : (sideways.value ? OVERLAY_W : Math.round(OVERLAY_W / CARD_RATIO))))

const viewH = computed(() => Math.round(VIEW_W / CARD_RATIO))
const viewBox = computed(() => (sideways.value ? `0 0 ${viewH.value} ${VIEW_W}` : `0 0 ${VIEW_W} ${viewH.value}`))

const groupTransform = computed(() => {
  if (!reversed.value && !upsideDown.value) return ''
  const w = sideways.value ? viewH.value : VIEW_W
  const h = sideways.value ? VIEW_W : viewH.value
  return `rotate(180 ${w / 2} ${h / 2})`
})

// CSS-like % to viewBox coords
const xyFromPct = (p: Pct) => {
  const vbW = sideways.value ? viewH.value : VIEW_W
  const vbH = sideways.value ? VIEW_W : viewH.value
  return { x: (p.left / 100) * vbW, y: (p.top / 100) * vbH }
}

/* =============================================================================
 * Dataset API helpers
 * ========================================================================== */

const ds = <T extends string = string>(key: T) =>
  computed<string | null>(() => hoveredElement.value?.dataset?.[key as any] ?? null)

const dsMap = <X>(key: keyof DOMStringMap, map: (v: string) => X): ComputedRef<X | null> =>
  computed(() => {
    const v = hoveredElement.value?.dataset?.[key]
    return v !== undefined ? map(v) : null
  })

const jsonDs = <T>(key: string): T => {
  try { return JSON.parse(hoveredElement.value?.dataset?.[key] ?? '[]') as T }
  catch { return [] as unknown as T }
}

/* =============================================================================
 * Minor overlays & simple dataset fields
 * ========================================================================== */

const fight = ds('fight')
const health = ds('health')
const evade = ds('evade')
const victory = ds('victory')
const keywords = ds('keywords')
const playingCardOverlay = ds('pc')
const swarm = dsMap('swarm', v => v === 'true')

const depth = computed<number | null>(() => {
  const d = hoveredElement.value?.dataset?.depth
  return d ? parseInt(d, 10) : null
})

const crossedOff = computed<string[] | null>(() => {
  const arr = jsonDs<string[]>('crossedOff')
  return arr.length ? arr : null
})

type Checkmark = { left: number; top: number; }

const checkmarks = computed<Checkmark[] | null>(() => {
  const arr = jsonDs<Checkmark[]>('checkmarks')
  return arr.length ? arr : null
})

const spentKeys = computed<ArkhamKey[]>(() => jsonDs<ArkhamKey[]>('spentKeys'))
const overlay = ds('overlay')

const tarot = computed<boolean>(() => !!hoveredElement.value?.classList.contains('tarot-card'))

// numeric damage/horror parsed from data-* (so "0" doesn't render)
const damage = computed<number | null>(() => {
  const v = hoveredElement.value?.dataset?.damage
  const n = v == null ? NaN : Number(v)
  return Number.isFinite(n) ? n : null
})
const horror = computed<number | null>(() => {
  const v = hoveredElement.value?.dataset?.horror
  const n = v == null ? NaN : Number(v)
  return Number.isFinite(n) ? n : null
})

// where badges go (ported from your CSS %)
const damagePositions: Pct[] = [
  { top: 56.1, left: 37.1 },
  { top: 55.0, left: 30.5 },
  { top: 53.3, left: 24.5 },
]
const horrorPositions: Pct[] = [
  { top: 56.5, left: 62.9 },
  { top: 55.0, left: 69.5 },
  { top: 53.5, left: 75.7 },
]
// CSS had 22px on ~300px-tall image ⇒ ~7.33% height
const badgeSize = computed(() => {
  const vbH = sideways.value ? VIEW_W : viewH.value
  const h = 0.0533 * vbH
  return { w: h, h } // ~square
})

/* =============================================================================
 * Card code & customization image
 * ========================================================================== */

const isSpirit = computed<boolean>(() => {
  const el = hoveredElement.value
  if (!el) return false
  return el.dataset.isSpirit === 'true'
})

const cardCode = computed<string | null>(() => {
  if (!card.value) return null
  const m = card.value.match(/cards\/(\d+)(_.*)?\.avif$/)
  return m ? originalArt(m[1]) : null
})

const {
  customizationsCard,
  parsedTicks,
  tickPct,
  tickSize,
  labelItems,
  labelTransform,
  setLabelRef,
  skillItems,
} = useOverlayCustomizations({ hoveredElement, card, cardCode, sideways, viewH })

/* =============================================================================
 * Read aloud
 * ========================================================================== */

// Deliberately not the `cardCode` above: that one drops the trailing side
// letter, and narration needs it to tell a back face from a front.
const narrationImageCode = computed<string | null>(() => {
  const image = card.value
  // A homebrew image path ends in /cards/<local code>, which otherwise looks
  // like an official card code.
  if (!image || image.includes('/homebrew/')) return null
  const match = image.match(/\/cards\/([^/?]+)\.avif(?:[?#].*)?$/)
  return match ? match[1].replace(/_.*$/, '') : null
})

const narrationDeclaredCode = computed<string | null>(() =>
  normalizedCardCode(
    hoveredElement.value?.dataset.cardCode ?? hoveredElement.value?.dataset.imageId,
  ),
)

const narrationCardCode = computed<string | null>(
  () => narrationDeclaredCode.value ?? narrationImageCode.value,
)

watch(
  [narrationCardCode, narrationImageCode, hoveredElement, () => store.lang],
  async ([code, imageCode, element]) => {
    if (!imageCode || !element) return

    try {
      await store.initDbCards()
    } catch {
      // The local CSV can still supply narration if card metadata cannot load.
    }
    // Both awaits below can outlive the hover that started them.
    if (narrationImageCode.value !== imageCode || hoveredElement.value !== element) return

    const dbCard = code
      ? store.getDbCard(code) ?? store.getDbCard(imageCode)
      : store.getDbCard(imageCode)
    const category = cardNarrationCategory(dbCard, element)
    const csvNarration = await cardNarrationFromCsv(code, imageCode, category)
    if (narrationImageCode.value !== imageCode || hoveredElement.value !== element) return
    if (csvNarration) {
      setCurrentNarration(csvNarration)
      return
    }

    if (!dbCard) return
    const back = imageCode === `${dbCard.code}b`
    const segments: NarrationSegment[] = [
      { category: 'cardName', text: back ? dbCard.back_name || dbCard.name : dbCard.name },
      { category: 'cardSubname', text: back ? '' : (dbCard.subname ?? '') },
      {
        category: 'cardTraits',
        text: back ? dbCard.back_traits || dbCard.traits || '' : dbCard.traits || '',
      },
      { category: 'cardText', text: back ? dbCard.back_text || '' : dbCard.text || '' },
      { category: 'cardFlavor', text: back ? dbCard.back_flavor || '' : dbCard.flavor || '' },
    ]

    setCurrentNarration({
      id: `card:${dbCard.code}:${back ? 'back' : 'front'}:${store.lang}:${JSON.stringify(segments)}`,
      category,
      segments,
    })
  },
)

const additionalCard = computed<string | null>(() => {
  if (!cardCode.value) return null
  if (!["88043"].includes(cardCode.value)) return null
  return imgsrc(`cards/${cardCode.value}b.avif`)
})

/* =============================================================================
 * ArkhamDB fallback text (localization overlay) — extracted to composable
 * ========================================================================== */

const {
  dbCardName, dbCardTypeName, dbCardFactionName, dbCardFactionCode,
  dbCardTraits, dbCardText, dbCardFlavor, dbCardCustomizationText, dbCardData,
} = useDbCardFallback(card)

</script>

<template>
  <Teleport to="body">
    <div
      class="card-overlay"
      ref="cardOverlay"
      :style="{ top: overlayPosition.top + 'px', left: overlayPosition.left + 'px'}"
      :class="{ sideways, tarot, isMobile, overPopover }"
    >
    <div class="card-image">
      <button
        v-if="card && (dbCardData || dbCardCustomizationText)"
        type="button"
        class="card-text-toggle"
        data-keep-card-overlay
        :aria-expanded="showCardText"
        @pointerdown.stop
        @pointerup.stop
        @click.stop="toggleCardText"
      >{{ t(showCardText ? 'hideCardText' : 'showCardText') }}</button>
      <svg
        v-if="card"
        class="card-svg"
        :viewBox="viewBox"
        :width="svgWidth"
        :height="svgHeight"
        :style="`width:${svgWidth}px;height:${svgHeight}px`"
        preserveAspectRatio="xMidYMid meet"
      >
        <g :transform="groupTransform" :data-pc="playingCardOverlay">
          <image
            :href="card"
            x="0" y="0"
            :width="sideways ? viewH : VIEW_W"
            :height="sideways ? VIEW_W : viewH"
          />
          <image
            v-if="playingCardOverlay"
            :href="playingCardOverlay"
            class="playing-card-overlay"
            x="25" y="30"
            width="160"
          />
          <image
            v-if="overlay"
            :href="overlay"
            x="0" y="0"
            :width="sideways ? viewH : VIEW_W"
            :height="sideways ? VIEW_W : viewH"
          />

          <template v-if="damage">
            <template v-for="i in Math.min(damage, 3)" :key="'d'+i">
              <template v-if="damagePositions[i-1]">
                <image
                  :href="imgsrc('damage-overlay.png')"
                  :x="xyFromPct(damagePositions[i-1]).x - badgeSize.w/2"
                  :y="xyFromPct(damagePositions[i-1]).y - badgeSize.h/2"
                  :width="badgeSize.w"
                  :height="badgeSize.h"
                />
              </template>
            </template>
          </template>

          <template v-if="horror">
            <template v-for="i in Math.min(horror, 3)" :key="'h'+i">
              <template v-if="horrorPositions[i-1]">
                <image
                  :href="imgsrc('horror-overlay.png')"
                  :x="xyFromPct(horrorPositions[i-1]).x - badgeSize.w/2"
                  :y="xyFromPct(horrorPositions[i-1]).y - badgeSize.h/2"
                  :width="badgeSize.w"
                  :height="badgeSize.h"
                />
              </template>
            </template>
          </template>

          <template v-for="pos in checkmarks" :key="`checkmark-${pos.top}-${pos.left}`">
            <template v-if="pos.top !== undefined && pos.left !== undefined">
              <g
                :transform="(() => {
                  const vbW = sideways ? viewH : VIEW_W;
                  const vbH = sideways ? VIEW_W : viewH;
                  const x = (pos.left! / 100) * vbW;
                  const y = (pos.top!  / 100) * vbH;
                  const s = tickSize;
                  return `translate(${x - s/2}, ${y - s/2}) scale(${s/24})`;
                })()"
                fill="#690000"
                aria-label="tick"
              >
                <path d="M20.285 2l-11.285 11.567-5.286-5.011-3.714 3.716 9 8.728 15-15.285z"/>
              </g>
            </template>
          </template>
        </g>
      </svg>

      <font-awesome-icon v-if="isSpirit && card" :icon="['fas', 'ghost']" class="spirit-icon" />

      <svg
        v-if="additionalCard"
        class="card-svg customizations-svg"
        :width="svgWidth"
        :height="svgHeight"
        :style="`width:${svgWidth}px;height:${svgHeight}px`"
        :viewBox="viewBox"
        preserveAspectRatio="xMidYMid meet"
      >
        <g :transform="groupTransform">
          <image
            :href="additionalCard"
            x="0" y="0"
            :width="sideways ? viewH : VIEW_W"
            :height="sideways ? VIEW_W : viewH"
          />
        </g>
      </svg>

      <svg
        v-if="customizationsCard"
        class="card-svg customizations-svg"
        :width="svgWidth"
        :height="svgHeight"
        :style="`width:${svgWidth}px;height:${svgHeight}px`"
        :viewBox="viewBox"
        preserveAspectRatio="xMidYMid meet"
      >
        <g :transform="groupTransform">
          <image
            :href="customizationsCard"
            x="0" y="0"
            :width="sideways ? viewH : VIEW_W"
            :height="sideways ? VIEW_W : viewH"
          />

          <template v-for="tp in parsedTicks" :key="`cust-${tp.code}-${tp.first}-${tp.idx}`">
            <template v-if="tickPct(tp).top !== undefined && tickPct(tp).left !== undefined">
              <g
                :transform="(() => {
                  const vbW = sideways ? viewH : VIEW_W;
                  const vbH = sideways ? VIEW_W : viewH;
                  const pos = tickPct(tp);
                  const x = (pos.left! / 100) * vbW;
                  const y = (pos.top!  / 100) * vbH;
                  const s = tickSize;
                  return `translate(${x - s/2}, ${y - s/2}) scale(${s/24})`;
                })()"
                fill="currentColor"
                aria-label="tick"
              >
                <path d="M20.285 2l-11.285 11.567-5.286-5.011-3.714 3.716 9 8.728 15-15.285z"/>
              </g>
            </template>
          </template>

          <template v-for="item in labelItems" :key="`lbl-${item.code}-${item.key}`">
            <g :data-w="item.w" :data-h="item.h" :transform="labelTransform(`lbl-${item.code}-${item.key}`, item)">
              <text
                :ref="setLabelRef(
                  `lbl-${item.code}-${item.key}`,
                  () => [item.text, item.w.toFixed(2), item.h.toFixed(2), sideways ? 'S' : 'P'].join('|')
                )"
                x="0" y="0"
                :font-size="BASE_LABEL_FONT"
                style="font-weight: 600;"
              >
                {{ item.text }}
              </text>
            </g>
          </template>

          <template v-for="s in skillItems" :key="`skill-09079-${s.name}`">
            <circle :cx="s.cx" :cy="s.cy" :r="s.r" fill="rgba(0,0,0,0.4)" stroke="var(--neutral-extra-dark)" stroke-width="2" />
          </template>
        </g>
      </svg>

      <div v-for="entry in crossedOff" :key="entry" class="crossed-off" :class="{ [toCamelCase(entry)]: true }"></div>

      <p v-if="cardErrata" class="card-errata" v-html="`Errata: ${formatContent(cardErrata)}`"></p>
    </div>

    <div
      class="card-data"
      v-if="showCardText && dbCardData"
      :class="{ reversed, Reversed: upsideDown, [`faction-${dbCardFactionCode || 'neutral'}`]: true }"
    >
      <div class="card-data-header">
        <p v-if="dbCardName"><b>{{ dbCardName }}</b></p>
      </div>
      <div class="card-data-body">
        <div class="card-info">
          <div>
            <p v-if="dbCardTypeName">{{ dbCardTypeName }}</p>
            <p v-if="dbCardTraits"><span style="font-style: italic;">{{ dbCardTraits }}</span></p>
          </div>
          <div>
            <p v-if="dbCardFactionName">{{ dbCardFactionName }}</p>
          </div>
        </div>
        <div v-if="dbCardText" class="card-text">
          <p v-html="dbCardText"></p>
        </div>
        <div v-if="dbCardFlavor" class="card-flavor">
          <p v-html="dbCardFlavor"></p>
        </div>
      </div>
    </div>

    <span class="swarm" v-if="swarm"><BugAntIcon aria-hidden="true" /></span>
    <span class="fight" v-if="fight">{{ fight }}</span>
    <span class="health" v-if="health">{{ health }}</span>
    <span class="evade" v-if="evade">{{ evade }}</span>
    <span class="victory" v-if="victory">Victory {{ victory }}.</span>
    <span class="keywords" v-if="keywords">{{ keywords }}.</span>
    <PoolItem class="depth" v-if="depth" type="resource" :amount="depth" />

    <div class="spent-keys" v-if="spentKeys.length > 0">
      <KeyToken v-for="k in spentKeys" :key="keyToId(k)" :keyToken="k" @choose="() => {}"/>
    </div>

    <div class="card-data" v-if="showCardText && dbCardCustomizationText">
      <p v-if="dbCardName"><b>{{ dbCardName }}</b></p>
      <p v-if="dbCardCustomizationText" v-html="dbCardCustomizationText" style="font-size: 0.85em;"></p>
    </div>

    <div v-if="playabilityData && debug.active" class="playability-panel">
      <ul class="playability-checks">
        <li
          v-for="[name, detail] in playabilityData.checks"
          :key="name"
          :class="detail === null ? 'check-passed' : 'check-failed'"
        >
          <span class="check-icon">{{ detail === null ? '✓' : '✗' }}</span>
          <span class="check-body">
            <span class="check-name">{{ name }}</span>
            <span v-if="detail !== null" class="check-detail">{{ detail }}</span>
          </span>
        </li>
      </ul>
    </div>
    </div>
  </Teleport>
</template>

<style scoped>
.fight, .evade, .health, .swarm {
  font-family: "Teutonic";
  position: absolute;
  color: white;
  font-weight: bold;
  font-size: 1.3em;
  text-shadow:
    1px 1px 0 #000,
    -1px 1px 0 #000,
    -1px -1px 0 #000,
    1px -1px 0 #000;
}
.swarm {
  inset: 0;
  width: var(--card-width);
  height: auto;
}

.fight {
  top: 11%;
  left: 30%;
}

.health {
  font-size: 1.6em;
  top: 10%;
  transform: translate(-50%, 0);
  left:50%;
}

.evade {
  top: 11%;
  left: 68%;
}

.victory {
  position: absolute;
  color: rgba(0, 0, 0, 0.6);
  top: 47%;
  transform: translate(-50%, 0);
  left:50%;
  font-weight: 900;
  font-size: 0.8em;
}

.keywords {
  width: 80%;
  position: absolute;
  color: rgba(0, 0, 0, 0.6);
  top: 23.2%;
  left:13%;
  font-weight: bold;
  font-size: 0.8em;
}

.card-data {
  position: relative;
  width: 300px;
  min-height: 0;
  max-height: calc(100dvh - 20px);
  overflow-y: auto;
  overflow-wrap: anywhere;
  flex-shrink: 0;
  overscroll-behavior: contain;
  margin-left: 2px;
  border-radius: 12px;
  font-family: Arial;
  white-space: pre-wrap;
  word-wrap: break-word;
  aspect-ratio: var(--card-aspect);
  -ms-overflow-style: none;
  scrollbar-width: none;
  scroll-behavior: smooth;
  box-shadow: 1px 1px 6px rgba(0, 0, 0, 0.75);
  display: flex;
  flex-direction: column;
  --panel-color: #808080;
  --border-color: var(--panel-color);
}

.card-data {
  &.faction-guardian {
    --panel-color: #1c6e9f;
  }
  &.faction-seeker {
    --panel-color: #ba6d2a;
  }
  &.faction-rogue {
    --panel-color: #1e6b24;
  }
  &.faction-mystic {
    --panel-color: #554c9e;
  }
  &.faction-survivor {
    --panel-color: #bd2330;
  }
  &.faction-mythos {
    --panel-color: #dbdbdb;
    --border-color: #0a0a0a;
  }
}

.card-data::-webkit-scrollbar {
  display: none;
}

.card-data-header {
  font-size: 1.0em;
  font-family: sans-serif;
  background-color: var(--panel-color);
  padding: 3% 15px;
  border-top-left-radius: 12px;
  border-top-right-radius: 12px;
}

.card-data-body {
  font-size: 0.9em;
  font-family: serif;
  flex: 1;
  padding: 15px;
  background-color: rgba(212, 212, 212, 0.85);
  border-bottom-left-radius: 12px;
  border-bottom-right-radius: 12px;
}

.card-data-body > *:not(:first-child) {
  margin-top: 8px;
}

.card-data-body :deep(span[class$="-icon"]),
.card-data-body :deep(span[class*=" -icon"]) {
  font-size: 1.25em;
}

.card-data-body .card-info {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
}

.card-data-body .card-text {
  border-color: var(--border-color);
  border-left-width: 2px;
  border-left-style: solid;
}

.card-data-body .card-text p {
  margin: 0 8px;
}

.card-data-body .card-flavor {
  font-size: 0.85em;
  font-style: italic;
}

.card-overlay {
  position: fixed;
  z-index: var(--z-card-hover-overlay);
  display: flex;
  width: max-content;
  max-width: calc(100vw - 20px);
  max-height: calc(100dvh - 20px);
  overflow: auto;
  align-items: flex-start;
  overscroll-behavior: contain;
  height: auto;
  top: 0;
  left: 2px;
  pointer-events: auto;
  animation: fadeIn 0.5s;
}
.card-overlay.overPopover {
  z-index: var(--z-card-hover-overlay-over-popover);
}

.card-overlay.sideways {
  /* on narrow portrait screens, allow horizontal scroll if both SVGs visible */
  @media (max-width: 800px) and (orientation: portrait){
    overflow: auto;
  }
}
.card-overlay.tarot {
  height: auto;
  width: max-content;
}

.card-svg {
  filter: drop-shadow(1px 1px 6px rgba(0, 0, 0, 0.75));
  border-radius: 15px;
  width: 300px;
  height: fit-content;
  aspect-ratio: var(--card-aspect);
  overflow: hidden;
}

.reversed, .Reversed { transform: rotateZ(180deg); }

.card-image { position: relative; flex-shrink: 0; }
.card-text-toggle {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 1;
  padding: 5px 10px;
  border: 1px solid #b99d62;
  border-radius: 4px;
  background: rgb(8 24 21 / 0.94);
  color: #f0dfb9;
  font-size: 0.75rem;
  cursor: pointer;
}
.card-text-toggle:focus-visible { outline: 2px solid #f0dfb9; outline-offset: 2px; }

.card-errata {
  width: 300px;
  margin: 8px 0 0;
  padding: 10px 12px;
  border-radius: 8px;
  background: #111827;
  color: #fff7d6;
  font-size: 0.8rem;
  font-weight: 600;
  line-height: 1.3;
  box-shadow: 0 3px 10px #000;
}

.spirit-icon {
  position: absolute;
  bottom: 7%;
  right: 5.1%;
  z-index: var(--z-index-3);
  font-size: 1.7em;
  color: rgba(180, 230, 255, 0.95);
  filter:
    drop-shadow(0 0 1px rgba(0, 0, 0, 0.9))
    drop-shadow(0 1px 2px rgba(0, 0, 0, 0.8))
    drop-shadow(0 0 5px rgba(130, 200, 255, 0.7));
  pointer-events: none;
}

@keyframes fadeIn { 0% { opacity: 0; } 100% { opacity: 1; } }

.crossed-off {
  position: absolute;
  margin-inline: auto;
  inset-inline: 0;
  border-top: 2px solid red;
  width: 33%;
}

.brianBurnham { top: 31.8%; }
.otheraGilman { top: 36.0%; }
.joyceLittle { top: 40.4%; }
.barnabasMarsh { top: 44.2%; }
.zadokAllen { top: 48.5%; }
.robertFriendly { top: 53%; }
.innsmouthJail { top: 65.4%; }
.shorewardSlums { top: 69.5%; }
.sawboneAlley { top: 73.9%; }
.theHouseOnWaterStreet { top: 78%; width: 50%; }
.esotericOrderOfDagon { top: 82.2%; width: 50%; }
.newChurchGreen { top: 86.7%; }

.spent-keys {
  position: absolute;
  bottom: 17%;
  inset-inline: 40px;
  margin-inline: auto;
  display: flex;
  gap: 2px;
}
.spent-keys :deep(img) {
  border-radius: 2px;
  width: 25px;
  height: 25px;
}

.depth {
  left: calc(50% - 20px);
  bottom: 16%;
  position: absolute;
  width: 40px;
}

.isMobile {
  inset: 0 !important;
  margin: auto;
  align-self: center;
  justify-content: center;
  width: fit-content;
}

.playability-panel {
  position: relative;
  width: 240px;
  margin-left: 2px;
  padding: 8px;
  border-radius: 10px;
  background-color: rgba(20, 20, 30, 0.9);
  box-shadow: 1px 1px 6px rgba(0, 0, 0, 0.75);
  align-self: flex-start;
}

.playability-checks {
  list-style: none;
  margin: 0;
  padding: 0;
  font-family: Arial, sans-serif;
  font-size: 0.75em;
}

.playability-checks li {
  display: flex;
  align-items: flex-start;
  gap: 4px;
  padding: 2px 0;
}

.check-passed { color: #4caf50; }
.check-failed { color: #f44336; }

.check-icon { flex-shrink: 0; font-weight: bold; }
.check-body { display: flex; flex-direction: column; flex: 1; min-width: 0; }
.check-name { word-break: break-word; }
.check-detail { font-style: italic; color: #ffb74d; word-break: break-word; }

</style>
