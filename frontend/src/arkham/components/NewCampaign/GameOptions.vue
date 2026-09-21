<script lang="ts" setup>
import { computed, ref, watch } from 'vue'
import { BugAntIcon } from '@heroicons/vue/20/solid'
import { imgsrc } from '@/arkham/helpers'
import { chaosTokenImage, compareTokenFaces, type TokenFace } from '@/arkham/types/ChaosToken'
import type { Difficulty } from '@/arkham/types/Difficulty'
import type { Scenario, Campaign } from '@/arkham/data'
import type { GameMode, MultiplayerVariant, CampaignType } from '@/arkham/types/NewGame'
import type { UndoMode } from '@/arkham/types/Game'
import { ACHIEVEMENT_CAMPAIGN_IDS } from '@/arkham/achievements'
import { useSettings } from '@/stores/settings'

type FullCampaignOption = {
  key: string
  difficultyLevels: Record<Difficulty, TokenFace[]>
}

type RecommendedToggle = {
  type: 'toggle'
  default?: boolean
  icon?: 'bug-ant'
  option: { tag: string }
}

const props = defineProps<{
  gameMode: GameMode
  campaign: Campaign | null | undefined
  scenario: Scenario | undefined

  canStandalone: boolean
  selectedCampaign: string | null
  selectedCampaignReturnTo: any | null

  campaignScenarios: Scenario[]
  difficulties: Difficulty[]
  currentCampaignName: string

  chosenCampaignId: string | null
  chosenSideStoryId: string | null
}>()

const playerCount = defineModel<number>('playerCount', { required: true })
const multiplayerVariant = defineModel<MultiplayerVariant>('multiplayerVariant', { required: true })
const returnTo = defineModel<boolean>('returnTo', { required: true })
const fullCampaign = defineModel<CampaignType>('fullCampaign', { required: true })
const selectedScenario = defineModel<string | null>('selectedScenario', { required: true })
const selectedDifficulty = defineModel<Difficulty>('selectedDifficulty', { required: true })
const includeTarotReadings = defineModel<boolean>('includeTarotReadings', { required: true })
const campaignName = defineModel<string | null>('campaignName', { required: true })
const fullCampaignOptionKey = defineModel<string | null>('fullCampaignOptionKey', { required: true })
const sideStoryMode = defineModel<string>('sideStoryMode', { required: true })

// "Epic Multiplayer" side-story flow. Only surfaced for side stories whose data
// carries `epicMultiplayer: true` (src/arkham/data/side-stories.json).
type EpicGroup = { name: string; playerCount: number }
const epicMode = defineModel<boolean>('epicMode', { required: true })
const epicGroupCount = defineModel<number>('epicGroupCount', { required: true })
const epicGroups = defineModel<EpicGroup[]>('epicGroups', { required: true })

// Shared time limit for the event. When the checkbox is off, NewCampaign sends 0
// minutes (= no limit / no barrier / no countdown); on, it sends `timeLimitMinutes`.
const imposeTimeLimit = defineModel<boolean>('imposeTimeLimit', { required: true })
const timeLimitMinutes = defineModel<number>('timeLimitMinutes', { required: true })

// "Mini-campaign" side-story flow. Surfaced for side stories whose data carries
// `miniCampaign: true` (src/arkham/data/side-stories.json). Unlike Epic Multiplayer
// this is not behind a dev flag.
const miniCampaign = defineModel<boolean>('miniCampaign', { required: true })

const settings = useSettings()

// The epic play-mode option only appears for an epic-capable side story AND when
// the dev-only Epic Multiplayer flag is enabled (store value is dev-gated). When
// off, the side-story flow shows only the normal single-group flow.
const scenarioSupportsEpic = computed(
  () =>
    props.gameMode === 'SideStory' &&
    props.scenario?.epicMultiplayer === true &&
    settings.epicMultiplayerEnabled,
)
const isEpicActive = computed(() => scenarioSupportsEpic.value && epicMode.value)

// Mini-campaign choice appears for any side story flagged `miniCampaign`, with no
// dev gating. Hidden while an Epic Multiplayer event is being configured.
const scenarioSupportsMiniCampaign = computed(
  () => props.gameMode === 'SideStory' && props.scenario?.miniCampaign === true,
)

// Keep the per-group rows in sync with the chosen group count, preserving any
// names/counts the organizer already edited.
watch(epicGroupCount, (count) => {
  const next = epicGroups.value.slice(0, count)
  while (next.length < count) next.push({ name: `Group ${String.fromCharCode(65 + next.length)}`, playerCount: 2 })
  epicGroups.value = next
})

const sideStoryScenarios = computed(() =>
  props.gameMode === 'SideStory' ? props.scenario?.scenarios ?? [] : []
)

const deckRequirements = computed(() => props.scenario?.deckRequirements ?? [])

const showAlphaWarning = computed(() => {
  if (props.gameMode === 'Campaign' && props.campaign) {
    return props.campaign.alpha
  }

  if (props.gameMode === 'SideStory' && props.scenario) {
    return props.scenario.alpha
  }

  return false
})

const showBetaWarning = computed(() => {
  if (props.gameMode === 'Campaign' && props.campaign) {
    return props.campaign.beta
  }

  if (props.gameMode === 'SideStory' && props.scenario) {
    return props.scenario.beta
  }

  return false
})

const showReturnToToggle = computed(() => {
  return (
    (props.gameMode === 'SideStory' && props.scenario?.returnToVariant === true) ||
    ((props.gameMode === 'Campaign' || fullCampaign.value === 'Standalone') &&
      !!props.selectedCampaign &&
      !!props.selectedCampaignReturnTo)
  )
})

const showStandaloneScenarioPicker = computed(() => {
  return (
    props.gameMode === 'Campaign' &&
    !!props.selectedCampaign &&
    (fullCampaign.value === 'Standalone' || fullCampaign.value === 'PartialCampaign')
  )
})

const selectionSummary = computed(() => {
  if (props.gameMode === 'Campaign' && props.chosenCampaignId) {
    return {
      kind: 'Campaign' as const,
      id: props.chosenCampaignId,
      title: props.campaign?.name ?? ''
    }
  }

  if (props.gameMode === 'SideStory' && props.chosenSideStoryId) {
    // title might be scenario?.name (it should exist once chosen)
    return {
      kind: 'SideStory' as const,
      id: props.chosenSideStoryId,
      title: selectedSideStoryPart.value?.name ?? props.scenario?.name ?? ''
    }
  }

  return null
})

