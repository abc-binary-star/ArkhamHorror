<script lang="ts" setup>
import { reactive } from 'vue'
import { useToast } from "vue-toastification";
import { useI18n } from 'vue-i18n';
import api from '@/api';

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
  await api.put(`password-reset/${props.resetId}`, { password : reset.password })
  toast.success(t("passwordUpdatedSuccessfully"), { timeout: 3000 })
}

const toast = useToast()
</script>

<template>
  <form @submit.prevent="updatePassword">
    <header><i class="secret"></i></header>
    <section>
      <div>
        <input
          v-model="reset.password"
          type="password"
          :placeholder="$t('newPassword')"
        />
      </div>
      <div>
        <button>{{$t('updatePassword')}}</button>
      </div>
    </section>
  </form>
</template>

<style scoped>
form {
  margin: 0 auto;
  margin-top: 10vh;
  width: 50vw;
  max-width: 400px;
}

section {
  background-image: var(--panel-gradient);
  border: var(--edge-width) solid var(--edge-dim);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-4);
  padding: 14px;
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
  background:#E3CCCD;
  color: #900000;
  border-radius: 5px;
  margin: 10px 5px;
  padding: 5px 10px;
}
</style>
