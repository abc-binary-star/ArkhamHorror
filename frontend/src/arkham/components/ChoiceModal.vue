<script lang="ts" setup>
import type { AtmosphereTone } from '@/arkham/atmosphere';
import AtmosphereLine from './AtmosphereLine.vue';
import { computed, inject, nextTick, onBeforeUnmount, onMounted, ref, watch, type CSSProperties } from 'vue';
import { useI18n } from 'vue-i18n';
import type { Game } from '@/arkham/types/Game';
import * as ArkhamGame from '@/arkham/types/Game';
import { choiceRequiresModal } from '@/arkham/types/Message';
import { formatContent, imgsrc } from '@/arkham/helpers';
import { cardImage } from '@/arkham/cardImages';
import { toCardContents } from '@/arkham/types/Card';
import { handleEmbeddedI18n } from '@/arkham/i18n';
import { QuestionType } from '@/arkham/types/Question';
import Draggable from '@/components/Draggable.vue';
import Question from '@/arkham/components/Question.vue';
import TriggeredEffectModal from '@/arkham/components/TriggeredEffectModal.vue';
import EnemyAttackChoiceModal from '@/arkham/components/EnemyAttackChoiceModal.vue';
import RequiredActionReminder from '@/arkham/components/RequiredActionReminder.vue';
import { IsMobile } from '@/arkham/isMobile';
import { processingKey, phaseAnnouncementKey } from '@/arkham/injectionKeys';

export interface Props {
  game: Game
  playerId: string
  noStory?: boolean
}

const props = withDefaults(defineProps<Props>(), { noStory: false })
const emit = defineEmits(['choose'])
const { t, te } = useI18n()
const processing = inject(processingKey)
const phaseAnnouncement = inject(phaseAnnouncementKey, ref(false))
const isProcessing = computed(() => processing?.value ?? false)

async function choose(idx: number) {
  emit('choose', idx)
}

// The decoder preserves WindowChooseOne as isWindow. Never infer a response
// window from purple highlights: ordinary action/fast windows use those too.
const isTriggeredWindow = computed(() => {
  let question = props.game.question[props.playerId]
  while (question) {
    if (question.tag === QuestionType.CHOOSE_ONE) return question.isWindow === true && question.choices.length > 0
    if (!question.question) return false
    question = question.question
  }
  return false
})

const inSkillTest = computed(() => props.game.skillTest !== null)
// An explicit server label distinguishes incoming attacks from targeting an
// enemy with a player action. Both otherwise arrive as EnemyTarget choices.
const enemyAttackPrompt = computed(() => {
  let question = props.game.question[props.playerId]
  while (question) {
    if (question.tag === 'QuestionLabel') {
      if (question.label === '$enemyAttackPrompt.opportunity') return 'opportunity'
      if (question.label === '$enemyAttackPrompt.regular') return 'regular'
    }
    if (!question.question) break
    question = question.question
  }
  return null
})
const choices = computed(() => ArkhamGame.choices(props.game, props.playerId))
const cthulhuDeckCardCodes = new Set([
  '11705',
  '11706',
  '11707',
  '11708',
  '11709',
  '11710',
  '11711',
  '11712',
  '11713',
  '11714',
  '11715',
])
const investigator = computed(() => Object.values(props.game.investigators).find(i => i.playerId === props.playerId))
const { isMobile } = IsMobile()
// TargetLabel choices are normally acted on in the hand. Keep them visible in
// the mobile choice window too, including setup before a player panel exists.
const handChoices = computed(() => {
  const hand = investigator.value?.hand ?? []
  return choices.value.flatMap((choice, index) => {
    if (choice.tag !== 'TargetLabel') return []
    const card = hand.find((card) => toCardContents(card).id === choice.target.contents)
    if (!card) return []
    const contents = toCardContents(card)
    return [{ index, id: contents.id, code: contents.cardCode, image: cardImage(`${contents.cardCode}${contents.isFlipped ? 'b' : ''}`) }]
  })
})

