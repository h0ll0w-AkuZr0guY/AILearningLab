<script setup lang="ts">
import type { GuideVisual } from '~/data/guide-types'

const props = defineProps<{ visual: GuideVisual }>()
const active = ref(0)

const layers = [
  { name: 'data descriptor', note: '__get__ + __set__/__delete__' },
  { name: 'instance.__dict__', note: '实例自己的同名键' },
  { name: 'non-data descriptor', note: '只有 __get__，例如函数' },
  { name: 'class attribute', note: 'MRO 中的普通类属性' }
]

const winner = computed(() => [0, 1, 2, 3][active.value])
const reset = () => { active.value = 0 }
</script>

<template>
  <div class="descriptor-demo">
    <div class="scenario-tabs" aria-label="属性查找场景">
      <button
        v-for="(step, index) in props.visual.steps"
        :key="step.label"
        :class="{ active: active === index }"
        @click="active = index"
      >
        <span>{{ String(index + 1).padStart(2, '0') }}</span>
        {{ step.label }}
      </button>
    </div>

    <div class="lookup-stack" aria-live="polite">
      <div
        v-for="(layer, index) in layers"
        :key="layer.name"
        :class="{ winner: winner === index, skipped: index < winner }"
      >
        <span>{{ index + 1 }}</span>
        <p><b>{{ layer.name }}</b><small>{{ layer.note }}</small></p>
        <strong>{{ winner === index ? '命中并返回' : index < winner ? '本场景不成立' : '无需继续' }}</strong>
      </div>
    </div>

    <div class="descriptor-result">
      <span>当前结论</span>
      <p>{{ props.visual.steps[active]?.detail }}</p>
      <button @click="reset">重置为 data descriptor</button>
    </div>

    <p class="descriptor-caption">{{ props.visual.caption }}</p>
  </div>
</template>

<style scoped>
.descriptor-demo {
  background: #f7f9fd;
  padding: 22px;
}

.scenario-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 18px;
}

.scenario-tabs button {
  background: #fff;
  border: 1px solid #cad2e2;
  border-radius: 5px;
  color: #4c5970;
  font-weight: 750;
  padding: 8px 11px;
}

.scenario-tabs button span {
  color: #8792a8;
  font: .64rem 'DM Mono', monospace;
  margin-right: 5px;
}

.scenario-tabs button.active {
  background: #172033;
  border-color: #172033;
  color: #fff;
}

.lookup-stack {
  display: grid;
  gap: 8px;
}

.lookup-stack > div {
  align-items: center;
  background: #fff;
  border: 1px solid #d8deea;
  border-radius: 7px;
  display: grid;
  gap: 12px;
  grid-template-columns: 28px 1fr auto;
  padding: 11px 13px;
}

.lookup-stack > div > span {
  color: #7b879c;
  font: .72rem 'DM Mono', monospace;
}

.lookup-stack p {
  margin: 0;
}

.lookup-stack b,
.lookup-stack small {
  display: block;
}

.lookup-stack small {
  color: #7a8598;
  margin-top: 2px;
}

.lookup-stack strong {
  color: #9aa4b5;
  font-size: .75rem;
}

.lookup-stack .winner {
  background: #172033;
  border-color: #172033;
  box-shadow: 5px 5px 0 #d8ff61;
  color: #fff;
}

.lookup-stack .winner small,
.lookup-stack .winner > span {
  color: #b6c2d8;
}

.lookup-stack .winner strong {
  color: #d8ff61;
}

.lookup-stack .skipped {
  opacity: .5;
}

.descriptor-result {
  align-items: start;
  display: grid;
  gap: 7px;
  grid-template-columns: 1fr auto;
  margin-top: 18px;
}

.descriptor-result span,
.descriptor-result p {
  grid-column: 1;
}

.descriptor-result span {
  color: #6c7890;
  font: .68rem 'DM Mono', monospace;
}

.descriptor-result p,
.descriptor-caption {
  color: #4e5b70;
  line-height: 1.65;
  margin: 0;
}

.descriptor-result button {
  background: #fff;
  border: 1px solid #c8d0df;
  border-radius: 4px;
  grid-column: 2;
  grid-row: 1 / 3;
  padding: 8px 10px;
}

.descriptor-caption {
  border-top: 1px dashed #d6dce8;
  font-size: .8rem;
  margin-top: 17px;
  padding-top: 13px;
}

@media (max-width: 620px) {
  .lookup-stack > div {
    grid-template-columns: 24px 1fr;
  }

  .lookup-stack strong {
    grid-column: 2;
  }

  .descriptor-result {
    grid-template-columns: 1fr;
  }

  .descriptor-result button {
    grid-column: 1;
    grid-row: auto;
    justify-self: start;
  }
}

@media (prefers-reduced-motion: reduce) {
  .descriptor-demo * {
    transition: none !important;
  }
}
</style>
