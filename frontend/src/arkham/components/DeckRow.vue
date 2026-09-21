<script lang="ts" setup>
import { computed, ref, watch } from 'vue'
import { SquarePen, ExternalLink, RefreshCw, Trash2, Layers, Shield, Search, Gem, Triangle, Bird, Sparkles } from '@lucide/vue'
import { useRouter } from 'vue-router'
import { portraitImage } from '@/arkham/cardImages'
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

const classIcons = { guardian: Shield, seeker: Search, rogue: Gem, mystic: Triangle, survivor: Bird, neutral: Sparkles }
const classes = computed(() => Object.entries(deckClass.value)
  .filter(([key, active]) => active && key in classIcons)
  .map(([key]) => key as keyof typeof classIcons))
const portraitFailed = ref(false)
watch(deckInvestigator, () => { portraitFailed.value = false })
const coverImage = computed(() => portraitFailed.value ? cardImg(deckInvestigator.value) : portraitImage(deckInvestigator.value))

// Makes the "recently used" sort legible: the row says what it is being ordered by.
const lastPlayed = computed(() => {
  if (!props.deck.lastUsedAt) return null
  const d = new Date(props.deck.lastUsedAt)
  return isNaN(d.getTime()) ? null : d.toLocaleDateString()
})
</script>

<template>
  <div class="decklist" :class="deckClass" @click="navigateToDeck">
    <div class="deck-cover">
      <img class="portrait--decklist" :class="{ 'portrait--fallback': portraitFailed }" :src="coverImage" alt="" loading="lazy" @error="portraitFailed = true" />
      <div v-if="classes.length" class="cover-classes">
        <span v-for="iclass in classes" :key="iclass" class="cover-class">
          <component :is="classIcons[iclass]" aria-hidden="true" />{{ $t(`deckToolbar.classes.${iclass}`) }}
        </span>
      </div>
    </div>
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
          <router-link class="deck-name" :title="deck.name" :to="{ name: 'Deck', params: { deckId: deck.id } }" @click.stop>{{ deck.name }}</router-link>
        </div>
      </div>
      <div class="deck-footer">
        <span class="last-played" :title="lastPlayed ? $t('deck.lastPlayed', { date: lastPlayed }) : $t('deck.neverPlayed')">
          {{ lastPlayed ? $t('deck.lastPlayed', { date: lastPlayed }) : $t('deck.neverPlayed') }}
        </span>
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
  </div>
</template>

<style scoped>
.decklist {
  position: relative;
  display: flex;
  flex-direction: column;
  min-width: 0;
  margin: 0;
  padding: 7px;
  box-sizing: border-box;
  overflow: hidden;
  border: 1px solid #b5a078;
  border-radius: 8px;
  background: linear-gradient(135deg, #fcf9ef, #f0eadb);
  color: #344136;
  box-shadow: inset 0 0 0 3px rgb(255 252 240 / 0.7), 0 3px 8px rgb(77 61 33 / 0.12);
  cursor: pointer;
  transition: border-color 160ms ease, box-shadow 160ms ease;
}
.decklist:hover { border-color: #887044; box-shadow: 0 5px 14px rgb(77 61 33 / 0.2); }
.deck-cover { position: relative; height: 184px; flex-shrink: 0; overflow: hidden; border: 1px solid #c5b58f; border-radius: 3px; background: #d6d3c1; }
.portrait--decklist { display: block; width: 100%; height: 100%; object-fit: cover; object-position: center 28%; }
.portrait--fallback { object-fit: contain; }
.cover-classes { position: absolute; left: 8px; bottom: 8px; display: flex; flex-wrap: wrap; gap: 5px; }
.cover-class { display: inline-flex; align-items: center; gap: 6px; padding: 4px 7px; border: 1px solid #c3b184; border-radius: 4px; background: rgb(40 51 37 / 0.9); color: #faf3df; font-size: 0.72rem; line-height: 1.3; }
.cover-class svg { width: 15px; height: 15px; stroke-width: 1.6; }
.deck-details { display: flex; flex-direction: column; gap: 8px; min-width: 0; padding: 8px 7px 3px; }
.deck-name-row { display: flex; align-items: center; gap: 6px; min-width: 0; height: 28px; }
.deck-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #303d31; font: 600 1rem / 1.5 'Source Han Serif', 'Arno', serif; text-decoration: none; }
.deck-name:hover { color: #7a6035; }
.deck-footer { display: flex; align-items: center; gap: 4px; min-width: 0; height: 32px; }
.last-played { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.68rem; font-weight: 400; color: #737a69; }
.deck-actions { display: flex; align-items: center; gap: 1px; flex-shrink: 0; }
.action-btn { display: inline-flex; justify-content: center; align-items: center; flex-shrink: 0; width: 28px; height: 32px; margin: 0; padding: 0; border: 1px solid transparent; border-radius: 3px; background: transparent; color: #40503d; box-shadow: none; text-decoration: none; cursor: pointer; }
.action-btn:hover { background: #e1e3d1; border-color: #b5ba9c; }
.action-btn--delete:hover { color: #984d40; background: #efe0d7; border-color: #c5a18e; }
.action-btn svg { width: 17px; height: 17px; stroke-width: 1.6; }
.overlay-badge { display: inline-flex; flex-shrink: 0; color: #647b4b; }
.overlay-badge svg { width: 16px; height: 16px; }
a:focus-visible, button:focus-visible { outline: 2px solid #53694b; outline-offset: 1px; }
@media (pointer: coarse) {
  .deck-footer { height: 44px; }
  .action-btn { width: 36px; height: 44px; }
}
</style>
