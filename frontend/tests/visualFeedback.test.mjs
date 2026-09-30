import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'
const read = path => readFile(new URL(path, import.meta.url), 'utf8')
const transpile = source => ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText
const exports = {}
new Function('exports', transpile(await read('../src/arkham/visualFeedback.ts')))(exports)
const { VisualFeedbackQueue, feedbackPoint, arrangeReceipts } = exports
const snapshot = (step = 1) => ({
  id: 'game', scenarioSteps: step, scenario: { id: 'scenario' },
  investigators: { a: { tokens: { Resource: 5 }, remainingActions: 3, endedTurn: false }, b: { tokens: {}, remainingActions: 3, endedTurn: false } },
  locations: { room: { tokens: { Clue: 2 } } }, assets: {}, enemies: {},
})
function prime(state) { const queue = new VisualFeedbackQueue(); assert.deepEqual(queue.consume(null, state), []); return queue }

test('initial load, reconnect, undo and changed scenario rebuild silently', () => {
  const a = snapshot(10), b = snapshot(11)
  b.investigators.a.tokens.Resource = 9
  const queue = prime(a)
  queue.reset()
  assert.deepEqual(queue.consume(a, b), [])
  assert.deepEqual(queue.consume(b, a), [])
  b.scenario.id = 'next'
  assert.deepEqual(queue.consume(a, b), [])
  b.id = 'other-game'
  assert.deepEqual(queue.consume(a, b), [])
})

test('batch retains exact multi-investigator identity and damage/horror signs', () => {
  const a = snapshot(), b = snapshot(2)
  b.investigators.a.tokens = { Resource: 3, Damage: 2, Horror: 1 }
  b.investigators.b.tokens.Clue = 2
  b.locations.room.tokens.Clue = 0
  const events = prime(a).consume(a, b)
  assert.deepEqual(events.map(e => [e.key, e.delta]), [
    ['investigators:a:Resource', -2], ['investigators:a:Damage', 2], ['investigators:a:Horror', 1],
    ['investigators:b:Clue', 2], ['locations:room:Clue', -2],
  ])
  assert.equal(new Set(events.map(e => e.id)).size, events.length)
  assert.ok(events.every(e => e.origin === 'state-diff'))
})

test('duplicate applied snapshots emit nothing; legitimate reversals at the same step survive', () => {
  const a = snapshot(), b = snapshot()
  b.investigators.a.tokens.Resource = 6
  const queue = prime(a)
  const first = queue.consume(a, b)
  assert.equal(first.length, 1)
  assert.deepEqual(queue.consume(b, structuredClone(b)), [])
  assert.equal(queue.consume(b, a)[0].delta, -1)
  assert.notEqual(queue.consume(a, b)[0].id, first[0].id)
})

test('zero transitions work; new and removed entities do not invent gains/losses', () => {
  const a = snapshot(), b = snapshot(2)
  b.investigators.b.tokens.Horror = 2
  b.assets.new = { tokens: { Resource: 6 } }
  delete b.locations.room
  assert.deepEqual(prime(a).consume(a, b).map(e => [e.key, e.delta]), [['investigators:b:Horror', 2]])
  const c = structuredClone(b)
  delete c.investigators.b.tokens.Horror
  assert.equal(prime(b).consume(b, c)[0].delta, -2)
})

test('spent standard actions keep their original slots; end-turn clearing is silent', () => {
  const a = snapshot(), b = snapshot(2)
  b.investigators.a.remainingActions = 1
  assert.deepEqual(prime(a).consume(a, b).map(e => e.key), ['investigators:a:Action:2', 'investigators:a:Action:3'])
  b.investigators.a.endedTurn = true
  assert.deepEqual(prime(a).consume(a, b), [])
})

test('viewport coordinates already contain scale/scroll; nearby receipts do not overlap', () => {
  // Original (100, 200, 40, 40), scale 1.5, viewport scroll (30, 90).
  assert.deepEqual(feedbackPoint({ left: 120, top: 210, width: 60, height: 60 }), { x: 150, y: 240 })
  const items = arrangeReceipts([0, 1, 2, 3].map(() => ({ x: 10, y: 10, height: 24, delta: 1 })), 360, 720)
  assert.ok(items.length > 0 && items.length <= 4)
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      assert.equal(exports.overlaps(
        { left: items[i].x - 58, top: items[i].y - 13, width: 116, height: 26 },
        { left: items[j].x - 58, top: items[j].y - 13, width: 116, height: 26 },
      ), false)
    }
  }
  assert.ok(items.every(i => i.x >= 60 && i.y >= 36 && i.y < 720))
})

