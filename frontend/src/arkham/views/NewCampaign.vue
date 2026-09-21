<script lang="ts" setup>
import { watch, ref, computed, onMounted, onUnmounted } from 'vue'
import { useUserStore } from '@/stores/user'
import { useRoute, useRouter } from 'vue-router'
import * as ArkhamDeck from '@/arkham/types/Deck'
import { fetchDecks, newGame, createEvent } from '@/arkham/api'
import { useToast } from 'vue-toastification'
import { useI18n } from 'vue-i18n'
import { useEventStore } from '@/arkham/stores/event'
import type { Difficulty } from '@/arkham/types/Difficulty'
import { campaignChapter } from '@/arkham/data'
import type { Scenario, Campaign } from '@/arkham/data'
import { storeToRefs } from 'pinia'
import type { GameMode, MultiplayerVariant, CampaignType } from '@/arkham/types/NewGame'
import type { UndoMode } from '@/arkham/types/Game'

import { ACHIEVEMENT_CAMPAIGN_IDS } from '@/arkham/achievements'
import officialCampaignJSON from '@/arkham/data/campaigns'
import { homebrewCampaigns } from '@/arkham/homebrewData'
import scenarioJSON from '@/arkham/data/scenarios'
import sideStoriesJSON from '@/arkham/data/side-stories'
import { filterDisplayable, isDevBuild } from '@/arkham/displayRules'

import ChooseMode from '@/arkham/components/NewCampaign/ChooseMode.vue'
import GameOptions from '@/arkham/components/NewCampaign/GameOptions.vue'

type Step = 'ChooseMode' | 'GameOptions'
type CampaignGroup = 'chapter1' | 'chapter2' | 'homebrew'

const store = useUserStore()
const { currentUser } = storeToRefs(store)
const eventStore = useEventStore()

const route = useRoute()
const router = useRouter()

const dev = isDevBuild()
const alpha = ref(false)
const isBetaUser = computed(() => !!currentUser.value?.beta)
const displayRuleOptions = computed(() => ({ alpha: alpha.value, beta: isBetaUser.value, dev }))
const gate = <T extends { alpha?: boolean; beta?: boolean; dev?: boolean }>(items: T[]) =>
  filterDisplayable(items, displayRuleOptions.value)

const step = ref<Step>('ChooseMode')
const campaignGroup = ref<CampaignGroup>('chapter1')
const gameMode = ref<GameMode>('Campaign')
const includeTarotReadings = ref(false)
const strictAsIfAt = ref(false)
const decks = ref<ArkhamDeck.Deck[]>([])
const ready = ref(false)

const playerCount = ref(1)
const selectedDifficulty = ref<Difficulty>('Easy')
const deckIds = ref<(string | null)[]>([null, null, null, null])

const fullCampaign = ref<CampaignType>('FullCampaign')
const sideStoryMode = ref<string>('campaign')
const selectedCampaign = ref<string | null>(null)
const selectedScenario = ref<string | null>(null)
const campaignName = ref<string | null>(null)
const multiplayerVariant = ref<MultiplayerVariant>('WithFriends')
const returnTo = ref(false)

// Per-seat AI configuration (dev-only, Solo games only); see GameOptions.vue.

const fullCampaignOptionKey = ref<string | null>(null)
const recommendedOptionState = ref<Record<string, boolean>>({})

// Ultimatums and Boons variant tags selected in GameOptions (e.g. "BoonOfHades").
const ultimatumsAndBoons = ref<string[]>([])

// Achievement tracking (default on). Only honored for campaigns with an
// achievement catalog; unsupported campaigns always send true.
const achievementsEnabled = ref(true)
const undoMode = ref<UndoMode>('full')

// "Epic Multiplayer" side-story mode state (only meaningful for epic-capable
// side stories; see GameOptions.vue / side-stories.json).
type EpicGroup = { name: string; playerCount: number }
const epicMode = ref(false)
const epicGroupCount = ref(2)
const epicGroups = ref<EpicGroup[]>([
  { name: 'Group A', playerCount: 2 },
  { name: 'Group B', playerCount: 2 },
])
// Shared time limit (epic only). On by default; sends 0 minutes when off.
const imposeTimeLimit = ref(true)
const timeLimitMinutes = ref(180)

