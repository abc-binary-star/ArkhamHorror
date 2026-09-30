<script setup lang="ts">
import type { AttachmentEffectKind } from '@/arkham/attachmentEffects'
defineProps<{ kind: AttachmentEffectKind; variant?: string; dormant?: boolean }>()
// Fixed positions are deterministic across rerenders and clients.
const motes = Array.from({ length: 10 }, (_, i) => ({
  x: i % 2 ? 92 - (i % 3) * 3 : 5 + (i % 3) * 3,
  y: 13 + i * 8,
  delay: `${-i * 0.63}s`,
}))
</script>

<template>
  <div class="attachment-motif" :class="[`fx-${kind}`, variant && `variant-${variant}`, { 'is-dormant': dormant }]">
    <div v-if="['fog', 'snow', 'water', 'haunt', 'rot', 'blood', 'spotlight', 'lantern'].includes(kind)" class="atmosphere" />
    <svg viewBox="0 0 100 140" preserveAspectRatio="none" focusable="false" fill="none" class="motif-drawing">
      <!-- Rusted chain with a different seal for investigation, exits and arcane tolls. -->
      <g v-if="kind === 'lock'" class="chain">
        <path d="M5 6Q-1 65 8 132M95 6Q101 65 92 132" class="chain-shadow" />
        <path d="M5 6Q-1 65 8 132M95 6Q101 65 92 132" stroke-dasharray="5 2" />
        <path d="M6 9Q26 27 43 16M57 16Q76 27 94 9" stroke-dasharray="4 2" />
        <g class="lock-seal">
          <path d="M44 15V9a6 6 0 0 1 12 0v6" />
          <rect x="40" y="14" width="20" height="17" rx="3" class="metal-fill" />
          <path v-if="variant === 'exit'" d="M44 23h12m-4-4 4 4-4 4" />
          <path v-else-if="variant === 'arcane'" d="m50 17 6 6-6 6-6-6Zm0 2v8" />
          <path v-else d="M44 23q6-8 12 0-6 8-12 0Zm6-2v4" />
        </g>
      </g>
      <g v-else-if="kind === 'barrier'" class="breathe">
        <path d="M12 133V23Q50-8 88 23v110M5 132V20Q50-17 95 20v112" />
        <path d="m9 39 7 7-7 7-7-7Zm82 46 7 7-7 7-7-7ZM43 10l7-7 7 7-7 7Z" class="rune-fill" />
        <path d="M7 67h10M83 67h10M7 114h10M83 114h10" />
      </g>
      <g v-else-if="kind === 'rubble'" class="stones">
        <path d="m1 140 1-14 12-7 14 8 2 13Zm28 0-3-14 14-10 17 9-2 15Zm26 0 4-15 15-5 12 10-3 10Zm26 0 5-17 11-5 3 22Z" class="stone-fill" />
        <path d="m3 127 12 5 12-4m-12 4 1 8m15-13 12 4 12-5m-12 5v9m17-13 12 4 11-1M5 118l-2-15 8-7 6 18M94 117l4-19-11-4-2 16" />
      </g>
      <g v-else-if="kind === 'vines'" class="vines">
        <path d="M5 140Q20 121 5 99T9 60T3 20M97 0Q82 24 96 43T91 88T97 130" stroke-width="3" />
        <path d="M6 110Q24 104 17 91Q4 96 6 110ZM9 70Q-1 50 2 46Q17 54 9 70ZM94 34Q77 30 79 14Q92 16 94 34ZM92 91Q78 101 82 112Q97 110 92 91Z" class="leaf-fill" />
        <path v-if="variant === 'thorns'" d="m6 120 13 1-10-8m0-34 12-9-14 1m87-16-14 2 12 6m0 41-14 4 13 5" />
      </g>
      <g v-else-if="kind === 'web'" class="web">
        <path d="M1 1 35 40M1 1 13 51M1 1 44 17M99 139 64 103M99 139 87 86M99 139 55 121M1 1v55M99 139v-57" />
        <path d="M1 14q6-1 11-3t5-10M1 28q9-4 18-8t13-8M1 44q15-7 26-14t14-14M99 122q-10 5-15 0t-4 17M99 104q-13 10-25 10t-10 15M99 91q-17 12-25 18t-16 13" />
      </g>
      <g v-else-if="kind === 'ice'" class="ice">
        <path d="m0 0 12 18-7 21 10 19-6 31 8 18-12 33M100 0 89 26l7 15-14 31 12 15-11 31 9 22M5 39l18 6m-10 44 14-10m62-53-14-6m9 52-14-3m12 49-15 6" />
        <path d="m0 0 12 18-7 21 10 19L0 87Zm100 45L82 72l12 15-11 31 17 22Z" class="ice-fill" />
      </g>
      <g v-else-if="kind === 'vortex'" class="vortex">
        <path d="M7 110Q-5 38 29 10M9 123Q-2 50 24 20M94 29q13 77-24 103M94 17q17 61-13 99M29 10q23-11 42 0M70 132q-24 11-42-1" />
        <path d="m23 9 8-4-2 9m48 118-8 4 2-9" />
      </g>
      <g v-else-if="kind === 'water'" class="water-lines">
        <path d="M1 119q12-7 25 0t25 0 25 0 25 0M1 126q12-7 25 0t25 0 25 0 25 0M1 133q12-7 25 0t25 0 25 0 25 0" />
        <path d="m7 118-3-11m8 8 3-14m77 17 4-15m-10 10-1-9" />
      </g>
      <g v-else-if="kind === 'electric' || kind === 'sparks'" class="electric">
        <path d="m8 5-5 27 8-7-6 35 8-5-7 43 6-5-7 39M92 7l5 25-8-7 6 35-8-5 7 43-6-5 7 39" />
        <path d="m20 5 4 8-9-2m65 120-4-8 9 2M2 75l15-9M98 49l-15-9" class="spark-flash" />
      </g>
      <g v-else-if="kind === 'rift'" class="rift">
        <path d="m4 0 8 24-7 14 9 13-8 22 10 16-12 25 7 26M98 0l-11 18 8 26-10 15 7 22-9 13 12 28-9 18" stroke-width="3" />
        <path d="m10 23 10 4-10 9m80 30-13 3 13 8M13 99l13 7-18 7" />
      </g>
      <g v-else-if="kind === 'threads'" class="threads">
        <path d="M1 2q20 46 5 136M8 2q-12 74 5 136M92 2q12 74-5 136M99 2q-20 46-5 136M0 10q50 15 100 0M0 130q50-15 100 0" />
        <path d="m46 3 8 10-8 10 8 10M50 8v20" />
      </g>
      <g v-else-if="kind === 'blood' || kind === 'growth' || kind === 'rot'" class="veins">
        <path d="M4 0q11 26 0 55t2 85M96 0q-11 26 0 55t-2 85M6 24l12 9-4 13M5 67l11-8 4-11M6 100l13 11-4 13M94 29l-14 9 4 14M95 75l-15-8-3-14M95 112l-13 11 3 11" />
        <path v-if="kind === 'growth'" d="M2 3h16M2 3v18M98 3H82M98 3v18M2 137h16M2 137v-18M98 137H82M98 137v-18" stroke-width="4" />
        <g v-if="kind === 'rot'" class="fungus-fill"><ellipse cx="8" cy="42" rx="8" ry="3" /><ellipse cx="92" cy="94" rx="8" ry="3" /><ellipse cx="6" cy="104" rx="5" ry="2" /></g>
      </g>
      <g v-else-if="kind === 'doom'" class="doom">
        <path d="M3 140V20l5-13 5 13v120M97 140V20L92 7l-5 13v120" />
        <path d="m38 12 12-9 12 9-12 9ZM50 3v28m-10-9 10 9 10-9" />
        <circle cx="50" cy="14" r="13" stroke-dasharray="2 4" />
      </g>
      <g v-else-if="kind === 'hunt'" class="hunt">
        <path d="m2 25 4-19 16-4M98 25l-4-19-16-4M2 115l4 19 16 4M98 115l-4 19-16 4" />
        <path d="M4 22h13M10 16v13M83 118h13m-7-7v14" />
        <circle cx="50" cy="9" r="6" /><path d="M40 9h20M50 0v18" />
      </g>
      <g v-else-if="kind === 'evidence'" class="evidence">
        <path d="m2 5 25 3-4 19L0 22Zm96 129-25-3 4-19 23 5Z" class="paper-fill" />
        <path d="m7 10 13 2m-14 4 10 2m63 99 13 2m-14 4 10 2M25 10q36-19 66 2" />
        <circle cx="9" cy="7" r="2" class="rune-fill" />
      </g>
      <g v-else-if="kind === 'song'" class="song">
        <path d="M4 5q11 25 0 50t0 80M10 5q11 25 0 50t0 80M96 5q-11 25 0 50t0 80M90 5q-11 25 0 50t0 80" />
        <path d="m10 39 6-3v17m-4-3q-5 0-4 4t8-1M89 91l-6-3v17m4-3q5 0 4 4t-8-1" />
      </g>
      <g v-else-if="kind === 'glyph'" class="glyph">
        <path d="M3 3h25M3 3v35M97 3H72M97 3v35M3 137h25M3 137v-35M97 137H72M97 137v-35" />
        <path d="m8 15 6-7 6 7-6 7Zm78 4V8h7m-79 109-6 11h12Zm72 0 7 11-7 6-7-6Z" />
        <path d="M4 47h7v14H4m92 18h-7v14h7" class="breathe" />
      </g>
      <g v-else-if="kind === 'lantern'" class="lantern">
        <path d="M44 15V8a6 6 0 0 1 12 0v7M40 15h20l-3 21H43ZM39 37h22M46 19v13m8-13v13" />
        <path d="m35 19-8-4m38 4 8-4M36 29l-9 4m37-4 9 4" class="breathe" />
      </g>
      <g v-else-if="kind === 'haunt'" class="haunt">
        <path d="M6 138Q-7 95 8 72T5 2M94 138q13-43-2-66t3-70" />
        <path d="M2 26q6-9 12 0l-2 12-4-3-4 4ZM86 103q6-9 12 0l-2 12-4-3-4 4Z" class="ghost-fill" />
      </g>
      <g v-if="['fog','spores','snow','vortex','electric','rot','lantern'].includes(kind)" class="motes">
        <circle v-for="(mote, i) in motes" :key="i" :cx="mote.x" :cy="mote.y" :r="kind === 'spores' ? 1.6 : 0.8" :style="{ animationDelay: mote.delay }" />
      </g>
    </svg>
  </div>
