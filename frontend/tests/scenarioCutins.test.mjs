import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'
import { computed, effectScope, nextTick, ref } from 'vue'

const artwork = JSON.parse(await readFile(new URL('../src/arkham/data/scenarioCutins.json', import.meta.url), 'utf8'))
async function loadComposable(file, replace = source => source) {
  const source = replace(await readFile(new URL(`../src/arkham/composables/${file}.ts`, import.meta.url), 'utf8'))
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } })
  const moduleSource = outputText.replace("from 'vue'", `from '${import.meta.resolve('vue')}'`)
  return import(`data:text/javascript;base64,${Buffer.from(moduleSource).toString('base64')}`)
}
const { useScenarioCutins, SCENARIO_CUTIN_MS } = await loadComposable('useScenarioCutins', source => source.replace("import artwork from '@/arkham/data/scenarioCutins.json'", `const artwork = ${JSON.stringify(artwork)}`))
const { usePhaseAnnouncement } = await loadComposable('usePhaseAnnouncement')
const card = (code, side = 'A') => ({ id: `c${code}`, deckId: 1, sequence: { side }, flipped: side === 'B' })
const state = (acts = ['12109'], agendas = ['12106'], overrides = {}) => ({
  id: 'game-1', scenario: { id: 'c12105' }, inSetup: false, scenarioSteps: 1,
  phase: 'InvestigationPhase',
  acts: Object.fromEntries(acts.map(code => [code, card(code)])),
  agendas: Object.fromEntries(agendas.map(code => [code, card(code)])), ...overrides,
})
function setup(t, initial = state()) {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const game = ref(initial)
  const enabled = ref(true)
  const blocked = ref(false)
  const scope = effectScope()
  const cutins = scope.run(() => useScenarioCutins(() => game.value, () => enabled.value, blocked))
  t.after(() => scope.stop())
  return { game, enabled, blocked, scope, cutins }
}

test('initial hydration and unchanged snapshots do not replay existing cards', t => {
  const { game, cutins } = setup(t, null)
  game.value = state()
  game.value = state([], [], { scenario: { id: 'c13001' }, scenarioSteps: 2 })
  assert.equal(cutins.active.value, false)
})

test('setup completion presents starting agenda then act', t => {
  const { game, cutins } = setup(t, state(['12109'], ['12106'], { inSetup: true }))
  game.value = state()
  assert.equal(cutins.current.value.code, '12106')
  cutins.skip()
  assert.equal(cutins.current.value.code, '12109')
  cutins.skip()
  assert.equal(cutins.active.value, false)
})

test('new A faces queue once; B flips and unchanged doom do not trigger entrances', t => {
  const { game, cutins } = setup(t)
  game.value = state(['12109'], ['12106'], { acts: { a: card('12109', 'B') } })
  assert.equal(cutins.active.value, false)
  game.value = state(['12110'], ['12107'], { scenarioSteps: 2 })
  assert.equal(cutins.current.value.code, '12107')
  game.value = state(['12110'], ['12107'], { scenarioSteps: 3 })
  cutins.skip()
  assert.equal(cutins.current.value.code, '12110')
  cutins.skip()
  assert.equal(cutins.active.value, false)
})

test('a revelation stays dismissible while card entrances wait behind it', t => {
  const { game, blocked, cutins } = setup(t)
  blocked.value = true
  game.value = state(['12110'])
  assert.equal(cutins.active.value, false)
  blocked.value = false
  assert.equal(cutins.current.value.code, '12110')
})

test('display time begins at image load and failed or stalled images release the queue', t => {
  const { game, cutins } = setup(t)
  game.value = state(['12110'], ['12107'])
  t.mock.timers.tick(4000)
  assert.equal(cutins.current.value.code, '12107')
  cutins.imageReady()
  t.mock.timers.tick(SCENARIO_CUTIN_MS)
  assert.equal(cutins.current.value.code, '12110')
  cutins.imageFailed()
  assert.equal(cutins.active.value, false)
  game.value = state(['12111'], ['12107'])
  t.mock.timers.tick(SCENARIO_CUTIN_MS + 5000)
  assert.equal(cutins.active.value, false)
})

test('disabling animations consumes snapshots without replay on re-enable', t => {
  const { game, enabled, cutins } = setup(t)
  game.value = state(['12110'])
  enabled.value = false
  assert.equal(cutins.active.value, false)
  game.value = state(['12111'])
  enabled.value = true
  game.value = state(['12111'])
  assert.equal(cutins.active.value, false)
})

test('undo and game changes discard pending entrances', t => {
  const { game, cutins } = setup(t, state(['12111'], ['12107'], { scenarioSteps: 10 }))
  game.value = state(['12112'], ['12108'], { scenarioSteps: 11 })
  game.value = state(['12111'], ['12107'], { scenarioSteps: 10 })
  assert.equal(cutins.active.value, false)
  game.value = state(['12112'], ['12108'], { id: 'game-2', scenarioSteps: 11 })
  assert.equal(cutins.active.value, false)
})

test('a new scenario can introduce cards even when its step counter restarts', t => {
  const { game, cutins } = setup(t, state(['12112'], ['12108'], { scenarioSteps: 40 }))
  game.value = state(['12136'], ['12134'], { scenario: { id: 'c12133' }, scenarioSteps: 1 })
  assert.equal(cutins.current.value.code, '12134')
  cutins.skip()
  assert.equal(cutins.current.value.code, '12136')
})

test('the shared final act/agenda gets one illustration', t => {
  const { game, cutins } = setup(t, state(['12173'], ['12170'], { scenario: { id: 'c12168' } }))
  game.value = state(['12171'], ['12171'], { scenario: { id: 'c12168' }, scenarioSteps: 2 })
  assert.equal(cutins.current.value.code, '12171')
  cutins.skip()
  assert.equal(cutins.active.value, false)
})

test('phase banners wait for the card cutin and resume after it', async t => {
  const { game, blocked, scope, cutins } = setup(t)
  const phases = scope.run(() => usePhaseAnnouncement(() => game.value?.phase, computed(() => blocked.value || cutins.active.value)))
  game.value = state(['12110'], ['12106'], { phase: 'EnemyPhase' })
  assert.equal(cutins.current.value.code, '12110')
  assert.equal(phases.current.value, null)
  cutins.skip()
  await nextTick()
  assert.equal(phases.current.value, 'EnemyPhase')
})

test('all 15 backend act and agenda definitions have unique scenario artwork', async () => {
  const codes = new Set()
  for (const kind of ['Act', 'Agenda']) {
    for (const scenario of ['SpreadingFlames', 'SmokeAndMirrors', 'QueenOfAsh']) {
      const source = await readFile(new URL(`../../backend/arkham-api/library/Arkham/${kind}/CardDefs/BrethrenOfAsh/${scenario}.hs`, import.meta.url), 'utf8')
      for (const match of source.matchAll(/(?:act|agenda) "(\d+)"/g)) codes.add(match[1])
    }
  }
  assert.equal(artwork.length, 15)
  assert.deepEqual(new Set(artwork.map(a => a.code)), codes)
  assert.equal(new Set(artwork.map(a => a.image)).size, 15)
  for (const art of artwork) {
    const bytes = await readFile(new URL(`../public${art.image}`, import.meta.url))
    assert.equal(bytes.subarray(0, 2).toString('hex'), 'ffd8', art.code)
  }
})
