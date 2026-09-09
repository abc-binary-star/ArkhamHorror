<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { clearAchievements, fetchAchievements, type ClearAchievementsScope } from '@/arkham/api'
import {
  achievementCatalog,
  achievementChecklists,
  achievementSections,
  compareAchievementCampaignIds,
  type AchievementEntry,
} from '@/arkham/achievements'
import type { Achievement } from '@/arkham/types/Achievement'
import Prompt from '@/components/Prompt.vue'

const { t } = useI18n()

const rows = ref<Achievement[]>([])
const ready = ref(false)

function reload() {
  fetchAchievements()
    .then((r) => {
      rows.value = r
    })
    .catch((e) => console.error(e))
    .finally(() => {
      ready.value = true
    })
}

onMounted(reload)

// Clearing earned achievements (all / one campaign / one achievement) asks
// for confirmation first; pendingClear holds the scope + prompt text.
const pendingClear = ref<{ scope: ClearAchievementsScope; prompt: string } | null>(null)

function requestClearAll() {
  pendingClear.value = { scope: { scope: 'all' }, prompt: t('achievements.clearAllConfirm') }
}

function requestClearCampaign(campaignId: string) {
  pendingClear.value = {
    scope: { scope: 'campaign', campaign: campaignId },
    prompt: t('achievements.clearCampaignConfirm', {
      campaign: t(`achievements.campaigns.${campaignId}`),
    }),
  }
}

function requestClearOne(entry: AchievementEntry) {
  pendingClear.value = {
    scope: { scope: 'achievement', achievement: entry.tag },
    prompt: t('achievements.clearOneConfirm', {
      name: t(`achievements.entries.${entry.tag}.name`),
    }),
  }
}

function confirmClear() {
  const pending = pendingClear.value
  pendingClear.value = null
  if (pending)
    clearAchievements(pending.scope)
      .then(reload)
      .catch((e) => console.error(e))
}

const anyEarned = computed(() => rows.value.some((r) => r.earnedAt !== null))

const campaignEarnedCount = (campaign: { entries: AchievementEntry[] }) =>
  campaign.entries.filter((entry) => !!earnedRow(entry)).length

const campaignProgressPercent = (campaign: { entries: AchievementEntry[] }) =>
  campaign.entries.length === 0
    ? 0
    : Math.round((campaignEarnedCount(campaign) / campaign.entries.length) * 100)

const campaignHasEarned = (campaign: { entries: AchievementEntry[] }) =>
  campaignEarnedCount(campaign) > 0

const byTag = computed(() => new Map(rows.value.map((r) => [r.achievement, r])))

const campaigns = computed(() => {
  const groups = new Map<string, AchievementEntry[]>()
  for (const entry of achievementCatalog) {
    const group = groups.get(entry.campaignId)
    if (group) group.push(entry)
    else groups.set(entry.campaignId, [entry])
  }
  return [...groups.entries()]
    .sort(([a], [b]) => compareAchievementCampaignIds(a, b))
    .map(([campaignId, entries]) => ({
      campaignId,
      entries,
      // The Dream-Eaters prints one list per mini-campaign; every other campaign
      // comes back as a single unlabelled section.
      sections: achievementSections(entries),
    }))
})

const earnedRow = (entry: AchievementEntry): Achievement | null => {
  const row = byTag.value.get(entry.tag)
  return row && row.earnedAt !== null ? row : null
}

// Cross-playthrough checklist achievements: the row's progress column holds
// the checked item keys; an earned row counts as fully checked.
const checklist = (entry: AchievementEntry): string[] | undefined =>
  achievementChecklists[entry.tag]

const checkedItems = (entry: AchievementEntry): string[] => {
  const row = byTag.value.get(entry.tag)
  if (!row) return []
  if (row.earnedAt !== null) return checklist(entry) ?? []
  return Array.isArray(row.progress)
    ? row.progress.filter((x): x is string => typeof x === 'string')
    : []
}

const isChecked = (entry: AchievementEntry, item: string): boolean =>
  checkedItems(entry).includes(item)

const earnedDate = (row: Achievement): string | null => {
  if (!row.earnedAt) return null
  const d = new Date(row.earnedAt)
  return isNaN(d.getTime()) ? null : d.toLocaleDateString()
}
</script>

