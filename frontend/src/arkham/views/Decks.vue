<script lang="ts" setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import * as ArkhamDeck from '@/arkham/types/Deck'
import Prompt from '@/components/Prompt.vue'
import LoadState from '@/components/LoadState.vue'
import { fetchDecks, deleteDeck, syncDeck } from '@/arkham/api'
import NewDeck from '@/arkham/components/NewDeck.vue';
import Deck from '@/arkham/components/DeckRow.vue';
import DeckToolbar from '@/arkham/components/DeckToolbar.vue';
import { Plus, X, SquarePen, Library } from '@lucide/vue'
import { useToast } from "vue-toastification";
import { useI18n } from 'vue-i18n'
import type { InvestigatorClass } from '@/arkham/helpers'
import { storeToRefs } from 'pinia'
import { useSettings } from '@/stores/settings'
import { loadLibrary } from '@/arkham/customCardLibrary'
import { onDeckBuilderSave } from '@/arkham/deckBuilderBridge'

const { t } = useI18n()

// A deck laid over with your own investigator draws its row from your library.
const { customCardsEnabled } = storeToRefs(useSettings())
if (customCardsEnabled.value) loadLibrary()

const allDecks = ref<ArkhamDeck.Deck[]>([])
const deleteId = ref<string | null>(null)
const toast = useToast()
const showNewDeck = ref(false)
const searchText = ref('')
const sortBy = ref<ArkhamDeck.DeckSort>('name')
const filterClasses = ref<InvestigatorClass[]>([])

async function addDeck(d: ArkhamDeck.Deck) {
  allDecks.value.push(d)
  showNewDeck.value = false
}

async function deleteDeckEvent() {
  const { value } = deleteId
  if (!value) return

  try {
    await deleteDeck(value)
    allDecks.value = allDecks.value.filter((deck) => deck.id !== value)
  } catch {
    // Without this the deck stays in the list, the prompt stays open, and the
    // user has no idea the delete did not happen.
    toast.error(t('pleaseTryAgainLater'))
  } finally {
    deleteId.value = null
  }
}

const loaded = ref(false)
const loadError = ref(false)

const builderCreateUrl = `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, '')}/build/deck/create`

const loadDecks = () => {
  loadError.value = false
  fetchDecks()
    .then((response) => { allDecks.value = response })
    .catch(() => { loadError.value = true })
    .finally(() => { loaded.value = true })
}

loadDecks()

// A deck saved in the /build/ tab is written to the database by the builder
// itself; reload so it shows up here without a manual refresh.
let unsubscribeDeckBuilder: (() => void) | null = null
onMounted(() => {
  unsubscribeDeckBuilder = onDeckBuilderSave(() => loadDecks())
})
onUnmounted(() => {
  unsubscribeDeckBuilder?.()
  unsubscribeDeckBuilder = null
})

const decks = computed(() => {
  const result = allDecks.value.filter((deck) => {
    const matchesClass = filterClasses.value.length === 0 ||
      filterClasses.value.some((k) => ArkhamDeck.deckClass(deck)[k])
    const matchesSearch = !searchText.value ||
      deck.name.toLowerCase().includes(searchText.value.toLowerCase())
    return matchesClass && matchesSearch
  })

  return ArkhamDeck.sortDecks(result, sortBy.value)
})

async function sync(deck: ArkhamDeck.Deck) {
  syncDeck(deck.id).then(() => {
    toast.success(t('deckSyncedSuccessfully'), { timeout: 3000 })
  })
}
</script>

