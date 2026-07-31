<script setup lang="ts">
import type { Lesson, Track, TrackId } from '~/data/curriculum'
import { tracks } from '~/data/curriculum'
import { topicGuides } from '~/data/topic-guides'

type AtlasMode = 'source' | 'docs'
type KnowledgeKind = 'repository' | 'domain' | 'directory' | 'file' | 'symbol' | 'page' | 'section'

interface KnowledgeNode {
  id: string
  parentId?: string
  label: string
  kind: KnowledgeKind
  path: string
  url?: string
  description: string
  depth: number
  verified: boolean
  relatedLessonIds: string[]
}

interface KnowledgeEdge {
  source: string
  target: string
}

interface PositionedNode extends KnowledgeNode {
  x: number
  y: number
}

const GRAPH_WIDTH = 960
const GRAPH_HEIGHT = 700
const GRAPH_CENTER = { x: GRAPH_WIDTH / 2, y: GRAPH_HEIGHT / 2 }
const NODE_RADIUS: Record<KnowledgeKind, number> = {
  repository: 54,
  domain: 42,
  directory: 36,
  file: 32,
  symbol: 29,
  page: 34,
  section: 29
}

const route = useRoute()
const router = useRouter()
const query = ref('')
const mode = ref<AtlasMode>('source')
const activeTrackId = ref<TrackId>('langgraph')
const selectedNodeId = ref('root')
const collapsedNodeIds = ref(new Set<string>())
const zoom = ref(1)

const activeTrack = computed<Track>(() =>
  tracks.find(track => track.id === activeTrackId.value) || tracks[0]!
)

const guideEntries = computed(() => {
  const guides = topicGuides[activeTrack.value.id] || {}
  return Object.entries(guides).flatMap(([title, guide]) => {
    const lesson = activeTrack.value.lessons.find(item => item.title === title)
    return lesson ? [{ lesson, guide }] : []
  })
})

const repoName = (url: string) => url.replace(/\/$/, '').split('/').pop() || 'repository'

const sourceUrlForPath = (track: Track, path: string) => {
  const fileLike = /\.[a-z0-9]+$/i.test(path)
  return `${track.source}/${fileLike ? 'blob' : 'tree'}/main/${path}`
}

const extractSourcePaths = (scope: string) => {
  const parts = scope.split(/\s+与\s+|[、，,]/)
  return [...new Set(parts.flatMap((part) => {
    const value = part.trim()
    if (!value) return []
    if (/仓库根目录/.test(value)) return /tests/i.test(value) ? ['tests'] : []
    return /^[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)*$/.test(value) ? [value] : []
  }))]
}

const appendLesson = (node: KnowledgeNode, lessonId?: string) => {
  if (lessonId && !node.relatedLessonIds.includes(lessonId)) node.relatedLessonIds.push(lessonId)
}