const selectedSideStoryPart = computed(() => {
  if (props.gameMode !== 'SideStory') return null
  if (sideStoryMode.value === 'campaign') return null
  return props.scenario?.scenarios?.find((s) => s.id === sideStoryMode.value) ?? null
})

const selectionBoxSrc = computed(() => {
  if (!selectionSummary.value) return null
  const part = selectedSideStoryPart.value
  const id = part ? part.box ?? part.id : selectionSummary.value.id

  if (id.startsWith(":")) {
    const homebrew = id.slice(1,)
    return imgsrc(`homebrew/${homebrew}/boxes/${homebrew}.jpg`)
  }
  return imgsrc(`boxes/${id}.jpg`)
})

const selectionKind = computed(() => selectionSummary.value?.kind ?? null)

const difficultyLevels = computed<Record<Difficulty, TokenFace[]> | null>(() => {
  const opt = selectedFullCampaignOption.value
  if (opt?.difficultyLevels) return opt.difficultyLevels

  const c = props.campaign as any
  if (c?.difficultyLevels) return c.difficultyLevels as Record<Difficulty, TokenFace[]>

  const s = props.scenario as any
  if (s?.difficultyLevels) return s.difficultyLevels as Record<Difficulty, TokenFace[]>

  return null
})

const chaosTokensForDifficulty = computed<TokenFace[]>(() => {
  const levels = difficultyLevels.value
  if (!levels) return []
  return (levels[selectedDifficulty.value] ?? []).slice().sort(compareTokenFaces)
})

const variants = computed<FullCampaignOption[]>(() => {
  const c = props.campaign as any
  return (c?.variants ?? []) as FullCampaignOption[]
})

const showFullCampaignOptions = computed(() =>
  props.gameMode === 'Campaign' &&
  fullCampaign.value === 'FullCampaign' &&
  variants.value.length > 0
)

const selectedFullCampaignOption = computed<FullCampaignOption | null>(() => {
  if (!showFullCampaignOptions.value) return null
  const key = fullCampaignOptionKey.value ?? variants.value[0]?.key
  return variants.value.find(o => o.key === key) ?? null
})

const recommendedOptionState =
  defineModel<Record<string, boolean>>('recommendedOptionState', { required: true })

const strictAsIfAt = defineModel<boolean>('strictAsIfAt', { required: true })

const rulesExpanded = ref(false)

// --- Achievement tracking --------------------------------------------------------
// Only rendered when the effective campaign (Return To swaps the id) has an
// achievement catalog; unsupported campaigns always create with tracking on.
const achievementsEnabled = defineModel<boolean>('achievementsEnabled', { required: true })

// --- Undo mode ------------------------------------------------------------------
// Chosen here rather than in the in-game settings panel because it is fixed at
// creation: the backend prunes steps as they are persisted, so loosening it
// later could not bring the discarded history back.
const undoMode = defineModel<UndoMode>('undoMode', { required: true })
const undoModes: UndoMode[] = ['full', 'standard', 'light', 'hardcore', 'expert']

const effectiveCampaignId = computed<string | null>(() => {
  if (props.gameMode !== 'Campaign') return null
  // A standalone scenario creates a game with no campaign, and achievement
  // detection is gated on the campaign, so nothing can be earned.
  if (fullCampaign.value === 'Standalone') return null
  if (returnTo.value && props.selectedCampaignReturnTo?.id) return props.selectedCampaignReturnTo.id
  return props.chosenCampaignId
})

const supportsAchievements = computed(
  () => !!effectiveCampaignId.value && ACHIEVEMENT_CAMPAIGN_IDS.includes(effectiveCampaignId.value)
)

// --- Ultimatums and Boons variant selection ------------------------------------
// Selected enum tags flow up to NewCampaign and into the create-game POST body.
const ultimatumsAndBoons = defineModel<string[]>('ultimatumsAndBoons', { required: true })

// Each group renders as its own collapsed card; per-group expansion state.
const uabExpanded = ref<Record<string, boolean>>({ boons: false, ultimatums: false })

const uabSelectedCount = (group: { tags: string[] }) =>
  group.tags.filter((tag) => ultimatumsAndBoons.value.includes(tag)).length

// ponytail: hardcoded catalog; add new tags here + locale entries when they land.
const uabGroups: { key: 'boons' | 'ultimatums'; beta?: boolean; tags: string[] }[] = [
  {
    key: 'boons',
    tags: [
      'BoonOfTheAncients',
      'BoonOfAthena',
      'BoonOfDestiny',
      'BoonOfHades',
      'BoonOfHermes',
      'BoonOfThoth',
      'BoonOfOsiris',
      'BoonOfTheMorrigan',
      'BoonOfPersephone',
      'BoonOfTheExplorer',
      'BoonOfTheChild',
    ],
  },
  {
    key: 'ultimatums',
    beta: true,
    tags: [
      'UltimatumOfAgony',
      'UltimatumOfBrokenPromises',
      'UltimatumOfTheBrokenVeil',
      'UltimatumOfChaos',
      'UltimatumOfDisaster',
      'UltimatumOfDread',
      'UltimatumOfExile',
      'UltimatumOfFailure',
      'UltimatumOfFinality',
      'UltimatumOfForbiddenKnowledge',
      'UltimatumOfHardship',
      'UltimatumOfTheHighlander',
      'UltimatumOfInduction',
      'UltimatumOfMalevolence',
      'UltimatumOfOrthodoxy',
      'UltimatumOfTheScream',
      'UltimatumOfTheSpiral',
      'UltimatumOfSurvival',
      'UltimatumOfUltimatums',
    ],
  },
]

// Entries enforced at deck construction (deckRestrictions.ts) rather than at
// runtime — the in-game Ultimatums & Boons on/off toggle does not affect them.
const UAB_DECKBUILDING_TAGS = new Set([
  'UltimatumOfChaos',
  'UltimatumOfDisaster',
  'UltimatumOfTheHighlander',
  'UltimatumOfInduction',
  'UltimatumOfOrthodoxy',
  'UltimatumOfExile',
])

