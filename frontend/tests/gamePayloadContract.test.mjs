import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import { fileURLToPath, URL } from 'node:url'

/*
 * The client-facing game payload is built in the backend (Arkham/Game.hs), and
 * the frontend decoder silently ignores any key it was not told about. So a
 * field the backend starts sending is invisible on the frontend: no error, no
 * warning, just `undefined` wherever it was going to be read. Nothing checked
 * the two sides against each other.
 *
 * These tests extract both key lists from source and pin the current agreement.
 * They are intentionally failure-on-change: adding a key to the backend payload
 * without teaching the decoder about it will fail here, which is the point.
 */

const here = (rel) => fileURLToPath(new URL(rel, import.meta.url))
const hsPath = here('../../backend/arkham-api/library/Arkham/Game.hs')
const tsPath = here('../src/arkham/types/Game.ts')

assert.ok(
  fs.existsSync(hsPath),
  'backend source not found at ' + hsPath + ' — this check needs the whole repo, not just frontend/',
)

// Keys of every `"tag" .= String "PublicGame"` encoder in the backend.
function backendPayloadKeys() {
  const lines = fs.readFileSync(hsPath, 'utf8').split('\n')
  const keys = new Set()
  let collecting = false
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]
    if (!collecting && /"tag"\s*\.=\s*String "PublicGame"/.test(line)) collecting = true
    if (!collecting) continue
    // Column 0 starts a new top-level binding; an indented `toJSON (FailedToLoadGame e)`
    // starts a different payload. Either one ends this encoder.
    if (i > 0 && (/^\S/.test(line) || /^\s*(toJSON|toEncoding)\s*\(/.test(line))) {
      collecting = false
      continue
    }
    for (const m of line.matchAll(/"([a-zA-Z][A-Za-z0-9_]*)"\s*\.=/g)) keys.add(m[1])
  }
  return keys
}

// Top-level keys of the object literal handed to JsonDecoder.object.
function decoderKeys() {
  const lines = fs.readFileSync(tsPath, 'utf8').split('\n')
  const start = lines.findIndex((l) => /^export const gameDecoder/.test(l))
  assert.ok(start > -1, 'found `export const gameDecoder` in Game.ts')
  const keys = new Set()
  let depth = 0
  for (let i = start; i < lines.length; i += 1) {
    for (const ch of lines[i]) {
      if (ch === '{') depth += 1
      else if (ch === '}') depth -= 1
    }
    if (depth === 1) {
      const m = lines[i].match(/^\s*([a-zA-Z_]\w*)\s*:/)
      if (m) keys.add(m[1])
    }
    if (depth === 0 && i > start) break
  }
  return keys
}

// Decoded on the way out of the decoder rather than sent by the backend.
const SYNTHESIZED = ['scenario', 'campaign']
// Decoded keys that are aliases: the payload carries `mode`, not these.
const RENAMED_AWAY = ['mode', 'gameSettings']
// Payload keys the game decoder does not need: the discriminator the API layer
// dispatches on, plus two the frontend reads nowhere today. Kept explicit so
// that losing or gaining one is a deliberate edit rather than a silent no-op.
const NOT_DECODED = ['tag', 'git', 'turnPlayerInvestigatorId']

test('the backend payload sends every key the decoder reads', () => {
  const emitted = backendPayloadKeys()
  const wanted = [...decoderKeys()].filter((k) => !RENAMED_AWAY.includes(k))
  const missing = wanted.filter((k) => !emitted.has(k))
  assert.deepEqual(
    missing,
    [],
    'the decoder reads keys the backend payload does not send — they will always be undefined: ' +
      missing.join(', '),
  )
})

test('the backend payload does not quietly gain keys the decoder ignores', () => {
  const emitted = backendPayloadKeys()
  const known = new Set([...decoderKeys(), ...SYNTHESIZED, ...RENAMED_AWAY, ...NOT_DECODED])
  const dropped = [...emitted].filter((k) => !known.has(k))
  assert.deepEqual(
    dropped,
    [],
    'the backend now sends keys the decoder drops silently — either decode them or add them to ' +
      'NOT_DECODED: ' + dropped.join(', '),
  )
})

test('the exemption lists still describe reality', () => {
  const emitted = backendPayloadKeys()
  for (const k of NOT_DECODED) {
    assert.ok(emitted.has(k), `${k} is no longer sent, so drop it from NOT_DECODED`)
  }
  for (const k of RENAMED_AWAY) {
    assert.ok(emitted.has(k), `${k} is no longer sent, so drop it from RENAMED_AWAY`)
  }
})
