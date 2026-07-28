<script setup lang="ts">
import { getLesson, getTrack } from '~/data/curriculum'
import { getLessonDetail } from '~/data/lesson-content'

const route = useRoute()
const track = computed(() => getTrack(String(route.params.track)))
const lesson = computed(() => getLesson(String(route.params.track), String(route.params.lesson)))
if (!track.value || !lesson.value) throw createError({ statusCode: 404, statusMessage: '题目不存在' })

const detail = computed(() => getLessonDetail(track.value!, lesson.value!))
const lessonIndex = computed(() => track.value!.lessons.findIndex(item => item.id === lesson.value!.id))
const previousLesson = computed(() => track.value!.lessons[lessonIndex.value - 1])
const nextLesson = computed(() => track.value!.lessons[lessonIndex.value + 1])
const lessonHref = (id: string) => `/tracks/${track.value!.id}/lessons/${id}`

const activeTab = ref<'learn' | 'source' | 'practice' | 'interview'>('learn')
const code = ref(detail.value.example)
const feedback = ref('')
const reviewing = ref(false)
const splitPercent = ref(47)
const isDragging = ref(false)
const showAssistant = ref(false)
const assistantQuestion = ref('')
const assistantAnswer = ref('')
const assisting = ref(false)
const standardAnswer = ref('')
const answering = ref(false)
const answerSavedAt = ref('')
const showSelfCheckAnswer = ref(false)
const showBuiltInInterviewAnswer = ref(false)
const copiedId = ref('')
const editorScrollTop = ref(0)
const workspaceFilename = computed(() => {
  if (['python', 'langchain', 'langgraph', 'deepagents', 'transformer', 'torch', 'vllm', 'lora'].includes(track.value!.id)) return 'solution.py'
  if (track.value!.id === 'nuxt') return 'lesson.vue'
  return 'solution.ts'
})
const codeLines = computed(() => code.value.split('\n'))
const lessonLead = computed(() => {
  if (detail.value.curated) {
    return detail.value.overview[0]
  }
  return lesson.value!.objective
})
const interviewQuestion = computed(() => detail.value.selfCheckQuestion)
const sourceIntro = computed(() => detail.value.sourceLabel.startsWith('核心架构教学版')
  ? '先阅读下面的中文教学实现。它保留矩阵运算的核心数据流，并用前一节已经完成的小函数继续搭建；理解后再通过底部链接对照 torch.matmul / ATen 的生产实现。'
  : detail.value.curated
    ? `从 ${detail.value.source.file} 中的 ${detail.value.source.symbol} 开始。先按中文注释追踪入口、参数和主分派，再用下方“沿函数向下读”核对状态、不变量与失败路径。`
    : lesson.value!.sourceFocus)

const coach = inject<{
  apiKey: Ref<string>
  endpoint: Ref<string>
  model: Ref<string>
  open: () => void
}>('coach-config')

const storageKey = computed(() => `reviewlab:interview:${lesson.value!.id}`)
const workspaceKey = computed(() => `reviewlab:workspace:${lesson.value!.id}`)

onMounted(() => {
  const savedAnswer = localStorage.getItem(storageKey.value)
  if (savedAnswer) {
    try {
      const parsed = JSON.parse(savedAnswer)
      standardAnswer.value = parsed.answer || ''
      answerSavedAt.value = parsed.savedAt || ''
    } catch {
      standardAnswer.value = savedAnswer
    }
  }
  const savedCode = localStorage.getItem(workspaceKey.value)
  if (savedCode) {
    const lines = savedCode.split('\n')
    const pollutedLines = lines.filter(line => line.startsWith('+')).length
    code.value = pollutedLines > lines.length / 2
      ? lines.map(line => line.startsWith('+') ? line.slice(1) : line).join('\n')
      : savedCode
  }
})

watch(code, value => {
  if (import.meta.client) localStorage.setItem(workspaceKey.value, value)
})

