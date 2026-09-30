import type { Question } from './types/Question'
import type { Message } from './types/Message'

// Classify only explicit question/choice semantics, never card text or turn ownership.
export function decisionGuidance(question: Question | undefined, choices: Message[]): string | null {
  if (!question) return null
  let current = question
  let payment = false
  while (current.question) {
    if (current.tag === 'PayCostQuestion') payment = true
    current = current.question
  }
  if (choices.some(choice => choice.tag === 'ComponentLabel'
    && 'tokenType' in choice.component
    && ['DamageToken', 'HorrorToken'].includes(choice.component.tokenType))) return 'assign'
  if (choices.some(choice => choice.tag === 'SkillTestApplyResultsButton')) return 'resolve'
  if (choices.some(choice => choice.tag === 'StartSkillTestButton')) return 'reveal'
  switch (current.tag) {
    case 'ChoosePaymentAmounts': case 'PayCostQuestion': return 'pay'
    case 'ChooseAmounts': case 'ChooseExchangeAmounts': return 'amounts'
    case 'ChooseDeck': case 'ChooseJoinDeck': case 'ChooseUpgradeDeck': return 'deck'
    case 'ContinueCampaign': return 'campaign'
    case 'Read': return choices.length ? 'read' : null
  }
  if (!choices.length) return null
  if (payment) return 'pay'
  if (choices.some(choice => choice.tag === 'EndTurnButton')) return 'action'
  if (choices.some(choice => choice.tag === 'SkipTriggersButton')) return 'response'
  return 'choose'
}
