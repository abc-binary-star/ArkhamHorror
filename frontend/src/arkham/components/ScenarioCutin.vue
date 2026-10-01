<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ScenarioCutin } from '@/arkham/composables/useScenarioCutins'

const props = defineProps<{ cutin: ScenarioCutin | null }>()
const emit = defineEmits<{ skip: []; ready: []; failed: [] }>()
const { locale, t } = useI18n({
  useScope: 'local',
  messages: {
    zh: { act: '场景推进', agenda: '密谋降临', skip: '跳过 · Esc' },
    en: { act: 'Act advances', agenda: 'Agenda arrives', skip: 'Skip · Esc' },
  },
})
const title = computed(() => props.cutin?.title[locale.value.startsWith('zh') ? 'zh' : 'en'] ?? '')
const loaded = ref(false)
const button = ref<HTMLButtonElement | null>(null)
let previousFocus: HTMLElement | null = null
let focusGeneration = 0

function restoreFocus() {
  if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true })
  previousFocus = null
}

watch(() => props.cutin, async (value, previous) => {
  const run = ++focusGeneration
  loaded.value = false
  if (!value) {
    restoreFocus()
    return
  }
  if (!previous) previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
  await nextTick()
  if (run === focusGeneration) button.value?.focus({ preventScroll: true })
}, { immediate: true })

function ready() {
  loaded.value = true
  emit('ready')
}

onBeforeUnmount(() => { focusGeneration++; restoreFocus() })
</script>

<template>
  <Teleport to="body">
    <div
      v-if="cutin"
      :key="cutin.code"
      class="scenario-cutin"
      :class="{ 'scenario-cutin--loaded': loaded, 'scenario-cutin--agenda': cutin.kind === 'agenda' }"
      role="dialog"
      aria-modal="true"
      aria-labelledby="scenario-cutin-title"
      @click.stop="emit('skip')"
      @keydown.esc.stop.prevent="emit('skip')"
      @keydown.enter.stop.prevent="emit('skip')"
      @keydown.space.stop.prevent="emit('skip')"
      @keydown.tab.stop.prevent="button?.focus()"
    >
      <div class="scenario-cutin__veil" aria-hidden="true" />
      <section class="scenario-cutin__panel">
        <img :src="cutin.image" :alt="title" class="scenario-cutin__art no-overlay" @load="ready" @error="emit('failed')" />
        <div class="scenario-cutin__shade" aria-hidden="true" />
        <div class="scenario-cutin__caption">
          <span>{{ t(cutin.kind) }}</span>
          <h2 id="scenario-cutin-title">{{ title }}</h2>
        </div>
        <div class="scenario-cutin__streaks" aria-hidden="true" />
      </section>
      <button ref="button" type="button" class="scenario-cutin__skip" @click.stop="emit('skip')">{{ t('skip') }}</button>
    </div>
  </Teleport>
</template>

<style scoped>
.scenario-cutin {
  --cutin-accent: #edc785;
  position: fixed;
  inset: 0;
  z-index: var(--z-tooltip-over-menus);
  display: grid;
  place-items: center;
  cursor: pointer;
  isolation: isolate;
}
.scenario-cutin--agenda { --cutin-accent: #ff8d60; }
.scenario-cutin__veil { position: absolute; inset: 0; background: rgb(4 6 12 / 82%); }
.scenario-cutin__panel {
  position: relative;
  width: min(1440px, 100vw);
  aspect-ratio: 16 / 9;
  max-height: 84dvh;
  overflow: hidden;
  clip-path: polygon(0 5%, 100% 0, 100% 95%, 0 100%);
  background: #11121a;
  opacity: 0;
}
.scenario-cutin--loaded .scenario-cutin__panel { animation: cutin-enter 340ms cubic-bezier(.16, 1, .3, 1) both; }
.scenario-cutin__art { width: 100%; height: 100%; object-fit: cover; object-position: center; }
.scenario-cutin--loaded .scenario-cutin__art { animation: cutin-camera 3.2s ease-out both; }
.scenario-cutin__shade { position: absolute; inset: 0; background: linear-gradient(transparent 45%, rgb(2 3 8 / 88%) 100%); }
.scenario-cutin__caption { position: absolute; left: clamp(24px, 6vw, 100px); right: 24px; bottom: 11%; color: #fff7e8; }
.scenario-cutin__caption span { color: var(--cutin-accent); font-size: clamp(12px, 1.3vw, 19px); font-weight: 700; letter-spacing: .18em; }
.scenario-cutin__caption h2 { margin: 8px 0 0; font-size: clamp(26px, 4.5vw, 66px); font-weight: 900; line-height: 1.15; text-shadow: 2px 3px #111, 0 3px 18px #000; }
.scenario-cutin__streaks { position: absolute; inset: 0; pointer-events: none; border-block: 3px solid var(--cutin-accent); background: linear-gradient(168deg, rgb(255 245 226 / 12%) 0 1%, transparent 1% 97%, rgb(255 245 226 / 10%) 97%); }
.scenario-cutin__skip { position: absolute; right: max(24px, env(safe-area-inset-right)); bottom: max(22px, env(safe-area-inset-bottom)); border: 1px solid #ffffff80; border-radius: 4px; padding: 9px 16px; background: #111620; color: #fff7e8; font-size: 14px; cursor: pointer; }
.scenario-cutin__skip:focus-visible { outline: 2px solid var(--cutin-accent); outline-offset: 4px; }
@keyframes cutin-enter { from { opacity: 0; transform: translateX(-9%) scale(.97); } to { opacity: 1; transform: none; } }
@keyframes cutin-camera { from { transform: scale(1.08); } to { transform: scale(1); } }
@media (max-width: 600px) { .scenario-cutin__panel { aspect-ratio: 4 / 3; } .scenario-cutin__caption { left: 22px; bottom: 14%; } }
@media (prefers-reduced-motion: reduce) {
  .scenario-cutin--loaded .scenario-cutin__panel { animation: none; opacity: 1; }
  .scenario-cutin--loaded .scenario-cutin__art { animation: none; }
}
</style>
