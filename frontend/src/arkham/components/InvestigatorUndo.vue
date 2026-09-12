<script setup lang="ts">
import { inject, ref } from 'vue'
import { Dropdown } from 'floating-vue'
import { Undo2 } from '@lucide/vue'
import { ArrowUturnLeftIcon, ClockIcon, RectangleStackIcon, ArrowPathIcon, FlagIcon } from '@heroicons/vue/20/solid'
import { undoControlsKey } from '@/arkham/injectionKeys'

const controls = inject(undoControlsKey)
const menuOpen = ref(false)
const { canUndoAction, canUndoTurn, canUndoPhase, canUndoRound, canUndoScenario,
  undoChordArmed, confirmingUndoScenario, undo, undoActionStart, undoTurnStart,
  undoPhaseStart, undoRoundStart } = controls!
</script>

<template>
      <div class="investigator-undo">
        <Dropdown v-model:show="menuOpen" :triggers="['click']" theme="game-bar-undo" placement="bottom" :distance="6">
          <button
            type="button"
            class="undo-trigger"
            v-tooltip="$t('gameBar.undo')"
            :aria-label="$t('gameBar.undo')"
          >
            <Undo2 aria-hidden="true" /><span>{{ $t('gameBar.undo') }}</span>
          </button>
          <template #popper>
            <div class="undo-panel">
              <button type="button" class="undo-panel__row" v-close-popper @click="undo">
                <Undo2 aria-hidden="true" />
                <span>{{ $t('gameBar.undo') }}</span>
                <span class="shortcut">u</span>
              </button>
              <div
                v-if="canUndoAction || canUndoTurn || canUndoPhase || canUndoRound || canUndoScenario"
                class="undo-jump-group"
                :class="{ armed: undoChordArmed }"
              >
                <div class="undo-jump-header">
                  <span>{{ $t('game.undoTo') }}</span>
                  <span class="chord-prefix"><kbd>U</kbd> + <span class="chord-hint">…</span></span>
                </div>
                <button v-if="canUndoAction" type="button" class="undo-jump scope-action" v-close-popper @click="undoActionStart"><ArrowUturnLeftIcon aria-hidden="true" /><span class="undo-jump-label">{{ $t('game.startOfAction') }}</span><kbd class="chord-key">A</kbd></button>
                <button v-if="canUndoTurn" type="button" class="undo-jump scope-turn" v-close-popper @click="undoTurnStart"><ClockIcon aria-hidden="true" /><span class="undo-jump-label">{{ $t('game.startOfTurn') }}</span><kbd class="chord-key">T</kbd></button>
                <button v-if="canUndoPhase" type="button" class="undo-jump scope-phase" v-close-popper @click="undoPhaseStart"><RectangleStackIcon aria-hidden="true" /><span class="undo-jump-label">{{ $t('game.startOfPhase') }}</span><kbd class="chord-key">P</kbd></button>
                <button v-if="canUndoRound" type="button" class="undo-jump scope-round" v-close-popper @click="undoRoundStart"><ArrowPathIcon aria-hidden="true" /><span class="undo-jump-label">{{ $t('game.startOfRound') }}</span><kbd class="chord-key">R</kbd></button>
                <button v-if="canUndoScenario" type="button" class="undo-jump scope-scenario" v-close-popper @click="confirmingUndoScenario = true"><FlagIcon aria-hidden="true" /><span class="undo-jump-label">{{ $t('gameBar.restartScenario') }}</span><kbd class="chord-key">S</kbd></button>
              </div>
            </div>
          </template>
        </Dropdown>
      </div>
</template>

