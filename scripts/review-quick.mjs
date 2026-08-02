// 启动前轻量检阅：目标路线 + 相邻路线 established 模块 curated 课程
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

const root = process.cwd()
const targets = process.argv.slice(2)
const problems = []

function countCJK(text) {
  const m = text.match(/[\u4e00-\u9fff]/g)
  return m ? m.length : 0
}

for (const target of targets) {
  const [track, module] = target.split('/')
  const base = join(root, 'content', 'curriculum', track, module)
  const lessonDir = join(base, 'lessons')
  const visualDir = join(base, 'visuals')
  let lessonFiles = []
  try { lessonFiles = (await readdir(lessonDir)).filter(f => f.endsWith('.md')) } catch { console.log(`!! ${target}: no lessons dir`); continue }
  let catalogText = ''
  try { catalogText = await readFile(join(base, 'catalog.md'), 'utf8') } catch { /* 无 */ }
  const catalogByLesson = {}
  if (catalogText) {
    const blocks = catalogText.split(/^## /m).slice(1)
    for (const b of blocks) {
      const id = b.match(/^([\w-]+)\r?$/m)
      const est = b.match(/^estimatedMinutes:\s*(\d+)/m)
      const status = b.match(/^status:\s*(\w+)/m)
      if (id) catalogByLesson[id[1]] = {
        estimatedMinutes: est ? parseInt(est[1]) : 0,
        status: status?.[1] || 'unknown'
      }
    }
  }
  for (const f of lessonFiles.sort()) {
    const lessonId = f.replace('.md', '')
    if (catalogByLesson[lessonId]?.status !== 'curated') continue
    const text = await readFile(join(lessonDir, f), 'utf8')
    const fm = text.match(/^---\n([\s\S]*?)\n---\n/)
    const meta = {}
    if (fm) for (const line of fm[1].split('\n')) {
      const m = line.match(/^(\w+):\s*(.+)$/)
      if (m) meta[m[1]] = m[2].trim().replace(/^"|"$/g, '')
    }
    const body = text.replace(/^---\n[\s\S]*?\n---\n/, '').replace(/```[\s\S]*?```/g, '')
    const cjk = countCJK(body)
    const reading = parseInt(meta.readingMinutes) || 0
    const density = reading > 0 ? Math.round(cjk / reading) : 0
    const sum = [meta.readingMinutes, meta.sourceMinutes, meta.practiceMinutes, meta.reviewMinutes]
      .reduce((a, b) => a + (parseInt(b) || 0), 0)
    const est = catalogByLesson[lessonId]?.estimatedMinutes ?? 0

    const officialUrlM = text.match(/^url:\s*"([^"]+)"/m)
    const officialUrl = officialUrlM ? officialUrlM[1] : ''
    const sourceBlock = text.match(/^## 真实源码\n([\s\S]*?)(?=^## )/m)
    let sourceUrl = ''
    if (sourceBlock) {
      const m = sourceBlock[1].match(/^url:\s*"([^"]+)"/m)
      if (m) sourceUrl = m[1]
    }
    const fixedVersion = /\/blob\/(?!main|master|refs\/heads\/)/.test(sourceUrl)
    const hasRange = /#L\d+-L\d+/.test(sourceUrl)
    const hasLog = text.includes('## 更新日志')

    let vText = ''
    try { vText = await readFile(join(visualDir, f), 'utf8') } catch { /* 无 */ }
    let vSteps = 0, vObs = 0, vKinds = []
    if (vText) {
      const blocks = vText.split(/\n### /).slice(1)
      for (const b of blocks) {
        const kindM = b.match(/^kind:\s*"([^"]+)"/m)
        if (kindM) vKinds.push(kindM[1])
        const sections = b.split(/\n#### /).slice(1)
        for (const s of sections) {
          const title = s.split('\n')[0]
          const lines = s.split('\n').slice(1).filter(l => l.trim().startsWith('- ')).length
          if (title.includes('步骤')) vSteps += lines
          if (title.includes('观察重点')) vObs += lines
        }
      }
    }

    const r = { lesson: lessonId, cjk, reading, density, timeSum: sum, estimatedMinutes: est,
      timeOk: sum === est, officialAnchor: officialUrl.includes('#') ? 'Y' : 'N',
      sourceFixed: fixedVersion ? 'Y' : 'N', sourceRange: hasRange ? 'Y' : 'N', hasLog: hasLog ? 'Y' : 'N',
      vKinds: vKinds.join('|') || '-', vSteps, vObsOk: vObs >= 1 ? 'Y' : 'N' }
    console.log(`${r.lesson} | cjk=${r.cjk} dens=${r.density} time=${r.timeSum}/${r.estimatedMinutes}${r.timeOk ? '✓' : '✗'} off=${r.officialAnchor} src=${r.sourceFixed}${r.sourceRange} log=${r.hasLog} vis=${r.vKinds}[${r.vSteps}步/${r.vObsOk}]`)
    if (density < 70 && cjk > 0) problems.push(`${r.lesson}: 密度 ${density}`)
    if (!r.timeOk) problems.push(`${r.lesson}: 时间 ${r.timeSum} != ${est}`)
    if (!officialUrl.includes('#')) problems.push(`${r.lesson}: 官方 URL 无锚点`)
    if (!fixedVersion || !hasRange) problems.push(`${r.lesson}: 源码 URL 版本/行区间`)
    if (!hasLog) problems.push(`${r.lesson}: 缺更新日志`)
    if (vText && vKinds.some(k => k !== 'image') && vSteps < 3) problems.push(`${r.lesson}: 视觉步数 ${vSteps}`)
    if (vText && vObs === 0) problems.push(`${r.lesson}: 视觉无观察重点`)
  }
}
console.log('\n=== 问题 ===')
if (problems.length) { for (const p of problems) console.log('P:', p) } else console.log('无问题')