<template>
  <div class="achievements-page archive-page">
    <div class="achievements-column">
      <div class="page-header">
        <div class="page-heading">
          <img
            class="achievement-seal"
            src="/assets/veiled-harbour/C05-档案压印.svg"
            alt=""
            aria-hidden="true"
          />
          <div>
            <p class="archive-kicker"><span></span> CASE RECORD / PERSONAL ARCHIVE <span></span></p>
            <h1>{{ t('achievements.pageTitle') }}</h1>
          </div>
        </div>
        <button
          v-if="anyEarned"
          type="button"
          class="clear-btn clear-all-btn"
          @click="requestClearAll"
        >
          <font-awesome-icon icon="trash" aria-hidden="true" />
          {{ t('achievements.clearAll') }}
        </button>
      </div>

      <div class="page-rule" aria-hidden="true"><span></span><i></i><span></span></div>

      <details v-for="campaign in campaigns" :key="campaign.campaignId" class="campaign-section">
        <summary class="campaign-header">
          <div class="campaign-title">
            <h2>{{ t(`achievements.campaigns.${campaign.campaignId}`) }}</h2>
            <div
              class="campaign-progress"
              :aria-label="`${campaignEarnedCount(campaign)} of ${campaign.entries.length} achievements earned`"
            >
              <span class="progress-count"
                >{{ campaignEarnedCount(campaign) }}/{{ campaign.entries.length }}</span
              >
              <span class="progress-track" aria-hidden="true">
                <span
                  class="progress-fill"
                  :style="{ width: `${campaignProgressPercent(campaign)}%` }"
                />
              </span>
            </div>
          </div>
          <button
            v-if="campaignHasEarned(campaign)"
            type="button"
            class="clear-btn"
            @click.stop.prevent="requestClearCampaign(campaign.campaignId)"
          >
            {{ t('achievements.clearCampaign') }}
          </button>
        </summary>
        <template v-for="section in campaign.sections" :key="section.part ?? 'all'">
          <h3 v-if="section.part" class="part-header">
            <span class="part-title">{{ t(`achievements.parts.${section.part}`) }}</span>
            <span class="part-count"
              >{{ campaignEarnedCount(section) }}/{{ section.entries.length }}</span
            >
          </h3>
          <ul class="entry-list">
            <li
              v-for="entry in section.entries"
              :key="entry.tag"
              class="entry"
              :class="{ earned: !!earnedRow(entry) }"
            >
              <font-awesome-icon :icon="['fas', 'trophy']" class="entry-icon" aria-hidden="true" />
              <div class="entry-body">
                <span class="entry-name">{{ t(`achievements.entries.${entry.tag}.name`) }}</span>
                <span class="entry-text">{{ t(`achievements.entries.${entry.tag}.text`) }}</span>
                <ul v-if="checklist(entry)" class="checklist">
                  <li
                    v-for="item in checklist(entry)"
                    :key="item"
                    class="checklist-item"
                    :class="{ checked: isChecked(entry, item) }"
                  >
                    <span class="checkbox" aria-hidden="true">{{
                      isChecked(entry, item) ? '☑' : '☐'
                    }}</span>
                    {{ t(`achievements.entries.${entry.tag}.items.${item}`) }}
                  </li>
                </ul>
                <span v-if="earnedRow(entry)" class="entry-earned">
                  {{ earnedDate(earnedRow(entry)!) }}
                  <router-link
                    v-if="earnedRow(entry)!.arkhamGameId"
                    :to="`/games/${earnedRow(entry)!.arkhamGameId}`"
                    >{{ t('achievements.viewGame') }}</router-link
                  >
                  <span v-else class="game-deleted">{{ t('achievements.gameDeleted') }}</span>
                </span>
              </div>
              <button
                v-if="earnedRow(entry)"
                type="button"
                class="clear-btn entry-clear"
                :title="t('achievements.clearOne')"
                @click="requestClearOne(entry)"
              >
                <font-awesome-icon icon="trash" />
              </button>
            </li>
          </ul>
        </template>
      </details>

      <Prompt
        v-if="pendingClear"
        :prompt="pendingClear.prompt"
        :yes="confirmClear"
        :no="
          () => {
            pendingClear = null
          }
        "
      />
    </div>
  </div>
</template>

<style scoped>
.achievements-page {
  flex: 1;
  min-height: 0;
  width: 100%;
  overflow: auto;
  background: var(--background-dark) url('/assets/veiled-harbour/29-档案页底图.png') center top /
    cover fixed no-repeat;
}

