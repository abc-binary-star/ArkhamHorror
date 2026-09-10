<script lang="ts" setup>
import AuthFrame from '@/components/AuthFrame.vue'
import { reactive, ref } from 'vue'
import { useToast } from 'vue-toastification'
import { useI18n } from 'vue-i18n'
import api from '@/api'

const submitted = ref(false)
const resetError = ref<string | null>(null)
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
    await api.post('password-reset', { email: reset.email })
    // Only now: flipping this earlier told the user to check their inbox even
    // when the request had failed and no email was ever sent.
    submitted.value = true
    toast.success(t('passwordResetRequested'), { timeout: 3000 })
  } catch {
    resetError.value = t('pleaseTryAgainLater')
  } finally {
    sending.value = false
  }
}

const toast = useToast()
</script>

<template>
  <AuthFrame :title="$t('resetPassword')">
    <form v-if="!submitted" @submit.prevent="resetPassword">
      <div class="error" role="alert" v-if="resetError">{{ resetError }}</div>
      <section>
        <div>
          <label for="auth-email">{{ $t('email') }}</label>
          <input
            id="auth-email"
            v-model="reset.email"
            autocomplete="email"
            required
            type="email"
            :placeholder="$t('email')"
          />
        </div>
        <div>
          <button :disabled="sending">{{ $t('resetPassword') }}</button>
        </div>
      </section>
    </form>
    <p v-else class="auth-message" role="status">{{ $t('passwordResetInstructions') }}</p>
  </AuthFrame>
</template>
