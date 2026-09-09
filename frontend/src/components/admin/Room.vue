<script setup lang="ts">
import { computed } from 'vue'
import api from '@/api'

interface RoomData {
  roomClients: number
  roomLastUpdateAt: string | null
  roomArkhamGameId: string
}

const props = defineProps<{
  room: RoomData
}>()

const lastUpdated = computed(() => props.room.roomLastUpdateAt ? props.room.roomLastUpdateAt : 'deleted')
const deleted = computed(() => lastUpdated.value === 'deleted')

async function deleteRoom() {
  await api.delete(`admin/rooms/${props.room.roomArkhamGameId}`)
  window.location.reload()
}
</script>

<template>
  <div class="room box" :class="{ deleted }">
    <div class="room-stat">
      <span class="label">Clients</span>
      <strong>{{ room.roomClients }}</strong>
    </div>
    <div class="room-stat updated">
      <span class="label">Last Updated</span>
      <span>{{ lastUpdated }}</span>
    </div>
    <div class="room-actions">
      <router-link :to="`/admin/games/${room.roomArkhamGameId}`">View</router-link>
      <a v-if="deleted" href="#" class="delete" @click.prevent="deleteRoom">Delete</a>
    </div>
  </div>
</template>

<style scoped>
.room {
  align-items: center;
  display: grid;
  gap: 14px;
  grid-template-columns: minmax(80px, 0.5fr) minmax(180px, 1fr) auto;
}

.room.deleted {
  opacity: 0.82;
}

.room-stat {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.label {
  color: color-mix(in srgb, var(--title) 62%, transparent);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

strong {
  color: var(--title);
  font-size: 1.3rem;
}

.updated span:last-child {
  color: var(--title);
  overflow-wrap: anywhere;
}

.room-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.room-actions a {
  background: var(--surface-raised);
  border: var(--edge-width) solid var(--edge-dim);
  border-radius: var(--radius-sm);
  color: var(--title);
  font-size: 0.8rem;
  font-weight: 700;
  padding: 7px 10px;
  text-decoration: none;
  text-transform: uppercase;
}

.room-actions a:hover {
  background: var(--surface-panel);
  border-color: var(--spooky-green);
  color: var(--spooky-green-dark);
}

.room-actions .delete {
  border-color: color-mix(in srgb, var(--delete) 65%, var(--box-border));
  color: var(--status-danger-text);
}

@media (max-width: 620px) {
  .room {
    align-items: stretch;
    grid-template-columns: 1fr;
  }

  .room-actions {
    justify-content: flex-start;
  }
}
</style>
