<script setup lang="ts">
import { getTrack } from '~/data/curriculum'
import { getLessonDetail } from '~/data/lesson-content'

const route = useRoute()
const track = computed(() => getTrack(String(route.params.track)))
if (!track.value) throw createError({ statusCode: 404, statusMessage: '课程不存在' })
const curatedCount = computed(() => track.value!.lessons.filter(lesson => getLessonDetail(track.value!, lesson).curated).length)
const modules = computed(() => [...new Set(track.value!.lessons.map(lesson => lesson.moduleOrder))].map(order => ({
  order,
  title: track.value!.lessons.find(lesson => lesson.moduleOrder === order)?.module || '',
  lessons: track.value!.lessons.filter(lesson => lesson.moduleOrder === order)
})))
const interviewerCases = computed(() => modules.value.map(module => ({
  title: `请结合一个真实项目，解释「${module.lessons[0]?.title}」的设计取舍。`,
  detail: `追问方向：${module.lessons.slice(1, 4).map(lesson => lesson.title).join('、')}。要求给出失败案例、指标或测试证据，而不是复述定义。`,
  source: module.lessons[0]?.interviewSource,
  answer: `回答应先界定「${module.lessons[0]?.title}」解决的工程边界，再用 ${module.lessons.slice(1, 4).map(lesson => lesson.title).join('、')} 推演内部机制。项目证据至少包含一个失败案例、一项可量化指标和一个自动化测试；最后说明该设计增加的复杂度，以及在哪些简单场景下应选择更直接的实现。`
})))
const openInterviewerAnswer = ref<number | null>(null)
</script>

<template>
  <main class="shell">
      <section class="page-hero">
        <div class="breadcrumb"><NuxtLink to="/">课程地图</NuxtLink><span>/</span><span>{{ track?.name }}</span></div>
        <p class="eyebrow">SOURCE-DRIVEN CURRICULUM</p><h1>{{ track?.name }}</h1>
        <p class="course-intro">{{ track?.description }} 课程正文先回答“为什么需要、如何设计、怎样验证”，再进入复现任务与面试实战。题目是练手入口，知识体系和源码阅读才是主线。</p>
        <div class="track-meta"><span>{{ track?.lessons.length }} 节专题课</span><span>{{ modules.length }} 个能力模块</span><span>{{ curatedCount }}/{{ track?.lessons.length }} 已深度精写</span><a :href="track?.source" target="_blank" rel="noreferrer">上游源码 ↗</a><a href="#interviewer">面试官实战 ↓</a></div>
      </section>
      <section class="course-layout">
        <aside class="course-sidebar"><strong>课程栏目</strong><p>先学机制，再做复现</p><a v-for="module in modules" :key="module.order" class="module-jump" :href="`#module-${module.order}`">{{ String(module.order).padStart(2, '0') }} · {{ module.title.replace(/^\d+ · /, '') }}</a><a class="module-jump interview-jump" href="#interviewer">⌁ 面试官实战</a></aside>
        <div>
          <article v-for="module in modules" :id="`module-${module.order}`" :key="module.order" class="module">
            <header class="module-head"><div><h2>{{ module.title }}</h2><p>课时数量按该能力域的变体、源码复杂度和真实工程边界决定，本模块当前有 {{ module.lessons.length }} 个专题。</p></div><span>{{ module.lessons.length }} LESSONS</span></header>
            <table class="lesson-table"><tbody><tr v-for="lesson in module.lessons" :key="lesson.id"><td class="lesson-num">{{ String(lesson.order).padStart(3, '0') }}</td><td class="lesson-title"><NuxtLink :to="`/tracks/${track?.id}/lessons/${lesson.id}`">{{ lesson.title }}</NuxtLink><div class="lesson-tags"><span :class="`level-${lesson.difficulty}`">{{ lesson.difficulty }}</span><span>{{ lesson.learningValue }} · {{ lesson.learningValueScore }}/5</span><span>{{ lesson.estimatedMinutes }} min</span><span>{{ lesson.granularity }}</span></div><small>{{ lesson.objective }}</small></td><td class="lesson-action"><NuxtLink :to="`/tracks/${track?.id}/lessons/${lesson.id}`">学习与复现 →</NuxtLink></td></tr></tbody></table>
          </article>
          <section id="interviewer" class="interviewer-section"><p class="eyebrow">INTERVIEWER PRACTICE</p><h2>面试官实战</h2><p>以下题型根据公开面经的关注点重新设计，结合本课程的机制、源码与工程证据作答；它们不复制平台内容。</p><article v-for="(item, index) in interviewerCases" :key="item.title" class="interviewer-card"><span>Q{{ String(index + 1).padStart(2, '0') }}</span><div><h3>{{ item.title }}</h3><p>{{ item.detail }}</p><div class="interviewer-actions"><button @click="openInterviewerAnswer = openInterviewerAnswer === index ? null : index">{{ openInterviewerAnswer === index ? '收起答案' : '查看参考答案' }}</button><a :href="item.source" target="_blank" rel="noreferrer">题型线索：公开面经 ↗</a></div><p v-if="openInterviewerAnswer === index" class="interviewer-answer">{{ item.answer }}</p></div></article></section>
        </div>
      </section>
    </main>
    <footer class="footer"><span>{{ track?.name }} · {{ track?.lessons.length }} lessons</span><span>知识正文 · 源码复现 · 练习 · 面试官实战</span></footer>
</template>
