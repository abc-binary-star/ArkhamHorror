<script lang="ts" setup>
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import type { User } from '@/types';
import { useDbCardStore } from '@/stores/dbCards'
import { useSettings } from '@/stores/settings'
import { checkImageExists } from '@/arkham/helpers'
import { isDevBuild } from '@/arkham/displayRules'
import { loadLocaleMessages, normalizeLocale } from '@/locales/messages'
import { useToast } from 'vue-toastification'

const props = defineProps<{
  user: User
  updateBeta: (setting: boolean) => void
  deleteAccount: () => void
}>()

const store = useDbCardStore()
const settings = useSettings()
const { epicMultiplayerStored, customCardsEnabled } = storeToRefs(settings)
const dev = isDevBuild()
const { t, availableLocales, locale, setLocaleMessage } = useI18n({ useScope: 'global' })
const toast = useToast()
const language = ref(localStorage.getItem('language') || locale.value)
const beta = ref(props.user.beta ? "On" : "Off")
const showDeleteConfirm = ref(false)

const betaUpdate = async () => props.updateBeta(beta.value == "On")

// Dev-only Epic Multiplayer flag, bound to the persisted store value via On/Off.
const epicMultiplayer = computed({
  get: () => (epicMultiplayerStored.value ? 'On' : 'Off'),
  set: (value: string) => settings.setEpicMultiplayerEnabled(value === 'On'),
})

const customCards = computed({
  get: () => (customCardsEnabled.value ? 'On' : 'Off'),
  set: (value: string) => settings.setCustomCardsEnabled(value === 'On'),
})

const updateLanguage = async (a: Event) => {
  const target = a.target as HTMLSelectElement;
  const selectedLanguage = target.value
  const uiLocale = normalizeLocale(selectedLanguage)

  try {
    if (!availableLocales.includes(uiLocale)) {
      const messages = await loadLocaleMessages(uiLocale)
      setLocaleMessage(messages.locale, messages.messages)
    }

    language.value = selectedLanguage
    locale.value = uiLocale
    localStorage.setItem('language', selectedLanguage)

    // Card names come from a separate per-language database. If it does not
    // arrive, the UI is in the new language while every card name stays in the
    // old one -- say so rather than leaving the mismatch unexplained.
    const cardsLoaded = await store.initDbCards()
    if (!cardsLoaded) toast.error(t('loadState.cardDataFailed'))

    await checkImageExists()
  } catch (err) {
    console.error('[settings] language switch failed', err)
    toast.error(t('loadState.cardDataFailed'))
  }
}
</script>

