<script lang="ts" setup>
import { ref, computed, Ref } from 'vue';
import { useUserStore } from '@/stores/user';
import { useRouter, useRoute } from 'vue-router';
import { deleteEvent, deleteGame, fetchGames, fetchEvents, fetchNotifications } from '@/arkham/api';
import LoadState from '@/components/LoadState.vue';
import { cullGameLocalStorage, removeGameLocalStorage } from '@/arkham/localStorage';
import type { GameDetails } from '@/arkham/types/Game';
import type { EventListEntry } from '@/arkham/types/EpicEvent';
import type { AppNotification } from '@/arkham/api';
import GameRow from '@/arkham/components/GameRow.vue';
import EventRow from '@/arkham/components/EventRow.vue';
import NewGame from '@/arkham/views/NewCampaign.vue';
import ImportGame from '@/arkham/components/ImportGame.vue';
import PrimaryButton from '@/components/PrimaryButton.vue';
import { useToast } from 'vue-toastification';
import { useI18n } from 'vue-i18n';
import { storeToRefs } from 'pinia';

const route = useRoute()
const router = useRouter()
const store = useUserStore()
const { currentUser } = storeToRefs(store)
const games: Ref<GameDetails[]> = ref([])
const events: Ref<EventListEntry[]> = ref([])
const notifications: Ref<AppNotification[]> = ref([])

const dismissedNotifications = JSON.parse(localStorage.getItem('dismissedNotifications') ?? "[]")

const activeGames = computed(() => games.value.filter(g => g.gameState.tag !== 'IsOver'))
const finishedGames = computed(() => games.value.filter(g => g.gameState.tag === 'IsOver'))
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
    .catch(() => { loadError.value = true })
    .finally(() => { gamesLoaded.value = true })

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
    .catch(() => { loadError.value = true })
    .finally(() => { eventsLoaded.value = true })
}

loadLobby()

fetchNotifications()
  .then((result) => notifications.value = result.filter((n: AppNotification) => !dismissedNotifications.includes(n.id)))
  .catch(() => { /* a missing bell is not worth interrupting the lobby for */ })

const toast = useToast()
const { t } = useI18n()

async function deleteGameEvent(game: GameDetails) {
  try {
    await deleteGame(game.id)
    removeGameLocalStorage(game.id)
    games.value = games.value.filter((g) => g.id !== game.id);
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

const newGame = ref(route.path === "/new-game" || false)
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
      router.push({ path: "/new-game" })
    } else {
      router.push({ path: "/" })
    }
  })
}

const toggleImportGame = () => {
  showImportGame.value = !showImportGame.value
}

