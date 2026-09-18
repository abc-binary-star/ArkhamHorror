import { computed, onBeforeUnmount, ref, watch, watchEffect } from 'vue'
import { useRoute } from 'vue-router'
import { type Game } from '@/arkham/types/Game'

const KEY = 'arkhamBgmDisabled'
const SITE_TRACK = '/audio/bgm/cassildas-song.mp3'
const GAME_ROUTES = new Set(['Game', 'AdminGame', 'Spectate'])

// Suno-generated campaign tracks under public/audio/bgm. Return-to variants
// share the base scenario's track. The campaign theme fills every
// mapped-campaign moment without a scenario (interludes and other in-between
// screens) so a campaign keeps continuous music.
// Scenario ids arrive as card ids, serialized with a "c" prefix (like every
// card id); campaign ids are plain ("01", "02").
const TRACKS: Record<string, string> = {
  // The Night of the Zealot
  'c01104': '/audio/bgm/the-gathering.mp3',
  'c50011': '/audio/bgm/the-gathering.mp3',
  'c01120': '/audio/bgm/midnight-masks.mp3',
  'c50025': '/audio/bgm/midnight-masks.mp3',
  'c01142': '/audio/bgm/devourer-below.mp3',
  'c50032': '/audio/bgm/devourer-below.mp3',
  // The Dunwich Legacy
  'c02041': '/audio/bgm/extracurricular-activity.mp3',
  'c51012': '/audio/bgm/extracurricular-activity.mp3',
  'c02062': '/audio/bgm/house-always-wins.mp3',
  'c51015': '/audio/bgm/house-always-wins.mp3',
  'c02118': '/audio/bgm/miskatonic-museum.mp3',
  'c51020': '/audio/bgm/miskatonic-museum.mp3',
  'c02159': '/audio/bgm/essex-county-express.mp3',
  'c51025': '/audio/bgm/essex-county-express.mp3',
  'c02195': '/audio/bgm/blood-on-the-altar.mp3',
  'c51032': '/audio/bgm/blood-on-the-altar.mp3',
  'c02236': '/audio/bgm/undimensioned-unseen.mp3',
  'c51041': '/audio/bgm/undimensioned-unseen.mp3',
  'c02274': '/audio/bgm/where-doom-awaits.mp3',
  'c51047': '/audio/bgm/where-doom-awaits.mp3',
  'c02311': '/audio/bgm/lost-in-time-space.mp3',
  'c51053': '/audio/bgm/lost-in-time-space.mp3',
  // Brethren of Ash
  'c12105': '/audio/bgm/spreading-flames.mp3',
  'c12133': '/audio/bgm/smoke-and-mirrors.mp3',
  'c12168': '/audio/bgm/queen-of-ash.mp3',
  // The Forgotten Age
  'c04043': '/audio/bgm/the-untamed-wilds.mp3',
  'c53016': '/audio/bgm/the-untamed-wilds.mp3',
  'c04054': '/audio/bgm/the-doom-of-eztli.mp3',
  'c53017': '/audio/bgm/the-doom-of-eztli.mp3',
  'c04113': '/audio/bgm/threads-of-fate.mp3',
  'c53028': '/audio/bgm/threads-of-fate.mp3',
  'c04161': '/audio/bgm/the-boundary-beyond.mp3',
  'c53038': '/audio/bgm/the-boundary-beyond.mp3',
  'c04205': '/audio/bgm/heart-of-the-elders-part-1.mp3',
  'c04205a': '/audio/bgm/heart-of-the-elders-part-1.mp3',
  'c53045': '/audio/bgm/heart-of-the-elders-part-1.mp3',
  'c04205b': '/audio/bgm/heart-of-the-elders-part-2.mp3',
  'c53048': '/audio/bgm/heart-of-the-elders-part-2.mp3',
  'c04237': '/audio/bgm/the-city-of-archives.mp3',
  'c53053': '/audio/bgm/the-city-of-archives.mp3',
  'c04277': '/audio/bgm/the-depths-of-yoth.mp3',
  'c53059': '/audio/bgm/the-depths-of-yoth.mp3',
  'c04314': '/audio/bgm/shattered-aeons.mp3',
  'c53061': '/audio/bgm/shattered-aeons.mp3',
  'c04344': '/audio/bgm/turn-back-time.mp3',
  'c53066': '/audio/bgm/turn-back-time.mp3',
  // The Path to Carcosa
  'c03043': '/audio/bgm/curtain-call.mp3',
  'c52014': '/audio/bgm/curtain-call.mp3',
  'c03061': '/audio/bgm/the-last-king.mp3',
  'c52021': '/audio/bgm/the-last-king.mp3',
  'c03120': '/audio/bgm/echoes-of-the-past.mp3',
  'c52028': '/audio/bgm/echoes-of-the-past.mp3',
  'c03159': '/audio/bgm/the-unspeakable-oath.mp3',
  'c52034': '/audio/bgm/the-unspeakable-oath.mp3',
  'c03200': '/audio/bgm/a-phantom-of-truth.mp3',
  'c52040': '/audio/bgm/a-phantom-of-truth.mp3',
  'c03240': '/audio/bgm/the-pallid-mask.mp3',
  'c52048': '/audio/bgm/the-pallid-mask.mp3',
  'c03274': '/audio/bgm/black-stars-rise.mp3',
  'c52054': '/audio/bgm/black-stars-rise.mp3',
  'c03316': '/audio/bgm/dim-carcosa.mp3',
  'c52059': '/audio/bgm/dim-carcosa.mp3',
  // The Circle Undone
  'c05043': '/audio/bgm/disappearance-at-the-twilight-estate.mp3',
  'c05050': '/audio/bgm/the-witching-hour.mp3',
  'c05065': '/audio/bgm/at-deaths-doorstep.mp3',
  'c05120': '/audio/bgm/the-secret-name.mp3',
  'c05161': '/audio/bgm/the-wages-of-sin.mp3',
  'c05197': '/audio/bgm/for-the-greater-good.mp3',
  'c05238': '/audio/bgm/union-and-disillusion.mp3',
  'c05284': '/audio/bgm/in-the-clutches-of-chaos.mp3',
  'c05325': '/audio/bgm/before-the-black-throne.mp3',
  // The Dream-Eaters
  'c06039': '/audio/bgm/beyond-the-gates-of-sleep.mp3',
  'c06063': '/audio/bgm/waking-nightmare.mp3',
  'c06119': '/audio/bgm/the-search-for-kadath.mp3',
  'c06168': '/audio/bgm/a-thousand-shapes-of-horror.mp3',
  'c06206': '/audio/bgm/dark-side-of-the-moon.mp3',
  'c06247': '/audio/bgm/point-of-no-return.mp3',
  'c06286': '/audio/bgm/where-the-gods-dwell.mp3',
  'c06333': '/audio/bgm/weaver-of-the-cosmos.mp3',
}

