import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch, type ComputedRef, type Ref } from 'vue'
import { waitForImagesToLoad } from '@/arkham/helpers'
import { gameLocalStorageKey, getGameLocalStorageItem } from '@/arkham/localStorage'

const cosmicEmissaryLabels = [
  'cosmicEmissaryPhantasm',
  'cosmicEmissaryAbyss',
  'cosmicEmissaryBrilliance',
  'cosmicEmissaryMiasma',
] as const

type CosmicEmissaryLabel = (typeof cosmicEmissaryLabels)[number]

const cosmicEmissaryLocationLabels: Record<CosmicEmissaryLabel, string> = {
  cosmicEmissaryPhantasm: 'mirrorNestLeft',
  cosmicEmissaryAbyss: 'mirrorNestTop',
  cosmicEmissaryBrilliance: 'mirrorNestBottom',
  cosmicEmissaryMiasma: 'mirrorNestRight',
}

type StyleMap = Record<string, Record<string, string>>

function readStyleMapCache(key: string): StyleMap {
  try {
    const cached = JSON.parse(sessionStorage.getItem(key) ?? '{}') as StyleMap
    for (const style of Object.values(cached)) {
      const match = style.transform?.match(/^translate\(([^,]+),\s*([^\)]+)\)$/)
      if (match) {
        style.translate = `${match[1]} ${match[2]}`
        delete style.transform
      }
    }
    return cached
  } catch {
    return {}
  }
}

function writeStyleMapCache(key: string, value: StyleMap) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Ignore storage failures; the in-memory ref still prevents normal update hops.
  }
}

function transformTranslate(el: HTMLElement): { x: number; y: number } {
  const style = getComputedStyle(el)
  const translate = style.translate
  if (translate && translate !== 'none') {
    const [x = '0px', y = '0px'] = translate.split(/\s+/)
    return { x: parseFloat(x) || 0, y: parseFloat(y) || 0 }
  }

  const transform = style.transform
  if (!transform || transform === 'none') return { x: 0, y: 0 }
  const matrix = new DOMMatrixReadOnly(transform)
  return { x: matrix.e, y: matrix.f }
}

function styleMapsEqual(a: StyleMap, b: StyleMap): boolean {
  const aKeys = Object.keys(a)
  const bKeys = Object.keys(b)
  if (aKeys.length !== bKeys.length) return false
  return aKeys.every((key) => {
    const aStyle = a[key]
    const bStyle = b[key]
    if (!bStyle) return false
    const aStyleKeys = Object.keys(aStyle)
    const bStyleKeys = Object.keys(bStyle)
    return (
      aStyleKeys.length === bStyleKeys.length &&
      aStyleKeys.every((styleKey) => aStyle[styleKey] === bStyle[styleKey])
    )
  })
}

