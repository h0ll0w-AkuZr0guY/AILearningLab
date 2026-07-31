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

const compactGraphLabel = (label: string) =>
  label.length > 10 ? `${label.slice(0, 9)}…` : label

const visualAccent = (kind: GuideVisual['kind']) => ({
  flow: '#526ce5',
  graph: '#8157d9',
  tensor: '#26a77c',
  playground: '#e27b3f',
  state: '#307dc2',
  image: '#64748b'
}[kind] || '#526ce5')

const progress = (visual: GuideVisual) =>
  `${((activeIndex(visual) + 1) / Math.max(1, visual.steps.length)) * 100}%`

const previousStep = (visual: GuideVisual) =>
  visual.steps[Math.max(0, activeIndex(visual) - 1)]

const nextStep = (visual: GuideVisual) =>
  visual.steps[Math.min(visual.steps.length - 1, activeIndex(visual) + 1)]

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
      :style="{ '--visual-accent': visualAccent(visual.kind) }"
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
          <div class="flow-rail">
            <template v-for="(step, index) in visual.steps" :key="`${visual.id}-${step.label}`">
              <button
                :class="{ active: activeIndex(visual) === index, done: activeIndex(visual) > index }"
                @click="setActive(visual, index)"
              >
                <span>{{ String(index + 1).padStart(2, '0') }}</span>
                <b>{{ step.label }}</b>
                <small>{{ activeIndex(visual) > index ? 'DONE' : activeIndex(visual) === index ? 'ACTIVE' : 'WAIT' }}</small>
              </button>
              <i v-if="index < visual.steps.length - 1" aria-hidden="true"><em /></i>
            </template>
          </div>
          <aside class="flow-console">
            <span>PIPELINE TRACE · {{ String(activeIndex(visual) + 1).padStart(2, '0') }}</span>
            <h4>{{ visual.steps[activeIndex(visual)]?.label }}</h4>
            <p>{{ visual.steps[activeIndex(visual)]?.detail }}</p>
            <div><i :style="{ width: progress(visual) }" /></div>
          </aside>
        </div>

        <div v-else-if="visual.kind === 'graph'" class="visual-graph-stage">
          <div class="graph-canvas">
            <span class="graph-coordinate">NODE GRAPH · {{ visual.steps.length }} NODES</span>
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
                <title>{{ step.detail }}</title>
                <circle class="node-halo" r="43" />
                <circle r="31" />
                <text text-anchor="middle" dominant-baseline="middle">{{ index + 1 }}</text>
                <text class="graph-label" text-anchor="middle" y="51">{{ compactGraphLabel(step.label) }}</text>
              </g>
            </svg>
          </div>
          <aside class="graph-inspector">
            <span>ACTIVE NODE</span>
            <b>{{ visual.steps[activeIndex(visual)]?.label }}</b>
            <p>{{ visual.steps[activeIndex(visual)]?.detail }}</p>
            <dl>
              <div><dt>前驱</dt><dd>{{ previousStep(visual)?.label }}</dd></div>
              <div><dt>后继</dt><dd>{{ nextStep(visual)?.label }}</dd></div>
            </dl>
          </aside>
        </div>

        <div v-else-if="visual.kind === 'tensor'" class="visual-tensor-stage">
          <div class="tensor-board">
            <div class="tensor-axis"><span>MEMORY / SHAPE PROBE</span><b>{{ activeIndex(visual) + 1 }} × {{ visual.steps.length }}</b></div>
            <div class="tensor-grid" :style="{ '--cells': String(Math.min(4, visual.steps.length)) }">
              <button
                v-for="(step, index) in visual.steps"
                :key="step.label"
                :class="{ active: activeIndex(visual) === index, done: activeIndex(visual) > index }"
                @click="setActive(visual, index)"
              >
                <span>[{{ index }}]</span>
                <b>{{ step.label }}</b>
                <i v-for="cell in 6" :key="cell" :style="{ '--delay': String(cell) }" />
              </button>
            </div>
          </div>
          <div class="tensor-readout">
            <span>ACTIVE TRANSFORM</span>
            <strong>{{ visual.steps[activeIndex(visual)]?.label }}</strong>
            <p>{{ visual.steps[activeIndex(visual)]?.detail }}</p>
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
            <span>LIVE RUNTIME PREVIEW</span>
            <Transition name="visual-swap" mode="out-in">
              <strong :key="activeIndex(visual)">{{ visual.steps[activeIndex(visual)]?.label }}</strong>
            </Transition>
            <p>{{ visual.steps[activeIndex(visual)]?.detail }}</p>
            <div class="playground-signals">
              <span>INPUT <b>{{ previousStep(visual)?.label }}</b></span>
              <span>EFFECT <b>{{ visual.steps[activeIndex(visual)]?.label }}</b></span>
              <span>NEXT <b>{{ nextStep(visual)?.label }}</b></span>
            </div>
            <i :style="{ width: `${((activeIndex(visual) + 1) / visual.steps.length) * 100}%` }" />
          </div>
        </div>

        <div v-else class="visual-state-stage">
          <div class="state-timeline">
            <button
              v-for="(step, index) in visual.steps"
              :key="step.label"
              :class="{ active: activeIndex(visual) === index, done: activeIndex(visual) > index }"
              @click="setActive(visual, index)"
            ><i />{{ step.label }}</button>
          </div>
          <div class="state-comparison">
            <div>
              <span>前一状态</span>
              <b>{{ previousStep(visual)?.label }}</b>
            </div>
            <i aria-hidden="true">→</i>
            <div class="current">
              <span>当前状态</span>
              <Transition name="visual-swap" mode="out-in">
                <b :key="activeIndex(visual)">{{ visual.steps[activeIndex(visual)]?.label }}</b>
              </Transition>
              <p>{{ visual.steps[activeIndex(visual)]?.detail }}</p>
            </div>
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
  position: relative;
}

