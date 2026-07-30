import type { TrackId } from './curriculum'

export interface GuideChapter {
  title: string
  kicker?: string
  paragraphs: string[]
  points?: string[]
  code?: string
  language?: string
  takeaway?: string
}

export interface GuideVariant {
  title: string
  useWhen: string
  tradeoff: string
  code?: string
  language?: string
}

export interface GuideStudyPlan {
  readingMinutes: number
  sourceMinutes: number
  practiceMinutes: number
  reviewMinutes: number
}

export interface TopicGuide {
  official?: {
    title: string
    url: string
    note: string
  }
  source?: {
    repo: string
    file: string
    symbol: string
    language: string
    code: string
    walkthrough: string[]
    url: string
  }
  overview: string[]
  chapters?: GuideChapter[]
  mechanisms?: string[]
  pitfalls?: string[]
  variants?: GuideVariant[]
  studyPlan?: GuideStudyPlan
  exampleLanguage?: string
  example: string
  buildSteps?: Array<{ title: string; body: string; code?: string }>
  selfCheckQuestion?: string
  selfCheckAnswer?: string
}

export interface LessonMarkdownDocument {
  id: string
  track: TrackId
  title: string
  depth: 'foundation' | 'deep'
  guide: TopicGuide
}
