<script setup lang="ts">
import type { GuideVisual } from '~/data/guide-types'

const props = defineProps<{ visual: GuideVisual }>()
const turn = ref(0)
const running = ref(false)
let timer: ReturnType<typeof window.setInterval> | undefined

const phases = [
  {
    ready: ['call_soon(A)', 'I/O callback'],
    timers: ['timer@12ms', 'timer@40ms'],
    deferred: [],
    note: '进入 _run_once 前，ready 保存立即回调，scheduled 以截止时间排序。'
  },
  {
    ready: ['call_soon(A)', 'I/O callback', 'timer@12ms'],
    timers: ['timer@40ms'],
    deferred: [],
    note: '轮次边界只把已经到期的 timer 移入 ready；未到期项仍留在 timer heap。'
  },
  {
    ready: ['I/O callback', 'timer@12ms'],
    timers: ['timer@40ms'],
    deferred: ['A 内部安排的 B'],
    note: '本轮按进入执行阶段时的 ready 快照推进；A 新安排的 B 不插队到当前快照。'
  },
  {
    ready: ['B'],
    timers: ['timer@40ms'],
    deferred: [],
    note: '下一轮开始，上一轮产生的 B 才获得执行机会，形成可预测的轮次边界。'
  }
]

const current = computed(() => phases[turn.value])

const stop = () => {
  if (timer) window.clearInterval(timer)
  timer = undefined
  running.value = false
}

const next = () => {
  turn.value = (turn.value + 1) % phases.length
  if (turn.value === 0) stop()
}

const toggle = () => {
  if (running.value) {
    stop()
    return
  }
  running.value = true
  timer = window.setInterval(next, 1500)
}

const reset = () => {
  stop()
  turn.value = 0
}

onBeforeUnmount(stop)
</script>

<template>
  <div class="loop-demo">
    <div class="turn-strip">
      <button
        v-for="(_, index) in phases"
        :key="index"
        :class="{ active: turn === index }"
        @click="turn = index"
      >轮次 {{ index + 1 }}</button>
    </div>

    <div class="queue-board" aria-live="polite">
      <section>
        <header><span>READY</span><b>FIFO deque</b></header>
        <div v-if="current.ready.length" class="queue-items">
          <i v-for="item in current.ready" :key="item">{{ item }}</i>
        </div>
        <p v-else>当前没有立即可运行回调</p>
      </section>

      <section>
        <header><span>TIMERS</span><b>min-heap</b></header>
        <div v-if="current.timers.length" class="queue-items timers">
          <i v-for="item in current.timers" :key="item">{{ item }}</i>
        </div>
        <p v-else>没有等待截止时间的 timer</p>
      </section>

      <section>
        <header><span>NEXT TURN</span><b>deferred</b></header>
        <div v-if="current.deferred.length" class="queue-items deferred">
          <i v-for="item in current.deferred" :key="item">{{ item }}</i>
        </div>
        <p v-else>尚未产生下一轮工作</p>
      </section>
    </div>

    <div class="loop-note">
      <span>观察 {{ turn + 1 }} / {{ phases.length }}</span>
      <p>{{ current.note }}</p>
    </div>

    <div class="loop-controls">
      <button @click="turn = (turn + phases.length - 1) % phases.length">上一步</button>
      <button class="primary" @click="toggle">{{ running ? '暂停' : props.visual.actionLabel }}</button>
      <button @click="next">下一步</button>
      <button @click="reset">重置</button>
    </div>

    <p class="loop-caption">{{ props.visual.caption }}</p>
  </div>
</template>

<style scoped>
.loop-demo {
  background: #151d2d;
  color: #dbe5f6;
  padding: 22px;
}

.turn-strip,
.loop-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
}

.turn-strip {
  margin-bottom: 16px;
}

.turn-strip button,
.loop-controls button {
  background: #202a40;
  border: 1px solid #3b4862;
  border-radius: 4px;
  color: #bfcbe0;
  padding: 7px 10px;
}

.turn-strip button.active,
.loop-controls button.primary {
  background: #d8ff61;
  border-color: #d8ff61;
  color: #172033;
  font-weight: 800;
}

.queue-board {
  display: grid;
  gap: 11px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.queue-board section {
  background: #1d273b;
  border: 1px solid #36445f;
  border-radius: 7px;
  min-height: 180px;
  padding: 13px;
}

.queue-board header {
  align-items: center;
  display: flex;
  justify-content: space-between;
}

.queue-board header span {
  color: #d8ff61;
  font: .68rem 'DM Mono', monospace;
}

.queue-board header b {
  color: #8290aa;
  font-size: .68rem;
}

.queue-items {
  display: grid;
  gap: 7px;
  margin-top: 14px;
}

.queue-items i {
  background: #2a3750;
  border-left: 3px solid #7189f0;
  border-radius: 3px;
  color: #e2e9f5;
  font: normal .73rem 'DM Mono', monospace;
  overflow-wrap: anywhere;
  padding: 9px;
}

.queue-items.timers i {
  border-color: #e7b65b;
}

.queue-items.deferred i {
  border-color: #6fd3ab;
}

.queue-board p {
  color: #7f8ca3;
  font-size: .76rem;
  line-height: 1.5;
  margin-top: 18px;
}

.loop-note {
  background: #202a40;
  border-radius: 5px;
  margin-top: 12px;
  padding: 13px 15px;
}

.loop-note span {
  color: #8fa0bb;
  font: .66rem 'DM Mono', monospace;
}

.loop-note p,
.loop-caption {
  color: #c7d2e4;
  line-height: 1.65;
  margin: 6px 0 0;
}

.loop-controls {
  margin-top: 12px;
}

.loop-caption {
  border-top: 1px dashed #3b4860;
  color: #8f9db4;
  font-size: .78rem;
  margin-top: 15px;
  padding-top: 13px;
}

@media (max-width: 720px) {
  .queue-board {
    grid-template-columns: 1fr;
  }

  .queue-board section {
    min-height: auto;
  }
}

@media (prefers-reduced-motion: reduce) {
  .loop-demo * {
    transition: none !important;
  }
}
</style>
