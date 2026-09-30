import catalog from '@/arkham/data/attachmentEffects.json'
import type { Game } from '@/arkham/types/Game'
import type { Placement } from '@/arkham/types/Placement'

export type AttachmentEffectKind =
  | 'lock' | 'barrier' | 'rubble' | 'fog' | 'vines' | 'web' | 'spores'
  | 'snow' | 'vortex' | 'ice' | 'water' | 'electric' | 'rift' | 'spotlight'
  | 'rot' | 'threads' | 'sparks' | 'blood' | 'growth' | 'doom' | 'haunt'
  | 'hunt' | 'evidence' | 'song' | 'glyph' | 'lantern' | 'fire'

export type AttachmentHost = { type: 'location' | 'enemy' | 'asset' | 'act' | 'agenda'; id: string }
export interface AttachmentEffectDefinition {
  name: string
  kind: AttachmentEffectKind
  variant?: string
  readyOnly?: boolean
}
export interface AttachmentEffect extends AttachmentEffectDefinition {
  sourceId: string
  dormant: boolean
}
export const attachmentEffectCatalog = catalog as Record<string, AttachmentEffectDefinition>

function attachedTo(placement: Placement, host: AttachmentHost): boolean {
  switch (placement.tag) {
    case 'AttachedToLocation': return host.type === 'location' && placement.contents === host.id
    case 'AttachedToEnemy': return host.type === 'enemy' && placement.contents === host.id
    case 'AttachedToAsset': return host.type === 'asset' && placement.contents[0] === host.id
    case 'AttachedToAct': return host.type === 'act' && placement.contents === host.id
    case 'AttachedToAgenda': return host.type === 'agenda' && placement.contents === host.id
    default: return false
  }
}

/** Read the live host relationship, never the last draw, selected seat or card name. */
export function attachmentEffectsFor(game: Game, host: AttachmentHost): AttachmentEffect[] {
  const entities = {
    location: game.locations, enemy: game.enemies, asset: game.assets,
    act: game.acts, agenda: game.agendas,
  }
  const entity = entities[host.type]?.[host.id]
  if (!entity) return []
  const effects: AttachmentEffect[] = []
  for (const id of entity.treacheries) {
    const card = game.treacheries[id]
    if (!card || !attachedTo(card.placement, host)) continue
    const definition = attachmentEffectCatalog[card.cardCode.replace(/^c/, '')]
    const blanked = game.modifiers?.some(([target, modifiers]) =>
      target.tag === 'TreacheryTarget' && target.contents === id
      && modifiers.some(modifier => modifier.type.tag === 'Blank')) ?? false
    if (definition) effects.push({
      ...definition, sourceId: id,
      dormant: blanked || (!!definition.readyOnly && card.exhausted),
    })
  }
  // Mind Extraction attaches the flipped lantern, not the treachery itself.
  if (host.type === 'enemy') {
    for (const id of game.enemies[host.id].assets) {
      const asset = game.assets[id]
      if (!asset || !attachedTo(asset.placement, host)) continue
      const definition = attachmentEffectCatalog[asset.cardCode.replace(/^c/, '')]
      if (definition?.kind === 'lantern') effects.push({ ...definition, sourceId: id, dormant: false })
    }
  }
  return effects
}

/** One animated environment; distinct remaining attachments keep static motifs. */
export function attachmentEffectLayers(effects: AttachmentEffect[]): AttachmentEffect[] {
  const kinds = new Set<string>()
  return effects.filter(effect => {
    // Orange fire already has its own server-driven FlameWrap on locations.
    if (effect.kind === 'fire') return false
    const key = `${effect.kind}:${effect.variant ?? ''}:${effect.dormant}`
    if (kinds.has(key)) return false
    kinds.add(key)
    return true
  }).sort((a, b) => Number(a.dormant) - Number(b.dormant)
    || Number(b.kind === 'lock' || b.kind === 'rubble') - Number(a.kind === 'lock' || a.kind === 'rubble')
    || a.sourceId.localeCompare(b.sourceId))
}

export type AttachmentDeparture = AttachmentEffect & { reason: 'removed' | 'moved' | 'inactive' }
/** Compare source identities before collapsing duplicate environmental motifs. */
export function attachmentDepartures(previous: AttachmentEffect[], next: AttachmentEffect[], game: Game): AttachmentDeparture[] {
  return previous.flatMap(effect => {
    if (effect.dormant || effect.kind === 'fire') return []
    const current = next.find(item => item.sourceId === effect.sourceId)
    if (current && !current.dormant) return []
    const source = game.treacheries[effect.sourceId] ?? game.assets[effect.sourceId]
    const reason = current?.dormant ? 'inactive'
      : source?.placement.tag.startsWith('AttachedTo') ? 'moved' : 'removed'
    return [{ ...effect, reason }]
  })
}
