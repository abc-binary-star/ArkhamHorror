<script lang="ts" setup>
import { CircleCheck, SkipForward, Layers, Coins, Search } from '@lucide/vue'
import { useSettings } from '@/stores/settings';
import { storeToRefs } from 'pinia';
import { onUnmounted, onMounted, computed, inject, ref, watch } from 'vue'
import Draggable from '@/components/Draggable.vue';
import CardView from '@/arkham/components/Card.vue';
import Modifiers from '@/arkham/components/Modifiers.vue';
import PendingDamageTokens from '@/arkham/components/PendingDamageTokens.vue';
import { useDebug } from '@/arkham/debug'
import { ForwardIcon, PaperClipIcon } from '@heroicons/vue/20/solid'
import type { Game } from '@/arkham/types/Game'
import { imgsrc } from '@/arkham/helpers'
import { cardArt, cardImage, portraitImage, sourceCardCode } from '@/arkham/cardImages'
import * as ArkhamInvestigator from '@/arkham/types/Investigator'
import type { AbilityLabel, AbilityMessage, Message } from '@/arkham/types/Message'
import { MessageType } from '@/arkham/types/Message'
import { cardId, toCardContents } from '@/arkham/types/Card'
import SealedChaosTokens from '@/arkham/components/SealedChaosTokens.vue';
import AbilityButton from '@/arkham/components/AbilityButton.vue'
import { useMenu } from '@/arkham/composables/menu';
import { useI18n } from 'vue-i18n';
import useEmitter from '@/arkham/composables/useEmitter';
import useHighlighter from '@/arkham/composables/useHighlighter';
import Resources from '@/arkham/components/Resources.vue';
import Draw from '@/arkham/components/Draw.vue';
import InvestigatorUndo from '@/arkham/components/InvestigatorUndo.vue';
import { IsMobile } from '@/arkham/isMobile';
import {
  undoControlsKey,
  skipAllAvailableKey,
  skipAllInProgressKey,
  skipAllTriggersKey,
  soloKey,
} from '@/arkham/injectionKeys';
const { t } = useI18n();
const undoControls = inject(undoControlsKey);

export interface Props {
  choices: readonly Message[]
  investigator: ArkhamInvestigator.Investigator
  playerId: string
  game: Game
  portrait?: boolean
}

const props = withDefaults(defineProps<Props>(), { portrait: false })
const emit = defineEmits(['showCards', 'hideCards', 'choose'])

const id = computed(() => props.investigator.id)
const highlighter = useHighlighter()
const isHighlighted = computed(() => highlighter.highlighted.value === props.investigator.id)
const isAttackTarget = computed(() => props.game.enemyAttackTargets.some((e) => e.target.contents === props.investigator.id))
const debug = useDebug()
const choose = (idx: number) => emit('choose', idx)

function clicked() {
  emit('choose', investigatorAction.value)
}

const { addEntry, removeEntry } = useMenu()
const settingsStore = useSettings()
const { toggleShowBonded } = settingsStore
const { showBonded } = storeToRefs(settingsStore)
const { isMobile } = IsMobile();

const doShowBonded = computed(() => {
  return showBonded.value && props.playerId == props.investigator.playerId
})

watch(() => props.playerId, () => {
  if (!props.portrait) {
    if (props.playerId == props.investigator.playerId) {
      addEntry({
        id: `viewBonded-${props.investigator.playerId}`,
        icon: PaperClipIcon,
        content: t('gameBar.viewBonded'),
        shortcut: "b",
        nested: 'view',
        action: () => toggleShowBonded()
      })
    } else {
      removeEntry(`viewBonded-${props.investigator.playerId}`)
    }
  }
}, { immediate: true })

function canActivateAbility(c: Message): boolean {
  if (c.tag  === MessageType.ABILITY_LABEL) {
    if ("contents" in c.ability.source) {
      return c.ability.source.contents === id.value
    }
  }
  return false
}
const activateAbilityAction = computed(() => props.choices.findIndex(canActivateAbility))

const labelAction = computed(() => {
  return props.choices
    .findIndex((c) => c.tag === MessageType.TARGET_LABEL
      && c.target.tag === "InvestigatorTarget" && c.target.contents === id.value)
})

const investigatorAction = computed(() => {
  if (labelAction.value !== -1) {
    return labelAction.value
  }

  return activateAbilityAction.value
})

const choices = computed(() => props.choices)

// Keep spent actions as invisible slots so the shortcuts stay beside the
// full action row instead of sliding right each time an action is used.
const actionSlotCount = ref(3)
watch(
  () => [props.investigator.id, props.investigator.remainingActions + props.investigator.additionalActions.length] as const,
  ([investigatorId, count], previous) => {
    actionSlotCount.value = Math.max(previous?.[0] === investigatorId ? actionSlotCount.value : 3, count)
  },
  { immediate: true },
)
const spentActionSlots = computed(() => Math.max(0,
  actionSlotCount.value - props.investigator.remainingActions - props.investigator.additionalActions.length,
))

const basicActions = computed(() => {
  const canAct = props.playerId === props.investigator.playerId
  const draw = props.choices.findIndex(c => c.tag === 'ComponentLabel'
    && c.component.tag === 'InvestigatorDeckComponent'
    && c.component.investigatorId === id.value)
  const resource = props.choices.findIndex(c => c.tag === 'ComponentLabel'
    && c.component.tag === 'InvestigatorComponent'
    && c.component.tokenType === 'ResourceToken'
    && c.component.investigatorId === id.value)
  const investigate = props.choices.findIndex(c => c.tag === 'AbilityLabel'
    && c.ability.source.sourceTag !== 'ProxySource'
    && c.ability.source.tag === 'LocationSource'
    && c.ability.source.contents === props.investigator.location
    && c.ability.index === 103)
  return [
    { key: 'draw', icon: Layers, index: canAct ? draw : -1 },
    { key: 'resource', icon: Coins, index: canAct ? resource : -1 },
    { key: 'investigate', icon: Search, index: canAct ? investigate : -1 },
  ]
})

