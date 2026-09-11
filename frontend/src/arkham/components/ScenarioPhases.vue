<script setup lang="ts">
import type { Game } from '@/arkham/types/Game'

// The phase rail: the four phases with their rule-numbered steps and fast
// windows. Split out of Scenario.vue so the rail can be restyled on its own.
defineProps<{
  phase: Game['phase']
  phaseStep: Game['phaseStep']
}>()
</script>

<template>
<div class="phases">
  <div class="phase" :class="{ 'active-phase': phase == 'MythosPhase' }">
    <div class="subphases">
      <div
        v-tooltip.left="$t('phase.mythosPhaseBeginsStep')"
        :class="{ current: phaseStep?.contents === 'MythosPhaseBeginsStep' }"
      >
        1.1
      </div>
      <div
        v-tooltip.left="$t('phase.placeDoomOnAgendaStep')"
        :class="{ current: phaseStep?.contents === 'PlaceDoomOnAgendaStep' }"
      >
        1.2
      </div>
      <div
        v-tooltip.left="$t('phase.checkDoomThresholdStep')"
        :class="{ current: phaseStep?.contents === 'CheckDoomThresholdStep' }"
      >
        1.3
      </div>
      <div
        v-tooltip.left="$t('phase.eachInvestigatorDrawsEncounterCardStep')"
        :class="{ current: phaseStep?.contents === 'EachInvestigatorDrawsEncounterCardStep' }"
      >
        1.4
      </div>
      <div
        v-tooltip.left="$t('phase.playerWindow')"
        :class="{ current: phaseStep?.contents === 'MythosPhaseWindow' }"
      >
        <i class="fast-icon" />
      </div>
      <div
        v-tooltip.left="$t('phase.mythosPhaseEndsStep')"
        :class="{ current: phaseStep?.contents === 'MythosPhaseEndsStep' }"
      >
        1.5
      </div>
    </div>
    <div>{{ $t('phase.mythosPhase') }}</div>
  </div>
  <div class="phase" :class="{ 'active-phase': phase == 'InvestigationPhase' }">
    <div class="subphases">
      <div
        v-tooltip.left="$t('phase.investigationPhaseBeginsStep')"
        :class="{ current: phaseStep?.contents === 'InvestigationPhaseBeginsStep' }"
      >
        2.1
      </div>
      <div
        v-tooltip.left="$t('phase.playerWindow')"
        :class="{ current: phaseStep?.contents === 'InvestigationPhaseBeginsWindow' }"
      >
        <i class="fast-icon" />
      </div>
      <div
        v-tooltip.left="$t('phase.nextInvestigatorsTurnBeginsStep')"
        :class="{ current: phaseStep?.contents === 'NextInvestigatorsTurnBeginsStep' }"
      >
        2.2
      </div>
      <div
        v-tooltip.left="$t('phase.playerWindow')"
        :class="{ current: phaseStep?.contents === 'NextInvestigatorsTurnBeginsWindow' }"
      >
        <i class="fast-icon" />
      </div>
      <div
        v-tooltip.left="$t('phase.investigatorTakesActionStep')"
        :class="{ current: phaseStep?.contents === 'InvestigatorTakesActionStep' }"
      >
        2.2.1
      </div>
      <div
        v-tooltip.left="$t('phase.investigatorsTurnEndsStep')"
        :class="{ current: phaseStep?.contents === 'InvestigatorsTurnEndsStep' }"
      >
        2.2.2
      </div>
      <div
        v-tooltip.left="$t('phase.investigationPhaseEndsStep')"
        :class="{ current: phaseStep?.contents === 'InvestigationPhaseEndsStep' }"
      >
        2.3
      </div>
    </div>
    <div>{{ $t('phase.investigationPhase') }}</div>
  </div>
  <div class="phase" :class="{ 'active-phase': phase == 'EnemyPhase' }">
    <div class="subphases">
      <div
        v-tooltip.left="$t('phase.enemyPhaseBeginsStep')"
        :class="{ current: phaseStep?.contents === 'EnemyPhaseBeginsStep' }"
      >
        3.1
      </div>
      <div
        v-tooltip.left="$t('phase.hunterEnemiesMoveStep')"
        :class="{ current: phaseStep?.contents === 'HunterEnemiesMoveStep' }"
      >
        3.2
        <span v-if="phaseStep?.contents === 'HunterEnemiesMoveStep'">{{
          $t('phase.hunterEnemiesMoveStep')
        }}</span>
      </div>
      <div
        v-tooltip.left="$t('phase.playerWindow')"
        :class="{ current: phaseStep?.contents === 'ResolveAttacksWindow' }"
      >
        <i class="fast-icon" />
      </div>
      <div
        v-tooltip.left="$t('phase.resolveAttacksStep')"
        :class="{ current: phaseStep?.contents === 'ResolveAttacksStep' }"
      >
        3.3
      </div>
      <div
        v-tooltip.left="$t('phase.playerWindow')"
        :class="{ current: phaseStep?.contents === 'AfterResolveAttacksWindow' }"
      >
        <i class="fast-icon" />
      </div>
      <div
        v-tooltip.left="$t('phase.enemyPhaseEndsStep')"
        :class="{ current: phaseStep?.contents === 'EnemyPhaseEndsStep' }"
      >
        3.4
      </div>
    </div>
    <div>{{ $t('phase.enemyPhase') }}</div>
  </div>
  <div class="phase" :class="{ 'active-phase': phase == 'UpkeepPhase' }">
    <div class="subphases">
      <div
        v-tooltip.left="$t('phase.upkeepPhaseBeginsStep')"
        :class="{ current: phaseStep?.contents === 'UpkeepPhaseBeginsStep' }"
      >
        4.1
      </div>
      <div
        v-tooltip.left="$t('phase.playerWindow')"
        :class="{ current: phaseStep?.contents === 'UpkeepPhaseBeginsWindow' }"
      >
        <i class="fast-icon" />
      </div>
      <div
        v-tooltip.left="$t('phase.resetActionsStep')"
        :class="{ current: phaseStep?.contents === 'ResetActionsStep' }"
      >
        4.2
      </div>
      <div
        v-tooltip.left="$t('phase.readyExhaustedStep')"
        :class="{ current: phaseStep?.contents === 'ReadyExhaustedStep' }"
      >
        4.3
      </div>
      <div
        v-tooltip.left="$t('phase.drawCardAndGainResourceStep')"
        :class="{ current: phaseStep?.contents === 'DrawCardAndGainResourceStep' }"
      >
        4.4
      </div>
      <div
        v-tooltip.left="$t('phase.checkHandSizeStep')"
        :class="{ current: phaseStep?.contents === 'CheckHandSizeStep' }"
      >
        4.5
      </div>
      <div
        v-tooltip.left="$t('phase.upkeepPhaseEndsStep')"
        :class="{ current: phaseStep?.contents === 'UpkeepPhaseEndsStep' }"
      >
        4.6
      </div>
    </div>
    <div>{{ $t('phase.upkeepPhase') }}</div>
  </div>
