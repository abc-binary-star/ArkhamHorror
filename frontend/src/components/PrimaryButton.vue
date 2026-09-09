<script lang="ts" setup>
withDefaults(defineProps<{ label: string; danger?: boolean }>(), { danger: false })
defineEmits(['click'])
</script>

<template>
  <button class="primary-btn" :class="{ danger }" @click="$emit('click')">{{ label }}</button>
</template>

<style scoped>
.primary-btn {
  min-width: 120px;
  min-height: var(--control-height-primary);
  align-self: center;
  background-color: var(--spooky-green);
  background-image:
    linear-gradient(180deg, rgba(53, 84, 76, 0.62), rgba(20, 40, 37, 0.58)),
    url('/assets/veiled-harbour/C01-墨绿漆面微纹理.jpg');
  background-size: 100% 100%, 256px 256px;
  background-repeat: no-repeat, repeat;
  border: var(--edge-width) solid var(--edge-on-accent);
  border-radius: var(--control-radius);
  box-shadow: var(--shadow-3);
  outline: none;
  padding: 10px 24px;
  text-transform: none;
  line-height: 1.25;
  letter-spacing: 0.05em;
  color: var(--button-1-text);
  font-size: 1em;
  font-weight: var(--font-black);
  cursor: pointer;
  transition: transform 80ms ease, box-shadow 80ms ease, filter 120ms ease;
  @media (max-width: 768px) {
    min-width: 104px;
    padding: 8px 14px;
    font-size: 0.82em;
  }

  &:hover:not(:disabled) {
    filter: brightness(1.06);
    transform: translateY(-1px);
  }

  &:active:not(:disabled) {
    transform: translate(1px, 1px);
    box-shadow: none;
  }

  &:disabled {
    cursor: not-allowed;
    filter: var(--button-disabled-filter);
    opacity: 0.72;
    box-shadow: var(--shadow-1);
  }

  &:focus-visible {
    outline: 2px solid var(--button-focus-ring);
    outline-offset: 2px;
  }

  &.danger {
    background-color: var(--survivor-dark);
    background-image:
      linear-gradient(180deg, rgba(184, 66, 60, 0.7), rgba(111, 36, 33, 0.78)),
      url('/assets/veiled-harbour/C01-墨绿漆面微纹理.jpg');
    background-size: 100% 100%, 256px 256px;
    background-repeat: no-repeat, repeat;
    border-color: var(--survivor);
    color: #fff2f0;
  }
}
</style>
