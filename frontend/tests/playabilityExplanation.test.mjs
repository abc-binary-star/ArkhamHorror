import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'
const source = await readFile(new URL('../src/arkham/playabilityExplanation.ts', import.meta.url), 'utf8')
const js = ts.transpileModule(source.replaceAll('export function', 'function'), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
const explain = new Function(`${js}; return playabilityExplanation`)()
test('only failed checks become player-facing reasons', () => {
  assert.deepEqual(explain([['Play window', null], ['Limits', 'limit reached']]), [{ key: 'limit', values: {} }])
})
test('resource amounts come from server diagnosis, including alternative payment resources', () => {
  assert.deepEqual(explain([['Resource cost', 'Need 5 resources, have 3']]), [{ key: 'resources', values: { need: 5, have: 3 } }])
})
test('additional costs are not incorrectly described as missing actions', () => {
  assert.equal(explain([['Action cost', 'Cannot afford action cost (0 action(s) required)']])[0].key, 'actionCost')
})
test('unrecognized special contexts degrade without leaking raw engine syntax', () => {
  assert.deepEqual(explain([['Alternate play context', 'No valid alternate play context']]), [{ key: 'unknown', values: {} }])
})

const { isPlayabilityWindow, playabilityResponseIsCurrent } = new Function(`${js}; return { isPlayabilityWindow, playabilityResponseIsCurrent }`)()
test('normalized response and player windows are accepted through source wrappers', () => {
  assert.equal(isPlayabilityWindow({ tag: 'ChooseOne', isWindow: true }), true)
  assert.equal(isPlayabilityWindow({ tag: 'QuestionWithSource', question: { tag: 'ChooseOne', isPlayerWindow: true } }), true)
  assert.equal(isPlayabilityWindow({ tag: 'ChooseOne' }), false)
  assert.equal(isPlayabilityWindow({ tag: 'Read' }), false)
  assert.equal(isPlayabilityWindow(undefined), false)
})
test('diagnostic results for a different card or server step are discarded', () => {
  assert.equal(playabilityResponseIsCurrent({ cardId: 'a', scenarioSteps: 10 }, 'a', 10), true)
  assert.equal(playabilityResponseIsCurrent({ cardId: 'a', scenarioSteps: 11 }, 'a', 10), false)
  assert.equal(playabilityResponseIsCurrent({ cardId: 'b', scenarioSteps: 10 }, 'a', 10), false)
  assert.equal(playabilityResponseIsCurrent({ cardId: 'a' }, 'a', 10), true)
})