const hasActionsRemaining = computed(() =>
  props.investigator.remainingActions > 0 || props.investigator.additionalActions.length > 0)

function chooseBasicAction(index: number) {
  if (index >= 0) choose(index)
}

function isAbility(v: Message): v is AbilityLabel {
  if (v.tag !== MessageType.ABILITY_LABEL) {
    return false
  }

  const { source } = v.ability;

  if (source.sourceTag === 'ProxySource') {
    if ("contents" in source.source) {
      return source.source.contents === id.value
    }
  } else if (source.tag === 'InvestigatorSource') {
    return source.contents === id.value
  }

  return false
}

const abilities = computed(() => {
  return choices
    .value
    .reduce<AbilityMessage[]>((acc, v, i) => {
      if (isAbility(v)) {
        return [...acc, { contents: v, displayAsAction: false, index: i }];
      }

      return acc;
    }, []);
})

const endTurnAction = computed(() => {
  return props.choices
    .findIndex((c) => c.tag === MessageType.END_TURN_BUTTON && c.investigatorId === id.value);
})

// Two-step end turn: with actions still available a single click can waste
// them, so arm-then-confirm instead of ending immediately. With 0 actions the
// button behaves exactly as before.
const endTurnArmed = ref(false)
let endTurnArmTimer: ReturnType<typeof setTimeout> | null = null

const endTurnNeedsConfirm = computed(() => props.investigator.remainingActions > 0)

function disarmEndTurn() {
  endTurnArmed.value = false
  if (endTurnArmTimer) {
    clearTimeout(endTurnArmTimer)
    endTurnArmTimer = null
  }
}

const endTurnLabel = computed(() => {
  if (endTurnArmed.value) {
    return isMobile.value
      ? t('investigator.confirmEndTurnShort', { n: props.investigator.remainingActions })
      : t('investigator.confirmEndTurn', { n: props.investigator.remainingActions })
  }
  return isMobile.value ? t('investigator.endTurnShort') : t('investigator.endTurn')
})

function endTurn() {
  if (endTurnAction.value === -1) return
  if (endTurnNeedsConfirm.value && !endTurnArmed.value) {
    if (endTurnArmTimer) clearTimeout(endTurnArmTimer)
    endTurnArmed.value = true
    endTurnArmTimer = setTimeout(disarmEndTurn, 3000)
    return
  }
  disarmEndTurn()
  emit('choose', endTurnAction.value)
}

onUnmounted(disarmEndTurn)

const skipTriggersAction = computed(() => {
  return props.choices
    .findIndex((c) => c.tag === MessageType.SKIP_TRIGGERS_BUTTON && c.investigatorId === id.value);
})

const skipAllTriggers = inject(skipAllTriggersKey)
const skipAllAvailable = inject(skipAllAvailableKey)
const skipAllInProgress = inject(skipAllInProgressKey)
const solo = inject(soloKey)
const isCurrentPlayersInvestigator = computed(() => props.investigator.playerId === props.playerId)
const showSkipAll = computed(() => {
  if (solo?.value === true) {
    return skipTriggersAction.value !== -1 && skipAllAvailable?.value === true
  }

  return isCurrentPlayersInvestigator.value && skipAllAvailable?.value === true
})
// "Skip Triggers" skips only the current player's own window; it is greyed out
// when this investigator has no window of their own. "Skip All" (showSkipAll) is
// a separate button that handles the other players' windows.
const canSkipTriggers = computed(() => skipTriggersAction.value !== -1)

function skipTriggers() {
  if (skipTriggersAction.value === -1) return
  emit('choose', skipTriggersAction.value)
}

const investigatorClass = computed(() => {
  return ['c03006', 'c90087'].includes(props.investigator.cardCode) && props.investigator.meta !== 'Neutral' ? (props.investigator.meta ?? props.investigator.class) : props.investigator.class
})

const image = computed(() => {
  if (props.investigator.form.tag === 'YithianForm') {
    return imgsrc("cards/04244.avif");
  }

  if (props.investigator.form.tag === 'HomunculusForm') {
    return imgsrc("cards/11068b.avif");
  }

  if (props.investigator.form.tag === 'ShatteredForm') {
    return imgsrc("cards/10661.avif");
  }

  if (props.investigator.form.tag === "TransfiguredForm") {
    return cardImage(props.investigator.form.contents)
  }

  const mutated = props.investigator.mutated ? `_${props.investigator.mutated}` : ''
  const classVariant = ['c03006', 'c90087'].includes(props.investigator.cardCode) && props.investigator.meta !== 'Neutral' ? (props.investigator.meta ? `_${props.investigator.meta}` : '') : ''
  return cardImage(props.investigator.art, `${classVariant}${mutated}`)
})

const investigatorPortraitImage = computed(() => {
  const suffix = props.investigator.endedTurn ? 'b' : ''
  if (props.investigator.form.tag === "YithianForm" || props.investigator.form.tag === "HomunculusForm" || props.investigator.form.tag === "ShatteredForm") {
    return portraitImage(id.value, suffix)
  }

  return portraitImage(props.investigator.cardCode, suffix)
})