.page-header,
.campaign-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.clear-btn {
  border: var(--edge-width) solid var(--edge-dim);
  border-radius: var(--radius-sm);
  background: var(--surface-raised);
  color: var(--text-dim);
  padding: 2px 7px;
  font-size: 0.72rem;
  line-height: 1.3;
  cursor: pointer;
  transition:
    background 0.15s ease,
    border-color 0.15s ease,
    color 0.15s ease;

  &:hover {
    border-color: var(--delete);
    background: color-mix(in srgb, var(--delete) 12%, var(--surface-raised));
    color: var(--status-danger-text);
  }
}

.entry-clear {
  align-self: center;
  margin-left: auto;
  flex-shrink: 0;
}

.achievements-column {
  width: min(1080px, calc(100% - 40px));
  min-height: calc(100% - 40px);
  margin-inline: auto;
  box-sizing: border-box;
  margin-top: 20px;
  margin-bottom: 20px;
  padding: clamp(24px, 4vw, 52px);
  background: rgba(233, 225, 210, 0.92);
  border: 1px solid color-mix(in srgb, var(--brass) 70%, var(--edge-dim));
  box-shadow:
    0 16px 42px rgba(25, 31, 30, 0.28),
    inset 0 0 0 5px rgba(244, 239, 228, 0.3);
  display: flex;
  flex-direction: column;
  gap: 18px;
  position: relative;
}

.achievements-column::before,
.achievements-column::after {
  content: '';
  position: absolute;
  width: 48px;
  height: 48px;
  pointer-events: none;
  opacity: 0.55;
  background: url('/assets/veiled-harbour/C04-黄铜压线角件-左上.svg') top left / contain no-repeat;
}

.achievements-column::before {
  top: 12px;
  left: 12px;
}
.achievements-column::after {
  right: 12px;
  bottom: 12px;
  transform: rotate(180deg);
}

.page-heading {
  display: flex;
  align-items: center;
  gap: 18px;
  min-width: 0;
}

.achievement-seal {
  width: 74px;
  height: 74px;
  padding: 7px;
  box-sizing: border-box;
  border: 1px solid color-mix(in srgb, var(--brass) 80%, transparent);
  border-radius: 50%;
  background: rgba(38, 55, 58, 0.08);
  box-shadow: inset 0 0 0 5px rgba(244, 239, 228, 0.35);
}

.archive-kicker {
  display: flex;
  align-items: center;
  gap: 9px;
  margin: 0 0 7px;
  color: var(--spooky-green);
  font-family: Arno, 'Noto Serif SC', serif;
  font-size: 0.66rem;
  font-weight: 700;
  letter-spacing: 0.16em;

  span {
    width: 24px;
    height: 1px;
    background: var(--brass);
  }
}

.page-rule {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: -4px 0 2px;
  color: var(--brass);

  span {
    flex: 1;
    height: 1px;
    background: color-mix(in srgb, var(--brass) 45%, transparent);
  }
  i {
    width: 7px;
    height: 7px;
    border: 1px solid var(--brass);
    transform: rotate(45deg);
  }
}

h1 {
  font-family: Arno, 'Noto Serif SC', 'Noto Serif CJK SC', serif;
  font-size: clamp(2rem, 4vw, 3rem);
  margin: 0;
  color: var(--title);
  font-weight: 600;
  letter-spacing: 0.02em;
  line-height: 1;
}

.campaign-section {
  --accent: #b3922f;
  background: linear-gradient(135deg, rgba(244, 239, 228, 0.9), rgba(232, 225, 210, 0.86));
  border: 1px solid rgba(129, 123, 112, 0.72);
  border-left: 3px solid var(--brass);
  padding: 16px 18px;
  box-shadow:
    0 3px 10px rgba(37, 39, 37, 0.1),
    inset 0 0 0 1px rgba(244, 239, 228, 0.42);
  transition:
    border-color 120ms ease,
    box-shadow 120ms ease;
}

.campaign-section[open] {
  border-left-color: var(--accent);
  box-shadow:
    0 5px 14px rgba(37, 39, 37, 0.14),
    inset 0 0 0 1px rgba(244, 239, 228, 0.42);
}

.campaign-header {
  cursor: pointer;
  list-style: none;
  padding: 2px 0 10px;
  border-bottom: 1px solid rgba(129, 123, 112, 0.55);
}

.campaign-header::-webkit-details-marker {
  display: none;
}

.campaign-header::before {
  content: '▸';
  color: var(--text-faint);
  font-size: 0.85rem;
  transition: transform 0.15s ease;
}

