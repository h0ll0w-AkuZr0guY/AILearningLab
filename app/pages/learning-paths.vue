<script setup lang="ts">
import type { TrackId } from '~/data/curriculum'
import { tracks } from '~/data/curriculum'
import { topicGuides } from '~/data/topic-guides'

const paths: Array<{
  id: string
  label: string
  title: string
  summary: string
  outcome: string
  tracks: TrackId[]
  phases: Array<[string, string, string]>
}> = [
  {
    id: 'agent',
    label: 'Agent 框架',
    title: '从运行时协议到生产级 Agent',
    summary: '先建立 Python 与类型契约，再拆 LangChain 的组件协议、LangGraph 的持久执行，最后进入 Deep Agents 的上下文与子代理。',
    outcome: '能够从零实现带工具、状态、暂停恢复、权限与可观测能力的最小 Agent 框架。',
    tracks: ['python', 'typescript', 'langchain', 'langgraph', 'deepagents'],
    phases: [
      ['地基', 'Python + TypeScript', '对象模型、异步、类型边界和序列化合同'],
      ['组件', 'LangChain', '消息、模型、工具、Runnable 与 middleware'],
      ['运行时', 'LangGraph', 'State、Pregel、checkpoint、interrupt 与并发'],
      ['系统化', 'Deep Agents', '规划、文件系统、子代理、沙箱与治理']
    ]
  },
  {
    id: 'model',
    label: '模型与训练',
    title: '从张量语义到可控微调',
    summary: '用 Transformer 建立算法结构，用 PyTorch 追踪张量、autograd 与分布式执行，再用 LoRA/PEFT 验证参数高效训练。',
    outcome: '能够手写 decoder、定位训练失败、解释 kernel/内存瓶颈，并设计可复现实验。',
    tracks: ['transformer', 'torch', 'lora'],
    phases: [
      ['数学表示', 'Transformer', 'shape、attention、位置编码与训练目标'],
      ['执行机制', 'PyTorch', 'Storage、TensorImpl、dispatcher 与 autograd'],
      ['训练系统', 'PyTorch', 'AMP、checkpoint、DDP/FSDP 与 profiler'],
      ['高效适配', 'LoRA · PEFT', '低秩假设、target modules、量化与合并']
    ]
  },
  {
    id: 'serving',
    label: '推理与产品',
    title: '从模型执行到可上线 AI 产品',
    summary: '先理解 Transformer/PyTorch 的内存与执行，再进入 vLLM 调度和 KV Cache，最后用 Nuxt 构建可部署、可交互的产品表面。',
    outcome: '能够解释吞吐与延迟取舍，搭建兼容 API 服务，并把静态前端、安全代理和模型服务接成完整系统。',
    tracks: ['transformer', 'torch', 'vllm', 'nuxt', 'typescript'],
    phases: [
      ['模型路径', 'Transformer + PyTorch', 'prefill、decode、KV Cache 与 kernel'],
      ['服务运行时', 'vLLM', 'PagedAttention、continuous batching 与调度'],
      ['接口合同', 'TypeScript', '流式协议、错误模型与客户端状态机'],
      ['产品交付', 'Nuxt', 'SSR/SSG、hydration、CORS、部署与可观测']
    ]
  }
]

const activeId = ref(paths[0].id)
const activePath = computed(() => paths.find(path => path.id === activeId.value) || paths[0])
const trackById = (id: TrackId) => tracks.find(track => track.id === id)!
const curated = (id: TrackId) => Object.keys(topicGuides[id] || {}).length
const totalMinutes = computed(() => activePath.value.tracks.reduce((sum, id) => {
  return sum + trackById(id).lessons.reduce((trackSum, lesson) => trackSum + lesson.estimatedMinutes, 0)
}, 0))
</script>

<template>
  <main class="portal-page">
    <section class="portal-hero compact">
      <div class="portal-shell">
        <p class="portal-kicker"><span /> LEARNING PATHS</p>
        <h1>从目标倒推能力，<br>避免在目录里迷路。</h1>
        <p>技术路线之间有真实依赖。这里给出三条可执行路径，每一阶段都说明前置能力、学习证据和最终工程产出。</p>
      </div>
    </section>

    <section class="portal-shell path-workbench">
      <div class="path-tabs" role="tablist" aria-label="学习目标">
        <button v-for="path in paths" :key="path.id" :class="{ active: path.id === activePath.id }" @click="activeId = path.id">
          <span>{{ String(paths.indexOf(path) + 1).padStart(2, '0') }}</span>{{ path.label }}
        </button>
      </div>

      <article class="path-overview">
        <div>
          <p class="portal-kicker">SELECTED OUTCOME</p>
          <h2>{{ activePath.title }}</h2>
          <p>{{ activePath.summary }}</p>
          <aside><b>完成标准</b><span>{{ activePath.outcome }}</span></aside>
        </div>
        <dl>
          <div><dt>涉及路线</dt><dd>{{ activePath.tracks.length }}</dd></div>
          <div><dt>全部课题</dt><dd>{{ activePath.tracks.reduce((sum, id) => sum + trackById(id).lessons.length, 0) }}</dd></div>
          <div><dt>预计训练</dt><dd>{{ Math.round(totalMinutes / 60) }}h</dd></div>
        </dl>
      </article>

      <section class="path-phases">
        <article v-for="(phase, index) in activePath.phases" :key="phase[0]">
          <span>{{ String(index + 1).padStart(2, '0') }}</span>
          <div><small>{{ phase[0] }}</small><h3>{{ phase[1] }}</h3><p>{{ phase[2] }}</p></div>
        </article>
      </section>

      <section class="path-track-grid">
        <NuxtLink v-for="id in activePath.tracks" :key="id" :to="`/tracks/${id}`" :style="{ '--track': trackById(id).color }">
          <i>{{ trackById(id).symbol }}</i>
          <div><h3>{{ trackById(id).name }}</h3><p>{{ trackById(id).description }}</p></div>
          <span><b>{{ curated(id) }}</b> / {{ trackById(id).lessons.length }}<small>已精写</small></span>
        </NuxtLink>
      </section>

      <aside class="path-advice">
        <p class="portal-kicker">HOW TO USE</p>
        <h2>路径提供顺序，掌握仍然依赖证据。</h2>
        <div>
          <p><b>跳过已经掌握的 API</b>，但不要跳过运行时实验。能使用一个接口与能解释它在失败时如何表现，是两种能力。</p>
          <p><b>每完成一个模块就做综合项目</b>。项目暴露跨技术栈边界，比连续刷同类小题更容易发现知识断层。</p>
          <p><b>保留复现仓库和决策日志</b>。面试时最有说服力的材料，是你能展示设计取舍、反例和修复证据。</p>
        </div>
      </aside>
    </section>
  </main>
</template>
