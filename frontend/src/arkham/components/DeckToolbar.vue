<script lang="ts" setup>
import { capitalize } from '@/arkham/helpers'
import { useI18n } from 'vue-i18n'
import { computed } from 'vue'

const { t } = useI18n()

const props = withDefaults(defineProps<{
  compact?: boolean
  searchPlaceholder?: string
  showValidFilter?: boolean
}>(), { compact: false, searchPlaceholder: '', showValidFilter: false })

const effectivePlaceholder = computed(() => props.searchPlaceholder || t('deckToolbar.searchDecks'))

const allClasses = ["guardian", "seeker", "rogue", "mystic", "survivor", "neutral"]

const search = defineModel<string>('search', { default: '' })
const filterClasses = defineModel<string[]>('filterClasses', { default: () => [] })
const sortBy = defineModel<'name' | 'class'>('sortBy', { default: 'name' })
const validOnly = defineModel<boolean>('validOnly', { default: false })

function toggleClass(c: string) {
  const idx = filterClasses.value.indexOf(c)
  filterClasses.value = idx === -1
    ? [...filterClasses.value, c]
    : filterClasses.value.filter(x => x !== c)
}
</script>

<template>
  <div class="deck-toolbar" :class="{ compact }">
    <div class="class-filters">
      <button
        v-for="iclass in allClasses"
        :key="iclass"
        class="class-pill"
        :class="{ [iclass]: filterClasses.includes(iclass), active: filterClasses.includes(iclass) }"
        :title="capitalize(iclass)"
        @click.prevent="toggleClass(iclass)"
      >
        <span :class="`${iclass}-icon`"></span>
        <span v-if="!compact" class="pill-label">{{ capitalize(iclass) }}</span>
      </button>
    </div>
    <div class="toolbar-right">
      <button
        v-if="showValidFilter"
        type="button"
        class="valid-filter"
        :class="{ active: validOnly }"
        @click.prevent="validOnly = !validOnly"
      >
        Valid decks
      </button>
      <input
        v-model="search"
        class="search-input"
        :placeholder="effectivePlaceholder"
        type="search"
      />
      <select v-model="sortBy" class="sort-select">
        <option value="name">{{ t('deckToolbar.sortName') }}</option>
        <option value="class">{{ t('deckToolbar.sortClass') }}</option>
      </select>
    </div>
  </div>
</template>

<style scoped>
.deck-toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  padding: 10px 12px;
  border-top: 1px solid color-mix(in srgb, var(--brass) 40%, transparent);
  border-bottom: 1px solid var(--box-border);
  background: color-mix(in srgb, var(--surface-panel) 92%, var(--brass));
  box-shadow: inset 0 1px rgba(255, 255, 255, 0.28);
  @media (max-width: 768px) {
    flex-direction: column;
    align-items: stretch;
  }
}

.class-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  flex: 1;
  @media (max-width: 768px) {
    flex: none;
    gap: 4px;
  }
}

.class-pill {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 5px 10px;
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--text-dim);
  background: var(--surface-raised);
  border: var(--edge-width) solid var(--edge-dim);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background 0.12s, color 0.12s, border-color 0.12s;
  user-select: none;

  &:hover { color: var(--text); border-color: var(--spooky-green); }

  &.active.guardian { background: var(--guardian-extra-dark); border-color: var(--guardian-dark); color: #fff; }
  &.active.seeker   { background: var(--seeker-extra-dark);   border-color: var(--seeker-dark);   color: #fff; }
  &.active.rogue    { background: var(--rogue-extra-dark);    border-color: var(--rogue-dark);    color: #fff; }
  &.active.mystic   { background: var(--mystic-extra-dark);   border-color: var(--mystic-dark);   color: #fff; }
  &.active.survivor { background: var(--survivor-extra-dark); border-color: var(--survivor-dark); color: #fff; }
  &.active.neutral  { background: var(--neutral-extra-dark);  border-color: var(--neutral-dark);  color: #fff; }

  span[class$="-icon"] { font-size: 1em; }

  @media (max-width: 768px) {
    flex: 1;
    height: 36px;
    padding: 0;
    .pill-label { display: none; }
    span[class$="-icon"] { font-size: 1.15em; }
  }
}

/* Compact mode: icon-only square buttons */
.compact .class-pill {
  width: 36px;
  height: 36px;
  padding: 0;
  background: var(--surface-raised);
  border-color: var(--edge-dim);
  color: var(--text-dim);

  &:hover { border-color: var(--spooky-green); color: var(--text); }

  span[class$="-icon"] { font-size: 1.15em; }

  &.active.guardian { background: var(--guardian-extra-dark); border-color: var(--guardian-dark); color: #fff; }
  &.active.seeker   { background: var(--seeker-extra-dark);   border-color: var(--seeker-dark);   color: #fff; }
  &.active.rogue    { background: var(--rogue-extra-dark);    border-color: var(--rogue-dark);    color: #fff; }
  &.active.mystic   { background: var(--mystic-extra-dark);   border-color: var(--mystic-dark);   color: #fff; }
  &.active.survivor { background: var(--survivor-extra-dark); border-color: var(--survivor-dark); color: #fff; }
  &.active.neutral  { background: var(--neutral-extra-dark);  border-color: var(--neutral-dark);  color: #fff; }
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
  @media (max-width: 768px) {
    width: 100%;
  }
}

.valid-filter {
  padding: 6px 10px;
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  white-space: nowrap;
  color: var(--text-dim);
  background: var(--surface-raised);
  border: var(--edge-width) solid var(--edge-dim);
  border-radius: var(--radius-sm);
  cursor: pointer;

  &:hover { color: var(--text); border-color: var(--spooky-green); }
  &.active {
    color: #fff;
    background: rgba(110, 134, 64, 0.85);
    border-color: rgba(154, 196, 78, 0.45);
  }
}

.compact .valid-filter {
  background: var(--surface-raised);
  border-color: var(--edge-dim);

  &.active {
    background: rgba(110, 134, 64, 0.85);
    border-color: rgba(154, 196, 78, 0.45);
  }
}

.search-input {
  padding: 6px 10px;
  font-size: 0.82rem;
  color: var(--text);
  background: var(--input-background);
  border: var(--edge-width) solid var(--edge-dim);
  border-radius: var(--radius-sm);
  outline: none;
  width: 180px;
  transition: border-color 0.12s;

  &::placeholder { color: var(--text-faint); }
  &:focus { border-color: var(--spooky-green); box-shadow: var(--shadow-2); }

  @media (max-width: 768px) {
    flex: 1;
    width: unset;
  }
}

.compact .search-input {
  background: var(--input-background);
  border-color: var(--edge-dim);
  color: var(--text);
  width: 140px;

  &::placeholder { color: var(--text-faint); }
  &:focus { border-color: var(--spooky-green); }
}

.sort-select {
  width: max-content;
  padding: 6px 32px 6px 10px;
  font-size: 0.82rem;
  color: var(--text);
  background-color: var(--input-background);
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%23888'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 10px center;
  border: var(--edge-width) solid var(--edge-dim);
  border-radius: var(--radius-sm);
  outline: none;
  cursor: pointer;
  appearance: none;

  option { background: var(--surface-raised); color: var(--text); }
}

.compact .sort-select {
  background-color: var(--input-background);
  border-color: var(--edge-dim);

  option { background: var(--surface-raised); color: var(--text); }
}
</style>
