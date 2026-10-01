import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'
import { effectScope, ref } from 'vue'

const artwork = JSON.parse(await readFile(new URL('../src/arkham/data/scenarioCutins.json', import.meta.url), 'utf8'))
const enemies = JSON.parse(await readFile(new URL('../src/arkham/data/enemyEntrances.json', import.meta.url), 'utf8'))
const source = (await readFile(new URL('../src/arkham/composables/useScenarioCutins.ts', import.meta.url), 'utf8'))
  .replace("import artwork from '@/arkham/data/scenarioCutins.json'", `const artwork = ${JSON.stringify(artwork)}`)
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } })
const { useScenarioCutins, ENEMY_ENTRANCE_MS } = await import(`data:text/javascript;base64,${Buffer.from(outputText.replace("from 'vue'", `from '${import.meta.resolve('vue')}'`)).toString('base64')}`)
const enemy = (code = '12114', id = 'enemy-1', placement = 'AtLocation', flipped = false) => ({
  id, cardCode: `c${code}`, placement: { tag: placement, contents: 'location-1' }, flipped,
})
const state = (monsters = [], overrides = {}) => ({
  id: 'game-1', scenario: { id: 'c12105' }, inSetup: false, scenarioSteps: 1,
  acts: {}, agendas: {}, enemies: Object.fromEntries(monsters.map(e => [e.id, e])), ...overrides,
})
function setup(t, initial = state()) {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const game = ref(initial)
  const enabled = ref(true)
  const blocked = ref(false)
  const scope = effectScope()
  const cutins = scope.run(() => useScenarioCutins(() => game.value, () => enabled.value, blocked, enemies))
  t.after(() => scope.stop())
  return { game, enabled, blocked, cutins }
}

test('loaded enemies establish a baseline; setup completion presents visible starting elites', t => {
  const { game, cutins } = setup(t, null)
  game.value = state([enemy()])
  assert.equal(cutins.active.value, false)
  game.value = state([enemy()], { inSetup: true })
  game.value = state([enemy()])
  assert.equal(cutins.current.value.code, '12114')
  assert.equal(cutins.current.value.kind, 'enemy')
})

test('movement, exhaustion and damage never replay an entrance', t => {
  const { game, cutins } = setup(t)
  game.value = state([enemy()])
  cutins.skip()
  game.value = state([{ ...enemy('12114', 'enemy-1', 'InThreatArea'), exhausted: true, tokens: { damage: 3 } }], { scenarioSteps: 2 })
  assert.equal(cutins.active.value, false)
  game.value = state([enemy('12114', 'enemy-2')], { scenarioSteps: 3 })
  assert.equal(cutins.current.value.instance, 'enemy-2:12114')
})

test('set-aside, concealed and facedown identities stay hidden until publicly spawned', t => {
  const { game, cutins } = setup(t)
  for (const placement of ['OutOfPlay', 'Limbo', 'InTheShadows', 'FacedownInThreatArea', 'HiddenInHand', 'AsSwarm']) {
    game.value = state([enemy('12114', 'enemy-1', placement)])
    assert.equal(cutins.active.value, false, placement)
  }
  game.value = state([enemy()])
  assert.equal(cutins.current.value.code, '12114')
})

test('ordinary enemies and enemies from other scenarios get no substitute illustration', t => {
  const { game, cutins } = setup(t)
  game.value = state([enemy('12132')])
  assert.equal(cutins.active.value, false)
  game.value = state([enemy('12114')], { scenario: { id: 'c01104' } })
  assert.equal(cutins.active.value, false)
})

test('boss transformation handles a changed code or a flipped original code', t => {
  const { game, cutins } = setup(t, state([], { scenario: { id: 'c12168' } }))
  game.value = state([enemy('12179')], { scenario: { id: 'c12168' } })
  assert.equal(cutins.current.value.tone, 'ash')
  cutins.skip()
  game.value = state([enemy('12179', 'enemy-1', 'AtLocation', true)], { scenario: { id: 'c12168' }, scenarioSteps: 2 })
  assert.equal(cutins.current.value.code, '12179b')
  assert.equal(cutins.current.value.tone, 'flame')
  cutins.skip()
  game.value = state([enemy('12179b')], { scenario: { id: 'c12168' }, scenarioSteps: 3 })
  assert.equal(cutins.active.value, false)
  game.value = state([enemy('12179')], { scenario: { id: 'c12168' }, scenarioSteps: 4 })
  cutins.skip()
  game.value = state([enemy('12179b')], { scenario: { id: 'c12168' }, scenarioSteps: 5 })
  assert.equal(cutins.current.value.code, '12179b')
})

