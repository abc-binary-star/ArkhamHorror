<script setup lang="ts">
import AtmosphereLine from './AtmosphereLine.vue'
import { computed, inject, nextTick, onBeforeUnmount, ref, useId, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Game } from '@/arkham/types/Game'
import { choices, damageAssignmentTokens } from '@/arkham/types/Game'
import { processingKey, uiLockKey, phaseAnnouncementKey } from '@/arkham/injectionKeys'
import { useDbCardStore } from '@/stores/dbCards'

const props = defineProps<{ game: Game; playerId: string; suppressed?: boolean }>()
const emit = defineEmits<{ choose: [index: number] }>()
const { t } = useI18n({ useScope: 'local', messages: {
  zh: {
    drawAnnouncement: '{name} 抽取了遭遇卡',
    assignTitle: '需要分配伤害／恐惧',
    damage: '{count} 点伤害', horror: '{count} 点恐惧', assign: '开始分配', inspect: '查看牌桌',
  },
  en: {
    drawAnnouncement: '{name} drew an encounter card',
    assignTitle: 'Assign damage / horror',
    damage: '{count} damage', horror: '{count} horror', assign: 'Start assigning', inspect: 'View table',
  },
} })
const titleId = useId()
const dialog = ref<HTMLDialogElement | null>(null)
const processing = inject(processingKey, ref(false))
const uiLock = inject(uiLockKey, ref(false))
const phaseAnnouncement = inject(phaseAnnouncementKey, ref(false))
const dbCards = useDbCardStore()
const submitted = ref(false)
const dismissed = ref(false)
const tokens = computed(() => damageAssignmentTokens(props.game, props.playerId))
const assignVisible = computed(() => !!tokens.value && !props.suppressed && !uiLock.value && !phaseAnnouncement.value)
const drawIndex = computed(() => props.game.phase === 'MythosPhase'
  ? choices(props.game, props.playerId).findIndex(choice => choice.tag === 'TargetLabel' && choice.target.tag === 'EncounterDeckTarget')
  : -1)
const drawVisible = computed(() => drawIndex.value >= 0 && !tokens.value
  && !props.suppressed && !uiLock.value && !phaseAnnouncement.value)
const investigatorName = computed(() => {
  const investigator = Object.values(props.game.investigators).find(i => i.playerId === props.playerId)
  if (!investigator) return ''
  const title = investigator.name.title
  return (localStorage.getItem('language') || 'en') === 'en' ? title : dbCards.getCardName(title, 'investigator')
})

function collapse() {
  dismissed.value = true
  dialog.value?.close()
}
async function syncDialog() {
  await nextTick()
  if (!assignVisible.value || dismissed.value) dialog.value?.close()
  else if (dialog.value?.isConnected && !dialog.value.open) dialog.value.showModal()
}
function act() {
  if (processing.value || !assignVisible.value) return
  collapse()
}
// Preserve dismissal across the brief empty question between assignment clicks;
// changing remaining counts must not reopen a dialog over the target cards.
let resetTimer: ReturnType<typeof setTimeout> | undefined
let lastAssignVisible = false
watch(assignVisible, value => {
  clearTimeout(resetTimer)
  if (value) {
    if (value !== lastAssignVisible) dismissed.value = false
    lastAssignVisible = value
  } else {
    resetTimer = setTimeout(() => { lastAssignVisible = false; dismissed.value = false }, 600)
  }
  void syncDialog()
}, { immediate: true, flush: 'post' })

// The interlude doubles as the auto-draw delay: submit once its reveal animation
// (1500ms in the style block) has played, so the card never needs a click.
const DRAW_INTERLUDE_MS = 1500
let drawTimer: ReturnType<typeof setTimeout> | undefined
function submitDraw() {
  if (processing.value) { drawTimer = setTimeout(submitDraw, 300); return }
  if (submitted.value || drawIndex.value < 0) return
  submitted.value = true
  emit('choose', drawIndex.value)
}
function armDrawTimer() {
  clearTimeout(drawTimer)
  drawTimer = setTimeout(submitDraw, DRAW_INTERLUDE_MS)
}
watch(drawVisible, active => {
  if (active) {
    if (!submitted.value) armDrawTimer()
  } else {
    clearTimeout(drawTimer)
    submitted.value = false
  }
}, { flush: 'post' })
watch(() => props.playerId, () => { lastAssignVisible = assignVisible.value; dismissed.value = false; submitted.value = false })
watch([assignVisible, dismissed], syncDialog, { flush: 'post' })
watch(processing, value => {
  if (value) return
  submitted.value = false
  if (drawVisible.value) armDrawTimer()
})
onBeforeUnmount(() => { clearTimeout(resetTimer); clearTimeout(drawTimer); dialog.value?.close() })
</script>