// "Mini-campaign" side-story mode (only meaningful for side stories flagged
// `miniCampaign` in side-stories.json, e.g. The Labyrinths of Lunacy).
const miniCampaign = ref(false)

const scenarios = computed<Scenario[]>(() => gate(scenarioJSON))
const sideStories = computed<Scenario[]>(() => gate(sideStoriesJSON))
const campaignJSON = dev ? [...officialCampaignJSON, ...homebrewCampaigns] : officialCampaignJSON
const campaigns = computed<Campaign[]>(() => gate(campaignJSON))

const scenario = computed(() =>
  gameMode.value === 'SideStory'
    ? sideStories.value.find((s) => s.id === selectedScenario.value)
    : scenarios.value.find((s) => s.id === selectedScenario.value)
)

const campaign = computed(() =>
  gameMode.value === 'Campaign'
    ? campaigns.value.find((c) => c.id === selectedCampaign.value)
    : null
)

const scenarioSupportsEpic = computed(
  () => gameMode.value === 'SideStory' && scenario.value?.epicMultiplayer === true,
)
const isEpicMode = computed(() => scenarioSupportsEpic.value && epicMode.value)

const selectedCampaignReturnTo = computed(() => {
  const c = campaigns.value.find((x) => x.id === selectedCampaign.value)
  if (c?.returnTo?.alpha && !alpha.value) return null
  return c?.returnTo ?? null
})

const campaignScenarios = computed(() =>
  selectedCampaign.value
    ? scenarios.value.filter((s) => s.campaign == selectedCampaign.value && s.show !== false && s.standalone !== false)
    : []
)

const canStandalone = computed(() => {
  if (gameMode.value !== 'Campaign') return false
  const c = campaign.value
  if (!c) return false
  return c.id !== '09'
})

const difficulties = computed<Difficulty[]>(() => {
  if (gameMode.value === 'SideStory') {
    const s = sideStories.value.find((c) => c.id === selectedScenario.value)
    if (s?.standaloneDifficulties) return s.standaloneDifficulties as Difficulty[]
    return []
  }
  return ['Easy', 'Standard', 'Hard', 'Expert']
})

const defaultCampaignName = computed(() => {
  if (gameMode.value === 'Campaign' && campaign.value) {
    const prefix = returnTo.value ? 'Return to ' : ''
    return `${prefix}${campaign.value.name}`
  }

  if (fullCampaign.value === 'Standalone' && scenario.value) {
    const prefix = returnTo.value ? 'Return to ' : ''
    return `${prefix}${scenario.value.name}`
  }

  if (gameMode.value === 'SideStory' && scenario.value) {
    if (returnTo.value && scenario.value.returnToVariant) {
      return 'The Blob That Ate Everything ELSE!'
    }

    if (scenario.value.scenarios && sideStoryMode.value !== 'campaign') {
      const part = scenario.value.scenarios.find((s) => s.id === sideStoryMode.value)
      if (part) return part.name
    }
    return `${scenario.value.name}`
  }

  return ''
})

const currentCampaignName = computed(() => {
  return campaignName.value && campaignName.value !== ''
    ? campaignName.value
    : defaultCampaignName.value
})

const disabled = computed(() => {
  if (fullCampaign.value === 'Standalone' || gameMode.value === 'SideStory') {
    return !(scenario.value && currentCampaignName.value)
  } else {
    return !(campaign.value && currentCampaignName.value)
  }
})

const canGoNextFromStep1 = computed(() => {
  if (gameMode.value === 'SideStory') return !!selectedScenario.value
  return !!selectedCampaign.value
})

const creating = ref(false)
const toast = useToast()
const { t } = useI18n()

const nextDisabled = computed(() =>
  creating.value || (step.value === 'ChooseMode' ? !canGoNextFromStep1.value : disabled.value)
)

function withViewTransition(fn: () => void) {
  const d = document as any
  if (typeof d.startViewTransition === 'function') {
    d.startViewTransition(() => fn())
  } else {
    fn()
  }
}

function setStep(next: Step) {
  if (step.value === next) return
  withViewTransition(() => {
    step.value = next
  })
}

function goBack() {
  if (step.value === 'GameOptions') setStep('ChooseMode')
}

