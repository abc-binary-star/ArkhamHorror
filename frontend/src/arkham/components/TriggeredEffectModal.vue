<script setup lang="ts">
import { computed, inject, nextTick, onBeforeUnmount, ref, useId, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Game } from '@/arkham/types/Game'
import { choices, choicesTooltip } from '@/arkham/types/Game'
import { toCardContents } from '@/arkham/types/Card'
import type { Source } from '@/arkham/types/Source'
import { formatContent } from '@/arkham/helpers'
import { handleEmbeddedI18n } from '@/arkham/i18n'
import { cardImage, sourceCardCode } from '@/arkham/cardImages'
import { processingKey } from '@/arkham/injectionKeys'
import AbilityButton from './AbilityButton.vue'
import QuestionChoices from './QuestionChoices.vue'

const props = defineProps<{ game: Game; playerId: string }>()
const emit = defineEmits<{ choose: [index: number] }>()
const { t } = useI18n()
const titleId = useId()
const descriptionId = useId()
const dialog = ref<HTMLDialogElement | null>(null)
const collapsed = ref(false)
const submitted = ref(false)
const processing = inject(processingKey)
const busy = computed(() => submitted.value || processing?.value === true)
const questionKey = computed(() => JSON.stringify(props.game.question[props.playerId]))
const context = computed(() => {
  let question = props.game.question[props.playerId]
  while (question) {
    if (question.tag === 'QuestionLabel' && question.label !== '@none') return question.label
    if (!question.question) break
    question = question.question
  }
  return choicesTooltip(props.game, props.playerId)
})
const contextHtml = computed(() => context.value ? formatContent(handleEmbeddedI18n(context.value, t)) : '')
function effectCardCode(source: Source): string | null {
  switch (source.sourceTag) {
    case 'ProxySource': return effectCardCode(source.source) ?? effectCardCode(source.originalSource)
    case 'IndexedSource': return source.contents ? effectCardCode(source.contents[1]) : null
    case 'AbilitySource': return effectCardCode(source.contents[0])
    case 'UseAbilitySource': return effectCardCode(source.contents[1])
    case 'PaymentSource': return effectCardCode(source.contents)
    case 'BothSource': return effectCardCode(source.contents[0]) ?? effectCardCode(source.contents[1])
    case 'OtherSource':
      if (source.tag === 'SkillSource' && source.contents) return props.game.skills[source.contents]?.cardCode ?? null
      if (source.tag === 'CardCodeSource') return source.contents ?? null
      break
  }
  return sourceCardCode(source, props.game)
}
const entries = computed(() => {
  const investigator = Object.values(props.game.investigators).find(i => i.playerId === props.playerId)
  return choices(props.game, props.playerId).map((choice, index) => {
    let code: string | null = null
    if (choice.tag === 'AbilityLabel') code = effectCardCode(choice.ability.source)
    if (choice.tag === 'TargetLabel' && choice.target.tag === 'CardIdTarget') {
      // Resolve only already-visible zones, never inspect another player's hand.
      const visibleCards = investigator ? [
        ...investigator.hand.map(toCardContents),
        ...investigator.discard,
        ...investigator.cardsUnderneath.map(toCardContents),
        ...Object.values(investigator.foundCards).flat().map(toCardContents),
      ] : []
      const contents = visibleCards.find(c => c.id === choice.target.contents)
      if (contents) {
        code = `${contents.cardCode}${contents.isFlipped ? 'b' : ''}`
      }
    }
    return { choice, index, image: code ? cardImage(code) : null }
  })
})
// Merge adjacent entries that resolve to the same card image so several
// abilities of one card share a single card picture. Choices keep their own
// indices; ordering with unrelated entries is untouched.
const groupedEntries = computed(() => {
  const groups: { image: string | null; entries: typeof entries.value }[] = []
  for (const entry of entries.value) {
    const last = groups[groups.length - 1]
    if (last && last.image && entry.image && last.image === entry.image) {
      last.entries.push(entry)
    } else {
      groups.push({ image: entry.image, entries: [entry] })
    }
  }
  return groups
})
const compactLayout = computed(() => groupedEntries.value.filter(group =>
  !group.entries.every(entry => entry.choice.tag === 'SkipTriggersButton')
).length <= 1)