.visual-card::before {
  background: var(--visual-accent);
  content: '';
  height: 3px;
  left: 0;
  position: absolute;
  right: 0;
  top: 0;
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
  align-items: stretch;
  display: grid;
  gap: 18px;
  grid-template-columns: minmax(0, 1fr) 230px;
}

.flow-rail {
  align-items: center;
  display: flex;
  justify-content: center;
  min-width: max-content;
  overflow-x: auto;
  padding: 8px;
}

.flow-rail button {
  background: #fff;
  border: 1px solid #cbd2df;
  border-radius: 7px;
  color: #3d4960;
  flex: 0 0 112px;
  min-height: 92px;
  padding: 12px 8px;
  position: relative;
  transition: border-color .2s ease, background .2s ease, transform .2s ease;
}

.flow-rail button span {
  color: #7f8aa0;
  display: block;
  font: .65rem 'DM Mono', monospace;
}

.flow-rail button b {
  display: block;
  font-size: .78rem;
  line-height: 1.4;
  margin-top: 7px;
  overflow-wrap: anywhere;
}

.flow-rail button small {
  bottom: 6px;
  color: #9aa4b5;
  display: block;
  font: .48rem 'DM Mono', monospace;
  left: 0;
  position: absolute;
  right: 0;
}

.flow-rail button.active,
.tensor-grid button.active {
  background: #172033;
  border-color: #172033;
  color: #fff;
  transform: translateY(-4px);
}

.flow-rail button.done,
.tensor-grid button.done {
  background: #edf8f2;
  border-color: #9ed7bc;
}

.flow-rail > i {
  display: block;
  height: 1px;
  padding: 0;
  position: relative;
  width: 18px;
  background: #b9c3d4;
}

.flow-rail > i::after {
  border-bottom: 3px solid transparent;
  border-left: 5px solid #8996ac;
  border-top: 3px solid transparent;
  content: '';
  position: absolute;
  right: -1px;
  top: -3px;
}

.flow-rail > i em {
  animation: flow-pulse 1.8s ease-in-out infinite;
  background: var(--visual-accent);
  border-radius: 50%;
  height: 6px;
  left: 0;
  position: absolute;
  top: -3px;
  width: 6px;
}

@keyframes flow-pulse {
  0%, 100% { opacity: .25; transform: translateX(0); }
  50% { opacity: 1; transform: translateX(12px); }
}

.flow-console {
  align-content: center;
  background: #151f32;
  border-radius: 9px;
  color: #fff;
  display: grid;
  padding: 18px;
}

.flow-console > span,
.graph-inspector > span,
.tensor-readout > span {
  color: #91a0bb;
  font: .55rem 'DM Mono', monospace;
  letter-spacing: .08em;
}

.flow-console h4 {
  font-size: 1rem;
  line-height: 1.35;
  margin: 8px 0;
}

.flow-console p,
.graph-inspector p,
.tensor-readout p {
  color: #b4bfd2;
  font-size: .68rem;
  line-height: 1.65;
  margin: 0;
}

.flow-console > div {
  background: #2a3650;
  border-radius: 3px;
  height: 5px;
  margin-top: 17px;
  overflow: hidden;
}

