import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'
import { computed } from 'vue'
const source = await readFile(new URL('../src/arkham/components/SkillTestBreakdown.vue', import.meta.url), 'utf8')
const script = source.split('<script setup lang="ts">')[1].split('</script>')[0]
const js = ts.transpileModule(script.replace(/^import .*\n/gm, ''), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
const create = new Function('computed', 'defineProps', 'defineEmits', 'useI18n', `${js}; return { total, rawTotal, inspect };`)
function setup(values = {}) {
  const events = []
  const results = { skillTestResultsSkillValue: 3, skillTestResultsIconValue: 2,
    skillTestResultsChaosTokensValue: -1, skillTestResultsDifficulty: 3,
    skillTestResultsResultModifiers: 2, skillTestResultsSuccess: true, ...values }
  const state = create(computed, () => ({ results }), () => name => events.push(name), () => ({ t() {} }))
  return { state, events, results }
}

test('result margin modifiers are not added to the skill value', () => {
  const { state } = setup()
  assert.equal(state.total.value, 4)
})

test('negative sums are floored at zero without changing the server outcome', () => {
  const { state, results } = setup({ skillTestResultsChaosTokensValue: -9, skillTestResultsSuccess: false })
  assert.equal(state.rawTotal.value, -4)
  assert.equal(state.total.value, 0)
  assert.equal(results.skillTestResultsSuccess, false)
})

test('opening details requests a pause immediately, closing never resumes automatically', () => {
  const { state, events } = setup()
  state.inspect({ currentTarget: { parentElement: { open: false } } })
  state.inspect({ currentTarget: { parentElement: { open: true } } })
  assert.deepEqual(events, ['inspect'])
})
