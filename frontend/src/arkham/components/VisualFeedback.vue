<script setup lang="ts">
import { shallowRef, watch, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import { arrangeReceipts, overlaps, type FeedbackRect } from '../visualFeedback'
import { useVisualFeedback } from '../composables/useVisualFeedback'
import { useSettings } from '@/stores/settings'
import { imgsrc } from '@/arkham/helpers'
const feedback = useVisualFeedback()
const settings = useSettings()
const { t } = useI18n()
type Receipt = NonNullable<typeof feedback>['receipts']['value'][number]
const receipts = shallowRef<Receipt[]>([])
let frame: number | null = null
let observer: MutationObserver | null = null
const canvas = document.createElement('canvas').getContext('2d')
function boxes(selector: string): FeedbackRect[] {
  return [...document.querySelectorAll<HTMLElement>(selector)].flatMap(element => {
    if (element.closest('.visual-feedback') || !element.getClientRects().length || getComputedStyle(element).visibility === 'hidden') return []
    const rect = element.getBoundingClientRect()
    if (!rect.width || !rect.height || rect.bottom < 0 || rect.top > innerHeight || rect.right < 0 || rect.left > innerWidth) return []
    return [{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }]
  })
}
function updateLayout() {
  frame = null
  const decisions = boxes('dialog[open], [role="dialog"], [data-feedback-avoid], .choice-modal-wrapper, .question-choices, button, input, select, textarea')
  const reading = boxes('img.card, .story-entry, .skill-test')
  const items = (feedback?.receipts.value ?? []).filter(item => item.delta !== undefined || !decisions.some(rect => overlaps(rect, {
    left: item.x - item.width / 2, top: item.y - item.height / 2, width: item.width, height: item.height,
  }))).map(item => {
    if (canvas) canvas.font = '12px sans-serif'
    const text = `${t(`visualFeedback.${item.kind}`)} ${item.delta && item.delta > 0 ? '+' : '−'}${Math.abs(item.delta ?? 0)}`
    return { ...item, bubbleWidth: (canvas?.measureText(text).width ?? text.length * 12) + 38 }
  })
  const next = arrangeReceipts(items, innerWidth, innerHeight, [...decisions, ...reading])
  if (JSON.stringify(next) !== JSON.stringify(receipts.value)) receipts.value = next
}
function scheduleLayout() {
  if (frame === null) frame = requestAnimationFrame(updateLayout)
}
watch(() => feedback?.receipts.value, items => {
  observer?.disconnect()
  if (!items?.length) {
    if (frame !== null) cancelAnimationFrame(frame)
    frame = null
    receipts.value = []
    return
  }
  // Watch only while a receipt is alive; ignore our own layout updates.
  observer ??= new MutationObserver(records => {
    if (records.some(record => !(record.target instanceof Element) || !record.target.closest('.visual-feedback'))) scheduleLayout()
  })
  observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['open', 'class', 'style'] })
  scheduleLayout()
}, { flush: 'post' })
onBeforeUnmount(() => { observer?.disconnect(); if (frame !== null) cancelAnimationFrame(frame) })
const images: Record<string, string> = { Resource: 'tokens/resource.png', Clue: 'tokens/clue.png', Damage: 'health.png', Horror: 'horror.png' }
// Reuse the published map edges, including their actual curves and direction.
// No shortest-path inference, and no new connections to hidden locations.
const edgeAnimations = new Map<string, Animation[]>()
watch([() => feedback?.receipts.value, () => settings.extraAnimations, () => settings.visualExperience], () => {
  const items = feedback?.receipts.value ?? []
  const animated = settings.extraAnimations && settings.visualExperience !== 'simple'
  const live = new Set(animated ? items.map(item => item.id) : [])
  for (const [id, animations] of edgeAnimations) {
    if (!live.has(id)) { animations.forEach(animation => animation.cancel()); edgeAnimations.delete(id) }
  }
  if (!animated) return
  for (const item of items) {
    if (edgeAnimations.has(item.id) || item.kind !== 'Reveal') continue
    const animations: Animation[] = []
    for (const edge of document.querySelectorAll<SVGElement>('.connections-svg [data-connection]')) {
      const endpoints = edge.dataset.connection?.split(/->|:/) ?? []
      if (endpoints.length !== 2) continue
      const matches = endpoints.includes(item.locationId ?? '')
      if (!matches || !edge.animate) continue
      animations.push(edge.animate([
        { opacity: 0.25, stroke: '#b7cfb6', strokeWidth: '3px' },
        { opacity: 1, stroke: '#e4cc91', strokeWidth: '3px', offset: 0.35 },
        { opacity: 0.7 },
      ], { duration: 650, easing: 'ease-out' }))
    }
    edgeAnimations.set(item.id, animations)
  }
}, { flush: 'post' })
onBeforeUnmount(() => edgeAnimations.forEach(animations => animations.forEach(animation => animation.cancel())))
</script>
<template>
  <Teleport to="body">
    <div v-if="feedback" class="visual-feedback" aria-hidden="true"
      :class="{ 'visual-feedback--static': settings.visualExperience === 'simple' || !settings.extraAnimations }">
      <div v-for="item in receipts" :key="`${item.id}:${item.anchor}`"
        class="visual-receipt" :class="`visual-receipt--${item.kind}`"
        :style="{ left: `${item.x}px`, top: `${item.y}px`, '--receipt-width': `${item.width}px`, '--receipt-height': `${item.height}px` }">
        <template v-if="item.delta !== undefined">
          <img :src="imgsrc(images[item.kind])" alt="" />
          <span>{{ $t(`visualFeedback.${item.kind}`) }} {{ item.delta > 0 ? '+' : '−' }}{{ Math.abs(item.delta) }}</span>
        </template>
        <i v-else-if="item.kind === 'Action'" class="action" />
      </div>
    </div>
  </Teleport>