.flow-console > div i {
  background: linear-gradient(90deg, var(--visual-accent), #d8ff61);
  display: block;
  height: 100%;
  transition: width .3s ease;
}

.visual-flow-stage > i {
  color: #7c89a4;
  font-style: normal;
  padding: 0 6px;
}

.visual-graph-stage {
  background-image: radial-gradient(#d6dce8 1px, transparent 1px);
  background-size: 18px 18px;
  display: grid;
  gap: 12px;
  grid-template-columns: minmax(0, 1fr) 210px;
  padding: 13px;
}

.graph-canvas {
  min-width: 0;
  position: relative;
}

.graph-coordinate {
  left: 10px;
  color: #8b96a9;
  font: .52rem 'DM Mono', monospace;
  position: absolute;
  top: 8px;
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

.graph-node .node-halo {
  fill: transparent;
  opacity: 0;
  stroke: var(--visual-accent);
  stroke-dasharray: 3 5;
  stroke-width: 1;
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

.graph-node.active .node-halo {
  animation: node-orbit 5s linear infinite;
  opacity: .65;
  transform-origin: center;
}

@keyframes node-orbit {
  to { transform: rotate(360deg); }
}

.graph-node.active text {
  fill: #fff;
}

.graph-node.active .graph-label {
  fill: #172033;
}

.graph-inspector {
  align-content: center;
  background: #fff;
  border: 1px solid #d7deea;
  border-radius: 9px;
  display: grid;
  padding: 16px;
}

.graph-inspector > b {
  font-size: .9rem;
  margin: 8px 0;
}

.graph-inspector p {
  color: #667289;
}

.graph-inspector dl {
  display: grid;
  gap: 6px;
  margin: 15px 0 0;
}

.graph-inspector dl div {
  border-left: 2px solid var(--visual-accent);
  background: #f3f5fa;
  padding: 7px 9px;
}

.graph-inspector dt { color: #919bad; font-size: .52rem; }
.graph-inspector dd { font-size: .62rem; font-weight: 800; margin: 1px 0 0; }

.visual-tensor-stage {
  background: #151d2d;
  color: #dce6f8;
  display: grid;
  gap: 18px;
  grid-template-columns: minmax(0, 1fr) 230px;
}

.tensor-board {
  min-width: 0;
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
  grid-template-columns: repeat(3, 1fr);
}

.tensor-grid button span {
  color: #71809c;
  font: .65rem 'DM Mono', monospace;
}

.tensor-grid button b {
  font-size: .72rem;
  line-height: 1.35;
  overflow-wrap: anywhere;
  grid-column: 1 / -1;
}

.tensor-grid button i {
  background: #43516b;
  border-radius: 2px;
  height: 8px;
  opacity: .55;
  width: 100%;
}

.tensor-grid button.active i {
  animation: tensor-cell .65s ease both;
  animation-delay: calc(var(--delay) * 35ms);
  background: #d8ff61;
}

@keyframes tensor-cell {
  from { opacity: .2; transform: scale(.65); }
  to { opacity: 1; transform: scale(1); }
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

.tensor-readout {
  align-content: center;
  border: 1px solid #3a4761;
  border-radius: 8px;
  display: grid;
  padding: 18px;
}

.tensor-readout strong {
  color: #fff;
  font-size: 1rem;
  line-height: 1.35;
  margin: 9px 0;
}

.visual-state-stage {
  display: block;
}

.state-timeline {
  align-items: center;
  display: flex;
  gap: 0;
  overflow-x: auto;
  padding: 2px 3px 18px;
}

.state-timeline button {
  align-items: center;
  background: transparent;
  border: 0;
  color: #8b96a9;
  display: flex;
  flex: 1 0 105px;
  font-size: .62rem;
  gap: 7px;
  padding: 0;
  position: relative;
  text-align: left;
}

.state-timeline button::after {
  background: #cad1de;
  content: '';
  height: 1px;
  left: 13px;
  position: absolute;
  right: -1px;
  top: 6px;
  z-index: 0;
}

.state-timeline button:last-child::after { display: none; }
.state-timeline button i {
  background: #fff;
  border: 2px solid #a9b3c4;
  border-radius: 50%;
  flex: 0 0 13px;
  height: 13px;
  position: relative;
  width: 13px;
  z-index: 1;
}
.state-timeline button.done i,
.state-timeline button.active i { background: var(--visual-accent); border-color: var(--visual-accent); }
.state-timeline button.active { color: #23314a; font-weight: 800; }

.state-comparison {
  align-items: stretch;
  display: grid;
  gap: 16px;
  grid-template-columns: 1fr auto 1.25fr;
}

.state-comparison > div {
  background: #fff;
  border: 1px solid #d5dae5;
  border-radius: 8px;
  display: grid;
  min-height: 130px;
  padding: 18px;
  place-content: center;
  text-align: center;
}

.state-comparison > div.current {
  background: #172033;
  border-color: #172033;
  color: #fff;
  box-shadow: 8px 8px 0 #d8ff61;
}

.state-comparison > i {
  color: #5069df;
  font-size: 1.6rem;
  font-style: normal;
}

.state-comparison b {
  display: block;
  margin-top: 8px;
}

.state-comparison p {
  color: #bfc9dc;
  font-size: .66rem;
  line-height: 1.55;
  margin: 10px 0 0;
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

.playground-preview > p {
  color: #66738a;
  font-size: .68rem;
  line-height: 1.65;
  margin: 8px 0 15px;
}

.playground-signals {
  display: grid;
  gap: 6px;
  grid-template-columns: repeat(3, 1fr);
}

.playground-signals span {
  background: #f2f4f8;
  border-radius: 5px;
  color: #8b95a8;
  display: grid;
  font: .48rem 'DM Mono', monospace;
  padding: 7px;
}

.playground-signals b {
  color: #40506d;
  font-size: .56rem;
  margin-top: 3px;
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
  .visual-playground-stage,
  .visual-flow-stage,
  .visual-graph-stage,
  .visual-tensor-stage {
    grid-template-columns: 1fr;
  }

  .flow-rail {
    justify-content: flex-start;
  }

  .state-comparison {
    grid-template-columns: 1fr;
  }

  .state-comparison > i {
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