async function goNext() {
  if (step.value === 'ChooseMode') {
    setStep('GameOptions')
    return
  }
  await start()
}

function onKeydown(e: KeyboardEvent) {
  if (e.key !== 'Escape') return
  if (step.value !== 'ChooseMode') {
    setStep('ChooseMode')
  }
}

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
})

onMounted(async () => {
  alpha.value = route.query.alpha !== undefined || localStorage.getItem('alpha') === 'true'
  if (route.query.alpha !== undefined) localStorage.setItem('alpha', 'true')
  window.addEventListener('keydown', onKeydown)
})

watch(difficulties, (ds) => {
  if (ds.length > 0) selectedDifficulty.value = ds[0]
})

watch(gameMode, (mode) => {
  returnTo.value = false
  campaignName.value = null
  sideStoryMode.value = 'campaign'

  if (mode === 'SideStory') {
    selectedCampaign.value = null
    fullCampaign.value = 'FullCampaign'
  } else {
    selectedScenario.value = null
  }

  step.value = 'ChooseMode'
})

watch(selectedScenario, () => {
  if (gameMode.value === 'SideStory') sideStoryMode.value = 'campaign'
  // Re-arm to the default single-group mode whenever the chosen side story changes.
  epicMode.value = false
  miniCampaign.value = false
})

watch(gameMode, () => {
  epicMode.value = false
  miniCampaign.value = false
})

watch(selectedCampaign, (id) => {
  selectedScenario.value = null
  returnTo.value = false
  recommendedOptionState.value = {}
  ultimatumsAndBoons.value = []
  strictAsIfAt.value = campaignChapter(campaignJSON.find((c) => c.id === id), id) === 2

  if (id === '09') fullCampaign.value = 'FullCampaign'
})

watch(campaign, (c) => {
  const recs = ((c as any)?.recommendedOptions ?? []) as Array<{ type: 'toggle'; default?: boolean; option: { tag: string } }>
  const next: Record<string, boolean> = {}

  for (const r of recs) {
    if (r.type === 'toggle' && r.option?.tag) next[r.option.tag] = r.default ?? true
  }

  recommendedOptionState.value = { ...next, ...recommendedOptionState.value }
}, { immediate: true })

watch([selectedCampaign, fullCampaign], () => {
  if (fullCampaign.value !== 'FullCampaign') {
    fullCampaignOptionKey.value = null
    return
  }

  const c: any = campaign.value
  const opts = c?.variants as { key: string }[] | undefined
  fullCampaignOptionKey.value = opts?.[0]?.key ?? null
})

fetchDecks()
  .then((result) => { decks.value = result })
  .catch((err) => { console.error('[new-campaign] could not list saved decks', err) })
  .finally(() => { ready.value = true })

// The toggle is only rendered for supported campaigns; a stale "off" from a
// supported selection must not leak into an unsupported one. A standalone
// scenario has no campaign at all, and achievements are gated on the campaign,
// so tracking is off rather than reported as on.
const achievementsForCreate = (campaignId: string | null) =>
  campaignId
    ? ACHIEVEMENT_CAMPAIGN_IDS.includes(campaignId) ? achievementsEnabled.value : true
    : false

async function start() {
  if (creating.value) return
  creating.value = true
  try {
    await createGame()
  } catch (err) {
    console.error('[new-campaign] could not create the game', err)
    toast.error(t('pleaseTryAgainLater'))
  } finally {
    creating.value = false
  }
}

