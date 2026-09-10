import { ref, computed, watchEffect } from 'vue'
import { imgsrc } from '@/arkham/helpers'
import { useDbCardStore, ArkhamDBCard } from '@/stores/dbCards'
import { homebrewTokenMap } from '@/arkham/homebrewAssets'
import type { ComputedRef } from 'vue'

export function useDbCardFallback(card: ComputedRef<string | null>) {
  const store = useDbCardStore()
  const dbCardName = ref<string>('')
  const dbCardTypeName = ref<string>('')
  const dbCardFactionName = ref<string>('')
  const dbCardFactionCode = ref<string>('')
  const dbCardTraits = ref<string>('')
  const dbCardText = ref<string>('')
  const dbCardFlavor = ref<string>('')
  const dbCardCustomizationText = ref<string>('')

  const dbCardData = computed<boolean>(() =>
    !!(dbCardName.value || dbCardTypeName.value || dbCardFactionName.value || dbCardTraits.value || dbCardText.value || dbCardCustomizationText.value || dbCardFlavor.value),
  )

  const TOKEN_MAP: Record<string, string> = {
    '[action]': '<span class="action-icon"></span>',
    '[fast]': '<span class="fast-icon"></span>',
    '[free]': '<span class="free-icon"></span>',
    '[reaction]': '<span class="reaction-icon"></span>',
    '[willpower]': '<span class="willpower-icon"></span>',
    '[intellect]': '<span class="intellect-icon"></span>',
    '[combat]': '<span class="combat-icon"></span>',
    '[agility]': '<span class="agility-icon"></span>',
    '[wild]': '<span class="wild-icon"></span>',
    '[guardian]': '<span class="guardian-icon"></span>',
    '[seeker]': '<span class="seeker-icon"></span>',
    '[rogue]': '<span class="rogue-icon"></span>',
    '[mystic]': '<span class="mystic-icon"></span>',
    '[survivor]': '<span class="survivor-icon"></span>',
    '[elder_sign]': '<span class="elder-sign"></span>',
    '[auto_fail]': '<span class="auto-fail"></span>',
    '[skull]': '<span class="skull-icon"></span>',
    '[cultist]': '<span class="cultist-icon"></span>',
    '[tablet]': '<span class="tablet-icon"></span>',
    '[elder_thing]': '<span class="elder-thing-icon"></span>',
    '[bless]': '<span class="bless-icon"></span>',
    '[curse]': '<span class="curse-icon"></span>',
    '[frost]': '<span class="frost-icon"></span>',
    '[blood]': '<span class="blood-icon"></span>',
    '[per_investigator]': '<span class="per-player"></span>',
    '[seal_a]': '<span class="seal-a-icon"></span>',
    '[seal_b]': '<span class="seal-b-icon"></span>',
    '[seal_c]': '<span class="seal-c-icon"></span>',
    '[seal_d]': '<span class="seal-d-icon"></span>',
    '[seal_e]': '<span class="seal-e-icon"></span>',
    '[day]': '<span class="day-icon"></span>',
    '[night]': '<span class="night-icon"></span>',
    '[codex]': '<span class="codex-icon"></span>',
    ...homebrewTokenMap,
  }

  const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const tokenRE = new RegExp(Object.keys(TOKEN_MAP).map(escapeRegExp).join('|'), 'g')
  const replaceText = (text: string): string => !text ? '' :
    text
      .replaceAll('[[', '<span style="font-style: italic; font-weight: bold">')
      .replaceAll(']]', '</span>')
      .replaceAll('<i>', '<span style="font-style: italic;">')
      .replaceAll('</i>', '</span>')
      .replace(tokenRE, (m) => TOKEN_MAP[m] ?? m)

  const getCardName = (dbCard: ArkhamDBCard, needBack: boolean): string | null => {
    if (!card.value || isLocalized(card.value)) return null
    if (dbCard.name === dbCard.real_name) return null
    let name = (needBack ? (dbCard.double_sided ? (dbCard.back_name || dbCard.name) : dbCard.back_name) : dbCard.name) || null
    if (!name) return null
    if (!needBack && dbCard.subname) name = `${name}: ${dbCard.subname}`
    if ((dbCard.xp || 0) > 0) name = `${name} (${dbCard.xp})`
    if (dbCard.is_unique) name = `*${name}`
    return name
  }

  const getCardTypeName = (dbCard: ArkhamDBCard,): string | null => {
    if (!card.value || isLocalized(card.value)) return null
    const t = dbCard.type_name || null
    return t ? replaceText(t) : null
  }

  const getCardFactionName = (dbCard: ArkhamDBCard,): string | null => {
    if (!card.value || isLocalized(card.value)) return null
    const t = dbCard.faction_name || null
    return t ? replaceText(t) : null
  }

  const getCardFactionCode = (dbCard: ArkhamDBCard,): string | null => {
    if (!card.value || isLocalized(card.value)) return null
    return dbCard.faction_code || null
  }

  const getCardTraits = (dbCard: ArkhamDBCard, needBack: boolean): string | null =>
    (!card.value || isLocalized(card.value)) ? null :
      (needBack ? (dbCard.double_sided ? (dbCard.back_traits || dbCard.traits) : dbCard.back_traits) : dbCard.traits) || null

  const getCardText = (dbCard: ArkhamDBCard, needBack: boolean): string | null => {
    if (!card.value || isLocalized(card.value)) return null
    const t = needBack ? (dbCard.back_text || null) : (dbCard.text || null)
    return t ? replaceText(t) : null
  }

  const getCardFlavor = (dbCard: ArkhamDBCard, needBack: boolean): string | null => {
    if (!card.value || isLocalized(card.value)) return null
    const t = needBack ? (dbCard.back_flavor || null) : (dbCard.flavor || null)
    return t ? replaceText(t) : null
  }

  const getCardCustomizationText = (dbCard: ArkhamDBCard): string | null =>
    (!card.value || isLocalized(card.value)) ? null : replaceText(dbCard.customization_text || '')

  const isLocalized = (url: string): boolean => {
    // Simple heuristic: URLs containing language subpaths (e.g., /zh/ /fr/ /ko/)
    const m = url.match(/cards\/c?\d+(?:_(zh|fr|ko|de|es|it))?\.avif(?:\?|$)/i)
    return !!m && m[1] !== undefined && m[1].length === 2
  }

  watchEffect(() => {
    dbCardName.value = dbCardTypeName.value = dbCardFactionName.value = dbCardFactionCode.value = dbCardTraits.value = dbCardText.value = dbCardCustomizationText.value = dbCardFlavor.value = ''
    const src = card.value
    if (!src) return
    const m = src.match(/(\d+b?)(_.*)?\.avif$/)
    if (!m) return
    const code = m[1]
    const tabooSuffix = m[2]
    const language = localStorage.getItem('language') || 'en'
    if (imgsrc(`cards/${m[0]}`).includes(language)) return

    const dbCard = store.getDbCard(code)
    if (!dbCard) return
    const needBack = dbCard.code !== code

    const name = getCardName(dbCard, needBack)
    const type = getCardTypeName(dbCard)
    const faction = getCardFactionName(dbCard)
    const factionCode = getCardFactionCode(dbCard)
    const traits = getCardTraits(dbCard, needBack)
    const text = getCardText(dbCard, needBack)
    const flavor = getCardFlavor(dbCard, needBack)
    const cust = getCardCustomizationText(dbCard)

    dbCardName.value = name ? `${tabooSuffix ? '[Taboo] ' : ''}${name}` : ''
    dbCardTypeName.value = type ?? ''
    dbCardFactionName.value = faction ?? ''
    dbCardFactionCode.value = factionCode ?? ''
    dbCardTraits.value = traits ?? ''
    dbCardText.value = text ?? ''
    dbCardFlavor.value = flavor ?? ''
    dbCardCustomizationText.value = cust ?? ''
  })

  return {
    dbCardName, dbCardTypeName, dbCardFactionName, dbCardFactionCode,
    dbCardTraits, dbCardText, dbCardFlavor, dbCardCustomizationText, dbCardData,
  }
}