<template>
  <div class="page-container workbench-shell">
    <div id="decks">
      <header class="decks-header">
        <div class="decks-heading">
          <p class="decks-eyebrow"><Library aria-hidden="true" />{{ $t('deckList.archiveLabel') }}</p>
          <h2>{{ $t('decks') }}</h2>

        </div>
        <div class="decks-header-actions">
        <a class="builder-new-btn" :href="builderCreateUrl" target="_blank" rel="noreferrer noopener">
          <SquarePen aria-hidden="true" />
          {{ $t('deckList.createInBuilder') }}
        </a>
        <button class="new-deck-button" type="button" :aria-expanded="showNewDeck" aria-controls="new-deck-panel" @click="showNewDeck = !showNewDeck">
          <X v-if="showNewDeck" aria-hidden="true" /><Plus v-else aria-hidden="true" />
          {{ showNewDeck ? t('cancel') : t('deckList.newDeck') }}
        </button>
        </div>
      </header>

      <div v-if="showNewDeck" id="new-deck-panel" class="new-deck-panel">
        <NewDeck always-save @new-deck="addDeck" />
      </div>

      <div class="library-layout">
      <aside class="library-sidebar" :aria-label="$t('deckToolbar.searchDecks')">
      <DeckToolbar
        v-model:search="searchText"
        v-model:filterClasses="filterClasses"
        v-model:sortBy="sortBy"
        class="toolbar"
      />
      </aside>
      <section class="library-collection" :aria-label="$t('deckList.collectionLabel')">

      <div v-if="loaded && !loadError" class="deck-results" role="status">
        <span>{{ $t('deckList.collectionLabel') }}</span>
        <span>{{ $t('deckList.resultCount', { count: decks.length, total: allDecks.length }) }}</span>
      </div>
      <LoadState v-if="loadError" error @retry="loadDecks" />
      <LoadState v-else-if="!loaded" />
      <div v-else-if="decks.length === 0" class="empty-state">
        <img class="empty-state-card" src="/assets/veiled-harbour/24-空档案纸牌.avif" alt="" aria-hidden="true" />
        <p>{{ $t(allDecks.length === 0 ? 'noDecksYet' : 'noDecksMatchFilters') }}</p>
      </div>
      <div v-else class="deck-grid">
        <Deck
          v-for="deck in decks"
          :key="deck.id"
          :deck="deck"
          :markDelete="() => deleteId = deck.id"
          :sync="() => sync(deck)"
        />
      </div>

      </section>
      </div>

      <Prompt
        v-if="deleteId"
        :prompt="t('areYouSureDeleteDeck')"
        :yes="deleteDeckEvent"
        :no="() => deleteId = null"
      />
    </div>
  </div>
</template>

