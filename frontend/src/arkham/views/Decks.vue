<script lang="ts" setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import * as ArkhamDeck from '@/arkham/types/Deck'
import Prompt from '@/components/Prompt.vue'
import LoadState from '@/components/LoadState.vue'
import { fetchDecks, deleteDeck, syncDeck } from '@/arkham/api'
import NewDeck from '@/arkham/components/NewDeck.vue';
import Deck from '@/arkham/components/DeckRow.vue';
import DeckToolbar from '@/arkham/components/DeckToolbar.vue';
import { Import, X, SquarePen } from '@lucide/vue'
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
    return matchesClass
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
      <div class="library-layout">
        <aside class="library-sidebar" :aria-label="$t('deckList.archiveLabel')">
          <div class="library-actions">
            <a class="builder-new-btn" :href="builderCreateUrl" target="_blank" rel="noreferrer noopener">
              <SquarePen aria-hidden="true" />{{ $t('deckList.createInBuilder') }}
            </a>
            <button class="new-deck-button" type="button" :aria-expanded="showNewDeck" aria-controls="new-deck-panel" @click="showNewDeck = !showNewDeck">
              <X v-if="showNewDeck" aria-hidden="true" /><Import v-else aria-hidden="true" />
              {{ showNewDeck ? t('cancel') : t('deckList.newDeck') }}
            </button>
          </div>
          <DeckToolbar
            v-model:filterClasses="filterClasses"
            v-model:sortBy="sortBy"
            :show-search="false"
            show-all-classes
            archive
            class="toolbar"
          />
        </aside>
        <section class="library-collection" :aria-label="$t('decks')">
          <div v-if="showNewDeck" id="new-deck-panel" class="new-deck-panel">
            <NewDeck always-save @new-deck="addDeck" />
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
  background: #b7b39a url('/assets/veiled-harbour/deck-library-morning-v1.png') center top / cover no-repeat;
  background-attachment: local;
  min-height: 0;
}
#decks {
  display: flex;
  flex-direction: column;
  min-height: 100%;
  width: calc(100% - clamp(32px, 6vw, 160px));
  min-width: 0;
  margin: 0 auto;
  box-sizing: border-box;
  padding: 12px 0 16px;
}
.library-layout {
  display: grid;
  flex: 1;
  grid-template-columns: 216px minmax(0, 1fr);
  gap: 6px;
  align-items: stretch;
}
.library-sidebar, .library-collection {
  position: relative;
  min-width: 0;
  box-sizing: border-box;
  border: 1px solid #b5a078;
  border-radius: 7px;
  background: linear-gradient(120deg, rgb(249 246 235 / 0.97), rgb(243 238 221 / 0.87));
  box-shadow: inset 0 0 0 3px #f4efdf, inset 0 0 0 4px rgb(181 160 120 / 0.48), 0 5px 18px rgb(59 47 27 / 0.12);
}
.library-sidebar { padding: 18px 16px; }
.library-collection { padding: 22px; }
.library-actions { display: grid; gap: 9px; margin-bottom: 22px; }
.builder-new-btn, .new-deck-button {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-height: 44px;
  padding: 8px 12px;
  box-sizing: border-box;
  border: 1px solid #ad9566;
  border-radius: 4px;
  background: linear-gradient(#fcfaf2, #f0eadb);
  color: #344136;
  font: inherit;
  font-size: 0.88rem;
  font-weight: 600;
  text-decoration: none;
  cursor: pointer;
  box-shadow: 0 2px 4px rgb(74 59 32 / 0.1), inset 0 1px rgb(255 255 255 / 0.5);
  transition: background 160ms ease, border-color 160ms ease;
}
.new-deck-button { background: linear-gradient(135deg, #43533e, #303e30); color: #f7efd8; }
.builder-new-btn:hover { background: #fffdf5; border-color: #75633e; }
.new-deck-button:hover { background: #4b6046; border-color: #75633e; }
.library-actions svg { width: 19px; height: 19px; stroke-width: 1.6; }
.library-actions > :focus-visible { outline: 2px solid #53694b; outline-offset: 3px; }
.new-deck-panel { padding: 20px; margin-bottom: 20px; border: 1px solid #b9a477; border-radius: 5px; background: #f5f0e4; }
.toolbar {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 18px;
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  box-shadow: none;
}
.toolbar :deep(.toolbar-right) { display: flex; flex-direction: column; align-items: stretch; width: 100%; }
.toolbar :deep(.class-filters) { display: grid; grid-template-columns: 1fr; gap: 0; flex: none; }
.toolbar :deep(.class-pill) {
  justify-content: flex-start;
  gap: 14px;
  min-height: 46px;
  height: auto;
  width: 100%;
  padding: 8px 12px;
  box-shadow: none;
  border: 0;
  border-bottom: 1px solid rgb(167 149 110 / 0.18);
  border-radius: 0;
  background: transparent;
  color: #354337;
  font-weight: 500;
}
.toolbar :deep(.class-pill.active) { background: #d7dac5; color: #2e402e; border-radius: 4px; }
.toolbar :deep(.class-pill:hover) { background: #e4e5d5; color: #2e402e; }
.toolbar :deep(.pill-label) { display: inline; }
.toolbar :deep(.class-pill svg) { width: 18px; height: 18px; stroke-width: 1.6; flex-shrink: 0; }
.toolbar :deep(.sort-select) { width: 100%; min-width: 0; min-height: 40px; box-sizing: border-box; background-color: #f7f3e9; color: #344136; border: 1px solid #b8ad94; border-radius: 4px; font-size: 0.8rem; }
.toolbar :deep(.sort-select option) { background: #f7f3e9; color: #344136; }
.toolbar :deep(button:focus-visible), .toolbar :deep(select:focus-visible) { outline: 2px solid #53694b; outline-offset: 2px; }
.deck-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 320px), 320px)); gap: 18px; align-items: start; justify-content: start; }
.empty-state { display: grid; justify-items: center; gap: 16px; padding: 48px 20px; text-align: center; color: #53604d; }
.empty-state-card { width: 110px; border-radius: 4px; }
@media (max-width: 1000px) {
  .library-layout { grid-template-columns: 190px minmax(0, 1fr); }
  .library-collection { padding: 16px; }
}
@media (max-width: 760px) {
  #decks { width: calc(100% - 20px); padding-top: 10px; }
  .library-layout { grid-template-columns: minmax(0, 1fr); grid-template-rows: auto 1fr; gap: 10px; }
  .library-sidebar { padding: 14px; }
  .library-actions { grid-template-columns: repeat(2, minmax(0, 1fr)); margin-bottom: 12px; }
  .toolbar { gap: 12px; }
  .toolbar :deep(.class-filters) { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .toolbar :deep(.class-pill) { justify-content: center; min-height: 44px; padding: 6px; gap: 6px; }
  .deck-grid { grid-template-columns: repeat(auto-fill, minmax(min(100%, 280px), 1fr)); gap: 14px; }
  .new-deck-panel { padding: 12px; }
}
</style>
