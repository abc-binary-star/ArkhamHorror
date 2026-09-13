<script lang="ts" setup>
import { clientLog, clientError } from '@/utils/clientLog'
import { isTabletopFrame, TABLETOP_DISMISS, tabletopDocument, useFixedTabletop } from '@/arkham/composables/useFixedTabletop'
import { useGameAudio } from '@/arkham/composables/useGameAudio'
import { ArrowLeft, Music, Volume2, VolumeX, SlidersHorizontal, Minimize, Maximize, PanelRight, Monitor } from '@lucide/vue'
import {
  computed,
  markRaw,
  nextTick,
  onMounted,
  onErrorCaptured,
  onUnmounted,
  provide,
  ref,
  shallowRef,
  watch,
} from 'vue'
import { useToast } from 'vue-toastification'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import confetti from '@/effects/confetti'
import { useEventListener, useResizeObserver, useFullscreen } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { useSettings } from '@/stores/settings'
import { MenuItem } from '@headlessui/vue'
import {
  AdjustmentsHorizontalIcon,
  BeakerIcon,
  BoltIcon,
  BugAntIcon,
  ClockIcon,
  DocumentArrowDownIcon,
  DocumentTextIcon,
  EyeIcon,
  ExclamationTriangleIcon,
  XMarkIcon,
} from '@heroicons/vue/20/solid'
import { LottieAnimation } from 'lottie-web-vue'
import * as JsonDecoder from 'ts.data.json'
import processingJSON from '@/assets/processing.json'
import api from '@/api'
import {
  fetchGame,
  fetchGameStep,
  buildWebsocketUrl,
  undoChoice,
  undoScenarioChoice,
  undoAction,
  undoTurn,
  undoPhase,
  undoRound,
  markEventReady,
  eventTimeUp,
} from '@/arkham/api'
import * as Api from '@/arkham/api'
import { useCardStore } from '@/stores/cards'
import { useUserStore } from '@/stores/user'
import { useEventStore } from '@/arkham/stores/event'
import { useBgm } from '@/arkham/composables/useBgm'
import { useEventTimer } from '@/arkham/composables/useEventTimer'
import { useFocusLight } from '@/arkham/composables/useFocusLight'
import { useGameSocket, useSingleFlight } from '@/arkham/composables/useGameSocket'
import { useImagePreloader } from '@/arkham/composables/useImagePreloader'
import { useTurnTitleFlash } from '@/arkham/composables/useTurnTitleFlash'
import { awaitingOrganizer, type SharedEventState } from '@/arkham/types/EpicEvent'
import { useMenu } from '@/arkham/composables/menu'
import useEmitter from '@/arkham/composables/useEmitter'
import { useDebug } from '@/arkham/debug'
import { cardImg, imgsrc, isTypingTarget } from '@/arkham/helpers'
import { handleEmbeddedI18n } from '@/arkham/i18n'
import { getGameLocalStorageItem, setGameLocalStorageItem } from '@/arkham/localStorage'
import * as ArkhamGame from '@/arkham/types/Game'
import { deckMetaValue, type ArkhamDbDecklist, type Deck } from '@/arkham/types/Deck'
import { subscribeToDeckSaves } from '@/arkham/deckSaveNotifications'
import {
  choicesByPlayerKey,
  choicesSourceByPlayerKey,
  choicesTooltipByPlayerKey,
} from '@/arkham/composables/useGameChoices'
import { buildGameIndexes, gameIndexesKey } from '@/arkham/composables/useGameIndexes'
import {
  undoControlsKey,
  chooseAmountsKey,
  chooseDeckKey,
  chooseDeckListKey,
  choosePaymentAmountsKey,
  processingKey,
  scenarioSpecificAnswerKey,
  sendKey,
  showOtherPlayersHandsKey,
  skipAllAvailableKey,
  skipAllInProgressKey,
  skipAllTriggersKey,
  soloKey,
  spectateKey,
  storyAnswerPendingKey,
  switchInvestigatorKey,
  uiLockKey,
  phaseAnnouncementKey,
} from '@/arkham/injectionKeys'
import { Card, asCardCode, cardDecoder, toCardContents } from '@/arkham/types/Card'
import { customCardDef, isCustomCardCode } from '@/arkham/customCards'
import * as Message from '@/arkham/types/Message'
import { type Question } from '@/arkham/types/Question'
import type { Source } from '@/arkham/types/Source'
import { TarotCard, tarotCardDecoder, tarotCardImage } from '@/arkham/types/TarotCard'
import Campaign from '@/arkham/components/Campaign.vue'
import CampaignLog from '@/arkham/components/CampaignLog.vue'
import CampaignSettings from '@/arkham/components/CampaignSettings.vue'
import CardOverlay from '@/arkham/components/CardOverlay.vue'
import CardView from '@/arkham/components/Card.vue'
import MultiplayerLobby from '@/arkham/components/MultiplayerLobby.vue'
import GameLog from '@/arkham/components/GameLog.vue'
import HistoryPanel from '@/arkham/components/HistoryPanel.vue'
import ScenarioSettings from '@/arkham/components/ScenarioSettings.vue'
import Settings from '@/arkham/components/Settings.vue'
import OrganizerBar from '@/arkham/components/OrganizerBar.vue'
import PlayerEventBar from '@/arkham/components/PlayerEventBar.vue'
import EventStartBarrier from '@/arkham/components/EventStartBarrier.vue'
import EventActAdvanceBarrier from '@/arkham/components/EventActAdvanceBarrier.vue'
import StandaloneScenario from '@/arkham/components/StandaloneScenario.vue'
import StoryQuestion from '@/arkham/components/StoryQuestion.vue'
import AchievementToast from '@/arkham/components/AchievementToast.vue'
import { clearCurrentNarration, stopNarration } from '@/arkham/narration'
import Draggable from '@/components/Draggable.vue'
import Menu from '@/components/Menu.vue'
import Prompt from '@/components/Prompt.vue'
import LoadState from '@/components/LoadState.vue'

interface GameCard {
  title: string
  card: Card
}

interface GameCardOnly {
  player: string
  title: string
  card: Card
}

// TODO: contents should not be string
type ServerResult =
  | { tag: 'GameError'; contents: string }
  | { tag: 'GameMessage'; contents: string }
  | { tag: 'GameTarot'; contents: string }
  | { tag: 'GameAchievement'; contents: string }
  | { tag: 'GameCard'; contents: string }
  | { tag: 'GameCardOnly'; contents: string }
  | { tag: 'GameUpdate'; contents: string }
  | { tag: 'GameShowDiscard'; contents: string }
  | { tag: 'GameShowUnder'; contents: string }
  | { tag: 'GameUI'; contents: string }
  | { tag: 'GameAudio'; contents: string }
  | { tag: 'SharedStateUpdate'; contents: SharedEventState }
  | { tag: 'EventChanged' }

export interface Props {
  gameId: string
  spectate?: boolean
}

const props = withDefaults(defineProps<Props>(), { spectate: false })

const fixedResolution = useFixedTabletop()
const fixedTabletopFrame = isTabletopFrame()

const debug = useDebug()
const emitter = useEmitter()
const router = useRouter()
const route = useRoute()
const store = useCardStore()
const userStore = useUserStore()
const eventStore = useEventStore()
const { addEntry, menuItems } = useMenu()
const toast = useToast()

// "Epic Multiplayer": a group's game can be entered two ways — via the dashboard's
// per-group links (which carry an ?event=<id> query param) OR via the plain
// join / "take a seat" path (which does NOT). To engage the event on EITHER path
// we resolve the event id from the URL first, then fall back to the `eventId` the
// game-fetch response now carries (resolved server-side). Everything that needs to
// know "which event is this game a group of" keys off `resolvedEventId`; only true
// navigation/links keep using the raw `eventQueryId`.
const eventQueryId = computed(() => {
  const q = route.query.event
  return typeof q === 'string' && q !== '' ? q : null
})

// Set from the fetchGame payload's `eventId` (null for ordinary games). Lets a
// group game engage its event even when the URL is missing ?event.
const gamePayloadEventId = ref<string | null>(null)

const resolvedEventId = computed(() => eventQueryId.value ?? gamePayloadEventId.value)

const organizerEventId = computed(() => {
  const eid = resolvedEventId.value
  if (!eid) return null
  const ev = eventStore.event
  return ev && ev.id === eid && ev.role === 'organizer' ? eid : null
})

// Player-facing counterpart: any seated MEMBER (not the organizer) of an Epic
// event may switch to / spectate the sibling groups. NOT gated on the local dev
// flag — invited players don't have it set, but their game is still part of the
// event server-side. Engages purely on the loaded event containing this gameId
// (mirrors organizerEventId). Events can only be CREATED with the dev flag, so
// there are no event games in production regardless. Organizer keeps OrganizerBar.
const playerEventId = computed(() => {
  const eid = resolvedEventId.value
  if (!eid) return null
  const ev = eventStore.event
  if (!ev || ev.id !== eid || ev.role === 'organizer') return null
  return ev.groups.some((g) => g.gameId === props.gameId) ? eid : null
})

watch(
  resolvedEventId,
  (eid) => {
    if (!eid) return
    if (eventStore.event?.id === eid) return
    eventStore.load(eid).catch((e) => console.error(e))
  },
  { immediate: true },
)

// Main Street can transfer this player's complete investigator state to a
// sibling game. EventChanged refreshes the roster; follow that authoritative
// membership so the old websocket is replaced by the destination game's room.
watch([() => eventStore.event, () => userStore.currentUser?.username], ([event, username]) => {
  if (!event || !username || event.role === 'organizer' || props.spectate) return
  const currentGroup = event.groups.find((group) => group.gameId === props.gameId)
  if (currentGroup?.players.some((player) => player.username === username)) return
  const destination = event.groups.find((group) =>
    group.players.some((player) => player.username === username),
  )
  if (!destination?.gameId) return
  void router.replace({
    name: 'Game',
    params: { gameId: destination.gameId },
    query: { event: event.id },
  })
})

// "Epic Multiplayer" time limit. The event id this game view actively
// PARTICIPATES in for the timer: a seated player (or an organizer playing a
// seat), never the organizer's spectate/non-playing view. NOT gated on the local
// dev flag (invited players don't have it) — engages purely on the loaded event
// containing this game as a group, so ordinary games never engage.
const timerEventId = computed(() => {
  if (props.spectate) return null
  const eid = resolvedEventId.value
  if (!eid) return null
  const ev = eventStore.event
  if (!ev || ev.id !== eid) return null
  return ev.groups.some((g) => g.gameId === props.gameId) ? eid : null
})

const { hasTimeLimit, barrierPending, timerStartedAt, timeUp } = useEventTimer()

// Whether an epic bar (organizer or player) is mounted above the board.
const hasEventBar = computed(() => !!organizerEventId.value || !!playerEventId.value)

// Measure the optional event bar so the flex layout can reserve its space without
// pushing the board's player area below the viewport.
const epicBarRef = ref<HTMLElement | null>(null)
const epicBarHeight = ref(0)
useResizeObserver(epicBarRef, () => {
  epicBarHeight.value = epicBarRef.value?.offsetHeight ?? 0
})
watch(hasEventBar, (present) => {
  if (!present) epicBarHeight.value = 0
})

const { preloadImages } = useImagePreloader()
const {
  pointer,
  flashlightX,
  flashlightY,
  focusLightX,
  focusLightY,
  updateFocusLight,
} = useFocusLight()

store.fetchCards()
store.fetchCustomCards(props.gameId)

interface PlayabilityInfo {
  cardId: string
  cardCode: string
  checks: [string, string | null][]
}

const game = shallowRef<ArkhamGame.Game | null>(null)

/* A custom card someone else created shows up in the game payload before this
 * client has its def; refetch the game's custom cards when an unknown one
 * appears. */
watch(game, (g) => {
  if (!g) return
  const missing = (code: string) => isCustomCardCode(code) && !customCardDef(code)
  // A custom investigator never appears in `cards`; it is only a seat.
  const unknown =
    Object.values(g.cards).some((c) => missing(asCardCode(c))) ||
    Object.values(g.investigators).some((i) => missing(i.cardCode))
  if (unknown) store.fetchCustomCards(props.gameId)
})

// "Ready to play": the group has reached the first investigation phase of an
// active, started scenario. Cleanest signal we have off the existing game state.
const reachedInvestigation = computed(() => {
  const g = game.value
  return (
    !!g &&
    g.gameState.tag === 'IsActive' &&
    !!g.scenario?.started &&
    g.phase === 'InvestigationPhase'
  )
})

// Show the blocking start-barrier overlay only once this group has finished its own
// setup (reached investigation) and is waiting on the other groups. Gating on
// reachedInvestigation is essential: blocking the board during deck selection /
// mulligan would stop the player from ever reaching investigation -> deadlock.
const showStartBarrier = computed(
  () => !!timerEventId.value && barrierPending.value && reachedInvestigation.value,
)

// Stage (1/2/3) of the act currently in play for this group, fed to the epic bars'
// shared-pool readout. The Blob has a single act deck, so the lone act in
// `game.acts` is the current one; its sequence number is the stage.
const currentActStage = computed<number | null>(() => {
  const acts = game.value ? Object.values(game.value.acts) : []
  return acts.length > 0 ? acts[0].sequence.number : null
})

// Park an actively-playing member of this event's group behind a wait overlay while
// the shared act advance for their current stage awaits the organizer's allocation.
// Lifts as soon as the `awaiting-organizer:<stage>` gate clears (the backend pushes
// the cleared shared state over the ws), surfacing the group's parked "Continue"
// question for the player to click — mirrors EventStartBarrier's release.
const showActAdvanceWait = computed(
  () =>
    !!timerEventId.value &&
    currentActStage.value !== null &&
    awaitingOrganizer(eventStore.sharedState, currentActStage.value) > 0,
)

// Mark this group ready at the start barrier exactly once per load. Guarded with a
// local flag (the endpoint is idempotent server-side regardless). Immediate so a
// reconnect mid-investigation still signals readiness.
let markedReady = false
watch(
  [timerEventId, reachedInvestigation, barrierPending],
  () => {
    if (markedReady) return
    const eid = timerEventId.value
    if (!eid) return
    if (!hasTimeLimit.value) return
    if (timerStartedAt.value !== 0) return
    if (!reachedInvestigation.value) return
    markedReady = true
    markEventReady(eid).catch((e) => console.error(e))
  },
  { immediate: true },
)

// When the countdown hits 0, force the time-up resolution once. Fires from any
// loaded event game (player or spectating organizer); the endpoint is idempotent
// across clients.
let timeUpFired = false
watch(
  timeUp,
  (up) => {
    if (!up || timeUpFired) return
    const eid = resolvedEventId.value
    if (!eid || !hasTimeLimit.value) return
    timeUpFired = true
    eventTimeUp(eid).catch((e) => console.error(e))
  },
  { immediate: true },
)

const gameCard = ref<GameCard | null>(null)
const cthulhuDeckCardCodes = new Set([
  '11705',
  '11706',
  '11707',
  '11708',
  '11709',
  '11710',
  '11711',
  '11712',
  '11713',
  '11714',
  '11715',
])
const isCthulhuDeckReveal = computed(() => {
  const focusedCard = gameCard.value
  return (
    focusedCard !== null &&
    cthulhuDeckCardCodes.has(toCardContents(focusedCard.card).cardCode.replace(/^c/, ''))
  )
})
const showTheSilenceModal = ref(false)
const playabilityInfo = ref<PlayabilityInfo | null>(null)
const gameLog = shallowRef<readonly string[]>(Object.freeze([]))
const playerId = ref<string | null>(null)
const ready = ref(false)
const resultQueue = ref<any>([])
const showLog = ref(false)
const showTools = ref(false)
const showShortcuts = ref(false)
const isMobileViewport = () =>
  typeof window !== 'undefined' && window.matchMedia('(max-width: 800px)').matches
const showSidebar = ref(
  isMobileViewport()
    ? false
    : JSON.parse(getGameLocalStorageItem(props.gameId, 'showSidebar') ?? 'true'),
)
const socketError = ref(false)
const error = ref<string | null>(null)
const solo = ref(false)
const soundsDisabled = ref(localStorage.getItem('arkhamSoundsDisabled') === 'true')
const { playAudioFile } = useGameAudio(soundsDisabled)
const showOtherPlayersHands = ref(
  getGameLocalStorageItem(props.gameId, 'showOtherPlayersHands') === 'true',
)
watch(showOtherPlayersHands, (v) => {
  setGameLocalStorageItem(props.gameId, 'showOtherPlayersHands', v ? 'true' : 'false')
})
const tarotCards = ref<TarotCard[]>([])
const uiLock = ref<boolean>(false)
// True while a phase interlude banner is on screen (written by PhaseInterlude).
// Revelation-class overlays arriving during a banner queue behind it.
const phaseAnnouncement = ref<boolean>(false)
const showSettings = ref(false)
const showHistory = ref(false)
const processing = ref(false)
// The spinner is only worth showing for a wait a player would otherwise wonder
// about. Most answers round-trip in well under this, so gating it behind a delay
// keeps a plain "continue" click from flickering an animation on every press.
const showProcessing = ref(false)
let processingTimer: ReturnType<typeof setTimeout> | null = null
const endTurnKeyArmed = ref(false)
let endTurnKeyArmTimer: ReturnType<typeof setTimeout> | null = null
watch(processing, (busy) => {
  if (processingTimer) {
    clearTimeout(processingTimer)
    processingTimer = null
  }
  if (!busy) {
    showProcessing.value = false
    return
  }
  processingTimer = setTimeout(() => {
    showProcessing.value = true
  }, 400)
})
// Set while a story/interlude answer is in flight. Those screens keep their text
// on display for the round-trip instead of blanking their question, so this is
// what stops the passage from being answered a second time meanwhile.
const storyAnswerPending = ref(false)
const oldQuestion = ref<Record<string, Question> | null>(null)
const skipAllPending = ref<Set<string>>(new Set())
const { t } = useI18n()

