import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

/*
 * The backend writes in-game log lines as `$gameLog.<key> <var>=<type>:<value>`
 * tokens whose values contain the {card:…}/{investigator:…}/{enemy:…}/
 * {location:…} references the renderer localizes (see Arkham/Helpers/GameLog.hs).
 * GameMessage resolves the token first and splits the *result* around those
 * references. Both halves are shape-sensitive: a malformed var list makes the
 * whole line render as a raw $key, and a reference the renderer does not
 * recognise renders as literal braces.
 *
 * The tokenizer and parser below are ported from src/arkham/i18n.ts
 * (isWholeI18nToken / parseInput / tokenizeParams) rather than imported, because
 * that module pulls in the card store and cannot be loaded in plain node. Keep
 * them in step with it; the locale templates are the real ones.
 */

const read = (f) => JSON.parse(readFileSync(resolve(f), 'utf8'))
const zh = read('src/locales/zh/base.json')
const en = read('src/locales/en/base.json')

const isWholeI18nToken = (input) => {
  if (!input.startsWith('$')) return false
  const spaceIndex = input.indexOf(' ')
  if (spaceIndex === -1) return true
  const rest = input.substring(spaceIndex + 1).trim()
  if (!rest) return false
  const value = '(?:"(?:[^"\\\\]|\\\\.)*"|\\S+)'
  return new RegExp(`^[A-Za-z0-9_]+=[is]:${value}(\\s+[A-Za-z0-9_]+=[is]:${value})*$`).test(rest)
}

function tokenizeParams(paramsString) {
  const tokens = []
  let currentToken = ''
  let inQuotes = false
  let quoteChar = ''
  let escaped = false
  for (let i = 0; i < paramsString.length; i++) {
    const c = paramsString[i]
    if (inQuotes) {
      if (c !== '\\') currentToken += c
      if (c === quoteChar && !escaped) inQuotes = false
      if (c === '\\' && !escaped) escaped = true
      else escaped = false
    } else if (c === ' ') {
      if (currentToken.length > 0) {
        tokens.push(currentToken)
        currentToken = ''
      }
    } else {
      currentToken += c
      if (c === '"' || c === "'") {
        inQuotes = true
        quoteChar = c
      }
    }
  }
  if (currentToken.length > 0) tokens.push(currentToken)
  return tokens
}

function parseInput(input) {
  input = input.trim()
  if (input.startsWith('$')) input = input.substring(1).trim()
  const spaceIndex = input.indexOf(' ')
  let key = input
  let paramsString = ''
  if (spaceIndex !== -1) {
    key = input.substring(0, spaceIndex)
    paramsString = input.substring(spaceIndex + 1).trim()
  }
  const params = {}
  for (const token of paramsString ? tokenizeParams(paramsString) : []) {
    const match = token.match(/^([^=]+)=([is]):(.+)$/)
    assert.ok(match, `unparseable parameter: ${token}`)
    const [, paramName, paramType] = match
    let paramValue = match[3]
    params[paramName] =
      paramType === 'i' ? Number.parseInt(paramValue, 10) : paramValue.slice(1, -1)
  }
  return { key, params }
}

// Arkham/I18n.hs: `quoted` escapes quotes/backslashes; `ikey` emits the vars in
// Data.Map order.
const quoted = (v) => `"${v.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`
const ikey = (key, vars) =>
  '$' +
  key +
  Object.entries(vars)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([k, v]) => ` ${k}=${typeof v === 'number' ? `i:${v}` : `s:${quoted(v)}`}`)
    .join('')

const lookup = (tree, path) => path.split('.').reduce((acc, k) => (acc ? acc[k] : undefined), tree)
const render = (tree, key, params) => {
  const template = lookup(tree, key)
  assert.equal(typeof template, 'string', `missing locale template for ${key}`)
  return Object.entries(params).reduce(
    (acc, [name, value]) => acc.replaceAll(`{${name}}`, String(value)),
    template,
  )
}

// The references GameMessage.vue recognises; anything else renders as braces.
const referencePatterns = [
  /^{card:"((?:[^"]|\\.)+)":"([^"]+)":"([^"]+)"}$/,
  /^{investigator:"((?:[^"]|\\.)+)":"([^"]+)"}$/,
  /^{enemy:"((?:[^"]|\\.)+)":(.+):"([^"]+)"}$/,
  /^{location:"((?:[^"]|\\.)+)":(.+):"([^"]+)"}$/,
  /^{location:"((?:[^"]|\\.)+)":(.+)}$/,
  /^{token:"([^"]+)"}$/,
]