const searchedCards = computed(() => {
  const playerCards = Object.entries(investigator.value?.foundCards ?? [])

  const playerZones = playerCards.filter(([, c]) => c.length > 0)

  const encounterCards = Object.entries({
    ...(props.game.scenario?.foundCards ?? {}),
    ...props.game.foundCards,
  })
  const encounterZones = encounterCards.filter(([, c]) => c.length > 0)

  return [...playerZones, ...encounterZones]
})

const focusedCards = computed(() => {
  if (searchedCards.value.length > 0) {
    return []
  }

  return props.game.focusedCards
})

const cthulhuDeckChoice = computed(() => {
  if (focusedCards.value.length !== 1) return null

  const contents = toCardContents(focusedCards.value[0])
  const cardCode = contents.cardCode.replace(/^c/, '')
  if (!cthulhuDeckCardCodes.has(cardCode)) return null

  const index = choices.value.findIndex(
    choice => choice.tag === 'TargetLabel' &&
      choice.target.tag === 'CardIdTarget' &&
      choice.target.contents === contents.id,
  )

  return index === -1 ? null : { cardCode, index }
})

const cthulhuEnactCard = ref<HTMLElement | null>(null)
const cthulhuRevealReady = ref(false)
const cthulhuRevealStyle = ref<CSSProperties>({})
const cthulhuDeckStandStyle = ref<CSSProperties>({})
const cthulhuDeckCount = ref('')
let cthulhuRevealFrame: number | null = null
let cthulhuResizeFrame: number | null = null

const updateCthulhuDeckStand = () => {
  if (!cthulhuDeckChoice.value) return

  const deck = document.querySelector<HTMLElement>(
    '.scenario-deck-area .deck > img[src*="back_cthulhu_deck"]',
  )
  if (!deck) return

  const deckRect = deck.getBoundingClientRect()
  const count = deck.parentElement?.querySelector<HTMLElement>('.deck-size')
  cthulhuDeckCount.value = count?.textContent?.trim() ?? ''
  cthulhuDeckStandStyle.value = {
    left: `${deckRect.left}px`,
    top: `${deckRect.top}px`,
    width: `${deckRect.width}px`,
    height: `${deckRect.height}px`,
  }
}

const scheduleCthulhuDeckStandUpdate = () => {
  if (cthulhuResizeFrame !== null) cancelAnimationFrame(cthulhuResizeFrame)
  cthulhuResizeFrame = requestAnimationFrame(updateCthulhuDeckStand)
}

const prepareCthulhuReveal = async () => {
  cthulhuRevealReady.value = false
  document.dispatchEvent(new CustomEvent('arkham:clear-card-overlay'))
  await nextTick()

  cthulhuRevealFrame = requestAnimationFrame(() => {
    const card = cthulhuEnactCard.value
    const deck = document.querySelector<HTMLElement>(
      '.scenario-deck-area .deck > img[src*="back_cthulhu_deck"]',
    )
    if (!card || !deck) {
      cthulhuRevealReady.value = true
      return
    }

    const cardRect = card.getBoundingClientRect()
    const deckRect = deck.getBoundingClientRect()
    updateCthulhuDeckStand()
    cthulhuRevealStyle.value = {
      '--cthulhu-origin-x': `${deckRect.left + deckRect.width / 2 - cardRect.left - cardRect.width / 2}px`,
      '--cthulhu-origin-y': `${deckRect.top + deckRect.height / 2 - cardRect.top - cardRect.height / 2}px`,
      '--cthulhu-origin-scale': String(deckRect.width / cardRect.width),
    }

    cthulhuRevealFrame = requestAnimationFrame(() => {
      cthulhuRevealReady.value = true
    })
  })
}

watch(cthulhuDeckChoice, choice => {
  if (choice) void prepareCthulhuReveal()
}, { immediate: true })

onMounted(() => window.addEventListener('resize', scheduleCthulhuDeckStandUpdate))