const composable = (await read('../src/arkham/composables/useVisualFeedback.ts')).replace(/^import .*$/gm, '')
function harness({ offscreen = false } = {}) {
  const result = {}
  const cleanup = []
  const target = { getBoundingClientRect: () => ({ left: offscreen ? 2000 : 100, top: 200, width: 30, height: 30, right: offscreen ? 2030 : 130, bottom: 230 }), getClientRects: () => [1], parentElement: null }
  const document = { querySelectorAll: () => [target] }
  new Function('exports', 'VisualFeedbackQueue', 'feedbackPoint', 'inject', 'provide', 'shallowRef', 'nextTick', 'onBeforeUnmount', 'onMounted', 'document', 'CSS', 'innerWidth', 'innerHeight', 'getComputedStyle', 'window', transpile(composable))(
    result, VisualFeedbackQueue, feedbackPoint, () => null, () => {}, value => ({ value }), () => Promise.resolve(), fn => cleanup.push(fn), () => {}, document, { escape: s => s }, 1000, 1000,
    () => ({ visibility: 'visible', display: 'block', opacity: '1', overflowX: 'visible', overflowY: 'visible' }), { removeEventListener() {} },
  )
  return { api: result.provideVisualFeedback(), close: () => cleanup.forEach(fn => fn()) }
}

test('reset cancels an already prepared batch before DOM flush; focus stays silent', async () => {
  const { api, close } = harness()
  try {
    const a = snapshot(), b = snapshot(2)
    b.investigators.a.tokens.Resource++
    api.baseline(a)
    const present = api.prepare(a, b)
    api.reset()
    await present()
    await api.focus('a')
    assert.deepEqual(api.receipts.value, [])
  } finally { close() }
})

test('pause suppresses every resync/undo checkpoint and ordinary updates resume afterwards', async () => {
  const { api, close } = harness()
  try {
    const a = snapshot(), b = snapshot(2), c = snapshot(3), d = snapshot(4)
    b.investigators.a.tokens.Resource = 6
    c.investigators.a.tokens.Resource = 7
    d.investigators.a.tokens.Resource = 8
    api.baseline(a)
    const resume = api.pause()
    await api.prepare(a, b)()
    await api.prepare(b, c)()
    await api.focus('a')
    assert.deepEqual(api.receipts.value, [])
    resume()
    await api.prepare(c, d)()
    assert.equal(api.receipts.value[0].delta, 1)
    await api.focus('a')
    assert.ok(api.receipts.value.some(e => e.kind === 'Focus'))
  } finally { close() }
})

test('duplicate additional actions are matched as a multiset and preserve the removed slot', () => {
  const a = snapshot(), b = snapshot(2)
  a.investigators.a.additionalActions = [{ tag: 'AnyAdditionalAction' }, { tag: 'AnyAdditionalAction' }]
  b.investigators.a.additionalActions = [{ tag: 'AnyAdditionalAction' }]
  assert.deepEqual(prime(a).consume(a, b).map(e => e.key), ['investigators:a:AdditionalAction:1'])
})

test('snapshots only mark arrivals, even with adjacent locations and a single step', () => {
  const a = snapshot(5), b = snapshot(6)
  for (const g of [a, b]) {
    g.locations.room.connectedLocations = ['next']
    g.locations.next = { tokens: {}, connectedLocations: ['room'] }
  }
  a.investigators.a.placement = { tag: 'AtLocation', contents: 'room' }
  b.investigators.a.placement = { tag: 'AtLocation', contents: 'next' }
  assert.equal(prime(a).consume(a, b).find(e => e.kind === 'Move').route, undefined)
  assert.equal(prime(a).consume(a, b).find(e => e.kind === 'Move').locationId, 'next')
  b.scenarioSteps = 8
  assert.equal(prime(a).consume(a, b).find(e => e.kind === 'Move').route, undefined)
  b.scenarioSteps = 6
  a.enemies.hunter = { placement: { tag: 'AtLocation', contents: 'next' } }
  b.enemies.hunter = { placement: { tag: 'AtLocation', contents: 'room' } }
  const swaps = prime(a).consume(a, b).filter(e => e.kind === 'Move')
  assert.equal(swaps.length, 2)
  assert.ok(swaps.every(e => !e.route))
  delete a.enemies.hunter; delete b.enemies.hunter
  a.locations.room.connectedLocations = []
  assert.equal(prime(a).consume(a, b).find(e => e.kind === 'Move').route, undefined)
})

