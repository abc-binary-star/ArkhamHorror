<template>
  <div v-if="!avifSupported" class="error-message container">
    <header><h2 class="title">Please update your browser</h2></header>
    <section class="box">
      <p>Your browser does not support AVIF images. Please update your browser or switch to a different one.</p>
    </section>
  </div>
  <template v-else>
    <NavBar v-if="!route.meta.hideNav"/>
    <main class="router-container">
      <Suspense>
        <router-view v-slot="{ Component }">
          <transition name="fade">
            <component :is="Component" />
          </transition>
        </router-view>
        <template #fallback>
          <div class="app-loading" role="status">{{ $t('loadState.loading') }}</div>
        </template>
      </Suspense>
    </main>
    <ModalsContainer />
  </template>
  <footer class="app-footer"><a href="https://www.fantasyflightgames.com/en/products/arkham-horror-the-card-game/" rel="noreferrer" target="_blank" tabindex="-1">Arkham Horror: The Card Game™</a> and all related content © <a href="https://www.fantasyflightgames.com" rel="noreferrer" target="_blank" tabindex="-1">Fantasy Flight Games (FFG)</a>. This site is not produced, endorsed by or affiliated with FFG. <router-link to="/about">{{$t('nav.about')}}.</router-link></footer>
</template>

<script lang="ts" setup>
import { clientLog } from '@/utils/clientLog'
import { ModalsContainer } from 'vue-final-modal'
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useSiteSettingsStore } from '@/stores/site_settings'
import { checkImageExists, fallbackLocalizedCardImage } from '@/arkham/helpers'
import NavBar from '@/components/NavBar.vue'

const route = useRoute()
const settingsStore = useSiteSettingsStore()

// Image errors do not bubble. Capture them for locations, acts, agendas and
// card previews, including cards mounted after the initial page load.
document.addEventListener('error', fallbackLocalizedCardImage, true)
onBeforeUnmount(() => document.removeEventListener('error', fallbackLocalizedCardImage, true))

// index.html ships `lang="en"` as the neutral default; the UI locale decides
// what the document actually is, which CJK line breaking, hyphenation and
// screen-reader pronunciation all read.
const { locale } = useI18n({ useScope: 'global' })
function syncDocumentLang(value: string) {
  document.documentElement.lang = value === 'zh' ? 'zh-Hans' : value
}
watch(locale, syncDocumentLang, { immediate: true })

onMounted(async () => {
  clientLog('app.settings.start')
  await settingsStore.init()
  clientLog('app.settings.complete')
  avifSupported.value = await checkAvifSupport();
  clientLog('app.avif', { supported: avifSupported.value })
  await checkImageExists()
  clientLog('app.images.complete')
})
const avifSupported = ref(true);
const checkAvifSupport = (): Promise<boolean> => {
  return new Promise((resolve) => {
    const image = new Image();
    image.onerror = () => resolve(false)
    image.onload = () => resolve(true)
    image.src =
      "data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADybWV0YQAAAAAAAAAoaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAGxpYmF2aWYAAAAADnBpdG0AAAAAAAEAAAAeaWxvYwAAAABEAAABAAEAAAABAAABGgAAAB0AAAAoaWluZgAAAAAAAQAAABppbmZlAgAAAAABAABhdjAxQ29sb3IAAAAAamlwcnAAAABLaXBjbwAAABRpc3BlAAAAAAAAAAIAAAACAAAAEHBpeGkAAAAAAwgICAAAAAxhdjFDgQ0MAAAAABNjb2xybmNseAACAAIAAYAAAAAXaXBtYQAAAAAAAAABAAEEAQKDBAAAACVtZGF0EgAKCBgANogQEAwgMg8f8D///8WfhwB8+ErK42A=";
  })
};
</script>


<style scoped>
.app-footer {
  position: relative;
  flex: 0 0 auto;
  box-sizing: border-box;
  padding: 5px 16px;
  font-size: 10px;
  line-height: 1.5;
  color: #bebeb0;
  background: #182725;
  border-top: 1px solid rgb(163 142 94 / 0.26);
}
.app-footer a { color: #d1c7ae; text-underline-offset: 2px; }
.app-footer a:hover { color: #fff1cc; }
/* Fullscreen is for the board: this strip would otherwise hold a row at the
   bottom of the map. #app is a flex column, so removing it gives that row to
   the view. */
:global(html.fixed-tabletop-page .app-footer),
html:fullscreen .app-footer,
html:-webkit-full-screen .app-footer {
  display: none;
}
.app-loading {
  display: grid;
  place-items: center;
  color: var(--text-dim);
  font-family: 'Source Han Serif', 'Arno', serif;
  letter-spacing: 0.12em;
}
</style>