onBeforeUnmount(() => {
  window.removeEventListener('resize', scheduleCthulhuDeckStandUpdate)
  if (cthulhuRevealFrame !== null) cancelAnimationFrame(cthulhuRevealFrame)
  if (cthulhuResizeFrame !== null) cancelAnimationFrame(cthulhuResizeFrame)
})

const paymentAmountsLabel = computed(() => {
  if (question.value?.tag === QuestionType.CHOOSE_PAYMENT_AMOUNTS) {
    return question.value.label
  }

  return null
})

const choicesRequireModal = computed(() => choices.value.some(choiceRequiresModal))

const tokenChoices = computed(() => props.game.scenario?.chaosBag.choice)

const damageAssignmentTokens = computed(() => ArkhamGame.damageAssignmentTokens(props.game, props.playerId))

const requiresModal = computed(() => {
  if (phaseAnnouncement.value) return false
  // Nothing inside the modal renders without a question, and undo/step transitions
  // clear the question while focused cards, tokens and search results still hold
  // the old state -- without this the modal stays up completely empty.
  if (!question.value) {
    return false
  }
  // The reminder explains assignment first, then lets the player click cards.
  if (damageAssignmentTokens.value) {
    return false
  }
  if (props.noStory && question.value?.tag === QuestionType.READ) {
    return false
  }
  if (question.value?.tag === QuestionType.READ) {
    return true
  }
  if (inSkillTest.value) {
    return false
  }

  return ((props.game.focusedChaosTokens.length > 0 || tokenChoices.value !== null) && !inSkillTest.value) || focusedCards.value.length > 0 || searchedCards.value.length > 0 || paymentAmountsLabel.value || amountsLabel.value || choicesRequireModal.value || ['QuestionLabel', 'DropDown', 'ChooseExchangeAmounts', 'PayCostQuestion'].includes(question.value?.tag)
})

const question = computed(() => props.game.question[props.playerId])

const amountsLabel = computed(() => {
  if (question.value?.tag === QuestionType.CHOOSE_AMOUNTS) {
    return question.value.label
  }

  if (question.value?.tag === QuestionType.QUESTION_LABEL && question.value?.question?.tag === QuestionType.CHOOSE_AMOUNTS) {
    return question.value.question.label
  }

  return null
})

const label = function(body: string) {
  return formatContent(handleEmbeddedI18n(body, t))
}

const skillTestResults = computed(() => props.game.skillTestResults)

const body = computed(() => {
  if (question.value && question.value.tag === 'QuestionLabel') {
    if (question.value.label !== "@none") {
      return question.value.label
    }
  }

  return null
})

const title = computed(() => {
  if (skillTestResults.value) {
    return t("Results")
  }

  if (question.value && question.value.tag === QuestionType.READ) {
    if (question.value.flavorText.title) {
      return handleEmbeddedI18n(question.value.flavorText.title, t)
    }

    return t("Story")
  }

  if (question.value && question.value.tag === QuestionType.CHOOSE_ONE_WIZARD) {
    if (question.value.flavorText.title) {
      return handleEmbeddedI18n(question.value.flavorText.title, t)
    }

    return t("Choose")
  }

  if (question.value && question.value.tag === QuestionType.DROP_DOWN) {
    return t("Choose one")
  }


  if (amountsLabel.value) {
    if(amountsLabel.value.startsWith("$")) {
      let titleKey = amountsLabel.value.replace(".label.", ".title.")
      return te(titleKey.slice(1)) ? titleKey : amountsLabel.value
    } else {
      return amountsLabel.value
    }
  }

  // A labelled question can name its own heading by adding a sibling of its
  // "$...label..." key under "title" -- otherwise every one of them says "Choose".
  if (body.value?.startsWith("$")) {
    const titleKey = body.value.replace(".label.", ".title.")
    // The key can carry i18n vars ("$a.label.b var=i:1"); `te` needs the key alone.
    const bareKey = titleKey.slice(1).split(' ')[0]
    if (titleKey !== body.value && te(bareKey)) {
      return titleKey
    }
  }

  if (!question.value) {
    return ""
  }

  return t("Choose")
})
const choiceAtmosphere = computed<AtmosphereTone>(() => {
  if (question.value?.tag === QuestionType.READ) return 'story'
  if (skillTestResults.value) return skillTestResults.value.skillTestResultsSuccess ? 'success' : 'failure'
  if (paymentAmountsLabel.value || question.value?.tag === 'PayCostQuestion' || question.value?.tag === 'ChooseExchangeAmounts') return 'payment'
  if (searchedCards.value.length) return 'search'
  if (props.game.focusedChaosTokens.length || tokenChoices.value) return 'chaos'
  if (focusedCards.value.length) return 'revelation'
  return 'choice'
})
</script>