const miniCardDevoured = computed(() => {
  const devouredMiniCards = props.game.scenario?.meta?.devouredMiniCards
  return Array.isArray(devouredMiniCards) && devouredMiniCards.includes(id.value)
})

const replacementMiniCardInitials = computed(() => {
  const name = props.investigator.name.title
    .replace(/["“”']/g, '')
    .replace(/\([^)]*\)/g, '')
    .trim()
  const words = name.split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase()
})

const replacementMiniCardStyle = computed(() => ({
  '--replacement-class-color': `var(--${investigatorClass.value.toLowerCase()})`,
}))

const portraitClasses = computed(() => ({
  'investigator--can-interact--portrait': investigatorAction.value !== -1,
  ethereal: ethereal.value,
  dragging: dragging.value,
  captured: captured.value,
}))

const emitter = useEmitter()
const cardsUnderneath = computed(() => props.investigator.cardsUnderneath)
const cardsUnderneathLabel = computed(() => t('investigator.underneathCards', {count: cardsUnderneath.value.length}))
const devoured = computed(() => props.investigator.devoured)

onMounted(() => {
  emitter.on('showUnder', (id: string) => {
    if (id === props.investigator.id) {
      showCardsUnderneath(new Event('click'))
    }
  })
})

onUnmounted(() => {
  if (!props.portrait) removeEntry(`viewBonded-${props.investigator.playerId}`)
  emitter.off('showUnder')
})


const showCardsUnderneath = (e: Event) => emit('showCards', e, cardsUnderneath, "Cards Underneath", false)
const showDevoured = (e: Event) => emit('showCards', e, devoured, "Devoured", false)
const forcedShowUnder = ref(false)

watch(() => choices.value, () => {
  const isUnderChoice = (c: Message) => {
    if (c.tag !== "TargetLabel") return false
    if (c.target.tag !== "CardIdTarget") return false
    return props.investigator.cardsUnderneath.some(card => cardId(card) === c.target.contents)
  }
  const showUnder = choices.value.some(isUnderChoice)
  if (showUnder) {
    showCardsUnderneath(new Event('click'))
    forcedShowUnder.value = true
  } else {
    emit('hideCards')
    forcedShowUnder.value = false
  }
})

const modifiers = computed(() => props.investigator.modifiers)

const blankedModifier = computed(() => {
  return modifiers.value?.find(
    (m) =>
      m.type.tag === "Blank"
      || (m.type.tag === "OtherModifier" && m.type.contents === "Blank")
  ) ?? null
})

const isBlanked = computed(() => blankedModifier.value !== null)

const blankedCardCode = computed<string | null>(() => {
  const m = blankedModifier.value
  if (!m) return null
  if (m.card) return cardArt(toCardContents(m.card).cardCode)
  return sourceCardCode(m.source, props.game)
})

const captured = computed(() => {
  return modifiers.value?.some((m) => m.type.tag === "ScenarioModifier" && m.type.contents === "captured") ?? false
})

const ethereal = computed(() => {
  return modifiers.value?.some((m) => m.type.tag === "UIModifier" && m.type.contents === "Ethereal") ?? false
})

// While taking an immediate (granted) action there is no fast player window, so
// fast/free abilities can't be used. The engine marks this with AsIfTurn (see
// handlePlayerWindow), which reaches the client as an OtherModifier.
// Once the game is resolving an action (gameInAction), the choice has already
// been made, so there's nothing to warn about — hide the indicator then.
const isTakingImmediateAction = computed(() => {
  if (props.game.inAction) return false
  return modifiers.value?.some(
    (m) => m.type.tag === "OtherModifier" && m.type.contents === "AsIfTurn"
  ) ?? false
})

function useEffectAction(action: { contents: string[] }) {
  const choice = choices.value.findIndex((c) => c.tag === 'EffectActionButton' && c.effectId == action.contents[1])
  if (choice !== -1) {
    emit('choose', choice)
  }
}

function isActiveEffectAction(action: { tag?: "EffectAction"; contents: any }) {
  const choice = choices.value.findIndex((c) => c.tag === 'EffectActionButton' && c.effectId == action.contents[1])
  return choice !== -1
}

const skills = computed(() => {
  const st = props.game.skillTest
  const activeSkills = st ? new Set(st.skills) : null
  const action = st?.action

  const base = {
    SkillWillpower: props.investigator.willpower,
    SkillIntellect: props.investigator.intellect,
    SkillCombat: props.investigator.combat,
    SkillAgility: props.investigator.agility,
  }

  const baseOverride: Record<string, number|undefined> = {}
  const plus: Record<string, number> = {
    SkillWillpower: 0, SkillIntellect: 0, SkillCombat: 0, SkillAgility: 0
  }
  const finalSet: Record<string, number|undefined> = {}

  for (const m of (props.investigator.modifiers ?? [])) {
    const t = m.type
    switch (t.tag) {
      case 'BaseSkillOf':
        baseOverride[t.skillType] = t.value
        break
      case 'BaseSkill':
        if (activeSkills)
          for (const k of activeSkills) baseOverride[k] = t.contents
        break
      case 'SkillModifier':
        plus[t.skillType] += t.value
        break
      case 'AnySkillValue':
        if (activeSkills) for (const k of activeSkills) plus[k] += t.contents
        break
      case 'ActionSkillModifier':
        if (t.action === action) plus[t.skillType] += t.value
        break
      case 'SetSkillValue':
        finalSet[t.skillType] = t.value
        break
    }
  }

  const calc = (k:'SkillWillpower'|'SkillIntellect'|'SkillCombat'|'SkillAgility') =>
    Math.max(0, finalSet[k] ?? ((baseOverride[k] ?? base[k]) + plus[k]))

  return {
    willpower: calc('SkillWillpower'),
    intellect: calc('SkillIntellect'),
    combat: calc('SkillCombat'),
    agility: calc('SkillAgility'),
  }
})

const willpower = computed(() => skills.value.willpower)
const intellect = computed(() => skills.value.intellect)
const combat = computed(() => skills.value.combat)
const agility = computed(() => skills.value.agility)

const dragging = ref(false)
const showModifiers = ref(false)
function startDrag(event: DragEvent) {
  dragging.value = true
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', JSON.stringify({ "tag": "InvestigatorTarget", "contents": id.value }))
  }
}

