<script lang="ts" setup>
import { ComputedRef, computed, ref, watch } from 'vue'
import { Dropdown } from 'floating-vue'
import { useCardStore } from '@/stores/cards'
import { type Game } from '@/arkham/types/Game'
import { type Card, cardImagePath, asCardCode, toCardContents } from '@/arkham/types/Card'
import AbilitiesMenu from '@/arkham/components/AbilitiesMenu.vue'
import AbilityButton from '@/arkham/components/AbilityButton.vue'
import { useDebug } from '@/arkham/debug'
import PoolItem from '@/arkham/components/PoolItem.vue'
import KeyToken from '@/arkham/components/Key.vue'
import Treachery from '@/arkham/components/Treachery.vue'
import Enemy from '@/arkham/components/Enemy.vue'
import Asset from '@/arkham/components/Asset.vue'
import ScarletKey from '@/arkham/components/ScarletKey.vue'
import Story from '@/arkham/components/Story.vue'
import StackIndicator from '@/arkham/components/StackIndicator.vue'
import StackHistoryCard from '@/arkham/components/StackHistoryCard.vue'
import StackPips from '@/arkham/components/StackPips.vue'
import CardsUnderIndicator from '@/arkham/components/CardsUnderIndicator.vue'
import * as ArkhamGame from '@/arkham/types/Game'
import { AbilityLabel, AbilityMessage, type Message } from '@/arkham/types/Message'
import { MessageType } from '@/arkham/types/Message'
import type { Ability } from '@/arkham/types/Ability'
import { keyToId } from '@/arkham/types/Key'
import { cardImg, imgsrc } from '@/arkham/helpers'
import { resolvedSideArt } from '@/arkham/cardImages'
import * as ArkhamAct from '@/arkham/types/Act'
import { useEventStore } from '@/arkham/stores/event'
import { actContribution, actSpend } from '@/arkham/types/EpicEvent'
import { useCardFlip } from '@/arkham/composables/useCardFlip'
import { useHistoryDrag } from '@/arkham/composables/useHistoryDrag'

const props = defineProps<{
  act: ArkhamAct.Act
  game: Game
  cardsUnder: Card[]
  cardsNextTo: Card[]
  remainingStack: Card[]
  completedStack: Card[]
  playerId: string
  showClueBadge?: boolean
  hideStackControl?: boolean
  abilitiesBar?: string | null
}>()

const emits = defineEmits<{
  show: [cards: ComputedRef<Card[]>, title: string, isDiscards: boolean]
  choose: [value: number]
}>()

const showAbilities = ref(false)
const frame = ref(null)
const debug = useDebug()
const cardStore = useCardStore()

const id = computed(() => props.act.id)

const keys = computed(() => props.act.keys)

const cardCode = computed(() => {
  const side = props.act.sequence.side.toLowerCase().replace('a', '')
  const sidePart = id.value.endsWith(side) ? '' : side

  let newId = side == 'b' && id.value === 'c10607a' ? '10607' : id.value.replace(/^c/, '')

  if (sidePart == 'd') {
    newId = newId.replace(/c$/, '')
  }

  if (sidePart == 'f') {
    newId = newId.replace(/e$/, '')
  }

  if (sidePart == 'h') {
    newId = newId.replace(/g$/, '')
  }

  // handle threads of fate as hardcoded values because I don't want to deal with it
  if (parseInt(newId) >= 4117 && parseInt(newId) <= 4140) {
    const adjustedSidePart = sidePart.replace(/[ace]/, '').replace(/[df]/, 'b')
    return `${newId}${adjustedSidePart}`
  }

  if (parseInt(newId) >= 53029 && parseInt(newId) <= 53036) {
    const adjustedSidePart = sidePart.replace(/[g]/, '').replace(/[h]/, 'b')
    return `${newId}${adjustedSidePart}`
  }

  return `${newId}${sidePart}`
})

const image = computed(() => {
  return cardImg(cardCode.value)
})
const { displayedImage, flipping, flippingDiagonally } = useCardFlip(image)

const choices = computed(() => ArkhamGame.choices(props.game, props.playerId))

function imageForCard(card: Card) {
  return imgsrc(cardImagePath(card))
}

function isCardAction(c: Message): boolean {
  return c.tag === MessageType.TARGET_LABEL && c.target.contents === id.value
}

const interactAction = computed(() => choices.value.findIndex(isCardAction))

