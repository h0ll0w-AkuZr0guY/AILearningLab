export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  app: {
    baseURL: process.env.NUXT_APP_BASE_URL || '/',
    pageTransition: { name: 'page', mode: 'out-in' }
  },
  nitro: {
    preset: 'static',
    // Windows 会拒绝两个并发 prerender worker 原子重命名同一 payload 缓存。
    // 单 worker 牺牲少量构建速度，换取本地与 CI 都可重复的静态产物。
    prerender: { concurrency: 1 }
  },
  css: [
    '~/assets/css/main.css',
    '~/assets/css/navigation.css',
    '~/assets/css/interview.css',
    '~/assets/css/workbench.css',
    '~/assets/css/portal.css'
  ]
})
