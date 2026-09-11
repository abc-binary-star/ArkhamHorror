<script lang="ts" setup>
import { computed } from 'vue'
import * as ArkhamCardDef from '@/arkham/types/CardDef'
import { localizeArkhamDBBaseUrl } from '@/arkham/helpers'
import { cardGroupKey as groupKey, groupCards } from '@/arkham/cardDetails'
import CardImage from '@/arkham/components/CardImage.vue'

const props = withDefaults(defineProps<{
  cards: ArkhamCardDef.CardDef[],
  attachments?: Record<string, ArkhamCardDef.CardDef[]>,
  showCounts?: boolean,
  unimplemented?: Set<string>,
  selectable?: boolean,
  /* Editing an overlay: each card gets take-one/put-one-back controls right on
   * the card, rather than in a separate pane. */
  overlayEditing?: boolean,
  overlayRemoved?: (card: ArkhamCardDef.CardDef) => number,
  /* What the overlay leaves of a card, when that differs from the copies
   * listed. Zero means it is out but still shown, so it can be put back. */
  overlayCount?: (card: ArkhamCardDef.CardDef) => number | null,
}>(), {
  attachments: () => ({}),
  showCounts: true,
  unimplemented: () => new Set(),
  selectable: false,
  overlayEditing: false,
  overlayRemoved: () => () => 0,
  overlayCount: () => () => null,
})

const shownCount = (card: ArkhamCardDef.CardDef, count: number) => props.overlayCount(card) ?? count
const isOut = (card: ArkhamCardDef.CardDef) => props.overlayCount(card) === 0

// When selectable, clicking a card asks the parent to show its details instead
// of following the link out to ArkhamDB.
const emit = defineEmits<{
  select: [card: ArkhamCardDef.CardDef]
  'overlay-take': [card: ArkhamCardDef.CardDef]
  'overlay-restore': [card: ArkhamCardDef.CardDef]
}>()

const onCardClick = (event: MouseEvent, card: ArkhamCardDef.CardDef) => {
  if (!props.selectable) return
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return
  event.preventDefault()
  emit('select', card)
}

// Cards shown for completeness that the engine doesn't implement yet.
const isUnimplemented = (card: ArkhamCardDef.CardDef) => props.unimplemented.has(card.art)

const groupedCards = computed(() => groupCards(props.cards))

const attachedCards = (card: ArkhamCardDef.CardDef) => props.attachments[card.art] ?? []

const groupedAttachedCards = (card: ArkhamCardDef.CardDef) => groupCards(attachedCards(card))

const underworldMarketCards = () => props.attachments['09077'] ?? []
const spiritDeckCards = () => props.attachments['90052'] ?? []
const stickToThePlanCards = () => props.attachments['03264'] ?? []
const ancestralKnowledgeCards = () => props.attachments['07303'] ?? []
const bewitchingCards = () => props.attachments['10079'] ?? []
const eldritchBrandCards = () => props.attachments['11080'] ?? []

const countCards = (cards: ArkhamCardDef.CardDef[]) => {
  const counts = new Map<string, number>()
  for (const card of cards) counts.set(card.art, (counts.get(card.art) ?? 0) + 1)
  return counts
}

const marketCardCounts = computed(() => countCards(underworldMarketCards()))
const spiritCardCounts = computed(() => countCards(spiritDeckCards()))
const stickToThePlanCardCounts = computed(() => countCards(stickToThePlanCards()))
const ancestralKnowledgeCardCounts = computed(() => countCards(ancestralKnowledgeCards()))
const bewitchingCardCounts = computed(() => countCards(bewitchingCards()))
const eldritchBrandCardCounts = computed(() => countCards(eldritchBrandCards()))