// An act's "spend clues to advance" shows up in choices as an Objective ability
// whose inner cost is clue-shaped; the engine only offers it once timing and
// payment (team-wide for group clue costs) already pass, so its presence is the
// advance-ready signal.
const canProgress = computed(
  () =>
    interactAction.value !== -1 ||
    abilities.value.some(
      ({ contents }) => 'ability' in contents && isClueAdvancement(contents.ability),
    ),
)

const canInteract = computed(() => abilities.value.length > 0 || interactAction.value !== -1)

function isClueAdvancement(ability: Ability): boolean {
  const { tag, abilityType } = ability.type as unknown as {
    tag?: string
    abilityType?: { cost?: unknown }
  }
  return tag === 'Objective' && isClueCost(abilityType?.cost)
}

function isClueCost(cost: unknown): boolean {
  if (!cost || typeof cost !== 'object') return false
  const { tag, contents } = cost as { tag?: unknown; contents?: unknown }
  if (typeof tag !== 'string') return false
  if (tag.includes('ClueCost')) return true
  return tag === 'Costs' && Array.isArray(contents) && contents.some(isClueCost)
}

function isAbility(v: Message): v is AbilityLabel {
  if (v.tag !== MessageType.ABILITY_LABEL) {
    return false
  }

  const { source } = v.ability

  if (source.sourceTag === 'ProxySource') {
    if ('contents' in source.source) {
      return source.source.contents === id.value
    }
  } else if (source.tag === 'ActSource') {
    return source.contents === id.value
  }

  return false
}

const abilities = computed(() => {
  return choices.value.reduce<AbilityMessage[]>(
    (acc, v, i) =>
      isAbility(v) ? [...acc, { contents: v, displayAsAction: false, index: i }] : acc,
    [],
  )
})

const hasObjective = computed(() =>
  abilities.value.some(
    ({ contents }) => 'ability' in contents && contents.ability.type.tag === 'Objective',
  ),
)

function revealFacedownCard(card: Card): Card {
  switch (card.tag) {
    case 'PlayerCard':
    case 'EncounterCard':
      return { ...card, contents: { ...card.contents, facedown: false } }
    case 'VengeanceCard': {
      const contents = card.contents
      return {
        ...card,
        contents: { ...contents, contents: { ...contents.contents, facedown: false } },
      }
    }
  }
}

// Two separate piles end up under the act: the scenario's cards under the act *deck*,
// and cards placed under the act card itself (PlaceUnderneath on the act, e.g. The
// Apiary's rescued pilgrims). Only the former was being shown, so the latter had no
// count and no way to view it.
const cardsUnder = computed(() => [...props.cardsUnder, ...props.act.cardsUnderneath])
// Facedown cards stay in the list so the count is honest; CardView renders them as
// backs. Debug turns them over.
const visibleCardsUnder = computed(() =>
  debug.active ? cardsUnder.value.map(revealFacedownCard) : cardsUnder.value,
)

const futureStack = computed(() =>
  props.remainingStack.filter((c) => asCardCode(c) !== props.act.id),
)

const cardDefFor = (code: string) =>
  cardStore.cards.find(
    (cardDef) => cardDef.cardCode === code || cardDef.cardCode === code.replace(/^c/, ''),
  )

const cardStage = (code: string): number | null => cardDefFor(code)?.stage ?? null

// Cards sharing a stage are usually branch alternatives (only one of "All In" /
// "Fold" is ever played), so they share a pip. Same-stage cards that also share
// a title are variant printings of that act, each of which is played in turn,
// so those get a pip each.
const cardTitle = (code: string): string => cardDefFor(code)?.name.title ?? code

// The face a completed act/agenda was resolved on, so the popover can offer the
// side that only ever flashed past on advance.
const resolvedSideImage = (card: Card) => {
  const art = toCardContents(card).art || asCardCode(card).replace(/^c/, '')
  return cardImg(resolvedSideArt(art))
}

type StackIndicatorGroup = {
  label: string
  state: 'completed' | 'current' | 'remaining'
  images: {
    src: string
    back?: string
    current?: boolean
    passed?: boolean
  }[]
}

type ActStackGroup = StackIndicatorGroup & {
  stage: number | null
  titles: Set<string>
  firstIndex: number
}

