<script lang="ts" setup>
import { clientLog } from '@/utils/clientLog'
import { BookOpen, Zap, Skull, Layers, Archive } from '@lucide/vue'
import { useMediaQuery } from '@vueuse/core'
import UpgradeDeck from '@/arkham/components/UpgradeDeck.vue'
import {
  EyeIcon,
  QuestionMarkCircleIcon,
  ViewColumnsIcon,
  ArchiveBoxXMarkIcon,
  ArrowPathIcon,
} from '@heroicons/vue/20/solid'
import {
  watchEffect,
  watch,
  onMounted,
  onUpdated,
  onBeforeUnmount,
  computed,
  nextTick,
  ref,
  ComputedRef,
  reactive,
  provide,
  inject,
} from 'vue'
import { type Game } from '@/arkham/types/Game'
import type { Investigator as InvestigatorState } from '@/arkham/types/Investigator'
import { type Scenario, usesHardExpertReference } from '@/arkham/types/Scenario'
import { type Story as StoryAttrs } from '@/arkham/types/Story'
import { type Enemy } from '@/arkham/types/Enemy'
import { type ConcealedCard } from '@/arkham/types/ConcealedCard'
import ConcealedCardView from '@/arkham/components/ConcealedCard.vue'
import { type Position } from '@/arkham/types/Placement'
import { type Card, cardId } from '@/arkham/types/Card'
import { TarotCard, tarotCardImage } from '@/arkham/types/TarotCard'
import { TokenType } from '@/arkham/types/Token'
import { ModifierType, Hollow } from '@/arkham/types/Modifier'
import { Source } from '@/arkham/types/Source'
import { type Target } from '@/arkham/types/Target'
import { Message, AbilityMessage, AbilityLabel } from '@/arkham/types/Message'
import { MessageType } from '@/arkham/types/Message'
import { imgsrc, groupBy } from '@/arkham/helpers'
import { cardArt, cardImage as cardImage, investigatorPortrait } from '@/arkham/cardImages'
import { useMenu } from '@/arkham/composables/menu'
import { useCosmicEmissaryCompact } from '@/arkham/composables/useCosmicEmissaryCompact'
import { useLocationActionEdges } from '@/arkham/composables/useLocationActionEdges'
import { useSettings } from '@/stores/settings'
import { keyToId } from '@/arkham/types/Key'
import AbilityButton from '@/arkham/components/AbilityButton.vue'
import Act from '@/arkham/components/Act.vue'
import CardView from '@/arkham/components/Card.vue'
import Draggable from '@/components/Draggable.vue'
import ChaosBag from '@/arkham/components/ChaosBag.vue'
import Agenda from '@/arkham/components/Agenda.vue'
import Investigator from '@/arkham/components/Investigator.vue'
import AssetView from '@/arkham/components/Asset.vue'
import EnemyView from '@/arkham/components/Enemy.vue'
import CardRow from '@/arkham/components/CardRow.vue'
import KeyToken from '@/arkham/components/Key.vue'
import PlayerTabs from '@/arkham/components/PlayerTabs.vue'
import Connections from '@/arkham/components/Connections.vue'
import RainOverlay from '@/arkham/components/RainOverlay.vue'
import { useScenarioRain } from '@/arkham/composables/useScenarioRain'
import { useAtlachNachaLegs } from '@/arkham/composables/useAtlachNachaLegs'
import PoolItem from '@/arkham/components/PoolItem.vue'
import { chaosTokenImage } from '@/arkham/types/ChaosToken'
import { homebrewTotalsTokens } from '@/arkham/homebrewData'
import scenarioMetadata from '@/arkham/data/scenarios'
import EncounterDeck from '@/arkham/components/EncounterDeck.vue'
import VictoryDisplay from '@/arkham/components/VictoryDisplay.vue'
import SkillTest from '@/arkham/components/SkillTest.vue'
import ScenarioDeck from '@/arkham/components/ScenarioDeck.vue'
import CthulhuBoard from '@/arkham/components/TheDrownedCity/CthulhuBoard.vue'
import { isCthulhuBoardEnemyInPlay } from '@/arkham/components/TheDrownedCity/cthulhuBoard'
import ScenarioDebug from '@/arkham/components/ScenarioDebug.vue'
import CardsUnderIndicator from '@/arkham/components/CardsUnderIndicator.vue'
import Story from '@/arkham/components/Story.vue'
import Asset from '@/arkham/components/Asset.vue'
import Location from '@/arkham/components/Location.vue'
import TreacheryView from '@/arkham/components/Treachery.vue'
import { useGameChoices } from '@/arkham/composables/useGameChoices'
import { isMinimizedSkillTestKey, soloKey } from '@/arkham/injectionKeys'
import { useMapViewport } from '@/arkham/composables/useMapViewport'
import ScenarioPhases from '@/arkham/components/ScenarioPhases.vue'
import PhaseInterlude from '@/arkham/components/PhaseInterlude.vue'
import ScenarioMapControls from '@/arkham/components/ScenarioMapControls.vue'
import { setLocationOffset, resetLocationOffsets, updateGameRaw } from '@/arkham/api'
import { useDebug, scenarioHasDebugOptions } from '@/arkham/debug'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { useDbCardStore } from '@/stores/dbCards'
import { IsMobile } from '@/arkham/isMobile'
const { t } = useI18n()

// types
interface RefWrapper<T> {
  ref: ComputedRef<T>
}

const tarotCardBackground = `url(${imgsrc('background.jpg')})`

// Setup
export interface Props {
  game: Game
  scenario: Scenario
  playerId: string
  realityAcidLightDevoured?: boolean
  realityAcidLightActive?: boolean
}
const props = defineProps<Props>()
const allowCurvedPaths = computed(() => {
  const scenarioId = props.scenario.id.replace(/^c(?=:)/, '')
  return scenarioMetadata.find((metadata) => metadata.id === scenarioId)?.allowCurvedPaths === true
})
const emit = defineEmits(['choose', 'update', 'toggleRealityAcidLight'])
const debug = useDebug()
const dbCards = useDbCardStore()
const { addEntry, removeEntry } = useMenu()

const upgradeDeck = computed(() =>
  Object.values(props.game.question).some((q) => q.tag === 'ChooseUpgradeDeck'),
)

// emit helpers
const choose = async (idx: number) => emit('choose', idx)
const update = async (game: Game) => emit('update', game)

//Refs
const settingsStore = useSettings()

const { rainEnabled, rainAvailable, showRain, rainOptions } = useScenarioRain(
  () => props.game,
  () => settingsStore.extraAnimations,
)

useAtlachNachaLegs(() => props.scenario.id)

const { splitView } = storeToRefs(settingsStore)
const { toggleSplitView, setGameId } = settingsStore
const showChaosBag = ref(false)
const showOutOfPlay = ref(false)
const forcedShowOutOfPlay = ref(false)
const hollowedPopoverShown = ref(false)
const showScenarioDebugOptions = ref(false)
const realityAcidLightAnchor = ref<HTMLElement | null>(null)
const realityAcidLightRect = reactive({ left: 0, top: 0, width: 0, height: 0 })
const locationMap = ref<Element | null>(null)
const locationCardsContainer = ref<HTMLElement | null>(null)
const scrollerRef = ref<HTMLElement | null>(null)
const viewingDiscard = ref(false)
const revealingCards = ref(false)
const cardRowTitle = ref('')

const mapTranslation = ref({ x: 0, y: 0 })
const mapMoveMode = ref(false)
const mapResetting = ref(false)
let stagePan: {
  pointerId: number
  startX: number
  startY: number
  baseX: number
  baseY: number
  moved: boolean
} | null = null
let suppressNextStageClick = false

function updateRealityAcidLightRect() {
  const rect = (
    realityAcidLightAnchor.value ??
    document.querySelector<HTMLElement>('.reality-acid-light-switch-anchor')
  )?.getBoundingClientRect()
  realityAcidLightRect.left = rect?.left ?? 0
  realityAcidLightRect.top = rect?.top ?? 0
  realityAcidLightRect.width = rect?.width ?? 0
  realityAcidLightRect.height = rect?.height ?? 0
}

const {
  zoom,
  onWheel: onMapWheel,
  toggleZoom,
  updateScrollMargins,
  doubleZoomActive,
} = useMapViewport({
  gameId: () => props.game.id,
  scroller: scrollerRef,
  grid: locationMap,
  investigatorLocationId: () =>
    Object.values(props.game.investigators).find((i) => i.playerId === props.playerId)?.location ??
    null,
})

const locationsUnlocked = ref(false)
const locationsFullscreen = ref(false)
function onFullscreenKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && locationsFullscreen.value) {
    locationsFullscreen.value = false
  }
}
const draggingLocationId = ref<string | null>(null)
// Optimistic offsets after a drop, kept until the server echoes them back.
// Stored in canonical (rotationSteps=0) coordinates, same as the backend.
const pendingOffsets = ref<Record<string, { x: number; y: number }>>({})

// Plain (non-reactive) drag state. Mutated on every pointermove without
// triggering Vue re-renders; the live drag visual is applied via direct DOM.
type DragInternal = {
  locationId: string
  element: HTMLElement
  pointerId: number
  startX: number
  startY: number
  // Canonical base offset (matches what's stored on the backend).
  baseCanonicalX: number
  baseCanonicalY: number
  // Pre-drag screen-space offset = displayOffset(base).
  baseScreenX: number
  baseScreenY: number
  // Updated canonical offset after current drag delta (used by Vue fallback
  // path if a mid-drag render happens).
  canonicalFinalX: number
  canonicalFinalY: number
  // Capture rotation at start so mid-drag rotation changes don't desync.
  rotationAtStart: number
  moved: boolean
}
let dragInternal: DragInternal | null = null
const DRAG_THRESHOLD_PX = 3

// Measured location-cell dimensions (in unscaled CSS px). Updated after layout
// changes so the rotation math can compensate for non-square cells: the grid
// reshuffles via grid-template-areas (cells don't visually rotate), so a
// "1 cell right" displacement before rotation isn't the same pixel distance as
// "1 cell down" after rotation when cells aren't square.
const cellDimensions = ref<{ w: number; h: number }>({ w: 1, h: 1 })

function updateCellDimensions() {
  nextTick(() => {
    const cell = document.querySelector('.location-cell') as HTMLElement | null
    if (!cell) return
    const rect = cell.getBoundingClientRect()
    const scale = zoom.value || 1
    if (rect.width > 0 && rect.height > 0) {
      cellDimensions.value = { w: rect.width / scale, h: rect.height / scale }
    }
  })
}

// Screen-space 90° CW rotation in pixels, with aspect-ratio correction so
// "N cells worth of horizontal pixels" maps to "N cells worth of vertical
// pixels" after rotation (and vice versa). For square cells this reduces to
// the plain (-y, x) matrix; for rectangular cells it preserves the visual
// relationship between cells across rotations. 180° always yields (-x, -y)
// regardless of aspect ratio, which is why 180° looked right with the naive
// matrix while 90°/270° looked off.
function rotateOffset(off: { x: number; y: number }, steps: number): { x: number; y: number } {
  const k = ((steps % 4) + 4) % 4
  const { w, h } = cellDimensions.value
  const ratio = w > 0 && h > 0 ? w / h : 1
  let { x, y } = off
  for (let i = 0; i < k; i++) {
    const nx = -y * ratio
    const ny = x / ratio
    x = nx
    y = ny
  }
  return { x, y }
}

const locationOffsets = computed<Record<string, { x: number; y: number }>>(() => {
  // Iterate props.game.locations directly so this computed doesn't depend on
  // the `locations` ref (which is declared later in this setup script and
  // would otherwise TDZ when the watch below registers its source eagerly).
  const offsets: Record<string, { x: number; y: number }> = {}
  for (const loc of Object.values(props.game.locations)) {
    for (const m of loc.modifiers ?? []) {
      if (m.type.tag !== 'UIModifier') continue
      const c = m.type.contents as any
      if (c && typeof c === 'object' && c.tag === 'Positioned') {
        offsets[loc.id] = { x: c.x, y: c.y }
      }
    }
  }
  return offsets
})

const locationGridOffsets = computed<Record<string, { column: number; row: number }>>(() => {
  const offsets: Record<string, { column: number; row: number }> = {}
  for (const loc of Object.values(props.game.locations)) {
    for (const m of loc.modifiers ?? []) {
      if (m.type.tag !== 'UIModifier') continue
      const c = m.type.contents as any
      if (c && typeof c === 'object' && c.tag === 'GridOffset') {
        offsets[loc.id] = { column: c.columnOffset, row: c.rowOffset }
      }
    }
  }
  return offsets
})

const hasAnyOffset = computed(
  () =>
    Object.keys(locationOffsets.value).length > 0 || Object.keys(pendingOffsets.value).length > 0,
)

// Padding to extend the scroll area so dragged locations near the edges
// aren't clipped. Transforms don't expand the parent's layout box, so we
// measure each moved cell's actual displaced position against the grid's
// content bounds and only add padding for real overflow — a location moved
// "into" the grid (e.g. a bottom-row cell nudged up) shouldn't grow padding.
const layoutPadding = ref({ left: 0, right: 0, top: 0, bottom: 0 })

async function updateLayoutPadding() {
  await nextTick()
  const grid = (locationMap.value as any)?.$el ?? (locationMap.value as HTMLElement | null)
  if (!grid) return

  const current = layoutPadding.value
  const allOffsets: Record<string, { x: number; y: number }> = {}
  const offsetLocationIds = new Set([
    ...Object.keys(locationOffsets.value),
    ...Object.keys(pendingOffsets.value),
    ...Object.keys(locationGridOffsets.value),
  ])
  for (const id of offsetLocationIds) {
    const userOffset = pendingOffsets.value[id] ?? locationOffsets.value[id] ?? { x: 0, y: 0 }
    const gridOffset = locationGridOffsets.value[id] ?? { column: 0, row: 0 }
    allOffsets[id] = {
      x: userOffset.x + gridOffset.column * (cellDimensions.value.w + 20),
      y: userOffset.y + gridOffset.row * (cellDimensions.value.h + 20),
    }
  }

  if (offsetLocationIds.size === 0) {
    if (current.left || current.right || current.top || current.bottom) {
      layoutPadding.value = { left: 0, right: 0, top: 0, bottom: 0 }
    }
    return
  }

  const contentWidth = grid.clientWidth - current.left - current.right
  const contentHeight = grid.clientHeight - current.top - current.bottom

  let left = 0,
    right = 0,
    top = 0,
    bottom = 0
  const cells = grid.querySelectorAll('.location-cell[data-location-id]') as NodeListOf<HTMLElement>
  for (const cell of cells) {
    const id = cell.dataset.locationId
    if (!id) continue
    const offset = allOffsets[id]
    if (!offset) continue

    const rot = rotateOffset(offset, rotationSteps.value)
    // offsetLeft/offsetTop are relative to the offset parent's border box and
    // ignore CSS transforms, so they give us the cell's natural grid position
    // *including* the grid's current padding — subtract it to get content-area
    // coords, which are stable across padding updates.
    const cellLeft = cell.offsetLeft - current.left + rot.x
    const cellTop = cell.offsetTop - current.top + rot.y
    const cellRight = cellLeft + cell.offsetWidth
    const cellBottom = cellTop + cell.offsetHeight

    if (cellLeft < 0) left = Math.max(left, -cellLeft)
    if (cellTop < 0) top = Math.max(top, -cellTop)
    if (cellRight > contentWidth) right = Math.max(right, cellRight - contentWidth)
    if (cellBottom > contentHeight) bottom = Math.max(bottom, cellBottom - contentHeight)
  }

  if (
    left !== current.left ||
    right !== current.right ||
    top !== current.top ||
    bottom !== current.bottom
  ) {
    layoutPadding.value = { left, right, top, bottom }
  }
}

// Returns the CANONICAL offset for a location (server-side coordinate frame).
function effectiveOffset(locationId: string): { x: number; y: number } {
  if (dragInternal && dragInternal.locationId === locationId && dragInternal.moved) {
    return { x: dragInternal.canonicalFinalX, y: dragInternal.canonicalFinalY }
  }
  return pendingOffsets.value[locationId] ?? locationOffsets.value[locationId] ?? { x: 0, y: 0 }
}

// Returns only the user-offset transform. Grid placement lives on the wrapper
// `.location-cell` so Vue's TransitionGroup FLIP can animate the wrapper
// without clobbering this transform during rotation reshuffles.
function locationOffsetStyle(location: { id: string }) {
  const userOffset = effectiveOffset(location.id)
  const gridOffset = locationGridOffsets.value[location.id] ?? { column: 0, row: 0 }
  const canonical = {
    x: userOffset.x + gridOffset.column * (cellDimensions.value.w + 20),
    y: userOffset.y + gridOffset.row * (cellDimensions.value.h + 20),
  }
  // Apply the user's current rotation so the offset moves with the rotated
  // layout instead of staying in absolute screen space.
  const off = rotateOffset(canonical, rotationSteps.value)
  const style: Record<string, string> = {}
  if (off.x !== 0 || off.y !== 0) {
    style.transform = `translate(${off.x}px, ${off.y}px)`
  }
  return style
}

function onLocationPointerDown(event: PointerEvent, location: { id: string }) {
  if (!locationsUnlocked.value) return
  event.preventDefault()
  event.stopPropagation()
  const element = event.currentTarget as HTMLElement | null
  if (!element) return
  const baseCanonical = effectiveOffset(location.id)
  const baseScreen = rotateOffset(baseCanonical, rotationSteps.value)
  dragInternal = {
    locationId: location.id,
    element,
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    baseCanonicalX: baseCanonical.x,
    baseCanonicalY: baseCanonical.y,
    baseScreenX: baseScreen.x,
    baseScreenY: baseScreen.y,
    canonicalFinalX: baseCanonical.x,
    canonicalFinalY: baseCanonical.y,
    rotationAtStart: rotationSteps.value,
    moved: false,
  }
  window.addEventListener('pointermove', onWindowPointerMove, { passive: true })
  window.addEventListener('pointerup', onWindowPointerUp, { passive: true })
  window.addEventListener('pointercancel', onWindowPointerUp, { passive: true })
}

function onWindowPointerMove(event: PointerEvent) {
  if (!dragInternal || dragInternal.pointerId !== event.pointerId) return
  const scale = zoom.value || 1
  const screenDx = (event.clientX - dragInternal.startX) / scale
  const screenDy = (event.clientY - dragInternal.startY) / scale
  if (
    !dragInternal.moved &&
    Math.hypot(event.clientX - dragInternal.startX, event.clientY - dragInternal.startY) >
      DRAG_THRESHOLD_PX
  ) {
    dragInternal.moved = true
    draggingLocationId.value = dragInternal.locationId
  }
  if (dragInternal.moved) {
    // Live visual: screen-space delta on top of pre-drag screen position.
    const screenX = dragInternal.baseScreenX + screenDx
    const screenY = dragInternal.baseScreenY + screenDy
    dragInternal.element.style.transform = `translate(${screenX}px, ${screenY}px)`
    // Mirror it in canonical coords (inverse rotation) for commit + fallback.
    const canonicalDelta = rotateOffset({ x: screenDx, y: screenDy }, -dragInternal.rotationAtStart)
    dragInternal.canonicalFinalX = dragInternal.baseCanonicalX + canonicalDelta.x
    dragInternal.canonicalFinalY = dragInternal.baseCanonicalY + canonicalDelta.y
  }
}

function onWindowPointerUp(event: PointerEvent) {
  if (!dragInternal || dragInternal.pointerId !== event.pointerId) return
  const drag = dragInternal
  dragInternal = null
  window.removeEventListener('pointermove', onWindowPointerMove)
  window.removeEventListener('pointerup', onWindowPointerUp)
  window.removeEventListener('pointercancel', onWindowPointerUp)
  draggingLocationId.value = null
  if (!drag.moved) return
  // Stash the drop position before the next render so the inline style stays
  // at the drop point until the server echoes the new modifier back.
  pendingOffsets.value = {
    ...pendingOffsets.value,
    [drag.locationId]: { x: drag.canonicalFinalX, y: drag.canonicalFinalY },
  }
  nextTick(() => window.dispatchEvent(new Event('arkham-location-layout-change')))
  void setLocationOffset(
    props.game.id,
    drag.locationId,
    drag.canonicalFinalX,
    drag.canonicalFinalY,
  ).finally(() => nextTick(() => window.dispatchEvent(new Event('arkham-location-layout-change'))))
}

// Drop a pending entry once the server's modifier confirms it.
watch(
  locationOffsets,
  (newServer) => {
    if (Object.keys(pendingOffsets.value).length === 0) return
    const next = { ...pendingOffsets.value }
    let changed = false
    for (const id of Object.keys(next)) {
      const server = newServer[id]
      if (
        server &&
        Math.abs(server.x - next[id].x) < 0.5 &&
        Math.abs(server.y - next[id].y) < 0.5
      ) {
        delete next[id]
        changed = true
      }
    }
    if (changed) {
      pendingOffsets.value = next
      nextTick(() => window.dispatchEvent(new Event('arkham-location-layout-change')))
    }
  },
  { deep: true },
)

function cancelActiveDrag() {
  if (!dragInternal) return
  window.removeEventListener('pointermove', onWindowPointerMove)
  window.removeEventListener('pointerup', onWindowPointerUp)
  window.removeEventListener('pointercancel', onWindowPointerUp)
  dragInternal.element.style.transform = ''
  dragInternal = null
  draggingLocationId.value = null
}

function toggleLocationsUnlocked() {
  locationsUnlocked.value = !locationsUnlocked.value
  if (!locationsUnlocked.value) cancelActiveDrag()
  nextTick(() => window.dispatchEvent(new Event('arkham-location-layout-change')))
}

function suppressLocationInteractionWhenUnlocked(event: MouseEvent) {
  if (!locationsUnlocked.value) return
  event.preventDefault()
  event.stopPropagation()
  event.stopImmediatePropagation()
}

async function resetLocationsLayout() {
  if (mapResetting.value) return
  mapResetting.value = true
  cancelActiveDrag()
  if (stagePan && scrollerRef.value?.hasPointerCapture(stagePan.pointerId)) {
    scrollerRef.value.releasePointerCapture(stagePan.pointerId)
  }
  stagePan = null
  mapMoveMode.value = false
  try {
    if (hasAnyOffset.value) {
      await resetLocationOffsets(props.game.id)
      pendingOffsets.value = Object.fromEntries(locations.value.map(location => [location.id, { x: 0, y: 0 }]))
    }
    if (props.scenario.id === 'c10651') {
      clearCosmicEmissaryCompactStyles()
      requestCosmicEmissaryCompact(true)
    }
    mapTranslation.value = { x: 0, y: 0 }
    zoom.value = 1
    doubleZoomActive.value = false
    await nextTick()
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
    const scroller = scrollerRef.value
    if (!scroller) return
    scroller.scrollLeft = 0
    scroller.scrollTop = 0
    const cardBounds = () => Array.from(scroller.querySelectorAll<HTMLElement>('.location-wrapper'))
      .map(el => el.getBoundingClientRect()).filter(r => r.width > 0 && r.height > 0)
    let rects = cardBounds()
    if (!rects.length) return
    const width = Math.max(...rects.map(r => r.right)) - Math.min(...rects.map(r => r.left))
    const height = Math.max(...rects.map(r => r.bottom)) - Math.min(...rects.map(r => r.top))
    zoom.value = Math.max(0.1, Math.min(1, (scroller.clientWidth - 96) / width, (scroller.clientHeight - 96) / height))
    await nextTick()
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
    rects = cardBounds()
    const viewport = scroller.getBoundingClientRect()
    mapTranslation.value = {
      x: viewport.left + scroller.clientWidth / 2 - (Math.min(...rects.map(r => r.left)) + Math.max(...rects.map(r => r.right))) / 2,
      y: viewport.top + scroller.clientHeight / 2 - (Math.min(...rects.map(r => r.top)) + Math.max(...rects.map(r => r.bottom))) / 2,
    }
    window.dispatchEvent(new Event('arkham-location-layout-change'))
  } catch (err) {
    console.error('[scenario] could not reset location offsets', err)
  } finally {
    mapResetting.value = false
  }
}

const { isMobile } = IsMobile()
onMounted(() => clientLog('scenario.mount', { mobile: isMobile.value }))
onBeforeUnmount(() => clientLog('scenario.unmount'))
watch(isMobile, (mobile) => clientLog('scenario.viewport', { mobile, width: window.innerWidth, height: window.innerHeight }))

function proxyClippedLocationClick(event: MouseEvent) {
  if (event.defaultPrevented || event.button !== 0) return

  const target = event.target as HTMLElement | null
  if (!target?.closest('.location-cards-container')) return
  if (
    target.closest(
      '.location-cell, .draggable, button, a, input, select, textarea, [role="button"]',
    )
  )
    return

  const cell = [...document.querySelectorAll<HTMLElement>('.location-cell--can-interact')].find(
    (el) => {
      const rects = [
        el,
        ...el.querySelectorAll<HTMLElement>('.location-wrapper, .location, .card-frame'),
      ]
        .map((node) => node.getBoundingClientRect())
        .filter((rect) => rect.width > 0 && rect.height > 0)

      return rects.some(
        (rect) =>
          event.clientX >= rect.left &&
          event.clientX <= rect.right &&
          event.clientY >= rect.top &&
          event.clientY <= rect.bottom,
      )
    },
  )

  if (!cell) return

  const clickTarget =
    cell.querySelector<HTMLElement>('.card-frame') ??
    cell.querySelector<HTMLElement>('.location') ??
    cell
  event.preventDefault()
  event.stopPropagation()
  clickTarget.dispatchEvent(
    new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      clientX: event.clientX,
      clientY: event.clientY,
      ctrlKey: event.ctrlKey,
      shiftKey: event.shiftKey,
      altKey: event.altKey,
      metaKey: event.metaKey,
    }),
  )
}

function onStagePointerDown(event: PointerEvent) {
  if (event.button !== 0) return
  const scroller = scrollerRef.value
  if (!scroller) return
  const target = event.target as HTMLElement | null
  if (
    !mapMoveMode.value && target?.closest(
      [
        'button',
        'a',
        'input',
        'select',
        'textarea',
        '[role="button"]',
        '.card',
        '.card-frame',
        '.enemy',
        '.enemy--outer',
        '.swarm-button-wrap',
        '.v-popper__popper',
      ].join(', '),
    )
  )
    return
  if (mapMoveMode.value) {
    event.preventDefault()
    event.stopPropagation()
  }

  // Do NOT capture the pointer here. Capturing on pointerdown retargets the
  // browser-synthesized click to the scroller, swallowing clicks on any board
  // element that hasn't handled the pointerdown itself. We only capture once a
  // real drag begins (see onStagePointerMove), so a stationary click always
  // reaches whatever it lands on.
  stagePan = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    baseX: mapTranslation.value.x,
    baseY: mapTranslation.value.y,
    moved: false,
  }
}

function onStagePointerMove(event: PointerEvent) {
  if (!stagePan || stagePan.pointerId !== event.pointerId) return
  const scroller = scrollerRef.value
  if (!scroller) return
  const dx = event.clientX - stagePan.startX
  const dy = event.clientY - stagePan.startY
  if (!stagePan.moved && Math.hypot(dx, dy) > DRAG_THRESHOLD_PX) {
    stagePan.moved = true
    // Capture now that this is a real drag, so we keep receiving move/up events
    // even if the pointer leaves the scroller. A click that never dragged is
    // never captured, so it isn't swallowed.
    scroller.setPointerCapture(event.pointerId)
  }
  if (!stagePan.moved) return
  event.preventDefault()
  mapTranslation.value = { x: stagePan.baseX + dx, y: stagePan.baseY + dy }
}

function onStagePointerUp(event: PointerEvent) {
  if (!stagePan || stagePan.pointerId !== event.pointerId) return
  const scroller = scrollerRef.value
  if (scroller?.hasPointerCapture(event.pointerId)) scroller.releasePointerCapture(event.pointerId)
  suppressNextStageClick = stagePan.moved
  stagePan = null
}