function endDrag() { dragging.value = false }

const dragover = (e: DragEvent) => {
  e.preventDefault()
  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = 'move'
  }
}

function onDrop(event: DragEvent) {
  event.preventDefault()
  if (event.dataTransfer) {
    const data = event.dataTransfer.getData('text/plain')
    if (data) {
      const json = JSON.parse(data)
      if (json.tag === "KeyTarget") {
        debug.send(props.game.id, {tag: 'PlaceKey', contents: [{ tag: "InvestigatorTarget", contents: id.value }, json.contents]})
      }

      if (json.tag === "EnemyTarget") {
        debug.send(props.game.id, {tag: 'EngageMessage', contents: {tag: 'EnemyEngageInvestigator_', contents: [json.contents, id.value]}})
      }
    }
  }
}

const heartInjury = computed(() => {
  return modifiers.value?.some((m) => m.type.tag === "ScenarioModifier" && m.type.contents === "heartInjury") ?? false
})

const diamondInjury = computed(() => {
  return modifiers.value?.some((m) => m.type.tag === "ScenarioModifier" && m.type.contents === "diamondInjury") ?? false
})

const clubInjury = computed(() => {
  return modifiers.value?.some((m) => m.type.tag === "ScenarioModifier" && m.type.contents === "clubInjury") ?? false
})

const spadeInjury = computed(() => {
  return modifiers.value?.some((m) => m.type.tag === "ScenarioModifier" && m.type.contents === "spadeInjury") ?? false
})
</script>

