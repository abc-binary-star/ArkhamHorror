type Translate = (key: string, params?: Record<string, unknown>) => string

const normalized = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[.。]+$/, '')

export function buildKnownTranslations(
  source: unknown,
  target: unknown,
  result = new Map<string, string>(),
) {
  if (typeof source === 'string' && typeof target === 'string') {
    const key = normalized(source)
    if (key && source !== target && !source.includes('<')) result.set(key, target)
    return result
  }

  if (!source || !target || typeof source !== 'object' || typeof target !== 'object') return result
  for (const key of Object.keys(source as Record<string, unknown>)) {
    buildKnownTranslations(
      (source as Record<string, unknown>)[key],
      (target as Record<string, unknown>)[key],
      result,
    )
  }
  return result
}

// The log is split around {card:…}/{location:…} references before translation,
// so the fixed table keys are the fragments that surround those references.
const fixedFragments = [
  [' played ', 'gameLog.played', (text: string) => ` ${text} `],
  [' draws ', 'gameLog.draws', (text: string) => ` ${text} `],
  [' chaos token', 'gameLog.chaosToken', (text: string) => ` ${text}`],
  [' chaos tokens', 'gameLog.chaosTokens', (text: string) => ` ${text}`],
  [' discovered clue(s)', 'gameLog.discoveredClues', (text: string) => ` ${text}`],
] as const

export function translateGameLogText(
  text: string,
  t: Translate,
  knownTranslations: Map<string, string>,
): string {
  if (!text.trim()) return text

  for (const [fragment, key, wrap] of fixedFragments) {
    if (text === fragment) return wrap(t(key))
  }

  const directive = text.match(/^(Remember|Forgot|Record) "(.+)"(?: \((\d+)\))?$/)
  if (directive) {
    const [, action, rawValue, amount] = directive
    const value = knownTranslations.get(normalized(rawValue)) ?? rawValue
    const key = action === 'Remember' ? 'remember' : action === 'Forgot' ? 'forgot' : 'record'
    const translated = t(`gameLog.${key}`, { value })
    return amount ? `${translated} (${amount})` : translated
  }

  const leading = text.match(/^\s*/)?.[0] ?? ''
  const trailing = text.match(/\s*$/)?.[0] ?? ''
  const core = text.slice(leading.length, text.length - trailing.length)
  return `${leading}${knownTranslations.get(normalized(core)) ?? core}${trailing}`
}

let cache: { locale: string; translations: Map<string, string> } | null = null

// Both the fallback and the active locale are loaded before the app mounts, so
// the two trees can be walked without importing either locale statically.
export function knownTranslationsFor(
  locale: string,
  messages: Record<string, unknown> | undefined,
): Map<string, string> {
  if (cache?.locale === locale) return cache.translations

  const translations =
    locale === 'en' || !messages
      ? new Map<string, string>()
      : buildKnownTranslations(messages.en, messages[locale])

  cache = { locale, translations }
  return translations
}
