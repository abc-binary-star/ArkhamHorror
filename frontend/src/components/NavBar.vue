<script lang="ts" setup>
import { computed, ref } from 'vue'
import { useUserStore } from '@/stores/user'
import { useRoute, useRouter } from 'vue-router'
import type { User } from '@/types'
import { OnClickOutside } from '@vueuse/components'
import { storeToRefs } from 'pinia'
import { useSettings } from '@/stores/settings'

const expanded = ref(false)
const mobileOpen = ref(false)
const router = useRouter()
const route = useRoute()
const store = useUserStore()
const currentUser = computed<User | null>(() => store.currentUser)
const { customCardsEnabled } = storeToRefs(useSettings())

// The embedded deck builder is a separate static SPA served by nginx at
// /build/, not a router route, and it is only packaged into a distribution.
const deckBuilderAvailable = import.meta.env.PROD
const deckBuilderHref = '/build/'

const isNavCurrent = (path: string) => route.path === path || route.path.startsWith(`${path}/`)
const isAboutCurrent = computed(() => route.path === '/about')

async function logout() {
  await store.logout()
  router.push({ path: '/' })
}
</script>

<template>
  <header id="nav" @keydown.esc="mobileOpen = false; expanded = false">
    <button
      v-if="currentUser"
      type="button"
      class="mobile-menu-btn"
      aria-controls="mobile-navigation"
      :aria-expanded="mobileOpen"
      :aria-label="$t('nav.menu')"
      @click="mobileOpen = !mobileOpen"
    >
      <font-awesome-icon icon="bars" />
    </button>

    <router-link to="/" class="home-plaque" :aria-label="$t('nav.home')">
      <img
        class="brand-mark"
        src="/assets/veiled-harbour/06-诡镇奇谈徽记.svg"
        alt=""
        aria-hidden="true"
      />
      <span class="brand-lockup">
        <span class="brand-name">诡镇奇谈</span>
        <span class="brand-subtitle">ARKHAM HORROR</span>
      </span>
    </router-link>

    <nav v-if="currentUser" class="main-links">
      <router-link
        v-if="currentUser"
        to="/decks"
        class="nav-link"
        :class="{ 'nav-link--current': isNavCurrent('/decks') }"
        >{{ $t('nav.myDecks') }}</router-link
      >
      <a
        v-if="currentUser && deckBuilderAvailable"
        :href="deckBuilderHref"
        class="nav-link"
        target="_blank"
        rel="noopener"
        >{{ $t('nav.deckBuilder') }}</a
      >
      <router-link
        v-if="currentUser"
        to="/cards"
        class="nav-link"
        :class="{ 'nav-link--current': isNavCurrent('/cards') }"
        >{{ $t('nav.cards') }}</router-link
      >
      <router-link
        v-if="currentUser"
        to="/achievements"
        class="nav-link"
        :class="{ 'nav-link--current': isNavCurrent('/achievements') }"
        >{{ $t('nav.achievements') }}</router-link
      >
      <router-link
        v-if="currentUser && customCardsEnabled"
        to="/card-builder"
        class="nav-link"
        :class="{ 'nav-link--current': isNavCurrent('/card-builder') }"
        >{{ $t('nav.cardBuilder') }}</router-link
      >
      <router-link
        v-if="currentUser"
        to="/about"
        class="nav-link"
        :class="{ 'nav-link--current': isAboutCurrent }"
        >{{ $t('nav.about') }}</router-link
      >
      <router-link
        v-if="currentUser && currentUser.admin"
        to="/admin"
        class="nav-link"
        :class="{ 'nav-link--current': isNavCurrent('/admin') }"
        >{{ $t('nav.admin') }}</router-link
      >
    </nav>

    <OnClickOutside class="account-menu" @trigger="expanded = false">
      <div class="user-links">
        <template v-if="currentUser">
          <button
            type="button"
            class="user-btn"
            :class="{ open: expanded }"
            :aria-expanded="expanded"
            @click="expanded = !expanded"
          >
            <span>{{ currentUser.username }}</span>
            <font-awesome-icon
              icon="angle-down"
              class="dropdown-icon"
              :class="{ open: expanded }"
            />
          </button>
          <div v-if="expanded" class="user-dropdown">
            <router-link @click="expanded = false" to="/settings">{{ $t('settings') }}</router-link>
            <a href="#" @click="logout">{{ $t('logOut') }}</a>
          </div>
        </template>
        <template v-else>
          <router-link to="/sign-in">{{ $t('logIn') }}</router-link>
          <router-link to="/sign-up">{{ $t('register') }}</router-link>
        </template>
      </div>
    </OnClickOutside>

    <div v-if="mobileOpen" id="mobile-navigation" class="mobile-menu" @click="mobileOpen = false">
      <router-link to="/decks" :class="{ 'nav-link--current': isNavCurrent('/decks') }">{{
        $t('nav.myDecks')
      }}</router-link>
      <a v-if="deckBuilderAvailable" :href="deckBuilderHref" target="_blank" rel="noopener">{{
        $t('nav.deckBuilder')
      }}</a>
      <router-link to="/cards" :class="{ 'nav-link--current': isNavCurrent('/cards') }">{{
        $t('nav.cards')
      }}</router-link>
      <router-link
        to="/achievements"
        :class="{ 'nav-link--current': isNavCurrent('/achievements') }"
        >{{ $t('nav.achievements') }}</router-link
      >
      <router-link
        v-if="customCardsEnabled"
        to="/card-builder"
        :class="{ 'nav-link--current': isNavCurrent('/card-builder') }"
        >{{ $t('nav.cardBuilder') }}</router-link
      >
      <router-link to="/about" :class="{ 'nav-link--current': isAboutCurrent }">{{
        $t('nav.about')
      }}</router-link>
      <router-link
        v-if="currentUser && currentUser.admin"
        to="/admin"
        :class="{ 'nav-link--current': isNavCurrent('/admin') }"
        >{{ $t('nav.admin') }}</router-link
      >
    </div>
  </header>
