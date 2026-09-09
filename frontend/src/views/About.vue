<script setup lang="ts">
import { useRoute } from 'vue-router'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const route = useRoute()
const { t } = useI18n()
const isSupportPage = computed(() => route.query.support !== undefined)
</script>
<template>
  <div class="page-container about-page">
    <div class="about-page-shell">
      <header class="about-hero">
        <div class="about-hero-seal" aria-hidden="true">
          <img src="/assets/veiled-harbour/06-诡镇奇谈徽记.svg" alt="" />
        </div>
        <div class="about-hero-copy">
          <p class="archive-kicker"><span></span> ARCHIVAL NOTICE <span></span></p>
          <h1>{{ t('nav.about') }}</h1>
          <p class="about-hero-note">ARKHAM HORROR · COMMUNITY ARCHIVE</p>
        </div>
        <div class="about-hero-index" aria-hidden="true">FILE<br /><strong>04—17</strong></div>
      </header>

      <div class="about-divider" aria-hidden="true"><span></span><i></i><span></span></div>

      <div class="about-grid">
        <section class="about-section about-section--support" :class="{ focus: isSupportPage }">
          <div class="section-heading">
            <span class="section-number">01</span>
            <h2>{{ t('about.supportTitle') }}</h2>
          </div>
          <div class="about-card column">
            <p>{{ t('about.supportBody') }}</p>
            <a
              class="archive-link"
              href="https://patreon.com/HalogenAndToast?utm_medium=unknown&utm_source=join_link&utm_campaign=creatorshare_creator&utm_content=copyLink"
              >Patreon <span aria-hidden="true">↗</span></a
            >
            <p class="card-note">{{ t('about.supportNote') }}</p>
          </div>
        </section>

        <section class="about-section">
          <div class="section-heading">
            <span class="section-number">02</span>
            <h2>{{ t('about.copyrightTitle') }}</h2>
          </div>
          <div class="about-card column">
            <p v-html="t('about.copyrightBody')"></p>
            <p class="card-note">{{ t('about.copyrightArtwork') }}</p>
          </div>
        </section>

        <section class="about-section about-section--wide">
          <div class="section-heading">
            <span class="section-number">03</span>
            <h2>{{ t('about.projectTitle') }}</h2>
          </div>
          <div class="about-card" v-html="t('about.projectBody')"></div>
        </section>
      </div>

      <div class="about-footer" aria-hidden="true">
        <span>THE RECORD REMAINS OPEN</span>
        <span class="footer-rule"></span>
        <span>ARCHIVE 04—17</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.about-page {
  background: var(--background-dark) url('/assets/veiled-harbour/29-档案页底图.png') center top /
    cover fixed no-repeat;
  color: var(--text);
}

.about-page-shell {
  width: min(1080px, calc(100% - 40px));
  min-height: calc(100% - 40px);
  box-sizing: border-box;
  margin: 20px auto;
  padding: clamp(24px, 4vw, 52px);
  background: rgba(233, 225, 210, 0.92);
  border: 1px solid color-mix(in srgb, var(--brass) 70%, var(--edge-dim));
  box-shadow:
    0 16px 42px rgba(25, 31, 30, 0.28),
    inset 0 0 0 5px rgba(244, 239, 228, 0.3);
  position: relative;
}

.about-page-shell::before,
.about-page-shell::after {
  content: '';
  position: absolute;
  width: 48px;
  height: 48px;
  pointer-events: none;
  opacity: 0.55;
  background: url('/assets/veiled-harbour/C04-黄铜压线角件-左上.svg') top left / contain no-repeat;
}

.about-page-shell::before {
  top: 12px;
  left: 12px;
}
.about-page-shell::after {
  right: 12px;
  bottom: 12px;
  transform: rotate(180deg);
}

.about-hero {
  display: grid;
  grid-template-columns: 88px 1fr auto;
  align-items: center;
  gap: 20px;
}

.about-hero-seal {
  display: grid;
  place-items: center;
  width: 76px;
  height: 76px;
  border: 1px solid color-mix(in srgb, var(--brass) 80%, transparent);
  border-radius: 50%;
  background: rgba(38, 55, 58, 0.08);
  box-shadow: inset 0 0 0 5px rgba(244, 239, 228, 0.35);

  img {
    width: 56px;
    height: 56px;
  }
}

.about-hero-copy {
  min-width: 0;
}

.archive-kicker {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0 0 8px;
  color: var(--spooky-green);
  font-family: Arno, 'Noto Serif SC', serif;
  font-size: 0.68rem;
  letter-spacing: 0.18em;
  font-weight: 700;

  span {
    display: block;
    width: 28px;
    height: 1px;
    background: var(--brass);
  }
}

