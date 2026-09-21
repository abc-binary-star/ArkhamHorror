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
import { processingKey, phaseAnnouncementKey, uiLockKey, spectateKey } from '@/arkham/injectionKeys'
import AbilityButton from './AbilityButton.vue'
import QuestionChoices from './QuestionChoices.vue'

const props = defineProps<{ game: Game; playerId: string }>()
const emit = defineEmits<{ choose: [index: number] }>()
const { t } = useI18n()
const { t: responseText } = useI18n({ useScope: 'local', messages: {
  zh: { title: '可响应的卡牌', hint: '点击卡牌发动；同一张牌有多个能力时，点击后选择。', activate: '发动这张卡牌', select: '选择这张卡牌的能力', abilities: '{count} 个可用能力' },
  en: { title: 'Available responses', hint: 'Select a card to respond. Cards with several abilities let you choose one.', activate: 'Activate this card', select: 'Choose an ability on this card', abilities: '{count} available abilities' },
} })
const titleId = useId()
const expandedGroup = ref<string | null>(null)
const dialog = ref<HTMLDialogElement | null>(null)
const collapsed = ref(false)
const submitted = ref(false)
const processing = inject(processingKey)
const phaseAnnouncement = inject(phaseAnnouncementKey, ref(false))
const uiLock = inject(uiLockKey, ref(false))
const spectating = inject(spectateKey, ref(false))
const blocked = computed(() => phaseAnnouncement.value || uiLock.value || spectating.value)
const busy = computed(() => submitted.value || processing?.value === true || blocked.value)
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
// Group by entity identity, never by artwork: two copies of the same card may
// have different resources, exhaustion states and response costs.
function effectIdentity(source: Source): string {
  switch (source.sourceTag) {
    case 'AbilitySource': return effectIdentity(source.contents[0])
    case 'UseAbilitySource': return effectIdentity(source.contents[1])
    case 'PaymentSource': return effectIdentity(source.contents)
    case 'IndexedSource': return source.contents ? effectIdentity(source.contents[1]) : JSON.stringify(source)
    case 'ProxySource': return effectIdentity(effectCardCode(source.source) ? source.source : source.originalSource)
    case 'OtherSource': return `${source.tag.replace(/Source$/, '')}:${source.contents ?? ''}`
    default: return JSON.stringify(source)
  }
}
const promptInvestigator = computed(() => Object.values(props.game.investigators).find(i => i.playerId === props.playerId))
const entries = computed(() => {
  const investigator = promptInvestigator.value
  return choices(props.game, props.playerId).map((choice, index) => {
    let code: string | null = null
    let key = `choice:${index}`
    if (choice.tag === 'AbilityLabel') {
      code = effectCardCode(choice.ability.source)
      key = effectIdentity(choice.ability.source)
    }
    if (choice.tag === 'TargetLabel') {
      const id = typeof choice.target.contents === 'string' ? choice.target.contents : ''
      key = id ? `${choice.target.tag.replace(/Target$/, '')}:${id}` : `choice:${index}`
      const entity = choice.target.tag === 'AssetTarget' ? props.game.assets[id]
        : choice.target.tag === 'EnemyTarget' ? props.game.enemies[id] : undefined
      if (entity) code = `${entity.cardCode}${entity.flipped ? 'b' : ''}`
    }
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
    return { choice, index, key, image: code ? cardImage(code) : null }
  })
})
// Collect all abilities on one physical card, retaining server choice indices.
const groupedEntries = computed(() => {
  const groups: { key: string; image: string | null; entries: typeof entries.value }[] = []
  for (const entry of entries.value) {
    const group = entry.image ? groups.find(group => group.key === entry.key) : undefined
    if (group) {
      group.entries.push(entry)
    } else {
      groups.push({ key: entry.key, image: entry.image, entries: [entry] })
    }
  }
  return groups
})
const compactLayout = computed(() => groupedEntries.value.filter(group =>
  !group.entries.every(entry => entry.choice.tag === 'SkipTriggersButton')
).length <= 1)
const revealWindow = computed(() => props.game.skillTest?.step === 'SkillTestFastWindow2'
  && entries.value.some(entry => entry.choice.tag === 'SkipTriggersButton')
  && entries.value.every(({ choice }) => choice.tag === 'SkipTriggersButton'
    || (choice.tag === 'AbilityLabel' && choice.ability.type.tag === 'FastAbility'
      && choice.windows.length > 0 && choice.windows.every(window => window.windowType.tag === 'FastPlayerWindow'))))
function activateCard(group: typeof groupedEntries.value[number]) {
  if (busy.value) return
  if (group.entries.length === 1) choose(group.entries[0].index)
  else expandedGroup.value = expandedGroup.value === group.key ? null : group.key
}

async function open() {
  collapsed.value = false
  await nextTick()
  if (!blocked.value && !collapsed.value && dialog.value?.isConnected && !dialog.value.open) dialog.value.showModal()
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
  expandedGroup.value = null
  void open()
}, { immediate: true, flush: 'post' })
// Allow retry after the shared request handler finishes, including failures.
watch(() => processing?.value, value => {
  if (value === false) submitted.value = false
})
watch(blocked, value => {
  if (value) dialog.value?.close()
  else if (!collapsed.value) void open()
})
onBeforeUnmount(() => dialog.value?.close())
</script>

