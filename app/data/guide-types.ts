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

export type GuideVisualKind =
  | 'state'
  | 'flow'
  | 'graph'
  | 'tensor'
  | 'playground'
  | 'image'

export type GuideVisualPlacement =
  | 'overview'
  | `chapter:${number}`
  | 'mechanisms'
  | 'build'
  | 'example'

export interface GuideVisualStep {
  label: string
  detail: string
}

export interface GuideVisual {
  id: string
  kind: GuideVisualKind
  placement: GuideVisualPlacement
  title: string
  summary: string
  caption: string
  actionLabel?: string
  component?: string
  steps: GuideVisualStep[]
  observations: string[]
  asset?: string
  alt?: string
  credit?: string
}

export interface GuideContribution {
  title: string
  at: string
  human: string
  ai: string
  summary: string
  pr?: string
  commit?: string
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
  visuals?: GuideVisual[]
  contributions?: GuideContribution[]
}

export interface LessonMarkdownDocument {
  id: string
  track: TrackId
  title: string
  depth: 'foundation' | 'deep'
  visualIndex?: string
  guide: TopicGuide
}

export interface VisualMarkdownDocument {
  lesson: string
  track: TrackId
  decision: string
  visuals: GuideVisual[]
}
