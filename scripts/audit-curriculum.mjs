import { access, readFile, readdir } from 'node:fs/promises'
import { join, relative } from 'node:path'
import {
  parseLessonMarkdown,
  parseVisualMarkdown
} from '../app/data/lesson-markdown.ts'
import { loadCurriculumFromDisk } from './lib/load-curriculum.mjs'

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const curriculumRoot = join(root, 'content', 'curriculum')
const malformed = []
const { tracks, trackDocuments, moduleDocuments } = await loadCurriculumFromDisk(root)

async function listMarkdownFiles(directory) {
  const result = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolute = join(directory, entry.name)
    if (entry.isDirectory()) result.push(...await listMarkdownFiles(absolute))
    else if (entry.isFile() && entry.name.endsWith('.md')) result.push(absolute)
  }
  return result
}

const lessonByTrackAndId = new Map(
  tracks.flatMap(track =>
    track.lessons.map(lesson => [`${track.id}:${lesson.id}`, { track, lesson }])
  )
)
const curatedByTrack = new Map(tracks.map(track => [track.id, new Set()]))
const seenTitles = new Set()
const seenIds = new Set()
const lessonDocumentsByKey = new Map()
const visualDocumentsByKey = new Map()

const countCjk = value => (value.match(/[\u3400-\u9fff]/g) || []).length
const nonEmptyLines = value => value.split('\n').filter(line => line.trim()).length

const lessonFiles = (await listMarkdownFiles(curriculumRoot))
  .filter(file => file.replace(/\\/g, '/').includes('/lessons/'))

for (const file of lessonFiles) {
  const relativePath = relative(root, file).replace(/\\/g, '/')
  const raw = await readFile(file, 'utf8')
  if (/^## 视觉实验$/m.test(raw)) {
    malformed.push(`${relativePath}: 视觉实验必须移入同模块 visuals/<lesson-id>.md`)
  }
  if (/\bTODO\b|\{\{[A-Z_]+\}\}/.test(raw)) {
    malformed.push(`${relativePath}: 仍含公共模板占位符`)
  }
  let document
  try {
    document = parseLessonMarkdown(raw, relativePath)
  } catch (error) {
    malformed.push(error.message)
    continue
  }

  const key = `${document.track}:${document.id}`
  const titleKey = `${document.track}:${document.title}`
  const curriculumEntry = lessonByTrackAndId.get(key)
  if (!curriculumEntry) {
    malformed.push(`${relativePath}: ${key} 未出现在课程表`)
    continue
  }
  lessonDocumentsByKey.set(key, { document, relativePath, curriculumEntry })

  if (seenIds.has(key)) malformed.push(`${relativePath}: 课程 id 重复 ${key}`)
  if (seenTitles.has(titleKey)) malformed.push(`${relativePath}: 课程题名重复 ${titleKey}`)
  seenIds.add(key)
  seenTitles.add(titleKey)

  const expectedPath = `content/curriculum/${document.track}/${String(curriculumEntry.lesson.moduleOrder).padStart(2, '0')}/lessons/${document.id}.md`
  if (relativePath !== expectedPath) {
    malformed.push(`${relativePath}: 文件路径应为 ${expectedPath}`)
  }
  if (document.title !== curriculumEntry.lesson.title) {
    malformed.push(
      `${relativePath}: frontmatter 题名“${document.title}”与课程表“${curriculumEntry.lesson.title}”不一致`
    )
  }

  const guide = document.guide
  if (guide.overview.length < 2) malformed.push(`${relativePath}: 导读至少需要 2 段`)
  if (!guide.example.trim()) malformed.push(`${relativePath}: 缺少可运行示例`)

  if (document.depth === 'deep') {
    for (const [field, value] of [
      ['官方入口', guide.official],
      ['真实源码', guide.source],
      ['分章正文', guide.chapters?.length],
      ['核心机制', guide.mechanisms?.length],
      ['常见误区', guide.pitfalls?.length],
      ['实现变体', guide.variants?.length],
      ['学习时间', guide.studyPlan],
      ['搭积木复现', guide.buildSteps?.length],
      ['自检问题', guide.selfCheckQuestion],
      ['站内答案', guide.selfCheckAnswer]
    ]) {
      if (!value) malformed.push(`${relativePath}: 深度课程缺少 ${field}`)
    }

    const lesson = curriculumEntry.lesson
    const expert = lesson.difficulty === '专家'
    const chapterCount = guide.chapters?.length || 0
    const variantCount = guide.variants?.length || 0
    const walkthroughCount = guide.source?.walkthrough.length || 0
    const buildStepCount = guide.buildSteps?.length || 0
    const sourceCodeLines = nonEmptyLines(guide.source?.code || '')
    const readingMinutes = guide.studyPlan?.readingMinutes || 0
    const minCjk = Math.max(expert ? 2800 : 2000, readingMinutes * 70)

    if (chapterCount < (expert ? 7 : 5)) {
      malformed.push(`${relativePath}: ${lesson.difficulty}课正文仅 ${chapterCount} 章`)
    }
    if (variantCount < 2) malformed.push(`${relativePath}: 实现变体仅 ${variantCount} 个`)
    if (walkthroughCount < 4) malformed.push(`${relativePath}: 源码逐段讲解仅 ${walkthroughCount} 步`)
    if (buildStepCount < (expert ? 6 : 5)) {
      malformed.push(`${relativePath}: 复现积木仅 ${buildStepCount} 个`)
    }
    if (sourceCodeLines < (expert ? 20 : 14)) {
      malformed.push(`${relativePath}: 真实源码节选仅 ${sourceCodeLines} 行`)
    }
    if (countCjk(raw) < minCjk) {
      malformed.push(`${relativePath}: 中文内容不足 ${minCjk} 字`)
    }

    const plannedMinutes = guide.studyPlan
      ? Object.values(guide.studyPlan).reduce((sum, value) => sum + value, 0)
      : 0
    if (plannedMinutes !== lesson.estimatedMinutes) {
      malformed.push(
        `${relativePath}: 四段时间合计 ${plannedMinutes}，应为 ${lesson.estimatedMinutes}`
      )
    }
  }

  if (curriculumEntry.lesson.status === 'pending') {
    malformed.push(`${relativePath}: pending 课题不应已有正文，请先认领`)
  }
  if (curriculumEntry.lesson.status === 'curated') {
    curatedByTrack.get(document.track).add(document.id)
  }
}