<template>
  <Teleport to="body">
    <button v-if="collapsed && !blocked" class="trigger-reminder" type="button" @click="open">
      {{ t('triggeredEffect.restore') }}
    </button>
    <dialog ref="dialog" class="trigger-dialog" :aria-labelledby="titleId" :class="{ 'trigger-dialog--compact': compactLayout }" @cancel.prevent="collapse">
      <h2 :id="titleId">{{ responseText('title') }}</h2>
      <p class="collection-hint">{{ responseText('hint') }}</p>
      <p v-if="revealWindow" class="collection-hint">{{ t('cardOption.testFast.beforeDraw') }}</p>
      <p v-if="contextHtml" class="context" v-html="contextHtml"></p>
      <fieldset :disabled="busy" :aria-busy="busy">
        <template v-for="group in groupedEntries" :key="group.key">
          <div
            v-if="group.entries.length === 1 && group.entries[0].choice.tag === 'SkipTriggersButton'"
            class="skip-row"
          >
            <button type="button" class="skip" @click="choose(group.entries[0].index)">
              {{ t(revealWindow ? 'cardOption.testFast.reveal' : 'triggeredEffect.skip') }}
            </button>
          </div>
          <div v-else class="trigger-entry" :class="{ 'trigger-entry--card': group.image }">
            <button v-if="group.image" type="button" class="response-card" :disabled="busy"
              :aria-label="responseText(group.entries.length === 1 ? 'activate' : 'select')"
              :aria-expanded="group.entries.length > 1 ? expandedGroup === group.key : undefined"
              @click="activateCard(group)">
              <img :src="group.image" :alt="t('triggeredEffect.card')" />
              <span v-if="group.entries.length > 1" class="ability-count">{{ responseText('abilities', { count: group.entries.length }) }}</span>
            </button>
            <div v-if="!group.image || group.entries.length === 1 || expandedGroup === group.key" class="entry-actions">
              <div class="action-row">
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
          </div>
        </template>
      </fieldset>
      <footer><button type="button" class="collapse" @click="collapse">{{ t('triggeredEffect.inspect') }}</button></footer>
    </dialog>
  </Teleport>
</template>

<style scoped>
.trigger-dialog {
  position: fixed;
  inset: 0;
  margin: auto;
  box-sizing: border-box;
  width: min(920px, calc(100vw - 32px));
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
h2 { margin: 0; text-align: center; font-size: 1.15rem; color: #e2cba7; }
.collection-hint { font-size: .85rem; text-align: center; color: #c9bdcf; }
footer { display: flex; justify-content: center; margin-top: 14px; }
.response-card { position: relative; width: 100%; padding: 0; border: 2px solid transparent; border-radius: 9px; background: transparent; cursor: pointer; transition: border-color .15s, transform .15s; }
.response-card:hover:not(:disabled), .response-card[aria-expanded="true"] { border-color: #cbb0dd; transform: translateY(-2px); }
.ability-count { display: block; padding: 6px; font-size: .8rem; color: #eee5d2; }
.trigger-dialog--compact { width: min(360px, calc(100vw - 32px)); padding: 16px; }
/* A full-width skip row otherwise keeps unused auto-fit columns occupied. */
.trigger-dialog--compact fieldset { grid-template-columns: minmax(0, 1fr); }
/* One entry needs no inner frame; the dialog already draws the only box. */
.trigger-dialog--compact .trigger-entry { padding: 0; border: 0; background: transparent; }
p { line-height: 1.6; }
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
/* Button + 查看牌桌 share one line. */
.action-row { display: flex; flex-wrap: wrap; align-items: stretch; justify-content: center; gap: 8px; min-width: 0; }
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
/* Override the width:100% / white-space rules above for buttons sharing the row. */
.action-row :deep(button) { flex: 0 1 auto; width: auto; min-width: 0; max-width: 100%; }
.action-row :deep(.button-label) { min-width: 0; white-space: normal; overflow-wrap: anywhere; }
.action-row .collapse { flex-shrink: 0; white-space: nowrap; }
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
.trigger-reminder { position: fixed; bottom: calc(84px + env(safe-area-inset-bottom)); left: 50%; transform: translateX(-50%); z-index: 1100; padding: 10px 18px; border: 1px solid #a58cba; border-radius: 8px; background: #342d3c; color: #eee5d2; box-shadow: 0 4px 24px #0008; cursor: pointer; }
@media (max-width: 600px) {
  .trigger-dialog { padding: 16px; }
  .trigger-entry img { max-height: 32dvh; }
}

/* Response window: silver paper and amethyst controls. */
.trigger-dialog {
  background: #e0dfe8 url('@/assets/veiled-harbour/arcane-silver-v1.png') center / 100% 100% no-repeat;
  color: #363143;
  border-color: #8f819e;
  box-shadow: inset 0 0 0 3px #f2eff46b, 0 24px 80px #0009;
}
.trigger-dialog h2 { color: #514060; font-family: 'Source Han Serif', Arno, serif; }
.collection-hint { color: #665d73; }
.context { background: #5340660a; border-left-color: #8c749e; }
.trigger-entry { background: #f6f3fa80; border-color: #8e7aa34d; }
.ability-count { color: #534060; }
.skip, .collapse { color: #574562; border-color: #8e7aa380; background: #f5f0f780; }
.skip:hover, .collapse:hover { background: #d8cee1; border-color: #786087; }
.action-row .collapse { color: #f4eaf5; }
.trigger-dialog button:focus-visible,
.entry-actions :deep(button:focus-visible) { outline-color: #78558f; }
.response-card:hover:not(:disabled), .response-card[aria-expanded="true"] { border-color: #78558f; }

</style>
