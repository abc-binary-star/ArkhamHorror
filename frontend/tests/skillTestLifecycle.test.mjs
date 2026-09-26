import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'
import { computed, effectScope, nextTick, reactive, ref, watch } from 'vue'

// Exercise the component's real timer/watch logic without a browser renderer.
const source = await readFile(new URL('../src/arkham/components/SkillTest.vue', import.meta.url), 'utf8')
const lifecycle = source.slice(source.indexOf('const processing = inject('), source.indexOf('const skillValue = computed('))
const { outputText } = ts.transpileModule(lifecycle, { compilerOptions: { target: ts.ScriptTarget.ES2022 } })
const create = new Function('props', 'computed', 'ref', 'watch', 'inject', 'onMounted', 'onBeforeUnmount',
  'processingKey', 'uiLockKey', 'phaseAnnouncementKey', 'spectateKey', 'isMinimizedSkillTestKey',
  'skillTestResults', 'choices', 'applyResultsAction', 'emit', 'ArkhamGame',
  `${outputText}\nreturn { minimized, resultsPaused, autoApplyPending, hideSpentTest, applyResults, pauseResults };`)

function setup(t) {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const question = () => ({ tag: 'ChooseOne', choices: [{ tag: 'SkillTestApplyResultsButton' }] })
  const props = reactive({
    playerId: 'p1', skillTest: { id: 'test1', step: 'DetermineSuccessOrFailureOfSkillTestStep' },
    game: { id: 'game1', scenarioSteps: 10, question: { p1: question() }, skillTestResults: { success: true } },
  })
  const processing = ref(false)
  const sent = []
  const choices = computed(() => props.game.question.p1?.choices ?? [])
  const scope = effectScope()
  const cleanup = []
  const state = scope.run(() => create(props, computed, ref, watch,
    (key, fallback) => key === 'processing' ? processing : fallback,
    () => {}, fn => cleanup.push(fn), 'processing', 'lock', 'phase', 'spectate', 'minimized',
    computed(() => props.game.skillTestResults), choices,
    computed(() => choices.value.findIndex(c => c.tag === 'SkillTestApplyResultsButton')),
    (_, index) => sent.push(index), { activeQuestionIsPlayerWindow: () => false }))
  t.after(() => { scope.stop(); t.mock.timers.reset() })
  return { props, state, processing, sent, question }
}

test('minimizing cancels auto settlement and restoring starts a fresh countdown', async t => {
  const f = setup(t)
  f.state.minimized.value = true
  await nextTick()
  t.mock.timers.tick(2000)
  assert.deepEqual(f.sent, [])
  f.state.minimized.value = false
  await nextTick()
  t.mock.timers.tick(1499)
  assert.deepEqual(f.sent, [])
  t.mock.timers.tick(1)
  assert.deepEqual(f.sent, [0])
})

test('failed optimistic submission stays manually retryable without an auto retry loop', async t => {
  const f = setup(t)
  t.mock.timers.tick(1500)
  f.processing.value = true
  f.props.game.question = {}
  await nextTick()
  f.props.game.question = { p1: f.question() }
  f.processing.value = false
  await nextTick()
  t.mock.timers.tick(5000)
  assert.deepEqual(f.sent, [0])
  f.state.applyResults()
  assert.deepEqual(f.sent, [0, 0])
})

test('a later server decision with the same result and button can auto settle', async t => {
  const f = setup(t)
  t.mock.timers.tick(1500)
  f.props.game.scenarioSteps++
  await nextTick()
  t.mock.timers.tick(1500)
  assert.deepEqual(f.sent, [0, 0])
})

test('empty result hides, new test resets its timer, and a real choice restores it', async t => {
  const f = setup(t)
  f.props.game.question = {}
  await nextTick()
  t.mock.timers.tick(1200)
  assert.equal(f.state.hideSpentTest.value, true)
  f.props.skillTest.id = 'test2'
  await nextTick()
  assert.equal(f.state.hideSpentTest.value, false)
  t.mock.timers.tick(1200)
  assert.equal(f.state.hideSpentTest.value, true)
  f.props.game.question = { p1: f.question() }
  await nextTick()
  assert.equal(f.state.hideSpentTest.value, false)
})
