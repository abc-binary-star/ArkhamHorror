<script lang="ts" setup>
import AuthFrame from '@/components/AuthFrame.vue'
import { ref, reactive } from 'vue'
import { useUserStore } from '@/stores/user'
import { useRoute, useRouter } from 'vue-router'
import type { Registration } from '@/types'
import { useI18n } from 'vue-i18n'

const route = useRoute()
const router = useRouter()
const store = useUserStore()
const registration = reactive<Registration>({
  username: '',
  email: '',
  password: '',
})
const signUpError = ref<string | null>(null)
const registering = ref(false)

const { t } = useI18n()

async function register() {
  signUpError.value = null
  registering.value = true
  try {
    await store.register(registration)
    const { nextUrl } = route.query
    if (nextUrl) {
      router.push({ path: nextUrl as string })
    } else {
      router.push({ path: '/' })
    }
  } catch {
    signUpError.value = t('usernameOrEmailAlreadyTaken')
  } finally {
    registering.value = false
  }
}
</script>

<template>
  <AuthFrame :title="$t('register')">
    <form @submit.prevent="register">
      <div class="error" role="alert" v-if="signUpError">{{ signUpError }}</div>
      <section>
        <div>
          <label for="auth-username">{{ $t('username') }}</label>
          <input
            id="auth-username"
            v-model="registration.username"
            autocomplete="username"
            required
            type="text"
            :placeholder="$t('username')"
          />
        </div>
        <div>
          <label for="auth-email">{{ $t('email') }}</label>
          <input
            id="auth-email"
            v-model="registration.email"
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
            v-model="registration.password"
            autocomplete="new-password"
            required
            type="password"
            :placeholder="$t('password')"
          />
        </div>
        <div>
          <button :disabled="registering">{{ $t('register') }}</button>
        </div>
      </section>
    </form>
  </AuthFrame>
</template>
