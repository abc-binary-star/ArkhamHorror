<script lang="ts" setup>
import { computed, ref, watch } from 'vue';
import { useDebug } from '@/arkham/debug';
import { Game } from '@/arkham/types/Game';
import { imgsrc, formatContent } from '@/arkham/helpers';
import * as ArkhamGame from '@/arkham/types/Game';
import { ChaosTokenValueEntry, SkillTest } from '@/arkham/types/SkillTest';
import { MessageType } from '@/arkham/types/Message';
import { ChaosBag } from '@/arkham/types/ChaosBag';
import Token from '@/arkham/components/Token.vue';
import ChaosBagChoice from '@/arkham/components/ChaosBagChoice.vue';
import { chaosTokenEffectKey } from '@/arkham/types/Scenario';
import { useI18n } from 'vue-i18n';
import { Dropdown } from 'floating-vue';
import { chanceOfSuccess } from '@/arkham/chaosBagOdds';
import { chaosTokenImage, compareTokenFaces, numericTokenFaces } from '@/arkham/types/ChaosToken';

const props = defineProps<{
  game: Game
  skillTest: SkillTest | null
  chaosBag: ChaosBag
  playerId: string
}>()

const emit = defineEmits<{
  choose: [value: number]
}>()

const revealedChaosTokens = computed(() => {
  if (props.skillTest) return props.game.skillTestChaosTokens

  if (props.game.focusedChaosTokens.length > 0) {
    const tokens = [...props.game.skillTestChaosTokens, ...props.game.focusedChaosTokens]
    return Array.from(new Set(tokens.map((token) => JSON.stringify(token))))
      .map((token) => JSON.parse(token) as (typeof tokens)[number]);
  }

  return props.game.skillTestChaosTokens;
})

const choices = computed(() => ArkhamGame.choices(props.game, props.playerId))
const tokenAction = computed(() => choices.value.findIndex((c) => c.tag === MessageType.START_SKILL_TEST_BUTTON))
const debug = useDebug()
const { t } = useI18n()
const allTokenFaces = computed(() => props.chaosBag.chaosTokens.map(t => t.face).sort(compareTokenFaces))

// Scenario effect text for the symbol tokens. `false` disables `v-tooltip` on the
// faces that have none.
function tokenTooltip(tokenFace: string) {
  const scenario = props.game.scenario
  if (!scenario) return false

  const key = chaosTokenEffectKey(scenario, tokenFace)
  if (!key) return false

  const text = t(key)
  if (text === key) return false

  return { content: formatContent(text), html: true }
}

// Only supplied while a skill test is running; absent means no values and no stats bar.
const breakdown = computed(() => props.game.skillTest?.valueBreakdown ?? null)

// Odds belong to the test being taken, so the bar is skill-test-window only. The
// chaos bag window still gets the per-token value pills.
const showStatsBar = computed(() => !!breakdown.value && props.skillTest !== null)

const whatIfSkill = ref(0)
const whatIfDifficulty = ref(0)

const seedWhatIf = () => {
  const b = breakdown.value
  if (!b) return
  whatIfSkill.value = b.skillValue
  whatIfDifficulty.value = b.difficulty
}

watch(breakdown, seedWhatIf, { immediate: true })

const isModified = computed(() => {
  const b = breakdown.value
  return !!b && (whatIfSkill.value !== b.skillValue || whatIfDifficulty.value !== b.difficulty)
})

// Opt-in per skill test: seeing the odds should be a deliberate act, so this
// resets whenever a new test starts.
const showOdds = ref(false)

watch(() => props.game.skillTest?.id, () => { showOdds.value = false })

const oddsPercent = computed(() => {
  const b = breakdown.value
  return b ? Math.round(chanceOfSuccess(b, whatIfSkill.value, whatIfDifficulty.value) * 100) : null
})

const breakdownRows = computed(() =>
  [...(breakdown.value?.tokens ?? [])].sort((a, b) => compareTokenFaces(a.face, b.face))
)

const canForceDraw = computed(() => debug.active && tokenAction.value !== -1)

const forceDraw = (tokenFace: string) =>
  debug.send(props.game.id, {tag: 'ChaosBagMessage', contents: {tag: 'ForceChaosTokenDraw_', contents: tokenFace}})

const valuesByFace = computed(
  () => new Map((breakdown.value?.tokens ?? []).map((e) => [e.face, e]))
)

function faceValueLabel(tokenFace: string) {
  // Faces whose art already states their value get no label beneath them.
  if (numericTokenFaces.includes(tokenFace) || tokenFace === 'AutoFail') return null
  const entry = valuesByFace.value.get(tokenFace)
  if (!entry || entry.value === null) return null
  return entry.value > 0 ? `+${entry.value}` : `${entry.value}`
}

function entryValueLabel(entry: ChaosTokenValueEntry) {
  if (entry.autoFail) return t('gameBar.chaosBagStats.autoFail')
  if (entry.autoSuccess) return t('gameBar.chaosBagStats.autoSuccess')
  if (entry.value === null) return '?'
  return entry.value > 0 ? `+${entry.value}` : `${entry.value}`
}

