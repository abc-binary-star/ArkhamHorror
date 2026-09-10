// The engine serves English card defs; the per-language ArkhamDB dump
// (`public/cards/cards_<lang>.json`) carries the printed names. These lookups
// keep the English def as the fallback so a card the translation does not cover
// still renders rather than disappearing.
import type { CardDef } from '@/arkham/types/CardDef'
import type { ArkhamDBCard } from '@/stores/dbCards'

export interface LocalizableSet {
  code: string
  min: number
  max: number
}

export const currentLanguage = () => localStorage.getItem('language') || 'en'

export const usesLocalizedCardData = () => currentLanguage() !== 'en'

/** A copy of `card` with every field the ArkhamDB record covers replaced. */
export const localizeCardDef = (card: CardDef, match: ArkhamDBCard | null): CardDef => {
  if (!match) return card

  const localized: CardDef = { ...card, name: { ...card.name }, cardTraits: [...card.cardTraits] }

  localized.name.title = match.name
  if (match.subname) localized.name.subtitle = match.subname
  if (match.type_name) localized.cardType = match.type_name
  if (match.traits) {
    localized.cardTraits = match.traits
      .split('.')
      .map((trait) => trait.trim())
      .filter((trait) => trait !== '')
  }

  // `classSymbols` is left alone on purpose: the list and detail views style the
  // class with a `guardian-icon`-style class name, so a translated symbol would
  // render an empty span.
  return localized
}

/**
 * Set code → translated expansion name, taken from the first card the database
 * has for that set. Sets the translation does not name are absent, so callers
 * fall back to the English data.
 */
export const buildSetNameIndex = (
  sets: LocalizableSet[],
  getCard: (art: string) => ArkhamDBCard | null,
): Map<string, string> => {
  const names = new Map<string, string>()

  for (const set of sets) {
    for (let code = set.min; code <= set.max; code++) {
      const packName = getCard(String(code).padStart(5, '0'))?.pack_name
      if (packName) {
        names.set(set.code, packName)
        break
      }
    }
  }

  return names
}
