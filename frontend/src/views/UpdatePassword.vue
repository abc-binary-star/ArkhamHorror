<script lang="ts" setup>
import AuthFrame from '@/components/AuthFrame.vue'
import { reactive } from 'vue'
import { useToast } from 'vue-toastification'
import { useI18n } from 'vue-i18n'
import api from '@/api'

export interface Props {
  resetId: string
}

const props = defineProps<Props>()

interface UpdatePassword {
  password: string
}

const reset = reactive<UpdatePassword>({
  password: '',
})

const { t } = useI18n()

async function updatePassword() {
  await api.put(`password-reset/${props.resetId}`, { password: reset.password })
  toast.success(t('passwordUpdatedSuccessfully'), { timeout: 3000 })
}

const toast = useToast()
</script>

<template>
  <AuthFrame :title="$t('updatePassword')">
    <form @submit.prevent="updatePassword">
      <section>
        <div>
          <label for="auth-password">{{ $t('newPassword') }}</label>
          <input
            id="auth-password"
            v-model="reset.password"
            autocomplete="new-password"
            required
            type="password"
            :placeholder="$t('newPassword')"
          />
        </div>
        <div>
          <button>{{ $t('updatePassword') }}</button>
        </div>
      </section>
    </form>
  </AuthFrame>
</template>