const visualFiles = (await listMarkdownFiles(curriculumRoot))
  .filter(file => file.replace(/\\/g, '/').includes('/visuals/'))

for (const file of visualFiles) {
  const relativePath = relative(root, file).replace(/\\/g, '/')
  const raw = await readFile(file, 'utf8')
  let visualDocument
  try {
    visualDocument = parseVisualMarkdown(raw, relativePath)
  } catch (error) {
    malformed.push(error.message)
    continue
  }

  const key = `${visualDocument.track}:${visualDocument.lesson}`
  const lessonRecord = lessonDocumentsByKey.get(key)
  if (!lessonRecord) {
    malformed.push(`${relativePath}: 找不到对应课程正文 ${key}`)
    continue
  }
  if (visualDocumentsByKey.has(key)) {
    malformed.push(`${relativePath}: 一个试题只能有一个视觉索引文件 ${key}`)
    continue
  }
  visualDocumentsByKey.set(key, { visualDocument, relativePath })

  const { document, curriculumEntry } = lessonRecord
  if (curriculumEntry.lesson.status !== 'curated') {
    malformed.push(`${relativePath}: pending 课题不应提前登记视觉资源`)
  }
  const expectedPath = `content/curriculum/${document.track}/${String(curriculumEntry.lesson.moduleOrder).padStart(2, '0')}/visuals/${document.id}.md`
  if (relativePath !== expectedPath) {
    malformed.push(`${relativePath}: 视觉索引路径应为 ${expectedPath}`)
  }
  const expectedIndex = `../visuals/${document.id}.md`
  if (document.visualIndex !== expectedIndex) {
    malformed.push(`${relativePath}: 课程 frontmatter 应登记 visualIndex: "${expectedIndex}"`)
  }
  if (visualDocument.decision.replace(/\s+/g, '').length < 24) {
    malformed.push(`${relativePath}: decision 必须说明视觉解决的具体学习障碍`)
  }

  const visualIds = new Set()
  for (const visual of visualDocument.visuals) {
    if (visualIds.has(visual.id)) {
      malformed.push(`${relativePath}: 视觉实验 id 重复 ${visual.id}`)
    }
    visualIds.add(visual.id)
    if (!visual.id.startsWith(`${document.id}-`)) {
      malformed.push(`${relativePath}: 视觉 id ${visual.id} 必须以 ${document.id}- 开头`)
    }
    const chapter = visual.placement.match(/^chapter:(\d+)$/)?.[1]
    if (chapter && Number(chapter) > (document.guide.chapters?.length || 0)) {
      malformed.push(`${relativePath}: placement ${visual.placement} 超出正文章数`)
    }
    if (visual.summary.length < 20) {
      malformed.push(`${relativePath}: 视觉实验 ${visual.id} 的 summary 过短`)
    }
    if (visual.caption.length < 20) {
      malformed.push(`${relativePath}: 视觉实验 ${visual.id} 的 caption 过短`)
    }
    if (!visual.observations.length) {
      malformed.push(`${relativePath}: 视觉实验 ${visual.id} 缺少观察重点`)
    }
    if (visual.kind === 'image') {
      const assetPrefix = `/visuals/${document.track}/${document.id}/`
      if (!visual.asset?.startsWith(assetPrefix)) {
        malformed.push(`${relativePath}: 图片 ${visual.id} 必须存入 ${assetPrefix}`)
      } else {
        try {
          await access(join(root, 'public', visual.asset.replace(/^\/+/, '')))
        } catch {
          malformed.push(`${relativePath}: 图片视觉 ${visual.id} 的资源不存在 ${visual.asset}`)
        }
      }
      if (!visual.alt || countCjk(visual.alt) < 12) {
        malformed.push(`${relativePath}: 图片视觉 ${visual.id} 缺少有效中文 alt`)
      }
      if (!visual.credit) {
        malformed.push(`${relativePath}: 图片视觉 ${visual.id} 缺少生成或来源说明`)
      }
    } else {
      if (visual.steps.length < 3) {
        malformed.push(`${relativePath}: 视觉实验 ${visual.id} 少于 3 个可交互步骤`)
      }
      if (!visual.actionLabel) {
        malformed.push(`${relativePath}: 视觉实验 ${visual.id} 缺少 actionLabel`)
      }
      const labels = new Set()
      for (const step of visual.steps) {
        if (labels.has(step.label)) {
          malformed.push(`${relativePath}: 视觉实验 ${visual.id} 的步骤标签重复 ${step.label}`)
        }
        labels.add(step.label)
        if (step.detail.replace(/\s+/g, '').length < 12) {
          malformed.push(`${relativePath}: 视觉实验 ${visual.id} 的步骤“${step.label}”解释过短`)
        }
      }
    }
    if (visual.component) {
      if (visual.kind !== 'playground') {
        malformed.push(`${relativePath}: 自定义视觉组件 ${visual.component} 只能用于 playground`)
      }
      if (!new RegExp(`^${document.id}/[a-z0-9-]+$`).test(visual.component)) {
        malformed.push(`${relativePath}: 自定义组件必须位于 ${document.id}/ 下`)
      } else {
        try {
          await access(join(
            root,
            'app',
            'components',
            'lesson-visuals',
            ...visual.component.split('/')
          ) + '.vue')
        } catch {
          malformed.push(`${relativePath}: 自定义视觉组件不存在 ${visual.component}`)
        }
      }
    }
  }
}