type RulesPreset = 'chapter1' | 'chapter2'

type RulesSettings = {
  strictAsIfAt: boolean
}

const presets: Record<RulesPreset, RulesSettings> = {
  chapter1: { strictAsIfAt: false },
  chapter2: { strictAsIfAt: true },
}

const activePreset = computed<RulesPreset | null>(() => {
  for (const [key, p] of Object.entries(presets) as [RulesPreset, RulesSettings][]) {
    if (strictAsIfAt.value === p.strictAsIfAt) return key
  }
  return null
})

function applyPreset(preset: RulesPreset) {
  const p = presets[preset]
  strictAsIfAt.value = p.strictAsIfAt
}

const recommendedToggles = computed<RecommendedToggle[]>(() => {
  const c = props.campaign as any
  const opts = (c?.recommendedOptions ?? []) as RecommendedToggle[]
  return opts.filter((o) => o.type === 'toggle' && o.option?.tag)
})

function optKey(o: RecommendedToggle) {
  return o.option.tag
}

function isOptEnabled(o: RecommendedToggle) {
  const k = optKey(o)
  const v = recommendedOptionState.value[k]
  return v ?? true
}

function setOptEnabled(o: RecommendedToggle, enabled: boolean) {
  recommendedOptionState.value = {
    ...recommendedOptionState.value,
    [optKey(o)]: enabled,
  }
}
</script>

