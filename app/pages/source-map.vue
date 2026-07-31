<script setup lang="ts">
import type { CurriculumModule, Lesson, Track, TrackId } from '~/data/curriculum'
import { tracks } from '~/data/curriculum'
import { topicGuides } from '~/data/topic-guides'

type AtlasMode = 'source' | 'docs'

interface AtlasLesson extends Lesson {
  sourceUrl?: string
  sourceFile?: string
  sourceSymbol?: string
  officialUrl?: string
  officialTitle?: string
}

interface AtlasModule extends CurriculumModule {
  lessons: AtlasLesson[]
  visibleLessons: AtlasLesson[]
}

const query = ref('')
const mode = ref<AtlasMode>('source')
const activeTrackId = ref<TrackId>('langgraph')
const expandedModules = ref(new Set<string>())
const selectedLessonId = ref('')

const activeTrack = computed<Track>(() =>
  tracks.find(track => track.id === activeTrackId.value) || tracks[0]
)

const atlasModules = computed<AtlasModule[]>(() => activeTrack.value.modules.map((module) => {
  const guides = topicGuides[activeTrack.value.id] || {}
  const lessons = module.lessons.map((lesson) => {
    const guide = guides[lesson.title]
    return {
      ...lesson,
      sourceUrl: guide?.source?.url,
      sourceFile: guide?.source?.file,
      sourceSymbol: guide?.source?.symbol,
      officialUrl: guide?.official?.url,
      officialTitle: guide?.official?.title
    }
  })
  return { ...module, lessons, visibleLessons: lessons }
}))

const normalizedQuery = computed(() => query.value.trim().toLowerCase())
const visibleModules = computed<AtlasModule[]>(() => {
  if (!normalizedQuery.value) return atlasModules.value
  return atlasModules.value.flatMap((module) => {
    const moduleText = [
      module.title,
      module.goal,
      module.sourceScope,
      module.officialScope
    ].join(' ').toLowerCase()
    const visibleLessons = module.lessons.filter((lesson) => [
      lesson.title,
      lesson.id,
      lesson.sourceFile,
      lesson.sourceSymbol,
      lesson.status
    ].join(' ').toLowerCase().includes(normalizedQuery.value))
    return moduleText.includes(normalizedQuery.value) || visibleLessons.length
      ? [{ ...module, visibleLessons: visibleLessons.length ? visibleLessons : module.lessons }]
      : []
  })
})

const selectedLesson = computed<AtlasLesson | undefined>(() =>
  atlasModules.value.flatMap(module => module.lessons)
    .find(lesson => lesson.id === selectedLessonId.value)
)

const selectedModule = computed<AtlasModule | undefined>(() => {
  if (selectedLesson.value) {
    return atlasModules.value.find(module =>
      module.lessons.some(lesson => lesson.id === selectedLesson.value?.id)
    )
  }
  return visibleModules.value[0]
})

const resultCount = computed(() =>
  visibleModules.value.reduce((total, module) => total + module.visibleLessons.length, 0)
)

const exactSourceCount = computed(() =>
  atlasModules.value.flatMap(module => module.lessons)
    .filter(lesson => lesson.sourceUrl).length
)

const sourceScopeUrl = (track: Track, sourceScope: string) => {
  const path = sourceScope
    .replace(/\s*与\s*.*$/, '')
    .replace(/^仓库根目录.*$/, '')
    .trim()
  if (!path) return track.source
  const suffix = path.includes('.') ? 'blob/main' : 'tree/main'
  return `${track.source}/${suffix}/${path}`
}

const isExpanded = (module: AtlasModule) =>
  Boolean(normalizedQuery.value) || expandedModules.value.has(module.id)

const toggleModule = (module: AtlasModule) => {
  const next = new Set(expandedModules.value)
  if (next.has(module.id)) next.delete(module.id)
  else next.add(module.id)
  expandedModules.value = next
}

const selectTrack = (trackId: TrackId) => {
  activeTrackId.value = trackId
  selectedLessonId.value = ''
  expandedModules.value = new Set(
    tracks.find(track => track.id === trackId)?.modules.slice(0, 2).map(module => module.id)
  )
}

const selectLesson = (lesson: AtlasLesson) => {
  selectedLessonId.value = lesson.id
}

watch(mode, () => {
  selectedLessonId.value = ''
})

onMounted(() => {
  expandedModules.value = new Set(activeTrack.value.modules.slice(0, 2).map(module => module.id))
})
</script>

