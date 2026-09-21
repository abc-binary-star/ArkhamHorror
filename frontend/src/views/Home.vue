<script lang="ts" setup>
import { useNavigationBack } from '@/composables/useNavigationBack'
import { ref, computed, Ref, watch } from 'vue'
import { useUserStore } from '@/stores/user'
import { useRouter, useRoute } from 'vue-router'
import { deleteEvent, deleteGame, fetchGames, fetchEvents, fetchNotifications } from '@/arkham/api'
import LoadState from '@/components/LoadState.vue'
import { cullGameLocalStorage, removeGameLocalStorage } from '@/arkham/localStorage'
import type { GameDetails } from '@/arkham/types/Game'
import type { EventListEntry } from '@/arkham/types/EpicEvent'
import type { AppNotification } from '@/arkham/api'
import GameRow from '@/arkham/components/GameRow.vue'
import EventRow from '@/arkham/components/EventRow.vue'
import NewGame from '@/arkham/views/NewCampaign.vue'
import ImportGame from '@/arkham/components/ImportGame.vue'
import { ArrowRight, Plus, FolderOpen } from '@lucide/vue'
import { useToast } from 'vue-toastification'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'

const route = useRoute()
const router = useRouter()
const store = useUserStore()
const { currentUser } = storeToRefs(store)
const games: Ref<GameDetails[]> = ref([])
const events: Ref<EventListEntry[]> = ref([])
const notifications: Ref<AppNotification[]> = ref([])

const dismissedNotifications = JSON.parse(localStorage.getItem('dismissedNotifications') ?? '[]')

const activeGames = computed(() => games.value.filter((g) => g.gameState.tag !== 'IsOver'))
const finishedGames = computed(() => games.value.filter((g) => g.gameState.tag === 'IsOver'))
const leadGame = computed(() => activeGames.value[0] ?? null)

const gamesLoaded = ref(false)
const eventsLoaded = ref(false)
const loadError = ref(false)
const lobbyLoaded = computed(() => gamesLoaded.value && eventsLoaded.value)

const loadLobby = () => {
  loadError.value = false
  gamesLoaded.value = false
  eventsLoaded.value = false

  fetchGames()
    .then((result) => {
      const availableGames = result.filter((g) => g.tag === 'game') as GameDetails[]
      cullGameLocalStorage(availableGames)
      games.value = availableGames
    })
    .catch(() => {
      loadError.value = true
    })
    .finally(() => {
      gamesLoaded.value = true
    })

  // Epic Multiplayer events surface as a single entry each, inline with regular
  // games (group games are hidden from fetchGames by the backend). A user who is
  // both organizer and player of an event gets duplicate membership rows; collapse
  // to one entry, preferring the organizer role.
  fetchEvents()
    .then((result) => {
      const byId = new Map<string, EventListEntry>()
      for (const entry of result) {
        const existing = byId.get(entry.id)
        if (!existing || entry.role === 'organizer') byId.set(entry.id, entry)
      }
      events.value = [...byId.values()]
    })
    .catch(() => {
      loadError.value = true
    })
    .finally(() => {
      eventsLoaded.value = true
    })
}

loadLobby()

fetchNotifications()
  .then(
    (result) =>
      (notifications.value = result.filter(
        (n: AppNotification) => !dismissedNotifications.includes(n.id),
      )),
  )
  .catch(() => {
    /* a missing bell is not worth interrupting the lobby for */
  })

const toast = useToast()
const { t } = useI18n()

async function deleteGameEvent(game: GameDetails) {
  try {
    await deleteGame(game.id)
    removeGameLocalStorage(game.id)
    games.value = games.value.filter((g) => g.id !== game.id)
  } catch {
    toast.error(t('pleaseTryAgainLater'))
  }
}

async function deleteEpicEvent(event: EventListEntry) {
  try {
    await deleteEvent(event.id)
    events.value = events.value.filter((e) => e.id !== event.id)
  } catch {
    toast.error(t('pleaseTryAgainLater'))
  }
}

const newGame = ref(route.path === '/new-game' || false)
watch(
  () => route.name,
  (name) => {
    newGame.value = name === 'NewGame'
  },
)
const showImportGame = ref(false)
const importGameRef = ref<any>(null)
const importGameSelected = computed(() => !!importGameRef.value?.selectedFile)
const importGameCanSubmit = computed(() => importGameRef.value?.canSubmit ?? false)
const importGameLoading = computed(() => importGameRef.value?.loading ?? false)
const submitImportGame = () => importGameRef.value?.submit()

