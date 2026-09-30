/** Presentation-only events. Never enqueue rules or derive source/target causality. */
export const feedbackTokens = ['Resource', 'Clue', 'Damage', 'Horror'] as const
export type FeedbackToken = typeof feedbackTokens[number]
export type VisualEvent = {
  id: string
  origin: 'state-diff' | 'ui'
  key: string
  kind: FeedbackToken | 'Action' | 'Focus' | 'Move' | 'Reveal' | 'Doom'
  locationId?: string
  subjectName?: string
  subjectCode?: string
  subjectType?: string
  delta?: number
}
type Entity = { name?: { title: string }; cardCode?: string; placement?: { tag: string; contents?: unknown } | null; revealed?: boolean; connectedLocations?: string[]; tokens?: Partial<Record<FeedbackToken, number>>; remainingActions?: number; additionalActions?: unknown[]; endedTurn?: boolean }
export type FeedbackSnapshot = {
  id: string
  scenarioSteps: number
  scenario?: { id: string } | null
  investigators: Record<string, Entity>
  assets: Record<string, Entity>
  enemies: Record<string, Entity>
  locations: Record<string, Entity>
  agendas?: Record<string, { flipped: boolean; doomPressure?: { total: number; threshold: number } | null }>
}
const groups = ['investigators', 'assets', 'enemies', 'locations'] as const

export class VisualFeedbackQueue {
  private silent = true
  private sequence = 0
  get rebuilding() { return this.silent }
  reset() { this.silent = true }
  consume(previous: FeedbackSnapshot | null, next: FeedbackSnapshot): VisualEvent[] {
    const rebuilding = this.silent || !previous || previous.id !== next.id
      || previous.scenario?.id !== next.scenario?.id || next.scenarioSteps < previous.scenarioSteps
    this.silent = false
    if (rebuilding || !previous) return []
    const batch = ++this.sequence
    const events: VisualEvent[] = []
    for (const group of groups) {
      for (const [id, entity] of Object.entries(next[group])) {
        const old = previous[group][id]
        if (!old) continue // entity entry is not evidence of gaining its tokens
        for (const token of feedbackTokens) {
          const delta = (entity.tokens?.[token] ?? 0) - (old.tokens?.[token] ?? 0)
          if (Number.isFinite(delta) && delta) {
            const key = `${group}:${id}:${token}`
            events.push({ id: `${batch}:${key}`, origin: 'state-diff', key, kind: token, delta, subjectName: entity.name?.title, subjectCode: entity.revealed === false ? undefined : entity.cardCode, subjectType: group, locationId: group === 'locations' ? id : group === 'enemies' ? locationOf(entity) ?? undefined : undefined })
          }
        }
        // Ending a turn clears unused actions; it is not an action payment.
        if (group === 'investigators' && !entity.endedTurn && !old.endedTurn) {
          const before = old.remainingActions ?? 0
          const after = entity.remainingActions ?? 0
          for (let slot = after + 1; slot <= before; slot++) {
            const key = `${group}:${id}:Action:${slot}`
            events.push({ id: `${batch}:${key}`, origin: 'state-diff', key, kind: 'Action' })
          }
          const remaining = (entity.additionalActions ?? []).map(action => JSON.stringify(action))
          for (const [index, action] of (old.additionalActions ?? []).entries()) {
            const match = remaining.indexOf(JSON.stringify(action))
            if (match >= 0) { remaining.splice(match, 1); continue }
            const key = `${group}:${id}:AdditionalAction:${index}`
            events.push({ id: `${batch}:${key}`, origin: 'state-diff', key, kind: 'Action' })
          }
        }
      }
    }
    for (const group of ['investigators', 'enemies'] as const) {
      for (const [id, entity] of Object.entries(next[group])) {
        const source = locationOf(previous[group][id])
        const destination = locationOf(entity)
        if (!source || !destination || source === destination || !next.locations[destination]) continue
        // A snapshot proves a changed location, not how the entity travelled.
        events.push({ id: `${batch}:move:${group}:${id}`, origin: 'state-diff', kind: 'Move',
          key: `location:${destination}`, locationId: destination,
          subjectType: 'locations', subjectCode: next.locations[destination].revealed ? next.locations[destination].cardCode : undefined })
      }
    }
    for (const [id, location] of Object.entries(next.locations)) {
      if (previous.locations[id]?.revealed === false && location.revealed === true) {
        events.push({ id: `${batch}:reveal:${id}`, origin: 'state-diff', kind: 'Reveal', key: `revealed:${id}`, locationId: id, subjectType: 'locations', subjectCode: location.cardCode })
      }
    }
    for (const [id, agenda] of Object.entries(next.agendas ?? {})) {
      const old = previous.agendas?.[id]
      if (!agenda.flipped && old?.doomPressure && agenda.doomPressure
        && doomPressureLevel(old.doomPressure) !== 'reached' && doomPressureLevel(agenda.doomPressure) === 'reached') {
        events.push({ id: `${batch}:doom:${id}`, origin: 'state-diff', kind: 'Doom', key: `agenda:${id}` })
      }
    }
    return events
  }
}

