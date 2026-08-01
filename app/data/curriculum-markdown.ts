export type TrackId =
  | 'python'
  | 'typescript'
  | 'langchain'
  | 'langgraph'
  | 'deepagents'
  | 'nuxt'
  | 'transformer'
  | 'torch'
  | 'vllm'
  | 'lora'

export type LessonDifficulty = '简单' | '中等' | '困难' | '专家'
export type LearningValue = '基础必修' | '高频核心' | '进阶关键' | '专项拓展' | '工程扩展'
export type LessonGranularity = '合并基础课' | '合并精讲' | '单点精讲' | '拆分专题'
export type LessonStatus = 'pending' | 'claimed' | 'curated'

export interface Lesson {
  id: string
  order: number
  title: string
  module: string
  moduleOrder: number
  objective: string
  practice: string
  interview: string
  docs: string
  source: string
  why: string
  sourceFocus: string
  rebuild: string
  interviewSource: string
  difficulty: LessonDifficulty
  difficultyReason: string
  learningValue: LearningValue
  learningValueScore: 1 | 2 | 3 | 4 | 5
  estimatedMinutes: number
  granularity: LessonGranularity
  status: LessonStatus
  owner?: string
}

export interface CurriculumModule {
  id: string
  order: number
  title: string
  goal: string
  lab: string
  interview: string
  officialScope: string
  sourceScope: string
  planningStatus: 'draft' | 'established'
  lessons: Lesson[]
  catalogPath: string
}

export interface Track {
  id: TrackId
  order: number
  name: string
  symbol: string
  description: string
  color: string
  docs: string
  source: string
  interviewSource: string
  modules: CurriculumModule[]
  lessons: Lesson[]
}

export interface TrackMarkdownDocument extends Omit<Track, 'modules' | 'lessons'> {
  path: string
}

export interface ModuleMarkdownDocument {
  path: string
  track: TrackId
  id: string
  order: number
  title: string
  goal: string
  lab: string
  interview: string
  officialScope: string
  sourceScope: string
  planningStatus: 'draft' | 'established'
  topics: Array<{
    id: string
    title: string
    status: LessonStatus
    owner?: string
    difficulty: LessonDifficulty
    difficultyReason: string
    learningValue: LearningValue
    learningValueScore: 1 | 2 | 3 | 4 | 5
    estimatedMinutes: number
    granularity: LessonGranularity
  }>
}

interface HeadingBlock {
  title: string
  body: string
}

const TRACK_IDS = new Set<TrackId>([
  'python',
  'typescript',
  'langchain',
  'langgraph',
  'deepagents',
  'nuxt',
  'transformer',
  'torch',
  'vllm',
  'lora'
])
const LESSON_STATUSES = new Set<LessonStatus>(['pending', 'claimed', 'curated'])

const normalize = (value: string) => value.replace(/\r\n?/g, '\n').trim()

const parseScalar = (value: string) => {
  const trimmed = value.trim()
  if (!trimmed) return ''
  try {
    return JSON.parse(trimmed)
  } catch {
    return trimmed
  }
}

const fields = (source: string) => {
  const result: Record<string, string | number> = {}
  for (const line of source.split('\n')) {
    const match = line.match(/^([A-Za-z][A-Za-z0-9]*):\s*(.*)$/)
    if (match) result[match[1]] = parseScalar(match[2])
  }
  return result
}

const splitHeadings = (source: string, level: number): HeadingBlock[] => {
  const marker = '#'.repeat(level)
  const result: HeadingBlock[] = []
  let current: HeadingBlock | undefined

  for (const line of source.split('\n')) {
    const heading = line.match(new RegExp(`^${marker} (.+)$`))
    if (heading) {
      if (current) result.push({ ...current, body: normalize(current.body) })
      current = { title: heading[1].trim(), body: '' }
    } else if (current) {
      current.body += `${line}\n`
    }
  }

  if (current) result.push({ ...current, body: normalize(current.body) })
  return result
}

const frontmatter = (raw: string, path: string) => {
  const source = raw.replace(/\r\n?/g, '\n')
  const match = source.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  if (!match) throw new Error(`${path}: 缺少 frontmatter`)
  return { meta: fields(match[1]), body: match[2] }
}

