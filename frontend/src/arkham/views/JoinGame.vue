<script lang="ts" setup>
import type { Game } from '@/arkham/types/Game';
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router'
import { joinGame, fetchJoinGame} from '@/arkham/api'
import GameDetails from '@/arkham/components/GameDetails.vue';
import LoadState from '@/components/LoadState.vue';

export interface Props {
  gameId: string
}
const props = defineProps<Props>()

const route = useRoute()
const router = useRouter()
const game = ref<Game | null>(null)
const loaded = ref(false)
const loadError = ref(false)
const joining = ref(false)
const joinError = ref(false)

const load = () => {
  loadError.value = false
  fetchJoinGame(props.gameId)
    .then((result: Game) => { game.value = result })
    .catch(() => { loadError.value = true })
    .finally(() => { loaded.value = true })
}

load()

async function join() {
    // Preserve an Epic Multiplayer event context if present, so an organizer who
    // joins their own group lands in the game with the organizer bar intact.
    const eventId = typeof route.query.event === 'string' ? route.query.event : null
    joining.value = true
    joinError.value = false
    joinGame(props.gameId)
      .then((game) => router.push(
        eventId
          ? { name: 'Game', params: { gameId: game.id }, query: { event: eventId } }
          : `/games/${game.id}`
      ))
      .catch(() => { joinError.value = true })
      .finally(() => { joining.value = false });
}
</script>

<template>
  <div class="container">
    <div>
      <header>
        <h2>{{ $t('joinGame') }}</h2>
      </header>

      <LoadState v-if="loadError" error @retry="load" />
      <LoadState v-else-if="!loaded" />
      <GameDetails v-else-if="game" :game="game">
        <form id="join-game" @submit.prevent="join">
          <p v-if="joinError" class="join-error">{{ $t('loadState.failed') }}</p>
          <button type="submit" :disabled="joining">{{ $t('join') }}</button>
        </form>
      </GameDetails>
    </div>
  </div>
</template>

<style scoped>
.container {
  width: 100%;
  max-width: 800px;
  margin: 0 auto;
  margin-top: 10px;
}

#join-game {
  width: 100%;
  color: var(--text);
  background-image: var(--panel-gradient);
  border: var(--edge-width) solid var(--edge-dim);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-4);
  padding: 14px;

  button {
    outline: 0;
    width: 100%;
    padding: 12px;
    background: var(--spooky-green);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-3);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--button-1-text);
    font-weight: var(--font-black);
    cursor: pointer;
    transition: transform 80ms ease, box-shadow 80ms ease, filter 120ms ease;

    &:hover:not([disabled]) {
      filter: brightness(1.1);
      transform: translateY(-2px);
    }

    &:active:not([disabled]) {
      transform: translate(1px, 1px);
      box-shadow: none;
    }
  }

  button[disabled] {
    background: var(--button);
    border-color: var(--edge-faint);
    box-shadow: var(--shadow-1);
    color: var(--text-faint);
    cursor: not-allowed;
    filter: none;
    transform: none;
  }

  input[type=text] {
    outline: 0;
    width: 100%;
    margin-bottom: 10px;
    padding: 12px;
    background: var(--input-background);
    border: var(--edge-width) solid var(--edge-dim);
    border-radius: var(--radius-md);
    color: var(--text);
    transition: border-color 120ms ease, box-shadow 80ms ease;

    &:hover { border-color: var(--edge); }
    &:focus { border-color: var(--spooky-green); box-shadow: var(--shadow-2); }
  }

  select {
    outline: 0;
    width: 100%;
    margin-bottom: 10px;
    padding: 12px 34px 12px 12px;
    background-color: var(--input-background);
    border: var(--edge-width) solid var(--edge-dim);
    border-radius: var(--radius-md);
    color: var(--text);
    appearance: none;
    background-image: var(--select-caret);
    background-size: var(--select-caret-size);
    background-repeat: no-repeat;
    background-position: right 11px center;
    transition: border-color 120ms ease, box-shadow 80ms ease;

    &:hover { border-color: var(--edge); }
    &:focus { border-color: var(--spooky-green); box-shadow: var(--shadow-2); }
  }

  a {
    color: var(--spooky-green);
    font-weight: var(--font-bold);
  }

  p {
    margin: 0;
    padding: 0;
    color: var(--text-dim);
    font-size: 0.8rem;
    font-weight: var(--font-bold);
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  p.join-error {
    color: var(--delete);
    font-size: 0.9rem;
    letter-spacing: normal;
    margin-bottom: 10px;
    text-transform: none;
  }
}

h2 {
  color: var(--title);
  margin-left: 10px;
  font-family: Arno, 'Source Han Serif', serif;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-shadow: none;
}
</style>
