<script setup lang="ts">
import { tracks } from '~/data/curriculum'

const projects = [
  ['01', 'Typed Task Engine', 'Python + TypeScript', '用可序列化 DAG、重试策略与类型契约把任务执行引擎做完整。'],
  ['02', 'Production Research Agent', 'LangGraph + Deep Agents', '从工具权限、checkpoint、人工审批到离线评测，构建可追踪 Agent。'],
  ['03', 'SSR-safe AI Workspace', 'Nuxt + TypeScript', '静态前端直连模型，处理 hydration、CORS、密钥和 payload 边界。'],
  ['04', 'Tiny Decoder from Scratch', 'Transformer + PyTorch', '从 token 到训练、KV cache、采样和 profiler 完成可运行 decoder。']
]
</script>

<template>
  <main class="shell">
      <section class="home-hero"><div><p class="eyebrow">INTERVIEW PREP · SOURCE-FIRST ENGINEERING</p><h1>从会用框架，走向<br><em>能独立造出框架。</em></h1><p>一套面向高级工程师的源码驱动训练系统。每条路径不以“记住 API”为终点，而以你能重建关键机制、解释故障、设计边界与完成现场编码为验收。</p><a class="primary" href="#tracks">进入课程地图 <span>↓</span></a></div><aside class="hero-stat"><small>目标能力</small><span class="counter">SOURCE-READY</span><strong>离开官方文档，<br>仍能设计、实现、调试。</strong><p>机制推演 · 源码走读 · 代码评审 · 综合工程</p></aside></section>
      <section id="tracks" class="section"><div class="section-head"><div><p class="eyebrow">CURRICULUM MAP</p><h2>按能力域组织，<br>不按目录堆叠。</h2></div><p>每个方向进入独立课程页。专题数量会随系统复杂度展开：框架级系统覆盖架构、可靠性、安全、可观测与源码；语言课程聚焦运行时与实现边界。</p></div><div class="track-grid"><NuxtLink v-for="track in tracks" :key="track.id" class="track-card" :to="`/tracks/${track.id}`" :style="{ '--track': track.color }"><span class="track-symbol">{{ track.symbol }}</span><span><h3>{{ track.name }}</h3><p>{{ track.description }}</p></span><span class="count">{{ track.lessons.length }} 课<br>进入 →</span></NuxtLink></div></section>
    </main>
    <section id="projects" class="integrations"><div class="shell section"><div class="section-head"><div><p class="eyebrow">INTEGRATION PROJECTS</p><h2>把局部能力，<br>接成完整系统。</h2></div><p>每完成一个能力簇，就用综合项目验证设计、实现、测试、评审和叙述能力。</p></div><div class="integration-grid"><article v-for="project in projects" :key="project[0]" class="integration"><span class="num">{{ project[0] }}</span><h3>{{ project[1] }}</h3><p><b>{{ project[2] }}</b><br>{{ project[3] }}</p></article></div></div></section>
    <section id="sources" class="shell section"><div class="section-head"><div><p class="eyebrow">LOCAL SOURCE ATLAS</p><h2>源码与文档，<br>在你手边。</h2></div><p>每节课都指向官方文档和上游源码。项目的同步脚本会按需稀疏下载关键目录，避免把大型仓库混入前端构建。</p></div></section>
    <footer class="footer"><span>REVIEW LAB · SOURCE-FIRST CURRICULUM</span><span>本地优先 · GitHub Pages 可部署</span></footer>
</template>