const callCoach = async (system: string, user: string) => {
  if (!coach?.apiKey.value) {
    coach?.open()
    throw new Error('请先配置 AI 教练')
  }
  const response = await fetch(`${coach.endpoint.value.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${coach.apiKey.value}`
    },
    body: JSON.stringify({
      model: coach.model.value,
      temperature: 0.2,
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }]
    })
  })
  if (!response.ok) throw new Error(`${response.status} ${await response.text()}`)
  const data = await response.json()
  return data.choices?.[0]?.message?.content || '模型返回空内容。'
}

const ruleReview = () => {
  const checks = [
    code.value.length > 220 ? '✓ 已形成可评审的实现主体。' : '△ 代码仍偏短，请先写出核心路径。',
    /function |def |class |const /.test(code.value) ? '✓ 检测到清晰的实现入口。' : '△ 缺少函数、类或模块入口。',
    /test|assert|expect|throw|try|catch/.test(code.value) ? '✓ 已体现验证或异常路径。' : '△ 请补充边界用例、断言或失败路径。',
    /TODO|\.\.\./.test(code.value) ? '△ 仍有未完成占位，请把其中一处替换为可执行逻辑。' : '✓ 未检测到明显占位实现。'
  ]
  feedback.value = `规则化审阅\n\n${checks.join('\n')}\n\n下一步追问：\n${interviewQuestion.value}`
}

const aiReview = async () => {
  reviewing.value = true
  feedback.value = 'AI 教练正在审阅机制理解、边界条件与可运行性…'
  try {
    feedback.value = await callCoach(
      '你是大厂高级工程师面试官。用中文严谨审阅代码：先指出一个正确机制，再按 P0/P1/P2 给出最多三项可操作修改，补一个边界测试，最后追问一个源码或运行时问题。切勿虚构执行结果。',
      `技术栈：${track.value!.name}\n课题：${lesson.value!.title}\n官方语义：${detail.value.official.note}\n源码入口：${detail.value.source.file} / ${detail.value.source.symbol}\n复现任务：${lesson.value!.rebuild}\n\n代码：\n${code.value}`
    )
  } catch (error) {
    feedback.value = `连接失败：${error instanceof Error ? error.message : '未知错误'}\n\n如果供应商禁止浏览器 CORS，请配置本地兼容代理。`
  } finally {
    reviewing.value = false
  }
}

const askAssistant = async () => {
  if (!assistantQuestion.value.trim()) return
  assisting.value = true
  assistantAnswer.value = '正在结合当前工作区分析…'
  try {
    assistantAnswer.value = await callCoach(
      '你是结对编程助教。基于用户当前代码和课程目标回答问题。优先给思路、定位和小片段，保留值得用户自己完成的核心部分；指出你引用的具体代码位置，不能假装运行过代码。',
      `课程：${track.value!.name} / ${lesson.value!.title}\n官方语义：${detail.value.official.note}\n复现目标：${lesson.value!.rebuild}\n\n用户问题：${assistantQuestion.value}\n\n当前工作区代码：\n${code.value}`
    )
  } catch (error) {
    assistantAnswer.value = `连接失败：${error instanceof Error ? error.message : '未知错误'}`
  } finally {
    assisting.value = false
  }
}

const generateStandardAnswer = async () => {
  answering.value = true
  standardAnswer.value = 'AI 正在组织标准答案…'
  try {
    standardAnswer.value = await callCoach(
      '你是资深技术面试官。请输出一份可反复复习的中文标准答案，结构固定为：一句话结论、底层机制、源码证据、最小示例、边界与取舍、面试追问。内容必须具体，避免套话。',
      `课程：${track.value!.name}\n题目：${interviewQuestion.value}\n当前知识点：${lesson.value!.title}\n官方语义：${detail.value.official.note}\n源码函数：${detail.value.source.file} 中的 ${detail.value.source.symbol}\n用户工作区可作为补充证据：\n${code.value}`
    )
    const savedAt = new Date().toLocaleString('zh-CN')
    answerSavedAt.value = savedAt
    localStorage.setItem(storageKey.value, JSON.stringify({ answer: standardAnswer.value, savedAt }))
  } catch (error) {
    standardAnswer.value = `生成失败：${error instanceof Error ? error.message : '未知错误'}`
  } finally {
    answering.value = false
  }
}

