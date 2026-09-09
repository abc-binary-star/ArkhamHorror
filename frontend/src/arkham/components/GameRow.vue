<script lang="ts" setup>
import { computed, ref } from 'vue'
import { portraitImage } from '@/arkham/cardImages'
import type { GameDetails } from '@/arkham/types/Game'
import type { Difficulty } from '@/arkham/types/Difficulty'
import type { CampaignDetails } from '@/arkham/types/Campaign'
import type { ScenarioDetails } from '@/arkham/types/Scenario'
import { imgsrc } from '@/arkham/helpers'
import Prompt from '@/components/Prompt.vue'

const props = withDefaults(
  defineProps<{
    game: GameDetails
    deleteGame?: () => void
    admin?: boolean
  }>(),
  {
    admin: false,
  },
)
const campaign = computed<CampaignDetails | null>(() => props.game.campaign)
const scenario = computed<ScenarioDetails | null>(() => props.game.scenario)
const deleting = ref(false)

const difficulty = computed<Difficulty>(() => {
  if (campaign.value) {
    return campaign.value.difficulty
  }

  if (scenario.value) {
    return scenario.value.difficulty
  }

  return 'Easy'
})

const currentHeading = computed(() => {
  if (campaign.value?.currentCampaignMode) {
    return campaign.value?.currentCampaignMode === 'TheWebOfDreams'
      ? 'The Web of Dreams'
      : 'The Dream-Quest'
  }

  return null
})

const otherHeading = computed(() => {
  if (currentHeading.value) {
    return currentHeading.value === 'The Web of Dreams' ? 'The Dream-Quest' : 'The Web of Dreams'
  }

  return null
})

const toCssName = (s: string): string => s.charAt(0).toLowerCase() + s.substring(1)

const campaignIcon = computed(() => {
  if (!campaign.value) return null
  const { id: campaignId } = campaign.value
  if (!campaignId) return null
  if (campaignId.startsWith(':')) {
    const homebrewId = campaignId.slice(1)
    return imgsrc(`homebrew/${homebrewId}/sets/${homebrewId}.png`)
  }
  return imgsrc(`sets/${campaignId}.png`)
})

const scenarioIcon = computed(() => {
  if (!scenario.value) return null
  const { id: scenarioId } = scenario.value
  if (!scenarioId) return null
  if (scenarioId.startsWith('c:')) {
    const match = scenarioId.match(/^c:([^:]+):([^:]+)$/)
    if (!match) return null
    const [, homebrewId, homebrewScenarioId] = match
    return imgsrc(`homebrew/${homebrewId}/sets/${homebrewScenarioId}.png`)
  }
  const setId = scenarioId.replace('c', '')
  const variant = scenario.value.variant ? `-${scenario.value.variant}` : ''
  return imgsrc(`sets/${setId}${variant}.png`)
})
</script>

