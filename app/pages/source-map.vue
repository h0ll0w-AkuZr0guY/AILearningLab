<script setup lang="ts">
import type { TrackId } from '~/data/curriculum'
import { tracks } from '~/data/curriculum'
import { topicGuides } from '~/data/topic-guides'

interface SourceRecord {
  trackId: TrackId
  trackName: string
  trackSymbol: string
  color: string
  lesson: string
  lessonId: string
  repo: string
  file: string
  symbol: string
  language: string
  sourceUrl: string
  officialTitle: string
  officialUrl: string
}

const records = computed<SourceRecord[]>(() => tracks.flatMap(track => {
  const guides = topicGuides[track.id] || {}
  return Object.entries(guides).flatMap(([title, guide]) => {
    if (!guide.source || !guide.official) return []
    const lesson = track.lessons.find(item => item.title === title)
    if (!lesson) return []
    return [{
      trackId: track.id,
      trackName: track.name,
      trackSymbol: track.symbol,
      color: track.color,
      lesson: title,
      lessonId: lesson.id,
      repo: guide.source.repo,
      file: guide.source.file,
      symbol: guide.source.symbol,
      language: guide.source.language,
      sourceUrl: guide.source.url,
      officialTitle: guide.official.title,
      officialUrl: guide.official.url
    }]
  })
}))

const query = ref('')
const activeTrack = ref<'all' | TrackId>('all')
const availableTracks = computed(() => tracks.filter(track => records.value.some(record => record.trackId === track.id)))
const filteredRecords = computed(() => {
  const needle = query.value.trim().toLowerCase()
  return records.value.filter(record => {
    const trackMatch = activeTrack.value === 'all' || record.trackId === activeTrack.value
    const textMatch = !needle || [record.lesson, record.repo, record.file, record.symbol, record.language, record.trackName]
      .join(' ')
      .toLowerCase()
      .includes(needle)
    return trackMatch && textMatch
  })
})
const repoCount = computed(() => new Set(records.value.map(record => record.repo)).size)
</script>

<template>
  <main class="portal-page source-page">
    <section class="portal-hero source-hero">
      <div class="portal-shell">
        <p class="portal-kicker"><span /> LOCAL SOURCE ATLAS</p>
        <h1>从课程概念，直接落到<br>仓库、文件与函数。</h1>
        <p>这里收录已经完成深度精写的源码入口。每条记录同时连接站内课程、官方语义和固定源码路径，省去在大型仓库中盲目搜索。</p>
        <dl><div><dt>源码课题</dt><dd>{{ records.length }}</dd></div><div><dt>上游仓库</dt><dd>{{ repoCount }}</dd></div><div><dt>技术路线</dt><dd>{{ availableTracks.length }}</dd></div></dl>
      </div>
    </section>

    <section class="portal-shell source-workbench">
      <aside class="source-sidebar">
        <p class="portal-kicker">FILTER BY TRACK</p>
        <button :class="{ active: activeTrack === 'all' }" @click="activeTrack = 'all'"><i>∑</i><span>全部源码</span><b>{{ records.length }}</b></button>
        <button
          v-for="track in availableTracks"
          :key="track.id"
          :class="{ active: activeTrack === track.id }"
          :style="{ '--track': track.color }"
          @click="activeTrack = track.id"
        >
          <i>{{ track.symbol }}</i><span>{{ track.name }}</span><b>{{ records.filter(record => record.trackId === track.id).length }}</b>
        </button>
        <div class="source-reading-order">
          <b>推荐阅读顺序</b>
          <ol><li>公开接口与官方语义</li><li>测试和调用点</li><li>核心入口与状态</li><li>失败路径与性能分支</li></ol>
        </div>
      </aside>

      <div class="source-results">
        <label class="source-search">
          <span>⌕</span>
          <input v-model="query" type="search" placeholder="搜索函数、文件、仓库或课题，例如 Pregel / TensorImpl" />
          <small>{{ filteredRecords.length }} RESULTS</small>
        </label>

        <div v-if="filteredRecords.length" class="source-list">
          <article v-for="record in filteredRecords" :key="`${record.trackId}-${record.lesson}`" :style="{ '--track': record.color }">
            <header><i>{{ record.trackSymbol }}</i><span>{{ record.trackName }}</span><small>{{ record.language.toUpperCase() }}</small></header>
            <h2>{{ record.symbol }}</h2>
            <p>{{ record.repo }}<br><code>{{ record.file }}</code></p>
            <div><span>对应课题</span><b>{{ record.lesson }}</b></div>
            <footer>
              <NuxtLink :to="`/tracks/${record.trackId}/lessons/${record.lessonId}`">站内精读 <span>→</span></NuxtLink>
              <a :href="record.officialUrl" target="_blank" rel="noreferrer">官方章节 ↗</a>
              <a :href="record.sourceUrl" target="_blank" rel="noreferrer">完整源码 ↗</a>
            </footer>
          </article>
        </div>
        <div v-else class="source-empty"><span>⌕</span><h2>没有匹配的源码入口</h2><p>换一个函数名、文件路径或技术路线试试。</p></div>
      </div>
    </section>
  </main>
</template>
