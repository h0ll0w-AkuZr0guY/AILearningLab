<script setup lang="ts">
import { tracks } from '~/data/curriculum'

const showCoach = ref(false)
const provider = useState('coach-provider', () => 'OpenAI')
const endpoint = useState('coach-endpoint', () => 'https://api.openai.com/v1')
const model = useState('coach-model', () => 'gpt-4.1-mini')
const apiKey = useState('coach-key', () => '')
const rememberKey = ref(false)
const testing = ref(false)
const connectionState = ref<'idle' | 'ok' | 'error'>('idle')
const connectionMessage = ref('')
const courseMenu = ref<HTMLDetailsElement | null>(null)
const route = useRoute()

const closeCourseMenu = () => {
  if (courseMenu.value) courseMenu.value.open = false
}

const dismissCourseMenu = (event: PointerEvent) => {
  if (!courseMenu.value?.open) return
  if (event.target instanceof Node && !courseMenu.value.contains(event.target)) closeCourseMenu()
}

const dismissCourseMenuByKeyboard = (event: KeyboardEvent) => {
  if (event.key === 'Escape') closeCourseMenu()
}

const applyPreset = () => {
  const presets: Record<string, [string, string]> = {
    OpenAI: ['https://api.openai.com/v1', 'gpt-4.1-mini'],
    DeepSeek: ['https://api.deepseek.com', 'deepseek-chat'],
    SiliconFlow: ['https://api.siliconflow.cn/v1', 'Qwen/Qwen3-8B'],
    'Custom / local': ['http://localhost:11434/v1', 'your-model']
  }
  ;[endpoint.value, model.value] = presets[provider.value]
  connectionState.value = 'idle'
  connectionMessage.value = ''
}

onMounted(() => {
  document.addEventListener('pointerdown', dismissCourseMenu)
  document.addEventListener('keydown', dismissCourseMenuByKeyboard)
  const saved = localStorage.getItem('reviewlab:coach-config')
  if (!saved) return
  try {
    const config = JSON.parse(saved)
    provider.value = config.provider || provider.value
    endpoint.value = config.endpoint || endpoint.value
    model.value = config.model || model.value
    rememberKey.value = Boolean(config.rememberKey)
    if (rememberKey.value) apiKey.value = config.apiKey || ''
  } catch {
    localStorage.removeItem('reviewlab:coach-config')
  }
})

watch(() => route.fullPath, closeCourseMenu)
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', dismissCourseMenu)
  document.removeEventListener('keydown', dismissCourseMenuByKeyboard)
})

const saveCoach = () => {
  localStorage.setItem('reviewlab:coach-config', JSON.stringify({
    provider: provider.value,
    endpoint: endpoint.value,
    model: model.value,
    rememberKey: rememberKey.value,
    apiKey: rememberKey.value ? apiKey.value : ''
  }))
  showCoach.value = false
}

const testConnection = async () => {
  if (!apiKey.value.trim()) {
    connectionState.value = 'error'
    connectionMessage.value = '请先填写 API Key。'
    return
  }
  testing.value = true
  connectionState.value = 'idle'
  connectionMessage.value = '正在发送最小测试请求…'
  try {
    const response = await fetch(`${endpoint.value.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey.value}`
      },
      body: JSON.stringify({
        model: model.value,
        temperature: 0,
        max_tokens: 8,
        messages: [{ role: 'user', content: 'Reply only: OK' }]
      })
    })
    if (!response.ok) throw new Error(`${response.status} ${await response.text()}`)
    const data = await response.json()
    if (!data.choices?.[0]?.message) throw new Error('响应中缺少 choices[0].message')
    connectionState.value = 'ok'
    connectionMessage.value = '连接成功，可以使用代码助教、评阅和面试答案。'
  } catch (error) {
    connectionState.value = 'error'
    connectionMessage.value = `连接失败：${error instanceof Error ? error.message : '未知错误'}`
  } finally {
    testing.value = false
  }
}

provide('coach-config', { apiKey, endpoint, model, open: () => { showCoach.value = true } })
</script>

