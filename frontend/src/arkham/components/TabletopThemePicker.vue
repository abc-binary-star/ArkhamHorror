<script setup lang="ts">
import { useTabletopTheme, type TabletopTheme } from '@/stores/tabletopTheme'

const emit = defineEmits<{ (event: 'select'): void }>()
const settings = useTabletopTheme()
const options: { id: TabletopTheme; label: string; hint: string }[] = [
  { id: 'harbour', label: 'themeHarbour', hint: 'themeHarbourHint' },
  { id: 'zealot', label: 'themeZealot', hint: 'themeZealotHint' },
  { id: 'dunwich', label: 'themeDunwich', hint: 'themeDunwichHint' },
]
</script>

<template>
  <fieldset class="theme-picker">
    <legend>{{ $t('gameBar.themeTitle') }}</legend>
    <div class="theme-picker__options">
      <button
        v-for="option in options" :key="option.id" type="button"
        class="theme-picker__option" :class="{ 'is-selected': settings.theme === option.id }"
        :aria-pressed="settings.theme === option.id"
        :title="$t(`gameBar.${option.hint}`)"
        @click="settings.theme = option.id; emit('select')"
      >
        <span class="theme-picker__preview" :data-preview="option.id" aria-hidden="true">
          <span v-if="settings.theme === option.id" class="theme-picker__check">✓</span>
        </span>
        <span class="theme-picker__name">{{ $t(`gameBar.${option.label}`) }}</span>
      </button>
    </div>
  </fieldset>
</template>

<style scoped>
.theme-picker { min-width: 0; margin: 0 0 14px; padding: 0; border: 0; }
.theme-picker legend { margin-bottom: 10px; color: var(--text); font-size: 14px; }
.theme-picker__options { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.theme-picker__option { display: flex; flex-direction: column; gap: 7px; min-width: 0; padding: 5px; color: #e9e0d6; background: var(--background-dark); border: 1px solid var(--edge-dim); border-radius: 4px; cursor: pointer; }
.theme-picker__option:hover, .theme-picker__option.is-selected { border-color: #d5ba85; color: #f3e5c6; background: #302c27; }
.theme-picker__option:focus-visible { outline: 2px solid #f3d394; outline-offset: 3px; }
.theme-picker__preview { position: relative; width: 100%; aspect-ratio: 3 / 2; border-radius: 2px; background-position: center; background-size: 100% 100%; box-shadow: inset 0 0 0 1px rgb(221 190 130 / 0.24); }
[data-preview="harbour"] { background-image: url('/assets/veiled-harbour/T04-地点地图底板-v2.avif'); background-color: #183b34; }
[data-preview="zealot"] { background-image: url('../../assets/tabletop-themes/zealot-map-v2.jpg'); }
[data-preview="dunwich"] { background-image: url('../../assets/tabletop-themes/dunwich-map-v2.jpg'); }
.theme-picker__check { position: absolute; right: 4px; bottom: 4px; display: grid; place-items: center; width: 19px; height: 19px; border-radius: 50%; color: #241c14; background: #e5c68b; }
.theme-picker__name { font-size: 12px; line-height: 1.5; text-align: center; overflow-wrap: anywhere; }
</style>
