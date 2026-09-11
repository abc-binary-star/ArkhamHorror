<script setup lang="ts">
import { ref, computed } from 'vue'
import { Token } from '@/arkham/types/Token'
import { Source } from '@/arkham/types/Source'
import type { Game } from '@/arkham/types/Game';
import { portraitImage } from '@/arkham/cardImages';
import PoolItem from '@/arkham/components/PoolItem.vue';
import { useI18n } from 'vue-i18n';
import { exchangeTokens } from '@/arkham/api';

const props = defineProps<{
  game: Game
  investigator1: string
  investigator1Amount: number
  investigator2: string
  investigator2Amount: number
  token: Token
  source: Source
}>()

const { t } = useI18n()
const disabled = ref(false)
const amount = ref(0)
const amount1 = computed(() => props.investigator1Amount - amount.value)
const amount2 = computed(() => props.investigator2Amount + amount.value)

const portraitLabelImage = (investigatorId: string) => {
  const player = props.game.investigators[investigatorId]
  const code = (player.form.tag === "YithianForm" || player.form.tag === "HomunculusForm" || player.form.tag === "ShatteredForm")
    ? investigatorId
    : player.cardCode
  return portraitImage(code)
}

async function submit() {
  disabled.value = true
  await exchangeTokens(props.game.id, props.source, props.investigator1, props.investigator2, props.token, amount.value)
}

async function adjustAmount(delta: number) {
  const newAmount = amount.value + delta

  if (props.investigator1Amount - newAmount < 0) return
  if (props.investigator2Amount + newAmount < 0) return

  amount.value = newAmount
}

</script>

<template>
  <div class="exchange-tokens">
    <section class='main'>
      <div class="investigator">
        <img class="portrait" :src="portraitLabelImage(investigator1)"/>
        <span class="amount">{{amount1}}</span>
      </div>
      <div class='controls'>
        <button id="btn__back" @click="adjustAmount(-1)">&larr;</button>
        <div class="item">
          <PoolItem :type="token.toLowerCase()" />
        </div>
        <button id="btn__forward" @click="adjustAmount(1)">&rarr;</button>
      </div>
      <div class="investigator">
        <img class="portrait" :src="portraitLabelImage(investigator2)"/>
        <span class="amount">{{amount2}}</span>
      </div>
    </section>
    <section class='actions'>
      <button class="button close" :disabled="disabled" @click="submit">{{ t('exchange') }}</button>
    </section>
  </div>
</template>

<style scoped>
.exchange-tokens {
  display: flex;
  flex-direction: column;
  align-items: center;

  section {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1em;
    width: 100%;
  }

  section.main {
    padding: 2em;
    background: var(--surface-panel);
    border: var(--edge-width) solid var(--border-panel);
    border-radius: var(--radius-lg);
  }

  section.actions {
    button {
      width: 100%;
    }
  }
}

.investigator {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5em;
  color: var(--text);
  font-size: 1.2em;
  font-weight: bold;
  font-family: 'Arno', sans-serif;
  flex-shrink: 0;
  position: relative;
  isolation: isolate;
  padding-bottom: 20px;
  img {
    border: 2px solid transparent;
    background: linear-gradient(#999 0%, var(--button-highlight) 100%) border-box;
    width: 60px;
    height: 60px;
    border-radius: 50%;
    object-fit: cover;
    object-position: top;
    /* drop shadow */
    box-shadow: var(--shadow-2);
  }

  .amount {
    box-shadow: var(--shadow-1);
    z-index: var(--z-index-neg-1);
    position: absolute;
    bottom: 0px;
    color: var(--spooky-green-dark);
    font-family: "Teutonic";
    letter-spacing: 0.1em;
    transform: translateY(calc(100% - 38px));
    background: var(--surface-raised);
    padding: 20px 8px 2px 8px;
    border-radius: 2px;
  }
}

.controls {
  display: flex;
  align-items: center;
  flex-direction: row;
  width: 100%;
  justify-content: center;
  position: relative;
  margin-inline: 2em;
  button {
    position: absolute;
    font-size: 1.1em;
    background: var(--surface-raised);
    color: var(--text);
    padding: 2px 10px;
    cursor: pointer;
    &:first-of-type {
      border-top-left-radius: 4px;
      border-bottom-left-radius: 4px;
      right: 0;
      transform: translateX(-100%);
    }
    &:last-of-type {
      border-top-right-radius: 4px;
      border-bottom-right-radius: 4px;
      left: 0;
      transform: translateX(100%);
    }
    &:hover {
      color: var(--spooky-green);
    }
  }
}

.actions {
  button {
    padding: 0.8em;
    font-size: 1em;
    font-weight: bold;
    background: var(--button-2);
    color: var(--button-2-text);
    border-radius: 0.6em;
    border-top-left-radius: 0;
    border-top-right-radius: 0;
    text-transform: uppercase;
    width: 100%;
    transition: all 0.3s ease;

    &:hover {
      color: var(--button-2-text);
    }
  }
}

.item {
  padding: 10px;
  background-color: var(--surface-raised);
  border: var(--edge-width) solid var(--edge-dim);
  border-radius: 100vw;
  width: fit-content;
  height: auto;
  aspect-ratio: 1 / 1;
  :deep(img) {
    padding: 2px;
  }
}
</style>