async function open() {
  collapsed.value = false
  await nextTick()
  if (dialog.value?.isConnected && !dialog.value.open) dialog.value.showModal()
}
function collapse() {
  dialog.value?.close()
  collapsed.value = true
}
function choose(index: number) {
  if (busy.value || !entries.value.some(entry => entry.index === index)) return
  submitted.value = true
  emit('choose', index)
}
// A fresh server question supersedes the old window, including after undo.
watch(questionKey, () => {
  submitted.value = false
  void open()
}, { immediate: true, flush: 'post' })
// Allow retry after the shared request handler finishes, including failures.
watch(() => processing?.value, value => {
  if (value === false) submitted.value = false
})
onBeforeUnmount(() => dialog.value?.close())
</script>

<template>
  <Teleport to="body">
    <button v-if="collapsed" class="trigger-reminder" type="button" @click="open">
      {{ t('triggeredEffect.restore') }}
    </button>
    <dialog ref="dialog" class="trigger-dialog" :class="{ 'trigger-dialog--compact': compactLayout }" :aria-labelledby="titleId" :aria-describedby="descriptionId" @cancel.prevent="collapse">
      <header>
        <h2 :id="titleId">{{ t('triggeredEffect.title') }}</h2>
        <button type="button" class="collapse" @click="collapse">{{ t('triggeredEffect.inspect') }}</button>
      </header>
      <p :id="descriptionId" class="description">{{ t('triggeredEffect.description') }}</p>
      <p v-if="contextHtml" class="context" v-html="contextHtml"></p>
      <fieldset :disabled="busy" :aria-busy="busy">
        <template v-for="(group, groupIndex) in groupedEntries" :key="groupIndex">
          <div
            v-if="group.entries.length === 1 && group.entries[0].choice.tag === 'SkipTriggersButton'"
            class="skip-row"
          >
            <button type="button" class="skip" @click="choose(group.entries[0].index)">
              {{ t('triggeredEffect.skip') }}
            </button>
          </div>
          <div v-else class="trigger-entry" :class="{ 'trigger-entry--card': group.image }">
            <img v-if="group.image" :src="group.image" :alt="t('triggeredEffect.card')" />
            <div class="entry-actions">
              <template v-for="entry in group.entries" :key="entry.index">
                <AbilityButton
                  v-if="entry.choice.tag === 'AbilityLabel'"
                  :game="game"
                  :ability="entry.choice"
                  tooltip-is-button-text
                  @click="choose(entry.index)"
                />
                <button v-else-if="entry.choice.tag === 'TargetLabel' && entry.image" type="button" @click="choose(entry.index)">
                  {{ t('triggeredEffect.play') }}
                </button>
                <QuestionChoices v-else :game="game" :choices="[[entry.choice, entry.index]]" @choose="choose" />
              </template>
            </div>
          </div>
        </template>
      </fieldset>
      <p class="hint">{{ t('triggeredEffect.hint') }}</p>
    </dialog>
  </Teleport>
</template>