const marketCardCount = (card: ArkhamCardDef.CardDef) => marketCardCounts.value.get(card.art) ?? 0
const spiritCardCount = (card: ArkhamCardDef.CardDef) => spiritCardCounts.value.get(card.art) ?? 0
const stickToThePlanCardCount = (card: ArkhamCardDef.CardDef) => stickToThePlanCardCounts.value.get(card.art) ?? 0
const ancestralKnowledgeCardCount = (card: ArkhamCardDef.CardDef) => ancestralKnowledgeCardCounts.value.get(card.art) ?? 0
const bewitchingCardCount = (card: ArkhamCardDef.CardDef) => bewitchingCardCounts.value.get(card.art) ?? 0
const eldritchBrandCardCount = (card: ArkhamCardDef.CardDef) => eldritchBrandCardCounts.value.get(card.art) ?? 0

const marketTooltip = (card: ArkhamCardDef.CardDef) => `Attached to Market deck (x ${marketCardCount(card)})`
const spiritTooltip = (card: ArkhamCardDef.CardDef) => `In Spirit deck (x ${spiritCardCount(card)})`
const stickToThePlanTooltip = (card: ArkhamCardDef.CardDef) => `Attached to Stick to the Plan (x ${stickToThePlanCardCount(card)})`
const ancestralKnowledgeTooltip = (card: ArkhamCardDef.CardDef) => `Attached to Ancestral Knowledge (x ${ancestralKnowledgeCardCount(card)})`
const bewitchingTooltip = (card: ArkhamCardDef.CardDef) => `Attached to Bewitching (x ${bewitchingCardCount(card)})`
const eldritchBrandTooltip = (card: ArkhamCardDef.CardDef) => `Branded by Eldritch Brand (x ${eldritchBrandCardCount(card)})`

const isUnderworldMarketCard = (card: ArkhamCardDef.CardDef) => marketCardCount(card) > 0
const isSpiritDeckCard = (card: ArkhamCardDef.CardDef) => spiritCardCount(card) > 0
const isStickToThePlanCard = (card: ArkhamCardDef.CardDef) => stickToThePlanCardCount(card) > 0
const isAncestralKnowledgeCard = (card: ArkhamCardDef.CardDef) => ancestralKnowledgeCardCount(card) > 0
const isBewitchingCard = (card: ArkhamCardDef.CardDef) => bewitchingCardCount(card) > 0
const isEldritchBrandCard = (card: ArkhamCardDef.CardDef) => eldritchBrandCardCount(card) > 0

const attachmentTitle = (card: ArkhamCardDef.CardDef) => {
  if (card.art === '90052') return 'Spirit deck'
  if (card.art === '09077') return 'Underworld Market'
  if (card.art === '11080') return 'Eldritch Brand'
  return 'Attached cards'
}

const cardName = (card: ArkhamCardDef.CardDef) => {
  const subtitle = card.name.subtitle === null ? "" : `: ${card.name.subtitle}`
  return `${card.name.title}${subtitle}`
}
</script>

