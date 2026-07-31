import type {
  GuideChapter,
  GuideVisual,
  GuideVisualKind,
  GuideVisualPlacement,
  GuideVariant,
  LessonMarkdownDocument,
  TopicGuide,
  VisualMarkdownDocument
} from './guide-types'
import type { TrackId } from './curriculum'

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
  let fence: string | undefined

  for (const line of source.split('\n')) {
    const fenceMatch = line.match(/^\s*(```+|~~~+)/)
    if (fenceMatch) {
      if (!fence) fence = fenceMatch[1][0]
      else if (fence === fenceMatch[1][0]) fence = undefined
    }

    const heading = !fence ? line.match(new RegExp(`^${marker} (.+)$`)) : null
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

const beforeHeading = (source: string, level: number) => {
  const marker = '#'.repeat(level)
  let fence: string | undefined
  const lines: string[] = []
  for (const line of source.split('\n')) {
    const fenceMatch = line.match(/^\s*(```+|~~~+)/)
    if (fenceMatch) {
      if (!fence) fence = fenceMatch[1][0]
      else if (fence === fenceMatch[1][0]) fence = undefined
    }
    if (!fence && line.startsWith(`${marker} `)) break
    lines.push(line)
  }
  return normalize(lines.join('\n'))
}

const paragraphs = (source: string) => normalize(source)
  .split(/\n\s*\n/)
  .map(item => item.replace(/\n/g, ' ').trim())
  .filter(Boolean)

const list = (source: string) => source
  .split('\n')
  .map(line => line.match(/^\s*-\s+(.+)$/)?.[1]?.trim())
  .filter((item): item is string => Boolean(item))

const codeFence = (source: string) => {
  const match = normalize(source).match(/^(?:[\s\S]*?\n)?```([^\n]*)\n([\s\S]*?)\n```(?:\n[\s\S]*)?$/)
  if (!match) return undefined
  return { language: match[1].trim(), code: match[2] }
}

const section = (sections: HeadingBlock[], title: string) =>
  sections.find(item => item.title === title)?.body || ''

