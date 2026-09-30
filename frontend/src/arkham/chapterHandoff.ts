import type { XpBreakdownStep } from './types/Xp'
import type { Question } from './types/Question'

export function chapterXp(iid: string, breakdown: XpBreakdownStep | undefined): number | null {
  if (!breakdown || !breakdown.investigators.includes(iid)) return null
  return breakdown.entries.reduce((total, entry) => {
    if (entry.tag === 'AllGainXp' && entry.details.source === 'XpFromVictoryDisplay') return total + entry.details.amount
    if (entry.tag === 'InvestigatorGainXp' && entry.investigator === iid) return total + entry.details.amount
    if (entry.tag === 'InvestigatorLoseXp' && entry.investigator === iid) return total - entry.details.amount
    return total
  }, 0)
}

export function hasPendingUpgrade(questions: Record<string, Question>, iid: string, playerId: string): boolean {
  return [questions[iid], questions[playerId]].some(question => {
    let current = question
    while (current?.question) current = current.question
    return current?.tag === 'ChooseUpgradeDeck'
  })
}