test('reveal only follows a known unrevealed location; threshold crossing is distinct from advancing', () => {
  const a = snapshot(), b = snapshot(2)
  a.locations.room.revealed = false
  b.locations.room.revealed = true
  b.locations.new = { revealed: true, tokens: {} }
  a.agendas = { agenda: { flipped: false, doomPressure: { total: 5, threshold: 6 } } }
  b.agendas = { agenda: { flipped: false, doomPressure: { total: 6, threshold: 6 } } }
  const events = prime(a).consume(a, b)
  assert.equal(events.filter(e => e.kind === 'Reveal').length, 1)
  assert.equal(events.find(e => e.kind === 'Reveal').delay, undefined)
  assert.equal(events.filter(e => e.kind === 'Doom').length, 1)
  assert.deepEqual(prime(b).consume(b, structuredClone(b)), [])
  b.agendas.agenda.flipped = true
  assert.equal(prime(a).consume(a, b).filter(e => e.kind === 'Doom').length, 0)
  assert.equal(exports.doomPressureLevel({ total: 2, threshold: 10 }), 'normal')
  assert.equal(exports.doomPressureLevel({ total: 8, threshold: 10 }), 'near')
})

test('danger uses effective remaining capacity and applied damage, never missing/printed values', () => {
  assert.equal(exports.nearDefeat(undefined, 5), false)
  assert.equal(exports.nearDefeat(null, 5), false)
  assert.equal(exports.nearDefeat(2, 1), true)
  assert.equal(exports.nearDefeat(0, 2), true)
  assert.equal(exports.nearDefeat(2, 0), false)
  assert.equal(exports.nearDefeat(4, 5), false)
})

test('rewind clears delayed reveal feedback and gates attachment transitions', async () => {
  const { api, close } = harness()
  try {
    const a = snapshot(), b = snapshot(2)
    a.locations.room.revealed = false
    b.locations.room.revealed = true
    api.baseline(a)
    await api.prepare(a, b)()
    assert.equal(api.transitionAllowed.value, true)
    await api.prepare(b, a)()
    assert.equal(api.transitionAllowed.value, false)
    assert.equal(api.resetVersion.value, 2)
    await api.completeReveal('room')
    assert.deepEqual(api.receipts.value, [])
  } finally { close() }
})

test('reveal is armed before state application, waits for completion, and consumes the signal once', async () => {
  const { api, close } = harness()
  try {
    const a = snapshot(), b = snapshot(2)
    a.locations.room.revealed = false
    b.locations.room.revealed = true
    api.baseline(a)
    await api.completeReveal('room')
    assert.deepEqual(api.receipts.value, [])
    const applied = api.prepare(a, b)
    assert.deepEqual(api.receipts.value, [])
    await applied()
    assert.deepEqual(api.receipts.value, [])
    await api.completeReveal('room')
    assert.equal(api.receipts.value.filter(e => e.kind === 'Reveal').length, 1)
    await api.completeReveal('room')
    assert.equal(api.history.value.length, 1)
  } finally { close() }
})

test('consecutive changes remain separately readable after transient feedback is dismissed', async () => {
  const { api, close } = harness()
  try {
    const a = snapshot(), b = snapshot(2), c = snapshot(3)
    b.investigators.a.tokens.Resource = 3
    c.investigators.a.tokens.Resource = 4
    api.baseline(a)
    await api.prepare(a, b)()
    await api.prepare(b, c)()
    api.dismiss()
    assert.deepEqual(api.receipts.value, [])
    assert.deepEqual(api.history.value.map(event => event.delta), [-2, 1])
    api.reset()
    assert.deepEqual(api.history.value, [])
  } finally { close() }
})