</template>

<style scoped>
.attachment-motif {
  --fx-color: #b6a47b;
  --fx-dark: #302b22;
  position: absolute; inset: 0;
  color: var(--fx-color);

}
.motif-drawing { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; stroke: currentColor; stroke-width: 1.2; stroke-linecap: round; stroke-linejoin: round; }
.chain { stroke-width: 2; }
.chain-shadow { stroke: #25201a; stroke-width: 4.5; }
.metal-fill { fill: #504534; stroke: #c1a06a; }
.rune-fill { fill: currentColor; fill-opacity: 0.35; }
.stone-fill { fill: #5f5b51; stroke: #a39b82; }
.leaf-fill { fill: #384a33; }
.ice-fill { fill: #a1c9ce; fill-opacity: 0.2; }
.fungus-fill { fill: #6c7951; }
.paper-fill { fill: #b5a481; fill-opacity: 0.8; stroke: #685c43; }
.ghost-fill { fill: #a7bab7; fill-opacity: 0.3; }
.breathe, .barrier, .veins, .doom, .glyph, .lock-seal { animation: attachment-breathe 5s ease-in-out infinite alternate; }
.fx-lock { --fx-color: #b49159; }
.fx-lock.variant-arcane, .fx-barrier, .fx-threads { --fx-color: #ae90b9; }
.fx-rubble { --fx-color: #a89f89; }
.fx-vines, .fx-spores, .fx-rot { --fx-color: #83965a; }
.fx-vines.variant-thorns { --fx-color: #a09762; }
.fx-spores.variant-luminous { --fx-color: #abdca0; }
.fx-web { --fx-color: #d0c8ac; }
.web { stroke-width: 0.75; opacity: 0.85; animation: attachment-web 7s ease-in-out infinite alternate; transform-origin: center; }
.fx-fog { --fx-color: #b2b8b1; }
.fx-fog.variant-spectral, .fx-haunt { --fx-color: #99bdc2; }
.fx-snow, .fx-vortex, .fx-ice, .fx-water { --fx-color: #b3d6db; }
.fx-electric { --fx-color: #85cbdc; }
.fx-sparks { --fx-color: #c6a072; }
.fx-rift { --fx-color: #b898c0; }
.fx-blood, .fx-hunt { --fx-color: #bb7063; }
.fx-growth { --fx-color: #989378; }
.fx-doom { --fx-color: #b99369; }
.fx-doom.variant-yellow { --fx-color: #c5b765; }
.fx-song { --fx-color: #95b8a1; }
.fx-lantern { --fx-color: #b4d6ba; }
.atmosphere {
  position: absolute; inset: -2%; border-radius: 6%;
  background: radial-gradient(ellipse at 0 35%, currentColor, transparent 18%), radial-gradient(ellipse at 100% 75%, currentColor, transparent 18%), linear-gradient(180deg, currentColor, transparent 12%, transparent 90%, currentColor);
  opacity: 0.25; animation: attachment-mist 8s ease-in-out infinite alternate;
  mask-image: linear-gradient(90deg, #000 0%, transparent 22%, transparent 78%, #000 100%);
}
.fx-water .atmosphere { inset: 78% 0 0; mask-image: none; background: linear-gradient(transparent, #548e9d88); }
.water-lines { animation: attachment-water 3s ease-in-out infinite alternate; }
.fx-snow .atmosphere { opacity: 0.3; }
.fx-blood .atmosphere { opacity: 0.2; }
.fx-rot .atmosphere { opacity: 0.3; }
.fx-spotlight .atmosphere { inset: 0; mask-image: none; background: linear-gradient(100deg, transparent 40%, #d8c58b38 49%, transparent 59%); background-size: 280% 100%; background-position: 50% 0; animation: attachment-sweep 9s ease-in-out infinite; }
.fx-lantern .atmosphere { inset: 0 25% 70%; mask-image: none; background: radial-gradient(ellipse at 50% 25%, #bad9b666, transparent 65%); }
.motes circle { fill: currentColor; stroke: none; opacity: 0.45; animation: attachment-mote 5s linear infinite; }
.fx-snow .motes circle { animation-direction: reverse; }
.electric { animation: attachment-electric 4s ease-in-out infinite; }
.spark-flash { animation: attachment-spark 3.7s linear infinite; }
.rift { animation: attachment-breathe 6s ease-in-out infinite alternate; }
.vortex { animation: attachment-web 4s ease-in-out infinite alternate; transform-origin: center; }
.song { animation: attachment-breathe 7s ease-in-out infinite alternate; }
.is-dormant { opacity: 0.3 !important; filter: grayscale(1); }
.is-dormant .stones { transform: translateY(8px) scaleY(0.94); transform-origin: bottom; }
.is-dormant * { animation: none !important; }
@keyframes attachment-breathe { from { opacity: 0.5; } to { opacity: 0.95; } }
@keyframes attachment-web { from { transform: skewY(-0.6deg); } to { transform: skewY(0.6deg); } }
@keyframes attachment-mist { from { opacity: 0.15; transform: translateY(-1%); } to { opacity: 0.35; transform: translateY(1%); } }
@keyframes attachment-mote { 0% { opacity: 0; transform: translateY(5px); } 25% { opacity: 0.55; } 100% { opacity: 0; transform: translateY(-12px); } }
@keyframes attachment-water { from { transform: translateY(1px); opacity: 0.5; } to { transform: translateY(-1px); opacity: 0.9; } }
@keyframes attachment-sweep { 0%, 15% { background-position: 100% 0; opacity: 0; } 30%, 70% { opacity: 0.65; } 85%, 100% { background-position: 0 0; opacity: 0; } }
@keyframes attachment-electric { 0%, 100% { opacity: 0.45; } 45%, 60% { opacity: 0.9; } }
@keyframes attachment-spark { 0%, 75%, 100% { opacity: 0; } 80%, 90% { opacity: 0.85; } }
</style>