<style scoped>
.investigator-undo .undo-trigger { color: #fff4dc; text-shadow: 0 1px 2px rgb(4 12 12 / 0.6); }
.investigator-undo .undo-trigger:hover { color: #fff; }
.investigator-undo { display: inline-flex; align-items: center; }
.investigator-undo > :deep(.v-popper) { display: inline-flex; }
.investigator-undo button { display: inline-flex; align-items: center; gap: 5px; white-space: nowrap; }
.investigator-undo button svg { width: 14px; height: 14px; }
.shortcut { margin-left: auto; opacity: 0.65; }
.undo-jump-group {
  background: rgba(0, 0, 0, 0.22);
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.25);
  border-bottom-left-radius: 5px;
  border-bottom-right-radius: 5px;
  overflow: hidden;
  transition:
    box-shadow 0.2s ease,
    background 0.2s ease;

  &.armed {
    background: rgba(0, 0, 0, 0.35);
    box-shadow:
      inset 0 1px 2px rgba(0, 0, 0, 0.3),
      0 0 0 1px rgba(127, 184, 212, 0.6),
      0 0 12px rgba(127, 184, 212, 0.35);
  }
}

.undo-jump-header {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  color: rgba(255, 255, 255, 0.55);
  padding: 8px 10px 6px 10px;
  user-select: none;
  pointer-events: none;
  align-items: center;
  gap: 8px;
}

.chord-prefix {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
  letter-spacing: normal;
  text-transform: none;

  kbd {
    font-family: inherit;
    font-size: inherit;
    font-weight: bold;
    padding: 2px 5px;
    border-radius: 4px;
    background-color: var(--box-background);
    border: 1px solid var(--title);
    color: var(--text);
    line-height: 1;
  }

  .chord-hint {
    opacity: 0.6;
  }
}

.undo-jump-group.armed .chord-prefix kbd {
  background-color: var(--box-border);
}

.chord-key {
  font-family: inherit;
  font-size: inherit;
  font-weight: bold;
  margin-left: auto;
  padding: 2px 5px;
  border-radius: 4px;
  background-color: var(--box-background);
  border: 1px solid var(--title);
  color: var(--text);
  line-height: 1;
}

.undo-jump:hover .chord-key,
.undo-jump.active .chord-key,
.undo-jump-group.armed .chord-key {
  background-color: var(--box-border);
}

.undo-jump {
  position: relative;
  width: 100%;
  padding: 5px 10px 5px 18px !important;
  background: rgba(0, 0, 0, 0.4);

  &::before {
    content: '';
    position: absolute;
    left: 6px;
    top: 6px;
    bottom: 6px;
    width: 2px;
    border-radius: 2px;
    background: var(--undo-scope);
    opacity: 0.55;
    transition:
      opacity 0.15s ease,
      transform 0.15s ease;
  }

  svg {
    color: var(--undo-scope);
  }

  &.scope-action {
    --undo-scope: #7fb8d4;
  }
  &.scope-turn {
    --undo-scope: #6cc28d;
  }
  &.scope-phase {
    --undo-scope: #e0b256;
  }
  &.scope-round {
    --undo-scope: #c97aa8;
  }
  &.scope-scenario {
    --undo-scope: #d96a6a;
  }

  &:hover {
    background: rgba(0, 0, 0, 0.6);
  }

  &:hover::before,
  &.active::before {
    opacity: 1;
    transform: scaleX(1.5);
  }
}

.undo-panel {
  display: flex;
  flex-direction: column;
  min-width: 224px;
}

/* Deliberately no `background` here: the jump rows carry their own plate and
   a shorthand would win on specificity and flatten it. */
.undo-panel button {
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
  padding: 8px 10px;
  border: 0;
  color: inherit;
  font: inherit;
  font-weight: 600;
  text-align: left;
  cursor: pointer;
}

.undo-panel__row {
  background: none;
}

.undo-panel__row svg,
.undo-jump svg {
  width: 16px;
  height: 16px;
}

.undo-panel button:hover,
.undo-panel button:focus-visible,
.undo-panel button.active {
  background: rgb(205 175 107 / 0.2);
  color: #fff;
  outline: none;
}

.undo-panel .undo-jump-group {
  border-top: 1px solid rgb(205 175 107 / 0.22);
  border-radius: 0;
}

.undo-panel .undo-jump-header {
  display: flex;
}

</style>
