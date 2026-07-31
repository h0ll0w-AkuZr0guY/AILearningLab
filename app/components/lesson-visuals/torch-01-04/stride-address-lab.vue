<script setup lang="ts">
import type { GuideVisual } from '~/data/guide-types'

defineProps<{ visual: GuideVisual }>()

type Layout = 'contiguous' | 'transpose' | 'slice' | 'channels'

const layout = ref<Layout>('contiguous')
const selected = ref<[number, number]>([0, 0])

const layouts = {
  contiguous: { label: 'row-major contiguous', shape: [2, 3], stride: [3, 1], offset: 0 },
  transpose: { label: 'transpose(0, 1)', shape: [3, 2], stride: [1, 3], offset: 0 },
  slice: { label: 'x[:, ::2]', shape: [2, 2], stride: [3, 2], offset: 0 },
  channels: { label: 'channels_last 观察', shape: [2, 3], stride: [1, 2], offset: 0 }
} as const

const current = computed(() => layouts[layout.value])
const cells = computed(() => Array.from(
  { length: current.value.shape[0] * current.value.shape[1] },
  (_, index) => {
    const row = Math.floor(index / current.value.shape[1])
    const column = index % current.value.shape[1]
    return {
      row,
      column,
      address: current.value.offset
        + row * current.value.stride[0]
        + column * current.value.stride[1]
    }
  }
))

const selectedAddress = computed(() =>
  current.value.offset
  + selected.value[0] * current.value.stride[0]
  + selected.value[1] * current.value.stride[1]
)

const chooseLayout = (next: Layout) => {
  layout.value = next
  selected.value = [0, 0]
}
</script>

<template>
  <section class="stride-lab" aria-label="PyTorch stride 地址计算实验">
    <nav aria-label="选择张量布局">
      <button v-for="(item, key) in layouts" :key="key" :class="{ active: layout === key }" @click="chooseLayout(key as Layout)">
        <span>{{ item.label }}</span><small>shape={{ item.shape }} · stride={{ item.stride }}</small>
      </button>
    </nav>

    <div class="stride-stage">
      <section class="logical-view">
        <header><span>LOGICAL TENSOR</span><b>{{ current.label }}</b></header>
        <div class="logical-grid" :style="{ '--columns': String(current.shape[1]) }">
          <button
            v-for="cell in cells"
            :key="`${cell.row}-${cell.column}`"
            :class="{ active: selected[0] === cell.row && selected[1] === cell.column }"
            @click="selected = [cell.row, cell.column]"
          >
            <small>[{{ cell.row }}, {{ cell.column }}]</small>
            <b>{{ cell.address }}</b>
          </button>
        </div>
      </section>

      <section class="address-math">
        <span>ADDRESS EQUATION</span>
        <code>offset + i₀ × stride₀ + i₁ × stride₁</code>
        <strong>{{ current.offset }} + {{ selected[0] }} × {{ current.stride[0] }} + {{ selected[1] }} × {{ current.stride[1] }} = {{ selectedAddress }}</strong>
        <p>格子中的数字是 Storage 元素序号。切换布局后，逻辑邻居可能跳到不同的物理位置，但底层 Storage 没有因此移动。</p>
      </section>

      <section class="storage-strip">
        <header><span>PHYSICAL STORAGE</span><b>element offsets</b></header>
        <div>
          <i
            v-for="address in 6"
            :key="address - 1"
            :class="{ active: selectedAddress === address - 1, used: cells.some(cell => cell.address === address - 1) }"
          >{{ address - 1 }}</i>
        </div>
        <small>{{ layout === 'slice' ? '灰色位置是该 view 的地址洞' : '相同 Storage，不同 sizes / strides 解释' }}</small>
      </section>
    </div>

    <footer>
      <span>当前合同</span>
      <p>{{ layout === 'contiguous'
        ? '最后一维 stride=1，按行连续访问。'
        : layout === 'transpose'
          ? 'sizes 与 strides 同步置换，逻辑转置没有复制字节。'
          : layout === 'slice'
            ? '步长切片放大 stride，view 跳过 Storage 中的地址。'
            : '连续性依赖 memory_format；同一 strided layout 可以有不同连续顺序。' }}</p>
    </footer>
  </section>
</template>

<style scoped>
.stride-lab { background: #111a2a; color: #dce7f7; }
.stride-lab > nav { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1px; border-bottom: 1px solid #344158; background: #344158; }
.stride-lab > nav button { display: grid; gap: 2px; padding: 10px; border: 0; background: #1d283b; color: #aebbd0; text-align: left; }
.stride-lab > nav button.active { background: #2c6b57; color: #fff; }
.stride-lab > nav span { font-size: .62rem; font-weight: 800; }
.stride-lab > nav small { color: #8290a8; font: .49rem 'DM Mono', monospace; }
.stride-lab > nav button.active small { color: #bfe9d8; }
.stride-stage { display: grid; grid-template-columns: 1fr .88fr; gap: 12px; padding: 18px; }
.stride-stage > section { min-width: 0; padding: 15px; border: 1px solid #344158; border-radius: 8px; background: #172235; }
.logical-view { grid-row: 1 / 3; }
.stride-stage header { display: flex; justify-content: space-between; gap: 9px; }
.stride-stage header span,
.address-math > span,
.stride-lab footer > span { color: #8190aa; font: .52rem 'DM Mono', monospace; letter-spacing: .08em; }
.stride-stage header b { color: #dce7f7; font-size: .62rem; }
.logical-grid { display: grid; grid-template-columns: repeat(var(--columns), 1fr); gap: 7px; margin-top: 18px; }
.logical-grid button { aspect-ratio: 1.35; padding: 6px; border: 1px solid #40506a; border-radius: 5px; background: #202d43; color: #d4deed; }
.logical-grid button.active { border-color: #d8ff61; background: #2d765f; box-shadow: 0 0 0 3px #d8ff6117; }
.logical-grid small { display: block; color: #8090a8; font: .5rem 'DM Mono', monospace; }
.logical-grid b { display: block; margin-top: 6px; font: 1rem 'DM Mono', monospace; }
.address-math { display: grid; align-content: center; }
.address-math code { margin-top: 9px; color: #8e9eb8; font-size: .56rem; }
.address-math strong { margin-top: 8px; color: #d8ff61; font: .78rem 'DM Mono', monospace; }
.address-math p { margin: 10px 0 0; color: #aab6c9; font-size: .6rem; line-height: 1.6; }
.storage-strip > div { display: grid; grid-template-columns: repeat(6, 1fr); gap: 5px; margin-top: 14px; }
.storage-strip i { display: grid; aspect-ratio: 1; place-items: center; border: 1px solid #3d4b63; border-radius: 4px; color: #64738d; font: normal .62rem 'DM Mono', monospace; }
.storage-strip i.used { background: #253c42; color: #9ccdbb; }
.storage-strip i.active { border-color: #d8ff61; background: #d8ff61; color: #172033; transform: translateY(-3px); }
.storage-strip > small { display: block; margin-top: 10px; color: #8190a8; font-size: .54rem; }
.stride-lab footer { display: grid; grid-template-columns: 90px 1fr; align-items: center; padding: 13px 18px; border-top: 1px solid #344158; background: #151f31; }
.stride-lab footer p { margin: 0; color: #b2bfd2; font-size: .65rem; }
@media (max-width: 720px) {
  .stride-lab > nav { grid-template-columns: 1fr 1fr; }
  .stride-stage { grid-template-columns: 1fr; }
  .logical-view { grid-row: auto; }
}
@media (prefers-reduced-motion: reduce) {
  .stride-lab * { transition: none !important; }
}
</style>