const requiredString = (
  value: unknown,
  field: string,
  filePath: string
): string => {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${filePath}: 缺少 ${field}`)
  }
  return value.trim()
}

const optionalString = (value: unknown) =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined

const parseOfficial = (source: string) => {
  if (!source) return undefined
  const meta = fields(source)
  const note = beforeHeading(source, 3)
    .split('\n')
    .filter(line => !/^[A-Za-z][A-Za-z0-9]*:\s*/.test(line))
    .join('\n')
    .trim()
  return {
    title: String(meta.title || ''),
    url: String(meta.url || ''),
    note
  }
}

const parseSource = (source: string) => {
  if (!source) return undefined
  const meta = fields(beforeHeading(source, 3))
  const subsections = splitHeadings(source, 3)
  const excerpt = codeFence(section(subsections, '源码节选'))
  return {
    repo: String(meta.repo || ''),
    file: String(meta.file || ''),
    symbol: String(meta.symbol || ''),
    language: String(meta.language || excerpt?.language || ''),
    url: String(meta.url || ''),
    walkthrough: list(section(subsections, '逐段讲解')),
    code: excerpt?.code || ''
  }
}

const parseChapters = (source: string): GuideChapter[] => splitHeadings(source, 3)
  .map(chapter => {
    const intro = beforeHeading(chapter.body, 4)
    const meta = fields(intro)
    const body = intro
      .split('\n')
      .filter(line => !/^kicker:\s*/.test(line))
      .join('\n')
    const parts = splitHeadings(chapter.body, 4)
    const snippet = codeFence(section(parts, '代码'))
    return {
      title: chapter.title,
      kicker: optionalString(meta.kicker),
      paragraphs: paragraphs(body),
      points: list(section(parts, '要点')),
      code: snippet?.code,
      language: optionalString(snippet?.language),
      takeaway: optionalString(section(parts, '本章结论'))
    }
  })

const parseVariants = (source: string): GuideVariant[] => splitHeadings(source, 3)
  .map(variant => {
    const meta = fields(beforeHeading(variant.body, 4))
    const snippet = codeFence(section(splitHeadings(variant.body, 4), '代码'))
    return {
      title: variant.title,
      useWhen: String(meta.useWhen || ''),
      tradeoff: String(meta.tradeoff || ''),
      code: snippet?.code,
      language: optionalString(snippet?.language)
    }
  })

const parseBuildSteps = (source: string) => splitHeadings(source, 3)
  .map(step => {
    const body = beforeHeading(step.body, 4)
    const snippet = codeFence(section(splitHeadings(step.body, 4), '代码'))
    return {
      title: step.title,
      body: paragraphs(body).join('\n\n'),
      code: snippet?.code
    }
  })

const VISUAL_KINDS = new Set<GuideVisualKind>([
  'state',
  'flow',
  'graph',
  'tensor',
  'playground',
  'image'
])

const parseVisualPlacement = (
  value: unknown,
  filePath: string,
  visualIndex: number
): GuideVisualPlacement => {
  const placement = requiredString(
    value,
    `视觉实验 ${visualIndex + 1} placement`,
    filePath
  )
  if (
    placement === 'overview' ||
    placement === 'mechanisms' ||
    placement === 'build' ||
    placement === 'example' ||
    /^chapter:[1-9]\d*$/.test(placement)
  ) {
    return placement as GuideVisualPlacement
  }
  throw new Error(`${filePath}: 视觉实验 ${visualIndex + 1} 的 placement 无效`)
}

const parseVisualSteps = (source: string) => list(source)
  .map((item, index) => {
    const separator = item.indexOf('|')
    if (separator < 0) {
      return { label: `阶段 ${index + 1}`, detail: item }
    }
    return {
      label: item.slice(0, separator).trim(),
      detail: item.slice(separator + 1).trim()
    }
  })
  .filter(step => step.label && step.detail)

const parseVisuals = (source: string, filePath: string): GuideVisual[] =>
  splitHeadings(source, 3).map((block, index) => {
    const intro = beforeHeading(block.body, 4)
    const meta = fields(intro)
    const kind = String(meta.kind || '') as GuideVisualKind
    if (!VISUAL_KINDS.has(kind)) {
      throw new Error(`${filePath}: 视觉实验 ${index + 1} 的 kind 无效`)
    }
    const parts = splitHeadings(block.body, 4)
    return {
      id: requiredString(meta.id, `视觉实验 ${index + 1} id`, filePath),
      kind,
      placement: parseVisualPlacement(meta.placement, filePath, index),
      title: block.title,
      summary: requiredString(meta.summary, `视觉实验 ${index + 1} summary`, filePath),
      caption: requiredString(meta.caption, `视觉实验 ${index + 1} caption`, filePath),
      actionLabel: optionalString(meta.actionLabel),
      component: optionalString(meta.component),
      steps: parseVisualSteps(section(parts, '步骤')),
      observations: list(section(parts, '观察重点')),
      asset: optionalString(meta.asset),
      alt: optionalString(meta.alt),
      credit: optionalString(meta.credit)
    }
  })

export function parseLessonMarkdown(
  raw: string,
  filePath = '<markdown>'
): LessonMarkdownDocument {
  const source = raw.replace(/\r\n?/g, '\n')
  const frontmatter = source.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  if (!frontmatter) throw new Error(`${filePath}: 缺少 YAML frontmatter`)

  const meta = fields(frontmatter[1])
  const track = requiredString(meta.track, 'track', filePath)
  if (!TRACK_IDS.has(track as TrackId)) {
    throw new Error(`${filePath}: track ${track} 不是有效 TrackId`)
  }

  const sections = splitHeadings(frontmatter[2], 2)
  const example = codeFence(section(sections, '可运行示例'))
  const selfCheck = splitHeadings(section(sections, '自检'), 3)
  const plan = {
    readingMinutes: Number(meta.readingMinutes || 0),
    sourceMinutes: Number(meta.sourceMinutes || 0),
    practiceMinutes: Number(meta.practiceMinutes || 0),
    reviewMinutes: Number(meta.reviewMinutes || 0)
  }
  const hasPlan = Object.values(plan).some(Boolean)

  const guide: TopicGuide = {
    official: parseOfficial(section(sections, '官方入口')),
    source: parseSource(section(sections, '真实源码')),
    overview: paragraphs(section(sections, '导读')),
    chapters: parseChapters(section(sections, '分章正文')),
    mechanisms: list(section(sections, '核心机制')),
    pitfalls: list(section(sections, '常见误区')),
    variants: parseVariants(section(sections, '实现变体')),
    studyPlan: hasPlan ? plan : undefined,
    exampleLanguage: optionalString(meta.exampleLanguage) || example?.language,
    example: example?.code || '',
    buildSteps: parseBuildSteps(section(sections, '搭积木复现')),
    selfCheckQuestion: optionalString(section(selfCheck, '问题')),
    selfCheckAnswer: optionalString(section(selfCheck, '站内答案')),
    visuals: []
  }

  return {
    id: requiredString(meta.id, 'id', filePath),
    track: track as TrackId,
    title: requiredString(meta.title, 'title', filePath),
    depth: meta.depth === 'deep' ? 'deep' : 'foundation',
    visualIndex: optionalString(meta.visualIndex),
    guide
  }
}

export function parseVisualMarkdown(
  raw: string,
  filePath = '<visual-markdown>'
): VisualMarkdownDocument {
  const source = raw.replace(/\r\n?/g, '\n')
  const frontmatter = source.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  if (!frontmatter) throw new Error(`${filePath}: 缺少 YAML frontmatter`)

  const meta = fields(frontmatter[1])
  const track = requiredString(meta.track, 'track', filePath)
  if (!TRACK_IDS.has(track as TrackId)) {
    throw new Error(`${filePath}: track ${track} 不是有效 TrackId`)
  }
  const sections = splitHeadings(frontmatter[2], 2)
  return {
    lesson: requiredString(meta.lesson, 'lesson', filePath),
    track: track as TrackId,
    decision: requiredString(meta.decision, 'decision', filePath),
    visuals: parseVisuals(section(sections, '视觉实验'), filePath)
  }
}
