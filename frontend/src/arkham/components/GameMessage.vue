<script lang="ts">
import { defineComponent, h } from 'vue';
import { useI18n } from 'vue-i18n';
import { cardArt } from '@/arkham/cardImages';
import { Game } from '@/arkham/types/Game';
import { handleEmbeddedI18n } from '@/arkham/i18n';
import { knownTranslationsFor, translateGameLogText } from '@/arkham/gameLogLocalization';
import { chaosTokenImage } from '@/arkham/types/ChaosToken';
import { useDbCardStore } from '@/stores/dbCards';

export default defineComponent({
  props: {
    game: { type: Object as () => Game, required: true },
    msg: { type: String, required: true },
  },
  setup() {
    // Global scope so the pair stays reactive when SettingsForm swaps the
    // active locale at runtime via setLocaleMessage.
    const { locale, messages } = useI18n({ useScope: 'global' })
    const dbCards = useDbCardStore()
    const localizeCardName = (name: string, cardCode: string): string =>
      dbCards.getDbCard(cardArt(cardCode))?.name ?? name
    const localizeInvestigatorName = (name: string, investigatorId: string): string => {
      const dbCard = dbCards.getDbCard(cardArt(investigatorId))
      if (!dbCard) return name
      return dbCard.subname ? `${dbCard.name}: ${dbCard.subname}` : dbCard.name
    }
    return { activeLocale: locale, activeMessages: messages, localizeCardName, localizeInvestigatorName }
  },
  render() {
    const msg = handleEmbeddedI18n(this.msg, this.$t)
      // Logs written before custom token formatting was fixed contain the
      // Haskell constructor and an extra pair of quotes. Keep saved logs
      // renderable while new entries use the canonical homebrew slug.
      .replace(/\{token:"CustomToken "([^"]+)""\}/g, '{token:"$1"}')
    const splits = msg.split(/({[^}]+})/)
    // Messages that are not $i18n tokens reach the log as raw English, so match
    // them against the already-loaded en and active locale trees instead.
    const knownTranslations = knownTranslationsFor(this.activeLocale, this.activeMessages)
    const els = splits.map(split => {
      if (/{card:"((?:[^"]|\\.)+)":"([^"]+)":"([^"]+)"}/.test(split)) {
        const found = split.match(/{card:"((?:[^"]|\\.)+)":"([^"]+)":"([^"]+)"}/)
        if (found) {
          const [, cardName, cardId] = found
          if (cardName && cardId) {
            const display = this.localizeCardName(cardName.replace(/\\"/g, "\""), cardId)
            return h('span', { 'data-image-id': cardId }, display)
          }
        }
      } else if (/{investigator:"((?:[^"]|\\.)+)":"([^"]+)"}/.test(split)) {
        const found = split.match(/{investigator:"((?:[^"]|\\.)+)":"([^"]+)"}/)
        if (found) {
          const [, name, investigatorId ] = found
          if (investigatorId) {
            const display = name ? this.localizeInvestigatorName(name.replace(/\\"/g, "\""), investigatorId) : name
            return display ? h('span', { 'data-image-id': investigatorId, 'class': 'card--sideways' }, display) : split
          }
        }
      } else if (/{enemy:"((?:[^"]|\\.)+)":(.+):"([^"]+)"}/.test(split)) {
        const found = split.match(/{enemy:"((?:[^"]|\\.)+)":(.+):"([^"]+)"}/)
        if (found) {
          const [, name, , cardCode ] = found
          if (cardCode) {
            if (!name) return split
            const display = this.localizeCardName(name.replace(/\\"/g, "\""), cardCode)
            return display ? h('span', { 'data-image-id': cardCode }, display) : split
          }
        }
      } else if (/{location:"((?:[^"]|\\.)+)":(.+):"([^"]+)"}/.test(split)) {
        const found = split.match(/{location:"((?:[^"]|\\.)+)":(.+):"([^"]+)"}/)
        if (found) {
          const [, name, locationId, cardCode ] = found
          const location = this.game.locations[locationId]
          if (!name) return split
          const display = this.localizeCardName(name.replace(/\\"/g, "\""), location?.cardCode ?? cardCode)

          if (location) {
            const actualCardCode = cardArt(location.cardCode, location.revealed ? '' : 'b')
            return h('span', { 'data-image-id': actualCardCode }, display)
          }

          return h('span', { 'data-image-id': cardCode }, display)
        }
      } else if (/{location:"((?:[^"]|\\.)+)":(.+)}/.test(split)) {
        const found = split.match(/{location:"((?:[^"]|\\.)+)":(.+)}/)
        if (found) {
          const [, name, locationId ] = found
          if (locationId) {
            if (!name) return split
            const display = this.localizeCardName(name.replace(/\\"/g, "\""), this.game.locations[locationId]?.cardCode ?? locationId)
            return display ? h('span', { 'data-image-id': locationId }, display) : split
          }
        }
      } else if (/{token:"([^"]+)"}/.test(split)) {
        const found = split.match(/{token:"([^"]+)"}/)
        if (found) {
          const [, token] = found
          if (token) {
            return h('img', { 'src': chaosTokenImage(token), 'width': '23', 'class': 'chaos-token' })
          }
        }
      }
      return translateGameLogText(split, this.$t, knownTranslations)
    })

    return h('div', { className: 'message-body' }, els)
  },
})
</script>

<style scoped>
span[data-image-id] {
  color: var(--text-dim);
  cursor: pointer;
}

img.chaos-token {
  display: inline-block;
  vertical-align: text-top;
}
</style>
