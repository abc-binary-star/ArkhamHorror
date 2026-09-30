import { inject, nextTick, onBeforeUnmount, onMounted, provide, shallowRef, type InjectionKey } from 'vue'
import { VisualFeedbackQueue, feedbackPoint, type FeedbackSnapshot, type VisualEvent } from '../visualFeedback'

type Receipt = VisualEvent & { anchor: number; x: number; y: number; width: number; height: number }
function visible(element: HTMLElement) {
  const rect = element.getBoundingClientRect()
  if (!element.getClientRects().length || !rect.width || !rect.height) return false
  const point = feedbackPoint(rect)
  if (point.x < 0 || point.y < 0 || point.x > innerWidth || point.y > innerHeight) return false
  for (let parent: HTMLElement | null = element; parent; parent = parent.parentElement) {
    const css = getComputedStyle(parent)
    if (css.visibility === 'hidden' || css.display === 'none' || css.opacity === '0') return false
    const bounds = parent.getBoundingClientRect()
    if (/(hidden|clip|auto|scroll)/.test(css.overflowX) && (point.x < bounds.left || point.x > bounds.right)) return false
    if (/(hidden|clip|auto|scroll)/.test(css.overflowY) && (point.y < bounds.top || point.y > bounds.bottom)) return false
  }
  return true
}
function elements(key: string) {
  return [...document.querySelectorAll<HTMLElement>(`[data-feedback-key="${CSS.escape(key)}"]`)]
}
function anchors(key: string) { return elements(key).filter(visible) }
function rendered(key: string) {
  return elements(key).some(element => element.getClientRects().length && getComputedStyle(element).visibility !== 'hidden')
}
function locate(event: VisualEvent): Receipt[] {
  const exact = anchors(event.key)
  const direct = exact.length || event.kind !== 'Reveal' ? exact : anchors(`location:${event.locationId}`)
  const parts = event.key.split(':')
  const targets = direct.length || parts[0] !== 'investigators' || event.kind === 'Action'
    ? direct : anchors(`tab:${parts[1]}`)
  return targets.map((element, anchor) => {
    const rect = element.getBoundingClientRect()
    return { ...event, anchor, ...feedbackPoint(rect), width: rect.width, height: rect.height }
  })
}
export function provideVisualFeedback() {
  const queue = new VisualFeedbackQueue()
  const receipts = shallowRef<Receipt[]>([])
  const history = shallowRef<VisualEvent[]>([])
  const mapActivity = shallowRef<VisualEvent[]>([])
  const pendingReveals = new Map<string, VisualEvent>()
  let mapFocus: ((id: string) => Promise<boolean>) | null = null
  const historyTimers = new Set<ReturnType<typeof setTimeout>>()
  let generation = 0
  const transitionAllowed = shallowRef(false)
  const resetVersion = shallowRef(0)
  let ready = false
  let paused = 0
  let focusSequence = 0
  const timers = new Set<ReturnType<typeof setTimeout>>()
  function dismiss() { receipts.value = []; timers.forEach(clearTimeout); timers.clear() }
  function reset() { history.value = []; mapActivity.value = []; pendingReveals.clear();
    historyTimers.forEach(clearTimeout); historyTimers.clear(); transitionAllowed.value = false; resetVersion.value++; generation++; ready = false; queue.reset(); dismiss() }
  function pause() {
    paused++
    reset()
    return () => { paused = Math.max(0, paused - 1) }
  }
  function baseline(snapshot: FeedbackSnapshot) {
    reset()
    queue.consume(null, snapshot)
  }
  function publish(items: Receipt[]) {
    if (!items.length) return
    const keys = new Set(items.map(item => item.key))
    receipts.value = [...receipts.value.filter(item => !keys.has(item.key)), ...items].slice(-64)
    const ids = new Set(items.map(item => item.id))
    const timer = setTimeout(() => {
      receipts.value = receipts.value.filter(item => !ids.has(item.id))
      timers.delete(timer)
    }, 850)
    timers.add(timer)
  }
  function remember(event: VisualEvent, previouslyVisible = false) {
    if (['Action', 'Focus'].includes(event.kind)) return
    // A visible tab or a rendered map/card is evidence of public UI access.
    if (!previouslyVisible && !rendered(event.key) && !(event.kind === 'Reveal' && rendered(`location:${event.locationId}`)) && !locate(event).length) return
    if (history.value.some(item => item.id === event.id)) return
    history.value = [...history.value, event].slice(-24)
    if (event.locationId && !locate(event).length) {
      mapActivity.value = [...mapActivity.value.filter(item => item.locationId !== event.locationId), event].slice(-6)
    }
    const timer = setTimeout(() => {
      history.value = history.value.filter(item => item.id !== event.id)
      mapActivity.value = mapActivity.value.filter(item => item.id !== event.id)
      historyTimers.delete(timer)
    }, 30000)
    historyTimers.add(timer)
  }
  async function completeReveal(locationId: string) {
    const event = pendingReveals.get(locationId)
    if (!event) return
    const epoch = generation
    await nextTick()
    if (epoch !== generation || pendingReveals.get(locationId) !== event) return
    pendingReveals.delete(locationId)
    remember(event)
    publish(locate(event))
  }
  function registerMapFocus(callback: (id: string) => Promise<boolean>) {
    mapFocus = callback
    return () => { if (mapFocus === callback) mapFocus = null }
  }
  async function locateMapEvent(event: VisualEvent) {
    if (!event.locationId || !mapFocus) return
    const epoch = generation
    if (!await mapFocus(event.locationId) || epoch !== generation) return
    mapActivity.value = mapActivity.value.filter(item => item.locationId !== event.locationId)
    await nextTick()
    publish(locate({ id: `locate:${++focusSequence}`, key: `location:${event.locationId}`, origin: 'ui', kind: 'Focus' }))
  }
  function prepare(previous: FeedbackSnapshot | null, next: FeedbackSnapshot) {
    if (paused) queue.reset()
    const wasSilent = queue.rebuilding
    const rebuilding = !previous || previous.id !== next.id || previous.scenario?.id !== next.scenario?.id
      || next.scenarioSteps < previous.scenarioSteps
    transitionAllowed.value = !wasSilent && !rebuilding && !paused
    const events = queue.consume(previous, next)
    // A rewind must also remove already visible receipts.
    if (rebuilding) {
      resetVersion.value++; generation++; ready = false; dismiss()
      history.value = []; mapActivity.value = []; pendingReveals.clear()
      historyTimers.forEach(clearTimeout); historyTimers.clear()
    }
    mapActivity.value = mapActivity.value.filter(event => event.locationId && next.locations[event.locationId])
    for (const id of pendingReveals.keys()) {
      if (!next.locations[id]?.revealed) pendingReveals.delete(id)
    }
    for (const event of events) {
      if (event.kind === 'Reveal' && event.locationId) pendingReveals.set(event.locationId, event)
    }
    const epoch = generation
    const oldPositions = new Map(events.map(event => [event.id, locate(event)]))
    return async () => {
      await nextTick()
      if (generation !== epoch) return
      ready = !rebuilding && !wasSilent
      const positions = (event: VisualEvent) => {
        const current = event.kind === 'Action' ? [] : locate(event)
        const result = current.length ? current : ['Move', 'Reveal', 'Doom'].includes(event.kind) ? [] : oldPositions.get(event.id) ?? []
        return result
      }
      for (const event of events.filter(event => event.kind !== 'Reveal')) remember(event, !!oldPositions.get(event.id)?.length)
      publish(events.filter(event => event.kind !== 'Reveal').flatMap(positions))
    }
  }
  async function focus(id: string) {
    if (!ready || paused) return
    const epoch = generation
    await nextTick()
    if (epoch !== generation) return
    publish(['tab', 'portrait'].flatMap(part => locate({
      id: `focus:${++focusSequence}`, origin: 'ui', key: `${part}:${id}`, kind: 'Focus',
    })))
  }
  // Fixed receipts are dismissed before their underlying viewport moves.
  onMounted(() => {
    window.addEventListener('scroll', dismiss, true)
    window.addEventListener('wheel', dismiss, { capture: true, passive: true })
    window.addEventListener('resize', dismiss)
    window.addEventListener('pointerdown', dismiss, true)
  })
  onBeforeUnmount(() => {
    window.removeEventListener('scroll', dismiss, true)
    window.removeEventListener('wheel', dismiss, true)
    window.removeEventListener('resize', dismiss)
    window.removeEventListener('pointerdown', dismiss, true)
  })
  const api = { history, mapActivity, completeReveal, registerMapFocus, locateMapEvent, transitionAllowed, resetVersion, receipts, reset, pause, baseline, dismiss, prepare, focus }
  provide(key, api)
  onBeforeUnmount(reset)
  return api
}
const key: InjectionKey<ReturnType<typeof provideVisualFeedback>> = Symbol('visual-feedback')
export const useVisualFeedback = () => inject(key, null)
