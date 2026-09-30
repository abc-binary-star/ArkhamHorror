import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'
const source = (await readFile(new URL('../src/arkham/composables/useCardFlip.ts', import.meta.url), 'utf8')).replace(/^import .*$/gm, '')
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText
function harness({ reduced = false, deferImages = false } = {}) {
  const exports = {}, timers = new Map(), probes = []
  let clock = 0, sequence = 0, update, dispose
  const window = {
    setTimeout(fn, ms) { const id = ++sequence; timers.set(id, { fn, at: clock + ms }); return id },
    clearTimeout(id) { timers.delete(id) }, matchMedia: () => ({ matches: reduced }),
  }
  class Image {
    naturalWidth = 100; naturalHeight = 140
    set src(value) { if (deferImages) probes.push(() => this.onload()); else this.onload() }
  }
  new Function('exports', 'ref', 'watch', 'onBeforeUnmount', 'window', 'Image', js)(
    exports, value => ({ value }), (_ref, fn) => { update = fn }, fn => { dispose = fn }, window, Image,
  )
  const calls = []
  const state = exports.useCardFlip({ value: 'back' }, () => true, (...args) => calls.push(args))
  function advance(ms) {
    const until = clock + ms
    while (true) {
      const next = [...timers.entries()].filter(([, timer]) => timer.at <= until).sort((a, b) => a[1].at - b[1].at)[0]
      if (!next) break
      const [id, timer] = next; timers.delete(id); clock = timer.at; timer.fn()
    }
    clock = until
  }
  return { state, calls, update, advance, dispose, probes }
}
test('completion follows the real flip, not the intermediate image swap', () => {
  const h = harness()
  h.update('face', 'back')
  h.advance(225)
  assert.equal(h.state.displayedImage.value, 'face')
  assert.deepEqual(h.calls, [])
  h.advance(225)
  assert.deepEqual(h.calls, [['face', 'back']])
  assert.equal(h.state.flipping.value, false)
})
test('reduced motion completes without a timer and cancelled flips never complete', () => {
  const h = harness({ reduced: true })
  h.update('face', 'back')
  assert.deepEqual(h.calls, [['face', 'back']])
  const replaced = harness()
  replaced.update('face', 'back')
  replaced.advance(100)
  replaced.update('other', 'face')
  replaced.advance(450)
  assert.deepEqual(replaced.calls, [['other', 'face']])
})
test('unmount invalidates pending image measurements before they can start an animation', () => {
  const h = harness({ deferImages: true })
  h.update('face', 'back')
  h.dispose()
  h.probes.forEach(resolve => resolve())
  h.advance(1000)
  assert.deepEqual(h.calls, [])
  assert.equal(h.state.flipping.value, false)
})
