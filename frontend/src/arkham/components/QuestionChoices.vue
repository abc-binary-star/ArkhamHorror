<script lang="ts" setup>
import AbilityButton from '@/arkham/components/AbilityButton.vue'
import FormattedEntry from '@/arkham/components/FormattedEntry.vue'
import { MessageType, Message } from '@/arkham/types/Message';
import { formatContent } from '@/arkham/helpers';
import { handleEmbeddedI18n } from '@/arkham/i18n';
import { formatCost } from '@/arkham/cost';
import { useI18n } from 'vue-i18n';
import type { Game } from '@/arkham/types/Game';

defineProps<{
  game: Game
  choices: [Message, number][]
}>()

const emit = defineEmits<{
  (e: 'choose', value: number): void
}>()

const choose = (idx: number) => emit('choose', idx)
const connectionImage = (connection: string) => {
  const filename = connection === 'Equals' ? 'slash' : connection.toLowerCase()
  return `/img/arkham/connections/${filename}.svg`
}

const { t } = useI18n()
const label = function(body: string) {
  return formatContent(handleEmbeddedI18n(body, t))
}

const drownedCityTaskCards: Record<string, string> = {
  noPlaceLikeHome: '11753a',
  walkInFaith: '11754a',
  toeTheLine: '11755a',
  goodMoney: '11756a',
  proveYourWorth: '11757a',
  doNoHarm: '11758a',
  dreamsOfDestruction: '11759a',
  plumbTheDepths: '11760a',
}

const drownedCityTaskNames: Record<string, string> = {
  'No Place Like Home': 'noPlaceLikeHome',
  'Walk in Faith': 'walkInFaith',
  'Toe the Line': 'toeTheLine',
  'Good Money': 'goodMoney',
  'Prove Your Worth': 'proveYourWorth',
  'Do No Harm': 'doNoHarm',
  'Dreams of Destruction': 'dreamsOfDestruction',
  'Plumb the Depths': 'plumbTheDepths',
}

const drownedCityTaskKey = (body: string) => {
  const raw = body.trim()
  const i18nKey = raw.replace(/^\$/, '')
  const prefix = 'theDrownedCity.anOfferYouCantRefuse.label.'
  if (i18nKey.startsWith(prefix)) {
    const key = i18nKey.slice(prefix.length)
    return key in drownedCityTaskCards ? key : null
  }
  if (raw in drownedCityTaskCards) return raw

  const localized = handleEmbeddedI18n(body, t)
  return drownedCityTaskNames[localized] ?? null
}

const drownedCityTaskCardCode = (body: string) => {
  const key = drownedCityTaskKey(body)
  return key ? drownedCityTaskCards[key] : undefined
}