function onStageClick(event: MouseEvent) {
  if (!suppressNextStageClick && !mapMoveMode.value) return
  suppressNextStageClick = false
  event.preventDefault()
  event.stopPropagation()
}

// callbacks
onMounted(() => {
  setGameId(props.game.id)
  window.addEventListener('resize', updateRealityAcidLightRect)
  window.addEventListener('scroll', updateRealityAcidLightRect, true)
  document.addEventListener('click', proxyClippedLocationClick, true)
  window.addEventListener('keydown', onFullscreenKeydown)
  nextTick(updateRealityAcidLightRect)
  updateScrollMargins()
  updateCellDimensions()
  updateLayoutPadding()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', updateRealityAcidLightRect)
  window.removeEventListener('scroll', updateRealityAcidLightRect, true)
  document.removeEventListener('click', proxyClippedLocationClick, true)
  window.removeEventListener('keydown', onFullscreenKeydown)
  stagePan = null
  suppressNextStageClick = false
  cancelActiveDrag()
})

onUpdated(() => {
  updateRealityAcidLightRect()
})

// Menu
addEntry({
  id: 'viewChaosBag',
  icon: QuestionMarkCircleIcon,
  content: t('gameBar.viewChaosBag'),
  shortcut: 'c',
  nested: 'view',
  action: () => (showChaosBag.value = !showChaosBag.value),
})

addEntry({
  id: 'splitView',
  icon: ViewColumnsIcon,
  content: t('gameBar.splitView'),
  nested: 'view',
  action: toggleSplitView,
})

addEntry({
  id: 'viewRemovedFromPlay',
  icon: ArchiveBoxXMarkIcon,
  content: 'View removed from Play',
  nested: 'view',
  action: () => showRemovedFromPlay(),
})

addEntry({
  id: 'rotateLayout',
  icon: ArrowPathIcon,
  content: t('gameBar.rotateLayout'),
  shortcut: '>',
  nested: 'view',
  action: () => {
    rotationSteps.value = (rotationSteps.value + 1) % 4
  },
})

addEntry({
  id: 'rotateLayoutCounterClockwise',
  icon: ArrowPathIcon,
  content: t('gameBar.rotateLayout'),
  shortcut: '<',
  nested: 'hidden',
  action: () => {
    rotationSteps.value = (rotationSteps.value - 1) % 4
  },
})

// Computed
const pendingScenarioDifficulty = ref<string | null>(null)
const displayedScenarioDifficulty = computed(
  () => pendingScenarioDifficulty.value ?? props.scenario.difficulty,
)
watch(
  () => props.scenario.difficulty,
  (difficulty) => {
    if (pendingScenarioDifficulty.value === difficulty) pendingScenarioDifficulty.value = null
  },
)

const scenarioGuide = computed(() => {
  const { reference } = props.scenario
  const hardExpertSide = usesHardExpertReference(props.scenario, displayedScenarioDifficulty.value)
  const referenceCode = reference.replace(/^c/, '')
  const referenceBase = referenceCode.replace(/b$/, '')

  if (props.scenario.id === 'c10501' || referenceBase === '10501' || referenceBase === '10502') {
    const referenceSide = referenceCode.endsWith('b') ? 'b' : ''
    const writtenInRockReference = hardExpertSide ? '10502' : '10501'
    return cardImage(`${writtenInRockReference}${referenceSide}`)
  }

  const difficultySuffix = hardExpertSide ? 'b' : ''
  return cardImage(reference, difficultySuffix)
})

const changeScenarioDifficulty = (event: Event) => {
  const difficulty = (event.target as HTMLSelectElement).value
  pendingScenarioDifficulty.value = difficulty
  debug.send(props.game.id, { tag: 'SetScenarioDifficulty', contents: difficulty })
}

const additionalReferences = computed(() => {
  return props.scenario.additionalReferences.map((s) => cardImage(s))
})
const abyssIsLocation = computed(
  () => props.scenario.id === 'c10651' && props.scenario.meta?.abyssIsLocation === true,
)

const abyssDeckCount = computed(
  () => props.scenario.decks?.find(([key]) => key === 'AbyssDeck')?.[1]?.length ?? 0,
)

const scenarioDecks = computed(() => {
  if (!props.scenario.decks) return null
  return Object.entries(props.scenario.decks).filter(
    ([, scenarioDeck]) => !(abyssIsLocation.value && scenarioDeck[0] === 'AbyssDeck'),
  )
})

const hideEncounterDeck = computed(() => props.scenario.id === 'c10651')

const scenarioDeckDiscard = (key: string) => {
  const discards = props.scenario.deckDiscards
  if (!discards) return undefined
  const entry = discards.find(([k]) => k === key)
  return entry ? entry[1] : undefined
}

const isVertical = function (area: string) {
  const [start, end] = area.split('--')
  const startLocation = locations.value.find((l) => l.id === start)
  const endLocation = locations.value.find((l) => l.id === end)

  if (!startLocation || !endLocation) return false

  return (
    startLocation.label[startLocation.label.length - 1] !==
    endLocation.label[endLocation.label.length - 1]
  )
}

const barriers = computed(() => props.scenario.meta?.barriers)

function isAbility(v: Message): v is AbilityLabel {
  if (v.tag !== MessageType.ABILITY_LABEL) {
    return false
  }

  const { source } = v.ability
  // Ultimatums/Boons are global pseudo-entities with no board presence; their
  // ability buttons render on the scenario card like scenario abilities do.
  return (
    source.sourceTag === 'OtherSource' &&
    (source.tag === 'ScenarioSource' || source.tag === 'UltimatumOrBoonSource')
  )
}

const abilities = computed(() => {
  return choices.value.reduce<AbilityMessage[]>((acc, v, i) => {
    if (isAbility(v)) {
      return [...acc, { contents: v, displayAsAction: false, index: i }]
    }

    return acc
  }, [])
})

interface ScenarioBadge {
  key: string
  icon: string
  label: string
  detail?: string
}

const scenarioBadges = computed<ScenarioBadge[]>(() => {
  if (props.scenario.id !== 'c85001') return []

  const badges: ScenarioBadge[] = []
  if (props.scenario.meta?.foodAndDrinksActive === true) {
    const damage =
      typeof props.scenario.meta.foodAndDrinksDamageDealt === 'number'
        ? props.scenario.meta.foodAndDrinksDamageDealt
        : 0
    badges.push({
      key: 'foodAndDrinks',
      icon: '🚫🍔',
      label: 'No food or drinks',
      detail: `${Math.min(damage, 3)}/3 damage dealt to Subject 8L-08`,
    })
  }

  if (props.scenario.meta?.languageActive === true) {
    badges.push({
      key: 'language',
      icon: '🗣️?',
      label: 'Gibberish only',
      detail: 'The concept of language is devoured until the end of the investigation phase.',
    })
  }

  if (props.scenario.meta?.friendshipsActive === true) {
    badges.push({
      key: 'friendships',
      icon: '🤝⃠',
      label: 'No cross-commits',
      detail: 'Friendships are devoured until the end of the round.',
    })
  }

  if (props.scenario.meta?.senseOfTimeActive === true) {
    badges.push({
      key: 'senseOfTime',
      icon: '🚫⏱️',
      label: 'No timekeeping',
      detail:
        'Until the agenda advances, investigators cannot use time-keeping devices, ask about the time, or trigger abilities on cards with “time,” “watch,” or “chrono” in their title.',
    })
  }

  if (props.scenario.meta?.discardPileActive === true) {
    badges.push({
      key: 'discardPile',
      icon: '🗑️🫥',
      label: 'No discard piles',
      detail:
        'Until the end of the next mythos phase, cards that would be placed in an investigator discard pile are devoured instead.',
    })
  }

  const voiceActive = props.scenario.meta?.voiceActive
  if (Array.isArray(voiceActive) && voiceActive.length > 0) {
    const names = voiceActive
      .map((iid) => props.game.investigators[iid]?.name?.title)
      .filter(Boolean)
    badges.push({
      key: 'voice',
      icon: '🤐',
      label: names.length === 1 ? `${names[0]} cannot speak` : 'No speaking/noise',
      detail:
        names.length > 0
          ? names.join(', ')
          : 'One or more investigators cannot speak or make noise until the end of the round.',
    })
  }

  return badges
})

const heededDanielsWarning = computed(() =>
  props.game.campaign?.id === '03' || props.game.campaign?.id === '52'
    ? props.game.campaign.log.recorded.some(
        (r) => r.tag === 'ThePathToCarcosaKey' && r.contents === 'YouHeadedDanielsWarning',
      )
    : false,
)
const hasturSpeaker = computed(() => {
  const investigators = Object.values(props.game.investigators).filter(
    (i) => !i.eliminated && !i.defeated,
  )
  return investigators.find((i) => i.playerId === props.playerId) ?? investigators[0] ?? null
})
const spokenHasturTooltip = computed(() => {
  const name = hasturSpeaker.value?.name.title ?? 'an investigator'
  return `Record that ${name} spoke HASTUR aloud and take 1 horror.`
})

async function recordSpokenHastur() {
  const investigatorId = hasturSpeaker.value?.id
  if (!investigatorId) return

  await updateGameRaw(props.game.id, {
    tag: 'InvestigatorMessage',
    contents: {
      tag: 'InvestigatorAssignDamage_',
      contents: [investigatorId, { tag: 'CampaignSource' }, { tag: 'DamageAny' }, 0, 1],
    },
  })
}

// The rain switch lives in this bar, so the bar has to appear for it even when
// there are no other badges and no reality-acid switch.
const showScenarioNotifierBar = computed(
  () =>
    scenarioBadges.value.length > 0 ||
    props.realityAcidLightDevoured === true ||
    rainAvailable.value,
)

watch(
  () => [props.realityAcidLightDevoured, props.realityAcidLightActive, scenarioBadges.value.length],
  () => {
    nextTick(updateRealityAcidLightRect)
    setTimeout(updateRealityAcidLightRect, 50)
  },
  { immediate: true, flush: 'post' },
)

const rotationSteps = ref(0)
const transpose = <T,>(grid: T[][]): T[][] =>
  (grid[0] ?? []).map((_col, i) => grid.map((row) => row[i]))

const rotateClockwise = <T,>(grid: T[][]): T[][] => transpose([...grid].reverse())

const rotateCounterClockwise = <T,>(grid: T[][]): T[][] => [...transpose(grid)].reverse()

const rotateNTimes = <T,>(grid: T[][], steps: number): T[][] => {
  const k = ((steps % 4) + 4) % 4
  switch (k) {
    case 0:
      return grid
    case 1:
      return rotateClockwise(grid)
    case 2:
      return rotateClockwise(rotateClockwise(grid))
    case 3:
      return rotateCounterClockwise(grid)
    default:
      return grid
  }
}
const gridAreas = computed(() => {
  const { locationLayout } = props.scenario
  if (!locationLayout) return null

  // fast path when no barriers meta
  if (!barriers.value) {
    const normalizeRow = (row: string): string[] => row.trim().split(/\s+/)
    const baseRows: string[][] = locationLayout.map(normalizeRow)
    const rotatedRows = rotateNTimes(baseRows, rotationSteps.value)
    return rotatedRows.map((r) => `"${r.join(' ')}"`).join(' ')
  }

  const grid: any = {}
  for (const l of locations.value) grid[l.label] = l.id

  const cleanedRows = locationLayout.map((r) => r.split(' '))
  const withHoriz: string[][] = []
  for (const row of cleanedRows) {
    const newRow: string[] = []
    for (let c = 0; c < row.length; c++) {
      const a = row[c]
      newRow.push(a)
      if (c < row.length - 1) {
        const b = row[c + 1]
        const idA = grid[a],
          idB = grid[b]
        newRow.push(idA && idB ? `barrier-${[idA, idB].sort().join('--')}` : '.')
      }
    }
    withHoriz.push(newRow)
  }
  const finalRows: string[][] = []
  for (let r = 0; r < withHoriz.length; r++) {
    const row = withHoriz[r]
    finalRows.push(row)
    if (r < withHoriz.length - 1) {
      const next = withHoriz[r + 1]
      let need = false
      const barrierRow = row.map((_cell, idx) => {
        const a = row[idx],
          b = next[idx]
        const idA = grid[a],
          idB = grid[b]
        const v = idA && idB ? `barrier-${[idA, idB].sort().join('--')}` : '.'
        if (v !== '.') need = true
        return v
      })
      if (need) finalRows.push(barrierRow)
    }
  }
  const rotatedRows = rotateNTimes(finalRows, rotationSteps.value)
  return rotatedRows.map((r) => `"${r.join(' ')}"`).join(' ')
})

// transform: scale() is used rather than CSS zoom because it is handled consistently
// by getBoundingClientRect() in all browsers. The scroll area doesn't follow transform
// automatically, so we set margins after each render to compensate.
const locationStyles = computed(() => {
  const pad = layoutPadding.value
  const mobileEdgePadding = isMobile.value ? 140 : 0
  return {
    display: 'grid',
    gap: '20px',
    'grid-template-areas': gridAreas.value ?? '',
    gridAutoColumns: 'max-content',
    gridAutoRows: 'max-content',
    transform: `scale(${zoom.value})`,
    transformOrigin: zoom.value >= 1 ? '0 0' : 'center center',
    paddingLeft: `${pad.left + mobileEdgePadding}px`,
    paddingRight: `${pad.right + mobileEdgePadding}px`,
    paddingTop: `${pad.top}px`,
    paddingBottom: `${pad.bottom}px`,
  }
})

const scenarioDeckStyles = computed(() => {
  const { decksLayout } = props.scenario
  return {
    display: 'grid',
    'grid-template-areas': decksLayout.map((row) => `"${row}"`).join(' '),
    'grid-row-gap': '10px',
  }
})
const soloMode = inject(soloKey, ref(false))
const players = computed(() => props.game.investigators)
const playerOrder = computed(() => props.game.playerOrder)
const multiSeatBoard = computed(() => playerOrder.value.length > 1)
const encounterPilesHost = ref<HTMLElement | null>(null)
const desktopTable = useMediaQuery('(min-width: 1200px)')
// The single-seat desktop layout is retired: from 1200px up every game uses the
// tabletop arrangement, whatever the seat count. `multiSeatBoard` stays for the
// things that genuinely need more than one seat (the teammate rail).
const desktopTabletop = computed(() => desktopTable.value || (multiSeatBoard.value && !isMobile.value))
const mobilePanel = ref<'map' | 'player' | 'scenario' | 'team'>('map')
const navigationSummaryHost = ref<HTMLElement | null>(null)
onMounted(() => {
  navigationSummaryHost.value = document.getElementById('table-navigation-summary')
})
const summaryInNavigation = computed(() => desktopTable.value && !!navigationSummaryHost.value)
const scenarioAccessoriesOpen = ref(false)
// Solo multi-control keeps every investigator in one user's hands, so the seat
// tabs alone are enough to move between them. Separate seats are other people's
// investigators: they only ever expose public information.
const onlineMultiSeat = computed(() => multiSeatBoard.value && !soloMode.value)
const activeInvestigator = computed(
  () => props.game.investigators[props.game.activeInvestigatorId] ?? null,
)
function displayInvestigatorName(investigator: InvestigatorState): string {
  const dbCard = dbCards.getDbCard(cardArt(investigator.cardCode))
  const title = dbCard?.name ?? dbCards.getCardName(investigator.name.title, 'investigator')
  const subtitle = dbCard?.subname ?? investigator.name.subtitle
  return subtitle ? `${title}: ${subtitle}` : title
}
const localizedScenarioName = computed(() => {
  const dbCard = dbCards.getDbCard(cardArt(props.scenario.reference))
  return {
    title: dbCard?.name ?? props.scenario.name.title,
    subtitle: dbCard?.subname ?? props.scenario.name.subtitle,
  }
})
const currentAgenda = computed(() => Object.values(props.game.agendas)[0] ?? null)
const currentAct = computed(() => Object.values(props.game.acts)[0] ?? null)
const orderedInvestigators = computed(() =>
  playerOrder.value
    .map((investigatorId) => players.value[investigatorId])
    .filter((investigator): investigator is InvestigatorState => Boolean(investigator)),
)
const investigatorToken = (investigator: InvestigatorState, token: keyof typeof TokenType) =>
  investigator.tokens[token] ?? 0
const investigatorLocation = (investigator: InvestigatorState) =>
  (() => {
    const location = props.game.locations[investigator.location]
    if (!location?.revealed) return t('multiplayerTable.locationUnknown')
    return dbCards.getDbCard(cardArt(location.cardCode))?.name ?? location.label
  })()
const investigatorAssets = (investigator: InvestigatorState) =>
  investigator.assets.map((assetId) => props.game.assets[assetId]).filter(Boolean)
const investigatorEnemies = (investigator: InvestigatorState) =>
  investigator.engagedEnemies.map((enemyId) => props.game.enemies[enemyId]).filter(Boolean)
// The threat area also holds the treacheries attached to the investigator, which
// is what usually tells a teammate whether someone needs help.
const investigatorTreacheries = (investigator: InvestigatorState) =>
  investigator.treacheries.map((id) => props.game.treacheries[id]).filter(Boolean)
const teammateThreatCount = (investigator: InvestigatorState) =>
  investigatorEnemies(investigator).length + investigator.treacheries.length
// Who is acting is the turn order; who still owes an answer is the engine's own
// question map. A seat can be the latter without being the former, and a seat
// that has left the table is neither.
function teammateState(
  investigator: InvestigatorState,
): 'acting' | 'waiting' | 'eliminated' | null {
  if (investigator.eliminated) return 'eliminated'
  if (investigator.playerId in props.game.question) return 'waiting'
  if (investigator.id === props.game.activeInvestigatorId) return 'acting'
  return null
}
function teammateStateLabel(state: ReturnType<typeof teammateState>) {
  if (state === 'acting') return t('multiplayerTable.turnMarker')
  if (state === 'waiting') return t('waitingOn.short')
  if (state === 'eliminated') return t('partnerStatus.eliminated')
  return ''
}
const teammates = computed(() =>
  onlineMultiSeat.value
    ? orderedInvestigators.value.filter((investigator) => investigator.playerId !== props.playerId)
    : [],
)
const myInvestigator = computed(
  () =>
    orderedInvestigators.value.find((investigator) => investigator.playerId === props.playerId) ??
    null,
)
// The workbench label names whoever's panel is on screen. Solo keeps routing
// between seats, so fall back to the investigator the table is acting as.
const workbenchInvestigator = computed(() => myInvestigator.value ?? activeInvestigator.value)
// Separate seats are other people's investigators, so the workbench must stay on
// ours. A viewer without a seat here (a spectator) keeps following the table.
const pinWorkbench = computed(() => onlineMultiSeat.value && myInvestigator.value !== null)
const focusedTeammateId = ref<string | null>(null)
const focusedTeammate = computed(
  () => teammates.value.find((investigator) => investigator.id === focusedTeammateId.value) ?? null,
)
function toggleTeammate(investigatorId: string) {
  focusedTeammateId.value = focusedTeammateId.value === investigatorId ? null : investigatorId
}
watch(teammates, (list) => {
  if (
    focusedTeammateId.value &&
    !list.some((investigator) => investigator.id === focusedTeammateId.value)
  ) {
    focusedTeammateId.value = null
  }
})
const discards = computed<Card[]>(() =>
  props.scenario.discard.map((c) => ({ tag: 'EncounterCard', contents: c })),
)
const playerLocationZones = computed(() =>
  props.game.playerOrder.flatMap((investigatorId) => {
    const investigator = props.game.investigators[investigatorId]
    if (!investigator) return []

    const playerLocations = Object.values(props.game.locations).filter(
      (location) =>
        location.placement?.tag === 'InPlayArea' && location.placement.contents === investigator.id,
    )

    if (playerLocations.length === 0) return []
    return [
      {
        investigatorId,
        name: displayInvestigatorName(investigator),
        locations: playerLocations,
      },
    ]
  }),
)

const enemyGroups = computed(() => {
  const all = Object.values(props.game.enemies)
  const outOfPlay: Enemy[] = []
  const pursuit: Enemy[] = []
  const global: Enemy[] = []
  const asLoc: Enemy[] = []
  let firstVoid: Enemy | undefined

  for (const e of all) {
    const p = e.placement
    if (p.tag === 'OutOfPlay') {
      outOfPlay.push(e)
      if (!firstVoid && (p.contents === 'VoidZone' || p.contents === 'TheDepths')) firstVoid = e
      if (p.contents === 'PursuitZone') pursuit.push(e)
    }
    if (p.tag === 'OtherPlacement' && p.contents === 'Global' && e.asSelfLocation === null)
      global.push(e)
    // An enemy that IS its own location keeps its asSelfLocation label after it
    // leaves play, so the placement has to be checked too — otherwise a defeated
    // Leg of Atlach-Nacha keeps occupying its grid slot. Not narrowed to
    // AtLocation: Atlach-Nacha itself sits at Global while it is the web's centre.
    if (e.asSelfLocation !== null && p.tag !== 'OutOfPlay') asLoc.push(e)
  }
  return { outOfPlay, pursuit, global, asLoc, firstVoid }
})

const outOfPlayEnemies = computed(() => enemyGroups.value.outOfPlay)
const pursuit = computed(() => enemyGroups.value.pursuit)
const globalEnemies = computed(() => enemyGroups.value.global)
const inTheShadows = computed(() =>
  Object.values(props.game.enemies).filter((e) => e.placement.tag === 'InTheShadows'),
)
type InTheShadowLocations = { left?: string; middle?: string; right?: string }
const inTheShadowLocations = computed<InTheShadowLocations>(() => {
  const locations = props.scenario.meta?.locationsInShadows
  if (!locations || typeof locations !== 'object') return {}
  return locations as InTheShadowLocations
})

const anyInTheShadowLocations = computed(() => {
  const locations = inTheShadowLocations.value
  return locations.left || locations.right || locations.middle
})
const inTheShadowsInvestigators = computed(() =>
  Object.values(props.game.investigators).filter((e) => e.placement.tag === 'InTheShadows'),
)
const enemiesAsLocations = computed(() => enemyGroups.value.asLoc)
const topEnemyInVoid = computed(() => enemyGroups.value.firstVoid)

type ConcealedGroup = {
  position: Position
  known: ConcealedCard[]
  unknown: ConcealedCard[]
}

const positionToGridArea = function (pos: Position): string {
  // convert to posxxyy, negative number gets prefixed with an n so pos (-1, 0) is posn0100, (0, -1) is pos00n01, and (-1, -1) would be posn01n01
  const fmt = (n: number): string => {
    const sign = n < 0 ? 'n' : ''
    const abs = Math.abs(n)
    const padded = abs.toString().padStart(2, '0') // 0 -> "00", 5 -> "05", 12 -> "12"
    return sign + padded
  }

  return `pos${fmt(pos.x)}${fmt(pos.y)}`
}

const gridConcealed = computed<ConcealedGroup[]>(() => {
  const concealedCards = props.scenario.meta?.concealedCards as
    | [[number, number], string[]][]
    | undefined
  if (!concealedCards) return []

  const available = Object.values(props.game.concealed)
  const availableIds = new Set(available.map((c) => c.id))

  const cardPosition: Record<string, Position> = {}
  for (const [[x, y], cards] of concealedCards) {
    const position = { x, y }
    for (const cardId of cards) {
      if (availableIds.has(cardId)) cardPosition[cardId] = position
    }
  }

  const groups = new Map<string, ConcealedGroup>()
  for (const card of available) {
    const position = cardPosition[card.id]
    if (!position) continue
    const key = `${position.x}:${position.y}`
    const group = groups.get(key) ?? groups.set(key, { position, known: [], unknown: [] }).get(key)!
    ;(card.known ? group.known : group.unknown).push(card)
  }

  return [...groups.values()]
})

function isHollow(m: ModifierType): m is Hollow {
  return m.tag === 'Hollow'
}
const hollowed = computed(() => [
  ...new Set(
    Object.values(props.game.investigators).flatMap((i) =>
      (i.modifiers || [])
        .map((m) => m.type)
        .filter(isHollow)
        .map((m) => props.game.cards[m.contents]),
    ),
  ),
])

const outOfPlay = computed(() => props.scenario?.setAsideCards || [])
const removedFromPlay = computed(() => props.game.removedFromPlay)
const noCards = computed<Card[]>(() => [])
const topOfEncounterDiscard = computed(() => {
  if (!props.scenario.discard[0]) return null
  return cardImage(props.scenario.discard[0].cardCode)
})
const spectralEncounterDeck = computed(
  () => props.scenario.encounterDecks['SpectralEncounterDeck']?.[0],
)
const spectralDiscard = computed(() => props.scenario.encounterDecks['SpectralEncounterDeck']?.[1])
const spectralDiscards = computed<Card[]>(() =>
  (spectralDiscard.value ?? []).map((c) => ({ tag: 'EncounterCard', contents: c })),
)
const topOfSpectralDiscard = computed(() => {
  if (!spectralDiscard.value || !spectralDiscard.value[0]) return null
  return cardImage(spectralDiscard.value[0].cardCode)
})
const activePlayerId = computed(() => props.game.activeInvestigatorId)
const globalStories = computed(() =>
  Object.values(props.game.stories).filter(
    (story) => story.placement.tag === 'OtherPlacement' && story.placement.contents === 'Global',
  ),
)

// Keep both faces of a double-sided story mounted as the same physical card.
// The backend replaces the story entity when it flips, but a stable key lets
// Story's image watcher play the card-flip animation instead of remounting.
const globalStoryKey = (story: StoryAttrs) => [story.art, story.flippedArt].sort().join('/')

const globalAssets = computed(() =>
  Object.values(props.game.assets).filter(
    (asset) => asset.placement.tag === 'OtherPlacement' && asset.placement.contents === 'Global',
  ),
)
const cardsUnderScenarioReference = computed(() => props.scenario.cardsUnderScenarioReference)
const cardsUnderAgenda = computed(() => props.scenario.cardsUnderAgendaDeck)
const cardsUnderAct = computed(() => props.scenario.cardsUnderActDeck)
const cardsNextToAct = computed(() => props.scenario.cardsNextToActDeck)
const cardsNextToAgenda = computed(() => props.scenario.cardsNextToAgendaDeck)
const nextToTreacheries = computed<string[]>(() =>
  Object.values(props.game.treacheries)
    .filter((t) => t.placement.tag === 'NextToAgenda')
    .map((t) => t.id),
)
const agendaGroupedTreacheries = computed(() =>
  Object.entries(groupBy(nextToTreacheries.value, (t) => props.game.treacheries[t].cardCode)),
)

const keys = computed(() => props.scenario.setAsideKeys)
const spentKeys = computed(() => props.scenario.keys)
// TODO: not showing cosmos should be more specific, as there could be a cosmos location in the future?
// A [[Starship]] location (Starfall's The Tatterdemalion / The Cassilda) is
// attached to another location but is still a location on the map, sitting in
// its own berth cell. Only placements that take a location off the map entirely
// (InPlayArea) are filtered out here.
const locations = computed(() =>
  Object.values(props.game.locations).filter(
    (a) =>
      (a.placement === null || a.placement.tag === 'AttachedToLocation') && a.label !== 'cosmos',
  ),
)
const occupiedLocationIds = computed(
  () =>
    new Set(
      Object.values(props.game.investigators)
        .map((investigator) => investigator.location)
        .filter((locationId): locationId is string => Boolean(locationId)),
    ),
)
const currentPlayerLocationIds = computed(
  () =>
    new Set(
      Object.values(props.game.investigators)
        .filter((investigator) => investigator.playerId === props.playerId)
        .map((investigator) => investigator.location)
        .filter((locationId): locationId is string => Boolean(locationId)),
    ),
)
watch(locations, updateScrollMargins, { flush: 'post' })
watch(layoutPadding, updateScrollMargins, { flush: 'post' })
watch([locations, rotationSteps, zoom], updateCellDimensions, { flush: 'post' })
watch(
  [
    locationOffsets,
    pendingOffsets,
    locationGridOffsets,
    rotationSteps,
    zoom,
    locations,
    cellDimensions,
  ],
  updateLayoutPadding,
  { flush: 'post', deep: true },
)
const usedLabels = computed(() => locations.value.map((l) => l.label))
const unusedLabels = computed(() => {
  const { locationLayout, usesGrid } = props.scenario
  if (!locationLayout || !usesGrid) return []
  return locationLayout
    .flatMap((row) => row.split(' '))
    .filter((x) => !usedLabels.value.includes(x) && x !== '.')
})
const choices = useGameChoices(
  () => props.game,
  () => props.playerId,
)

