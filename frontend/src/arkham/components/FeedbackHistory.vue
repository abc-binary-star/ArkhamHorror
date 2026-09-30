<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useVisualFeedback } from '../composables/useVisualFeedback'
import type { VisualEvent } from '../visualFeedback'
import { useDbCardStore } from '@/stores/dbCards'
import { cardArt } from '@/arkham/cardImages'
const props = defineProps<{ mapOnly?: boolean }>()
const feedback = useVisualFeedback()
const { t } = useI18n()
const cards = useDbCardStore()
const entries = computed(() => [...(props.mapOnly ? feedback?.mapActivity.value ?? [] : feedback?.history.value ?? [])].reverse())
function subject(event: VisualEvent) {
  if (event.subjectCode) {
    const card = cards.getDbCard(cardArt(event.subjectCode))
    if (card) return card.name
  }
  if (event.subjectName) return cards.getCardName(event.subjectName, event.subjectType === 'investigators' ? 'investigator' : undefined)
  return t(`visualFeedback.subject.${event.subjectType ?? 'unknown'}`)
}
</script>
<template>
  <details v-if="entries.length" class="feedback-history" :class="{ 'feedback-history--map': mapOnly }" data-feedback-avoid @pointerdown.stop @dblclick.stop>
    <summary>{{ t(mapOnly ? 'visualFeedback.offscreen' : 'visualFeedback.recent') }} · {{ entries.length }}</summary>
    <ul>
      <li v-for="entry in entries" :key="entry.id">
        <span>{{ subject(entry) }} · {{ t(`visualFeedback.${entry.kind}`) }}<template v-if="entry.delta !== undefined"> {{ entry.delta > 0 ? '+' : '−' }}{{ Math.abs(entry.delta) }}</template></span>
        <button v-if="entry.locationId" type="button" @click.stop="feedback?.locateMapEvent(entry)">{{ t('visualFeedback.locate') }}</button>
      </li>
    </ul>
  </details>
</template>
<style scoped>
.feedback-history { position: relative; width: fit-content; max-width: 100%; font: 12px/1.5 sans-serif; color: #ddd0b2; background: #17201ef2; border: 1px solid #8c7c5555; border-radius: 4px; z-index: 32; }
summary { padding: 3px 8px; cursor: pointer; }
ul { list-style: none; padding: 4px 8px; margin: 0; width: min(340px, 72vw); max-height: 180px; overflow: auto; }
li { display: flex; justify-content: space-between; gap: 10px; align-items: center; padding: 3px 0; }
button { flex: none; padding: 2px 6px; font: inherit; background: transparent; color: #ebd193; border: 1px solid #a08c6555; border-radius: 3px; cursor: pointer; }
.feedback-history--map { position: absolute; top: 8px; left: 8px; }
</style>