<template>
  <div class="alpha-warning" v-if="showAlphaWarning">
    {{ $t('create.alphaWarning') }}
  </div>
  <div class="beta-warning" v-if="showBetaWarning">
    {{ $t('create.betaWarning') }}
  </div>
  <div class="game-options">
    <aside v-if="selectionSummary && selectionBoxSrc" class="summary">
      <div
        class="selection-box"
        :class="{
          campaign: selectionKind === 'Campaign',
          sidestory: selectionKind === 'SideStory'
        }"
        style="view-transition-name: selected-game-box;"
      >
        <img class="selection-img" :src="selectionBoxSrc" :alt="selectionSummary.title" />
      </div>
      <h3 class="selection-title">{{ selectionSummary.title }}</h3>
      <div class="summary-actions"><slot name="actions" /></div>
    </aside>

    <section class="config">
      <div v-if="deckRequirements.length" class="card deck-requirements-card">
        <div class="card-title">Deck Requirements</div>
        <ul class="deck-requirements">
          <li v-for="requirement in deckRequirements" :key="requirement">{{ requirement }}</li>
        </ul>
      </div>

      <div class="card compact-setting">
        <div class="card-title">{{ $t('create.gameName') }}</div>
        <input class="text" type="text" v-model="campaignName" :placeholder="currentCampaignName" />
      </div>

      <div v-if="scenarioSupportsEpic" class="card">
        <div class="card-title">{{ $t('create.playMode') }}</div>
        <div class="segmented segmented-2">
          <input type="radio" v-model="epicMode" :value="false" id="singleGroupMode" />
          <label for="singleGroupMode">{{ $t('create.singleGroupMode') }}</label>
          <input type="radio" v-model="epicMode" :value="true" id="epicMultiplayerMode" />
          <label for="epicMultiplayerMode">{{ $t('create.epicMultiplayerMode') }}</label>
        </div>

        <transition name="slide">
          <div v-if="isEpicActive" class="subcard">
            <div class="card-title small">{{ $t('create.numberOfGroups') }}</div>
            <div class="segmented segmented-3">
              <template v-for="n in [2, 3, 4]" :key="n">
                <input type="radio" v-model="epicGroupCount" :value="n" :id="`groupCount${n}`" />
                <label :for="`groupCount${n}`">{{ n }}</label>
              </template>
            </div>

            <div class="epic-groups">
              <div v-for="(group, index) in epicGroups" :key="index" class="epic-group-row">
                <label class="epic-field">
                  <span class="card-title small">{{ $t('create.groupName') }}</span>
                  <input class="text" type="text" v-model="group.name" />
                </label>
                <label class="epic-field epic-field-count">
                  <span class="card-title small">{{ $t('create.groupPlayers') }}</span>
                  <select class="text" v-model.number="group.playerCount">
                    <option v-for="p in 4" :key="p" :value="p">{{ p }}</option>
                  </select>
                </label>
              </div>
            </div>

            <div class="epic-time-limit">
              <label class="epic-toggle">
                <input type="checkbox" v-model="imposeTimeLimit" />
                <span class="card-title small">{{ $t('create.imposeTimeLimit') }}</span>
              </label>
              <label v-if="imposeTimeLimit" class="epic-field epic-field-count">
                <span class="card-title small">{{ $t('create.timeLimitMinutes') }}</span>
                <input class="text" type="number" min="1" step="1" v-model.number="timeLimitMinutes" />
              </label>
            </div>
          </div>
        </transition>
      </div>

      <div v-if="scenarioSupportsMiniCampaign && !isEpicActive" class="card">
        <div class="card-title">{{ $t('create.playMode') }}</div>
        <div class="segmented segmented-2">
          <input type="radio" v-model="miniCampaign" :value="false" id="singleScenarioMode" />
          <label for="singleScenarioMode">{{ $t('create.singleScenarioMode') }}</label>
          <input type="radio" v-model="miniCampaign" :value="true" id="miniCampaignMode" />
          <label for="miniCampaignMode">{{ $t('create.miniCampaignMode') }}</label>
        </div>

        <transition name="slide">
          <div v-if="miniCampaign" class="subcard mini-campaign-desc" v-html="$t('create.miniCampaignDescription')"></div>
        </transition>
      </div>

      <div v-if="!isEpicActive" class="card compact-setting">
        <div class="card-title">{{ $t('create.numberOfPlayers') }}</div>
        <div class="segmented segmented-4">
          <input type="radio" v-model="playerCount" :value="1" id="player1" />
          <label for="player1">1</label>
          <input type="radio" v-model="playerCount" :value="2" id="player2" />
          <label for="player2">2</label>
          <input type="radio" v-model="playerCount" :value="3" id="player3" />
          <label for="player3">3</label>
          <input type="radio" v-model="playerCount" :value="4" id="player4" />
          <label for="player4">4</label>
        </div>

        <transition name="slide">
          <div v-if="playerCount > 1" class="subcard">
            <div class="card-title small">{{ $t('create.multiplayerVariant') }}</div>
            <div class="segmented segmented-2">
              <input type="radio" v-model="multiplayerVariant" value="WithFriends" id="friends" />
              <label for="friends">{{ $t('create.withFriends') }}</label>
              <input type="radio" v-model="multiplayerVariant" value="Solo" id="solo" />
              <label for="solo">{{ $t('create.multihandedSolo') }}</label>
            </div>
          </div>
        </transition>

        <transition name="slide">
        <div v-if="multiplayerVariant === 'Solo' && playerCount > 1" class="callout">
            <div class="callout-title">
              <font-awesome-icon icon="eye" class="callout-icon" />
              {{ $t('create.switchingPerspectives') }}
            </div>
            <div class="callout-body" v-html="$t('create.switchingPerspectivesDescription')"></div>
          </div>
        </transition>
      </div>

      <div v-if="sideStoryScenarios.length > 0" class="card">
        <div class="card-title">{{ $t('create.scenarios') }}</div>
        <div class="segmented" :class="`segmented-${sideStoryScenarios.length + 1}`">
          <input type="radio" v-model="sideStoryMode" value="campaign" id="sideStoryBoth" />
          <label for="sideStoryBoth">{{ $t('create.bothScenarios') }}</label>

          <template v-for="s in sideStoryScenarios" :key="s.id">
            <input type="radio" v-model="sideStoryMode" :value="s.id" :id="`sideStoryPart-${s.id}`" />
            <label :for="`sideStoryPart-${s.id}`">{{ s.name }}</label>
          </template>
        </div>
      </div>

      <div v-if="showReturnToToggle" class="card">
        <div class="card-title">{{ $t('create.returnTo') }}</div>
        <div class="segmented segmented-2">
          <input type="radio" v-model="returnTo" :value="false" id="normal" />
          <label for="normal">{{ $t('create.normal') }}</label>
          <input type="radio" v-model="returnTo" :value="true" id="returnTo" />
          <label for="returnTo">{{ scenario?.returnToVariant ? 'The Blob That Ate Everything ELSE!' : $t('create.returnTo') }}</label>
        </div>
      </div>

      <div v-if="canStandalone" class="card">
        <div class="card-title">{{ $t('create.campaignType') }}</div>
        <div class="segmented" :class="campaign?.settings ? 'segmented-3' : 'segmented-2'">
          <input type="radio" v-model="fullCampaign" :value="'FullCampaign'" id="full" />
          <label for="full">{{ $t('create.fullCampaign') }}</label>

          <input type="radio" v-model="fullCampaign" :value="'Standalone'" id="standalone" />
          <label for="standalone">{{ $t('create.standalone') }}</label>

          <template v-if="campaign?.settings">
            <input type="radio" v-model="fullCampaign" :value="'PartialCampaign'" id="partial" />
            <label for="partial">{{ $t('create.partialCampaign') }}</label>
          </template>
        </div>

        <template v-if="showStandaloneScenarioPicker">
          <div class="subcard">
            <div class="card-title small">{{ $t('create.pickScenario') }}</div>
            <div class="scenario-grid">
              <button
                v-for="s in campaignScenarios"
                :key="s.id"
                type="button"
                class="scenario-tile"
                :class="{ selected: selectedScenario == s.id }"
                @click="selectedScenario = s.id"
              >
                <img :src="imgsrc(`boxes/${s.id}.jpg`)" :alt="s.name" />
              </button>
            </div>
          </div>
        </template>
      </div>

      <div v-if="showFullCampaignOptions" class="card">
        <div class="card-title">{{ $t('create.variant') }}</div>

        <div class="segmented" :class="`segmented-${variants.length}`">
          <template v-for="opt in variants" :key="opt.key">
            <input
              type="radio"
              v-model="fullCampaignOptionKey"
              :value="opt.key"
              :id="`fullCampaignOption-${opt.key}`"
            />
            <label class="variant" :for="`fullCampaignOption-${opt.key}`" v-html="$t(`create.fullCampaignOption.${opt.key}`)" />
          </template>
        </div>
      </div>

      <div class="card">
        <div class="card-title">{{ $t('create.difficulty') }}</div>
        <div class="segmented segmented-4">
          <template v-for="difficulty in difficulties" :key="difficulty">
            <input
              type="radio"
              v-model="selectedDifficulty"
              :value="difficulty"
              :id="`difficulty${difficulty}`"
            />
            <label :for="`difficulty${difficulty}`">{{ $t('create.' + difficulty) }}</label>
          </template>
        </div>
        <div v-if="chaosTokensForDifficulty.length > 0" class="token-preview callout">
          <img
            v-for="(tokenFace, idx) in chaosTokensForDifficulty"
            :key="`${tokenFace}-${idx}`"
            class="token"
            :src="chaosTokenImage(tokenFace)"
            :alt="tokenFace"
          />
        </div>
      </div>

      <div class="card">
        <div class="card-title">{{ $t('create.includeTarotReadings') }}</div>
        <div class="segmented segmented-2">
          <input type="radio" v-model="includeTarotReadings" :value="false" id="tarotNo" />
          <label for="tarotNo">{{ $t('No') }}</label>

          <input type="radio" v-model="includeTarotReadings" :value="true" id="tarotYes" />
          <label for="tarotYes">{{ $t('Yes') }}</label>
        </div>
      </div>

      <div class="card">
        <div class="card-title">{{ $t('create.undoMode.title') }}</div>
        <div class="segmented segmented-5">
          <template v-for="mode in undoModes" :key="mode">
            <input type="radio" v-model="undoMode" :value="mode" :id="`undoMode-${mode}`" />
            <label :for="`undoMode-${mode}`">{{ $t(`create.undoMode.${mode}`) }}</label>
          </template>
        </div>
        <div class="achievements-desc">{{ $t(`create.undoMode.hint.${undoMode}`) }}</div>
        <div class="achievements-desc">{{ $t('create.undoMode.immutable') }}</div>
      </div>

      <div v-if="supportsAchievements" class="card">
        <div class="card-title">{{ $t('achievements.settingsToggleTitle') }}</div>
        <div class="segmented segmented-2">
          <input type="radio" v-model="achievementsEnabled" :value="true" id="achievementsOn" />
          <label for="achievementsOn">{{ $t('On') }}</label>

          <input type="radio" v-model="achievementsEnabled" :value="false" id="achievementsOff" />
          <label for="achievementsOff">{{ $t('Off') }}</label>
        </div>
        <div class="achievements-desc">{{ $t('achievements.settingsToggleDescription') }}</div>
      </div>

      <div class="card rules-card">
        <button type="button" class="rules-toggle" @click="rulesExpanded = !rulesExpanded">
          <span class="card-title" style="margin-bottom: 0">{{ $t('create.advancedRulesConfiguration') ?? 'Advanced Rules Configuration' }}</span>
          <span class="rules-header-right">
            <span class="preset-pill" :class="activePreset ?? 'custom'">
              {{ activePreset ? ($t(`create.preset.${activePreset}.name`) ?? activePreset) : ($t('create.presetCustom') ?? 'Custom') }}
            </span>
            <span class="rules-chevron" :class="{ expanded: rulesExpanded }">▸</span>
          </span>
        </button>
        <transition name="slide">
          <div v-if="rulesExpanded" class="rules-body subcard">
            <div class="card-title small">{{ $t('create.rulesPresets') ?? 'Presets' }}</div>
            <div class="preset-options">
              <button
                v-for="preset in (['chapter1', 'chapter2'] as RulesPreset[])"
                :key="preset"
                type="button"
                class="preset-option"
                :class="{ selected: activePreset === preset }"
                @click="applyPreset(preset)"
              >
                <span class="preset-name">{{ $t(`create.preset.${preset}.name`) ?? preset }}</span>
                <span class="preset-desc">{{ $t(`create.preset.${preset}.description`) ?? '' }}</span>
              </button>
            </div>

            <div class="rule-setting subcard">
              <div class="card-title small">{{ $t('create.asIfAtBehavior') ?? '"As If" At Behavior' }}</div>
              <div class="as-if-at-options">
                <label class="as-if-at-option" :class="{ selected: !strictAsIfAt }" @click="strictAsIfAt = false">
                  <div class="as-if-at-header">
                    <input type="radio" v-model="strictAsIfAt" :value="false" id="asIfAtChapter1" />
                    <span class="as-if-at-name">{{ $t('create.asIfAtChapter1') ?? 'Chapter 1 Rules' }}</span>
                  </div>
                  <div class="as-if-at-desc">{{ $t('create.asIfAtChapter1Description') ?? '' }}</div>
                </label>
                <label class="as-if-at-option" :class="{ selected: strictAsIfAt }" @click="strictAsIfAt = true">
                  <div class="as-if-at-header">
                    <input type="radio" v-model="strictAsIfAt" :value="true" id="asIfAtChapter2" />
                    <span class="as-if-at-name">{{ $t('create.asIfAtChapter2') ?? 'Chapter 2 Rules' }}</span>
                  </div>
                  <div class="as-if-at-desc">{{ $t('create.asIfAtChapter2Description') ?? '' }}</div>
                </label>
              </div>
            </div>
          </div>
        </transition>
      </div>

      <div v-if="recommendedToggles.length > 0" class="card">
        <div class="card-title">{{ $t('create.recommendedOptions') ?? 'Recommended options' }}</div>

        <div class="recommended-list">
          <div class="recommended-row" v-for="o in recommendedToggles" :key="optKey(o)">
            <div class="recommended-text">
              <div class="recommended-name">
                <BugAntIcon v-if="o.icon === 'bug-ant'" class="recommended-icon" aria-hidden="true" />
                {{ $t(`create.recommendedOption.${o.option.tag}.title`) ?? o.option.tag }}
              </div>
              <div class="recommended-desc" v-if="$te?.(`create.recommendedOption.${o.option.tag}.description`)">
                {{ $t(`create.recommendedOption.${o.option.tag}.description`) }}
              </div>
            </div>

            <div class="segmented segmented-2 recommended-toggle">
              <input
                type="radio"
                :id="`rec-${optKey(o)}-on`"
                :checked="isOptEnabled(o)"
                @change="setOptEnabled(o, true)"
              />
              <label :for="`rec-${optKey(o)}-on`">{{ $t('On') ?? 'On' }}</label>

              <input
                type="radio"
                :id="`rec-${optKey(o)}-off`"
                :checked="!isOptEnabled(o)"
                @change="setOptEnabled(o, false)"
              />
              <label :for="`rec-${optKey(o)}-off`">{{ $t('Off') ?? 'Off' }}</label>
            </div>
          </div>
        </div>
      </div>

      <template v-for="group in uabGroups" :key="group.key">
        <div v-if="group.tags.length > 0" class="card rules-card">
          <button type="button" class="rules-toggle" @click="uabExpanded[group.key] = !uabExpanded[group.key]">
            <span class="card-title" style="margin-bottom: 0">
              {{ $t(`ultimatumsAndBoons.${group.key}`) }}
              <span v-if="group.beta" class="uab-beta-pill">{{ $t('ultimatumsAndBoons.betaBadge') }}</span>
            </span>
            <span class="rules-header-right">
              <span class="preset-pill" :class="{ 'uab-active': uabSelectedCount(group) > 0 }">
                {{ uabSelectedCount(group) > 0
                  ? $t('ultimatumsAndBoons.selectedCount', { count: uabSelectedCount(group) })
                  : $t('ultimatumsAndBoons.noneSelected') }}
              </span>
              <span class="rules-chevron" :class="{ expanded: uabExpanded[group.key] }">▸</span>
            </span>
          </button>
          <transition name="slide">
            <div v-if="uabExpanded[group.key]" class="rules-body subcard">
              <div class="uab-group">
                <label v-for="tag in group.tags" :key="tag" class="uab-row">
                  <input type="checkbox" :value="tag" v-model="ultimatumsAndBoons" />
                  <span class="uab-text">
                    <span class="uab-name">
                      {{ $t(`ultimatumsAndBoons.entries.${tag}.name`) }}
                      <span v-if="UAB_DECKBUILDING_TAGS.has(tag)" class="uab-deckbuilding-badge">
                        {{ $t('ultimatumsAndBoons.deckbuildingBadge') }}
                      </span>
                    </span>
                    <span class="uab-desc">{{ $t(`ultimatumsAndBoons.entries.${tag}.text`) }}</span>
                  </span>
                </label>
              </div>
            </div>
          </transition>
        </div>
      </template>
    </section>
  </div>
