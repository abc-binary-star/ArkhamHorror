import { choices, type Game } from '@/arkham/types/Game'

// Only ordinary, skippable fast-ability windows before the token draw belong
// in the test panel. Reactions, forced effects and mixed prompts stay modal.
export function isInlineSkillTestFastWindow(game: Game, playerId: string): boolean {
  const test = game.skillTest
  if (!test || game.investigators[test.investigator]?.playerId !== playerId) return false
  if (!['SkillTestFastWindow1', 'SkillTestFastWindow2'].includes(test.step)) return false
  let question = game.question[playerId]
  while (question?.question) question = question.question
  if (question?.tag !== 'ChooseOne' || !question.isWindow) return false
  const entries = choices(game, playerId)
  // Multiple card sources belong together in the response collection dialog.
  // Keep a single card's repeatable boosts inline during the test.
  const sources = new Set(entries.flatMap(entry => entry.tag === 'AbilityLabel'
    ? [JSON.stringify(entry.ability.source)] : []))
  if (sources.size > 1) return false
  return entries.some(entry => entry.tag === 'SkipTriggersButton')
    && entries.some(entry => entry.tag === 'AbilityLabel')
    && entries.every(entry => entry.tag === 'SkipTriggersButton'
      || (entry.tag === 'AbilityLabel'
        && entry.ability.type.tag === 'FastAbility'
        && entry.windows.length > 0
        && entry.windows.every(window => window.windowType.tag === 'FastPlayerWindow')))
}
