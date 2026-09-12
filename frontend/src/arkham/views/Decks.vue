<script lang="ts" setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import * as ArkhamDeck from '@/arkham/types/Deck'
import Prompt from '@/components/Prompt.vue'
import LoadState from '@/components/LoadState.vue'
import { fetchDecks, deleteDeck, syncDeck } from '@/arkham/api'
import NewDeck from '@/arkham/components/NewDeck.vue';
import Deck from '@/arkham/components/DeckRow.vue';
import DeckToolbar from '@/arkham/components/DeckToolbar.vue';
import PrimaryButton from '@/components/PrimaryButton.vue';
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
const sortBy = ref<Arkham.DeckSort>('name')
const filterClasses = ref<InvestigatorClass[]>([])

const CLASS_ORDER: Record<string, number> = {
  guardian: 0, seeker: 1, rogue: 2, mystic: 3, survivor: 4, neutral: 5
}
const allClasses: InvestigatorClass[] = ["guardian", "seeker", "rogue", "mystic", "survivor", "neutral"]

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

  return Arkham.sortDecks(result, sortBy.value)
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
        <h2>{{ $t('decks') }}</h2>
        <a class="builder-new-btn" :href="builderCreateUrl" target="_blank" rel="noreferrer noopener">
          <font-awesome-icon icon="pen" />
          {{ $t('deckList.createInBuilder') }}
        </a>
        <PrimaryButton :label="showNewDeck ? t('cancel') : t('deckList.newDeck')" :danger="showNewDeck" @click="showNewDeck = !showNewDeck" />
      </header>

      <div v-if="showNewDeck" class="new-deck-panel">
        <NewDeck always-save @new-deck="addDeck" />
      </div>

      <DeckToolbar
        v-model:search="searchText"
        v-model:filterClasses="filterClasses"
        v-model:sortBy="sortBy"
        class="toolbar"
      />

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
#decks {
  width: min(1180px, calc(100% - 48px));
  max-width: none;
  min-width: 0;
  margin: 0 auto;
  box-sizing: border-box;
  padding: 28px 0 72px;
  background:
    linear-gradient(rgba(233, 225, 210, 0.84), rgba(233, 225, 210, 0.84)),
    url('/assets/veiled-harbour/44-午夜档案馆工作台-v1.png') center / cover no-repeat;
  border: 1px solid color-mix(in srgb, var(--brass) 30%, transparent);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-2);
  @media (max-width: 768px) {
    width: 100%;
    min-width: unset;
    padding: 18px 14px 56px;
    box-sizing: border-box;
    border-radius: 0;
    border-left: 0;
    border-right: 0;
  }
}

.decks-header {
  display: flex;
  align-items: center;
  margin-bottom: 18px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--box-border);

  h2 {
    flex: 1;
    color: var(--title);
    font-size: 2em;
    font-family: Arno, 'Source Han Serif', serif;
    font-weight: 600;
    letter-spacing: 0.02em;
    margin: 0;
  }

  @media (max-width: 768px) {
    flex-wrap: wrap;
    gap: 8px;
  }
}

.builder-new-btn {
  align-self: center;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  border-radius: var(--control-radius);
  background-color: color-mix(in srgb, var(--brass) 18%, var(--surface-panel));
  color: var(--title);
  font-size: 0.95em;
  font-weight: var(--font-black);
  letter-spacing: 0.05em;
  text-decoration: none;
  box-shadow: var(--shadow-1);
  cursor: pointer;
  transition: filter 120ms ease, transform 80ms ease;

  &:hover {
    filter: brightness(1.06);
    transform: translateY(-1px);
  }

  @media (max-width: 768px) {
    padding: 8px 14px;
    font-size: 0.82em;
  }
}

.new-deck-panel {
  background: var(--surface-panel) url('/assets/veiled-harbour/03-档案纸纹理.svg') repeat;
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-3);
  padding: 20px;
  margin-bottom: 20px;
}

.toolbar {
  margin-bottom: 20px;
}

.empty-state {
  align-items: center;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 40px;
  text-align: center;
  color: var(--text-dim);
  font-size: 0.9rem;
}

.empty-state-card {
  width: min(180px, 48vw);
  aspect-ratio: 4 / 5;
  object-fit: cover;
  border: 1px solid color-mix(in srgb, var(--brass) 54%, transparent);
  border-radius: 6px;
  box-shadow: var(--shadow-3);
}

.deck-grid {
  display: flex;
  flex-direction: column;
  gap: 8px;
}


@media (max-width: 800px), (max-width: 1199px) and (pointer: coarse) {

  .page-content { width: 100%; max-width: 100%; padding: 16px 12px; }
  .decks-header, .toolbar { flex-wrap: wrap; gap: 12px; }
  .deck-grid { grid-template-columns: minmax(0, 1fr); }
  .new-deck-panel { min-width: 0; padding: 12px; }

}
</style>