</template>

<style lang="scss" scoped>
.game-options {
  display: grid;
  grid-template-columns: 360px minmax(0, 1fr);
  gap: 16px;
  align-items: start;
}

@media (max-width: 1100px) {
  .game-options {
    grid-template-columns: 1fr;
  }
}

.summary {
  position: sticky;
}

.config {
  min-width: 0;
  display: grid;
  gap: 12px;
}

.selection-box.campaign {
  aspect-ratio: 4 / 3;
}

.selection-box.sidestory {
  aspect-ratio: 3 / 2;
}

.selection-img {
  inset: 0;
  width: 100%;
  border-radius: 3px;
  display: block;
  object-fit: cover;
  object-position: 50% 50%;
  filter: contrast(1.05);
  outline: 1px solid #9e8a60;
  pointer-events: none;
}

/* Cards */
.card {
  border-radius: 3px;
  background: rgba(12, 27, 27, 0.68);
  border: 1px solid rgba(188, 166, 119, 0.2);
  padding: 12px;
  box-shadow: 0 8px 22px rgba(0, 0, 0, 0.22);
}

.subcard {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid #d7cfba;
}

.card-title {
  font-size: 12px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #65705c;
  margin-bottom: 8px;
}

.mini-campaign-desc {
  font-size: 13px;
  line-height: 1.5;
  color: #65705c;
}

