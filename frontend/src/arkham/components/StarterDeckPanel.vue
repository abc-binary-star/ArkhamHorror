<script lang="ts" setup>
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from 'vue-toastification'
import { Check, ChevronDown } from '@lucide/vue'
import type { ArkhamDbDecklist, Deck } from '@/arkham/types/Deck'
import { newDeck } from '@/arkham/api'
import starterDeckData from '@/arkham/data/community-starter-decks.json'

interface StarterDeck {
  slots: Record<string, number>
  sideSlots?: Record<string, number>
  investigator_code: string
  investigator_name: string
  meta?: string | null
  taboo_id?: number | null
  url?: string | null
  id: string
  name: string
}

const starters = starterDeckData as StarterDeck[]

const props = defineProps<{ decks: Deck[] }>()
const emit = defineEmits<{ (e: 'added', deck: Deck): void }>()

const { t } = useI18n()
const toast = useToast()
const saving = ref<string | null>(null)
const errorOf = ref<Record<string, string>>({})

/* The backend generates its own deck id on create, and the client deck
 * projection drops the decklist id, so "already added" is detected by the
 * deck name. Starter deck names are long, unique community titles, so a
 * rename is the only way to make a deck offer itself twice. */
const isAdded = (s: StarterDeck) => props.decks.some((d) => d.name === s.name)

function plainNotes(s: StarterDeck): string {
  if (!s.meta) return ''
  try {
    const parsed = JSON.parse(s.meta) as Record<string, unknown>
    const md = parsed?.arkham_horror_description_md
    if (typeof md !== 'string') return ''
    return md.replace(/<[^>]*>/g, '').trim()
  } catch {
    return ''
  }
}

async function add(s: StarterDeck) {
  if (saving.value || isAdded(s)) return
  saving.value = s.id
  try {
    // url stays null on purpose: the deck must be self-contained rather than
    // re-syncing from the community builder it was authored on.
    const deckList: ArkhamDbDecklist = {
      id: s.id,
      url: null,
      meta: s.meta ?? undefined,
      name: s.name,
      investigator_code: s.investigator_code,
      investigator_name: s.investigator_name,
      slots: s.slots,
      sideSlots: s.sideSlots,
      taboo_id: s.taboo_id ?? null,
    }
    const created = await newDeck(s.id, s.name, null, deckList)
    toast.success(t('deckList.starterDeckAddedToast'), { timeout: 3000 })
    emit('added', created)
  } catch (err: unknown) {
    const response = err as { response?: { data?: unknown } }
    const payload = response.response?.data
    let msg = t('pleaseTryAgainLater')
    if (Array.isArray(payload)) {
      const codes = payload
        .map((e) => (typeof e === 'object' && e !== null && 'contents' in e ? String((e as { contents: unknown }).contents) : String(e)))
        .join(', ')
      msg = t('deckList.starterDeckUnimplemented', { cards: codes })
    } else if (payload && typeof payload === 'object' && 'message' in payload) {
      msg = String((payload as { message: unknown }).message)
    }
    errorOf.value = { ...errorOf.value, [s.id]: msg }
  } finally {
    saving.value = null
  }
}
</script>

<template>
  <div class="starter-decks">
    <p class="starter-hint">{{ t('deckList.starterDeckHint') }}</p>
    <div v-for="s in starters" :key="s.id" class="starter-card">
      <div class="starter-info">
        <div class="starter-name">{{ s.name }}</div>
        <div class="starter-investigator">{{ s.investigator_name }}</div>
        <details v-if="plainNotes(s)" class="starter-notes">
          <summary>{{ t('deckList.starterDeckNotes') }}<ChevronDown aria-hidden="true" /></summary>
          <p class="notes-body">{{ plainNotes(s) }}</p>
        </details>
        <p v-if="errorOf[s.id]" class="starter-error">{{ errorOf[s.id] }}</p>
      </div>
      <button
        class="starter-add"
        type="button"
        :disabled="isAdded(s) || saving === s.id"
        @click="add(s)"
      >
        <Check v-if="isAdded(s)" aria-hidden="true" />
        {{ isAdded(s) ? t('deckList.starterDeckInLibrary') : t('deckList.starterDeckAdd') }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.starter-decks { display: grid; gap: 12px; }
.starter-hint { margin: 0; color: #5b5643; font-size: 0.85rem; }
.starter-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 14px;
  border: 1px solid #c9b98f;
  border-radius: 5px;
  background: #fbf7ea;
  box-shadow: 0 1px 3px rgb(74 59 32 / 0.08);
}
.starter-info { min-width: 0; }
.starter-name { font-weight: 650; color: #344136; font-size: 0.92rem; }
.starter-investigator { margin-top: 2px; color: #6d6752; font-size: 0.82rem; }
.starter-notes { margin-top: 6px; font-size: 0.82rem; color: #5b5643; }
.starter-notes summary {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  color: #53694b;
  font-weight: 600;
  list-style: none;
}
.starter-notes summary::-webkit-details-marker { display: none; }
.starter-notes summary svg { width: 14px; height: 14px; transition: transform 140ms ease; }
.starter-notes[open] summary svg { transform: rotate(180deg); }
.notes-body {
  margin: 8px 0 0;
  padding: 10px 12px;
  border: 1px solid #ded3b4;
  border-radius: 4px;
  background: #f7f2e2;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 260px;
  overflow-y: auto;
  line-height: 1.55;
}
.starter-error { margin: 6px 0 0; color: #8c3d2e; font-size: 0.82rem; }
.starter-add {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 38px;
  padding: 6px 14px;
  border: 1px solid #ad9566;
  border-radius: 4px;
  background: linear-gradient(#fcfaf2, #f0eadb);
  color: #344136;
  font: inherit;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 2px 4px rgb(74 59 32 / 0.1), inset 0 1px rgb(255 255 255 / 0.5);
}
.starter-add:hover:not(:disabled) { background: #fffdf5; border-color: #75633e; }
.starter-add:disabled { cursor: default; color: #6d6752; background: #eee8d6; border-color: #c9bd9c; box-shadow: none; }
.starter-add svg { width: 15px; height: 15px; }
</style>
