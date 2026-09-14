<script lang="ts" setup>
import * as ArkhamGame from '@/arkham/types/Game'
import { shallowRef, ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { fetchGame } from '@/arkham/api'
import { useCardStore } from '@/stores/cards'
import CampaignLog from '@/arkham/components/CampaignLog.vue'
import LoadState from '@/components/LoadState.vue'

export interface Props {
  gameId: string
}

const props = defineProps<Props>()
const store = useCardStore()
const router = useRouter()
store.fetchCards()
const game = shallowRef<ArkhamGame.Game | null>(null)
const loaded = ref(false)
const loadError = ref(false)

const cards = computed(() => store.cards)

const refreshGame = () => fetchGame(props.gameId, false)
  .then(({ game: newGame }) => {
    game.value = newGame
    loadError.value = false
  })
  .catch(() => { loadError.value = true })
  .finally(() => { loaded.value = true })

refreshGame()

const goBack = () => router.push({ name: 'Game', params: { gameId: props.gameId } })

const onKeyDown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') goBack()
}

onMounted(() => document.addEventListener('keydown', onKeyDown))
onUnmounted(() => document.removeEventListener('keydown', onKeyDown))
</script>

<template>
  <div class="campaign-log-view">
    <LoadState v-if="loadError && game === null" error @retry="refreshGame" />
    <LoadState v-else-if="!loaded" />
    <CampaignLog v-else-if="game !== null" :game="game" :cards="cards" :player-id="game.activePlayerId" @refresh="refreshGame">

    </CampaignLog>
  </div>
</template>

<style scoped>
.campaign-log-view {
  display: flex;
  flex: 1;
  min-height: 0;
  width: 100%;
}

.back-button {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-radius: 8px;
  background: var(--surface-raised);
  color: var(--text-dim);
  font-family: "Noto Sans", Avenir, Helvetica, Arial, sans-serif;
  font-size: 0.95em;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  text-decoration: none;
  transition: background 0.15s, border-color 0.15s, color 0.15s;

  .back-icon {
    font-size: 0.85em;
    transition: transform 0.15s;
  }

  &:hover {
    background: var(--surface-panel);
    border-color: var(--spooky-green);
    color: var(--spooky-green-dark);

    .back-icon {
      transform: translateX(-3px);
    }
  }
}

@media (max-width: 800px), (max-width: 1199px) and (pointer: coarse) {

  .campaign-log-view { min-width: 0; width: 100%; overflow: auto; padding: 12px; }
  .back-button { display: inline-flex; align-items: center; min-height: 44px; }

}
</style>