.mini-campaign-desc :deep(p) {
  margin: 0 0 10px;
}

.mini-campaign-desc :deep(ul) {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.mini-campaign-desc :deep(li) {
  position: relative;
  padding-left: 18px;
}

.mini-campaign-desc :deep(li)::before {
  content: '';
  position: absolute;
  left: 2px;
  top: 0.55em;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #d7cfba;
}

.card-title.small {
  opacity: 0.85;
}

.deck-requirements-card {
  border-color: rgba(255, 211, 112, 0.18);
  background: rgba(95, 65, 10, 0.24);
}

.deck-requirements {
  margin: 0;
  padding-left: 20px;
  color: rgba(255, 226, 154, 0.95);
  line-height: 1.35;
  font-size: 13px;
}

/* Text input */
.text {
  width: 100%;
  outline: 0;
  border-radius: 10px;
  padding: 10px 12px;
  background: rgba(0, 0, 0, 0.22);
  color: #fff;
}

.text::placeholder {
  color: #65705c;
}

/* Segmented controls */
input[type='radio'] {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  clip-path: inset(50%);
  overflow: hidden;
}
input[type='radio']:focus-visible + label {
  outline: 2px solid #c5b17c;
  outline-offset: -3px;
}

.segmented {
  position: relative;
  display: grid;
  border-radius: 3px;
  overflow: hidden;
  border: 1px solid #d7cfba;
  background: rgba(0, 0, 0, 0.12);
}

.segmented-2 { grid-template-columns: repeat(2, 1fr); }
.segmented-3 { grid-template-columns: repeat(3, 1fr); }
.segmented-4 { grid-template-columns: repeat(4, 1fr); }
.segmented-5 { grid-template-columns: repeat(5, 1fr); }

.segmented label {
  color: #ded9c9;
  min-width: 0;
  min-height: 44px;
  box-sizing: border-box;
  text-align: center;
  white-space: normal;
  overflow-wrap: anywhere;
  line-height: 1.5;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 10px 8px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-size: 12px;
  user-select: none;
  cursor: pointer;
  background: #d7cfba;
  border-right: 1px solid #d7cfba;
}

/* Five across is tighter than the others, and labels like "Standard" overflow
   at the default uppercase tracking. After .segmented label on purpose: equal
   specificity, so the later rule is the one that applies. */
.segmented-5 label {
  padding: 10px 4px;
  letter-spacing: 0.02em;
}

.segmented label:last-of-type {
  border-right: none;
}

.segmented label:hover {
  background: #d7cfba;
}

input[type='radio']:checked + label {
  color: #fff5dc;
  background: #3d594d;
  box-shadow: inset 0 0 0 1px #a9976a;
}

/* Scenario picker */
.scenario-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}

@media (max-width: 1100px) {
  .scenario-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

.scenario-tile {
  border: 0;
  padding: 0;
  background: transparent;
  border-radius: 3px;
  overflow: hidden;
  cursor: pointer;
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.35);
  outline: 1px solid #d7cfba;
}

.scenario-tile img {
  width: 100%;
  display: block;
  filter: saturate(0.78);
  transition: filter 220ms ease, transform 220ms ease;
}

.scenario-tile:hover img {
  filter: none;
  transform: scale(1.02);
}

.scenario-tile.selected img {
  filter: none;
}

/* Slide transition */
.slide-enter-active,
.slide-leave-active {
  transition: all 0.3s ease-in-out;
}

.slide-enter-to,
.slide-leave-from {
  overflow: hidden;
  max-height: 1000px;
  opacity: 1;
}

.slide-enter-from,
.slide-leave-to {
  overflow: hidden;
  max-height: 0;
  opacity: 0;
}

.callout {
  margin-top: 10px;
  padding: 12px;
  border-radius: 3px;
  background: rgba(0,0,0,0.18);
  box-shadow: 0 10px 22px rgba(0,0,0,0.22);
}

.callout-title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12px;
  letter-spacing: 0.10em;
  text-transform: uppercase;
  color: #65705c;
  margin-bottom: 6px;
}

.callout-icon {
  opacity: 0.9;
  animation: glow 1.5s infinite alternate;
}

.callout-body {
  font-size: 13px;
  line-height: 1.35;
  color: #65705c;
}

@keyframes glow {
  from {
    color: #000;
    text-shadow: 0 0 0px var(--select);
  }
  to {
    color: var(--select); /* Glowing color */
    text-shadow: 0 0 10px var(--select);
  }
}

