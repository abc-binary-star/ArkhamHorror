import { useCardStore } from '@/stores/cards'
import { cardImg } from '@/arkham/helpers'
import { cardFaceImages, cardHasDistinctBack } from '@/arkham/cardImages'
import { toCardContents } from '@/arkham/types/Card'
import type { Game } from '@/arkham/types/Game'

// Warms the browser cache with every card image a game can show, so revealing a
// card does not stall on the CDN. The cache is per-component-instance: a fresh
// game gets a fresh set, and re-entering the same game re-checks cheaply.
export function useImagePreloader() {
  const store = useCardStore()
  const preloaded = new Set<string>()
  const preloading = new Set<string>()

  async function loadImages(urls: string[]): Promise<void> {
    const pending = [...new Set(urls)].filter((url) => !preloaded.has(url) && !preloading.has(url))
    if (pending.length === 0) return
    pending.forEach((url) => preloading.add(url))

    await Promise.all(
      pending.map(
        (url) =>
          new Promise<void>((resolve) => {
            const img = new Image()
            img.onload = () => {
              preloaded.add(url)
              preloading.delete(url)
              resolve()
            }
            img.onerror = () => {
              preloaded.add(url)
              preloading.delete(url)
              console.warn(`Could not preload ${url}`)
              resolve()
            }
            img.src = url
          }),
      ),
    )
  }

  async function loadAllImages(game: Game): Promise<void> {
    const cards = Object.values(game.cards)
    const visibleImages = cards.map((card) => {
      const { cardCode, isFlipped } = toCardContents(card)
      return cardImg(`${cardCode.replace(/^c/, '')}${isFlipped ? 'b' : ''}`)
    })

    // Start visible art immediately; card definitions may still be loading.
    const visibleLoad = loadImages(visibleImages)
    const cardDefs = store.loaded ? store.cards : await store.fetchCards()

    if (cardDefs) {
      const defsByCode = new Map<string, (typeof cardDefs)[number]>()
      for (const cardDef of cardDefs) {
        defsByCode.set(cardDef.cardCode.replace(/^c/, ''), cardDef)
        defsByCode.set(cardDef.art.replace(/^c/, ''), cardDef)
      }

      const reverseImages = cards.flatMap((card) => {
        const cardDef = defsByCode.get(toCardContents(card).cardCode.replace(/^c/, ''))
        if (!cardDef || !cardHasDistinctBack(cardDef)) return []

        const { front, back } = cardFaceImages(cardDef)
        return back ? [front, back] : [front]
      })
      await Promise.all([visibleLoad, loadImages(reverseImages)])
      return
    }

    await visibleLoad
  }

  function preloadImages(game: Game): void {
    void loadAllImages(game).catch((e: unknown) => {
      console.error(e)
    })
  }

  return { preloadImages }
}
