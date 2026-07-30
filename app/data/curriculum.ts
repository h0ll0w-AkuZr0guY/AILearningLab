import {
  buildCurriculum,
  parseModuleMarkdown,
  parseTrackMarkdown
} from './curriculum-markdown'

export type {
  CurriculumModule,
  LearningValue,
  Lesson,
  LessonDifficulty,
  LessonGranularity,
  LessonStatus,
  Track,
  TrackId
} from './curriculum-markdown'

const trackFiles = import.meta.glob('../../content/curriculum/*/track.md', {
  eager: true,
  import: 'default',
  query: '?raw'
}) as Record<string, string>

const moduleFiles = import.meta.glob('../../content/curriculum/*/*/catalog.md', {
  eager: true,
  import: 'default',
  query: '?raw'
}) as Record<string, string>

export const tracks = buildCurriculum(
  Object.entries(trackFiles).map(([path, raw]) => parseTrackMarkdown(raw, path)),
  Object.entries(moduleFiles).map(([path, raw]) => parseModuleMarkdown(raw, path))
)

export const getTrack = (id: string) => tracks.find(track => track.id === id)
export const getLesson = (trackId: string, lessonId: string) =>
  getTrack(trackId)?.lessons.find(lesson => lesson.id === lessonId)
