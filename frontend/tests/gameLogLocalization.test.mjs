import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import test from 'node:test'
import { createServer } from 'vite'

/* The backend emits two kinds of log message: `$i18n` tokens, which
handleEmbeddedI18n resolves, and raw English text, which nothing translates.
gameLogLocalization is the fallback for the second kind. These tests pin the
fragment shapes it must recognise, because they are dictated by how GameMessage
splits the log around {card:…}/{location:…} references — a change to that split
silently breaks translation rather than throwing. */

const gameLog = {
  played: '打出了',
  draws: '抽取了',
  chaosToken: '混乱标记',
  chaosTokens: '混乱标记',
  remember: '记住“{value}”',
  forgot: '忘记“{value}”',
  record: '记录“{value}”',
}

const t = (key, params) => {
  assert.ok(key.startsWith('gameLog.'), `unexpected key ${key}`)
  const template = gameLog[key.slice('gameLog.'.length)]
  assert.ok(template, `missing gameLog template for ${key}`)
  return Object.entries(params ?? {}).reduce(
    (acc, [name, value]) => acc.replaceAll(`{${name}}`, String(value)),
    template,
  )
}

async function load(t2) {
  const server = await createServer({
    root: resolve('.'),
    server: { middlewareMode: true },
    appType: 'custom',
    logLevel: 'silent',
  })
  t2.after(() => server.close())
  return server.ssrLoadModule('/src/arkham/gameLogLocalization.ts')
}

test('buildKnownTranslations maps English source text to the target locale', async (t2) => {
  const { buildKnownTranslations } = await load(t2)

  const map = buildKnownTranslations(
    { log: { retaliate: '{name} retaliates' }, cards: { name: 'Roland Banks' } },
    { log: { retaliate: '{name}报复' }, cards: { name: '罗兰·班克斯' } },
  )

  assert.equal(map.get('{name} retaliates'), '{name}报复')
  assert.equal(map.get('roland banks'), '罗兰·班克斯')
})

test('buildKnownTranslations skips identical values, markup, and keys the target lacks', async (t2) => {
  const { buildKnownTranslations } = await load(t2)

  const map = buildKnownTranslations(
    {
      same: 'Investigate',
      markup: '<b>bold</b>',
      untranslated: 'Drawn',
      blank: '',
    },
    {
      same: 'Investigate',
      markup: '<b>粗体</b>',
      blank: '',
    },
  )

  assert.equal(map.size, 0)
})

test('trailing periods and case are ignored when matching', async (t2) => {
  const { buildKnownTranslations, translateGameLogText } = await load(t2)

  const map = buildKnownTranslations({ a: 'You take 1 damage.' }, { a: '你受到 1 点伤害。' })
  assert.equal(translateGameLogText('you take 1 DAMAGE', t, map), '你受到 1 点伤害。')
})

test('the fragments that surround a card reference are translated with spacing intact', async (t2) => {
  const { translateGameLogText } = await load(t2)
  const empty = new Map()

  assert.equal(translateGameLogText(' played ', t, empty), ' 打出了 ')
  assert.equal(translateGameLogText(' draws ', t, empty), ' 抽取了 ')
  assert.equal(translateGameLogText(' chaos token', t, empty), ' 混乱标记')
  assert.equal(translateGameLogText(' chaos tokens', t, empty), ' 混乱标记')
})

test('remember/forgot/record directives translate both the verb and the recorded value', async (t2) => {
  const { translateGameLogText } = await load(t2)
  const map = new Map([['the red key', '红钥匙']])

  assert.equal(translateGameLogText('Remember "The Red Key"', t, map), '记住“红钥匙”')
  assert.equal(translateGameLogText('Forgot "The Red Key"', t, map), '忘记“红钥匙”')
  assert.equal(translateGameLogText('Record "The Red Key"', t, map), '记录“红钥匙”')
  assert.equal(translateGameLogText('Record "Supplies" (3)', t, map), '记录“Supplies” (3)')
})

test('whitespace around a translated fragment is preserved', async (t2) => {
  const { translateGameLogText } = await load(t2)
  const map = new Map([['roland banks', '罗兰·班克斯']])

  assert.equal(translateGameLogText('  Roland Banks  ', t, map), '  罗兰·班克斯  ')
})

test('unrecognised text and blank fragments pass through untouched', async (t2) => {
  const { translateGameLogText } = await load(t2)
  const empty = new Map()

  assert.equal(translateGameLogText('Some unknown line', t, empty), 'Some unknown line')
  assert.equal(translateGameLogText('   ', t, empty), '   ')
  assert.equal(translateGameLogText('', t, empty), '')
})

test('knownTranslationsFor is empty for English and cached per locale', async (t2) => {
  const { knownTranslationsFor } = await load(t2)
  const messages = {
    en: { cards: { name: 'Roland Banks' } },
    zh: { cards: { name: '罗兰·班克斯' } },
  }

  assert.equal(knownTranslationsFor('en', messages).size, 0)

  const first = knownTranslationsFor('zh', messages)
  assert.equal(first.get('roland banks'), '罗兰·班克斯')
  assert.equal(knownTranslationsFor('zh', messages), first, 'expected the cached map')

  // A locale that was never loaded must not blow up the log render.
  assert.equal(knownTranslationsFor('fr', messages).size, 0)
})