async function createGame() {
  const enabledRecommendedOptions = Object.entries(recommendedOptionState.value)
    .filter(([, enabled]) => enabled)
    .map(([tag]) => ({ tag }))

  const variant = fullCampaignOptionKey.value ? [{ 'tag': 'CampaignVariant', 'contents': fullCampaignOptionKey.value }] : [];

  const options = [
    ...enabledRecommendedOptions,
    ...variant,
    ...(miniCampaign.value ? [{ tag: 'PlayAsMiniCampaign' }] : []),
    ...(returnTo.value && scenario.value?.returnToVariant ? [{ tag: 'PlayWithTheBlobThatAteEverythingElse' }] : [])
  ]

  // Epic Multiplayer side story: spin up an event aggregate (N group games +
  // shared state) instead of a single game, and land on the organizer dashboard.
  if (isEpicMode.value && scenario.value && currentCampaignName.value) {
    // Off -> 0 (no limit). On with a bad/empty value -> fall back to the 180 default
    // so an "imposed" limit can never silently become "no limit".
    const minutes = imposeTimeLimit.value
      ? (Number.isFinite(timeLimitMinutes.value) && timeLimitMinutes.value > 0
          ? Math.floor(timeLimitMinutes.value)
          : 180)
      : 0
    const details = await createEvent({
      name: currentCampaignName.value,
      scenarioId: scenario.value.id,
      difficulty: selectedDifficulty.value,
      includeTarotReadings: includeTarotReadings.value,
      playWithBlobElse: returnTo.value && scenario.value?.returnToVariant === true,
      timeLimitMinutes: minutes,
      groups: epicGroups.value.map((g, i) => ({
        name: g.name.trim() === '' ? `Group ${String.fromCharCode(65 + i)}` : g.name.trim(),
        playerCount: g.playerCount,
      })),
    })
    eventStore.setEvent(details)
    router.push(`/events/${details.id}`)
    return
  }

  if (fullCampaign.value === 'Standalone' || gameMode.value === 'SideStory') {
    if (scenario.value && currentCampaignName.value) {
      let scenarioId: string | null =
        returnTo.value && (scenario.value as any).returnTo ? (scenario.value as any).returnTo : scenario.value.id
      let campaignId: string | null = null

      if (gameMode.value === 'SideStory' && scenario.value.scenarios) {
        if (sideStoryMode.value === 'campaign' && scenario.value.campaign) {
          campaignId = scenario.value.campaign
          scenarioId = null
        } else {
          scenarioId = sideStoryMode.value
        }
      }

      const game = await newGame(
        deckIds.value,
        playerCount.value,
        campaignId,
        scenarioId,
        selectedDifficulty.value,
        currentCampaignName.value,
        multiplayerVariant.value,
        includeTarotReadings.value,
        options,
        strictAsIfAt.value,
        ultimatumsAndBoons.value,
        achievementsForCreate(campaignId),
        undoMode.value
      )
      router.push(`/games/${game.id}`)
    }
  } else {
    const c = campaign.value
    if (c && currentCampaignName.value) {
      const campaignId = returnTo.value && c.returnTo?.id ? c.returnTo.id : c.id

      const game = await newGame(
        deckIds.value,
        playerCount.value,
        campaignId,
        fullCampaign.value !== 'PartialCampaign' ? null : selectedScenario.value,
        selectedDifficulty.value,
        currentCampaignName.value,
        multiplayerVariant.value,
        includeTarotReadings.value,
        options,
        strictAsIfAt.value,
        ultimatumsAndBoons.value,
        achievementsForCreate(campaignId),
        undoMode.value
      )
      router.push(`/games/${game.id}`)
    }
  }
}
</script>