const groupedActStack = computed<StackIndicatorGroup[]>(() => {
  const groups: ActStackGroup[] = []

  const addToGroup = (
    code: string,
    fallbackKey: string,
    fallbackStage: number | null,
    image: StackIndicatorGroup['images'][number],
    preferredState: StackIndicatorGroup['state'],
    firstIndex: number,
  ) => {
    const stage = cardStage(code) ?? fallbackStage
    const title = cardTitle(code)
    const group = groups.find((g) =>
      stage !== null ? g.stage === stage && !g.titles.has(title) : g.label === fallbackKey,
    )

    if (group) {
      group.images.push(image)
      group.titles.add(title)
      if (preferredState === 'current') group.state = 'current'
      return
    }

    groups.push({
      label: stage === null ? fallbackKey : `Act ${stage}`,
      stage,
      titles: new Set([title]),
      firstIndex,
      state: preferredState,
      images: [image],
    })
  }

  props.completedStack.forEach((card, i) => {
    addToGroup(
      asCardCode(card),
      `Act ${i + 1}`,
      null,
      { src: imgsrc(cardImagePath(card)), back: resolvedSideImage(card), passed: true },
      'completed',
      i,
    )
  })

  addToGroup(
    props.act.id,
    `Act ${props.act.sequence.number}`,
    props.act.sequence.number,
    { src: image.value, current: true },
    'current',
    props.completedStack.length,
  )

  futureStack.value.forEach((card, i) => {
    addToGroup(
      asCardCode(card),
      `Act ${props.completedStack.length + i + 2}`,
      null,
      { src: imgsrc(cardImagePath(card)) },
      'remaining',
      props.completedStack.length + i + 1,
    )
  })

  return groups.sort((a, b) => {
    if (a.stage !== null && b.stage !== null && a.stage !== b.stage) return a.stage - b.stage
    return a.firstIndex - b.firstIndex
  })
})

const totalActs = computed(() => groupedActStack.value.length)
const currentActPosition = computed(
  () =>
    groupedActStack.value.findIndex((group) => group.state === 'current') + 1 ||
    props.act.sequence.number,
)

const pipStates = computed(() => groupedActStack.value.map((group) => group.state))

// Tabletop seats hide StackIndicator — in the seat's column layout the pip strip
// would stack above the card and blow the seat's measured height. The history
// rides on the card's own box there instead: a strip over the card's left edge
// picks which act the seat shows, and a resolved one turns over on click.
const viewedGroup = ref<number | null>(null)

const viewed = computed(() => {
  const index = viewedGroup.value
  if (index === null) return null

  const group = groupedActStack.value[index]
  // A card still in the deck is not a page of the history: it stays unviewable.
  return group && group.state !== 'remaining' ? group : null
})

function selectGroup(index: number) {
  const group = groupedActStack.value[index]
  if (!group || group.state === 'remaining') return

  // The group holding the live act *is* the live card, so it selects back to the
  // seat's own card rather than to a row of resolved ones.
  viewedGroup.value = group.state === 'current' ? null : index
}

function stepSelection(direction: 1 | -1) {
  const groups = groupedActStack.value
  const from = viewedGroup.value ?? groups.findIndex((group) => group.state === 'current')
  if (from === -1) return

  for (let i = from + direction; i >= 0 && i < groups.length; i += direction) {
    if (groups[i].state !== 'remaining') {
      selectGroup(i)
      return
    }
  }
}

// The dots are a small target: dragging the card itself pages the same history.
const { onPointerDown, onPointerMove, onPointerUp } = useHistoryDrag(
  () => Boolean(props.hideStackControl),
  stepSelection,
)

// A new act on the table moves every seat measurement under it: come back to the
// live card instead of leaving the seat parked on a resolved one.
watch(() => [props.act.id, props.completedStack.length], () => { viewedGroup.value = null })

async function clicked() {
  if (interactAction.value !== -1) {
    emits('choose', interactAction.value)
  } else if (abilities.value.length === 1) {
    // Unambiguous single ability: fire it directly instead of making the
    // player open the abilities menu just to confirm.
    chooseAbility(abilities.value[0].index)
  } else if (abilities.value.length > 1) {
    showAbilities.value = !showAbilities.value
  } else {
    showAbilities.value = false
  }
}

async function chooseAbility(index: number) {
  showAbilities.value = false
  emits('choose', index)
}

