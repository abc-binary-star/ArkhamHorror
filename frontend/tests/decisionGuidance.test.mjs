import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'
const source = await readFile(new URL('../src/arkham/decisionGuidance.ts', import.meta.url), 'utf8')
const js = ts.transpileModule(source.replace(/^import type .*\n/gm, '').replace('export function', 'function'), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
const classify = new Function(`${js}; return decisionGuidance`)()
const choice = tag => ({ tag })

test('empty story placeholders and absent questions are not pending work', () => {
  assert.equal(classify(undefined, []), null)
  assert.equal(classify({ tag: 'Read' }, []), null)
  assert.equal(classify({ tag: 'ChooseOne' }, []), null)
})

test('structured questions without button choices remain visible through wrappers', () => {
  assert.equal(classify({ tag: 'QuestionWithSource', question: { tag: 'QuestionLabel', question: { tag: 'ChooseAmounts' } } }, []), 'amounts')
  assert.equal(classify({ tag: 'ChoosePaymentAmounts' }, []), 'pay')
  assert.equal(classify({ tag: 'ContinueCampaign' }, []), 'campaign')
})

test('action windows and optional responses are distinct; generic questions stay generic', () => {
  const question = { tag: 'ChooseOne' }
  assert.equal(classify(question, [choice('EndTurnButton'), choice('SkipTriggersButton')]), 'action')
  assert.equal(classify(question, [choice('SkipTriggersButton')]), 'response')
  assert.equal(classify(question, [choice('Label')]), 'choose')
})

test('explicit test controls and damage targets determine guidance, not turn ownership', () => {
  const question = { tag: 'ChooseOne' }
  assert.equal(classify(question, [choice('SkillTestApplyResultsButton')]), 'resolve')
  assert.equal(classify(question, [choice('StartSkillTestButton')]), 'reveal')
  assert.equal(classify(question, [{ tag: 'ComponentLabel', component: { tokenType: 'HorrorToken' } }]), 'assign')
  assert.equal(classify(question, [{ tag: 'ComponentLabel', component: { tokenType: 'ResourceToken' } }]), 'choose')
})
