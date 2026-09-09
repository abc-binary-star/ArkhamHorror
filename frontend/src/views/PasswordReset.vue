<script lang="ts" setup>
import { reactive, ref } from 'vue'
import { useToast } from "vue-toastification";
import { useI18n } from 'vue-i18n';
import api from '@/api';

const submitted = ref(false)
const resetError = ref<string|null>(null)
const sending = ref(false)

interface PasswordReset {
  email: string
}

const reset = reactive<PasswordReset>({
  email: '',
})

const { t } = useI18n()

async function resetPassword() {
  resetError.value = null
  sending.value = true
  try {
    await api.post('password-reset', { email : reset.email })
    // Only now: flipping this earlier told the user to check their inbox even
    // when the request had failed and no email was ever sent.
    submitted.value = true
    toast.success(t("passwordResetRequested"), { timeout: 3000 })
  } catch {
    resetError.value = t('pleaseTryAgainLater')
  } finally {
    sending.value = false
  }
}

const toast = useToast()
</script>

<template>
  <form v-if="!submitted" @submit.prevent="resetPassword">
    <header><i class="secret"></i></header>
    <div class="error" v-if="resetError">{{resetError}}</div>
    <section>
      <div>
        <input
          v-model="reset.email"
          type="email"
          :placeholder="$t('email')"
        />
      </div>
      <div>
        <button :disabled="sending">{{$t('resetPassword')}}</button>
      </div>
    </section>
  </form>
  <div v-else class="container box">
    <p>Check your email inbox (and spam folder) for instructions on how to reset your password.</p>
  </div>
</template>

<style scoped>
form, .container {
  margin: 0 auto;
  margin-top: 10vh;
  width: 50vw;
  max-width: 400px;
}

header {
  text-align: center;
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

i.secret {
  font-family: 'Arkham';
  font-style: normal;
  font-weight: normal;
  font-variant: normal;
  text-transform: none;
  line-height: 1;
  font-size: 5em;
  color: var(--brass);
  text-shadow: 0 0 18px rgba(176, 141, 63, 0.22), 2px 2px 0 var(--ink);
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
</style>
