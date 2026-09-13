<script lang="ts" setup>
import { computed, inject, provide, ref } from 'vue';
import { debugControlsAllowedKey, soloKey, spectateKey } from '@/arkham/injectionKeys';

const props = defineProps<{
  title: string
  index: string
  selectedTab: string
  activePlayer: boolean
  playerClass: string
  investigatorId: string
  playerId: string
}>()

const solo = inject(soloKey, ref(false))
const spectate = inject(spectateKey, ref(false))
provide(debugControlsAllowedKey, computed(
  () => !spectate.value && (solo.value || props.playerId === props.index),
))

const isActive = computed(() => props.selectedTab == props.index)
</script>

<template>
  <div class='tab' :class="{ 'tab--active': isActive }" :data-player-tab="index" v-show='isActive'>
    <slot></slot>
  </div>
</template>
