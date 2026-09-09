import { defineStore } from 'pinia'

export interface ArkhamDBCard {
  code: string
  name: string
  xp?: number
  subname?: string
  traits?: string
  text?: string
  back_name?: string
  back_traits?: string
  back_text?: string
  customization_text?: string
  flavor? :string
  back_flavor?: string
  faction_name: string
  faction2_name?: string
  faction3_name?: string
  faction_code?: string
  type_name: string
  pack_name: string
  real_name: string
  real_traits: string
  real_text: string
  type_code: string
  // "weakness" | "basicweakness"; absent on non-weakness cards
  subtype_code?: string
  is_unique: boolean
  double_sided: boolean
  encounter_code?: string
  // Investigator cards only: required signature cards keyed by code, each
  // mapping to its alternate versions (also keyed by code).
  deck_requirements?: {
    size?: number
    card?: Record<string, Record<string, string> | null>
    random?: unknown[]
  }
}

export interface DbCardsState {
  dbCards: ArkhamDBCard[]
  dbCardsIndex: Map<string, ArkhamDBCard>
  lang: string
  loadingLang: string | null
}

export const useDbCardStore = defineStore("dbCards", {
  state: (): DbCardsState => ({
    dbCards: [],
    dbCardsIndex: new Map(),
    lang: 'en',
    loadingLang: null
  } as DbCardsState),

  actions: {
    getDbCard(code: string): ArkhamDBCard | null {
      if (this.dbCards.length < 1) {
        void this.initDbCards()
      }

      // ArkhamDB stores some split-card fronts with an "a" suffix, while the
      // game runtime refers to the same front using the unsuffixed code.
      return this.dbCardsIndex.get(code) ?? this.dbCardsIndex.get(`${code}a`) ?? null
    },

    getCardName(cardTitle: string, typeCode: string = ""): string {
      if (this.dbCards.length < 1) {
        const language = localStorage.getItem('language') || 'en'
        if (language !== 'en') void this.initDbCards()
      }

      const i = typeCode
        ? this.dbCards.find((c: ArkhamDBCard) =>  c.type_code === typeCode && c.real_name == cardTitle)
        : this.dbCards.find((c: ArkhamDBCard) =>  c.real_name == cardTitle)

      return i ? i.name : cardTitle
    },

    async fetchDbCards(lang: string) {
      const response = await fetch(`/cards/cards_${lang}.json`.replace(/^\//, ''))
      // Without this a 404 hands back the SPA's index.html and .json() throws an
      // opaque SyntaxError from deep inside the store.
      if (!response.ok) {
        throw new Error(`card database for "${lang}" returned ${response.status}`)
      }
      const data = await response.json() as ArkhamDBCard[]

      // The user may have asked for a different language while this was in flight.
      if (this.loadingLang !== lang) return

      this.dbCards = data
      const index = new Map<string, ArkhamDBCard>()
      for (const card of data) {
        index.set(card.code, card)
        index.set(`${card.code}b`, card)
      }
      this.dbCardsIndex = index
      // Committed only once its cards are actually in place. Setting it earlier
      // would make the guard below treat stale wrong-language cards as correct
      // and never retry.
      this.lang = lang
    },

    /** Resolves true when the cards on screen match the stored language. */
    async initDbCards(): Promise<boolean> {
      const language = localStorage.getItem('language') || 'en'

      if (this.lang === language && this.dbCards.length > 0) return true
      if (this.loadingLang === language) return false

      this.loadingLang = language

      try {
        await this.fetchDbCards(language)
        return this.lang === language
      } catch (err) {
        // Swallowed on purpose: most callers fire this as `void initDbCards()`,
        // and an unhandled rejection there would surface nowhere. Leaving
        // this.lang alone is what lets the next call retry.
        console.error(`[dbCards] could not load the ${language} card database`, err)
        return false
      } finally {
        if (this.loadingLang === language) this.loadingLang = null
      }
    }
  }
})