const dismissNotification = (notification: AppNotification) => {
  localStorage.setItem('dismissedNotifications', JSON.stringify([notification.id, ...dismissedNotifications]))
  notifications.value = notifications.value.filter(n => n.id !== notification.id)
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
          <div class="archive-kicker"><span class="archive-rule"></span>{{ $t('home.archiveKicker') }}<span class="archive-rule"></span></div>
          <p class="archive-index">{{ $t('home.archiveIndex') }}</p>
          <h1 id="home-hero-title">{{ $t('home.heroTitle') }}</h1>
          <p class="hero-subtitle">{{ leadGame?.name || $t('home.heroSubtitle') }}</p>
          <p class="hero-caption">{{ $t('home.heroCaption') }}</p>
          <div class="hero-actions">
            <PrimaryButton :label="leadGame ? $t('continue') : $t('newGame')" @click="leadGame ? router.push(`/games/${leadGame.id}`) : toggleNewGame()" />
            <button v-if="currentUser" class="hero-secondary plaque plaque--paper" type="button" @click="toggleImportGame">{{ $t('home.loadGame') }}</button>
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
          <h2>{{$t('activeGames')}}</h2>
        </div>
        <div class="header-actions">
          <button v-if="currentUser" class="secondary-cta plaque plaque--paper" type="button" @click="toggleImportGame">
            {{ $t('home.loadGame') }}
          </button>
          <PrimaryButton :label="$t('newGame')" @click="toggleNewGame" />
        </div>
      </div>

      <div class="archive-layout">
        <section class="archive-main-column">
          <Transition name="slide">
            <div v-if="currentUser && showImportGame" class="load-game-panel">
              <div class="panel-header">
                <h3>{{ $t('home.loadGame') }}</h3>
                <div class="panel-actions">
                  <button class="panel-close plaque plaque--paper" type="button" @click="toggleImportGame">{{ $t('cancel') }}</button>
                  <button
                    v-if="importGameSelected"
                    class="panel-load plaque"
                    type="button"
                    :disabled="!importGameCanSubmit"
                    @click="submitImportGame"
                  >
                    {{ importGameLoading ? 'Loading…' : 'Load Game' }}
                  </button>
                </div>
              </div>
              <ImportGame ref="importGameRef" />
            </div>
          </Transition>
          <LoadState v-if="loadError" error @retry="loadLobby" />
          <div v-else-if="lobbyLoaded && activeGames.length === 0 && events.length === 0" class="empty-archive box">
            <img src="/assets/veiled-harbour/06-诡镇奇谈徽记.svg" alt="" aria-hidden="true" />
            <div><p class="empty-archive-title">{{ $t('home.emptyTitle') }}</p><p>{{ $t('home.noActiveGames') }}</p></div>
          </div>
          <EventRow
            v-for="event in events"
            :key="event.id"
            :event="event"
            :deleteEvent="() => deleteEpicEvent(event)"
          />
          <GameRow v-for="game in activeGames" :key="game.id" :game="game" :deleteGame="() => deleteGameEvent(game)" />
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
            <span>{{ $t('finishedGames') }}</span><strong>{{ finishedGames.length }}</strong>
          </div>
        </aside>
      </div>

      <section v-if="finishedGames.length > 0" class="finished-archive">
        <header><h2>{{$t('finishedGames')}}</h2><span class="archive-count">{{ finishedGames.length }} {{ $t('home.records') }}</span></header>
        <GameRow v-for="game in finishedGames" :key="game.id" :game="game" :deleteGame="() => deleteGameEvent(game)" />
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
  font-family: "Arno", "Noto Sans", sans-serif;
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
    &:hover { filter: brightness(1.1); }
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
    background-color: var(--spooky-green);
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

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

/* Material comes from `.plaque--paper`. */
.secondary-cta {
  align-self: center;
  cursor: pointer;
  font-size: 0.85em;
  font-weight: var(--font-bold);
  letter-spacing: 0.04em;
  outline: 0;
  padding: 8px 12px;
  text-transform: uppercase;

  @media (max-width: 768px) {
    padding: 6px 9px;
    font-size: 0.75em;
  }
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
  font-family: "Arno", "Noto Sans", sans-serif;
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
  background-image: linear-gradient(
    to bottom,
    rgba(176, 141, 63, 0.18),
    rgba(176, 141, 63, 0.05)
  );
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
  width: min(1240px, calc(100% - 48px));
  max-width: none;
  min-width: 0;
  padding-top: 24px;
  padding-bottom: 72px;
}

.home-hero {
  position: relative;
  isolation: isolate;
  min-height: clamp(320px, 34vw, 440px);
  overflow: hidden;
  display: flex;
  align-items: stretch;
  margin: 0 0 30px;
  border-radius: 8px;
  background: #bfc0b8 url('/assets/veiled-harbour/01-诡镇奇谈主视觉.avif') center / cover no-repeat;
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
  width: min(430px, 48%);
  padding: clamp(28px, 5vw, 60px) clamp(24px, 4vw, 56px);
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

.archive-kicker--dark { color: var(--brass-dim); }

.archive-rule {
  display: block;
  width: 24px;
  height: 1px;
  background: currentColor;
  opacity: 0.72;
}

.archive-index {
  margin: 22px 0 8px;
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
  font-size: clamp(2.25rem, 4.6vw, 4.25rem);
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
  max-width: 28em;
  margin: 8px 0 22px;
  color: #5b625b;
  font-family: 'Source Han Serif', 'Arno', serif;
  font-size: 0.95rem;
  line-height: 1.7;
}

.hero-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }

/* Material comes from `.plaque--paper`; only sizing and rhythm live here. */
.hero-secondary {
  height: 40px;
  padding: 0 14px;
  font-size: 0.82rem;
  font-weight: 600;
  letter-spacing: 0.04em;
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

.home-hero-seal img { width: 54px; height: 54px; filter: brightness(1.2) sepia(0.16); opacity: 0.92; }

.archive-heading {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 24px;
  margin: 0 0 14px;
  padding: 0 2px 14px;
  border-bottom: 1px solid var(--box-border);
}

.archive-heading h2 { margin: 6px 0 0; font-family: 'Arno', 'Source Han Serif', serif; font-size: 1.75rem; letter-spacing: 0.02em; }
.archive-layout { display: grid; grid-template-columns: minmax(0, 1fr) 250px; align-items: start; gap: 22px; }
.archive-main-column { min-width: 0; }
.archive-side-column { display: grid; gap: 14px; }

.archive-note {
  position: relative;
  overflow: hidden;
  padding: 20px;
  border-radius: 5px;
  background: var(--paper, #e9e1d2) url('/assets/veiled-harbour/03-档案纸纹理.svg') repeat;
  box-shadow: var(--shadow-2);
}

.archive-note::before { content: ''; position: absolute; inset: 8px; pointer-events: none; }
.archive-note > * { position: relative; }
.archive-note-label { margin: 0 0 18px; color: var(--brass-dim); font-size: 0.65rem; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; }
.archive-note-title { margin: 0; color: var(--ink); font-family: 'Arno', 'Source Han Serif', serif; font-size: 1.38rem; font-weight: 600; line-height: 1.3; }
.archive-note-body { margin: 12px 0 18px; color: var(--text-dim); font-family: 'Source Han Serif', 'Arno', serif; font-size: 0.9rem; line-height: 1.75; }
.archive-note-line { height: 1px; margin: 0 0 10px; background: var(--brass); opacity: 0.55; }
.archive-note-code { color: var(--brass-dim); font-family: 'Noto Sans', sans-serif; font-size: 0.6rem; letter-spacing: 0.14em; }
.finished-summary { display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; border-top: 1px solid var(--box-border); border-bottom: 1px solid var(--box-border); color: var(--text-dim); font-size: 0.8rem; }
.finished-summary strong { color: var(--ink); font-family: 'Noto Sans', sans-serif; font-size: 1.2rem; }

.empty-archive { display: flex; align-items: center; gap: 16px; min-height: 110px; background: var(--paper, #e9e1d2) url('/assets/veiled-harbour/03-档案纸纹理.svg') repeat; }
.empty-archive img { width: 48px; height: 48px; opacity: 0.72; }
.empty-archive-title { margin-bottom: 4px; color: var(--ink); font-family: 'Arno', serif; font-size: 1.12rem; font-weight: 600; }
.finished-archive { margin-top: 34px; padding-top: 18px; border-top: 1px solid var(--box-border); }
.finished-archive > header { margin-bottom: 14px; }
.archive-count { color: var(--text-dim); font-size: 0.72rem; letter-spacing: 0.08em; }

@media (max-width: 900px) {
  .archive-layout { grid-template-columns: 1fr; }
  .archive-side-column { grid-template-columns: minmax(0, 1fr) minmax(180px, 0.42fr); }
  .home-hero-content { width: min(480px, 62%); }
}

@media (max-width: 640px) {
  .archive-shell { width: calc(100% - 28px); padding-top: 14px; }
  .home-hero {
    min-height: 430px;
    margin-bottom: 24px;
    background-image: linear-gradient(180deg, rgba(248, 244, 234, 0.22), rgba(29, 42, 43, 0.22)), url('/assets/veiled-harbour/15-移动端诡镇奇谈竖版.avif');
    background-position: center;
    background-size: cover;
  }
  .home-hero-wash { background: linear-gradient(180deg, rgba(248, 244, 234, 0.94) 0%, rgba(248, 244, 234, 0.84) 26%, rgba(248, 244, 234, 0.5) 46%, rgba(29, 42, 43, 0.16) 68%, rgba(18, 30, 31, 0.42) 100%); }
  .home-hero-content { width: auto; max-width: 100%; padding: 28px 22px; justify-content: flex-start; }
  .home-hero h1 { font-size: 2.5rem; }
  .home-hero-seal { right: 14px; bottom: 12px; }
  .archive-heading { align-items: flex-start; flex-direction: column; gap: 12px; }
  .archive-heading .header-actions { width: 100%; justify-content: flex-start; }
  .archive-side-column { grid-template-columns: 1fr; }
}
</style>
