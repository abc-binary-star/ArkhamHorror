<script lang="ts" setup>
import { computed } from 'vue'

export type PipState = 'completed' | 'current' | 'remaining'

const props = defineProps<{
  label: string
  pips: PipState[]
  // The pip being looked at, or null for the card still in play. null is drawn on
  // the 'current' pip: that is the position the live card occupies.
  selected: number | null
}>()

const emit = defineEmits<{ select: [index: number] }>()

// A dot past the current one marks a card still in the deck. It has never been
// turned over, so it is a position marker and never a page of the history.
const selectable = (state: PipState) => state !== 'remaining'

const at = (i: number) => props.pips[i]

// The unreadable tail is drawn as one marker carrying its count, not a dot each:
// a long deck would otherwise stretch the strip past the card it rides on.
const dots = computed(() => {
  const firstLocked = props.pips.findIndex((state) => state === 'remaining')
  return props.pips.slice(0, firstLocked === -1 ? props.pips.length : firstLocked)
})

const lockedCount = computed(() => props.pips.length - dots.value.length)

const currentIndex = computed(() => props.pips.findIndex((state) => state === 'current'))

const activeIndex = computed(() => {
  const { selected } = props
  if (selected !== null && selectable(at(selected))) return selected
  return currentIndex.value
})

function step(direction: 1 | -1) {
  const from = activeIndex.value
  if (from === -1) return

  for (let i = from + direction; i >= 0 && i < props.pips.length; i += direction) {
    if (selectable(at(i))) {
      emit('select', i)
      return
    }
  }
}

const STEP_PX = 16
let originY: number | null = null
let dragged = false

function onPointerDown(e: PointerEvent) {
  // Capturing on the dot, not the strip: capture retargets the compatibility
  // click to the capture target, so capturing here would swallow the dot's own
  // click. The moves still bubble up to the strip, where the drag is measured.
  const dot = (e.target as Element | null)?.closest('.pip')
  if (dot instanceof HTMLElement) dot.setPointerCapture(e.pointerId)
  originY = e.clientY
  dragged = false
}

function onPointerMove(e: PointerEvent) {
  if (originY === null) return
  const delta = e.clientY - originY
  if (Math.abs(delta) < STEP_PX) return

  originY = e.clientY
  dragged = true
  step(delta > 0 ? 1 : -1)
}

function onPointerUp() {
  originY = null
}

function choose(i: number) {
  if (dragged) {
    dragged = false
    return
  }
  if (!selectable(at(i))) return
  emit('select', i)
}

function onWheel(e: WheelEvent) {
  // Leave pinch gestures and the table's own zoom to the surface underneath.
  if (e.ctrlKey || e.metaKey) return
  e.preventDefault()
  step(e.deltaY > 0 ? 1 : -1)
}
</script>

<template>
  <div
    class="stack-pips no-card-overlay"
    role="group"
    :aria-label="label"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
    @wheel="onWheel"
  >
    <button
      v-for="(state, i) in dots"
      :key="i"
      type="button"
      class="pip"
      :class="[`pip--${state}`, { 'pip--active': i === activeIndex }]"
      :tabindex="selectable(state) ? undefined : -1"
      :aria-disabled="selectable(state) ? undefined : 'true'"
      :aria-label="`${label} ${i + 1}/${pips.length}`"
      @click="choose(i)"
    >
      <span class="pip__dot" aria-hidden="true" />
    </button>
    <span v-if="lockedCount > 0" class="tail" aria-hidden="true">
      <span class="tail__count">{{ lockedCount }}</span>
    </span>
  </div>
</template>

<style scoped>
/* An overlay, not a column: the seat measures its card to fill its own width, so
   anything that took space beside the card would resize the card and the seat
   with it. */
.stack-pips {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 4px 3px;
  border-radius: 999px;
  background: rgb(6 20 18 / 0.58);
  box-shadow: 0 2px 8px rgb(0 0 0 / 0.45);
  cursor: grab;
  touch-action: none;
  user-select: none;
}

.stack-pips:active {
  cursor: grabbing;
}

.pip {
  display: grid;
  place-items: center;
  width: 14px;
  height: 14px;
  min-height: 0;
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: none;
  box-shadow: none;
  cursor: pointer;
}

.pip[aria-disabled='true'] {
  cursor: default;
}

.pip__dot {
  width: 6px;
  height: 6px;
  border: 1px solid rgb(255 255 255 / 0.34);
  border-radius: 50%;
  background: transparent;
  transition: transform 0.15s ease, background 0.15s ease, border-color 0.15s ease,
    box-shadow 0.15s ease;
}

.pip--completed .pip__dot {
  border-color: var(--brass);
  background: var(--brass);
}

.pip--current .pip__dot {
  border-color: var(--act-advance-edge);
  background: var(--act-advance-edge);
}

.pip--active .pip__dot {
  transform: scale(1.35);
  box-shadow: 0 0 4px rgb(255 248 219 / 0.5);
}

.pip:not([aria-disabled='true']):hover .pip__dot {
  border-color: rgb(255 255 255 / 0.8);
}

.pip:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 1px;
}

/* Cards still in the deck: one marker carrying how many, never a page of the
   history and never a control. */
.tail {
  display: grid;
  place-items: center;
  width: 12px;
  height: 12px;
  margin: 1px 0;
  border: 1px solid rgb(255 255 255 / 0.3);
  border-radius: 50%;
}

.tail__count {
  color: rgb(255 255 255 / 0.62);
  font-size: 8px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}
</style>