<template>
  <RequiredActionReminder
    :game="game"
    :player-id="playerId"
    :suppressed="isTriggeredWindow || !!enemyAttackPrompt"
    @choose="choose"
  />
  <EnemyAttackChoiceModal
    v-if="enemyAttackPrompt && !phaseAnnouncement"
    :game="game"
    :player-id="playerId"
    :opportunity="enemyAttackPrompt === 'opportunity'"
    @choose="choose"
  />
  <TriggeredEffectModal
    v-else-if="isTriggeredWindow && !phaseAnnouncement"
    :game="game"
    :player-id="playerId"
    @choose="choose"
  />
  <div
    v-else-if="requiresModal && cthulhuDeckChoice"
    class="cthulhu-enact no-card-overlay"
    :class="{ 'cthulhu-enact--processing': isProcessing }"
  >
    <AtmosphereLine tone="revelation" class="cthulhu-atmosphere" />
    <span class="cthulhu-space-backdrop" aria-hidden="true"></span>
    <span
      v-if="cthulhuDeckCount"
      class="cthulhu-deck-stand"
      :style="cthulhuDeckStandStyle"
      aria-hidden="true"
    >
      <img :src="imgsrc('backs/back_cthulhu_deck.jpg')" alt="" />
      <span>{{ cthulhuDeckCount }}</span>
    </span>
    <button
      ref="cthulhuEnactCard"
      class="cthulhu-enact-card"
      :class="{ 'cthulhu-enact-card--ready': cthulhuRevealReady }"
      :style="cthulhuRevealStyle"
      type="button"
      :aria-label="`Enact card ${cthulhuDeckChoice.cardCode}`"
      @click="choose(cthulhuDeckChoice.index)"
    >
      <span class="cthulhu-enact-card-inner">
        <img
          class="cthulhu-enact-card-face"
          :src="cardImage(cthulhuDeckChoice.cardCode)"
          alt=""
        />
        <img
          class="cthulhu-enact-card-back"
          :src="imgsrc('backs/back_cthulhu_deck.jpg')"
          alt=""
        />
        <span v-if="cthulhuDeckCount" class="cthulhu-moving-count">{{ cthulhuDeckCount }}</span>
      </span>
    </button>
  </div>
  <Draggable
    v-else-if="requiresModal"
    center-in-selector=".scenario-body"
    avoid-selector=".location-cell--can-interact, .location-cell--can-interact .location-wrapper, .location-cell--can-interact .card-frame"
    click-through-chrome
  >
    <template #handle><h1 v-html="label(title)"></h1></template>
    <div class="choice-modal-wrapper" :class="{ 'choice-modal-wrapper--processing': isProcessing }">
      <AtmosphereLine :tone="choiceAtmosphere" />
      <p class="body" v-if="body" v-html="label(body)"></p>
      <section v-if="isMobile && handChoices.length" class="mobile-hand-choices" :aria-label="t('player.hand')">
        <button v-for="card in handChoices" :key="card.id" type="button" :disabled="isProcessing" :aria-label="`${t('player.hand')} ${card.code}`" @click="choose(card.index)">
          <img :src="card.image" :alt="card.code" />
        </button>
      </section>
      <Question v-if="question" :game="game" :playerId="playerId" @choose="choose" />
    </div>
  </Draggable>
</template>