// Full-height backs (an act/agenda that flips to an enemy or location) are stored
// portrait; normal act/agenda faces are landscape. Detect from the loaded image
// instead of maintaining a card-code whitelist. Reset on src change so a flip
// re-detects; @load then corrects it.
const isVertical = ref(false)
function updateOrientation(e: Event) {
  const img = e.target as HTMLImageElement
  isVertical.value = img.naturalHeight > img.naturalWidth
}
watch(image, () => { isVertical.value = false })

const breaches = computed(() => {
  const { breaches } = props.act
  return breaches ?? 0
})

const clues = computed(() => props.act.tokens.Clue ?? 0)
const resources = computed(() => props.act.tokens.Resource ?? 0)

// Epic Multiplayer: The Blob's Act 1 holds ZERO real clue tokens — clues are
// spent into the global pool — so the act looks empty. Render a
// PSEUDO clue-token pool equal to THIS group's clues still on the act for the current
// stage = its contribution minus what the organizer allocated it to spend
// (`act-contribution:<stage>:<ordinal>` − `act-spend:<stage>:<ordinal>`). So the spent
// clues drop off this group's act the moment the organizer allocates (act-spend is
// mirrored before the gate lifts), and the leftover stays until this group advances.
// The viewing group's ordinal comes from the event store's membership (matched by this
// game's id); null for ordinary games. On advance the act stage changes and the new
// stage reads 0, so the pseudo tokens reset naturally. NOTE: shows the VIEWING group's
// pool only; an organizer/shared view could show every group's pool (follow-up).
const eventStore = useEventStore()
const thisGroupOrdinal = computed<number | null>(() => {
  const ev = eventStore.event
  if (!ev) return null
  const group = ev.groups.find((g) => g.gameId === props.game.id)
  return group ? group.ordinal : null
})
const sharedContribution = computed(() => {
  const ordinal = thisGroupOrdinal.value
  if (ordinal === null) return 0
  const stage = props.act.sequence.number
  if (stage !== 1) return 0
  const contributed = actContribution(eventStore.sharedState, stage, ordinal)
  const spent = actSpend(eventStore.sharedState, stage, ordinal)
  return Math.max(0, contributed - spent)
})

const nextToScarletKeys = computed(() =>
  Object.values(props.game.scarletKeys)
    .filter((s) => s.placement.tag === 'NextToAct')
    .map((s) => s.id),
)

// Enemies that spawn "next to the act deck, at no specific location" (Hound of
// Tindalos). They belong to no location and no threat area, so this is the only
// place they are drawn.
const nextToEnemies = computed(() =>
  Object.values(props.game.enemies)
    .filter((e) => e.placement.tag === 'NextToAct')
    .map((e) => e.id),
)

// Stories that put themselves into play "next to the act deck" (In the Shadow of
// Earth's Evidence cards). They have no location and no attachment, so this is
// the only place they are drawn.
const nextToStories = computed(() =>
  Object.values(props.game.stories)
    .filter((s) => s.placement.tag === 'NextToAct')
    .map((s) => s.id),
)

// Story assets that place themselves "next to the act deck" (Starfall's Project
// Origami, Last Hope and Repairing the Threshold, and the objectives the other
// three contacts swap in). Like the enemies and stories above they belong to no
// location and no play area, so this is the only place they are drawn.
const nextToAssets = computed(() =>
  Object.values(props.game.assets)
    .filter((a) => a.placement.tag === 'NextToAct')
    .map((a) => a.id),
)

// Three or more stories collapse into one visible card. The full collection
// remains available in an overlay without adding height to the act column.
const activeStoryId = ref<string | null>(null)
const storyCollectionOpen = ref(false)

watch(
  nextToStories,
  (storyIds) => {
    if (!activeStoryId.value || !storyIds.includes(activeStoryId.value)) {
      activeStoryId.value = storyIds[0] ?? null
    }
    if (storyIds.length < 3) storyCollectionOpen.value = false
  },
  { immediate: true },
)

const activeStory = computed(() =>
  activeStoryId.value ? props.game.stories[activeStoryId.value] : null,
)

const storyCollectionHasForcedAbility = computed(() => {
  const storyIds = new Set(nextToStories.value)

  return choices.value.some((choice) => {
    if (
      choice.tag !== MessageType.ABILITY_LABEL ||
      choice.ability.type.tag !== 'ForcedAbility'
    ) {
      return false
    }

    const { source } = choice.ability
    if (source.sourceTag === 'ProxySource') {
      return (
        'contents' in source.source &&
        typeof source.source.contents === 'string' &&
        storyIds.has(source.source.contents)
      )
    }

    return (
      source.tag === 'StorySource' &&
      typeof source.contents === 'string' &&
      storyIds.has(source.contents)
    )
  })
})

