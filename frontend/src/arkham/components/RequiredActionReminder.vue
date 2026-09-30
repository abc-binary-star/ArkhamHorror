<script setup lang="ts">
import { assignmentPreview } from '@/arkham/visualFeedback'
import { computed, inject, nextTick, onBeforeUnmount, ref, useId, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Game } from '@/arkham/types/Game'
import type { Message } from '@/arkham/types/Message'
import QuestionChoices from './QuestionChoices.vue'
import { choices, damageAssignmentTokens } from '@/arkham/types/Game'
import { processingKey, uiLockKey, phaseAnnouncementKey } from '@/arkham/injectionKeys'
import { useDbCardStore } from '@/stores/dbCards'
import { useCardStore } from '@/stores/cards'
import { cardArt } from '@/arkham/cardImages'
import { Brain, Droplet } from '@lucide/vue'

const props = defineProps<{ game: Game; playerId: string; suppressed?: boolean }>()
const emit = defineEmits<{ choose: [index: number] }>()
const { t } = useI18n({ useScope: 'local', messages: {
  zh: {
    drawAnnouncement: '{name} 抽取了遭遇卡',
    assignTitle: '分配伤害与恐惧',
    capacity: '当前余量：生命 {health} · 理智 {sanity}', after: '按当前分配结算后：生命 {health} · 理智 {sanity}', nextDamage: '再分配 1 伤害后，生命余量 {count}', nextHorror: '再分配 1 恐惧后，理智余量 {count}', unknown: '—', atLimit: '当前分配将达到生命或理智上限；最终按规则结算。', healing: '本次待治疗：伤害 {damage} · 恐惧 {horror}',
    damage: '{count} 点伤害', horror: '{count} 点恐惧', assign: '分配 1 伤害', assignHorror: '分配 1 恐惧', investigator: '调查员', asset: '资产', instruction: '点击对象旁的按钮分配，每次 1 点。', received: '已承受：伤害 {damage} · 恐惧 {horror}', pending: '本次已分配：伤害 {damage} · 恐惧 {horror}', inspect: '查看牌桌',
  },
  en: {
    drawAnnouncement: '{name} drew an encounter card',
    assignTitle: 'Assign damage / horror',
    capacity: 'Remaining: {health} health · {sanity} sanity', after: 'After current assignments: {health} health · {sanity} sanity', nextDamage: 'After assigning 1 more damage: {count} health remaining', nextHorror: 'After assigning 1 more horror: {count} sanity remaining', unknown: '—', atLimit: 'Current assignments reach a health or sanity limit. Final resolution follows the rules.', healing: 'Pending healing: {damage} damage · {horror} horror',
    damage: '{count} damage', horror: '{count} horror', assign: 'Assign 1 damage', assignHorror: 'Assign 1 horror', investigator: 'Investigator', asset: 'Asset', instruction: 'Assign one point at a time using the buttons beside each target.', received: 'Taken: {damage} damage · {horror} horror', pending: 'Assigned: {damage} damage · {horror} horror', inspect: 'View table',
  },
} })
const titleId = useId()
const dialog = ref<HTMLDialogElement | null>(null)
const processing = inject(processingKey, ref(false))
const uiLock = inject(uiLockKey, ref(false))
const phaseAnnouncement = inject(phaseAnnouncementKey, ref(false))
const dbCards = useDbCardStore()
const cardStore = useCardStore()
function assetName(code: string): string {
  const definition = cardStore.cards.find(card => card.cardCode === code)
  const card = dbCards.getDbCard(cardArt(code))
    ?? (definition ? dbCards.getDbCard(definition.art) : null)
  if (card) return card.name
  return definition ? dbCards.getCardName(definition.name.title, 'asset') : code
}
const submitted = ref(false)
const dismissed = ref(false)
const tokens = computed(() => damageAssignmentTokens(props.game, props.playerId))
const assignmentSubmitted = ref(false)
const assignmentChoices = computed(() => choices(props.game, props.playerId))
const assignmentRows = computed(() => {
  const rows = new Map<string, {
    id: string; name: string; kind: string; owner: string; damage: number; horror: number;
    healthPreview: ReturnType<typeof assignmentPreview>; sanityPreview: ReturnType<typeof assignmentPreview>;
    healingDamage: number; healingHorror: number; nextHealth: number | null; nextSanity: number | null;
    assignedDamage: number; assignedHorror: number; damageIndex?: number; horrorIndex?: number
  }>()
  assignmentChoices.value.forEach((choice, index) => {
    if (choice.tag !== 'ComponentLabel') return
    const component = choice.component
    if (!('tokenType' in component) || !['DamageToken', 'HorrorToken'].includes(component.tokenType)) return
    const isInvestigator = component.tag === 'InvestigatorComponent'
    const id = isInvestigator ? component.investigatorId : component.assetId
    const entity = isInvestigator ? props.game.investigators[id] : props.game.assets[id]
    if (!entity) return
    const key = `${component.tag}:${id}`
    let row = rows.get(key)
    if (!row) {
      const asset = !isInvestigator ? props.game.assets[id] : undefined
      const owner = asset ? props.game.investigators[asset.controller ?? asset.owner ?? ''] : undefined
      row = {
        id: key,
        name: isInvestigator ? dbCards.getCardName(props.game.investigators[id].name.title, 'investigator')
          : assetName(entity.cardCode),
        kind: isInvestigator ? 'investigator' : 'asset',
        owner: owner ? dbCards.getCardName(owner.name.title, 'investigator') : '',
        damage: entity.tokens.Damage ?? 0, horror: entity.tokens.Horror ?? 0,
        assignedDamage: entity.assignedHealthDamage, assignedHorror: entity.assignedSanityDamage,
        healingDamage: entity.assignedHealthHeal, healingHorror: entity.assignedSanityHeal,
        nextHealth: assignmentPreview(entity.remainingHealth, entity.tokens.Damage, entity.assignedHealthDamage + 1, entity.assignedHealthHeal)?.after ?? null,
        nextSanity: assignmentPreview(entity.remainingSanity, entity.tokens.Horror, entity.assignedSanityDamage + 1, entity.assignedSanityHeal)?.after ?? null,
        healthPreview: assignmentPreview(entity.remainingHealth, entity.tokens.Damage, entity.assignedHealthDamage, entity.assignedHealthHeal),
        sanityPreview: assignmentPreview(entity.remainingSanity, entity.tokens.Horror, entity.assignedSanityDamage, entity.assignedSanityHeal),
      }
      rows.set(key, row)
    }
    if (component.tokenType === 'DamageToken') row.damageIndex = index
    else row.horrorIndex = index
  })
  return [...rows.values()]
})
const otherChoices = computed<[Message, number][]>(() => {
  const indices = new Set(assignmentRows.value.flatMap(row => [row.damageIndex, row.horrorIndex]))
  return assignmentChoices.value.flatMap((choice, index) => indices.has(index) ? [] : [[choice, index] as [Message, number]])
})
const assignmentBusy = computed(() => processing.value || assignmentSubmitted.value || !assignVisible.value)
function assign(index: number) {
  if (assignmentBusy.value || !assignmentChoices.value[index]) return
  assignmentSubmitted.value = true
  emit('choose', index)
}
watch(() => props.game.question[props.playerId], () => { assignmentSubmitted.value = false })
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
// Keep the user's table-view preference through brief question transitions.
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
  assignmentSubmitted.value = false
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
      <header class="assignment-header">
      <h2 :id="titleId">{{ t('assignTitle') }}</h2>
      <div v-if="tokens" class="token-counts">
        <span v-if="tokens.damage > 0" class="damage"><Droplet aria-hidden="true" />{{ t('damage', { count: tokens.damage }) }}</span>
        <span v-if="tokens.horror > 0" class="horror"><Brain aria-hidden="true" />{{ t('horror', { count: tokens.horror }) }}</span>
      </div>
      </header>
      <fieldset :disabled="assignmentBusy" :aria-busy="assignmentBusy" class="assignment-list">
        <section v-for="row in assignmentRows" :key="row.id" class="assignment-row">
          <div class="target-info">
            <strong>{{ row.name }}</strong>
            <small>{{ t(row.kind) }}<template v-if="row.owner"> · {{ row.owner }}</template></small>
            <small>{{ t('received', { damage: row.damage, horror: row.horror }) }}</small>
            <small v-if="row.assignedDamage || row.assignedHorror">{{ t('pending', { damage: row.assignedDamage, horror: row.assignedHorror }) }}</small>
            <small v-if="row.healingDamage || row.healingHorror">{{ t('healing', { damage: row.healingDamage, horror: row.healingHorror }) }}</small>
            <small v-if="row.healthPreview || row.sanityPreview">{{ t('capacity', { health: row.healthPreview?.remaining ?? t('unknown'), sanity: row.sanityPreview?.remaining ?? t('unknown') }) }}</small>
            <small v-if="(row.healthPreview || row.sanityPreview) && (row.assignedDamage || row.assignedHorror || row.healingDamage || row.healingHorror)">{{ t('after', { health: row.healthPreview?.after ?? t('unknown'), sanity: row.sanityPreview?.after ?? t('unknown') }) }}</small>
            <small v-if="row.healthPreview?.after === 0 || row.sanityPreview?.after === 0" class="assignment-limit">{{ t('atLimit') }}</small>
          </div>
          <div class="assignment-buttons">
            <button v-if="row.damageIndex !== undefined" class="assign-damage" type="button" :title="row.nextHealth != null ? t('nextDamage', { count: row.nextHealth }) : undefined" :aria-label="`${row.name}：${t('assign')}`" @click="assign(row.damageIndex)"><Droplet aria-hidden="true" />{{ t('assign') }}</button>
            <button v-if="row.horrorIndex !== undefined" class="assign-horror" type="button" :title="row.nextSanity != null ? t('nextHorror', { count: row.nextSanity }) : undefined" :aria-label="`${row.name}：${t('assignHorror')}`" @click="assign(row.horrorIndex)"><Brain aria-hidden="true" />{{ t('assignHorror') }}</button>
          </div>
        </section>
        <QuestionChoices v-if="otherChoices.length" :game="game" :choices="otherChoices" @choose="assign" />
      </fieldset>
      <button class="inspect dialog-chrome-action" type="button" @click="collapse">{{ t('inspect') }}</button>
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
.assignment-limit { color: #e7aa99; }
.action-dialog {
  position: fixed;
  inset: 0;
  margin: auto;
  isolation: isolate;
  box-sizing: border-box;
  width: min(520px, calc(100vw - 24px));
  max-height: calc(100dvh - 24px);
  overflow: auto;
  padding: 36px 32px 24px;
  border: 1px solid #796c5880;
  border-radius: 4px;
  color: #e2dbce;
  background:
    radial-gradient(ellipse at 0 0, #63252355, transparent 48%),
    radial-gradient(ellipse at 100% 100%, #50436240, transparent 52%), #141919;
  box-shadow: 0 28px 90px #000c, inset 0 0 40px #0008;
}
/* Tone the existing engraving into the panel; the artwork occupies only its rim. */
.action-dialog::before {
  content: '';
  position: absolute;
  inset: 3px;
  z-index: -1;
  pointer-events: none;
  border: 42px solid transparent;
  border-image: url('@/assets/veiled-harbour/occult-panel-v1.png') 280 / 1 / 0 stretch;
  filter: invert(.9) grayscale(.8) sepia(.25) brightness(.7);
  opacity: .65;
}
.action-dialog::after {
  content: '';
  position: absolute;
  top: 0;
  left: 18px;
  right: 18px;
  height: 2px;
  pointer-events: none;
  background: linear-gradient(90deg, transparent, #8c443d 18%, #aa8260 50%, #79658c 82%, transparent);
}
.action-dialog::backdrop { background: #050a0db8; }
.assignment-header { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; padding-bottom: 18px; border-bottom: 1px solid #b7a27c35; }
h2 { margin: 0; font: 500 1.12rem/1.5 'Songti SC', 'Noto Serif SC', Georgia, serif; letter-spacing: .06em; color: #e1d0b0; }
.token-counts { display: flex; flex-wrap: wrap; gap: 12px; }
.token-counts span { display: inline-flex; align-items: center; gap: 6px; font-size: .85rem; font-weight: 500; }
.token-counts svg, .assignment-buttons svg { width: 16px; height: 16px; stroke-width: 1.5; flex-shrink: 0; }
.token-counts .damage { color: #d9a196; }
.token-counts .horror { color: #bca9d0; }
button { cursor: pointer; min-height: 40px; padding: 8px 12px; border-radius: 3px; color: #e6dfd6; font-size: .78rem; font-weight: 500; }
.assignment-list { display: grid; padding: 0; margin: 0; border: 0; min-width: 0; }
.assignment-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 19px 0; border-bottom: 1px solid #a6977d26; }
.target-info { display: grid; gap: 4px; min-width: 0; overflow-wrap: anywhere; }
.target-info strong { margin-bottom: 2px; color: #e7deca; font: 600 1rem/1.4 'Songti SC', 'Noto Serif SC', Georgia, serif; }
.target-info small { font-size: .7rem; line-height: 1.5; color: #a6a69e; }
.assignment-buttons { display: grid; gap: 8px; flex-shrink: 0; }
.assignment-buttons button { display: flex; align-items: center; justify-content: center; gap: 7px; transition: background .15s, border-color .15s; box-shadow: inset 0 1px #ffffff08; }
.assign-damage { border: 1px solid #925c505c; background: #542f2b66; color: #e1b1a3; }
.assign-horror { border: 1px solid #88739866; background: #46394e77; color: #cfc0de; }
.assign-damage:hover:not(:disabled) { background: #683b34; border-color: #b17b69; }
.assign-horror:hover:not(:disabled) { background: #544260; border-color: #a28bb5; }
.assignment-list:disabled { opacity: .65; pointer-events: none; }
.inspect { display: block; margin: 14px auto 0; padding: 5px 16px; min-height: 36px; border: 0; background: transparent; color: #a99d85; font-size: .75rem; }
.inspect:hover { color: #e4d4b5; background: #bba7790a; }
button:disabled { opacity: .6; cursor: wait; }
button:focus-visible { outline: 1px solid #bda985; outline-offset: 3px; }
.action-reminder { position: fixed; left: 50%; top: calc(84px + env(safe-area-inset-top)); transform: translateX(-50%); z-index: 1100; max-width: calc(100vw - 32px); border: 1px solid #a58b64; background: #282322; box-shadow: 0 4px 24px #0008; color: #e2c9a0; }
@media (max-width: 480px) {
  .action-dialog { padding: 28px 22px 18px; }
  .assignment-row { align-items: stretch; flex-direction: column; gap: 12px; padding: 16px 0; }
  .assignment-buttons { grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); }
  h2 { font-size: 1.05rem; }
}

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
