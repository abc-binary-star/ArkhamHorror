import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { type Game } from '@/arkham/types/Game'
import { supportsHtmlInCanvas } from '@/arkham/droplets'
import { createRainAudio, type RainAudioInstance } from '@/arkham/rainAudio'
import { useSoundsDisabled } from '@/composable/useSoundsDisabled'
import {
  getGameLocalStorageItem,
  setGameLocalStorageItem,
} from '@/arkham/localStorage'

// Rain visuals and ambience for In Too Deep (c09501). The rain only starts
// once EndSetup has run, so it begins with the scenario rather than over the
// setup screens. RainOverlay additionally requires html-in-canvas, without
// which it renders nothing and just passes the board through untouched — only
// worth offering a switch where the effect can actually render.
export function useScenarioRain(game: () => Game, extraAnimations: () => boolean) {
  const rainSupported = supportsHtmlInCanvas()
  const rainEnabled = ref(getGameLocalStorageItem(game().id, 'rainEnabled') !== 'false')

  watch(rainEnabled, (value) => {
    setGameLocalStorageItem(game().id, 'rainEnabled', value ? 'true' : 'false')
  })

  const rainAvailable = computed(
    () => game().scenario?.id === 'c09501' && !game().inSetup && rainSupported && extraAnimations(),
  )

  const showRain = computed(() => rainAvailable.value && rainEnabled.value)

  // Ambient rain, tied to the same switch as the visuals and to the global
  // Sounds preference. Built lazily so no AudioContext exists for anyone who
  // never sees the effect.
  const { soundsDisabled } = useSoundsDisabled()
  const rainAudioWanted = computed(() => showRain.value && !soundsDisabled.value)
  let rainAudio: RainAudioInstance | null = null
  let rainAudioUnavailable = false

  watch(
    rainAudioWanted,
    (wanted) => {
      if (!wanted) {
        rainAudio?.stop()
        return
      }
      if (!rainAudio && !rainAudioUnavailable) {
        rainAudio = createRainAudio()
        rainAudioUnavailable = rainAudio === null
      }
      void rainAudio?.start()
    },
    { immediate: true },
  )

  onBeforeUnmount(() => {
    rainAudio?.destroy()
    rainAudio = null
  })

  // From the canvasui playground: slow, thin, sparse. Note this sits at the
  // bottom of the effect's usable range — at intensity 0.2 the first rain layer,
  // S(0.25, 0.75, intensity), is exactly zero, so only the second draws and its
  // coverage lands right against the shader's hard S(0.3, 1.0) cull. Lower and
  // the rain disappears rather than thinning; to reduce it further lower `scale`
  // (drop count goes with its square) instead.
  const rainOptions = {
    intensity: 0.45,
    speed: 0.4,
    // Density comes off `scale`, not `intensity`: intensity feeds the
    // S(0.25, 0.75) and S(0.0, 0.5) layer ramps, and dropping it switches whole
    // layers off rather than thinning them. Drop count goes with scale squared.
    scale: 0.28,
    staticDrops: 0.1,
    dropWidth: 0.8,
    fallSpeed: 0.6,
  }

  return { rainEnabled, rainAvailable, showRain, rainOptions }
}