const format = (str: string) => {
  return handleEmbeddedI18n(str, t)
}

function handleSettingChange(event: Event) {
  const detail = (event as CustomEvent<{ key?: string; value?: string }>).detail
  if (detail?.key === 'arkhamSoundsDisabled') {
    soundsDisabled.value = detail.value === 'true'
  }
}

// One-click mute from the game bar; reuses the settings' persistence + sync
// event so the Settings dialog radio stays consistent.
function toggleSounds() {
  soundsDisabled.value = !soundsDisabled.value
  localStorage.setItem('arkhamSoundsDisabled', soundsDisabled.value ? 'true' : 'false')
  window.dispatchEvent(
    new CustomEvent('arkham-setting-change', {
      detail: { key: 'arkhamSoundsDisabled', value: String(soundsDisabled.value) },
    }),
  )
}

function leaveGame() {
  void router.push({ name: 'Home' })
}

const { isFullscreen, isSupported: fullscreenSupported, enter: enterFullscreen, toggle: toggleFullscreen } = useFullscreen(undefined, { document: tabletopDocument() })

// Fullscreen + the "hide the toolbar" preference: the action bar stops reserving
// space and slides out of view until the pointer reaches the top edge. While the
// bar's own surfaces are open (tools drawer, settings, shortcuts) the bar has to
// stay reachable, so it stays put.
const TOOLBAR_REVEAL_ZONE_PX = 30
const TOOLBAR_HIDE_ZONE_PX = 60

const { autoHideToolbarInFullscreen } = storeToRefs(useSettings())
const toolbarRevealed = ref(false)
const toolbarAutoHide = computed(() => isFullscreen.value && autoHideToolbarInFullscreen.value)
const toolbarHidden = computed(
  () =>
    toolbarAutoHide.value &&
    !toolbarRevealed.value &&
    !showTools.value &&
    !showSettings.value &&
    !showShortcuts.value,
)

function handleToolbarPointerMove(event: PointerEvent) {
  if (!toolbarAutoHide.value) return
  if (event.clientY <= TOOLBAR_REVEAL_ZONE_PX) {
    toolbarRevealed.value = true
  } else if (event.clientY > TOOLBAR_HIDE_ZONE_PX) {
    toolbarRevealed.value = false
  }
}

// Leaving fullscreen (or turning the preference off) must never strand the bar
// out of view with nothing left to summon it.
watch(toolbarAutoHide, (active) => {
  if (!active) toolbarRevealed.value = false
})

// Popouts opened from the bar (tools drawer, settings, shortcuts) collapse on
// any press that lands outside them. Floating-vue poppers (undo, indicators)
// run their own outside-press detection, but in the fixed tabletop the frame
// cannot see presses on the surrounding table field, so the host replays one
// (see TABLETOP_DISMISS) and mousedown+click on the document root closes them.
const POPOUT_KEEP_OPEN_SELECTOR = '.game-tools-drawer, .draggable, .game-bar-tools--primary'

function dismissTabletopPopouts() {
  showTools.value = false
  showSettings.value = false
  showShortcuts.value = false
}

useEventListener(document, 'pointerdown', (event) => {
  const target = event.target
  if (!(target instanceof Element)) return
  if (target.closest(POPOUT_KEEP_OPEN_SELECTOR)) return
  dismissTabletopPopouts()
}, { capture: true })

useEventListener(window, 'message', (event) => {
  if (!isTabletopFrame()) return
  if (event.source !== window.parent || event.origin !== window.location.origin) return
  if (event.data?.type !== TABLETOP_DISMISS) return
  dismissTabletopPopouts()
  const root = document.documentElement
  root.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
  root.dispatchEvent(new MouseEvent('click', { bubbles: true }))
})

function updateGameLog(nextLog: readonly string[]) {
  const currentLog = gameLog.value
  if (
    currentLog.length === nextLog.length &&
    currentLog[0] === nextLog[0] &&
    currentLog[currentLog.length - 1] === nextLog[nextLog.length - 1]
  ) {
    return
  }

  gameLog.value = Object.freeze([...nextLog])
}

addEntry({
  id: 'viewSettings',
  icon: AdjustmentsHorizontalIcon,
  content: t('gameBar.viewSettings'),
  shortcut: 'S',
  nested: 'view',
  action: () => (showSettings.value = !showSettings.value),
})

addEntry({
  id: 'viewHistory',
  icon: ClockIcon,
  content: t('gameBar.viewHistory'),
  shortcut: 'H',
  nested: 'view',
  action: () => (showHistory.value = !showHistory.value),
})

// Computed
const cards = computed(() => store.cards)
const choicesByPlayer = computed(() => {
  const currentGame = game.value
  if (!currentGame) return new Map<string, readonly Message.Message[]>()

  return new Map(
    Object.keys(currentGame.question).map((pid) => [pid, ArkhamGame.choices(currentGame, pid)]),
  )
})
const choicesSourceByPlayer = computed(() => {
  const currentGame = game.value
  if (!currentGame) return new Map<string, Source | null>()

  return new Map(
    Object.keys(currentGame.question).map((pid) => [
      pid,
      ArkhamGame.choicesSource(currentGame, pid),
    ]),
  )
})
const choicesTooltipByPlayer = computed(() => {
  const currentGame = game.value
  if (!currentGame) return new Map<string, string | null>()

  return new Map(
    Object.keys(currentGame.question).map((pid) => [
      pid,
      ArkhamGame.choicesTooltip(currentGame, pid),
    ]),
  )
})
const gameIndexes = computed(() => buildGameIndexes(game.value))
const choices = computed(() => {
  if (!playerId.value) return []
  return choicesByPlayer.value.get(playerId.value) ?? []
})
const gameOver = computed(() => game.value?.gameState.tag === 'IsOver')
const { bgmDisabled, toggleBgm } = useBgm(() => game.value, () => gameOver.value)
const questionPlayerId = computed(() => {
  const currentGame = game.value
  if (!currentGame) return playerId.value
  if (playerId.value && currentGame.question[playerId.value]) return playerId.value
  if (solo.value && currentGame.gameState.tag === 'IsChooseDecks') {
    return Object.keys(currentGame.question)[0] ?? playerId.value
  }
  return playerId.value
})
const question = computed(() => {
  const owner = questionPlayerId.value
  return owner ? game.value?.question[owner] : null
})

watch(questionPlayerId, (owner) => {
  if (owner && owner !== playerId.value) playerId.value = owner
})

// Replacing a killed or insane investigator is a chain of setup questions
// (deck, trauma, lead investigator, scenario setup). Some transitions can occur
// after the upgrade component has unmounted, so its local waiting poll cannot
// carry the UI through the whole chain. Keep the game view synchronized until
// the engine leaves IsChooseDecks.
let chooseDecksPoll: ReturnType<typeof setTimeout> | null = null
// Last step this poll has already pulled the full game for. Null means we have
// not probed yet, which counts as "changed" so the first tick resyncs once.
let chooseDecksStep: number | null = null
// Jittered so a table full of clients cannot line up on the same instant.
const chooseDecksInterval = () => 750 + Math.floor(Math.random() * 250)

async function pollChooseDecksState() {
  try {
    const step = await fetchGameStep(props.gameId)
    if (step !== chooseDecksStep) {
      chooseDecksStep = step
      const latest = await fetchGame(props.gameId, props.spectate)
      game.value = latest.game
      if (latest.playerId && !latest.game.question[playerId.value ?? '']) {
        playerId.value = latest.playerId
      }
      followPendingUpgradeQuestion(latest.game)
    }
    if (game.value?.gameState.tag === 'IsChooseDecks') {
      chooseDecksPoll = setTimeout(pollChooseDecksState, chooseDecksInterval())
    } else {
      chooseDecksPoll = null
    }
  } catch {
    chooseDecksPoll = setTimeout(pollChooseDecksState, 1500)
  }
}

watch(
  () => game.value?.gameState.tag,
  (tag) => {
    if (tag === 'IsChooseDecks' && chooseDecksPoll === null) {
      chooseDecksStep = null
      chooseDecksPoll = setTimeout(pollChooseDecksState, 500)
    } else if (tag !== 'IsChooseDecks' && chooseDecksPoll !== null) {
      clearTimeout(chooseDecksPoll)
      chooseDecksPoll = null
    }
  },
)

function questionTag(q: Question | null | undefined): string | null {
  if (!q) return null
  if (q.tag === 'QuestionLabel') return q.question.tag
  return q.tag
}

// PlayerTabs (the in-scenario seat switcher) is mounted only inside Scenario.vue,
// which Campaign.vue renders under exactly this condition. Read off an explicit
// game rather than game.value: applyGameUpdate can defer the game.value swap into
// a view transition, so an incoming update must be inspected directly.
function followPendingUpgradeQuestion(g: ArkhamGame.Game) {
  if (!solo.value || g.gameState.tag !== 'IsChooseDecks') return
  const currentPlayerId = playerId.value
  if (currentPlayerId && g.question[currentPlayerId]) return

  // Replacement investigators can produce follow-up trauma and setup questions
  // after ChooseUpgradeDeck has been answered. Keep following whichever solo
  // investigator owns the continuation instead of remaining on the answered tab.
  const pendingPlayer = Object.keys(g.question)[0]
  if (pendingPlayer) playerId.value = pendingPlayer
}

watch([game, playerId, solo], ([currentGame]) => {
  if (currentGame) followPendingUpgradeQuestion(currentGame)
})

function scenarioBoardMounted(g: ArkhamGame.Game) {
  const scenario = g.scenario
  if (!scenario) return false
  if (g.gameState.tag !== 'IsActive' && g.gameState.tag !== 'IsOver') return false
  if (scenario.campaignStep) return false
  if (!scenario.started) return false
  return Object.keys(g.investigators).length > 0
}

const isActualScenarioView = computed(() => {
  const g = game.value
  if (!g?.scenario) return false
  if (g.gameState.tag !== 'IsActive' && g.gameState.tag !== 'IsOver') return false
  if (!g.scenario.started || g.scenario.campaignStep) return false
  if (Object.entries(g.investigators).length === 0) return false

  const activeQuestionTag = questionTag(question.value)
  return (
    activeQuestionTag !== 'ChooseUpgradeDeck' &&
    activeQuestionTag !== 'ChooseDeck' &&
    activeQuestionTag !== 'ChooseJoinDeck' &&
    activeQuestionTag !== 'PickScenarioSettings' &&
    activeQuestionTag !== 'PickCampaignSettings' &&
    activeQuestionTag !== 'ContinueCampaign'
  )
})

const realityAcidLightOverride = ref<boolean | null>(null)
const realityAcidLightMetaActive = computed(() => {
  const scenario = game.value?.scenario
  return scenario?.id === 'c85001' && scenario.meta?.lightActive === true
})

const realityAcidLightActive = computed(
  () => realityAcidLightOverride.value ?? realityAcidLightMetaActive.value,
)

watch(realityAcidLightMetaActive, () => {
  realityAcidLightOverride.value = null
})

watch(question, async () => {
  await nextTick()
  updateFocusLight()
})

const realityAcidLightDevoured = computed(() => {
  const scenario = game.value?.scenario
  if (scenario?.id !== 'c85001') return false
  return (
    realityAcidLightMetaActive.value ||
    scenario.meta?.lightDevoured === true ||
    realityAcidLightOverride.value !== null
  )
})

const toggleRealityAcidLight = () => {
  const gameId = game.value?.id
  if (!gameId) return
  const active = !realityAcidLightActive.value
  realityAcidLightOverride.value = active
  debug.send(gameId, {
    tag: 'ScenarioSpecific',
    contents: ['blobSetLightActive', active],
  })
}

const activePlayerId = computed(() => game.value?.activePlayerId ?? null)

function activePlayerBelongsToCurrentPlayer(g: ArkhamGame.Game, currentPlayerId: string) {
  if (g.activePlayerId === currentPlayerId) return true
  return Object.values(g.investigators).some(
    (investigator) =>
      investigator.id === g.activePlayerId && investigator.playerId === currentPlayerId,
  )
}

// "Your turn" tab-title flash; the watcher below decides when to start it.
const { flashTurnTitle } = useTurnTitleFlash()

watch(activePlayerId, (newActivePlayerId, oldActivePlayerId) => {
  if (!newActivePlayerId || !oldActivePlayerId || newActivePlayerId === oldActivePlayerId) return
  if (props.spectate || solo.value) return
  if (!game.value || game.value.playerCount < 2 || !playerId.value) return
  if (!activePlayerBelongsToCurrentPlayer(game.value, playerId.value)) return

  playAudioFile('turnIndicator.ogg')
  toast.info(t('game.yourTurn'))
  flashTurnTitle()
})

type SkipTriggerEntry = { playerId: string; choiceIdx: number; investigatorId: string }

function skipTriggerEntries(g: ArkhamGame.Game): SkipTriggerEntry[] {
  const result: SkipTriggerEntry[] = []
  for (const pid of Object.keys(g.question)) {
    const cs = ArkhamGame.choices(g, pid)
    const idx = cs.findIndex((c) => c.tag === Message.MessageType.SKIP_TRIGGERS_BUTTON)
    const choice = idx === -1 ? null : cs[idx]
    if (choice?.tag === Message.MessageType.SKIP_TRIGGERS_BUTTON) {
      result.push({ playerId: pid, choiceIdx: idx, investigatorId: choice.investigatorId })
    }
  }
  return result
}

function investigatorBelongsToPlayer(
  g: ArkhamGame.Game,
  investigatorId: string,
  targetPlayerId: string,
) {
  return g.investigators[investigatorId]?.playerId === targetPlayerId
}

function isInvestigatorTurn(g: ArkhamGame.Game) {
  return (
    g.phaseStep?.tag === 'InvestigationPhaseStep' &&
    [
      'NextInvestigatorsTurnBeginsStep',
      'NextInvestigatorsTurnBeginsWindow',
      'InvestigatorTakesActionStep',
      'InvestigatorsTurnEndsStep',
    ].includes(g.phaseStep.contents)
  )
}

function canCurrentPlayerSkipAllWindows(g: ArkhamGame.Game, currentPlayerId: string) {
  if (solo.value) return true

  if (g.skillTest) {
    return investigatorBelongsToPlayer(g, g.skillTest.investigator, currentPlayerId)
  }

  if (isInvestigatorTurn(g)) {
    return investigatorBelongsToPlayer(g, g.activeInvestigatorId, currentPlayerId)
  }

  return true
}

function authorizedSkipTriggerEntries(g: ArkhamGame.Game): SkipTriggerEntry[] {
  if (!playerId.value) return []
  if (!canCurrentPlayerSkipAllWindows(g, playerId.value)) return []
  return skipTriggerEntries(g)
}

const skipAllAvailable = computed(() => {
  if (!game.value) return false
  if (skipAllPending.value.size > 0) return true

  const entries = authorizedSkipTriggerEntries(game.value)
  const distinct = new Set(entries.map((entry) => entry.playerId))
  if (distinct.size > 1) return true
  // The authorized player (e.g. the skill-test owner) may be waiting on a
  // single other player's fast trigger with no window of their own to skip;
  // let them skip that lone window too. Solo keeps the stricter rule.
  return !solo.value && distinct.size === 1 && !distinct.has(playerId.value ?? '')
})

const skipAllInProgress = computed(() => skipAllPending.value.size > 0)

function setGameQuestion(question: Record<string, Question>) {
  if (!game.value) return
  game.value = { ...game.value, question }
}

const websocketUrl = computed(() => {
  const spectatePrefix = props.spectate ? '/spectate' : ''
  return buildWebsocketUrl(`/api/v1/arkham/games/${props.gameId}${spectatePrefix}`, userStore.token)
})

const loadError = ref(false)
let loadController: AbortController | null = null

// A failed child setup/render must not leave the previous loading frame on screen.
onErrorCaptured((cause, instance, info) => {
  clientError('game.render.error', cause, { component: instance?.$options.name ?? instance?.$options.__name ?? 'anonymous', info, ready: ready.value })
  loadError.value = true
  return false
})
onUnmounted(() => {
  clientLog('game.unmount')
  loadController?.abort()
  loadController = null
})

let loadSequence = 0
const loadGame = async () => {
  const request = ++loadSequence
  const started = performance.now()
  clientLog('game.load.start', { request, spectate: props.spectate, superseding: Boolean(loadController) })
  loadController?.abort()
  const controller = new AbortController()
  loadController = controller
  loadError.value = false
  ready.value = false
  try {
    const {
      game: newGame,
      playerId: newPlayerId,
      multiplayerMode,
      eventId,
    } = await fetchGame(props.gameId, props.spectate, controller.signal)
    if (controller.signal.aborted || loadController !== controller) return

    clientLog('game.load.decoded', { request, elapsedMs: Math.round(performance.now() - started), hasPlayer: Boolean(newPlayerId), mode: multiplayerMode, state: newGame.gameState.tag })
    preloadImages(newGame)
    ;(window as Window & { g?: ArkhamGame.Game }).g = newGame
    game.value = newGame
    solo.value = multiplayerMode === 'Solo'
    // Engage the Epic event this game belongs to even when the URL lacks
    // ?event (e.g. entered via the join / take-a-seat path).
    gamePayloadEventId.value = eventId
    updateGameLog(newGame.log)
    playerId.value = newPlayerId
    ready.value = true
    clientLog('game.load.ready', { request })
    await nextTick()
    clientLog('game.render.flushed', { request, ready: ready.value, error: loadError.value })
    if (fixedTabletopFrame && !loadError.value) {
      window.parent.postMessage({ type: 'arkham-tabletop-ready' }, window.location.origin)
    }
  } catch (cause) {
    if (controller.signal.aborted || loadController !== controller) return
    clientError('game.load.error', cause, { request, elapsedMs: Math.round(performance.now() - started) })
    loadError.value = true
  } finally {
    clientLog('game.load.end', { request, aborted: controller.signal.aborted, elapsedMs: Math.round(performance.now() - started) })
    if (loadController === controller) loadController = null
  }
}