const CAMPAIGN_THEMES: Record<string, string> = {
  '01': '/audio/bgm/notz-theme.mp3',
  '02': '/audio/bgm/dunwich-theme.mp3',
  '03': '/audio/bgm/carcosa-theme.mp3',
  '04': '/audio/bgm/the-forgotten-age-theme.mp3',
  '05': '/audio/bgm/circle-undone-theme.mp3',
  '06': '/audio/bgm/dream-eaters-theme.mp3',
  '12': '/audio/bgm/brethren-of-ash-theme.mp3',
}

const BGM_VOLUME = 0.35

// One audio element for the entire app. The game view and the site-wide
// fallback both file claims on requestedTrack; the fallback (the Cassilda
// song, on every non-game page) only fills in when nothing else has claimed.
// An in-game claim of '' means "playing nothing on purpose" — it keeps the
// fallback out of running games that have no mapped track.
const bgmDisabled = ref(localStorage.getItem(KEY) === 'true')
const requestedTrack = ref<string | null>(null)

let audio: HTMLAudioElement | null = null
let currentSrc = ''
let resumeListener: (() => void) | null = null

export function toggleBgm() {
  bgmDisabled.value = !bgmDisabled.value
  localStorage.setItem(KEY, bgmDisabled.value ? 'true' : 'false')
}

function startPlayback() {
  if (!audio) return
  audio.play().catch(() => {
    // Browsers refuse autoplay without user activation; if this page was
    // reached without one (e.g. a fresh load straight into a game), retry on
    // the first interaction instead of staying silent forever.
    if (resumeListener) return
    const resume = () => {
      window.removeEventListener('pointerdown', resume)
      window.removeEventListener('keydown', resume)
      resumeListener = null
      if (requestedTrack.value) void audio?.play().catch(() => {})
    }
    resumeListener = resume
    window.addEventListener('pointerdown', resume, { once: true })
    window.addEventListener('keydown', resume, { once: true })
  })
}

watch(requestedTrack, (track) => {
  if (!track) {
    audio?.pause()
    return
  }
  if (!audio) {
    audio = new Audio()
    audio.loop = true
    audio.volume = BGM_VOLUME
  }
  if (currentSrc !== track) {
    currentSrc = track
    audio.src = track
  }
  startPlayback()
})

export function useBgm(game: () => Game | null, gameOver: () => boolean) {
  const track = computed(() => {
    const current = game()
    const scenarioId = current?.scenario?.id
    const byScenario = scenarioId ? TRACKS[scenarioId] : undefined
    if (byScenario) return byScenario
    const campaignId = current?.campaign?.id
    return (campaignId && CAMPAIGN_THEMES[campaignId]) || null
  })

  const wanted = computed(() => !!track.value && !bgmDisabled.value && !gameOver())

  watchEffect(() => {
    requestedTrack.value = wanted.value && track.value ? track.value : ''
  })

  onBeforeUnmount(() => {
    requestedTrack.value = null
    if (resumeListener) {
      window.removeEventListener('pointerdown', resumeListener)
      window.removeEventListener('keydown', resumeListener)
      resumeListener = null
    }
  })

  return { bgmDisabled, toggleBgm }
}

// Site-wide fallback: the Cassilda song hums on every page that is not a
// running game — home, decks, campaign lobby, scenario selection.
export function useSiteBgm() {
  const route = useRoute()
  watchEffect(() => {
    if (GAME_ROUTES.has(String(route.name)) || bgmDisabled.value) {
      if (requestedTrack.value === SITE_TRACK) requestedTrack.value = null
      return
    }
    if (requestedTrack.value === null) requestedTrack.value = SITE_TRACK
  })
}
