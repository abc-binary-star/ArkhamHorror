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

  function reset() {
    generation++
    clearTimeout(timer)
    timer = undefined
    pending.length = 0
    current.value = null
  }

  watch(phase, (next, previous) => {
    if (!next || next === 'CampaignPhase') {
      reset()
      return
    }
    // Loading/reconnecting does not replay the phase already in progress.
    if (!previous || next === previous) return
    pending.push(next)
    if (!current.value) advance()
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
  return { current, active }
}