for (const [key, lessonRecord] of lessonDocumentsByKey) {
  if (lessonRecord.document.visualIndex && !visualDocumentsByKey.has(key)) {
    malformed.push(`${lessonRecord.relativePath}: visualIndex 指向的视觉索引不存在`)
  }
  if (!lessonRecord.document.visualIndex && visualDocumentsByKey.has(key)) {
    malformed.push(`${lessonRecord.relativePath}: 缺少 visualIndex 双向索引`)
  }
}

for (const track of tracks) {
  for (const lesson of track.lessons) {
    const key = `${track.id}:${lesson.id}`
    if (lesson.status === 'curated' && !seenIds.has(key)) {
      malformed.push(`${track.id}/${lesson.id}: catalog 标记 curated，但缺少课程正文`)
    }
  }
}

if (trackDocuments.length !== tracks.length) {
  malformed.push(`路线注册数量异常：读取 ${trackDocuments.length}，构建 ${tracks.length}`)
}
if (moduleDocuments.length !== tracks.reduce((sum, track) => sum + track.modules.length, 0)) {
  malformed.push('模块注册数量与构建结果不一致')
}

const rows = tracks.map(track => {
  const curated = curatedByTrack.get(track.id).size
  return {
    track: track.name,
    lessons: track.lessons.length,
    curated,
    pending: track.lessons.length - curated,
    coverage: `${(curated / track.lessons.length * 100).toFixed(1)}%`
  }
})

console.table(rows)
const totals = rows.reduce(
  (sum, row) => ({
    lessons: sum.lessons + row.lessons,
    curated: sum.curated + row.curated,
    pending: sum.pending + row.pending
  }),
  { lessons: 0, curated: 0, pending: 0 }
)
console.log(`全站：${totals.curated}/${totals.lessons} 已精写，${totals.pending} 待完成`)

if (malformed.length) {
  console.error('\n内容结构错误：')
  for (const error of malformed) console.error(`- ${error}`)
  process.exitCode = 1
}

if (process.argv.includes('--strict') && totals.pending > 0) {
  console.error('\n严格审计未通过：仍有课程未完成深度精写。')
  process.exitCode = 1
}
