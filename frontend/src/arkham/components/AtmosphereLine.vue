<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { AtmosphereTone } from '@/arkham/atmosphere'
withDefaults(defineProps<{ tone?: AtmosphereTone }>(), { tone: 'choice' })
const { t } = useI18n({ useScope: 'local', fallbackLocale: 'en', messages: {
  zh: {
    support: '并肩而立的身影让灯火重新明亮。纵使长夜无边，你仍有迎向黑暗的力量。',
    resolve: '你握紧手中的最后一点希望。恐惧尚未退去，而你已经向前一步。',
    enemy: '阴影中传来不属于人类的呼吸。那东西正缓缓抬头，仿佛早已知道你的名字。',
    enemyForced: '某种古老的意志碾过现实。利爪与低语一同逼近，这一次，黑暗不容你回避。',
    treachery: '纸页渗出冰冷的潮意，字迹像活物般蠕动。帷幕之后，有什么正在回应你的注视。',
    forced: '看不见的齿轮再次转动。命运的契约已然生效，回声正索取它的代价。',
    encounter: '群星偏离了熟悉的位置。翻开下一页，让潜伏在夜色中的秘密显露形貌。',
    damage: '疼痛划破了长夜。稳住呼吸，在下一阵黑暗涌来之前，守住仍能站立的人。',
    horror: '那幅景象仍在脑海深处睁着眼睛。抓住一个熟悉的声音，别让自己沉入低语。',
    peril: '伤口在灼烧，低语在逼近。握住同伴伸来的手，将这份重压一同扛过。',
    test: '灯焰静止了一瞬。你倾尽所能，将意志投向那片无人应答的黑暗。',
    success: '黑暗裂开一道微光。你的坚持留下了回响，前路终于显出轮廓。',
    failure: '回声消失在深处。纵然这一步未能踏稳，仍有一盏灯等待你重新举起。',
    chaos: '袋中响起石子般的轻语。伸手探入未知，让命运露出它今夜的面孔。',
    payment: '每一束照进深渊的光，都有它的代价。衡量手中的筹码，再许下你的决意。',
    search: '拂去尘埃，沿着残缺的痕迹追索。也许下一张纸页，便藏着穿过长夜的线索。',
    story: '旧日的墨迹尚未干涸。静听这一页的回声，你的脚步也将写入其中。',
    choice: '岔路隐没在雾中。提稳手中的灯，选择你愿意继续走下去的方向。',
    archive: '在泛黄的纸页间，往事仍有余温。细看那些被遗忘的名字与痕迹。',
    preparation: '拨亮灯芯，收拢散落的行装。在再度踏入未知之前，让一切各归其位。',
    revelation: '封存的秘密终于显露。别急着移开目光——你看见的，也许并非全部。',
    tarot: '命运在古老的图案间低语。翻动纸牌，听见尚未发生之事投来的回声。',
  },
  en: {
    support: 'Beside you, a steady presence makes the lantern burn brighter. Even in this endless night, you have strength to face the dark.',
    resolve: 'You hold fast to the hope that remains. Fear has not left you, but you take another step.',
    enemy: 'Something in the shadows breathes without human lungs. It lifts its head as though it has always known your name.',
    enemyForced: 'An ancient will presses against reality. Claws and whispers draw near; this time, the darkness offers no retreat.',
    treachery: 'Cold damp seeps through the page. The letters seem to stir, and something beyond the veil returns your gaze.',
    forced: 'Unseen gears turn again. An old bargain has come due, and its echo demands a price.',
    encounter: 'The stars have strayed from their familiar places. Turn the page and let the night disclose its secret.',
    damage: 'Pain cuts through the night. Steady your breath and shelter those who can still stand.',
    horror: 'The vision still watches from within your mind. Hold on to a familiar voice before the whispers draw you under.',
    peril: 'Wounds burn as the whispers close in. Take the hand beside you and share the weight of this darkness.',
    test: 'The lantern flame holds still. You gather everything you have and cast your will into the unanswering dark.',
    success: 'A thread of light breaks through. Your persistence has left its mark, and the path takes shape.',
    failure: 'The echo fades into the depths. Though this step has faltered, a lantern still waits to be raised.',
    chaos: 'The bag whispers like shifting stones. Reach into the unknown and meet the face fate wears tonight.',
    payment: 'Every light cast into the abyss has its price. Weigh what you carry before making your resolve.',
    search: 'Brush away the dust and follow the broken trail. The next page may hold a clue through the night.',
    story: 'The old ink has not yet dried. Listen to this page; your footsteps, too, will become part of its story.',
    choice: 'The paths vanish into mist. Hold your lantern steady and choose where you will walk next.',
    archive: 'The past still holds a little warmth between these yellowed pages. Study the forgotten names and traces.',
    preparation: 'Trim the wick and gather your belongings. Before returning to the unknown, put everything in its place.',
    revelation: 'A sealed secret comes to light. Hold your gaze; what you have seen may not be all that is there.',
    tarot: 'Fate whispers through ancient symbols. Turn the cards and hear the echo of things yet to come.',
  },
} })
</script>
<template><p class="atmosphere-line" :data-tone="tone">{{ t(tone) }}</p></template>
<style scoped>
.atmosphere-line { margin: 10px 0 14px; max-width: max(60ch, 38em); font-family: 'Songti SC', 'Noto Serif SC', Georgia, serif; font-size: .85rem; font-weight: 400; line-height: 1.8; letter-spacing: .035em; color: inherit; opacity: .78; text-wrap: pretty; }
.atmosphere-line[data-tone='support'], .atmosphere-line[data-tone='resolve'] { border-left: 2px solid #a9bd8580; padding-left: 10px; }
.atmosphere-line[data-tone='enemyForced'], .atmosphere-line[data-tone='treachery'], .atmosphere-line[data-tone='horror'] { border-left: 2px solid #a58cba80; padding-left: 10px; }
</style>
