<script lang="ts" setup>
import { computed, watch, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import {imgsrc} from '@/arkham/helpers';
import { fetchInvestigators, newDeck, validateDeck } from '@/arkham/api'
import ArkhamDbDeck from '@/arkham/components/ArkhamDbDeck.vue';
import { ArkhamDbDecklist } from '@/arkham/types/Deck';
import { useCardStore } from '@/stores/cards'

const { t } = useI18n()

const props = withDefaults(defineProps<{
  noPortrait?: boolean
  alwaysSave?: boolean
  setPortrait?: (src: string) => void
}>(), { noPortrait: false, alwaysSave: false })

const emit = defineEmits(['newDeck', 'newDeckList'])

const store = useCardStore()
const investigators = ref<string[]>([])
const { cards }  = storeToRefs(store)

// Deliberately not awaited at the top level: a rejection there would keep the
// whole panel behind Suspense and never render it. The list is only consulted
// once the user submits a deck list, long after this resolves.
fetchInvestigators()
  .then((result) => { investigators.value = result })
  .catch(() => { investigators.value = [] })

interface UnimplementedCardError {
  tag: string
  contents: string
}

function validationErrorsFromResponse(err: unknown): string[] {
  const response = err as { response?: { data?: unknown } }
  // No response object at all means the request never completed -- it timed out,
  // the connection dropped, or something blocked it. That is not the server
  // telling us anything about the deck, so it must not be reported as one.
  if (!response.response) {
    requestFailed.value = true
    return []
  }
  const payload = response.response?.data
  if (!Array.isArray(payload)) {
    if (payload && typeof payload === 'object' && 'message' in payload) {
      return [String((payload as { message: unknown }).message)]
    }
    return ['Unable to validate deck']
  }

  return payload.map((e) => {
    const code = typeof e === 'object' && e !== null && 'contents' in e
      ? String((e as UnimplementedCardError).contents)
      : String(e)
    const key = normalizeCode(code)
    const hit = cardByCode.value.get(key)
    if (hit) return hit.xp ? `${hit.name.title} (${hit.xp})` : hit.name.title
    return `Unknown card: ${code}`
  })
}

interface ArkhamDBCard {
  name: { title: string; subtitle: string | null }
  cardCode: string
  xp?: string | number | null
}

const errors = ref<string[]>([])
const requestFailed = ref(false)
const valid = ref(false)
const saveDeck = computed(() => props.alwaysSave ? true : saveDeckToggle.value)
const saveDeckToggle = ref(true)
const investigatorError = ref<string | null>(null)
const investigator = ref<string | null>(null)
const deck = ref<string | null>(null)
const deckId = ref<string | null>(null)
const deckName = ref<string | null>(null)
const deckUrl = ref<string | null>(null)
const deckList = ref<ArkhamDbDecklist | null>(null)
const normalizeCode = (code: string) => code.replace(/^c/, '')
// An empty list means the fetch failed or has not landed yet -- that is
// "unknown", not "nothing is implemented", so let the deck through rather than
// rejecting every import.
const isInvestigatorImplemented = (code: string) =>
  investigators.value.length === 0
  || investigators.value.includes(code)
  || investigators.value.includes(normalizeCode(code))
const maybeSetPortrait = (code: string | null | undefined) => {
  if (!code || !props.setPortrait) return
  props.setPortrait(imgsrc(`portraits/${normalizeCode(code)}.jpg`))
}
const resolvedInvestigatorCode = (d: ArkhamDbDecklist) => {
  const meta = (() => {
    if (typeof d.meta !== 'string') return d.meta
    try {
      return JSON.parse(d.meta || '{}')
    } catch (_e) {
      return {}
    }
  })()
  return meta?.alternate_front ?? d.investigator_code
}

function loadDeckFromFile(e: Event) {
  valid.value = false
  const files = (e.target as HTMLInputElement).files || (e as DragEvent).dataTransfer?.files || [];
  const deck = files[0]
  if (deck) {
    const reader = new FileReader()
    reader.onloadend = (e1: ProgressEvent<FileReader>) => {
      if(!e1?.target?.result) return
      let data = JSON.parse(e1.target.result.toString())
      deckList.value = data
      investigator.value = null
      investigatorError.value = null
      if (isInvestigatorImplemented(data.investigator_code)) {
        if(data.meta && data.meta.alternate_front) {
          investigator.value = data.meta.alternate_front
          if (props.setPortrait) {
            props.setPortrait(imgsrc(`portraits/${data.meta.alternate_front.replace('c', '')}.jpg`))
          }
        } else {
          investigator.value = data.investigator_code
          if (props.setPortrait) {
            props.setPortrait(imgsrc(`portraits/${data.investigator_code.replace('c', '')}.jpg`))
          }
        }

      } else {
        investigatorError.value = t('newDeck.investigatorUnimplemented', { name: data.investigator_name })
      }
      deckId.value = data.id.toString()
      deckName.value = data.name

      runValidations()
    }
    reader.readAsText(deck)
  }
}

watch(deckList, loadDeck)

async function loadDeck() {
  valid.value = false
  errors.value = []
  requestFailed.value = false
  investigator.value = null
  investigatorError.value = null

  const dl = deckList.value
  if (!dl) return

  const invCode = resolvedInvestigatorCode(dl)
  const invImplemented = isInvestigatorImplemented(dl.investigator_code)

  if (invImplemented) {
    investigator.value = invCode
    maybeSetPortrait(invCode)
  } else {
    investigatorError.value = t('newDeck.investigatorUnimplemented', { name: dl.investigator_name })
  }

  deckId.value = String(dl.id)
  deckName.value = dl.name
  deckUrl.value = dl.url

  await runValidations()
}

const cardByCode = computed(() => {
  const m = new Map<string, ArkhamDBCard>()
  for (const c of cards.value) m.set(normalizeCode(c.cardCode), c)
  return m
})

async function runValidations() {
  valid.value = false
  errors.value = []
  requestFailed.value = false
  try {
    if (!deckList.value) return
    await validateDeck(deckList.value)
    valid.value = true
  } catch (err: unknown) {
    errors.value = validationErrorsFromResponse(err)
  }
}

const saving = ref(false)

async function createDeck() {
  errors.value = []
  requestFailed.value = false
  if (saving.value || !valid.value || !deckList.value) return

  if (!saveDeck.value) {
    const dl = deckList.value
    deckId.value = null
    deckName.value = null
    deckUrl.value = null
    investigator.value = null
    deck.value = null
    emit('newDeckList', dl)
    return
  }

  if (!(deckId.value && deckName.value)) return

  saving.value = true
  try {
    const created = await newDeck(deckId.value, deckName.value, deckUrl.value, deckList.value)
    deckId.value = null
    deckName.value = null
    deckUrl.value = null
    investigator.value = null
    deck.value = null
    emit('newDeck', created)
  } catch (err: unknown) {
    errors.value = validationErrorsFromResponse(err)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="new-deck">
    <div class="form-body">
      <img v-if="investigator && !noPortrait" class="portrait" :src="imgsrc(`portraits/${investigator.replace('c', '')}.jpg`)" />
      <div class="fields">
        <ArkhamDbDeck v-model="deckList" />
        <input type="file" accept=".json,application/json" @change="loadDeckFromFile" />
        <input v-if="investigator" v-model="deckName" />
        <div v-if="!alwaysSave" class="save-option" :class="{ active: saveDeck }" @click="saveDeckToggle = !saveDeckToggle" role="checkbox" :aria-checked="saveDeck">
          <div class="save-option-body">
            <span class="save-option-title">{{ $t('deckList.saveToDeckList') }}</span>
            <span class="save-option-desc">{{ $t('deckList.saveToDeckListDescription') }}</span>
          </div>
          <div class="save-option-toggle" :class="{ on: saveDeck }">
            <div class="save-option-thumb" />
          </div>
        </div>
        <button :disabled="!valid || saving" @click.prevent="createDeck" class="primary-action">{{ alwaysSave ? t('newDeck.save') : saveDeck ? t('newDeck.saveAndUse') : t('newDeck.useWithoutSaving') }}</button>
      </div>
    </div>
    <div class="errors" v-if="investigatorError">
      {{investigatorError}}
    </div>
    <div class="errors" v-if="requestFailed">
      {{ t('newDeck.requestFailed') }}
    </div>
    <div class="errors" v-if="errors.length > 0">
      <p>{{ t('newDeck.unimplementedError') }}</p>
      <ul>
        <li class="error" v-for="(error, idx) in errors" :key="idx">
          {{error}}
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.new-deck {
  :deep(input[type=url]) {
    margin-bottom: 0;
  }
  :deep(input) {
    outline: 0;
    border: var(--edge-width) solid var(--edge-dim);
    border-radius: var(--radius-md);
    padding: 12px 14px;
    color: var(--text);
    background: var(--input-background);
    width: 100%;
    font-size: 0.92em;
    transition: border-color 120ms ease;

    &:focus {
      border-color: var(--spooky-green);
      box-shadow: var(--shadow-2);
    }
  }
  :deep(input[type=file]) {
    padding: 8px 12px;
    color: var(--text-dim);
    cursor: pointer;

    &::file-selector-button {
      background: var(--surface-raised);
      border: var(--edge-width) solid var(--edge-dim);
      border-radius: var(--radius-sm);
      color: var(--text);
      padding: 5px 12px;
      font-size: 0.82em;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      cursor: pointer;
      margin-right: 10px;
      transition: background 150ms ease;

      &:hover {
        background: var(--surface-panel);
      }
    }
  }
  .portrait {
    margin-right: 10px;
    height: 170px;
    border-radius: 5px;
  }
  .fields {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .errors {
    background-color: color-mix(in srgb, var(--delete) 12%, var(--surface-panel));
    border: var(--edge-width) solid color-mix(in srgb, var(--delete) 45%, transparent);
    border-radius: var(--radius-md);
    color: var(--status-danger-text);
    width: 100%;
    margin-top: 10px;
    padding: 14px 16px;
  }
  /* Save option toggle card */
  .save-option {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    border-radius: var(--radius-md);
    border: var(--edge-width) solid var(--edge-dim);
    background: var(--surface-raised);
    cursor: pointer;
    user-select: none;
    transition: background 150ms ease, border-color 150ms ease;
    width: 100%;

    &:hover {
      background: var(--surface-panel);
    }

    &.active {
      border-color: var(--spooky-green);
      background: color-mix(in srgb, var(--spooky-green) 10%, var(--surface-raised));
    }
  }

  .save-option-body {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .save-option-title {
    font-size: 0.88em;
    font-weight: 600;
    color: var(--text);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .save-option-desc {
    font-size: 0.76em;
    color: var(--text-dim);
  }

  .save-option-toggle {
    width: 38px;
    height: 22px;
    border-radius: 11px;
    background: var(--surface-panel);
    border: var(--edge-width) solid var(--edge-dim);
    position: relative;
    flex-shrink: 0;
    transition: background 200ms ease, border-color 200ms ease;

    &.on {
      background: var(--spooky-green);
      border-color: var(--spooky-green-dark);
    }
  }

  .save-option-thumb {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: white;
    box-shadow: 0 1px 3px rgba(0,0,0,0.4);
    transition: transform 200ms ease;

    .save-option-toggle.on & {
      transform: translateX(16px);
    }
  }

  /* Primary action button */
  button.primary-action {
    outline: 0;
    width: 100%;
    height: 48px;
    border-radius: 5px;
    margin-top: 8px;
    border: var(--edge-width) solid var(--edge-on-accent);
    background: var(--spooky-green);
    color: var(--button-1-text);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    font-size: 0.88em;
    cursor: pointer;
    box-shadow: var(--shadow-3);
    transition: transform 120ms ease, background 160ms ease, box-shadow 160ms ease;

    &:hover:not(:disabled) {
      transform: translateY(-1px);
      background: var(--highlight);
      box-shadow: var(--shadow-4);
    }

    &:active:not(:disabled) {
      transform: translateY(0) scale(0.97);
    }

    &:disabled {
      opacity: 0.55;
      cursor: not-allowed;
      box-shadow: none;
      transform: none;
    }
  }
  display: flex;
  flex-direction: column;
  color: var(--text);
  border-radius: 3px;
  a {
    color: var(--spooky-green-dark);
    font-weight: bolder;
  }
}

.form-body {
  display: flex;
}
</style>