watch(
  // Also react to `spectate`: the same Game.vue instance is reused when an
  // organizer toggles between the Spectate (organizer) and Game (play-my-seat)
  // routes for one gameId, so we must re-fetch in the new mode to pick up the
  // player's seat/question (or drop them when spectating again).
  () => [props.gameId, props.spectate] as const,
  async (newVals, oldVals) => {
    const [newId] = newVals
    if (!newId) return
    if (oldVals && newId === oldVals[0] && newVals[1] === oldVals[1]) return
    await loadGame()
  },
  { immediate: true },
)

// Local Decoders
const gameCardDecoder = JsonDecoder.object<GameCard>(
  {
    title: JsonDecoder.string(),
    card: cardDecoder,
  },
  'GameCard',
)

const gameCardOnlyDecoder = JsonDecoder.object<GameCardOnly>(
  {
    player: JsonDecoder.string(),
    title: JsonDecoder.string(),
    card: cardDecoder,
  },
  'GameCard',
)

// Socket Handling
const onDisconnect = () => {
  processing.value = false
  storyAnswerPending.value = false
  if (game.value && oldQuestion.value) {
    setGameQuestion(oldQuestion.value)
  }
  socketError.value = true
}

let qHead = 0
const qPush = (x: any) => {
  resultQueue.value.push(x)
}
const qPop = () => {
  if (qHead >= resultQueue.value.length) {
    resultQueue.value = []
    qHead = 0
    return undefined
  }
  return resultQueue.value[qHead++]
}

function entitiesMoved(previous: ArkhamGame.Game, current: ArkhamGame.Game) {
  const placementChanged = (
    previousEntities: Record<string, { placement: unknown }>,
    currentEntities: Record<string, { placement: unknown }>,
  ) =>
    Object.entries(currentEntities).some(([id, entity]) => {
      const previousEntity = previousEntities[id]
      return (
        previousEntity &&
        JSON.stringify(previousEntity.placement) !== JSON.stringify(entity.placement)
      )
    })

  return (
    placementChanged(previous.investigators, current.investigators) ||
    placementChanged(previous.enemies, current.enemies)
  )
}

function applyGameUpdate(updatedGame: ArkhamGame.Game, locked: boolean) {
  // skillTest drives the skill-check dialog too: hide it behind a revelation
  // so the reveal is dismissed before the check opens (the queued GameUpdate
  // restores it on unlock).
  const nextGame = locked ? { ...updatedGame, question: {}, skillTest: null } : updatedGame
  const previousGame = game.value
  const apply = async () => {
    game.value = nextGame
    storyAnswerPending.value = false
    await nextTick()
  }
  const transitionDocument = document as Document & {
    startViewTransition?: (callback: () => Promise<void>) => unknown
  }

  if (
    previousGame &&
    entitiesMoved(previousGame, nextGame) &&
    transitionDocument.startViewTransition
  ) {
    transitionDocument.startViewTransition(apply)
  } else {
    void apply()
  }
}

async function applyDecodedUpdate(updatedGame: ArkhamGame.Game): Promise<void> {
  const locked = uiLock.value
  // Behind a revelation: refresh the board but keep the question hidden so the
  // player can't act until they dismiss it. On unlock the queued GameUpdate is
  // replayed (locked === false) and restores the real question + side effects.
  applyGameUpdate(updatedGame, locked)
  updateGameLog(updatedGame.log)
  preloadImages(updatedGame)
  if (!locked) {
    // PlayerTabs owns in-scenario perspective changes so tab routing and
    // return navigation remain coordinated. Campaign/setup screens do not
    // mount PlayerTabs, though, so follow another pending question when the
    // current seat has finished answering. Some sequential group stories
    // keep an empty Read question parked for every seat, so presence alone
    // does not mean the current seat still has an answer to give.
    const questionPlayers = Object.keys(updatedGame.question)
    const actionableQuestionPlayers = questionPlayers.filter(
      (pid) => ArkhamGame.choices(updatedGame, pid).length > 0,
    )
    const currentPlayer = playerId.value ?? ''
    const currentQuestion = updatedGame.question[currentPlayer]
    const currentReadIsWaiting =
      questionTag(currentQuestion) === 'Read' &&
      ArkhamGame.choices(updatedGame, currentPlayer).length === 0 &&
      actionableQuestionPlayers.length > 0
    const nextQuestionPlayer = !questionPlayers.includes(currentPlayer)
      ? questionPlayers[0]
      : currentReadIsWaiting
        ? actionableQuestionPlayers[0]
        : null

    if (
      solo.value &&
      !props.spectate &&
      nextQuestionPlayer &&
      !scenarioBoardMounted(updatedGame)
    ) {
      playerId.value = nextQuestionPlayer
    }
    continueSkipAll()
  }
}

async function recoverFromFailedDecode(err: unknown): Promise<void> {
  // A dropped update used to be an unhandled rejection: the board silently stayed on
  // the previous state, which looks exactly like "the server ignored me" and invites
  // the player to submit the same action again (#5256). Re-fetch instead.
  console.error('Failed to decode game update, refetching', err)
  await fetchGame(props.gameId, props.spectate)
    .then(({ game: refetched }) => {
      applyGameUpdate(refetched, uiLock.value)
      updateGameLog(refetched.log)
    })
    .catch(() => {
      socketError.value = true
    })
}

const scheduleApplyUpdate = useSingleFlight(
  (payload: string) => ArkhamGame.gameDecoder.decodePromise(payload),
  applyDecodedUpdate,
  recoverFromFailedDecode,
)

function continueSkipAll() {
  if (skipAllPending.value.size === 0) return
  if (!game.value) return
  const next = authorizedSkipTriggerEntries(game.value).find((e) =>
    skipAllPending.value.has(e.playerId),
  )
  if (!next) {
    skipAllPending.value = new Set()
    return
  }
  sendSkipFor(next.playerId, next.choiceIdx)
}

function sendSkipFor(targetPlayerId: string, choiceIdx: number) {
  if (!game.value || props.spectate) return
  oldQuestion.value = game.value.question
  const questionVersion = game.value.scenarioSteps
  setGameQuestion({})
  sendAnswer(
    JSON.stringify({
      tag: 'Answer',
      contents: { choice: choiceIdx, playerId: targetPlayerId, questionVersion },
    }),
  )
}

function skipAllTriggers() {
  if (!game.value || props.spectate) return
  if (skipAllPending.value.size > 0) {
    if (!processing.value) continueSkipAll()
    return
  }

  const entries = authorizedSkipTriggerEntries(game.value)
  if (entries.length === 0) return
  skipAllPending.value = new Set(entries.map((e) => e.playerId))
  const first = entries[0]
  sendSkipFor(first.playerId, first.choiceIdx)
}

const { send, close } = useGameSocket<ServerResult>({
  url: websocketUrl,
  onResult: (result) => {
    handleResult(result)
    oldQuestion.value = null
  },
  onDisconnect,
  onConnect: (reconnected) => {
    socketError.value = false
    processing.value = false
    // Anything published while the socket was down is gone -- the server drops
    // updates for rooms with no subscriber rather than buffering them. On a
    // RECONNECT (not the initial connect, which the page load already fetched
    // for) pull the current state so we can't sit on a stale board.
    if (reconnected) void resyncGame()
  },
})

/*
 * A GameUpdate is the only message carrying new board state, and it reaches us
 * over a different path than the log lines do: the server broadcasts log lines
 * in-process, but publishes GameUpdate through Redis pub/sub so it can reach
 * other pods. When that path breaks, the failure is silent and deeply
 * confusing -- log lines keep scrolling while the board freezes, so it reads
 * as "the server ignored my click" and invites the player to click again.
 *
 * We resync on RECONNECT ONLY. There is deliberately no timer here.
 *
 * There used to be one: every answer armed a watchdog that refetched over REST
 * if no GameUpdate arrived in time. Do not reintroduce it. It is a retry storm
 * with a trigger threshold, and on 2026-08-15 it took the site down.
 *
 * The mechanism: the timer fired a full fetchGame -- the most expensive endpoint
 * we have, the entire game plus log -- per client, per answer, up to four times.
 * Actions hold a transaction and a FOR UPDATE lock on the game row for all of
 * runMessages, so those refetches compete for the very connection pool the
 * stalled actions are occupying. Once latency crossed the threshold, every
 * waiting client ADDED load, which pushed latency higher, which fired more
 * watchdogs. Positive feedback, ending in 30s RunMessagesTimeouts.
 *
 * Note the shape of that failure: below the threshold nothing fires and
 * everything is healthy, so it presents as a cliff rather than a slope. It
 * looked like a regression that "started at 10pm" when it was really a capacity
 * ceiling finally letting normal latency cross 5s. Raising the threshold only
 * moves the cliff; it does not remove it.
 *
 * And the timer was largely redundant anyway. The silent-dead-subscriber case it
 * was written for is detected and repaired server-side by the pub/sub heartbeat
 * on arkham:pubsub:health (see pubSubSupervisor in Api.Arkham.Helpers), which
 * tears down and resubscribes a connection that stops delivering. A client-side
 * timer second-guessing that buys little and costs a stampede.
 *
 * If a future silent-loss bug does need client cover, make it cheap and
 * self-limiting -- probe a few bytes of current step and only fetch the whole
 * game when it actually advanced, with jitter so clients cannot synchronise.
 */
let resyncing = false

/*
 * Pull current state over REST and apply it. Called on reconnect, where whatever
 * the server currently holds is authoritative: anything published while the
 * socket was down is gone, because the server drops updates for rooms with no
 * subscriber rather than buffering them.
 */
async function resyncGame() {
  if (resyncing) return
  resyncing = true
  try {
    const { game: refetched } = await fetchGame(props.gameId, props.spectate)
    applyGameUpdate(refetched, uiLock.value)
    updateGameLog(refetched.log)
    processing.value = false
    storyAnswerPending.value = false
  } catch (e) {
    console.error('Resync after reconnect failed', e)
  } finally {
    resyncing = false
  }
}

// Every path that answers a question goes through here, so there is one place to
// change if answering ever needs to do more than flip `processing`.
function sendAnswer(payload: string) {
  processing.value = true
  send(payload)
}

const handleResult = (result: ServerResult) => {
  processing.value = false
  switch (result.tag) {
    case 'GameError':
      if (props.spectate) return
      storyAnswerPending.value = false
      error.value = result.contents
      if (game.value && oldQuestion.value) {
        setGameQuestion(oldQuestion.value)
      }
      return
    case 'GameMessage':
      // Raw, like the game payload's entries: GameMessage.vue localizes at render
      gameLog.value = Object.freeze([...gameLog.value, result.contents])
      return
    case 'GameShowDiscard':
      emitter.emit('showDiscards', result.contents)
      return
    case 'GameShowUnder':
      emitter.emit('showUnder', result.contents)
      return
    case 'GameAudio':
      playAudioFile(result.contents)
      return
    case 'GameUI':
      if (result.contents.startsWith('theSilence:')) {
        if (props.spectate) return
        const targetPlayer = result.contents.slice('theSilence:'.length)
        if (!(solo.value === true || targetPlayer === playerId.value)) return
        if (uiLock.value || phaseAnnouncement.value) {
          qPush(result)
          return
        }
        document.dispatchEvent(new CustomEvent('arkham:clear-card-overlay'))
        showTheSilenceModal.value = true
        uiLock.value = true
        return
      }
      switch (result.contents) {
        case 'confetti': {
          setTimeout(() => {
            var count = 500
            var defaults = {
              origin: { y: 0.7 },
            }

            function fire(particleRatio: number, opts: Parameters<typeof confetti>[0]) {
              confetti({
                ...defaults,
                ...opts,
                particleCount: Math.floor(count * particleRatio),
              })
            }

            fire(0.25, {
              spread: 26,
              startVelocity: 55,
            })
          }, 500)
        }
        default:
          return
      }
    case 'GameTarot':
      if (props.spectate) return
      if (uiLock.value || phaseAnnouncement.value) {
        qPush(result)
        return
      }

      uiLock.value = true
      JsonDecoder.array(tarotCardDecoder, 'tarotCards')
        .decodePromise(result.contents)
        .then((r) => {
          tarotCards.value = r
        })
        .catch((e) => {
          console.error(e)
          uiLock.value = false
        })
      return

    case 'GameAchievement': {
      // Non-blocking gold toast; vue-toastification stacks multiple unlocks.
      // Strings are translated here because the toast container has no i18n.
      const tag = result.contents
      toast(
        {
          component: markRaw(AchievementToast),
          props: {
            title: t('achievements.toastTitle'),
            name: t(`achievements.entries.${tag}.name`),
            text: t(`achievements.entries.${tag}.text`),
          },
        },
        { timeout: 8000, icon: false, closeButton: false, toastClassName: 'achievement-toast' },
      )
      return
    }

    case 'GameCard':
      if (props.spectate) return
      if (uiLock.value || phaseAnnouncement.value) {
        qPush(result)
        return
      }

      uiLock.value = true
      gameCardDecoder
        .decodePromise(result as any)
        .then((r) => {
          gameCard.value = r
        })
        .catch((e) => {
          console.error(e)
          uiLock.value = false
        })
      return

    case 'GameCardOnly':
      if (props.spectate) return
      if (uiLock.value || phaseAnnouncement.value) {
        qPush(result)
        return
      }

      uiLock.value = true
      gameCardOnlyDecoder
        .decodePromise(result as any)
        .then((r) => {
          // if it isn't for us, immediately unlock and continue draining
          if (!(solo.value === true || r.player === playerId.value)) {
            uiLock.value = false
            return
          }
          gameCard.value = r
        })
        .catch((e) => {
          console.error(e)
          uiLock.value = false
        })
      return
    case 'SharedStateUpdate':
      // "Epic Multiplayer" shared-state feed riding on this group's game ws.
      // Forward it to the event store so the organizer bar's shared counters stay
      // live; harmless no-op for ordinary games that never receive this tag.
      eventStore.applySharedState(result.contents)
      return
    case 'EventChanged': {
      const eid = resolvedEventId.value
      if (eid) void eventStore.load(eid).catch((e) => console.error(e))
      return
    }
    case 'GameUpdate':
      // Flush the latest state onto the board even while a revelation/modal holds
      // the UI lock, so the table behind it reflects the current situation instead
      // of freezing on the pre-revelation state (issue #4817). Keep it queued so
      // the pending question is only restored once every revelation is dismissed.
      if (uiLock.value) qPush(result)
      scheduleApplyUpdate(result.contents)
      return
  }
}

function drainResultQueue() {
  if (uiLock.value) return
  for (;;) {
    const r = qPop()
    if (!r) break
    handleResult(r)
    if (uiLock.value) break
  }
}

watch(uiLock, () => {
  if (!uiLock.value) drainResultQueue()
})

// A revelation that arrived mid-banner was queued; release it once the banner
// finishes so the phase interlude always plays out before the draw is shown.
watch(phaseAnnouncement, (active) => {
  if (!active) drainResultQueue()
})

const confirmingUndoScenario = ref(false)

const actionMap = computed<Map<string, () => void>>(() => {
  const map = new Map<string, () => void>()
  for (const item of menuItems.value) {
    if (item.shortcut) map.set(item.shortcut, item.action)
  }
  return map
})

const canUndoScenario = computed(() => {
  if (!game.value) return false
  return game.value.scenarioSteps > 1
})

const canUndoBoundary = (boundary: number | null): boolean => {
  if (!game.value) return false
  if (boundary === null) return false
  return game.value.scenarioSteps > boundary
}

const canUndoAction = computed(() => canUndoBoundary(game.value?.undoActionStep ?? null))
const canUndoTurn = computed(() => canUndoBoundary(game.value?.undoTurnStep ?? null))
const canUndoPhase = computed(() => canUndoBoundary(game.value?.undoPhaseStep ?? null))
const canUndoRound = computed(() => canUndoBoundary(game.value?.undoRoundStep ?? null))

// Chord state for U + <key> shortcuts (T/R/P/S/A)
const undoChordArmed = ref(false)
let undoChordTimer: number | null = null
const UNDO_CHORD_TIMEOUT_MS = 1500

const armUndoChord = () => {
  undoChordArmed.value = true
  if (undoChordTimer) clearTimeout(undoChordTimer)
  undoChordTimer = window.setTimeout(() => {
    undoChordArmed.value = false
    undoChordTimer = null
  }, UNDO_CHORD_TIMEOUT_MS)
}

const clearUndoChord = () => {
  undoChordArmed.value = false
  if (undoChordTimer) {
    clearTimeout(undoChordTimer)
    undoChordTimer = null
  }
}

// --- Konami Code support ---
const KONAMI_SEQ = [
  'ArrowUp',
  'ArrowUp',
  'ArrowDown',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'ArrowLeft',
  'ArrowRight',
  'b',
  'a',
] as const

let konamiIndex = 0
let konamiTimer: number | null = null
const KONAMI_TIMEOUT_MS = 5000 // reset if user pauses too long

const onKonami = () => {
  if (!game.value) return
  debug.send(game.value.id, { tag: 'KonamiCode', contents: playerId.value })
}

const feedKonami = (rawKey: string): boolean => {
  const key = rawKey.length === 1 ? rawKey.toLowerCase() : rawKey

  // match current step
  if (key === KONAMI_SEQ[konamiIndex]) {
    konamiIndex++
    if (konamiIndex === KONAMI_SEQ.length) {
      // success!
      konamiIndex = 0
      if (konamiTimer) {
        clearTimeout(konamiTimer)
        konamiTimer = null
      }
      onKonami()
      return true
    }
    // keep a rolling timeout while the user is entering
    if (konamiTimer) clearTimeout(konamiTimer)
    konamiTimer = window.setTimeout(() => {
      konamiIndex = 0
      konamiTimer = null
    }, KONAMI_TIMEOUT_MS)
    return false
  }

  // mismatch: allow overlap if this key is the first symbol of the sequence
  if (key === KONAMI_SEQ[0]) {
    konamiIndex = 1
    if (konamiTimer) clearTimeout(konamiTimer)
    konamiTimer = window.setTimeout(() => {
      konamiIndex = 0
      konamiTimer = null
    }, KONAMI_TIMEOUT_MS)
  } else {
    konamiIndex = 0
    if (konamiTimer) {
      clearTimeout(konamiTimer)
      konamiTimer = null
    }
  }

  return false
}

