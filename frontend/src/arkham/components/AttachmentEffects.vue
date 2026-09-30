<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch, type CSSProperties } from 'vue'
import { useVisualFeedback } from '@/arkham/composables/useVisualFeedback'
import { useSettings } from '@/stores/settings'
import type { Game } from '@/arkham/types/Game'
import { attachmentEffectsFor, attachmentEffectLayers, attachmentDepartures, type AttachmentDeparture, type AttachmentHost } from '@/arkham/attachmentEffects'
import AttachmentMotif from '@/arkham/components/AttachmentMotif.vue'

const props = defineProps<{
  game: Game
  host: AttachmentHost
  target?: HTMLElement | null
  hasFire?: boolean
}>()
const settings = useSettings()
const feedback = useVisualFeedback()
const rawEffects = computed(() => attachmentEffectsFor(props.game, props.host))
const effects = computed(() => attachmentEffectLayers(rawEffects.value))
let departureSequence = 0
const departing = ref<Array<AttachmentDeparture & { exitId: number }>>([])
const forming = ref<string[]>([])
const departureTimers = new Set<ReturnType<typeof setTimeout>>()
function clearDepartures() {
  departing.value = []
  forming.value = []
  departureTimers.forEach(clearTimeout)
  departureTimers.clear()
}
watch(() => [feedback?.resetVersion.value, props.host.id, props.host.type, settings.extraAnimations, settings.visualExperience], clearDepartures)
watch(() => [rawEffects.value, props.host.type, props.host.id] as const, ([next, type, id], [previous, oldType, oldId]) => {
  if (type !== oldType || id !== oldId || !feedback?.transitionAllowed.value || !settings.extraAnimations || settings.visualExperience === 'simple') {
    clearDepartures()
    return
  }
  const leaving = attachmentDepartures(previous, next, props.game).map(effect => ({ ...effect, exitId: ++departureSequence }))
  // If an effect returns during its own departure, remove the stale ghost.
  departing.value = departing.value.filter(effect => !next.some(item => item.sourceId === effect.sourceId && !item.dormant))
  departing.value.push(...leaving)
  const arriving = next.filter(effect => !effect.dormant && !previous.some(old => old.sourceId === effect.sourceId && !old.dormant)).map(effect => effect.sourceId)
  forming.value.push(...arriving)
  if (!leaving.length && !arriving.length) return
  const timer = setTimeout(() => {
    departing.value = departing.value.filter(effect => !leaving.some(old => old.exitId === effect.exitId))
    forming.value = forming.value.filter(id => !arriving.includes(id))
    departureTimers.delete(timer)
  }, 400)
  departureTimers.add(timer)
})
onBeforeUnmount(clearDepartures)
const root = ref<HTMLElement | null>(null)
const visible = ref(false)
const geometry = ref<CSSProperties>({ visibility: 'hidden' })
let target: HTMLElement | null = null
let resize: ResizeObserver | null = null
let intersection: IntersectionObserver | null = null
let mutation: MutationObserver | null = null
let raf: number | null = null
const transitions = new Set<string>()

function measure() {
  raf = null
  if (!target || !root.value) return
  // Local layout pixels intentionally exclude map/table zoom. The browser
  // applies the common ancestor transform to the card and this overlay once.
  const style = getComputedStyle(target)
  geometry.value = {
    left: `${target.offsetLeft}px`, top: `${target.offsetTop}px`,
    width: `${target.offsetWidth}px`, height: `${target.offsetHeight}px`,
    transform: style.transform, transformOrigin: style.transformOrigin,
    visibility: target.offsetWidth && target.offsetHeight ? 'visible' : 'hidden',
  }
  if (transitions.size && visible.value) raf = requestAnimationFrame(measure)
}
function scheduleMeasure() {
  if (raf === null) raf = requestAnimationFrame(measure)
}
function transitionStart(event: TransitionEvent) {
  if (event.target !== target) return
  transitions.add(event.propertyName)
  scheduleMeasure()
}
function transitionEnd(event: TransitionEvent) {
  if (event.target !== target) return
  transitions.delete(event.propertyName)
  scheduleMeasure()
}
function detach() {
  resize?.disconnect()
  intersection?.disconnect()
  mutation?.disconnect()
  target?.removeEventListener('load', scheduleMeasure)
  target?.removeEventListener('transitionrun', transitionStart)
  target?.removeEventListener('transitionend', transitionEnd)
  target?.removeEventListener('transitioncancel', transitionEnd)
  if (raf !== null) cancelAnimationFrame(raf)
  raf = null
  transitions.clear()
  target = null
  visible.value = false
}
function attach() {
  const next = props.target ?? root.value?.parentElement?.querySelector<HTMLElement>(':scope > img.card') ?? null
  if (next === target && root.value) { scheduleMeasure(); return }
  detach()
  if (!next || !root.value) return
  target = next
  resize = new ResizeObserver(scheduleMeasure)
  resize.observe(next)
  if (root.value.parentElement) resize.observe(root.value.parentElement)
  intersection = new IntersectionObserver(entries => {
    visible.value = entries[entries.length - 1]?.isIntersecting ?? false
    if (visible.value) scheduleMeasure()
  })
  intersection.observe(root.value)
  mutation = new MutationObserver(scheduleMeasure)
  mutation.observe(next, { attributes: true, attributeFilter: ['class', 'style', 'src'] })
  next.addEventListener('load', scheduleMeasure)
  next.addEventListener('transitionrun', transitionStart)
  next.addEventListener('transitionend', transitionEnd)
  next.addEventListener('transitioncancel', transitionEnd)
  measure()
}
watch(() => [root.value, props.target, props.game, props.host.id], attach, { flush: 'post' })
onBeforeUnmount(detach)
</script>