<template>
  <div v-if="portrait" class="portrait-container">
    <span v-if="isMobile">
      <i class="action" v-for="n in investigator.remainingActions" :key="n"></i>
      <template v-for="action in investigator.additionalActions" :key="action">
        <button @click="useEffectAction(action)" v-if="action.tag === 'EffectAction'" v-tooltip="action.contents[0]" :class="[{ activeButton: isActiveEffectAction(action)}, `${investigatorClass.toLowerCase()}ActionButton`]">
          <i class="action"></i>
        </button>
        <i v-else class="action" :class="`${investigatorClass.toLowerCase()}Action`"></i>
      </template>
    </span>
    <span
      v-if="isMobile && isTakingImmediateAction"
      class="no-free-abilities"
      v-tooltip="{ content: $t('investigator.freeAbilitiesUnavailable'), html: true }"
    >
      <span class="fast-icon"></span>
      <svg class="no-sign" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <line x1="5" y1="5" x2="19" y2="19" />
      </svg>
    </span>
    <div
      v-if="miniCardDevoured"
      class="portrait portrait--replacement-marker portrait--devoured-mini-card"
      :class="portraitClasses"
      :style="replacementMiniCardStyle"
      :draggable="debug.active"
      v-tooltip="investigator.name.title"
      @click="clicked"
      @dragstart="startDrag($event)"
      @dragstop="endDrag"
      @drop="onDrop($event)"
      @dragover.prevent="dragover($event)"
      @dragenter.prevent
    >
      {{ replacementMiniCardInitials }}
      <img class="portrait--blob-overlay" :src="imgsrc('extra/the-blob-that-ate-everything/blob-overlay.png')" alt="" aria-hidden="true" />
    </div>
    <img
      v-else
      :src="investigatorPortraitImage"
      class="portrait"
      :class="[portraitClasses, `portrait--${investigatorClass.toLowerCase()}`]"
      :draggable="debug.active"
      @click="clicked"
      @dragstart="startDrag($event)"
      @dragstop="endDrag"
      @drop="onDrop($event)"
      @dragover.prevent="dragover($event)"
      @dragenter.prevent
    />
  </div>
  <div v-else class="player-container">
    <div class="player-area">
      <div class="player-card">
        <div class="investigator-header" :class="{ 'investigator-header--mobile': isMobile }">
        <div class="stats">
          <div class="willpower willpower-icon">{{willpower}}</div>
          <div class="intellect intellect-icon">{{intellect}}</div>
          <div class="combat combat-icon">{{combat}}</div>
          <div class="agility agility-icon">{{agility}}</div>
        </div>
              <span v-if="!isMobile" class="basic-actions">
                <button
                  v-for="basicAction in basicActions"
                  :key="basicAction.key"
                  type="button"
                  class="basic-action"
                  :class="{ 'basic-action--ready': hasActionsRemaining && basicAction.index !== -1 }"
                  v-tooltip="t(`investigator.basicActions.${basicAction.key}`)"
                  :aria-label="t(`investigator.basicActions.${basicAction.key}`)"
                  :disabled="basicAction.index === -1"
                  :data-game-actionable="basicAction.index !== -1 || undefined"
                  @click.stop="chooseBasicAction(basicAction.index)"
                ><component :is="basicAction.icon" aria-hidden="true" /></button>
              </span>
            <span v-if="!isMobile" class="action-container">
              <i class="spade" v-if="spadeInjury"></i>
              <i class="heart" v-if="heartInjury"></i>
              <i class="diamond" v-if="diamondInjury"></i>
              <i class="club" v-if="clubInjury"></i>
              <i class="action" v-for="n in investigator.remainingActions" :key="n"></i>
              <template v-for="action in investigator.additionalActions" :key="action">
                <button @click="useEffectAction(action)" v-if="action.tag === 'EffectAction'" v-tooltip="action.contents[0]" :class="[{ activeButton: isActiveEffectAction(action)}, `${investigatorClass.toLowerCase()}ActionButton`]">
                  <i class="action"></i>
                </button>
                <i v-else class="action" :class="`${investigatorClass.toLowerCase()}Action`"></i>
              </template>
              <i v-for="n in spentActionSlots" :key="`spent-${n}`" class="action action--spent-slot" aria-hidden="true"></i>
              <span
                v-if="isTakingImmediateAction"
                class="no-free-abilities"
                v-tooltip="{ content: $t('investigator.freeAbilitiesUnavailable'), html: true }"
              >
                <span class="fast-icon"></span>
                <svg class="no-sign" viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="5" y1="5" x2="19" y2="19" />
                </svg>
              </span>
            </span>
        </div>
        <div class="investigator-image">
          <img
            :class="{ 'investigator--can-interact': investigatorAction !== -1, 'ability-target': isHighlighted || isAttackTarget }"
            class="card card--sideways"
            :src="image"
            @click="clicked"
            @drop="onDrop($event)"
            @dragover.prevent="dragover($event)"
            @dragenter.prevent
          />
          <span v-if="isBlanked" class="blanked-badge" :data-image-id="blankedCardCode"><font-awesome-icon icon="ban" /></span>
          <PendingDamageTokens
            v-if="!portrait"
            :game="game"
            :playerId="investigator.playerId"
            class="investigator-pending-tokens"
          />
          <div v-if="investigator.sealedChaosTokens.length > 0" class="sealed">
            <SealedChaosTokens
              :tokens="investigator.sealedChaosTokens"
              :game="game"
              :playerId="playerId"
              @choose="choose"
            />
          </div>
        </div>
      </div>
      <div>
        <div class="player-buttons">
          <div class="button-group" :class="{ 'button-group--skip-all-pending': isCurrentPlayersInvestigator && skipAllInProgress }">
            <div class="investigator-controls">
            <template v-if="debug.active">
              <button
                @click.exact="debug.send(game.id, {tag: 'GainActions', contents: [id, {tag: 'TestSource', contents: []}, 1]})"
                @click.shift="debug.send(game.id, {tag: 'GainActions', contents: [id, {tag: 'TestSource', contents: []}, 5]})"
              >+</button>
            </template>
            <AbilityButton
              v-for="ability in abilities"
              :key="ability.index"
              :ability="ability.contents"
              :game="game"
              @click="$emit('choose', ability.index)"
              />
            <InvestigatorUndo v-if="undoControls && isCurrentPlayersInvestigator" />
            <button
            class="end-turn-button"
            :class="{ active: endTurnAction !== -1 && investigator.remainingActions <= 0, armed: endTurnArmed }"
            :disabled="endTurnAction == -1"
            :data-game-actionable="endTurnAction !== -1 || undefined"
            @click="endTurn"
            ><CircleCheck class="table-action-icon" aria-hidden="true" />{{ endTurnLabel }}</button>

            <button
              v-if="devoured && devoured.length > 0"
              @click="showDevoured"
            >{{ $t('investigator.devouredCards', {count: devoured.length}) }}</button>

            <span class="skip-triggers-group" :class="{ 'skip-triggers-group--paired': showSkipAll }">
              <button
                :disabled="!canSkipTriggers || skipAllInProgress"
                :data-game-actionable="canSkipTriggers && !skipAllInProgress || undefined"
                @click="skipTriggers"
                class="skip-triggers-button"
              ><SkipForward class="table-action-icon" aria-hidden="true" />{{ isMobile ? t('skip') : $t('investigator.skipTriggers') }}</button>
              <button
                v-if="showSkipAll"
                @click="skipAllTriggers && skipAllTriggers()"
                class="skip-all-triggers-button"
                v-tooltip="$t('investigator.skipAllTriggers')"
                :aria-label="$t('investigator.skipAllTriggers')"
              ><ForwardIcon class="skip-all-triggers-icon" aria-hidden="true" /></button>
            </span>

            <button
              v-if="debug && debug.active && (investigator.modifiers ?? []).length > 0"
              @click="showModifiers = true"
              >{{ $t('investigatorRow.showModifiers') }}</button>

            <Modifiers v-if="investigator.modifiers && showModifiers" :game="game" :modifiers="investigator.modifiers" @close="showModifiers = false" />

            <button v-if="cardsUnderneath.length > 0" class="view-discard-button" @click="showCardsUnderneath">{{cardsUnderneathLabel}}</button>
            </div>
          </div>
          <Draw
            v-if="isMobile"
            :game="game"
            :playerId="playerId"
            :investigator="investigator"
            @choose="$emit('choose', $event)"
          />
        </div>
        <Resources
          v-if="isMobile"
          :game="game"
          :investigator="investigator"
          :choices="choices"
          :playerId="playerId"
          @choose="$emit('choose', $event)"
        />
      </div>
    </div>
    <Resources
      v-if="!isMobile"
      :game="game"
      :investigator="investigator"
      :choices="choices"
      :playerId="playerId"
      @choose="$emit('choose', $event)"
    />

    <Draggable v-if="doShowBonded" atmosphere="support">
      <template #handle><header><h2>{{$t('gameBar.bonded')}}</h2></header></template>
      <div class="card-row-cards">
        <div v-for="card in investigator.bondedCards" :key="cardId(card)" class="card-row-card">
          <CardView :game="game" :card="card" :playerId="playerId" />
        </div>
      </div>
      <button class="close button" @click="toggleShowBonded">{{$t('close')}}</button>
    </Draggable>
  </div>