// Keyboard Shortcuts
const handleKeyPress = (event: KeyboardEvent) => {
  if (filingBug.value) return
  if (isTypingTarget(event.target)) return
  if (event.ctrlKey) return
  if (event.metaKey) return
  if (event.altKey) return

  if (feedKonami(event.key)) return

  // Chord: when U is armed, the next key chooses the undo level
  if (undoChordArmed.value) {
    const k = event.key.toLowerCase()
    if (k === 'a' && canUndoAction.value) {
      clearUndoChord()
      undoActionStart()
      return
    }
    if (k === 't' && canUndoTurn.value) {
      clearUndoChord()
      undoTurnStart()
      return
    }
    if (k === 'p' && canUndoPhase.value) {
      clearUndoChord()
      undoPhaseStart()
      return
    }
    if (k === 'r' && canUndoRound.value) {
      clearUndoChord()
      undoRoundStart()
      return
    }
    if (k === 's' && canUndoScenario.value) {
      clearUndoChord()
      confirmingUndoScenario.value = true
      return
    }
    // Pressing U again while armed = single undo (re-pressing the prefix)
    if (k === 'u') {
      clearUndoChord()
      undo()
      return
    }
    // Any other key cancels the chord and falls through
    clearUndoChord()
  }

  if (event.key === 'u') {
    undo()
    return
  }

  if (event.key === 'U') {
    armUndoChord()
    return
  }

  if (event.key === 'D') {
    debug.toggle()
    return
  }

  if (event.key === '?') {
    showShortcuts.value = !showShortcuts.value
    return
  }

  if (event.key === ' ' || event.code === 'Space') {
    event.preventDefault()

    if (gameCard.value || tarotCards.value.length > 0) {
      continueUI()
      return
    }

    const skipTriggers = choices.value.findIndex(
      (c) => c.tag === Message.MessageType.SKIP_TRIGGERS_BUTTON,
    )
    if (skipTriggers !== -1) {
      choose(skipTriggers)
      return
    }

    const doneCommitting = choices.value.findIndex((c) => {
      if (c.tag === Message.MessageType.START_SKILL_TEST_BUTTON) return true
      if (c.tag !== Message.MessageType.LABEL && c.tag !== Message.MessageType.DONE) return false
      return c.label === '$label.doneCommitting' || c.label.endsWith('doneCommitting')
    })
    if (doneCommitting !== -1) {
      choose(doneCommitting)
      return
    }

    const validIndices = choices.value
      .map((c, i) =>
        ![Message.MessageType.INVALID_LABEL, Message.MessageType.INFO].includes(c.tag) ? i : -1,
      )
      .filter((i) => i !== -1)

    if (validIndices.length === 1) {
      choose(validIndices[0])
      return
    }

    if (choices.value.length === 1) {
      choose(0)
      return
    }
    return
  }

  if (event.key === 'd') {
    const draw = choices.value.findIndex((c) => {
      if (c.tag !== Message.MessageType.COMPONENT_LABEL) return false
      if (c.component.tag !== 'InvestigatorDeckComponent') return false
      if (!playerId.value) return false
      return game.value?.investigators[c.component.investigatorId]?.playerId === playerId.value
    })
    if (draw !== -1) {
      choose(draw)
    } else {
      const drawEncounter = choices.value.findIndex((c) => {
        if (c.tag !== Message.MessageType.TARGET_LABEL) return false
        return c.target.tag === 'EncounterDeckTarget'
      })

      if (drawEncounter !== -1) choose(drawEncounter)
    }
    return
  }

  if (event.key === 'r') {
    const resource = choices.value.findIndex((c) => {
      if (c.tag !== Message.MessageType.COMPONENT_LABEL) return false
      if (c.component.tag !== 'InvestigatorComponent') return false
      if (c.component.tokenType !== 'ResourceToken') return false
      if (!playerId.value) return false
      return game.value?.investigators[c.component.investigatorId]?.playerId === playerId.value
    })
    if (resource !== -1) choose(resource)
    return
  }

  if (event.key === 'e') {
    if (!game.value || !playerId.value) return
    const elementUnderMouse = document.elementFromPoint(pointer.x, pointer.y)
    if (debug.active && elementUnderMouse) {
      const dataId = elementUnderMouse.getAttribute('data-id')
      if (dataId && game.value.assets[dataId]) {
        const exhausted = elementUnderMouse.classList.contains('exhausted')
        if (exhausted) {
          debug.send(game.value.id, {
            tag: 'Ready',
            contents: { tag: 'AssetTarget', contents: dataId },
          })
        } else {
          debug.send(game.value.id, {
            tag: 'Exhaust',
            contents: { tag: 'AssetTarget', contents: dataId },
          })
        }
        return
      }
    }
    const endTurn = choices.value.findIndex((c) => {
      if (c.tag !== Message.MessageType.END_TURN_BUTTON) return false
      return game.value?.investigators[c.investigatorId]?.playerId === playerId.value
    })
    if (endTurn !== -1) {
      // Mirror the End Turn button's two-step confirm: E alone must not throw
      // away unused actions on a stray keypress.
      const choice = choices.value[endTurn]
      const investigator =
        choice.tag === Message.MessageType.END_TURN_BUTTON
          ? game.value?.investigators[choice.investigatorId]
          : undefined
      if (investigator && investigator.remainingActions > 0 && !endTurnKeyArmed.value) {
        endTurnKeyArmed.value = true
        if (endTurnKeyArmTimer !== null) clearTimeout(endTurnKeyArmTimer)
        endTurnKeyArmTimer = setTimeout(() => {
          endTurnKeyArmed.value = false
        }, 3000)
        toast.info(t('game.confirmEndTurnKeyboard', { n: investigator.remainingActions }))
        return
      }
      endTurnKeyArmed.value = false
      if (endTurnKeyArmTimer !== null) {
        clearTimeout(endTurnKeyArmTimer)
        endTurnKeyArmTimer = null
      }
      choose(endTurn)
    }
    return
  }

  actionMap.value.get(event.key)?.()
}

// Sidebar
const toggleSidebar = function () {
  showSidebar.value = !showSidebar.value
  if (!isMobileViewport()) {
    setGameLocalStorageItem(props.gameId, 'showSidebar', JSON.stringify(showSidebar.value))
  }
}

// Undo
const undoLock = ref(false)

/*
 * Every undo goes through here so the lock is taken BEFORE any UI state is
 * touched and released in `finally`.
 *
 * Both halves matter. Guarding after the state wipe meant a press that lost the
 * race still blanked the question and then returned without sending anything --
 * the board went empty and stayed empty. And releasing only on the happy path
 * meant a single request that never settled left `undoLock` true for the life of
 * the page, after which every press was a silent no-op: no request, no error,
 * nothing in the console, just a dead Undo button. The undo calls carry their own
 * timeout (see api.ts) so the promise always settles and this `finally` can run.
 */
async function runUndo(call: (gameId: string) => Promise<void>) {
  if (undoLock.value) return
  undoLock.value = true
  processing.value = true
  const oldQuestion = game.value?.question
  if (game.value) setGameQuestion({})
  resultQueue.value = []
  gameCard.value = null
  tarotCards.value = []
  uiLock.value = false
  try {
    await call(props.gameId)
  } catch (e) {
    processing.value = false
    if (game.value && oldQuestion) setGameQuestion(oldQuestion)
    console.log(e)
  } finally {
    undoLock.value = false
  }
}

async function undo() {
  await runUndo((gameId) => undoChoice(gameId, debug.active))
}

async function undoScenario() {
  confirmingUndoScenario.value = false
  await runUndo(undoScenarioChoice)
}

const undoActionStart = () => runUndo(undoAction)
const undoTurnStart = () => runUndo(undoTurn)
const undoPhaseStart = () => runUndo(undoPhase)
const undoRoundStart = () => runUndo(undoRound)

provide(undoControlsKey, {
  canUndoAction, canUndoTurn, canUndoPhase, canUndoRound, canUndoScenario,
  undoChordArmed, confirmingUndoScenario, undo, undoActionStart, undoTurnStart,
  undoPhaseStart, undoRoundStart,
})

const filingBug = ref(false)
const submittingBug = ref(false)
const bugTitle = ref('')
const bugDescription = ref('')

function fileBugFromError() {
  bugDescription.value = error.value ?? ''
  error.value = null
  filingBug.value = true
}

async function fileBug() {
  submittingBug.value = true
  filingBug.value = false
  Api.fileBug(props.gameId)
    .then((response) => {
      const title = encodeURIComponent(bugTitle.value)
      const body = encodeURIComponent(
        `${bugDescription.value}\n\ngame: ${window.location.href}\nfile: ${response.data}`,
      )
      window.open(
        `https://github.com/halogenandtoast/ArkhamHorror/issues/new?labels=bug&title=${title}&body=${body}&assignee=halogenandtoast&projects=halogenandtoast/2`,
        '_blank',
      )
      submittingBug.value = false
    })
    .catch(() => {
      alert(t('gameBar.bugSubmittingFail'))
      submittingBug.value = false
    })
}

const continueUI = () => {
  gameCard.value = null
  showTheSilenceModal.value = false
  tarotCards.value = []
  uiLock.value = false
}

// Keep a multi-token reveal mounted while its per-token reaction windows advance.
// Clearing the question here would tear down and recreate the same modal and
// token components after every skip, replaying all of their reveal animations.
function shouldPreserveFocusedChaosWindow() {
  if (!game.value || !playerId.value || game.value.focusedChaosTokens.length === 0) return false
  const currentQuestion = game.value.question[playerId.value]
  return currentQuestion?.tag === 'ChooseOne' && currentQuestion.isWindow === true
}

// Keep focused-card modals mounted between one-at-a-time choices. The server
// returns a new question after each card, and clearing the old one eagerly makes
// the modal disappear and reappear between those responses.
function shouldPreserveFocusedCardChoice() {
  if (!game.value || !playerId.value || game.value.focusedCards.length === 0) return false
  return Boolean(game.value.question[playerId.value])
}

// Read questions (story passages, interludes, resolutions) render as a full-page
// spread rather than a widget over the board.
function isStoryQuestion(question: Question | null | undefined): boolean {
  if (!question) return false
  const inner = question.tag === 'QuestionLabel' ? question.question : question
  return inner?.tag === 'Read'
}

// Callbacks
async function choose(idx: number) {
  if (processing.value) return
  if (idx !== -1 && game.value && !props.spectate) {
    oldQuestion.value = game.value.question
    const questionVersion = game.value.scenarioSteps
    if (!shouldPreserveFocusedChaosWindow() && !shouldPreserveFocusedCardChoice()) {
      // A story screen is the whole page. Blanking its question empties the view
      // for the round-trip and the next passage pops in from nothing, so hold the
      // text and mark its choices spent instead.
      if (isStoryQuestion(game.value.question[playerId.value ?? ''])) {
        storyAnswerPending.value = true
      } else {
        setGameQuestion({})
      }
    }
    sendAnswer(
      JSON.stringify({
        tag: 'Answer',
        contents: { choice: idx, playerId: playerId.value, questionVersion },
      }),
    )
  }
}

/* An overlay chosen at deck selection applies to this game only -- it is sent
 * with the answer rather than saved to the deck. */
async function chooseDeck(deckId: string, overlay: any = null): Promise<void> {
  if (game.value && !props.spectate) {
    oldQuestion.value = game.value.question
    setGameQuestion({})
    sendAnswer(JSON.stringify({ tag: 'DeckAnswer', deckId, playerId: playerId.value, overlay }))
  }
}

async function chooseDeckList(deckList: object): Promise<void> {
  if (game.value && !props.spectate) {
    oldQuestion.value = game.value.question
    setGameQuestion({})
    sendAnswer(JSON.stringify({ tag: 'DeckListAnswer', deckList, playerId: playerId.value }))
  }
}

async function choosePaymentAmounts(amounts: Record<string, number>): Promise<void> {
  if (game.value && !props.spectate) {
    oldQuestion.value = game.value.question
    const questionVersion = game.value.scenarioSteps
    setGameQuestion({})
    sendAnswer(
      JSON.stringify({
        tag: 'PaymentAmountsAnswer',
        contents: { amounts, questionVersion, playerId: playerId.value },
      }),
    )
  }
}

async function scenarioSpecificAnswer(key: string, value: unknown): Promise<void> {
  if (game.value && !props.spectate) {
    oldQuestion.value = game.value.question
    setGameQuestion({})
    sendAnswer(JSON.stringify({ tag: 'ScenarioSpecificAnswer', contents: [key, value] }))
  }
}

async function chooseAmounts(amounts: Record<string, number>): Promise<void> {
  if (game.value && !props.spectate) {
    oldQuestion.value = game.value.question
    const questionVersion = game.value.scenarioSteps
    setGameQuestion({})
    sendAnswer(
      JSON.stringify({
        tag: 'AmountsAnswer',
        contents: { amounts, questionVersion, playerId: playerId.value },
      }),
    )
  }
}

async function update(state: ArkhamGame.Game) {
  game.value = state
  followPendingUpgradeQuestion(state)
}

function switchInvestigator(newPlayerId: string) {
  playerId.value = newPlayerId
}
type ExportType = 'basic' | 'full' | 'scenario'
function debugExport(exportType: ExportType) {
  const isFullExport = exportType === 'full'
  api
    .get(
      `arkham/games/${props.gameId}/${isFullExport ? 'full-' : exportType == 'scenario' ? 'scenario-' : ''}export`,
      { responseType: 'blob', params: isFullExport ? { gzip: true } : undefined },
    )
    .then((resp) => {
      const url = window.URL.createObjectURL(resp.data)
      const a = document.createElement('a')
      a.style.display = 'none'
      a.href = url
      // the filename you want
      a.download = isFullExport ? 'arkham-debug.json.gz' : 'arkham-debug.json'
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
    })
    .catch((e) => {
      console.log(e)
      alert(t('game.unableToDownloadExport'))
    })
}

// provides
provide(choicesByPlayerKey, choicesByPlayer)
provide(choicesSourceByPlayerKey, choicesSourceByPlayer)
provide(choicesTooltipByPlayerKey, choicesTooltipByPlayer)
provide(gameIndexesKey, gameIndexes)
provide(chooseDeckKey, chooseDeck)
provide(chooseDeckListKey, chooseDeckList)
provide(sendKey, send)
provide(choosePaymentAmountsKey, choosePaymentAmounts)
provide(chooseAmountsKey, chooseAmounts)
provide(scenarioSpecificAnswerKey, scenarioSpecificAnswer)
provide(switchInvestigatorKey, switchInvestigator)
provide(soloKey, solo)
provide(
  spectateKey,
  computed(() => props.spectate),
)
provide(processingKey, processing)
provide(storyAnswerPendingKey, storyAnswerPending)
provide(uiLockKey, uiLock)
provide(phaseAnnouncementKey, phaseAnnouncement)
provide(skipAllTriggersKey, skipAllTriggers)
provide(skipAllAvailableKey, skipAllAvailable)
provide(skipAllInProgressKey, skipAllInProgress)
provide(showOtherPlayersHandsKey, showOtherPlayersHands)

// callbacks
const onPlayabilityResult = (result: any) => {
  if (!debug.active) return
  playabilityInfo.value = {
    cardId: result.cardId,
    cardCode: result.cardCode,
    checks: result.checks,
  }
}
emitter.on('playabilityResult', onPlayabilityResult)

// How tall the map band is: from the top of the board down to the workbench's top
// edge. The log drawer is sized to it so the drawer and the workbench stack
// instead of sharing the board's width. The workbench's height follows the game
// state (hand size, opened piles), so it is tracked, not measured once.
const gameMainRef = ref<HTMLElement | null>(null)
const sidebarBandHeight = ref<number | null>(null)
let workbenchObserver: ResizeObserver | null = null

const measureSidebarBand = () => {
  const main = gameMainRef.value
  const workbench = main?.querySelector<HTMLElement>('#player-zone')
  if (!main || !workbench) {
    sidebarBandHeight.value = null
    return
  }
  const band = workbench.getBoundingClientRect().top - main.getBoundingClientRect().top
  sidebarBandHeight.value = band > 0 ? Math.round(band) : null
}

const trackWorkbench = async () => {
  await nextTick()
  workbenchObserver?.disconnect()
  workbenchObserver = null
  measureSidebarBand()
  const workbench = gameMainRef.value?.querySelector<HTMLElement>('#player-zone')
  if (!workbench) return
  workbenchObserver = new ResizeObserver(measureSidebarBand)
  workbenchObserver.observe(workbench)
}

useResizeObserver(gameMainRef, measureSidebarBand)
watch([game, gameMainRef, isActualScenarioView], trackWorkbench, { immediate: true })

let applyingSavedDeck = false
let stopDeckSaveNotifications: (() => void) | null = null

function normalizedInvestigatorId(value: string) {
  return value.replace(/^c/, '')
}

function savedDeckList(deck: Deck): ArkhamDbDecklist {
  return {
    id: deck.id,
    url: `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, '')}/build/deck/view/${deck.id}`,
    name: deck.name,
    investigator_code: deck.list.investigator_code,
    investigator_name: deck.investigatorName ?? deck.name,
    slots: deck.list.slots,
    sideSlots: deck.list.sideSlots,
    taboo_id: deck.list.taboo_id ?? null,
    meta: deck.list.meta,
  }
}