<style scoped>
.trigger-dialog {
  position: fixed;
  inset: 0;
  margin: auto;
  box-sizing: border-box;
  width: min(560px, calc(100vw - 32px));
  max-height: calc(100dvh - 32px - env(safe-area-inset-top) - env(safe-area-inset-bottom));
  overflow: auto;
  overscroll-behavior: contain;
  padding: 22px;
  border: 1px solid #a58cba80;
  border-radius: 12px;
  background: radial-gradient(ellipse at top, #34313d 0%, #1b2425 65%);
  color: #eee5d2;
  box-shadow: 0 24px 80px #0009, inset 0 0 0 4px #ffffff03;
}
.trigger-dialog::backdrop { background: rgb(10 12 18 / 65%); }
.trigger-dialog--compact { width: min(360px, calc(100vw - 32px)); padding: 16px; }
/* A full-width skip row otherwise keeps unused auto-fit columns occupied. */
.trigger-dialog--compact fieldset { grid-template-columns: minmax(0, 1fr); }
.trigger-dialog--compact header { flex-wrap: wrap; gap: 8px; }
.trigger-dialog--compact h2 { font-size: 1rem; }
.trigger-dialog--compact .collapse { margin-left: auto; padding: 6px 10px; }
header { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
h2 { margin: 0; font-size: 1.1rem; font-weight: 500; letter-spacing: .04em; color: #dcc6ef; }
p { line-height: 1.6; }
.description { margin: 10px 0 18px; font-size: .85rem; font-weight: 400; color: #bbb4bd; }
.context { padding: 10px 12px; border-left: 2px solid #a58cba80; background: #ffffff05; font-size: .9rem; }
fieldset { border: 0; padding: 0; margin: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(min(200px, 100%), 1fr)); gap: 14px; min-width: 0; }
fieldset:disabled { opacity: .65; pointer-events: none; }
.trigger-entry {
  box-sizing: border-box;
  width: 100%;
  max-width: 280px;
  min-width: 0;
  margin-inline: auto;
  padding: 12px;
  border: 1px solid #a58cba30;
  border-radius: 9px;
  background: #10181980;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.trigger-entry img { display: block; width: min(100%, 210px); height: auto; max-height: 294px; object-fit: contain; margin: auto; border-radius: 7px; box-shadow: 0 5px 16px #0006; }
.entry-actions { display: flex; flex-direction: column; gap: 8px; min-width: 0; margin-top: auto; }
.entry-actions :deep(button) {
  width: 100%;
  min-width: 0;
  min-height: 42px;
  margin: 0;
  padding: 8px 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: 1px solid #b8a0c660;
  border-radius: 6px;
  background: linear-gradient(180deg, #504158, #3b3043);
  color: #f4eaf5;
  font-size: .9rem;
  white-space: normal;
  overflow-wrap: anywhere;
  cursor: pointer;
}
.entry-actions :deep(button:hover:not(:disabled)) { border-color: #cbb0dd; filter: brightness(1.12); }
.entry-actions :deep(.button-label) { flex: 0 1 auto; padding: 0; white-space: normal; }
.entry-actions :deep(button::before) { flex: 0 0 auto; padding: 0; margin: 0; }
.skip-row { grid-column: 1 / -1; display: flex; justify-content: center; padding-top: 12px; border-top: 1px solid #a58cba25; }
.skip, .collapse {
  cursor: pointer;
  min-height: 40px;
  padding: 8px 14px;
  border: 1px solid #a58cba40;
  border-radius: 6px;
  background: transparent;
  color: #d0c5d4;
  font-size: .8rem;
  font-weight: 400;
}
.skip { min-width: 160px; }
.skip:hover, .collapse:hover { background: #ffffff08; border-color: #a58cba90; }
button:focus-visible, .entry-actions :deep(button:focus-visible) { outline: 2px solid #e2c2ff; outline-offset: 3px; }
.collapse { flex-shrink: 0; }
.hint { margin: 12px 0 0; color: #9f9b96; font-size: .75rem; font-weight: 400; text-align: center; }
.trigger-reminder { position: fixed; bottom: calc(84px + env(safe-area-inset-bottom)); left: 50%; transform: translateX(-50%); z-index: 1100; padding: 10px 18px; border: 1px solid #a58cba; border-radius: 8px; background: #342d3c; color: #eee5d2; box-shadow: 0 4px 24px #0008; cursor: pointer; }
@media (max-width: 600px) {
  .trigger-dialog { padding: 16px; }
  header { align-items: flex-start; gap: 8px; }
  h2 { font-size: 1rem; }
  .trigger-entry img { max-height: 32dvh; }
}
</style>
