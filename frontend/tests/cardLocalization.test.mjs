import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath, URL } from 'node:url'

import { createServer } from 'vite'

const loadModule = async (t) => {
  const server = await createServer({
    root: fileURLToPath(new URL('..', import.meta.url)),
    appType: 'custom',
    logLevel: 'silent',
    server: { middlewareMode: true, hmr: false },
  })
  t.after(() => server.close())
  return server.ssrLoadModule('/src/arkham/cardLocalization.ts')
}

const engineCard = {
  cardCode: 'c01002',
  doubleSided: false,
  classSymbols: ['Mystic'],
  cardType: 'InvestigatorType',
  art: '01002',
  level: null,
  name: { title: 'Daisy Walker', subtitle: null },
  cardTraits: ['Agent', 'Researcher'],
  skills: [],
  cost: null,
  otherSide: null,
  meta: {},
  errata: null,
}

test('localization replaces the printed fields without touching the engine def', async (t) => {
  const { localizeCardDef } = await loadModule(t)

  const localized = localizeCardDef(engineCard, {
    name: '黛西·沃克',
    subname: '寻求真理者',
    type_name: '调查员',
    traits: '特工. 研究员',
  })

  assert.equal(localized.name.title, '黛西·沃克')
  assert.equal(localized.name.subtitle, '寻求真理者')
  assert.equal(localized.cardType, '调查员')
  assert.deepEqual(localized.cardTraits, ['特工', '研究员'])

  // The class renders through a `guardian-icon`-style class name, so translating
  // it would drop the icon.
  assert.deepEqual(localized.classSymbols, ['Mystic'])
  assert.equal(engineCard.name.title, 'Daisy Walker')
  assert.equal(engineCard.cardType, 'InvestigatorType')
  assert.deepEqual(engineCard.cardTraits, ['Agent', 'Researcher'])
})

test('localization leaves a card the database does not have as-is', async (t) => {
  const { localizeCardDef } = await loadModule(t)

  assert.equal(localizeCardDef(engineCard, null), engineCard)
})

test('set names come from the first card the database actually names', async (t) => {
  const { buildSetNameIndex } = await loadModule(t)

  const cards = new Map([
    ['02105', { pack_name: '' }],
    ['02106', { pack_name: '博物馆之夜' }],
    ['07330a', { pack_name: '深渊守卫' }],
  ])
  // The store resolves a split card's front under its suffixed code.
  const getCard = (art) => cards.get(art) ?? cards.get(`${art}a`) ?? null
  const sets = [
    { code: 'tmm', min: 2105, max: 2146 },
    { code: 'guardians', min: 7330, max: 7349 },
    { code: 'absent', min: 99991, max: 99999 },
  ]

  const names = buildSetNameIndex(sets, getCard)

  assert.equal(names.get('tmm'), '博物馆之夜')
  assert.equal(names.get('guardians'), '深渊守卫')
  // Nothing to name this set: the caller keeps the English data name.
  assert.equal(names.has('absent'), false)
})
