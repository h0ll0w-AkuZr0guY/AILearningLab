import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { loadCurriculumFromDisk } from './lib/load-curriculum.mjs'

const [, , trackId, lessonId] = process.argv
const preview = process.argv.includes('--stdout')
if (!trackId || !lessonId) {
  console.error('用法：corepack pnpm curriculum:new <track-id> <lesson-id>')
  process.exit(1)
}

const root = process.cwd()
const { tracks } = await loadCurriculumFromDisk(root)
const track = tracks.find(item => item.id === trackId)
const lesson = track?.lessons.find(item => item.id === lessonId)
if (!track || !lesson) {
  console.error(`模块目录中找不到 ${trackId}/${lessonId}`)
  process.exit(1)
}

if (!preview && lesson.status !== 'claimed') {
  console.error(`${trackId}/${lessonId} 当前状态为 ${lesson.status}；请先在模块 catalog.md 中认领并填写 owner`)
  process.exit(1)
}

const output = join(
  root,
  'content',
  'curriculum',
  trackId,
  String(lesson.moduleOrder).padStart(2, '0'),
  'lessons',
  `${lessonId}.md`
)
if (!preview) {
  try {
    await access(output)
    console.error(`${output} 已存在；脚手架不会覆盖课程内容`)
    process.exit(1)
  } catch {
    // 文件不存在时才创建。
  }
}

const readingMinutes = Math.max(10, Math.round(lesson.estimatedMinutes * 0.3))
const sourceMinutes = Math.max(8, Math.round(lesson.estimatedMinutes * 0.22))
const practiceMinutes = Math.max(10, Math.round(lesson.estimatedMinutes * 0.35))
const reviewMinutes = lesson.estimatedMinutes - readingMinutes - sourceMinutes - practiceMinutes
const exampleLanguage = trackId === 'typescript' ? 'typescript' : trackId === 'nuxt' ? 'vue' : 'python'
const templatePath = join(root, 'content', 'templates', 'deep-lesson.md')
const template = await readFile(templatePath, 'utf8')
const replacements = {
  LESSON_ID: lesson.id,
  TRACK_ID: track.id,
  LESSON_TITLE: lesson.title,
  EXAMPLE_LANGUAGE: exampleLanguage,
  SOURCE_LANGUAGE: 'text',
  READING_MINUTES: String(readingMinutes),
  SOURCE_MINUTES: String(sourceMinutes),
  PRACTICE_MINUTES: String(practiceMinutes),
  REVIEW_MINUTES: String(reviewMinutes)
}

const content = Object.entries(replacements).reduce(
  (result, [key, value]) => result.replaceAll(`{{${key}}}`, value),
  template
)

if (preview) {
  console.log(content)
} else {
  await mkdir(dirname(output), { recursive: true })
  await writeFile(output, content, 'utf8')
  console.log(`已从公共模板创建 ${output}`)
}