<template>
  <div>
    <header class="site-nav">
      <NuxtLink class="brand" to="/"><b>∿</b>Review Lab</NuxtLink>
      <nav class="nav-links">
        <NuxtLink to="/learning-paths">学习路径</NuxtLink>
        <details ref="courseMenu" class="course-menu">
          <summary>课程 <span>⌄</span></summary>
          <div class="course-dropdown">
            <NuxtLink v-for="track in tracks" :key="track.id" :to="`/tracks/${track.id}`" @click="closeCourseMenu">
              <i :style="{ background: track.color }">{{ track.symbol }}</i>
              <span><strong>{{ track.name }}</strong><small>{{ track.lessons.length }} 节专题</small></span>
            </NuxtLink>
          </div>
        </details>
        <NuxtLink to="/projects">综合项目</NuxtLink>
        <NuxtLink to="/source-map">源码地图</NuxtLink>
      </nav>
      <div class="nav-actions">
        <a
          class="repo-index"
          href="https://github.com/h0ll0w-AkuZr0guY/AILearningLab"
          target="_blank"
          rel="noreferrer"
          aria-label="在 GitHub 打开 AILearningLab 仓库"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 .9a11.3 11.3 0 0 0-3.6 22c.6.1.8-.2.8-.5v-2.2c-3.3.7-4-1.4-4-1.4-.5-1.4-1.3-1.7-1.3-1.7-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1.1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.8-1.6-2.7-.3-5.5-1.3-5.5-5.6 0-1.2.4-2.3 1.2-3.1-.1-.3-.5-1.6.1-3.1 0 0 1-.3 3.1 1.2a10.8 10.8 0 0 1 5.7 0c2.2-1.5 3.1-1.2 3.1-1.2.6 1.5.2 2.8.1 3.1.8.8 1.2 1.9 1.2 3.1 0 4.3-2.8 5.3-5.5 5.6.4.4.8 1.1.8 2.1v3.1c0 .3.2.6.8.5A11.3 11.3 0 0 0 12 .9Z" /></svg>
          <span><small>GITHUB REPOSITORY</small><b>AILearningLab</b></span>
          <em>main</em>
        </a>
        <button class="coach-button" :class="{ connected: apiKey }" @click="showCoach = true"><i />{{ apiKey ? 'AI 已配置' : '配置 AI' }}</button>
      </div>
    </header>
    <slot />
    <div v-if="showCoach" class="coach-modal-mask" @click.self="showCoach = false">
      <section class="coach-modal"><button class="close" @click="showCoach = false">×</button><p class="eyebrow">AI CONNECTION</p><h2>配置 AI 教练</h2><p>所有 AI 功能统一使用这里的配置。默认只保存服务商、地址和模型；你可以自行选择是否在当前浏览器保存 Key。</p>
        <label>服务商<select v-model="provider" @change="applyPreset"><option>OpenAI</option><option>DeepSeek</option><option>SiliconFlow</option><option>Custom / local</option></select></label>
        <label>兼容 API Base URL<input v-model="endpoint" placeholder="例如 https://api.openai.com/v1" /></label><label>模型<input v-model="model" /></label><label>API Key<input v-model="apiKey" type="password" autocomplete="off" placeholder="sk-..." /></label>
        <label class="remember-key"><input v-model="rememberKey" type="checkbox" />仅在这台浏览器保存 API Key</label>
        <p>地址应填写到 API 版本层，例如 <code>https://api.openai.com/v1</code>；页面会自动追加 <code>/chat/completions</code>。若供应商禁用浏览器跨域，请填写本地 OpenAI-compatible 代理地址。</p>
        <p v-if="connectionMessage" class="connection-message" :class="connectionState">{{ connectionMessage }}</p>
        <div class="coach-modal-actions"><button class="test-connection" :disabled="testing" @click="testConnection">{{ testing ? '测试中…' : '测试连接' }}</button><button class="primary" @click="saveCoach">保存配置 <span>✓</span></button></div>
      </section>
    </div>
  </div>
</template>