watch(
  storyCollectionHasForcedAbility,
  (hasForcedAbility) => {
    if (hasForcedAbility && nextToStories.value.length >= 3) {
      storyCollectionOpen.value = true
    }
  },
  { immediate: true },
)

const chooseFromStoryCollection = (choice: number) => {
  storyCollectionOpen.value = false
  emits('choose', choice)
}
</script>

<template>
  <div class="act-container">
    <div class="act-row">
      <div
        class="card-container"
        :class="{
          'act--objective': viewed === null && hasObjective,
          'objective-ring': viewed === null && hasObjective,
        }"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onPointerUp"
        @dragstart.prevent
      >
        <StackHistoryCard
          v-for="(image, i) in viewed ? viewed.images : []"
          :key="`${viewedGroup}-${i}`"
          :src="image.src"
          :back="image.back"
          :passed="image.passed"
          :current="image.current"
        />
        <template v-if="viewed === null">
          <img
            :class="{
              'act--can-progress': canProgress,
              'act--can-interact': canInteract,
              'card--sideways': !isVertical,
              'card--flipping': flipping,
              'card--flipping-diagonal': flippingDiagonally,
            }"
            class="card"
            @click="clicked"
            @load="updateOrientation"
            :src="displayedImage"
            ref="frame"
          />
          <PoolItem
            v-if="showClueBadge"
            class="act-clue-badge"
            type="clue"
            :amount="clues"
            :tooltip="$t('multiplayerTable.actClues')"
          />
        </template>
        <StackPips
          v-if="hideStackControl"
          :label="$t('multiplayerTable.actArea')"
          :pips="pipStates"
          :selected="viewedGroup"
          @select="selectGroup"
        />
      </div>
      <StackIndicator
      v-if="!hideStackControl"
        label="Act"
        :current="currentActPosition"
        :total="totalActs"
        :completedCards="completedStack"
        :currentImage="displayedImage"
        :remainingCards="futureStack"
        :groups="groupedActStack"
      />
    </div>
    <AbilitiesMenu
      :frame="frame"
      v-model="showAbilities"
      :abilities="abilities"
      :game="game"
      position="bottom"
      @choose="chooseAbility"
    />
    <!-- Same bar as the agenda: tabletop shelf clips the card column, so the
         abilities also live in the seat's heading bar. -->
    <Teleport v-if="abilitiesBar" defer :to="abilitiesBar">
      <AbilityButton
        v-for="ability in abilities"
        :key="ability.index"
        :ability="ability.contents"
        :game="game"
        class="seat-heading-ability"
        @click="chooseAbility(ability.index)"
      />
    </Teleport>
    <CardsUnderIndicator
      v-if="cardsUnder.length > 0"
      :cards="visibleCardsUnder"
      :label="$t('cardsUnderneath', { count: cardsUnder.length })"
      :game="game"
      :playerId="playerId"
      @choose="$emit('choose', $event)"
    />
    <div class="card-container" v-for="(card, idx) in cardsNextTo" :key="idx">
      <img class="card card--sideways" :src="imageForCard(card)" />
    </div>
    <Treachery
      v-for="treacheryId in act.treacheries"
      :key="treacheryId"
      :treachery="game.treacheries[treacheryId]"
      :game="game"
      :playerId="playerId"
      @choose="$emit('choose', $event)"
    />
    <Enemy
      v-for="enemyId in nextToEnemies"
      :key="enemyId"
      :enemy="game.enemies[enemyId]"
      :game="game"
      :playerId="playerId"
      @choose="$emit('choose', $event)"
    />
    <Asset
      v-for="assetId in nextToAssets"
      :key="assetId"
      :asset="game.assets[assetId]"
      :game="game"
      :playerId="playerId"
      @choose="$emit('choose', $event)"
    />
    <Story
      v-for="storyId in nextToStories.length < 3 ? nextToStories : []"
      :key="storyId"
      :story="game.stories[storyId]"
      :game="game"
      :playerId="playerId"
      @choose="$emit('choose', $event)"
    />
    <section
      v-if="nextToStories.length >= 3 && activeStory"
      class="story-collection"
      :aria-label="`${nextToStories.length} story cards next to the act`"
    >
      <Story
        :story="activeStory"
        :game="game"
        :playerId="playerId"
        @choose="$emit('choose', $event)"
      />
      <Dropdown
        v-model:shown="storyCollectionOpen"
        placement="right-start"
        :distance="8"
        :triggers="['click']"
        :auto-hide="true"
        theme="cards-under-popover"
      >
        <button
          type="button"
          class="story-collection__toggle cards-under-indicator"
          :aria-label="`Story cards (${nextToStories.length}) — click to view`"
          v-tooltip="`Story cards (${nextToStories.length}) — click to view`"
        >
          <span class="cards-under-indicator__icon" aria-hidden="true">
            <span class="cards-under-indicator__card cards-under-indicator__card--back" />
            <span class="cards-under-indicator__card cards-under-indicator__card--front" />
          </span>
          <span class="cards-under-indicator__count">{{ nextToStories.length }}</span>
        </button>
        <template #popper>
          <div class="cards-under-popover">
            <div class="cards-under-popover__header">Story cards ({{ nextToStories.length }})</div>
            <div class="cards-under-popover__cards">
              <article
                v-for="storyId in nextToStories"
                :key="storyId"
                class="cards-under-popover__card-wrap"
              >
                <Story
                  :story="game.stories[storyId]"
                  :game="game"
                  :playerId="playerId"
                  @choose="chooseFromStoryCollection"
                />
              </article>
            </div>
          </div>
        </template>
      </Dropdown>
    </section>
    <ScarletKey
      v-for="scarletKeyId in nextToScarletKeys"
      :scarletKey="game.scarletKeys[scarletKeyId]"
      :game="game"
      :playerId="playerId"
      @choose="$emit('choose', $event)"
    />

    <div class="pool">
      <PoolItem v-if="!showClueBadge && clues > 0" type="clue" :amount="clues" />
      <span v-if="sharedContribution > 0" class="shared-clue-pool" :title="$t('event.sharedClues')">
        <PoolItem type="clue" :amount="sharedContribution" />
      </span>
      <PoolItem v-if="resources > 0" type="resource" :amount="resources" />
      <PoolItem v-if="breaches > 0" type="resource" :amount="breaches" />
      <KeyToken
        v-for="k in keys"
        :key="keyToId(k)"
        :keyToken="k"
        :game="game"
        :playerId="playerId"
        @choose="$emit('choose', $event)"
      />
    </div>
  </div>
