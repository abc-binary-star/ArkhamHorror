<script setup lang="ts">
import { computed, inject, ref } from 'vue'
import { Bell, BellOff } from '@lucide/vue'
import { useI18n } from 'vue-i18n'
import type { Game } from '@/arkham/types/Game'
import { spectateKey } from '@/arkham/injectionKeys'
import { setCardSilenced } from '@/arkham/api'

/* Per-card silence toggle: while muted, the engine stops offering this card's
 * non-forced window triggers and fast play offers, so it only responds when
 * the player unsilences it and deliberately fires it. Renders nothing unless
 * the viewer controls the owning investigator. Positioning belongs to the
 * parent via the root button. */
const props = defineProps<{
  game: Game
  playerId: string
  investigatorId: string | null
  cardCode: string
}>()
const { t } = useI18n()
const spectate = inject(spectateKey, ref(false))
const investigator = computed(() =>
  props.investigatorId ? props.game.investigators[props.investigatorId] : undefined,
)
const editable = computed(
  () => !spectate.value && !!investigator.value && investigator.value.playerId === props.playerId,
)
const silenced = computed(
  () => investigator.value?.settings.perCardSettings[props.cardCode]?.cardSilenced === true,
)
function toggle() {
  if (!editable.value || !props.investigatorId) return
  void setCardSilenced(props.game.id, props.investigatorId, props.cardCode, !silenced.value)
}
</script>

<template>
  <button
    v-if="editable"
    type="button"
    class="silence-bell"
    :class="{ 'silence-bell--muted': silenced }"
    :aria-pressed="silenced"
    :aria-label="silenced ? t('player.unsilenceCard') : t('player.silenceCard')"
    v-tooltip="silenced ? t('player.unsilenceCard') : t('player.silenceCard')"
    @click.stop.prevent="toggle"
  >
    <component :is="silenced ? BellOff : Bell" aria-hidden="true" />
  </button>
</template>

<style scoped>
/* Same bare-glyph language as the card-options gear: no pill, no border, only
   drop-shadows, so it survives light card art in the shared top-left corner. */
.silence-bell {
  position: absolute;
  left: 3px;
  top: 3px;
  z-index: var(--z-index-3);
  display: grid;
  place-items: center;
  width: 18px;
  height: 18px;
  padding: 0;
  margin: 0;
  border: 0;
  background: none;
  cursor: pointer;
  color: rgba(255, 255, 255, 0.62);
  filter: drop-shadow(0 0 1px rgba(0, 0, 0, 0.95)) drop-shadow(0 1px 2px rgba(0, 0, 0, 0.85));
  transition: color 0.15s ease;
}

.silence-bell svg {
  width: 13px;
  height: 13px;
}

.silence-bell:hover {
  color: var(--text);
}

.silence-bell--muted {
  color: #e2c2ff;
  filter: drop-shadow(0 0 1px rgba(0, 0, 0, 0.95)) drop-shadow(0 0 4px rgba(226, 194, 255, 0.75));
}
</style>