const choose = (idx: number) => emit('choose', idx)
</script>

<template>
  <div class="chaos-bag">
    <img
      class="chaos-seal"
      src="/assets/veiled-harbour/11-混沌袋仪式纹章.avif"
      alt=""
      aria-hidden="true"
    />
    <div class="chaos-bag-contents">
      <Token v-for="revealedToken in revealedChaosTokens" :key="revealedToken.id" :token="revealedToken" :playerId="playerId" :game="game" @choose="choose" />
      <button v-if="tokenAction !== -1" type="button" class="finish-committing" @click="choose(tokenAction)">
        {{ t('cardOption.testFast.finishCommit') }}
      </button>
      <ChaosBagChoice v-if="chaosBag.choice && 'step' in chaosBag.choice && !game.skillTestResults" :choice="chaosBag.choice.step" :game="game" :playerId="playerId" @choose="choose" />
    </div>

    <div class="token-preview" :class="{ 'token-preview--debug': canForceDraw }">
      <div
        v-for="(tokenFace, idx) in allTokenFaces"
        :key="`${tokenFace}${idx}`"
        class="token-slot"
        v-tooltip="tokenTooltip(tokenFace)"
        @click="canForceDraw && forceDraw(tokenFace)"
      >
        <span v-if="faceValueLabel(tokenFace)" class="count-pill token-slot__value">{{ faceValueLabel(tokenFace) }}</span>
        <img
          class="token"
          :class="{'token-big': skillTest === null}"
          :src="chaosTokenImage(tokenFace)"
        />
      </div>
    </div>

    <Dropdown
      v-if="showStatsBar"
      class="stats-bar-anchor"
      placement="top"
      :distance="6"
      theme="chaos-bag-stats-popover"
    >
      <div class="stats-bar" role="button" tabindex="0">
        <span class="stats-bar__count">{{ $t('gameBar.chaosBagStats.tokens', { count: allTokenFaces.length }) }}</span>
        <span v-if="showOdds" class="stats-bar__odds" :class="{ 'stats-bar__odds--whatif': isModified }">{{ oddsPercent }}%</span>
        <button v-else type="button" class="stats-bar__reveal" @click.stop="showOdds = true">
          {{ $t('gameBar.chaosBagStats.showOdds') }}
        </button>
        <span class="stats-bar__caret" aria-hidden="true">&#9652;</span>
      </div>

      <template #popper>
        <div class="stats">
          <div class="stats__headline">
            <template v-if="showOdds">
              <span class="stats__percent">{{ oddsPercent }}%</span>
              <span class="stats__label">{{ $t('gameBar.chaosBagStats.chanceOfSuccess') }}</span>
            </template>
            <button v-else type="button" class="stats__reveal" @click="showOdds = true">
              {{ $t('gameBar.chaosBagStats.showOdds') }}
            </button>
          </div>

          <div class="stats__whatif">
            <label>
              {{ $t('gameBar.chaosBagStats.skill') }}
              <input v-model.number="whatIfSkill" type="number" />
            </label>
            <label>
              {{ $t('gameBar.chaosBagStats.difficulty') }}
              <input v-model.number="whatIfDifficulty" type="number" />
            </label>
            <button v-if="isModified" type="button" class="stats__reset" @click="seedWhatIf">
              {{ $t('gameBar.chaosBagStats.reset') }}
            </button>
          </div>

          <div class="stats__table">
            <div v-for="entry in breakdownRows" :key="entry.face" class="stats__row">
              <img class="stats__token" :src="chaosTokenImage(entry.face)" />
              <span class="stats__multiplier">&times;{{ entry.count }}</span>
              <span class="stats__value">{{ entryValueLabel(entry) }}</span>
            </div>
          </div>

          <p class="stats__caveat">{{ $t('gameBar.chaosBagStats.caveat') }}</p>
        </div>
      </template>
    </Dropdown>
  </div>
</template>

<style scoped>
.finish-committing { padding: 10px 16px; border-radius: 6px; cursor: pointer; }
.token--can-draw {
  border: min(5px, 1vw) solid var(--select);
  border-radius: 500px;
  cursor: pointer;
}

.token {
  width: min(100px, 20vw);
  height: auto;
  margin-bottom: 10px;
}

.portrait {
  width: var(--card-width);
  height: auto;
}

.chaos-bag-contents {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
   @media (max-width: 800px) and (orientation: portrait) {
    position:absolute;
    width: 100%;
    left: 0;
   }
}

