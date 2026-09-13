<script setup lang="ts">
import { computed, inject, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Moon, Eye, Skull, Flame } from '@lucide/vue'
import type { Phase } from '@/arkham/types/Phase'
import { announcedPhaseKey } from '@/arkham/injectionKeys'
import { PHASE_ANNOUNCEMENT_MS } from '@/arkham/composables/usePhaseAnnouncement'

const { t } = useI18n({
  useScope: 'local',
  fallbackLocale: 'en',
  messages: {
    zh: {
      MythosPhase: { title: '神话阶段', verse: '群星偏移，古老的低语正穿过帷幕。' },
      InvestigationPhase: { title: '调查阶段', verse: '提灯照向未知，真相隐于尘封之处。' },
      EnemyPhase: { title: '敌人阶段', verse: '暗影已闻见你的气息，猎杀将至。' },
      UpkeepPhase: { title: '补给阶段', verse: '拢住最后的火光，在长夜中重整行装。' },
    },
    en: {
      MythosPhase: { title: 'Mythos Phase', verse: 'The stars shift. Ancient whispers pierce the veil.' },
      InvestigationPhase: { title: 'Investigation Phase', verse: 'Raise your lantern. Truth waits beneath the dust.' },
      EnemyPhase: { title: 'Enemy Phase', verse: 'The shadows have caught your scent. The hunt begins.' },
      UpkeepPhase: { title: 'Upkeep Phase', verse: 'Shelter the last flame. Gather your strength for the long night.' },
    },
  },
})

type RoundPhase = Exclude<Phase, 'CampaignPhase'>
const emblems = {
  MythosPhase: { icon: Moon, numeral: 'I', accent: '#bfa2d6' },
  InvestigationPhase: { icon: Eye, numeral: 'II', accent: '#a8c9bd' },
  EnemyPhase: { icon: Skull, numeral: 'III', accent: '#d39686' },
  UpkeepPhase: { icon: Flame, numeral: 'IV', accent: '#ddc18a' },
}
const current = inject(announcedPhaseKey, ref<Phase | null>(null))
const emblem = computed(() => current.value && current.value !== 'CampaignPhase'
  ? emblems[current.value as RoundPhase] : null)
</script>

<template>
  <Teleport to="body">
    <div class="phase-announcer" role="status" aria-live="polite" aria-atomic="true">
      <div
        v-if="current && emblem"
        :key="current"
        class="phase-interlude"
        :style="{ '--phase-accent': emblem.accent, '--phase-duration': `${PHASE_ANNOUNCEMENT_MS}ms` }"
      >
        <div class="phase-interlude__veil" aria-hidden="true" />
        <section class="phase-interlude__panel">
          <span class="phase-interlude__corner phase-interlude__corner--left" aria-hidden="true" />
          <span class="phase-interlude__corner phase-interlude__corner--right" aria-hidden="true" />
          <div class="phase-interlude__seal" aria-hidden="true">
            <component :is="emblem.icon" :size="30" :stroke-width="1.2" />
          </div>
          <div class="phase-interlude__ordinal" aria-hidden="true">{{ emblem.numeral }}</div>
          <h2>{{ t(`${current}.title`) }}</h2>
          <div class="phase-interlude__rule" aria-hidden="true">◆</div>
          <p>{{ t(`${current}.verse`) }}</p>
        </section>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.phase-announcer {
  position: fixed;
  inset: 0;
  z-index: var(--z-tooltip-over-menus);
  pointer-events: none;
}

.phase-interlude {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  opacity: 0;
  animation: phase-revelation var(--phase-duration) ease both;
  pointer-events: auto;
}

.phase-interlude__veil {
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at center, rgb(5 12 16 / 18%), rgb(3 8 11 / 66%));
}

.phase-interlude__panel {
  position: relative;
  box-sizing: border-box;
  width: min(680px, calc(100vw - 36px));
  padding: 28px 36px 32px;
  text-align: center;
  color: #e9d3a3;
  border-block: 1px solid #b59760;
  background:
    radial-gradient(ellipse at 50% 0%, rgb(130 108 73 / 15%), transparent 68%),
    linear-gradient(90deg, rgb(9 18 21 / 88%), #111b20 25%, #111b20 75%, rgb(9 18 21 / 88%));
  box-shadow: 0 20px 80px rgb(0 0 0 / 55%), inset 0 0 0 5px rgb(8 14 17 / 70%);
}

.phase-interlude__panel::before {
  content: '';
  position: absolute;
  inset: 7px 14px;
  border-block: 1px solid rgb(185 155 97 / 28%);
}

.phase-interlude__corner {
  position: absolute;
  top: 18px;
  bottom: 18px;
  width: 22px;
  border-block: 1px solid #c6a874;
}
.phase-interlude__corner--left { left: 22px; border-left: 1px solid #c6a874; }
.phase-interlude__corner--right { right: 22px; border-right: 1px solid #c6a874; }

.phase-interlude__seal {
  position: relative;
  display: grid;
  place-items: center;
  width: 62px;
  height: 62px;
  margin: 0 auto 12px;
  border: 1px solid rgb(198 168 116 / 65%);
  border-radius: 50%;
  color: var(--phase-accent);
  box-shadow: 0 0 24px color-mix(in srgb, var(--phase-accent) 18%, transparent);
}
.phase-interlude__seal::before {
  content: '';
  position: absolute;
  inset: 6px;
  border: 1px solid rgb(198 168 116 / 32%);
  transform: rotate(45deg);
}

.phase-interlude__ordinal {
  color: var(--phase-accent);
  font: 12px Georgia, serif;
  letter-spacing: 0.2em;
}
.phase-interlude h2 {
  margin: 8px 0 10px;
  font-family: 'Songti SC', 'Noto Serif SC', Georgia, serif;
  font-size: clamp(25px, 3vw, 36px);
  font-weight: 500;
  letter-spacing: 0.2em;
  text-indent: 0.2em;
  text-shadow: 0 2px 3px #000, 0 0 22px rgb(217 182 116 / 22%);
}
.phase-interlude__rule {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  color: #b59760;
  font-size: 7px;
}
.phase-interlude__rule::before,
.phase-interlude__rule::after {
  content: '';
  width: 90px;
  height: 1px;
  background: linear-gradient(90deg, transparent, #b59760, transparent);
}
.phase-interlude p {
  margin: 14px 0 0;
  color: #c7c1b1;
  font-family: 'Songti SC', 'Noto Serif SC', Georgia, serif;
  font-size: clamp(13px, 1.3vw, 16px);
  line-height: 1.8;
  letter-spacing: 0.08em;
  text-wrap: balance;
}

@keyframes phase-revelation {
  0% { opacity: 0; transform: translateY(8px); }
  16%, 76% { opacity: 1; transform: translateY(0); }
  100% { opacity: 0; transform: translateY(-4px); }
}
@media (prefers-reduced-motion: reduce) {
  .phase-interlude { animation: none; opacity: 1; }
}
</style>