<template>
  <div class="cards">
    <div
      v-for="{ card, count } in groupedCards"
      :key="groupKey(card)"
      class="card-tile"
      :class="{ 'has-attachments': attachedCards(card).length > 0, 'card-tile--unimplemented': isUnimplemented(card), 'card-tile--out': isOut(card) }"
      v-tooltip="isUnimplemented(card) ? 'Not yet implemented' : undefined"
    >
      <a target="_blank" :href="`${localizeArkhamDBBaseUrl()}/card/${card.art}`" @click="onCardClick($event, card)">
        <CardImage :card="card" />
        <span class="card-badges">
          <span v-if="showCounts" class="deck-card-count">x {{ shownCount(card, count) }}</span>
          <span v-if="isUnderworldMarketCard(card)" class="market-badge" v-tooltip="marketTooltip(card)" :aria-label="marketTooltip(card)">
            <font-awesome-icon icon="store" />
            <span>x {{ marketCardCount(card) }}</span>
          </span>
          <span v-if="isStickToThePlanCard(card)" class="market-badge" v-tooltip="stickToThePlanTooltip(card)" :aria-label="stickToThePlanTooltip(card)">
            <font-awesome-icon icon="paperclip" />
            <span>x {{ stickToThePlanCardCount(card) }}</span>
          </span>
          <span v-if="isAncestralKnowledgeCard(card)" class="market-badge" v-tooltip="ancestralKnowledgeTooltip(card)" :aria-label="ancestralKnowledgeTooltip(card)">
            <font-awesome-icon icon="paperclip" />
            <span>x {{ ancestralKnowledgeCardCount(card) }}</span>
          </span>
          <span v-if="isBewitchingCard(card)" class="market-badge" v-tooltip="bewitchingTooltip(card)" :aria-label="bewitchingTooltip(card)">
            <font-awesome-icon icon="paperclip" />
            <span>x {{ bewitchingCardCount(card) }}</span>
          </span>
          <span v-if="isEldritchBrandCard(card)" class="market-badge" v-tooltip="eldritchBrandTooltip(card)" :aria-label="eldritchBrandTooltip(card)">
            <font-awesome-icon icon="book" />
            <span>x {{ eldritchBrandCardCount(card) }}</span>
          </span>
          <span v-if="isSpiritDeckCard(card)" class="spirit-badge" v-tooltip="spiritTooltip(card)" :aria-label="spiritTooltip(card)">
            <font-awesome-icon :icon="['fas', 'ghost']" />
            <span>x {{ spiritCardCount(card) }}</span>
          </span>
        </span>
      </a>
      <div v-if="overlayEditing" class="overlay-controls">
        <button type="button" title="Take one out" @click="emit('overlay-take', card)">−</button>
        <button
          type="button"
          title="Put one back"
          :disabled="overlayRemoved(card) === 0"
          @click="emit('overlay-restore', card)"
        >+</button>
      </div>
      <div v-if="attachedCards(card).length > 0" class="attachments-panel">
        <div class="attachments-title" :class="{ 'attachments-title--spirit': card.art === '90052' }">
          <font-awesome-icon :icon="card.art === '90052' ? ['fas', 'ghost'] : 'paperclip'" /> {{ attachmentTitle(card) }}
        </div>
        <div class="attachment-grid">
          <a
            v-for="entry in groupedAttachedCards(card)"
            :key="groupKey(entry.card)"
            class="attachment-card"
            target="_blank"
            :href="`${localizeArkhamDBBaseUrl()}/card/${entry.card.art}`"
            :title="cardName(entry.card)"
          >
            <CardImage :card="entry.card" />
            <span class="attachment-label">
              <span class="attachment-name">{{ cardName(entry.card) }}{{ card.art === '11080' ? ' was branded' : '' }}</span>
              <span v-if="card.art !== '11080' || entry.count > 1" class="attachment-count">x {{ entry.count }}</span>
            </span>
          </a>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cards {
  --min-col-width: 200px;
  flex: 1;
  overflow-y: auto;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(var(--min-col-width), 100%), 1fr));
  gap: 12px;
  padding: 16px;
  align-content: start;

  &:deep(.card-container) {
    width: 100%;
    max-width: unset;
    margin: 0;
  }
}

.card-tile {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-self: start;
  position: relative;
  padding: 7px;
  border: 1px solid color-mix(in srgb, var(--brass) 38%, transparent);
  border-radius: var(--radius-md);
  background:
    linear-gradient(rgba(233, 225, 210, 0.46), rgba(233, 225, 210, 0.46)),
    url('/assets/veiled-harbour/13-卡槽纸面.avif') center / cover no-repeat;
  box-shadow: var(--shadow-2);
  transition: transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease;

  &:hover {
    transform: translateY(-2px);
    border-color: var(--brass);
    box-shadow: var(--shadow-4);
  }

  &::after {
    content: '';
    position: absolute;
    left: 12%;
    right: 12%;
    bottom: 2px;
    height: 28px;
    pointer-events: none;
    background: url('/assets/veiled-harbour/33-卡牌交互状态带-v2.avif') center / 100% 100% no-repeat;
    mix-blend-mode: multiply;
    opacity: 0;
    transform: translateY(4px);
    transition: opacity 160ms ease, transform 160ms ease;
  }

  &:hover::after,
  &:focus-within::after {
    opacity: 0.78;
    transform: translateY(0);
  }

  > a {
    position: relative;
    z-index: 1;
    display: flex;
    justify-content: center;
  }

  > .overlay-controls,
  > .attachments-panel {
    position: relative;
    z-index: 1;
  }
}

