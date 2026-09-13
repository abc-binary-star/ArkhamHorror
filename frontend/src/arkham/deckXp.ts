import type { XpBreakdownStep, XpEntry } from '@/arkham/types/Xp'

const normalize = (code: string) => code.replace(/^c/, '')

/* Total XP an investigator has earned across the campaign, mirroring
 * XpBreakdown.vue's per-investigator math: own gain/lose entries plus each
 * step's victory-display XP (tally entries count for nobody). Deliberately NOT
 * the engine's xp/spentXp pair — an upgrade application snapshots spentXp to
 * everything available, so that pair cannot express a budget. */
export function investigatorEarnedXp(iid: string, breakdown: XpBreakdownStep[]): number {
  const id = normalize(iid)
  let total = 0
  for (const step of breakdown ?? []) {
    for (const entry of (step.entries ?? []) as XpEntry[]) {
      if (entry.tag === 'InvestigatorGainXp' && normalize(entry.investigator) === id) {
        total += entry.details.amount
      } else if (entry.tag === 'InvestigatorLoseXp' && normalize(entry.investigator) === id) {
        total -= entry.details.amount
      } else if (entry.tag === 'AllGainXp' && entry.details.source === 'XpFromVictoryDisplay') {
        total += entry.details.amount
      }
    }
  }
  return total
}

/* Total XP value carried by a deck's slots. Leveled versions are priced at
 * their full XP, which equals the cumulative diff cost from the zero-XP base
 * version, so this doubles as "total XP ever spent building this deck" and can
 * be compared directly against the investigator's total earned XP. */
export function deckTotalXp(
  slots: Record<string, number> | null | undefined,
  xpForCode: (code: string) => number | undefined,
): number {
  if (!slots) return 0
  let total = 0
  for (const [rawCode, count] of Object.entries(slots)) {
    const code = normalize(rawCode)
    if (code === '01000') continue
    total += count * (xpForCode(code) ?? 0)
  }
  return total
}