</template>

<style scoped>
.investigator-controls { display: contents; }
.table-action-icon { width: 14px; height: 14px; margin-right: 5px; vertical-align: -2px; }
.investigator-header {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  flex: 0 0 auto;
  gap: 6px;
  width: 100%;
  margin: 0;
  padding: 0;
  line-height: 1;
}
.investigator-header--mobile { display: contents; }
.investigator-header > .stats { flex: 0 0 auto; }
.investigator-header > .action-container {
  display: inline-flex;
  align-items: center;
  flex: 0 0 auto;
  gap: 3px;
  margin: 0;
  padding: 0;
  line-height: 1;
}
.investigator-header > .action-container button {
  box-sizing: border-box;
  min-height: 0;
  height: 24px;
  padding: 0 3px;
  line-height: 1;
}
.basic-actions {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  margin-left: auto;
  margin-right: 6px;
  flex-shrink: 0;
  vertical-align: middle;
}
.basic-actions .basic-action {
  box-sizing: border-box;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  min-width: 0;
  min-height: 0;
  height: 24px;
  padding: 3px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  box-shadow: none;
  color: #fff;
  cursor: pointer;
}
.basic-actions .basic-action:disabled { color: #fff; opacity: 0.65; cursor: default; }
.basic-actions .basic-action:hover:not(:disabled) { color: #fff; background: var(--surface-raised); }
.basic-actions .basic-action:focus-visible { outline: 2px solid var(--select); outline-offset: 1px; }
.basic-actions .basic-action--ready { color: var(--ability-ready-edge); background: rgb(236 217 160 / 0.14); }
.basic-actions .basic-action--ready:hover:not(:disabled) { color: var(--ability-ready-edge-hover); background: rgb(236 217 160 / 0.26); }
.basic-action svg { width: 18px; height: 18px; }
.action--spent-slot { visibility: hidden; pointer-events: none; }
i.action {
  font-family: 'Arkham';
  font-style: normal;
  font-weight: normal;
  font-variant: normal;
  text-transform: none;
  line-height: 1;
  -webkit-font-smoothing: antialiased;
  position: relative;
  color: #EEE;

  &:before {
    font-family: "Arkham";
    content: "\0049";
  }
}

/* "no free abilities" indicator: the fast/free trigger glyph with a red
   prohibition slash, shown while taking an immediate (granted) action. */
.no-free-abilities {
  position: relative;
  display: inline-flex;
  align-items: center;
  margin-left: 6px;
  cursor: help;
  line-height: 1;
}

.no-free-abilities :deep(.fast-icon) {
  font-size: 15px;
  color: #cfcfd6;
}

.no-free-abilities :deep(.fast-icon)::before {
  margin-right: 0;
}

.no-free-abilities .no-sign {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 20px;
  height: 20px;
  transform: translate(-55%, -50%);
  pointer-events: none;
}

.no-free-abilities .no-sign circle,
.no-free-abilities .no-sign line {
  fill: none;
  stroke: #e0454d;
  stroke-width: 2.2;
}

.investigator--can-interact,
.investigator--can-interact--portrait {
  border: 2px solid var(--ability-ready-edge);
  box-shadow: var(--ability-ready-shadow);
  transition: border-color 180ms ease, box-shadow 180ms ease;

  &:is(:hover, :focus-visible) {
    border-color: var(--ability-ready-edge-hover);
    box-shadow: var(--ability-ready-hover-shadow);
  }
  border-radius: 2px;
  cursor: pointer;
}


.investigator--can-interact--portrait {
  cursor: pointer;
  border-width: 3px;
}

.card {
  width: auto;
  height: var(--card-width);
}

.guardianAction {
  color: var(--guardian-extra-dark) !important;
}

.survivorAction {
  color: var(--survivor-extra-dark) !important;
}

.mysticAction {
  color: var(--mystic-extra-dark) !important;
}

.seekerAction {
  color: var(--seeker-extra-dark) !important;
}

.rogueAction {
  color: var(--rogue-extra-dark) !important;
}

.neutralAction {
  color: var(--neutral) !important;
}

.guardianActionButton {
  background-color: var(--guardian) !important;
  border: 0;
  border-radius: 2px;
  margin: 0 2px;
}

.seekerActionButton {
  background-color: var(--seeker) !important;
  border: 0;
  border-radius: 2px;
  margin: 0 2px;
}

.rogueActionButton {
  background-color: var(--rogue) !important;
  border: 0;
  border-radius: 2px;
  margin: 0 2px;
}

.mysticActionButton {
  background-color: var(--mystic) !important;
  border: 0;
  border-radius: 2px;
  margin: 0 2px;
}

.survivorActionButton {
  background-color: var(--survivor) !important;
  border: 0;
  border-radius: 2px;
  margin: 0 2px;
}

.neutralActionButton {
  background-color: var(--neutral) !important;
  border: 0;
  border-radius: 2px;
  margin: 0 2px;
}

.player-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  width: min-content;

  @media (max-width: 800px) and (orientation: portrait) {
    width: 48%;
    display: flex;
    flex-direction: row;
    gap: 2px;

    :deep(.card) {
      width: auto;
      height: calc(var(--card-width) * 3);
    }
  }
}

.portrait-container{
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  flex-direction: column;
  overflow: visible;
  :deep(span) {
    height: 0.87rem;
    overflow: visible;
    z-index: var(--z-index-10);
  }
  :deep(.action) {
    font-size: 0.35rem;
  }
}

.portrait {
  border-radius: 3px;
  width: calc(var(--card-width) * 0.6);
}

.portrait--replacement-marker {
  aspect-ratio: 2 / 3;
  border: 2px dashed color-mix(in srgb, var(--replacement-class-color) 70%, white);
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--replacement-class-color) 82%, black), var(--replacement-class-color));
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: calc(var(--card-width) * 0.24);
  font-weight: 800;
  letter-spacing: 0.04em;
  text-shadow: 0 1px 2px rgb(0 0 0 / 75%);
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / 20%);
  box-sizing: border-box;
  user-select: none;
}

