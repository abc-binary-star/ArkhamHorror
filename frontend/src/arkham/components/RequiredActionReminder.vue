<script setup lang="ts">
import { computed, inject, nextTick, onBeforeUnmount, ref, useId, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Game } from '@/arkham/types/Game'
import { choices, damageAssignmentTokens } from '@/arkham/types/Game'
import { processingKey, uiLockKey } from '@/arkham/injectionKeys'

const props = defineProps<{ game: Game; playerId: string; suppressed?: boolean }>()
const emit = defineEmits<{ choose: [index: number] }>()
const { t } = useI18n({ useScope: 'local', messages: {
  zh: {
    drawTitle: '请抽取遭遇卡', drawHint: '神话阶段需要抽取遭遇卡并结算。游戏正在等待你的操作。',
    draw: '抽取遭遇卡', assignTitle: '需要分配伤害／恐惧',
    assignHint: '请点击牌桌上可承受伤害或恐惧的调查员、支援卡，完成本次分配。',
    damage: '{count} 点伤害', horror: '{count} 点恐惧', assign: '开始分配', inspect: '查看牌桌',
  },
  en: {
    drawTitle: 'Draw an encounter card', drawHint: 'Draw and resolve an encounter card for the mythos phase. The game is waiting for your action.',
    draw: 'Draw encounter card', assignTitle: 'Assign damage / horror',
    assignHint: 'Select eligible investigators or assets on the table to complete this assignment.',
    damage: '{count} damage', horror: '{count} horror', assign: 'Start assigning', inspect: 'View table',
  },
} })
const titleId = useId()
const descriptionId = useId()
const dialog = ref<HTMLDialogElement | null>(null)
const processing = inject(processingKey, ref(false))
const uiLock = inject(uiLockKey, ref(false))
const submitted = ref(false)
const dismissed = ref(false)
const tokens = computed(() => damageAssignmentTokens(props.game, props.playerId))
const drawIndex = computed(() => props.game.phase === 'MythosPhase'
  ? choices(props.game, props.playerId).findIndex(choice => choice.tag === 'TargetLabel' && choice.target.tag === 'EncounterDeckTarget')
  : -1)
const kind = computed(() => tokens.value ? 'assign' : drawIndex.value >= 0 ? 'draw' : null)
const title = computed(() => t(kind.value === 'assign' ? 'assignTitle' : 'drawTitle'))
const visible = computed(() => !!kind.value && !props.suppressed && !uiLock.value)
let resetTimer: ReturnType<typeof setTimeout> | undefined
let lastKind: typeof kind.value = null

function collapse() {
  dismissed.value = true
  dialog.value?.close()
}
async function syncDialog() {
  await nextTick()
  if (!visible.value || dismissed.value) dialog.value?.close()
  else if (dialog.value?.isConnected && !dialog.value.open) dialog.value.showModal()
}
function act() {
  if (processing.value || submitted.value || !visible.value) return
  if (kind.value === 'assign') collapse()
  else if (drawIndex.value >= 0) {
    submitted.value = true
    emit('choose', drawIndex.value)
  }
}
// Preserve dismissal across the brief empty question between assignment clicks;
// changing remaining counts must not reopen a dialog over the target cards.
watch(kind, value => {
  clearTimeout(resetTimer)
  submitted.value = false
  if (value) {
    if (value !== lastKind) dismissed.value = false
    lastKind = value
  } else {
    resetTimer = setTimeout(() => { lastKind = null; dismissed.value = false }, 600)
  }
  void syncDialog()
}, { immediate: true, flush: 'post' })
watch(() => props.playerId, () => { lastKind = kind.value; dismissed.value = false; submitted.value = false })
watch([visible, dismissed], syncDialog, { flush: 'post' })
watch(processing, value => { if (!value) submitted.value = false })
onBeforeUnmount(() => { clearTimeout(resetTimer); dialog.value?.close() })
</script>

<template>
  <Teleport to="body">
    <button v-if="visible && dismissed" class="action-reminder" type="button" @click="dismissed = false">
      {{ title }}<template v-if="tokens"> · {{ t('damage', { count: tokens.damage }) }} / {{ t('horror', { count: tokens.horror }) }}</template>
    </button>
    <dialog ref="dialog" class="action-dialog" :aria-labelledby="titleId" :aria-describedby="descriptionId" @cancel.prevent="collapse">
      <h2 :id="titleId">{{ title }}</h2>
      <div v-if="tokens" class="token-counts">
        <span v-if="tokens.damage > 0" class="damage">{{ t('damage', { count: tokens.damage }) }}</span>
        <span v-if="tokens.horror > 0" class="horror">{{ t('horror', { count: tokens.horror }) }}</span>
      </div>
      <p :id="descriptionId">{{ t(kind === 'assign' ? 'assignHint' : 'drawHint') }}</p>
      <button class="primary" type="button" :disabled="processing || submitted" @click="act">{{ t(kind === 'assign' ? 'assign' : 'draw') }}</button>
      <button class="inspect" type="button" @click="collapse">{{ t('inspect') }}</button>
    </dialog>
  </Teleport>
</template>

<style scoped>
.action-dialog { position: fixed; inset: 0; margin: auto; box-sizing: border-box; width: min(360px, calc(100vw - 32px)); max-height: calc(100dvh - 32px); overflow: auto; padding: 22px; border: 1px solid #a58cba80; border-radius: 12px; background: linear-gradient(145deg, #302d38, #1b2425); color: #eee5d2; box-shadow: 0 24px 80px #0009; }
.action-dialog::backdrop { background: #090d12a6; }
h2 { margin: 0 0 14px; font-size: 1.1rem; color: #dcc6ef; }
p { margin: 14px 0 20px; font-size: .9rem; line-height: 1.7; color: #c6bdc9; }
.token-counts { display: flex; flex-wrap: wrap; gap: 10px; }
.token-counts span { padding: 8px 12px; border-radius: 6px; background: #ffffff08; font-weight: 600; }
.damage { color: #eea497; } .horror { color: #b7b0ef; }
button { cursor: pointer; min-height: 42px; padding: 9px 12px; border-radius: 6px; color: #f4eaf5; font-size: .9rem; }
.primary { width: 100%; border: 1px solid #b8a0c660; background: linear-gradient(#504158, #3b3043); }
.inspect { display: block; margin: 8px auto 0; border: 0; background: transparent; color: #bcb0c1; }
button:disabled { opacity: .6; cursor: wait; }
button:focus-visible { outline: 2px solid #e2c2ff; outline-offset: 3px; }
.action-reminder { position: fixed; left: 50%; top: calc(84px + env(safe-area-inset-top)); transform: translateX(-50%); z-index: 1100; max-width: calc(100vw - 32px); border: 1px solid #a58cba; background: #342d3c; box-shadow: 0 4px 24px #0008; }
</style>
