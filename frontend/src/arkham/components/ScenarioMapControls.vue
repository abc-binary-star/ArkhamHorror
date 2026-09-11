<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { Move } from '@lucide/vue'
import { ArrowUturnLeftIcon, LockClosedIcon, LockOpenIcon } from '@heroicons/vue/20/solid'

// Map controls pinned to the top-right of the board: pan mode, the location-drag
// lock, and layout reset. Zoom stays on the wheel; fullscreen lives in the bar.
defineProps<{
  mapMoveMode: boolean
  locationsUnlocked: boolean
  mapResetting: boolean
}>()

const emit = defineEmits<{
  'update:mapMoveMode': [value: boolean]
  toggleLock: []
  reset: []
}>()

const { t } = useI18n()
</script>

<template>
<!-- Map controls pinned to the top-right corner: lock/unlock dragging,
   plus layout reset once anything has been dragged. Zoom lives on the
   mouse wheel; fullscreen lives in the game bar. -->
<div class="map-corner-controls">
  <button type="button" class="zoom-btn" :class="{ 'zoom-btn--active': mapMoveMode }" :aria-pressed="mapMoveMode" :aria-label="t('multiplayerTable.moveMap')" v-tooltip="t('multiplayerTable.moveMap')" @click.stop="emit('update:mapMoveMode', !mapMoveMode)">
    <Move class="zoom-btn__icon" />
  </button>
  <button
    class="zoom-btn"
    :class="{ 'zoom-btn--active': locationsUnlocked }"
    @click.stop="emit('toggleLock')"
    v-tooltip="$t(locationsUnlocked ? 'multiplayerTable.lockLocations' : 'multiplayerTable.unlockLocations')"
  >
    <LockOpenIcon v-if="locationsUnlocked" class="zoom-btn__icon" />
    <LockClosedIcon v-else class="zoom-btn__icon" />
  </button>
  <button
    type="button"
    :disabled="mapResetting"
    :aria-label="t('multiplayerTable.resetMap')"
    class="zoom-btn map-reset-button"
    @click.stop="emit('reset')"
    v-tooltip="$t('multiplayerTable.resetMap')"
  >
    <ArrowUturnLeftIcon class="zoom-btn__icon" />
    <span>{{ t('multiplayerTable.resetMapShort') }}</span>
  </button>
</div>
</template>

<style scoped>
.zoom-btn {
  background: none;
  border: none;
  color: var(--text-on-dark);
  font-size: 18px;
  width: 22px;
  height: 22px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  line-height: 1;
  padding: 0;
  transition:
    background 0.15s,
    color 0.15s;
  flex-shrink: 0;

  &:hover {
    background: rgb(244 239 228 / 0.08);
    color: #fff1cc;
  }

  &:active {
    background: var(--button-1-highlight);
    color: white;
  }
}

.zoom-btn--active {
  background: var(--button-1-highlight);
  color: white;
}

.zoom-btn__icon {
  width: 14px;
  height: 14px;
}

.map-corner-controls {
  position: absolute;
  top: 8px;
  right: 10px;
  z-index: var(--z-index-30, 30);
  display: flex;
  align-items: center;
  gap: 4px;
}

.map-corner-controls {
  top: 12px;
  right: 18px;
  max-width: calc(100% - 36px);
  padding: 3px 6px;
  background: rgb(8 25 21 / 0.88);
  border-radius: 4px;
}

.map-corner-controls .map-reset-button {
  width: auto;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding-inline: 8px;
  color: #dfcd9d;
  white-space: nowrap;
  font-size: 0.75rem;
}
</style>
