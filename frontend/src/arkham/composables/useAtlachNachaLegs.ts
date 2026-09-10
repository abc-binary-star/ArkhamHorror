import { nextTick, onBeforeUnmount, onMounted, onUpdated, ref } from 'vue'
import { waitForImagesToLoad } from '@/arkham/helpers'

// Atlach-Nacha (c06333): the spider's body and its four legs sit on separate
// grid pieces and must rotate together around the body card's centre.
export function useAtlachNachaLegs(scenarioId: () => string) {
  const needsInit = ref(true)
  const previousRotation = ref(0)
  const legsSet = ref(['legs1', 'legs2', 'legs3', 'legs4'])

  let legObserver: MutationObserver | null = null

  function rotateImages(init: boolean) {
    const atlachNacha = document.querySelector('[data-label=atlachNacha]') as HTMLElement
    const locationCards = document.querySelector('.location-cards')
    if (atlachNacha && locationCards) {
      needsInit.value = false
      const inLocation = locationCards.querySelector('[data-label=atlachNacha]')

      if (inLocation) {
        ;['legs1', 'legs2', 'legs3', 'legs4'].forEach((legs) => {
          const legsDiv = locationCards.querySelector(`[data-label=${legs}]`)
          if (!legsDiv) {
            legsSet.value = legsSet.value.filter((item) => item !== legs)

            const newDiv = document.createElement('div')
            newDiv.setAttribute('data-label', legs) // Setting the data-label attribute
            newDiv.style.width = '60px' // Setting the width of the div
            newDiv.style.height = '84px' // Setting the width of the div
            newDiv.style.gridArea = legs // Assuming 'legs1' is a valid grid-area name

            locationCards.appendChild(newDiv) // Append the new div to the parent container
          }
        })
      }

      // Guard: don't clobber the rotation with a transient 0/NaN from the
      // backend's data attribute.
      const raw = atlachNacha.dataset?.rotation
      const parsed = Number(raw)
      const hasValid = raw != null && !Number.isNaN(parsed)
      const degrees = hasValid ? parsed : previousRotation.value
      const middleCardImg = atlachNacha.querySelector('img')
      if (!middleCardImg) return
      const middleCardRect = atlachNacha.getBoundingClientRect()
      const middleCardImgRect = middleCardImg.getBoundingClientRect()
      const originX = middleCardImgRect.left + middleCardImgRect.width / 2 - middleCardRect.left
      const originY = middleCardImgRect.top + middleCardImgRect.height / 2 - middleCardRect.top

      if (init) atlachNacha.style.transformOrigin = `${originX}px ${originY}px`
      atlachNacha.style.transition = 'none'
      atlachNacha.style.transform = `rotate(${previousRotation.value}deg)`
      const oX = middleCardImgRect.left + middleCardImgRect.width / 2
      const oY = middleCardImgRect.top + middleCardImgRect.height / 2

      document
        .querySelectorAll(
          '[data-label=legs1],[data-label=legs2],[data-label=legs3],[data-label=legs4]',
        )
        .forEach((el) => {
          const img = el as HTMLElement
          const label = img.dataset.label
          if (!label) return

          if (init || !legsSet.value.includes(label)) {
            if (!legsSet.value.includes(label)) {
              legsSet.value = [...legsSet.value, label]
            }
            const thisRect = img.getBoundingClientRect()
            const thisX = thisRect.left
            const thisY = thisRect.top
            img.style.transformOrigin = `${oX - thisX}px ${oY - thisY}px`
          }
          img.style.transition = 'none'
          img.style.transform = `rotate(${previousRotation.value}deg)`
        })
      if (hasValid && degrees !== previousRotation.value) {
        previousRotation.value = degrees
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            atlachNacha.style.transform = `rotate(${previousRotation.value}deg)`
            atlachNacha.style.transition = 'transform 0.5s'
            document
              .querySelectorAll(
                '[data-label=legs1],[data-label=legs2],[data-label=legs3],[data-label=legs4]',
              )
              .forEach((el) => {
                const img = el as HTMLElement
                img.style.transition = 'transform 0.5s'
                img.style.transform = `rotate(${degrees}deg)`
              })
          })
        })
      }
    }
  }

  onMounted(() => {
    if (scenarioId() !== 'c06333') return
    waitForImagesToLoad(() => {
      nextTick(() => rotateImages(true))

      // Observe for legs added back in (undo etc.) and immediately apply rotation
      const locationCards = document.querySelector('.location-cards') as HTMLElement | null
      const atlachNacha = document.querySelector('[data-label=atlachNacha]') as HTMLElement | null
      if (locationCards && atlachNacha) {
        const middleCardImg = atlachNacha.querySelector('img') as HTMLImageElement | null
        const computeOrigin = () => {
          if (!middleCardImg) return null
          const middleCardRect = atlachNacha.getBoundingClientRect()
          const middleCardImgRect = middleCardImg.getBoundingClientRect()
          const originX = middleCardImgRect.left + middleCardImgRect.width / 2 - middleCardRect.left
          const originY = middleCardImgRect.top + middleCardImgRect.height / 2 - middleCardRect.top
          const oX = middleCardImgRect.left + middleCardImgRect.width / 2
          const oY = middleCardImgRect.top + middleCardImgRect.height / 2
          return { originX, originY, oX, oY }
        }

        const applyLegTransform = (el: HTMLElement) => {
          const o = computeOrigin()
          if (!o) return
          // set container origin if needed (harmless if repeated)
          atlachNacha.style.transformOrigin = `${o.originX}px ${o.originY}px`
          const r = el.getBoundingClientRect()
          el.style.transformOrigin = `${o.oX - r.left}px ${o.oY - r.top}px`
          el.style.transition = 'transform 0.5s'
          el.style.transform = `rotate(${previousRotation.value}deg)`
        }

        // run once for any current legs missing transform (e.g., first mount)
        locationCards
          .querySelectorAll<HTMLElement>(
            '[data-label=legs1],[data-label=legs2],[data-label=legs3],[data-label=legs4]',
          )
          .forEach(applyLegTransform)

        legObserver = new MutationObserver((muts) => {
          for (const m of muts) {
            if (m.type === 'childList' && (m.addedNodes?.length ?? 0) > 0) {
              m.addedNodes.forEach((n) => {
                if (!(n instanceof HTMLElement)) return
                const maybeApply = (el: HTMLElement) => {
                  const label = el.dataset?.label
                  if (
                    label &&
                    (label === 'legs1' ||
                      label === 'legs2' ||
                      label === 'legs3' ||
                      label === 'legs4')
                  ) {
                    applyLegTransform(el)
                  }
                }
                // node itself
                maybeApply(n)
                // or any legs inside subtree
                n.querySelectorAll?.(
                  '[data-label=legs1],[data-label=legs2],[data-label=legs3],[data-label=legs4]',
                )?.forEach((el) => maybeApply(el as HTMLElement))
              })
            }
          }
        })
        legObserver.observe(locationCards, { childList: true, subtree: true })
      }
    })
  })

  onUpdated(() => {
    if (scenarioId() !== 'c06333') return
    nextTick(() => rotateImages(needsInit.value))
  })

  onBeforeUnmount(() => {
    legObserver?.disconnect()
    legObserver = null
  })

  return { rotateImages }
}
