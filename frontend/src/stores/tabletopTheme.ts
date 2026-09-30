import { computed } from 'vue'
import { defineStore } from 'pinia'
import { useStorage } from '@vueuse/core'

export const tabletopThemes = ['harbour', 'zealot', 'dunwich'] as const
export type TabletopTheme = typeof tabletopThemes[number]

export const useTabletopTheme = defineStore('tabletopTheme', () => {
  // Shared across games, tabs and the fixed-resolution iframe; never sent to peers.
  const stored = useStorage<string>('arkhamTabletopTheme', 'harbour')
  const theme = computed<TabletopTheme>({
    get: () => tabletopThemes.includes(stored.value as TabletopTheme)
      ? stored.value as TabletopTheme : 'harbour',
    set: value => { stored.value = value },
  })
  return { theme }
})
