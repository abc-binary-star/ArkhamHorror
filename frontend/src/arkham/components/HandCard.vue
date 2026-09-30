<script lang="ts" setup>
import { computed, inject, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { onClickOutside, useEventListener } from '@vueuse/core'
import { visibleRestrictionSource } from '@/arkham/restrictionSource'
import type { Source } from '@/arkham/types/Source'
import { useDbCardStore } from '@/stores/dbCards'
import { useI18n } from 'vue-i18n'
import { fetchPlayability } from '@/arkham/api'
import { playabilityExplanation, isPlayabilityWindow, playabilityResponseIsCurrent } from '@/arkham/playabilityExplanation'
import { processingKey, uiLockKey, phaseAnnouncementKey, spectateKey } from '@/arkham/injectionKeys'
import { CardContents, type Card } from '@/arkham/types/Card'
import type { Game } from '@/arkham/types/Game'
import type { AbilityLabel, AbilityMessage, Message } from '@/arkham/types/Message'
import { MessageType } from '@/arkham/types/Message'
import { imgsrc } from '@/arkham/helpers'
import { cardImage } from '@/arkham/cardImages'
import CardSilenceBell from '@/arkham/components/CardSilenceBell.vue'
import AbilitiesMenu from '@/arkham/components/AbilitiesMenu.vue'
import * as ArkhamGame from '@/arkham/types/Game'
import { useDebug } from '@/arkham/debug'
import { useCardStore } from '@/stores/cards'
import { showOtherPlayersHandsKey, soloKey } from '@/arkham/injectionKeys'

export interface Props {
  game: Game
  card: Card
  playerId: string
  ownerId: string
  mobileHandOpen?: boolean
}

const props = defineProps<Props>()
const { t } = useI18n()
const processing = inject(processingKey, ref(false))
const uiLock = inject(uiLockKey, ref(false))
const phaseAnnouncement = inject(phaseAnnouncementKey, ref(false))
const spectate = inject(spectateKey, ref(false))
const explanationOpen = ref(false)
const explanationLoading = ref(false)
const explanationError = ref(false)
const explanationScope = ref<'currentWindow' | 'normalTurn' | 'unavailable'>('normalTurn')
const explanationStale = ref(false)
const restrictionSources = ref<Source[]>([])
const expandedSource = ref<string | null>(null)
const dbCards = useDbCardStore()
const visibleSources = computed(() => {
  const sources = new Map<string, { key: string; code: string }>()
  for (const source of restrictionSources.value) {
    const visible = visibleRestrictionSource(source, props.game)
    if (visible) sources.set(visible.key, visible)
  }
  return [...sources.values()]
})
const restrictionName = (code: string) => dbCards.getDbCard(code.replace(/^c/, ''))?.name ?? t('handExplanation.sourceCard')
const explanation = ref<ReturnType<typeof playabilityExplanation>>([])
let explanationRequest = 0
const explanationPanel = ref<HTMLElement | null>(null)
const explanationStyle = ref<Record<string, string>>({})
onClickOutside(explanationPanel, () => clearExplanation(), { ignore: ['.explain-card', '.card.in-hand'] })
useEventListener(window, 'keydown', (event: KeyboardEvent) => {
  if (event.key === 'Escape' && explanationOpen.value) clearExplanation()
})
useEventListener(window, 'resize', () => clearExplanation())
const debug = useDebug()
const cardStore = useCardStore()

onMounted(() => {
  if (!cardStore.loaded) cardStore.fetchCards()
})

const cardFrame = ref<HTMLElement | null>(null)
const showAbilities = ref(false)

watch(
  () => props.mobileHandOpen,
  (open) => {
    if (open === false) showAbilities.value = false
  },
)
const investigator = computed(() =>
  Object.values(props.game.investigators).find((i) => i.playerId === props.playerId),
)
const investigatorId = computed(() => investigator.value?.id)

const cardContents = computed<CardContents>(() =>
  props.card.tag == 'VengeanceCard' ? props.card.contents.contents : props.card.contents,
)

const id = computed(() => cardContents.value.id)
const choices = computed(() => ArkhamGame.choices(props.game, props.playerId))

const revealed = computed(() => {
  const meta = investigator.value?.meta
  if (meta && typeof meta === 'object' && 'revealedCards' in meta) {
    return Object.values(meta.revealedCards).some((v) => (v as string[]).includes(id.value))
  }

  return false
})

const cardAction = computed(() => {
  return choices.value.findIndex((choice) => {
    if (choice.tag === MessageType.TARGET_LABEL) {
      return choice.target.contents === id.value
    }

    return false
  })
})

const solo = inject(soloKey)
const showOtherPlayersHands = inject(showOtherPlayersHandsKey)

function isAbility(v: Message): v is AbilityLabel {
  if (v.tag !== 'AbilityLabel') {
    return false
  }

  const { source } = v.ability

  if (source.sourceTag === 'ProxySource') {
    if ('contents' in source.source) {
      return source.source.contents === id.value
    }
  } else if (source.tag === 'CardIdSource') {
    return source.contents === id.value
  } else if (source.tag === 'EventSource') {
    return source.contents === id.value
  } else if (source.tag === 'AssetSource') {
    if (source.contents === id.value) {
      return true
    }
    if (!source.contents) return false
    const asset = props.game.assets[source.contents]
    if (asset) {
      return asset.cardId === id.value && asset.placement.tag === 'StillInHand'
    }
  } else if (source.tag === 'SkillSource') {
    return source.contents === id.value
  }

  return false
}

const abilities = computed(() => {
  return choices.value.reduce<AbilityMessage[]>((acc, v, i) => {
    if (isAbility(v)) {
      return [...acc, { contents: v, displayAsAction: false, index: i }]
    }

    return acc
  }, [])
})

const classObject = computed(() => {
  return {
    'card--can-interact': cardAction.value !== -1 || abilities.value.length > 0,
  }
})

const canExplain = computed(() => !spectate.value && investigatorId.value === props.ownerId
  && cardAction.value === -1 && abilities.value.length === 0)
const explanationContext = computed(() => {
  if (processing.value || uiLock.value || phaseAnnouncement.value) return 'busy'
  if (!props.game.question[props.playerId]) return 'waiting'
  if (!isPlayabilityWindow(props.game.question[props.playerId])) return 'otherChoice'
  return null
})
function clearExplanation() {
  explanationRequest++
  explanationOpen.value = false
  explanationLoading.value = false
  explanationError.value = false
  explanation.value = []
  restrictionSources.value = []
  expandedSource.value = null
  explanationStale.value = false
}
watch(() => [props.game.scenarioSteps, props.game.question, props.playerId, id.value, canExplain.value, explanationContext.value, props.mobileHandOpen], clearExplanation)
onBeforeUnmount(clearExplanation)
async function explainCard() {
  if (!canExplain.value || explanationLoading.value) return
  const rect = cardFrame.value?.getBoundingClientRect()
  explanationStyle.value = {
    left: `${Math.max(8, Math.min(rect?.left ?? 8, window.innerWidth - 304))}px`,
    bottom: `${Math.max(8, Math.min(window.innerHeight - (rect?.top ?? 0) + 8, window.innerHeight / 2))}px`,
  }
  explanationOpen.value = true
  if (explanationContext.value) return
  const request = ++explanationRequest
  explanationLoading.value = true
  explanationError.value = false
  explanationStale.value = false
  try {
    const result = await fetchPlayability(props.game.id, investigatorId.value!, id.value)
    if (request !== explanationRequest) return
    if (!playabilityResponseIsCurrent(result, id.value, props.game.scenarioSteps)) {
      explanationStale.value = true
      return
    }
    // An older server can only provide a normal-turn diagnostic, never label
    // its synthetic DuringTurn result as a live response-window diagnosis.
    explanationScope.value = result.scope ?? 'normalTurn'
    explanation.value = playabilityExplanation(result.checks)
    restrictionSources.value = result.checks.some(([name, detail]) => name === 'Play restrictions' && detail !== null)
      ? result.restrictionSources ?? [] : []
  } catch {
    if (request === explanationRequest) explanationError.value = true
  } finally {
    if (request === explanationRequest) explanationLoading.value = false
  }
}

function handleCardClick() {
  if (cardAction.value !== -1) {
    emit('choose', cardAction.value)
  } else if (abilities.value.length === 1) {
    emit('choose', abilities.value[0].index)
  } else if (abilities.value.length > 1) {
    showAbilities.value = !showAbilities.value
  } else if (canExplain.value) {
    void explainCard()
  }
}

const emit = defineEmits<{ choose: [value: number] }>()

const cardBack = computed(() => {
  return imgsrc('backs/back_player.jpg')
})

const image = computed(() => {
  const { cardCode, mutated } = cardContents.value
  return cardImage(cardCode, mutated ? `_${mutated}` : '')
})

const cardDef = computed(() =>
  cardStore.cards.find((c) => c.cardCode === cardContents.value.cardCode),
)
const canDebugCustomize = computed(
  () => debug.active && (cardDef.value?.customizations?.length ?? 0) > 0,
)

function debugCustomize() {
  debug.send(props.game.id, { tag: 'DebugCustomize', contents: [props.ownerId, id.value] })
}

/*
const painted = computed(() => {
  return true
})

const canvas = ref<HTMLCanvasElement | null>(null)



watch(canvas, (painted) => {
  let c = canvas.value
  if (c === null || c === undefined) {
    return
  }
  if (painted) {
    const ctx = c.getContext('2d') as CanvasRenderingContext2D
    const img = new Image()
    img.addEventListener('load', () => {
      c.width = img.width
      c.height = img.height
      ctx.drawImage(img, 0, 0, c.width, c.height)
      oilPaintEffect(c, 4, 55);
    })
    img.src = image.value
  }
})



function oilPaintEffect(canvas, radius, intensity) {
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D
    var width = canvas.width,
        height = canvas.height,
        imgData = ctx.getImageData(0, 0, width, height),
        pixData = imgData.data,
        pixelIntensityCount = [];

    var centerX = canvas.width / 2,
        centerY = canvas.height / 4;

    var intensityLUT = [],
        rgbLUT = [];

    for (var y = 0; y < height; y++) {
        intensityLUT[y] = [];
        rgbLUT[y] = [];
        for (var x = 0; x < width; x++) {
            var idx = (y * width + x) * 4,
                r = pixData[idx],
                g = pixData[idx + 1],
                b = pixData[idx + 2],
                avg = (r + g + b) / 3;

            intensityLUT[y][x] = Math.round((avg * intensity) / 255);
            rgbLUT[y][x] = {
                r: r,
                g: g,
                b: b
            };
        }
    }


    for (y = 0; y < height; y++) {
        for (x = 0; x < width; x++) {
            pixelIntensityCount = [];

            // Find intensities of nearest pixels within radius.
            for (var yy = -radius; yy <= radius; yy++) {
                for (var xx = -radius; xx <= radius; xx++) {
                    if (y + yy > 0 && y + yy < height && x + xx > 0 && x + xx < width) {
                        var intensityVal = intensityLUT[y + yy][x + xx];

                        if (!pixelIntensityCount[intensityVal]) {
                            pixelIntensityCount[intensityVal] = {
                                val: 1,
                                r: rgbLUT[y + yy][x + xx].r,
                                g: rgbLUT[y + yy][x + xx].g,
                                b: rgbLUT[y + yy][x + xx].b
                            }
                        } else {
                            pixelIntensityCount[intensityVal].val++;
                            pixelIntensityCount[intensityVal].r += rgbLUT[y + yy][x + xx].r;
                            pixelIntensityCount[intensityVal].g += rgbLUT[y + yy][x + xx].g;
                            pixelIntensityCount[intensityVal].b += rgbLUT[y + yy][x + xx].b;
                        }
                    }
                }
            }

            pixelIntensityCount.sort(function (a, b) {
                return b.val - a.val;
            });

            var curMax = pixelIntensityCount[0].val,
                dIdx = (y * width + x) * 4;


            const ry = canvas.width / 3;
            const rx = canvas.height / 3.7;

            if ((Math.pow(x - centerX, 2)/Math.pow(rx, 2)) + (Math.pow(y - centerY, 2)/Math.pow(ry, 2)) <= 1) {
              pixData[dIdx] = ~~ (pixelIntensityCount[0].r / curMax);
              pixData[dIdx + 1] = ~~ (pixelIntensityCount[0].g / curMax);
              pixData[dIdx + 2] = ~~ (pixelIntensityCount[0].b / curMax);
              pixData[dIdx + 3] = 255;
            }

        }
    }

    // change this to ctx to instead put the data on the original canvas
    ctx.putImageData(imgData, 0, 0);
}

    <canvas v-show="painted" ref="canvas" class="card" :data-index="id" :data-card-code="cardContents.cardCode" :data-image="image">
    </canvas>
*/
</script>

<template>
  <div
    class="card-container"
    :data-index="id"
    v-if="solo || showOtherPlayersHands || investigatorId == ownerId || revealed"
  >
    <img
      ref="cardFrame"
      :class="classObject"
      class="card in-hand"
      :src="image"
      :data-customizations="JSON.stringify(cardContents.customizations)"
      :data-chained="cardContents.chained || undefined"
      :data-playability-game-id="cardAction === -1 ? game.id : undefined"
      :data-playability-investigator-id="cardAction === -1 ? investigatorId : undefined"
      :data-playability-card-id="cardAction === -1 ? id : undefined"
      @click="handleCardClick"
    />

    <button
      v-if="canDebugCustomize"
      class="debug-customize"
      type="button"
      title="Debug customize"
      @click.stop="debugCustomize"
    >
      <font-awesome-icon icon="wrench" />
    </button>

    <button v-if="canExplain" class="explain-card" type="button" :aria-expanded="explanationOpen"
      @click.stop="explanationOpen ? clearExplanation() : explainCard()">{{ t('handExplanation.why') }}</button>
    <Teleport to="body">
    <div v-if="explanationOpen" ref="explanationPanel" :style="explanationStyle" class="hand-explanation" @click.stop @pointerdown.stop>
      <p v-if="explanationContext" role="status">{{ t(`handExplanation.${explanationContext}`) }}</p>
      <p v-else-if="explanationLoading" role="status">{{ t('handExplanation.loading') }}</p>
      <p v-else-if="explanationStale" role="status">{{ t('handExplanation.stale') }}</p>
      <template v-else-if="explanationError">
        <p role="alert">{{ t('handExplanation.error') }}</p>
        <button type="button" @click="explainCard">{{ t('loadState.retry') }}</button>
      </template>
      <template v-else>
        <p>{{ t(explanationScope === 'currentWindow' ? 'handExplanation.currentScope' : explanationScope === 'unavailable' ? 'handExplanation.unavailable' : 'handExplanation.scope') }}</p>
        <ul v-if="explanationScope !== 'unavailable' && explanation.length"><li v-for="(reason, index) in explanation" :key="index">{{ t(`handExplanation.${reason.key}`, reason.values) }}</li></ul>
        <p v-else-if="explanationScope !== 'unavailable'">{{ t(explanationScope === 'currentWindow' ? 'handExplanation.currentNoReason' : 'handExplanation.noReason') }}</p>
      </template>
      <section v-if="!explanationLoading && !explanationError && !explanationStale && !explanationContext && visibleSources.length" class="restriction-sources">
        <p>{{ t('handExplanation.restrictionSources') }}</p>
        <div v-for="source in visibleSources" :key="source.key">
          <button type="button" :aria-expanded="expandedSource === source.key"
            @click="expandedSource = expandedSource === source.key ? null : source.key">{{ t('handExplanation.viewSource', { name: restrictionName(source.code) }) }}</button>
          <img v-if="expandedSource === source.key" :src="cardImage(source.code)" :alt="restrictionName(source.code)" class="restriction-source-image" />
        </div>
      </section>
      <button type="button" @click="clearExplanation">{{ t('close') }}</button>
    </div>
    </Teleport>

    <CardSilenceBell
      v-if="investigatorId && investigatorId === ownerId"
      class="hand-silence-bell"
      :game="game"
      :player-id="playerId"
      :investigator-id="investigatorId"
      :card-code="cardContents.cardCode"
    />
    <AbilitiesMenu
      v-if="abilities.length > 0"
      v-model="showAbilities"
      :game="game"
      :abilities="abilities"
      :frame="cardFrame"
      :play-action="cardAction !== -1 ? cardAction : undefined"
      position="top"
      @choose="$emit('choose', $event)"
    />
  </div>
  <div class="card-container" v-else>
    <img class="card in-hand" :src="cardBack" />
  </div>
</template>

<style scoped>
.hand-silence-bell { opacity: 0; }
.card-container:hover .hand-silence-bell,
.card-container:focus-within .hand-silence-bell,
.hand-silence-bell.silence-bell--automatic,
.hand-silence-bell.silence-bell--muted { opacity: 1; }
@media (hover: none) { .hand-silence-bell { opacity: 1; } }

.card {
  width: var(--card-width);
  min-width: var(--card-width);
  border-radius: 6px;
}

.card--can-interact {
  border: 2px solid var(--ability-ready-edge);
  box-shadow: var(--ability-ready-shadow);
  transition: border-color 180ms ease, box-shadow 180ms ease;

  &:is(:hover, :focus-visible) {
    border-color: var(--ability-ready-edge-hover);
    box-shadow: var(--ability-ready-hover-shadow);
  }
  cursor: pointer;
}

.card-container {
  display: flex;
  flex-direction: column;
  position: relative;
}

.debug-customize {
  position: absolute;
  top: 4px;
  left: 4px;
  z-index: var(--z-index-20);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  border: 1px solid #111;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.9);
  color: #111;
  font-size: 11px;
  cursor: pointer;
}

.debug-customize:hover {
  background: #fff;
}
</style>

<style scoped>
.explain-card { position: absolute; bottom: 4px; left: 4px; right: 4px; z-index: 2; font-size: 11px; padding: 4px; color: var(--text); background: var(--panel); border: 1px solid var(--edge-dim); border-radius: 4px; cursor: pointer; }
.hand-explanation { position: fixed; z-index: 10000; box-sizing: border-box; width: min(296px, calc(100vw - 16px)); max-height: 48dvh; overflow: auto; padding: 12px; background: var(--panel, #eee5d4); color: var(--text); border: 1px solid var(--edge-dim); border-radius: 5px; box-shadow: 0 4px 16px #0005; font-size: 13px; line-height: 1.6; }
.hand-explanation p { margin: 0 0 8px; }
.hand-explanation ul { margin: 0 0 8px; padding-left: 20px; }
.hand-explanation button { min-height: 32px; }
.explain-card:focus-visible, .hand-explanation button:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: 2px; }
</style>

<style scoped>
.restriction-sources { border-top: 1px solid var(--edge-dim); padding-top: 8px; margin: 8px 0; }
.restriction-sources button { width: 100%; text-align: left; white-space: normal; }
.restriction-source-image { display: block; width: 100%; height: auto; margin-top: 8px; border-radius: 8px; }
</style>
