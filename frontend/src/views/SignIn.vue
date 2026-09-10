<script lang="ts" setup>
import AuthFrame from '@/components/AuthFrame.vue'
import { useUserStore } from '@/stores/user'
import { useRoute, useRouter, onBeforeRouteLeave } from 'vue-router'
import { ref, reactive, onUnmounted } from 'vue'
import { Credentials } from '../types'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const store = useUserStore()
const route = useRoute()
const router = useRouter()
const credentials = reactive<Credentials>({
  email: '',
  password: '',
})
const signingIn = ref(false)
const signInError = ref<string | null>(null)

const health = ref<boolean>(true)

const timeoutId = ref<ReturnType<typeof setTimeout> | null>(null)
const checkHealth = async () => {
  try {
    const response = await fetch('/health')
    health.value = response.ok
  } catch {
    health.value = false
  }

  timeoutId.value = setTimeout(checkHealth, 5000)
}

await checkHealth()

async function authenticate() {
  if (signingIn.value) return
  signInError.value = null
  signingIn.value = true
  try {
    await store.authenticate(credentials)
    const { nextUrl } = route.query
    if (nextUrl) {
      router.push({ path: nextUrl as string })
    } else {
      router.push({ path: '/' })
    }
  } catch {
    signInError.value = t('invalidEmailOrPassword')
  } finally {
    signingIn.value = false
  }
}

onUnmounted(() => {
  if (timeoutId.value) clearTimeout(timeoutId.value)
})

onBeforeRouteLeave(() => {
  if (timeoutId.value) clearTimeout(timeoutId.value)
})
</script>

<template>
  <AuthFrame :title="health ? $t('logIn') : $t('serviceUnavailable')">
    <form v-if="health" @submit.prevent="authenticate" :aria-busy="signingIn">
      <div class="error" role="alert" v-if="signInError">{{ signInError }}</div>
      <section>
        <div>
          <label for="auth-email">{{ $t('email') }}</label>
          <input
            id="auth-email"
            v-model="credentials.email"
            autocomplete="email"
            required
            type="email"
            :placeholder="$t('email')"
          />
        </div>
        <div>
          <label for="auth-password">{{ $t('password') }}</label>
          <input
            id="auth-password"
            v-model="credentials.password"
            autocomplete="current-password"
            required
            type="password"
            :placeholder="$t('password')"
          />
        </div>
        <div>
          <button :disabled="signingIn">
            {{ signingIn ? $t('loadState.loading') : $t('logIn') }}
          </button>
        </div>
      </section>
      <section class="auth-links">
        <router-link to="/password-reset">{{ $t('forgotPassword') }}</router-link>
      </section>
    </form>
    <p v-else class="auth-message" role="status">{{ $t('pleaseTryAgainLater') }}</p>
  </AuthFrame>
</template>