.campaign-title {
  flex: 1;
  display: flex;
  align-items: baseline;
  gap: 14px;
  min-width: 0;
}

.campaign-progress {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--text-dim);
  font-size: 0.78rem;
  white-space: nowrap;
}

.progress-count {
  font-variant-numeric: tabular-nums;
}

.progress-track {
  width: 96px;
  height: 5px;
  border-radius: 999px;
  background: var(--panel-inset);
  overflow: hidden;
}

.progress-fill {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--accent);
  box-shadow: 0 0 8px rgba(179, 146, 47, 0.35);
}

.campaign-section[open] .campaign-header::before {
  transform: rotate(90deg);
}

h2 {
  font-family: Arno, 'Noto Serif SC', 'Noto Serif CJK SC', serif;
  font-size: clamp(1.05rem, 2vw, 1.35rem);
  font-weight: 600;
  color: var(--text);
  letter-spacing: 0.02em;
  margin: 0;
}

.entry-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 12px 0 0;
  padding: 0;
  list-style: none;
}

/* Mini-campaign divider (The Dream-Eaters' two printed lists). */
.part-header {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin: 16px 0 0;
  font-family: 'Noto Sans', Avenir, Helvetica, Arial, sans-serif;
  font-size: 1em;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.part-title {
  color: #765f31;
}

.part-count {
  color: var(--text-faint);
  font-family: inherit;
  font-size: 0.78rem;
  font-variant-numeric: tabular-nums;
  letter-spacing: normal;
}

.entry {
  display: flex;
  gap: 10px;
  padding: 10px 12px;
  background: rgba(244, 239, 228, 0.66);
  border: 1px solid rgba(169, 163, 152, 0.76);
  border-left: 3px solid var(--edge-faint);
  transition:
    background 120ms ease,
    border-color 120ms ease,
    transform 120ms ease;
}

.entry:hover {
  background: rgba(244, 239, 228, 0.94);
  border-color: var(--edge-dim);
  transform: translateY(-1px);
}

.entry:not(.earned) > .entry-icon,
.entry:not(.earned) .entry-name,
.entry:not(.earned) .entry-text,
.entry:not(.earned) .checklist-item:not(.checked) {
  opacity: 0.55;
  filter: grayscale(60%);
}

.entry.earned {
  background: color-mix(in srgb, var(--brass) 10%, var(--surface-raised));
  border-left-color: var(--accent);
}

.entry-icon {
  color: var(--text-faint);
  flex-shrink: 0;
  margin-top: 3px;
}

.entry.earned .entry-icon {
  color: var(--accent);
}

.entry-body {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.entry-name {
  color: var(--title);
  font-weight: 600;
  font-size: 0.95rem;
  line-height: 1.4;
}

.entry-text {
  color: var(--text-dim);
  font-size: 0.85rem;
  line-height: 1.45;
}

.checklist {
  margin: 4px 0 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.checklist-item {
  color: var(--text-dim);
  font-size: 0.85rem;
  line-height: 1.45;
  display: flex;
  gap: 6px;
  align-items: baseline;
}

.checklist-item.checked {
  color: #765f31;
}

.checkbox {
  font-size: 1rem;
}

.entry-earned {
  font-size: 0.8rem;
  color: #765f31;
  display: flex;
  gap: 8px;
  align-items: baseline;

  a {
    color: var(--spooky-green);
    text-decoration: none;
    &:hover {
      text-decoration: underline;
    }
  }
}

.game-deleted {
  color: var(--text-faint);
  font-style: italic;
}

@media (max-width: 768px) {
  .achievements-column {
    width: calc(100% - 20px);
    margin-top: 10px;
    margin-bottom: 10px;
    padding: 26px 14px 24px;
  }

  .page-header {
    align-items: flex-start;
  }
  .page-heading {
    gap: 12px;
  }
  .achievement-seal {
    width: 54px;
    height: 54px;
    padding: 5px;
  }
  .archive-kicker {
    font-size: 0.55rem;
    letter-spacing: 0.09em;
  }
  .archive-kicker span {
    width: 14px;
  }
  .clear-all-btn {
    padding-inline: 8px;
  }
  .campaign-title {
    gap: 8px;
    flex-wrap: wrap;
  }
  .progress-track {
    width: 76px;
  }
  .campaign-section {
    padding: 13px 12px;
  }
  .entry {
    gap: 8px;
    padding: 9px 10px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .campaign-section,
  .entry {
    transition: none;
  }
}
</style>