.portrait--devoured-mini-card {
  position: relative;
  overflow: visible;
}

.portrait--blob-overlay {
  position: absolute;
  inset: -2px;
  width: calc(100% + 4px);
  height: calc(100% + 4px);
  border-radius: inherit;
  pointer-events: none;
}

.supplies {
  & ul {
    display: flex;
    flex-direction: row;
    list-style: none;
  }
}

.stats {
  display: inline-flex;
  width: max-content;
  border-radius: 5px;
  overflow: hidden;

  > div {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.06rem;
    padding-inline: 0.36rem;
    white-space: nowrap;
  }

  > div + div::after {
    content: "";
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 1px;
    background: rgba(255, 255, 255, 0.22);
  }

  @media (max-width: 800px) and (orientation: portrait) {
    display: flex;
    flex-direction: column;
    width: max-content;

    > div {
      padding-inline: 0.36rem;
    }

    > div + div::after {
      left: 0;
      right: 0;
      top: 0;
      bottom: auto;
      width: auto;
      height: 1px;
    }
  }

}

.willpower {
  background-color: var(--guardian-dark);
  color: white;
  text-align: center;
  border-top-left-radius: 5px;

  @media (max-width: 800px) and (orientation: portrait) {
    border-top-right-radius: 5px;
  }
}

.intellect {
  background-color: var(--mystic-dark);
  color: white;
  text-align: center;
}

.combat {
  background-color: var(--survivor-dark);
  color: white;
  text-align: center;
}

.agility {
  background-color: var(--rogue-dark);
  color: white;
  text-align: center;
  border-top-right-radius: 5px;

  @media (max-width: 800px) and (orientation: portrait) {
    border-top-right-radius: 0;
    border-bottom-left-radius: 5px;
    border-bottom-right-radius: 5px;
  }
}

.activeButton {
  border: 1px solid var(--select);
}