const buildSourceNodes = (track: Track): KnowledgeNode[] => {
  const nodes = new Map<string, KnowledgeNode>()
  nodes.set('root', {
    id: 'root',
    label: repoName(track.source),
    kind: 'repository',
    path: `${repoName(track.source)} / repository`,
    url: track.source,
    description: `${track.name} 官方上游仓库。节点按真实目录、文件和已核验符号组织。`,
    depth: 0,
    verified: true,
    relatedLessonIds: []
  })

  const addPath = (rawPath: string, lessonId?: string, exactUrl?: string) => {
    const path = rawPath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
    if (!path) return 'root'
    const segments = path.split('/').filter(Boolean)
    let parentId = 'root'
    let currentPath = ''
    segments.forEach((segment, index) => {
      currentPath = currentPath ? `${currentPath}/${segment}` : segment
      const id = `source:${currentPath}`
      const isLast = index === segments.length - 1
      const kind: KnowledgeKind = isLast && /\.[a-z0-9]+$/i.test(segment) ? 'file' : 'directory'
      if (!nodes.has(id)) {
        nodes.set(id, {
          id,
          parentId,
          label: segment,
          kind,
          path: currentPath,
          url: isLast && exactUrl ? exactUrl : sourceUrlForPath(track, currentPath),
          description: kind === 'file'
            ? `官方仓库文件：${currentPath}`
            : `官方仓库目录：${currentPath}`,
          depth: index + 1,
          verified: Boolean(exactUrl),
          relatedLessonIds: []
        })
      }
      const node = nodes.get(id)!
      if (exactUrl && isLast) {
        node.url = exactUrl
        node.verified = true
      }
      appendLesson(node, lessonId)
      parentId = id
    })
    return parentId
  }

  track.modules.forEach((module) => {
    extractSourcePaths(module.sourceScope).forEach(path => addPath(path))
  })

  guideEntries.value.forEach(({ lesson, guide }) => {
    if (!guide.source?.file) return
    const fileId = addPath(guide.source.file, lesson.id, guide.source.url)
    const symbol = guide.source.symbol?.trim()
    if (!symbol) return
    const symbolId = `symbol:${guide.source.file}:${symbol}`
    if (!nodes.has(symbolId)) {
      nodes.set(symbolId, {
        id: symbolId,
        parentId: fileId,
        label: symbol,
        kind: 'symbol',
        path: `${guide.source.file}#${symbol}`,
        url: guide.source.url,
        description: `已由课程核验的核心源码符号：${symbol}`,
        depth: (nodes.get(fileId)?.depth || 1) + 1,
        verified: true,
        relatedLessonIds: [lesson.id]
      })
    } else {
      appendLesson(nodes.get(symbolId)!, lesson.id)
    }
  })

  return [...nodes.values()]
}

const buildDocsNodes = (track: Track): KnowledgeNode[] => {
  const nodes = new Map<string, KnowledgeNode>()
  nodes.set('root', {
    id: 'root',
    label: `${track.name} Docs`,
    kind: 'repository',
    path: track.docs,
    url: track.docs,
    description: `${track.name} 官方文档入口。节点按官方域名、页面路径与章节锚点组织。`,
    depth: 0,
    verified: true,
    relatedLessonIds: []
  })

  const addDocUrl = (rawUrl: string, lessonId?: string, exactTitle?: string) => {
    let parsed: URL
    try {
      parsed = new URL(rawUrl)
    } catch {
      return 'root'
    }

    const domainId = `docs:${parsed.host}`
    if (!nodes.has(domainId)) {
      nodes.set(domainId, {
        id: domainId,
        parentId: 'root',
        label: parsed.host,
        kind: 'domain',
        path: parsed.host,
        url: parsed.origin,
        description: `官方文档域：${parsed.host}`,
        depth: 1,
        verified: true,
        relatedLessonIds: []
      })
    }

    const segments = parsed.pathname.split('/').filter(Boolean)
    let parentId = domainId
    let currentPath = ''
    segments.forEach((segment, index) => {
      currentPath = `${currentPath}/${segment}`
      const id = `docs:${parsed.host}${currentPath}`
      const isLast = index === segments.length - 1
      if (!nodes.has(id)) {
        nodes.set(id, {
          id,
          parentId,
          label: isLast && exactTitle ? exactTitle : decodeURIComponent(segment),
          kind: isLast ? 'page' : 'directory',
          path: `${parsed.host}${currentPath}`,
          url: isLast ? `${parsed.origin}${parsed.pathname}` : undefined,
          description: isLast
            ? `官方文档页面：${exactTitle || decodeURIComponent(segment)}`
            : `官方文档路径：${parsed.host}${currentPath}`,
          depth: index + 2,
          verified: Boolean(lessonId),
          relatedLessonIds: []
        })
      }
      const node = nodes.get(id)!
      if (isLast && exactTitle) node.label = exactTitle
      appendLesson(node, lessonId)
      parentId = id
    })

    if (parsed.hash) {
      const id = `docs:${parsed.host}${parsed.pathname}${parsed.hash}`
      if (!nodes.has(id)) {
        nodes.set(id, {
          id,
          parentId,
          label: exactTitle ? exactTitle.split('·').pop()?.trim() || parsed.hash.slice(1) : parsed.hash.slice(1),
          kind: 'section',
          path: `${parsed.host}${parsed.pathname}${parsed.hash}`,
          url: parsed.toString(),
          description: `官方文档章节锚点：${parsed.hash}`,
          depth: (nodes.get(parentId)?.depth || 1) + 1,
          verified: Boolean(lessonId),
          relatedLessonIds: lessonId ? [lessonId] : []
        })
      } else {
        appendLesson(nodes.get(id)!, lessonId)
      }
      return id
    }
    return parentId
  }

  addDocUrl(track.docs)
  track.modules.forEach((module) => {
    if (module.officialScope && module.officialScope !== track.docs) addDocUrl(module.officialScope)
  })
  guideEntries.value.forEach(({ lesson, guide }) => {
    if (guide.official?.url) addDocUrl(guide.official.url, lesson.id, guide.official.title)
  })

  return [...nodes.values()]
}

