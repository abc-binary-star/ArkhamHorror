<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft } from '@lucide/vue'

const route = useRoute()
const router = useRouter()
const fallback = computed(() => {
  if (route.params.gameId) return { name: 'Game', params: { gameId: route.params.gameId } }
  if (route.name === 'Deck') return { name: 'Decks' }
  if (route.name === 'Rooms') return { name: 'Admin' }
  if (['SignUp', 'PasswordReset', 'UpdatePassword'].includes(String(route.name))) return { name: 'SignIn' }
  if (route.name === 'SignIn') return { name: 'About' }
  return { name: 'Home' }
})
function goBack(event: MouseEvent) {
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return
  const back = router.options.history.state.back
  // Direct links still have a destination; never send the player to an
  // unrelated external page simply because browser history is non-empty.
  if (typeof back === 'string' && back.startsWith('/') && !back.startsWith('//') && back !== route.fullPath) {
    event.preventDefault()
    router.back()
  } else {
    event.preventDefault()
    void router.push(fallback.value)
  }
}
</script>

<template>
  <div class="page-back-bar">
    <a :href="router.resolve(fallback).href" @click="goBack"><ArrowLeft aria-hidden="true" /><span>{{ $t('back') }}</span></a>
  </div>
</template>

<style scoped>
.page-back-bar { flex: 0 0 auto; padding: 6px max(16px, env(safe-area-inset-left)); background: var(--background-dark); border-bottom: 1px solid var(--box-border); }
.page-back-bar a { display: inline-flex; align-items: center; gap: 6px; min-height: 32px; padding: 4px 10px; color: var(--text); text-decoration: none; border-radius: 6px; }
.page-back-bar a:hover { background: var(--surface-raised); }
.page-back-bar svg { width: 18px; height: 18px; }
</style>