<template>
  <div class="game" :class="{ 'finished-game': game.gameState.tag == 'IsOver' }">
    <div class="game-details">
      <div class="game-title">
        <div class="main-details">
          <div class="campaign-icon-container" v-if="campaignIcon">
            <img class="campaign-icon" :src="campaignIcon" />
          </div>
          <div class="campaign-icon-container" v-else-if="scenarioIcon">
            <img class="campaign-icon" :src="scenarioIcon" />
          </div>
          <router-link v-if="admin" class="title" :to="`/admin/games/${game.id}`">{{
            game.name
          }}</router-link>
          <router-link
            v-else-if="game.hasOpenSeats"
            class="title"
            :to="`/games/${game.id}/claim-seat`"
            >{{ game.name }}</router-link
          >
          <router-link v-else class="title" :to="`/games/${game.id}`">{{ game.name }}</router-link>
          <div v-if="game.multiplayerVariant === 'Solo'" class="solo">{{ $t('gameRow.solo') }}</div>
        </div>
        <div v-if="campaign && scenario && scenarioIcon" class="scenario-details">
          <img class="scenario-icon" :src="scenarioIcon" />
          <span>{{ scenario.name.title }}</span>
        </div>
        <div class="extra-details">
          <div class="game-difficulty">{{ difficulty }}</div>

          <div v-if="deleteGame" class="game-delete">
            <a href="#delete" @click.prevent="deleting = true"
              ><font-awesome-icon icon="trash"
            /></a>
          </div>
          <Prompt
            v-if="deleting && deleteGame"
            prompt="Are you sure you want to delete this game?"
            :yes="deleteGame"
            :no="() => (deleting = false)"
          />
        </div>
      </div>
      <div class="game-subdetails">
        <div class="current-subdetails">
          <h2 v-if="currentHeading">{{ currentHeading }}</h2>
          <div class="investigators">
            <div
              v-for="investigator in game.investigators"
              :key="investigator.id"
              class="investigator"
            >
              <div
                :class="`investigator-portrait-container ${toCssName(investigator.classSymbol)}`"
              >
                <img
                  :src="portraitImage(investigator.id)"
                  class="investigator-portrait"
                />
              </div>
            </div>
          </div>
        </div>
        <div v-if="Object.keys(game.otherInvestigators).length > 0" class="other-subdetails">
          <h2 v-if="otherHeading">{{ otherHeading }}</h2>
          <div class="other-investigators">
            <div
              v-for="investigator in game.otherInvestigators"
              :key="investigator.id"
              class="investigator"
            >
              <div
                :class="`investigator-portrait-container ${toCssName(investigator.classSymbol)}`"
              >
                <img
                  :src="portraitImage(investigator.id)"
                  class="investigator-portrait"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
h2 {
  color: var(--brass);
  font-size: 2em;
  font-weight: 600;
  letter-spacing: 0.02em;
  font-family: "Arno", "Noto Sans", sans-serif;
}
.game {
  display: flex;
  color: var(--text);
  background-image: var(--panel-gradient);
  border: var(--edge-width) solid var(--box-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-2);
  margin-bottom: 12px;
  overflow: hidden;
  transition: border-color 120ms ease, transform 120ms ease;

  &:hover {
    border-color: var(--edge);
    transform: translateY(-1px);
  }

  a {
    color: var(--text);
    font-weight: var(--font-bold);
    &:hover {
      color: var(--spooky-green);
    }
  }
}

.campaign-icon-container {
  display: flex;
  align-items: center;
  width: 50px;
}

.campaign-icon {
  max-height: 50px;
  width: 100%;
  object-fit: contain;
}

.scenario-icon {
  height: 30px;
}

.game-details {
  flex: 1;
  min-width: 0;
}

.game-delete {
  transition: all 0.5s;
  position: relative;
  align-self: center;
  display: flex;
  a {
    font-size: 1.2em;
    color: var(--delete);
    &:hover {
      color: var(--survivor);
    }
  }
}

.scenario-details {
  justify-content: flex-end;
  display: flex;
  gap: 10px;
  border-radius: var(--radius-md);
  align-items: center;
  span {
    line-height: 25px;
  }

  @media (max-width: 600px) {
    justify-content: flex-start;
    width: 100%;
    background: rgba(48, 58, 61, 0.06);
    border-left: 3px solid var(--edge-dim);
    border-radius: var(--radius-sm);
    padding: 5px 8px;
    box-sizing: border-box;
    img {
      margin: 0;
    }
  }
}

.title {
  flex: 1;
  font-family: "Arno", "Noto Sans", sans-serif;
  font-size: 1.6em;
  font-weight: var(--font-black);
  letter-spacing: 0.02em;
  text-decoration: none;
  a {
    text-decoration: none;
  }

  &:hover {
    color: var(--spooky-green);
  }
}

.investigator {
  display: inline;
  padding: 5px;
  border-radius: var(--radius-md);
  @media (max-width: 768px) {
    padding: 2px;
  }
}

