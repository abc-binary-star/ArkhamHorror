import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'
const source = await readFile(new URL('../src/arkham/restrictionSource.ts', import.meta.url), 'utf8')
const js = ts.transpileModule(source.replace(/^import type .*\n/gm, '').replace('export function', 'function'), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
const visible = new Function(`${js}; return visibleRestrictionSource`)()
const src = (tag, contents) => ({ tag, sourceTag: tag, contents })
const game = () => ({ investigators: {}, assets: {}, enemies: {}, treacheries: {}, locations: {} })

test('public restrictions keep entity identity even when printed card codes match', () => {
  const g = game()
  g.assets.a = g.assets.b = { cardCode: 'c123', flipped: false, placement: { tag: 'InPlayArea' } }
  assert.deepEqual(visible(src('AssetSource', 'a'), g), { key: 'AssetSource:a', code: 'c123' })
  assert.notEqual(visible(src('AssetSource', 'a'), g).key, visible(src('AssetSource', 'b'), g).key)
})
test('hidden, flipped and off-board cards never become source previews', () => {
  const g = game()
  for (const tag of ['HiddenInHand', 'StillInHand', 'OutOfPlay', 'FacedownInThreatArea', 'Limbo']) {
    g.assets.a = { cardCode: 'secret', flipped: false, placement: { tag } }
    assert.equal(visible(src('AssetSource', 'a'), g), null)
  }
  g.assets.a = { cardCode: 'secret', flipped: true, placement: { tag: 'InPlayArea' } }
  assert.equal(visible(src('AssetSource', 'a'), g), null)
  g.locations.a = { cardCode: 'secret', revealed: false }
  assert.equal(visible(src('LocationSource', 'a'), g), null)
  assert.equal(visible(src('CardCodeSource', 'secret'), g), null)
})
test('wrapped sources resolve only known public entities', () => {
  const g = game()
  g.locations.a = { cardCode: 'loc', revealed: true }
  const wrapped = src('PaymentSource', src('UseAbilitySource', ['i', src('LocationSource', 'a'), 1]))
  assert.equal(visible(wrapped, g).code, 'loc')
  delete g.locations.a
  assert.equal(visible(wrapped, g), null)
})
