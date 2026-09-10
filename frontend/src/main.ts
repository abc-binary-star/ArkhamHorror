import './styles/index.css'
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import FloatingVue from 'floating-vue'
import Toast, { createToastInterface, globalEventBus } from "vue-toastification";
import { createVfm } from 'vue-final-modal'
import App from './App.vue'
import router from './router'
import api from '@/api'
import { useUserStore } from '@/stores/user'
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import { library } from "@fortawesome/fontawesome-svg-core";
import { faExpeditedssl } from "@fortawesome/free-brands-svg-icons";
import { faGear, faLayerGroup, faBan, faCircleExclamation, faGhost, faLocationDot, faSearch, faList, faImage, faAngleDown, faUndo, faTrash, faEye, faCopy, faExternalLink, faRefresh, faBook, faChevronRight, faBars, faTimes, faShieldHeart, faWrench, faPaperclip, faArrowLeft, faArrowUp, faStore, faTriangleExclamation, faShuffle, faTrophy, faDownload, faCheckDouble, faFlask, faPen } from '@fortawesome/free-solid-svg-icons'
import * as VueI18n from 'vue-i18n'
import { loadLocaleMessages, normalizeLocale } from '@/locales/messages'
import { preferredLanguage } from '@/locales/language'
import mitt from 'mitt';

library.add(faBan, faLocationDot, faCircleExclamation, faGhost, faSearch, faList, faImage, faAngleDown, faExpeditedssl, faUndo, faTrash, faEye, faCopy, faExternalLink, faRefresh, faBook, faChevronRight, faBars, faTimes, faShieldHeart, faWrench, faPaperclip, faArrowLeft, faArrowUp, faStore, faTriangleExclamation, faShuffle, faTrophy, faGear, faLayerGroup, faDownload, faCheckDouble, faFlask, faPen)

async function bootstrap() {
  const language = localStorage.getItem('language')
  const naviLanguage = preferredLanguage(navigator.language || 'en')
  const currentLanguage = language ?? naviLanguage
  const currentLocale = normalizeLocale(currentLanguage)
  if (!language) { localStorage.setItem('language', currentLanguage) }

  const loadedMessages: Record<string, any> = {}
  const fallback = await loadLocaleMessages('en')
  loadedMessages[fallback.locale] = fallback.messages

  if (currentLocale !== fallback.locale) {
    const current = await loadLocaleMessages(currentLocale)
    loadedMessages[current.locale] = current.messages
  }

  const i18n = VueI18n.createI18n({
    locale: currentLocale, // set locale
    fallbackLocale: 'en', // set fallback locale
    legacy: false,
    warnHtmlMessage: false,
    messages: loadedMessages
  })

  const pinia = createPinia()
  const vfm = createVfm()
  const emitter = mitt()

  const app = createApp(App).
    use(router).
    use(pinia).
    use(FloatingVue, {
      // flip/shift keep a popper inside the viewport, but with the library's
      // default padding of 0 they stop it flush against the edge. Keep a small
      // margin so tooltips and dropdowns stay clear of the screen border.
      overflowPadding: 8,
      themes: {
        'stack-indicator-popover': {
          $extend: 'dropdown',
        },
        'chaos-bag-stats-popover': {
          $extend: 'dropdown',
        },
      },
    }).
    use(Toast, {}).
    use(vfm).
    use(i18n).
    component("font-awesome-icon", FontAwesomeIcon)

  app.config.globalProperties.emitter = emitter

  app.mount('#app')

  // A 401 from anywhere means the stored token is dead. Left alone, `whoami`
  // fails, the user store logs out silently, and someone mid-game is dropped on
  // a logged-out page with no explanation. Registered only once the router has
  // settled its first navigation: the beforeEach guard itself calls whoami, and
  // pushing a redirect from inside that would fight the navigation in flight.
  void router.isReady().then(() => {
    const toast = createToastInterface(globalEventBus)
    let bouncing = false

    api.interceptors.response.use(
      (response) => response,
      (error) => {
        const hadSession = localStorage.getItem('arkham-token') !== null
        if (hadSession && error?.response?.status === 401) {
          useUserStore(pinia).logout()

          const current = router.currentRoute.value
          if (!bouncing && current.path !== '/sign-in') {
            bouncing = true
            toast.error(i18n.global.t('loadState.sessionExpired'))
            void router
              .push({ path: '/sign-in', query: { nextUrl: current.fullPath } })
              .finally(() => { bouncing = false })
          }
        }

        return Promise.reject(error)
      },
    )
  })
}

void bootstrap()