const drownedCityTaskRecommendation = (body: string) => {
  const key = drownedCityTaskKey(body)
  return key ? label(`$theDrownedCity.anOfferYouCantRefuse.recommended.${key}`) : null
}
</script>
<template>
  <div class='question-choices'>
    <template v-for="[choice, index] in choices" :key="index">
      <template v-if="choice.tag === MessageType.ABILITY_LABEL">
        <AbilityButton
          :ability="choice"
          :game="game"
          @click="choose(index)"
          />
      </template>
      <template v-else-if="choice.tag === MessageType.TARGET_LABEL">
        <button @click="choose(index)">{{ t('continue') }}</button>
      </template>
      <button
        v-else-if="choice.tag === MessageType.CONNECTION_LABEL"
        class="connection-choice"
        :aria-label="choice.connection"
        @click="choose(index)"
      >
        <img :src="connectionImage(choice.connection)" alt="" />
      </button>
      <template v-else-if="choice.tag === MessageType.TOOLTIP_LABEL">
        <button @click="choose(index)" v-tooltip="choice.tooltip">{{ t(choice.label) }}</button>
      </template>
      <div v-else-if="choice.tag === MessageType.LABEL" class="message-label">
        <button v-if="choice.label == 'Choose {skull}'" @click="choose(index)">
          Choose <i class="iconSkull"></i>
        </button>
        <button v-else-if="choice.label == 'Choose {cultist}'" @click="choose(index)">
          Choose <i class="iconCultist"></i>
        </button>
        <button v-else-if="choice.label == 'Choose {tablet}'" @click="choose(index)">
          Choose <i class="iconTablet"></i>
        </button>
        <button v-else-if="choice.label == 'Choose {elderThing}'" @click="choose(index)">
          Choose <i class="iconElderThing"></i>
        </button>
        <button
          v-else-if="drownedCityTaskCardCode(choice.label)"
          @click="choose(index)"
          class="task-choice"
        >
          <span class="choice-content">
            <span class="choice-label" v-html="label(choice.label)"></span>
            <span
              v-if="drownedCityTaskRecommendation(choice.label)"
              class="choice-subtext"
              v-html="drownedCityTaskRecommendation(choice.label)"
            ></span>
          </span>
        </button>
        <button v-else @click="choose(index)" v-html="label(choice.label)"></button>
      </div>
      <div v-else-if="choice.tag === MessageType.COST_LABEL" class="message-label">
        <button @click="choose(index)" v-html="label(formatCost(choice.cost, t))"></button>
      </div>
      <div
        v-else-if="choice.tag === MessageType.INVALID_LABEL"
        class="message-label"
      >
        <button
          v-if="drownedCityTaskCardCode(choice.label)"
          class="task-choice"
          disabled
        >
          <span class="choice-content">
            <span class="choice-label" v-html="label(choice.label)"></span>
            <span
              v-if="drownedCityTaskRecommendation(choice.label)"
              class="choice-subtext"
              v-html="drownedCityTaskRecommendation(choice.label)"
            ></span>
          </span>
        </button>
        <button v-else v-html="label(choice.label)" disabled></button>
      </div>
      <div v-else-if="choice.tag === MessageType.INFO" class="message-label">
        <FormattedEntry v-for="(entry, entryIndex) in choice.flavor.body" :key="entryIndex" :entry="entry" />
      </div>
      <div v-else-if="choice.tag === MessageType.DONE" class="message-label">
        <button @click="choose(index)" v-html="label(choice.label)"></button>
      </div>

      <a
        v-if="choice.tag === MessageType.SKILL_LABEL"
        class="button"
        role="button"
        tabindex="0"
        @click="choose(index)"
        @keydown.enter.prevent="choose(index)"
        @keydown.space.prevent="choose(index)"
      >
        Use <i :class="`icon${choice.skillType}`"></i>
      </a>

      <a
        v-if="choice.tag === MessageType.SKILL_LABEL_WITH_LABEL"
        class="button"
        role="button"
        tabindex="0"
        @click="choose(index)"
        @keydown.enter.prevent="choose(index)"
        @keydown.space.prevent="choose(index)"
      >
        Use <i :class="`icon${choice.skillType}`"></i>: {{ t(choice.label) }}
      </a>
    </template>
  </div>
</template>

<style scoped>

a.button {
  display: flex;
  background-color: var(--button);
  color: var(--text);
  border: var(--edge-width) solid var(--edge-dim);
  cursor: pointer;
  align-content: center;
  align-items: center;
  line-height: 1.2em;

  &:has(i.iconSkillCombat) {
    background-color: #8b0000;
    &:hover {
      background-color: #5a0000;
    }
  }
  &:has(i.iconSkillAgility) {
    background-color: #004d00;
    &:hover {
      background-color: #003300;
    }
  }
  &:has(i.iconSkillWillpower) {
    background-color: #00008b;
    &:hover {
      background-color: #00005a;
    }
  }
}

a.button:hover {
  background-color: var(--surface-panel);
  border-color: var(--spooky-green);
}

a.button:active {
  background-color: var(--panel-inset);
  border-color: var(--edge);
}

button, a.button {
  min-height: var(--control-height);
  background-color: var(--button);
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.08), rgba(0, 0, 0, 0.03)),
    url('/assets/veiled-harbour/C02-象牙档案纸微纹理.avif');
  background-size: 100% 100%, 256px 256px;
  background-repeat: no-repeat, repeat;
  border-radius: var(--control-radius);
  color: var(--button-text);
  font-size: 1em;
  font-weight: var(--font-bold);
  font-family: "Noto Sans", sans-serif;
  padding: 9px 12px;
  text-align: left;
  transition: transform 80ms ease, background-color 120ms ease, box-shadow 80ms ease, filter 120ms ease;
  white-space: break-spaces;
  width: 100%;
  display: flex;

  &:deep(strong) {
    display: contents;
    color: inherit;
  }

  &[disabled] {
    cursor: not-allowed;
    filter: var(--button-disabled-filter);
    opacity: 0.72;
  }

  &::before {
    font-family: "ArkhamIcons";
    content: "\E91A";
    margin-right: 10px;
    flex: 0 0 auto;
  }

  &.task-choice {
    align-items: flex-start;
    text-align: left;
  }
}

