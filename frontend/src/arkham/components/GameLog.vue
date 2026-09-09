<script lang="ts" setup>
import { watch, ref, computed, nextTick, onMounted } from 'vue';
import { Game } from '@/arkham/types/Game';
import GameMessage from '@/arkham/components/GameMessage.vue';

const props = defineProps<{
  game: Game
  gameLog: readonly string[]
}>()

// Render only the newest entries: GameMessage re-parses its message (embedded
// i18n + several regexes) on every whole-game update, so the full history is
// unrolled on demand instead of being live all at once. Keys are absolute log
// indexes so "load older" mounts new entries without re-rendering existing ones.
const INITIAL_VISIBLE = 50
const LOAD_MORE_STEP = 100

const visibleCount = ref(INITIAL_VISIBLE)
const visibleLog = computed(() => {
  const start = Math.max(0, props.gameLog.length - visibleCount.value)
  return props.gameLog.slice(start).map((msg, i) => ({ msg, index: start + i }))
})
const olderCount = computed(() => Math.max(0, props.gameLog.length - visibleCount.value))

const messages = ref<HTMLElement | null>(null)

// New entries only auto-scroll when the reader is already near the bottom;
// scrolling up to read history must not be yanked back by the next log line.
const NEAR_BOTTOM_THRESHOLD = 160

const isNearBottom = (el: HTMLElement) =>
  el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_THRESHOLD

const scrollToBottom = async () => {
  const el = messages.value
  if (!el) return
  await nextTick()
  const child = el.lastElementChild
  if (child) {
    child.scrollIntoView(false)
    el.scrollTop = el.scrollTop + 100
  }
}

onMounted(scrollToBottom)

watch(() => props.gameLog, async (log, oldLog) => {
  const el = messages.value
  if (!el) return
  const grew = log.length > (oldLog?.length ?? 0)
  // Appended entries sit below the viewport, so reading position is preserved
  // naturally; only follow the tail when the reader is already near it.
  if (grew && isNearBottom(el)) {
    await scrollToBottom()
  }
})

async function loadOlder() {
  const anchor = messages.value?.querySelector('li:first-child') ?? null
  visibleCount.value += LOAD_MORE_STEP
  await nextTick()
  // The newly revealed entries are inserted above the reader's position; keep
  // the previously-first entry where it was on screen.
  anchor?.scrollIntoView(false)
}

</script>

<template>
  <div class="game-log">
    <button v-if="olderCount > 0" class="load-older" @click="loadOlder">
      {{ $t('game.loadOlderLogEntries', { n: olderCount }) }}
    </button>
    <ul ref="messages">
      <li class="log-entry" v-for="entry in visibleLog" :key="entry.index"><GameMessage :game="game" :msg="entry.msg" /></li>
    </ul>
  </div>
</template>

<style scoped>
.game-log {
  background:
    linear-gradient(rgb(246 240 225 / 0.2), rgb(246 240 225 / 0.2)),
    url('/assets/veiled-harbour/T03-日志书页.png') center / cover no-repeat;
  border: 1px solid color-mix(in srgb, var(--brass) 62%, var(--border-panel));
  width: calc(100% - 20px);
  border-radius: 2px;
  margin: 12px 10px;
  padding: 16px 16px 18px 28px;
  flex: 1 1 auto;
  min-height: 0;
  overflow-x: hidden;
  display: flex;
  flex-direction: column;
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
  }
}

.load-older {
  flex: 0 0 auto;
  width: 100%;
  padding: 6px 10px;
  margin: 0 0 12px -12px;
  border: 1px solid color-mix(in srgb, var(--brass) 52%, var(--edge-faint));
  border-radius: 2px;
  background: rgb(255 252 242 / 0.48);
  color: var(--text);
  font-size: 0.8em;
  cursor: pointer;
  &:hover {
    background: var(--background);
  }
}

.log-entry {
  padding: 9px 8px 9px 12px;
  margin: 0;
  border: 0;
  border-left: 2px solid color-mix(in srgb, var(--brass) 40%, transparent);
  border-radius: 0;
  color: var(--text-on-paper, var(--text));
  font-weight: 500;
  font-size: 0.8em;

  &:nth-child(even) {
    background: rgb(255 252 242 / 0.26);
  }

  &:last-child {
    border-left-color: var(--brass);
  }
}
</style>
