<script setup lang="ts">
import { computed, inject, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { choices, type Game } from '@/arkham/types/Game'
import { isInlineSkillTestFastWindow } from '@/arkham/skillTestFastWindow'
import { phaseAnnouncementKey, processingKey, spectateKey } from '@/arkham/injectionKeys'
import { sourceCardCode } from '@/arkham/cardImages'
import AbilityButton from './AbilityButton.vue'
import CardPromptSettings from './CardPromptSettings.vue'

const props = defineProps<{ game: Game; playerId: string }>()
const emit = defineEmits<{ choose: [index: number] }>()
const { t } = useI18n()
const processing = inject(processingKey, ref(false))
const phaseAnnouncement = inject(phaseAnnouncementKey, ref(false))
const spectate = inject(spectateKey, ref(false))
const submitted = ref(false)
const busy = computed(() => submitted.value || processing.value || spectate.value)
const visible = computed(() => !phaseAnnouncement.value && isInlineSkillTestFastWindow(props.game, props.playerId))
const entries = computed(() => choices(props.game, props.playerId).map((choice, index) => ({ choice, index,
  code: choice.tag === 'AbilityLabel' ? sourceCardCode(choice.ability.source, props.game) : null,
})))
const beforeDraw = computed(() => props.game.skillTest?.step === 'SkillTestFastWindow2')
watch(() => JSON.stringify(props.game.question[props.playerId]), () => { submitted.value = false })
watch(processing, value => { if (!value) submitted.value = false })
function choose(index: number) {
  if (busy.value || !visible.value) return
  submitted.value = true
  emit('choose', index)
}
</script>

<template>
  <section v-if="visible" class="skill-test-fast-actions" :aria-label="t('cardOption.testFast.title')">
    <p>{{ t(beforeDraw ? 'cardOption.testFast.beforeDraw' : 'cardOption.testFast.beforeCommit') }}</p>
    <fieldset :disabled="busy">
      <div v-for="entry in entries" :key="entry.index" class="fast-action-row">
        <template v-if="entry.choice.tag === 'AbilityLabel'">
          <AbilityButton :game="game" :ability="entry.choice" tooltip-is-button-text @click="choose(entry.index)" />
          <CardPromptSettings v-if="entry.code && game.skillTest" :game="game" :player-id="playerId"
            :investigator-id="game.skillTest.investigator" :card-code="entry.code" />
        </template>
        <button v-else-if="entry.choice.tag === 'SkipTriggersButton'" type="button" class="continue-test" @click="choose(entry.index)">
          {{ t(beforeDraw ? 'cardOption.testFast.reveal' : 'cardOption.testFast.commit') }}
        </button>
      </div>
    </fieldset>
  </section>
</template>

<style scoped>
.skill-test-fast-actions { padding: 10px 12px; margin: 8px 0; border: 1px solid var(--box-border); border-radius: 8px; background: var(--background-dark); }
.skill-test-fast-actions p { margin: 0 0 8px; font-size: 13px; color: var(--text); }
.skill-test-fast-actions fieldset { border: 0; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 8px; min-width: 0; }
.fast-action-row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.continue-test { width: 100%; padding: 8px 12px; cursor: pointer; }
</style>