const {
  enableCosmicEmissaryAnimation,
  cosmicEmissaryEnemyStyles,
  cosmicEmissaryLocationCellStyles,
  clearCosmicEmissaryCompactStyles,
  requestCosmicEmissaryCompact,
} = useCosmicEmissaryCompact({
  gameId: () => props.game.id,
  scenarioId: () => props.scenario.id,
  locations,
  enemiesAsLocations,
  rotationSteps,
  zoom,
  locationsUnlocked,
  hasManualLocationOffset: locationHasManualOffset,
})
const {
  hiddenLocationActionEdges,
  hasHiddenLocationActionEdge,
  scheduleHiddenLocationActionEdgesUpdate,
} = useLocationActionEdges(locationCardsContainer)

watch(
  [choices, locations, zoom],
  () => nextTick(scheduleHiddenLocationActionEdgesUpdate),
  { flush: 'post' },
)

type LocationLike = { id: string; label: string }

const isLocationChoice = (c: Message, location: LocationLike): boolean => {
  if (c.tag === 'TargetLabel') return c.target.contents === location.id
  if (c.tag === 'GridLabel') return c.gridLabel === location.label

  if (c.tag !== 'AbilityLabel') return false
  const { source } = c.ability

  if (source.sourceTag === 'ProxySource') {
    if ('contents' in source.source) return source.source.contents === location.id
  } else if (source.tag === 'LocationSource') {
    return source.contents === location.id
  }

  return false
}

const locationCanInteract = (location: LocationLike): boolean =>
  !locationsUnlocked.value && choices.value.some((choice) => isLocationChoice(choice, location))

const isEncounterDiscardChoice = (c: Message) => {
  if (c.tag !== 'TargetLabel') return false
  if (c.target.tag === 'EnemyTarget') {
    const enemy = props.game.enemies[c.target.contents as string]
    if (!enemy) return false
    return discards.value.some((card) => cardId(card) === enemy.cardId)
  }
  if (c.target.tag !== 'CardIdTarget') return false
  return discards.value.some((card) => cardId(card) === c.target.contents)
}

const resources = computed(() => props.scenario.tokens[TokenType.Resource])
const damage = computed(() => props.scenario.tokens[TokenType.Damage])
const targets = computed(() => props.scenario.tokens[TokenType.Target])
const hasPool = computed(
  () => (resources.value && resources.value > 0) || (damage.value && damage.value > 0),
)
const tarotCards = computed(() =>
  props.scenario.tarotCards.filter((c) => c.scope.tag === 'GlobalTarot'),
)
const phase = computed(() => props.game.phase)
const phaseStep = computed(() => props.game.phaseStep)
const currentDepth = computed(() => props.scenario.counts['CurrentDepth'])
const civiliansSlain = computed(() => props.scenario.counts['CiviliansSlain'])
const scraps = computed(() => props.scenario.tokens[TokenType.Scrap])
const switches = computed(() => props.scenario.tokens[TokenType.Switch])
const darknessLevel = computed(() => props.scenario.tokens[TokenType.DarknessLevel])
const signOfTheGods = computed(() => props.scenario.counts['SignOfTheGods'])
const strengthOfTheAbyss = computed(() => props.scenario.counts['StrengthOfTheAbyss'])
const distortion = computed(() => props.scenario.counts['Distortion'])
const cthulhuRage = computed(() => props.scenario.counts['CthulhuRage'])

const cthulhuDeckStoryCodes = new Set([
  '11705',
  '11706',
  '11707',
  '11708',
  '11709',
  '11710',
  '11711',
  '11712',
  '11713',
  '11714',
  '11715',
])
const resolvingCthulhuDeckStory = computed(
  () =>
    Object.values(props.game.stories).find(
      (story) =>
        story.placement.tag === 'OtherPlacement' &&
        story.placement.contents === 'Unplaced' &&
        cthulhuDeckStoryCodes.has(story.id.replace(/^c/, '')),
    ) ?? null,
)
const resolvingCthulhuDeckStoryImage = computed(() => {
  const story = resolvingCthulhuDeckStory.value
  return story ? cardImage(story.flipped ? story.flippedArt : story.art) : null
})

/* The Doom of Arkham Pt II. The three Cthulhu facets are at Cthulhu's location and
 * engaged with the investigators there, but are displayed on the Cthulhu Board
 * beside the scenario decks rather than in the location grid or a threat area. */
const cthulhuBoardEnemies = computed(() =>
  Object.values(props.game.enemies).filter(isCthulhuBoardEnemyInPlay),
)
/* The Cthulhu Board is a physical component of The Doom of Arkham Pt II, so it stays
 * on the table for the whole scenario. Slots empty out as facets are banished to the
 * victory display and fill again when an act returns them. */
const showCthulhuBoard = computed(() => props.scenario.id === 'c11688a')
// Laid to Rest: horror placed on the scenario reference card represents
// Spiritual Disturbance (defeats everyone at 4). Render it on the scenario card.
const spiritualDisturbance = computed(() =>
  props.scenario.id === 'c90054' ? props.scenario.tokens[TokenType.Horror] : undefined,
)
const gameOver = computed(() => props.game.gameState.tag === 'IsOver')

// Reactive
const showCards = reactive<RefWrapper<any>>({ ref: noCards })
const doShowCards = (
  cards: ComputedRef<Card[]>,
  title: string,
  isDiscards: boolean,
  revealed = false,
) => {
  cardRowTitle.value = title
  showCards.ref = cards
  viewingDiscard.value = isDiscards
  revealingCards.value = revealed
}
const showRemovedFromPlay = () => doShowCards(removedFromPlay, t('scenario.removedFromPlay'), true)
const showDiscards = () => doShowCards(discards, t('scenario.discards'), true)
const showSpectralDiscards = () => doShowCards(spectralDiscards, t('multiplayerTable.spectralDiscardPile'), true)
const hideCards = () => {
  showCards.ref = noCards
  revealingCards.value = false
}

// Watchers
watchEffect(() => {
  const oop = outOfPlay.value.length + outOfPlayEnemies.value.length

  if (oop == 0) {
    removeEntry('showOutOfPlay')
    showOutOfPlay.value = false
  } else {
    addEntry({
      id: 'showOutOfPlay',
      icon: EyeIcon,
      content: t('gameBar.showOutOfPlay'),
      nested: 'view',
      shortcut: 'o',
      action: () => (showOutOfPlay.value = !showOutOfPlay.value),
    })
  }

  const isOutOfPlaySource = (source: Source) => {
    switch (source.tag) {
      case 'EnemySource': {
        return outOfPlayEnemies.value.some((e) => e.id == source.contents)
      }
      case 'TreacherySource': {
        return outOfPlayEnemies.value.some((e) => {
          if (source.contents) return e.treacheries.includes(source.contents)
          return false
        })
      }
      case 'EventSource': {
        return outOfPlayEnemies.value.some((e) => {
          if (source.contents) return e.events.includes(source.contents)
          return false
        })
      }
      default:
        return false
    }
  }
  const isOutOfPlayCardId = (id: string) => outOfPlay.value.some((card) => cardId(card) === id)

  const isOutOfPlayTarget = (target: Target) => {
    const contents = target.contents
    if (typeof contents !== 'string') return false

    switch (target.tag) {
      case 'CardIdTarget':
        return isOutOfPlayCardId(contents)
      case 'EnemyTarget':
        return outOfPlayEnemies.value.some((e) => e.id === contents)
      case 'TreacheryTarget': {
        return outOfPlayEnemies.value.some((e) => e.treacheries.includes(contents))
      }
      case 'EventTarget': {
        return outOfPlayEnemies.value.some((e) => e.events.includes(contents))
      }
      default:
        return false
    }
  }

  const isOutOfPlayChoice = (c: Message) => {
    if (c.tag === 'AbilityLabel') return isOutOfPlaySource(c.ability.source)
    if (c.tag === 'TargetLabel') return isOutOfPlayTarget(c.target)
    return false
  }

  const isActionableChoice = (c: Message) =>
    !['Info', 'InvalidLabel', 'TooltipLabel'].includes(c.tag)
  const actionableChoices = choices.value.filter(isActionableChoice)
  forcedShowOutOfPlay.value =
    actionableChoices.length > 0 && actionableChoices.every(isOutOfPlayChoice)

  const isHollowedChoice = (c: Message) => {
    if (c.tag !== 'TargetLabel') return false
    if (c.target.tag !== 'CardIdTarget') return false
    return hollowed.value.some((card) => cardId(card) === c.target.contents)
  }
  const showDiscard = choices.value.some(isEncounterDiscardChoice)
  const showHollowedCards = choices.value.some(isHollowedChoice)
  if (showDiscard) {
    hideCards()
    showDiscards()
    hollowedPopoverShown.value = false
  } else if (showHollowedCards) {
    hollowedPopoverShown.value = true
  } else {
    hideCards()
    hollowedPopoverShown.value = false
  }
})

function locationHasManualOffset(el: HTMLElement): boolean {
  const locationId = el.dataset.locationId
  if (!locationId) return false
  return (
    locationId in locationOffsets.value ||
    locationId in pendingOffsets.value ||
    dragInternal?.locationId === locationId
  )
}

function beforeLeave(e: Element) {
  const el = e as HTMLElement
  const { marginLeft, marginTop, width, height } = window.getComputedStyle(el)

  el.style.left = `${el.offsetLeft - parseFloat(marginLeft)}px`
  el.style.top = `${el.offsetTop - parseFloat(marginTop)}px`
  el.style.width = width
  el.style.height = height
}

const unusedCanInteract = (u: string) =>
  choices.value.findIndex((c) => c.tag === 'GridLabel' && c.gridLabel === u)
const tarotCardAbility = (card: TarotCard) => {
  return choices.value.findIndex((c) => {
    if (c.tag === 'AbilityLabel') {
      return (
        c.ability.source.sourceTag === 'TarotSource' &&
        c.ability.source.contents.arcana === card.arcana
      )
    }

    return false
  })
}

const victoryDisplay = computed(() => props.scenario.victoryDisplay)

const isMinimized_SkillTest = ref(false)
provide(isMinimizedSkillTestKey, isMinimized_SkillTest)
function minimize_SkillTest(isMinimized: boolean) {
  if (isMobile.value) {
    isMinimized_SkillTest.value = isMinimized
  }
}

const blessTokens = computed(
  () => props.scenario.chaosBag.chaosTokens.filter((t) => t.face === 'BlessToken').length,
)
const curseTokens = computed(
  () => props.scenario.chaosBag.chaosTokens.filter((t) => t.face === 'CurseToken').length,
)
const frostTokens = computed(
  () => props.scenario.chaosBag.chaosTokens.filter((t) => t.face === 'FrostToken').length,
)
const bloodTokens = computed(
  () => props.scenario.chaosBag.chaosTokens.filter((t) => t.face === 'BloodToken').length,
)

// Custom campaign tokens (e.g. the Circus Ex Mortis moon) that opt into the
// totals bar via their campaign's homebrew tokens.json. Counted across the
// chaos bag and every investigator's sealed tokens (where moon tokens live).
const homebrewTotals = computed(() => {
  const sealed = Object.values(props.game.investigators).flatMap((i) => i.sealedChaosTokens ?? [])
  const all = [...props.scenario.chaosBag.chaosTokens, ...sealed]
  return homebrewTotalsTokens
    .map((cfg) => ({
      face: cfg.face,
      tooltip: cfg.tooltip,
      image: chaosTokenImage(cfg.face),
      count: all.filter((t) => t.face === cfg.face).length,
    }))
    .filter((t) => t.count > 0)
})

async function removeChaosToken(face: any) {
  debug.send(props.game.id, {
    tag: 'ChaosBagMessage',
    contents: { tag: 'RemoveChaosToken_', contents: face },
  })
}

async function addChaosToken(face: any) {
  debug.send(props.game.id, { tag: 'AddChaosToken', contents: face })
}
</script>