const knowledgeNodes = computed(() =>
  mode.value === 'source'
    ? buildSourceNodes(activeTrack.value)
    : buildDocsNodes(activeTrack.value)
)

const nodeById = computed(() =>
  new Map(knowledgeNodes.value.map(node => [node.id, node]))
)

const childrenByParent = computed(() => {
  const children = new Map<string, KnowledgeNode[]>()
  knowledgeNodes.value.forEach((node) => {
    if (!node.parentId) return
    const group = children.get(node.parentId) || []
    group.push(node)
    children.set(node.parentId, group)
  })
  return children
})

const normalizedQuery = computed(() => query.value.trim().toLowerCase())

const matchedNodeIds = computed(() => {
  if (!normalizedQuery.value) return new Set(knowledgeNodes.value.map(node => node.id))
  const matches = knowledgeNodes.value.filter(node => [
    node.label,
    node.path,
    node.kind,
    node.description,
    ...node.relatedLessonIds
  ].join(' ').toLowerCase().includes(normalizedQuery.value))
  return new Set(matches.map(node => node.id))
})

const queryVisibleIds = computed(() => {
  if (!normalizedQuery.value) return undefined
  const visible = new Set<string>(['root'])
  matchedNodeIds.value.forEach((id) => {
    let cursor = nodeById.value.get(id)
    while (cursor) {
      visible.add(cursor.id)
      cursor = cursor.parentId ? nodeById.value.get(cursor.parentId) : undefined
    }
  })
  return visible
})

const isHiddenByCollapse = (node: KnowledgeNode) => {
  let parentId = node.parentId
  while (parentId) {
    if (collapsedNodeIds.value.has(parentId)) return true
    parentId = nodeById.value.get(parentId)?.parentId
  }
  return false
}

const visibleNodes = computed(() => knowledgeNodes.value.filter((node) => {
  if (queryVisibleIds.value) return queryVisibleIds.value.has(node.id)
  return !isHiddenByCollapse(node)
}))

const visibleNodeIds = computed(() => new Set(visibleNodes.value.map(node => node.id)))

const visibleEdges = computed<KnowledgeEdge[]>(() =>
  visibleNodes.value.flatMap(node =>
    node.parentId && visibleNodeIds.value.has(node.parentId)
      ? [{ source: node.parentId, target: node.id }]
      : []
  )
)

const hashUnit = (value: string) => {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return ((hash >>> 0) % 10000) / 10000
}