button:hover:not(:disabled),
a.button:hover {
  background-color: var(--button-highlight);
  border-color: var(--edge);
  filter: brightness(1.03);
  transform: translateY(-1px);
}

button:active:not(:disabled),
a.button:active {
  background-color: var(--panel-inset);
  transform: translate(1px, 1px);
  box-shadow: none;
}

button:focus-visible,
a.button:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}

.choice-content,
.choice-label {
  display: block;
}

.choice-content {
  flex: 1 1 auto;
}

.choice-subtext {
  color: #cfc6d8;
  display: block;
  font-size: 0.72em;
  font-weight: 600;
  line-height: 1.25;
  margin-top: 4px;
  text-transform: none;
}

.choice-subtext :deep(.guardian-icon)::before,
.choice-subtext :deep(.seeker-icon)::before,
.choice-subtext :deep(.rogue-icon)::before,
.choice-subtext :deep(.mystic-icon)::before,
.choice-subtext :deep(.survivor-icon)::before {
  display: inline-block;
  font-family: "Arkham";
  font-size: 1.1em;
  font-weight: normal;
  text-transform: none;
}

.choice-subtext :deep(.guardian-icon)::before { content: "\0051"; }
.choice-subtext :deep(.seeker-icon)::before { content: "\0045"; }
.choice-subtext :deep(.rogue-icon)::before { content: "\0054"; }
.choice-subtext :deep(.mystic-icon)::before { content: "\0057"; }
.choice-subtext :deep(.survivor-icon)::before { content: "\0052"; }

i {
  font-family: 'Arkham';
  font-style: normal;
  font-weight: normal;
  font-variant: normal;
  text-transform: none;
  line-height: 1;
  -webkit-font-smoothing: antialiased;
  position: relative;
}

i.iconSkull:before {
  content: "\004E";
}

i.iconCultist:before {
  content: "\0042";
}

i.iconTablet:before {
  content: "\0056";
}

i.iconElderThing:before {
  content: "\0043";
}

i.iconSkillWillpower:before {
  content: "\0041";
  font-size: 1.3em;
}

i.iconSkillIntellect:before {
  content: "\0046";
  font-size: 1.3em;
}

i.iconSkillCombat:before {
  content: "\0044";
  font-size: 1.3em;
}

i.iconSkillAgility:before {
  content: "\0053";
  font-size: 1.3em;
}

.question-choices > .connection-choice {
  align-items: center;
  background-color: var(--select-dark-30) !important;
  border: 1px solid rgb(255 255 255 / 14%);
  border-radius: 50% !important;
  box-shadow: 0 4px 12px rgb(0 0 0 / 22%);
  display: flex !important;
  flex: 0 0 5rem;
  height: 5rem;
  justify-content: center;
  min-height: 0;
  padding: 0 !important;
  transition: background-color 35ms linear, border-color 35ms linear, box-shadow 35ms linear, transform 35ms linear !important;
  width: 5rem;
}

.connection-choice::before {
  display: none;
}

.connection-choice img {
  filter: drop-shadow(0 2px 3px rgb(0 0 0 / 32%));
  height: 4.6rem;
  object-fit: contain;
  width: 4.6rem;
}

.connection-choice:hover {
  background-color: rgb(205, 24, 205) !important;
  border-color: #f8e4ac;
  box-shadow: 0 0 0 1px rgb(248 228 172 / 12%), 0 3px 8px rgb(0 0 0 / 24%);
  transform: translateY(-1px);
}

.connection-choice:active {
  box-shadow: 0 0 0 1px rgb(248 228 172 / 20%);
  transform: translateY(0) scale(0.97);
}

.question-choices {
  display: flex;
  gap: 10px;
  flex-direction: column;
}

.question-choices:has(> .connection-choice) {
  align-items: center;
  flex-direction: row;
  gap: 1rem !important;
  justify-content: center;
  padding: 1.25rem;
}

.question-choices:has(.question-label) {
  padding: 10px;
}

:deep(.message-label) {
  .agility-icon, .combat-icon, .intellect-icon, .willpower-icon {
    display: contents;
    &::before {
      display: contents;
    }
  }
}

@media (max-width: 800px), (max-width: 1199px) and (pointer: coarse) {

  .question-choices { display: flex; flex-direction: column; gap: 8px; min-width: 0; width: 100%; }
  .question-choices > button { min-height: 44px; width: 100%; padding: 12px; white-space: normal; text-align: left; overflow-wrap: anywhere; font-size: 15px; line-height: 1.5; }

}
</style>
