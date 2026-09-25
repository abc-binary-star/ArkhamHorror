<script setup lang="ts">
import { computed, onBeforeUnmount, watch } from 'vue'
import { useDbCardStore } from '@/stores/dbCards'
import { cardArt } from '@/arkham/cardImages'
import { handleEmbeddedI18n } from '@/arkham/i18n'
import { useI18n } from 'vue-i18n'

const props = defineProps<{ notice?: { id: number; payload: string } }>()
const emit = defineEmits<{ finished: [] }>()
const { t: globalT } = useI18n({ useScope: 'global' })
const dbCards = useDbCardStore()
const { t } = useI18n({ useScope: 'local', messages: {
  zh: { resolved: '强制效果生效', unnamed: '卡牌能力', unavailable: '暂无效果说明，请查看来源卡牌。' },
  en: { resolved: 'Forced effect activated', unnamed: 'Card ability', unavailable: 'Effect description unavailable. Please check the source card.' },
} })
// Accept name-only notices from older servers as well as structured notices.
const details = computed(() => {
  const payload = props.notice?.payload ?? ''
  try {
    const value = JSON.parse(payload)
    if (value && typeof value.name === 'string') return {
      name: value.name as string,
      cardCode: typeof value.cardCode === 'string' ? value.cardCode : '',
      tooltip: typeof value.tooltip === 'string' ? value.tooltip : '',
    }
  } catch { /* Legacy name-only payload. */ }
  return { name: payload, cardCode: '', tooltip: '' }
})
const card = computed(() => details.value.cardCode
  ? dbCards.getDbCard(cardArt(details.value.cardCode))
  : dbCards.getDbCardByRealName(details.value.name))
const name = computed(() => card.value?.name || handleEmbeddedI18n(details.value.name, globalT))
// Render rule text as text, preserving paragraph breaks without injecting HTML.
const plainText = (text: string) => text.replace(/<br\s*\/?>(?:\n)?/gi, '\n').replace(/<[^>]*>/g, '')
const effect = computed(() => {
  if (details.value.tooltip) return plainText(handleEmbeddedI18n(details.value.tooltip, globalT))
  const text = plainText(card.value?.text || card.value?.real_text || '')
  const forced = text.split('\n').filter(line => /^\s*(?:强制|強制|Forced)\s*[:：—–-]/i.test(line))
  // Multiple printed forced abilities cannot safely be mapped by array index.
  return forced.join('\n') || text || t('unavailable')
})
let timer: ReturnType<typeof setTimeout> | undefined
watch(() => props.notice, notice => {
  clearTimeout(timer)
  if (notice) timer = setTimeout(() => emit('finished'), Math.min(16000, Math.max(6000, effect.value.length * 90)))
}, { immediate: true })
onBeforeUnmount(() => clearTimeout(timer))
</script>

<template>
  <Teleport to="body">
    <Transition name="forced-effect" mode="out-in">
      <div v-if="notice" :key="notice.id" class="forced-effect-announcement" role="status" aria-live="polite">
        <span>{{ t('resolved') }}</span>
        <strong>{{ name || t('unnamed') }}</strong>
        <p>{{ effect }}</p>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.forced-effect-announcement {
  position: fixed;
  top: 22%;
  left: 50%;
  transform: translateX(-50%);
  z-index: 12000;
  pointer-events: none;
  display: grid;
  gap: 0.4rem;
  box-sizing: border-box;
  width: 30rem;
  max-width: min(85vw, 32rem);
  padding: 1rem 2.5rem;
  text-align: center;
  color: #ead9af;
  background: linear-gradient(90deg, transparent, rgba(18, 23, 25, 0.96) 15%, rgba(18, 23, 25, 0.96) 85%, transparent);
  text-shadow: 0 1px 3px #000;
}
.forced-effect-announcement p { margin: 0.35rem 0 0; font-size: 0.95rem; line-height: 1.6; text-align: center; white-space: pre-line; overflow-wrap: anywhere; color: #f1eadc; }
.forced-effect-announcement span { font-size: 0.8rem; letter-spacing: 0.15em; }
.forced-effect-announcement strong { font-size: 1.15rem; overflow-wrap: anywhere; }
.forced-effect-enter-active, .forced-effect-leave-active { transition: opacity 0.2s ease; }
.forced-effect-enter-from, .forced-effect-leave-to { opacity: 0; }
@media (prefers-reduced-motion: reduce) {
  .forced-effect-enter-active, .forced-effect-leave-active { transition: none; }
}
</style>