const positionedNodes = computed<PositionedNode[]>(() => {
  const nodes = visibleNodes.value.map((node, index) => {
    if (node.id === 'root') return { ...node, x: GRAPH_CENTER.x, y: GRAPH_CENTER.y }
    const angle = hashUnit(node.id) * Math.PI * 2
    const radius = Math.min(286, 105 + node.depth * 48 + (index % 3) * 9)
    return {
      ...node,
      x: GRAPH_CENTER.x + Math.cos(angle) * radius,
      y: GRAPH_CENTER.y + Math.sin(angle) * radius
    }
  })
  const byId = new Map(nodes.map(node => [node.id, node]))

  for (let iteration = 0; iteration < 105; iteration += 1) {
    const alpha = 1 - iteration / 105
    const velocity = new Map(nodes.map(node => [node.id, { x: 0, y: 0 }]))

    for (let leftIndex = 0; leftIndex < nodes.length; leftIndex += 1) {
      const left = nodes[leftIndex]!
      for (let rightIndex = leftIndex + 1; rightIndex < nodes.length; rightIndex += 1) {
        const right = nodes[rightIndex]!
        let dx = right.x - left.x
        let dy = right.y - left.y
        let distanceSquared = dx * dx + dy * dy
        if (distanceSquared < 1) {
          dx = (hashUnit(`${left.id}:${right.id}`) - .5) * 2
          dy = (hashUnit(`${right.id}:${left.id}`) - .5) * 2
          distanceSquared = dx * dx + dy * dy
        }
        const distance = Math.sqrt(distanceSquared)
        const minimumDistance = NODE_RADIUS[left.kind] + NODE_RADIUS[right.kind] + 11
        const collision = distance < minimumDistance
          ? (minimumDistance - distance) * .16 * alpha
          : 0
        const repulsion = (72000 * alpha) / Math.max(400, distanceSquared)
        const pushX = (dx / distance) * (repulsion + collision)
        const pushY = (dy / distance) * (repulsion + collision)
        if (left.id !== 'root') {
          velocity.get(left.id)!.x -= pushX
          velocity.get(left.id)!.y -= pushY
        }
        if (right.id !== 'root') {
          velocity.get(right.id)!.x += pushX
          velocity.get(right.id)!.y += pushY
        }
      }
    }

    visibleEdges.value.forEach((edge) => {
      const source = byId.get(edge.source)
      const target = byId.get(edge.target)
      if (!source || !target) return
      const dx = target.x - source.x
      const dy = target.y - source.y
      const distance = Math.max(1, Math.hypot(dx, dy))
      const desired = edge.source === 'root' ? 175 : 105
      const spring = (distance - desired) * .018 * alpha
      const pullX = (dx / distance) * spring
      const pullY = (dy / distance) * spring
      if (source.id !== 'root') {
        velocity.get(source.id)!.x += pullX
        velocity.get(source.id)!.y += pullY
      }
      if (target.id !== 'root') {
        velocity.get(target.id)!.x -= pullX
        velocity.get(target.id)!.y -= pullY
      }
    })

    nodes.forEach((node) => {
      if (node.id === 'root') return
      const force = velocity.get(node.id)!
      force.x += (GRAPH_CENTER.x - node.x) * .0018 * alpha
      force.y += (GRAPH_CENTER.y - node.y) * .0018 * alpha
      node.x = Math.max(58, Math.min(GRAPH_WIDTH - 58, node.x + force.x))
      node.y = Math.max(58, Math.min(GRAPH_HEIGHT - 58, node.y + force.y))
    })
  }

  return nodes
})

const positionedById = computed(() =>
  new Map(positionedNodes.value.map(node => [node.id, node]))
)

const selectedNode = computed(() =>
  nodeById.value.get(selectedNodeId.value) || nodeById.value.get('root')
)

const selectedLessons = computed<Lesson[]>(() => {
  const ids = new Set(selectedNode.value?.relatedLessonIds || [])
  return activeTrack.value.lessons.filter(lesson => ids.has(lesson.id))
})

const verifiedCount = computed(() =>
  knowledgeNodes.value.filter(node => node.verified && !['repository', 'domain'].includes(node.kind)).length
)

const edgePath = (edge: KnowledgeEdge) => {
  const source = positionedById.value.get(edge.source)
  const target = positionedById.value.get(edge.target)
  if (!source || !target) return ''
  const middleX = (source.x + target.x) / 2
  const middleY = (source.y + target.y) / 2
  const dx = target.x - source.x
  const dy = target.y - source.y
  const length = Math.max(1, Math.hypot(dx, dy))
  const bend = edge.source === 'root' ? 12 : 7
  return `M ${source.x} ${source.y} Q ${middleX - (dy / length) * bend} ${middleY + (dx / length) * bend} ${target.x} ${target.y}`
}

