<script lang="ts" setup>
import { ref, computed } from 'vue'
import {imgsrc, localizeArkhamDBBaseUrl, processArkhamBuildDeck} from '@/arkham/helpers';

const model = defineModel()
const deck = ref<string | null>(null)
const deckUrl = ref<string | null>(null)
const error = ref<string | null>(null)

const arkhamDbRegex = /https:\/\/(?:[a-zA-Z0-9-]+\.)?arkhamdb\.com\/(deck(list)?)(\/view)?\/([^/]+)/
const arkhamBuildShareRegex = /https:\/\/arkham\.build\/(?:deck\/view|share(?:\/view)?)\/([^/?]+)/
const arkhamBuildDecklistRegex = /https:\/\/arkham\.build\/decklist(?:\/view)?\/([^/?]+)/
const isArkhamBuild = computed(() => deck.value && (deck.value.match(arkhamBuildShareRegex) || deck.value.match(arkhamBuildDecklistRegex)))

async function loadDeck() {
  if (!deck.value) return
  model.value = null
  error.value = null

  let matches
  if (matches = deck.value.match(arkhamDbRegex)) {
    deckUrl.value = `${localizeArkhamDBBaseUrl()}/api/public/${matches[1]}/${matches[4]}`
    try {
      const response = await fetch(deckUrl.value)
      if (!response.ok) {
        error.value = "Could not find deck on ArkhamDB."
        return
      }
      const data = await response.json()
      model.value = {...data, url: deckUrl.value}
    } catch {
      error.value = "Could not reach ArkhamDB."
    }
  } else if (matches = deck.value.match(arkhamBuildShareRegex)) {
    deckUrl.value = `https://api.arkham.build/v1/public/share/${matches[1]}`
    try {
      const response = await fetch(deckUrl.value)
      if (response.ok) {
        const data = await response.json()
        const deckData = processArkhamBuildDeck(data, deckUrl.value)
        if (Object.keys(deckData.slots).length === 0) {
          error.value = "Is this deck empty?"
        } else{
          model.value = deckData
        }
      } else {
        error.value = "Could not find deck, please make sure you have created a public share."
      }
    } catch {
      error.value = "Could not find deck, please make sure you have created a public share."
    }
  } else if (matches = deck.value.match(arkhamBuildDecklistRegex)) {
    deckUrl.value = `https://api.arkham.build/v1/public/share/${matches[1]}?type=decklist`
    try {
      const response = await fetch(deckUrl.value)
      if (response.ok) {
        const data = await response.json()
        const deckData = processArkhamBuildDeck(data, deckUrl.value)
        if (Object.keys(deckData.slots).length === 0) {
          error.value = "Is this deck empty?"
        } else{
          model.value = deckData
        }
      } else {
        error.value = "Could not find decklist."
      }
    } catch {
      error.value = "Could not find decklist."
    }
  }
}

function pasteDeck(evt: ClipboardEvent) {
  error.value = null
  if (evt.clipboardData) {
    deck.value = evt.clipboardData.getData('text')
    loadDeck()
  }
}
</script>

<template>
  <input
    type="url"
    v-model="deck"
    @change="loadDeck"
    @paste.prevent="pasteDeck($event)"
    v-bind:placeholder="$t('create.deckUrlPlaceholder')"
  />
  <div class="error" v-if="error">
    <p>{{ error }}</p>
     <img v-if="isArkhamBuild" :src="imgsrc('ui/arkham-build-public-share.jpg')" />
  </div>
</template>

<style scoped>
input {
  outline: 0;
  border: var(--edge-width) solid var(--edge-dim);
  border-radius: var(--radius-md);
  padding: 15px;
  background: var(--input-background);
  color: var(--text);
  width: 100%;
  margin-bottom: 10px;

  &:focus {
    border-color: var(--spooky-green);
    box-shadow: var(--shadow-2);
  }
}

.error {
  background-color: color-mix(in srgb, var(--delete) 12%, var(--surface-panel));
  color: var(--status-danger-text);
  border: var(--edge-width) solid color-mix(in srgb, var(--delete) 45%, transparent);
  width: 100%;
  margin-bottom: 10px;
  padding: 10px;
  border-radius: 5px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  text-transform: uppercase;
  img {
    flex: 0;
    max-width: fit-content;
    border-radius: 5px;
  }
}
</style>
