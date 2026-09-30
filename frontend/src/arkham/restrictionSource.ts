import type { Source } from './types/Source'
import type { Game } from './types/Game'

// Only preview a known, face-up public entity. Never resolve raw card-code
// sources, concealed cards, hidden hands, or off-board entities into artwork.
export function visibleRestrictionSource(source: Source, game: Game): { key: string; code: string } | null {
  if (source.sourceTag === 'AbilitySource') return visibleRestrictionSource(source.contents[0], game)
  if (source.sourceTag === 'UseAbilitySource') return visibleRestrictionSource(source.contents[1], game)
  if (source.sourceTag === 'PaymentSource') return visibleRestrictionSource(source.contents, game)
  if (source.sourceTag === 'IndexedSource') return source.contents ? visibleRestrictionSource(source.contents[1], game) : null
  if (source.sourceTag === 'ProxySource') return visibleRestrictionSource(source.source, game)
  if (!('contents' in source) || typeof source.contents !== 'string') return null
  const id = source.contents
  const key = `${source.tag}:${id}`
  if (source.tag === 'InvestigatorSource') {
    const investigator = game.investigators[id]
    return investigator ? { key, code: investigator.cardCode } : null
  }
  if (source.tag === 'LocationSource') {
    const location = game.locations[id]
    return location?.revealed ? { key, code: location.cardCode } : null
  }
  const entity = source.tag === 'AssetSource' ? game.assets[id]
    : source.tag === 'EnemySource' ? game.enemies[id]
    : source.tag === 'TreacherySource' ? game.treacheries[id] : null
  if (!entity || ('flipped' in entity && entity.flipped)) return null
  if (!['InPlayArea', 'InThreatArea', 'AtLocation', 'NextToAgenda', 'NextToAct', 'NextToScenarioReference'].includes(entity.placement.tag)) return null
  return { key, code: entity.cardCode }
}