// View Transition helper
function withViewTransition(fn: () => void) {
  const d = document as any
  if (typeof d.startViewTransition === 'function') {
    d.startViewTransition(() => fn())
  } else {
    fn()
  }
}

const toggleNewGame = () => {
  withViewTransition(() => {
    newGame.value = !newGame.value
    showImportGame.value = false
    if (newGame.value === true) {
      router.push({ path: '/new-game' })
    } else {
      router.push({ path: '/' })
    }
  })
}

useNavigationBack(() =>
  showImportGame.value
    ? {
        label: t('navigationBack.home'),
        disabled: importGameLoading.value,
        run: () => {
          showImportGame.value = false
        },
      }
    : null,
)

const toggleImportGame = () => {
  showImportGame.value = !showImportGame.value
}

const dismissNotification = (notification: AppNotification) => {
  localStorage.setItem(
    'dismissedNotifications',
    JSON.stringify([notification.id, ...dismissedNotifications]),
  )
  notifications.value = notifications.value.filter((n) => n.id !== notification.id)
}
</script>

<template>
  <div class="page-container">
    <NewGame v-if="currentUser && newGame" @close="toggleNewGame">
      <template #cancel>
        <button @click="toggleNewGame" class="cancel-new-game-button">
          <span>{{ $t('cancel') }}</span>
        </button>
      </template>
    </NewGame>

    <div v-if="!newGame" class="home page-content archive-shell">
      <div class="notification" v-for="notification in notifications" :key="notification.id">
        <p v-html="notification.body"></p>
        <a @click.prevent="dismissNotification(notification)" href="#">{{ $t('home.dismiss') }}</a>
      </div>

      <section class="home-hero" aria-labelledby="home-hero-title">
        <div class="home-hero-wash" aria-hidden="true"></div>
        <div class="home-hero-content">
          <div class="archive-kicker">
            <span class="archive-rule"></span>{{ $t('home.archiveKicker')
            }}<span class="archive-rule"></span>
          </div>
          <p class="archive-index">{{ $t('home.archiveIndex') }}</p>
          <h1 id="home-hero-title">{{ $t('home.heroTitle') }}</h1>
          <p class="hero-subtitle">{{ leadGame?.name || $t('home.heroSubtitle') }}</p>
          <p class="hero-caption">{{ $t('home.heroCaption') }}</p>
          <div class="hero-actions">
            <button
              class="hero-primary"
              type="button"
              @click="leadGame ? router.push(`/games/${leadGame.id}`) : toggleNewGame()"
            >
              <span>{{ leadGame ? $t('continue') : $t('newGame') }}</span>
              <ArrowRight aria-hidden="true" />
            </button>
            <div v-if="currentUser || leadGame" class="hero-utilities">
              <button v-if="leadGame" class="hero-utility" type="button" @click="toggleNewGame">
                <Plus aria-hidden="true" />{{ $t('newGame') }}
              </button>
              <button
                v-if="currentUser"
                class="hero-utility"
                type="button"
                :aria-expanded="showImportGame"
                aria-controls="home-import-panel"
                @click="toggleImportGame"
              >
                <FolderOpen aria-hidden="true" />{{ $t('home.loadGame') }}
              </button>
            </div>
          </div>
        </div>
        <div class="home-hero-seal" aria-hidden="true">
          <img src="/assets/veiled-harbour/C05-档案压印.svg" alt="" />
          <span>ARCHIVE<br />04—17</span>
        </div>
      </section>

      <div class="archive-heading">
        <div>
          <p class="archive-kicker archive-kicker--dark">{{ $t('home.caseKicker') }}</p>
          <h2>{{ $t('activeGames') }}</h2>
        </div>
      </div>

      <div class="archive-layout">
        <section class="archive-main-column">
          <Transition name="slide">
            <div
              v-if="currentUser && showImportGame"
              id="home-import-panel"
              class="load-game-panel"
            >
              <div class="panel-header">
                <h3>{{ $t('home.loadGame') }}</h3>
                <div class="panel-actions">
                  <button
                    class="panel-close plaque plaque--paper"
                    type="button"
                    @click="toggleImportGame"
                  >
                    {{ $t('cancel') }}
                  </button>
                  <button
                    v-if="importGameSelected"
                    class="panel-load plaque"
                    type="button"
                    :disabled="!importGameCanSubmit"
                    @click="submitImportGame"
                  >
                    {{ importGameLoading ? $t('loadState.loading') : $t('home.loadGame') }}
                  </button>
                </div>
              </div>
              <ImportGame ref="importGameRef" />
            </div>
          </Transition>
          <LoadState v-if="loadError" error @retry="loadLobby" />
          <div
            v-else-if="lobbyLoaded && activeGames.length === 0 && events.length === 0"
            class="empty-archive box"
          >
            <img src="/assets/veiled-harbour/06-诡镇奇谈徽记.svg" alt="" aria-hidden="true" />
            <div>
              <p class="empty-archive-title">{{ $t('home.emptyTitle') }}</p>
              <p>{{ $t('home.noActiveGames') }}</p>
            </div>
          </div>
          <EventRow
            v-for="event in events"
            :key="event.id"
            :event="event"
            :deleteEvent="() => deleteEpicEvent(event)"
          />
          <GameRow
            v-for="game in activeGames"
            :key="game.id"
            :game="game"
            :deleteGame="() => deleteGameEvent(game)"
          />
        </section>

        <aside class="archive-side-column" :aria-label="$t('home.sideLabel')">
          <div class="archive-note">
            <p class="archive-note-label">{{ $t('home.sideLabel') }}</p>
            <p class="archive-note-title">{{ $t('home.sideTitle') }}</p>
            <p class="archive-note-body">{{ $t('home.sideBody') }}</p>
            <div class="archive-note-line"></div>
            <span class="archive-note-code">M—17 / CASEWORK</span>
          </div>
          <div v-if="finishedGames.length > 0" class="finished-summary">
            <span>{{ $t('finishedGames') }}</span
            ><strong>{{ finishedGames.length }}</strong>
          </div>
        </aside>
      </div>

      <section v-if="finishedGames.length > 0" class="finished-archive">
        <header>
          <h2>{{ $t('finishedGames') }}</h2>
          <span class="archive-count">{{ finishedGames.length }} {{ $t('home.records') }}</span>
        </header>
        <GameRow
          v-for="game in finishedGames"
          :key="game.id"
          :game="game"
          :deleteGame="() => deleteGameEvent(game)"
        />
      </section>
    </div>
  </div>