// The embedded arkham.build tab broadcasts a save notification; when it belongs
// to this game's active campaign branch, apply it as the deck upgrade.
async function applySavedCampaignDeck(deckId: string) {
  if (applyingSavedDeck || !game.value || props.spectate) return

  applyingSavedDeck = true
  try {
    const deck = await Api.fetchDeck(deckId)
    const deckGameId = deckMetaValue(deck, 'arkham_horror_campaign_game_id')
    const deckInvestigatorId = deckMetaValue(deck, 'arkham_horror_campaign_investigator')
    const deckStatus = deckMetaValue(deck, 'arkham_horror_campaign_status')
    if (
      deckStatus !== 'active' ||
      deckGameId !== props.gameId ||
      !deckInvestigatorId ||
      !playerId.value
    ) {
      return
    }

    const target = Object.values(game.value.investigators).find(
      (candidate) =>
        normalizedInvestigatorId(candidate.id) === normalizedInvestigatorId(deckInvestigatorId) &&
        candidate.playerId === playerId.value,
    )
    if (!target) return

    await Api.upgradeDeck(props.gameId, target.id, undefined, savedDeckList(deck))
  } catch (error) {
    console.warn('Could not apply the saved campaign deck', error)
  } finally {
    applyingSavedDeck = false
  }
}

onMounted(() => {
  ;(window as any).sendDebug = async (msg: any) => {
    if (game.value) await debug.send(game.value.id, msg)
  }
  ;(window as any).undo = undo
  ;(window as any).debugChoose = choose
  document.addEventListener('keydown', handleKeyPress)
  window.addEventListener('pointermove', handleToolbarPointerMove, { passive: true })
  window.addEventListener('arkham-setting-change', handleSettingChange)
  stopDeckSaveNotifications = subscribeToDeckSaves((notification) => {
    void applySavedCampaignDeck(notification.deckId)
  })

  // The tabletop is laid out for the whole viewport and starts with the bar
  // auto-hidden, so the seat asks for fullscreen as it opens. Coming from the
  // campaign log this is still the user's click, so the request carries their
  // activation; a direct URL load has none and the browser refuses it — that
  // rejection is expected and ignored, the bar's own fullscreen button remains
  // the way in by hand.
  if (fullscreenSupported.value && !isMobileViewport()) {
    void enterFullscreen().catch(() => {})
  }
})

onBeforeRouteLeave(() => close())
onUnmounted(() => {
  workbenchObserver?.disconnect()
  workbenchObserver = null
  document.removeEventListener('keydown', handleKeyPress)
  window.removeEventListener('pointermove', handleToolbarPointerMove)
  window.removeEventListener('arkham-setting-change', handleSettingChange)
  if (endTurnKeyArmTimer !== null) clearTimeout(endTurnKeyArmTimer)
  if (chooseDecksPoll !== null) clearTimeout(chooseDecksPoll)
  if (processingTimer !== null) clearTimeout(processingTimer)
  stopDeckSaveNotifications?.()
  stopDeckSaveNotifications = null
  delete (window as any).sendDebug
  delete (window as any).undo
  delete (window as any).debugChoose
  emitter.off('playabilityResult', onPlayabilityResult)
  stopNarration()
  clearCurrentNarration()
  close()
})
</script>

<template>
  <div v-if="submittingBug" class="column page-container">
    <div class="page-content column">
      <h2 class="title">{{ $t('gameBar.bugSubmittingTitle') }}</h2>
      <section class="box">
        {{ $t('gameBar.bugSubmittingContent') }}
      </section>
    </div>
  </div>
  <LoadState v-else-if="loadError" error @retry="loadGame" />
  <LoadState v-else-if="!ready" />
  <div
    class="tabletop-shell"
    :class="{ 'tabletop-shell--toolbar-hidden': toolbarHidden, 'tabletop-shell--fixed': fixedTabletopFrame }"
    v-else-if="ready && game && playerId"
    :style="{ '--epic-bar-height': epicBarHeight + 'px' }"
  >
    <dialog v-if="error" class="error-dialog">
      <span class="status-seal status-seal--danger" aria-hidden="true"></span>
      <h2>{{ $t('error') }}</h2>
      <p class="error-message">{{ error }}</p>
      <p>{{ $t('errorContent') }}</p>
      <div class="buttons">
        <button @click="fileBugFromError">
          <ExclamationTriangleIcon aria-hidden="true" /> {{ $t('fileBug') }}
        </button>
        <button @click="error = null">{{ $t('close') }}</button>
      </div>
    </dialog>
    <div v-if="showProcessing" class="processing">
      <LottieAnimation
        :animation-data="processingJSON"
        :auto-play="true"
        :loop="true"
        :speed="1"
        ref="anim"
      />
    </div>
    <CardOverlay />
    <div
      v-if="realityAcidLightActive"
      class="reality-acid-flashlight"
      :style="{ '--flashlight-x': `${flashlightX}px`, '--flashlight-y': `${flashlightY}px` }"
      aria-hidden="true"
    ></div>
    <div
      v-if="realityAcidLightActive"
      class="reality-acid-focus-light"
      :style="{ '--focus-light-x': `${focusLightX}px`, '--focus-light-y': `${focusLightY}px` }"
      aria-hidden="true"
    ></div>
    <Draggable v-if="showShortcuts">
      <div class="shortcuts-modal">
        <div class="shortcuts-header">
          <h2 class="shortcuts-title">{{ $t('gameBar.shortcutsTitle') }}</h2>
        </div>

        <div class="shortcuts-body">
          <section class="shortcuts-section">
            <h3 class="section-title">{{ $t('game.shortcutSection.game') }}</h3>
            <div class="shortcut-list">
              <div class="shortcut-row">
                <div class="shortcut-name">{{ $t('gameBar.shortcutSkipTriggers') }}</div>
                <div class="shortcut-keys"><kbd> </kbd></div>
              </div>
              <div class="shortcut-row">
                <div class="shortcut-name">{{ $t('gameBar.shortcutEndTurn') }}</div>
                <div class="shortcut-keys"><kbd>e</kbd></div>
              </div>
              <div class="shortcut-row">
                <div class="shortcut-name">{{ $t('gameBar.shortcutDraw') }}</div>
                <div class="shortcut-keys"><kbd>d</kbd></div>
              </div>
              <div class="shortcut-row">
                <div class="shortcut-name">{{ $t('gameBar.shortcutTakeResources') }}</div>
                <div class="shortcut-keys"><kbd>r</kbd></div>
              </div>
            </div>
          </section>

          <section class="shortcuts-section">
            <h3 class="section-title">{{ $t('game.shortcutSection.undo') }}</h3>
            <div class="shortcut-list">
              <div class="shortcut-row">
                <div class="shortcut-name">{{ $t('gameBar.shortcutUndo') }}</div>
                <div class="shortcut-keys"><kbd>u</kbd></div>
              </div>
              <div class="shortcut-row">
                <div class="shortcut-name">{{ $t('game.shortcutUndoActionStart') }}</div>
                <div class="shortcut-keys">
                  <kbd>U</kbd><span class="chord-arrow">+</span><kbd>A</kbd>
                </div>
              </div>
              <div class="shortcut-row">
                <div class="shortcut-name">{{ $t('game.shortcutUndoTurnStart') }}</div>
                <div class="shortcut-keys">
                  <kbd>U</kbd><span class="chord-arrow">+</span><kbd>T</kbd>
                </div>
              </div>
              <div class="shortcut-row">
                <div class="shortcut-name">{{ $t('game.shortcutUndoPhaseStart') }}</div>
                <div class="shortcut-keys">
                  <kbd>U</kbd><span class="chord-arrow">+</span><kbd>P</kbd>
                </div>
              </div>
              <div class="shortcut-row">
                <div class="shortcut-name">{{ $t('game.shortcutUndoRoundStart') }}</div>
                <div class="shortcut-keys">
                  <kbd>U</kbd><span class="chord-arrow">+</span><kbd>R</kbd>
                </div>
              </div>
              <div class="shortcut-row">
                <div class="shortcut-name">{{ $t('gameBar.shortcutRestartScenario') }}</div>
                <div class="shortcut-keys">
                  <kbd>U</kbd><span class="chord-arrow">+</span><kbd>S</kbd>
                </div>
              </div>
            </div>
          </section>

          <section class="shortcuts-section">
            <h3 class="section-title">{{ $t('game.shortcutSection.view') }}</h3>
            <div class="shortcut-list">
              <div class="shortcut-row">
                <div class="shortcut-name">{{ $t('gameBar.shortcutShowOrHideShortcuts') }}</div>
                <div class="shortcut-keys"><kbd>?</kbd></div>
              </div>
              <div class="shortcut-row">
                <div class="shortcut-name">{{ $t('gameBar.shortcutToggleDebug') }}</div>
                <div class="shortcut-keys"><kbd>D</kbd></div>
              </div>
              <div class="shortcut-row">
                <div class="shortcut-name">{{ $t('gameBar.shortcutSelectInvestigator') }}</div>
                <div class="shortcut-keys">
                  <kbd>1</kbd><span class="chord-arrow">…</span><kbd>4</kbd>
                </div>
              </div>
              <div v-if="solo" class="shortcut-row">
                <div class="shortcut-name">{{ $t('gameBar.shortcutSwitchPerspective') }}</div>
                <div class="shortcut-keys">
                  <kbd>Shift</kbd><span class="chord-arrow">+</span><kbd>1</kbd
                  ><span class="chord-arrow">…</span><kbd>4</kbd>
                </div>
              </div>
              <template v-for="item in menuItems" :key="item.id">
                <div v-if="item.shortcut" class="shortcut-row">
                  <div class="shortcut-name">{{ item.content }}</div>
                  <div class="shortcut-keys">
                    <kbd>{{ item.shortcut }}</kbd>
                  </div>
                </div>
              </template>
            </div>
          </section>
        </div>

        <button class="shortcuts-footer" @click="showShortcuts = false">{{ $t('close') }}</button>
      </div>
    </Draggable>
    <Draggable v-if="filingBug">
      <template #handle>
        <header>
          <h2>{{ $t('gameBar.fileABug') }}</h2>
        </header>
      </template>
      <form @submit.prevent="fileBug" class="column bug-form box">
        <p>{{ $t('gameBar.fileBugPart1') }}</p>
        <p class="info">{{ $t('gameBar.fileBugPart2') }}</p>
        <p class="warning">{{ $t('gameBar.fileBugPart3') }}</p>
        <input
          required
          type="text"
          v-model="bugTitle"
          v-bind:placeholder="$t('gameBar.bugTitleholder')"
        />
        <textarea
          required
          v-model="bugDescription"
          v-bind:placeholder="$t('gameBar.bugDescriptionholder')"
        ></textarea>
        <div class="buttons">
          <button type="submit">{{ $t('submit') }}</button>
          <button @click="filingBug = false">{{ $t('cancel') }}</button>
        </div>
      </form>
    </Draggable>
    <div v-if="socketError" class="socketWarning">
      <!-- frontend/src/locales/en/gameBoard/base.json -->
      <div class="socket-warning-card">
        <span class="status-seal status-seal--waiting" aria-hidden="true"></span>
        <p>{{ $t('outOfSyncHint') }}</p>
      </div>
    </div>
    <aside v-if="showTools" class="game-tools-drawer" :aria-label="$t('gameBar.tabletopTools')">
      <div class="game-tools-drawer__header">
        <div>
          <span class="game-tools-drawer__eyebrow">CASEWORK</span>
          <h2>{{ $t('gameBar.tabletopTools') }}</h2>
        </div>
        <button type="button" class="game-tools-drawer__close" @click="showTools = false">
          <XMarkIcon aria-hidden="true" />
          <span class="sr-only">{{ $t('close') }}</span>
        </button>
      </div>
      <div class="game-tools-drawer__body">
        <button
          type="button"
          class="game-tools-action fixed-resolution-toggle"
          role="switch"
          :aria-checked="fixedResolution"
          :aria-label="$t('gameBar.fixedResolution')"
          @click="fixedResolution = !fixedResolution"
        >
          <Monitor aria-hidden="true" />
          <span class="fixed-resolution-toggle__label">
            {{ $t('gameBar.fixedResolution') }}
            <small>{{ $t('gameBar.fixedResolutionHint') }}</small>
          </span>
          <span class="fixed-resolution-toggle__track" aria-hidden="true"><span /></span>
        </button>
        <button type="button" class="game-tools-action" @click="showLog = !showLog; showTools = false">
          <DocumentTextIcon aria-hidden="true" />
          {{ showLog ? $t('gameBar.closeLog') : $t('gameBar.viewLog') }}
        </button>
        <Menu>
          <EyeIcon aria-hidden="true" />
          {{ $t('gameBar.view') }}
          <template #items>
            <MenuItem v-slot="{ active }">
              <button :class="{ active }" @click="showShortcuts = !showShortcuts">
                <BoltIcon aria-hidden="true" /> {{ $t('gameBar.shortcuts') }}
                <span class="shortcut">?</span>
              </button>
            </MenuItem>
            <template v-for="item in menuItems" :key="item.id">
              <MenuItem v-if="item.nested === 'view'" v-slot="{ active }">
                <button :class="{ active }" @click="item.action">
                  <component v-if="item.icon" v-bind:is="item.icon"></component>
                  {{ item.content }}
                  <span v-if="item.shortcut" class="shortcut">{{ item.shortcut }}</span>
                </button>
              </MenuItem>
            </template>
          </template>
        </Menu>
        <Menu>
          <BeakerIcon aria-hidden="true" />
          {{ $t('gameBar.debug') }}
          <template #items>
            <MenuItem v-slot="{ active }">
              <button :class="{ active }" @click="debug.toggle">
                <BugAntIcon aria-hidden="true" /> {{ $t('gameBar.toggleDebug') }}
                <span class="shortcut">D</span>
              </button>
            </MenuItem>
            <MenuItem v-slot="{ active }">
              <button :class="{ active }" @click="debugExport('basic')">
                <DocumentArrowDownIcon aria-hidden="true" /> {{ $t('gameBar.debugExport') }}
              </button>
            </MenuItem>
            <MenuItem v-if="userStore.isAdmin" v-slot="{ active }">
              <button :class="{ active }" @click="debugExport('scenario')">
                <DocumentArrowDownIcon aria-hidden="true" /> {{ $t('gameBar.debugExportScenario') }}
              </button>
            </MenuItem>
            <MenuItem v-if="userStore.isAdmin" v-slot="{ active }">
              <button :class="{ active }" @click="debugExport('full')">
                <DocumentArrowDownIcon aria-hidden="true" /> {{ $t('gameBar.debugExportFull') }}
              </button>
            </MenuItem>
          </template>
        </Menu>
        <button type="button" class="game-tools-action" @click="filingBug = true">
          <ExclamationTriangleIcon aria-hidden="true" /> {{ $t('fileBug') }}
        </button>
        <template v-for="item in menuItems" :key="item.id">
          <button v-if="item.nested === null || item.nested === undefined" type="button" class="game-tools-action" @click="item.action">
            <component v-if="item.icon" v-bind:is="item.icon"></component>
            {{ item.content }}
          </button>
        </template>
      </div>
    </aside>
    <div class="game-bar">
      <div class="game-bar-item game-bar-item--leave">
        <div>
          <button
            @click="leaveGame"
            v-tooltip="$t('gameBar.leaveGame')"
            :aria-label="$t('gameBar.leaveGame')"
          >
            <ArrowLeft aria-hidden="true" />
          </button>
        </div>
      </div>
      <div class="game-bar-item game-bar-item--sounds">
        <div>
          <button
            @click="toggleSounds"
            v-tooltip="$t('gameBar.sounds')"
            :aria-label="$t('gameBar.sounds')"
            :aria-pressed="!soundsDisabled"
          >
            <Volume2 v-if="!soundsDisabled" aria-hidden="true" />
            <VolumeX v-else aria-hidden="true" />
          </button>
        </div>
      </div>
      <div class="game-bar-item game-bar-item--music">
        <div>
          <button
            @click="toggleBgm"
            :class="{ 'is-off': bgmDisabled }"
            v-tooltip="$t('gameBar.music')"
            :aria-label="$t('gameBar.music')"
            :aria-pressed="!bgmDisabled"
          >
            <Music aria-hidden="true" />
          </button>
        </div>
      </div>
      <div class="game-bar-tools game-bar-tools--primary">
        <button
          type="button"
          :class="{ active: showTools }"
          v-tooltip="$t('gameBar.tabletopTools')"
          :aria-label="$t('gameBar.tabletopTools')"
          :aria-expanded="showTools"
          @click="showTools = !showTools"
        >
          <SlidersHorizontal aria-hidden="true" />
        </button>
      </div>
      <div id="table-navigation-summary"></div>
      <div class="right">
        <button
          v-if="fullscreenSupported"
          type="button"
          :aria-pressed="isFullscreen"
          v-tooltip="$t('gameBar.fullscreen')"
          :aria-label="$t('gameBar.fullscreen')"
          @click="toggleFullscreen"
        >
          <Minimize v-if="isFullscreen" aria-hidden="true" />
          <Maximize v-else aria-hidden="true" />
        </button>
        <button
          v-if="isActualScenarioView"
          type="button"
          class="sidebar-toggle-button"
          v-tooltip="$t('gameBar.toggleSidebar')"
          :aria-label="$t('gameBar.toggleSidebar')"
          @click="toggleSidebar"
        >
          <PanelRight aria-hidden="true" />
        </button>
      </div>
    </div>
    <div v-if="hasEventBar" ref="epicBarRef" class="epic-bar-slot">
      <OrganizerBar
        v-if="organizerEventId"
        :event-id="organizerEventId"
        :current-game-id="gameId"
        :spectate="spectate"
        :current-act-stage="currentActStage"
      />
      <PlayerEventBar
        v-else-if="playerEventId"
        :event-id="playerEventId"
        :current-game-id="gameId"
        :spectate="spectate"
        :current-act-stage="currentActStage"
      />
    </div>
    <EventStartBarrier v-if="showStartBarrier" />
    <EventActAdvanceBarrier v-if="showActAdvanceWait" :organizer-event-id="organizerEventId" />
    <MultiplayerLobby
      v-if="game.gameState.tag === 'IsPending'"
      :game-id="gameId"
      :game="game"
      :player-id="playerId"
    />
    <template v-else>
      <Draggable v-if="showSettings">
        <Settings
          :game="game"
          :playerId="playerId"
          :solo="solo"
          v-model:showOtherPlayersHands="showOtherPlayersHands"
          :closeSettings="() => (showSettings = false)"
        />
      </Draggable>
      <CampaignLog v-if="showLog && game !== null" :game="game" :cards="cards" :playerId="playerId" on-dark>
        <template #header-leading>
          <button class="back-button" @click="showLog = false">
            <font-awesome-icon icon="arrow-left" class="back-icon" />
            <span>{{ $t('back') }}</span>
          </button>
        </template>
      </CampaignLog>
      <div
        v-else
        ref="gameMainRef"
        class="game-main"
        :class="{ 'game-main--sidebar': showSidebar && isActualScenarioView }"
        :style="
          sidebarBandHeight === null
            ? undefined
            : { '--sidebar-band-height': `${sidebarBandHeight}px` }
        "
      >
        <div v-if="showTheSilenceModal" class="the-silence-modal-backdrop">
          <div
            class="the-silence-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="the-silence-modal-title"
          >
            <img
              class="the-silence-modal__agenda no-overlay"
              :src="imgsrc('cards/10652.avif')"
              alt="The Silence"
            />
            <div class="the-silence-modal__body">
              <h2 id="the-silence-modal-title">The Silence</h2>
              <p>
                If you look at the Cosmic Emissary enemy for more than 15 seconds at a time, you are
                <strong>driven insane</strong>.
              </p>
              <div class="the-silence-modal__actions">
                <button type="button" class="the-silence-modal__confirm" @click="continueUI">
                  {{ $t('ok') }}
                </button>
              </div>
            </div>
          </div>
        </div>
        <div
          v-else-if="gameCard"
          class="revelation"
          :class="{ 'cthulhu-revelation': isCthulhuDeckReveal }"
        >
          <div class="revelation-container">
            <h2>{{ format(gameCard.title) }}</h2>
            <div class="revelation-card-container">
              <div
                class="revelation-card"
                :class="{ 'cthulhu-revelation-card': isCthulhuDeckReveal }"
                :role="isCthulhuDeckReveal ? 'button' : undefined"
                :tabindex="isCthulhuDeckReveal ? 0 : undefined"
                :aria-label="
                  isCthulhuDeckReveal ? `${format(gameCard.title)}. Click to enact.` : undefined
                "
                @click="isCthulhuDeckReveal && continueUI()"
                @keydown.enter="isCthulhuDeckReveal && continueUI()"
                @keydown.space.prevent="isCthulhuDeckReveal && continueUI()"
              >
                <CardView :game="game" :card="gameCard.card" :playerId="playerId" />
                <img
                  v-if="gameCard.card.tag === 'PlayerCard'"
                  :src="imgsrc('backs/back_player.jpg')"
                  class="card back"
                />
                <img v-else :src="imgsrc('backs/back_encounter.jpg')" class="card back" />
              </div>
              <span v-if="isCthulhuDeckReveal" class="cthulhu-revelation-hint">Click to enact</span>
              <button v-else @click="continueUI">{{ $t('ok') }}</button>
            </div>
          </div>
        </div>
        <!-- Click-anywhere-to-continue behind the reveal overlay: the OK button
             was the only dismissal target, and a round has dozens of reveals.
             Sits below the reveal's z-index and outside its v-if chain. -->
        <div
          v-if="gameCard || tarotCards.length > 0"
          class="revelation-backdrop"
          aria-hidden="true"
          @click="continueUI"
        ></div>
        <HistoryPanel
          v-if="showHistory && game && playerId"
          :game="game"
          :playerId="playerId"
          @close="showHistory = false"
        />
        <div
          v-if="playabilityInfo && debug.active"
          class="debug-modal-overlay"
          @click.self="playabilityInfo = null"
        >
          <div class="debug-playability-modal">
            <h3>{{ $t('game.playabilityChecks') }}</h3>
            <div class="debug-playability-content">
              <img
                class="debug-card-image"
                :src="cardImg(playabilityInfo.cardCode.replace('c', ''))"
              />
              <ul class="playability-checks">
                <li
                  v-for="[name, detail] in playabilityInfo.checks"
                  :key="name"
                  :class="detail === null ? 'check-passed' : 'check-failed'"
                >
                  <span class="check-icon">{{ detail === null ? '✓' : '✗' }}</span>
                  <span class="check-name">{{ name }}</span>
                  <span v-if="detail !== null" class="check-detail">{{ detail }}</span>
                </li>
              </ul>
            </div>
            <button @click="playabilityInfo = null">{{ $t('close') }}</button>
          </div>
        </div>
        <div v-if="tarotCards.length > 0" class="revelation">
          <div class="revelation-container">
            <div class="revelation-card-container">
              <div class="tarot-cards">
                <div v-for="(tarotCard, idx) in tarotCards" :key="idx" class="tarot-card">
                  <div class="card-container">
                    <img
                      :src="imgsrc(`tarot/${tarotCardImage(tarotCard)}`)"
                      class="tarot"
                      :class="tarotCard.facing"
                    />
                  </div>
                  <img :src="imgsrc('tarot/back.jpg')" class="card back" />
                </div>
              </div>
              <button @click="continueUI">{{ $t('ok') }}</button>
            </div>
          </div>
        </div>
        <CampaignSettings
          v-if="game.campaign && !gameOver && question && question.tag === 'PickCampaignSettings'"
          :game="game"
          :campaign="game.campaign"
          :playerId="playerId"
        />
        <Campaign
          v-else-if="game.campaign"
          :game="game"
          :gameLog="gameLog"
          :playerId="playerId"
          :campaign="game.campaign"
          :realityAcidLightDevoured="realityAcidLightDevoured"
          :realityAcidLightActive="realityAcidLightActive"
          @choose="choose"
          @update="update"
          @toggleRealityAcidLight="toggleRealityAcidLight"
        />
        <ScenarioSettings
          v-else-if="
            game.scenario && !gameOver && question && question.tag === 'PickScenarioSettings'
          "
          :game="game"
          :scenario="game.scenario"
          :playerId="playerId"
        />
        <StandaloneScenario
          v-else-if="game.scenario && !gameOver"
          :game="game"
          :playerId="playerId"
          :realityAcidLightDevoured="realityAcidLightDevoured"
          :realityAcidLightActive="realityAcidLightActive"
          @choose="choose"
          @update="update"
          @toggleRealityAcidLight="toggleRealityAcidLight"
        />
        <StoryQuestion
          v-else-if="question"
          :game="game"
          :question="question"
          :playerId="playerId"
          @choose="choose"
        />
        <div
          class="sidebar"
          :class="{ 'sidebar--empty-log': gameLog.length === 0 }"
          v-if="showSidebar && isActualScenarioView"
        >
          <!-- Reuses the campaign log's own label: the drawer is the same thing to
               a reader, and every locale already carries the words. -->
          <h2 class="sidebar__title">{{ $t('campaignLog.tabs.log') }}</h2>
          <GameLog :game="game" :gameLog="gameLog" @undo="undo" />
        </div>
        <div class="game-over" v-if="gameOver">
          <p>{{ $t('gameOver') }}</p>
          <button
            class="replay-button"
            @click="router.push({ name: 'ReplayGame', params: { gameId } })"
          >
            {{ $t('watchReplay') }}
          </button>
          <CampaignLog v-if="game !== null" :game="game" :cards="cards" :playerId="playerId" on-dark />
        </div>
        <div
          v-if="showSidebar && isActualScenarioView"
          class="sidebar-backdrop"
          @click="toggleSidebar"
          aria-hidden="true"
        ></div>
      </div>
    </template>
    <Prompt
      v-if="confirmingUndoScenario"
      prompt="$game.areYouSureUndoScenario"
      :yes="undoScenario"
      :no="() => (confirmingUndoScenario = false)"
    />
  </div>