test('agenda, act and enemy entrances share one serial queue', t => {
  const { game, cutins } = setup(t)
  game.value = state([enemy()], {
    agendas: { a: { id: 'c12106', deckId: 1, sequence: { side: 'A' }, flipped: false } },
    acts: { a: { id: 'c12109', deckId: 1, sequence: { side: 'A' } } },
  })
  assert.equal(cutins.current.value.kind, 'agenda')
  cutins.skip()
  assert.equal(cutins.current.value.kind, 'act')
  cutins.skip()
  assert.equal(cutins.current.value.kind, 'enemy')
  cutins.imageReady()
  t.mock.timers.tick(ENEMY_ENTRANCE_MS - 1)
  assert.equal(cutins.active.value, true)
  t.mock.timers.tick(1)
  assert.equal(cutins.active.value, false)
})

test('revelation remains usable while an enemy entrance waits behind it', t => {
  const { game, blocked, cutins } = setup(t)
  blocked.value = true
  game.value = state([enemy()])
  assert.equal(cutins.active.value, false)
  blocked.value = false
  assert.equal(cutins.current.value.kind, 'enemy')
})

test('disabled animations and undo consume snapshots without replay', t => {
  const { game, enabled, cutins } = setup(t)
  enabled.value = false
  game.value = state([enemy()], { scenarioSteps: 4 })
  enabled.value = true
  game.value = state([enemy()], { scenarioSteps: 5 })
  assert.equal(cutins.active.value, false)
  game.value = state([enemy('12114', 'enemy-2')], { scenarioSteps: 6 })
  assert.equal(cutins.active.value, true)
  game.value = state([enemy()], { scenarioSteps: 4 })
  assert.equal(cutins.active.value, false)
})

test('failed and stalled portraits release the game input barrier', t => {
  const { game, cutins } = setup(t, state([], { scenario: { id: 'c12168' } }))
  game.value = state([enemy('12177'), enemy('12178', 'enemy-2')], { scenario: { id: 'c12168' } })
  cutins.imageFailed()
  assert.equal(cutins.current.value.code, '12178')
  t.mock.timers.tick(ENEMY_ENTRANCE_MS + 5000)
  assert.equal(cutins.active.value, false)
})

test('new scenario setup resets its step counter without losing starting enemy entrances', t => {
  const { game, cutins } = setup(t, state([], { scenarioSteps: 80 }))
  game.value = state([enemy('12138')], { scenario: { id: 'c12133' }, scenarioSteps: 1 })
  assert.equal(cutins.current.value.code, '12138')
})

test('every elite definition across the three scenarios has newly generated runtime art', async () => {
  const eliteCodes = new Set()
  for (const scenario of ['SpreadingFlames', 'SmokeAndMirrors', 'QueenOfAsh']) {
    const definitions = await readFile(new URL(`../../backend/arkham-api/library/Arkham/Enemy/CardDefs/BrethrenOfAsh/${scenario}.hs`, import.meta.url), 'utf8')
    for (const definition of definitions.split(/\n\w+ :: CardDef/)) {
      if (!/cdCardTraits[^\n]*\bElite\b/.test(definition)) continue
      const code = definition.match(/enemy "([^"]+)"/)?.[1]
      assert.ok(code)
      eliteCodes.add(code)
    }
  }
  assert.equal(eliteCodes.size, 11)
  for (const code of eliteCodes) assert.ok(enemies.some(a => a.code === code), code)
  assert.equal(enemies.length, 13)
  assert.equal(new Set(enemies.map(a => `${a.scenario}:${a.code}`)).size, 13)
  assert.equal(new Set(enemies.map(a => a.image)).size, 10)
  for (const image of new Set(enemies.map(a => a.image))) {
    const bytes = await readFile(new URL(`../public${image}`, import.meta.url))
    assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', image)
    assert.equal(bytes[25], 6, `${image} must preserve RGBA`)
  }
})
