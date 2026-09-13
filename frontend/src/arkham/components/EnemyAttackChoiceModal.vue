<script setup lang="ts">
import { computed, inject, nextTick, onBeforeUnmount, ref, useId, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Game } from '@/arkham/types/Game'
import { choices } from '@/arkham/types/Game'
import { cardImage } from '@/arkham/cardImages'
import { processingKey, phaseAnnouncementKey, uiLockKey } from '@/arkham/injectionKeys'
import QuestionChoices from './QuestionChoices.vue'

const props = defineProps<{ game: Game; playerId: string; opportunity: boolean }>()
const emit = defineEmits<{ choose: [index: number] }>()
const { t } = useI18n({ useScope: 'local', messages: {
  zh: {
    regular: '暗影迫近 · 敌人来袭', opportunity: '破绽已现 · 借机攻击',
    regularVerse: '灯火在腥风中颤抖，黑暗里的饥饿之物已循着你的心跳而来。',
    opportunityVerse: '你移开目光的刹那，帷幕后的利爪便探入了现实。黑暗从不放过片刻的疏忽。',
    instruction: '选择下方怪物，继续结算其攻击。若有多只怪物，请决定攻击顺序。',
    resolve: '结算这次攻击', inspect: '查看牌桌', restore: '仍有敌人攻击待结算',
    damage: '伤害 {count}', horror: '恐惧 {count}', card: '即将攻击的敌人',
  },
  en: {
    regular: 'Shadows gather · Enemy attack', opportunity: 'A moment exposed · Attack of opportunity',
    regularVerse: 'The lantern trembles. Something hungry in the darkness has learned the rhythm of your heart.',
    opportunityVerse: 'In the instant you look away, claws reach through the veil. The darkness never wastes an opening.',
    instruction: 'Choose an enemy below to resolve its attack. If several enemies are attacking, choose their order.',
    resolve: 'Resolve this attack', inspect: 'View table', restore: 'Enemy attacks await resolution',
    damage: 'Damage {count}', horror: 'Horror {count}', card: 'Attacking enemy',
  },
} })
const titleId = useId()
const descriptionId = useId()
const dialog = ref<HTMLDialogElement | null>(null)
const collapsed = ref(false)
const submitted = ref(false)
const processing = inject(processingKey, ref(false))
const announcement = inject(phaseAnnouncementKey, ref(false))
const uiLock = inject(uiLockKey, ref(false))
const blocked = computed(() => announcement.value || uiLock.value)
const busy = computed(() => processing.value || submitted.value || blocked.value)
const entries = computed(() => choices(props.game, props.playerId).map((choice, index) => {
  const enemy = choice.tag === 'TargetLabel' && choice.target.tag === 'EnemyTarget' && typeof choice.target.contents === 'string'
    ? props.game.enemies[choice.target.contents] : undefined
  return { choice, index, enemy, image: enemy ? cardImage(`${enemy.cardCode}${enemy.flipped ? 'b' : ''}`) : null }
}))
const questionKey = computed(() => JSON.stringify(props.game.question[props.playerId]))
async function syncDialog() {
  await nextTick()
  if (blocked.value || collapsed.value || !entries.value.length) dialog.value?.close()
  else if (dialog.value?.isConnected && !dialog.value.open) dialog.value.showModal()
}
function collapse() { collapsed.value = true; dialog.value?.close() }
function choose(index: number) {
  if (busy.value || !entries.value.some(entry => entry.index === index)) return
  submitted.value = true
  emit('choose', index)
}
watch(questionKey, () => { submitted.value = false; collapsed.value = false; void syncDialog() }, { immediate: true, flush: 'post' })
watch([blocked, collapsed], syncDialog, { flush: 'post' })
watch(processing, value => { if (!value) submitted.value = false })
onBeforeUnmount(() => dialog.value?.close())
</script>

<template>
  <Teleport to="body">
    <button v-if="collapsed && !blocked" class="attack-reminder" type="button" @click="collapsed = false">{{ t('restore') }}</button>
    <dialog ref="dialog" class="attack-dialog" :class="{ 'attack-dialog--multiple': entries.length > 1 }" :aria-labelledby="titleId" :aria-describedby="descriptionId" @cancel.prevent="collapse">
      <h2 :id="titleId">{{ t(opportunity ? 'opportunity' : 'regular') }}</h2>
      <p class="verse">{{ t(opportunity ? 'opportunityVerse' : 'regularVerse') }}</p>
      <p :id="descriptionId" class="instruction">{{ t('instruction') }}</p>
      <fieldset :disabled="busy" :aria-busy="busy">
        <section v-for="entry in entries" :key="entry.index" class="attack-entry">
          <template v-if="entry.enemy && entry.image">
            <img :src="entry.image" :alt="t('card')" />
            <div class="values"><span>{{ t('damage', { count: entry.enemy.healthDamage }) }}</span><span>{{ t('horror', { count: entry.enemy.sanityDamage }) }}</span></div>
            <button type="button" @click="choose(entry.index)">{{ t('resolve') }}</button>
          </template>
          <QuestionChoices v-else :game="game" :choices="[[entry.choice, entry.index]]" @choose="choose" />
        </section>
      </fieldset>
      <button class="inspect" type="button" @click="collapse">{{ t('inspect') }}</button>
    </dialog>
  </Teleport>
</template>

<style scoped>
.attack-dialog { position: fixed; inset: 0; margin: auto; box-sizing: border-box; width: min(360px, calc(100vw - 32px)); max-height: calc(100dvh - 32px); overflow: auto; padding: 20px; border: 1px solid #a98569; border-radius: 10px; background: radial-gradient(ellipse at top, #34302e, #162422 65%); color: #e9dfcb; box-shadow: 0 24px 80px #000b; }
.attack-dialog--multiple { width: min(620px, calc(100vw - 32px)); }
.attack-dialog::backdrop { background: #050d10b3; }
h2 { margin: 0; color: #dbb990; font: 500 1.12rem 'Songti SC', Georgia, serif; text-align: center; }
p { line-height: 1.7; }
.verse { color: #baaa92; font: italic .9rem/1.8 'Songti SC', Georgia, serif; }
.instruction { font-size: .82rem; color: #c7c4b6; }
fieldset { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(220px, 100%), 1fr)); gap: 16px; margin: 0; padding: 0; border: 0; min-width: 0; }
fieldset:disabled { opacity: .65; pointer-events: none; }
.attack-entry { min-width: 0; display: flex; flex-direction: column; gap: 10px; align-items: center; }
.attack-entry img { width: min(100%, 200px); max-height: 32dvh; object-fit: contain; border-radius: 8px; }
.values { display: flex; gap: 16px; font-size: .85rem; color: #d6ae9c; }
button { min-height: 42px; padding: 9px 14px; border: 1px solid #ad8b65; border-radius: 6px; background: linear-gradient(#544133, #382f29); color: #f0e1c7; cursor: pointer; font-size: .85rem; }
.attack-entry button { width: min(100%, 250px); }
button:focus-visible { outline: 2px solid #e2c59e; outline-offset: 3px; }
.inspect { display: block; margin: 8px auto 0; background: transparent; border-color: #ad8b6540; }
.attack-reminder { position: fixed; bottom: calc(84px + env(safe-area-inset-bottom)); left: 50%; transform: translateX(-50%); z-index: 1100; max-width: calc(100vw - 32px); }
</style>
