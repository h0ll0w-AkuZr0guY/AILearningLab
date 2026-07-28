import { readdir, readFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { tracks } from '../app/data/curriculum.ts'

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const guideRoot = join(root, 'app', 'data', 'guides')
const requiredFields = [
  'official',
  'overview',
  'mechanisms',
  'pitfalls',
  'example',
  'buildSteps',
  'selfCheckQuestion',
  'selfCheckAnswer'
]

async function listTypeScriptFiles(directory) {
  const result = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolute = join(directory, entry.name)
    if (entry.isDirectory()) result.push(...await listTypeScriptFiles(absolute))
    else if (entry.isFile() && entry.name.endsWith('.ts')) result.push(absolute)
  }
  return result
}

function topLevelTitles(source) {
  return [...source.matchAll(/^  '([^']+)': \{$/gm)].map(match => match[1])
}

function topLevelGuideBlocks(source) {
  const matches = [...source.matchAll(/^  '([^']+)': \{$/gm)]
  return matches.map((match, index) => ({
    title: match[1],
    source: source.slice(match.index, matches[index + 1]?.index ?? source.length)
  }))
}

function sliceField(block, field, nextFields) {
  const start = block.indexOf(`    ${field}:`)
  if (start < 0) return ''
  const ends = nextFields
    .map(next => block.indexOf(`    ${next}:`, start + field.length + 5))
    .filter(index => index >= 0)
  return block.slice(start, ends.length ? Math.min(...ends) : block.length)
}

function countCjk(value) {
  return (value.match(/[\u3400-\u9fff]/g) || []).length
}

function numericField(source, field) {
  const match = source.match(new RegExp(`${field}:\\s*(\\d+)`))
  return match ? Number(match[1]) : NaN
}

const lessonTitlesByTrack = new Map(
  tracks.map(track => [track.id, new Set(track.lessons.map(lesson => lesson.title))])
)
const lessonByTrackAndTitle = new Map(
  tracks.flatMap(track => track.lessons.map(lesson => [`${track.id}:${lesson.title}`, lesson]))
)
const curatedByTrack = new Map(tracks.map(track => [track.id, new Set()]))
const malformed = []

