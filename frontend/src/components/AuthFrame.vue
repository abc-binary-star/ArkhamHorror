<script setup lang="ts">
defineProps<{ title: string }>()
</script>

<template>
  <div class="auth-stage">
    <section class="auth-card" aria-labelledby="auth-title">
      <header class="auth-heading">
        <img src="/assets/veiled-harbour/06-诡镇奇谈徽记.svg" alt="" width="64" height="64" />
        <p class="auth-kicker" aria-hidden="true">ARKHAM HORROR · ARCHIVES</p>
        <h1 id="auth-title">{{ title }}</h1>
        <p class="auth-tagline">{{ $t('signInTagline') }}</p>
      </header>
      <slot />
      <div class="auth-colophon" aria-hidden="true"><span></span> ◆ <span></span></div>
    </section>
  </div>
</template>

<style scoped>
.auth-stage {
  flex: 1;
  min-height: 0;
  overflow: auto;
  display: flex;
  padding: clamp(24px, 5vh, 64px) 20px 40px;
  box-sizing: border-box;
  background:
    linear-gradient(90deg, rgb(8 18 19 / 0.72), rgb(8 18 19 / 0.28) 65%, rgb(8 18 19 / 0.5)),
    url('/assets/veiled-harbour/42-旧港雾潮主视觉-v1.png') center / cover no-repeat;
}

.auth-card {
  position: relative;
  flex: 0 0 auto;
  width: min(100%, 420px);
  margin: auto;
  padding: 32px clamp(24px, 4vw, 40px) 22px;
  box-sizing: border-box;
  color: var(--text);
  background: #ece5d5 url('/assets/veiled-harbour/C02-象牙档案纸微纹理.avif') center / 320px;
  border-radius: 2px;
  box-shadow:
    0 24px 72px rgb(0 0 0 / 0.38),
    0 3px 10px rgb(0 0 0 / 0.2);
}

.auth-card::before {
  content: '';
  position: absolute;
  inset: 7px;
  pointer-events: none;
}

.auth-heading {
  text-align: center;
  margin-bottom: 28px;
}
.auth-heading img {
  display: block;
  margin: 0 auto 14px;
}
.auth-kicker {
  margin: 0 0 12px;
  color: #6e6048;
  font-family: 'Arno', serif;
  font-size: 11px;
  letter-spacing: 0.2em;
}
.auth-heading h1 {
  margin: 0;
  color: #243c38;
  font-family: 'Source Han Serif', 'Arno', serif;
  font-size: 28px;
  font-weight: 600;
  letter-spacing: 0.14em;
  line-height: 1.5;
}
.auth-tagline {
  margin: 10px 0 0;
  color: #696354;
  font-size: 13px;
  letter-spacing: 0.08em;
}
.auth-colophon {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-top: 26px;
  color: #948057;
  font-size: 8px;
}
.auth-colophon span {
  width: 48px;
  height: 1px;
  background: rgb(142 114 66 / 0.35);
}
:deep(form),
:deep(section) {
  margin: 0;
  padding: 0;
}
:deep(label) {
  display: block;
  margin: 0 0 7px;
  color: #504e42;
  font-size: 12px;
  letter-spacing: 0.06em;
}
:deep(input) {
  box-sizing: border-box;
  width: 100%;
  min-height: 46px;
  margin-bottom: 18px;
  padding: 11px 12px;
  background: rgb(255 253 245 / 0.52);
  border: 1px solid #a69e8c;
  border-radius: 2px;
  color: #293a36;
  font-size: 16px;
  box-shadow: inset 0 1px 3px rgb(60 49 30 / 0.05);
  transition:
    border-color 160ms,
    box-shadow 160ms;
}
:deep(input:hover) {
  border-color: #7e816b;
}
:deep(input:focus-visible) {
  outline: 2px solid #446d64;
  outline-offset: 2px;
  border-color: #446d64;
}
:deep(button) {
  width: 100%;
  min-height: 46px;
  margin-top: 4px;
  color: #f4eddd;
  background:
    linear-gradient(rgb(28 57 51 / 0.88), rgb(20 41 38 / 0.96)),
    url('/assets/veiled-harbour/C01-墨绿漆面微纹理.avif') center / 256px;
  border: 1px solid #8e7b52;
  border-radius: 2px;
  box-shadow:
    inset 0 0 0 2px rgb(185 160 105 / 0.12),
    0 3px 8px rgb(35 44 33 / 0.14);
  font-size: 14px;
  letter-spacing: 0.12em;
}
:deep(button:focus-visible),
:deep(a:focus-visible) {
  outline: 2px solid #446d64;
  outline-offset: 3px;
}
:deep(a) {
  color: #475f56;
  text-underline-offset: 4px;
}
:deep(.auth-links) {
  margin: 18px 0 0;
  text-align: center;
  font-size: 13px;
}
:deep(.error) {
  margin-bottom: 18px;
  padding: 10px 12px;
  background: #f0dfd5;
  border-left: 2px solid #985342;
  color: #793c31;
  font-size: 13px;
  line-height: 1.6;
}
:deep(.auth-message) {
  margin: 0;
  font-size: 14px;
  line-height: 1.8;
}
@media (max-width: 600px) {
  .auth-stage {
    padding: 24px 18px;
    background-image:
      linear-gradient(rgb(8 18 19 / 0.42), rgb(8 18 19 / 0.76)),
      url('/assets/veiled-harbour/46-移动端旧港巷道-v1.png');
  }
  .auth-card {
    padding-top: 26px;
  }
  .auth-heading {
    margin-bottom: 22px;
  }
}
</style>