<template>
  <div v-if="upgradeDeck" id="game" class="game">
    <UpgradeDeck
      :game="game"
      :key="playerId"
      :playerId="playerId"
      @choose="choose"
      @update="update"
    />
  </div>
  <div v-else-if="!gameOver" id="scenario" class="scenario" :data-scenario="scenario.id" :data-mobile-panel="mobilePanel">
    <nav v-if="isMobile" class="mobile-table-nav" :aria-label="$t('multiplayerTable.mobileNavigation')">
      <button v-for="panel in (['map', 'player', 'scenario', 'team'] as const)" v-show="panel !== 'team' || onlineMultiSeat" :key="panel" type="button" :aria-pressed="mobilePanel === panel" @click="mobilePanel = panel">
        {{ $t(`multiplayerTable.${{ map: 'mobileMap', player: 'mobilePlayer', scenario: 'mobileScenario', team: 'mobileTeam' }[panel]}`) }}
      </button>
    </nav>
    <div v-if="isMobile && activeInvestigator" class="mobile-turn-summary" aria-live="polite">
      <Zap aria-hidden="true" /><strong>{{ displayInvestigatorName(activeInvestigator) }}</strong>
      <span>{{ $t('multiplayerTable.actionsRemaining', { count: activeInvestigator.remainingActions }) }}</span>
    </div>
    <div
      class="scenario-body"
      :class="{
        'split-view': splitView,
        'scenario-body--notifier-overlays': showScenarioNotifierBar,
        'scenario-body--multiseat': desktopTabletop,
        'scenario-body--online': onlineMultiSeat,
        'scenario-body--teammate-open': focusedTeammate !== null,
      }"
    >
      <Draggable v-if="showOutOfPlay || forcedShowOutOfPlay">
        <template #handle
          ><header>
            <h2>{{ $t('gameBar.outOfPlay') }}</h2>
          </header></template
        >
        <div class="card-row-cards">
          <div v-for="card in outOfPlay" :key="cardId(card)" class="card-row-card">
            <CardView
              :game="game"
              :card="card"
              :playerId="playerId"
              @choose="$emit('choose', $event)"
            />
          </div>
          <EnemyView
            v-for="enemy in outOfPlayEnemies"
            :key="enemy.id"
            :enemy="enemy"
            :game="game"
            :playerId="playerId"
            @choose="choose"
          />
        </div>
        <button v-if="!forcedShowOutOfPlay" class="close button" @click="showOutOfPlay = false">
          {{ $t('close') }}
        </button>
      </Draggable>
      <Draggable v-if="showChaosBag">
        <template #handle
          ><header>
            <h2>
              {{ $t('gameBar.chaosBag') }}
              <span class="count-pill">{{ scenario.chaosBag.chaosTokens.length }}</span>
            </h2>
          </header></template
        >
        <ChaosBag
          :game="game"
          :skillTest="null"
          :chaosBag="scenario.chaosBag"
          :playerId="playerId"
          @choose="choose"
        />
        <div v-if="debug.active" class="buttons buttons-row">
          <div class="tri-button blessed">
            <button class="button blessed" @click="removeChaosToken('BlessToken')">-</button>
            <span class="bless-icon"></span>
            <button class="button blessed" @click="addChaosToken('BlessToken')">+</button>
          </div>
          <div class="tri-button cursed">
            <button class="button cursed" @click="removeChaosToken('CurseToken')">-</button>
            <span class="curse-icon"></span>
            <button class="button cursed" @click="addChaosToken('CurseToken')">+</button>
          </div>
          <div class="tri-button frost">
            <button class="button frost" @click="removeChaosToken('FrostToken')">-</button>
            <span class="frost-icon"></span>
            <button class="button frost" @click="addChaosToken('FrostToken')">+</button>
          </div>
          <div class="tri-button blood">
            <button class="button blood" @click="removeChaosToken('BloodToken')">-</button>
            <span class="blood-icon"></span>
            <button class="button blood" @click="addChaosToken('BloodToken')">+</button>
          </div>
          <div class="tri-button">
            <button class="button" @click="removeChaosToken('PlusOne')">-</button>
            <span>+1</span>
            <button class="button" @click="addChaosToken('PlusOne')">+</button>
          </div>
          <div class="tri-button">
            <button class="button" @click="removeChaosToken('Zero')">-</button>
            <span>0</span>
            <button class="button" @click="addChaosToken('Zero')">+</button>
          </div>
          <div class="tri-button">
            <button class="button" @click="removeChaosToken('MinusOne')">-</button>
            <span>-1</span>
            <button class="button" @click="addChaosToken('MinusOne')">+</button>
          </div>
          <div class="tri-button">
            <button class="button" @click="removeChaosToken('MinusTwo')">-</button>
            <span>-2</span>
            <button class="button" @click="addChaosToken('MinusTwo')">+</button>
          </div>
          <div class="tri-button">
            <button class="button" @click="removeChaosToken('MinusThree')">-</button>
            <span>-3</span>
            <button class="button" @click="addChaosToken('MinusThree')">+</button>
          </div>
          <div class="tri-button">
            <button class="button" @click="removeChaosToken('MinusFour')">-</button>
            <span>-4</span>
            <button class="button" @click="addChaosToken('MinusFour')">+</button>
          </div>
          <div class="tri-button">
            <button class="button" @click="removeChaosToken('MinusFive')">-</button>
            <span>-5</span>
            <button class="button" @click="addChaosToken('MinusFive')">+</button>
          </div>
          <div class="tri-button">
            <button class="button" @click="removeChaosToken('MinusSix')">-</button>
            <span>-6</span>
            <button class="button" @click="addChaosToken('MinusSix')">+</button>
          </div>
          <div class="tri-button">
            <button class="button" @click="removeChaosToken('MinusSeven')">-</button>
            <span>-7</span>
            <button class="button" @click="addChaosToken('MinusSeven')">+</button>
          </div>
          <div class="tri-button">
            <button class="button" @click="removeChaosToken('MinusEight')">-</button>
            <span>-8</span>
            <button class="button" @click="addChaosToken('MinusEight')">+</button>
          </div>
          <div class="tri-button">
            <button class="button" @click="removeChaosToken('Skull')">-</button>
            <span class="skull-icon"></span>
            <button class="button" @click="addChaosToken('Skull')">+</button>
          </div>
          <div class="tri-button">
            <button class="button" @click="removeChaosToken('Cultist')">-</button>
            <span class="cultist-icon"></span>
            <button class="button" @click="addChaosToken('Cultist')">+</button>
          </div>
          <div class="tri-button">
            <button class="button" @click="removeChaosToken('Tablet')">-</button>
            <span class="tablet-icon"></span>
            <button class="button" @click="addChaosToken('Tablet')">+</button>
          </div>
          <div class="tri-button">
            <button class="button" @click="removeChaosToken('ElderThing')">-</button>
            <span class="elder-thing-icon"></span>
            <button class="button" @click="addChaosToken('ElderThing')">+</button>
          </div>
          <div class="tri-button elder-sign-button">
            <button class="button elder-sign-button" @click="removeChaosToken('ElderSign')">
              -
            </button>
            <span class="elder-sign"></span>
            <button class="button elder-sign-button" @click="addChaosToken('ElderSign')">+</button>
          </div>
          <div class="tri-button auto-fail-button">
            <button class="button auto-fail-button" @click="removeChaosToken('AutoFail')">-</button>
            <span class="auto-fail"></span>
            <button class="button auto-fail-button" @click="addChaosToken('AutoFail')">+</button>
          </div>
        </div>
        <button class="button close-button" @click="showChaosBag = false">{{ $t('close') }}</button>
      </Draggable>
      <CardRow
        v-if="showCards.ref.length > 0"
        :game="game"
        :cards="showCards.ref"
        :isDiscards="viewingDiscard"
        :title="cardRowTitle"
        :playerId="playerId"
        :revealed="revealingCards"
        @choose="choose"
        @close="hideCards"
      />
      <div
        class="scenario-cards"
        :class="{ 'scenario-cards--has-badges': showScenarioNotifierBar }"
      >
        <Teleport v-if="desktopTabletop" :to="navigationSummaryHost || 'body'" :disabled="!summaryInNavigation">
          <section class="table-shelf-header" :class="{ 'table-shelf-header--navigation': summaryInNavigation }">
            <div class="table-summary-title" :title="[localizedScenarioName.title, localizedScenarioName.subtitle].filter(Boolean).join(' · ')">
              <BookOpen class="shelf-label-icon" aria-hidden="true" />
              <strong>{{ localizedScenarioName.title }}</strong>
              <span v-if="localizedScenarioName.subtitle">{{ localizedScenarioName.subtitle }}</span>
            </div>
            <div v-if="activeInvestigator" class="table-summary-action" :title="displayInvestigatorName(activeInvestigator)">
              <Zap class="shelf-label-icon" aria-hidden="true" />
              <span class="table-summary-investigator">{{ displayInvestigatorName(activeInvestigator) }}</span>
              <small>{{ $t('multiplayerTable.actionsRemaining', { count: activeInvestigator.remainingActions }) }}</small>
            </div>
            <button
              v-if="summaryInNavigation"
              type="button"
              class="table-shelf-header__accessories"
              :class="{ active: scenarioAccessoriesOpen }"
              :title="$t('multiplayerTable.scenarioAccessories')"
              :aria-label="$t('multiplayerTable.scenarioAccessories')"
              :aria-expanded="scenarioAccessoriesOpen"
              @click="scenarioAccessoriesOpen = !scenarioAccessoriesOpen"
            >
              <Layers aria-hidden="true" />
            </button>
          </section>
        </Teleport>
        <Teleport :to="encounterPilesHost || 'body'" :disabled="!desktopTabletop || !encounterPilesHost">
        <div class="scenario-encounter-decks">
          <span class="encounter-piles-label">
            <Layers class="shelf-label-icon" aria-hidden="true" /><span>{{ $t('multiplayerTable.encounterDeck') }}</span>
            <span class="pile-count">{{ game.encounterDeckSize }}</span>
          </span>
          <div v-if="topOfEncounterDiscard || (props.scenario.hasEncounterDeck && !hideEncounterDeck)" class="discard" style="grid-area: encounterDiscard">
            <button type="button" class="discard-view-control" :disabled="discards.length === 0" @click="showDiscards">
              <Archive aria-hidden="true" /><span>{{ t('multiplayerTable.viewDiscardPile') }}</span>
              <span class="discard-view-count">{{ discards.length }}</span>
            </button>
            <div v-if="topOfEncounterDiscard" class="discard-card">
              <img :src="topOfEncounterDiscard" class="card" />
            </div>
            <div v-else class="discard-empty" aria-hidden="true">—</div>

            <button v-if="debug.active && discards.length > 0" @click="debug.send(game.id, { tag: 'ShuffleEncounterDiscardBackIn' })">
              {{ $t('scenarioComponent.shuffleBackIn') }}
            </button>
          </div>


          <EncounterDeck
            :game="game"
            :playerId="playerId"
            @choose="choose"
            style="grid-area: encounterDeck"
            v-if="props.scenario.hasEncounterDeck && !hideEncounterDeck"
          />

          <div v-if="topOfSpectralDiscard || spectralEncounterDeck" class="discard" style="grid-area: spectralDiscard">
            <button type="button" class="discard-view-control" :disabled="spectralDiscards.length === 0" @click="showSpectralDiscards">
              <Archive aria-hidden="true" /><span>{{ t('multiplayerTable.viewDiscardPile') }}</span>
              <span class="discard-view-count">{{ spectralDiscards.length }}</span>
            </button>
            <div v-if="topOfSpectralDiscard" class="discard-card">
              <img :src="topOfSpectralDiscard" class="card" />
            </div>

            <div v-if="spectralDiscards.length > 0" class="buttons">
              <template v-if="debug.active">
                <button
                  @click="
                    debug.send(game.id, {
                      tag: 'ShuffleEncounterDiscardBackInByKey',
                      contents: 'SpectralEncounterDeck',
                    })
                  "
                >
                  {{ $t('scenarioComponent.shuffleBackIn') }}
                </button>
              </template>
            </div>
          </div>

          <EncounterDeck
            v-if="spectralEncounterDeck"
            :spectral="spectralEncounterDeck.length"
            :game="game"
            :playerId="playerId"
            @choose="choose"
            style="grid-area: spectralDeck"
          />
        </div>

        </Teleport>
        <div class="scenario-decks" :style="scenarioDeckStyles">
          <section class="scenario-seat scenario-seat--agenda" :style="{ '--seat-card-count': Math.max(1, Object.keys(game.agendas).length) }">
            <header class="scenario-seat__heading"><Skull aria-hidden="true" /><span>{{ $t('multiplayerTable.agendaArea') }}</span><i aria-hidden="true">◇</i></header>
            <div class="scenario-seat__cards">
          <TransitionGroup
            v-if="Object.values(game.agendas).length > 0"
            name="deck-advance"
            :duration="{ enter: 0, leave: 420 }"
          >
            <Agenda
              v-for="(agenda, key) in game.agendas"
              :key="key"
              :agenda="agenda"
              :hideStackControl="desktopTabletop"
              :data-area-label="$t('multiplayerTable.agendaArea')"
              :cardsUnder="cardsUnderAgenda"
              :cardsNextTo="cardsNextToAgenda"
              :remainingStack="scenario.agendaStack[agenda.deckId] || []"
              :completedStack="scenario.completedAgendaStack[agenda.deckId] || []"
              :game="game"
              :playerId="playerId"
              :style="{ 'grid-area': `agenda${agenda.deckId}`, 'justify-self': 'center' }"
              @choose="choose"
              @show="doShowCards"
            />
          </TransitionGroup>
          <div v-else-if="agendaGroupedTreacheries.length > 0" class="treacheries">
            <div
              v-for="([cCode, treacheries], idx) in agendaGroupedTreacheries"
              :key="cCode"
              class="treachery-group"
              :style="{
                zIndex: `calc(var(--z-index-10) * ${agendaGroupedTreacheries.length - idx})`,
              }"
            >
              <div v-for="treacheryId in treacheries" class="treachery-card" :key="treacheryId">
                <TreacheryView
                  :treachery="game.treacheries[treacheryId]"
                  :game="game"
                  :playerId="playerId"
                  @choose="$emit('choose', $event)"
                  :overlay-delay="310"
                />
              </div>
            </div>
          </div>

            </div>
          </section>
          <section class="scenario-seat scenario-seat--act" :style="{ '--seat-card-count': Math.max(1, Object.keys(game.acts).length) }">
            <header class="scenario-seat__heading"><BookOpen aria-hidden="true" /><span>{{ $t('multiplayerTable.actArea') }}</span><i aria-hidden="true">◇</i></header>
            <div class="scenario-seat__cards">
            <!-- The spendable clue total reads off the act frame's corner, the
                 way the agenda frame already carries doom. It lives inside the
                 card area so that area's own clipping trims the badge's ring at
                 the card's edge, exactly as it does on the agenda. -->
            <PoolItem
              v-if="desktopTable"
              class="act-clue-total"
              type="clue"
              :amount="game.totalClues"
              tooltip="Total Spendable Clues"
            />
          <TransitionGroup name="deck-advance" :duration="{ enter: 0, leave: 420 }">
            <Act
              v-for="(act, key) in game.acts"
              :key="key"
              :act="act"
              :hideStackControl="desktopTabletop"
              :data-area-label="$t('multiplayerTable.actArea')"
              :cardsUnder="cardsUnderAct"
              :cardsNextTo="cardsNextToAct"
              :remainingStack="scenario.actStack[act.deckId] || []"
              :completedStack="scenario.completedActStack[act.deckId] || []"
              :game="game"
              :playerId="playerId"
              :style="{ 'grid-area': `act${act.deckId}`, 'justify-self': 'center' }"
              @choose="choose"
              @show="doShowCards"
            />
          </TransitionGroup>
            </div>
          </section>
        </div>

        <div
          class="scenario-accessories"
          :class="{ 'is-open': scenarioAccessoriesOpen || !desktopTabletop }"
        >
          <div class="scenario-accessories__content">

        <div
          v-if="
            anyInTheShadowLocations ||
            inTheShadows.length > 0 ||
            inTheShadowsInvestigators.length > 0
          "
          class="in-the-shadows"
        >
          <template v-if="anyInTheShadowLocations">
            <Location
              v-if="inTheShadowLocations.left && game.locations[inTheShadowLocations.left]"
              class="location"
              :game="game"
              :playerId="playerId"
              :location="game.locations[inTheShadowLocations.left]"
              @choose="choose"
              @show="doShowCards"
            />
            <Location
              v-if="inTheShadowLocations.middle && game.locations[inTheShadowLocations.middle]"
              class="location"
              :game="game"
              :playerId="playerId"
              :location="game.locations[inTheShadowLocations.middle]"
              @choose="choose"
              @show="doShowCards"
            />
            <Location
              v-if="inTheShadowLocations.right && game.locations[inTheShadowLocations.right]"
              class="location"
              :game="game"
              :playerId="playerId"
              :location="game.locations[inTheShadowLocations.right]"
              @choose="choose"
              @show="doShowCards"
            />
          </template>
          <EnemyView
            v-for="enemy in inTheShadows"
            :key="enemy.id"
            :enemy="enemy"
            :game="game"
            :playerId="playerId"
            @choose="choose"
          />
          <Investigator
            v-for="investigator in inTheShadowsInvestigators"
            :key="investigator.id"
            :choices="[]"
            :investigator="investigator"
            :playerId="playerId"
            :game="game"
            :portrait="true"
          />
        </div>
        <div v-if="tarotCards.length > 0" class="tarot-cards">
          <div
            v-for="tarotCard in tarotCards"
            :key="tarotCard.arcana"
            class="tarot-card-container"
            :class="{
              [tarotCard.facing]: true,
              'can-interact': tarotCardAbility(tarotCard) !== -1,
            }"
            @click="choose(tarotCardAbility(tarotCard))"
          >
            <img
              :src="imgsrc(`tarot/${tarotCardImage(tarotCard)}`)"
              :class="tarotCard.facing"
              class="card tarot-card"
            />
          </div>
        </div>
        <div v-if="topEnemyInVoid">
          <EnemyView :enemy="topEnemyInVoid" :game="game" :playerId="playerId" @choose="choose" />
        </div>
        <div v-if="showCthulhuBoard" class="cthulhu-board-row">
          <aside
            v-if="resolvingCthulhuDeckStory && resolvingCthulhuDeckStoryImage"
            class="resolving-cthulhu-card"
            aria-label="Cthulhu deck card currently resolving"
          >
            <img
              class="card"
              :class="{ 'source-highlight': scenario.meta?.activeCthulhuFacet }"
              :src="resolvingCthulhuDeckStoryImage"
              alt=""
            />
          </aside>
          <CthulhuBoard
            :game="game"
            :playerId="playerId"
            :enemies="cthulhuBoardEnemies"
            @choose="choose"
          />
        </div>
        <ScenarioDeck
          v-for="[, scenarioDeck] in scenarioDecks"
          :key="scenarioDeck[0]"
          :deck="scenarioDeck"
          :discardPile="scenarioDeckDiscard(scenarioDeck[0])"
          :game="game"
          :playerId="playerId"
          @choose="choose"
          @show="doShowCards"
        />
        <VictoryDisplay
          :game="game"
          :victoryDisplay="victoryDisplay"
          @choose="choose"
          :playerId="playerId"
        />



        <EnemyView
          v-for="enemy in pursuit"
          :key="enemy.id"
          :enemy="enemy"
          :game="game"
          :playerId="playerId"
          @choose="choose"
        />

        <EnemyView
          v-for="enemy in globalEnemies"
          :key="enemy.id"
          :enemy="enemy"
          :game="game"
          :playerId="playerId"
          @choose="choose"
        />

        <Story
          v-for="story in globalStories"
          :key="globalStoryKey(story)"
          :story="story"
          :game="game"
          :playerId="playerId"
          @choose="choose"
        />

        <Asset
          v-for="asset in globalAssets"
          :key="asset.id"
          :asset="asset"
          :game="game"
          :playerId="playerId"
          @choose="choose"
        />

        <div class="scenario-guide">
          <div class="scenario-guide-main">
            <div class="scenario-guide-card-wrapper">
              <div class="scenario-guide-card">
                <img
                  class="card"
                  :src="scenarioGuide"
                  :data-spent-keys="JSON.stringify(spentKeys)"
                  :data-depth="currentDepth"
                />
                <img v-for="reference in additionalReferences" class="card" :src="reference" />
                <AbilityButton
                  v-for="ability in abilities"
                  :key="ability.index"
                  :ability="ability.contents"
                  :game="game"
                  @click="choose(ability.index)"
                />
              </div>
              <PoolItem class="depth" v-if="currentDepth" type="resource" :amount="currentDepth" />
              <PoolItem
                class="civilians-slain"
                v-if="civiliansSlain"
                type="resource"
                :amount="civiliansSlain"
              />
              <PoolItem
                class="strength-of-the-abyss"
                v-if="strengthOfTheAbyss !== undefined"
                type="resource"
                :amount="strengthOfTheAbyss"
              />
              <PoolItem class="targets" v-if="targets" type="resource" :amount="targets" />
              <PoolItem class="scraps" v-if="scraps" type="resource" :amount="scraps" />
              <PoolItem class="switches" v-if="switches" type="resource" :amount="switches" />
              <PoolItem
                class="darkness-level"
                v-if="darknessLevel"
                type="resource"
                :amount="darknessLevel"
              />
              <div class="spent-keys" v-if="spentKeys.length > 0">
                <KeyToken
                  v-for="k in spentKeys"
                  :key="keyToId(k)"
                  :keyToken="k"
                  :game="game"
                  :playerId="playerId"
                  @choose="choose"
                />
              </div>
              <PoolItem
                v-if="signOfTheGods"
                class="signOfTheGods"
                type="resource"
                tooltip="Sign of the Gods"
                :amount="signOfTheGods"
              />
              <PoolItem
                v-if="cthulhuRage"
                class="cthulhuRage"
                type="resource"
                tooltip="Cthulhu's Rage"
                :amount="cthulhuRage"
              />
              <PoolItem
                v-if="distortion"
                class="distortion"
                type="damage"
                tooltip="Distortion"
                :amount="distortion"
              />
              <PoolItem
                v-if="spiritualDisturbance"
                class="spiritualDisturbance"
                type="horror"
                tooltip="Spiritual Disturbance"
                :amount="spiritualDisturbance"
              />
              <div class="pool" v-if="hasPool">
                <PoolItem v-if="resources && resources > 0" type="resource" :amount="resources" />
                <PoolItem v-if="damage && damage > 0" type="damage" :amount="damage" />
              </div>
            </div>
            <div v-if="heededDanielsWarning" class="spoken-hastur-recorder">
              <button
                type="button"
                class="spoken-hastur-button"
                :disabled="!hasturSpeaker"
                v-tooltip="spokenHasturTooltip"
                :aria-label="spokenHasturTooltip"
                @click.stop.prevent="recordSpokenHastur"
              >
                <img :src="imgsrc('chaos-tokens/ct-cultist.png')" alt="" />
              </button>
            </div>
          </div>
          <div class="keys" v-if="keys.length > 0">
            <KeyToken
              v-for="k in keys"
              :key="keyToId(k)"
              :keyToken="k"
              :game="game"
              :playerId="playerId"
              @choose="choose"
            />
          </div>
          <label v-if="debug.active" class="debug-difficulty">
            <span>Difficulty</span>
            <select :value="displayedScenarioDifficulty" @change="changeScenarioDifficulty">
              <option value="Easy">Easy</option>
              <option value="Standard">Standard</option>
              <option value="Hard">Hard</option>
              <option value="Expert">Expert</option>
            </select>
          </label>
          <button
            v-if="debug.active && scenarioHasDebugOptions(scenario)"
            type="button"
            class="scenario-debug-toggle"
            @click="showScenarioDebugOptions = true"
          >
            Debug
          </button>
          <CardsUnderIndicator
            v-if="cardsUnderScenarioReference.length > 0"
            class="scenario-cards-under"
            :cards="cardsUnderScenarioReference"
            :game="game"
            :playerId="playerId"
            :label="$t('scenario.cardsUnderScenarioReference')"
            full-width
            @choose="choose"
          />
        </div>

        <div v-if="hollowed.length > 0" class="discard">
          <div class="discard-card">
            <CardView :game="game" :card="hollowed[0]" :playerId="playerId" class="card" />
          </div>
          <div class="buttons">
            <CardsUnderIndicator
              v-model:shown="hollowedPopoverShown"
              class="view-discard-button"
              :cards="hollowed"
              :game="game"
              :playerId="playerId"
              :label="t('scenario.hollowed')"
              :fullWidth="true"
              @choose="choose"
            />
          </div>
        </div>
        <SkillTest
          v-if="game.skillTest"
          :game="game"
          :chaosBag="scenario.chaosBag"
          :skillTest="game.skillTest"
          :playerId="playerId"
          @choose="choose"
        >
        </SkillTest>

        <div v-if="showScenarioNotifierBar" class="scenario-badges" :aria-label="$t('multiplayerTable.scenarioReminders')">
          <div
            v-for="badge in scenarioBadges"
            :key="badge.key"
            class="scenario-badge"
            v-tooltip="badge.detail"
            :aria-label="badge.detail ? `${badge.label}: ${badge.detail}` : badge.label"
          >
            <span class="scenario-badge-icon" aria-hidden="true">{{ badge.icon }}</span>
            <span class="scenario-badge-text">
              <strong>{{ badge.label }}</strong>
              <small v-if="badge.detail">{{ badge.detail }}</small>
            </span>
          </div>
          <button
            v-if="rainAvailable"
            type="button"
            class="scenario-badge rain-switch"
            :class="{ 'rain-switch--on': rainEnabled }"
            :title="$t(rainEnabled ? 'multiplayerTable.stopRain' : 'multiplayerTable.startRain')"
            @click="rainEnabled = !rainEnabled"
          >
            <span class="rain-switch-track" aria-hidden="true">
              <span class="rain-switch-knob"></span>
            </span>
            <span class="scenario-badge-text rain-switch-label">
              <strong>{{ $t(rainEnabled ? 'multiplayerTable.rainOn' : 'multiplayerTable.rainOff') }}</strong>
            </span>
          </button>
          <span
            v-if="realityAcidLightDevoured"
            ref="realityAcidLightAnchor"
            class="scenario-badge reality-acid-light-switch-anchor"
            aria-hidden="true"
          >
            <span class="reality-acid-light-switch-track">
              <span class="reality-acid-light-switch-knob"></span>
            </span>
            <span class="scenario-badge-text reality-acid-light-switch-label">
              <strong>{{ $t(realityAcidLightActive ? 'multiplayerTable.lightsOff' : 'multiplayerTable.lightsOn') }}</strong>
            </span>
          </span>
          <Teleport to="body">
            <button
              v-if="realityAcidLightDevoured"
              type="button"
              class="scenario-badge reality-acid-light-switch reality-acid-light-switch--floating"
              :class="{ 'reality-acid-light-switch--on': realityAcidLightActive }"
              :style="{
                left: `${realityAcidLightRect.left}px`,
                top: `${realityAcidLightRect.top}px`,
                width: `${realityAcidLightRect.width}px`,
                height: `${realityAcidLightRect.height}px`,
              }"
              :title="$t(realityAcidLightActive ? 'multiplayerTable.turnLightsOn' : 'multiplayerTable.turnLightsOff')"
              @click="$emit('toggleRealityAcidLight')"
            >
              <span class="reality-acid-light-switch-track" aria-hidden="true">
                <span class="reality-acid-light-switch-knob"></span>
              </span>
              <span class="scenario-badge-text reality-acid-light-switch-label">
                <strong>{{ $t(realityAcidLightActive ? 'multiplayerTable.lightsOff' : 'multiplayerTable.lightsOn') }}</strong>
              </span>
            </button>
          </Teleport>
        </div>

        <div
          v-if="props.scenario.hasEncounterDeck && !hideEncounterDeck"
          class="scenario-balance-placeholder"
          aria-hidden="true"
        ></div>

          </div>
        </div>
      </div>

      <aside
        v-if="onlineMultiSeat"
        class="teammate-rail"
        :aria-label="$t('multiplayerTable.roster')"
      >
        <header class="teammate-rail__header">
          <span>{{ $t('multiplayerTable.roster') }}</span>
          <small>{{ $t('multiplayerTable.publicView') }}</small>
        </header>
        <section v-if="focusedTeammate" class="teammate-detail">
          <div class="teammate-detail__top">
            <img class="teammate-detail__card" :src="cardImage(focusedTeammate.art)" alt="" />
            <div class="teammate-detail__identity">
              <strong>{{ displayInvestigatorName(focusedTeammate) }}</strong>
              <small>{{ investigatorLocation(focusedTeammate) }}</small>
              <em
                v-if="teammateState(focusedTeammate)"
                class="teammate-detail__state"
                :class="`teammate-detail__state--${teammateState(focusedTeammate)}`"
              >
                {{ teammateStateLabel(teammateState(focusedTeammate)) }}
              </em>
              <small>{{
                $t('multiplayerTable.actionsRemaining', {
                  count: focusedTeammate.remainingActions,
                })
              }}</small>
              <button
                type="button"
                class="teammate-detail__close"
                @click="toggleTeammate(focusedTeammate.id)"
              >
                {{ $t('close') }}
              </button>
            </div>
          </div>
          <dl class="teammate-detail__stats">
            <div>
              <dt>{{ $t('multiplayerTable.health') }}</dt>
              <dd>
                {{
                  focusedTeammate.health - investigatorToken(focusedTeammate, TokenType.Damage)
                }}/{{ focusedTeammate.health }}
              </dd>
            </div>
            <div>
              <dt>{{ $t('multiplayerTable.sanity') }}</dt>
              <dd>
                {{
                  focusedTeammate.sanity - investigatorToken(focusedTeammate, TokenType.Horror)
                }}/{{ focusedTeammate.sanity }}
              </dd>
            </div>
            <div>
              <dt>{{ $t('multiplayerTable.resources') }}</dt>
              <dd>{{ investigatorToken(focusedTeammate, TokenType.Resource) }}</dd>
            </div>
            <div>
              <dt>{{ $t('multiplayerTable.cluesShort') }}</dt>
              <dd>{{ investigatorToken(focusedTeammate, TokenType.Clue) }}</dd>
            </div>
            <div>
              <dt>{{ $t('multiplayerTable.willpower') }}</dt>
              <dd>{{ focusedTeammate.willpower }}</dd>
            </div>
            <div>
              <dt>{{ $t('multiplayerTable.intellect') }}</dt>
              <dd>{{ focusedTeammate.intellect }}</dd>
            </div>
            <div>
              <dt>{{ $t('multiplayerTable.combat') }}</dt>
              <dd>{{ focusedTeammate.combat }}</dd>
            </div>
            <div>
              <dt>{{ $t('multiplayerTable.agility') }}</dt>
              <dd>{{ focusedTeammate.agility }}</dd>
            </div>
          </dl>
          <div
            v-if="investigatorAssets(focusedTeammate).length > 0"
            class="teammate-detail__cards"
            :aria-label="$t('multiplayerTable.inPlay')"
          >
            <AssetView
              v-for="asset in investigatorAssets(focusedTeammate)"
              :key="asset.id"
              :asset="asset"
              :game="game"
              :playerId="focusedTeammate.playerId"
              readonly
            />
          </div>
          <div
            v-if="teammateThreatCount(focusedTeammate) > 0"
            class="teammate-detail__cards teammate-detail__cards--threat"
            :aria-label="$t('multiplayerTable.threatArea')"
          >
            <EnemyView
              v-for="enemy in investigatorEnemies(focusedTeammate)"
              :key="enemy.id"
              :enemy="enemy"
              :game="game"
              :playerId="focusedTeammate.playerId"
              readonly
            />
            <TreacheryView
              v-for="treachery in investigatorTreacheries(focusedTeammate)"
              :key="treachery.id"
              :treachery="treachery"
              :game="game"
              :playerId="focusedTeammate.playerId"
              readonly
            />
          </div>
        </section>
        <button
          v-for="investigator in teammates"
          v-show="investigator.id !== focusedTeammateId"
          :key="investigator.id"
          type="button"
          class="teammate-card"
          :class="{
            'teammate-card--active': investigator.id === activeInvestigator?.id,
            [`teammate-card--${investigator.class.toLowerCase()}`]: true,
          }"
          @click="toggleTeammate(investigator.id)"
        >
          <img
            class="teammate-card__portrait"
            :src="investigatorPortrait(game, investigator.id)"
            alt=""
          />
          <span class="teammate-card__name">
            {{ displayInvestigatorName(investigator) }}
            <em
              v-if="teammateState(investigator)"
              :class="`teammate-card__state teammate-card__state--${teammateState(investigator)}`"
              >{{ teammateStateLabel(teammateState(investigator)) }}</em
            >
          </span>
          <span class="teammate-card__location">{{ investigatorLocation(investigator) }}</span>
          <span class="teammate-card__stats">
            <span
              ><b
                >{{ investigator.health - investigatorToken(investigator, TokenType.Damage) }}/{{
                  investigator.health
                }}</b
              ><i>{{ $t('multiplayerTable.health') }}</i></span
            >
            <span
              ><b
                >{{ investigator.sanity - investigatorToken(investigator, TokenType.Horror) }}/{{
                  investigator.sanity
                }}</b
              ><i>{{ $t('multiplayerTable.sanity') }}</i></span
            >
            <span
              ><b>{{ investigatorToken(investigator, TokenType.Resource) }}</b
              ><i>{{ $t('multiplayerTable.resources') }}</i></span
            >
            <span
              ><b>{{ investigatorToken(investigator, TokenType.Clue) }}</b
              ><i>{{ $t('multiplayerTable.cluesShort') }}</i></span
            >
          </span>
          <span v-if="investigatorAssets(investigator).length > 0" class="teammate-card__assets">
            <img
              v-for="asset in investigatorAssets(investigator).slice(0, 3)"
              :key="asset.id"
              :src="cardImage(asset.cardCode)"
              alt=""
            />
            <em v-if="investigatorAssets(investigator).length > 3"
              >+{{ investigatorAssets(investigator).length - 3 }}</em
            >
          </span>
        </button>
      </aside>

      <RainOverlay :enabled="showRain" :options="rainOptions">
        <div
          ref="locationCardsContainer"
          class="location-cards-container"
          :class="{
            'location-cards-container--hidden-action': hasHiddenLocationActionEdge,
            'location-cards-container--hidden-action-top': hiddenLocationActionEdges.top,
            'location-cards-container--hidden-action-right': hiddenLocationActionEdges.right,
            'location-cards-container--hidden-action-bottom': hiddenLocationActionEdges.bottom,
            'location-cards-container--hidden-action-left': hiddenLocationActionEdges.left,
            'location-cards-container--unlocked': locationsUnlocked,
            'location-cards-container--fullscreen': locationsFullscreen,
          }"
          @dblclick.passive="toggleZoom"
        >
          <ScenarioMapControls
            v-model:map-move-mode="mapMoveMode"
            :locations-unlocked="locationsUnlocked"
            :map-resetting="mapResetting"
            @zoom-in="zoom = Math.min(6, zoom + 0.15)"
            @zoom-out="zoom = Math.max(0.25, zoom - 0.15)"
            @toggle-lock="toggleLocationsUnlocked"
            @reset="resetLocationsLayout"
          />
          <div
            class="location-cards-scroller"
            ref="scrollerRef"
            @wheel.prevent="onMapWheel"
            :class="{ 'location-cards-scroller--moving': mapMoveMode }"
            @pointerdown.capture="onStagePointerDown"
            @pointermove="onStagePointerMove"
            @pointerup="onStagePointerUp"
            @pointercancel="onStagePointerUp"
            @click.capture="onStageClick"
          >
            <div class="location-cards-stage" :style="{ transform: `translate(${mapTranslation.x}px, ${mapTranslation.y}px)` }">
              <Connections
                :game="game"
                :playerId="playerId"
                :allowCurvedPaths="allowCurvedPaths"
                :enableCosmicEmissaryAnimation="enableCosmicEmissaryAnimation"
              />
              <transition-group
                name="map"
                tag="div"
                ref="locationMap"
                class="location-cards"
                :css="props.scenario.id !== 'c10651'"
                :style="locationStyles"
                @before-leave="beforeLeave"
              >
                <!-- Keyed by id, not label: a location that changes grid label (the
               Great Lift sliding between levels) must stay the same element so
               TransitionGroup FLIP-animates it into its new cell. Keying by
               label made that read as a leave + enter, so it teleported. -->
                <div
                  v-for="location in locations"
                  :key="location.id"
                  class="location-cell"
                  :class="{
                    'location-cell--can-interact': locationCanInteract(location),
                    'location-cell--occupied': occupiedLocationIds.has(location.id),
                    'location-cell--current-player': currentPlayerLocationIds.has(location.id),
                  }"
                  :data-location-id="location.id"
                  :data-label="location.label"
                  :style="[
                    { 'grid-area': location.label, 'justify-self': 'center' },
                    cosmicEmissaryLocationCellStyles[location.label] ?? {},
                  ]"
                >
                  <div
                    class="location-wrapper"
                    :style="locationOffsetStyle(location)"
                    @pointerdown.capture="onLocationPointerDown($event, location)"
                    @click.capture="suppressLocationInteractionWhenUnlocked"
                  >
                    <div
                      v-if="abyssIsLocation && location.label === 'theAbyss'"
                      class="abyss-location-count"
                      v-tooltip="`${abyssDeckCount} cards in The Abyss`"
                    >
                      {{ abyssDeckCount }}
                    </div>
                    <Location
                      class="location"
                      :class="{
                        'location--unlocked': locationsUnlocked,
                        'location--dragging': draggingLocationId === location.id,
                      }"
                      :game="game"
                      :playerId="playerId"
                      :location="location"
                      @choose="choose"
                      @show="doShowCards"
                    />
                  </div>
                </div>
                <EnemyView
                  v-for="enemy in enemiesAsLocations"
                  :key="enemy.id"
                  :enemy="enemy"
                  :game="game"
                  :playerId="playerId"
                  :data-label="enemy.asSelfLocation"
                  :data-rotation="enemy.meta?.rotation ?? null"
                  :style="[
                    {
                      'grid-area': enemy.asSelfLocation,
                      'justify-self': 'center',
                      'align-items': 'center',
                    },
                    enemy.asSelfLocation
                      ? (cosmicEmissaryEnemyStyles[enemy.asSelfLocation] ?? {})
                      : {},
                  ]"
                  @choose="choose"
                />
                <div
                  v-for="group in gridConcealed"
                  :key="`${group.position.x}-${group.position.y}`"
                  class="concealed-card-group"
                  :style="{ 'grid-area': positionToGridArea(group.position) }"
                >
                  <div v-if="group.unknown.length > 0" class="concealed-card-stack">
                    <ConcealedCardView
                      :card="group.unknown[0]"
                      :game="game"
                      :playerId="playerId"
                      @choose="choose"
                    />
                    <span class="count">{{ group.unknown.length }}</span>
                  </div>
                  <ConcealedCardView
                    v-for="card in group.known"
                    :key="card.id"
                    :card="card"
                    :game="game"
                    :playerId="playerId"
                    @choose="choose"
                  />
                </div>

                <template v-if="barriers">
                  <div
                    v-for="[area, amount] in Object.entries(barriers)"
                    :key="area"
                    class="barrier"
                    :class="{ vertical: isVertical(area) }"
                    :style="{ 'grid-area': `barrier-${area}` }"
                  >
                    <img v-for="n in amount" :key="n" :src="imgsrc('tokens/resource.png')" />
                    <button
                      v-if="debug.active && (amount as number) > 0"
                      @click="
                        debug.send(game.id, {
                          tag: 'ScenarioCountDecrementBy',
                          contents: [{ tag: 'Barriers', contents: area.split('--') }, 1],
                        })
                      "
                    >
                      x
                    </button>
                  </div>
                </template>

                <template v-if="scenario.usesGrid">
                  <template v-for="u in unusedLabels" :key="u">
                    <div
                      v-if="unusedCanInteract(u) !== -1"
                      class="empty-grid-position card"
                      :class="{ 'can-interact': unusedCanInteract(u) !== -1 }"
                      :style="{ 'grid-area': u }"
                      @click="choose(unusedCanInteract(u))"
                    ></div>
                  </template>
                </template>
              </transition-group>
              <div v-if="playerLocationZones.length > 0" class="player-location-zones">
                <section
                  v-for="zone in playerLocationZones"
                  :key="zone.investigatorId"
                  class="player-location-zone"
                >
                  <h3>{{ zone.name }}</h3>
                  <div class="player-location-zone__cards">
                    <Location
                      v-for="location in zone.locations"
                      :key="location.id"
                      class="player-area-location"
                      :game="game"
                      :playerId="playerId"
                      :location="location"
                      @choose="choose"
                      @show="doShowCards"
                    />
                  </div>
                </section>
              </div>
            </div>
          </div>
        </div>
      </RainOverlay>

      <div id="player-zone" :class="{ 'player-zone--fullscreen': locationsFullscreen }">
        <div ref="encounterPilesHost" class="workbench-encounter-piles"></div>
        <p v-if="onlineMultiSeat && workbenchInvestigator" class="workbench-label">
          <span class="workbench-label__title">
            {{ $t('multiplayerTable.myArea') }} ·
            <strong>{{ displayInvestigatorName(workbenchInvestigator) }}</strong>
          </span>
          <span class="workbench-label__stats">
            <span>
              <i>{{ $t('multiplayerTable.health') }}</i>
              <b
                >{{
                  workbenchInvestigator.health -
                  investigatorToken(workbenchInvestigator, TokenType.Damage)
                }}/{{ workbenchInvestigator.health }}</b
              >
            </span>
            <span>
              <i>{{ $t('multiplayerTable.sanity') }}</i>
              <b
                >{{
                  workbenchInvestigator.sanity -
                  investigatorToken(workbenchInvestigator, TokenType.Horror)
                }}/{{ workbenchInvestigator.sanity }}</b
              >
            </span>
            <span>
              <i>{{ $t('multiplayerTable.resources') }}</i>
              <b>{{ investigatorToken(workbenchInvestigator, TokenType.Resource) }}</b>
            </span>
            <span>
              <i>{{ $t('multiplayerTable.cluesShort') }}</i>
              <b>{{ investigatorToken(workbenchInvestigator, TokenType.Clue) }}</b>
            </span>
          </span>
        </p>
        <PlayerTabs
          :game="game"
          :playerId="playerId"
          :players="players"
          :playerOrder="playerOrder"
          :activePlayerId="activePlayerId"
          :tarotCards="props.scenario.tarotCards"
          :pinnedPlayerId="pinWorkbench ? playerId : undefined"
          @choose="choose"
        >
          <div id="totals">
            <!-- The tabletop reads doom off the agenda frame and the clue total
                 off the act frame, so the strip only keeps chaos-token pools. -->
            <template v-if="!desktopTable">
              <PoolItem type="doom" :amount="game.totalDoom" tooltip="Total Doom" />
              <PoolItem type="clue" :amount="game.totalClues" tooltip="Total Spendable Clues" />
            </template>
            <PoolItem v-if="blessTokens > 0" type="chaos-tokens/ct-bless" :amount="blessTokens" />
            <PoolItem v-if="curseTokens > 0" type="chaos-tokens/ct-curse" :amount="curseTokens" />
            <PoolItem v-if="frostTokens > 0" type="chaos-tokens/ct-frost" :amount="frostTokens" />
            <PoolItem v-if="bloodTokens > 0" type="chaos-tokens/ct-blood" :amount="bloodTokens" />
            <PoolItem
              v-for="t in homebrewTotals"
              :key="t.face"
              type="custom-token"
              :image="t.image"
              :amount="t.count"
              :tooltip="t.tooltip"
            />
          </div>
        </PlayerTabs>
      </div>
    </div>
    <ScenarioPhases :phase="phase" :phase-step="phaseStep" />
    <PhaseInterlude :key="game.id" :phase="phase" />
  </div>

  <Teleport to="body">
    <ScenarioDebug
      v-if="debug.active && showScenarioDebugOptions"
      :game="game"
      :scenario="scenario"
      @close="showScenarioDebugOptions = false"
    />
  </Teleport>