<template>
  <main class="portal-page source-page source-atlas">
    <section class="portal-hero source-hero">
      <div class="portal-shell source-hero-grid">
        <div>
          <p class="portal-kicker"><span /> UPSTREAM KNOWLEDGE GRAPH</p>
          <h1>从课程目录，穿透到<br>源码与官方文档。</h1>
          <p>图谱以全部模块目录为骨架，pending 课题也会出现。深化课程只负责补充精确到函数与章节锚点的叶节点，不再决定资料能否被检索。</p>
        </div>
        <div class="atlas-orbit" aria-hidden="true">
          <i class="orbit-track">{{ activeTrack.symbol }}</i>
          <span class="orbit-source">SOURCE</span>
          <span class="orbit-docs">DOCS</span>
          <span class="orbit-lessons">{{ activeTrack.lessons.length }} TOPICS</span>
          <svg viewBox="0 0 440 270">
            <path d="M220 135 C156 70 119 61 58 55" />
            <path d="M220 135 C287 70 328 63 387 55" />
            <path d="M220 135 C220 194 220 205 220 242" />
          </svg>
        </div>
        <dl>
          <div><dt>课程骨架节点</dt><dd>{{ activeTrack.lessons.length }}</dd></div>
          <div><dt>模块分组</dt><dd>{{ activeTrack.modules.length }}</dd></div>
          <div><dt>精确源码叶节点</dt><dd>{{ exactSourceCount }}</dd></div>
          <div><dt>技术路线</dt><dd>{{ tracks.length }}</dd></div>
        </dl>
      </div>
    </section>

    <section class="portal-shell atlas-workbench">
      <aside class="atlas-tracks" aria-label="技术路线">
        <p class="portal-kicker">TRACK ROOTS</p>
        <button
          v-for="track in tracks"
          :key="track.id"
          :class="{ active: activeTrackId === track.id }"
          :style="{ '--track': track.color }"
          @click="selectTrack(track.id)"
        >
          <i>{{ track.symbol }}</i>
          <span><b>{{ track.name }}</b><small>{{ track.modules.length }} 模块 · {{ track.lessons.length }} 课题</small></span>
          <em>→</em>
        </button>
        <div class="atlas-legend">
          <b>节点图例</b>
          <p><i class="ready" />精确锚点已核验</p>
          <p><i class="planned" />目录节点待深化</p>
          <small>目录节点链接到真实上游范围，不伪造尚未核验的函数路径。</small>
        </div>
      </aside>

      <div class="atlas-main">
        <header class="atlas-toolbar">
          <div class="atlas-mode" role="tablist" aria-label="图谱类型">
            <button :class="{ active: mode === 'source' }" role="tab" :aria-selected="mode === 'source'" @click="mode = 'source'">
              <span>⌘</span>源码图谱
            </button>
            <button :class="{ active: mode === 'docs' }" role="tab" :aria-selected="mode === 'docs'" @click="mode = 'docs'">
              <span>§</span>官方文档图谱
            </button>
          </div>
          <label class="atlas-search">
            <span>⌕</span>
            <input v-model="query" type="search" placeholder="搜索模块、课题、函数或文件，例如 Pregel / TensorImpl" />
            <small>{{ resultCount }} NODES</small>
          </label>
        </header>

        <div class="atlas-canvas">
          <section class="atlas-tree" role="tree" :aria-label="`${activeTrack.name}${mode === 'source' ? '源码' : '文档'}知识图谱`">
            <div class="atlas-root" :style="{ '--track': activeTrack.color }">
              <i>{{ activeTrack.symbol }}</i>
              <div>
                <small>TRACK ROOT · {{ activeTrack.id }}</small>
                <h2>{{ activeTrack.name }}</h2>
                <p>{{ activeTrack.description }}</p>
              </div>
              <a :href="mode === 'source' ? activeTrack.source : activeTrack.docs" target="_blank" rel="noreferrer">
                {{ mode === 'source' ? '打开上游仓库' : '打开官方文档' }} ↗
              </a>
            </div>

            <div v-if="visibleModules.length" class="atlas-branches" role="group">
              <article
                v-for="module in visibleModules"
                :key="module.id"
                class="atlas-module"
                :class="{ expanded: isExpanded(module) }"
                role="treeitem"
                :aria-expanded="isExpanded(module)"
              >
                <div class="atlas-module-node">
                  <button
                    class="atlas-toggle"
                    :aria-label="`${isExpanded(module) ? '折叠' : '展开'} ${module.title}`"
                    @click="toggleModule(module)"
                  >
                    {{ isExpanded(module) ? '−' : '+' }}
                  </button>
                  <div>
                    <small>MODULE {{ String(module.order).padStart(2, '0') }}</small>
                    <h3>{{ module.title }}</h3>
                    <p>{{ module.goal }}</p>
                  </div>
                  <a
                    :href="mode === 'source' ? sourceScopeUrl(activeTrack, module.sourceScope) : module.officialScope"
                    target="_blank"
                    rel="noreferrer"
                  >
                    <span>{{ mode === 'source' ? module.sourceScope : '官方范围' }}</span>
                    ↗
                  </a>
                </div>

                <div v-if="isExpanded(module)" class="atlas-leaves" role="group">
                  <button
                    v-for="lesson in module.visibleLessons"
                    :key="lesson.id"
                    role="treeitem"
                    :class="{ selected: selectedLessonId === lesson.id, verified: mode === 'source' ? lesson.sourceUrl : lesson.officialUrl }"
                    @click="selectLesson(lesson)"
                  >
                    <i>{{ lesson.status === 'curated' ? '◆' : '◇' }}</i>
                    <span>
                      <small>{{ lesson.id }} · {{ lesson.status === 'curated' ? 'CURATED' : 'PLANNED' }}</small>
                      <b>{{ lesson.title }}</b>
                      <em v-if="mode === 'source' && lesson.sourceSymbol">{{ lesson.sourceSymbol }}</em>
                      <em v-else-if="mode === 'docs' && lesson.officialTitle">{{ lesson.officialTitle }}</em>
                      <em v-else>{{ mode === 'source' ? module.sourceScope : '等待深化时补充精确章节锚点' }}</em>
                    </span>
                    <strong>查看</strong>
                  </button>
                </div>
              </article>
            </div>

            <div v-else class="source-empty">
              <span>⌕</span><h2>没有匹配的图谱节点</h2><p>换一个模块、函数、文件或课题名试试。</p>
            </div>
          </section>

          <aside class="atlas-inspector" aria-live="polite">
            <p class="portal-kicker">NODE INSPECTOR</p>
            <template v-if="selectedLesson">
              <span class="atlas-status" :class="selectedLesson.status">{{ selectedLesson.status }}</span>
              <small>{{ selectedLesson.id }}</small>
              <h2>{{ selectedLesson.title }}</h2>
              <p>{{ selectedLesson.objective }}</p>
              <dl>
                <div><dt>所属模块</dt><dd>{{ selectedLesson.module }}</dd></div>
                <div><dt>源码范围</dt><dd><code>{{ selectedLesson.sourceFile || selectedModule?.sourceScope }}</code></dd></div>
                <div v-if="selectedLesson.sourceSymbol"><dt>核心符号</dt><dd><code>{{ selectedLesson.sourceSymbol }}</code></dd></div>
                <div><dt>状态</dt><dd>{{ selectedLesson.status === 'curated' ? '已有精确课程锚点' : '目录已建模，等待认领深化' }}</dd></div>
              </dl>
              <div class="atlas-actions">
                <NuxtLink :to="`/tracks/${activeTrack.id}/lessons/${selectedLesson.id}`">查看站内课题 →</NuxtLink>
                <a
                  :href="mode === 'source'
                    ? (selectedLesson.sourceUrl || sourceScopeUrl(activeTrack, selectedModule?.sourceScope || ''))
                    : (selectedLesson.officialUrl || selectedModule?.officialScope)"
                  target="_blank"
                  rel="noreferrer"
                >
                  {{ mode === 'source' ? '上游源码' : '官方文档' }} ↗
                </a>
              </div>
            </template>
            <template v-else-if="selectedModule">
              <span class="atlas-status module">module</span>
              <small>{{ selectedModule.id }}</small>
              <h2>{{ selectedModule.title }}</h2>
              <p>{{ selectedModule.goal }}</p>
              <dl>
                <div><dt>课程数量</dt><dd>{{ selectedModule.lessons.length }}</dd></div>
                <div><dt>源码范围</dt><dd><code>{{ selectedModule.sourceScope }}</code></dd></div>
                <div><dt>文档入口</dt><dd>{{ selectedModule.officialScope }}</dd></div>
                <div><dt>规划状态</dt><dd>{{ selectedModule.planningStatus }}</dd></div>
              </dl>
              <p class="atlas-hint">展开模块并选择一个叶节点，可继续查看精确源码符号、官方章节或待认领状态。</p>
            </template>
          </aside>
        </div>
      </div>
    </section>
  </main>
</template>