<style scoped>
.cthulhu-atmosphere { position: absolute; top: 24px; left: 50%; transform: translateX(-50%); width: min(520px, 85vw); z-index: 2; color: #e9dfcb; text-align: center; }
.cthulhu-enact {
  position: fixed;
  inset: 0;
  z-index: var(--z-index-1000);
  display: grid;
  place-content: center;
  justify-items: center;
  gap: 0;
  overflow: hidden;
  isolation: isolate;
  background: transparent;

  &::before,
  &::after {
    position: absolute;
    inset: 0;
    z-index: var(--z-index-1);
    content: '';
    pointer-events: none;
  }

  &::before {
    background:
      radial-gradient(circle at 4% 8%, rgba(220, 246, 231, 0.9) 0 1px, transparent 2px),
      radial-gradient(circle at 14% 31%, rgba(137, 195, 182, 0.76) 0 1.1px, transparent 2.1px),
      radial-gradient(circle at 8% 74%, rgba(183, 189, 225, 0.76) 0 0.8px, transparent 1.8px),
      radial-gradient(circle at 22% 91%, rgba(211, 241, 224, 0.86) 0 1.2px, transparent 2.2px),
      radial-gradient(circle at 31% 14%, rgba(129, 185, 175, 0.8) 0 0.9px, transparent 1.9px),
      radial-gradient(circle at 41% 67%, rgba(223, 248, 232, 0.9) 0 1px, transparent 2px),
      radial-gradient(circle at 53% 6%, rgba(173, 182, 217, 0.74) 0 1px, transparent 2px),
      radial-gradient(circle at 62% 84%, rgba(144, 204, 190, 0.82) 0 1.1px, transparent 2.1px),
      radial-gradient(circle at 72% 25%, rgba(221, 247, 230, 0.86) 0 0.9px, transparent 1.9px),
      radial-gradient(circle at 83% 62%, rgba(153, 165, 211, 0.78) 0 1.2px, transparent 2.2px),
      radial-gradient(circle at 94% 12%, rgba(157, 211, 195, 0.8) 0 1px, transparent 2px),
      radial-gradient(circle at 91% 89%, rgba(222, 247, 231, 0.88) 0 0.8px, transparent 1.8px),
      radial-gradient(circle at 11% 56%, rgba(232, 255, 240, 0.96) 0 1.7px, transparent 2.8px),
      radial-gradient(circle at 25% 43%, rgba(141, 199, 185, 0.76) 0 0.8px, transparent 1.8px),
      radial-gradient(circle at 35% 76%, rgba(190, 197, 230, 0.84) 0 1.1px, transparent 2.1px),
      radial-gradient(circle at 49% 43%, rgba(223, 250, 233, 0.92) 0 0.9px, transparent 1.9px),
      radial-gradient(circle at 66% 14%, rgba(226, 255, 237, 0.98) 0 1.5px, transparent 2.6px),
      radial-gradient(circle at 74% 68%, rgba(133, 193, 180, 0.8) 0 1px, transparent 2px),
      radial-gradient(circle at 86% 92%, rgba(217, 240, 228, 0.88) 0 1.2px, transparent 2.2px);
    animation: cthulhu-background-twinkle-a 4.8s ease-in-out infinite;
  }

  &::after {
    background:
      radial-gradient(circle at 3% 48%, rgba(146, 202, 188, 0.76) 0 0.8px, transparent 1.8px),
      radial-gradient(circle at 18% 12%, rgba(218, 244, 228, 0.88) 0 1.1px, transparent 2.1px),
      radial-gradient(circle at 27% 58%, rgba(171, 179, 219, 0.74) 0 1px, transparent 2px),
      radial-gradient(circle at 37% 88%, rgba(137, 194, 181, 0.8) 0 0.9px, transparent 1.9px),
      radial-gradient(circle at 46% 27%, rgba(226, 250, 235, 0.9) 0 1.2px, transparent 2.2px),
      radial-gradient(circle at 58% 52%, rgba(149, 207, 191, 0.78) 0 0.8px, transparent 1.8px),
      radial-gradient(circle at 69% 96%, rgba(216, 242, 226, 0.86) 0 1px, transparent 2px),
      radial-gradient(circle at 77% 7%, rgba(165, 173, 215, 0.72) 0 1.1px, transparent 2.1px),
      radial-gradient(circle at 87% 39%, rgba(129, 188, 174, 0.8) 0 0.9px, transparent 1.9px),
      radial-gradient(circle at 98% 71%, rgba(222, 247, 231, 0.86) 0 1.2px, transparent 2.2px),
      radial-gradient(circle at 9% 94%, rgba(151, 207, 192, 0.78) 0 0.9px, transparent 1.9px),
      radial-gradient(circle at 24% 74%, rgba(228, 254, 237, 0.94) 0 1.4px, transparent 2.5px),
      radial-gradient(circle at 33% 4%, rgba(184, 191, 226, 0.8) 0 1px, transparent 2px),
      radial-gradient(circle at 51% 82%, rgba(229, 255, 239, 0.98) 0 1.8px, transparent 2.9px),
      radial-gradient(circle at 64% 38%, rgba(139, 200, 185, 0.8) 0 0.8px, transparent 1.8px),
      radial-gradient(circle at 81% 78%, rgba(205, 213, 239, 0.86) 0 1.1px, transparent 2.1px),
      radial-gradient(circle at 95% 52%, rgba(225, 251, 234, 0.96) 0 1.5px, transparent 2.6px);
    animation: cthulhu-background-twinkle-b 6.2s ease-in-out infinite;
  }
}

.cthulhu-enact--processing {
  pointer-events: none;
}

.cthulhu-space-backdrop {
  position: absolute;
  inset: 0;
  z-index: var(--z-index-0);
  background:
    radial-gradient(circle at center, rgba(7, 31, 35, 0.58) 0, rgba(2, 10, 16, 0.82) 38%, rgba(0, 3, 8, 0.94) 76%);
  pointer-events: none;
  animation: cthulhu-space-fade-in 480ms ease-out both;
}

.cthulhu-deck-stand {
  position: fixed;
  z-index: var(--z-index-0);
  display: block;
  pointer-events: none;

  > img {
    display: block;
    width: 100%;
    height: 100%;
    border-radius: 6px;
    object-fit: cover;
    box-shadow: 0 3px 6px rgba(0, 0, 0, 0.55);
  }

  > span {
    position: absolute;
    left: 50%;
    bottom: 0;
    width: 1.3em;
    height: 1.3em;
    border-radius: 50%;
    color: rgba(255, 255, 255, 0.72);
    background: rgba(0, 0, 0, 0.82);
    font-size: 1.2rem;
    font-weight: bold;
    line-height: 1.3;
    text-align: center;
    transform: translate(-50%, -50%);
  }
}

.cthulhu-enact-card {
  width: min(34vw, 430px);
  aspect-ratio: 0.704;
  padding: 0;
  border: 0;
  border-radius: 4.5%;
  outline: none;
  position: relative;
  z-index: var(--z-index-2);
  isolation: isolate;
  overflow: visible;
  background: transparent;
  cursor: pointer;
  perspective: 1200px;
  filter: drop-shadow(0 24px 30px rgba(0, 4, 5, 0.86));
  transition: filter 220ms ease, transform 220ms ease;

  &::before,
  &::after {
    position: absolute;
    content: '';
    pointer-events: none;
    opacity: 0;
  }

  &::before {
    inset: -40%;
    z-index: var(--z-index-neg-2);
    border-radius: 57% 43% 62% 38% / 42% 59% 41% 58%;
    background:
      radial-gradient(ellipse at 24% 28%, rgba(62, 132, 126, 0.34), transparent 29%),
      radial-gradient(ellipse at 78% 67%, rgba(65, 73, 125, 0.3), transparent 34%),
      radial-gradient(ellipse at 63% 18%, rgba(75, 117, 105, 0.22), transparent 24%),
      radial-gradient(ellipse at center, rgba(3, 15, 24, 0.94) 14%, rgba(11, 56, 61, 0.38) 46%, transparent 72%);
    filter: blur(48px);
    -webkit-mask-image: radial-gradient(ellipse at center, #000 34%, rgba(0, 0, 0, 0.78) 58%, transparent 82%);
    mask-image: radial-gradient(ellipse at center, #000 34%, rgba(0, 0, 0, 0.78) 58%, transparent 82%);
  }

  &::after {
    inset: -32%;
    z-index: var(--z-index-neg-1);
    border-radius: 43% 57% 39% 61% / 55% 38% 62% 45%;
    background:
      radial-gradient(ellipse at 22% 38%, rgba(32, 94, 85, 0.26), transparent 34%),
      radial-gradient(ellipse at 78% 61%, rgba(55, 48, 96, 0.28), transparent 36%),
      radial-gradient(ellipse at 50% 52%, rgba(0, 2, 7, 0.98) 18%, rgba(7, 35, 39, 0.7) 48%, transparent 74%);
    -webkit-mask-image: radial-gradient(ellipse at center, #000 38%, rgba(0, 0, 0, 0.82) 61%, transparent 86%);
    mask-image: radial-gradient(ellipse at center, #000 38%, rgba(0, 0, 0, 0.82) 61%, transparent 86%);
  }

  &:hover,
  &:focus-visible {
    transform: translateY(-6px) scale(1.02);
    filter: drop-shadow(0 28px 34px rgba(0, 4, 5, 0.92)) drop-shadow(0 0 14px rgba(92, 148, 119, 0.52));
  }

  &:focus-visible {
    box-shadow: 0 0 0 3px #adc8aa;
  }

  &:active {
    transform: translateY(-1px) scale(0.985);
  }
}

.cthulhu-enact-card-inner {
  position: relative;
  display: block;
  width: 100%;
  height: 100%;
  transform:
    translate3d(var(--cthulhu-origin-x, 0), var(--cthulhu-origin-y, 0), 0)
    rotateY(180deg)
    scale(var(--cthulhu-origin-scale, 0.14));
  transform-style: preserve-3d;
}

.cthulhu-enact-card--ready {
  &::before {
    animation: cthulhu-void-breathe 5.5s ease-in-out 420ms infinite alternate;
  }

  &::after {
    animation: cthulhu-starfield-drift 8s ease-in-out 420ms infinite;
  }

  .cthulhu-enact-card-inner {
    animation: cthulhu-card-reveal 1100ms cubic-bezier(0.16, 1, 0.3, 1) both;
  }

  .cthulhu-moving-count {
    animation: cthulhu-count-lift 200ms ease-out both;
  }
}

.cthulhu-enact-card-face,
.cthulhu-enact-card-back {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border-radius: 4.5%;
  opacity: 1;
  background: #071116;
  object-fit: cover;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
}

.cthulhu-enact-card-back {
  transform: rotateY(180deg);
}

.cthulhu-moving-count {
  position: absolute;
  left: 50%;
  bottom: 0;
  width: 1.3em;
  height: 1.3em;
  border-radius: 50%;
  color: rgba(255, 255, 255, 0.72);
  background: rgba(0, 0, 0, 0.82);
  font-size: 9.5rem;
  font-weight: bold;
  line-height: 1.3;
  text-align: center;
  transform: translate(-50%, -50%) rotateY(180deg) translateZ(2px);
  backface-visibility: hidden;
}

@keyframes cthulhu-card-reveal {
  0% {
    transform:
      translate3d(var(--cthulhu-origin-x, 0), var(--cthulhu-origin-y, 0), 0)
      rotateY(180deg)
      scale(var(--cthulhu-origin-scale, 0.14));
  }
  18% {
    transform:
      translate3d(var(--cthulhu-origin-x, 0), calc(var(--cthulhu-origin-y, 0px) - 16px), 0)
      rotateY(180deg)
      scale(var(--cthulhu-origin-scale, 0.14));
  }
  100% {
    transform: translate3d(0, 0, 0) rotateY(0) scale(1);
  }
}

@keyframes cthulhu-count-lift {
  from { opacity: 1; }
  to { opacity: 0; }
}

@keyframes cthulhu-void-breathe {
  from {
    opacity: 0.34;
    transform: translate3d(-2%, 1%, 0) scale(0.92, 0.97);
  }
  to {
    opacity: 0.62;
    transform: translate3d(2%, -1.5%, 0) scale(1.08, 1.03);
  }
}

@keyframes cthulhu-space-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes cthulhu-starfield-drift {
  0%, 100% { opacity: 0.2; }
  38% { opacity: 0.52; }
  72% { opacity: 0.3; }
}

@keyframes cthulhu-background-twinkle-a {
  0%, 100% { opacity: 0; }
  14% { opacity: 0.32; }
  36% { opacity: 0.72; }
  63% { opacity: 0.44; }
  81% { opacity: 0.66; }
  93% { opacity: 0.22; }
}

@keyframes cthulhu-background-twinkle-b {
  0%, 100% { opacity: 0; }
  12% { opacity: 0.48; }
  29% { opacity: 0.38; }
  57% { opacity: 0.7; }
  78% { opacity: 0.46; }
  92% { opacity: 0.2; }
}

@media (max-width: 700px) {
  .cthulhu-enact-card {
    width: min(78vw, 390px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .cthulhu-enact,
  .cthulhu-space-backdrop,
  .cthulhu-enact::before,
  .cthulhu-enact::after,
  .cthulhu-enact-card::before,
  .cthulhu-enact-card::after,
  .cthulhu-enact-card-inner {
    animation: none;
  }

  .cthulhu-enact::before,
  .cthulhu-enact::after {
    opacity: 0.5;
  }

  .cthulhu-enact-card::before {
    opacity: 0.48;
    transform: none;
  }

  .cthulhu-enact-card::after {
    opacity: 0.38;
    transform: none;
  }

  .cthulhu-enact-card {
    transition: none;
  }

  .cthulhu-enact-card-inner {
    transform: none;
  }
}

.body {
  font-size: 1.3em;
  font-family: "Noto Sans", sans-serif;
  color: var(--text);
  background:
    linear-gradient(rgba(233, 225, 210, 0.86), rgba(233, 225, 210, 0.86)),
    url('/assets/veiled-harbour/47-剧情检定烛影纸面-v1.png') center / cover no-repeat;
  padding: 10px;
  border-radius: 10px;
  border: 1px solid color-mix(in srgb, var(--brass) 54%, var(--border-panel));
  box-shadow: var(--shadow-4);
}

.choice-modal-wrapper {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 18px;
  background: url('/assets/veiled-harbour/C02-象牙档案纸微纹理.avif') center / 256px 256px repeat;
  border-radius: 8px;
  box-shadow: var(--shadow-2);
}

.choice-modal-wrapper--processing {
  pointer-events: none;
}

.choice-modal-wrapper .body {
  text-align: center;
  margin: 0;
  background: transparent;
  border: 0;
  box-shadow: none;
}

/* The card pool picker's panels carry the framing, so its lede stays plain text. */
.choice-modal-wrapper:has(.card-pool-picker) .body {
  padding: 2px 2px 0;
  border: 0;
  background: none;
  color: var(--text);
  font-size: 1.05em;
}

@media (max-width: 800px), (max-width: 1199px) and (pointer: coarse) {

  .choice-modal-wrapper { min-width: 0; width: 100%; max-width: 100%; }
  .choice-modal-wrapper .body { font-size: 16px; line-height: 1.65; }

}

@media (max-width: 800px), (max-width: 1199px) and (pointer: coarse) {

  .mobile-hand-choices { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-bottom: 16px; }
  .mobile-hand-choices button { display: block; width: 100%; min-width: 0; padding: 3px; border: 2px solid var(--select, #b69c60); border-radius: 8px; background: transparent; }
  .mobile-hand-choices img { display: block; width: 100%; height: auto; border-radius: 5px; }
  .mobile-hand-choices button:disabled { opacity: 0.6; }

}
</style>
