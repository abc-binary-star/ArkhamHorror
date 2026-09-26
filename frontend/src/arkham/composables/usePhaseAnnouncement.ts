import { computed, nextTick, onScopeDispose, ref, watch, type Ref } from 'vue'
import type { Phase } from '@/arkham/types/Phase'

export const PHASE_ANNOUNCEMENT_MS = 2200

// Own the barrier alongside the game state, before any child choice dialogs
// render. The banner is only a view of this state, never the owner of the lock.
export function usePhaseAnnouncement(
  phase: () => Phase | undefined,
  revelationActive: Ref<boolean>,
) {
  const current = ref<Phase | null>(null)
  const pending: Phase[] = []
  const active = computed(() => current.value !== null)
  let timer: ReturnType<typeof setTimeout> | undefined
  let generation = 0
  let lastAnnounced: Phase | undefined = phase()

  function advance() {
    const run = ++generation
    clearTimeout(timer)
    timer = undefined
    if (revelationActive.value) return
    current.value = pending.shift() ?? null
    if (current.value) {
      // Start the full display interval only after the banner has rendered.
      void nextTick(() => {
        if (run === generation && current.value && !revelationActive.value) {
          timer = setTimeout(advance, PHASE_ANNOUNCEMENT_MS)
        }
      })
    }
  }

  // Server-driven phase transitions (PhaseChanged broadcasts) enter through
  // here. Deduplicate against the current banner and queue so a broadcast
  // arriving after the GameUpdate-driven watch(phase) push cannot double-play
  // the phase the client already observed.
  function push(phase: Phase) {
    if (!phase || phase === 'CampaignPhase') return
    if (lastAnnounced === phase) return
    lastAnnounced = phase
    pending.push(phase)
    if (!current.value) advance()
  }

  function reset() {
    generation++
    clearTimeout(timer)
    timer = undefined
    pending.length = 0
    lastAnnounced = phase()
    current.value = null
  }

  watch(phase, (next, previous) => {
    if (!next || next === 'CampaignPhase') {
      reset()
      return
    }
    // Loading/reconnecting does not replay the phase already in progress.
    if (!previous) {
      lastAnnounced = next
      return
    }
    if (next === previous) return
    push(next)
  }, { flush: 'sync' })

  watch(revelationActive, locked => {
    if (locked) {
      generation++
      clearTimeout(timer)
      timer = undefined
      if (current.value) pending.unshift(current.value)
      current.value = null
    } else if (!current.value) {
      // Reserve the banner before Game.vue drains queued reveals or any
      // nextTick callback can open the next question's native dialog.
      advance()
    }
  }, { flush: 'sync' })

  onScopeDispose(reset)
  return { current, active, push, reset }
}
