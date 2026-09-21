<script lang="ts" setup>
import { computed } from 'vue'
import { SquarePen, ExternalLink, RefreshCw, Trash2, BookOpen, Layers } from '@lucide/vue'
import { useRouter } from 'vue-router'
import { displayTabooId } from '@/arkham/taboo';
import {cardImg, localizeArkhamDBBaseUrl, investigatorClass} from '@/arkham/helpers';
import * as ArkhamDeck from '@/arkham/types/Deck'
import { overlayIsEmpty } from '@/arkham/deckOverlay'

interface Props {
  deck: ArkhamDeck.Deck
  sync?: () => void
  markDelete?: () => void
}

const props = defineProps<Props>()
const router = useRouter()

function navigateToDeck() {
  router.push({ name: 'Deck', params: { deckId: props.deck.id } })
}

// The embedded builder edits the saved deck in place (PUT), so the row just
// hands off to its editor.
const builderEditUrl = () =>
  `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, '')}/build/deck/edit/${props.deck.id}`

const deckUrlToPage = (url: string): string => {
  return url
    .replace("https://arkhamdb.com", localizeArkhamDBBaseUrl())
    .replace("/api/public/decklist", "/decklist/view")
    .replace("/api/public/deck", "/deck/view")
}

// An overlay can replace the investigator, so the row follows the play list.
const deckInvestigator = computed(() => ArkhamDeck.deckInvestigator(props.deck))

const deckClass = computed(() => {
  if (deckInvestigator.value) {
    return investigatorClass(deckInvestigator.value)
  }
  return {};
})

// A laid-over deck plays differently from the one it was built as, so the row says so.
const hasOverlay = computed(() => !overlayIsEmpty(props.deck.overlay ?? null))

const tabooList = computed(() => {
  const list = ArkhamDeck.deckPlayList(props.deck)
  return list.taboo_id ? displayTabooId(list.taboo_id) : null
})

// Makes the "recently used" sort legible: the row says what it is being ordered by.
const lastPlayed = computed(() => {
  if (!props.deck.lastUsedAt) return null
  const d = new Date(props.deck.lastUsedAt)
  return isNaN(d.getTime()) ? null : d.toLocaleDateString()
})
</script>

<template>
  <div class="decklist box" :class="deckClass" @click="navigateToDeck">
    <img class="portrait--decklist" :src="cardImg(deckInvestigator)" alt="" loading="lazy" />
    <div class="deck-details">
      <div class="deck-main">
        <div class="deck-name-row">
          <span
            v-if="hasOverlay"
            class="overlay-badge"
            title="Overlay — this deck is laid over with custom cards"
            aria-label="Overlay"
          >
            <Layers aria-hidden="true" />
          </span>
          <router-link class="deck-name" :to="{ name: 'Deck', params: { deckId: deck.id } }" @click.stop>{{ deck.name }}</router-link>
        </div>
        <div class="deck-badges">
          <span v-if="tabooList" class="taboo-badge"><BookOpen aria-hidden="true" /> Taboo: {{ tabooList }}</span>
          <span class="last-played">
            {{ lastPlayed ? $t('deck.lastPlayed', { date: lastPlayed }) : $t('deck.neverPlayed') }}
          </span>
        </div>
      </div>
      <div class="deck-actions" @click.stop>
        <a class="action-btn" :href="builderEditUrl()" target="_blank" rel="noreferrer noopener" :title="$t('deck.editInBuilder')" :aria-label="$t('deck.editInBuilder')">
          <SquarePen aria-hidden="true" />
        </a>
        <a v-if="deck.url" class="action-btn" :href="deckUrlToPage(deck.url)" target="_blank" rel="noreferrer noopener" :title="$t('deck.viewOnArkhamDb')" :aria-label="$t('deck.viewOnArkhamDb')">
          <ExternalLink aria-hidden="true" />
        </a>
        <button v-if="deck.url && sync" type="button" class="action-btn" :title="$t('deck.syncDeck')" :aria-label="$t('deck.syncDeck')" @click="sync">
          <RefreshCw aria-hidden="true" />
        </button>
        <button v-if="markDelete" type="button" class="action-btn action-btn--delete" :title="$t('deck.deleteDeck')" :aria-label="$t('deck.deleteDeck')" @click="markDelete">
          <Trash2 aria-hidden="true" />
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.decklist {
  position: relative;
  isolation: isolate;
  display: flex;
  gap: 16px;
  color: var(--text);
  border-left: 4px solid transparent;
  overflow: hidden;
  background: var(--surface-panel) url('/assets/veiled-harbour/03-档案纸纹理.svg') repeat;
  box-shadow: 0 8px 18px rgba(37, 39, 37, 0.12);
  cursor: pointer;
  transition: background-color 0.2s, border-color 0.2s, transform 0.2s, box-shadow 0.2s;

  &::after {
    content: '';
    position: absolute;
    inset: 8px;
    z-index: -1;
    border: 1px solid color-mix(in srgb, var(--brass) 26%, transparent);
    pointer-events: none;
  }

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 12px 24px rgba(37, 39, 37, 0.17);
  }

  &.guardian { border-left-color: var(--guardian-dark); &:hover { background-color: color-mix(in srgb, var(--guardian-dark) 10%, var(--surface-panel)); .deck-name { color: var(--guardian-dark); } } }
  &.seeker   { border-left-color: var(--seeker-dark);   &:hover { background-color: color-mix(in srgb, var(--seeker-dark) 10%, var(--surface-panel));   .deck-name { color: var(--seeker-dark); } } }
  &.rogue    { border-left-color: var(--rogue-dark);    &:hover { background-color: color-mix(in srgb, var(--rogue-dark) 10%, var(--surface-panel));    .deck-name { color: var(--rogue-dark); } } }
  &.mystic   { border-left-color: var(--mystic-dark);   &:hover { background-color: color-mix(in srgb, var(--mystic-dark) 10%, var(--surface-panel));   .deck-name { color: var(--mystic-dark); } } }
  &.survivor { border-left-color: var(--survivor-dark); &:hover { background-color: color-mix(in srgb, var(--survivor-dark) 10%, var(--surface-panel)); .deck-name { color: var(--survivor-dark); } } }
  &.neutral  { border-left-color: var(--neutral-dark);  &:hover { background-color: color-mix(in srgb, var(--neutral-dark) 10%, var(--surface-panel));  .deck-name { color: var(--neutral-dark); } } }
}

