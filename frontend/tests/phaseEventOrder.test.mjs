import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'
import { effectScope, nextTick, ref } from 'vue'

async function loadModule(file) {
  const source = await readFile(new URL(file, import.meta.url), 'utf8')
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
  })
  const code = outputText.replace("from 'vue'", `from '${import.meta.resolve('vue')}'`)
  return import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
}
const { orderedGameEvents } = await loadModule('../src/arkham/composables/orderedGameEvents.ts')
const { usePhaseAnnouncement, PHASE_ANNOUNCEMENT_MS } = await loadModule('../src/arkham/composables/usePhaseAnnouncement.ts')

function setup(t) {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const board = ref({ phase: 'InvestigationPhase', cards: 5, resources: 3 })
  const reveal = ref(false)
  const scope = effectScope()
  const banner = scope.run(() => usePhaseAnnouncement(() => board.value.phase, reveal))
  t.after(() => scope.stop())
  const events = orderedGameEvents(
    () => banner.active.value || reveal.value,
    async event => {
      if (event.tag === 'phase') banner.push(event.phase)
      if (event.tag === 'reveal') reveal.value = true
      if (event.tag === 'snapshot') { board.value = event.board; await nextTick() }
    },
    error => { throw error },
  )
  const flush = async () => { for (let i = 0; i < 25; i++) await nextTick() }
  const finishBanner = async () => {
    await flush()
    t.mock.timers.tick(PHASE_ANNOUNCEMENT_MS)
    await events.drain()
    await flush()
  }
  return { board, reveal, banner, events, flush, finishBanner }
}
const phase = phase => ({ tag: 'phase', phase })
const snapshot = (phase, cards, resources) => ({ tag: 'snapshot', board: { phase, cards, resources } })

test('upkeep gains cannot appear under the enemy banner when the whole round arrives at once', async t => {
  const f = setup(t)
  for (const event of [
    phase('EnemyPhase'), snapshot('EnemyPhase', 5, 3),
    snapshot('EnemyPhase', 5, 3), phase('UpkeepPhase'),
    snapshot('UpkeepPhase', 5, 3), snapshot('UpkeepPhase', 6, 4),
    phase('MythosPhase'), snapshot('MythosPhase', 6, 4),
  ]) f.events.push(event)
  await f.flush()
  assert.equal(f.banner.current.value, 'EnemyPhase')
  assert.equal(f.board.value.cards, 5)
  assert.equal(f.board.value.resources, 3)
  await f.finishBanner()
  assert.equal(f.banner.current.value, 'UpkeepPhase')
  assert.equal(f.board.value.cards, 5)
  assert.equal(f.board.value.resources, 3)
  await f.finishBanner()
  assert.equal(f.banner.current.value, 'MythosPhase')
  assert.deepEqual(f.board.value, { phase: 'UpkeepPhase', cards: 6, resources: 4 })
  await f.finishBanner()
  assert.equal(f.board.value.phase, 'MythosPhase')
  assert.equal(f.banner.active.value, false)
})

test('an upkeep weakness reveal finishes before the next phase and its snapshots', async t => {
  const f = setup(t)
  for (const event of [
    phase('UpkeepPhase'), snapshot('UpkeepPhase', 5, 3),
    { tag: 'reveal' }, snapshot('UpkeepPhase', 6, 4),
    phase('MythosPhase'), snapshot('MythosPhase', 6, 4),
  ]) f.events.push(event)
  await f.finishBanner()
  assert.equal(f.reveal.value, true)
  assert.equal(f.banner.current.value, null)
  assert.equal(f.board.value.phase, 'UpkeepPhase')
  assert.equal(f.board.value.resources, 3)
  f.reveal.value = false
  await f.events.drain()
  assert.equal(f.banner.current.value, 'MythosPhase')
  assert.equal(f.board.value.resources, 4)
  await f.finishBanner()
  assert.equal(f.board.value.phase, 'MythosPhase')
})

test('a slow decode cannot be overtaken or drop snapshots across a phase boundary', async () => {
  const seen = []
  let release
  const gate = new Promise(resolve => { release = resolve })
  const events = orderedGameEvents(() => false, async event => {
    if (event === 'enemy-end') await gate
    seen.push(event)
  }, error => { throw error })
  for (const event of ['enemy-end', 'upkeep-begin', 'upkeep-end', 'mythos-begin']) events.push(event)
  await Promise.resolve()
  assert.deepEqual(seen, [])
  release()
  for (let i = 0; i < 12; i++) await Promise.resolve()
  assert.deepEqual(seen, ['enemy-end', 'upkeep-begin', 'upkeep-end', 'mythos-begin'])
})

test('clearing queued events prevents pending phases from replaying after undo', async () => {
  let blocked = true
  const seen = []
  const events = orderedGameEvents(() => blocked, async event => { seen.push(event) }, assert.fail)
  events.push('old-phase')
  events.clear()
  blocked = false
  events.push('restored-state')
  await events.drain()
  assert.deepEqual(seen, ['restored-state'])
})

test('undo invalidates a snapshot that was already decoding', async () => {
  const seen = []
  let release
  const gate = new Promise(resolve => { release = resolve })
  const events = orderedGameEvents(() => false, async (event, isCurrent) => {
    if (event === 'old-snapshot') await gate
    if (isCurrent()) seen.push(event)
  }, assert.fail)
  events.push('old-snapshot')
  events.clear()
  events.push('restored-state')
  release()
  for (let i = 0; i < 12; i++) await Promise.resolve()
  assert.deepEqual(seen, ['restored-state'])
})
