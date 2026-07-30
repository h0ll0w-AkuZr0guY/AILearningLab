import { readFile, readdir } from 'node:fs/promises'
import { join, relative } from 'node:path'
import {
  buildCurriculum,
  parseModuleMarkdown,
  parseTrackMarkdown
} from '../../app/data/curriculum-markdown.ts'

async function listFiles(directory, fileName) {
  const result = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolute = join(directory, entry.name)
    if (entry.isDirectory()) result.push(...await listFiles(absolute, fileName))
    else if (entry.isFile() && entry.name === fileName) result.push(absolute)
  }
  return result
}

export async function loadCurriculumFromDisk(root) {
  const curriculumRoot = join(root, 'content', 'curriculum')
  const [trackPaths, modulePaths] = await Promise.all([
    listFiles(curriculumRoot, 'track.md'),
    listFiles(curriculumRoot, 'catalog.md')
  ])
  const displayPath = path => relative(root, path).replace(/\\/g, '/')
  const trackDocuments = await Promise.all(trackPaths.map(async path =>
    parseTrackMarkdown(await readFile(path, 'utf8'), displayPath(path))
  ))
  const moduleDocuments = await Promise.all(modulePaths.map(async path =>
    parseModuleMarkdown(await readFile(path, 'utf8'), displayPath(path))
  ))

  return {
    tracks: buildCurriculum(trackDocuments, moduleDocuments),
    trackDocuments,
    moduleDocuments
  }
}