<template>
  <Teleport to="body">
    <button v-if="assignVisible && dismissed" class="action-reminder" type="button" @click="dismissed = false">
      {{ t('assignTitle') }}<template v-if="tokens"> · {{ t('damage', { count: tokens.damage }) }} / {{ t('horror', { count: tokens.horror }) }}</template>
    </button>
    <dialog ref="dialog" class="action-dialog" :aria-labelledby="titleId" @cancel.prevent="collapse">
      <h2 :id="titleId">{{ t('assignTitle') }}</h2>
      <AtmosphereLine :tone="tokens?.damage && tokens?.horror ? 'peril' : tokens?.horror ? 'horror' : 'damage'" />
      <div v-if="tokens" class="token-counts">
        <span v-if="tokens.damage > 0" class="damage">{{ t('damage', { count: tokens.damage }) }}</span>
        <span v-if="tokens.horror > 0" class="horror">{{ t('horror', { count: tokens.horror }) }}</span>
      </div>
      <button class="primary" type="button" :disabled="processing" @click="act">{{ t('assign') }}</button>
      <button class="inspect" type="button" @click="collapse">{{ t('inspect') }}</button>
    </dialog>
    <div v-if="drawVisible" class="draw-interlude" role="status" aria-live="polite">
      <div class="draw-interlude__veil" aria-hidden="true"></div>
      <div class="draw-interlude__panel">
        <span class="draw-interlude__corner draw-interlude__corner--left" aria-hidden="true"></span>
        <span class="draw-interlude__corner draw-interlude__corner--right" aria-hidden="true"></span>
        <p>{{ t('drawAnnouncement', { name: investigatorName }) }}</p>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.action-dialog { position: fixed; inset: 0; margin: auto; box-sizing: border-box; width: min(360px, calc(100vw - 32px)); max-height: calc(100dvh - 32px); overflow: auto; padding: 22px; border: 1px solid #a58cba80; border-radius: 12px; background: linear-gradient(145deg, #302d38, #1b2425); color: #eee5d2; box-shadow: 0 24px 80px #0009; }
.action-dialog::backdrop { background: #090d12a6; }
h2 { margin: 0 0 14px; font-size: 1.1rem; color: #dcc6ef; }
.token-counts { display: flex; flex-wrap: wrap; gap: 10px; }
.token-counts span { padding: 8px 12px; border-radius: 6px; background: #ffffff08; font-weight: 600; }
.damage { color: #eea497; } .horror { color: #b7b0ef; }
button { cursor: pointer; min-height: 42px; padding: 9px 12px; border-radius: 6px; color: #f4eaf5; font-size: .9rem; }
.primary { width: 100%; border: 1px solid #b8a0c660; background: linear-gradient(#504158, #3b3043); }
.inspect { display: block; margin: 8px auto 0; border: 0; background: transparent; color: #bcb0c1; }
button:disabled { opacity: .6; cursor: wait; }
button:focus-visible { outline: 2px solid #e2c2ff; outline-offset: 3px; }
.action-reminder { position: fixed; left: 50%; top: calc(84px + env(safe-area-inset-top)); transform: translateX(-50%); z-index: 1100; max-width: calc(100vw - 32px); border: 1px solid #a58cba; background: #342d3c; box-shadow: 0 4px 24px #0008; }

.draw-interlude {
  position: fixed;
  inset: 0;
  z-index: var(--z-tooltip-over-menus);
  display: grid;
  place-items: center;
  pointer-events: none;
  animation: draw-interlude-reveal 1500ms ease both;
}
.draw-interlude__veil {
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at center, rgb(5 12 16 / 10%), rgb(3 8 11 / 44%));
}
.draw-interlude__panel {
  position: relative;
  box-sizing: border-box;
  width: min(560px, calc(100vw - 36px));
  padding: 24px 36px;
  text-align: center;
  color: #e9d3a3;
  border-block: 1px solid #b59760;
  background: linear-gradient(90deg, rgb(9 18 21 / 84%), #111b20 25%, #111b20 75%, rgb(9 18 21 / 84%));
  box-shadow: 0 20px 80px rgb(0 0 0 / 45%), inset 0 0 0 5px rgb(8 14 17 / 55%);
}
.draw-interlude__panel::before {
  content: '';
  position: absolute;
  inset: 7px 14px;
  border-block: 1px solid rgb(185 155 97 / 28%);
}
.draw-interlude__corner {
  position: absolute;
  top: 14px;
  bottom: 14px;
  width: 18px;
  border-block: 1px solid #c6a874;
}
.draw-interlude__corner--left { left: 16px; border-left: 1px solid #c6a874; }
.draw-interlude__corner--right { right: 16px; border-right: 1px solid #c6a874; }
.draw-interlude__panel p {
  margin: 0;
  font-family: 'Songti SC', 'Noto Serif SC', Georgia, serif;
  font-size: clamp(19px, 2.2vw, 26px);
  letter-spacing: 0.14em;
  text-indent: 0.14em;
  text-shadow: 0 2px 3px #000, 0 0 22px rgb(217 182 116 / 22%);
}
@keyframes draw-interlude-reveal {
  0% { opacity: 0; transform: translateY(8px); }
  16%, 76% { opacity: 1; transform: translateY(0); }
  100% { opacity: 0; transform: translateY(-4px); }
}
@media (prefers-reduced-motion: reduce) {
  .draw-interlude { animation: none; }
}
</style>