</template>
<style scoped>
.visual-feedback { position: fixed; inset: 0; z-index: 1200; pointer-events: none; }
.visual-receipt { position: absolute; display: flex; align-items: center; gap: 3px; white-space: nowrap; padding: 3px 6px; border: 1px solid currentColor; border-radius: 5px; color: #ead29a; background: #18201ef2; font: 12px/18px sans-serif; transform: translate(-50%, -50%); animation: receipt-rise 850ms ease-out both; pointer-events: none; }
.visual-receipt img { width: 18px; height: 18px; object-fit: contain; }
.visual-receipt--Clue { color: #b7d7bd; }
.visual-receipt--Damage { color: #f0a59c; }
.visual-receipt--Horror { color: #d4b6ef; }
.visual-receipt--Focus, .visual-receipt--Move, .visual-receipt--Reveal, .visual-receipt--Doom { width: var(--receipt-width); height: var(--receipt-height); padding: 0; background: transparent; box-shadow: inset 0 0 12px #d6b97880; transform: translate(-50%, -50%); animation: receipt-fade 850ms ease-out both; }
.visual-receipt--Action .action { font: normal var(--receipt-height)/1 Arkham; color: #ead29a; }
.visual-receipt--Action .action::before { content: "\0049"; }
.visual-receipt--Action { background: transparent; border: 0; padding: 0; transform: translate(-50%, -50%); animation: receipt-fade 700ms ease-out both; }
@keyframes receipt-rise { 0% { opacity: 0; scale: .96; } 18% { opacity: 1; scale: 1; } 70% { opacity: 1; } 100% { opacity: 0; } }
@keyframes receipt-fade { from { opacity: 1; } to { opacity: 0; } }
.visual-receipt--Reveal { color: #b7cfb6; box-shadow: inset 0 0 10px #b7cfb660; }
.visual-receipt--Doom { color: #d09380; box-shadow: inset 0 0 10px #ab604a70; }
.visual-feedback--static .visual-receipt { animation: none; }
@media (prefers-reduced-motion: reduce) { .visual-receipt { animation: none; } }
</style>
