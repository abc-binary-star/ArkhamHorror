<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { EnemyEntrance } from '@/arkham/composables/useScenarioCutins'

const props = defineProps<{ entrance: EnemyEntrance | null }>()
const emit = defineEmits<{ skip: []; ready: []; failed: [] }>()
const { locale, t } = useI18n({
  useScope: 'local',
  messages: {
    zh: { boss: '首领降临', elite: '精英登场', skip: '跳过 · Esc' },
    en: { boss: 'Boss arrives', elite: 'Elite arrives', skip: 'Skip · Esc' },
  },
})
const language = computed(() => locale.value.startsWith('zh') ? 'zh' : 'en')
const title = computed(() => props.entrance?.title[language.value] ?? '')
const subtitle = computed(() => props.entrance?.subtitle[language.value] ?? '')
const loaded = ref(false)
const skipButton = ref<HTMLButtonElement | null>(null)
let previousFocus: HTMLElement | null = null
let focusGeneration = 0

function restoreFocus() {
  if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true })
  previousFocus = null
}

watch(() => props.entrance, async (value, previous) => {
  const run = ++focusGeneration
  loaded.value = false
  if (!value) { restoreFocus(); return }
  if (!previous) previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
  await nextTick()
  if (run === focusGeneration) skipButton.value?.focus({ preventScroll: true })
}, { immediate: true })

function ready() { loaded.value = true; emit('ready') }
onBeforeUnmount(() => { focusGeneration++; restoreFocus() })
</script>

<template>
  <Teleport to="body">
    <div
      v-if="entrance"
      :key="entrance.instance"
      class="enemy-entrance"
      :class="[{ 'enemy-entrance--loaded': loaded }, `enemy-entrance--${entrance.tone}`]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="enemy-entrance-title"
      @click.stop="emit('skip')"
      @keydown.esc.stop.prevent="emit('skip')"
      @keydown.enter.stop.prevent="emit('skip')"
      @keydown.space.stop.prevent="emit('skip')"
      @keydown.tab.stop.prevent="skipButton?.focus()"
    >
      <div class="enemy-entrance__darkness" aria-hidden="true" />
      <div class="enemy-entrance__stage">
        <div class="enemy-entrance__halo" aria-hidden="true" />
        <div class="enemy-entrance__portrait">
          <img class="enemy-entrance__art no-overlay" :src="entrance.image" :alt="title" @load="ready" @error="emit('failed')" />
        </div>
        <div class="enemy-entrance__mist" aria-hidden="true" />
        <div class="enemy-entrance__embers" aria-hidden="true">
          <i v-for="n in 12" :key="n" :style="{ '--n': n }" />
        </div>
        <div class="enemy-entrance__caption">
          <span class="enemy-entrance__kind">{{ t(entrance.boss ? 'boss' : 'elite') }}</span>
          <h2 id="enemy-entrance-title">{{ title }}</h2>
          <p v-if="subtitle">{{ subtitle }}</p>
        </div>
      </div>
      <button ref="skipButton" class="enemy-entrance__skip" type="button" @click.stop="emit('skip')">{{ t('skip') }}</button>
    </div>
  </Teleport>
</template>

