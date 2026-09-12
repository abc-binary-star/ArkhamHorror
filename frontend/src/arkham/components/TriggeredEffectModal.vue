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
    <dialog ref="dialog" class="trigger-dialog" :aria-labelledby="titleId" :aria-describedby="descriptionId" @cancel.prevent="collapse">
      <header>
        <h2 :id="titleId">{{ t('triggeredEffect.title') }}</h2>
        <button type="button" class="collapse" @click="collapse">{{ t('triggeredEffect.inspect') }}</button>
      </header>
      <p :id="descriptionId">{{ t('triggeredEffect.description') }}</p>
      <p v-if="contextHtml" class="context" v-html="contextHtml"></p>
      <fieldset :disabled="busy" :aria-busy="busy">
        <div v-for="entry in entries" :key="entry.index" class="trigger-entry" :class="{ 'trigger-entry--card': entry.image }">
          <img v-if="entry.image" :src="entry.image" :alt="t('triggeredEffect.card')" />
          <AbilityButton
            v-if="entry.choice.tag === 'AbilityLabel'"
            :game="game"
            :ability="entry.choice"
            tooltip-is-button-text
            @click="choose(entry.index)"
          />
          <button v-else-if="entry.choice.tag === 'SkipTriggersButton'" type="button" @click="choose(entry.index)">
            {{ t('triggeredEffect.skip') }}
          </button>
          <button v-else-if="entry.choice.tag === 'TargetLabel' && entry.image" type="button" @click="choose(entry.index)">
            {{ t('triggeredEffect.play') }}
          </button>
          <QuestionChoices v-else :game="game" :choices="[[entry.choice, entry.index]]" @choose="choose" />
        </div>
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
  width: min(680px, calc(100vw - 32px));
  max-height: calc(100dvh - 32px - env(safe-area-inset-top) - env(safe-area-inset-bottom));
  overflow: auto;
  overscroll-behavior: contain;
  padding: 24px;
  border: 1px solid #a58cba;
  border-radius: 12px;
  background: #202a29;
  color: #eee5d2;
  box-shadow: 0 24px 80px #0009;
}
.trigger-dialog::backdrop { background: rgb(10 12 18 / 55%); }
header { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
h2 { margin: 0; font-size: 1.3rem; color: #dcc6ef; }
p { line-height: 1.6; }
fieldset { border: 0; padding: 0; margin: 0; display: grid; gap: 12px; min-width: 0; }
fieldset:disabled { opacity: .65; pointer-events: none; }
.trigger-entry { min-width: 0; padding: 12px; border: 1px solid #a58cba45; border-radius: 8px; background: #141b1b; }
.trigger-entry--card { display: grid; grid-template-columns: minmax(100px, 160px) minmax(0, 1fr); gap: 16px; align-items: center; }
.trigger-entry img { width: 100%; max-height: 250px; object-fit: contain; border-radius: 6px; }
.trigger-entry :deep(button) { min-width: 0; min-height: 44px; white-space: normal; overflow-wrap: anywhere; }
.trigger-entry :deep(.button-label) { white-space: normal; }
button { cursor: pointer; min-height: 44px; padding: 10px 14px; border: 1px solid #a58cba; border-radius: 6px; background: #493959; color: #fff1df; }
button:focus-visible { outline: 2px solid #e2c2ff; outline-offset: 3px; }
.collapse { flex-shrink: 0; background: transparent; }
.hint { margin-bottom: 0; color: #c3bba9; font-size: .85rem; }
.trigger-reminder { position: fixed; bottom: calc(84px + env(safe-area-inset-bottom)); left: 50%; transform: translateX(-50%); z-index: 1100; box-shadow: 0 4px 24px #0008; }
@media (max-width: 600px) {
  .trigger-dialog { padding: 16px; }
  header { align-items: flex-start; gap: 8px; }
  .trigger-entry--card { grid-template-columns: minmax(85px, 115px) minmax(0, 1fr); gap: 10px; }
}
</style>