.token-preview {
  display: flex;
  gap: 5px;
  flex-wrap: wrap;
  flex-direction: row;
  justify-content: center;
  @media (max-width: 800px) and (orientation: portrait) {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr 3fr 1fr 1fr 1fr;
    img{
      margin: 0 auto;
    }
    img:nth-child(6n+1) {
      grid-column: 1;
    }

    img:nth-child(6n+2) {
      grid-column: 2;
    }

    img:nth-child(6n+3) {
      grid-column: 3;
    }

    img:nth-child(6n+4) {
      grid-column: 5;
    }

    img:nth-child(6n+5) {
      grid-column: 6;
    }

    img:nth-child(6n) {
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
    border: 1px solid #65705c;
    border-radius: 30px;
    box-shadow: 0 4px 4px rgba(0,0,0,0.5);
  }
}

.beta-warning,
.alpha-warning {
  margin-top: 12px;
  padding: 12px;
  border-radius: 3px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 13px;
  box-shadow: 0 10px 22px rgba(0,0,0,0.22);
}

.beta-warning {
  background: rgba(184, 134, 11, 0.25);
}

.alpha-warning {
  background: rgba(139, 0, 0, 0.25);
}

.variant {
  display: flex;
  flex-direction: column;
  :deep(small) {
    font-size: 0.85em;
    margin-top: 4px;
    color: #f3ebd8;
  }
}

.epic-groups {
  margin-top: 10px;
  display: grid;
  gap: 10px;
}

.epic-group-row {
  display: grid;
  grid-template-columns: 1fr 120px;
  gap: 10px;
}

.epic-field {
  display: grid;
  gap: 4px;
}

.epic-field .text {
  border-radius: 10px;
}

.epic-time-limit {
  margin-top: 14px;
  display: flex;
  align-items: flex-end;
  gap: 16px;
  flex-wrap: wrap;
}

.epic-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.epic-toggle input[type='checkbox'] {
  width: 18px;
  height: 18px;
  cursor: pointer;
}

.epic-time-limit .epic-field-count {
  width: 120px;
}

.achievements-desc {
  margin-top: 10px;
  font-size: 12px;
  line-height: 1.35;
  color: #65705c;
}

.recommended-list {
  display: grid;
  gap: 10px;
}

.recommended-row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 12px;
  align-items: center;
  padding-top: 8px;
  border-top: 1px solid #d7cfba;
}

.recommended-row:first-child {
  border-top: none;
  padding-top: 0;
}

.recommended-name {
  font-size: 13px;
  color: #65705c;
}

.recommended-desc {
  margin-top: 4px;
  font-size: 12px;
  line-height: 1.3;
  color: #65705c;
}

.recommended-toggle {
  width: 180px;
}

.rules-body {
  display: grid;
  gap: 12px;
}

.preset-options {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.preset-option {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 12px;
  border-radius: 10px;
  background: rgba(0, 0, 0, 0.12);
  color: inherit;
  cursor: pointer;
  text-align: left;
  transition: background 150ms ease, border-color 150ms ease;
}

.preset-option.selected {
  background: rgba(110, 134, 64, 0.2);
  border-color: rgba(110, 134, 64, 0.6);
}

.preset-option:hover:not(.selected) {
  background: #d7cfba;
}

.preset-name {
  font-size: 13px;
  font-weight: 500;
  color: #65705c;
}

.preset-desc {
  font-size: 11px;
  line-height: 1.3;
  color: #65705c;
}

.rule-setting {
  margin-top: 0;
}

.as-if-at-options {
  display: grid;
  gap: 8px;
}

.as-if-at-option {
  padding: 10px 12px;
  border-radius: 10px;
  background: rgba(0, 0, 0, 0.12);
  cursor: pointer;
  transition: background 150ms ease, border-color 150ms ease;
}

.as-if-at-option.selected {
  background: rgba(110, 134, 64, 0.2);
  border-color: rgba(110, 134, 64, 0.6);
}

.as-if-at-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.as-if-at-header :deep(input[type='radio']),
.as-if-at-header input[type='radio'] {
  display: inline-block !important;
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  accent-color: rgb(110, 134, 64);
}

.as-if-at-name {
  font-size: 13px;
  color: #65705c;
  font-weight: 500;
}

.as-if-at-desc {
  margin-top: 5px;
  font-size: 12px;
  line-height: 1.35;
  color: #65705c;
}

.rules-header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.preset-pill {
  font-size: 11px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  padding: 2px 8px;
  border-radius: 999px;
  background: #d7cfba;
  color: #65705c;
}

.preset-pill.chapter1,
.preset-pill.chapter2 {
  background: rgba(110, 134, 64, 0.25);
  border-color: rgba(110, 134, 64, 0.55);
  color: rgba(180, 210, 120, 0.9);
}

.rules-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  background: none;
  border: none;
  color: inherit;
  cursor: pointer;
  padding: 0;
}

.rules-chevron {
  font-size: 12px;
  color: #65705c;
  transition: transform 200ms ease;
}

.rules-chevron.expanded {
  transform: rotate(90deg);
}

.preset-pill.uab-active {
  background: rgba(110, 134, 64, 0.25);
  border-color: rgba(110, 134, 64, 0.55);
  color: rgba(180, 210, 120, 0.9);
}

.uab-group {
  display: grid;
  gap: 8px;
}

.uab-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 10px;
  background: rgba(0, 0, 0, 0.12);
  cursor: pointer;
  transition: background 150ms ease, border-color 150ms ease;
}

.uab-row:has(input:checked) {
  background: rgba(110, 134, 64, 0.2);
  border-color: rgba(110, 134, 64, 0.6);
}

.uab-row input[type='checkbox'] {
  width: 15px;
  height: 15px;
  margin-top: 2px;
  flex-shrink: 0;
  accent-color: rgb(110, 134, 64);
}

.uab-text {
  display: grid;
  gap: 4px;
}

.uab-name {
  font-size: 13px;
  font-weight: 500;
  color: #65705c;
}

.uab-desc {
  font-size: 12px;
  line-height: 1.35;
  color: #65705c;
}

