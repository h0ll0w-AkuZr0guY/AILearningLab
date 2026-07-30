import { getLesson, type TrackId } from './curriculum'
import type { LessonMarkdownDocument, TopicGuide } from './guide-types'
import { parseLessonMarkdown } from './lesson-markdown'

export type {
  GuideChapter,
  GuideStudyPlan,
  GuideVariant,
  LessonMarkdownDocument,
  TopicGuide
} from './guide-types'

const markdownFiles = import.meta.glob('../../content/curriculum/*/*/lessons/*.md', {
  eager: true,
  import: 'default',
  query: '?raw'
}) as Record<string, string>

const parsedLessonDocuments: LessonMarkdownDocument[] = Object.entries(markdownFiles)
  .map(([path, raw]) => parseLessonMarkdown(raw, path))
  .sort((left, right) => left.id.localeCompare(right.id))

export const lessonDocuments = parsedLessonDocuments.filter(document =>
  getLesson(document.track, document.id)?.status === 'curated'
)

export const topicGuides: Partial<Record<TrackId, Record<string, TopicGuide>>> = {}
const guidesById = new Map<string, TopicGuide>()

for (const document of lessonDocuments) {
  const trackGuides = topicGuides[document.track] ||= {}
  if (trackGuides[document.title]) {
    throw new Error(`课程题名重复：${document.track}/${document.title}`)
  }

  const idKey = `${document.track}:${document.id}`
  if (guidesById.has(idKey)) {
    throw new Error(`课程 id 重复：${idKey}`)
  }

  trackGuides[document.title] = document.guide
  guidesById.set(idKey, document.guide)
}

export const getTopicGuide = (
  trackId: TrackId,
  lessonId: string,
  title = lessonId
) => guidesById.get(`${trackId}:${lessonId}`) || topicGuides[trackId]?.[title]
