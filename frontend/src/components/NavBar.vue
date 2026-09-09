<script lang="ts" setup>
import { computed, ref } from 'vue'
import { useUserStore } from '@/stores/user'
import { useRouter } from 'vue-router'
import type { User } from '@/types'
import { OnClickOutside } from '@vueuse/components'
import { storeToRefs } from 'pinia'
import { useSettings } from '@/stores/settings'

const expanded = ref(false);
const mobileOpen = ref(false);
const router = useRouter()
const store = useUserStore()
const currentUser = computed<User | null>(() => store.currentUser)
const { customCardsEnabled } = storeToRefs(useSettings())

// The embedded deck builder is a separate static SPA served by nginx at
// /build/, not a router route, and it is only packaged into a distribution.
const deckBuilderAvailable = import.meta.env.PROD
const deckBuilderHref = '/build/'

async function logout() {
  await store.logout()
  router.push({ path: '/' })
}
</script>

<template>
  <header id="nav">
    <button v-if="currentUser" class="mobile-menu-btn" @click="mobileOpen = !mobileOpen">
      <font-awesome-icon icon="bars" />
    </button>

    <router-link to="/" class="home-plaque" :aria-label="$t('nav.home')">
      <img class="brand-mark" src="/assets/veiled-harbour/06-诡镇奇谈徽记.svg" alt="" aria-hidden="true" />
      <span class="brand-lockup">
        <span class="brand-name">诡镇奇谈</span>
        <span class="brand-subtitle">ARKHAM HORROR</span>
      </span>
    </router-link>

    <nav v-if="currentUser" class="main-links">
      <router-link v-if="currentUser" to="/decks" class="nav-link">{{$t('nav.myDecks')}}</router-link>
      <a v-if="currentUser && deckBuilderAvailable" :href="deckBuilderHref" class="nav-link" target="_blank" rel="noopener">{{$t('nav.deckBuilder')}}</a>
      <router-link v-if="currentUser" to="/cards" class="nav-link">{{$t('nav.cards')}}</router-link>
      <router-link v-if="currentUser" to="/achievements" class="nav-link">{{$t('nav.achievements')}}</router-link>
      <router-link v-if="currentUser && customCardsEnabled" to="/card-builder" class="nav-link">{{$t('nav.cardBuilder')}}</router-link>
      <router-link v-if="currentUser" to="/about" class="nav-link">{{$t('nav.about')}}</router-link>
      <router-link v-if="currentUser" to="/about?support" class="nav-link">{{$t('nav.support')}}</router-link>
      <router-link v-if="currentUser && currentUser.admin" to="/admin" class="nav-link">{{$t('nav.admin')}}</router-link>
    </nav>

    <OnClickOutside @trigger="expanded = false">
      <div class="user-links">
        <template v-if="currentUser">
          <button class="user-btn" :class="{ open: expanded }" @click="expanded = !expanded">
            <span>{{currentUser.username}}</span>
            <font-awesome-icon icon="angle-down" class="dropdown-icon" :class="{ open: expanded }" />
          </button>
          <div v-if="expanded" class="user-dropdown">
            <router-link @click="expanded = false" to="/settings">{{$t('settings')}}</router-link>
            <a href="#" @click="logout">Logout</a>
          </div>
        </template>
        <template v-else>
          <router-link to="/sign-in">Login</router-link>
          <router-link to="/sign-up">Register</router-link>
        </template>
      </div>
    </OnClickOutside>

    <div v-if="mobileOpen" class="mobile-menu" @click="mobileOpen = false">
      <router-link to="/decks">{{$t('nav.myDecks')}}</router-link>
      <a v-if="deckBuilderAvailable" :href="deckBuilderHref" target="_blank" rel="noopener">{{$t('nav.deckBuilder')}}</a>
      <router-link to="/cards">{{$t('nav.cards')}}</router-link>
      <router-link to="/achievements">{{$t('nav.achievements')}}</router-link>
      <router-link v-if="customCardsEnabled" to="/card-builder">{{$t('nav.cardBuilder')}}</router-link>
      <router-link to="/about">{{$t('nav.about')}}</router-link>
      <router-link to="/about?support">{{$t('nav.support')}}</router-link>
      <router-link v-if="currentUser && currentUser.admin" to="/admin">{{$t('nav.admin')}}</router-link>
    </div>
  </header>
</template>

<style scoped>
#nav {
  background: var(--background-dark);
  border-bottom: 1px solid rgba(244, 239, 228, 0.18);
  box-shadow: 0 3px 10px rgba(37, 39, 37, 0.18);
  color: var(--text-on-dark, #f4efe4);
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 12px;
  height: var(--nav-height);
  flex-shrink: 0;
  position: relative;
  z-index: var(--z-index-100);
}

/* ── Home plaque ──────────────────────────────────────────────────────────
   Sits outside the tab tray on purpose: a tilted brass tag, the one warm
   surface in the bar. Hovering swings it back square. */