</template>

<style scoped>
.shelf-label-icon { width: 13px; height: 13px; margin-right: 4px; vertical-align: -2px; }
.card {
  border-radius: 5px;
  width: var(--card-width);
  height: auto;
  aspect-ratio: var(--card-aspect);
  box-shadow: 1px 1px 6px rgba(0, 0, 0, 0.45);
}

.card--sideways {
  width: auto;
  height: calc(var(--card-width) * 2);
  aspect-ratio: var(--card-sideways-ratio);
}

.deck-size {
  position: absolute;
  font-weight: bold;
  font-size: 1.2em;
  color: rgba(255, 255, 255, 1);
  left: 50%;
  bottom: 55%;
  transform: translateX(-50%) translateY(-50%);
  pointer-events: none;
  -webkit-text-stroke: 1px black;
}

.scenario-cards {
  display: flex;
  align-self: center;
  align-items: center;
  justify-content: center;
  padding: 8px 14px;
  position: relative;
  width: 100%;
  gap: 12px;
  z-index: var(--z-index-neg-2);
  background:
    linear-gradient(180deg, rgb(16 31 32 / 0.94), rgb(24 44 43 / 0.88)),
    url('/assets/veiled-harbour/T01-调查地图底场.avif') center / cover no-repeat;
  border-bottom: 1px solid rgb(205 175 107 / 0.42);
  box-shadow: 0 4px 14px rgb(5 12 13 / 0.3);

  /* Three-zone tray: decks hug the left edge, the scenario guide hugs the
     right edge, and the act/agenda cluster settles in the middle instead of
     everything floating in a centered clump. */
  .scenario-encounter-decks {
    margin-right: auto;
  }

  .scenario-guide {
    margin-left: auto;
  }

  @media (max-width: 800px) and (orientation: portrait) {
    padding-top: 10px;
    padding-bottom: 0;
    min-height: calc(var(--card-height) + 10px);
  }
}

/* A revealed (slid-out) treachery extends down into the board's region; lift the
   whole scenario-cards layer above the board (normally z-index: var(--z-index-neg-2), behind it) so
   the revealed card and its buttons stay clickable. */
.scenario-cards:has(.treachery-group.is-revealed) {
  z-index: var(--z-index-1);
}

.scenario-cards--has-badges {
  z-index: calc(var(--z-index-9999) + 2);
  padding-top: 56px;
}

.clue {
  position: relative;
  width: 57px;
  height: 54px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: black;
  font-weight: 900;
  font-size: 1.5em;

  img {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    right: 0;
    margin: auto;
    z-index: var(--z-index-neg-1);
  }
}

.scenario-body {
  background: transparent;
  z-index: var(--z-index-1);
  width: 100%;
  flex: 1;
  inset: 0;
  position: relative;

  display: grid;
  /* The map is the primary play surface. Keep scenario chrome compact so the
     location graph gets the largest continuous region of the viewport. */
  grid-template-rows: minmax(62px, auto) minmax(420px, 1fr) minmax(168px, 24vh);
  grid-template-columns: minmax(0, 1fr);
  min-height: 0;

  &.scenario-body--notifier-overlays {
    z-index: auto;
  }

  &.split-view {
    grid-template-columns: 1fr 2fr;
    grid-template-rows: 1fr 3fr;
    padding-bottom: 10px;
    row-gap: 30px;

    &:deep(.player-info) {
      grid-column: 1;
      grid-row: 2 / 3;
      display: flex;
      flex-direction: column;

      .tab {
        display: flex;
        flex-direction: column;
        flex: 1;
        border-top-right-radius: 10px;
        overflow: hidden;
      }

      .player-cards {
        overflow: auto;
        display: flex;
        flex-direction: column;
        flex: 1;
        border-top-right-radius: 10px;
      }

      .player {
        display: flex;
        flex-direction: column;
        gap: 10px;
        width: 100%;
        flex: 1;
      }
    }

    .scenario-cards {
      grid-column: 1;
      grid-row: 1 / 2;
      flex-wrap: wrap;
    }

    /* RainOverlay wraps the locations container when html-in-canvas is
       available, which makes ITS host the grid item. Place both, so the
       placement survives whether or not the wrapper is present. No :deep()
       needed — Vue stamps this component's scope id onto a child component's
       root element, and :deep() would compile to a descendant selector that
       cannot match a direct child of .scenario-body. */
    .location-cards-container,
    .rain-host {
      grid-column: 2;
      grid-row: 1 / 3;
    }
  }
}

.location-cards-scroller {
  flex: 1;
  min-height: 0;
  min-width: 0;
  overflow: auto;
  touch-action: manipulation;
  scrollbar-gutter: stable both-edges;
  scroll-padding: 30%;
  padding: 24px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 16px;
  align-items: safe center;
  justify-content: safe center;
}

.player-location-zones {
  grid-area: 2 / 1;
  justify-self: center;
  position: relative;
  z-index: 1;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 12px;
  flex-shrink: 0;
  max-width: 100%;
  padding: 0 12px 12px;
}

.player-location-zone {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px;
  border: var(--edge-width) solid var(--edge-dim);
  border-radius: var(--radius-lg);
  background: color-mix(in srgb, var(--surface-raised) 94%, transparent);

  h3 {
    margin: 0;
    color: var(--text);
    font-size: 0.85rem;
    font-weight: 600;
    text-align: center;
  }
}

.player-location-zone__cards {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: flex-start;
  gap: 12px;

  &:deep(.location) {
    min-width: calc(var(--card-width) + 120px);
  }
}

.location-cards-stage {
  position: relative;
  display: grid;
  row-gap: 16px;
  flex-shrink: 0;
  width: max-content;
  height: max-content;
  overflow: hidden;
}

.location-cards {
  display: grid;
  grid-area: 1 / 1;
  justify-self: center;
  position: relative;
  z-index: 1;
  transition: transform 0.2s ease;
}

.location-cards-container {
  --hidden-location-action-glow: rgba(255, 0, 255, 0.32);
  --hidden-location-action-soft: rgba(255, 0, 255, 0.12);
  --hidden-location-action-top: transparent;
  --hidden-location-action-right: transparent;
  --hidden-location-action-bottom: transparent;
  --hidden-location-action-left: transparent;
  display: flex;
  overflow: hidden;
  flex: 1;
  position: relative;
  background:
    radial-gradient(ellipse at 50% 46%, rgb(229 194 107 / 0.07), transparent 46%),
    radial-gradient(ellipse at 50% 50%, transparent 44%, rgb(4 14 15 / 0.32) 100%),
    linear-gradient(180deg, rgb(14 36 34 / 0.04), rgb(9 28 28 / 0.1)),
    url('/assets/veiled-harbour/T04-地点地图底板-v2.avif') center / cover no-repeat;
  border-bottom: 1px solid rgb(205 175 107 / 0.22);

  &::before {
    content: '';
    position: absolute;
    inset: 8px;
    pointer-events: none;
    border: 1px solid rgb(205 175 107 / 0.42);
    border-radius: 4px;
    box-shadow:
      inset 0 0 22px rgb(7 18 18 / 0.28),
      0 0 0 1px rgb(8 20 20 / 0.22);
    z-index: 0;
  }

  @media (max-width: 800px) and (orientation: portrait) {
    padding-top: 5px;
    padding-bottom: 5px;
  }
}

.location-cards-container--fullscreen {
  position: fixed;
  inset: 0;
  z-index: var(--z-index-50);
  background:
    radial-gradient(ellipse at 50% 46%, rgb(229 194 107 / 0.07), transparent 46%),
    radial-gradient(ellipse at 50% 50%, transparent 44%, rgb(4 14 15 / 0.32) 100%),
    linear-gradient(180deg, rgb(14 36 34 / 0.04), rgb(9 28 28 / 0.1)),
    url('/assets/veiled-harbour/T04-地点地图底板-v2.avif') center / cover no-repeat;
}

/* Split view and the old locations-fullscreen docked control bars are gone:
   the map's only controls are the corner cluster above and the wheel zoom. */

/* Keep the player zone (hand + in-play assets) usable while the board is a
   fixed fullscreen overlay: pin it to the viewport bottom above the overlay. */
.player-zone--fullscreen {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: calc(var(--z-index-50) + 1);
  background:
    radial-gradient(ellipse at 50% 42%, rgba(205, 175, 107, 0.08), transparent 48%),
    linear-gradient(180deg, rgba(20, 33, 34, 0.42), rgba(12, 20, 21, 0.35)),
    var(--deep-sea, #26373a) url('/assets/veiled-harbour/02-牌桌材质.avif') center / cover no-repeat;
  border-top: 1px solid rgba(208, 180, 123, 0.35);
  box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.5);
}

.location-cards-container::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: var(--z-index-30);
  opacity: 0;
  transition: opacity 0.3s ease;
  background:
    linear-gradient(to bottom, var(--hidden-location-action-top), transparent 14px) top / 100% 14px
      no-repeat,
    linear-gradient(to left, var(--hidden-location-action-right), transparent 14px) right / 14px
      100% no-repeat,
    linear-gradient(to top, var(--hidden-location-action-bottom), transparent 14px) bottom / 100%
      14px no-repeat,
    linear-gradient(to right, var(--hidden-location-action-left), transparent 14px) left / 14px 100%
      no-repeat;
  box-shadow: inset 0 0 6px var(--hidden-location-action-soft);
}

.location-cards-container--hidden-action::after {
  opacity: 1;

  @starting-style {
    opacity: 0;
  }
}

.location-cards-scroller {
  cursor: grab;
  user-select: none;
}

.location-cards-scroller:active {
  cursor: grabbing;
}

.location-cards-container--hidden-action-top {
  --hidden-location-action-top: var(--hidden-location-action-glow);
}

.location-cards-container--hidden-action-right {
  --hidden-location-action-right: var(--hidden-location-action-glow);
}

.location-cards-container--hidden-action-bottom {
  --hidden-location-action-bottom: var(--hidden-location-action-glow);
}

.location-cards-container--hidden-action-left {
  --hidden-location-action-left: var(--hidden-location-action-glow);
}

.portrait {
  border-radius: 3px;
}

.agenda-container,
.act-container {
  align-self: flex-start;
}

.discard {
  height: 100%;
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 5px;
  &:deep(.card) {
    margin: 0;
    box-shadow: none;
  }
  .buttons {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }
}

.discard-card {
  position: relative;
  width: fit-content;
  line-height: 0;
  box-shadow: 1px 1px 6px rgba(0, 0, 0, 0.45);
  .card {
    box-shadow: unset;
  }
  &::after {
    border-radius: 6px;
    pointer-events: none;
    content: '';
    position: absolute;
    inset: 0;
    background-color: #fff;
    opacity: 0.85;
    mix-blend-mode: saturation;
  }
}

.scenario-body > .scenario-cards,
.scenario-body > .rain-host {
  min-height: 0;
}

.scenario-body > .scenario-cards {
  padding-block: 4px;
  gap: 8px;
}

.scenario-body > .location-cards-container,
.scenario-body > .rain-host {
  min-width: 0;
  min-height: 0;
}

.location-cards-scroller {
  padding: 16px 24px;
}

.location-cards-container::before {
  inset: 10px 12px;
  border-color: rgb(205 175 107 / 0.28);
  box-shadow: inset 0 0 28px rgb(7 18 18 / 0.18);
}

.location-cards-stage {
  min-width: min(100%, 980px);
  min-height: min(100%, 620px);
}

.location-cards {
  align-content: center;
}

.player-location-zone {
  padding: 5px;
  border: 0;
  border-top: 1px solid rgb(205 175 107 / 0.34);
  border-radius: 0;
  background: rgb(11 27 25 / 0.34);
}

.player-location-zone__cards {
  gap: 6px;
}

.player-location-zone__cards:deep(.location) {
  min-width: calc(var(--card-width) + 12px);
}

@media (min-width: 1200px) {
  .scenario-body {
    grid-template-columns: 280px minmax(0, 1fr) 260px;
    grid-template-rows: minmax(0, 1fr);
    column-gap: 1px;
  }

  .scenario-body > .scenario-cards {
    grid-column: 3;
    grid-row: 1;
    align-self: stretch;
    flex-direction: column;
    justify-content: flex-start;
    overflow-y: auto;
    max-height: none;
    padding: 14px 10px;
    border-left: 1px solid rgb(205 175 107 / 0.35);
    border-bottom: 0;
  }

  .scenario-body > .scenario-cards .scenario-encounter-decks,
  .scenario-body > .scenario-cards .scenario-guide {
    margin-inline: 0;
    width: 100%;
  }

  .scenario-body > .location-cards-container,
  .scenario-body > .rain-host {
    grid-column: 2;
    grid-row: 1;
  }

  .scenario-body > #player-zone {
    grid-column: 1;
    grid-row: 1;
    max-height: none;
    height: 100%;
    flex-direction: column;
    border-top: 0;
    border-right: 1px solid rgb(205 175 107 / 0.35);
    overflow: hidden;
  }

  .scenario-body > #player-zone :deep(.player) {
    flex-direction: column;
  }

  .scenario-body > #player-zone :deep(.investigator-and-deck) {
    flex: 0 0 auto;
    width: 100%;
  }

  .scenario-body > #player-zone :deep(.hand-area) {
    width: 100%;
    min-width: 0;
    flex: 1 1 auto;
    flex-direction: row;
    overflow-x: auto;
    overflow-y: hidden;
  }

  .scenario-cards {
    min-height: 58px;
    max-height: 76px;
  }

  #player-zone {
    max-height: 24vh;
  }
}

@media (max-height: 760px) and (min-width: 801px) and (max-width: 1199px) {
  .scenario-body {
    grid-template-rows: 56px minmax(360px, 1fr) minmax(144px, 22vh);
  }

  #player-zone {
    max-height: 22vh;
  }
}

/* Keep the wide-screen encounter rail a true side panel. The generic tray
   rule below intentionally caps the compact top tray; on desktop the same
   content owns the full right column and must not collapse to a shallow strip. */
@media (min-width: 1200px) {
  .scenario-body > .scenario-cards {
    max-height: none !important;
    min-height: 0;
    align-items: stretch;
  }

  .scenario-body > .scenario-cards .scenario-guide {
    min-height: 0;
    overflow-y: auto;
  }
}

.scenario {
  display: flex;
  user-select: none;
  width: 100%;
  height: 100%;
  flex: 1;
}

.scenario-guide {
  display: flex;
  flex-direction: column;
  position: relative;
  isolation: isolate;
}

.scenario-guide-main {
  position: relative;
  width: fit-content;
}

.scenario-badges {
  position: absolute;
  top: 0;
  right: 0;
  left: 0;
  z-index: calc(var(--z-index-9999) + 2);
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 6px;
  min-height: 34px;
  padding: 5px 10px;
  overflow: visible;
  pointer-events: none;
  background: rgba(0, 0, 0, 0.2);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.scenario-badge {
  position: relative;
  display: inline-flex;
  pointer-events: auto;
  align-items: center;
  gap: 7px;
  min-width: 0;
  max-width: 260px;
  border: 1px solid rgb(255 255 255 / 16%);
  border-left: 3px solid rgb(160 185 190 / 55%);
  border-radius: 6px;
  background: rgb(18 21 24 / 92%);
  color: white;
  padding: 4px 8px 4px 6px;
  box-shadow: 0 1px 3px rgb(0 0 0 / 18%);
}

.scenario-badge-icon {
  flex: 0 0 auto;
  font-size: 0.95rem;
  line-height: 1;
  white-space: nowrap;
}

.scenario-badge-text {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
  line-height: 1.05;
}

.scenario-badge-text strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.68rem;
  letter-spacing: 0.01em;
}

.scenario-badge-text small {
  overflow: hidden;
  opacity: 0.68;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.58rem;
}

.rain-switch {
  pointer-events: auto;
  cursor: pointer;
  border-color: rgb(255 255 255 / 24%);
  border-left-color: rgb(150 195 235 / 90%);
  background: rgb(32 36 42 / 98%);
  color: #fff;
  text-shadow: 0 1px 2px rgb(0 0 0 / 90%);
  box-shadow: 0 2px 8px rgb(0 0 0 / 65%);
}

.rain-switch--on {
  box-shadow:
    inset 0 0 12px rgb(150 195 235 / 16%),
    0 0 0 1px rgb(150 195 235 / 14%),
    0 0 18px rgb(150 195 235 / 32%),
    0 2px 8px rgb(0 0 0 / 65%);
}

.rain-switch-track {
  position: relative;
  flex: 0 0 auto;
  width: 34px;
  height: 18px;
  border-radius: 999px;
  background: #48607a;
  box-shadow: inset 0 0 0 1px rgb(0 0 0 / 35%);
  transition: background 0.15s ease;
}

.rain-switch--on .rain-switch-track {
  background: #8fc0e6;
}

.rain-switch-knob {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #1d2229;
  transition: left 0.15s ease;
}

.rain-switch--on .rain-switch-knob {
  left: 18px;
}

.reality-acid-light-switch-anchor {
  min-width: 136px;
  visibility: hidden;
}

.reality-acid-light-switch {
  z-index: calc(var(--z-index-9999) + 3);
  isolation: isolate;
  pointer-events: auto;
  cursor: pointer;
  border-color: rgb(255 255 255 / 36%);
  border-left-color: rgb(255 225 105 / 95%);
  background: rgb(32 36 42 / 98%);
  color: #fff;
  text-shadow: 0 1px 2px rgb(0 0 0 / 90%);
  box-shadow: 0 2px 8px rgb(0 0 0 / 65%);
}

.reality-acid-light-switch--on {
  box-shadow:
    inset 0 0 12px rgb(255 225 105 / 18%),
    0 0 0 1px rgb(255 225 105 / 16%),
    0 0 20px rgb(255 225 105 / 42%),
    0 2px 8px rgb(0 0 0 / 65%);
}

.reality-acid-light-switch--floating {
  position: fixed;
  z-index: 2147483647;
  max-width: none;
}

.reality-acid-light-switch-track {
  position: relative;
  flex: 0 0 auto;
  width: 34px;
  height: 18px;
  border-radius: 999px;
  background: #d6c36a;
  box-shadow: inset 0 0 0 1px rgb(0 0 0 / 35%);
}

.reality-acid-light-switch-knob {
  position: absolute;
  top: 3px;
  left: 18px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: white;
  box-shadow: 0 1px 3px rgb(0 0 0 / 50%);
  transition: left 120ms ease;
}

.reality-acid-light-switch--on .reality-acid-light-switch-track {
  background: #263241;
}

.reality-acid-light-switch--on .reality-acid-light-switch-knob {
  left: 4px;
}

.reality-acid-light-switch .scenario-badge-text strong {
  color: #fff;
  font-size: 0.74rem;
}

.reality-acid-light-switch .scenario-badge-text small {
  color: #ffe078;
  opacity: 1;
}

.reality-acid-light-switch-label {
  text-align: left;
}

.scenario-cards-under {
  align-self: center;
  margin-top: 2px;
}

/* A single-cell grid: the card stack and every counter overlay share the same
   cell, so tokens always land on the card no matter what siblings (pool, keys,
   cards-underneath button) render around it. */
.scenario-guide-card-wrapper {
  display: grid;
  width: fit-content;

  > * {
    grid-area: 1 / 1;
  }

  .depth,
  .civilians-slain,
  .targets,
  .scraps,
  .switches,
  .darkness-level,
  .strength-of-the-abyss,
  .cthulhuRage {
    align-self: end;
    justify-self: end;
    pointer-events: none;
    z-index: var(--z-index-10);
  }

  .signOfTheGods {
    align-self: end;
    justify-self: end;
    pointer-events: none;
    z-index: var(--z-index-10);
  }

  .distortion {
    align-self: end;
    justify-self: end;
    pointer-events: none;
    z-index: var(--z-index-10);
  }

  .spiritualDisturbance {
    align-self: end;
    justify-self: end;
    pointer-events: none;
    z-index: var(--z-index-10);
  }

  .pool {
    align-self: end;
    justify-self: end;
    pointer-events: none;
    z-index: var(--z-index-10);
  }

  .spent-keys {
    align-self: end;
    justify-self: center;
    margin-bottom: 20px;
    pointer-events: none;
    z-index: var(--z-index-10);
  }
}

.map-move {
  transition: all 0.6s cubic-bezier(0.23, 1, 0.32, 1);
}

.map-leave-to {
  opacity: 0;
}

.map-leave-active {
  position: absolute;
}

.scenario-decks {
  gap: 5px;
  @media (max-width: 800px) and (orientation: portrait) {
    display: flex !important;
  }
}

@media (prefers-reduced-motion: no-preference) {
  .deck-advance-leave-active {
    pointer-events: none;
    position: relative;
    z-index: var(--z-index-10);
  }

  .deck-advance-leave-active :deep(.agenda-card > img.card--agenda),
  .deck-advance-leave-active :deep(.act-row > .card-container > img.card) {
    will-change: transform, opacity;
    transition:
      transform 420ms cubic-bezier(0.22, 1, 0.36, 1),
      opacity 320ms ease-in;
  }

  .deck-advance-leave-to :deep(.agenda-card > img.card--agenda),
  .deck-advance-leave-to :deep(.act-row > .card-container > img.card) {
    opacity: 0;
    transform: translate3d(0, -32px, 0) scale(1.035);
  }
}

.scenario-encounter-decks {
  display: grid;
  grid-template: 'encounterDiscard encounterDeck' 'spectralDiscard spectralDeck';
  gap: 10px;
}

.scenario-encounter-decks > .discard {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.scenario-encounter-decks .pile-label--discard {
  display: block;
  color: rgb(214 186 128 / 0.85);
  font-size: 0.68rem;
  line-height: 1.1;
  text-align: center;
  white-space: nowrap;
}

.scenario-balance-placeholder {
  flex: 0 1 var(--card-width);
  width: var(--card-width);
  min-width: 0;
  aspect-ratio: var(--card-aspect);
  visibility: hidden;
}

.empty-grid-position {
  content: ' ';
  box-shadow: unset;
  justify-self: center;
}

.can-interact {
  background: rgba(0, 0, 0, 0.5);
  border: 2px solid var(--select);
  cursor: pointer;
}

.pool {
  position: absolute;
  top: 10%;
  align-items: center;
  display: flex;
  align-self: flex-start;
  align-items: flex-end;
  pointer-events: none;

  * {
    transform: scale(0.9);
  }
}

.tarot-card {
  width: var(--card-width);
  aspect-ratio: var(--card-tarot-aspect);
  margin: 0;
}

.tarot-card-container {
  transition: transform 0.5s ease-in-out;
  display: flex;
  position: relative;
  border-radius: 5px;

  &.Reversed {
    transform: rotateZ(180deg);
    &:before {
      transform-origin: center;
      animation-fill-mode: forwards;
      animation: shadow-rotate 0.5s linear;
      transform: translate(0, -12px);
    }
  }
}

@keyframes shadow-rotate {
  0% {
    transform: translate(0, 12px);
  }
  25% {
    transform: translate(6px, 12px);
  }
  50% {
    transform: translate(12px, 0px);
  }
  75% {
    transform: translate(6px, -12px);
  }
  100% {
    transform: translate(0, -12px);
  }
}

.tarot-cards {
  display: flex;
  gap: 10px;
  margin-inline: 10px;
}

/* We lower the margin so things line up a bit better. */
[data-scenario='c06333'] .location-cards:deep(.location-container) {
  margin: 20px !important;
}

.buttons-row {
  padding: 10px;
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  justify-content: space-around;

  .blessed {
    background: var(--blessed);
    color: var(--text-on-dark);
  }

  .cursed {
    background: var(--cursed);
    color: var(--text-on-dark);
  }

  .auto-fail-button {
    background: var(--auto-fail);
    color: var(--text-on-dark);
  }

  .elder-sign-button {
    background: var(--elder-sign);
    color: var(--text-on-dark);
  }

  .frost {
    background: var(--frost);
    color: var(--text-on-dark);
  }

  .blood {
    background: var(--blood);
    color: var(--blood-red);
  }

  button {
    margin: 0;
  }
}

.button {
  padding: 5px 10px;
  font-size: 1em;
}

.card-row-cards {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 10px;
  gap: 2px;
  flex-wrap: wrap;

  .card-row-card {
    position: relative;
  }
}

.location {
  &:hover {
    z-index: var(--z-index-100);
  }
}

.button {
  border: var(--edge-width) solid var(--edge-dim);
  margin-top: 2px;
  color: var(--button-text);
  cursor: pointer;
  border-radius: 4px;
  background-color: var(--button);
  z-index: var(--z-index-1000);
  width: 100%;
  min-width: max-content;
}

.keys {
  display: flex;
  flex-direction: row;
  gap: 2px;
}

.scenario-guide-card {
  position: relative;
}

.debug-difficulty {
  display: flex;
  flex-direction: column;
  align-self: center;
  gap: 2px;
  margin-top: 2px;
  width: var(--card-width);
  color: white;
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
}

.debug-difficulty select {
  width: 100%;
  min-width: 0;
  border: 1px solid rgba(255, 255, 255, 0.25);
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.65);
  color: white;
  font-size: 0.75rem;
}

.scenario-debug-toggle {
  align-self: center;
  width: var(--card-width);
  margin-top: 4px;
  border: 1px solid rgba(255, 255, 255, 0.25);
  border-radius: 4px;
  background: var(--button);
  color: var(--text);
  cursor: pointer;
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
}

.spent-keys {
  pointer-events: none;
  display: flex;
  flex-direction: row;
  gap: 2px;

  &:deep(img) {
    width: 10px;
  }
}

/* Lock + reset float on the map's top-right corner: bare ghost icons, no
   frame, matching the game-bar control language. */
.location-cell {
  /* Grid placement + TransitionGroup FLIP target. The inner .location carries
     the user's drag offset transform, so rotation reshuffles (which FLIP-
     animate the wrapper) don't wipe that offset.

     The cell's untransformed grid box can overlap a different translated
     location. Do not let that invisible/original box win hit-testing; only the
     translated visible wrapper should receive pointer events. */
  display: block;
  position: relative;
  pointer-events: none;
}

.location-cell--can-interact {
  z-index: var(--z-index-20);
}

.location-cell--occupied {
  z-index: var(--z-index-10);
}

/* While a swarm is fanned open (hovering the swarm, or its abilities menu is open),
   lift the whole cell above its neighbours so the fanned cards aren't occluded by an
   adjacent location's wrapper — otherwise sweeping across the fan would lose hover. */
.location-cell:has(.enemy--outer:hover),
.location-cell:has(.swarm:hover),
.location-cell:has(.enemy--swarming.showAbilities) {
  z-index: var(--z-index-30);
}

.location-wrapper {
  position: relative;
  width: fit-content;
  padding: 3px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  box-shadow: 0 5px 12px rgb(4 14 15 / 0.25);
  transition:
    border-color 0.18s ease,
    background-color 0.18s ease,
    box-shadow 0.18s ease;
}

.location-cell--occupied > .location-wrapper {
  box-shadow: 0 5px 12px rgb(4 14 15 / 0.32);
}

