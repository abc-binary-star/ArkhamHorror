<script setup lang="ts">
import { computed, inject, ref } from 'vue'
import { Bell, BellOff, Zap } from '@lucide/vue'
import { useI18n } from 'vue-i18n'
import type { Game } from '@/arkham/types/Game'
import { spectateKey } from '@/arkham/injectionKeys'
import { setCardResponseMode, type CardResponseMode } from '@/arkham/api'
import { useToast } from 'vue-toastification'
import { isAxiosError } from 'axios'

// Response preferences are shared by copies of a card and persisted by the engine.
const props = defineProps<{
  game: Game
  playerId: string
  investigatorId: string | null
  cardCode: string
}>()
const { t } = useI18n({ useScope: 'local', messages: {
  zh: { normal: '正常：自行选择是否应用', silent: '静默：不响应', automatic: '默认响应：触发时直接应用', toggle: '{current}；点击切换为{next}', failed: '切换响应模式失败，请重试', serverFailed: '切换响应模式失败（HTTP {status}）：{reason}', outdated: '后端无法识别三种响应模式，请重新编译并重启后端后重试。', disconnected: '未收到后端响应，请检查后端服务和网络连接。' },
  en: { normal: 'Normal: choose whether to respond', silent: 'Silent: do not respond', automatic: 'Automatic: apply when triggered', toggle: '{current}; click to switch to {next}', failed: 'Could not change response mode. Please retry.', serverFailed: 'Could not change response mode (HTTP {status}): {reason}', outdated: 'The backend does not recognize response modes. Rebuild and restart the backend, then retry.', disconnected: 'No response from the backend. Check the server and your connection.' },
} })
const toast = useToast()
const saving = ref(false)
const spectate = inject(spectateKey, ref(false))
const investigator = computed(() =>
  props.investigatorId ? props.game.investigators[props.investigatorId] : undefined,
)
const editable = computed(
  () => !spectate.value && !!investigator.value && investigator.value.playerId === props.playerId,
)
const mode = computed<CardResponseMode>(() => {
  const settings = investigator.value?.settings.perCardSettings[props.cardCode]
  return settings?.cardSilenced ? 'SilentResponse' : settings?.cardAutoRespond ? 'AutomaticResponse' : 'NormalResponse'
})
const nextMode = computed<CardResponseMode>(() => mode.value === 'NormalResponse' ? 'SilentResponse'
  : mode.value === 'SilentResponse' ? 'AutomaticResponse' : 'NormalResponse')
const labels = { NormalResponse: 'normal', SilentResponse: 'silent', AutomaticResponse: 'automatic' } as const
const tooltip = computed(() => t('toggle', { current: t(labels[mode.value]), next: t(labels[nextMode.value]) }))
async function toggle() {
  if (!editable.value || !props.investigatorId || saving.value) return
  saving.value = true
  try {
    await setCardResponseMode(props.game.id, props.investigatorId, props.cardCode, nextMode.value)
  } catch (error) {
    if (isAxiosError(error)) {
      if (!error.response) {
        toast.error(t('disconnected'))
      } else {
        const data: unknown = error.response.data
        const details = typeof data === 'object' && data !== null
          ? data as Record<string, unknown> : undefined
        const reason = (typeof data === 'string' ? data : [
          details?.message,
          details?.error,
          ...(Array.isArray(details?.errors) ? details.errors : []),
        ].filter((value): value is string => typeof value === 'string').join(' '))
        const unsupportedMode = error.response.status === 400
          && reason.includes('SetCardResponseMode')
          && /unknown|unrecognized|not found|not one of|expected.*tag/i.test(reason)
        toast.error(unsupportedMode ? t('outdated') : t('serverFailed', {
          status: error.response.status,
          reason: reason.slice(0, 500) || error.response.statusText || t('failed'),
        }), { timeout: 10000 })
      }
    } else {
      toast.error(t('failed'))
    }
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <button
    v-if="editable"
    type="button"
    class="silence-bell"
    :class="{ 'silence-bell--muted': mode === 'SilentResponse', 'silence-bell--automatic': mode === 'AutomaticResponse' }"
    :disabled="saving"
    :aria-label="tooltip"
    v-tooltip="tooltip"
    @click.stop.prevent="toggle"
  >
    <component :is="mode === 'SilentResponse' ? BellOff : mode === 'AutomaticResponse' ? Zap : Bell" aria-hidden="true" />
  </button>
</template>

<style scoped>
/* Same bare-glyph language as the card-options gear: no pill, no border, only
   drop-shadows, so it survives light card art in the shared top-left corner. */
.silence-bell {
  position: absolute;
  left: 1px;
  top: 1px;
  z-index: var(--z-index-3);
  display: grid;
  place-items: center;
  width: 18px;
  height: 18px;
  /* Global `button { min-height: var(--control-height) }` would stretch the box
     and sink the glyph well below the corner. */
  min-height: 0;
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
.silence-bell--automatic {
  color: #e8c66b;
  filter: drop-shadow(0 0 2px #000);
}
</style>