.home-plaque {
  display: inline-flex;
  align-items: center;
  justify-content: flex-start;
  flex-shrink: 0;
  gap: 8px;
  min-width: 178px;
  height: 40px;
  padding: 0 10px 0 2px;
  color: var(--text-on-dark, #f4efe4);
  text-decoration: none;
  transition: color 120ms ease, transform 120ms ease;

  &:hover {
    color: var(--accent-brass-bright, #c8ad78);
    transform: translateY(-1px);
  }

  &:active {
    transform: translateY(0);
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
  font-family: "Arno", "Source Han Serif", serif;
  font-size: 1.05rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  white-space: nowrap;
}

.brand-subtitle {
  color: var(--text-dim-on-dark, #c7cfcc);
  font-family: "Arno", serif;
  font-size: 0.48rem;
  letter-spacing: 0.16em;
  white-space: nowrap;
}

/* ── Main nav: a segmented tray, not a row of bare links ────────────────── */

.main-links {
  display: flex;
  align-items: center;
  gap: 3px;
  flex: 1;
  min-width: 0;
  height: 40px;
  padding: 3px;
  border: var(--edge-width) solid rgba(244, 239, 228, 0.2);
  border-radius: var(--radius-lg);
  background: rgba(244, 239, 228, 0.08);
  box-shadow: var(--shadow-2);
  overflow-x: auto;
  scrollbar-width: none;

  &::-webkit-scrollbar { display: none; }
}

.nav-link {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  height: 30px;
  padding: 0 12px;
  border-radius: var(--radius-md);
  color: var(--text-dim-on-dark, #c7cfcc);
  font-size: 0.78rem;
  font-weight: var(--font-bold);
  letter-spacing: 0.03em;
  text-decoration: none;
  white-space: nowrap;
  transition: background-color 120ms ease, color 120ms ease;

  &:hover {
    background: rgba(244, 239, 228, 0.1);
    color: var(--text-on-dark, #f4efe4);
  }

  &.router-link-active {
    background: var(--spooky-green);
    box-shadow: var(--shadow-1);
    color: var(--button-1-text);
    font-weight: var(--font-black);
  }
}

@media (max-width: 768px) {
  .home-plaque { min-width: 0; padding-right: 2px; }
  .brand-subtitle { display: none; }
  .brand-name { font-size: 0.92rem; }
  .nav-link { display: none; }
  .main-links { border-color: transparent; box-shadow: none; background: transparent; }
}

/* ── Mobile hamburger ───────────────────────────────────────────────────── */

.mobile-menu-btn {
  display: none;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 32px;
  padding: 0;
  background: rgba(244, 239, 228, 0.08);
  border: var(--edge-width) solid rgba(244, 239, 228, 0.28);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-2);
  color: var(--text-dim-on-dark, #c7cfcc);
  font-size: 1rem;
  cursor: pointer;

  &:hover { color: var(--text-on-dark, #f4efe4); border-color: var(--accent-brass-bright, #c8ad78); }

  @media (max-width: 768px) {
    display: flex;
  }
}

.mobile-menu {
  position: absolute;
  top: calc(100% + 6px);
  left: 12px;
  right: 12px;
  padding: 4px;
  background: var(--surface-panel, #e8e1d2);
  border: var(--edge-width) solid var(--border-panel, #817b70);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-4);
  display: flex;
  flex-direction: column;
  gap: 2px;

  a {
    padding: 10px 12px;
    border-radius: var(--radius-md);
    color: var(--text);
    font-size: 0.85rem;
    font-weight: var(--font-bold);
    text-decoration: none;
    transition: background 120ms ease, color 120ms ease;

    &:hover { background: rgba(48, 58, 61, 0.08); color: var(--spooky-green); }
    &.router-link-active {
      background: var(--spooky-green);
      color: var(--button-1-text);
      font-weight: var(--font-black);
    }
  }
}

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
    height: 30px;
    padding: 0 11px;
    border: var(--edge-width) solid var(--edge-dim);
    border-radius: var(--radius-md);
    background: transparent;
    color: var(--text-dim);
    font-size: 0.75rem;
    font-weight: var(--font-bold);
    letter-spacing: 0.04em;
    text-transform: uppercase;
    text-decoration: none;
    white-space: nowrap;
    transition: border-color 120ms ease, color 120ms ease, background-color 120ms ease;

    &:hover {
      border-color: var(--edge);
      background: rgba(244, 239, 228, 0.1);
      color: var(--text-on-dark, #f4efe4);
    }
  }

  @media (max-width: 768px) {
    gap: 4px;
    a { padding: 0 8px; font-size: 0.7rem; }
  }
}

.user-btn {
  display: flex;
  align-items: center;
  gap: 7px;
  height: 32px;
  padding: 0 11px;
  background: rgba(244, 239, 228, 0.08);
  border: var(--edge-width) solid rgba(244, 239, 228, 0.28);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-2);
  color: var(--text-on-dark, #f4efe4);
  font-size: 0.78rem;
  font-weight: var(--font-black);
  cursor: pointer;
  white-space: nowrap;
  transition: border-color 120ms ease, color 120ms ease;

  &:hover { border-color: var(--accent-brass-bright, #c8ad78); color: var(--text-on-dark, #f4efe4); }
  &.open { border-color: var(--accent-brass-bright, #c8ad78); color: var(--text-on-dark, #f4efe4); }
}

.dropdown-icon {
  font-size: 0.75em;
  transition: transform 0.2s;
  &.open { transform: rotate(180deg); }
}

.user-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  min-width: 160px;
  padding: 4px;
  background: var(--surface-panel, #e8e1d2);
  border: var(--edge-width) solid var(--border-panel, #817b70);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-4);
  overflow: hidden;

  a {
    display: block;
    height: auto;
    padding: 9px 11px;
    border: 0;
    border-radius: var(--radius-md);
    background: transparent;
    color: var(--text);
    font-size: 0.8rem;
    font-weight: var(--font-bold);
    text-transform: none;
    letter-spacing: 0;
    text-decoration: none;
    transition: background 120ms ease, color 120ms ease;

    &:hover {
      background: rgba(48, 58, 61, 0.08);
      color: var(--spooky-green);
    }
  }
}
</style>
