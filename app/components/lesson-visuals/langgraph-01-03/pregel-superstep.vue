<script setup lang="ts">
import type { GuideVisual } from '~/data/guide-types'

defineProps<{ visual: GuideVisual }>()

type Phase = 'plan' | 'execute' | 'barrier' | 'next'

const phase = ref<Phase>('plan')
const completed = ref<string[]>([])
const writes = computed(() => completed.value.map(node => `${node}:count + 1`))

const choosePhase = (next: Phase) => {
  phase.value = next
  if (next === 'plan') completed.value = []
  if (next === 'barrier') completed.value = ['summarize', 'classify']
}

const completeTask = (node: string) => {
  phase.value = 'execute'
  if (!completed.value.includes(node)) completed.value.push(node)
}

const reset = () => choosePhase('plan')
</script>

<template>
  <section class="pregel-lab" aria-label="Pregel super-step barrier 实验">
    <header class="pregel-toolbar">
      <button :class="{ active: phase === 'plan' }" @click="choosePhase('plan')">01 Plan</button>
      <button :class="{ active: phase === 'execute' }" @click="choosePhase('execute')">02 Execute</button>
      <button :class="{ active: phase === 'barrier' }" @click="choosePhase('barrier')">03 Update barrier</button>
      <button :class="{ active: phase === 'next' }" @click="choosePhase('next')">04 Next step</button>
      <button class="reset" @click="reset">重置</button>
    </header>

    <div class="pregel-stage">
      <section class="channel-bank">
        <span>VISIBLE CHANNEL SNAPSHOT</span>
        <div><b>messages</b><code>["分析请求"]</code></div>
        <div><b>count</b><code>{{ phase === 'next' ? 2 : 0 }}</code></div>
        <small>{{ phase === 'next' ? '下一轮已读取归并结果' : '本轮执行期间保持只读' }}</small>
      </section>

      <i class="pregel-arrow" aria-hidden="true">→</i>

      <section class="task-board">
        <span>SUPER-STEP TASKS</span>
        <button
          :class="{ done: completed.includes('summarize'), running: phase === 'execute' && !completed.includes('summarize') }"
          @click="completeTask('summarize')"
        >
          <i>Σ</i><b>summarize</b><small>{{ completed.includes('summarize') ? 'write buffered' : 'reads snapshot v7' }}</small>
        </button>
        <button
          :class="{ done: completed.includes('classify'), running: phase === 'execute' && !completed.includes('classify') }"
          @click="completeTask('classify')"
        >
          <i>λ</i><b>classify</b><small>{{ completed.includes('classify') ? 'write buffered' : 'reads snapshot v7' }}</small>
        </button>
        <p>先后点击两个任务。即使 summarize 先完成，classify 仍读 v7，不会读到兄弟任务的写入。</p>
      </section>

      <i class="pregel-arrow" aria-hidden="true">→</i>

      <section class="write-buffer" :class="{ open: phase === 'barrier' || phase === 'next' }">
        <span>TASK WRITES / BARRIER</span>
        <div v-if="writes.length">
          <code v-for="write in writes" :key="write">{{ write }}</code>
        </div>
        <small v-else>等待 task writes</small>
        <strong>{{ phase === 'barrier' ? '归并中' : phase === 'next' ? 'committed → v8' : '当前轮不可见' }}</strong>
      </section>
    </div>

    <footer>
      <div><span>当前阶段</span><b>{{ phase }}</b></div>
      <p>{{ phase === 'plan'
        ? 'Plan 根据 channel version 与 versions_seen 选择本轮任务。'
        : phase === 'execute'
          ? '任务可以并发完成，writes 暂存在各自 task 中。'
          : phase === 'barrier'
            ? '只有 barrier 统一归并 writes，才产生新的 channel version。'
            : '下一轮节点共同读取 v8，上一轮兄弟完成顺序不改变可见性。' }}</p>
    </footer>
  </section>
</template>

<style scoped>
.pregel-lab { background: #f6f8fc; }
.pregel-toolbar { display: flex; flex-wrap: wrap; gap: 7px; padding: 13px 18px; border-bottom: 1px solid #dce2ec; }
.pregel-toolbar button { padding: 7px 10px; border: 1px solid #cad3e1; border-radius: 5px; background: #fff; color: #56637a; font-size: .67rem; font-weight: 800; }
.pregel-toolbar button.active { border-color: #7458d5; background: #201b3a; color: #fff; }
.pregel-toolbar .reset { margin-left: auto; }
.pregel-stage { display: grid; grid-template-columns: .9fr auto 1.15fr auto .9fr; gap: 10px; align-items: stretch; padding: 22px 18px; }
.pregel-stage > section { min-width: 0; padding: 15px; border: 1px solid #d7deea; border-radius: 9px; background: #fff; }
.pregel-stage section > span,
.pregel-lab footer span { color: #8894a9; font: .54rem 'DM Mono', monospace; letter-spacing: .08em; }
.channel-bank div { display: grid; grid-template-columns: 70px 1fr; margin-top: 9px; padding: 8px; border-radius: 5px; background: #f1f4fa; font-size: .64rem; }
.channel-bank code { overflow: hidden; color: #556ac7; text-overflow: ellipsis; }
.channel-bank small { display: block; margin-top: 12px; color: #7d899d; font-size: .58rem; }
.task-board { display: grid; gap: 7px; }
.task-board button { display: grid; grid-template-columns: 28px 1fr; gap: 1px 8px; align-items: center; padding: 9px; border: 1px solid #d8dfeb; border-radius: 7px; background: #fbfcff; color: #3f4d66; text-align: left; }
.task-board button i { grid-row: 1 / 3; display: grid; width: 28px; height: 28px; place-items: center; border-radius: 7px; background: #e9edfb; color: #5d70c9; font-style: normal; }
.task-board button small { color: #8b96a9; font: .52rem 'DM Mono', monospace; }
.task-board button.running { border-color: #7b65d3; box-shadow: 0 0 0 3px #7359cf16; }
.task-board button.done { border-color: #6fc5a7; background: #effaf6; }
.task-board button.done i { background: #42b88f; color: #fff; }
.task-board p { margin: 5px 0 0; color: #778399; font-size: .58rem; line-height: 1.6; }
.pregel-arrow { align-self: center; color: #755bd0; font-style: normal; }
.write-buffer { display: grid; align-content: start; transition: border-color .2s ease, box-shadow .2s ease; }
.write-buffer.open { border-color: #7a60d1; box-shadow: inset 0 0 0 2px #7359cf12; }
.write-buffer > div { display: grid; gap: 6px; margin-top: 11px; }
.write-buffer code { padding: 6px; border-left: 3px solid #7458d5; background: #f0edfb; color: #514584; font-size: .57rem; }
.write-buffer small { margin-top: 18px; color: #9aa4b5; font-size: .62rem; }
.write-buffer strong { margin-top: auto; padding-top: 18px; color: #7458d5; font-size: .68rem; }
.pregel-lab footer { display: grid; grid-template-columns: 110px 1fr; gap: 15px; align-items: center; padding: 14px 18px; border-top: 1px solid #dce2ec; background: #fff; }
.pregel-lab footer div { display: grid; }
.pregel-lab footer b { color: #7458d5; font: .74rem 'DM Mono', monospace; }
.pregel-lab footer p { margin: 0; color: #59667c; font-size: .7rem; }
@media (max-width: 720px) {
  .pregel-stage { grid-template-columns: 1fr; }
  .pregel-arrow { transform: rotate(90deg); text-align: center; }
}
@media (prefers-reduced-motion: reduce) {
  .pregel-lab * { transition: none !important; }
}
</style>
