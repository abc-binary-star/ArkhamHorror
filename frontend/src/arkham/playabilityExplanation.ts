export function playabilityExplanation(checks: [string, string | null][]) {
  return checks.flatMap(([name, detail]) => {
    if (detail === null) return []
    const resources = name === 'Resource cost' && /^Need (\d+) resources, have (\d+)$/.exec(detail)
    if (resources) return [{ key: 'resources', values: { need: Number(resources[1]), have: Number(resources[2]) } }]
    const keys: Record<string, string> = {
      'Card type': 'type', 'Uniqueness': 'unique', 'Play restrictions': 'restricted',
      'Resource cost': 'cost', 'Criteria': 'criteria', 'Play window': 'window',
      'Limits': 'limit', 'Slots': 'slots', 'Fight or Evade': 'fightEvade',
      'Evade actions': 'evade', 'Fight actions': 'fight', 'Investigate': 'investigate',
      'Action cost': 'actionCost',
    }
    return [{ key: keys[name] ?? 'unknown', values: {} }]
  })
}

// The decoder normalizes both window constructors to ChooseOne and keeps flags.
export function isPlayabilityWindow(question: { tag: string; question?: unknown; isWindow?: boolean; isPlayerWindow?: boolean } | undefined): boolean {
  if (!question) return false
  if (question.question) return isPlayabilityWindow(question.question as Parameters<typeof isPlayabilityWindow>[0])
  return question.tag === 'ChooseOne' && (question.isWindow === true || question.isPlayerWindow === true)
}

export function playabilityResponseIsCurrent(result: { cardId: string; scenarioSteps?: number }, cardId: string, step: number): boolean {
  return result.cardId === cardId && (result.scenarioSteps === undefined || result.scenarioSteps === step)
}