.location-cell--current-player > .location-wrapper {
  border: 1px solid rgb(229 194 107 / 0.92);
  background: rgb(229 194 107 / 0.08);
  box-shadow:
    0 0 0 2px rgb(229 194 107 / 0.1),
    0 8px 16px rgb(4 14 15 / 0.36);
}

.location-cell--can-interact > .location-wrapper {
  border-width: 2px;
  border-style: solid;
  border-color: var(--select, #d5bb83);
  background: rgb(213 187 131 / 0.14);
  box-shadow:
    0 0 0 3px rgb(213 187 131 / 0.12),
    0 8px 16px rgb(4 14 15 / 0.34);
}

.abyss-location-count {
  display: block;
  width: fit-content;
  margin: 0 auto 6px;
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(10, 13, 25, 0.9);
  border: 1px solid rgba(111, 225, 210, 0.8);
  box-shadow: 0 0 8px rgba(111, 225, 210, 0.45);
  color: white;
  font-size: 0.85rem;
  font-weight: bold;
  cursor: help;
}

.location-cell > .location-wrapper {
  pointer-events: auto;

  /* Animate the offset along with the wrapper's FLIP move during rotation so
     the offset doesn't snap to its rotated value before the wrapper slides
     into place. Same easing/duration as .map-move keeps them in sync. */
  transition: transform 0.6s cubic-bezier(0.23, 1, 0.32, 1);
}

/* Wide desktop board: reserve a real phase rail above the three play columns,
   then give each column a predictable budget. This keeps phase labels out of
   the game bar and prevents the side rails from stealing map space at runtime. */
@media (min-width: 1200px) {
  .scenario {
    position: relative;
    min-height: 0;
  }

  .scenario-body {
    grid-template-columns: 300px minmax(0, 1fr) 280px;
    padding-top: 38px;
    box-sizing: border-box;
  }

  .scenario-body > #player-zone {
    width: auto;
  }

  #player-zone {
    --card-width: min(calc(1.8vw + 42px), 72px);
  }

  .location-cards-container {
    --card-width: min(calc(1.2vw + 50px), 72px);
  }

  #player-zone :deep(.player-cards) {
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    min-height: 0;
    overflow-x: hidden;
    overflow-y: auto;
  }

  #player-zone :deep(.player-cards > .in-play-row) {
    flex: 0 0 auto;
    width: 100%;
    min-width: 0;
    overflow: hidden;
  }

  #player-zone :deep(.in-play-row > .in-play) {
    width: 0;
    min-width: 0;
  }

  #player-zone :deep(.player) {
    flex: 1 1 auto;
    min-height: 0;
    min-width: 0;
    width: 100%;
    align-items: stretch;
    overflow: hidden;
  }

  #player-zone :deep(.player-info) {
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
  }

  #player-zone :deep(.tab) {
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    min-height: 0;
    overflow: hidden;
  }

  #player-zone :deep(.player-cards > .in-play-row) {
    max-height: 90px;
  }

  #player-zone :deep(.investigator-and-deck) {
    flex: 0 0 auto;
  }

  #player-zone :deep(.hand-area) {
    flex: 1 1 150px;
    min-height: 107px;
    width: 100%;
    flex-direction: column !important;
    align-items: stretch !important;
    gap: 2px;
    padding-bottom: 0;
    overflow: hidden !important;
  }

  #player-zone :deep(.hand-area > section.hand) {
    flex: 1 1 auto;
    width: 100%;
    min-width: 0;
    min-height: 0;
    overflow-x: auto;
    overflow-y: hidden;
  }

  #player-zone :deep(.hand-area > section.hand > *) {
    flex: 0 0 auto;
  }

  .scenario-body > .scenario-cards {
    background:
      radial-gradient(circle at 50% 8%, rgb(205 175 107 / 0.08), transparent 34%),
      linear-gradient(180deg, rgb(16 31 32 / 0.97), rgb(10 23 23 / 0.96)),
      url('/assets/veiled-harbour/T05-底部行动托盘纹理-v1.avif') center / cover no-repeat;
    box-shadow:
      inset 0 0 30px rgb(4 14 15 / 0.34),
      -4px 0 16px rgb(4 12 12 / 0.2);
  }

  .scenario-body > .scenario-cards::before {
    content: '';
    position: absolute;
    inset: 10px 8px;
    z-index: 0;
    border: 1px solid rgb(205 175 107 / 0.18);
    border-radius: 6px;
    pointer-events: none;
  }

  .scenario-body > .scenario-cards > * {
    position: relative;
    z-index: 1;
  }

  #player-zone :deep(.player-info),
  #player-zone :deep(.player-cards),
  #player-zone :deep(.player) {
    color: var(--text-on-dark, #f4efe4);
  }

  #player-zone :deep(.skip-triggers-button[disabled]) {
    opacity: 1;
    background: rgb(191 200 197 / 0.94);
    border: 1px solid rgb(229 239 233 / 0.68);
    color: rgb(31 43 41);
  }
}

@media (min-width: 801px) and (max-width: 1199px) {
  .scenario-body {
    grid-template-rows: minmax(56px, auto) minmax(360px, 1fr) minmax(150px, 24vh);
  }
}

.location--unlocked {
  cursor: grab;
  outline: 1px dashed var(--spooky-green);
  outline-offset: 4px;
  border-radius: 6px;
  touch-action: none;
}

.location--dragging {
  cursor: grabbing;
  z-index: var(--z-index-50);
  transition: none !important;
}

.barrier {
  display: flex;
  flex-direction: column;
  width: calc(var(--card-width) / 4);
  height: calc(var(--card-width) / var(--card-aspect));
  align-self: flex-start;
  justify-content: center;

  img {
    width: 20px;
  }

  &.vertical {
    flex-direction: row;
    height: 40px;
    width: 100px;
    justify-self: center;
    img {
      height: 20px;
    }
  }
}

.treacheries {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.treachery-group {
  display: flex;
  gap: 5px;
  flex-direction: row;
  &:not(:first-of-type) {
    margin-top: -50px;
  }
  /*position: inherit; */
  transition: margin-top 0.3s;
  position: relative;

  &:hover {
    margin-top: 0px;
    .treachery-card {
      margin-left: 0;
    }
  }
}

.treachery {
  box-shadow: 1px 1px 6px rgba(0, 0, 0, 0.45);
}

.treachery-card {
  margin-left: -50px;
  transition: margin-left 0.3s;
  &:first-of-type {
    margin-left: 0;
  }
}

.scenario-guide-card {
  display: flex;
  flex-direction: column;
  img:nth-of-type(1) {
    z-index: var(--z-index-2);
  }

  img:not(:nth-of-type(1)) {
    z-index: var(--z-index-1);
    margin-top: calc((var(--card-width) / (3 / 2)) * -1);
  }
}

#player-zone {
  position: relative;
  isolation: isolate;
  display: flex;
  flex-direction: row;
  /* Player cards stay a step smaller than board cards so the hand and slot
     rows leave enough viewport height for the location map. */
  --card-width: min(calc(2.5vw + 14px), 52px);
  max-height: 40vh;
  min-height: 0;
  background:
    radial-gradient(ellipse at 50% 0%, rgb(229 194 107 / 0.08), transparent 42%),
    linear-gradient(180deg, rgb(17 29 27 / 0.12), rgb(11 20 19 / 0.48)),
    /* 110% over-scans the plate: its printed edge trim sits ~1% inside its own
       edges, so at `cover` it lands on ours and reads as a stray rule. Height
       stays auto so the grain keeps its proportions. */
    url('/assets/veiled-harbour/T02-调查员皮革桌垫.avif') center / 110% auto no-repeat;
  border-top: 1px solid rgb(205 175 107 / 0.6);
  box-shadow: 0 -6px 18px rgb(5 12 13 / 0.36);
  .player-info {
    flex: 1;
    min-height: 0;
  }
  /* Relax the flex chain down to the hand so the 40vh cap scrolls the hand
     instead of clipping it. */
  :deep(.player-info > *),
  :deep(.player-container),
  :deep(.player-cards) {
    min-height: 0;
  }
  :deep(.player-cards) {
    overflow-y: auto;
  }
  @media (max-width: 800px) {
    padding-bottom: 50px;
  }
}

/* Final tabletop polish: the board reads as one illuminated surface while
   the player rail remains a deliberate leather-and-brass instrument panel. */
.scenario-body > #player-zone {
  box-shadow:
    inset -1px 0 0 rgb(244 239 228 / 0.06),
    8px 0 22px rgb(4 12 12 / 0.2);
}

.scenario-body > .scenario-cards {
  background:
    radial-gradient(circle at 50% 10%, rgb(229 194 107 / 0.1), transparent 30%),
    linear-gradient(180deg, rgb(16 31 32 / 0.97), rgb(10 23 23 / 0.98)),
    url('/assets/veiled-harbour/T05-底部行动托盘纹理-v1.avif') center / cover no-repeat;
  box-shadow:
    inset 0 0 30px rgb(4 14 15 / 0.38),
    inset 1px 0 0 rgb(244 239 228 / 0.05),
    -4px 0 16px rgb(4 12 12 / 0.2);
}

#player-zone :deep(.hand-area) {
  background:
    linear-gradient(180deg, rgb(12 28 27 / 0.68), rgb(7 17 17 / 0.58)),
    url('/assets/veiled-harbour/T05-底部行动托盘纹理-v1.avif') center / cover no-repeat;
  border-color: rgb(205 175 107 / 0.38);
  box-shadow: inset 0 1px 0 rgb(244 239 228 / 0.05);
}

#player-zone :deep(.hand-area__header) {
  padding-inline: 6px;
  color: rgb(244 239 228 / 0.92);
  text-transform: uppercase;
}

/* Doom/clue counters sit inline at the end of the investigator-tab row; they
   no longer own a bordered strip of the player zone. */
#totals {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 2px;
  margin: 0 6px 0 auto;
  padding: 2px 4px;
  align-self: center;
}

.tri-button {
  background-color: var(--button);
  color: white;
  padding: 0;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  overflow: hidden;
  box-shadow: 1px 1px 6px rgba(0, 0, 0, 0.45);
  .bless-icon,
  .curse-icon {
    color: white;
    min-width: fit-content;
  }
  span {
    height: 100%;
    aspect-ratio: 1 / 1;
    padding: 0 5px;
    border-left: 1px solid rgba(0, 0, 0, 0.2);
    border-right: 1px solid rgba(0, 0, 0, 0.2);
    justify-content: center;
    display: flex;
    align-items: center;
  }

  .skull-icon {
    color: var(--skull);
    text-shadow: 0px 0px 2px rgba(255, 255, 255, 0.5);
  }

  .tablet-icon {
    color: var(--tablet);
    text-shadow: 0px 0px 2px rgba(255, 255, 255, 0.5);
  }

  .cultist-icon {
    color: var(--cultist);
    text-shadow: 0px 0px 2px rgba(255, 255, 255, 0.5);
  }

  .elder-thing-icon {
    color: var(--elder-thing);
    text-shadow: 0px 0px 2px rgba(255, 255, 255, 0.5);
  }

  button {
    width: 1em;
    border-radius: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  button:hover {
    background: rgba(0, 0, 0, 0.2);
  }
}

.close-button {
  background: var(--button);
  &:hover {
    background: var(--button-highlight);
  }
}

.in-the-shadows {
  background: rgba(0, 0, 0, 0.5);
  padding: 10px;
  min-width: 10vw;
  border-radius: 1vw;
  display: flex;
  flex-direction: row;
  gap: 10px;
  &:deep(.location) {
    min-width: unset;
  }
  &:deep(.location-container) {
    grid-template-columns: 0 1fr 0;
    min-height: unset;
    grid-column-gap: 0;
  }
}

.spoken-hastur-recorder {
  position: absolute;
  top: 4px;
  right: -42px;
  z-index: calc(var(--z-index-9999) + 1);
}

.spoken-hastur-button {
  position: relative;
  width: 34px;
  height: 34px;
  display: inline-grid;
  place-items: center;
  border: 1px solid rgba(241, 196, 15, 0.45);
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.28);
  cursor: pointer;

  img {
    width: 22px;
    height: 22px;
    filter: sepia(1) saturate(5) hue-rotate(350deg) brightness(1.15);
  }

  &:hover {
    background: rgba(241, 196, 15, 0.16);
    border-color: rgba(241, 196, 15, 0.75);
  }

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
}

.concealed-card {
  width: calc(var(--card-width) * 0.55);
  border-radius: 3px;
}

.concealed-card-stack {
  position: relative;
  display: grid;
  grid-template-areas: 'stack';
  align-items: center;
  justify-items: center;
  > * {
    grid-area: stack;
    justify-self: center;
  }
  .count {
    align-self: start;
    margin-top: 5%;
    font-weight: bold;
    border-radius: 100vw;
    background-color: rgba(255, 255, 255, 0.6);
    width: auto;
    height: 1.2em;
    display: grid;
    aspect-ratio: 1 / 1;
    text-align: center;
    align-content: center;
    justify-content: center;
    pointer-events: none;
  }
}

.concealed-card-group {
  display: grid;
  place-content: center;
}
.cthulhu-board-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  width: fit-content;
}

.resolving-cthulhu-card {
  flex: 0 0 auto;
  width: var(--card-width);

  img {
    display: block;
    width: 100%;
    border-radius: 6px;
    box-shadow:
      0 3px 6px rgba(0, 0, 0, 0.23),
      0 3px 6px rgba(0, 0, 0, 0.53);

    &.source-highlight {
      box-shadow:
        0 0 0 3px var(--important),
        0 0 12px 3px var(--important),
        0 0 22px 5px var(--important),
        var(--card-shadow);
      filter: brightness(1.08);
    }
  }
}

/* ---------------------------------------------------------------------------
   Multiplayer tabletop, desktop only (min-width: 1200px)

   The shared board keeps the top of the table: the investigation map takes the
   remaining width and the scenario shelf becomes a compact right-hand column.
   When the seats belong to different people, a second rail carries only what is
   public about the other investigators. The investigator being looked at then
   owns a full-width workbench, so character, cards in play and hand read as one
   surface instead of three narrow columns.
   --------------------------------------------------------------------------- */
