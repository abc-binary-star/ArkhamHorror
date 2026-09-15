<script lang="ts" setup>
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useCardFlip } from '@/arkham/composables/useCardFlip'

const props = defineProps<{
  src: string
  back?: string
  passed?: boolean
  current?: boolean
}>()

const { t } = useI18n()

// Only a resolved card has a side to turn to. The card still in play has no
// second face to give, and one still in the deck has an unrevealed back: a
// history view must not become a spoiler view.
const canFlip = computed(() => Boolean(props.passed && props.back))

// Resolved cards open on the side they were resolved on — the one that flashed
// past on advance — and turn back to the face that was played.
const showingFace = ref(false)
const face = computed(() => (canFlip.value && !showingFace.value ? props.back! : props.src))
const { displayedImage, flipping, flippingDiagonally } = useCardFlip(face)

// Full-height backs (an act/agenda that flips to an enemy or location) are
// stored portrait; normal act/agenda faces are landscape. Detect from the loaded
// image instead of maintaining a card-code whitelist.
const isVertical = ref(false)
function updateOrientation(e: Event) {
  const img = e.target as HTMLImageElement
  isVertical.value = img.naturalHeight > img.naturalWidth
}
watch(face, () => { isVertical.value = false })

function turnOver() {
  if (canFlip.value) showingFace.value = !showingFace.value
}
</script>

<template>
  <img
    class="card stack-history-card"
    :class="{
      'card--sideways': !isVertical,
      'card--flipping': flipping,
      'card--flipping-diagonal': flippingDiagonally,
      'stack-history-card--turnable': canFlip,
      'stack-history-card--current': current,
    }"
    :src="displayedImage"
    :role="canFlip ? 'button' : undefined"
    :tabindex="canFlip ? 0 : undefined"
    :title="canFlip ? t(showingFace ? 'card.resolvedSide' : 'card.front') : undefined"
    :aria-label="canFlip ? t(showingFace ? 'card.resolvedSide' : 'card.front') : undefined"
    @load="updateOrientation"
    @click="turnOver"
    @keydown.enter.prevent="turnOver"
    @keydown.space.prevent="turnOver"
  />
</template>

<style scoped>
/* Nothing sizes this card but the seat's own rules, and it is deliberately laid
   out exactly like the live card it replaces: a plain inline child of the same
   box. Anything that makes that box a flex row re-bases the card on `.card`'s
   own `flex: 0`, and the card then measures 0x0. */
.stack-history-card {
  cursor: default;
}

.stack-history-card--turnable {
  cursor: pointer;
}

.stack-history-card--turnable:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 2px;
}
</style>
