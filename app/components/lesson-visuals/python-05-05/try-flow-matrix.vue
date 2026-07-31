<script setup lang="ts">
import type { GuideVisual } from '~/data/guide-types'

const props = defineProps<{ visual: GuideVisual }>()
const scenario = ref(0)

const paths = [
  { cells: ['try', 'else', 'finally', '继续执行'], result: '正常结果' },
  { cells: ['try 抛错', 'except', 'finally', '继续执行'], result: '异常已处理' },
  { cells: ['try return', '跳过 else', 'finally', '执行 return'], result: '非局部跳转' },
  { cells: ['try 抛错', '未匹配', 'finally', '向外传播'], result: '异常继续传播' }
]

const current = computed(() => paths[scenario.value])
</script>

<template>
  <div class="matrix-demo">
    <div class="matrix-tabs" aria-label="try 控制流场景">
      <button
        v-for="(step, index) in props.visual.steps"
        :key="step.label"
        :class="{ active: scenario === index }"
        @click="scenario = index"
      >{{ step.label }}</button>
    </div>

    <div class="path-view" aria-live="polite">
      <template v-for="(cell, index) in current.cells" :key="`${scenario}-${cell}`">
        <div :class="{ final: cell === 'finally' }">
          <span>{{ String(index + 1).padStart(2, '0') }}</span>
          <b>{{ cell }}</b>
        </div>
        <i v-if="index < current.cells.length - 1" aria-hidden="true">→</i>
      </template>
    </div>

    <div class="matrix-result">
      <span>完成原因</span>
      <strong>{{ current.result }}</strong>
      <p>{{ props.visual.steps[scenario]?.detail }}</p>
    </div>

    <div class="matrix-controls">
      <button @click="scenario = (scenario + paths.length - 1) % paths.length">上一种</button>
      <button class="primary" @click="scenario = (scenario + 1) % paths.length">下一种</button>
      <button @click="scenario = 0">重置</button>
    </div>

    <p class="matrix-caption">{{ props.visual.caption }}</p>
  </div>
</template>

<style scoped>
.matrix-demo {
  background: #f7f9fd;
  padding: 22px;
}

.matrix-tabs,
.matrix-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
}

.matrix-tabs button,
.matrix-controls button {
  background: #fff;
  border: 1px solid #cbd3e1;
  border-radius: 4px;
  color: #4b5870;
  font-weight: 750;
  padding: 8px 10px;
}

.matrix-tabs button.active,
.matrix-controls button.primary {
  background: #172033;
  border-color: #172033;
  color: #fff;
}

.path-view {
  align-items: center;
  display: flex;
  justify-content: center;
  margin: 24px 0;
  overflow-x: auto;
  padding: 7px 0;
}

.path-view div {
  background: #fff;
  border: 1px solid #ccd4e2;
  border-radius: 7px;
  flex: 0 0 118px;
  min-height: 88px;
  padding: 13px 10px;
  text-align: center;
}

.path-view div.final {
  background: #172033;
  border-color: #172033;
  box-shadow: 4px 4px 0 #d8ff61;
  color: #fff;
}

.path-view span {
  color: #8490a6;
  display: block;
  font: .65rem 'DM Mono', monospace;
}

.path-view b {
  display: block;
  font-size: .78rem;
  line-height: 1.4;
  margin-top: 9px;
}

.path-view i {
  color: #6278df;
  flex: 0 0 auto;
  font-style: normal;
  padding: 0 7px;
}

.matrix-result {
  background: #edf2ff;
  border-left: 4px solid #526ce5;
  border-radius: 4px;
  padding: 13px 15px;
}

.matrix-result span {
  color: #65728a;
  font: .66rem 'DM Mono', monospace;
}

.matrix-result strong {
  display: block;
  margin: 4px 0;
}

.matrix-result p,
.matrix-caption {
  color: #4d5a70;
  line-height: 1.65;
  margin: 0;
}

.matrix-controls {
  margin-top: 12px;
}

.matrix-caption {
  border-top: 1px dashed #d3dae7;
  font-size: .8rem;
  margin-top: 15px;
  padding-top: 13px;
}

@media (max-width: 620px) {
  .path-view {
    justify-content: flex-start;
  }
}

@media (prefers-reduced-motion: reduce) {
  .matrix-demo * {
    transition: none !important;
  }
}
</style>