.investigator-portrait-container {
  width: 50px;
  height: 50px;
  overflow: hidden;
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-2);
  @media (max-width: 768px) {
    width: 36px;
    height: 36px;
  }

  &.survivor {
    border: 3px solid var(--survivor-extra-dark);
  }

  &.guardian {
    border: 3px solid var(--guardian-extra-dark);
  }

  &.mystic {
    border: 3px solid var(--mystic-extra-dark);
  }

  &.seeker {
    border: 3px solid var(--seeker-extra-dark);
  }

  &.rogue {
    border: 3px solid var(--rogue-extra-dark);
  }

  &.neutral {
    border: 3px solid var(--neutral-dark);
  }
}

.investigator-portrait {
  width: 150px;
  @media (max-width: 768px) {
    width: 108px;
  }
}

.game-subdetails {
  display: flex;
  background: rgba(48, 58, 61, 0.035);
  flex-grow: 1;
  position: relative;

  h2 {
    margin: 0;
    padding: 0;
  }
}

.current-subdetails {
  display: flex;
  flex-direction: column;
  background: rgba(48, 58, 61, 0.035);
  flex: 1;
  position: relative;
  gap: 10px;
  @media (max-width: 768px) {
    gap: 0;
  }

  h2 {
    color: var(--text-dim);
    font-size: 0.72em;
    font-weight: var(--font-black);
    letter-spacing: 0.12em;
    margin: 0;
    background: rgba(48, 58, 61, 0.08);
    padding: 3px 8px;
  }
}

.investigators {
  border-radius: var(--radius-md);
  display: flex;
  padding: 10px;
  flex: 1;
  @media (max-width: 768px) {
    padding: 4px 8px;
  }
}

.main-details,
.extra-details {
  display: flex;
  gap: 10px;
  align-items: center;
}

.main-details {
  flex: 1;
  min-width: 0;
}

.game-title {
  display: flex;
  gap: 10px;
  flex-direction: row;
  align-items: center;
  padding: 12px;
  position: relative;
  border-bottom: var(--edge-width) solid var(--edge-faint);

  @media (max-width: 600px) {
    display: flex;
    flex-direction: column;
    font-size: 0.8em;
    align-items: flex-start;
    img {
      width: 20px;
      height: auto;
    }
    gap: 5px;
    padding: 6px 10px;
  }

  * {
    z-index: var(--z-index-1);
  }

  &:before {
    content: ' ';
    display: block;
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    opacity: 0.1;
    background-repeat: no-repeat;
    background-position: center;
    background-size: cover;
    z-index: var(--z-index-0);
  }
}

.finished-game {
  filter: saturate(0);
  svg:hover {
    filter: saturate(1);
  }
}

.other-subdetails {
  text-transform: uppercase;
  display: flex;
  flex: 1;
  flex-direction: column;
  background: rgba(125, 148, 132, 0.035);

  h2 {
    background: var(--panel-inset);
    color: var(--text-dim);
    font-size: 0.72em;
    font-weight: var(--font-black);
    letter-spacing: 0.12em;
    margin: 0;
    padding: 3px 8px;
  }
}

.other-investigators {
  background: var(--panel-inset);
  display: flex;
  padding: 10px;
  flex: 1;
}

.game-difficulty {
  padding: 2px 10px;
  background: var(--panel-inset);
  border: 1px solid var(--edge-dim);
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-1);
  color: var(--text-dim);
  font-size: 0.72em;
  font-weight: var(--font-black);
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.solo {
  color: var(--text-faint);
  font-size: 0.75em;
  font-weight: var(--font-bold);
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.claim-seat-link {
  padding: 4px 11px;
  background: var(--spooky-green);
  border: var(--edge-width) solid var(--edge-on-accent);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-2);
  color: var(--button-1-text) !important;
  text-decoration: none;
  font-size: 0.78em;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-weight: var(--font-black);
  transition: transform 80ms ease, box-shadow 80ms ease, filter 120ms ease;

  &:hover {
    filter: brightness(1.1);
    transform: translateY(-2px);
  }

  &:active {
    transform: translate(1px, 1px);
    box-shadow: none;
  }
}
</style>