.card-tile--unimplemented {
  opacity: 0.42;
  filter: grayscale(0.55);
  transition: opacity 0.15s, filter 0.15s;

  &:hover {
    opacity: 0.85;
    filter: grayscale(0);
  }
}

.card-tile--unimplemented::before,
.card-tile--out::before {
  content: '';
  position: absolute;
  inset: 22% 28%;
  z-index: 0;
  pointer-events: none;
  background: url('/assets/veiled-harbour/16-卡牌背面纹章.avif') center / contain no-repeat;
  opacity: 0.16;
  mix-blend-mode: multiply;
}

.card-badges {
  position: absolute;
  left: 10px;
  bottom: 10px;
  z-index: var(--z-index-1);
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.deck-card-count {
  display: inline-grid;
  place-items: center;
  min-width: 30px;
  height: 26px;
  padding: 0 7px;
  color: var(--text);
  background: var(--surface-raised);
  border: var(--edge-width) solid var(--edge-dim);
  border-radius: 7px;
  box-shadow: 0 2px 7px rgba(0, 0, 0, 0.45);
  font-size: 0.82rem;
  font-weight: 800;
  white-space: nowrap;
}

.market-badge,
.spirit-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  min-width: 30px;
  height: 26px;
  padding: 0 7px;
  color: var(--brass-dim);
  background: var(--surface-raised);
  border: var(--edge-width) solid var(--brass);
  border-radius: 7px;
  box-shadow: 0 2px 7px rgba(0, 0, 0, 0.45);
  font-size: 0.82rem;
  font-weight: 800;
}

.spirit-badge {
  color: var(--teal);
  border-color: var(--teal);
}

.has-attachments {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: minmax(180px, 240px) 1fr;
  align-items: start;
  padding: 10px;
  background: linear-gradient(180deg, rgba(200, 169, 110, 0.12), rgba(255, 255, 255, 0.035));
  border: 1px solid rgba(200, 169, 110, 0.24);
  border-radius: 12px;
  box-shadow: 0 8px 22px rgba(0, 0, 0, 0.28);

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
}

.attachments-panel {
  padding: 8px;
  background: var(--surface-raised);
  border-radius: 9px;
}

.attachments-title {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 7px;
  color: #c8a96e;
  font-size: 0.68rem;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.attachments-title--spirit {
  color: var(--guardian-dark);
}

.attachment-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 8px;
}

.attachment-card {
  min-width: 0;
  color: var(--text);
  text-decoration: none;
  font-size: 0.68rem;
  font-weight: 700;

  &:deep(.card-container) {
    border-radius: 5px;
    overflow: hidden;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.35);
  }

  .attachment-label {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 5px;
    margin-top: 3px;
  }

  .attachment-name {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .attachment-count {
    flex: 0 0 auto;
    padding: 1px 5px;
    color: #1d170f;
    background: #c8a96e;
    border-radius: 999px;
    font-size: 0.58rem;
    font-weight: 900;
    white-space: nowrap;
  }

  &:hover { opacity: 0.82; }
}

/* Sits on the card rather than beside it, so the grid keeps its shape. */
.overlay-controls {
  bottom: 6px;
  display: flex;
  gap: 0.15rem;
  left: 50%;
  position: absolute;
  transform: translateX(-50%);
  z-index: 2;
}

.overlay-controls button {
  background: var(--surface-raised);
  border-radius: 3px;
  color: var(--text);
  cursor: pointer;
  font-size: 0.85rem;
  line-height: 1;
  padding: 0.1rem 0.45rem;

  &:hover:not(:disabled) {
    background: var(--surface-paper);
  }

  &:disabled {
    cursor: default;
    opacity: 0.3;
  }
}

/* Taken out by the overlay, but still shown so it can be put back. */
.card-tile--out > a {
  filter: grayscale(0.7);
  opacity: 0.35;
}
</style>