@media (min-width: 1200px) {
  .scenario-body.scenario-body--multiseat {
    /* The scenario shelf leads: agenda and act sit against the left edge, the
       investigation map takes the rest. The cards are capped by half the shelf's
       height, so this column must stay at least as wide as they are: with the
       height cap binding, the frames fill their halves and meet each other, and
       the map's edge lands on the frame. Any narrower and the width takes over
       as the cap, the cards shrink, and the two frames part. The workbench's
       seam is derived from this same width, so the clamp lives here alone. */
    --shelf-width: clamp(248px, 26vw, 372px);
    grid-template-columns: var(--shelf-width) minmax(0, 1fr);
    /* The workbench is sized by its own contents. A fixed height squeezed the
       in-play and hand rows (both clip with overflow: hidden), which cut the
       bottom off every card; the map above simply takes what is left. */
    grid-template-rows: minmax(0, 1fr) auto;
    column-gap: 0;
    row-gap: 0;
    /* The phase rail is exactly 34px tall, so this much clears it and no more:
       any extra reads as a bare band above the map's top edge and the shelf. */
    padding-top: 34px;
  }

  .scenario-body.scenario-body--multiseat.scenario-body--online {
    --shelf-width: clamp(240px, 21vw, 372px);
    grid-template-columns:
      var(--shelf-width)
      minmax(0, 1fr)
      clamp(200px, 15vw, 236px);
  }

  /* An opened teammate needs room for a character card and its stats. */
  .scenario-body.scenario-body--multiseat.scenario-body--online.scenario-body--teammate-open {
    --shelf-width: clamp(320px, 26vw, 392px);
    grid-template-columns:
      var(--shelf-width)
      minmax(0, 1fr)
      clamp(184px, 13vw, 216px);
  }

  .scenario-body.scenario-body--multiseat > .location-cards-container,
  .scenario-body.scenario-body--multiseat > .rain-host {
    grid-column: 2;
    grid-row: 1;
  }
  /* The shelf's column is a hair wider than the agenda/act frames, and that
     sliver of table showed between the frames and the map. The plate crops its
     own margin on all four sides, so its brass line sits on the element's edge:
     widening the box leftward brings that edge onto the frame's right edge, the
     same way the other three sides meet their neighbours. The column keeps its
     width, so the cards are untouched. */
  .scenario-body.scenario-body--multiseat > .location-cards-container {
    margin-left: -3px;
  }

  /* ---- scenario shelf ---- */
  .scenario-body.scenario-body--multiseat > .scenario-cards {
    grid-column: 1;
    grid-row: 1;
    align-self: stretch;
    min-height: 0;
    max-height: none !important;
    padding: 12px 10px 14px;
    overflow-x: hidden;
    overflow-y: auto;
    align-items: stretch;
    gap: 10px;
    border: 0;
    border-right: 1px solid rgb(205 175 107 / 0.38);
    background:
      radial-gradient(circle at 50% 8%, rgb(229 194 107 / 0.09), transparent 34%),
      linear-gradient(180deg, rgb(16 31 32 / 0.97), rgb(9 22 22 / 0.98)),
      url('/assets/veiled-harbour/41-多人牌桌底场-v1.avif') center / cover no-repeat;
    box-shadow:
      inset -1px 0 0 rgb(244 239 228 / 0.05),
      5px 0 18px rgb(4 12 12 / 0.2);
  }

  .scenario-body.scenario-body--multiseat > .scenario-cards .scenario-encounter-decks {
    gap: 6px;
  }

  .table-shelf-header {
    position: relative;
    /* isolation keeps the watermark's z-index: -1 inside the header; otherwise
       it sinks beneath the opaque .scenario-cards background and disappears */
    isolation: isolate;
    flex: 0 0 auto;
    padding: 0 2px 10px;
    border-bottom: 1px solid rgb(205 175 107 / 0.32);
  }

  .table-shelf-header::after {
    content: '';
    position: absolute;
    z-index: -1;
    top: 10px;
    right: 2px;
    width: 84px;
    height: 84px;
    background: url('/assets/veiled-harbour/50-潮汐罗盘印记-v1.png') center / contain no-repeat;
    opacity: 0.2;
    pointer-events: none;
  }

  .table-shelf-header__eyebrow,
  .table-shelf-header h2 {
    margin: 6px 0 2px;
    color: rgb(248 239 211 / 0.98);
    font-family: Arno, 'Source Han Serif', serif;
    font-size: 1.14rem;
    line-height: 1.15;
  }

  .table-shelf-header__focus span,
  /* ---- teammate rail (separate seats only) ---- */
  .scenario-body.scenario-body--multiseat.scenario-body--online > .teammate-rail {
    grid-column: 3;
    grid-row: 1;
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-height: 0;
    padding: 12px 10px 14px;
    overflow-x: hidden;
    overflow-y: auto;
    border-left: 1px solid rgb(205 175 107 / 0.3);
    background:
      radial-gradient(circle at 50% 10%, rgb(229 194 107 / 0.07), transparent 32%),
      linear-gradient(180deg, rgb(15 29 30 / 0.97), rgb(9 22 22 / 0.98)),
      url('/assets/veiled-harbour/41-多人牌桌底场-v1.avif') center / cover no-repeat;
    box-shadow:
      inset 1px 0 0 rgb(244 239 228 / 0.04),
      -5px 0 18px rgb(4 12 12 / 0.2);
  }

  .teammate-rail__header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 8px;
    color: rgb(214 186 128 / 0.78);
    font-size: 0.68rem;
    letter-spacing: 0.08em;
  }

  .teammate-rail__header small {
    color: rgb(214 220 210 / 0.44);
    font-size: 0.6rem;
    letter-spacing: 0;
  }

  .teammate-card {
    display: grid;
    grid-template-columns: 40px minmax(0, 1fr);
    grid-template-areas:
      'portrait name'
      'portrait location'
      'stats stats'
      'assets assets';
    align-items: center;
    gap: 2px 8px;
    flex: 0 0 auto;
    width: 100%;
    padding: 8px 9px 9px;
    border: 1px solid rgb(205 175 107 / 0.2);
    border-left: 3px solid rgb(124 168 147 / 0.7);
    border-radius: 4px;
    background: linear-gradient(135deg, rgb(30 54 48 / 0.72), rgb(12 27 26 / 0.84));
    color: rgb(244 239 228 / 0.92);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  .teammate-card:hover {
    border-left-color: rgb(229 194 107 / 0.9);
  }

  .teammate-card:focus-visible {
    outline: 2px solid rgb(229 194 107 / 0.9);
    outline-offset: 2px;
  }

  .teammate-card--active {
    border-color: rgb(229 194 107 / 0.5);
    background: linear-gradient(135deg, rgb(59 61 43 / 0.86), rgb(18 32 29 / 0.88));
  }

  .teammate-card--guardian {
    border-left-color: rgb(196 104 98 / 0.85);
  }

  .teammate-card--seeker {
    border-left-color: rgb(119 177 196 / 0.88);
  }

  .teammate-card--rogue {
    border-left-color: rgb(150 128 196 / 0.88);
  }

  .teammate-card--mystic {
    border-left-color: rgb(160 118 168 / 0.88);
  }

  .teammate-card--survivor {
    border-left-color: rgb(150 168 118 / 0.88);
  }

  .teammate-card__portrait {
    grid-area: portrait;
    width: 40px;
    height: 40px;
    border: 1px solid rgb(205 175 107 / 0.36);
    border-radius: 3px;
    object-fit: cover;
    object-position: 50% 12%;
  }

  .teammate-card__name {
    grid-area: name;
    display: flex;
    align-items: baseline;
    gap: 5px;
    min-width: 0;
    overflow: hidden;
    font-size: 0.82rem;
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .teammate-card__name em {
    flex: 0 0 auto;
    padding: 1px 5px;
    border-radius: 999px;
    background: rgb(229 194 107 / 0.18);
    color: rgb(244 226 176 / 0.96);
    font-size: 0.58rem;
    font-style: normal;
    letter-spacing: 0.04em;
  }

  .teammate-card__location {
    grid-area: location;
    overflow: hidden;
    color: rgb(214 220 210 / 0.56);
    font-size: 0.64rem;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .teammate-card__stats {
    grid-area: stats;
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 2px 6px;
    margin-top: 6px;
    padding-top: 5px;
    border-top: 1px solid rgb(205 175 107 / 0.16);
  }

  .teammate-card__stats span {
    display: grid;
    min-width: 0;
  }

  .teammate-card__stats b {
    color: rgb(248 239 211 / 0.94);
    font-family: Teutonic, Georgia, serif;
    font-size: 0.82rem;
    font-weight: 500;
  }

  .teammate-card__stats i {
    overflow: hidden;
    color: rgb(214 220 210 / 0.5);
    font-size: 0.58rem;
    font-style: normal;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .teammate-card__assets {
    grid-area: assets;
    display: flex;
    align-items: center;
    gap: 3px;
    margin-top: 6px;
  }

  .teammate-card__assets img {
    width: 26px;
    border-radius: 2px;
    box-shadow: 0 1px 3px rgb(4 12 12 / 0.5);
  }

  .teammate-card__assets em {
    color: rgb(214 220 210 / 0.6);
    font-size: 0.62rem;
    font-style: normal;
  }

  /* Public detail for one teammate: no hand, no control buttons. */
  .teammate-detail {
    display: grid;
    gap: 10px;
    flex: 0 0 auto;
    padding: 10px;
    border: 1px solid rgb(205 175 107 / 0.34);
    border-radius: 5px;
    background: linear-gradient(180deg, rgb(22 42 40 / 0.86), rgb(10 23 22 / 0.9));
  }

  .teammate-detail__top {
    display: grid;
    grid-template-columns: minmax(0, 132px) minmax(0, 1fr);
    align-items: start;
    gap: 10px;
  }

  /* The public detail shows the printed character card, not a thumbnail. */
  .teammate-detail__card {
    width: 100%;
    border-radius: 4px;
    box-shadow: 0 2px 8px rgb(4 12 12 / 0.5);
  }

  .teammate-detail__identity {
    display: grid;
    align-content: start;
    gap: 3px;
    min-width: 0;
  }

  .teammate-detail__identity strong {
    overflow: hidden;
    color: rgb(248 239 211 / 0.98);
    font-size: 0.9rem;
    font-weight: 600;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .teammate-detail__identity small {
    color: rgb(214 220 210 / 0.6);
    font-size: 0.66rem;
  }

  .teammate-detail__identity em {
    justify-self: start;
    padding: 1px 6px;
    border-radius: 999px;
    background: rgb(229 194 107 / 0.18);
    color: rgb(244 226 176 / 0.96);
    font-size: 0.6rem;
    font-style: normal;
  }

  /* The state reads from its own wording first; the tint only reinforces it. */
  .teammate-detail__identity em.teammate-detail__state--waiting,
  .teammate-card__name em.teammate-card__state--waiting {
    background: rgb(166 80 69 / 0.26);
    color: rgb(246 214 198 / 0.98);
  }

  .teammate-detail__identity em.teammate-detail__state--eliminated,
  .teammate-card__name em.teammate-card__state--eliminated {
    background: rgb(214 220 210 / 0.14);
    color: rgb(214 220 210 / 0.6);
  }

  .teammate-detail__close {
    justify-self: start;
    min-height: 0;
    margin-top: 2px;
    padding: 3px 8px;
    border: 1px solid rgb(205 175 107 / 0.3);
    border-radius: 3px;
    background: rgb(9 23 22 / 0.7);
    color: rgb(214 220 210 / 0.8);
    font-size: 0.64rem;
    cursor: pointer;
  }

  .teammate-detail__stats {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 6px 8px;
    margin: 0;
    padding-top: 9px;
    border-top: 1px solid rgb(205 175 107 / 0.18);
  }

  .teammate-detail__stats div {
    display: grid;
    min-width: 0;
  }

  .teammate-detail__stats dt {
    color: rgb(214 220 210 / 0.5);
    font-size: 0.58rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .teammate-detail__stats dd {
    margin: 0;
    color: rgb(248 239 211 / 0.96);
    font-family: Teutonic, Georgia, serif;
    font-size: 0.92rem;
  }

  .teammate-detail__cards {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
    padding-top: 9px;
    border-top: 1px solid rgb(205 175 107 / 0.18);
    --card-width: 66px;
  }

  .teammate-detail__cards--threat {
    border-top-color: rgb(196 104 98 / 0.42);
  }

  /* ---- workbench: my character, cards in play, hand and deck seat ---- */
  .scenario-body.scenario-body--multiseat > #player-zone {
    position: relative;
    grid-column: 1 / -1;
    grid-row: 2;
    flex-direction: column;
    width: auto;
    height: auto;
    max-height: none;
    min-height: 0;
    overflow: hidden;
    border-top: 1px solid rgb(205 175 107 / 0.58);
    border-right: 0;
    /* The character-card column runs from the screen's left edge to the x the
       card had before, which is also where the workbench's dashed seam belongs:
       the seam is the map plate's left edge carried down the table, so the
       column follows the shelf column rather than a hand-tuned clamp. 17px =
       the 14px column gap + the 3px the map overhangs its own column (the
       grid's own 12px inset is gone — see .player-cards' padding). */
    --identity-width: calc(var(--shelf-width) - 17px);
    --pile-width: clamp(70px, 5.4vw, 92px);
    --card-width: min(82px, calc((100cqw - var(--identity-width) - 3 * var(--pile-width) - 92px) / 10 - 5px));
    container-type: inline-size;
    background:
      linear-gradient(180deg, rgb(18 37 34 / 0.3), rgb(8 19 19 / 0.66)),
      /* 110%: over-scan, so the plate's edge trim stays outside the box. */
    url('/assets/veiled-harbour/T02-调查员皮革桌垫.avif') center / 110% auto no-repeat;
    box-shadow:
      0 -8px 22px rgb(4 12 12 / 0.3),
      inset 0 1px 0 rgb(244 239 228 / 0.06);
  }

  .workbench-label {
    position: relative;
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 16px;
    flex: 0 0 auto;
    margin: 0;
    padding: 5px 14px 4px 54px;
    border-bottom: 1px solid rgb(205 175 107 / 0.28);
    background: rgb(9 23 22 / 0.6);
    color: rgb(214 186 128 / 0.76);
    font-size: 0.66rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .workbench-label::before {
    content: '';
    position: absolute;
    left: 10px;
    top: 50%;
    transform: translateY(-50%);
    width: 34px;
    height: 17px;
    background: url('/assets/veiled-harbour/51-按钮端帽压饰-v1.png') left center / contain no-repeat;
    opacity: 0.45;
    pointer-events: none;
  }

  .workbench-label__title {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .workbench-label strong {
    color: rgb(248 239 211 / 0.96);
    font-size: 0.78rem;
    font-weight: 600;
    letter-spacing: 0;
    text-transform: none;
  }

  .workbench-label__stats {
    display: flex;
    flex: 0 0 auto;
    gap: 16px;
  }

  .workbench-label__stats span {
    display: flex;
    align-items: baseline;
    gap: 5px;
  }

  .workbench-label__stats i {
    color: rgb(214 220 210 / 0.5);
    font-size: 0.6rem;
    font-style: normal;
    letter-spacing: 0.06em;
  }

  .workbench-label__stats b {
    color: rgb(248 239 211 / 0.96);
    font-family: Teutonic, Georgia, serif;
    font-size: 0.86rem;
    font-weight: 500;
  }

  .scenario-body.scenario-body--multiseat > #player-zone :deep(.player-info) {
    display: flex;
    flex-direction: column;
    flex: 1 1 auto;
    width: 100%;
    min-width: 0;
    min-height: 0;
    padding: 0;
    gap: 0;
    overflow: hidden;
  }

  /* ---- seat strip: who is being looked at, and who is acting ---- */
  .scenario-body.scenario-body--multiseat > #player-zone :deep(.tabs-row) {
    flex: 0 0 30px;
    min-height: 30px;
    align-items: stretch;
    gap: 6px;
    /* No inset: the first seat name starts on the screen's own edge, level with
       the character card below it. */
    padding: 0;
    border-bottom: 1px solid rgb(205 175 107 / 0.3);
    background: rgb(9 23 22 / 0.62);
  }

  .scenario-body.scenario-body--multiseat > #player-zone :deep(ul.tabs__header) {
    flex: 1 1 auto;
    flex-direction: row;
    flex-wrap: nowrap;
    align-items: stretch;
    gap: 4px;
    min-width: 0;
    padding: 4px 0 0;
    overflow-x: auto;
    overflow-y: hidden;
  }

  .scenario-body.scenario-body--multiseat > #player-zone :deep(ul.tabs__header > li) {
    display: flex;
    flex: 0 0 auto;
    align-items: stretch;
    margin: 0;
    border: 1px solid rgb(205 175 107 / 0.24);
    border-bottom: 0;
    border-radius: 4px 4px 0 0;
    background: linear-gradient(180deg, rgb(30 47 48 / 0.5), rgb(13 26 26 / 0.7));
    opacity: 0.72;
  }

  .scenario-body.scenario-body--multiseat > #player-zone :deep(ul.tabs__header > li span) {
    padding: 5px 10px;
    font-size: 0.78rem;
    white-space: nowrap;
  }

  .scenario-body.scenario-body--multiseat > #player-zone :deep(ul.tabs__header > li.tab--selected) {
    opacity: 1;
    border-color: rgb(229 194 107 / 0.72);
    box-shadow:
      inset 0 -2px 0 rgb(229 194 107 / 0.9),
      0 -2px 10px rgb(229 194 107 / 0.12);
  }

  /* The action marker is a shape and a label, never colour alone. */
  .scenario-body.scenario-body--multiseat
    > #player-zone
    :deep(ul.tabs__header > li.tab--active-player::before) {
    align-self: center;
    margin: 0 0 0 7px;
    font-size: 0.62rem;
    opacity: 0.9;
  }

  .scenario-body.scenario-body--multiseat
    > #player-zone
    :deep(ul.tabs__header > li .switch-investigators),
  .scenario-body.scenario-body--multiseat
    > #player-zone
    :deep(ul.tabs__header > li .waiting-indicator) {
    align-self: stretch;
    height: auto;
    min-height: 0;
    padding: 2px 7px;
  }

  .scenario-body.scenario-body--multiseat > #player-zone :deep(ul.tabs__header > li svg) {
    width: 11px;
    height: 11px;
  }

  .scenario-body.scenario-body--multiseat
    > #player-zone
    :deep(ul.tabs__header > li.tab--lead-player::after) {
    display: none;
  }

  .scenario-body.scenario-body--multiseat > #player-zone :deep(.tabs-row > #totals) {
    flex: 0 0 auto;
    margin-left: auto;
  }

  /* Only the seat being looked at puts its workbench on the table. */
  .scenario-body.scenario-body--multiseat > #player-zone :deep(.tab) {
    display: none !important;
  }

  .scenario-body.scenario-body--multiseat > #player-zone :deep(.tab.tab--active) {
    display: flex !important;
    flex: 1 1 auto;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
  }

  /* Separate seats are other people's investigators: their panel is never the
     workbench, only their public summary in the rail. */
  .scenario-body.scenario-body--multiseat.scenario-body--online
    > #player-zone
    :deep(ul.tabs__header) {
    display: none;
  }

  /* ---- the workbench grid itself ---- */
  .scenario-body.scenario-body--multiseat > #player-zone :deep(.player-cards) {
    display: grid;
    /* Threats span both card rows; assets and hand share one column. */
    --threat-column-width: 100px;
    grid-template-columns: var(--identity-width) var(--threat-column-width) minmax(0, 1fr) var(--pile-width) var(--pile-width);
    /* Keep the asset row at its content height instead of distributing the
       taller pile column's extra space between assets and hand. */
    grid-template-rows: max-content auto;
    grid-template-areas:
      'identity threat in-play deck discard'
      'identity threat hand    deck discard';
    align-content: start;
    column-gap: 14px;
    row-gap: 4px;
    flex: 1 1 auto;
    width: 100%;
    min-height: 0;
    /* The identity column starts on the screen's own edge; the width it gains
       here is credited to --identity-width, so every column after it keeps the
       x it had. */
    padding: 8px 12px 8px 0;
    overflow: hidden;
  }

  /* The wrappers only group the panels; the grid places the panels themselves.
     Hoisting the character card and the action band apart is what lets the
     buttons leave the character column and join one band of their own. */
  .scenario-body.scenario-body--multiseat > #player-zone :deep(.player),
  .scenario-body.scenario-body--multiseat > #player-zone :deep(.investigator-and-deck),
  .scenario-body.scenario-body--multiseat > #player-zone :deep(.player-container),
  .scenario-body.scenario-body--multiseat > #player-zone :deep(.player-area) {
    display: contents;
  }

  /* The character card anchors the panel: it keeps its printed proportion and
     takes the identity column's full width instead of a thumbnail. */
  .scenario-body.scenario-body--multiseat > #player-zone :deep(.player-card) {
    display: flex;
    flex-direction: column;
    grid-area: identity;
    width: 100%;
    gap: 4px;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
  }

  .scenario-body.scenario-body--multiseat > #player-zone :deep(.player-card > .stats) {
    align-self: flex-start;
  }

  .scenario-body.scenario-body--multiseat > #player-zone :deep(.investigator-image) {
    display: flex;
    align-items: flex-start;
    justify-content: center;
    flex: 0 0 auto;
    width: 100%;
    min-width: 0;
    min-height: 0;
  }

  /* Preserve the printed character card's natural proportions. */
  .scenario-body.scenario-body--multiseat > #player-zone :deep(.investigator-image > .card) {
    width: 100%;
    max-width: 100%;
    height: auto;
    object-fit: contain;
    border-radius: 8px;
    box-shadow:
      0 4px 16px rgb(0 0 0 / 0.45),
      0 0 0 1px rgb(205 175 107 / 0.5);
  }

  /* Health, sanity, resources and clues ride on the character card's foot. */
  .scenario-body.scenario-body--multiseat > #player-zone :deep(.resources) {
    grid-area: identity;
    align-self: end;
    justify-self: start;
    --pool-token-width: 27px;
    font-size: 0.7rem;
    z-index: var(--z-index-10);
    flex-wrap: wrap;
    justify-content: center;
    gap: 4px;
    margin: 0 0 14px 8px;
    padding: 2px;
    border-radius: 0;
    background: transparent;
    box-shadow: none;
  }

  /* One action band for the whole panel: the acting investigator's action
     pips read first, then the legal abilities and the end-turn button. */
  .scenario-body.scenario-body--multiseat
    > #player-zone
    :deep(.player-area > div:not(.player-card)) {
    display: contents;
  }

  .scenario-body.scenario-body--multiseat > #player-zone :deep(.player-buttons),
  .scenario-body.scenario-body--multiseat > #player-zone :deep(.button-group) {
    display: contents;
  }

  .scenario-body.scenario-body--multiseat > #player-zone :deep(.action-container) {
    grid-area: identity;
    align-self: start;
    justify-self: end;
    z-index: 10;
    margin: 2px 6px 0 0;
    display: flex;
    align-items: center;
    gap: 3px;
    max-width: calc(100% - 144px);
    flex-wrap: nowrap;
    overflow-x: auto;
    /* No `filter` on this strip: any non-none filter makes it a containing
       block, and the quick-action tooltips are absolute-positioned poppers
       parented to `body`. floating-ui resolves their offsetParent against this
       strip, then writes those coordinates relative to `body` — the popper lands
       hundreds of px off, spills past the viewport, and turns every click into a
       drag on the scroll area it just created. The shadow lives on the children
       instead, where it cannot reparent the popper. */
    text-shadow: 0 1px 3px #000;
  }

  .scenario-body.scenario-body--multiseat > #player-zone :deep(.action-container svg) {
    filter: drop-shadow(0 1px 3px #000);
  }

  /* The band's trailing edge is the screen's own: the strip no longer carries
     the doom/clue readouts to its right, so the end-turn and skip-triggers
     buttons close on the right edge. */
  .scenario-body.scenario-body--multiseat > #player-zone :deep(.investigator-controls) {
    position: absolute;
    top: 0;
    right: 0;
    z-index: 11;
    display: flex;
    align-items: center;
    gap: 12px;
    max-width: calc(100% - 480px);
    min-height: 30px;
    overflow-x: auto;
  }

  .scenario-body.scenario-body--multiseat > #player-zone :deep(.investigator-controls button) {
    white-space: nowrap;
    min-height: 30px;
    padding: 3px 5px;
    font-size: 0.76rem;
  }

  /* Keep the investigator's end-turn reminder and confirmation styling.
     The compact toolbar reset must only flatten ordinary buttons. */
  .scenario-body.scenario-body--multiseat > #player-zone :deep(.investigator-controls button:not(.end-turn-button.active):not(.end-turn-button.armed)) {
    border: 0;
    border-radius: 0;
    background: transparent;
    box-shadow: none;
  }

  .scenario-body.scenario-body--multiseat > #player-zone :deep(.investigator-controls button:not(:disabled):not(.end-turn-button.active):not(.end-turn-button.armed):hover) {
    color: #f5d48b;
    background: rgb(205 175 107 / 0.08);
  }

  .scenario-body.scenario-body--multiseat > #player-zone :deep(.hunch-deck) {
    grid-area: identity;
    justify-self: end;
    align-self: end;
  }

  .scenario-body.scenario-body--multiseat > #player-zone :deep(.in-play-row) {
    position: relative;
    padding-top: 24px;
    grid-area: in-play;
    min-width: 0;
    min-height: 0;
    /* An earlier 1200px rule pins this strip to 90px, which crops the asset
       cards and the slot boxes to about three quarters of a card. */
    max-height: none;
    overflow: hidden;
  }

  .scenario-body.scenario-body--multiseat > #player-zone :deep(.in-play) {
    min-height: 0;
    /* The base rule caps this strip at 300px and scrolls it; here the row is
       already content-sized, so a cap would only crop tall cards again. */
    max-height: none;
    overflow-x: auto;
    overflow-y: hidden;
    align-items: flex-start;
    padding: 4px 2px;
    border-radius: 0;
    background: transparent;
  }

  /* Empty slots keep the shape of a real asset: a 28px marker read as a
     different kind of object next to the cards it stands for. */
  .scenario-body.scenario-body--multiseat > #player-zone :deep(.equip-slots) {
    grid-template-rows: auto;
    grid-auto-flow: column;
    gap: 4px;
    align-content: start;
    /* Flush with the in-play frame's left edge, like the hand row below it: the
       row used to carry its own 16px inset and a divider rule, which put the
       asset cards' left edge 16px right of the hand's. */
    margin-left: 0;
    padding-left: 0;
    border-left: 0;
  }

  .scenario-body.scenario-body--multiseat > #player-zone :deep(.equip-slots .slot) {
    --slot-width: var(--card-width);
    border-radius: 5px;
    border-color: rgb(205 175 107 / 0.28);
    background: rgb(9 23 22 / 0.42);
  }

  .scenario-body.scenario-body--multiseat > #player-zone :deep(.hand-area) {
    grid-area: hand;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
    padding: 0;
    background: transparent;
    border: 0;
    box-shadow: none;
  }

  .scenario-body.scenario-body--multiseat > #player-zone :deep(.hand-area__header) {
    flex: 0 0 18px;
    padding: 0 2px;
    font-size: 0.72rem;
  }

  .scenario-body.scenario-body--multiseat > #player-zone :deep(.hand-area > section.hand) {
    flex: 1 1 auto;
    width: 100%;
    min-width: 0;
    min-height: 0;
    padding: 2px 0 4px;
    overflow-x: auto;
    overflow-y: hidden;
    align-items: flex-start;
  }

  /* Deck and discard become the narrow seat at the end of the hand row:
     one shelf column with my deck on top and my discard under it. */
  .scenario-body.scenario-body--multiseat > #player-zone :deep(.player-cards .piles) {
    grid-area: deck;
    display: flex;
    flex-direction: column;
    /* Deck pins to the top, discard sinks to the workbench floor, so the pile
       shelf shares its bottom edge with the hand row and the character card. */
    justify-content: space-between;
    gap: 8px;
    min-width: 0;
    /* Tall enough for both stacked piles even when the in-play and hand
       rows are nearly empty: one label row, two cards, one gap. */
    min-height: calc(23px + 2 * (var(--pile-width) / var(--card-aspect)) + 8px);
  }

  /* Draw.vue ships the discard first; the shelf reads deck-over-discard. */
  .scenario-body.scenario-body--multiseat > #player-zone :deep(.player-cards .piles > .deck-container) {
    order: -1;
  }

  .scenario-body.scenario-body--multiseat > #player-zone :deep(.deck-container),
  .scenario-body.scenario-body--multiseat > #player-zone :deep(.discard) {
    --card-width: var(--pile-width);
    min-width: 0;
  }

  .scenario-body.scenario-body--multiseat > #player-zone :deep(.deck-container .deck),
  .scenario-body.scenario-body--multiseat > #player-zone :deep(.discard .card) {
    width: 100%;
    height: auto;
  }

  /* The workbench must measure exactly as tall as its rows. While these boxes
     could grow, the auto workbench row resolved taller than the cards and the
     leftover collected as a dead band under the action tray. */
  .scenario-body.scenario-body--multiseat > #player-zone :deep(.player-info),
  .scenario-body.scenario-body--multiseat > #player-zone :deep(.tab.tab--active),
  .scenario-body.scenario-body--multiseat > #player-zone :deep(.player-cards) {
    flex-grow: 0;
  }
  .scenario-body.scenario-body--multiseat > #player-zone :deep(.play-area-label) {
    display: flex;
    align-items: center;
    gap: 5px;
    position: absolute;
    top: 0;
    left: 2px;
    color: rgb(214 186 128 / 0.85);
    font-size: 0.72rem;
    line-height: 22px;
  }

  .scenario-body.scenario-body--multiseat > #player-zone :deep(.pile-label) {
    display: block;
    margin-bottom: 6px;
    color: rgb(214 186 128 / 0.85);
    font-size: 0.72rem;
    /* Pinned, together with the encounter labels: the encounter row is offset
       from the top of the pile tracks by this label and the 6px under it. */
    line-height: 17px;
    text-align: center;
  }

  /* Layout only: the frame itself comes from the shared empty-slot rule
     further down, so every empty slot on the table wears the same seal. */
  .scenario-body.scenario-body--multiseat > #player-zone :deep(.discard-empty) {
    display: grid;
    place-items: center;
    width: 100%;
    aspect-ratio: 5 / 7;
    font:
      1.5rem Georgia,
      serif;
  }

  .scenario-body.scenario-body--multiseat > #player-zone :deep(.investigator-controls button:disabled) {
    opacity: 0.45;
    background: transparent;
    color: rgb(224 219 200 / 0.75);
  }

  .scenario-body.scenario-body--multiseat > #player-zone :deep(.play-area-label svg),
  .scenario-body.scenario-body--multiseat > #player-zone :deep(.pile-label svg) {
    width: 13px;
    height: 13px;
    margin-right: 4px;
    vertical-align: -2px;
  }

  .scenario-body.scenario-body--multiseat > #player-zone :deep(.discard-empty),
  .scenario-body.scenario-body--multiseat > #player-zone :deep(.hand-area__header),
  .scenario-body.scenario-body--multiseat > #player-zone :deep(ul.tabs__header > li),
  .scenario-body.scenario-body--multiseat > #player-zone :deep(ul.tabs__header > li.tab--selected) {
    border-color: transparent;
    box-shadow: none;
    background: transparent;
  }

  .scenario-body.scenario-body--multiseat > #player-zone :deep(ul.tabs__header > li.tab--selected) {
    color: #f5d48b;
  }

  .scenario-body.scenario-body--multiseat > #player-zone :deep(.resources .poolItem::before) {
    display: none;
  }

  .scenario-body.scenario-body--multiseat > .scenario-cards::before {
    border: 0;
  }
  .scenario-body.scenario-body--multiseat .table-shelf-header__focus {
    border: 0;
    background: transparent;
    padding-left: 0;
  }
}
.table-summary-title,
.table-summary-action,
.table-summary-totals,
.table-summary-totals > span {
  display: flex;
  align-items: center;
  min-width: 0;
  gap: 5px;
}
.table-summary-title strong,
.table-summary-title > span,
.table-summary-investigator {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.table-summary-title strong { color: #eee5cf; font-family: Arno, Georgia, serif; }
.table-summary-action { font-size: 0.72rem; color: #d5d7cb; }
.table-summary-action small { flex: 0 0 auto; color: #bfa976; }
.table-shelf-header--navigation {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  grid-template-rows: auto auto;
  column-gap: 14px;
  row-gap: 1px;
  width: 100%;
  padding: 0;
  border: 0;
  line-height: 1.2;
}
.table-shelf-header--navigation::after { display: none; }
.table-shelf-header--navigation .table-summary-title { grid-column: 1; font-size: 0.88rem; }
.table-shelf-header--navigation .table-summary-action { grid-column: 1; }
.table-shelf-header--navigation .table-summary-totals { grid-column: 2; grid-row: 1 / 3; }
.table-shelf-header__accessories {
  grid-column: 3;
  grid-row: 1 / 3;
  align-self: center;
  justify-self: end;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 26px;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: transparent;
  box-shadow: none;
  color: rgb(244 239 228 / 0.78);
  cursor: pointer;
}
.table-shelf-header__accessories svg { width: 15px; height: 15px; }
.table-shelf-header__accessories:hover { background: rgb(244 239 228 / 0.08); color: #fff1cc; }
.table-shelf-header__accessories.active { background: rgb(244 239 228 / 0.1); color: #fff1cc; }
@media (min-width: 1200px) {
  .scenario-body.scenario-body--multiseat > .scenario-cards {
    container-type: inline-size;
    gap: 14px;
    padding-top: 12px;
  }
  /* Give each landscape card a full shelf row, including its stack controls. */
  .scenario-body.scenario-body--multiseat > .scenario-cards > .scenario-decks {
    display: flex !important;
    flex-direction: column;
    align-items: center;
    gap: 14px;
    order: -2;
    width: 100%;
    --card-width: calc((100cqw - 8px) / 1.4);
  }
  .scenario-body.scenario-body--multiseat > .scenario-cards > .scenario-encounter-decks {
    order: -1;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    justify-items: center;
    align-items: start;
    gap: 12px;
    --card-width: clamp(76px, calc((100cqw - 32px) / 2), 104px);
  }
  .scenario-body.scenario-body--multiseat .scenario-encounter-decks > .discard {
    height: auto;
  }
}
.encounter-piles-label { display: none; }
.workbench-encounter-piles:empty { display: none; }
@media (min-width: 1200px) {
  .scenario-body.scenario-body--multiseat > #player-zone > .workbench-encounter-piles {
    position: absolute;
    /* Level with my pile shelf, and pinned to the same floor line: label and
       deck stay at the top, the discard sinks to the workbench bottom. */
    top: 38px;
    bottom: 8px;
    right: 12px;
    /* One shelf track: the discard top card is its own view button. */
    width: var(--pile-width);
    z-index: 10;
    /* The rail's own box stays click-through so it cannot eat clicks on my
       piles; only the encounter piles themselves take pointer events. */
    pointer-events: none;
    --card-width: var(--pile-width);
  }
  .scenario-body.scenario-body--multiseat
    > #player-zone
    > .workbench-encounter-piles
    > .scenario-encounter-decks
    > * {
    pointer-events: auto;
  }
  .scenario-body.scenario-body--multiseat #player-zone .scenario-encounter-decks {
    display: grid;
    /* Same shelf logic as my column: deck on top, discard under it. */
    grid-template-areas:
      'encounterDeckLabel'
      'encounterDeck'
      'encounterDiscard';
    grid-template-columns: var(--pile-width);
    grid-template-rows: auto auto 1fr;
    row-gap: 6px;
    align-items: start;
    height: 100%;
    width: 100%;
    margin: 0;
  }
  #player-zone .encounter-piles-label {
    display: block;
    grid-area: encounterDeckLabel;
    font-size: 0.72rem;
    /* Matches the pile labels, so the encounter row lands under my piles. */
    line-height: 17px;
    color: rgb(214 186 128 / 0.85);
    text-align: center;
    white-space: nowrap;
  }
  /* The discard top card is itself the button: clicking it opens the pile view.
     It also sinks to the rail's floor so both shelf columns share one bottom
     edge with the hand row and the character card. */
  #player-zone .scenario-encounter-decks > .discard {
    align-self: end;
    height: auto;
  }
  #player-zone .scenario-encounter-decks > .discard > .discard-card {
    position: relative;
    cursor: default;
  }
  .scenario-body.scenario-body--multiseat > #player-zone :deep(.in-play-row),
  .scenario-body.scenario-body--multiseat > #player-zone :deep(.hand-area) {
    /* Same ink and rhythm as the empty-slot seal, so every dashed rule on the
       workbench reads as one set. The fallback is the tone this rule carried
       before the seal existed (the token only exists at 1200px and up). */
    border-left: 1px dashed var(--table-rule, rgb(205 175 107 / 0.42));
    padding-left: 12px;
    /* The seal's deep-sea wash, hugging the rule. */
    background-image: linear-gradient(90deg, rgb(40 97 93 / 0.22), transparent 18px);
  }
  .scenario-body.scenario-body--multiseat > #player-zone :deep(.in-play-row) {
    margin-left: -12px;
  }
  .scenario-body.scenario-body--multiseat > #player-zone :deep(.hand-area) {
    margin-left: -12px;
    width: calc(100% + 12px);
  }
  .scenario-body.scenario-body--multiseat > #player-zone :deep(.piles) {
    border-left: 1px dashed var(--table-rule, rgb(205 175 107 / 0.42));
    /* The rule marks the shelf's edge and sits 4px further out than the boxes'
       shared edge; the margin/padding pair moves the rule without moving the
       piles, which stay where they were. */
    margin-left: -12px;
    padding-left: 6px;
    width: calc(100% + 12px);
    /* Same wash as the rule beside the hand, so both read as one set. */
    background-image: linear-gradient(90deg, rgb(40 97 93 / 0.22), transparent 18px);
  }
  /* The captions carry the counts, so the card backs stop repeating them. Only
     the tabletop regime hides them: below 1200px there is no caption and the
     back-of-card number is the pile's only count. */
  .scenario-body.scenario-body--multiseat > #player-zone :deep(.piles .deck-size),
  .scenario-body.scenario-body--multiseat > #player-zone .scenario-encounter-decks :deep(.deck-size) {
    display: none;
  }
  /* One caption style across the shelf: same size, each centred over the track
     it names, whether it is drawn as a caption or as a pile view button. */
  .scenario-body.scenario-body--multiseat > #player-zone :deep(.discard-view-control) {
    justify-content: center;
    font-size: 0.72rem;
  }
  .scenario-body.scenario-body--multiseat .scenario-decks > :deep(.agenda-container),
  .scenario-body.scenario-body--multiseat .scenario-decks > :deep(.act-container) {
    display: flex;
    flex-direction: column;
    width: 100%;
    gap: 8px;
  }
  .scenario-body.scenario-body--multiseat .scenario-decks > :deep(.agenda-container::before),
  .scenario-body.scenario-body--multiseat .scenario-decks > :deep(.act-container::before) {
    content: '◇  ' attr(data-area-label);
    color: rgb(214 186 128 / 0.9);
    font-size: 0.78rem;
    letter-spacing: 0.12em;
  }
  .scenario-body.scenario-body--multiseat .scenario-decks > :deep(.act-container) {
    border-top: 1px dashed rgb(205 175 107 / 0.42);
    padding-top: 14px;
  }
  .scenario-body.scenario-body--multiseat .scenario-decks :deep(.agenda-main),
  .scenario-body.scenario-body--multiseat .scenario-decks :deep(.agenda-card),
  .scenario-body.scenario-body--multiseat .scenario-decks :deep(.act-row),
  .scenario-body.scenario-body--multiseat .scenario-decks :deep(.act-row > .card-container) {
    width: 100%;
  }
  .scenario-body.scenario-body--multiseat .scenario-decks :deep(.agenda-card > .card--sideways),
  .scenario-body.scenario-body--multiseat .scenario-decks :deep(.act-row > .card-container > .card--sideways) {
    width: 100%;
    height: auto;
    max-width: 100%;
  }
}
@media (min-width: 1200px) {
  .scenario-body.scenario-body--multiseat {
    --table-brass: #c5ad78;
    --table-rule: rgb(185 157 98 / 0.36);
  }
  .scenario-body.scenario-body--multiseat > #player-zone {
    border-top-color: rgb(192 161 94 / 0.5);
    background:
      radial-gradient(ellipse at 8% 75%, rgb(141 112 51 / 0.065), transparent 30%),
      linear-gradient(180deg, rgb(18 32 28 / 0.4), rgb(6 18 17 / 0.72)),
      /* 110%: over-scan, so the plate's edge trim stays outside the box. */
    url('/assets/veiled-harbour/T02-调查员皮革桌垫.avif') center / 110% auto no-repeat;
    box-shadow: 0 -3px 14px rgb(0 8 7 / 0.3), inset 0 1px rgb(244 225 175 / 0.06);
  }
  .scenario-body.scenario-body--multiseat > .scenario-cards {
    background:
      radial-gradient(ellipse at 50% 0%, rgb(174 139 68 / 0.075), transparent 45%),
      linear-gradient(180deg, rgb(16 29 26 / 0.96), rgb(6 20 18 / 0.97)),
      url('/assets/veiled-harbour/41-多人牌桌底场-v1.avif') center / cover no-repeat;
    scrollbar-width: none;

    &::-webkit-scrollbar {
      display: none;
    }
  }
  .scenario-body.scenario-body--multiseat > #player-zone :deep(.in-play-row),
  .scenario-body.scenario-body--multiseat > #player-zone :deep(.hand-area),
  .scenario-body.scenario-body--multiseat > #player-zone :deep(.piles),
  .scenario-body.scenario-body--multiseat .scenario-decks > :deep(.act-container) {
    border-color: var(--table-rule);
  }
  .scenario-body.scenario-body--multiseat > #player-zone :deep(.play-area-label),
  .scenario-body.scenario-body--multiseat > #player-zone :deep(.hand-area__header),
  .scenario-body.scenario-body--multiseat > #player-zone :deep(.pile-label),
  .scenario-body.scenario-body--multiseat #player-zone .encounter-piles-label,
  .scenario-body.scenario-body--multiseat .scenario-decks > :deep(.agenda-container::before),
  .scenario-body.scenario-body--multiseat .scenario-decks > :deep(.act-container::before) {
    color: var(--table-brass);
    font-family: Arno, 'Source Han Serif', Georgia, serif;
    letter-spacing: 0.075em;
    text-shadow: 0 1px 2px rgb(0 0 0 / 0.65);
  }
  .scenario-body.scenario-body--multiseat > #player-zone :deep(.play-area-label) {
    left: 12px;
  }
  /* One seal for every empty slot on the table. The dashed rule says "nothing
     here yet" — the same on the piles, the asset slots and the threat area —
     and the brass corner pieces, lit by a deep-sea wash, are the dressing a
     filled slot never needs. The slot's own centred content (the pile dash, an
     asset icon, the enemy skull) is untouched.
     The corner tiles are 52px so the art renders near the scale it was drawn
     at; much smaller and its 1.25px strokes turn to haze. */
  .scenario-body.scenario-body--multiseat > #player-zone :deep(.discard-empty),
  .scenario-body.scenario-body--multiseat > #player-zone :deep(.equip-slots .slot),
  .scenario-body.scenario-body--multiseat > #player-zone :deep(.threat-enemy-slot) {
    border: 1px dashed var(--table-rule);
    border-radius: 4px;
    background:
      url('/assets/veiled-harbour/C04-黄铜压线角件-左上.svg') left top / 52px 52px no-repeat,
      url('/assets/veiled-harbour/C04-黄铜压线角件-右上.svg') right top / 52px 52px no-repeat,
      url('/assets/veiled-harbour/C04-黄铜压线角件-左下.svg') left bottom / 52px 52px no-repeat,
      url('/assets/veiled-harbour/C04-黄铜压线角件-右下.svg') right bottom / 52px 52px no-repeat,
      radial-gradient(ellipse 76% 58% at 50% 44%, rgb(40 97 93 / 0.34), transparent 74%),
      linear-gradient(180deg, rgb(6 20 18 / 0.5), rgb(3 13 11 / 0.34));
    box-shadow: inset 0 0 18px rgb(0 0 0 / 0.38);
    color: rgb(197 173 120 / 0.42);
  }
  .scenario-body.scenario-body--multiseat > #player-zone :deep(.equip-slots .slot img) {
    opacity: 0.72;
    filter: sepia(0.5) saturate(0.65) invert(0.72);
  }
  .scenario-body.scenario-body--multiseat > #player-zone :deep(.in-play),
  .scenario-body.scenario-body--multiseat > #player-zone :deep(section.hand) {
    scrollbar-width: thin;
    scrollbar-color: rgb(185 157 98 / 0.34) transparent;
  }
  /* The online workbench carries its own seat label above the tabs, so the pile
     shelf starts 26px lower and the encounter rail follows it down. */
  .scenario-body.scenario-body--multiseat.scenario-body--online > #player-zone > .workbench-encounter-piles {
    top: 64px;
  }
}
.scenario-seat,
.scenario-seat__cards,
.scenario-accessories,
.scenario-accessories__content { display: contents; }
.scenario-seat__heading { display: none; }
@media (min-width: 1200px) {
  .scenario-body.scenario-body--multiseat > .scenario-cards {
    position: relative;
    display: flex;
    flex-direction: column;
    padding: 0;
    gap: 0;
    overflow: visible;
    border: 0;
    background: none;
    box-shadow: none;
    /* The seats size their cards against the shelf's width and height: cq units
       on the seats themselves resolve against an ancestor container, never
       against the seats, so the shelf has to carry it. */
    container-type: size;
  }
  .scenario-body.scenario-body--multiseat > .scenario-cards::before { display: none; }
  .scenario-body.scenario-body--multiseat > .scenario-cards > .scenario-decks {
    display: grid !important;
    grid-template-areas: none !important;
    grid-template-columns: minmax(0, 1fr);
    /* Two equal halves, one per card. */
    grid-template-rows: repeat(2, minmax(0, 1fr));
    align-items: start;
    justify-items: start;
    flex: 1 1 0;
    min-height: 0;
    gap: 0;
  }
  .scenario-body.scenario-body--multiseat .scenario-seat {
    position: relative;
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: 0;
    /* The card's height: what its width (the seat's inner width, aspect-locked
       at --card-sideways-aspect) allows, or this seat's share of the shelf when
       that is smaller, so two cards always fit a short shelf. 2px = the seat's
       borders, 4px = the gap between side by side cards, 20px = the borders plus
       the 18px label row, 40px = two of those. The child reads this property. */
    --seat-card-height: min(
      calc((100cqw - 2px - 4px * (var(--seat-card-count) - 1)) / var(--seat-card-count) / var(--card-sideways-aspect)),
      calc((100cqh - 40px) / 2)
    );
    /* The frame is the card plus its label, and nothing else: the width is the
       card's width (its height times the aspect) plus this seat's 2px borders,
       so no bare frame shows left or right of the card, and the height is that
       card height plus the 1px borders and the 18px label row. */
    width: calc(var(--seat-card-height) * var(--card-sideways-aspect) + 2px);
    height: calc(20px + var(--seat-card-height));
    padding: 0;
    border: 1px solid rgb(184 154 91 / 0.32);
    background:
      radial-gradient(ellipse at 50% 0, rgb(160 125 55 / 0.1), transparent 65%),
      linear-gradient(150deg, rgb(22 37 31 / 0.92), rgb(7 21 18 / 0.95));
    box-shadow: 0 3px 10px rgb(0 7 5 / 0.25);
  }
  .scenario-body.scenario-body--multiseat .scenario-seat--act {
    align-self: end;
  }
  /* The clue total sits on the act frame's top-left corner, mirroring the doom
     token on the agenda frame. 2px/1px are the small inset the agenda's own disc
     ends up with: its art leaves a rim inside its box (clue.png does not) and it
     is centred inside the agenda frame's 2em-tall pool. Its containing block is
     the card area, whose overflow does the same edge trim the agenda's badge
     gets -- the badge's ring spills 5px, so left to itself it would paint across
     the frame's edges. */
  .scenario-body.scenario-body--multiseat .scenario-seat--act .act-clue-total {
    position: absolute;
    top: 4px;
    left: 2px;
    z-index: 2;
    /* The two token assets are not drawn alike: clue.png's disc runs to the
       edges of its square, doom.png's is inset to ~92% of it. At the shared
       --pool-token-width the clue disc therefore read a size larger, so this
       badge's box carries the same 92% to land on the doom disc's diameter. */
    --pool-token-width: 26px;
    /* The frame is the click target that advances the act; the readout must not
       eat its corner. */
    pointer-events: none;
  }
  .scenario-body.scenario-body--multiseat .scenario-seat__heading {
    display: flex;
    align-items: center;
    flex: 0 0 18px;
    gap: 5px;
    padding: 0 5px;
    color: #c5ad78;
    font: 0.72rem Arno, Georgia, serif;
    letter-spacing: 0.12em;
  }
  .scenario-seat__heading svg { width: 11px; height: 11px; }
  .scenario-seat__heading i { margin-left: auto; font-style: normal; opacity: 0.6; }
  .scenario-body.scenario-body--multiseat .scenario-seat__cards {
    display: flex;
    justify-content: center;
    align-items: flex-start;
    gap: 4px;
    flex: 1 1 0;
    min-height: 0;
    /* Containing block for the seat's corner badges, and the box that trims
       their overhanging rings at the card's edges (the agenda badge has always
       been clipped here; its sibling on the act frame relies on it too). */
    position: relative;
    overflow: auto;
    /* No visible bar beside the card: the card is sized to the seat (see
       --card-width), so the bar only ever read as a stray hairline next to it.
       Scrolling itself stays available. */
    scrollbar-width: none;

    &::-webkit-scrollbar {
      display: none;
    }

    --card-width: var(--seat-card-height);
  }
  .scenario-body.scenario-body--multiseat .scenario-seat__cards > :deep(.agenda-container),
  .scenario-body.scenario-body--multiseat .scenario-seat__cards > :deep(.act-container) {
    display: flex;
    flex-direction: column;
    flex: 0 0 auto;
    width: calc(var(--card-width) * var(--card-sideways-aspect));
    max-width: 100%;
    padding: 0;
    border: 0;
  }
  .scenario-body.scenario-body--multiseat .scenario-seat__cards :deep(.act-row > .card-container) {
    height: auto;
  }
  /* The card is flush with the frame, so its own rounding would only open notches at the corners. */
  .scenario-body.scenario-body--multiseat .scenario-seat__cards :deep(.card),
  .scenario-body.scenario-body--multiseat .scenario-seat__cards :deep(.card-container),
  .scenario-body.scenario-body--multiseat .scenario-seat__cards :deep(.agenda-card) {
    border-radius: 0;
  }
  .scenario-body.scenario-body--multiseat .scenario-accessories {
    position: relative;
    display: block;
    flex: 0 0 auto;
    height: 0;
  }
  .scenario-body.scenario-body--multiseat .scenario-accessories:not(.is-open) > .scenario-accessories__content {
    display: none;
  }
  .scenario-body.scenario-body--multiseat .scenario-accessories.is-open > .scenario-accessories__content {
    position: absolute;
    left: 0;
    bottom: 0;
    z-index: 110;
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    width: min(460px, 70vw);
    max-height: 60vh;
    overflow: auto;
    padding: 14px;
    background: #10231e;
    border: 1px solid rgb(185 157 98 / 0.5);
    box-shadow: 0 8px 30px rgb(0 0 0 / 0.5);
    --card-width: 92px;
  }
}
/* Each workbench card zone owns its heading and horizontal card scroll. */
.scenario-body.scenario-body--multiseat > #player-zone :deep(.in-play-row) {
  padding-top: 0;
}
.scenario-body.scenario-body--multiseat > #player-zone :deep(.asset-zone > .play-area-label) {
  position: static;
  padding-left: 4px;
  min-height: 24px;
}
@media (min-width: 1200px) {
  .scenario-body.scenario-body--multiseat > #player-zone :deep(.player-cards:has(.threat-zone--occupied:not(.threat-zone--collapsed))) {
    --threat-column-width: min(180px, 12cqw);
  }
  .scenario-body.scenario-body--multiseat > #player-zone :deep(.in-play-row) {
    display: contents;
  }
  .scenario-body.scenario-body--multiseat > #player-zone :deep(.threat-zone) {
    grid-area: threat;
    position: relative;
    width: 100%;
    max-width: none;
    min-height: 0;
    margin: 0;
    padding: 0;
    box-sizing: border-box;
    /* This column's leading edge carries the same dashed rule and wash as the
       ones beside the hand and the piles, instead of the solid stroke the narrow
       layouts draw here. On the left it is also the character card's divider and
       lands on the map plate's edge above, so the seam runs unbroken from the
       shelf down the workbench. */
    border-left: 1px dashed var(--table-rule, rgb(170 104 87 / 0.4));
    /* The narrow layouts draw a solid stroke on the trailing edge; the rule has
       moved, so nothing is left there. */
    border-right: 0;
    background-image: linear-gradient(90deg, rgb(40 97 93 / 0.22), transparent 18px);
  }
  /* The caption occupies exactly the empty-slot frames' box, so its ghost sits
     on the frames' left edge and its collapse toggle on the frames' right edge
     instead of on the column's own edges. 16px = .threat-cards' 8px left inset
     + its 4px padding on both sides. max-content is the floor: on a workbench
     narrow enough that --card-width falls below the caption's own width, a
     one-line caption wins and the toggle stops short of the frames. */
  .scenario-body.scenario-body--multiseat > #player-zone :deep(.threat-area-label) {
    width: min(var(--card-width, 82px), calc(100% - 16px));
    min-width: max-content;
    margin-left: 12px;
    padding: 0;
  }
  /* The count rides next to its caption; the auto margin belongs to the toggle,
     which is what should meet the frames' right edge. */
  .scenario-body.scenario-body--multiseat > #player-zone :deep(.threat-area-label .threat-count) {
    margin-left: 0;
  }
  .scenario-body.scenario-body--multiseat > #player-zone :deep(.threat-area-label .threat-toggle) {
    margin-left: auto;
  }
  .scenario-body.scenario-body--multiseat > #player-zone :deep(.threat-cards) {
    position: absolute;
    /* 24px = the label row above both columns (the asset zone's label row and
       this one's own label), so the threat frame's top edge meets the in-play
       frame's. Its bottom already lands on the hand row's bottom. */
    top: 24px;
    bottom: 0;
    /* The rule is on this column's leading edge now, so the frames keep their
       8px clearance there instead. */
    left: 8px;
    right: 0;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    min-height: 0;
    max-height: none;
    overflow: auto;
    padding: 4px;
    /* The lower slot starts on the hand row's line so both columns read as two
       rows: the 4px row gap + the hand header's line box (32px) + the hand's
       own 5px gap. The upper slot already sits level with the asset row. */
    gap: 41px;
  }
  .scenario-body.scenario-body--multiseat > #player-zone :deep(.asset-zone) {
    grid-area: in-play;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    grid-template-rows: 24px auto;
    align-content: start;
    min-width: 0;
  }
  .scenario-body.scenario-body--multiseat > #player-zone :deep(.asset-zone > .play-area-label) {
    grid-column: 1 / -1;
    grid-row: 1;
    padding: 0;
  }
  .scenario-body.scenario-body--multiseat > #player-zone :deep(.asset-zone > .in-play) {
    grid-column: 1;
    grid-row: 2;
    width: 100%;
    min-width: 0;
    box-sizing: border-box;
    padding-left: 0;
    padding-right: 0;
  }
  .scenario-body.scenario-body--multiseat > #player-zone :deep(.asset-zone > .inert-stack) {
    grid-column: 2;
    grid-row: 2;
  }
  .scenario-body.scenario-body--multiseat > #player-zone :deep(.hand-area) {
    width: 100%;
    margin: 0;
    padding-left: 0;
    border-left: 0;
    box-sizing: border-box;
  }
  .scenario-body.scenario-body--multiseat > #player-zone :deep(.hand-area__header) {
    flex: 0 0 24px;
    min-height: 24px;
    padding-left: 0;
  }
}
/* Both pile columns use the same fixed card frames and vertical rhythm. */
@media (min-width: 1200px) {
  .scenario-body.scenario-body--multiseat > #player-zone {
    --pile-card-height: calc(var(--pile-width) * 7 / 5);
    --pile-row-gap: 6px;
  }
  .scenario-body.scenario-body--multiseat > #player-zone :deep(.player-cards .piles) {
    justify-content: flex-start;
    gap: var(--pile-row-gap);
    min-height: calc(23px + 2 * var(--pile-card-height) + 26px + 2 * var(--pile-row-gap));
  }
  .scenario-body.scenario-body--multiseat #player-zone .scenario-encounter-decks {
    grid-template-rows: 17px var(--pile-card-height) auto;
    row-gap: 6px;
    align-content: start;
  }
  .scenario-body.scenario-body--multiseat #player-zone .scenario-encounter-decks > .discard {
    align-self: start;
    margin-top: 0;
  }
  .scenario-body.scenario-body--multiseat > #player-zone :deep(.discard) {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: var(--pile-row-gap);
  }
  .scenario-body.scenario-body--multiseat > #player-zone :deep(.discard-view-control) {
    flex: 0 0 26px;
    height: 26px;
    min-height: 26px;
    margin: 0;
    width: 100%;
  }
  .scenario-body.scenario-body--multiseat > #player-zone :deep(.pile-label),
  .scenario-body.scenario-body--multiseat #player-zone .encounter-piles-label {
    height: 17px;
    line-height: 17px;
    padding: 0;
  }
  .scenario-body.scenario-body--multiseat > #player-zone :deep(.top-of-deck),
  .scenario-body.scenario-body--multiseat > #player-zone :deep(.discard-card),
  .scenario-body.scenario-body--multiseat > #player-zone :deep(.discard-empty) {
    width: var(--pile-width);
    height: var(--pile-card-height);
    min-height: var(--pile-card-height);
    box-sizing: border-box;
    margin: 0;
    flex-shrink: 0;
  }
  .scenario-body.scenario-body--multiseat > #player-zone :deep(.top-of-deck img.deck),
  .scenario-body.scenario-body--multiseat > #player-zone :deep(.top-of-deck img.card),
  .scenario-body.scenario-body--multiseat > #player-zone :deep(.discard-card .card) {
    display: block;
    width: var(--pile-width);
    height: var(--pile-card-height);
    max-width: none;
    box-sizing: border-box;
    object-fit: contain;
    margin: 0;
  }
}
/* The engraved chart fills the map viewport; card mounts remain distinct. */
.location-cards-container,
.location-cards-container--fullscreen {
  --select: #c5a368;
  --hidden-location-action-glow: rgb(197 163 104 / 0.4);
  --hidden-location-action-soft: rgb(197 163 104 / 0.15);
  /* Over-scanned by the plate's own margin: its brass frame is printed 10px in
     from the left/right edges and 11px from the top/bottom (of 1536x1024), so
     at 100% a seam of bare plate sat between the frame and whatever abuts the
     map. Any further and the corner compass roses lose their outer arms. */
  background: #102b26 url('/assets/veiled-harbour/T04-地点地图底板-v2.avif') center / 101.3% 102.2% no-repeat;
}
.location-cards-container::before {
  inset: 0;
  border: 0;
  border-radius: 0;
  background: none;
  box-shadow: inset 0 0 18px rgb(3 17 14 / 0.2);
}
.location-cards-scroller { position: relative; padding: 32px; }
.location-wrapper,
.location-cell--occupied > .location-wrapper,
.location-cell--current-player > .location-wrapper,
.location-cell--can-interact > .location-wrapper {
  padding: 8px;
  border: 0;
  background: transparent;
  box-shadow: none;
}
.location-cards-container :deep(.card-frame)::before {
  content: '';
  position: absolute;
  inset: -4px;
  border: 1px solid #cbb988;
  outline: 1px solid rgb(210 191 140 / 0.38);
  outline-offset: 2px;
  border-radius: 5px;
  background: #a69c7b;
  box-shadow: inset 0 0 0 2px #d1c5a3, 0 2px 4px rgb(0 10 7 / 0.55);
  pointer-events: none;
}
.location-cards-container :deep(.card-frame)::after {
  content: '';
  position: absolute;
  inset: -7px;
  background:
    linear-gradient(#c7ab70, #c7ab70) left top / 12px 1px,
    linear-gradient(#c7ab70, #c7ab70) left top / 1px 12px,
    linear-gradient(#c7ab70, #c7ab70) right top / 12px 1px,
    linear-gradient(#c7ab70, #c7ab70) right top / 1px 12px,
    linear-gradient(#c7ab70, #c7ab70) left bottom / 12px 1px,
    linear-gradient(#c7ab70, #c7ab70) left bottom / 1px 12px,
    linear-gradient(#c7ab70, #c7ab70) right bottom / 12px 1px,
    linear-gradient(#c7ab70, #c7ab70) right bottom / 1px 12px;
  background-repeat: no-repeat;
  pointer-events: none;
}
.location-cell--current-player :deep(.card-frame)::before {
  border-color: #ecd49a;
  outline-color: #c7ab70;
  box-shadow: inset 0 0 0 2px #dbc18a, 0 0 0 3px rgb(197 163 104 / 0.15);
}
.location-cell--can-interact :deep(.card-frame)::before {
  border-color: #f0d998;
  outline-color: #d1b476;
  background: #dbc18a;
}
.location-cards-container :deep(.card-frame-inner) {
  border-radius: 3px;
  box-shadow: 0 1px 2px rgb(0 8 5 / 0.65);
}
.location-cards-container :deep(.location-container) { position: relative; }
.location-cards-container :deep(.location-investigator-column) {
  position: absolute;
  top: -10px;
  left: -15px;
  z-index: 6;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.location-cards-container :deep(.location-investigator-column div) { margin-top: 0; }
.location-cards-container :deep(.location-investigator-column .portrait) {
  width: calc(var(--card-width) * 0.44);
  height: calc(var(--card-width) * 0.44);
  object-fit: cover;
  object-position: center 25%;
  border: 2px solid #ac915b;
  border-radius: 50%;
  box-sizing: border-box;
  box-shadow: 0 2px 3px rgb(30 24 13 / 0.6), inset 0 0 0 1px #403521;
}
.location-cards-container :deep(.location-investigator-column .portrait--guardian) { border-color: var(--guardian); }
.location-cards-container :deep(.location-investigator-column .portrait--seeker) { border-color: var(--seeker); }
.location-cards-container :deep(.location-investigator-column .portrait--rogue) { border-color: var(--rogue); }
.location-cards-container :deep(.location-investigator-column .portrait--mystic) { border-color: var(--mystic); }
.location-cards-container :deep(.location-investigator-column .portrait--survivor) { border-color: var(--survivor); }
.location-cards-container :deep(.location-summary) {
  position: relative;
  order: 2;
  top: auto;
  left: auto;
  transform: none;
  width: calc(var(--card-width) + 4px);
  max-width: none;
  box-sizing: border-box;
  margin-top: 10px;
  padding: 3px 0;
  color: #dfd2ae;
  background: transparent;
  border: 0;
  border-top: 1px solid rgb(199 171 112 / 0.32);
  box-shadow: none;
  font-family: 'Source Han Serif', Georgia, serif;
  line-height: 1.35;
}
.location-cards-container :deep(.location-summary__status) { color: #b6b498; font-size: 0.58rem; }
.location-cards-container :deep(.line:not(.mine-cart-next-line)) {
  stroke: #aa9870;
  stroke-width: 1.1px;
  stroke-dasharray: 3 5;
  filter: none;
}
.location-cards-container :deep(.line.active:not(.mine-cart-next-line)) {
  stroke: #dcc28b !important;
  stroke-width: 1.7px;
  filter: none;
}
.location-cards-container :deep(.chevrons) { fill: #aa9870; filter: none; }
@media (max-width: 800px) {
  .location-cards-container::before { inset: 0; }
  .location-cards-scroller { padding: 28px; }
}
.location-cards-scroller { cursor: grab; touch-action: none; }
.location-cards-scroller:active { cursor: grabbing; }
.location-cards-scroller--moving :deep(*) { cursor: grab !important; }
.location-cards-scroller--moving:active :deep(*) { cursor: grabbing !important; }

.mobile-table-nav, .mobile-turn-summary { display: none; }
@media (max-width: 800px), (max-width: 1199px) and (pointer: coarse) {
  .scenario { flex-direction: column; min-height: 0; overflow: hidden; }
  .mobile-table-nav { display: flex; flex: 0 0 auto; gap: 4px; padding: 6px max(8px, env(safe-area-inset-right)) 6px max(8px, env(safe-area-inset-left)); background: #142b29; border-bottom: 1px solid #78633d; }
  .mobile-table-nav button { flex: 1; min-width: 0; min-height: 44px; padding: 8px 4px; color: #ddd3b9; background: transparent; border: 1px solid transparent; border-radius: 5px; font-size: 14px; }
  .mobile-table-nav button[aria-pressed="true"] { background: #33453b; color: #fff0c6; border-color: #b69c60; }
  .mobile-turn-summary { display: flex; align-items: center; gap: 8px; flex: 0 0 auto; padding: 5px 12px; color: #e5d6af; background: #172925; font-size: 12px; }
  .mobile-turn-summary svg { width: 14px; height: 14px; flex: 0 0 auto; }
  .mobile-turn-summary strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .mobile-turn-summary span { margin-left: auto; flex-shrink: 0; }
  .scenario .scenario-body { display: flex; flex-direction: column; flex: 1; min-height: 0; overflow: hidden; }
  .scenario .scenario-body > .rain-host { flex: 1; min-height: 0; width: 100%; }
  .scenario .location-cards-container { height: 100%; min-height: 0; }
  .scenario .location-cards-scroller { padding: 66px 24px 24px; min-height: 0; }
  .scenario[data-mobile-panel="map"] .scenario-body > :is(.scenario-cards, .teammate-rail, #player-zone),
  .scenario:not([data-mobile-panel="map"]) .scenario-body > .rain-host,
  .scenario:not([data-mobile-panel="scenario"]) .scenario-body > .scenario-cards,
  .scenario:not([data-mobile-panel="team"]) .scenario-body > .teammate-rail,
  .scenario:not([data-mobile-panel="player"]) .scenario-body > #player-zone { display: none; }
  .scenario .scenario-body > #player-zone { flex: 1; min-height: 0; width: 100%; overflow: auto; padding: 10px 10px 64px; }
  .scenario .scenario-body > .scenario-cards { --card-width: 120px; --card-height: 168px; flex: 1; min-height: 0; display: flex; flex-wrap: wrap; align-content: flex-start; align-items: flex-start; justify-content: flex-start; gap: 16px; overflow: auto; padding: 16px 12px 24px; z-index: 1; }
  .scenario .scenario-cards .scenario-decks { display: flex; flex-wrap: wrap; width: 100%; justify-content: flex-start; gap: 16px; }
  .scenario .scenario-cards :is(.scenario-seat__cards, .scenario-encounter-decks) { display: flex; flex-wrap: wrap; gap: 12px; }
  .scenario .scenario-cards :is(.scenario-guide, .scenario-accessories) { width: 100%; margin: 0; max-height: none; }
  .scenario .scenario-cards .scenario-badges { position: static; display: flex; flex-wrap: wrap; width: 100%; }
  .scenario .scenario-cards .scenario-balance-placeholder { display: none; }
  .workbench-label { display: flex; flex-direction: column; gap: 8px; margin: 0 0 12px; padding: 10px; color: #eedbb1; border-bottom: 1px solid #78633d; }
  .workbench-label__stats { display: flex; flex-wrap: wrap; gap: 12px; font-size: 13px; }
  .workbench-label__stats span { display: flex; gap: 4px; }
  .workbench-label__stats i { font-style: normal; }
  .teammate-rail { flex: 1; min-height: 0; overflow: auto; padding: 12px; color: #eadcbb; }
  .teammate-rail__header { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
  .teammate-card { display: grid; grid-template-columns: 52px minmax(0, 1fr); gap: 6px 12px; width: 100%; padding: 12px; margin-bottom: 8px; color: #eadcbb; text-align: left; background: #203731; border: 1px solid #6c644a; border-radius: 8px; }
  .teammate-card--active { border-color: #ddbd73; box-shadow: inset 3px 0 #ddbd73; }
  .teammate-card__portrait { grid-row: span 4; width: 52px; height: 64px; object-fit: cover; border-radius: 4px; }
  .teammate-card__name, .teammate-card__stats { display: flex; flex-wrap: wrap; gap: 6px 12px; }
  .teammate-card__stats span { display: inline-flex; gap: 4px; }
  .teammate-card__location, .teammate-card__stats { font-size: 13px; }
  .teammate-card__assets { grid-column: 2; display: flex; gap: 6px; }
  .teammate-card__assets img { width: 40px; }
  .teammate-detail { padding: 12px; margin-bottom: 12px; background: #203731; border: 1px solid #ac9258; border-radius: 8px; }
  .teammate-detail__top { display: flex; align-items: flex-start; gap: 12px; }
  .teammate-detail__card { width: 100px; max-width: 35%; }
  .teammate-detail__identity { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 8px; }
  .teammate-detail__close { min-height: 44px; }
  .teammate-detail__stats { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
  .teammate-detail__stats dd { margin: 4px 0; }
  .teammate-detail__cards { --card-width: 110px; --card-height: 154px; display: flex; overflow-x: auto; gap: 10px; padding: 8px 0; }
  .teammate-detail__cards > * { flex-shrink: 0; }
}

</style>