const nodeStyle = (node: PositionedNode) => ({
  left: `${(node.x / GRAPH_WIDTH) * 100}%`,
  top: `${(node.y / GRAPH_HEIGHT) * 100}%`
})

const hasChildren = (nodeId: string) => Boolean(childrenByParent.value.get(nodeId)?.length)

const shortLabel = (value: string, limit = 12) =>
  value.length > limit ? `${value.slice(0, limit)}…` : value

const selectTrack = (trackId: TrackId) => {
  activeTrackId.value = trackId
  selectedNodeId.value = 'root'
  collapsedNodeIds.value = new Set()
  query.value = ''
  zoom.value = 1
  void router.replace({ query: { track: trackId, mode: mode.value } })
}

const setMode = (nextMode: AtlasMode) => {
  mode.value = nextMode
  selectedNodeId.value = 'root'
  collapsedNodeIds.value = new Set()
  query.value = ''
  void router.replace({ query: { track: activeTrackId.value, mode: nextMode } })
}

const selectKnowledgeNode = (node: KnowledgeNode) => {
  selectedNodeId.value = node.id
  if (!hasChildren(node.id) || normalizedQuery.value) return
  const next = new Set(collapsedNodeIds.value)
  if (next.has(node.id)) next.delete(node.id)
  else next.add(node.id)
  collapsedNodeIds.value = next
}

const setZoom = (next: number) => {
  zoom.value = Math.max(.82, Math.min(1.22, Number(next.toFixed(2))))
}

onMounted(() => {
  const trackId = String(route.query.track || '')
  if (tracks.some(track => track.id === trackId)) activeTrackId.value = trackId as TrackId
  const requestedMode = String(route.query.mode || '')
  if (requestedMode === 'source' || requestedMode === 'docs') mode.value = requestedMode
  query.value = String(route.query.q || '')
})

watch([activeTrackId, mode], () => {
  selectedNodeId.value = 'root'
  collapsedNodeIds.value = new Set()
})
</script>

