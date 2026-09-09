<script lang="ts" setup>
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
const signInError = ref<string|null>(null)

const health = ref<boolean>(true)

const timeoutId = ref<ReturnType<typeof setTimeout> | null>(null)
const checkHealth = async () => {
  try {
    const response = await fetch("/health")
    health.value = response.ok
  } catch {
    health.value = false
  }

  timeoutId.value = setTimeout(checkHealth, 5000)
}

await checkHealth()

async function authenticate() {
  signInError.value = null
  try {
    await store.authenticate(credentials)
    const { nextUrl } = route.query
    if (nextUrl) {
      router.push({ path: nextUrl as string })
    } else {
      router.push({ path: '/' })
    }
  } catch {
    signInError.value = t("invalidEmailOrPassword")
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
  <form v-if="health" @submit.prevent="authenticate">
    <header><i class="secret"></i></header>
    <div class="error" v-if="signInError">{{signInError}}</div>
    <section>
      <div>
        <input
          v-model="credentials.email"
          type="email"
          :placeholder="$t('email')"
        />
      </div>
      <div>
        <input
          v-model="credentials.password"
          type="password"
          :placeholder="$t('password')"
        />
      </div>
      <div>
        <button>{{$t('logIn')}}</button>
      </div>
    </section>
    <section>
      <router-link to="/password-reset">{{$t('forgotPassword')}}</router-link>
    </section>
  </form>
  <div v-else class="service-down">
    <div class="service-down-card">
      <h1>{{$t('serviceUnavailable')}}</h1>
      <p>{{$t('pleaseTryAgainLater')}}</p>
    </div>
  </div>
</template>

<style scoped>
form {
  margin: 12vh auto 0;
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

section a {
  display: block;
  margin-top: 14px;
  text-align: center;
  color: var(--text-faint);
  font-size: 0.78rem;
  font-weight: var(--font-bold);
  letter-spacing: 0.04em;
  text-decoration: none;
  transition: color 120ms ease;

  &:hover { color: var(--spooky-green); text-decoration: underline; }
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

.service-down {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
  padding: 20px;
  box-sizing: border-box;
}

.service-down-card {
  background-image: var(--panel-gradient);
  border: var(--edge-width) solid var(--edge-dim);
  color: var(--text-dim);
  padding: 2rem 3rem;
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-5);
  text-align: center;
  max-width: 400px;
}

.service-down-card h1 {
  text-transform: uppercase;
  font-family: 'Teutonic', sans-serif;
  font-weight: var(--font-black);
  letter-spacing: 0.06em;
  font-size: 1.8rem;
  margin-bottom: 0.75rem;
  color: var(--title);
  text-shadow: 2px 2px 0 var(--ink);
}

.service-down-card p {
  font-size: 1rem;
  color: var(--text-dim);
}
</style>
