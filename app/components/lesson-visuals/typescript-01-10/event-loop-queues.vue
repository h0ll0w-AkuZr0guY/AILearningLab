<script setup lang="ts">
import type { GuideVisual } from '~/data/guide-types'

defineProps<{ visual: GuideVisual }>()

type Phase = 'task' | 'microtask' | 'render' | 'idle'

const taskQueue = ref(['click handler'])
const microtaskQueue = ref(['Promise.then', 'queueMicrotask'])
const renderRequested = ref(true)
const phase = ref<Phase>('idle')
const log = ref<string[]>([])
const running = ref(false)
const codeMode = ref<'ts' | 'js'>('ts')
let stopRequested = false

const snippets = {
  ts: `const button = document.querySelector<HTMLButtonElement>("#run")!

button.addEventListener("click", () => {
  console.log("task")
  queueMicrotask(() => console.log("microtask"))
  requestAnimationFrame(() => console.log("render"))
})`,
  js: `const button = document.querySelector("#run")

button.addEventListener("click", () => {
  console.log("task")
  queueMicrotask(() => console.log("microtask"))
  requestAnimationFrame(() => console.log("render"))
})`
}

const reset = () => {
  stopRequested = true
  running.value = false
  taskQueue.value = ['click handler']
  microtaskQueue.value = ['Promise.then', 'queueMicrotask']
  renderRequested.value = true
  phase.value = 'idle'
  log.value = []
}

const addMicrotask = () => {
  microtaskQueue.value.push(`microtask ${microtaskQueue.value.length + 1}`)
}

const addTask = () => {
  taskQueue.value.push(`timer task ${taskQueue.value.length + 1}`)
}

const requestRender = () => {
  renderRequested.value = true
}

const step = () => {
  if (taskQueue.value.length) {
    phase.value = 'task'
    log.value.push(`执行 task：${taskQueue.value.shift()}`)
    return true
  }
  if (microtaskQueue.value.length) {
    phase.value = 'microtask'
    log.value.push(`清空 microtask：${microtaskQueue.value.shift()}`)
    return true
  }
  if (renderRequested.value) {
    phase.value = 'render'
    renderRequested.value = false
    log.value.push('浏览器获得渲染机会')
    return true
  }
  phase.value = 'idle'
  log.value.push('本轮没有待处理工作')
  return false
}

const runTurn = async () => {
  if (running.value) {
    stopRequested = true
    running.value = false
    return
  }
  stopRequested = false
  running.value = true
  while (!stopRequested && step()) {
    await new Promise(resolve => window.setTimeout(resolve, 520))
  }
  running.value = false
}

onBeforeUnmount(() => {
  stopRequested = true
})
</script>

<template>
  <section class="event-loop-demo" aria-label="HTML event loop 队列实验">
    <div class="event-toolbar">
      <button @click="addTask">加入 task</button>
      <button @click="addMicrotask">加入 microtask</button>
      <button @click="requestRender">请求渲染</button>
      <button class="step" @click="step">单步执行</button>
      <button class="run" @click="runTurn">{{ running ? '暂停' : '运行整轮' }}</button>
      <button @click="reset">重置</button>
    </div>

    <div class="event-stage">
      <section :class="{ active: phase === 'task' }">
        <header><span>01</span><b>Task queue</b></header>
        <div v-if="taskQueue.length" class="queue-items">
          <i v-for="item in taskQueue" :key="item">{{ item }}</i>
        </div>
        <small v-else>empty</small>
      </section>
      <i class="stage-arrow" aria-hidden="true">→</i>
      <section :class="{ active: phase === 'microtask' }">
        <header><span>02</span><b>Microtask checkpoint</b></header>
        <div v-if="microtaskQueue.length" class="queue-items">
          <i v-for="item in microtaskQueue" :key="item">{{ item }}</i>
        </div>
        <small v-else>empty</small>
      </section>
      <i class="stage-arrow" aria-hidden="true">→</i>
      <section :class="{ active: phase === 'render' }">
        <header><span>03</span><b>Render opportunity</b></header>
        <div class="browser-frame" :class="{ ready: renderRequested }">
          <i /><i /><i />
          <strong>{{ renderRequested ? '待绘制' : '已提交' }}</strong>
        </div>
      </section>
    </div>

    <div class="event-evidence">
      <div class="event-log" aria-live="polite">
        <span>执行日志</span>
        <ol v-if="log.length">
          <li v-for="(entry, index) in log" :key="`${index}-${entry}`">{{ entry }}</li>
        </ol>
        <p v-else>先单步执行，观察 task、microtask checkpoint 与渲染机会的顺序。</p>
      </div>
      <div class="event-code">
        <nav aria-label="切换示例语言">
          <button :class="{ active: codeMode === 'ts' }" @click="codeMode = 'ts'">TS</button>
          <button :class="{ active: codeMode === 'js' }" @click="codeMode = 'js'">JS</button>
        </nav>
        <pre><code>{{ snippets[codeMode] }}</code></pre>
      </div>
    </div>

    <p class="event-caption">{{ visual.caption }}</p>
  </section>