</template>

<style scoped>
.act-container :deep(.card) {
  flex: 0;
  width: var(--card-width);
  border-radius: inherit;
}

.card-container {
  box-shadow: var(--shadow-2);
  position: relative;
  border-radius: 6px;
  height: var(--card-width);
  width: fit-content;
}

.act-clue-badge {
  position: absolute;
  top: 4px;
  left: 2px;
  z-index: 2;
  --pool-token-width: 26px;
  pointer-events: none;
}

.act--objective {
  --objective-ring-radius: 6px;
}

.act-container {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.act-row {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: 6px;
}

.act-row :deep(.v-popper) {
  align-self: center;
}

.act-container :deep(.card--sideways) {
  width: auto;
  height: var(--card-width);
  aspect-ratio: var(--card-sideways-aspect);
}

/* Tabletop seats hide StackIndicator, so the pips ride on the card's own box:
   the seat measures its card to fill its own width, so a column beside the card
   would resize the card and the seat with it. */
.card-container > .stack-pips {
  position: absolute;
  left: 2px;
  top: 50%;
  transform: translateY(-50%);
  z-index: var(--z-index-200);
  opacity: 0;
  pointer-events: none;
  transition: opacity 180ms ease;
}

/* Chrome, not information: the strip waits until the pointer is on the card it
   belongs to (or the keyboard is inside it), so a clean card reads clean. */
.card-container:is(:hover, :focus-within) > .stack-pips {
  opacity: 1;
  pointer-events: auto;
}

.act--can-progress {
  border: 2px solid var(--act-advance-edge);
  box-shadow: var(--act-advance-shadow);
  filter: brightness(1.14) saturate(1.12);
  transition: border-color 180ms ease, filter 180ms ease;

  &:is(:hover, :focus-visible) {
    border-color: var(--act-advance-edge-hover);
    filter: brightness(1.24) saturate(1.16);
  }
  border-radius: 8px;
  cursor: pointer;
}

/* The desktop shelf's card area clips the outer glow, so the investigation
   daylight also lives on the card itself: warm light pooling from the top
   edge over the brightened artwork. */
.card-container:has(.act--can-progress)::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 1;
  border-radius: inherit;
  background: linear-gradient(
    180deg,
    rgb(255 243 196 / 0.38),
    rgb(255 232 160 / 0.16) 42%,
    transparent 68%
  );
  animation: act-advance-light 2.4s ease-in-out infinite;
  pointer-events: none;
}

