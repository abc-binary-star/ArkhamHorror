import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import { fileURLToPath, URL } from 'node:url'

/*
 * `Game` and `gameDecoder` in src/arkham/types/Game.ts are two hand-maintained
 * lists of the same field names. Nothing type-checks the pair: add a field to
 * the type and forget the decoder, and every read of it is `undefined` with no
 * error anywhere. These tests are that missing check.
 *
 * They do NOT cover drift against the backend's JSON — the decoder silently
 * ignores keys it was not told about, so a field the backend starts sending is
 * invisible here. Catching that needs the payload compared at runtime.
 */

const source = fs.readFileSync(
  fileURLToPath(new URL('../src/arkham/types/Game.ts', import.meta.url)),
  'utf8',
)
const lines = source.split('\n')

// Top-level keys of the brace block that starts on the given line.
function topLevelKeys(blockStart) {
  const keys = []
  let depth = 0
  for (let i = blockStart; i < lines.length; i += 1) {
    for (const ch of lines[i]) {
      if (ch === '{') depth += 1
      else if (ch === '}') depth -= 1
    }
    if (depth === 1) {
      const m = lines[i].match(/^\s*(?:\.\.\.)?([A-Za-z_]\w*)\s*[,:]/)
      if (m) keys.push(m[1])
      else {
        const spread = lines[i].match(/^\s*\.\.\.([A-Za-z_]\w*)/)
        if (spread) keys.push(spread[1])
      }
    }
    if (depth === 0 && i > blockStart) return keys
  }
  throw new Error('unbalanced braces in Game.ts starting at line ' + (blockStart + 1))
}

const typeLine = lines.findIndex((l) => /^export type Game = \{/.test(l))
const decoderLine = lines.findIndex((l) => /^export const gameDecoder/.test(l))
assert.ok(typeLine > -1, 'found `export type Game = {`')
assert.ok(decoderLine > -1, 'found `export const gameDecoder`')

const typeKeys = new Set(topLevelKeys(typeLine))
const decodedKeys = new Set(topLevelKeys(decoderLine))

// The decoder reshapes a few keys on the way out: `mode` becomes
// `scenario`/`campaign`, and `gameSettings` is folded into `settings`. Everything
// else must line up one-to-one.
const RENAMED_AWAY = ['mode', 'gameSettings']
const SYNTHESIZED = ['scenario', 'campaign']

test('every field the Game type declares reaches the decoded object', () => {
  const produced = new Set(decodedKeys)
  for (const k of RENAMED_AWAY) produced.delete(k)
  for (const k of SYNTHESIZED) produced.add(k)

  const missing = [...typeKeys].filter((k) => !produced.has(k))
  assert.deepEqual(
    missing,
    [],
    'declared on Game but the decoder never produces them — add them to gameDecoder or to SYNTHESIZED: ' +
      missing.join(', '),
  )
})

test('every field the decoder produces is declared on the Game type', () => {
  const produced = [...decodedKeys].filter((k) => !RENAMED_AWAY.includes(k))
  const undeclared = produced.filter((k) => !typeKeys.has(k))
  assert.deepEqual(
    undeclared,
    [],
    'the decoder produces fields the Game type does not declare — add them to Game or to RENAMED_AWAY: ' +
      undeclared.join(', '),
  )
})

test('the reshape lists stay honest', () => {
  // If someone stops decoding one of these, the exemptions above must not keep
  // hiding the difference.
  for (const k of RENAMED_AWAY) {
    assert.ok(decodedKeys.has(k), `${k} is no longer decoded, so drop it from RENAMED_AWAY`)
  }
  for (const k of SYNTHESIZED) {
    assert.ok(typeKeys.has(k), `${k} is no longer declared on Game, so drop it from SYNTHESIZED`)
  }
})