.token-preview {
  display: flex;
  gap: 5px;
  flex-wrap: wrap;
  flex-direction: row;
  justify-content: center;
  /* slots with a pill are taller; align on the token edge, not the slot top */
  align-items: flex-end;
  @media (max-width: 800px) and (orientation: portrait) {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr 3fr 1fr 1fr 1fr;
    .token-slot {
      margin: 0 auto;
    }
    .token-slot:nth-child(6n+1) {
      grid-column: 1;
    }

    .token-slot:nth-child(6n+2) {
      grid-column: 2;
    }

    .token-slot:nth-child(6n+3) {
      grid-column: 3;
    }

    .token-slot:nth-child(6n+4) {
      grid-column: 5;
    }

    .token-slot:nth-child(6n+5) {
      grid-column: 6;
    }

    .token-slot:nth-child(6n) {
      grid-column: 7;
    }
  }
  
  img {
    width: 30px;
    height: auto;
    transition: transform 0.2s;
    &:hover {
      transform: scale(1.2);
    }
    &.token-big {
      width: 50px;
      border-radius: 50px;
    }
    border: 1px solid rgba(255,255,255,0.4);
    border-radius: 30px;
    box-shadow: 0 4px 4px rgba(0,0,0,0.5);
  }
}

.chaos-bag {
  position: relative;
  padding: 10px;
  background: var(--surface-panel);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-2);
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.chaos-seal {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 42px;
  height: 42px;
  object-fit: contain;
  opacity: 0.36;
  pointer-events: none;
  filter: sepia(0.2) saturate(0.8);
}

.stats-bar-anchor {
  margin: -6px -10px -10px;
}

.stats-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 10px;
  border-top: var(--edge-width) solid var(--edge-dim);
  background: var(--surface-raised);
  color: var(--text-dim);
  font-family: sans-serif;
  font-size: 11px;
  line-height: 16px;
  cursor: pointer;
  user-select: none;
  &:hover {
    background: var(--surface-paper);
    color: var(--text);
  }
}

.stats-bar__count {
  flex: 1;
}

.stats-bar__odds {
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}

.stats-bar__odds--whatif {
  color: var(--important);
  font-style: italic;
}

.stats-bar__reveal {
  padding: 0 6px;
  border: var(--edge-width) solid var(--edge-dim);
  border-radius: 999px;
  background: transparent;
  color: inherit;
  font: inherit;
  line-height: 14px;
  cursor: pointer;
  &:hover {
    border-color: var(--spooky-green);
  }
}

.stats-bar__caret {
  opacity: 0.6;
  font-size: 9px;
}

.stats {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  max-width: min(320px, 85vw);
  font-family: sans-serif;
  font-size: 12px;
}

.stats__headline {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.stats__percent {
  font-size: 22px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.stats__label {
  color: rgba(255, 255, 255, 0.7);
}

.stats__reveal {
  padding: 4px 12px;
  border: var(--edge-width) solid var(--edge-dim);
  border-radius: 999px;
  background: transparent;
  color: var(--text);
  font: inherit;
  cursor: pointer;
  &:hover {
    border-color: var(--spooky-green);
  }
}

.stats__whatif {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);

  label {
    display: flex;
    align-items: center;
    gap: 4px;
    color: var(--text-dim);
  }

  input {
    width: 46px;
    padding: 2px 4px;
    border: var(--edge-width) solid var(--edge-dim);
    border-radius: 4px;
    background: var(--surface-raised);
    color: var(--text);
    font-variant-numeric: tabular-nums;
  }
}

.stats__reset {
  padding: 2px 8px;
  border: var(--edge-width) solid var(--edge-dim);
  border-radius: 999px;
  background: transparent;
  color: var(--text);
  cursor: pointer;
}

.stats__table {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 4px 14px;
}

.stats__row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.stats__token {
  width: 22px;
  height: auto;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.3);
}

.stats__multiplier {
  color: var(--text-dim);
  font-variant-numeric: tabular-nums;
}

.stats__value {
  margin-left: auto;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.stats__caveat {
  margin: 0;
  color: var(--text-dim);
  font-size: 10px;
  line-height: 1.4;
}

.token-slot {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;

  /* with the row bottom-aligned, this is what lifts the token off the baseline */
  img {
    margin-bottom: 9px;
  }
}

/* the shared pill, scaled down and dialled back so it reads as an annotation */
.token-slot__value {
  min-width: 0;
  /* symmetric vertical padding on a 1.0 line box centres the glyphs */
  padding: 2px 5px;
  border-color: var(--edge-dim);
  background: var(--surface-raised);
  box-shadow: none;
  color: var(--text-dim);
  font-size: 8px;
  font-weight: 400;
  line-height: 1;
}

.token-preview--debug .token-slot {
  cursor: pointer;
  img {
    border-color: var(--select);
  }
}

</style>

<style>
.v-popper--theme-chaos-bag-stats-popover .v-popper__inner {
  background: var(--surface-panel);
  border: var(--edge-width) solid var(--border-panel);
  border-radius: var(--radius-lg);
  color: var(--text);
  box-shadow: var(--shadow-float);
}

.v-popper--theme-chaos-bag-stats-popover .v-popper__arrow-outer {
  border-color: var(--border-panel);
}

.v-popper--theme-chaos-bag-stats-popover .v-popper__arrow-inner {
  border-color: var(--surface-panel);
}
</style>