@keyframes act-advance-light {
  0%,
  100% {
    opacity: 0.7;
  }

  50% {
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .card-container:has(.act--can-progress)::after {
    animation: none;
  }
}

.button {
  margin-top: 2px;
  color: var(--text);
  border-radius: 4px;
}

.ability-button {
  background-color: var(--button);
  &:before {
    font-family: 'arkham';
    content: '\0049';
    margin-right: 5px;
  }
}

.abilities {
  padding: 10px;
  background: var(--surface-panel);
  border-radius: 10px;
  button {
    padding: 4px;
  }
}

.card-container:not(.act--objective) {
  .act--can-interact {
    border: 2px solid var(--ability-ready-edge);
    box-shadow: var(--ability-ready-shadow);
    transition: border-color 180ms ease, box-shadow 180ms ease;

    &:is(:hover, :focus-visible) {
      border-color: var(--ability-ready-edge-hover);
      box-shadow: var(--ability-ready-hover-shadow);
    }
    cursor: pointer;
  }
}

.story-collection {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.story-collection__toggle {
  margin-top: 7px;
}

.cards-under-indicator {
  display: flex !important;
  align-items: center;
  justify-content: center;
  gap: 7px;
  height: 22px;
  padding: 0 7px;
  border: var(--edge-width) solid var(--edge-dim);
  border-radius: 999px;
  color: var(--text);
  background: var(--surface-raised);
  box-shadow: var(--shadow-2);
  cursor: pointer;
  line-height: 1;
  transition: background 0.15s ease, border-color 0.15s ease, transform 0.15s ease;
}

.cards-under-indicator:hover {
  border-color: var(--spooky-green);
  background: var(--surface-paper);
  transform: translateY(-1px);
}

.cards-under-indicator__icon {
  display: flex;
  flex: 0 0 20px;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 15px;
  overflow: hidden;
}

.cards-under-indicator__card {
  flex: 0 0 auto;
  width: 10px;
  height: 13px;
  border: 1px solid rgba(255, 255, 255, 0.8);
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.18);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.45);
}

.cards-under-indicator__card--back {
  opacity: 0.55;
  transform: rotate(-6deg) translateY(1px);
}

.cards-under-indicator__card--front {
  margin-left: -4px;
  background: rgba(255, 255, 255, 0.28);
  transform: rotate(6deg) translateY(-1px);
}

.cards-under-indicator__count {
  display: inline-grid;
  place-items: center;
  min-width: 1.35em;
  height: 1.35em;
  border: 1px solid rgba(255, 255, 255, 0.22);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.14);
  font-size: 0.72rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}

.story-collection__toggle:focus-visible {
  outline: 2px solid var(--select);
  outline-offset: 2px;
}

.cards-under-popover {
  min-width: 0;
  max-width: max(50vw, 300px);
  padding: 10px;
}

.cards-under-popover__header {
  margin: 0 0 8px;
  color: rgba(255, 255, 255, 0.82);
  font-size: 0.85rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  text-transform: uppercase;
}

.cards-under-popover__cards {
  display: flex;
  flex-flow: row wrap;
  align-items: flex-start;
  gap: 6px;
  max-height: 50vh;
  overflow: auto;
}

.cards-under-popover__card-wrap {
  flex: 0 0 auto;
  padding: 4px;
  border: 1px solid transparent;
  border-radius: 7px;
}

.cards-under-popover__card-wrap :deep(.card) {
  width: calc(var(--card-width, 100px) * 1.1);
}

/* Pseudo (shared-pool) clue tokens read slightly softer than real act tokens. */
.shared-clue-pool {
  display: inline-flex;
  opacity: 0.85;
  filter: saturate(0.85);
}
</style>
