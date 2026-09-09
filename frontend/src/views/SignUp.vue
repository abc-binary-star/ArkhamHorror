<script lang="ts" setup>
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
const signUpError = ref<string|null>(null)
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
    signUpError.value = t("usernameOrEmailAlreadyTaken")
  } finally {
    registering.value = false
  }
}
</script>

<template>
  <form @submit.prevent="register">
    <header><i class="secret"></i></header>
    <div class="error" v-if="signUpError">{{signUpError}}</div>
    <section>
      <div>
        <input
          v-model="registration.username"
          type="text"
          :placeholder="$t('username')"
        />
      </div>
      <div>
        <input
          v-model="registration.email"
          type="email"
          :placeholder="$t('email')"
        />
      </div>
      <div>
        <input
          v-model="registration.password"
          type="password"
          :placeholder="$t('password')"
        />
      </div>
      <div>
        <button :disabled="registering">{{$t('register')}}</button>
      </div>
    </section>
  </form>
</template>

<style scoped>
form {
  margin: 10vh auto 0;
  width: min(90vw, 400px);
  flex: 0 0 auto;
  padding: 22px;
  border: var(--edge-width) solid var(--edge-dim);
  border-radius: var(--radius-lg);
  background-image: var(--panel-gradient);
  box-shadow: var(--shadow-5);
}

section {
  padding: 0;
}

header {
  text-align: center;
  margin-bottom: 14px;
}

input {
  outline: 0;
  width: 100%;
  margin-bottom: 10px;
  padding: 12px;
  background: var(--input-background);
  border: var(--edge-width) solid var(--edge-dim);
  border-radius: var(--radius-md);
  color: var(--text);
  font-size: 0.9rem;
  transition: border-color 120ms ease, box-shadow 80ms ease;

  &:hover { border-color: var(--edge); }
  &:focus { border-color: var(--spooky-green); box-shadow: var(--shadow-2); }
}

button {
  outline: 0;
  width: 100%;
  padding: 12px;
  background: var(--spooky-green);
  border: var(--edge-width) solid var(--edge-on-accent);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-3);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--button-1-text);
  font-weight: var(--font-black);
  cursor: pointer;
  transition: transform 80ms ease, box-shadow 80ms ease, filter 120ms ease;

  &:hover {
    filter: brightness(1.1);
    transform: translateY(-2px);
  }

  &:active {
    transform: translate(1px, 1px);
    box-shadow: none;
  }
}

.error {
  background: var(--survivor-extra-dark);
  color: #ffe3df;
  border: var(--edge-width) solid var(--survivor-dark);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-2);
  margin-bottom: 14px;
  padding: 8px 12px;
  font-size: 0.82rem;
  font-weight: var(--font-bold);
}

i.secret {
  font-family: 'Arkham';
  font-style: normal;
  font-weight: normal;
  font-variant: normal;
  text-transform: none;
  line-height: 1;
  font-size: 5em;
  color: var(--brass);
  text-shadow: 0 0 22px rgba(176, 141, 63, 0.32), 3px 3px 0 var(--ink);
  -webkit-font-smoothing: antialiased;
  position: relative;

  &:before {
    font-family: "Arkham";
    content: "\0048";
  }
}
</style>