</div>
</template>

<style scoped>
.phases {
  display: flex;
  align-items: flex-end;
  writing-mode: vertical-rl;
  text-orientation: mixed;
  justify-content: space-around;
  background: linear-gradient(90deg, rgb(12 22 22 / 0.94), rgb(24 40 39 / 0.88));
  border-left: 1px solid rgb(205 175 107 / 0.35);
  color: rgb(214 186 128 / 0.85);
  text-transform: uppercase;
  > div {
    flex: 1;
    text-align: center;
  }

  @media (max-width: 768px) and (orientation: portrait) {
    display: none;
  }
}

.phase {
  display: flex;
  flex-direction: column;
  width: 100%;
}

.subphases {
  position: relative;
  font-size: 0.7em;
  flex: 1;
  writing-mode: lr-tb;
  text-orientation: revert;
  display: flex;
  min-width: min-content;
  flex-direction: column;
  height: 100%;
  justify-content: space-around;
  color: rgb(214 186 128 / 0.6);
  background: rgb(8 16 16 / 0.72);
  text-transform: uppercase;
  .current {
    background: rgba(205, 175, 107, 0.3) !important;
    color: rgb(240 226 182);
    position: relative;
    span {
      position: absolute;
      right: 100%;
      z-index: var(--z-index-100000);
      background: var(--neutral-extra-dark);
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      padding-inline: 10px;
      pointer-events: none;
    }
  }
  > div {
    width: 100%;
    padding: 0 5px;
    display: flex;
    justify-content: center;
    flex: 1;
    align-items: center;
    &:hover {
      background: rgba(205, 175, 107, 0.18);
    }
  }
  > div:nth-of-type(2n) {
    background: rgb(255 255 255 / 0.05);
    &:hover {
      background: rgba(205, 175, 107, 0.18);
    }
  }
}

