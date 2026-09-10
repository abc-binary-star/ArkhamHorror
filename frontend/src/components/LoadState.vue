<script lang="ts" setup>
import { useRouter } from 'vue-router'

defineProps<{ error?: boolean }>()
const emit = defineEmits<{ retry: [] }>()
const router = useRouter()
</script>

<template>
  <div class="load-state box" role="status" aria-live="polite">
    <img class="archive-placeholder" src="/assets/veiled-harbour/24-空档案纸牌.avif" alt="" aria-hidden="true" />
    <p class="message">{{ $t(error ? 'loadState.failed' : 'loadState.loading') }}</p>
    <div v-if="error" class="actions">
      <button type="button" class="plaque plaque--paper" @click="emit('retry')">{{ $t('loadState.retry') }}</button>
      <button type="button" class="ghost" @click="router.push('/')">{{ $t('loadState.backHome') }}</button>
    </div>
  </div>
</template>

<style scoped>
.load-state {
  align-items: center;
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 12px;
  justify-content: center;
  margin: 5vh auto 0;
  max-width: 420px;
  padding: 24px;
  text-align: center;
  width: 100%;
}

.message {
  color: var(--title);
  font-size: 1rem;
  margin: 0;
}

.archive-placeholder {
  width: 112px;
  aspect-ratio: 4 / 5;
  object-fit: cover;
  border: 1px solid color-mix(in srgb, var(--brass, #a5824b) 56%, transparent);
  border-radius: 5px;
  box-shadow: var(--shadow-2);
}

.actions {
  display: flex;
  gap: 10px;
  justify-content: center;
}

.actions button {
  font-weight: var(--font-bold);
  padding: 8px 16px;
}

/* A quiet text action, not a plate: clear the inherited paper texture too, or
   the "no fill" intent leaks the button material back in. */
.actions button.ghost {
  border-color: transparent;
  background-color: transparent;
  background-image: none;
  box-shadow: none;
  color: var(--text-dim);
}

.actions button.ghost:hover:not(:disabled) {
  border-color: transparent;
  background-color: color-mix(in srgb, var(--brass) 14%, transparent);
  color: var(--text);
  transform: none;
}
</style>