for (const file of await listTypeScriptFiles(guideRoot)) {
  const source = await readFile(file, 'utf8')
  const trackId = relative(guideRoot, file).split(/[\\/]/)[0]
  const trackTitles = lessonTitlesByTrack.get(trackId)
  if (!trackTitles) {
    malformed.push(`${relative(root, file)}: 目录名 ${trackId} 不是课程 TrackId`)
    continue
  }

  const titles = topLevelTitles(source)
  for (const title of titles) {
    if (!trackTitles.has(title)) {
      malformed.push(`${relative(root, file)}: 专题“${title}”未出现在 ${trackId} 课程表`)
      continue
    }
    curatedByTrack.get(trackId).add(title)
  }

  for (const field of requiredFields) {
    const count = [...source.matchAll(new RegExp(`^    ${field}:`, 'gm'))].length
    if (count !== titles.length) {
      malformed.push(
        `${relative(root, file)}: ${titles.length} 篇专题中 ${field} 出现 ${count} 次`
      )
    }
  }

  // Python 采用第一阶段的专题结构。从 TypeScript 开始，所有新精写课必须
  // 通过长课文密度门：分章正文、真实源码、写法变体和可核对的时间预算。
  if (trackId !== 'python') {
    for (const guide of topLevelGuideBlocks(source)) {
      const lesson = lessonByTrackAndTitle.get(`${trackId}:${guide.title}`)
      if (!lesson) continue

      for (const field of ['source', 'chapters', 'variants', 'studyPlan']) {
        if (!new RegExp(`^    ${field}:`, 'm').test(guide.source)) {
          malformed.push(`${relative(root, file)}: “${guide.title}”缺少长课文必填字段 ${field}`)
        }
      }

      const chapterSource = sliceField(guide.source, 'chapters', ['mechanisms', 'pitfalls', 'variants', 'studyPlan', 'example'])
      const variantSource = sliceField(guide.source, 'variants', ['studyPlan', 'example', 'buildSteps'])
      const sourceField = sliceField(guide.source, 'source', ['overview', 'chapters', 'mechanisms'])
      const buildStepSource = sliceField(guide.source, 'buildSteps', ['selfCheckQuestion', 'selfCheckAnswer'])
      const chapterCount = [...chapterSource.matchAll(/\btitle:\s*['"`]/g)].length
      const variantCount = [...variantSource.matchAll(/\btitle:\s*['"`]/g)].length
      const walkthroughCount = [...sourceField.matchAll(/^\s{8}['"`]/gm)].length
      const buildStepCount = [...buildStepSource.matchAll(/\btitle:\s*['"`]/g)].length
      const sourceCode = sourceField.match(/\bcode:\s*`([\s\S]*?)`/)?.[1] || ''
      const sourceCodeLines = sourceCode ? sourceCode.split('\n').filter(line => line.trim()).length : 0
      const cjkCount = countCjk(guide.source)
      const expert = lesson.difficulty === '专家'
      const minChapters = expert ? 7 : 5
      const plan = sliceField(guide.source, 'studyPlan', ['example', 'buildSteps'])
      const readingMinutes = numericField(plan, 'readingMinutes')
      // 深度阅读按每分钟至少 70 个中文字符校准。该阈值远低于普通中文
      // 浏览速度，因为读者还要停下来手推、看代码和做章内实验，但足以阻止
      // “预计 45 分钟、正文只有几段摘要”的虚假时间预算。
      const minCjk = Math.max(expert ? 2800 : 2000, readingMinutes * 70)
      const minBuildSteps = expert ? 6 : 5
      const minSourceLines = expert ? 20 : 14

      if (chapterCount < minChapters) {
        malformed.push(`${relative(root, file)}: “${guide.title}”正文仅 ${chapterCount} 章，${lesson.difficulty}课至少需要 ${minChapters} 章`)
      }
      if (variantCount < 2) {
        malformed.push(`${relative(root, file)}: “${guide.title}”仅 ${variantCount} 个写法/设计变体，至少需要 2 个`)
      }
      if (walkthroughCount < 4) {
        malformed.push(`${relative(root, file)}: “${guide.title}”源码逐段讲解仅 ${walkthroughCount} 步，至少需要 4 步`)
      }
      if (cjkCount < minCjk) {
        malformed.push(`${relative(root, file)}: “${guide.title}”中文内容约 ${cjkCount} 字，按 ${readingMinutes} 分钟正文预算至少需要 ${minCjk} 字`)
      }
      if (buildStepCount < minBuildSteps) {
        malformed.push(`${relative(root, file)}: “${guide.title}”仅 ${buildStepCount} 个复现积木，${lesson.difficulty}课至少需要 ${minBuildSteps} 个`)
      }
      if (sourceCodeLines < minSourceLines) {
        malformed.push(`${relative(root, file)}: “${guide.title}”真实源码节选仅 ${sourceCodeLines} 行，${lesson.difficulty}课至少需要 ${minSourceLines} 行`)
      }

      const plannedMinutes = ['readingMinutes', 'sourceMinutes', 'practiceMinutes', 'reviewMinutes']
        .map(field => numericField(plan, field))
        .reduce((sum, value) => sum + value, 0)
      if (!Number.isFinite(plannedMinutes) || plannedMinutes !== lesson.estimatedMinutes) {
        malformed.push(`${relative(root, file)}: “${guide.title}”四段时间合计 ${plannedMinutes}，应与预计 ${lesson.estimatedMinutes} 分钟一致`)
      }
    }
  }
}

// 早期精写内容仍有两处位于分轨 guide 目录外。只按真实课程题名计入，
// 等迁移完成后可删除兼容读取。
const legacyTopicGuides = await readFile(join(root, 'app', 'data', 'topic-guides.ts'), 'utf8')
const pythonTitles = lessonTitlesByTrack.get('python')
for (const title of topLevelTitles(legacyTopicGuides)) {
  if (pythonTitles.has(title)) curatedByTrack.get('python').add(title)
}

const legacyContent = await readFile(join(root, 'app', 'data', 'lesson-content.ts'), 'utf8')
const transformerTitles = lessonTitlesByTrack.get('transformer')
for (const title of topLevelTitles(legacyContent)) {
  if (transformerTitles.has(title)) curatedByTrack.get('transformer').add(title)
}
for (const match of legacyContent.matchAll(/track\.id === '([^']+)' && lesson\.title === '([^']+)'/g)) {
  const [, trackId, title] = match
  if (lessonTitlesByTrack.get(trackId)?.has(title)) curatedByTrack.get(trackId).add(title)
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
