<script setup lang="ts">
import { computed } from 'vue'
import { nearDefeat } from '../visualFeedback'
const props = defineProps<{ entity: {
  remainingHealth?: number | null; remainingSanity?: number | null
  tokens: { Damage?: number; Horror?: number }; eliminated?: boolean
} }>()
const damage = computed(() => !props.entity.eliminated && nearDefeat(props.entity.remainingHealth, props.entity.tokens.Damage))
const horror = computed(() => !props.entity.eliminated && nearDefeat(props.entity.remainingSanity, props.entity.tokens.Horror))
</script>
<template>
  <svg v-if="damage || horror" class="risk-corners" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
    <path v-if="damage" class="damage-crack" d="M1 20V1H20 M2 2L12 9L8 14L20 24 M12 9L22 7" />
    <path v-if="horror" class="horror-crack" d="M80 1H99V20 M98 2L88 9L92 16L80 25 M88 9L79 7" />
  </svg>
</template>
<style scoped>
.risk-corners { position: absolute; inset: 0; width: 100%; height: 100%; z-index: 101; pointer-events: none; fill: none; stroke-width: 1.5; filter: drop-shadow(0 1px 1px #000); }
.damage-crack { stroke: #da8e7f; }
.horror-crack { stroke: #c4a6de; stroke-dasharray: 10 2; }
</style>