const requiredString = (value: unknown, field: string, path: string) => {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${path}: 缺少 ${field}`)
  return value.trim()
}

const requiredNumber = (value: unknown, field: string, path: string) => {
  const number = Number(value)
  if (!Number.isFinite(number) || number <= 0) throw new Error(`${path}: ${field} 必须是正数`)
  return number
}

const trackId = (value: unknown, path: string) => {
  const id = requiredString(value, 'track/id', path) as TrackId
  if (!TRACK_IDS.has(id)) throw new Error(`${path}: 未知路线 ${id}`)
  return id
}

export function parseTrackMarkdown(raw: string, path: string): TrackMarkdownDocument {
  const { meta } = frontmatter(raw, path)
  return {
    path,
    id: trackId(meta.id, path),
    order: requiredNumber(meta.order, 'order', path),
    name: requiredString(meta.name, 'name', path),
    symbol: requiredString(meta.symbol, 'symbol', path),
    color: requiredString(meta.color, 'color', path),
    description: requiredString(meta.description, 'description', path),
    docs: requiredString(meta.docs, 'docs', path),
    source: requiredString(meta.source, 'source', path),
    interviewSource: requiredString(meta.interviewSource, 'interviewSource', path)
  }
}

export function parseModuleMarkdown(raw: string, path: string): ModuleMarkdownDocument {
  const { meta, body } = frontmatter(raw, path)
  const currentTrack = trackId(meta.track, path)
  const planningStatus = requiredString(meta.planningStatus, 'planningStatus', path)
  if (planningStatus !== 'draft' && planningStatus !== 'established') {
    throw new Error(`${path}: planningStatus 必须是 draft 或 established`)
  }

  const topics = splitHeadings(body, 2).map(block => {
    const topic = fields(block.body)
    const status = requiredString(topic.status, `${block.title}.status`, path) as LessonStatus
    if (!LESSON_STATUSES.has(status)) throw new Error(`${path}: ${block.title} 的 status 无效`)
    const owner = typeof topic.owner === 'string' && topic.owner.trim() ? topic.owner.trim() : undefined
    if (status === 'claimed' && !owner) throw new Error(`${path}: ${block.title} 已认领但缺少 owner`)
    if (status !== 'claimed' && owner) throw new Error(`${path}: ${block.title} 仅在 claimed 状态允许 owner`)

    return {
      id: block.title,
      title: requiredString(topic.title, `${block.title}.title`, path),
      status,
      owner,
      difficulty: requiredString(topic.difficulty, `${block.title}.difficulty`, path) as LessonDifficulty,
      difficultyReason: requiredString(topic.difficultyReason, `${block.title}.difficultyReason`, path),
      learningValue: requiredString(topic.learningValue, `${block.title}.learningValue`, path) as LearningValue,
      learningValueScore: requiredNumber(topic.learningValueScore, `${block.title}.learningValueScore`, path) as 1 | 2 | 3 | 4 | 5,
      estimatedMinutes: requiredNumber(topic.estimatedMinutes, `${block.title}.estimatedMinutes`, path),
      granularity: requiredString(topic.granularity, `${block.title}.granularity`, path) as LessonGranularity
    }
  })

  if (!topics.length && planningStatus !== 'draft') throw new Error(`${path}: 模块目录没有课题；草案模块允许零课题`)
  return {
    path,
    track: currentTrack,
    id: requiredString(meta.id, 'id', path),
    order: requiredNumber(meta.order, 'order', path),
    title: requiredString(meta.title, 'title', path),
    goal: requiredString(meta.goal, 'goal', path),
    lab: requiredString(meta.lab, 'lab', path),
    interview: requiredString(meta.interview, 'interview', path),
    officialScope: requiredString(meta.officialScope, 'officialScope', path),
    sourceScope: requiredString(meta.sourceScope, 'sourceScope', path),
    planningStatus,
    topics
  }
}

export function buildCurriculum(
  trackDocuments: TrackMarkdownDocument[],
  moduleDocuments: ModuleMarkdownDocument[]
): Track[] {
  const trackIds = new Set<string>()
  const trackOrders = new Set<number>()
  const lessonIds = new Set<string>()

  return [...trackDocuments]
    .sort((left, right) => left.order - right.order)
    .map(trackDocument => {
      if (trackIds.has(trackDocument.id)) throw new Error(`路线 id 重复：${trackDocument.id}`)
      if (trackOrders.has(trackDocument.order)) throw new Error(`路线顺序重复：${trackDocument.order}`)
      trackIds.add(trackDocument.id)
      trackOrders.add(trackDocument.order)

      let lessonOrder = 0
      const moduleOrders = new Set<number>()
      const modules = moduleDocuments
        .filter(module => module.track === trackDocument.id)
        .sort((left, right) => left.order - right.order)
        .map(module => {
          if (moduleOrders.has(module.order)) {
            throw new Error(`${trackDocument.id}: 模块顺序重复 ${module.order}`)
          }
          moduleOrders.add(module.order)

          const lessons = module.topics.map(topic => {
            if (lessonIds.has(topic.id)) throw new Error(`课程 id 重复：${topic.id}`)
            lessonIds.add(topic.id)
            return {
              ...topic,
              order: ++lessonOrder,
              module: module.title,
              moduleOrder: module.order,
              objective: `${module.goal} 本节将聚焦「${topic.title}」，要求你能给出机制解释、最小反例与工程取舍。`,
              practice: `${module.lab} 本题任务：围绕「${topic.title}」写出一个最小可运行实现，并补齐至少三个边界用例。`,
              interview: `${module.interview} 请结合「${topic.title}」用“结论 → 机制 → 证据 → 取舍”四步作答。`,
              docs: trackDocument.docs,
              source: trackDocument.source,
              why: `「${topic.title}」并非孤立 API。它位于「${module.title}」的设计边界上：${module.goal} 你需要解释这个抽象替代了什么更脆弱的写法，以及它在复杂系统中换来了什么可维护性、可观测性或性能收益。`,
              sourceFocus: `从 ${module.sourceScope} 开始，先搜索 “${topic.title}” 或相邻公开 API；优先阅读测试，再阅读调用点，最后进入核心实现。`,
              rebuild: `先只保留「${topic.title}」的最小接口和状态；再实现成功路径；随后加入一个明确的失败路径与测试；最后对照上游实现，记录你遗漏的一条不变量。`,
              interviewSource: trackDocument.interviewSource
            }
          })

          return {
            id: module.id,
            order: module.order,
            title: module.title,
            goal: module.goal,
            lab: module.lab,
            interview: module.interview,
            officialScope: module.officialScope,
            sourceScope: module.sourceScope,
            planningStatus: module.planningStatus,
            catalogPath: module.path,
            lessons
          }
        })

      if (!modules.length) throw new Error(`${trackDocument.path}: 路线没有模块`)
      return {
        id: trackDocument.id,
        order: trackDocument.order,
        name: trackDocument.name,
        symbol: trackDocument.symbol,
        color: trackDocument.color,
        description: trackDocument.description,
        docs: trackDocument.docs,
        source: trackDocument.source,
        interviewSource: trackDocument.interviewSource,
        modules,
        lessons: modules.flatMap(module => module.lessons)
      }
    })
}
