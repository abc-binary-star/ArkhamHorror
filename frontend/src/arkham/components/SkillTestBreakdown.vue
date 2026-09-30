<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { SkillTestResults } from '@/arkham/types/SkillTest'
const props = defineProps<{ results: SkillTestResults }>()
const emit = defineEmits<{ inspect: [] }>()
const { t } = useI18n()
const total = computed(() => Math.max(0, props.results.skillTestResultsSkillValue
  + props.results.skillTestResultsIconValue + props.results.skillTestResultsChaosTokensValue))
const rawTotal = computed(() => props.results.skillTestResultsSkillValue
  + props.results.skillTestResultsIconValue + props.results.skillTestResultsChaosTokensValue)
const signed = (value: number) => value > 0 ? `+${value}` : String(value)
function inspect(event: Event) {
  // Pause immediately on opening, before the native toggle event is queued.
  const summary = event.currentTarget as HTMLElement
  if (!(summary.parentElement as HTMLDetailsElement)?.open) emit('inspect')
}
</script>

<template>
  <details class="test-breakdown">
    <summary @click="inspect">{{ t('testBreakdown.title') }}</summary>
    <dl>
      <div><dt>{{ t('testBreakdown.skill') }}</dt><dd>{{ results.skillTestResultsSkillValue }}</dd></div>
      <div><dt>{{ t('testBreakdown.icons') }}</dt><dd>{{ signed(results.skillTestResultsIconValue) }}</dd></div>
      <div><dt>{{ t('testBreakdown.tokens') }}</dt><dd>{{ signed(results.skillTestResultsChaosTokensValue) }}</dd></div>
      <div class="test-breakdown__total"><dt>{{ t('testBreakdown.total') }}</dt><dd>{{ total }}</dd></div>
      <div><dt>{{ t('testBreakdown.difficulty') }}</dt><dd>{{ results.skillTestResultsDifficulty }}</dd></div>
      <div v-if="results.skillTestResultsResultModifiers"><dt>{{ t('testBreakdown.resultModifier') }}</dt><dd>{{ signed(results.skillTestResultsResultModifiers) }}</dd></div>
      <div class="test-breakdown__total"><dt>{{ t('testBreakdown.outcome') }}</dt><dd>{{ t(results.skillTestResultsSuccess ? 'testBreakdown.success' : 'testBreakdown.failure') }}</dd></div>
    </dl>
    <p v-if="rawTotal < 0">{{ t('testBreakdown.floor') }}</p>
    <p>{{ t('testBreakdown.explanation') }}</p>
    <p v-if="results.skillTestResultsResultModifiers">{{ t('testBreakdown.modifierHint') }}</p>
  </details>
</template>

<style scoped>
.test-breakdown { margin: 8px 0; padding: 8px 12px; border: 1px solid var(--edge-dim); border-radius: 4px; background: var(--panel-inset); color: var(--text); font-size: 13px; }
summary { cursor: pointer; min-height: 28px; line-height: 28px; }
summary:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: 2px; }
dl { margin: 8px 0; }
dl > div { display: flex; justify-content: space-between; gap: 16px; padding: 4px 0; }
dd { margin: 0; font-variant-numeric: tabular-nums; flex-shrink: 0; }
.test-breakdown__total { border-top: 1px solid var(--edge-dim); font-weight: 700; }
p { margin: 6px 0 0; line-height: 1.6; color: var(--text-dim); }
@media (pointer: coarse) { summary { min-height: 44px; line-height: 44px; } }
</style>
