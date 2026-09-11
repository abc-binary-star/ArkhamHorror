import { computed, reactive, type ComputedRef, type Ref, type VNodeRef } from 'vue'
import { imgsrc } from '@/arkham/helpers'
import { VIEW_W } from '@/arkham/composables/cardOverlayShared'

type OverlayCustomizationOptions = {
  hoveredElement: Ref<HTMLElement | null>
  card: ComputedRef<string | null>
  cardCode: ComputedRef<string | null>
  sideways: ComputedRef<boolean>
  viewH: ComputedRef<number>
}

// Customization sheets (Forgotten Age upgrade cards) rendered on top of the
// card overlay: tick marks, auto-fitted labels and skill circles, positioned
// by per-card percentage tables.
export function useOverlayCustomizations(opts: OverlayCustomizationOptions) {
  const { hoveredElement, card, cardCode, sideways, viewH } = opts

  const allCustomizations = new Set([
    '09021', '09022', '09023', '09040', '09041', '09042', '09059', '09060',
    '09061', '09079', '09080', '09081', '09099', '09100', '09101', '09119'
  ])

  const customizationVariant = computed<string>(() => {
    const chained = hoveredElement.value?.dataset?.chained
    if (chained) return `_${chained}`
    if (!card.value) return ''
    const m = card.value.match(/cards\/\d+(_Mutated\d+)\.avif$/)
    return m ? m[1] : ''
  })

  // A later taboo can mutate a card without touching its customizable sheet -- Taboo 24
  // only changed Power Word's test difficulty, which lives on the front. Point those
  // variants at the sheet from the taboo that last changed it.
  const customizationSheetVariants: Record<string, string> = {
    '09081_Mutated24': '_Mutated21',
  }

  const customizationSheetVariant = computed<string>(() => {
    const variant = customizationVariant.value
    if (!variant || !cardCode.value) return variant
    return customizationSheetVariants[`${cardCode.value}${variant}`] ?? variant
  })

  const customizationsCard = computed<string | null>(() => {
    if (!cardCode.value) return null
    if (!allCustomizations.has(cardCode.value)) return null
    // Chained sheets (Runic Axe) ship as .avif; base and mutated sheets as .jpg.
    const chained = hoveredElement.value?.dataset?.chained
    if (chained) return imgsrc(`customizations/${cardCode.value}_${chained}.avif`)
    return imgsrc(`customizations/${cardCode.value}${customizationSheetVariant.value}.jpg`)
  })

  type ChoiceTag = 'ChosenCard' | 'ChosenTrait' | 'ChosenSkill' | 'ChosenIndex'
  type CustomizationEntry = [number, [number, Array<{ tag: ChoiceTag; contents: string }>]]

  const customizations = computed<CustomizationEntry[] | null>(() => {
    const raw = hoveredElement.value?.dataset?.customizations
    if (!raw) return null
    try {
      const parsed = JSON.parse(raw) as CustomizationEntry[]
      return parsed?.length ? parsed : null
    } catch {
      return null
    }
  })

  const customizationTicks = computed<string[]>(() => {
    if (!cardCode.value || !customizations.value) return []
    const out: string[] = []
    for (const [first, [count]] of customizations.value) {
      for (let i = 1; i <= count; i++) out.push(`customization-${cardCode.value}-${first}-${i}`)
    }
    return out
  })

  const customizationLabels = computed<[string, string][]>(() => {
    if (!cardCode.value || !customizations.value) return []
    const out: [string, string][] = []
    for (const [first, [, arr]] of customizations.value) {
      arr.forEach((a, j) => {
        if (a.tag === 'ChosenCard' || a.tag === 'ChosenTrait') {
          out.push([`label-${cardCode.value}-${first}-${j}`, a.contents])
        }
      })
    }
    return out
  })

  const customizationSkills = computed<string[]>(() => {
    if (!cardCode.value || !customizations.value) return []
    const out: string[] = []
    for (const [, [, arr]] of customizations.value) {
      arr.forEach(a => { if (a.tag === 'ChosenSkill') out.push(`skill-${cardCode.value}-${a.contents}`) })
    }
    return out
  })

  /** -------------------- Tick tables ----------------- **/
  type TickTable = Record<string, { top: Record<number, number>, left: Record<number, number> }>
  const TICK_TABLE: TickTable = {
    // Hunter's Armor (09021)
    '09021': {
      top: { 0: 21.0, 1: 31.9, 2: 42.8, 3: 47.0, 4: 51.3, 5: 62.2, 6: 76.3 },
      left: { 1: 10.0, 2: 13.0, 3: 16.6 }
    },
    // Runic Axe (09022)
    '09022': {
      top: { 0: 20.5, 1: 27.2, 2: 36.8, 3: 49.1, 4: 58.6, 5: 71.2, 6: 77.8, 7: 84.3 },
      left: { 1: 10.0, 2: 13.0, 3: 16.1, 4: 19.1 }
    },
    // Custom Modifications (09023)
    '09023': {
      top: { 0: 21.0, 1: 35.3, 2: 42.8, 3: 53.6, 4: 64.4, 5: 75.2 },
      left: { 1: 10.0, 2: 13.3, 3: 16.8, 4: 20.5 }
    },
    // Alchemical Distillation (09040)
    '09040': {
      top: { 0: 21.0, 1: 28.6, 2: 36.2, 3: 47.0, 4: 54.7, 5: 62.1, 6: 76.2 },
      left: { 1: 10.0, 2: 13.3, 3: 16.8, 4: 20.5, 5: 23.8 }
    },
    // Empirical Hypothesis (09041)
    '09041': {
      top: { 0: 20.3, 1: 27.1, 2: 33.7, 3: 40.2, 4: 46.9, 5: 59.3, 6: 68.9, 7: 78.4 },
      left: { 1: 10.0, 2: 12.9, 3: 15.8, 4: 18.9 }
    },
    // The Raven Quill (09042)
    '09042': {
      top: { 1: 26.7, 2: 33.1, 3: 39.6, 4: 46.3, 5: 52.9, 6: 62.2, 7: 71.9 },
      left: { 1: 10.0, 2: 12.9, 3: 15.8, 4: 18.9 }
    },
    // Damning Testimony (09059)
    '09059': {
      top: { 0: 20.5, 1: 34.6, 2: 42.1, 3: 49.5, 4: 63.8, 5: 74.8 },
      left: { 1: 9.9, 2: 13.3, 3: 16.6, 4: 19.9 }
    },
    // Friends in Low Places (09060)
    '09060': {
      top: { 1: 26.2, 2: 35.9, 3: 48.4, 4: 57.9, 5: 67.3, 6: 74.0, 7: 80.5 },
      left: { 1: 9.9, 2: 12.7, 3: 15.6 }
    },
    // Honed Instinct (09061)
    '09061': {
      top: { 0: 20.9, 1: 27.5, 2: 34.2, 3: 40.5, 4: 47.3, 5: 54.0, 6: 60.5, 7: 70.1 },
      left: { 1: 9.8, 2: 12.7, 3: 15.6, 4: 18.7, 5: 22.0 }
    },
    // Living Ink (09079)
    '09079': {
      top: { 1: 27.4, 2: 38.4, 3: 52.6, 4: 63.5, 5: 67.6, 6: 71.8, 7: 82.7 },
      left: { 1: 9.8, 2: 13.2, 3: 16.6 }
    },
    // Summoned Servitor (09080)
    '09080': {
      top: { 0: 20.2, 1: 29.7, 2: 39.3, 3: 51.7, 4: 58.3, 5: 67.9, 6: 74.5, 7: 83.9 },
      left: { 1: 9.8, 2: 12.6, 3: 15.7, 4: 18.7, 5: 21.7 }
    },
    // Power Word (09081) — non-mutated
    '09081': {
      top: { 0: 20.4, 1: 30.1, 2: 39.5, 3: 49.0, 4: 58.6, 5: 65.3, 6: 74.8, 7: 81.4 },
      left: { 1: 9.8, 2: 12.6, 3: 15.6 }
    },
    // Pocket Multi Tool (09099)
    '09099': {
      top: { 0: 21.0, 1: 31.9, 2: 39.5, 3: 46.9, 4: 54.6, 5: 62.0, 6: 69.7 },
      left: { 1: 9.8, 2: 13.0, 3: 16.6, 4: 19.8 }
    },
    // Makeshift Trap (09100)
    '09100': {
      top: { 0: 21.1, 1: 28.7, 2: 39.5, 3: 46.9, 4: 57.8, 5: 68.8, 6: 79.7 },
      left: { 1: 9.8, 2: 13.2, 3: 16.6, 4: 20.1 }
    },
    // Grizzled (09101)
    '09101': {
      top: { 1: 27.3, 2: 35.5, 3: 43.5, 4: 61.6, 5: 76.5 },
      left: { 1: 9.8, 2: 13.4, 3: 16.7, 4: 20.4, 5: 23.8 }
    },
    // Hyperphysical Shotcaster (09119)
    '09119': {
      top: { 0: 20.9, 1: 30.3, 2: 42.5, 3: 57.5, 4: 69.8, 5: 82.0, 6: 88.3 },
      left: { 1: 9.8, 2: 12.6, 3: 15.6, 4: 18.7 }
    },
  }
  // Power Word (09081) — mutated tops override
  const TICK_TABLE_MUT_09081_TOP: Record<number, number> = {
    0: 20.7, 1: 30.3, 2: 36.8, 3: 46.3, 4: 55.9, 5: 62.6, 6: 72.0, 7: 78.6,
  }

  type TickParsed = { code: string; first: number; idx: number }
  const parseTickId = (id: string): TickParsed | null => {
    const m = id.match(/^customization-(\d+)-(\d+)-(\d+)$/)
    return m ? { code: m[1], first: Number(m[2]), idx: Number(m[3]) } : null
  }

  const parsedTicks = computed<TickParsed[]>(() =>
    (customizationTicks.value ?? []).map(parseTickId).filter((x): x is TickParsed => !!x)
  )

  const tickPct = (tp: TickParsed): { top?: number; left?: number } => {
    const base = TICK_TABLE[tp.code]
    if (!base) return {}
    const topMap = (tp.code === '09081' && customizationVariant.value) ? TICK_TABLE_MUT_09081_TOP : base.top
    return { top: topMap[tp.first], left: base.left[tp.idx] }
  }

  // Size for the checkmark glyph (2.8% of card width)
  const tickSize = computed(() => {
    const vbW = sideways.value ? viewH.value : VIEW_W
    return 0.028 * vbW
  })

  /** -------------------- Label auto-fit (uniform scale, no skew) --------------- **/
  type LabelFit = { scale: number; dx: number; dy: number }
  const labelRefs = new Map<string, SVGTextElement>()
  const labelFits = reactive(new Map<string, LabelFit>())
  const labelDepsSig = new Map<string, string>()
  let fitRAF: number | null = null

  const queueFit = () => {
    if (fitRAF != null) return
    fitRAF = requestAnimationFrame(() => {
      fitRAF = null
      for (const [id, textEl] of labelRefs) {
        const parent = textEl.parentElement as SVGGElement | null
        if (!parent) continue
        const w = Number(parent.getAttribute('data-w') || 0)
        const h = Number(parent.getAttribute('data-h') || 0)
        if (!(w > 0 && h > 0)) continue
        const bbox = textEl.getBBox()
        if (!(bbox.width > 0 && bbox.height > 0)) continue
        const scale = Math.min(w / bbox.width, h / bbox.height) * 0.985
        const dx = (w - bbox.width * scale) / 2 - bbox.x * scale
        const dy = (h - bbox.height * scale) / 2 - bbox.y * scale
        labelFits.set(id, { scale, dx, dy })
      }
    })
  }

  const setLabelRef = (id: string, deps: () => string): VNodeRef => (el) => {
    const textEl = el instanceof SVGTextElement ? el : null
    if (!textEl) {
      labelRefs.delete(id)
      labelFits.delete(id)
      labelDepsSig.delete(id)
      return
    }
    labelRefs.set(id, textEl)
    const sig = deps()
    if (labelDepsSig.get(id) !== sig) {
      labelDepsSig.set(id, sig)
      queueFit()
    }
  }

  const labelTransform = (id: string, item: LabelRender) => {
    const fit = labelFits.get(id)
    if (!fit) return `translate(${item.x}, ${item.y})`
    return `translate(${item.x + fit.dx}, ${item.y + fit.dy}) scale(${fit.scale})`
  }

  /** -------------------- Label geometry for specific cards -------------------- **/
  type LabelGeom = { top: number; left: number; width: number; height: number } // % units
  const LABEL_TABLE: Record<string, Record<string, LabelGeom>> = {
    // Grizzled (09101)
    '09101': {
      '0-0': { top: 18.0, left: 35.2, width: 25.0, height: 5.8 },
      '0-1': { top: 18.0, left: 64.0, width: 25.0, height: 5.8 },
      '1-0': { top: 27.5, left: 8.0,  width: 25.0, height: 5.8 },
      '2-0': { top: 35.5, left: 8.0,  width: 25.0, height: 5.8 },
    },
    // Living Ink (09079) — labels unused; circles below.
    '09079': {},
    // Friends in Low Places (09060)
    '09060': {
      '0-0': { top: 18.0, left: 29.0, width: 40.0, height: 5.0 },
      '2-0': { top: 33.4, left: 66.0, width: 25.0, height: 5.0 },
    },
    // The Raven Quill (09042)
    '09042': {
      '0-0': { top: 18.0, left: 52.0, width: 40.0, height: 5.0 },
      '4-0': { top: 46.5, left: 18.0, width: 36.0, height: 5.0 },
      '4-1': { top: 46.5, left: 55.0, width: 35.0, height: 5.0 },
    },
  }

  type LabelRender = { x: number; y: number; w: number; h: number; text: string; code: string; key: string }
  const parseLabelId = (id: string) => {
    const m = id.match(/^label-(\d+)-(\d+)-(\d+)$/)
    return m ? { code: m[1], key: `${m[2]}-${m[3]}` } : null
  }

  const rectFromPct = (r: LabelGeom) => {
    const vbW = sideways.value ? viewH.value : VIEW_W
    const vbH = sideways.value ? VIEW_W : viewH.value
    return { x: (r.left / 100) * vbW, y: (r.top / 100) * vbH, w: (r.width / 100) * vbW, h: (r.height / 100) * vbH }
  }

  const labelItems = computed<LabelRender[]>(() =>
    (customizationLabels.value ?? []).flatMap(([id, text]) => {
      const parsed = parseLabelId(id)
      if (!parsed) return []
      const table = LABEL_TABLE[parsed.code]
      if (!table) return []
      const geom = table[parsed.key]
      if (!geom) return []
      const px = rectFromPct(geom)
      return [{ x: px.x, y: px.y, w: px.w, h: px.h, text, code: parsed.code, key: parsed.key }]
    })
  )

  /** -------------------- Skills (09079 Living Ink) circles -------------------- **/
  type SkillGeom = { top: number; left: number } // % units
  const SKILL_TABLE_09079: Record<string, SkillGeom> = {
    'SkillWillpower': { top: 18.6, left: 42.5 },
    'SkillIntellect': { top: 18.6, left: 55.0 },
    'SkillCombat':    { top: 18.6, left: 68.4 },
    'SkillAgility':   { top: 18.6, left: 81.0 },
  }

  type SkillRender = { cx: number; cy: number; r: number; name: string }
  const skillItems = computed<SkillRender[]>(() => {
    if (cardCode.value !== '09079') return []
    const vbW = sideways.value ? viewH.value : VIEW_W
    const vbH = sideways.value ? VIEW_W : viewH.value
    const sizePct = 7.0
    const r = 0.5 * (sizePct / 100) * vbW
    return (customizationSkills.value ?? []).flatMap(cls => {
      const m = cls.match(/^skill-(\d+)-(.+)$/)
      if (!m) return []
      const skillName = m[2]
      const pos = SKILL_TABLE_09079[skillName]
      if (!pos) return []
      const cx = (pos.left / 100) * vbW + r
      const cy = (pos.top  / 100) * vbH + r
      return [{ cx, cy, r, name: skillName }]
    })
  })

  return {
    customizationsCard,
    parsedTicks,
    tickPct,
    tickSize,
    labelItems,
    labelTransform,
    setLabelRef,
    skillItems,
  }
}