const clearStandardAnswer = () => {
  standardAnswer.value = ''
  answerSavedAt.value = ''
  localStorage.removeItem(storageKey.value)
}

const copyText = async (value: string, id: string) => {
  await navigator.clipboard.writeText(value)
  copiedId.value = id
  window.setTimeout(() => {
    if (copiedId.value === id) copiedId.value = ''
  }, 1600)
}

const resetWorkspace = () => {
  code.value = detail.value.example
}

const syncEditorScroll = (event: Event) => {
  editorScrollTop.value = (event.target as HTMLTextAreaElement).scrollTop
}

const resize = (event: PointerEvent) => {
  if (!isDragging.value) return
  splitPercent.value = Math.min(72, Math.max(28, event.clientX / window.innerWidth * 100))
}
const stopResize = () => {
  isDragging.value = false
  document.body.classList.remove('is-resizing')
  window.removeEventListener('pointermove', resize)
  window.removeEventListener('pointerup', stopResize)
}
const startResize = (event: PointerEvent) => {
  event.preventDefault()
  isDragging.value = true
  document.body.classList.add('is-resizing')
  window.addEventListener('pointermove', resize)
  window.addEventListener('pointerup', stopResize)
}
const resizeByKeyboard = (event: KeyboardEvent) => {
  if (event.key === 'ArrowLeft') splitPercent.value = Math.max(28, splitPercent.value - 3)
  if (event.key === 'ArrowRight') splitPercent.value = Math.min(72, splitPercent.value + 3)
}
onBeforeUnmount(stopResize)
</script>

