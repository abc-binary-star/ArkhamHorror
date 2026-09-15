<script setup lang="ts">
import { computed, inject, onBeforeUnmount, ref, watch } from 'vue'
import { Bell, BellOff } from '@lucide/vue'
import { useI18n } from 'vue-i18n'
import type { Game } from '@/arkham/types/Game'
import { spectateKey } from '@/arkham/injectionKeys'
import { setCardPromptMode } from '@/arkham/api'

const props = defineProps<{ game: Game; playerId: string; investigatorId: string; cardCode: string; compact?: boolean }>()
const { t } = useI18n()
const spectate = inject(spectateKey, ref(false))
const saving = ref(false)
const error = ref(false)
const menuOpen = ref(false)
const investigator = computed(() => props.game.investigators[props.investigatorId])
const editable = computed(() => !spectate.value && investigator.value?.playerId === props.playerId)
const mode = computed(() => investigator.value?.settings.perCardSettings[props.cardCode]?.cardPromptMode ?? 'normal')
const modes = ['normal', 'ownTurn', 'untilNextTurn', 'off']
async function save(value: string) {
  if (!editable.value || saving.value) return
  saving.value = true
  error.value = false
  try {
    await setCardPromptMode(props.game.id, props.investigatorId, props.cardCode, value)
  } catch {
    error.value = true
  } finally {
    saving.value = false
  }
}
function change(event: Event) {
  const select = event.target as HTMLSelectElement
  const value = select.value
  save(value).finally(() => { select.value = mode.value })
}
function pick(value: string) {
  void save(value)
  menuOpen.value = false
}
function closeOnOutside() { menuOpen.value = false }
watch(menuOpen, open => {
  if (open) document.addEventListener('pointerdown', closeOnOutside, { capture: true })
  else document.removeEventListener('pointerdown', closeOnOutside, { capture: true })
})
onBeforeUnmount(() => document.removeEventListener('pointerdown', closeOnOutside, { capture: true }))
</script>

<template>
  <div v-if="editable" class="card-prompt-settings" :class="{ configured: mode !== 'normal', compact }" @click.stop @pointerdown.stop>
    <template v-if="compact">
      <button type="button" class="bell-toggle" :aria-label="t('cardOption.prompt.title')" :aria-expanded="menuOpen" @click.stop="menuOpen = !menuOpen">
        <component :is="mode === 'normal' ? Bell : BellOff" aria-hidden="true" />
      </button>
      <div v-if="menuOpen" class="mode-menu" role="menu" :aria-label="t('cardOption.prompt.title')">
        <button
          v-for="value in modes"
          :key="value"
          type="button"
          role="menuitemradio"
          :aria-checked="mode === value"
          :class="{ active: mode === value }"
          :disabled="saving"
          @click.stop="pick(value)"
        >
          {{ t(`cardOption.prompt.${value}`) }}
        </button>
      </div>
    </template>
    <label v-else :title="t('cardOption.prompt.shared')">
      <component :is="mode === 'normal' ? Bell : BellOff" aria-hidden="true" />
      <select :value="mode" :disabled="saving" :aria-label="t('cardOption.prompt.title')" @change="change">
        <option v-for="value in modes" :key="value" :value="value">{{ t(`cardOption.prompt.${value}`) }}</option>
      </select>
    </label>
    <span v-if="error" role="alert">{{ t('cardOption.prompt.error') }}</span>
  </div>
</template>

<style scoped>
.card-prompt-settings { color: var(--text-on-dark); font-size: 11px; }
.card-prompt-settings label { display: inline-flex; align-items: center; gap: 3px; padding: 3px; border-radius: 4px; background: var(--background-dark); }
.card-prompt-settings svg { width: 14px; height: 14px; flex-shrink: 0; }
.card-prompt-settings select { min-width: 0; max-width: 100%; color: inherit; background: var(--background-dark); border: 0; font: inherit; cursor: pointer; }
.card-prompt-settings.configured { color: #e2c2ff; }
.card-prompt-settings select:focus-visible { outline: 2px solid var(--select); }
.card-prompt-settings [role="alert"] { display: block; color: var(--survivor); background: var(--background-dark); }
.bell-toggle { display: flex; align-items: center; justify-content: center; width: 22px; height: 22px; min-height: 0; padding: 0; border: 1px solid #a58cba80; border-radius: 4px; color: #eee5d2; background: #342d3ce6; cursor: pointer; }
.card-prompt-settings.configured .bell-toggle { color: #e2c2ff; }
.bell-toggle svg { width: 14px; height: 14px; }
.mode-menu { position: absolute; top: calc(100% + 2px); left: 0; z-index: 30; display: flex; flex-direction: column; padding: 3px; border: 1px solid #a58cba80; border-radius: 6px; background: linear-gradient(145deg, #302d38, #1b2425); box-shadow: 0 12px 40px #000a; }
.mode-menu button { min-height: 0; padding: 5px 10px; border: 0; border-radius: 4px; color: #eee5d2; font: inherit; font-size: 11px; text-align: left; white-space: nowrap; background: transparent; cursor: pointer; }
.mode-menu button.active { color: #e2c2ff; background: #ffffff14; }
.mode-menu button:disabled { opacity: .6; cursor: wait; }
</style>