h1,
h2 {
  font-family: Arno, 'Noto Serif SC', 'Noto Serif CJK SC', serif;
}

h1 {
  margin: 0;
  color: var(--title);
  font-size: clamp(2.2rem, 5vw, 3.4rem);
  font-weight: 600;
  letter-spacing: 0.04em;
  line-height: 1;
}

.about-hero-note {
  margin: 10px 0 0;
  color: var(--text-faint);
  font-size: 0.68rem;
  letter-spacing: 0.2em;
}

.about-hero-index {
  color: var(--brass-dim);
  font-family: Arno, serif;
  font-size: 0.72rem;
  letter-spacing: 0.16em;
  line-height: 1.6;
  text-align: right;

  strong {
    font-size: 1.3rem;
    letter-spacing: 0.08em;
  }
}

.about-divider {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 28px 0 24px;
  color: var(--brass);

  span {
    flex: 1;
    height: 1px;
    background: color-mix(in srgb, var(--brass) 45%, transparent);
  }
  i {
    width: 7px;
    height: 7px;
    border: 1px solid var(--brass);
    transform: rotate(45deg);
  }
}

.about-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 24px 20px;
  align-items: stretch;
}

.about-section {
  display: flex;
  min-width: 0;
  flex-direction: column;
}

.about-section--wide {
  grid-column: 1 / -1;
}

.section-heading {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin: 0 0 8px;
  color: var(--text);
}

.section-number {
  color: var(--brass-dim);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.7rem;
  letter-spacing: 0.08em;
}

h2 {
  margin: 0;
  font-size: clamp(1.25rem, 2vw, 1.65rem);
  font-weight: 600;
}

.about-card {
  min-width: 0;
  min-height: 0;
  flex: 1 1 auto;
  box-sizing: border-box;
  padding: 20px 22px;
  background: linear-gradient(135deg, rgba(244, 239, 228, 0.9), rgba(232, 225, 210, 0.86));
  border: 1px solid rgba(129, 123, 112, 0.72);
  border-left: 3px solid var(--brass);
  box-shadow:
    0 3px 10px rgba(37, 39, 37, 0.1),
    inset 0 0 0 1px rgba(244, 239, 228, 0.42);
  line-height: 1.75;
  overflow-wrap: anywhere;

  p {
    margin: 0;
  }
  p + p {
    margin-top: 14px;
  }
  a {
    color: var(--spooky-green);
  }

  :deep(a),
  :deep(*) {
    max-width: 100%;
    overflow-wrap: anywhere;
    word-break: break-word;
  }
}

.archive-link {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  width: fit-content;
  padding: 7px 12px;
  border: 1px solid var(--brass);
  color: var(--spooky-green) !important;
  font-weight: 700;
  text-decoration: none;
  transition:
    background 120ms ease,
    transform 120ms ease;

  &:hover {
    background: rgba(165, 130, 75, 0.12);
    transform: translateY(-1px);
  }
}

.card-note {
  color: var(--text-dim);
  font-size: 0.92em;
}

.focus .about-card {
  border-color: var(--select);
  border-left-color: var(--select);
  box-shadow:
    0 0 0 2px rgba(135, 90, 158, 0.16),
    var(--shadow-2);
}

.about-footer {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 30px;
  color: var(--text-faint);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.62rem;
  letter-spacing: 0.12em;

  .footer-rule {
    flex: 1;
    height: 1px;
    background: rgba(129, 123, 112, 0.45);
  }
}

@media (max-width: 768px) {
  .about-page-shell {
    width: calc(100% - 20px);
    margin: 10px auto;
    padding: 26px 18px 24px;
  }

  .about-hero {
    grid-template-columns: 58px 1fr;
    gap: 14px;
  }

  .about-hero-seal {
    width: 54px;
    height: 54px;
    img {
      width: 42px;
      height: 42px;
    }
  }

  .about-hero-index {
    display: none;
  }
  .about-hero-note {
    font-size: 0.56rem;
    letter-spacing: 0.12em;
  }
  .about-grid {
    grid-template-columns: 1fr;
    gap: 20px;
  }
  .about-section--wide {
    grid-column: auto;
  }
  .about-card {
    padding: 16px;
  }
  .about-footer {
    font-size: 0.54rem;
  }

  .archive-kicker {
    font-size: 0.58rem;
    letter-spacing: 0.12em;
  }
  .archive-kicker span {
    width: 16px;
  }

  h1 {
    font-size: 2.2rem;
  }
  h2 {
    font-size: 1.28rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .archive-link {
    transition: none;
  }
}
</style>