</template>

<style scoped>
.event-loop-demo {
  background: #f7f9fd;
}

.event-toolbar {
  border-bottom: 1px solid #dce1eb;
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  padding: 13px 18px;
}

.event-toolbar button,
.event-code nav button {
  background: #fff;
  border: 1px solid #cbd3df;
  border-radius: 4px;
  color: #4e5b72;
  font-size: .72rem;
  font-weight: 800;
  padding: 7px 10px;
}

.event-toolbar .step {
  border-color: #526ce5;
  color: #3e56c8;
  margin-left: auto;
}

.event-toolbar .run {
  background: #172033;
  border-color: #172033;
  color: #fff;
}

.event-stage {
  align-items: stretch;
  display: grid;
  gap: 8px;
  grid-template-columns: 1fr auto 1fr auto 1fr;
  padding: 22px 18px;
}

.event-stage > section {
  background: #fff;
  border: 1px solid #d6dce7;
  border-radius: 7px;
  min-height: 154px;
  padding: 13px;
  transition: border-color .2s ease, box-shadow .2s ease, transform .2s ease;
}

.event-stage > section.active {
  border-color: #526ce5;
  box-shadow: 0 0 0 3px rgba(82, 108, 229, .13);
  transform: translateY(-4px);
}

.event-stage header {
  align-items: center;
  display: flex;
  gap: 8px;
}

.event-stage header span {
  color: #8793a8;
  font: .65rem 'DM Mono', monospace;
}

.event-stage header b {
  font-size: .75rem;
}

.stage-arrow {
  align-self: center;
  color: #6476c8;
  font-style: normal;
}

.queue-items {
  display: grid;
  gap: 6px;
  margin-top: 14px;
}

.queue-items i {
  background: #eef2fb;
  border-left: 3px solid #526ce5;
  color: #4c5870;
  font: normal .65rem 'DM Mono', monospace;
  padding: 6px 7px;
}

.event-stage small {
  color: #9ba5b6;
  display: block;
  font: .7rem 'DM Mono', monospace;
  margin-top: 18px;
}

.browser-frame {
  background: #eef1f6;
  border: 1px solid #cdd5e1;
  border-radius: 5px;
  display: grid;
  gap: 4px;
  grid-template-columns: repeat(3, 8px) 1fr;
  margin-top: 15px;
  min-height: 75px;
  padding: 9px;
}

.browser-frame i {
  background: #a8b2c3;
  border-radius: 50%;
  height: 8px;
}

.browser-frame strong {
  align-self: center;
  color: #728098;
  font-size: .78rem;
  grid-column: 1 / -1;
  justify-self: center;
}

.browser-frame.ready {
  background: #effbe8;
  border-color: #9fc783;
}

.event-evidence {
  border-top: 1px solid #dce1eb;
  display: grid;
  grid-template-columns: .8fr 1.2fr;
}

.event-log,
.event-code {
  min-height: 228px;
  min-width: 0;
  padding: 16px 18px;
}

.event-log {
  border-right: 1px solid #dce1eb;
}

.event-log > span {
  color: #78849a;
  font: .67rem 'DM Mono', monospace;
  letter-spacing: .08em;
}

.event-log ol {
  margin: 11px 0 0;
  padding-left: 22px;
}

.event-log li,
.event-log p {
  color: #526078;
  font-size: .74rem;
  line-height: 1.65;
}

.event-code {
  background: #151d2d;
  color: #d9e5f8;
}

.event-code nav {
  display: flex;
  justify-content: flex-end;
}

.event-code nav button {
  background: transparent;
  border-color: #3b465b;
  border-radius: 0;
  color: #9dabbe;
  padding: 4px 8px;
}

.event-code nav button.active {
  background: #526ce5;
  color: #fff;
}

.event-code pre {
  font: .66rem/1.65 'DM Mono', monospace;
  margin: 10px 0 0;
  overflow: auto;
  white-space: pre;
}

.event-caption {
  border-top: 1px solid #dce1eb;
  color: #536078;
  font-size: .8rem;
  line-height: 1.7;
  margin: 0;
  padding: 13px 18px;
}

@media (max-width: 720px) {
  .event-stage {
    grid-template-columns: 1fr;
  }

  .stage-arrow {
    transform: rotate(90deg);
    text-align: center;
  }

  .event-evidence {
    grid-template-columns: 1fr;
  }

  .event-log {
    border-bottom: 1px solid #dce1eb;
    border-right: 0;
  }

  .event-toolbar .step {
    margin-left: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .event-loop-demo * {
    transition: none !important;
  }
}
</style>