</template>

<style scoped>
h2 {
  color: var(--title);
  font-size: 2em;
  font-weight: 600;
  letter-spacing: 0.02em;
  font-family: 'Arno', 'Noto Sans', sans-serif;
  margin: 0;
  @media (max-width: 768px) {
    font-size: 1.5em;
  }
}

.new-game {
  button {
    border-radius: var(--radius-md);
    outline: 0;
    padding: 10px 15px;
    background: var(--spooky-green);
    box-shadow: var(--shadow-2);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--button-1-text);
    font-weight: var(--font-black);
    width: 100%;
    &:hover {
      filter: brightness(1.1);
    }
  }
}

.home {
  max-width: 98vw;
  min-width: 60vw;
  margin: 0 auto;
  @media (max-width: 768px) {
    min-width: unset;
    width: 100%;
    padding: 20px 12px 10px;
    box-sizing: border-box;
  }
}

.slide-enter-active,
.slide-leave-active {
  transition: all 0.3s ease-in-out;
}

.slide-enter-to,
.slide-leave-from {
  opacity: 1;
}

.slide-enter-from,
.slide-leave-to {
  opacity: 0;
}

button.cancel-new-game-button {
  height: fit-content;
  align-self: center;
  font-size: 1em;
  font-weight: var(--font-black);
  letter-spacing: 0.05em;
  width: fit-content;
  background: rgb(19 34 33 / 0.72);
  border-color: #9d8c66;
  color: #efe8d6;
}

button.new-game-button {
  height: fit-content;
  align-self: center;
  font-size: 1em;
  font-weight: var(--font-black);
  width: fit-content;
  margin-block: 10px;
}

p {
  margin: 0;
  padding: 0;
}

.box {
  background-image: var(--panel-gradient);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-2);
  color: var(--text);
  padding: 14px;
}

form.box {
  display: flex;
  flex-direction: column;
  gap: 10px;

  button {
    text-transform: uppercase;
    padding: 10px;
  }
}