/** DOMRects are already viewport coordinates, including map zoom and scroll. */
export function feedbackPoint(rect: { left: number; top: number; width: number; height: number }) {
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
}

export type FeedbackRect = { left: number; top: number; width: number; height: number }
export function feedbackPriority(kind: string): number {
  return ({ Damage: 0, Horror: 0, Doom: 0, Focus: 0, Move: 1, Reveal: 1, Action: 2, Clue: 3, Resource: 4 } as Record<string, number>)[kind] ?? 5
}
export function overlaps(a: FeedbackRect, b: FeedbackRect, gap = 4): boolean {
  return a.left < b.left + b.width + gap && a.left + a.width + gap > b.left
    && a.top < b.top + b.height + gap && a.top + a.height + gap > b.top
}
/** Bound receipts to the viewport and keep them near their own entity. If no
 * safe space remains, the persistent history retains the result instead. */
export function arrangeReceipts<T extends { x: number; y: number; width?: number; height: number; delta?: number; kind?: string; bubbleWidth?: number }>(items: T[], viewportWidth: number, viewportHeight: number, obstacles: FeedbackRect[] = []): T[] {
  const placed: T[] = []
  const occupied: FeedbackRect[] = [...obstacles]
  for (const item of [...items].sort((a, b) => feedbackPriority(a.kind ?? '') - feedbackPriority(b.kind ?? ''))) {
    if (placed.length >= 10) break
    if (item.delta === undefined) { placed.push(item); continue }
    const width = Math.min(item.bubbleWidth ?? 116, viewportWidth - 16)
    const height = 26
    const originY = item.y - item.height / 2 - height / 2 - 8
    const candidates = [0, -32, 32, -64, 64, -96, 96, -128, 128].flatMap(dy =>
      [0, -width / 2 - 10, width / 2 + 10].map(dx => ({
        left: item.x + dx - width / 2, top: originY + dy - height / 2, width, height,
      })))
    const spot = candidates.find(rect => rect.left >= 8 && rect.top >= 24
      && rect.left + width <= viewportWidth - 8 && rect.top + height <= viewportHeight - 8
      && !occupied.some(other => overlaps(rect, other)))
    if (!spot) continue
    occupied.push(spot)
    placed.push({ ...item, x: spot.left + width / 2, y: spot.top + height / 2 })
  }
  return placed
}

/** Pending damage/healing is a preview, not a new applied token value. */
export function assignmentPreview(remaining: number | null | undefined, taken = 0, assigned = 0, healing = 0) {
  if (remaining === null || remaining === undefined || !Number.isFinite(remaining)) return null
  const recovered = Math.min(Math.max(0, healing), Math.max(0, taken + assigned))
  return { remaining, assigned, healing: recovered, after: remaining === 0 && healing > 0 ? null : Math.max(0, remaining - assigned + recovered) }
}

function locationOf(entity: Entity | undefined): string | null {
  return entity?.placement?.tag === 'AtLocation' && typeof entity.placement.contents === 'string'
    ? entity.placement.contents : null
}
export function doomPressureLevel(pressure: { total: number; threshold: number }): 'normal' | 'near' | 'reached' {
  if (pressure.total >= pressure.threshold) return 'reached'
  return pressure.threshold > 0 && pressure.total / pressure.threshold >= 0.75 ? 'near' : 'normal'
}
/** Unknown effective capacities stay unmarked; printed values are not a fallback. */
export function nearDefeat(remaining: number | null | undefined, taken = 0): boolean {
  return remaining !== null && remaining !== undefined && Number.isFinite(remaining) && remaining <= 2 && taken > 0
}
