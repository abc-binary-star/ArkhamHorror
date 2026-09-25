import { formatKey, type LogContents, type LogKey } from '@/arkham/types/Log'

type SectionLogKey = LogKey & { contents: { tag: string; contents: string } }

/* Section records (Simeon Atwood's notes, Areas Surveyed, ...) are rendered by
 * their own components rather than as campaign notes. */
export const isSectionLogKey = (r: LogKey): r is SectionLogKey => {
  if (!('contents' in r)) return false
  const contents = r.contents
  if (typeof contents !== 'object' || contents === null) return false
  return typeof contents.tag === 'string' && typeof contents.contents === 'string'
}

// Rendered by ArtifactsEarned as a checklist, so exclude them from Campaign Notes.
const TDC_ARTIFACT_KEYS = new Set([
  'BarrierNode',
  'GrislyMask',
  'TidalTablet',
  'ShardOfYchlecht',
  'ObsidianClaw',
  'HorrorInClay',
])

// Tasks are recorded per-investigator (progress counts live in each
// investigator's log), so exclude them from the shared Campaign Notes; they are
// shown in the per-investigator sections instead.
export const TDC_TASK_KEYS = new Set([
  'WalkInFaith',
  'ToeTheLine',
  'NoPlaceLikeHome',
  'GoodMoney',
  'DoNoHarm',
  'ProveYourWorth',
  'DreamsOfDestruction',
  'PlumbTheDepths',
])

export function campaignNoteItems(log: LogContents, fallbackHomebrewScope?: string): string[] {
  return log.recorded
    .filter(r => !['Teachings1', 'Teachings2', 'Teachings3'].includes(r.tag))
    .filter(r => !isSectionLogKey(r))
    .filter(r => !(r.tag === 'TheDrownedCityKey' && TDC_ARTIFACT_KEYS.has(String(r.contents))))
    .filter(r => !(r.tag === 'TheDrownedCityKey' && TDC_TASK_KEYS.has(String(r.contents))))
    .map(r => formatKey(r, fallbackHomebrewScope))
}
