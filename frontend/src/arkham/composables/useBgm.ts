import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { type Game } from '@/arkham/types/Game'

const KEY = 'arkhamBgmDisabled'

// Suno-generated campaign tracks under public/audio/bgm. Return-to variants
// share the base scenario's track. The campaign theme is the fallback: it
// fills every mapped-campaign moment without a scenario (interludes and other
// in-between screens) so a campaign keeps continuous music.
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
}

const CAMPAIGN_THEMES: Record<string, string> = {
  '01': '/audio/bgm/notz-theme.mp3',
  '02': '/audio/bgm/dunwich-theme.mp3',
  '12': '/audio/bgm/brethren-of-ash-theme.mp3',
}

const BGM_VOLUME = 0.35

export function useBgm(game: () => Game | null, gameOver: () => boolean) {
  const bgmDisabled = ref(localStorage.getItem(KEY) === 'true')

  function toggleBgm() {
    bgmDisabled.value = !bgmDisabled.value
    localStorage.setItem(KEY, bgmDisabled.value ? 'true' : 'false')
  }

  const track = computed(() => {
    const current = game()
    const scenarioId = current?.scenario?.id
    const byScenario = scenarioId ? TRACKS[scenarioId] : undefined
    if (byScenario) return byScenario
    const campaignId = current?.campaign?.id
    return (campaignId && CAMPAIGN_THEMES[campaignId]) || null
  })

  // BGM answers only to its own toggle; the game-bar sounds switch governs
  // sound effects (impacts, rain ambience) and must not reach the music.
  const wanted = computed(() => !!track.value && !bgmDisabled.value && !gameOver())

  let audio: HTMLAudioElement | null = null
  let currentSrc = ''
  let resumeListener: (() => void) | null = null

  function startPlayback() {
    if (!audio) return
    audio.play().catch(() => {
      // Browsers refuse autoplay without user activation; if this view was
      // reached without one (e.g. a fresh page load straight into a game),
      // retry on the first interaction instead of staying silent forever.
      if (resumeListener) return
      const resume = () => {
        window.removeEventListener('pointerdown', resume)
        window.removeEventListener('keydown', resume)
        resumeListener = null
        if (wanted.value) void audio?.play().catch(() => {})
      }
      resumeListener = resume
      window.addEventListener('pointerdown', resume, { once: true })
      window.addEventListener('keydown', resume, { once: true })
    })
  }

  watch(
    [wanted, track],
    ([isWanted, newTrack]) => {
      if (!isWanted || !newTrack) {
        audio?.pause()
        return
      }
      if (!audio) {
        audio = new Audio()
        audio.loop = true
        audio.volume = BGM_VOLUME
      }
      if (currentSrc !== newTrack) {
        currentSrc = newTrack
        audio.src = newTrack
      }
      startPlayback()
    },
    { immediate: true },
  )

  onBeforeUnmount(() => {
    if (resumeListener) {
      window.removeEventListener('pointerdown', resumeListener)
      window.removeEventListener('keydown', resumeListener)
      resumeListener = null
    }
    audio?.pause()
    audio = null
    currentSrc = ''
  })

  return { bgmDisabled, toggleBgm }
}
