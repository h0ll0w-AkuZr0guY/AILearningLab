<script setup lang="ts">
import { tracks } from '~/data/curriculum'
import { topicGuides } from '~/data/topic-guides'

const activeTrackId = ref('langgraph')
const activeTrack = computed(() => tracks.find(track => track.id === activeTrackId.value) || tracks[0])
const curatedCount = (trackId: typeof tracks[number]['id']) => Object.keys(topicGuides[trackId] || {}).length
const totalLessons = tracks.reduce((sum, track) => sum + track.lessons.length, 0)
const totalCurated = tracks.reduce((sum, track) => sum + curatedCount(track.id), 0)
const activeCurated = computed(() => curatedCount(activeTrack.value.id))
const activeProgress = computed(() => Math.round(activeCurated.value / activeTrack.value.lessons.length * 100))

const capabilityLoops = [
  ['01', '机制建模', '把 API 还原成状态、控制流、所有权和失败边界。'],
  ['02', '源码取证', '沿真实入口、调用链和测试寻找实现证据。'],
  ['03', '最小复现', '删去兼容分支，保留能解释设计的核心骨架。'],
  ['04', '故障演练', '用失败路径、并发与性能反例验证理解。'],
  ['05', '面试表达', '把结论、机制、证据与取舍压缩成现场答案。']
]
</script>

<template>
  <main class="portal-page home-page">
    <section class="home-stage">
      <div class="home-grid-glow" aria-hidden="true" />
      <div class="portal-shell home-stage-inner">
        <div class="home-copy">
          <p class="portal-kicker"><span /> SOURCE-FIRST INTERVIEW LAB</p>
          <h1>把复杂系统<br><em>拆到能够亲手重建。</em></h1>
          <p class="home-lead">面向有工程基础的开发者，从语言运行时、框架执行模型和真实源码进入。阅读、实验、复现、评审与面试表达被组织在同一条证据链里。</p>
          <div class="home-actions">
            <NuxtLink class="portal-primary" to="/learning-paths">规划学习路径 <span>↗</span></NuxtLink>
            <NuxtLink class="portal-ghost" :to="`/tracks/${activeTrack.id}`">继续 {{ activeTrack.name }}</NuxtLink>
          </div>
          <div class="home-metrics" aria-label="课程建设进度">
            <div><b>{{ totalLessons }}</b><span>全部课题</span></div>
            <div><b>{{ totalCurated }}</b><span>深度精写</span></div>
            <div><b>10</b><span>技术路线</span></div>
            <div><b>5×</b><span>每批上线</span></div>
          </div>
        </div>

        <aside class="signal-console" aria-label="课程能力雷达">
          <div class="signal-top"><span><i /> LIVE CURRICULUM</span><small>{{ activeProgress }}% CURATED</small></div>
          <div class="signal-orbit">
            <div class="orbit orbit-a" />
            <div class="orbit orbit-b" />
            <div class="signal-core" :style="{ '--signal': activeTrack.color }">
              <strong>{{ activeTrack.symbol }}</strong>
              <span>{{ activeTrack.name }}</span>
            </div>
            <span class="signal-node node-a">SOURCE</span>
            <span class="signal-node node-b">RUNTIME</span>
            <span class="signal-node node-c">REBUILD</span>
          </div>
          <div class="signal-readout">
            <span>当前路线</span><b>{{ activeTrack.name }}</b>
            <p>{{ activeTrack.description }}</p>
            <div><i :style="{ width: `${Math.max(activeProgress, 2)}%`, background: activeTrack.color }" /></div>
            <small>{{ activeCurated }} / {{ activeTrack.lessons.length }} 已精写</small>
          </div>
        </aside>
      </div>
    </section>

    <section class="portal-shell home-track-lab">
      <header class="portal-section-head">
        <div><p class="portal-kicker">CHOOSE A SYSTEM</p><h2>十条路线，共用一套深度标准。</h2></div>
        <p>选择一条路线查看建设进度。课程规模服从知识结构：复杂系统可以拆得更细，简单机制会合并验证。</p>
      </header>
      <div class="track-selector" role="list">
        <button
          v-for="track in tracks"
          :key="track.id"
          :class="{ active: activeTrack.id === track.id }"
          :style="{ '--track': track.color }"
          @click="activeTrackId = track.id"
        >
          <i>{{ track.symbol }}</i><span><b>{{ track.name }}</b><small>{{ curatedCount(track.id) }} / {{ track.lessons.length }}</small></span>
        </button>
      </div>
      <article class="featured-track" :style="{ '--track': activeTrack.color }">
        <div>
          <span class="featured-symbol">{{ activeTrack.symbol }}</span>
          <p class="portal-kicker">ACTIVE TRACK</p>
          <h3>{{ activeTrack.name }}</h3>
          <p>{{ activeTrack.description }}</p>
        </div>
        <div class="featured-progress">
          <b>{{ activeProgress }}<small>%</small></b>
          <span>深度内容覆盖率</span>
        </div>
        <div class="featured-entry">
          <p>从机制解释进入，经过源码阅读和可运行复现，最后用面试实战压缩表达。</p>
          <NuxtLink :to="`/tracks/${activeTrack.id}`">进入完整课程 <span>→</span></NuxtLink>
        </div>
      </article>
    </section>

    <section class="method-band">
      <div class="portal-shell">
        <header class="portal-section-head light">
          <div><p class="portal-kicker">THE LEARNING LOOP</p><h2>每节课都要形成可验证的闭环。</h2></div>
          <p>学习进度不由“看完”定义，而由你能否解释、实现、制造反例并修复来定义。</p>
        </header>
        <div class="capability-loop">
          <article v-for="item in capabilityLoops" :key="item[0]">
            <span>{{ item[0] }}</span><h3>{{ item[1] }}</h3><p>{{ item[2] }}</p>
          </article>
        </div>
      </div>
    </section>

    <section class="portal-shell portal-links">
      <NuxtLink to="/learning-paths"><span>01</span><div><small>LEARNING PATHS</small><h3>按目标组合课程</h3><p>从面试、框架重建或推理部署目标反推学习顺序。</p></div><b>↗</b></NuxtLink>
      <NuxtLink to="/projects"><span>02</span><div><small>INTEGRATION PROJECTS</small><h3>用工程交付验收</h3><p>每个项目都有阶段、证据、故障演练与面试追问。</p></div><b>↗</b></NuxtLink>
      <NuxtLink to="/source-map"><span>03</span><div><small>SOURCE ATLAS</small><h3>沿真实源码导航</h3><p>检索课程对应的仓库、文件、函数与官方章节。</p></div><b>↗</b></NuxtLink>
    </section>
  </main>
</template>
