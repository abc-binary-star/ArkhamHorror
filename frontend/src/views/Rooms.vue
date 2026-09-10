<script setup lang="ts">
import { ref } from 'vue'
import api from '@/api'
import Room from '@/components/admin/Room.vue'
import LoadState from '@/components/LoadState.vue'

interface RoomData {
  roomClients: number
  roomLastUpdateAt: string | null
  roomArkhamGameId: string
}

const data = ref<RoomData[]>([])
const loaded = ref(false)
const loadError = ref(false)

const load = () => {
  loadError.value = false
  api.get<RoomData[]>('admin/rooms')
    .then((request) => { data.value = request.data })
    .catch(() => { loadError.value = true })
    .finally(() => { loaded.value = true })
}

load()
</script>

<template>
  <section class="admin-block">
      <header class="section-header">
        <h2>Open Rooms</h2>
        <span v-if="loaded && !loadError" class="count-badge" aria-label="Open rooms count">{{ data.length }}</span>
      </header>

      <LoadState v-if="loadError" error @retry="load" />
      <LoadState v-else-if="!loaded" />
      <div v-else-if="data.length === 0" class="empty box">No rooms.</div>
      <div v-else class="room-list">
        <Room v-for="room in data" :room="room" :key="room.roomArkhamGameId" />
      </div>
  </section>
</template>

<style scoped>
.admin-block,
.room-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.admin-block {
  background: color-mix(in srgb, var(--surface-panel) 96%, transparent);
  border: 1px solid color-mix(in srgb, var(--box-border) 75%, transparent);
  border-radius: 6px;
  padding: 14px;
  box-shadow: var(--shadow-3);
}

.section-header {
  align-items: center;
  display: flex;
  gap: 12px;
}

.section-header h2 {
  color: var(--title);
  flex: 1;
  font-family: Arno, 'Source Han Serif', serif;
  font-size: 1.6rem;
  line-height: 1;
  margin: 0;
  font-weight: 600;
}

.count-badge {
  align-items: center;
  background: var(--surface-raised);
  border: 1px solid var(--spooky-green);
  border-left-width: 4px;
  border-radius: 3px;
  color: var(--spooky-green-dark);
  display: inline-flex;
  font-size: 0.78rem;
  font-weight: 800;
  justify-content: center;
  line-height: 1;
  min-width: 2.1em;
  padding: 5px 9px 5px 7px;
}

.empty {
  color: var(--title);
  opacity: 0.75;
}
</style>
