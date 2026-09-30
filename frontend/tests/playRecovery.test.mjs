import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'
import { ref } from 'vue'

const source = await readFile(new URL('../src/arkham/views/Game.vue', import.meta.url), 'utf8')
const recovery = source.slice(source.indexOf('async function resyncGame()'), source.indexOf('// Every path that answers'))
const js = ts.transpileModule(recovery, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
const create = new Function('ref', 'fetchGame', 'applyGameUpdate', `
  const resyncing = ref(false), socketConnected = ref(true), socketError = ref(true);
  const processing = ref(true), storyAnswerPending = ref(true), uiLock = ref(false);
  let connectionRevision = 0;
  const props = { gameId: 'game', spectate: false };
  const visualFeedback = { pause: () => () => {} };
  const resultEvents = { clear() {} };
  const resetPhaseAnnouncement = () => {};
  const updateGameLog = () => {};
  const console = { error() {} };
  ${js}
  return { resyncGame, resyncing, socketError, processing,
    reconnect() { connectionRevision += 1; } };
`)
const deferred = () => {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

test('recovery waits for state application and coalesces repeated retries', async () => {
  const request = deferred(), apply = deferred()
  let requests = 0
  const state = create(ref, () => { requests++; return request.promise }, () => apply.promise)
  const pending = state.resyncGame()
  await state.resyncGame()
  assert.equal(requests, 1)
  request.resolve({ game: { log: [] } })
  await Promise.resolve()
  assert.equal(state.socketError.value, true)
  apply.resolve()
  await pending
  assert.equal(state.socketError.value, false)
  assert.equal(state.processing.value, false)
})

test('failed recovery stays blocked without an automatic retry loop', async () => {
  let requests = 0
  const state = create(ref, async () => {
    if (++requests === 1) throw new Error('offline')
    return { game: { log: [] } }
  }, async () => {})
  await state.resyncGame()
  assert.equal(state.socketError.value, true)
  assert.equal(state.resyncing.value, false)
  assert.equal(requests, 1)
  await state.resyncGame()
  assert.equal(requests, 2)
  assert.equal(state.socketError.value, false)
})

test('a newer connection discards the old snapshot and gets its own snapshot', async () => {
  const first = deferred(), second = deferred()
  let requests = 0
  const applied = []
  const state = create(ref, () => ++requests === 1 ? first.promise : second.promise,
    async game => { applied.push(game.id) })
  const pending = state.resyncGame()
  state.reconnect()
  await state.resyncGame()
  first.resolve({ game: { id: 'stale', log: [] } })
  await pending
  assert.equal(requests, 2)
  assert.deepEqual(applied, [])
  assert.equal(state.socketError.value, true)
  second.resolve({ game: { id: 'fresh', log: [] } })
  await new Promise(resolve => setImmediate(resolve))
  assert.deepEqual(applied, ['fresh'])
  assert.equal(state.socketError.value, false)
})

const socketSource = await readFile(new URL('../src/arkham/composables/useGameSocket.ts', import.meta.url), 'utf8')
const socketJs = ts.transpileModule(socketSource.replace(/^import .*\n/gm, '').replace(/^export /gm, ''), {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText

test('normal socket closure reports disconnect and subsequent connection is a reconnect', () => {
  let config
  const createSocket = new Function('useWebSocket', `${socketJs}; return useGameSocket`)(
    (_, options) => { config = options; return { send() {}, close() {} } })
  const events = []
  createSocket({ url: '', onResult() {}, onDisconnect: () => events.push('offline'),
    onConnect: reconnect => events.push(reconnect ? 'reconnect' : 'initial') })
  config.onConnected()
  config.onDisconnected()
  config.onConnected()
  assert.deepEqual(events, ['initial', 'offline', 'reconnect'])
})