.uab-deckbuilding-badge {
  font-size: 10px;
  font-weight: 400;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  padding: 1px 6px;
  margin-left: 4px;
  border-radius: 999px;
  border: 1px solid rgba(255, 211, 112, 0.35);
  background: rgba(95, 65, 10, 0.35);
  color: rgba(255, 226, 154, 0.95);
  white-space: nowrap;
}

/* matches the campaign-box beta ribbon color (darkgoldenrod), pill-shaped */
.uab-beta-pill {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  padding: 1px 8px;
  margin-left: 6px;
  border-radius: 999px;
  background: darkgoldenrod;
  color: white;
  white-space: nowrap;
  vertical-align: middle;
}

.recommended-icon {
  width: 1em;
  height: 1em;
  vertical-align: -0.15em;
  margin-right: 0.4em;
  opacity: 0.75;
}

@media (max-width: 700px) {
  .recommended-row {
    grid-template-columns: 1fr;
  }
  .recommended-toggle {
    width: 100%;
  }
}

/* Expedition dossier: light materials, compact configuration, full-color cover. */
.game-options { grid-template-columns: minmax(220px, 300px) minmax(0, 1fr); gap: 18px; color: #354337; }
.summary { top: 12px; padding: 10px; border: 1px solid #b5a078; border-radius: 7px; background: #f7f2e5; box-shadow: inset 0 0 0 3px #ede5d2, 0 5px 18px rgb(62 50 27 / 0.15); }
.selection-box.campaign, .selection-box.sidestory { aspect-ratio: auto; }
.selection-img { object-fit: contain; filter: none; border-radius: 3px; outline-color: #b5a078; }
.selection-title { margin: 12px 4px 5px; color: #36442f; font: 600 1.1rem / 1.5 'Source Han Serif', 'Arno', serif; }
.config { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; padding: 16px; border: 1px solid #b5a078; border-radius: 7px; background: rgb(246 242 229 / 0.94); box-shadow: inset 0 0 0 3px rgb(255 251 239 / 0.7), 0 5px 18px rgb(62 50 27 / 0.1); }
.config > .card { grid-column: 1 / -1; }
.config > .compact-setting { grid-column: auto; }
.card { min-width: 0; padding: 14px; border: 1px solid #d1c6ad; border-radius: 5px; background: linear-gradient(130deg, #fcf9f0, #eee9da); box-shadow: 0 2px 5px rgb(62 50 27 / 0.04); }
.card-title { font-size: 0.82rem; font-weight: 600; letter-spacing: 0.03em; color: #405039; }
.subcard, .recommended-row { border-color: #d7cfba; }
.text { box-sizing: border-box; width: 100%; min-height: 40px; margin: 0; padding: 9px 11px; border: 1px solid #b9b096; border-radius: 4px; background: #fffcf4; color: #354337; font: inherit; font-size: 0.86rem; }
.text::placeholder { color: #838773; }
.epic-field .text { border-radius: 4px; }
.segmented { gap: 2px; padding: 3px; border: 1px solid #c6bea7; border-radius: 4px; background: #e6e3d4; }
.segmented label { min-height: 38px; padding: 7px 8px; border: 0; border-radius: 3px; background: transparent; color: #59644e; letter-spacing: 0.02em; }
.segmented label:hover { background: #f8f5eb; }
input[type='radio']:checked + label { background: #485e42; color: #fff6df; box-shadow: inset 0 0 0 1px #a1a776; }
.variant:has(input:checked) :deep(small) { color: #f3ebd8; }
.variant :deep(small) { color: #707a63; }
.callout { background: #e4e7d4; border: 1px solid #bfc8a4; box-shadow: none; }
.callout-title, .recommended-name, .preset-name, .as-if-at-name, .uab-name { color: #3c4d35; }
.callout-body, .mini-campaign-desc, .achievements-desc, .recommended-desc, .preset-desc, .as-if-at-desc, .uab-desc { color: #68725d; line-height: 1.6; }
.callout-icon { animation: none; color: #6d7f4b; }
.rules-card { padding: 12px 14px; }
.rules-toggle { min-height: 32px; box-shadow: none; border-radius: 3px; background: transparent; text-align: left; }
.rules-chevron { color: #737e63; }
.preset-pill { background: #e3e6d7; color: #69775d; }
.preset-pill.chapter1, .preset-pill.chapter2, .preset-pill.uab-active { background: #dbe3c9; color: #52653b; }
.preset-option, .as-if-at-option, .uab-row { border: 1px solid #d3cbb6; border-radius: 4px; background: #f8f5eb; }
.preset-option.selected, .as-if-at-option.selected, .uab-row:has(input:checked) { background: #e0e7d0; border-color: #a9b68e; }
.preset-option:hover:not(.selected) { background: #eeefdf; }
.deck-requirements-card, .beta-warning { background: #f4e7c6; border: 1px solid #c7aa70; color: #775a27; box-shadow: none; }
.deck-requirements, .uab-deckbuilding-badge { color: #775a27; }
.uab-deckbuilding-badge { background: #f3e6c8; border-color: #c7aa70; }
.alpha-warning { color: #8a4437; background: #f0ded1; box-shadow: none; }
.scenario-tile { border: 1px solid #b7ab8a; padding: 4px; background: #f8f3e5; box-shadow: 0 2px 5px rgb(62 50 27 / 0.1); }
.scenario-tile.selected { outline: 2px solid #788957; outline-offset: 1px; }
.token-preview { justify-content: flex-start; padding: 8px; border-radius: 4px; background: #e2ddca; }
.token-preview img { box-shadow: 0 2px 3px rgb(56 47 30 / 0.2); }
input[type='radio']:focus-visible + label, button:focus-visible, .text:focus-visible { outline: 2px solid #61774f; outline-offset: 2px; }
@media (max-width: 1100px) { .game-options { grid-template-columns: 220px minmax(0, 1fr); } .config { grid-template-columns: 1fr; } }
@media (max-width: 760px) { .game-options { grid-template-columns: 1fr; } .summary { position: static; display: grid; grid-template-columns: 120px minmax(0, 1fr); align-items: center; gap: 14px; } .summary-actions { grid-column: 1 / -1; } .selection-box { width: 120px; flex-shrink: 0; } .selection-title { font-size: 1rem; } .config { padding: 10px; } .scenario-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
</style>