</template>

<style scoped>
#nav {
  background-color: var(--background-dark);
  background-image:
    linear-gradient(180deg, rgba(244, 239, 228, 0.08), transparent 26%, rgba(12, 22, 22, 0.18)),
    url('/assets/veiled-harbour/39-顶部导航漆面底板-v1.avif');
  background-position: center;
  background-size: cover;
  border-bottom: 1px solid var(--brass, #9b7d45);
  box-shadow: 0 3px 12px rgba(18, 25, 25, 0.3);
  color: var(--text-on-dark, #f4efe4);
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 0 20px;
  height: 60px;
  flex-shrink: 0;
  position: relative;
  z-index: var(--z-index-100);
}

#nav::before {
  content: '';
  position: absolute;
  inset: 0 0 auto;
  height: 1px;
  background: rgba(244, 239, 228, 0.16);
  pointer-events: none;
}

/* ── Brand book spine ───────────────────────────────────────────────────── */

.home-plaque {
  display: inline-flex;
  align-items: center;
  justify-content: flex-start;
  flex-shrink: 0;
  gap: 8px;
  min-width: 196px;
  height: 44px;
  padding: 0 22px 0 0;
  color: var(--text-on-dark, #f4efe4);
  position: relative;
  text-decoration: none;
  transition:
    color 140ms ease,
    transform 140ms ease;

  &:hover {
    color: var(--accent-brass-bright, #c8ad78);
    transform: translateY(-1px);
  }

  &:active {
    transform: translateY(0);
  }

  &::after {
    content: '';
    position: absolute;
    top: 50%;
    right: 0;
    width: 18px;
    height: 18px;
    transform: translateY(-50%);
    background: url('/assets/veiled-harbour/40-导航黄铜索引压印-v1.avif') center / contain no-repeat;
    opacity: 0.42;
    pointer-events: none;
  }
}

.brand-mark {
  width: 36px;
  height: 36px;
  flex: 0 0 36px;
  object-fit: contain;
}

.brand-lockup {
  display: grid;
  gap: 1px;
  min-width: 0;
  line-height: 1;
}

.brand-name {
  font-family: 'Arno', 'Source Han Serif', serif;
  font-size: 1.12rem;
  font-weight: 600;
  letter-spacing: 0.1em;
  white-space: nowrap;
}

.brand-subtitle {
  color: var(--text-dim-on-dark, #c7cfcc);
  font-family: 'Arno', serif;
  font-size: 0.48rem;
  letter-spacing: 0.16em;
  white-space: nowrap;
}

/* ── Main nav: continuous cover index, not a segmented tray ─────────────── */

.main-links {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 1;
  min-width: 0;
  height: 48px;
  padding: 0;
  overflow-x: auto;
  scrollbar-width: none;

  &::-webkit-scrollbar {
    display: none;
  }
}

.nav-link {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  height: 44px;
  padding: 0 16px;
  border-radius: 0;
  color: var(--text-dim-on-dark, #c7cfcc);
  font-size: 0.88rem;
  font-weight: var(--font-bold);
  letter-spacing: 0.02em;
  text-decoration: none;
  white-space: nowrap;
  transition:
    color 140ms ease,
    background-color 140ms ease;

  &:hover {
    color: var(--text-on-dark, #f4efe4);
    background: rgba(244, 239, 228, 0.045);
  }

  &:focus-visible {
    outline: 2px solid var(--accent-brass-bright, #c8ad78);
    outline-offset: 2px;
    z-index: 1;
  }

  &::after {
    content: '';
    position: absolute;
    right: 20%;
    bottom: 2px;
    left: 20%;
    height: 2px;
    background: var(--accent-brass-bright, #c8ad78);
    opacity: 0;
    transform: scaleX(0.5);
    transition:
      opacity 140ms ease,
      transform 140ms ease;
  }

  &:hover::after {
    opacity: 0.55;
    transform: scaleX(1);
  }
}

.nav-link--current {
  color: var(--text-on-dark, #f4efe4);
  font-weight: var(--font-black);
}

.nav-link.nav-link--current::after {
  opacity: 1;
  transform: scaleX(1);
}

.nav-link.nav-link--current::before {
  content: '';
  position: absolute;
  bottom: 0;
  left: 50%;
  width: 5px;
  height: 5px;
  background: var(--accent-brass-bright, #c8ad78);
  transform: translate(-50%, 35%) rotate(45deg);
}

@media (max-width: 768px) {
  #nav {
    gap: 8px;
    padding: 0 12px;
    height: 56px;
  }

  .home-plaque {
    position: relative;
    flex: 1;
    min-width: 0;
    padding: 0;
    justify-content: center;
    transform: none;
  }
  .home-plaque:hover {
    transform: translateY(-1px);
  }
  .home-plaque::after {
    display: none;
  }
  .brand-subtitle {
    display: none;
  }
  .brand-name {
    font-size: 0.98rem;
  }
  .brand-mark {
    width: 32px;
    height: 32px;
    flex-basis: 32px;
  }
  .main-links {
    display: none;
  }
}

/* ── Mobile hamburger ───────────────────────────────────────────────────── */

.mobile-menu-btn {
  display: none;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  padding: 0;
  background: rgba(244, 239, 228, 0.04);
  border-radius: 3px;
  box-shadow: 0 2px 4px rgba(18, 25, 25, 0.22);
  color: var(--text-dim-on-dark, #c7cfcc);
  font-size: 1rem;
  cursor: pointer;

  &:hover,
  &:focus-visible {
    color: var(--text-on-dark, #f4efe4);
    border-color: var(--accent-brass-bright, #c8ad78);
  }

  &:focus-visible {
    outline: 2px solid var(--accent-brass-bright, #c8ad78);
    outline-offset: 2px;
  }

  @media (max-width: 768px) {
    display: flex;
  }
}

.mobile-menu {
  position: absolute;
  top: calc(100% + 8px);
  left: 10px;
  right: 10px;
  padding: 8px;
  background: var(--surface-panel, #e8e1d2) url('/assets/veiled-harbour/03-档案纸纹理.svg') center /
    320px 320px;
  border-top: 2px solid var(--brass, #9b7d45);
  border-radius: 4px;
  box-shadow: 0 12px 28px rgba(18, 25, 25, 0.34);
  display: flex;
  flex-direction: column;
  gap: 1px;

  a {
    position: relative;
    display: flex;
    align-items: center;
    min-height: 44px;
    padding: 10px 14px;
    border-bottom: 1px solid rgba(129, 123, 112, 0.28);
    color: var(--text);
    font-size: 0.9rem;
    font-weight: var(--font-bold);
    text-decoration: none;
    transition:
      background 140ms ease,
      color 140ms ease;

    &:last-child {
      border-bottom: 0;
    }

    &:hover,
    &:focus-visible {
      background: rgba(48, 58, 61, 0.08);
      color: var(--spooky-green);
    }

    &:focus-visible {
      outline: 2px solid var(--focus-ring, #225f68);
      outline-offset: -2px;
    }

    &.nav-link--current {
      color: var(--spooky-green-dark, #1f443f);
      font-weight: var(--font-black);
    }

    &.nav-link--current::before {
      content: '';
      width: 5px;
      height: 5px;
      margin-right: 10px;
      background: var(--brass, #9b7d45);
      transform: rotate(45deg);
    }
  }
}

.account-menu { margin-left: auto; min-width: 0; }

/* ── User section ──────────────────────────────────────────────────────── */

.user-links {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  position: relative;

  a {
    display: inline-flex;
    align-items: center;
    height: 36px;
    padding: 0 11px;
    border: 1px solid rgba(200, 173, 120, 0.36);
    border-radius: 3px;
    background: rgba(244, 239, 228, 0.025);
    color: var(--text-dim-on-dark, #c7cfcc);
    font-size: 0.75rem;
    font-weight: var(--font-bold);
    letter-spacing: 0.04em;
    text-transform: uppercase;
    text-decoration: none;
    white-space: nowrap;
    transition:
      border-color 140ms ease,
      color 140ms ease,
      background-color 140ms ease;

    &:hover,
    &:focus-visible {
      border-color: var(--accent-brass-bright, #c8ad78);
      background: rgba(200, 173, 120, 0.08);
      color: var(--text-on-dark, #f4efe4);
    }

    &:focus-visible {
      outline: 2px solid var(--accent-brass-bright, #c8ad78);
      outline-offset: 2px;
    }
  }

  @media (max-width: 768px) {
    gap: 4px;
    a {
      padding: 0 8px;
      font-size: 0.68rem;
    }
  }
}

.user-btn {
  display: flex;
  align-items: center;
  gap: 7px;
  height: 36px;
  max-width: 180px;
  padding: 0 11px;
  background: rgba(244, 239, 228, 0.04);
  border-radius: 3px;
  box-shadow: 0 2px 4px rgba(18, 25, 25, 0.2);
  color: var(--text-on-dark, #f4efe4);
  font-size: 0.78rem;
  font-weight: var(--font-black);
  cursor: pointer;
  white-space: nowrap;
  transition:
    border-color 140ms ease,
    color 140ms ease,
    background-color 140ms ease;

  span {
    overflow: hidden;
    text-overflow: ellipsis;
  }

  &:hover,
  &:focus-visible,
  &.open {
    border-color: var(--accent-brass-bright, #c8ad78);
    background: rgba(200, 173, 120, 0.08);
    color: var(--text-on-dark, #f4efe4);
  }

  &:focus-visible {
    outline: 2px solid var(--accent-brass-bright, #c8ad78);
    outline-offset: 2px;
  }
}

.dropdown-icon {
  flex-shrink: 0;
  font-size: 0.75em;
  transition: transform 0.2s;
  &.open {
    transform: rotate(180deg);
  }
}

.user-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  min-width: 180px;
  padding: 5px;
  background: var(--surface-panel, #e8e1d2) url('/assets/veiled-harbour/03-档案纸纹理.svg') center /
    320px 320px;
  border-top: 2px solid var(--brass, #9b7d45);
  border-radius: 4px;
  box-shadow: 0 12px 28px rgba(18, 25, 25, 0.34);
  overflow: hidden;

  a {
    display: block;
    height: auto;
    min-height: 44px;
    padding: 12px 11px;
    border: 0;
    border-radius: 2px;
    background: transparent;
    color: var(--text);
    font-size: 0.8rem;
    font-weight: var(--font-bold);
    text-transform: none;
    letter-spacing: 0;
    text-decoration: none;
    transition:
      background 120ms ease,
      color 120ms ease;

    &:hover,
    &:focus-visible {
      background: rgba(48, 58, 61, 0.08);
      color: var(--spooky-green);
    }

    &:focus-visible {
      outline: 2px solid var(--focus-ring, #225f68);
      outline-offset: -2px;
    }

    &:last-child:hover,
    &:last-child:focus-visible {
      color: var(--status-danger-text, #873d39);
    }
  }
}
.user-btn > span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
@media (max-width: 768px) {
  .user-btn { max-width: 100px; }
  .brand-mark { width: 26px; height: 26px; flex-basis: 26px; }
  .home-plaque { gap: 5px; }
}
</style>
