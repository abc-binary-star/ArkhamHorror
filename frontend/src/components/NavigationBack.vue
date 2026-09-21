<script setup lang="ts">
import { computed } from 'vue'
import { ArrowLeft } from '@lucide/vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter, type RouteLocationRaw } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { useNavigationBackContext } from '@/composables/useNavigationBack'

const route = useRoute()
const router = useRouter()
const user = useUserStore()
const { t } = useI18n()
const navigation = useNavigationBackContext()
const override = computed(() => navigation?.action.value ?? null)
const destination = computed<{ to: RouteLocationRaw; label: string }>(() => {
  const name = String(route.name)
  const event = typeof route.query.event === 'string' ? { event: route.query.event } : {}
  const back = router.options.history.state.back
  if (['Deck', 'Settings', 'Cards', 'CampaignLog', 'ReplayGame', 'JoinGame', 'ClaimSeat'].includes(name)
    && typeof back === 'string' && back.startsWith('/') && !back.startsWith('//')) {
    const previous = router.resolve(back)
    if (['Game', 'AdminGame', 'Spectate'].includes(String(previous.name))
      && (!route.params.gameId || previous.params.gameId === route.params.gameId)) {
      return { to: previous.fullPath, label: t('navigationBack.table') }
    }
  }
  if (route.params.gameId && !['Game', 'AdminGame', 'Spectate', 'JoinGame', 'ClaimSeat'].includes(name)) {
    return { to: { name: 'Game', params: { gameId: route.params.gameId }, query: event }, label: t('navigationBack.table') }
  }
  if (name === 'Deck') return { to: { name: 'Decks' }, label: t('navigationBack.decks') }
  if (name === 'Rooms' || name === 'AdminGame') return { to: { name: 'Admin' }, label: t('navigationBack.admin') }
  if (['SignUp', 'PasswordReset', 'UpdatePassword'].includes(name)) {
    return { to: { name: 'SignIn' }, label: t('navigationBack.signIn') }
  }
  if (name === 'SignIn') return { to: { name: 'About' }, label: t('navigationBack.about') }
  if (!user.currentUser) return { to: { name: 'SignIn' }, label: t('navigationBack.signIn') }
  return { to: { name: 'Home' }, label: t(route.params.gameId ? 'navigationBack.games' : 'navigationBack.home') }
})
const visible = computed(() => override.value !== null || (route.name !== 'Home' && !(route.name === 'About' && !user.currentUser)))
const label = computed(() => override.value?.label ?? destination.value.label)

function goBack() {
  if (override.value) {
    if (!override.value.disabled) override.value.run()
    return
  }
  // Only reuse history when it leads to the declared parent, never to a
  // login redirect, an unrelated page, or out of this application.
  const back = router.options.history.state.back
  const target = router.resolve(destination.value.to)
  if (typeof back === 'string' && back.startsWith('/') && !back.startsWith('//')) {
    const previous = router.resolve(back)
    if (previous.path === target.path && previous.query.event === target.query.event) {
      router.back()
      return
    }
  }
  void router.push(destination.value.to)
}
</script>

<template>
  <div class="navigation-back-slot">
    <button v-if="visible" type="button" class="navigation-back" v-tooltip="label"
      :aria-label="label" :disabled="override?.disabled" @click="goBack">
      <ArrowLeft aria-hidden="true" />
    </button>
  </div>
</template>

<style scoped>
.navigation-back-slot { flex: 0 0 36px; width: 36px; height: 36px; }
button.navigation-back {
  display: inline-flex; align-items: center; justify-content: center;
  width: 36px; height: 36px; min-height: 36px; padding: 0;
  border: 1px solid rgb(200 173 120 / 0.28); border-radius: 3px;
  background: rgb(244 239 228 / 0.02); color: #f4efe4; cursor: pointer;
}
button.navigation-back:hover:not(:disabled) { background: rgb(200 173 120 / 0.14); border-color: #c8ad78; }
button.navigation-back:focus-visible { outline: 2px solid #c8ad78; outline-offset: 2px; }
button.navigation-back:disabled { opacity: 0.45; cursor: default; }
button.navigation-back svg { width: 17px; height: 17px; stroke-width: 1.7; }
</style>
