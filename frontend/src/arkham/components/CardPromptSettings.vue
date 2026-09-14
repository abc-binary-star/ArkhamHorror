<script setup lang="ts">
import { computed, inject, ref } from 'vue'
import { Bell, BellOff } from '@lucide/vue'
import { useI18n } from 'vue-i18n'
import type { Game } from '@/arkham/types/Game'
import { spectateKey } from '@/arkham/injectionKeys'
import { setCardPromptMode } from '@/arkham/api'

const props = defineProps<{ game: Game; playerId: string; investigatorId: string; cardCode: string }>()
const { t } = useI18n()
const spectate = inject(spectateKey, ref(false))
const saving = ref(false)
const error = ref(false)
const investigator = computed(() => props.game.investigators[props.investigatorId])
const editable = computed(() => !spectate.value && investigator.value?.playerId === props.playerId)
const mode = computed(() => investigator.value?.settings.perCardSettings[props.cardCode]?.cardPromptMode ?? 'normal')
const modes = ['normal', 'ownTurn', 'untilNextTurn', 'off']
async function change(event: Event) {
  const select = event.target as HTMLSelectElement
  const value = select.value
  if (!editable.value || saving.value) return
  saving.value = true
  error.value = false
  try {
    await setCardPromptMode(props.game.id, props.investigatorId, props.cardCode, value)
  } catch {
    error.value = true
  } finally {
    select.value = mode.value
    saving.value = false
  }
}
</script>

<template>
  <div v-if="editable" class="card-prompt-settings" :class="{ configured: mode !== 'normal' }" @click.stop @pointerdown.stop>
    <label :title="t('cardOption.prompt.shared')">
      <component :is="mode === 'normal' ? Bell : BellOff" aria-hidden="true" />
      <select :value="mode" :disabled="saving" :aria-label="t('cardOption.prompt.title')" @change="change">
        <option v-for="value in modes" :key="value" :value="value">{{ t(`cardOption.prompt.${value}`) }}</option>
      </select>
    </label>
    <span v-if="error" role="alert">{{ t('cardOption.prompt.error') }}</span>
  </div>
</template>

<style scoped>
.card-prompt-settings { color: var(--text); font-size: 11px; }
.card-prompt-settings label { display: flex; align-items: center; gap: 3px; padding: 3px; border-radius: 4px; background: var(--background-dark); }
.card-prompt-settings svg { width: 14px; height: 14px; flex-shrink: 0; }
.card-prompt-settings select { min-width: 0; max-width: 100%; color: inherit; background: var(--background-dark); border: 0; font: inherit; cursor: pointer; }
.card-prompt-settings.configured { color: var(--highlight); }
.card-prompt-settings select:focus-visible { outline: 2px solid var(--select); }
.card-prompt-settings [role="alert"] { display: block; color: var(--survivor); background: var(--background-dark); }
</style>