<style scoped>
.workbench-shell {
  background: linear-gradient(180deg, rgb(9 21 19 / 0.58), rgb(9 21 19 / 0.88)),
    url('/assets/veiled-harbour/deck-library-study-v2.png') center top / cover no-repeat;
  background-attachment: local;
  min-height: 0;
}
#decks {
  width: calc(100% - clamp(48px, 6vw, 160px));
  min-width: 0;
  margin: 0 auto;
  box-sizing: border-box;
  padding: 28px 0 60px;
}
.decks-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding-bottom: 22px;
  margin-bottom: 24px;
  border-bottom: 1px solid rgb(200 173 120 / 0.35);
}
.decks-heading { min-width: 0; }
.decks-eyebrow {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0 0 8px;
  color: #d0b984;
  font-size: 0.7rem;
  letter-spacing: 0.18em;
}
.decks-eyebrow svg { width: 17px; height: 17px; stroke-width: 1.5; }
.decks-heading h2 {
  color: #f3eddf;
  font: 600 clamp(1.8rem, 2.1vw, 2.5rem) / 1.2 'Source Han Serif', 'Arno', serif;
  letter-spacing: 0.08em;
  margin: 0;
  text-shadow: 0 2px 12px rgb(0 0 0 / 0.4);
}
.decks-intro { margin: 14px 0 0; color: #c7c8b9; font-size: 0.88rem; line-height: 1.7; }
.decks-header-actions { display: flex; align-items: center; flex-wrap: wrap; gap: 12px; }
.builder-new-btn, .new-deck-button {
  display: inline-flex;
  justify-content: center;
  align-items: center;
  gap: 9px;
  min-height: 42px;
  padding: 0 16px;
  box-sizing: border-box;
  border: 1px solid rgb(200 173 120 / 0.55);
  border-radius: 4px;
  background: rgb(16 34 30 / 0.8);
  color: #eee5d1;
  font: inherit;
  font-size: 0.88rem;
  font-weight: 600;
  text-decoration: none;
  cursor: pointer;
  box-shadow: 0 4px 12px rgb(0 0 0 / 0.16);
  transition: background 160ms ease, border-color 160ms ease;
}
.new-deck-button { background: linear-gradient(135deg, #cfba89, #b29a68); color: #1b3028; border-color: #d5c498; }
.builder-new-btn:hover { background: #29473c; border-color: #d5c498; }
.new-deck-button:hover { background: #dbc799; }
.decks-header-actions svg { width: 18px; height: 18px; stroke-width: 1.6; }
.decks-header-actions > :focus-visible { outline: 2px solid #e4ce9b; outline-offset: 4px; }
.new-deck-panel { padding: 24px; margin-bottom: 24px; border: 1px solid #b9a477; border-radius: 6px; background: #e9e2d4; box-shadow: 0 10px 30px rgb(0 0 0 / 0.2); }
.library-layout {
  display: grid;
  grid-template-columns: 184px minmax(0, 1fr);
  gap: 28px;
  align-items: start;
}
.library-sidebar { min-width: 0; }
.library-collection { min-width: 0; padding: 0; }
.toolbar {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 14px;
  margin: 0;
  padding: 12px;
  border: 1px solid rgb(220 211 188 / 0.48);
  border-radius: 5px;
  background: linear-gradient(180deg, rgb(239 233 219 / 0.96), rgb(220 212 194 / 0.94));
  box-shadow: 0 8px 24px rgb(21 29 26 / 0.16);
}
.toolbar :deep(.toolbar-right) { order: -1; display: flex; flex-direction: column; align-items: stretch; gap: 10px; width: 100%; }
.toolbar :deep(.class-filters) { display: grid; grid-template-columns: 1fr; gap: 4px; flex: none; padding-top: 14px; border-top: 1px solid rgb(200 173 120 / 0.2); }
.toolbar :deep(.class-pill) { justify-content: flex-start; gap: 12px; min-height: 38px; width: 100%; padding: 6px 10px; box-shadow: none; border-color: rgb(220 211 188 / 0.44); border-radius: 3px; font-weight: 500; }
.toolbar :deep(.class-pill:not(.active)) { background: rgb(255 252 243 / 0.32); color: #34433b; }
.toolbar :deep(.class-pill:hover) { background: rgb(255 252 243 / 0.72); border-color: #9b8b6b; }
.toolbar :deep(.class-pill.active) { box-shadow: inset 3px 0 #c8ad78; }
.toolbar :deep(.class-pill.active.guardian),
.toolbar :deep(.class-pill.active.seeker),
.toolbar :deep(.class-pill.active.rogue),
.toolbar :deep(.class-pill.active.mystic),
.toolbar :deep(.class-pill.active.survivor),
.toolbar :deep(.class-pill.active.neutral) { border-color: rgb(231 222 198 / 0.82) !important; }
.toolbar :deep(.pill-label) { display: inline; }
.toolbar :deep(.search-input), .toolbar :deep(.sort-select) { width: 100%; min-width: 0; min-height: 40px; box-sizing: border-box; background-color: #f4efe3; color: #2c3b33; border: 1px solid rgb(126 111 83 / 0.56); border-radius: 3px; box-shadow: inset 0 1px 2px rgb(40 45 37 / 0.08); font-size: 0.78rem; }
.toolbar :deep(.search-input::placeholder) { color: #7c806f; }
.toolbar :deep(button:focus-visible), .toolbar :deep(input:focus-visible), .toolbar :deep(select:focus-visible) { outline: 2px solid #d6bd85; outline-offset: 2px; }
.deck-results { display: flex; justify-content: space-between; gap: 16px; color: #c7bea8; font-size: 0.75rem; letter-spacing: 0.06em; margin: 0 0 18px; padding-bottom: 14px; border-bottom: 1px solid rgb(200 173 120 / 0.17); }
.deck-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 244px), 244px)); gap: 18px; align-items: start; justify-content: start; }
.deck-grid :deep(.decklist) { display: flex; flex-direction: column; min-width: 0; gap: 0; padding: 0; border: 1px solid rgb(125 111 83 / 0.58); border-top: 2px solid #e1d5b5; border-radius: 4px; background: linear-gradient(145deg, #f1ecdf, #ddd5c4); color: #29372f; box-shadow: 0 5px 16px rgb(0 0 0 / 0.2); }
.deck-grid :deep(.decklist.guardian),
.deck-grid :deep(.decklist.seeker),
.deck-grid :deep(.decklist.rogue),
.deck-grid :deep(.decklist.mystic),
.deck-grid :deep(.decklist.survivor),
.deck-grid :deep(.decklist.neutral) { border-top-color: #e1d5b5; border-left-color: #e1d5b5; }
.deck-grid :deep(.decklist::after) { display: none; }
.deck-grid :deep(.decklist:hover) { background: linear-gradient(145deg, #f6f1e6, #e6dece); transform: translateY(-2px); box-shadow: 0 8px 20px rgb(0 0 0 / 0.3); }
.deck-grid :deep(.portrait--decklist) { box-sizing: border-box; width: 100%; height: 144px; object-fit: contain; padding: 14px 12px 8px; margin: 0; border: 0; border-bottom: 1px solid rgb(125 111 83 / 0.28); border-radius: 0; background: rgb(54 68 57 / 0.14); box-shadow: none; align-self: stretch; transform: none; }
.deck-grid :deep(.deck-details) { gap: 12px; padding: 10px 14px 8px; }
.deck-grid :deep(.deck-main) { gap: 7px; }
.deck-grid :deep(.deck-name) { color: #29372f; font-family: 'Source Han Serif', 'Arno', serif; font-size: 0.94rem; font-weight: 600; line-height: 1.5; overflow-wrap: anywhere; text-decoration: none; }
.deck-grid :deep(.decklist:hover .deck-name) { color: #725b2f; }
.deck-grid :deep(.deck-badges) { align-items: flex-start; flex-direction: column; gap: 6px; }
.deck-grid :deep(.last-played) { color: #697064; white-space: normal; line-height: 1.5; font-size: 0.72rem; font-weight: 400; }
.deck-grid :deep(.taboo-badge) { font-size: 0.65rem; font-weight: 500; padding: 1px 5px; color: #d1bd8d; border-color: rgb(200 173 120 / 0.2); background: rgb(200 173 120 / 0.06); }
.deck-grid :deep(.deck-actions) { flex-wrap: wrap; justify-content: flex-end; border-top: 1px solid rgb(200 173 120 / 0.14); padding-top: 6px; gap: 4px; }
.deck-grid :deep(.action-btn) { display: inline-flex; align-items: center; justify-content: center; width: 34px; height: 34px; padding: 0; border: 1px solid transparent; border-radius: 3px; background: transparent; box-shadow: none; cursor: pointer; color: #59665a; }
.deck-grid :deep(.action-btn:hover) { color: #29372f; background: rgb(125 111 83 / 0.1); border-color: rgb(125 111 83 / 0.42); }
.deck-grid :deep(.action-btn--delete:hover) { color: #ecaaa1; background: rgb(150 62 54 / 0.16); }
.deck-grid :deep(.action-btn svg) { width: 16px; height: 16px; stroke-width: 1.6; }
.deck-grid :deep(a:focus-visible), .deck-grid :deep(button:focus-visible) { outline: 2px solid #d6bd85; outline-offset: 3px; }
.empty-state { display: grid; justify-items: center; gap: 16px; padding: 48px 20px; text-align: center; color: #e4dcc7; background: rgb(17 34 30 / 0.78); border: 1px solid rgb(200 173 120 / 0.3); border-radius: 5px; }
.empty-state-card { width: 130px; border-radius: 4px; }
@media (max-width: 1000px) {
  .library-layout { grid-template-columns: 176px minmax(0, 1fr); gap: 18px; }
  .library-collection { padding: 0; }
}
@media (max-width: 760px) {
  #decks { width: calc(100% - 24px); padding-top: 22px; }
  .decks-header { flex-wrap: wrap; gap: 18px; }
  .decks-header-actions { gap: 8px; }
  .decks-header-actions > * { padding-inline: 12px; font-size: 0.8rem; }
  .library-layout { grid-template-columns: minmax(0, 1fr); gap: 16px; }
  .toolbar { padding: 12px; gap: 12px; }
  .toolbar :deep(.toolbar-right) { flex-direction: row; flex-wrap: wrap; }
  .toolbar :deep(.search-input) { flex: 1 1 150px; }
  .toolbar :deep(.sort-select) { flex: 1 1 130px; }
  .toolbar :deep(.class-filters) { grid-template-columns: repeat(3, minmax(0, 1fr)); padding-top: 10px; }
  .toolbar :deep(.class-pill) { justify-content: center; min-height: 44px; padding: 6px; gap: 6px; }
  .library-collection { padding: 0; }
  .deck-grid { gap: 14px; }
  .deck-grid :deep(.action-btn) { width: 44px; height: 44px; }
  .new-deck-panel { padding: 16px; }
}
</style>