<template>
  <main class="problem-app" :style="{ '--lesson-left': `${splitPercent}%` }">
      <section class="problem-left" aria-label="课程正文">
        <header class="lesson-sticky">
          <div class="lesson-toolbar">
            <NuxtLink class="back" :to="`/tracks/${track?.id}`">← {{ track?.name }}</NuxtLink>
            <nav class="compact-switcher" aria-label="题目切换">
              <NuxtLink v-if="previousLesson" :to="lessonHref(previousLesson.id)" title="上一题">‹</NuxtLink>
              <span v-else>‹</span>
              <b>{{ lessonIndex + 1 }} / {{ track?.lessons.length }}</b>
              <NuxtLink v-if="nextLesson" :to="lessonHref(nextLesson.id)" title="下一题">›</NuxtLink>
              <span v-else>›</span>
            </nav>
          </div>
          <div class="sticky-title-row"><h1>{{ lesson?.title }}</h1><span class="difficulty">LESSON {{ String(lesson?.order).padStart(3, '0') }}</span></div>
          <div class="lesson-assessment" :title="lesson?.difficultyReason">
            <span :class="`level-${lesson?.difficulty}`">{{ lesson?.difficulty }}</span>
            <span>{{ lesson?.learningValue }} · {{ lesson?.learningValueScore }}/5</span>
            <span>预计 {{ lesson?.estimatedMinutes }} 分钟</span>
            <span>{{ lesson?.granularity }}</span>
            <span :class="detail.curated ? 'content-curated' : 'content-drafting'">{{ detail.curated ? '深度精写' : '待精写' }}</span>
          </div>
          <div class="problem-tabs">
            <button :class="{ on: activeTab === 'learn' }" @click="activeTab = 'learn'">知识正文</button>
            <button :class="{ on: activeTab === 'source' }" @click="activeTab = 'source'">源码复现</button>
            <button :class="{ on: activeTab === 'practice' }" @click="activeTab = 'practice'">练习</button>
            <button :class="{ on: activeTab === 'interview' }" @click="activeTab = 'interview'">面试实战</button>
          </div>
        </header>
        <p class="objective">{{ lessonLead }}</p>

        <div v-if="activeTab === 'learn'" class="problem-content lesson-article">
          <aside class="official-anchor">
            <span>官方文档精确定位</span>
            <strong>{{ detail.official.title }}</strong>
            <p>{{ detail.official.note }}</p>
            <a :href="detail.official.url" target="_blank" rel="noreferrer">打开对应章节 ↗</a>
          </aside>
          <section class="study-plan" aria-label="本节时间预算">
            <div><b>{{ detail.studyPlan.readingMinutes }}</b><span>分钟正文</span></div>
            <div><b>{{ detail.studyPlan.sourceMinutes }}</b><span>分钟源码</span></div>
            <div><b>{{ detail.studyPlan.practiceMinutes }}</b><span>分钟实践</span></div>
            <div><b>{{ detail.studyPlan.reviewMinutes }}</b><span>分钟复盘</span></div>
          </section>
          <nav v-if="detail.chapters.length" class="chapter-outline" aria-label="正文目录">
            <span>本节正文</span>
            <a v-for="(chapter, index) in detail.chapters" :key="chapter.title" :href="`#chapter-${index + 1}`">
              {{ String(index + 1).padStart(2, '0') }} · {{ chapter.title }}
            </a>
          </nav>
          <h2>核心解释</h2>
          <p v-for="paragraph in detail.overview" :key="paragraph">{{ paragraph }}</p>
          <section
            v-for="(chapter, chapterIndex) in detail.chapters"
            :id="`chapter-${chapterIndex + 1}`"
            :key="chapter.title"
            class="textbook-chapter"
          >
            <header>
              <span>{{ chapter.kicker || `CHAPTER ${String(chapterIndex + 1).padStart(2, '0')}` }}</span>
              <h2>{{ chapter.title }}</h2>
            </header>
            <p v-for="paragraph in chapter.paragraphs" :key="paragraph">{{ paragraph }}</p>
            <ul v-if="chapter.points?.length" class="chapter-points">
              <li v-for="point in chapter.points" :key="point">{{ point }}</li>
            </ul>
            <div v-if="chapter.code" class="code-reader chapter-code">
              <div class="code-reader-bar">
                <span>{{ (chapter.language || detail.exampleLanguage).toUpperCase() }} · CHAPTER {{ chapterIndex + 1 }}</span>
                <button @click="copyText(chapter.code!, `chapter-${chapterIndex}`)">{{ copiedId === `chapter-${chapterIndex}` ? '已复制 ✓' : '复制代码' }}</button>
              </div>
              <ol><li v-for="(line, lineIndex) in chapter.code.split('\n')" :key="lineIndex"><code>{{ line || ' ' }}</code></li></ol>
            </div>
            <aside v-if="chapter.takeaway" class="chapter-takeaway"><b>这一节带走什么</b><p>{{ chapter.takeaway }}</p></aside>
          </section>
          <h2>运行机制</h2>
          <ol class="mechanism-list">
            <li v-for="(item, index) in detail.mechanisms" :key="item"><span>{{ index + 1 }}</span><p>{{ item }}</p></li>
          </ol>
          <h2>像搭积木一样实现</h2>
          <section v-for="(step, index) in detail.buildSteps" :key="step.title" class="build-step">
            <header><span>{{ String(index + 1).padStart(2, '0') }}</span><h3>{{ step.title }}</h3></header>
            <p>{{ step.body }}</p>
            <div v-if="step.code" class="code-reader compact-code">
              <div class="code-reader-bar"><span>{{ detail.exampleLanguage.toUpperCase() }} · STEP {{ index + 1 }}</span><button @click="copyText(step.code!, `step-${index}`)">{{ copiedId === `step-${index}` ? '已复制 ✓' : '复制代码' }}</button></div>
              <ol><li v-for="(line, lineIndex) in step.code.split('\n')" :key="lineIndex"><code>{{ line || ' ' }}</code></li></ol>
            </div>
          </section>
          <h2>组合后的可运行示例</h2>
          <div class="code-reader">
            <div class="code-reader-bar"><span>{{ detail.exampleLanguage.toUpperCase() }} · RUNNABLE EXAMPLE</span><button @click="copyText(detail.example, 'example')">{{ copiedId === 'example' ? '已复制 ✓' : '复制代码' }}</button></div>
            <ol><li v-for="(line, lineIndex) in detail.example.split('\n')" :key="lineIndex"><code>{{ line || ' ' }}</code></li></ol>
          </div>
          <template v-if="detail.variants.length">
            <h2>写法变体与取舍</h2>
            <section class="variant-grid">
              <article v-for="(variant, variantIndex) in detail.variants" :key="variant.title" class="variant-card">
                <h3>{{ variant.title }}</h3>
                <p><b>适合：</b>{{ variant.useWhen }}</p>
                <p><b>代价：</b>{{ variant.tradeoff }}</p>
                <div v-if="variant.code" class="code-reader compact-code">
                  <div class="code-reader-bar">
                    <span>{{ (variant.language || detail.exampleLanguage).toUpperCase() }} · VARIANT</span>
                    <button @click="copyText(variant.code!, `variant-${variantIndex}`)">{{ copiedId === `variant-${variantIndex}` ? '已复制 ✓' : '复制代码' }}</button>
                  </div>
                  <ol><li v-for="(line, lineIndex) in variant.code.split('\n')" :key="lineIndex"><code>{{ line || ' ' }}</code></li></ol>
                </div>
              </article>
            </section>
          </template>
          <h2>容易踩错的边界</h2>
          <ul class="pitfall-list"><li v-for="item in detail.pitfalls" :key="item">{{ item }}</li></ul>
          <div class="callout question-callout">
            <b>自检问题</b>
            <p>{{ detail.selfCheckQuestion }}</p>
            <button @click="showSelfCheckAnswer = !showSelfCheckAnswer">{{ showSelfCheckAnswer ? '收起参考答案' : '查看参考答案' }}</button>
            <p v-if="showSelfCheckAnswer" class="inline-answer">{{ detail.selfCheckAnswer }}</p>
          </div>
        </div>

        <div v-else-if="activeTab === 'source'" class="problem-content source-reader">
          <div class="source-heading">
            <div><span>{{ detail.sourceLabel }}</span><h2>{{ detail.source.symbol }}</h2></div>
            <span>{{ detail.source.repo }}<br>{{ detail.source.file }}</span>
          </div>
          <p>{{ sourceIntro }}</p>
          <div class="code-reader source-code-reader">
            <div class="code-reader-bar"><span>{{ detail.source.language.toUpperCase() }} · {{ detail.source.symbol }}</span><button @click="copyText(detail.annotatedSource, 'source')">{{ copiedId === 'source' ? '已复制 ✓' : '复制代码' }}</button></div>
            <ol><li v-for="(line, lineIndex) in detail.annotatedSource.split('\n')" :key="lineIndex"><code>{{ line || ' ' }}</code></li></ol>
          </div>
          <p class="source-caption">保留核心算法与稳定接口，省略版本兼容和低频参数；新增中文注释用于学习。完整实现仍以对应仓库为准。</p>
          <h2>沿函数向下读</h2>
          <ol><li v-for="item in detail.source.walkthrough" :key="item">{{ item }}</li></ol>
          <div class="callout"><b>复现协议</b><p>{{ lesson?.rebuild }}</p></div>
          <h2>你要交付的证据</h2>
          <ol><li>画出入口、状态和下游调用关系。</li><li>成功路径与失败路径各写一个可运行测试。</li><li>对照上游实现，记录一个被简化版本遗漏的不变量。</li></ol>
          <div class="link-pills">
            <a :href="detail.official.url" target="_blank" rel="noreferrer">对应文档章节 ↗</a>
            <a :href="detail.source.url" target="_blank" rel="noreferrer">查看完整源文件 ↗</a>
          </div>
        </div>

        <div v-else-if="activeTab === 'practice'" class="problem-content">
          <h2>实践任务</h2><p>{{ lesson?.practice }}</p>
          <div class="callout"><b>允许参考</b><p>可以直接参考本站正文、官方章节和源码函数。训练目标是重新组织接口契约、状态变化与不变量，并说明你删掉了哪些生产级分支。</p></div>
          <h2>验收标准</h2>
          <ol><li>实现能够运行并含最小测试。</li><li>能解释复杂度、资源、并发或生命周期边界。</li><li>能指出一个上游实现额外处理、简化版尚未覆盖的场景。</li><li>规则审阅与 AI 评阅中的高优先级问题已经关闭。</li></ol>
        </div>

        <div v-else class="problem-content interview-practice">
          <p class="eyebrow">INTERVIEWER PRACTICE</p>
          <h2>现场问题</h2>
          <p class="interview-question">{{ interviewQuestion }}</p>
          <div class="answer-actions">
            <button @click="showBuiltInInterviewAnswer = !showBuiltInInterviewAnswer">{{ showBuiltInInterviewAnswer ? '收起站内答案' : '查看站内参考答案' }}</button>
            <button class="primary-answer" :disabled="answering" @click="generateStandardAnswer">{{ answering ? '生成中…' : standardAnswer ? '重新生成答案' : '让 AI 生成标准答案' }}</button>
            <button v-if="standardAnswer" @click="clearStandardAnswer">清除固化答案</button>
          </div>
          <article v-if="showBuiltInInterviewAnswer" class="saved-answer built-in-answer">
            <header><strong>站内参考答案</strong><span>无需 AI</span></header>
            <div>{{ detail.referenceAnswer }}</div>
          </article>
          <article v-if="standardAnswer" class="saved-answer">
            <header><strong>已固化标准答案</strong><span>{{ answerSavedAt || '当前设备' }}</span></header>
            <div>{{ standardAnswer }}</div>
          </article>
          <div class="callout"><b>回答评分尺</b><p>先给结论，再推演机制，随后给源码函数、可运行代码或指标证据，最后说明适用边界和替代方案。</p></div>
          <div class="link-pills"><a :href="lesson?.interviewSource" target="_blank" rel="noreferrer">公开面经题型线索 ↗</a></div>
        </div>
      </section>

      <div
        class="split-handle"
        role="separator"
        aria-label="调整课程正文和代码工作区宽度"
        aria-orientation="vertical"
        :aria-valuenow="Math.round(splitPercent)"
        tabindex="0"
        @pointerdown="startResize"
        @keydown="resizeByKeyboard"
      ><i /></div>

      <section class="problem-right">
        <div class="editor-bar">
          <b><i />{{ workspaceFilename }}</b>
          <div class="editor-bar-tools">
            <span>{{ track?.symbol }} · {{ lesson?.module }}</span>
            <button @click="copyText(code, 'workspace')">{{ copiedId === 'workspace' ? '已复制 ✓' : '复制' }}</button>
            <button @click="resetWorkspace">重置示例</button>
          </div>
        </div>
        <div class="workspace-editor">
          <pre class="editor-gutter" aria-hidden="true" :style="{ transform: `translateY(-${editorScrollTop}px)` }"><span v-for="(_, index) in codeLines" :key="index">{{ index + 1 }}</span></pre>
          <textarea v-model="code" class="editor" spellcheck="false" aria-label="代码工作区" @scroll="syncEditorScroll" />
        </div>
        <div class="editor-actions">
          <button @click="ruleReview">规则审阅</button>
          <button :class="{ active: showAssistant }" @click="showAssistant = !showAssistant">问 AI 助教</button>
          <button class="run" :disabled="reviewing" @click="aiReview">{{ reviewing ? '审阅中…' : 'AI 评阅 →' }}</button>
        </div>
        <section v-if="showAssistant" class="assistant-panel">
          <header><strong>工作区 AI 助教</strong><span>会读取当前代码与本节目标</span></header>
          <div v-if="assistantAnswer" class="assistant-response">{{ assistantAnswer }}</div>
          <form @submit.prevent="askAssistant">
            <textarea v-model="assistantQuestion" rows="2" placeholder="例如：这个 reducer 为什么会丢状态？给我一个定位思路。" />
            <button :disabled="assisting || !assistantQuestion.trim()">{{ assisting ? '思考中…' : '发送' }}</button>
          </form>
        </section>
        <pre class="review" :class="{ 'review-empty': !feedback }">{{ feedback || '把你的方案写进工作区。\n\n评阅关注：\n· 设计不变量是否清晰\n· 边界和失败路径是否可解释\n· 是否能用源码或测试验证推断\n\n代码会自动保存在当前浏览器。' }}</pre>
      </section>
  </main>
</template>
