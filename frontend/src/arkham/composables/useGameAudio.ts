import { onMounted, onUnmounted, watch, type Ref } from 'vue'

// One cached voice per effect: repeated draw notifications coalesce rather
// than stacking a separate audio element for every card in a batch.
const effects: Record<string, { volume: number; cooldown: number }> = {
  'card-draw.mp3': { volume: 0.45, cooldown: 950 },
  'card-play.mp3': { volume: 0.5, cooldown: 550 },
  'attack.mp3': { volume: 0.55, cooldown: 550 },
  'investigate.mp3': { volume: 0.45, cooldown: 1300 },
  'damage.mp3': { volume: 0.55, cooldown: 1300 },
  'horror.mp3': { volume: 0.4, cooldown: 2150 },
}

export function useGameAudio(disabled: Ref<boolean>) {
  const clips = new Map<string, HTMLAudioElement>()
  const lastPlayed = new Map<string, number>()

  function clipFor(fileName: string) {
    let clip = clips.get(fileName)
    if (!clip) {
      clip = new Audio(`/audio/${fileName}`)
      clip.preload = 'auto'
      clip.volume = effects[fileName]?.volume ?? 0.65
      clips.set(fileName, clip)
    }
    return clip
  }

  function stop() {
    for (const clip of clips.values()) {
      clip.pause()
      clip.currentTime = 0
    }
    lastPlayed.clear()
  }

  function playAudioFile(fileName: string) {
    if (disabled.value || !/^[a-zA-Z0-9_.-]+\.(ogg|mp3|wav)$/i.test(fileName)) return
    const now = performance.now()
    if (now - (lastPlayed.get(fileName) ?? -Infinity) < (effects[fileName]?.cooldown ?? 250)) return
    // Keep both the cache and the number of simultaneous sounds bounded.
    if (!clips.has(fileName) && clips.size >= 16) return
    if ([...clips.values()].filter(clip => !clip.paused && !clip.ended).length >= 4) return
    const clip = clipFor(fileName)
    if (!clip.paused && !clip.ended) return
    lastPlayed.set(fileName, now)
    clip.currentTime = 0
    // Autoplay-blocked sounds are dropped, never replayed as a backlog.
    void clip.play().catch(() => {})
  }

  onMounted(() => {
    for (const fileName of Object.keys(effects)) clipFor(fileName).load()
  })
  watch(disabled, value => { if (value) stop() }, { flush: 'sync' })
  onUnmounted(() => {
    stop()
    for (const clip of clips.values()) {
      clip.removeAttribute('src')
      clip.load()
    }
    clips.clear()
  })

  return { playAudioFile }
}