test('offscreen map events remain available and never change perspective before a Locate click', async () => {
  const { api, close } = harness({ offscreen: true })
  try {
    const a = snapshot(), b = snapshot(2)
    a.investigators.a.placement = { tag: 'AtLocation', contents: 'start' }
    b.investigators.a.placement = { tag: 'AtLocation', contents: 'room' }
    let calls = 0
    api.registerMapFocus(async id => { assert.equal(id, 'room'); calls++; return true })
    api.baseline(a)
    await api.prepare(a, b)()
    assert.equal(calls, 0)
    assert.equal(api.mapActivity.value.length, 1)
    assert.deepEqual(api.receipts.value, [])
    await api.locateMapEvent(api.mapActivity.value[0])
    assert.equal(calls, 1)
    assert.deepEqual(api.mapActivity.value, [])
  } finally { close() }
})

test('packing keeps text inside the viewport, clears decision rectangles and prioritizes damage', () => {
  const obstacles = [{ left: 160, top: 80, width: 180, height: 120 }]
  const items = ['Resource', 'Damage', 'Horror'].map(kind => ({ kind, x: 220, y: 180, height: 24, delta: 1, bubbleWidth: 140 }))
  const placed = arrangeReceipts(items, 500, 360, obstacles)
  assert.equal(placed[0].kind, 'Damage')
  for (const item of placed) {
    const bounds = { left: item.x - 70, top: item.y - 13, width: 140, height: 26 }
    assert.equal(exports.overlaps(bounds, obstacles[0]), false)
    assert.ok(bounds.left >= 8 && bounds.top >= 24 && bounds.left + 140 <= 492 && bounds.top + 26 <= 352)
  }
  assert.deepEqual(arrangeReceipts(items, 500, 360, [{ left: 0, top: 0, width: 500, height: 360 }]), [])
})

test('assignment preview uses applied remaining capacity, bounds healing and preserves unknown capacity', () => {
  assert.deepEqual(exports.assignmentPreview(4, 3, 2, 1), { remaining: 4, assigned: 2, healing: 1, after: 3 })
  assert.equal(exports.assignmentPreview(2, 5, 3, 0).after, 0)
  assert.equal(exports.assignmentPreview(null, 3, 1, 0), null)
  assert.equal(exports.assignmentPreview(5, 0, 0, 10).after, 5)
  assert.equal(exports.assignmentPreview(5, 0, 1, 10).after, 5)
  assert.equal(exports.assignmentPreview(0, 9, 0, 1).after, null) // clamped remaining cannot reveal excess damage
})

test('damage target rows preserve original indices including interleaved non-assignment choices', async () => {
  const source = await read('../src/arkham/components/RequiredActionReminder.vue')
  const snippet = source.slice(source.indexOf('const assignmentRows ='), source.indexOf('const assignmentBusy ='))
  const investigator = { cardCode: 'i1', name: { title: 'Investigator' }, tokens: { Damage: 3 }, remainingHealth: 2, remainingSanity: 5,
    assignedHealthDamage: 1, assignedSanityDamage: 0, assignedHealthHeal: 0, assignedSanityHeal: 0 }
  const asset = { ...investigator, cardCode: 'a1', tokens: { Horror: 1 }, remainingHealth: null, remainingSanity: 1, owner: 'i' }
  const labels = [
    { tag: 'Label', label: 'Other' },
    { tag: 'ComponentLabel', component: { tag: 'AssetComponent', assetId: 'a', tokenType: 'HorrorToken' } },
    { tag: 'Label', label: 'Skip' },
    { tag: 'ComponentLabel', component: { tag: 'InvestigatorComponent', investigatorId: 'i', tokenType: 'DamageToken' } },
    { tag: 'ComponentLabel', component: { tag: 'InvestigatorComponent', investigatorId: 'i', tokenType: 'HorrorToken' } },
  ]
  const result = new Function('computed', 'assignmentChoices', 'props', 'dbCards', 'assetName', 'assignmentPreview', `${transpile(snippet)}; return { rows: assignmentRows.value, others: otherChoices.value }`)(
    fn => ({ value: fn() }), { value: labels }, { game: { investigators: { i: investigator }, assets: { a: asset } } },
    { getCardName: name => name }, code => code, exports.assignmentPreview,
  )
  assert.equal(result.rows[0].horrorIndex, 1)
  assert.equal(result.rows[1].damageIndex, 3)
  assert.equal(result.rows[1].horrorIndex, 4)
  assert.equal(result.rows[1].healthPreview.after, 1)
  assert.equal(result.rows[1].nextHealth, 0)
  assert.deepEqual(result.others.map(([, index]) => index), [0, 2])
})