@keyframes become-ghost {
  100% {
    filter: drop-shadow(0px 0 20px #FF0099) invert(75%);
  }
}

@keyframes ghost {
  0% {
    filter: drop-shadow(0px 0 20px #FF0099) invert(75%);
  }

  50% {
    filter: drop-shadow(0px 0 10px #FF0099) invert(70%);
  }

  100% {
    filter: drop-shadow(0px 0 20px #FF0099) invert(75%);
  }
}

@keyframes rotate {
  100% {
    transform: rotate(-360deg);
  }
}

.ethereal {
  height: fit-content;
  will-change: filter;
  transition: filter .2s ease-out;
  animation-direction: forwards;
  animation: become-ghost 1s linear, ghost 3s linear 1s infinite;
}

.player-container{
  display: flex;
  flex-direction: column;
  gap: 2px;

  @media (max-width: 800px) and (orientation: portrait) {
    width: 100%;
  }
}

.player-area {
  display: flex;
}

.button-group {
  display: flex;
  flex-direction: column;
  gap: 2px;
  @media (max-width: 800px) and (orientation: portrait) {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
    :deep(button) {
      width: 100%;
      height: fit-content;
      font-size: small;
    }
  }
}

.button-group--skip-all-pending > :not(.skip-triggers-group) {
  opacity: 0.35;
  filter: grayscale(1);
  pointer-events: none;
}

.button-group--skip-all-pending .skip-triggers-button {
  opacity: 0.55;
  pointer-events: none;
}

.player-buttons {
  margin-left: 10px;
  display: flex;
  gap: 2px;
  flex-direction: column;

  @media (prefers-color-scheme: light) {
    color: #efefef;
  }
  @media (max-width: 800px) and (orientation: portrait) {
    margin-left: 0;
    flex-direction: row;
    align-items: flex-start;
    gap: 8px;
    :deep(img) {
      width: calc(var(--pool-token-width) * 1.2);
    }
  }
}

.skip-triggers-group {
  display: inline-flex;
  align-items: stretch;
}

.skip-triggers-button {
  transition: background 0.15s ease, color 0.15s ease;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #fff4dc;
  text-shadow: 0 1px 2px rgb(4 12 12 / 0.6);

  &[disabled] {
    background: transparent;
    color: #e5ddcd;
  }

  &:not([disabled]):hover {
    background: rgb(244 239 228 / 0.08);
    color: #fff;
  }
}

.end-turn-button {
  min-height: 34px;
  padding-inline: 16px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #fff4dc;
  font-family: Teutonic, Georgia, serif;
  font-size: 0.92rem;
  letter-spacing: 0.14em;
  text-shadow: 0 1px 2px rgb(4 12 12 / 0.6);
  transition: background 0.15s ease, color 0.15s ease;

  &:not(:disabled):hover {
    background: rgb(229 194 107 / 0.14);
    color: #fff;
  }

  &:not(:disabled):active {
    background: rgb(229 194 107 / 0.24);
  }

  &.active:not(:disabled) {
    background: linear-gradient(135deg, #654b77, #302439 60%, #57412b);
    color: #fff0c9;
    box-shadow:
      inset 0 0 0 1px #e4c78b,
      inset 0 0 0 3px rgb(24 17 30 / 70%),
      0 0 0 1px #302333,
      0 0 12px rgb(195 143 229 / 50%);
    text-shadow: 0 0 8px rgb(236 206 143 / 40%);

    &:is(:hover, :focus-visible) {
      background: linear-gradient(135deg, #80608f, #45314e 60%, #715535);
      color: #fff;
      outline: 2px solid #f0d49a;
      outline-offset: 2px;
    }
  }

  &.armed {
    background: rgb(196 104 98 / 0.22);
    color: #fff;
  }

  &:disabled {
    background: transparent;
    color: #e5ddcd;
  }
}

.skip-triggers-group--paired .skip-triggers-button {
  border-radius: 6px 0 0 6px;
}

.skip-all-triggers-button {
  transition: background 0.15s ease, color 0.15s ease;
  background: transparent;
  color: #fff4dc;
  border: 0;
  border-left: 1px solid rgb(244 239 228 / 0.16);
  border-radius: 0 6px 6px 0;
  padding-inline: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;

  &:hover {
    background: rgb(244 239 228 / 0.08);
    color: #fff;
  }
}

.skip-all-triggers-icon {
  width: 14px;
  height: 14px;
}

.investigator-pending-tokens {
  position: absolute;
  bottom: 6px;
  left: 6px;
  z-index: var(--z-index-10);
  pointer-events: none;
}

.investigator-image {
  position: relative;
  align-self: stretch;
  min-width: 0;

  > .card {
    display: block;
    width: 100%;
    min-width: 0;
    height: auto;
    border-radius: 5px;
  }

  @media (max-width: 800px) and (orientation: portrait) {
    width: auto;

    > .card {
      width: auto;
      min-width: 0;
      height: calc(var(--card-width) * 3);
    }
  }
}

.blanked-badge {
  position: absolute;
  right: 6px;
  bottom: 22px;
  width: 24px;
  height: 24px;
  color: #e05252;
  filter: drop-shadow(0 1px 4px rgba(0,0,0,0.7));
  cursor: default;
  z-index: var(--z-index-2);
  display: flex;
  align-items: center;
  justify-content: center;
}

img.card {
  transition: box-shadow 120ms ease;
}

img.card.ability-target {
  box-shadow: 0 0 0 2px var(--highlight), 0 0 6px 1px var(--highlight), var(--card-shadow);
}



.card-row-cards {
  display: flex;
  flex-direction: row;
  gap: 5px;
  flex-wrap: wrap;
  padding: 10px;
}

.close {
  width: 100%;
  background: var(--button-2);
  display: inline;
  border: 0;
  color: white;
  padding: 0.5em;
  text-transform: uppercase;

  &:hover {
    background: var(--button-2-highlight);
  }
}

.sealed {
  --sealed-token-image-width: 30px;
  position: absolute;
  left: 4px;
  top: calc(var(--card-width) / 2);
}

/* The fanned-open group reaches past the card, so lift the image above the
   buttons and cards that follow it. */
.investigator-image:has(.sealed-chaos-tokens--expanded) {
  z-index: var(--z-index-30000);
}

.captured {
  rotate: 90deg;
}

button.active {
  background: var(--select-dark-20);
  border-color: var(--select-dark-20);
  border-radius: 2px;
  border-style: solid;
  color: white;
}

i.spade {
  font-style: normal;
  font-weight: normal;
  font-variant: normal;
  text-transform: none;
  line-height: 1;
  -webkit-font-smoothing: antialiased;
  position: relative;
  color: #EEE;
  margin-right: 4px;
  filter: drop-shadow(0 0 2px white);

  &:before {
    content: "♠️";
  }
}

i.club {
  font-style: normal;
  font-weight: normal;
  font-variant: normal;
  text-transform: none;
  line-height: 1;
  -webkit-font-smoothing: antialiased;
  position: relative;
  color: #EEE;
  margin-right: 4px;
  filter: drop-shadow(0 0 2px white);

  &:before {
    content: "♣️";
  }
}

i.heart {
  font-style: normal;
  font-weight: normal;
  font-variant: normal;
  text-transform: none;
  line-height: 1;
  -webkit-font-smoothing: antialiased;
  position: relative;
  color: #EEE;
  margin-right: 4px;
  filter: drop-shadow(0 0 2px white);

  &:before {
    content: "♥️";
  }
}

i.diamond {
  font-style: normal;
  font-weight: normal;
  font-variant: normal;
  text-transform: none;
  line-height: 1;
  -webkit-font-smoothing: antialiased;
  position: relative;
  color: #EEE;
  margin-right: 4px;
  filter: drop-shadow(0 0 2px white);

  &:before {
    content: "♦️";
  }
}

@media (max-width: 800px), (max-width: 1199px) and (pointer: coarse) {

  .player-card { display: flex; flex-direction: column; align-items: stretch; width: min(100%, 320px); max-width: 100%; gap: 10px; }
  .player-card .investigator-image { width: min(100%, 240px); align-self: center; }
  .player-card .investigator-image > .card { display: block; width: 100%; height: auto; min-width: 0; }
  .player-card :deep(.card) { max-width: 100%; height: auto; }
  .player-buttons, .button-group, .investigator-controls { display: flex; flex-wrap: wrap; gap: 8px; width: 100%; }
  .player-buttons button { min-height: 44px; min-width: 44px; white-space: normal; font-size: 14px; }
  .end-turn-button, .skip-triggers-button { flex: 1 1 auto; }

}
</style>
