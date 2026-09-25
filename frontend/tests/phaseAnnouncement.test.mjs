import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'
import { effectScope, nextTick, ref } from 'vue'

const source = await readFile(new URL('../src/arkham/composables/usePhaseAnnouncement.ts', import.meta.url), 'utf8')
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
})
const moduleSource = outputText.replace("from 'vue'", `from '${import.meta.resolve('vue')}'`)
const { usePhaseAnnouncement, PHASE_ANNOUNCEMENT_MS } = await import(
  `data:text/javascript;base64,${Buffer.from(moduleSource).toString('base64')}`
)

function setup(t) {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const phase = ref('InvestigationPhase')
  const revelation = ref(false)
  const scope = effectScope()
  const announcement = scope.run(() => usePhaseAnnouncement(() => phase.value, revelation))
  t.after(() => scope.stop())
  const finish = async () => {
    await nextTick()
    t.mock.timers.tick(PHASE_ANNOUNCEMENT_MS)
    await nextTick()
  }
  return { phase, revelation, announcement, finish }
}

test('round broadcasts precede the final mythos snapshot without duplicate banners', async t => {
  const { phase, announcement, finish } = setup(t)
  for (const next of ['EnemyPhase', 'UpkeepPhase', 'MythosPhase']) announcement.push(next)
  phase.value = 'MythosPhase'
  for (const expected of ['EnemyPhase', 'UpkeepPhase', 'MythosPhase']) {
    assert.equal(announcement.current.value, expected)
    assert.equal(announcement.active.value, true)
    await finish()
  }
  assert.equal(announcement.active.value, false)
  announcement.push('MythosPhase')
  assert.equal(announcement.active.value, false)
})

test('phases queued during a reveal resume in order without duplicating the snapshot', async t => {
  const { phase, revelation, announcement, finish } = setup(t)
  revelation.value = true
  for (const next of ['EnemyPhase', 'UpkeepPhase', 'MythosPhase']) announcement.push(next)
  phase.value = 'MythosPhase'
  assert.equal(announcement.active.value, false)
  revelation.value = false
  for (const expected of ['EnemyPhase', 'UpkeepPhase', 'MythosPhase']) {
    assert.equal(announcement.current.value, expected)
    await finish()
  }
  assert.equal(announcement.active.value, false)
})

test('snapshot fallback and later rounds still announce each new transition', async t => {
  const { phase, announcement, finish } = setup(t)
  assert.equal(announcement.active.value, false)
  phase.value = 'EnemyPhase'
  announcement.push('EnemyPhase')
  await finish()
  assert.equal(announcement.active.value, false)
  for (const next of ['UpkeepPhase', 'MythosPhase', 'InvestigationPhase', 'EnemyPhase']) {
    announcement.push(next)
    phase.value = next
    assert.equal(announcement.current.value, next)
    await finish()
    assert.equal(announcement.active.value, false)
  }
})