const investigator = '{investigator:"Mark Harrigan: The Soldier":"01001"}'
const enemy = '{enemy:"Ghoul Priest":"e2b1":"01119"}'
const location = '{location:"Study":6f2d:"01113"}'
const card = '{card:"Machete":"01020":"c-abc-123"}'
// cardCodeRef writes the code into all three fields (see Arkham/Helpers/GameLog.hs).
const cardByCode = '{card:"01020":"01020":"01020"}'

// One line per backend log site, so a new site that forgets its locale key or
// mangles its variables fails here rather than in someone's game.
const lines = [
  ['gameLog.investigatorTakesDamage', { investigator, damage: 2 }, zh],
  ['gameLog.investigatorTakesHorror', { investigator, horror: 1 }, zh],
  ['gameLog.investigatorHealsDamage', { investigator, damage: 2 }, zh],
  ['gameLog.investigatorHealsHorror', { investigator, horror: 1 }, zh],
  ['gameLog.investigatorDefeated', { investigator }, zh],
  ['gameLog.investigatorInsane', { investigator }, zh],
  ['gameLog.investigatorResigns', { investigator }, zh],
  ['gameLog.investigatorMovesTo', { investigator, location }, zh],
  ['gameLog.investigatesLocation', { investigator, location }, zh],
  ['gameLog.fightsEnemy', { investigator, enemy }, zh],
  ['gameLog.triesToEvadeEnemy', { investigator, enemy }, en],
  ['gameLog.abilityReaction', { investigator, card: cardByCode }, zh],
  ['gameLog.abilityForced', { investigator, card: cardByCode }, en],
  ['gameLog.investigatorEngagesEnemy', { investigator, enemy }, zh],
  ['gameLog.investigatorDisengages', { investigator, enemy }, zh],
  ['gameLog.investigatorEvades', { investigator, enemy }, zh],
  ['gameLog.enemyDefeated', { enemy }, zh],
  ['gameLog.enemyTakesDamage', { enemy, count: 2 }, zh],
  ['gameLog.enemyTakesDamageFrom', { investigator, enemy, count: 2 }, zh],
  ['gameLog.enemyHealsDamage', { enemy, count: 1 }, en],
  ['gameLog.enemyAttacks', { investigator, enemy, damage: 2, horror: 1 }, zh],
  ['gameLog.enemyMovesTo', { enemy, location }, zh],
  ['gameLog.enemySpawns', { enemy, location }, zh],
  ['gameLog.actAdvances', { card }, zh],
  ['gameLog.agendaAdvances', { card }, zh],
  ['gameLog.investigatorDiscoversClues', { investigator, count: 2 }, zh],
  ['gameLog.investigatorDrawsCards', { investigator, count: 2 }, en],
  ['gameLog.investigatorGainsResources', { investigator, count: 3 }, zh],
  ['gameLog.investigatorDrawsEncounterCard', { investigator, card }, zh],
  ['gameLog.discardsCard', { investigator, card }, zh],
  ['gameLog.losesResources', { investigator, count: 3 }, zh],
  ['gameLog.suffersPhysicalTrauma', { investigator, count: 1 }, zh],
  ['gameLog.suffersMentalTrauma', { investigator, count: 1 }, zh],
  ...['willpower', 'intellect', 'combat', 'agility', 'multi', 'resource', 'baseValue'].flatMap(
    (skill) => [
      [`gameLog.testSucceeded.${skill}`, { investigator, value: 6, difficulty: 2 }, zh],
      [`gameLog.testFailed.${skill}`, { investigator, value: 4, difficulty: 5 }, en],
    ],
  ),
]

for (const [key, vars, tree] of lines) {
  test(`${key} survives the client's log pipeline`, () => {
    const msg = ikey(key, vars)
    assert.ok(isWholeI18nToken(msg), `isWholeI18nToken rejected ${msg}`)

    const parsed = parseInput(msg)
    assert.equal(parsed.key, key)

    const rendered = render(tree, parsed.key, parsed.params)
    assert.doesNotMatch(rendered, /\$[A-Za-z0-9_.]+/, `unresolved token in ${rendered}`)

    const refs = rendered.split(/({[^}]+})/).filter((s) => s.startsWith('{'))
    assert.ok(refs.length > 0, `no reference survived in ${rendered}`)
    for (const ref of refs) {
      assert.ok(
        referencePatterns.some((p) => p.test(ref)),
        `renderer would print ${ref} literally (from ${rendered})`,
      )
    }
  })
}