header {
  display: flex;
  margin-bottom: 12px;
  align-items: center;
  gap: 12px;
  h2 {
    flex: 1;
  }

  button {
    height: fit-content;
    align-self: center;
    background: var(--spooky-green);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-2);
    outline: 0;
    padding: 9px 16px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--button-1-text);
    font-size: 1em;
    font-weight: var(--font-black);
    &:hover {
      filter: brightness(1.1);
    }
  }
}

.games {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.load-game-panel {
  background-image: var(--panel-gradient);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-4);
  padding: 14px;
  margin-bottom: 14px;
}

.panel-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.panel-header h3 {
  flex: 1;
  margin: 0;
  color: var(--title);
  font-family: 'Arno', 'Noto Sans', sans-serif;
  font-size: 1.4em;
  font-weight: var(--font-black);
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.panel-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* Material comes from `.plaque` / `.plaque--paper`. */
.panel-load,
.panel-close {
  cursor: pointer;
  font-size: 0.8em;
  font-weight: var(--font-bold);
  letter-spacing: 0.04em;
  padding: 7px 12px;
  text-transform: uppercase;
}

.panel-load {
  font-weight: var(--font-black);

  &:disabled {
    cursor: not-allowed;
    opacity: 0.45;
  }
}

.panel-close {
  font-weight: var(--font-bold);
}

/* Brass notice strip. Deliberately does not shadow the global --text /
   --background tokens the way the old light-yellow version did. */
.notification {
  display: flex;
  flex-direction: row;
  box-sizing: border-box;
  padding: 12px 14px;
  border-radius: var(--radius-lg);
  background-image: linear-gradient(to bottom, rgba(176, 141, 63, 0.18), rgba(176, 141, 63, 0.05));
  box-shadow: var(--shadow-2);
  color: var(--text);
  margin-block: 12px;
  font-size: 1.05em;
  gap: 8px;

  > p {
    flex: 1;
  }

  :deep(a) {
    color: var(--brass);
    font-weight: var(--font-bold);
    text-decoration: underline;
  }
}

header.main-header {
  view-transition-name: main-header;
  h2 {
    view-transition-name: main-header-title;
  }
  .primary-btn {
    view-transition-name: main-header-button;
  }
}

/* ── Arkham Horror archive surface ─────────────────────────────────────── */
.archive-shell {
  width: calc(100% - 48px);
  max-width: none;
  min-width: 0;
  padding-top: 24px;
  padding-bottom: 72px;
}

.home-hero {
  position: relative;
  isolation: isolate;
  min-height: clamp(340px, 32vw, 420px);
  overflow: hidden;
  display: flex;
  align-items: stretch;
  margin: 0 0 30px;
  border-radius: 8px;
  background: #bfc0b8 url('/assets/veiled-harbour/42-旧港雾潮主视觉-v1.png') center / cover
    no-repeat;
  box-shadow:
    inset 0 0 70px rgba(18, 30, 31, 0.32),
    0 18px 40px rgba(34, 40, 38, 0.22),
    0 2px 5px rgba(34, 40, 38, 0.14);
}

/* The veil exists so the title clears AA over the key art; it should not be a
   flat milk wash across half the hero. Concentrate it in the first third,
   then let the art fall into its own shadow — same two colours, only the
   alphas and stops change. */
.home-hero-wash {
  position: absolute;
  z-index: -1;
  inset: 0;
  background: linear-gradient(
    90deg,
    rgba(248, 244, 234, 0.94) 0%,
    rgba(248, 244, 234, 0.86) 17%,
    rgba(248, 244, 234, 0.52) 33%,
    rgba(248, 244, 234, 0.14) 45%,
    rgba(29, 42, 43, 0.12) 62%,
    rgba(18, 30, 31, 0.4) 100%
  );
}

/* Harbour haze, drifting across the art. Slow enough that it is atmosphere
   rather than animation. */
.home-hero::after {
  content: '';
  position: absolute;
  inset: -10% -6%;
  z-index: -1;
  pointer-events: none;
  background:
    radial-gradient(52% 34% at 62% 46%, rgba(236, 240, 235, 0.16), transparent 72%),
    radial-gradient(40% 30% at 84% 72%, rgba(226, 234, 230, 0.12), transparent 74%);
  background-repeat: no-repeat;
  animation: hero-mist 64s ease-in-out infinite alternate;
}

@keyframes hero-mist {
  from {
    transform: translate3d(-2.5%, 1%, 0) scale(1.02);
  }
  to {
    transform: translate3d(3.5%, -1.5%, 0) scale(1.07);
  }
}

.home-hero-content {
  box-sizing: border-box;
  width: min(530px, 55%);
  padding: clamp(30px, 4vw, 52px) clamp(24px, 4vw, 56px);
  display: flex;
  flex-direction: column;
  justify-content: center;
  color: var(--ink);
}

.archive-kicker {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--harbour-teal, #28615d);
  font-family: 'Noto Sans', sans-serif;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.16em;
  line-height: 1;
  text-transform: uppercase;
}

.archive-kicker--dark {
  color: var(--brass-dim);
}

.archive-rule {
  display: block;
  width: 24px;
  height: 1px;
  background: currentColor;
  opacity: 0.72;
}

.archive-index {
  margin: 24px 0 14px;
  color: var(--text-dim);
  font-family: 'Noto Sans', sans-serif;
  font-size: 0.68rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
}

.home-hero h1 {
  margin: 0;
  color: #202827;
  font-family: 'Arno', 'Source Han Serif', serif;
  font-size: clamp(2.25rem, 4.2vw, 3.75rem);
  font-weight: 600;
  letter-spacing: 0.06em;
  line-height: 1.08;
  text-shadow: 0 1px 0 rgba(255, 255, 255, 0.4);
}

.hero-subtitle {
  margin: 16px 0 0;
  max-width: 25em;
  color: #344541;
  font-family: 'Source Han Serif', 'Arno', serif;
  font-size: clamp(1.05rem, 1.6vw, 1.36rem);
  font-weight: 600;
  line-height: 1.45;
}

.hero-caption {
  max-width: 25em;
  text-wrap: pretty;
  margin: 8px 0 22px;
  color: #5b625b;
  font-family: 'Source Han Serif', 'Arno', serif;
  font-size: 0.95rem;
  line-height: 1.7;
}

.hero-actions {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
}

.hero-primary {
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: 40px;
  min-width: 194px;
  min-height: 48px;
  padding: 12px 20px;
  border: 1px solid #597065;
  border-radius: 4px;
  background: linear-gradient(135deg, #304f46, #19372f);
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.12),
    0 4px 10px rgb(25 55 47 / 0.16);
  color: #f4efe4;
  font: inherit;
  font-size: 0.9rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  cursor: pointer;
  transition:
    background 160ms ease,
    box-shadow 160ms ease;
}
.hero-primary:hover {
  background: linear-gradient(135deg, #3b6054, #23483d);
  box-shadow: 0 5px 14px rgb(25 55 47 / 0.22);
}
.hero-primary svg {
  width: 18px;
  height: 18px;
  stroke-width: 1.6;
}
.hero-utilities {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 16px;
}
.hero-utility {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  min-height: 44px;
  padding: 0 2px;
  border: 0;
  border-radius: 2px;
  background: transparent;
  box-shadow: none;
  color: #394b42;
  font: inherit;
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  transition: color 160ms ease;
}
.hero-utility svg {
  width: 16px;
  height: 16px;
  stroke-width: 1.6;
}
.hero-utility:hover,
.hero-utility[aria-expanded='true'] {
  color: #176354;
  text-decoration: underline;
  text-underline-offset: 5px;
}
.hero-actions button:focus-visible {
  outline: 2px solid #28615d;
  outline-offset: 4px;
}
.hero-actions button:active {
  transform: translateY(1px);
}

.home-hero-seal {
  position: absolute;
  right: 22px;
  bottom: 20px;
  display: grid;
  justify-items: center;
  gap: 3px;
  color: rgba(244, 239, 228, 0.86);
  font-family: 'Noto Sans', sans-serif;
  font-size: 0.56rem;
  letter-spacing: 0.16em;
  line-height: 1.45;
  text-align: center;
  text-shadow: 0 1px 3px rgba(24, 33, 33, 0.72);
}

.home-hero-seal img {
  width: 54px;
  height: 54px;
  filter: brightness(1.2) sepia(0.16);
  opacity: 0.92;
}

.archive-heading {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 24px;
  margin: 0 0 14px;
  padding: 0 2px 14px;
  border-bottom: 1px solid var(--box-border);
}

.archive-heading h2 {
  margin: 6px 0 0;
  font-family: 'Arno', 'Source Han Serif', serif;
  font-size: 1.75rem;
  letter-spacing: 0.02em;
}
.archive-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 250px;
  align-items: start;
  gap: 22px;
}
.archive-main-column {
  min-width: 0;
}
.archive-shell :deep(.game) {
  border: 1px solid rgb(126 112 78 / 0.24);
  border-radius: 5px;
  box-shadow: 0 3px 12px rgb(34 40 38 / 0.08);
}
.archive-shell :deep(.game-title) {
  padding: 14px 18px;
  gap: 16px;
}
.archive-shell :deep(.title) {
  font-size: 1.32rem;
  line-height: 1.3;
  overflow-wrap: anywhere;
}
.archive-shell :deep(.campaign-icon-container) {
  width: 36px;
  flex-shrink: 0;
}
.archive-shell :deep(.campaign-icon) {
  max-height: 36px;
  opacity: 0.8;
}
.archive-shell :deep(.extra-details) {
  gap: 14px;
}
.archive-shell :deep(.game-difficulty) {
  background: transparent;
  border: 1px solid rgb(126 112 78 / 0.28);
  padding: 4px 8px;
  box-shadow: none;
  font-size: 0.62rem;
}
.archive-shell :deep(.investigators) {
  padding: 8px 13px;
}
.archive-side-column {
  display: grid;
  gap: 14px;
}

.archive-note {
  position: relative;
  overflow: hidden;
  padding: 20px;
  border-radius: 5px;
  background: var(--paper, #e9e1d2) url('/assets/veiled-harbour/03-档案纸纹理.svg') repeat;
  box-shadow: var(--shadow-2);
}

.archive-note::before {
  content: '';
  position: absolute;
  inset: 8px;
  pointer-events: none;
}
.archive-note > * {
  position: relative;
}
.archive-note-label {
  margin: 0 0 18px;
  color: var(--brass-dim);
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}
.archive-note-title {
  margin: 0;
  color: var(--ink);
  font-family: 'Arno', 'Source Han Serif', serif;
  font-size: 1.38rem;
  font-weight: 600;
  line-height: 1.3;
}
.archive-note-body {
  margin: 12px 0 18px;
  color: var(--text-dim);
  font-family: 'Source Han Serif', 'Arno', serif;
  font-size: 0.9rem;
  line-height: 1.75;
}
.archive-note-line {
  height: 1px;
  margin: 0 0 10px;
  background: var(--brass);
  opacity: 0.55;
}
.archive-note-code {
  color: var(--brass-dim);
  font-family: 'Noto Sans', sans-serif;
  font-size: 0.6rem;
  letter-spacing: 0.14em;
}
.finished-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  border-top: 1px solid var(--box-border);
  border-bottom: 1px solid var(--box-border);
  color: var(--text-dim);
  font-size: 0.8rem;
}
.finished-summary strong {
  color: var(--ink);
  font-family: 'Noto Sans', sans-serif;
  font-size: 1.2rem;
}

.empty-archive {
  display: flex;
  align-items: center;
  gap: 16px;
  min-height: 110px;
  background: var(--paper, #e9e1d2) url('/assets/veiled-harbour/03-档案纸纹理.svg') repeat;
}
.empty-archive img {
  width: 48px;
  height: 48px;
  opacity: 0.72;
}
.empty-archive-title {
  margin-bottom: 4px;
  color: var(--ink);
  font-family: 'Arno', serif;
  font-size: 1.12rem;
  font-weight: 600;
}
.finished-archive {
  margin-top: 34px;
  padding-top: 18px;
  border-top: 1px solid var(--box-border);
}
.finished-archive > header {
  margin-bottom: 14px;
}
.archive-count {
  color: var(--text-dim);
  font-size: 0.72rem;
  letter-spacing: 0.08em;
}

@media (max-width: 900px) {
  .archive-layout {
    grid-template-columns: 1fr;
  }
  .archive-side-column {
    grid-template-columns: minmax(0, 1fr) minmax(180px, 0.42fr);
  }
  .home-hero-content {
    width: min(480px, 62%);
  }
}

@media (max-width: 640px) {
  .archive-shell :deep(.game-title) {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 8px;
    padding: 12px;
  }
  .archive-shell :deep(.extra-details) {
    gap: 4px;
  }
  .archive-shell :deep(.game-difficulty) {
    padding: 3px 5px;
    font-size: 0.55rem;
  }
  .archive-shell :deep(.title) {
    font-size: 1.1rem;
  }
  .archive-shell :deep(.campaign-icon-container) {
    width: 24px;
  }
  .archive-shell :deep(.scenario-details) {
    grid-column: 1 / -1;
    grid-row: 2;
  }
  .archive-shell :deep(.main-details) {
    gap: 8px;
  }
  .archive-shell :deep(.main-details) {
    flex-wrap: wrap;
  }
  .archive-shell {
    width: calc(100% - 28px);
    padding-top: 14px;
  }
  .home-hero {
    min-height: 430px;
    margin-bottom: 24px;
    background-image:
      linear-gradient(180deg, rgba(248, 244, 234, 0.22), rgba(29, 42, 43, 0.22)),
      url('/assets/veiled-harbour/46-移动端旧港巷道-v1.png');
    background-position: center;
    background-size: cover;
  }
  .home-hero-wash {
    background: linear-gradient(
      180deg,
      rgba(248, 244, 234, 0.94) 0%,
      rgba(248, 244, 234, 0.84) 26%,
      rgba(248, 244, 234, 0.5) 46%,
      rgba(29, 42, 43, 0.16) 68%,
      rgba(18, 30, 31, 0.42) 100%
    );
  }
  .home-hero-content {
    width: 100%;
    max-width: 100%;
    padding: 28px 22px;
    justify-content: flex-start;
  }
  .home-hero h1 {
    font-size: 2.5rem;
  }
  .home-hero-seal {
    right: 14px;
    bottom: 12px;
  }
  .archive-heading {
    align-items: flex-start;
    flex-direction: column;
    gap: 12px;
  }
  .archive-side-column {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 800px), (max-width: 1199px) and (pointer: coarse) {
  .home.page-content {
    width: 100%;
    max-width: 100%;
    padding: 12px;
  }
  .archive-layout {
    grid-template-columns: minmax(0, 1fr);
  }
  .archive-main-column,
  .archive-side-column {
    min-width: 0;
  }
  .archive-heading,
  .panel-header {
    flex-wrap: wrap;
    gap: 12px;
  }
  .panel-actions {
    flex-wrap: wrap;
    gap: 8px;
  }
  .hero-actions > * {
    min-height: 44px;
  }
  .home-hero-content {
    padding: 24px 16px;
  }
  .home-hero h1 {
    font-size: clamp(28px, 7vw, 42px);
  }
}
/* Let the archive grow with desktop screens while keeping readable text measures. */
@media (min-width: 1280px) {
  .archive-shell {
    width: calc(100% - clamp(48px, 6vw, 160px));
    padding-top: clamp(24px, 2vw, 40px);
  }
  .home-hero {
    min-height: clamp(440px, 30vw, 620px);
    margin-bottom: clamp(30px, 2.5vw, 50px);
  }
  .home-hero::before {
    content: '';
    position: absolute;
    inset: 12px;
    border: 1px solid rgb(200 173 120 / 0.3);
    border-radius: 3px;
    pointer-events: none;
  }
  .home-hero-content {
    width: clamp(530px, 43%, 820px);
    padding: clamp(44px, 4vw, 80px);
  }
  .home-hero h1 {
    font-size: clamp(3.75rem, 4.2vw, 5.5rem);
  }
  .hero-subtitle {
    font-size: clamp(1.36rem, 1.5vw, 1.85rem);
    margin-top: clamp(16px, 1.8vw, 32px);
  }
  .hero-caption {
    font-size: clamp(0.95rem, 1.05vw, 1.2rem);
    margin-bottom: clamp(22px, 2vw, 36px);
  }
  .hero-primary {
    min-width: clamp(194px, 16vw, 290px);
    min-height: clamp(48px, 3.4vw, 62px);
    padding-inline: 24px;
    font-size: clamp(0.9rem, 1vw, 1.15rem);
  }
  .hero-utilities {
    gap: 8px 24px;
  }
  .hero-utility {
    font-size: clamp(0.78rem, 0.9vw, 1rem);
  }
  .home-hero-seal {
    right: 30px;
    bottom: 28px;
  }
  .archive-layout {
    grid-template-columns: minmax(0, 1fr) clamp(250px, 21vw, 380px);
    gap: clamp(22px, 2vw, 40px);
  }
  .archive-note {
    padding: clamp(20px, 2vw, 36px);
  }
  .archive-shell :deep(.game-title) {
    padding: clamp(14px, 1.3vw, 24px) clamp(18px, 1.6vw, 32px);
  }
  .archive-shell :deep(.title) {
    font-size: clamp(1.32rem, 1.45vw, 1.8rem);
  }
}
</style>
