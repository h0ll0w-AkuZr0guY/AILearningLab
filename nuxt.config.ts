export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  app: {
    baseURL: process.env.NUXT_APP_BASE_URL || '/'
  },
  nitro: { preset: 'static' },
  css: ['~/assets/css/main.css', '~/assets/css/interview.css', '~/assets/css/workbench.css']
})
