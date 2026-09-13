import type { Source } from '@/arkham/types/Source'
import type { AbilityType } from '@/arkham/types/Ability'

export type AtmosphereTone = 'support' | 'resolve' | 'enemy' | 'enemyForced' | 'treachery' | 'forced' | 'encounter' | 'damage' | 'horror' | 'peril' | 'test' | 'success' | 'failure' | 'chaos' | 'payment' | 'search' | 'story' | 'choice' | 'archive' | 'preparation' | 'revelation' | 'tarot'

function sourceTags(source: Source): string[] {
  switch (source.sourceTag) {
    case 'ProxySource': return [...sourceTags(source.source), ...sourceTags(source.originalSource)]
    case 'IndexedSource': return source.contents ? sourceTags(source.contents[1]) : []
    case 'AbilitySource': return sourceTags(source.contents[0])
    case 'UseAbilitySource': return sourceTags(source.contents[1])
    case 'PaymentSource': return sourceTags(source.contents)
    case 'BothSource': return [...sourceTags(source.contents[0]), ...sourceTags(source.contents[1])]
    default: return [source.tag]
  }
}

export function triggerAtmosphere(source: Source, type: AbilityType): AtmosphereTone {
  // Objective/other wrappers must retain the tone of the underlying ability.
  if ('abilityType' in type) return triggerAtmosphere(source, type.abilityType)
  const tags = sourceTags(source)
  const forced = ['ForcedAbility', 'ForcedAbilityWithCost', 'SilentForcedAbility', 'Haunted'].includes(type.tag)
  if (tags.some(tag => tag === 'EnemySource' || tag === 'EnemyAttackSource')) return forced ? 'enemyForced' : 'enemy'
  if (tags.includes('TreacherySource') || type.tag === 'Haunted') return 'treachery'
  // Mandatory costs on player cards need a sober tone too: forced is not a boon.
  if (forced) return 'forced'
  if (tags.includes('AssetSource')) return 'support'
  if (tags.some(tag => ['InvestigatorSource', 'EventSource', 'SkillSource'].includes(tag))) return 'resolve'
  return 'choice'
}