<template>
  <div
    v-if="settings.extraAnimations && (effects.length || departing.length)"
    ref="root"
    class="attachment-effects"
    :class="{ 'is-paused': !visible, 'has-fire': hasFire, 'is-simple': settings.visualExperience === 'simple' }"
    :style="geometry"
    aria-hidden="true"
  >
    <AttachmentMotif
      v-for="(effect, index) in effects"
      :key="`${effect.kind}:${effect.variant ?? ''}:${effect.dormant}`"
      :kind="effect.kind"
      :variant="effect.variant"
      :dormant="effect.dormant"
      :class="{ 'is-secondary': index > 0, 'is-compact': index > 1, 'is-forming': forming.includes(effect.sourceId) }"
      :style="index > 1 ? { '--badge-col': (index - 2) % 4, '--badge-row': Math.floor((index - 2) / 4) } : undefined"
    />
    <AttachmentMotif
      v-for="effect in departing" :key="`departing:${effect.exitId}`"
      :kind="effect.kind" :variant="effect.variant" :dormant="true"
      class="attachment-departure" :class="`departure-${effect.reason}`"
    />
  </div>
</template>

<style scoped>
.attachment-effects {
  position: absolute;
  pointer-events: none;
  user-select: none;
  border-radius: 5%;
  /* Below the host's pools, buttons, and status badges. Never a new map layer. */
  z-index: 0;
}
.attachment-effects :deep(*) { pointer-events: none !important; }
.attachment-effects :deep(.is-secondary) { opacity: 0.7; }
.attachment-effects :deep(.is-compact) {
  width: 21%; height: 21%; left: calc(3% + var(--badge-col) * 24%); top: calc(77% - var(--badge-row) * 22%);
  opacity: 0.85;
}
.attachment-effects :deep(.is-secondary *),
.attachment-effects.has-fire :deep(*) { animation: none !important; }
.attachment-effects.is-simple :deep(*) { animation: none !important; }
.attachment-effects.is-paused :deep(*) { animation-play-state: paused !important; }
.attachment-effects :deep(.attachment-departure) { animation: attachment-release 400ms ease-out both; opacity: 0.45; }
.attachment-effects :deep(.attachment-departure *) { animation: none !important; }
.attachment-effects :deep(.attachment-departure.fx-lock) { transform-origin: 50% 5%; animation-name: lock-release; }
.attachment-effects :deep(.attachment-departure.fx-rubble) { animation-name: rubble-release; }
.attachment-effects :deep(.attachment-departure.fx-web),
.attachment-effects :deep(.attachment-departure.fx-threads) { animation-name: web-release; }
.attachment-effects :deep(.attachment-departure.departure-moved),
.attachment-effects :deep(.attachment-departure.departure-inactive) { animation-name: attachment-release; }
.attachment-effects :deep(.is-forming) { animation: attachment-form 400ms ease-out both; }
@keyframes attachment-release { from { opacity: 0.4; filter: blur(0); } to { opacity: 0; filter: blur(4px); } }
@keyframes lock-release { from { opacity: 0.4; rotate: 0deg; translate: 0 0; } to { opacity: 0; rotate: 8deg; translate: 0 8px; } }
@keyframes rubble-release { from { opacity: 0.4; translate: 0 0; } to { opacity: 0; translate: 0 9px; scale: 0.96; } }
@keyframes web-release { from { opacity: 0.4; scale: 1; } to { opacity: 0; scale: 1.08; } }
@keyframes attachment-form { from { opacity: 0; } to { opacity: 1; } }
@media (prefers-reduced-motion: reduce) {
  .attachment-effects :deep(*) { animation: none !important; transition: none !important; }
}
</style>
