<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Game, InvestigatorStats } from '@/arkham/types/Game'
import { investigatorPortrait } from '@/arkham/cardImages'

const props = defineProps<{
  game: Game
  stats: Record<string, InvestigatorStats>
  title?: string
}>()

const { t } = useI18n()

const lookup = (id: string) =>
  props.game.investigators[id]
  ?? props.game.killedInvestigators?.[id]
  ?? props.game.retiredInvestigators?.[id]
  ?? props.game.otherInvestigators?.[id]

const rows = computed(() =>
  Object.entries(props.stats)
    .map(([id, stats]) => ({ id, stats, investigator: lookup(id) }))
    .filter((row) => row.investigator)
    .filter((row) =>
      row.stats.damageDealt || row.stats.damageTaken || row.stats.horrorTaken || row.stats.cluesGained
    ),
)

const hasStats = computed(() => rows.value.length > 0)
</script>

<template>
  <div v-if="hasStats" class="stats-panel">
    <h3 v-if="title" class="stats-title">{{ title }}</h3>
    <table>
      <thead>
        <tr>
          <th class="who"></th>
          <th>{{ t('stats.damageDealt') }}</th>
          <th>{{ t('stats.damageTaken') }}</th>
          <th>{{ t('stats.horrorTaken') }}</th>
          <th>{{ t('stats.cluesGained') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="row.id">
          <td class="who">
            <div class="who-inner">
              <img :src="investigatorPortrait(game, row.id)" :alt="row.investigator!.name.title" />
              <span>{{ row.investigator!.name.title }}</span>
            </div>
          </td>
          <td>{{ row.stats.damageDealt }}</td>
          <td>{{ row.stats.damageTaken }}</td>
          <td>{{ row.stats.horrorTaken }}</td>
          <td>{{ row.stats.cluesGained }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped lang="scss">
.stats-panel {
  background: var(--surface-panel);
  box-shadow: var(--shadow-3);
  border-radius: 8px;
  padding: 10px 14px;
  color: var(--text);

  .stats-title {
    margin: 0 0 6px;
    color: var(--title);
    font-family: Arno, 'Source Han Serif', serif;
    font-size: 1.1em;
    font-weight: normal;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.95em;
  }

  th {
    color: var(--title);
    font-family: Arno, 'Source Han Serif', serif;
    font-weight: normal;
    font-size: 0.9em;
    text-align: center;
    padding: 4px 8px;
  }

  td {
    text-align: center;
    padding: 4px 8px;
  }

  tbody tr + tr td {
    border-top: 1px dashed oklch(from var(--title) calc(l - 0.4) c h / 0.35);
  }

  .who {
    text-align: left;

    .who-inner {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    img {
      width: 30px;
      height: 30px;
      border-radius: 4px;
      object-fit: cover;
    }
  }
}
</style>