<template>
  <div class="new-campaign-content" :class="{ 'new-campaign-content--choosing': step === 'ChooseMode' }">
    <header class="main-header">
      <h2>{{ $t('newGame') }}</h2>
      <slot name="cancel" />
    </header>

    <form v-if="ready" id="new-campaign" @submit.prevent="goNext">
      <ChooseMode
          v-if="step === 'ChooseMode'"
          v-model:gameMode="gameMode"
          v-model:selectedCampaign="selectedCampaign"
          v-model:selectedScenario="selectedScenario"
          v-model:campaignGroup="campaignGroup"
          :campaigns="campaigns"
          :sideStories="sideStories"
          :campaign="campaign"
          :scenario="scenario"
          @go="goNext"
        />

        <GameOptions
          v-else
          v-model:playerCount="playerCount"
          v-model:sideStoryMode="sideStoryMode"
          v-model:multiplayerVariant="multiplayerVariant"
          v-model:returnTo="returnTo"
          v-model:fullCampaign="fullCampaign"
          v-model:selectedScenario="selectedScenario"
          v-model:selectedDifficulty="selectedDifficulty"
          v-model:includeTarotReadings="includeTarotReadings"
          v-model:strictAsIfAt="strictAsIfAt"
          v-model:campaignName="campaignName"
          v-model:fullCampaignOptionKey="fullCampaignOptionKey"
          v-model:recommendedOptionState="recommendedOptionState"
          v-model:ultimatumsAndBoons="ultimatumsAndBoons"
          v-model:achievementsEnabled="achievementsEnabled"
          v-model:undoMode="undoMode"
          v-model:epicMode="epicMode"
          v-model:epicGroupCount="epicGroupCount"
          v-model:epicGroups="epicGroups"
          v-model:imposeTimeLimit="imposeTimeLimit"
          v-model:timeLimitMinutes="timeLimitMinutes"
          v-model:miniCampaign="miniCampaign"
          :gameMode="gameMode"
          :campaign="campaign"
          :scenario="scenario"
          :canStandalone="canStandalone"
          :selectedCampaign="selectedCampaign"
          :selectedCampaignReturnTo="selectedCampaignReturnTo"
          :campaignScenarios="campaignScenarios"
          :difficulties="difficulties"
          :currentCampaignName="currentCampaignName"
          :chosenCampaignId="selectedCampaign"
          :chosenSideStoryId="gameMode === 'SideStory' ? selectedScenario : null"
        >
        <template #actions>
        <div class="wizard-actions">
          <button
            v-if="step === 'GameOptions'"
            type="button"
            class="action secondary"
            @click="goBack"
          >
            {{ $t('Back') }}
          </button>

          <button v-if="step === 'GameOptions'" class="primary-action" type="submit" :disabled="nextDisabled">
            {{ $t('create.create') }}
          </button>
        </div>
        </template>
        </GameOptions>
    </form>
  </div>
</template>

<style scoped>
.new-campaign-content {
  --text: #354337;
  --text-dim: #65705e;
  --text-faint: #777d6e;
  --surface-raised: #f8f4e9;
  --surface-panel: #eee9da;
  --input-background: #fffcf4;
  --edge-dim: #bcb093;
  --button-1: #435740;
  --button-1-highlight: #53694b;
  --button-1-text: #faf2dc;
  --spooky-green: #435740;
  --title: #344136;
  width: 100%;
  height: 100%;
  overflow-y: auto;
  scrollbar-gutter: stable;
  min-height: 0;
  box-sizing: border-box;
  padding: 12px 0 16px;
  color: var(--text);
  background: #b7b39a url('/assets/veiled-harbour/campaign-expedition-morning-v1.png') center top / cover no-repeat;
  background-attachment: local;
}
.main-header, #new-campaign { width: calc(100% - clamp(32px, 6vw, 160px)); box-sizing: border-box; margin: 0 auto; }
.main-header { display: flex; align-items: center; justify-content: space-between; gap: 16px; min-height: 48px; padding: 8px 18px; margin-bottom: 10px; background: rgb(247 243 230 / 0.95); border: 1px solid #b5a078; border-radius: 6px; }
.main-header h2 { margin: 0; color: #344136; font: 600 1.25rem / 1.4 'Source Han Serif', 'Arno', serif; letter-spacing: 0.05em; }
.main-header :slotted(button) { min-height: 36px; padding: 6px 18px; border: 1px solid #b5a078; border-radius: 4px; background: #f9f5eb; color: #43513c; box-shadow: none; }
#new-campaign { display: grid; gap: 14px; }
.wizard-actions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin-top: 14px; padding-top: 12px; border-top: 1px solid #d2c5a9; }
.wizard-actions button { min-width: 0; min-height: 44px; padding: 8px 10px; border: 1px solid #9d895e; border-radius: 4px; background: linear-gradient(135deg, #4b6046, #344630); color: #fff4da; font: inherit; cursor: pointer; }
.wizard-actions button.secondary { background: #fbf8ef; color: #43513c; }
.wizard-actions button:hover:not(:disabled) { filter: brightness(1.06); border-color: #6d754e; }
.wizard-actions button:disabled { opacity: 0.5; cursor: not-allowed; }
:deep(button:focus-visible), :deep(input[type='image']:focus-visible), :deep(select:focus-visible), :deep(input.text:focus-visible) { outline: 2px solid #53694b; outline-offset: 3px; }
@media (max-width: 760px) {
  .main-header, #new-campaign { width: calc(100% - 20px); }
  .main-header { padding: 8px 12px; }
  .wizard-actions { padding-top: 10px; }
  .wizard-actions button { flex: 1; min-width: 0; }
}
</style>