<style scoped>
.enemy-entrance {
  --entrance-accent: #f0a761;
  --entrance-glow: rgb(177 54 16 / 45%);
  position: fixed;
  inset: 0;
  z-index: var(--z-tooltip-over-menus);
  display: grid;
  place-items: center;
  overflow: hidden;
  isolation: isolate;
  cursor: pointer;
}
.enemy-entrance--ash { --entrance-accent: #d0bc98; --entrance-glow: rgb(141 96 58 / 35%); }
.enemy-entrance--occult { --entrance-accent: #c3b3e6; --entrance-glow: rgb(91 66 133 / 40%); }
.enemy-entrance--noir { --entrance-accent: #b9cacc; --entrance-glow: rgb(64 110 121 / 35%); }
.enemy-entrance__darkness { position: absolute; inset: 0; background: rgb(3 5 9 / 94%); }
.enemy-entrance__stage { position: relative; width: min(1100px, 100vw); height: min(880px, 100dvh); opacity: 0; }
.enemy-entrance--loaded .enemy-entrance__stage { animation: entrance-stage 4s linear both; }
.enemy-entrance__halo { position: absolute; inset: 8% 9% 12%; background: radial-gradient(ellipse, var(--entrance-glow), transparent 66%); }
.enemy-entrance__portrait { position: absolute; inset: 2% 7% 0; transform-origin: 50% 75%; mask-image: linear-gradient(to bottom, #000 76%, transparent 100%); }
.enemy-entrance__art { display: block; width: 100%; height: 100%; object-fit: contain; object-position: center; }
.enemy-entrance--loaded .enemy-entrance__portrait { animation: entrance-portrait 4s cubic-bezier(.16, 1, .3, 1) both; }
.enemy-entrance__mist { position: absolute; inset: 50% -20% -25%; background: radial-gradient(ellipse at 40% 60%, var(--entrance-glow), transparent 65%); pointer-events: none; }
.enemy-entrance--loaded .enemy-entrance__mist { animation: entrance-mist 4s ease-out both; }
.enemy-entrance__embers { position: absolute; inset: 0; overflow: hidden; pointer-events: none; }
.enemy-entrance__embers i { position: absolute; left: calc(8% + var(--n) * 7%); bottom: 12%; width: 2px; height: 4px; background: var(--entrance-accent); box-shadow: 0 0 8px var(--entrance-accent); opacity: 0; }
.enemy-entrance--loaded .enemy-entrance__embers i { animation: entrance-ember 2.4s ease-out infinite; animation-delay: calc(var(--n) * .11s); }
.enemy-entrance__caption { position: absolute; inset-inline: 24px; bottom: max(11%, 85px); text-align: center; color: #f9efdc; text-shadow: 0 2px 5px #000, 0 0 22px #000; }
.enemy-entrance--loaded .enemy-entrance__caption { animation: entrance-caption 4s ease-out both; }
.enemy-entrance__kind { color: var(--entrance-accent); font-size: clamp(11px, 1.5vw, 16px); letter-spacing: .35em; }
.enemy-entrance__caption h2 { margin: 10px 0; font-family: 'Noto Serif SC', Georgia, serif; font-size: clamp(30px, 5vw, 62px); line-height: 1.2; font-weight: 700; letter-spacing: .06em; }
.enemy-entrance__caption p { margin: 0; color: #ddcfbb; font-size: clamp(14px, 2vw, 21px); letter-spacing: .15em; }
.enemy-entrance__skip { position: absolute; right: max(24px, env(safe-area-inset-right)); bottom: max(22px, env(safe-area-inset-bottom)); padding: 9px 16px; border: 1px solid #b5a89180; border-radius: 3px; background: #0d1018; color: #efe5d4; font-size: 14px; cursor: pointer; }
.enemy-entrance__skip:focus-visible { outline: 2px solid var(--entrance-accent); outline-offset: 4px; }
@keyframes entrance-stage { 0% { opacity: 0; } 9%, 86% { opacity: 1; } 100% { opacity: 0; } }
@keyframes entrance-portrait { 0% { transform: translateY(9%) scale(1.09); filter: brightness(.3); } 18% { transform: translateY(0) scale(1.025); filter: brightness(1.12); } 55% { transform: translateY(-.5%) scale(1.035); filter: brightness(1); } 87%, 100% { transform: translateY(0) scale(1.025); filter: brightness(1); } }
@keyframes entrance-caption { 0%, 15% { opacity: 0; transform: translateY(14px); } 28%, 88%, 100% { opacity: 1; transform: none; } }
@keyframes entrance-mist { from { transform: translateX(-7%) scale(.9); } to { transform: translateX(7%) scale(1.1); } }
@keyframes entrance-ember { 0% { opacity: 0; transform: translateY(0) rotate(25deg); } 20%, 60% { opacity: .7; } 100% { opacity: 0; transform: translate(22px, -45vh) rotate(80deg); } }
@media (max-width: 600px) { .enemy-entrance__portrait { inset: 6% -12% 0; } .enemy-entrance__caption { inset-inline: 16px; } }
@media (prefers-reduced-motion: reduce) {
  .enemy-entrance--loaded .enemy-entrance__stage { opacity: 1; animation: none; }
  .enemy-entrance--loaded .enemy-entrance__portrait,
  .enemy-entrance--loaded .enemy-entrance__caption,
  .enemy-entrance--loaded .enemy-entrance__mist { animation: none; }
  .enemy-entrance__embers { display: none; }
}
</style>