.active-phase {
  font-weight: bold;
  background-color: rgba(205, 175, 107, 0.16);
  color: rgb(240 226 182);
}

.phases {
  box-shadow:
    0 4px 14px rgb(4 12 12 / 0.24),
    inset 0 1px 0 rgb(244 239 228 / 0.06);
}

.phases .phase > div:last-child {
  text-shadow: 0 1px 2px rgb(4 12 12 / 0.72);
}

@media (min-width: 1200px) {
  .phases {
    position: absolute;
    inset: 10px auto auto 50%;
    z-index: 5;
    width: auto;
    height: auto;
    flex-direction: row;
    writing-mode: horizontal-tb;
    background: rgb(12 22 22 / 0.82);
    border: 1px solid rgb(205 175 107 / 0.3);
    transform: translateX(-50%);
  }

  .phases .phase {
    width: auto;
    min-width: 68px;
    padding: 3px 7px;
  }

  .phases .subphases {
    display: none;
  }

  .phases {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    z-index: var(--z-index-40, 40);
    display: flex;
    width: auto;
    height: 34px;
    flex-direction: row;
    writing-mode: horizontal-tb;
    align-items: stretch;
    justify-content: stretch;
    background: linear-gradient(180deg, rgb(15 32 31 / 0.98), rgb(8 19 19 / 0.96));
    border: 1px solid rgb(205 175 107 / 0.42);
    border-top: 0;
    transform: none;
  }

  .phases .phase {
    min-width: 0;
    width: auto;
    flex: 1 1 0;
    flex-direction: row;
    align-items: center;
    justify-content: center;
    gap: 7px;
    padding: 0 8px;
    color: rgb(214 186 128 / 0.82);
    white-space: nowrap;
  }

  .phases .phase > div:last-child {
    flex: 0 0 auto;
    font-family: Teutonic, Georgia, serif;
    font-size: 0.78rem;
    letter-spacing: 0.08em;
  }

  .phases .subphases {
    display: flex;
    flex: 0 0 auto;
    width: auto;
    height: auto;
    min-width: 0;
    flex-direction: row;
    gap: 2px;
    background: transparent;
  }

  .phases .subphases > div {
    width: auto;
    min-width: 16px;
    padding: 2px 3px;
    font-size: 0.58rem;
  }

  .phases .phase.active-phase {
    background: linear-gradient(180deg, rgb(205 175 107 / 0.3), rgb(205 175 107 / 0.12));
    color: rgb(248 239 211 / 0.98);
    box-shadow:
      inset 0 -2px 0 rgb(229 194 107 / 0.82),
      inset 0 0 16px rgb(229 194 107 / 0.08);
    text-shadow: 0 1px 8px rgb(229 194 107 / 0.34);
  }
}
</style>
