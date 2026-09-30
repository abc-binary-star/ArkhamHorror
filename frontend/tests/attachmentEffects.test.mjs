import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'
import * as JsonDecoder from 'ts.data.json'

const read = path => readFile(new URL(path, import.meta.url), 'utf8')
const catalog = JSON.parse(await read('../src/arkham/data/attachmentEffects.json'))
const source = (await read('../src/arkham/attachmentEffects.ts')).replace(/^import .*$/gm, '')
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText
const exports = {}
new Function('exports', 'catalog', js)(exports, catalog)
const { attachmentEffectsFor, attachmentEffectLayers } = exports
const placementSource = (await read('../src/arkham/types/Placement.ts')).replace(/^import .*$/gm, '')
const placementJs = ts.transpileModule(placementSource, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText
const placementExports = {}
new Function('exports', 'JsonDecoder', 'cardDecoder', placementJs)(placementExports, JsonDecoder, JsonDecoder.succeed())
const { placementDecoder } = placementExports

function game() {
  return {
    locations: { l1: { treacheries: ['t1'] }, l2: { treacheries: [] } },
    enemies: { e1: { treacheries: [], assets: [] } },
    assets: { a1: { treacheries: [] } },
    acts: { act1: { treacheries: [] } }, agendas: { agenda1: { treacheries: [] } },
    treacheries: { t1: { cardCode: 'c01174', placement: { tag: 'AttachedToLocation', contents: 'l1' }, exhausted: false } },
  }
}
const location = id => ({ type: 'location', id })

test('every screened attachment and all data variants have an explicit effect or lantern replacement', async () => {
  const cards = JSON.parse(await read('../card-data/cards_en.json'))
  const candidates = cards.filter(c => c.type_code === 'treachery' && /\battach(?:es)?\b/i.test(c.text ?? ''))
  assert.equal(new Set(candidates.map(c => c.name)).size, 97)
  for (const card of candidates) {
    if (card.name === 'Mind Extraction') {
      assert.equal(catalog['71046'].kind, 'lantern')
      assert.equal(catalog['71046b'].kind, 'lantern')
    } else {
      assert.ok(catalog[card.code], `${card.code} ${card.name}`)
    }
  }
  assert.equal(catalog['02096'].kind, 'growth') // missed by the original keyword search
})

test('effects follow attachment transfer and removal, even if an old host list lags behind', () => {
  const g = game()
  assert.equal(attachmentEffectsFor(g, location('l1'))[0].kind, 'lock')
  g.treacheries.t1.placement.contents = 'l2'
  g.locations.l2.treacheries = ['t1']
  assert.deepEqual(attachmentEffectsFor(g, location('l1')), [])
  assert.equal(attachmentEffectsFor(g, location('l2')).length, 1)
  g.treacheries.t1.placement = { tag: 'OutOfPlay', contents: 'RemovedZone' }
  assert.deepEqual(attachmentEffectsFor(g, location('l2')), [])
  delete g.treacheries.t1
  assert.deepEqual(attachmentEffectsFor(g, location('l2')), [])
  assert.deepEqual(attachmentEffectsFor(g, location('missing')), [])
})

test('enemy, asset, act and agenda placements retain their host ID through decoding', async () => {
  const pairs = [['enemy', 'e1', 'AttachedToEnemy'], ['asset', 'a1', 'AttachedToAsset'], ['act', 'act1', 'AttachedToAct'], ['agenda', 'agenda1', 'AttachedToAgenda']]
  for (const [type, id, tag] of pairs) {
    const g = game()
    const contents = type === 'asset' ? [id, null] : id
    const placement = await placementDecoder.decodePromise({ tag, contents })
    assert.deepEqual(placement, { tag, contents })
    g[type === 'enemy' ? 'enemies' : `${type}s`][id].treacheries = ['t1']
    g.treacheries.t1.placement = placement
    assert.equal(attachmentEffectsFor(g, { type, id }).length, 1)
  }
})

test('Stone Barrier becomes dormant when exhausted; other attachments are not suppressed', () => {
  const g = game()
  g.treacheries.t1.cardCode = 'c07299'
  assert.equal(attachmentEffectsFor(g, location('l1'))[0].dormant, false)
  g.treacheries.t1.exhausted = true
  assert.equal(attachmentEffectsFor(g, location('l1'))[0].dormant, true)
  g.treacheries.t1.cardCode = 'c01168'
  assert.equal(attachmentEffectsFor(g, location('l1'))[0].dormant, false)
})

test('Mind Extraction is represented by the attached lantern, never the drawn treachery', () => {
  const g = game()
  g.enemies.e1.assets = ['lantern']
  g.assets.lantern = { cardCode: 'c71046', placement: { tag: 'AttachedToEnemy', contents: 'e1' } }
  assert.equal(attachmentEffectsFor(g, { type: 'enemy', id: 'e1' })[0].kind, 'lantern')
  g.assets.lantern.placement = { tag: 'InPlayArea', contents: 'i1' }
  assert.deepEqual(attachmentEffectsFor(g, { type: 'enemy', id: 'e1' }), [])
  g.treacheries.t1.cardCode = 'c71057'
  assert.deepEqual(attachmentEffectsFor(g, location('l1')), [])
})

test('a blanked attachment keeps only a dormant mark until its text is restored', () => {
  const g = game()
  g.modifiers = [[{ tag: 'TreacheryTarget', contents: 't1' }, [{ type: { tag: 'Blank' } }]]]
  assert.equal(attachmentEffectsFor(g, location('l1'))[0].dormant, true)
  g.modifiers = []
  assert.equal(attachmentEffectsFor(g, location('l1'))[0].dormant, false)
})

test('stacking preserves distinct locks, merges repeated fog and keeps orange fire in its existing renderer', () => {
  const effect = (kind, sourceId, variant, dormant = false) => ({ kind, sourceId, variant, dormant, name: sourceId })
  const layers = attachmentEffectLayers([
    effect('fog', 'a'), effect('fog', 'b'), effect('fire', 'c'),
    effect('lock', 'd'), effect('lock', 'e', 'exit'), effect('rubble', 'f', undefined, true),
  ])
  assert.equal(layers.length, 4)
  assert.equal(layers[0].kind, 'lock')
  assert.equal(layers.filter(x => x.kind === 'fog').length, 1)
  assert.equal(layers.filter(x => x.kind === 'lock').length, 2)
  assert.equal(layers.at(-1).dormant, true)
})

test('overlay measurement uses layout coordinates and shares card rotation, irrespective of screen zoom', async () => {
  const component = await read('../src/arkham/components/AttachmentEffects.vue')
  const snippet = component.slice(component.indexOf('function measure()'), component.indexOf('function scheduleMeasure()'))
  const body = ts.transpileModule(snippet, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
  for (const scale of [0.25, 0.5, 1, 2, 6]) {
    const target = { offsetLeft: 6, offsetTop: 3, offsetWidth: 80, offsetHeight: 112,
      getBoundingClientRect: () => ({ width: 80 * scale, height: 112 * scale }) }
    const geometry = { value: null }
    new Function('target', 'geometry', 'getComputedStyle', `let raf=null; const root={value:{}}; const transitions=new Set(); ${body}; measure();`)(target, geometry, () => ({ transform: 'rotate(90deg)', transformOrigin: '40px 56px' }))
    assert.deepEqual(geometry.value, { left: '6px', top: '3px', width: '80px', height: '112px', transform: 'rotate(90deg)', transformOrigin: '40px 56px', visibility: 'visible' })
  }
})

test('departures preserve every source, distinguish migration/blanking/removal, and ignore dormant motifs', () => {
  const effect = (id, kind = 'fog') => ({ sourceId: id, kind, name: id, dormant: false })
  const a = effect('a'), b = effect('b'), c = effect('c', 'lock'), d = { ...effect('d'), dormant: true }
  const g = game()
  g.treacheries.b = { placement: { tag: 'AttachedToLocation', contents: 'l2' } }
  const exits = exports.attachmentDepartures([a, b, c, d], [{ ...c, dormant: true }], g)
  assert.deepEqual(exits.map(e => [e.sourceId, e.reason]), [['a', 'removed'], ['b', 'moved'], ['c', 'inactive']])
  assert.deepEqual(exports.attachmentDepartures([a, b], [a, b], g), [])
})
