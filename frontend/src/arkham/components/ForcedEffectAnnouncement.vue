<script setup lang="ts">
import { onBeforeUnmount, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{ notice?: { id: number; name: string } }>()
const emit = defineEmits<{ finished: [] }>()
const { t } = useI18n({ useScope: 'local', messages: {
  zh: { resolved: '强制效果生效', unnamed: '卡牌能力' },
  en: { resolved: 'Forced effect activated', unnamed: 'Card ability' },
} })
let timer: ReturnType<typeof setTimeout> | undefined
watch(() => props.notice, notice => {
  clearTimeout(timer)
  if (notice) timer = setTimeout(() => emit('finished'), 2200)
}, { immediate: true })
onBeforeUnmount(() => clearTimeout(timer))
</script>

<template>
  <Teleport to="body">
    <Transition name="forced-effect" mode="out-in">
      <div v-if="notice" :key="notice.id" class="forced-effect-announcement" role="status" aria-live="polite">
        <span>{{ t('resolved') }}</span>
        <strong>{{ notice.name || t('unnamed') }}</strong>
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
  width: max-content;
  max-width: min(85vw, 32rem);
  padding: 1rem 2.5rem;
  text-align: center;
  color: #ead9af;
  background: linear-gradient(90deg, transparent, rgba(18, 23, 25, 0.96) 15%, rgba(18, 23, 25, 0.96) 85%, transparent);
  text-shadow: 0 1px 3px #000;
}
.forced-effect-announcement span { font-size: 0.8rem; letter-spacing: 0.15em; }
.forced-effect-announcement strong { font-size: 1.15rem; overflow-wrap: anywhere; }
.forced-effect-enter-active, .forced-effect-leave-active { transition: opacity 0.2s ease; }
.forced-effect-enter-from, .forced-effect-leave-to { opacity: 0; }
@media (prefers-reduced-motion: reduce) {
  .forced-effect-enter-active, .forced-effect-leave-active { transition: none; }
}
</style>