.portrait--decklist {
  width: 150px;
  margin: 10px 0 10px 10px;
  border-radius: 5px;
  border: 1px solid color-mix(in srgb, var(--brass) 55%, transparent);
  box-shadow: 1px 1px 6px rgba(0, 0, 0, 0.45);
  flex-shrink: 0;
  align-self: flex-start;
  transition: transform 0.3s ease;

  .decklist:hover & {
    transform: scale(1.04);
  }
}

.deck-details {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  flex: 1;
  min-width: 0;
  padding: 4px 0;
}

.deck-main {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.deck-name {
  font-size: 1.2em;
  font-weight: 800;
  color: var(--title);
  line-height: 1.2;
  transition: color 0.15s;
}


.taboo-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  width: fit-content;
  padding: 1px 7px;
  line-height: 1.6;
  font-size: 0.75em;
  font-weight: 600;
  color: #765f31;
  background: color-mix(in srgb, var(--brass) 14%, transparent);
  border: 1px solid color-mix(in srgb, var(--brass) 46%, transparent);
  border-radius: 4px;
  letter-spacing: 0.02em;
}

.deck-badges {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.last-played {
  font-size: 0.75em;
  font-weight: 600;
  color: #8a93a8;
  letter-spacing: 0.02em;
  white-space: nowrap;
}

.deck-actions {
  display: flex;
  align-items: center;
  gap: 14px;
}

.action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  background: transparent;
  box-shadow: none;
  cursor: pointer;
  color: var(--text-dim);
  font-size: 0.9em;
  text-decoration: none;
  transition: color 0.15s;

  &:hover { color: var(--spooky-green); }
  &.action-btn--delete { &:hover { color: var(--delete); } }
}

/* Sits before the name so a laid-over deck reads as such at a glance. The row
 * is a stretching column, so the pill has to be sized to its own text. */
.deck-name-row {
  align-items: center;
  display: flex;
  gap: 8px;
  min-width: 0;
}

.overlay-badge {
  align-items: center;
  background: color-mix(in srgb, var(--spooky-green) 14%, transparent);
  border: 1px solid color-mix(in srgb, var(--spooky-green) 55%, transparent);
  border-radius: 999px;
  color: var(--spooky-green);
  display: inline-flex;
  flex: 0 0 auto;
  font-size: 0.75em;
  padding: 0.25em 0.45em;
  white-space: nowrap;
  width: fit-content;
}
.action-btn svg, .taboo-badge svg, .overlay-badge svg { width: 16px; height: 16px; flex-shrink: 0; }
.deck-name { text-decoration: none; }
</style>