</template>

<style lang="scss" scoped>
.back-button {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-radius: 8px;
  background: var(--surface-panel, #e8e1d2);
  color: var(--text);
  font-family: teutonic, sans-serif;
  font-size: 0.95em;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  text-decoration: none;
  cursor: pointer;
  transition:
    background 0.15s,
    border-color 0.15s,
    color 0.15s;

  .back-icon {
    font-size: 0.85em;
    transition: transform 0.15s;
  }

  &:hover {
    background: var(--surface-raised, #f4efe4);
    border-color: var(--edge);
    color: var(--spooky-green);

    .back-icon {
      transform: translateX(-3px);
    }
  }
}

.reality-acid-flashlight {
  --flashlight-x: 50vw;
  --flashlight-y: 50vh;
  position: fixed;
  inset: 0;
  z-index: var(--z-index-9998);
  pointer-events: none;
  background: radial-gradient(
    circle 330px at var(--flashlight-x) var(--flashlight-y),
    rgba(0, 0, 0, 0) 0 52%,
    rgba(0, 0, 0, 0.12) 68%,
    rgba(0, 0, 0, 0.82) 100%
  );
}

.reality-acid-focus-light {
  --focus-light-x: -1000px;
  --focus-light-y: -1000px;
  position: fixed;
  inset: 0;
  z-index: calc(var(--z-index-9998) + 1);
  pointer-events: none;
  background: radial-gradient(
    circle 205px at var(--focus-light-x) var(--focus-light-y),
    rgba(255, 248, 190, 0.72) 0 18%,
    rgba(255, 230, 128, 0.42) 46%,
    rgba(255, 226, 120, 0) 76%
  );
  mix-blend-mode: screen;
  opacity: 0.95;
}

.action {
  border: 1px solid var(--brass);
  border-radius: var(--radius-lg);
  box-shadow: inset 0 0 0 1px rgb(200 173 120 / 0.22);
}

  .tabletop-shell {
  --game-bar-height: 56px;
  width: 100vw;
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  /* Both atmosphere layers below are absolutely positioned, so the shell has
     to be their containing block. */
  position: relative;
  isolation: isolate;
  background:
    radial-gradient(ellipse at 50% 42%, rgba(205, 175, 107, 0.08), transparent 48%),
    radial-gradient(ellipse at 50% 50%, transparent 44%, rgba(4, 12, 13, 0.32) 100%),
    linear-gradient(
      180deg,
      rgba(20, 33, 34, 0.42),
      rgba(20, 33, 34, 0.06) 26%,
      rgba(12, 20, 21, 0.35)
    ),
    var(--deep-sea, #26373a) url('/assets/veiled-harbour/49-牌桌边缘潮痕海图-v1.png') center / cover no-repeat;
  background-attachment: fixed;
  border-top: 1px solid rgba(208, 180, 123, 0.35);
  animation: table-enter 280ms ease-out both;

  /* A candle-glow that breathes over the felt. Negative index keeps it under
     the play content because the shell isolates its stacking context. */
  &::before {
    content: '';
    position: absolute;
    inset: 0;
    z-index: -1;
    pointer-events: none;
    background: radial-gradient(ellipse at 50% 38%, rgba(229, 194, 107, 0.09), transparent 56%);
    animation: table-candle 11s ease-in-out infinite alternate;
  }

  /* Air moving across the table. Two soft banks on a long, offset cycle, so
     the felt never looks perfectly still without ever reading as a moving
     layer. */
  &::after {
    content: '';
    position: absolute;
    inset: -14% -8%;
    z-index: -1;
    pointer-events: none;
    background-image:
      radial-gradient(58% 38% at 24% 32%, rgba(214, 232, 226, 0.055), transparent 70%),
      radial-gradient(46% 34% at 70% 64%, rgba(198, 216, 210, 0.045), transparent 72%);
    background-repeat: no-repeat;
    animation: table-mist 52s ease-in-out infinite alternate;
  }

  &:has(.scroll-container) {
    overflow: auto;
  }
}

@keyframes table-enter {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

/* Uneven steps rather than a two-stop pulse: a real flame does not fade
   smoothly between two levels. */
@keyframes table-candle {
  0% { opacity: 0.62; }
  17% { opacity: 0.95; }
  26% { opacity: 0.71; }
  40% { opacity: 1; }
  57% { opacity: 0.79; }
  72% { opacity: 0.97; }
  86% { opacity: 0.73; }
  100% { opacity: 0.92; }
}

@keyframes table-mist {
  from {
    transform: translate3d(-3%, 1.5%, 0) scale(1.02);
  }
  to {
    transform: translate3d(4%, -2%, 0) scale(1.06);
  }
}

@media (max-width: 800px) and (orientation: portrait) {
  .tabletop-shell {
    background:
      linear-gradient(180deg, rgb(20 33 34 / 0.2), rgb(12 20 21 / 0.38)),
      url('/assets/veiled-harbour/23-移动端牌桌竖版.avif') center / cover no-repeat;
    background-attachment: scroll;
  }
}

/* Epic Multiplayer bar lives in normal flow above the board; reserve its measured
   height so the board's player area stays within the viewport. Defaults to 0 for
   ordinary games. */
.epic-bar-slot {
  flex: 0 0 auto;
}

.game-main {
  width: 100%;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex: 1 1 auto;
  padding-bottom: calc(var(--game-bar-height) + env(safe-area-inset-bottom));
}

.game-main > .game {
  min-width: 0;
  min-height: 0;
  flex: 1 1 auto;
}

.socketWarning {
  backdrop-filter: blur(3px);
  background-color: rgba(0, 0, 0, 0.8);
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  z-index: var(--z-index-100);

  justify-content: center;
  align-items: center;
  justify-self: center;
  align-self: center;
}

.socket-warning-card {
  display: flex;
  align-items: center;
  gap: 16px;
  max-width: min(560px, 88vw);
  padding: 18px 22px;
  background:
    linear-gradient(180deg, rgb(232 225 210 / 0.96), rgb(218 207 187 / 0.96)),
    url('/assets/veiled-harbour/17-调查日志纸卷.avif') center / cover no-repeat;
  border-radius: 4px;
  box-shadow: 0 18px 46px rgb(0 0 0 / 0.42);
  color: var(--text, #2e3233);

  p {
    margin: 0;
    padding: 0;
    font-weight: 700;
  }
}

.status-seal {
  display: block;
  width: 62px;
  height: 62px;
  flex: 0 0 auto;
  background-image: url('/assets/veiled-harbour/34-案件状态印章组-v2.avif');
  background-repeat: no-repeat;
  background-size: 400% 100%;
  background-position: 100% center;
  box-shadow: 0 8px 20px rgb(0 0 0 / 0.28);
}

.status-seal--danger {
  margin: 4px auto 2px;
}

.status-seal--waiting {
  background-position: 66.666% center;
}

.sidebar {
  height: 100%;
  width: 25vw;
  /* Narrower cap so the drawer's left edge lands on the pile shelf's dashed rule.
     Mirrored by the workbench's reclaim margin below. */
  max-width: 195px;
  display: flex;
  flex-direction: column;
  background:
    linear-gradient(rgb(10 25 23 / 0.93), rgb(5 16 15 / 0.96)),
    #091b18 url('/assets/veiled-harbour/32-侧栏档案抽屉-v2.avif') center / cover no-repeat;
  color-scheme: dark;
  color: #ddd8c8;
  border-left: 1px solid rgba(165, 130, 75, 0.5);

  @media (max-width: 800px) {
    position: fixed;
    top: 0;
    right: 0;
    height: 100vh;
    height: 100dvh;
    width: min(85vw, 360px);
    max-width: none;
    z-index: var(--z-index-200);
    box-shadow: -2px 0 16px rgba(0, 0, 0, 0.45);
    animation: sidebar-slide-in 0.18s ease-out;
  }

  @media (min-width: 801px) and (max-width: 1100px) {
    position: fixed;
    top: 0;
    right: 0;
    height: 100dvh;
    width: min(360px, 34vw);
    max-width: none;
    z-index: var(--z-index-200);
    box-shadow: -2px 0 16px rgba(0, 0, 0, 0.45);
    animation: sidebar-slide-in 0.18s ease-out;
  }

  /* Keep the log readable even when the operating system is in dark mode;
     game chrome owns its dark surface explicitly. */
}

.sidebar__title {
  flex: 0 0 auto;
  margin: 0;
  /* The phase rail above the board is 34px, and the drawer starts at its lower
     edge, so this row is that height: the rule under the title then lands on the
     rail's edge instead of a dozen pixels below it. */
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 14px;
  border-bottom: 1px solid rgb(205 175 107 / 0.32);
  /* Centred on the glyphs' own width: `letter-spacing` adds a trailing space
     after the last character, which would otherwise pull the block left. */
  text-align: center;
  text-indent: 0.04em;
  color: var(--text-on-dark, #f4efe4);
  font-family: Teutonic, Georgia, serif;
  font-size: 1.05rem;
  font-weight: 500;
  letter-spacing: 0.08em;
}

/* The log is the drawer's surface, not a box inside it: its own card margins put
   10-12px of empty drawer on every side. */
.sidebar :deep(.game-log) {
  margin: 0;
  width: 100%;
  border: 0;
  border-radius: 0;
}

/* The drawer is a flow sibling of the board, so opening it narrows the board's
   whole width — map and workbench alike. It should only take the map's band: the
   workbench below keeps the full board width (its column is given back to it),
   and the drawer stops at the workbench's top edge (--sidebar-band-height,
   measured in the component) instead of running down beside it. Only the desktop
   in-flow drawer does this; the overlay regimes measured below are unaffected. */
@media (min-width: 1200px), (min-width: 1101px) and (pointer: fine) {
  .sidebar {
    height: var(--sidebar-band-height, 100%);
  }

  .game-main--sidebar :deep(#player-zone:not(.player-zone--fullscreen)) {
    margin-right: calc(min(25vw, 195px) * -1);
  }
}

.sidebar--empty-log {
  pointer-events: none;
}

.sidebar-backdrop {
  display: none;

  @media (max-width: 800px) {
    display: block;
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: var(--z-index-199);
    animation: sidebar-fade-in 0.18s ease-out;
  }

  @media (min-width: 801px) and (max-width: 1100px) {
    display: block;
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: var(--z-index-199);
    animation: sidebar-fade-in 0.18s ease-out;
  }
}

@keyframes sidebar-slide-in {
  from {
    transform: translateX(100%);
  }
  to {
    transform: translateX(0);
  }
}

@keyframes sidebar-fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

#invite {
  background: var(--surface-raised);
  color: var(--text);
  width: 800px;
  margin: 0 auto;
  margin-top: 20px;
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-3);
  text-align: center;
  p {
    margin: 0;
    padding: 0;
    margin-bottom: 20px;
    font-size: 1.3em;
  }
  @media (max-width: 800px) and (orientation: portrait) {
    width: 100%;
  }
}

.invite-container {
  margin-top: 50px;
  h2 {
    color: #656a84;
    margin-left: 10px;
    text-transform: uppercase;
    padding: 0;
    margin: 0;
  }
}

header {
  display: flex;
  flex-direction: column;
}

.invite-link {
  flex: 1;
  input {
    font-size: 1.3em;
    width: 60%;
    border-right: 0;
    border-radius: 3px 0 0 3px;
    padding: 5px;
  }
  button {
    font-size: 1.3em;
    border-radius: 0 3px 3px 0;
    padding: 5px 10px;
    position: relative;

    &:before {
      content: '';
      display: none;
      position: absolute;
      z-index: var(--z-index-9998);
      top: 35px;
      left: 15px;
      width: 0;
      height: 0;

      border-left: 5px solid transparent;
      border-right: 5px solid transparent;
      border-bottom: 5px solid rgba(0, 0, 0, 0.72);
    }

    &:after {
      content: 'Copied!';
      display: none;
      position: absolute;
      z-index: var(--z-index-9999);
      top: var(--nav-height);
      left: -37px;
      width: 114px;
      height: 36px;

      color: #fff;
      font-size: 10px;
      line-height: 36px;
      text-align: center;

      background: rgba(0, 0, 0, 0.72);
      border-radius: 3px;
    }

    &:active,
    &:focus {
      outline: none;

      &:hover {
        background-color: #eee;

        &:before,
        &:after {
          display: block;
        }
      }
    }
  }
}

.button-link {
  display: block;
  width: 100%;
  text-decoration: none;
  button {
    display: block;
    width: 100%;
  }
}

header {
  font-family: Teutonic;
  font-size: 2em;
  text-align: center;
}

.game-over {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  align-items: center;

  p {
    text-transform: uppercase;
    background: var(--surface-raised);
    width: 100%;
    padding: 10px 20px;
    color: var(--text);
    text-align: center;
  }
}

@keyframes revelation {
  0% {
    opacity: 0;
    transform: scale(0);
  }

  65% {
    transform: scale(1.3);
  }

  100% {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes anim {
  0%,
  100% {
    border-radius: 30% 70% 70% 30% / 30% 52% 48% 70%;
    /*box-shadow: 10px -2vmin 4vmin LightPink inset, 10px -4vmin 4vmin MediumPurple inset, 10px -2vmin 7vmin purple inset;*/
  }

  10% {
    border-radius: 50% 50% 20% 80% / 25% 80% 20% 75%;
  }

  20% {
    border-radius: 67% 33% 47% 53% / 37% 20% 80% 63%;
  }

  30% {
    border-radius: 39% 61% 47% 53% / 37% 40% 60% 63%;
    /*box-shadow: 20px -4vmin 8vmin hotpink inset, -1vmin -2vmin 6vmin LightPink inset, -1vmin -2vmin 4vmin MediumPurple inset, 1vmin 4vmin 8vmin purple inset;*/
  }

  40% {
    border-radius: 39% 61% 82% 18% / 74% 40% 60% 26%;
  }

  50% {
    border-radius: 100%;
    /*box-shadow: 40px 4vmin 16vmin hotpink inset, 40px 2vmin 5vmin LightPink inset, 40px 4vmin 4vmin MediumPurple inset, 40px 6vmin 8vmin purple inset;*/
  }

  60% {
    border-radius: 50% 50% 53% 47% / 72% 69% 31% 28%;
  }

  70% {
    border-radius: 50% 50% 53% 47% / 26% 22% 78% 74%;
    /*box-shadow: 1vmin 1vmin 8vmin LightPink inset, 2vmin -1vmin 4vmin MediumPurple inset, -1vmin -1vmin 16vmin purple inset;*/
  }

  80% {
    border-radius: 50% 50% 53% 47% / 26% 69% 31% 74%;
  }

  90% {
    border-radius: 20% 80% 20% 80% / 20% 80% 20% 80%;
  }
}

@property --gradient-angle {
  syntax: '<angle>';
  initial-value: 0deg;
  inherits: false;
}

@keyframes rotation {
  0% {
    --gradient-angle: 360deg;
  }
  100% {
    --gradient-angle: 0deg;
  }
}

@keyframes glow {
  0% {
    filter: drop-shadow(0 0 3vmin Indigo) drop-shadow(0 5vmin 4vmin Orchid)
      drop-shadow(2vmin -2vmin 15vmin MediumSlateBlue) drop-shadow(0 0 7vmin MediumOrchid);
  }
  50% {
    filter: drop-shadow(0 0 3vmin Indigo) drop-shadow(0 5vmin 4vmin Orchid)
      drop-shadow(2vmin -2vmin 15vmin MediumSlateBlue) drop-shadow(0 0 7vmin Black);
  }
  100% {
    filter: drop-shadow(0 0 3vmin Indigo) drop-shadow(0 5vmin 4vmin Orchid)
      drop-shadow(2vmin -2vmin 15vmin MediumSlateBlue) drop-shadow(0 0 7vmin MediumOrchid);
  }
}

.the-silence-modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: var(--z-index-30000);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(0, 0, 0, 0.65);
}

.the-silence-modal {
  display: flex;
  gap: 18px;
  max-width: min(760px, 100%);
  padding: 18px;
  border-radius: 14px;
  background: linear-gradient(135deg, rgba(5, 29, 35, 0.98), rgba(12, 75, 82, 0.98));
  box-shadow:
    0 18px 50px rgba(0, 0, 0, 0.7),
    0 0 28px rgba(79, 224, 214, 0.38);
  color: #d8fffb;
}

.the-silence-modal__agenda {
  width: min(280px, 34vw);
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.55);
}

.the-silence-modal__body {
  display: flex;
  flex-direction: column;
  justify-content: center;
  max-width: 360px;
  font-family: Arial, sans-serif;
  text-align: left;
}

.the-silence-modal__body h2 {
  margin: 0 0 10px;
  font-family: Teutonic, Georgia, serif;
  font-size: 1.7rem;
  color: #bffff8;
}

.the-silence-modal__body p {
  margin: 0;
  line-height: 1.45;
}

.the-silence-modal__actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 18px;
}

.the-silence-modal__actions button {
  padding: 8px 14px;
  border-radius: 8px;
  color: white;
  cursor: pointer;
}

.the-silence-modal__confirm {
  background: rgba(12, 112, 119, 0.95);
  box-shadow: 0 0 12px rgba(79, 224, 214, 0.28);
}

@media (max-width: 650px) {
  .the-silence-modal {
    flex-direction: column;
    align-items: center;
  }

  .the-silence-modal__agenda {
    width: min(280px, 72vw);
  }
}

/* Dimmed click-catcher under the reveal overlay (revelation uses
   --z-index-1000); click anywhere dismisses the reveal. */
.revelation-backdrop {
  position: fixed;
  inset: 0;
  z-index: calc(var(--z-index-1000) - 1);
  background:
    linear-gradient(rgba(3, 12, 14, 0.28), rgba(3, 12, 14, 0.34)),
    url('/assets/veiled-harbour/38-调查揭示暗幕-v2.avif') center / cover no-repeat;
  cursor: pointer;
}

.revelation {
  position: absolute;
  transform: all 0.5s;
  z-index: var(--z-index-1000);
  color: white;
  text-align: center;
  margin: auto;
  inset: 0;
  width: fit-content;
  height: fit-content;
  display: grid;
  filter: drop-shadow(0 12px 28px rgba(0, 0, 0, 0.48));
  animation: revelation 0.3s ease-in-out;

  button {
    width: 100%;
    border: 0;
    padding: 10px;
    text-transform: uppercase;
    background-color: var(--button-2);
    font-weight: bold;
    color: var(--button-text);
    font: Arial, sans-serif;
    &:hover {
      background-color: #311b3e;
    }

    i {
      font-style: normal;
    }

    .card {
      border-radius: 15px;
    }
  }

  h2 {
    font-family: Teutonic;
    text-transform: uppercase;
    margin: 0;
    padding: 0;
    font-size: 2.5em;
  }

  :deep(.card) {
    animation: revelation 0.6s ease-in-out;
    width: 300px !important;
    aspect-ratio: var(--card-ratio);
    overflow: hidden;
    border-radius: 15px;
  }
}

.revelation-container {
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: center;
  align-self: center;
  align-content: center;
  justify-content: center;
  justify-items: center;
  justify-self: center;
}

.revelation.cthulhu-revelation {
  width: 100%;
  height: 100%;
  overflow: hidden;
  isolation: isolate;
  filter: none;
  background:
    linear-gradient(rgba(2, 16, 17, 0.78), rgba(1, 7, 8, 0.94)),
    url('/img/arkham/extra/the-drowned-city/cthulhu-board.jpg') center / cover;
  animation: cthulhu-revelation-in 500ms cubic-bezier(0.16, 1, 0.3, 1);

  &::before,
  &::after {
    position: absolute;
    inset: -20%;
    z-index: var(--z-index-0);
    content: '';
    pointer-events: none;
  }

  &::before {
    background:
      radial-gradient(ellipse at 50% 110%, rgba(45, 116, 99, 0.42) 0 12%, transparent 46%),
      radial-gradient(ellipse at 12% 50%, rgba(13, 67, 64, 0.48), transparent 42%),
      radial-gradient(ellipse at 88% 36%, rgba(68, 87, 43, 0.32), transparent 38%);
    animation: cthulhu-murk 9s ease-in-out infinite alternate;
  }

  &::after {
    opacity: 0.22;
    background: url('/img/arkham/grunge.png') center / cover;
    mix-blend-mode: screen;
  }

  .revelation-container {
    position: relative;
    z-index: var(--z-index-1);
  }

  h2 {
    color: #cad8bd;
    letter-spacing: 0.08em;
    text-shadow:
      0 2px 2px rgba(0, 0, 0, 0.9),
      0 0 8px rgba(72, 129, 105, 0.42);
  }
}

.cthulhu-revelation-card {
  cursor: pointer;
  outline: none;
  filter: drop-shadow(0 20px 24px rgba(0, 4, 5, 0.8));
  transition:
    transform 220ms ease,
    filter 220ms ease;

  &:hover,
  &:focus-visible {
    transform: translateY(-5px) scale(1.025);
    filter: drop-shadow(0 24px 28px rgba(0, 4, 5, 0.9));
  }

  &:focus-visible {
    border-radius: var(--radius-lg);
    box-shadow: 0 0 0 2px var(--accent-brass-bright);
  }

  &:active {
    transform: translateY(-1px) scale(0.985);
  }
}

.cthulhu-revelation-hint {
  color: #b9c9b1;
  font-family: Teutonic, Georgia, serif;
  font-size: 0.95rem;
  letter-spacing: 0.14em;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.9);
  text-transform: uppercase;
}

@keyframes cthulhu-revelation-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes cthulhu-murk {
  from {
    opacity: 0.62;
    transform: scale(1) rotate(-1deg);
  }
  to {
    opacity: 1;
    transform: scale(1.08) rotate(1deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .revelation.cthulhu-revelation,
  .revelation.cthulhu-revelation::before,
  .cthulhu-revelation-card {
    animation: none;
    transition: none;
  }
}

@keyframes flip-back {
  0% {
    opacity: 1;
    transform: rotateY(0deg);
  }

  49% {
    opacity: 1;
  }

  50% {
    opacity: 0;
  }

  100% {
    transform: rotateY(-180deg);
    opacity: 0;
  }
}

@keyframes flip-front {
  0% {
    transform: rotateY(180deg);
    opacity: 0;
  }

  49% {
    opacity: 0;
  }

  50% {
    opacity: 1;
  }

  100% {
    opacity: 1;
    transform: rotateY(0deg);
  }
}

.revelation-card-container {
  display: flex;
  flex-direction: column;
  width: fit-content;
  height: fit-content;
  gap: 10px;

  .the-silence-card {
    width: 300px;
    aspect-ratio: var(--card-aspect);

    .the-silence-card-image {
      animation: none !important;
      width: 300px !important;
      aspect-ratio: var(--card-ratio);
      border-radius: 15px;
    }
  }

  .tarot-cards {
    gap: 15px;
    display: flex;
    flex-direction: row;
    width: fit-content;
    height: fit-content;
    &:deep(img) {
      border-radius: 10px;
    }
  }

  .revelation-card {
    position: relative;
    width: 300px;
    aspect-ratio: var(--card-aspect);
    perspective: 1000px;
    &:nth-child(1) {
      animation-delay: 0.3s;
    }

    &:nth-child(2) {
      animation-delay: 0.6s;
    }

    &:nth-child(3) {
      animation-delay: 0.9s;
    }

    :deep(.card-container) {
      transform: rotateY(-180deg);
      transform-style: preserve-3d;
      position: absolute;
      top: 0;
      left: 0;
      backface-visibility: hidden;
      animation: flip-front 0.3s linear;
      animation-fill-mode: forwards;
      animation-delay: inherit;
    }

    .card-container {
      opacity: 0;
      transform-style: preserve-3d;
    }

    .card.back {
      transform-style: preserve-3d;
      position: absolute;
      top: 0;
      left: 0;
      backface-visibility: hidden;
      animation: flip-back 0.3s linear;
      animation-fill-mode: forwards;
      animation-delay: inherit;
    }
  }

  .tarot {
    width: 300px;
    aspect-ratio: 8/14;
  }

  .tarot-card:nth-child(1) {
    animation-delay: 0.3s;
  }

  .tarot-card:nth-child(2) {
    animation-delay: 0.6s;
  }

  .tarot-card:nth-child(3) {
    animation-delay: 0.9s;
  }

  .tarot-card {
    position: relative;
    width: 300px;
    padding-bottom: 15px;
    aspect-ratio: 8/14;
    perspective: 1000px;
    .Reversed {
      transform: rotateZ(180deg);
    }
    .card-container {
      transform: rotateY(-180deg);
      transform-style: preserve-3d;
      position: absolute;
      top: 0;
      left: 0;
      backface-visibility: hidden;
      animation: flip-front 0.3s linear;
      animation-fill-mode: forwards;
      animation-delay: inherit;
    }

    img {
      pointer-events: none;
    }

    .card-container {
      opacity: 0;
      transform-style: preserve-3d;
      pointer-events: none;
      img {
        pointer-events: none;
      }
    }

    .card.back {
      transform-style: preserve-3d;
      position: absolute;
      top: 0;
      left: 0;
      backface-visibility: hidden;
      animation: flip-back 0.3s linear;
      animation-fill-mode: forwards;
      animation-delay: inherit;
    }
  }
}

.full-width {
  flex: 1;
  padding-bottom: 10px;
}

.game-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  height: calc(var(--game-bar-height) + env(safe-area-inset-bottom));
  margin: 0;
  padding: 0 12px env(safe-area-inset-bottom);
  box-sizing: border-box;
  overflow-x: auto;
  overflow-y: hidden;
  background:
    linear-gradient(180deg, rgb(26 42 41 / 0.74), rgb(9 18 18 / 0.9)),
    url('/assets/veiled-harbour/T05-底部行动托盘纹理-v1.avif') center / cover no-repeat;
  border-top: 1px solid rgba(208, 180, 123, 0.42);
  box-shadow: 0 -6px 18px rgba(8, 14, 15, 0.45);
  color: var(--text-on-dark, #f4efe4);
  /* The document is `color-scheme: light` for the archive surfaces, which
     gives dark chrome a bright scrollbar stripe; and the global scrollbar
     colours are tuned for ivory. */
  color-scheme: dark;
  scrollbar-color: rgb(205 175 107 / 0.42) transparent;
  > div {
    display: flex;
    align-items: center;
    flex: 0 0 auto;
    gap: 6px;
    height: 100%;
    a {
      display: flex;
      align-items: center;
    }
  }
  /* Bar-level buttons are quiet ghost controls: bare icon + label, no frame,
     a soft tint on hover. :deep is required because the narration button
     carries its child component's scope id, and Menu's own scoped
     `button { background: none }` matches this ghost look. Dropdown panel
     buttons sit deeper and are deliberately not matched. */
  > div > :deep(button),
  > div > div > :deep(button) {
    display: flex;
    align-items: center;
    gap: 6px;
    height: 36px;
    min-height: 36px;
    min-width: 38px;
    padding: 0 10px;
    background: transparent;
    border: none;
    border-radius: 4px;
    color: rgb(244 239 228 / 0.78);
    font-weight: 600;
    letter-spacing: 0.02em;
    white-space: nowrap;
    cursor: pointer;
    svg {
      width: 16px;
      height: 16px;
    }
    &:hover {
      background: rgb(244 239 228 / 0.08);
      color: #fff1cc;
    }
    &:active {
      background: rgb(244 239 228 / 0.14);
      filter: none;
    }
    &:disabled {
      color: rgb(244 239 228 / 0.35);
      filter: none;
    }
    &.active {
      background: rgb(244 239 228 / 0.1);
      color: #fff1cc;
    }
    &:focus-visible {
      outline: 2px solid var(--button-focus-ring);
      outline-offset: -2px;
    }
  }
  > .right {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  justify-content: flex-start;
}

.game-bar-item.active,
.game-bar-item:hover {
  background: transparent;
  color: var(--title);
}

.game-bar-item--music button.is-off {
  opacity: 0.45;
}

@media (max-width: 800px) {
  .tabletop-shell {
    --game-bar-height: 60px;
  }

  .game-bar {
    padding-inline: 6px;
    /* Outranks the mobile hand sheet (--z-index-100). The sheet's collapsed
       strip rests in the same bottom band, and the tray's buttons have to stay
       reachable; the sheet only keeps the 50px above the tray. */
    z-index: var(--z-index-199);

    > div > :deep(button),
    > div > div > :deep(button) {
      min-width: 44px;
      padding-inline: 8px;
    }
  }
}

@media (min-width: 801px) {
  .tabletop-shell {
    --game-bar-height: 44px;
  }

  .game-bar {
    /* The navbar is hidden during play, so the action tray docks to the top
       edge and the board claims the full viewport beneath it. */
    top: 0;
    bottom: auto;
    z-index: 90;
    gap: 4px;
    padding-inline: 10px;
    background-color: rgb(13 27 25 / 0.96);
    transition: transform 180ms ease;
  }

  /* Auto-hidden toolbar (see `toolbarHidden`): the board takes the band the bar
     was reserving, and the bar slides out until the pointer reaches the top
     edge, where it overlays that band again. `pointer-events: none` keeps the
     hidden bar from swallowing clicks aimed at the board beneath it. */
  .tabletop-shell--toolbar-hidden .game-main {
    padding-top: 0;
  }

  .tabletop-shell--toolbar-hidden .game-bar {
    transform: translateY(-100%);
    pointer-events: none;
  }

  .game-bar > div > :deep(button),
  .game-bar > div > div > :deep(button) {
    padding-inline: 9px;
  }

  .game-main {
    padding-top: var(--game-bar-height);
    padding-bottom: 0;
  }

  .game-tools-drawer {
    top: var(--game-bar-height);
  }
}

/* After the desktop block above, so it wins the tie on the toolbar transition. */
@media (prefers-reduced-motion: reduce) {
  .game-bar {
    transition: none;
  }
}

.shortcuts-modal {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-height: 75vh;
  background: var(--background);
  color: var(--text);
}

.shortcuts-header {
  flex-shrink: 0;
  padding: 8px 16px;
  background: var(--background-dark);
  border-bottom: 1px solid var(--box-border);
}

.shortcuts-title {
  margin: 0;
  font-family: Teutonic, serif;
  font-size: 20px;
  color: var(--text-on-dark, #f4efe4);
  text-transform: none;
}

.shortcuts-body {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: 18px 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.shortcuts-section {
  display: flex;
  flex-direction: column;

  .section-title {
    margin: 0 0 10px;
    padding-bottom: 6px;
    font-family: Teutonic, serif;
    font-size: 13px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--title);
    border-bottom: 1px solid var(--box-border);
  }
}

.shortcut-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 6px;
}

.shortcut-row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 16px;
  align-items: center;
  padding: 10px 14px;
  background: var(--box-background);
  border-radius: 5px;
}

.shortcut-row:hover {
  background: var(--background-mid);
}

.shortcut-name {
  font-size: 14px;
  color: var(--text);
  min-width: 0;
}

.shortcut-keys {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;

  kbd {
    font-family: inherit;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 26px;
    padding: 4px 8px;
    font-size: 12px;
    font-weight: 700;
    border-radius: 4px;
    background: var(--background-dark);
    border: 1px solid var(--box-border);
    color: var(--text-on-dark, #f4efe4);
    line-height: 1;
  }

  .chord-arrow {
    opacity: 0.5;
    font-size: 12px;
  }
}

.shortcuts-footer {
  flex-shrink: 0;
  width: 100%;
  padding: 8px 16px;
  border: none;
  border-top: 1px solid var(--box-border);
  background: var(--button-2);
  color: var(--button-2-text);
  font-family: Teutonic, serif;
  font-size: 14px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  cursor: pointer;
  text-align: center;
}

.shortcuts-footer:hover {
  background: var(--button-2-highlight);
}

@media (max-width: 700px) {
  .shortcuts-header,
  .shortcuts-footer {
    padding-left: 16px;
    padding-right: 16px;
  }
  .shortcuts-body {
    padding: 14px 16px;
  }
}

.shortcut {
  margin-left: auto;
  border: 1px solid var(--title);
  background-color: var(--box-background);
  padding: 2px 5px;
  border-radius: 4px;
}

button:hover .shortcut {
  background-color: var(--box-border);
}

.bug-form {
  padding: 10px;
  font-size: 1.2em;
  input,
  textarea,
  button {
    font-size: 1.2em;
    padding: 5px 10px;
  }
}

.error-dialog {
  backdrop-filter: blur(3px);
  background:
    linear-gradient(180deg, rgb(232 225 210 / 0.97), rgb(218 207 187 / 0.97)),
    url('/assets/veiled-harbour/17-调查日志纸卷.avif') center / cover no-repeat;
  position: absolute;
  padding: 0;
  padding-block: 10px;
  width: min(50%, 620px);
  display: flex;
  z-index: var(--z-index-100);
  display: flex;
  flex-direction: column;
  border-radius: 4px;
  box-shadow: 0 22px 56px rgb(0 0 0 / 0.44);
  color: var(--text, #2e3233);
  top: 50%;

  p {
    padding: 10px;
    margin: 0;
  }

  h2 {
    font-family: Teutonic;
    font-size: 2em;
    color: var(--deep-sea, #26373a);
  }

  button {
    background: none;
    border: 0;
    display: inline;
    padding: 5px 10px;
    display: flex;
    gap: 5px;
    height: 100%;
    align-items: center;
    svg {
      width: 15px;
    }
    &:hover {
      background: rgb(165 130 75 / 0.16);
    }
    height: 100%;
  }

  justify-content: center;
  align-items: center;
  justify-self: center;
  align-self: center;

  .error-message {
    max-height: 50vh;
    overflow: auto;
    padding-inline: 20px;
  }
}
.loader {
  z-index: var(--z-index-1000);
  position: absolute;
  top: 50px;
  left: 20px;
  width: 60px;
  aspect-ratio: 1;
  display: flex;
  color: #d0d0d099;
  border: 4px solid;
  box-sizing: border-box;
  border-radius: 50%;
  background:
    radial-gradient(circle 5px, currentColor 95%, #0000),
    linear-gradient(currentColor 50%, #0000 0) 50%/4px 60% no-repeat;
  animation: l1 30s infinite linear;
}
.loader:before {
  content: '';
  flex: 1;
  background: linear-gradient(currentColor 50%, #0000 0) 50%/4px 80% no-repeat;
  animation: inherit;
}
@keyframes l1 {
  100% {
    transform: rotate(1turn);
  }
}

.processing {
  z-index: var(--z-index-1000);
  position: absolute;
  top: 5px;
  left: 00px;
  width: 80px;
  filter: invert(48%) sepia(32%) saturate(393%) hue-rotate(37deg) brightness(92%) contrast(89%);
  aspect-ratio: 1;
}

.replay-button {
  padding: 10px;
  width: 100%;
  font-size: 1.2em;
  border: 0;
  background: var(--spooky-green);
  color: var(--button-1-text);
  &:hover {
    background-color: var(--spooky-green-dark);
  }
}

.warning {
  background-color: var(--survivor-extra-dark);
  padding: 10px;
}

.info {
  background-color: var(--seeker-extra-dark);
  padding: 10px;
}

dialog {
  width: 400px;
  max-width: 90vw;
  padding: 20px;
  border-radius: 10px;
  background-color: var(--background);
  color: var(--title);
  font-size: 1.2em;
  margin: 0 auto;

  position: absolute;
  top: 50%;
  transform: translateY(-50%);

  &::backdrop {
    backdrop-filter: blur(3px);
    background-color: rgba(0, 0, 0, 0.8);
  }

  .buttons {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    margin-top: 10px;

    button {
      padding: 5px 10px;
      font-size: 1.2em;
    }
  }
}

.debug-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: var(--z-index-1000);
}

.debug-playability-modal {
  background: var(--surface-chrome);
  border-radius: 8px;
  padding: 1.5rem;
  min-width: 300px;
  max-width: 700px;
  color: var(--text-on-dark);

  h3 {
    margin: 0 0 1rem;
    font-size: 1.1rem;
    color: #adf;
  }

  button {
    margin-top: 1rem;
  }
}

.debug-playability-content {
  display: flex;
  gap: 1.5rem;
  align-items: flex-start;
}

.debug-card-image {
  width: 150px;
  border-radius: 6px;
  flex-shrink: 0;
}

.playability-checks {
  list-style: none;
  padding: 0;
  margin: 0;
  flex: 1;

  li {
    padding: 0.3rem 0;
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
}

.check-name {
  font-weight: 500;
}
.check-detail {
  font-size: 0.85rem;
  opacity: 0.8;
  font-style: italic;
}
.check-passed {
  color: #4f4;
}
.check-failed {
  color: #f44;
}
.check-icon {
  font-weight: bold;
  width: 1rem;
  flex-shrink: 0;
}

/* The game bar is deliberately quiet; infrequent actions live in one drawer so
   they cannot compete with the board or cover the phase rail. */
.game-tools-drawer {
  position: fixed;
  top: 0;
  bottom: 0;
  left: 0;
  z-index: 140;
  width: min(340px, calc(100vw - 24px));
  display: flex;
  flex-direction: column;
  color: var(--text-on-dark, #f4efe4);
  background:
    linear-gradient(180deg, rgb(20 38 37 / 0.76), rgb(8 18 18 / 0.92)),
    url('/assets/veiled-harbour/T05-底部行动托盘纹理-v1.avif') center / cover no-repeat;
  border-right: 1px solid rgb(205 175 107 / 0.58);
  box-shadow: 14px 0 30px rgb(4 10 10 / 0.42);

  /* The action list is short and the drawer is full height; without this the
     lower half is a dead slab. The ornament is a corner fitting, so it is
     anchored to the drawer's own bottom-left corner rather than floated in
     the middle, where its L-bracket reads as a broken frame. */
  &::after {
    content: '';
    position: absolute;
    left: 0;
    bottom: 0;
    width: 150px;
    height: 150px;
    background: url('/assets/veiled-harbour/04-黄铜角饰.svg') left bottom / contain no-repeat;
    transform: scaleY(-1);
    opacity: 0.22;
    pointer-events: none;
  }
}

.game-tools-drawer__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 18px 18px 14px;
  border-bottom: 1px solid rgb(205 175 107 / 0.32);
}

.game-tools-drawer__header h2 {
  margin: 3px 0 0;
  color: var(--text-on-dark, #f4efe4);
  font-family: Teutonic, Georgia, serif;
  font-size: 1.35rem;
  font-weight: 500;
  letter-spacing: 0.08em;
}

.game-tools-drawer__eyebrow {
  color: rgb(214 186 128 / 0.8);
  font-family: Typewriter, monospace;
  font-size: 0.62rem;
  letter-spacing: 0.16em;
}

.game-tools-drawer__close {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  flex: 0 0 auto;
  padding: 0;
  border: 1px solid rgb(205 175 107 / 0.52);
  border-radius: 4px;
  background: rgb(213 187 131 / 0.12);
  color: var(--text-on-dark, #f4efe4);
  cursor: pointer;
}

.game-tools-drawer__close:hover,
.game-tools-drawer__close:focus-visible {
  background: rgb(213 187 131 / 0.26);
  color: #fff;
}

.game-tools-drawer__close svg {
  width: 18px;
}

.game-tools-drawer__body {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px;
  overflow-y: auto;
  /* See `.game-bar`: dark chrome needs a dark scrollbar and dark native
     controls. */
  color-scheme: dark;
  scrollbar-color: rgb(205 175 107 / 0.42) transparent;
}

/* Every action row in the drawer is the same brass plate. HeadlessUI's Menu
   root carries no class, so its trigger is reached through the anonymous
   wrapper div — hence `:deep(div > button)`. Only one `:deep()` per selector:
   the compiler leaves a second one in the output, which invalidates the whole
   list and silently drops the rule. */
.game-tools-drawer__body > button,
.game-tools-drawer__body > :deep(div > button),
.game-tools-action {
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
  min-height: 42px;
  padding: 9px 11px;
  border: var(--plaque-border) !important;
  border-radius: var(--control-radius);
  background: var(--plaque-plate) !important;
  color: var(--plaque-ink) !important;
  text-shadow: var(--plaque-text-shadow);
  box-shadow: var(--plaque-shadow);
  font: inherit;
  font-weight: 600;
  text-align: left;
  cursor: pointer;
  transition:
    filter 140ms ease,
    border-color 140ms ease,
    color 140ms ease;
}

.game-tools-drawer__body > button:hover,
.game-tools-drawer__body > :deep(div > button:hover),
.game-tools-action:hover,
.game-tools-drawer__body > button:focus-visible,
.game-tools-drawer__body > :deep(div > button:focus-visible),
.game-tools-action:focus-visible {
  border: var(--plaque-border-hover) !important;
  color: #fff !important;
  filter: brightness(1.14);
  outline: 2px solid rgb(229 194 107 / 0.56);
  outline-offset: 1px;
}

.game-tools-drawer__body > div {
  position: relative;
}

.game-tools-drawer__body > div > :deep([role='menu']) {
  position: static !important;
  width: 100%;
  margin-top: 4px;
  overflow: hidden;
  border: 1px solid rgb(205 175 107 / 0.36);
  border-radius: 4px;
  background: rgb(11 28 27 / 0.96);
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.04);
}

/* Dropdown rows stay flat: the plaque rules above match every button under a
   direct child of the drawer body, which includes these, and their
   `!important` would otherwise plate each row of the menu. */
.game-tools-drawer__body > div > :deep([role='menu'] button) {
  width: 100%;
  min-height: 38px;
  padding: 8px 10px;
  border: 0 !important;
  border-bottom: 1px solid rgb(205 175 107 / 0.16) !important;
  border-radius: 0 !important;
  background: transparent !important;
  color: var(--text-on-dark, #f4efe4) !important;
  text-shadow: none !important;
  box-shadow: none !important;
  text-align: left;
}

.game-tools-drawer__body > div > :deep([role='menu'] button:hover),
.game-tools-drawer__body > div > :deep([role='menu'] button:focus-visible) {
  background: rgb(205 175 107 / 0.2) !important;
  color: #fff !important;
  outline: none;
}

.game-tools-drawer__body :deep(svg) {
  width: 17px;
  height: 17px;
  flex: 0 0 auto;
}

.game-tools-drawer__body :deep(.relative) {
  display: block;
}

.game-tools-drawer__body :deep(.absolute) {
  z-index: 2;
}

@media (max-width: 800px) {
  .game-tools-drawer {
    top: 0;
    width: min(360px, calc(100vw - 16px));
  }
}
</style>

<style scoped>
#table-navigation-summary { display: none; }
@media (min-width: 1200px) {
  .game-bar > #table-navigation-summary:has(> *) {
    display: flex;
    flex: 1 1 0;
    min-width: 0;
    margin-inline: 12px;
  }
}
</style>

<!-- Unscoped: the undo popper is teleported to <body>, outside this
     component's scope attribute tree. -->
<style>
.v-popper--theme-game-bar-undo .v-popper__inner {
  padding: 4px;
  border: 1px solid rgb(205 175 107 / 0.42);
  border-radius: 4px;
  background: linear-gradient(180deg, rgb(20 38 37 / 0.98), rgb(8 18 18 / 0.99));
  box-shadow: 0 12px 28px rgb(4 10 10 / 0.5);
  color: var(--text-on-dark, #f4efe4);
}

.v-popper--theme-game-bar-undo .v-popper__arrow-container {
  display: none;
}

@media (max-width: 800px), (max-width: 1199px) and (pointer: coarse) {

  .tabletop-shell { --game-bar-height: 60px; width: 100%; min-height: 0; background-attachment: scroll; }
  .tabletop-shell::before, .tabletop-shell::after { animation: none; }
  .game-main { min-height: 0; overflow: hidden; }
  .game-bar { padding-inline: max(8px, env(safe-area-inset-left)) max(8px, env(safe-area-inset-right)); gap: 4px; }
  .game-bar button, .game-bar a { min-width: 44px; min-height: 44px; }
  .game-tools-drawer { width: min(420px, 100%); max-width: 100%; max-height: calc(100dvh - var(--nav-height, 56px) - var(--game-bar-height) - env(safe-area-inset-bottom)); overflow-y: auto; }
  .sidebar { position: fixed; inset: var(--nav-height, 56px) 0 calc(var(--game-bar-height) + env(safe-area-inset-bottom)) auto; width: min(380px, 100%); max-width: 100%; overflow: auto; }
  .socketWarning { max-width: calc(100vw - 24px); overflow-wrap: anywhere; }
  .the-silence-modal { min-width: 0; width: min(94vw, 600px); max-height: 85dvh; overflow: auto; }
  .revelation-container { max-width: 100vw; max-height: 85dvh; overflow: auto; }

}
</style>

<style scoped>
/* A fixed board always keeps the same content rectangle, even while the tray
   is revealed or the outer document leaves fullscreen. */
.tabletop-shell.tabletop-shell--fixed .game-main {
  padding-top: 0;
}
.fixed-resolution-toggle__label { flex: 1; text-align: left; }
.fixed-resolution-toggle__label small {
  display: block;
  margin-top: 4px;
  font-size: 11px;
  font-weight: normal;
  color: #c0b79f;
}
.fixed-resolution-toggle__track {
  display: inline-flex;
  align-items: center;
  flex: 0 0 32px;
  height: 18px;
  padding: 2px;
  border: 1px solid #807452;
  border-radius: 12px;
  background: #142421;
}
.fixed-resolution-toggle__track > span {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #a49c84;
}
.fixed-resolution-toggle[aria-checked="true"] .fixed-resolution-toggle__track {
  background: #51634a;
  border-color: #c5ad78;
}
.fixed-resolution-toggle[aria-checked="true"] .fixed-resolution-toggle__track > span {
  transform: translateX(14px);
  background: #ead8ad;
}
.fixed-resolution-toggle:focus-visible {
  outline: 2px solid #c5ad78;
  outline-offset: 2px;
}
</style>