export function useCosmicEmissaryCompact(options: {
  gameId: () => string
  scenarioId: () => string
  locations: ComputedRef<Array<{ id: string; label: string }>>
  enemiesAsLocations: ComputedRef<Array<{ id: string; asSelfLocation: string | null }>>
  rotationSteps: Ref<number>
  zoom: Ref<number>
  locationsUnlocked: Ref<boolean>
  hasManualLocationOffset: (el: HTMLElement) => boolean
}) {
  const {
    gameId,
    scenarioId,
    locations,
    enemiesAsLocations,
    rotationSteps,
    zoom,
    locationsUnlocked,
    hasManualLocationOffset,
  } = options

  let cosmicEmissaryObserver: MutationObserver | null = null
  let cosmicEmissaryResizeObserver: ResizeObserver | null = null
  let cosmicEmissaryCompactRequest: number | null = null
  let cosmicEmissaryCompactForce = false

  const cosmicEmissaryEnemyStylesCacheKey = gameLocalStorageKey(
    gameId(),
    'cosmicEmissaryEnemyStyles',
  )
  const cosmicEmissaryLocationCellStylesCacheKey = gameLocalStorageKey(
    gameId(),
    'cosmicEmissaryLocationCellStyles',
  )
  const cosmicEmissaryAnimationSettingKey = gameLocalStorageKey(
    gameId(),
    'enableCosmicEmissaryAnimation',
  )
  const cachedCosmicEmissaryEnemyStyles = readStyleMapCache(cosmicEmissaryEnemyStylesCacheKey)
  const cachedCosmicEmissaryLocationCellStyles = readStyleMapCache(
    cosmicEmissaryLocationCellStylesCacheKey,
  )
  const cosmicEmissaryEnemyStyles = ref<StyleMap>(cachedCosmicEmissaryEnemyStyles)
  const cosmicEmissaryLocationCellStyles = ref<StyleMap>(cachedCosmicEmissaryLocationCellStyles)
  const cosmicEmissaryFormationHasMeasured = ref(
    Object.keys(cachedCosmicEmissaryEnemyStyles).length > 0,
  )
  const enableCosmicEmissaryAnimation = ref(
    getGameLocalStorageItem(gameId(), 'enableCosmicEmissaryAnimation') === null
      ? getGameLocalStorageItem(gameId(), 'disableCosmicEmissaryAnimation') !== 'true'
      : getGameLocalStorageItem(gameId(), 'enableCosmicEmissaryAnimation') !== 'false',
  )

  function clearCosmicEmissaryCompactStyles() {
    cosmicEmissaryEnemyStyles.value = {}
    cosmicEmissaryLocationCellStyles.value = {}
    sessionStorage.removeItem(cosmicEmissaryEnemyStylesCacheKey)
    sessionStorage.removeItem(cosmicEmissaryLocationCellStylesCacheKey)
    cosmicEmissaryFormationHasMeasured.value = false
  }

  function requestCosmicEmissaryCompact(force = false) {
    cosmicEmissaryCompactForce = cosmicEmissaryCompactForce || force
    if (cosmicEmissaryCompactRequest !== null) return
    cosmicEmissaryCompactRequest = requestAnimationFrame(() => {
      const shouldForce = cosmicEmissaryCompactForce
      cosmicEmissaryCompactForce = false
      cosmicEmissaryCompactRequest = null
      compactCosmicEmissaryFormation(shouldForce)
    })
  }

  function updateCosmicEmissaryAnimationSetting(value: string | null) {
    enableCosmicEmissaryAnimation.value = value !== 'false'
    nextTick(() => compactCosmicEmissaryFormation())
  }

  const onCosmicEmissaryStorage = (event: StorageEvent) => {
    if (event.key === cosmicEmissaryAnimationSettingKey)
      updateCosmicEmissaryAnimationSetting(event.newValue)
  }

  const onCosmicEmissarySettingChange = (event: Event) => {
    const detail = (event as CustomEvent<{ key?: string; value?: string }>).detail
    if (detail?.key === cosmicEmissaryAnimationSettingKey)
      updateCosmicEmissaryAnimationSetting(detail.value ?? null)
  }

  const cosmicEmissaryLayoutSignature = computed(() => {
    if (scenarioId() !== 'c10651') return ''
    return [
      locations.value.map((l) => `${l.id}:${l.label}`).join('|'),
      enemiesAsLocations.value.map((e) => `${e.id}:${e.asSelfLocation}`).join('|'),
    ].join('::')
  })
  watch(
    [cosmicEmissaryLayoutSignature, rotationSteps, zoom],
    () => nextTick(requestCosmicEmissaryCompact),
    { flush: 'post' },
  )

  function compactCosmicEmissaryFormation(force = false) {
    if (scenarioId() !== 'c10651' || (locationsUnlocked.value && !force)) return

    const entries = cosmicEmissaryLabels.map((label) => {
      const el = document.querySelector(`[data-label=${label}]`) as HTMLElement | null
      return el ? ([label, el] as const) : null
    })

    if (entries.some((entry) => entry === null)) {
      if (
        Object.keys(cosmicEmissaryEnemyStyles.value).length > 0 ||
        Object.keys(cosmicEmissaryLocationCellStyles.value).length > 0
      ) {
        clearCosmicEmissaryCompactStyles()
      }
      return
    }

    const elements = Object.fromEntries(entries as [CosmicEmissaryLabel, HTMLElement][]) as Record<
      CosmicEmissaryLabel,
      HTMLElement
    >

    const locationElements = Object.fromEntries(
      cosmicEmissaryLabels.map((label) => [
        label,
        document.querySelector(
          `.location-cell[data-label=${cosmicEmissaryLocationLabels[label]}]`,
        ) as HTMLElement | null,
      ]),
    ) as Record<CosmicEmissaryLabel, HTMLElement | null>

    requestAnimationFrame(() => {
      const locationCards = document.querySelector('.location-cards') as HTMLElement | null
      const visualScale = locationCards
        ? new DOMMatrixReadOnly(getComputedStyle(locationCards).transform).a || 1
        : 1
      const rectFor = (el: HTMLElement) => {
        const rectEl = (el.querySelector('img.card') ?? el) as HTMLElement
        const rect = rectEl.getBoundingClientRect()
        const existing = transformTranslate(el)
        // Measure the element's natural grid position without removing its current
        // transform. This keeps the compacted positions in the VDOM between game
        // updates, so cards don't snap outward before this rAF runs again.
        return {
          left: rect.left - existing.x * visualScale,
          top: rect.top - existing.y * visualScale,
          width: rect.width,
          height: rect.height,
        }
      }
      const rects = Object.fromEntries(
        Object.entries(elements).map(([label, el]) => [label, rectFor(el as HTMLElement)]),
      ) as Record<CosmicEmissaryLabel, { left: number; top: number; width: number; height: number }>

      const centerX =
        cosmicEmissaryLabels.reduce(
          (acc, label) => acc + rects[label].left + rects[label].width / 2,
          0,
        ) / cosmicEmissaryLabels.length
      const centerY =
        cosmicEmissaryLabels.reduce(
          (acc, label) => acc + rects[label].top + rects[label].height / 2,
          0,
        ) / cosmicEmissaryLabels.length

      const targets: Record<CosmicEmissaryLabel, { left: number; top: number }> = {
        cosmicEmissaryPhantasm: {
          left: centerX - rects.cosmicEmissaryPhantasm.width,
          top: centerY - rects.cosmicEmissaryPhantasm.height,
        },
        cosmicEmissaryAbyss: {
          left: centerX,
          top: centerY - rects.cosmicEmissaryAbyss.height,
        },
        cosmicEmissaryBrilliance: {
          left: centerX - rects.cosmicEmissaryBrilliance.width,
          top: centerY,
        },
        cosmicEmissaryMiasma: {
          left: centerX,
          top: centerY,
        },
      }

      const nextEnemyStyles: StyleMap = {}
      const nextLocationCellStyles: StyleMap = {}
      const transition =
        !enableCosmicEmissaryAnimation.value || cosmicEmissaryFormationHasMeasured.value
          ? 'none'
          : 'transform 0.2s ease'

      for (const label of cosmicEmissaryLabels) {
        const rect = rects[label]
        const target = targets[label]
        const dx = Math.round(((target.left - rect.left) / visualScale) * 10) / 10
        const dy = Math.round(((target.top - rect.top) / visualScale) * 10) / 10
        nextEnemyStyles[label] = {
          translate: `${dx}px ${dy}px`,
          transition,
          zIndex: 'var(--z-index-20)',
        }

        const locationEl = locationElements[label]
        const locationLabel = cosmicEmissaryLocationLabels[label]
        if (locationEl && hasManualLocationOffset(locationEl)) {
          const existing = cosmicEmissaryLocationCellStyles.value[locationLabel]
          if (existing) nextLocationCellStyles[locationLabel] = existing
        } else if (locationEl) {
          const shouldAlignVerticalMidpoint =
            label === 'cosmicEmissaryPhantasm' || label === 'cosmicEmissaryMiasma'
          const locationDy = shouldAlignVerticalMidpoint
            ? (() => {
                const locationRect = rectFor(locationEl)
                const enemyCenterY = rect.top + rect.height / 2
                const locationCenterY = locationRect.top + locationRect.height / 2
                return Math.round((dy + (enemyCenterY - locationCenterY) / visualScale) * 10) / 10
              })()
            : dy

          nextLocationCellStyles[locationLabel] = {
            translate: `${dx}px ${locationDy}px`,
            transition,
            zIndex: 'var(--z-index-10)',
          }
        }
      }

      const enemyStylesChanged = !styleMapsEqual(cosmicEmissaryEnemyStyles.value, nextEnemyStyles)
      const locationCellStylesChanged = !styleMapsEqual(
        cosmicEmissaryLocationCellStyles.value,
        nextLocationCellStyles,
      )
      if (enemyStylesChanged) {
        cosmicEmissaryEnemyStyles.value = nextEnemyStyles
        writeStyleMapCache(cosmicEmissaryEnemyStylesCacheKey, nextEnemyStyles)
      }
      if (locationCellStylesChanged) {
        cosmicEmissaryLocationCellStyles.value = nextLocationCellStyles
        writeStyleMapCache(cosmicEmissaryLocationCellStylesCacheKey, nextLocationCellStyles)
      }
      if (enemyStylesChanged || locationCellStylesChanged) {
        nextTick(() => window.dispatchEvent(new Event('arkham-location-layout-change')))
      }
      cosmicEmissaryFormationHasMeasured.value = true
    })
  }

  onMounted(() => {
    window.addEventListener('storage', onCosmicEmissaryStorage)
    window.addEventListener('arkham-setting-change', onCosmicEmissarySettingChange)

    if (scenarioId() === 'c10651') {
      nextTick(requestCosmicEmissaryCompact)
      setTimeout(requestCosmicEmissaryCompact, 100)
      setTimeout(requestCosmicEmissaryCompact, 500)
      setTimeout(requestCosmicEmissaryCompact, 1500)

      const setupCosmicEmissaryObservers = () => {
        const locationCards = document.querySelector('.location-cards') as HTMLElement | null
        if (!locationCards || cosmicEmissaryObserver) return

        cosmicEmissaryObserver = new MutationObserver(() => nextTick(requestCosmicEmissaryCompact))
        cosmicEmissaryObserver.observe(locationCards, { childList: true, subtree: true })

        cosmicEmissaryResizeObserver = new ResizeObserver(() => requestCosmicEmissaryCompact())
        cosmicEmissaryResizeObserver.observe(locationCards)
        locationCards
          .querySelectorAll<HTMLElement>('[data-label]')
          .forEach((el) => cosmicEmissaryResizeObserver?.observe(el))
      }

      nextTick(setupCosmicEmissaryObservers)
      waitForImagesToLoad(() => {
        setupCosmicEmissaryObservers()
        requestCosmicEmissaryCompact()
      })
    }
  })

  onBeforeUnmount(() => {
    window.removeEventListener('storage', onCosmicEmissaryStorage)
    window.removeEventListener('arkham-setting-change', onCosmicEmissarySettingChange)
    cosmicEmissaryObserver?.disconnect()
    cosmicEmissaryObserver = null
    cosmicEmissaryResizeObserver?.disconnect()
    cosmicEmissaryResizeObserver = null
    if (cosmicEmissaryCompactRequest !== null) cancelAnimationFrame(cosmicEmissaryCompactRequest)
    cosmicEmissaryCompactRequest = null
  })

  return {
    enableCosmicEmissaryAnimation,
    cosmicEmissaryEnemyStyles,
    cosmicEmissaryLocationCellStyles,
    clearCosmicEmissaryCompactStyles,
    requestCosmicEmissaryCompact,
  }
}
