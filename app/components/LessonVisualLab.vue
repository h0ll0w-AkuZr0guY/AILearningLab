<script setup lang="ts">
import type { GuideVisual } from '~/data/guide-types'

const props = defineProps<{
  visuals: GuideVisual[]
  lessonId: string
}>()

const activeSteps = reactive<Record<string, number>>({})
const playing = reactive<Record<string, boolean>>({})
const timers = new Map<string, ReturnType<typeof window.setInterval>>()
const baseURL = useRuntimeConfig().app.baseURL
const visualComponentFiles = import.meta.glob('./lesson-visuals/**/*.vue', {
  eager: true,
  import: 'default'
})
const visualComponents = Object.fromEntries(
  Object.entries(visualComponentFiles).map(([path, component]) => [
    path.replace(/^\.\/lesson-visuals\//, '').replace(/\.vue$/, ''),
    component
  ])
)

const activeIndex = (visual: GuideVisual) => activeSteps[visual.id] || 0

const setActive = (visual: GuideVisual, index: number) => {
  if (!visual.steps.length) return
  activeSteps[visual.id] = (index + visual.steps.length) % visual.steps.length
}

const stop = (visual: GuideVisual) => {
  const timer = timers.get(visual.id)
  if (timer) window.clearInterval(timer)
  timers.delete(visual.id)
  playing[visual.id] = false
}

const togglePlay = (visual: GuideVisual) => {
  if (playing[visual.id]) {
    stop(visual)
    return
  }
  if (visual.steps.length < 2) return
  playing[visual.id] = true
  timers.set(visual.id, window.setInterval(() => {
    setActive(visual, activeIndex(visual) + 1)
  }, 1600))
}

const reset = (visual: GuideVisual) => {
  stop(visual)
  setActive(visual, 0)
}

const assetUrl = (asset?: string) => {
  if (!asset) return ''
  if (/^(?:https?:)?\/\//.test(asset)) return asset
  return `${baseURL.replace(/\/$/, '')}/${asset.replace(/^\//, '')}`
}

const customVisual = (visual: GuideVisual) =>
  visual.component ? visualComponents[visual.component] : undefined

const graphPoint = (index: number, total: number) => {
  const columns = Math.min(4, Math.max(1, total))
  const row = Math.floor(index / columns)
  const column = index % columns
  const rows = Math.ceil(total / columns)
  const reverse = row % 2 === 1
  const visualColumn = reverse ? columns - 1 - column : column
  return {
    x: columns === 1 ? 320 : 80 + visualColumn * (480 / (columns - 1)),
    y: rows === 1 ? 135 : 70 + row * (130 / Math.max(1, rows - 1))
  }
}

onBeforeUnmount(() => {
  for (const timer of timers.values()) window.clearInterval(timer)
  timers.clear()
})
</script>

<template>
  <section
    v-if="visuals.length"
    :id="`visual-${lessonId}-${visuals[0]?.id}`"
    class="visual-lab"
    :aria-labelledby="`visual-lab-title-${lessonId}-${visuals[0]?.id}`"
  >
    <header class="visual-lab-heading">
      <div>
        <span>VISUAL LAB</span>
        <h2 :id="`visual-lab-title-${lessonId}-${visuals[0]?.id}`">把机制变成可观察实验</h2>
      </div>
      <p>点击阶段或逐步播放。动画只表达当前 Markdown 声明的状态，不替代官方文档和源码证据。</p>
    </header>

    <article
      v-for="(visual, visualIndex) in visuals"
      :key="visual.id"
      class="visual-card"
      :class="`visual-${visual.kind}`"
    >
      <header class="visual-card-heading">
        <div>
          <span>{{ visual.kind.toUpperCase() }} · {{ String(visualIndex + 1).padStart(2, '0') }}</span>
          <h3>{{ visual.title }}</h3>
        </div>
        <p>{{ visual.summary }}</p>
      </header>

      <component
        :is="customVisual(visual)"
        v-if="customVisual(visual)"
        :visual="visual"
      />

      <figure v-else-if="visual.kind === 'image'" class="visual-image">
        <img
          :src="assetUrl(visual.asset)"
          :alt="visual.alt"
          width="1536"
          height="1024"
          loading="lazy"
        >
        <figcaption>
          {{ visual.caption }}
          <small v-if="visual.credit">{{ visual.credit }}</small>
        </figcaption>
      </figure>

      <template v-else>
        <div
          v-if="visual.kind === 'flow'"
          class="visual-flow-stage"
          :aria-label="visual.title"
        >
          <template v-for="(step, index) in visual.steps" :key="`${visual.id}-${step.label}`">
            <button
              :class="{ active: activeIndex(visual) === index, done: activeIndex(visual) > index }"
              @click="setActive(visual, index)"
            >
              <span>{{ String(index + 1).padStart(2, '0') }}</span>
              <b>{{ step.label }}</b>
            </button>
            <i v-if="index < visual.steps.length - 1" aria-hidden="true">→</i>
          </template>
        </div>

        <div v-else-if="visual.kind === 'graph'" class="visual-graph-stage">
          <svg viewBox="0 0 640 270" role="img" :aria-label="`${visual.title} 节点流`">
            <g class="graph-edges">
              <line
                v-for="(_, index) in visual.steps.slice(0, -1)"
                :key="`edge-${index}`"
                :x1="graphPoint(index, visual.steps.length).x"
                :y1="graphPoint(index, visual.steps.length).y"
                :x2="graphPoint(index + 1, visual.steps.length).x"
                :y2="graphPoint(index + 1, visual.steps.length).y"
                :class="{ active: activeIndex(visual) > index }"
              />
            </g>
            <g
              v-for="(step, index) in visual.steps"
              :key="step.label"
              class="graph-node"
              :class="{ active: activeIndex(visual) === index, done: activeIndex(visual) > index }"
              :transform="`translate(${graphPoint(index, visual.steps.length).x} ${graphPoint(index, visual.steps.length).y})`"
              role="button"
              tabindex="0"
              @click="setActive(visual, index)"
              @keydown.enter.prevent="setActive(visual, index)"
              @keydown.space.prevent="setActive(visual, index)"
            >
              <circle r="34" />
              <text text-anchor="middle" dominant-baseline="middle">{{ index + 1 }}</text>
              <text class="graph-label" text-anchor="middle" y="54">{{ step.label }}</text>
            </g>
          </svg>
        </div>

        <div v-else-if="visual.kind === 'tensor'" class="visual-tensor-stage">
          <div class="tensor-axis"><span>状态 / shape</span><b>{{ activeIndex(visual) + 1 }} × {{ visual.steps.length }}</b></div>
          <div class="tensor-grid" :style="{ '--cells': String(Math.min(4, visual.steps.length)) }">
            <button
              v-for="(step, index) in visual.steps"
              :key="step.label"
              :class="{ active: activeIndex(visual) === index, done: activeIndex(visual) > index }"
              @click="setActive(visual, index)"
            >
              <span>{{ index }}</span>
              <b>{{ step.label }}</b>
            </button>
          </div>
        </div>

        <div v-else-if="visual.kind === 'playground'" class="visual-playground-stage">
          <div class="playground-controls" aria-label="切换实验状态">
            <button
              v-for="(step, index) in visual.steps"
              :key="step.label"
              :class="{ active: activeIndex(visual) === index }"
              @click="setActive(visual, index)"
            >{{ step.label }}</button>
          </div>
          <div class="playground-preview">
            <span>RUNTIME STATE</span>
            <Transition name="visual-swap" mode="out-in">
              <strong :key="activeIndex(visual)">{{ visual.steps[activeIndex(visual)]?.label }}</strong>
            </Transition>
            <i :style="{ width: `${((activeIndex(visual) + 1) / visual.steps.length) * 100}%` }" />
          </div>
        </div>

        <div v-else class="visual-state-stage">
          <div>
            <span>前一状态</span>
            <b>{{ visual.steps[Math.max(0, activeIndex(visual) - 1)]?.label }}</b>
          </div>
          <i aria-hidden="true">→</i>
          <div class="current">
            <span>当前状态</span>
            <Transition name="visual-swap" mode="out-in">
              <b :key="activeIndex(visual)">{{ visual.steps[activeIndex(visual)]?.label }}</b>
            </Transition>
          </div>
        </div>

        <div class="visual-controls">
          <button
            :aria-label="`${visual.title} 上一步`"
            @click="setActive(visual, activeIndex(visual) - 1)"
          >上一步</button>
          <button class="play" @click="togglePlay(visual)">
            {{ playing[visual.id] ? '暂停' : (visual.actionLabel || '播放机制') }}
          </button>
          <button
            :aria-label="`${visual.title} 下一步`"
            @click="setActive(visual, activeIndex(visual) + 1)"
          >下一步</button>
          <button @click="reset(visual)">重置</button>
        </div>

        <div class="visual-observation" aria-live="polite">
          <span>正在观察 · {{ activeIndex(visual) + 1 }}/{{ visual.steps.length }}</span>
          <p>{{ visual.steps[activeIndex(visual)]?.detail }}</p>
        </div>
        <p class="visual-caption">{{ visual.caption }}</p>
      </template>

      <ul v-if="visual.observations.length" class="visual-notes">
        <li v-for="item in visual.observations" :key="item">{{ item }}</li>
      </ul>
    </article>
  </section>
</template>

<style scoped>
.visual-lab {
  margin: 34px 0 44px;
}

.visual-lab-heading,
.visual-card-heading {
  display: grid;
  grid-template-columns: minmax(190px, .72fr) 1.28fr;
  gap: 24px;
  align-items: end;
}

.visual-lab-heading {
  margin-bottom: 16px;
}

.visual-lab-heading span,
.visual-card-heading span,
.visual-observation span,
.visual-state-stage span,
.playground-preview > span,
.tensor-axis {
  color: #6d7890;
  font-family: 'DM Mono', monospace;
  font-size: .68rem;
  letter-spacing: .08em;
}

.visual-lab-heading h2,
.visual-card-heading h3 {
  margin: 3px 0 0;
}

.visual-lab-heading p,
.visual-card-heading p {
  color: #59657a;
  font-size: .86rem;
  line-height: 1.65;
  margin: 0;
}

.visual-card {
  background:
    radial-gradient(circle at 90% 0%, rgba(86, 111, 225, .12), transparent 36%),
    #fbfcff;
  border: 1px solid #d9deea;
  border-radius: 9px;
  box-shadow: 0 16px 34px rgba(31, 41, 64, .06);
  margin-top: 16px;
  overflow: hidden;
}

.visual-card-heading {
  border-bottom: 1px solid #e0e4ed;
  padding: 19px 21px;
}

.visual-flow-stage,
.visual-state-stage,
.visual-playground-stage,
.visual-tensor-stage,
.visual-graph-stage {
  min-height: 230px;
  padding: 26px 22px;
}

.visual-flow-stage {
  align-items: center;
  display: flex;
  justify-content: center;
  overflow-x: auto;
}

.visual-flow-stage button {
  background: #fff;
  border: 1px solid #cbd2df;
  border-radius: 7px;
  color: #3d4960;
  flex: 0 0 112px;
  min-height: 92px;
  padding: 12px 8px;
}

.visual-flow-stage button span {
  color: #7f8aa0;
  display: block;
  font: .65rem 'DM Mono', monospace;
}

.visual-flow-stage button b {
  display: block;
  font-size: .78rem;
  line-height: 1.4;
  margin-top: 7px;
}

.visual-flow-stage button.active,
.tensor-grid button.active {
  background: #172033;
  border-color: #172033;
  color: #fff;
  transform: translateY(-4px);
}

.visual-flow-stage button.done,
.tensor-grid button.done {
  background: #edf8f2;
  border-color: #9ed7bc;
}

.visual-flow-stage i {
  color: #7c89a4;
  font-style: normal;
  padding: 0 6px;
}

.visual-graph-stage {
  background-image: radial-gradient(#d6dce8 1px, transparent 1px);
  background-size: 18px 18px;
  padding: 6px 18px;
}

.visual-graph-stage svg {
  display: block;
  height: 260px;
  margin: auto;
  max-width: 720px;
  width: 100%;
}

.graph-edges line {
  stroke: #c7cfdd;
  stroke-dasharray: 5 6;
  stroke-width: 3;
  transition: stroke .25s ease;
}

.graph-edges line.active {
  stroke: #4f68dd;
  stroke-dasharray: none;
}

.graph-node {
  cursor: pointer;
  outline: none;
}

.graph-node circle {
  fill: #fff;
  stroke: #9aa7bd;
  stroke-width: 2;
  transition: fill .22s ease, transform .22s ease;
}

.graph-node text {
  fill: #4c5870;
  font: 700 14px 'DM Mono', monospace;
  pointer-events: none;
}

.graph-node .graph-label {
  font: 700 12px Manrope, sans-serif;
}

.graph-node.done circle {
  fill: #dff5e9;
  stroke: #56af83;
}

.graph-node.active circle {
  fill: #172033;
  stroke: #d8ff61;
  stroke-width: 4;
}

.graph-node.active text {
  fill: #fff;
}

.graph-node.active .graph-label {
  fill: #172033;
}

.visual-tensor-stage {
  background: #151d2d;
  color: #dce6f8;
}

.tensor-axis {
  align-items: center;
  color: #8fa0bd;
  display: flex;
  justify-content: space-between;
  margin: 0 auto 14px;
  max-width: 560px;
}

.tensor-axis b {
  color: #d8ff61;
}

.tensor-grid {
  display: grid;
  gap: 8px;
  grid-template-columns: repeat(var(--cells), minmax(0, 1fr));
  margin: auto;
  max-width: 560px;
}

.tensor-grid button {
  aspect-ratio: 1.35;
  background: #202a40;
  border: 1px solid #3a4761;
  border-radius: 5px;
  color: #cad5e8;
  display: grid;
  min-width: 0;
  padding: 8px;
  place-items: center;
  transition: .2s ease;
}

.tensor-grid button span {
  color: #71809c;
  font: .65rem 'DM Mono', monospace;
}

.tensor-grid button b {
  font-size: .72rem;
  line-height: 1.35;
  overflow-wrap: anywhere;
}

.tensor-grid button.active {
  background: #526ce5;
  border-color: #d8ff61;
  box-shadow: 0 0 0 3px rgba(216, 255, 97, .13);
}

.tensor-grid button.done {
  background: #253c3c;
  border-color: #4d9679;
}

.visual-state-stage {
  align-items: center;
  display: grid;
  gap: 16px;
  grid-template-columns: 1fr auto 1fr;
}

.visual-state-stage > div {
  background: #fff;
  border: 1px solid #d5dae5;
  border-radius: 8px;
  display: grid;
  min-height: 130px;
  padding: 18px;
  place-content: center;
  text-align: center;
}

.visual-state-stage > div.current {
  background: #172033;
  border-color: #172033;
  color: #fff;
  box-shadow: 8px 8px 0 #d8ff61;
}

.visual-state-stage > i {
  color: #5069df;
  font-size: 1.6rem;
  font-style: normal;
}

.visual-state-stage b {
  display: block;
  margin-top: 8px;
}

.visual-playground-stage {
  display: grid;
  gap: 18px;
  grid-template-columns: minmax(150px, .65fr) 1.35fr;
}

.playground-controls {
  align-content: start;
  display: grid;
  gap: 8px;
}

.playground-controls button {
  background: #fff;
  border: 1px solid #ccd3df;
  border-radius: 5px;
  color: #516079;
  padding: 9px 11px;
  text-align: left;
}

.playground-controls button.active {
  background: #edf2ff;
  border-color: #4d69df;
  color: #304dbb;
  font-weight: 800;
}

.playground-preview {
  align-content: center;
  background: #fff;
  border: 1px solid #d8dde7;
  border-radius: 8px;
  display: grid;
  min-height: 180px;
  overflow: hidden;
  padding: 28px;
  position: relative;
}

.playground-preview strong {
  font-size: 1.5rem;
  line-height: 1.3;
  margin-top: 10px;
}

.playground-preview i {
  background: linear-gradient(90deg, #526ce5, #7cdcbc);
  bottom: 0;
  height: 6px;
  left: 0;
  position: absolute;
  transition: width .35s ease;
}

.visual-controls {
  align-items: center;
  border-top: 1px solid #e0e4ed;
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  padding: 12px 18px;
}

.visual-controls button {
  background: #fff;
  border: 1px solid #ccd3df;
  border-radius: 4px;
  color: #4e5b72;
  font-size: .75rem;
  font-weight: 800;
  padding: 7px 10px;
}

.visual-controls button.play {
  background: #172033;
  border-color: #172033;
  color: #fff;
}

.visual-observation {
  background: #f0f3f9;
  border-top: 1px solid #e0e4ed;
  min-height: 106px;
  padding: 16px 20px;
}

.visual-observation p,
.visual-caption {
  color: #4d596f;
  font-size: .85rem;
  line-height: 1.7;
  margin: 7px 0 0;
}

.visual-caption {
  border-top: 1px dashed #d8dde7;
  margin: 0;
  padding: 13px 20px;
}

.visual-notes {
  background: #fff;
  border-top: 1px solid #e0e4ed;
  margin: 0;
  padding: 13px 22px 13px 42px;
}

.visual-notes li {
  color: #576379;
  font-size: .78rem;
  margin: 4px 0;
}

.visual-image {
  margin: 0;
}

.visual-image img {
  aspect-ratio: 3 / 2;
  display: block;
  height: auto;
  object-fit: cover;
  width: 100%;
}

.visual-image figcaption {
  color: #4e5a70;
  font-size: .82rem;
  line-height: 1.7;
  padding: 14px 20px;
}

.visual-image figcaption small {
  color: #778198;
  display: block;
  margin-top: 4px;
}

.visual-swap-enter-active,
.visual-swap-leave-active {
  transition: opacity .16s ease, transform .16s ease;
}

.visual-swap-enter-from {
  opacity: 0;
  transform: translateY(6px);
}

.visual-swap-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

@media (max-width: 720px) {
  .visual-lab-heading,
  .visual-card-heading,
  .visual-playground-stage {
    grid-template-columns: 1fr;
  }

  .visual-flow-stage {
    justify-content: flex-start;
  }

  .visual-state-stage {
    grid-template-columns: 1fr;
  }

  .visual-state-stage > i {
    transform: rotate(90deg);
    text-align: center;
  }

  .tensor-grid {
    --cells: 2 !important;
  }
}

@media (prefers-reduced-motion: reduce) {
  .visual-card *,
  .visual-card *::before,
  .visual-card *::after {
    animation: none !important;
    scroll-behavior: auto !important;
    transition: none !important;
  }
}
</style>
