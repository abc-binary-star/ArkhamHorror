<script lang="ts" setup>
import AtmosphereLine from '@/arkham/components/AtmosphereLine.vue'
import type { AtmosphereTone } from '@/arkham/atmosphere'
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { handleEmbeddedI18n } from '@/arkham/i18n'

const { t } = useI18n()

export interface Props {
  atmosphere?: AtmosphereTone
  prompt: string
  yes: () => void
  no: () => void
  cancel?: () => void
}

const props = defineProps<Props>()
const cancelFun = computed(() => typeof props.cancel === 'function' ? props.cancel : props.no)

const dialogRef = ref<HTMLDialogElement>()

onMounted(() => {
  dialogRef.value?.showModal()
})

function handleYes() {
  dialogRef.value?.close()
  props.yes()
}

function handleNo() {
  dialogRef.value?.close()
  props.no()
}

function handleCancel() {
  dialogRef.value?.close()
  cancelFun.value()
}

const format = (str: string) => {
  return handleEmbeddedI18n(str, t)
}

</script>

<template>
  <dialog ref="dialogRef" @cancel.prevent="handleCancel">
    <button class="close-btn" @click.prevent="handleCancel" aria-label="Close">
      <font-awesome-icon icon="times" />
    </button>
    <p class="prompt-text">{{ format(prompt) }}</p>
    <AtmosphereLine v-if="atmosphere" :tone="atmosphere" />
    <div class="prompt-actions">
      <button class="btn btn--confirm" @click.prevent="handleYes">{{ t('yes') }}</button>
      <button class="btn btn--cancel" @click.prevent="handleNo">{{ t('no') }}</button>
    </div>
  </dialog>
</template>

<style scoped>
dialog {
  position: fixed;
  margin: auto;
  padding: 28px;
  width: 90%;
  max-width: 400px;
  background: var(--surface-raised);
  border: var(--edge-width) solid var(--edge-dim);
  border-radius: var(--control-radius);
  box-shadow: var(--shadow-5);
  color: var(--text);
  opacity: 0;
  transform: scale(0.94) translateY(-10px);
  transition: opacity 0.2s ease, transform 0.2s ease,
              display 0.2s allow-discrete,
              overlay 0.2s allow-discrete;

  &[open] {
    opacity: 1;
    transform: scale(1) translateY(0);
  }

  @starting-style {
    &[open] {
      opacity: 0;
      transform: scale(0.94) translateY(-10px);
    }
  }
}

dialog::backdrop {
  background: rgba(0, 0, 0, 0);
  backdrop-filter: blur(0px);
  transition: background 0.2s ease, backdrop-filter 0.2s ease,
              display 0.2s allow-discrete,
              overlay 0.2s allow-discrete;
}

dialog[open]::backdrop {
  background: rgba(0, 0, 0, 0.65);
  backdrop-filter: blur(4px);
}

@starting-style {
  dialog[open]::backdrop {
    background: rgba(0, 0, 0, 0);
    backdrop-filter: blur(0px);
  }
}

.close-btn {
  position: absolute;
  top: 12px;
  right: 12px;
  background: transparent;
  border: none;
  color: var(--text-faint);
  font-size: 1rem;
  cursor: pointer;
  min-width: var(--control-height-icon);
  min-height: var(--control-height-icon);
  padding: 4px 8px;
  border-radius: var(--control-radius);
  transition: color 0.15s, background-color 0.15s;

  &:hover { color: var(--text); background: var(--panel-inset); }
  &:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: 2px; }
}

.prompt-text {
  margin: 0 0 28px;
  font-size: 1rem;
  line-height: 1.5;
  color: var(--text);
  padding-right: 20px;
}

.prompt-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}

.btn {
  min-width: 88px;
  min-height: var(--control-height);
  padding: 8px 18px;
  border: var(--edge-width) solid var(--edge-dim);
  border-radius: var(--control-radius);
  font-size: 0.88rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  cursor: pointer;
  transition: transform 80ms ease, box-shadow 80ms ease, filter 120ms ease, border-color 120ms ease;

  &:hover { filter: brightness(1.04); border-color: var(--edge); transform: translateY(-1px); }
  &:active { transform: translate(1px, 1px); box-shadow: none; }
  &:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: 2px; }
}

.btn--confirm {
  background: var(--delete);
  border-color: var(--survivor-extra-dark);
  color: #fff;
}

.btn--cancel {
  background: var(--button);
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.08), rgba(0, 0, 0, 0.03)),
    url('/assets/veiled-harbour/C02-象牙档案纸微纹理.avif');
  background-size: 100% 100%, 256px 256px;
  background-repeat: no-repeat, repeat;
  color: var(--text);
}
</style>
