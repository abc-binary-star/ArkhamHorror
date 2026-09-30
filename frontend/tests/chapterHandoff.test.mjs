import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'
const source = await readFile(new URL('../src/arkham/chapterHandoff.ts', import.meta.url), 'utf8')
const js = ts.transpileModule(source.replace(/^import type .*\n/gm, '').replaceAll('export function', 'function'), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
const { chapterXp, hasPendingUpgrade } = new Function(`${js}; return { chapterXp, hasPendingUpgrade }`)()
test('latest settlement counts victory and personal XP, excluding campaign tallies and other seats', () => {
  const breakdown = { investigators: ['a'], entries: [
    { tag: 'AllGainXp', details: { source: 'XpFromVictoryDisplay', amount: 3 } },
    { tag: 'InvestigatorGainXp', investigator: 'a', details: { amount: 2 } },
    { tag: 'InvestigatorLoseXp', investigator: 'a', details: { amount: 1 } },
    { tag: 'InvestigatorGainXp', investigator: 'b', details: { amount: 7 } },
    { tag: 'TallyGained', details: { amount: 20 } },
  ] }
  assert.equal(chapterXp('a', breakdown), 4)
  assert.equal(chapterXp('new-seat', breakdown), null)
  assert.equal(chapterXp('a', undefined), null)
})
test('pending upgrade uses real wrapped questions keyed by investigator or player', () => {
  const question = { tag: 'QuestionLabel', question: { tag: 'QuestionWithSource', question: { tag: 'ChooseUpgradeDeck' } } }
  assert.equal(hasPendingUpgrade({ a: question }, 'a', 'p'), true)
  assert.equal(hasPendingUpgrade({ p: question }, 'a', 'p'), true)
  assert.equal(hasPendingUpgrade({ other: question }, 'a', 'p'), false)
  assert.equal(hasPendingUpgrade({ p: { tag: 'ContinueCampaign' } }, 'a', 'p'), false)
})
