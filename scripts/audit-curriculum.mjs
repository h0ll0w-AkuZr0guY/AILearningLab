import { readFile, readdir } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { parseLessonMarkdown } from '../app/data/lesson-markdown.ts'
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

const countCjk = value => (value.match(/[\u3400-\u9fff]/g) || []).length
const nonEmptyLines = value => value.split('\n').filter(line => line.trim()).length

const lessonFiles = (await listMarkdownFiles(curriculumRoot))
  .filter(file => file.replace(/\\/g, '/').includes('/lessons/'))

for (const file of lessonFiles) {
  const relativePath = relative(root, file).replace(/\\/g, '/')
  const raw = await readFile(file, 'utf8')
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
