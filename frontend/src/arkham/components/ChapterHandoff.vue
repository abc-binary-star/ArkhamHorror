<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { portraitImage } from '@/arkham/cardImages'
import CampaignLogSection from './CampaignLogSection.vue'
export interface HandoffInvestigator {
  id: string
  code: string
  name: string
  gained: number | null
  available: number | null
  physical: number
  mental: number
  status: 'pending' | 'available' | 'saved' | 'unavailable' | 'unknown' | 'overBudget' | 'notInRoster'
}
defineProps<{
  recentName: string | null
  nextName: string
  investigators: HandoffInvestigator[]
  notes: string[]
  canUpgrade: boolean
  busy: boolean
  readOnly: boolean
}>()
defineEmits<{ upgrade: [] }>()
const { t } = useI18n()
const signed = (value: number | null) => value === null ? '—' : value > 0 ? `+${value}` : String(value)
</script>

<template>
  <section class="chapter-handoff" :aria-label="t('chapterHandoff.title')">
    <header>
      <div>
        <h2>{{ t(recentName ? 'chapterHandoff.title' : 'chapterHandoff.preparation') }}</h2>
        <p v-if="recentName">{{ t('chapterHandoff.recent', { name: recentName }) }}</p>
        <p>{{ t('chapterHandoff.next', { name: nextName }) }}</p>
      </div>
      <button v-if="canUpgrade && !readOnly" type="button" :disabled="busy" @click="$emit('upgrade')">{{ t('chapterHandoff.reviewDecks') }}</button>
    </header>
    <div class="handoff-roster">
      <article v-for="investigator in investigators" :key="investigator.id">
        <div class="handoff-identity">
          <img :src="portraitImage(investigator.code)" alt="" />
          <div><h3>{{ investigator.name }}</h3><p class="handoff-status" :class="{ 'handoff-status--attention': ['pending', 'overBudget'].includes(investigator.status) }">{{ t(`chapterHandoff.${investigator.status}`) }}</p></div>
        </div>
        <dl>
          <div v-if="recentName"><dt>{{ t('chapterHandoff.gained') }}</dt><dd>{{ signed(investigator.gained) }}</dd></div>
          <div><dt>{{ t('chapterHandoff.remaining') }}</dt><dd>{{ investigator.available ?? '—' }}</dd></div>
          <div><dt>{{ t('chapterHandoff.physical') }}</dt><dd>{{ investigator.physical }}</dd></div>
          <div><dt>{{ t('chapterHandoff.mental') }}</dt><dd>{{ investigator.mental }}</dd></div>
        </dl>
      </article>
    </div>
    <p class="handoff-note">{{ t('chapterHandoff.statusHint') }}</p>
    <details v-if="notes.length" class="handoff-records">
      <summary>{{ t('chapterHandoff.records', { count: notes.length }) }}</summary>
      <CampaignLogSection :title="t('campaignLog.campaignNotes')" :items="notes" />
    </details>
    <p v-else class="handoff-note">{{ t('chapterHandoff.noNotes') }}</p>
  </section>
</template>

<style scoped>
.chapter-handoff { flex: 0 0 100%; min-width: 0; box-sizing: border-box; padding: clamp(16px, 2vw, 26px); border: 1px solid var(--edge-dim); border-radius: 8px; color: var(--text); background: var(--surface-panel); box-shadow: var(--shadow-3); }
header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px; margin-bottom: 18px; }
h2 { margin: 0 0 8px; font-family: Arno, 'Source Han Serif', serif; color: var(--title); font-size: 1.6rem; }
header p { margin: 4px 0; overflow-wrap: anywhere; }
header button { padding: 10px 16px; min-height: 44px; color: var(--button-2-text); background: var(--button-2); border-radius: 6px; cursor: pointer; }
button:disabled { opacity: .55; cursor: wait; }
button:focus-visible, summary:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: 3px; }
.handoff-roster { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr)); gap: 12px; }
article { min-width: 0; padding: 14px; border: 1px solid var(--edge-dim); border-radius: 6px; background: var(--panel-inset); }
.handoff-identity { display: flex; gap: 10px; align-items: center; }
.handoff-identity img { width: 44px; height: 56px; object-fit: cover; border-radius: 4px; }
h3 { margin: 0; font-size: 1rem; overflow-wrap: anywhere; }
.handoff-status { font-size: 12px; margin: 4px 0 0; }
.handoff-status--attention { font-weight: 700; }
dl { margin: 12px 0 0; display: grid; gap: 8px; }
dl > div { display: flex; justify-content: space-between; gap: 12px; font-size: 13px; }
dd { margin: 0; font-variant-numeric: tabular-nums; font-weight: 700; }
.handoff-note { font-size: 12px; line-height: 1.6; color: var(--text-dim); margin: 12px 0 0; }
.handoff-records { margin-top: 16px; border-top: 1px solid var(--edge-dim); padding-top: 12px; }
summary { cursor: pointer; padding: 6px 0; }
</style>