<template>
  <main class="portal-page source-page source-atlas">
    <section class="portal-hero source-hero">
      <div class="portal-shell source-hero-grid">
        <div>
          <p class="portal-kicker"><span /> UPSTREAM KNOWLEDGE GRAPH</p>
          <h1>沿官方资料关系，<br>进入项目内部。</h1>
          <p>图谱只表达上游项目自身：仓库、目录、文件、函数，或文档域、页面与章节锚点。课程目录不参与图谱层级；相关课程只作为节点的反向入口。</p>
        </div>
        <div class="atlas-orbit" aria-hidden="true">
          <i class="orbit-track">{{ activeTrack.symbol }}</i>
          <span class="orbit-source">SOURCE</span>
          <span class="orbit-docs">DOCS</span>
          <span class="orbit-lessons">{{ knowledgeNodes.length }} NODES</span>
          <svg viewBox="0 0 440 270">
            <path d="M220 135 C156 70 119 61 58 55" />
            <path d="M220 135 C287 70 328 63 387 55" />
            <path d="M220 135 C220 194 220 205 220 242" />
          </svg>
        </div>
        <dl>
          <div><dt>当前资料节点</dt><dd>{{ knowledgeNodes.length }}</dd></div>
          <div><dt>关系连线</dt><dd>{{ knowledgeNodes.length - 1 }}</dd></div>
          <div><dt>精确核验节点</dt><dd>{{ verifiedCount }}</dd></div>
          <div><dt>官方项目</dt><dd>{{ tracks.length }}</dd></div>
        </dl>
      </div>
    </section>

    <section class="portal-shell atlas-workbench">
      <aside class="atlas-tracks" aria-label="官方项目">
        <p class="portal-kicker">UPSTREAM PROJECTS</p>
        <button
          v-for="track in tracks"
          :key="track.id"
          :class="{ active: activeTrackId === track.id }"
          :style="{ '--track': track.color }"
          @click="selectTrack(track.id)"
        >
          <i>{{ track.symbol }}</i>
          <span><b>{{ track.name }}</b><small>{{ repoName(track.source) }}</small></span>
          <em>→</em>
        </button>
        <div class="atlas-legend">
          <b>节点图例</b>
          <p><i class="ready" />课程已核验的文件、符号或锚点</p>
          <p><i class="planned" />来自官方仓库/文档路径的结构节点</p>
          <small>有子节点的球可折叠。课程与模块不会成为图谱父节点。</small>
        </div>
      </aside>

      <div class="atlas-main">
        <header class="atlas-toolbar">
          <div class="atlas-mode" role="tablist" aria-label="图谱类型">
            <button :class="{ active: mode === 'source' }" role="tab" :aria-selected="mode === 'source'" @click="setMode('source')">
              <span>⌘</span>源码图谱
            </button>
            <button :class="{ active: mode === 'docs' }" role="tab" :aria-selected="mode === 'docs'" @click="setMode('docs')">
              <span>§</span>官方文档图谱
            </button>
          </div>
          <label class="atlas-search">
            <span>⌕</span>
            <input v-model="query" type="search" placeholder="搜索目录、文件、函数、页面或章节，例如 Pregel / TensorImpl" />
            <small>{{ normalizedQuery ? matchedNodeIds.size : knowledgeNodes.length }} NODES</small>
          </label>
        </header>

        <div class="atlas-canvas">
          <section
            class="atlas-network"
            :class="{ docs: mode === 'docs' }"
            :aria-label="`${activeTrack.name}${mode === 'source' ? '源码' : '文档'}球状知识图谱`"
          >
            <header class="network-head">
              <div>
                <span>FORCE GRAPH</span>
                <b>{{ activeTrack.name }} · {{ mode === 'source' ? 'OFFICIAL REPOSITORY' : 'OFFICIAL DOCS' }}</b>
              </div>
              <div class="network-zoom" aria-label="图谱缩放">
                <button aria-label="缩小图谱" :disabled="zoom <= .82" @click="setZoom(zoom - .1)">−</button>
                <button aria-label="重置图谱缩放" @click="setZoom(1)">{{ Math.round(zoom * 100) }}%</button>
                <button aria-label="放大图谱" :disabled="zoom >= 1.22" @click="setZoom(zoom + .1)">+</button>
              </div>
            </header>

            <div class="network-viewport">
              <div class="network-world" :style="{ transform: `scale(${zoom})` }">
                <svg
                  class="network-edges"
                  :viewBox="`0 0 ${GRAPH_WIDTH} ${GRAPH_HEIGHT}`"
                  aria-hidden="true"
                >
                  <defs>
                    <radialGradient id="networkGlow">
                      <stop offset="0%" stop-color="#7c6cff" stop-opacity=".2" />
                      <stop offset="100%" stop-color="#7c6cff" stop-opacity="0" />
                    </radialGradient>
                  </defs>
                  <circle :cx="GRAPH_CENTER.x" :cy="GRAPH_CENTER.y" r="290" fill="url(#networkGlow)" />
                  <path
                    v-for="edge in visibleEdges"
                    :key="`${edge.source}-${edge.target}`"
                    :d="edgePath(edge)"
                    class="network-edge"
                    :class="{
                      active: selectedNodeId === edge.source || selectedNodeId === edge.target,
                      verified: nodeById.get(edge.target)?.verified
                    }"
                  />
                </svg>

                <button
                  v-for="node in positionedNodes"
                  :key="node.id"
                  class="graph-node"
                  :class="[
                    `kind-${node.kind}`,
                    {
                      selected: selectedNodeId === node.id,
                      verified: node.verified,
                      collapsed: collapsedNodeIds.has(node.id),
                      searchable: normalizedQuery && matchedNodeIds.has(node.id)
                    }
                  ]"
                  :style="{ ...nodeStyle(node), '--track': activeTrack.color }"
                  :aria-label="`${node.label}，${node.kind}，${hasChildren(node.id) ? (collapsedNodeIds.has(node.id) ? '已折叠' : '已展开') : '叶节点'}`"
                  :aria-expanded="hasChildren(node.id) ? !collapsedNodeIds.has(node.id) : undefined"
                  :aria-pressed="selectedNodeId === node.id"
                  :title="node.path"
                  @click="selectKnowledgeNode(node)"
                >
                  <i>{{ node.kind === 'repository' ? activeTrack.symbol : node.kind === 'symbol' ? 'ƒ' : node.kind === 'section' ? '§' : node.kind === 'file' || node.kind === 'page' ? '●' : '○' }}</i>
                  <b>{{ shortLabel(node.label, node.kind === 'repository' ? 15 : 11) }}</b>
                  <small>{{ node.kind.toUpperCase() }}</small>
                  <span v-if="hasChildren(node.id)">{{ collapsedNodeIds.has(node.id) ? '+' : '−' }}</span>
                </button>
              </div>

              <div v-if="normalizedQuery && !matchedNodeIds.size" class="network-empty">
                <span>⌕</span>
                <b>没有匹配节点</b>
                <small>换一个目录、函数、文件、页面或章节名试试。</small>
              </div>

              <div class="network-guide">
                <span>{{ normalizedQuery ? 'SEARCH SUBGRAPH' : 'UPSTREAM RELATIONS' }}</span>
                <p v-if="normalizedQuery">只保留命中节点与祖先路径，帮助你从项目入口追到目标资料。</p>
                <p v-else>点击结构球可折叠分支；点击任意球在右侧查看完整路径、官方入口和反向课程。</p>
              </div>
            </div>
          </section>

          <aside v-if="selectedNode" class="atlas-inspector" aria-live="polite">
            <p class="portal-kicker">NODE INSPECTOR</p>
            <span class="atlas-status" :class="{ curated: selectedNode.verified }">{{ selectedNode.kind }}</span>
            <small>{{ selectedNode.verified ? 'VERIFIED EVIDENCE' : 'UPSTREAM STRUCTURE' }}</small>
            <h2>{{ selectedNode.label }}</h2>
            <p>{{ selectedNode.description }}</p>
            <dl>
              <div><dt>完整位置</dt><dd><code>{{ selectedNode.path }}</code></dd></div>
              <div><dt>直接子节点</dt><dd>{{ childrenByParent.get(selectedNode.id)?.length || 0 }}</dd></div>
              <div><dt>关联课程</dt><dd>{{ selectedLessons.length }}</dd></div>
              <div><dt>证据级别</dt><dd>{{ selectedNode.verified ? '精确入口已在课程中核验' : '来自官方范围的结构节点' }}</dd></div>
            </dl>
            <div class="atlas-actions">
              <a v-if="selectedNode.url" :href="selectedNode.url" target="_blank" rel="noreferrer">
                打开官方{{ mode === 'source' ? '源码' : '文档' }} ↗
              </a>
              <a v-else :href="mode === 'source' ? activeTrack.source : activeTrack.docs" target="_blank" rel="noreferrer">
                打开官方根入口 ↗
              </a>
            </div>
            <section v-if="selectedLessons.length" class="atlas-related-lessons">
              <b>反向学习入口</b>
              <NuxtLink
                v-for="lesson in selectedLessons"
                :key="lesson.id"
                :to="`/tracks/${activeTrack.id}/lessons/${lesson.id}`"
              >
                <small>{{ lesson.id }}</small>
                <span>{{ lesson.title }}</span>
                <em>→</em>
              </NuxtLink>
            </section>
            <p v-else class="atlas-hint">该节点目前没有精确映射课程，但仍可作为官方资料检索入口。</p>
          </aside>
        </div>
      </div>
    </section>
  </main>
</template>
