import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { loadCurriculumFromDisk } from './lib/load-curriculum.mjs'

const [, , trackId, lessonId, owner] = process.argv
if (!trackId || !lessonId || !owner) {
  console.error('用法：corepack pnpm curriculum:claim <track-id> <lesson-id> <owner>')
  process.exit(1)
}

const root = process.cwd()
const { tracks } = await loadCurriculumFromDisk(root)
const track = tracks.find(item => item.id === trackId)
const lesson = track?.lessons.find(item => item.id === lessonId)
if (!track || !lesson) {
  console.error(`课程目录中找不到 ${trackId}/${lessonId}`)
  process.exit(1)
}
if (lesson.status === 'curated') {
  console.error(`${trackId}/${lessonId} 已完成精写，无需认领`)
  process.exit(1)
}
if (lesson.status === 'claimed' && lesson.owner !== owner) {
  console.error(`${trackId}/${lessonId} 已由 ${lesson.owner} 认领`)
  process.exit(1)
}

const catalogPath = join(
  root,
  'content',
  'curriculum',
  trackId,
  String(lesson.moduleOrder).padStart(2, '0'),
  'catalog.md'
)
const lines = (await readFile(catalogPath, 'utf8')).split(/\r?\n/)
const heading = `## ${lessonId}`
const start = lines.findIndex(line => line === heading)
if (start === -1) throw new Error(`${catalogPath}: 找不到 ${heading}`)
const endOffset = lines.slice(start + 1).findIndex(line => line.startsWith('## '))
const end = endOffset === -1 ? lines.length : start + 1 + endOffset
const statusIndex = lines.findIndex((line, index) => index > start && index < end && line.startsWith('status:'))
const ownerIndex = lines.findIndex((line, index) => index > start && index < end && line.startsWith('owner:'))
if (statusIndex === -1 || ownerIndex === -1) throw new Error(`${catalogPath}: ${lessonId} 缺少状态字段`)

lines[statusIndex] = 'status: claimed'
lines[ownerIndex] = `owner: ${JSON.stringify(owner)}`
await writeFile(catalogPath, `${lines.join('\n')}\n`, 'utf8')
console.log(`已认领 ${trackId}/${lessonId}，负责人：${owner}`)
