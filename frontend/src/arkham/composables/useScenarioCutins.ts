import { computed, onScopeDispose, ref, watch, type Ref } from 'vue'
import type { Game } from '@/arkham/types/Game'
import artwork from '@/arkham/data/scenarioCutins.json'

// JSON widens kind to string; keep the shared queue's discriminator precise.
export type ScenarioCutin = Omit<(typeof artwork)[number], 'kind'> & { kind: 'act' | 'agenda' }
export type EnemyEntranceArt = {
  code: string
  scenario: string
  title: { zh: string; en: string }
  subtitle: { zh: string; en: string }
  image: string
  tone: string
  boss: boolean
}
export type EnemyEntrance = EnemyEntranceArt & { kind: 'enemy'; instance: string }
type Presentation = ScenarioCutin | EnemyEntrance
export const SCENARIO_CUTIN_MS = 3200
export const ENEMY_ENTRANCE_MS = 4000

// Observe the live stacks once per game, rather than each rendered card/seat.
// B faces resolve the departing card; only a newly arriving A face gets an entrance.
export function useScenarioCutins(
  game: () => Game | null | undefined,
  enabled: () => boolean,
  blocked: Ref<boolean>,
  enemyArtwork: readonly EnemyEntranceArt[] = [],
) {
  const current = ref<Presentation | null>(null)
  const pending: Presentation[] = []
  // Waiting behind a revelation must not disable that revelation's Continue button.
  const active = computed(() => current.value !== null)
  const failedImages = new Set<string>()
  let timer: ReturnType<typeof setTimeout> | undefined
  let generation = 0
  const duration = () => current.value?.kind === 'enemy' ? ENEMY_ENTRANCE_MS : SCENARIO_CUTIN_MS

  function reset() {
    generation++
    clearTimeout(timer)
    pending.length = 0
    current.value = null
  }

  function advance() {
    generation++
    clearTimeout(timer)
    if (blocked.value) return
    current.value = pending.shift() ?? null
    // A missing/slow image must never keep the game locked indefinitely.
    if (current.value) timer = setTimeout(advance, duration() + 5000)
  }

  function imageReady() {
    if (!current.value) return
    clearTimeout(timer)
    const run = generation
    timer = setTimeout(() => {
      if (run === generation) advance()
    }, duration())
  }

  function imageFailed() {
    if (current.value) failedImages.add(current.value.image)
    advance()
  }

  const snapshot = () => {
    const value = game()
    return {
      gameId: value?.id,
      scenarioId: value?.scenario?.id.replace(/^c/, ''),
      setup: value?.inSetup ?? true,
      steps: value?.scenarioSteps ?? 0,
      // Set-aside, concealed and facedown enemies must never reveal their identity.
      enemies: Object.values(value?.enemies ?? {})
        .filter(enemy => ['AtLocation', 'InThreatArea', 'InPlayArea', 'InVehicle', 'InPosition', 'NextToAgenda', 'NextToAct', 'NextToScenarioReference'].includes(enemy.placement.tag))
        .map(enemy => {
          const code = enemy.cardCode.replace(/^c/, '')
          // Normalize the displayed form so separate flip/replace updates do not replay it.
          return { id: enemy.id, code: enemy.flipped && !code.endsWith('b') ? `${code}b` : code }
        }),
      cards: [
        ...Object.values(value?.agendas ?? {}).filter(c => !c.flipped && c.sequence.side === 'A').map(c => ({ code: c.id.replace(/^c/, ''), kind: 'agenda', deck: c.deckId })),
        ...Object.values(value?.acts ?? {}).filter(c => c.sequence.side === 'A').map(c => ({ code: c.id.replace(/^c/, ''), kind: 'act', deck: c.deckId })),
      ],
    }
  }

  watch(snapshot, (next, previous) => {
    // Hydration, reconnect and undo establish a baseline without replaying old cards.
    if (!next.gameId || !previous?.gameId || next.gameId !== previous.gameId || (next.scenarioId === previous.scenarioId && next.steps < previous.steps)) {
      reset()
      return
    }
    if (next.scenarioId !== previous.scenarioId) reset()
    if (next.setup || !enabled()) return
    const previousCards = previous.setup || next.scenarioId !== previous.scenarioId ? [] : previous.cards
    const added = next.cards.filter(card => !previousCards.some(old => old.code === card.code && old.kind === card.kind && old.deck === card.deck))
    const queued = new Set<string>()
    for (const card of added) {
      const art = artwork.find(a => a.scenario === next.scenarioId && a.code === card.code && a.kind === card.kind) as ScenarioCutin | undefined
      // The finale's special agenda also occupies the act stack: show it once.
      if (!art || queued.has(art.code) || failedImages.has(art.image)) continue
      queued.add(art.code)
      pending.push(art)
    }
    const previousEnemies = previous.setup || next.scenarioId !== previous.scenarioId ? [] : previous.enemies
    for (const enemy of next.enemies) {
      if (previousEnemies.some(old => old.id === enemy.id && old.code === enemy.code)) continue
      const code = enemy.code
      const art = enemyArtwork.find(a => a.scenario === next.scenarioId && a.code === code)
      if (!art || failedImages.has(art.image)) continue
      pending.push({ ...art, kind: 'enemy', instance: `${enemy.id}:${code}` })
    }
    if (!current.value && pending.length) advance()
  }, { flush: 'sync', immediate: true })

  watch(enabled, value => { if (!value) reset() }, { flush: 'sync' })
  watch(() => [game()?.scenario?.id, enabled()] as const, ([scenarioId, animations]) => {
    if (!animations || typeof Image === 'undefined') return
    for (const art of [...artwork, ...enemyArtwork].filter(a => a.scenario === scenarioId?.replace(/^c/, ''))) {
      const image = new Image()
      image.src = art.image
    }
  }, { immediate: true })
  watch(blocked, value => {
    if (value) {
      generation++
      clearTimeout(timer)
      if (current.value) pending.unshift(current.value)
      current.value = null
    } else if (pending.length) advance()
  }, { flush: 'sync' })

  onScopeDispose(reset)
  return { current, active, skip: advance, imageReady, imageFailed, reset }
}
