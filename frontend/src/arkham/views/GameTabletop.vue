<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useEventListener, useResizeObserver } from '@vueuse/core'
import { useRoute, useRouter } from 'vue-router'
import Game from './Game.vue'
import {
  fitTabletop, isTabletopFrame, TABLETOP_HEIGHT, TABLETOP_MESSAGE,
  TABLETOP_WIDTH, useFixedTabletop,
} from '@/arkham/composables/useFixedTabletop'

const props = withDefaults(defineProps<{ gameId: string; spectate?: boolean }>(), { spectate: false })
const route = useRoute()
const router = useRouter()
const fixed = useFixedTabletop()
const inner = isTabletopFrame()
const framed = computed(() => fixed.value && !inner)
const host = ref<HTMLElement>()
const frame = ref<HTMLIFrameElement>()
const scale = ref(fitTabletop(window.innerWidth, window.innerHeight) || 1)
const frameReady = ref(false)
const frameFailed = ref(false)
let readyTimer: ReturnType<typeof setTimeout> | undefined
const frameSource = ref('about:blank')
const pendingSource = ref('')
const mounted = ref(false)
let startFrameRequest = 0
let childPath = ''

function frameUrl(path: string) {
  // This application uses hash history. Keep the actual document endpoint
  // (including any deployment prefix/search) and replace only its route.
  const url = new URL(window.location.href)
  url.searchParams.set('arkham-tabletop-frame', '1')
  url.hash = path
  return url.href
}

watch([framed, () => route.fullPath], ([active, path]) => {
  if (!active) {
    clearTimeout(readyTimer)
    frameReady.value = false
    frameFailed.value = false
    pendingSource.value = ''
    frameSource.value = 'about:blank'
    childPath = ''
    return
  }
  if (childPath !== path || frameSource.value === 'about:blank') {
    childPath = path
    frameReady.value = false
    frameFailed.value = false
    clearTimeout(readyTimer)
    pendingSource.value = frameUrl(path)
  }
}, { immediate: true })

function measureHost() {
  const bounds = host.value?.getBoundingClientRect()
  if (bounds && bounds.width > 0 && bounds.height > 0) {
    scale.value = fitTabletop(bounds.width, bounds.height)
  }
  startFrame()
}
useResizeObserver(host, measureHost)
useEventListener(window, 'resize', measureHost)
watch([host, frame, framed, pendingSource, mounted], async () => {
  await nextTick()
  cancelAnimationFrame(startFrameRequest)
  startFrameRequest = requestAnimationFrame(measureHost)
}, { flush: 'post' })

onMounted(() => { mounted.value = true })

function startFrame() {
  const element = frame.value
  if (!mounted.value || !framed.value || !pendingSource.value || !element?.isConnected) return
  // Vue may create iframe elements in Suspense's detached staging tree. Never
  // boot the application there: it sees a 0 x 0 viewport. Navigate only after
  // insertion and layout, with the logical dimensions already applied.
  if (element.offsetWidth !== TABLETOP_WIDTH || element.offsetHeight !== TABLETOP_HEIGHT) return
  const source = pendingSource.value
  pendingSource.value = ''
  frameSource.value = source
  clearTimeout(readyTimer)
  readyTimer = setTimeout(() => { frameFailed.value = !frameReady.value }, 20000)
}


useEventListener(window, 'message', (event: MessageEvent) => {
  if (!framed.value || event.origin !== window.location.origin ||
      event.source !== frame.value?.contentWindow) return
  if (event.data?.type === 'arkham-tabletop-ready') {
    frameReady.value = true
    frameFailed.value = false
    clearTimeout(readyTimer)
    measureHost()
    return
  }
  if (event.data?.type !== TABLETOP_MESSAGE) return
  const path = event.data.path
  if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//')) return
  childPath = path
  if (route.fullPath !== path) void router.push(path)
})

// Keep the global footer out of the logical viewport and the host's fit area.
watch(() => framed.value || inner, (active) => {
  document.documentElement.classList.toggle('fixed-tabletop-page', active)
}, { immediate: true })
onBeforeUnmount(() => {
  cancelAnimationFrame(startFrameRequest)
  clearTimeout(readyTimer)
  document.documentElement.classList.remove('fixed-tabletop-page')
})
</script>

<template>
  <div ref="host" class="tabletop-viewport" :class="{ 'fixed-tabletop-host': framed }">
    <template v-if="framed">
      <div
        class="fixed-tabletop-frame"
        :style="{ width: `${TABLETOP_WIDTH * scale}px`, height: `${TABLETOP_HEIGHT * scale}px` }"
      >
        <iframe
          ref="frame"
          data-arkham-tabletop="true"
          :src="frameSource"
          :title="$t('gameBar.fixedResolution')"
          :width="TABLETOP_WIDTH"
          :height="TABLETOP_HEIGHT"
          :style="{ width: `${TABLETOP_WIDTH}px`, height: `${TABLETOP_HEIGHT}px`, transform: `scale(${scale})` }"
          @load="measureHost"
          @error="frameFailed = true"
          allow="fullscreen; autoplay"
        />
      </div>
      <div v-if="!frameReady" class="fixed-tabletop-status" role="status">
        {{ frameFailed ? $t('gameBar.fixedResolutionFailed') : $t('loadState.loading') }}
      </div>
      <button type="button" class="fixed-tabletop-exit" @click="fixed = false">
        {{ $t('gameBar.exitFixedResolution') }}
      </button>
    </template>
    <Game v-else v-bind="props" />
  </div>
</template>

<style scoped>
.tabletop-viewport {
  position: relative;
  display: flex;
  flex-direction: column;
  flex: 1 1 0;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}
.tabletop-viewport.fixed-tabletop-host {
  position: absolute;
  inset: 0;
}
.fixed-tabletop-exit, .fixed-tabletop-status {
  position: absolute;
  z-index: 2;
  color: #ead8ad;
  background: #142421;
  border: 1px solid #807452;
  border-radius: 5px;
  padding: 8px 12px;
}
.fixed-tabletop-status { top: 48px; left: 12px; }
.fixed-tabletop-exit { top: 8px; right: 12px; cursor: pointer; }
.fixed-tabletop-exit:focus-visible { outline: 2px solid #ead8ad; outline-offset: 2px; }

.fixed-tabletop-host {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1 1 0;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  isolation: isolate;
  background:
    radial-gradient(ellipse at center, transparent 40%, rgb(1 7 7 / 0.88)),
    linear-gradient(rgb(5 18 17 / 0.82), rgb(3 12 12 / 0.9)),
    url('/assets/veiled-harbour/41-多人牌桌底场-v1.avif') center / cover,
    #071311;
}
.fixed-tabletop-host::before {
  content: '';
  position: absolute;
  inset: 12px;
  border: 1px solid rgb(172 145 87 / 0.2);
  outline: 1px solid rgb(172 145 87 / 0.08);
  outline-offset: 5px;
  pointer-events: none;
  z-index: -1;
}
.fixed-tabletop-frame {
  position: relative;
  flex: 0 0 auto;
  box-shadow: 0 0 0 1px rgb(191 159 93 / 0.35), 0 0 48px rgb(0 0 0 / 0.8);
}
iframe {
  position: absolute;
  inset: 0;
  display: block;
  width: 1472px;
  height: 920px;
  min-width: 1472px;
  min-height: 920px;
  max-width: none;
  max-height: none;
  border: 0;
  transform-origin: top left;
}
</style>