<template>
  <div class="page-container">
    <div class="page-content column">
      <h2 class="title">{{$t('settings')}}</h2>

      <section class="box column">
        <h3>{{$t('language')}}</h3>
        <p>{{ $t('settingsForm.languageHelp') }}</p>
        <select :value="language" @change="updateLanguage">
          <option value="de">Deutsch/German</option>
          <option value="en">English</option>
          <option value="es">Español/Spanish</option>
          <option value="fr">Français/French</option>
          <option value="it">Italiano/Italian</option>
          <option value="ko">한국어/Korean</option>
          <option value="pl">Polski/Polish</option>
          <option value="po">Português/Portuguese</option>
          <option value="ru">Русский/Russian</option>
          <option value="uk">українська/Ukrainian</option>
          <option value="zh-cn">简体中文/Simplified Chinese</option>
          <option value="zh">中文/Chinese</option>
        </select>
      </section>

      <section class="box column">
        <h3>{{ $t('settingsForm.enrollInBeta') }}</h3>
        <p>{{ $t('settingsForm.betaWarning') }}</p>
        <div class="row">
          <label class="radio-label">
            <input type="radio" name="beta" value="On" v-model="beta" @change="betaUpdate" />
            {{ $t('On') }}
          </label>
          <label class="radio-label">
            <input type="radio" name="beta" value="Off" v-model="beta" @change="betaUpdate" />
            {{ $t('Off') }}
          </label>
        </div>
      </section>

      <section class="box column">
        <h3>{{ $t('settingsForm.customCards') }}</h3>
        <p class="warning">
          <font-awesome-icon icon="flask" />
          {{ $t('settingsForm.customCardsWarning') }}
        </p>
        <i18n-t keypath="settingsForm.customCardsHelp" tag="p" scope="global">
          <template #icon>
            <font-awesome-icon icon="layer-group" class="inline-icon" />
          </template>
        </i18n-t>
        <div class="row">
          <label class="radio-label">
            <input type="radio" name="customCards" value="On" v-model="customCards" />
            {{ $t('On') }}
          </label>
          <label class="radio-label">
            <input type="radio" name="customCards" value="Off" v-model="customCards" />
            {{ $t('Off') }}
          </label>
        </div>
        <router-link v-if="customCardsEnabled" to="/card-builder" class="builder-link">
          {{ $t('settingsForm.openCardBuilder') }}
        </router-link>
      </section>

      <section class="box column danger-zone">
        <h3 class="danger-title">{{ $t('settingsForm.dangerZone') }}</h3>
        <p>{{ $t('settingsForm.dangerZoneDescription') }} <strong>{{ $t('settingsForm.cannotBeUndone') }}</strong></p>

        <div v-if="dev" class="dev-flag">
          <h4>{{ $t('settingsForm.epicMultiplayer') }}</h4>
          <p class="warning">{{ $t('settingsForm.epicMultiplayerWarning') }}</p>
          <div class="row">
            <label class="radio-label">
              <input type="radio" name="epicMultiplayer" value="On" v-model="epicMultiplayer" />
              {{ $t('On') }}
            </label>
            <label class="radio-label">
              <input type="radio" name="epicMultiplayer" value="Off" v-model="epicMultiplayer" />
              {{ $t('Off') }}
            </label>
          </div>
        </div>

        <div v-if="!showDeleteConfirm">
          <button class="btn-danger" @click="showDeleteConfirm = true">{{ $t('settingsForm.deleteAccount') }}</button>
        </div>
        <div v-else class="column">
          <p class="warning">{{ $t('settingsForm.deleteConfirm') }}</p>
          <div class="row">
            <button class="btn-danger" @click="props.deleteAccount()">{{ $t('settingsForm.confirmPermanentDelete') }}</button>
            <button @click="showDeleteConfirm = false">{{ $t('cancel') }}</button>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
h3 {
  font-size: 1.1em;
  font-weight: bold;
  color: var(--title);
  text-transform: uppercase;
  font-family: teutonic, sans-serif;
  font-size: 1.4em;
}

p {
  color: var(--title);
  opacity: 0.8;
}

select {
  background-color: var(--input-background);
  color: var(--text);
  border: var(--edge-width) solid var(--edge-dim);
  border-radius: var(--radius-md);
  padding: 8px 34px 8px 10px;
  font-size: 1em;
  width: fit-content;
  min-height: 40px;

  &:hover { border-color: var(--edge); }
  &:focus { border-color: var(--spooky-green); box-shadow: var(--shadow-2); }

  option {
    background: var(--surface-raised);
    color: var(--text);
  }
}

input[type="radio"] {
  display: unset;
  accent-color: var(--spooky-green);
}

.radio-label {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--title);
  cursor: pointer;
}

.danger-zone {
  border-color: var(--delete);
}

.danger-title {
  color: var(--delete);
}

.btn-danger {
  background: var(--delete);
  color: white;
  border: none;
  padding: 8px 16px;
  cursor: pointer;
  border-radius: 4px;
  font-size: 1em;
  text-transform: uppercase;
}

.btn-danger:hover {
  background-color: #a32929;
}

.warning {
  color: var(--delete);
  font-weight: bold;
}

/* The overlay button wears this icon, so the help can point straight at it. */
.inline-icon {
  color: var(--title);
  margin: 0 0.15em;
}

.builder-link {
  color: var(--spooky-green);
  width: fit-content;
}

.dev-flag {
  margin: 8px 0 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--box-border);
}

.dev-flag h4 {
  margin: 0 0 4px;
  color: var(--title);
  font-family: teutonic, sans-serif;
  font-size: 1.2em;
  text-transform: uppercase;
}
</style>
