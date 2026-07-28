<script setup lang="ts">
const filters = ['全部', 'Agent 系统', '模型与训练', '推理部署', '前端工程']
const activeFilter = ref('全部')

const projects = [
  {
    id: 'agent-runtime',
    index: '01',
    category: 'Agent 系统',
    title: '可恢复 Research Agent',
    stack: ['LangGraph', 'LangChain', 'Python'],
    summary: '实现带检索、工具、人工审批、checkpoint、幂等副作用和执行轨迹的研究型 Agent。',
    evidence: ['崩溃后从指定 super-step 恢复', '工具调用具备幂等键与权限策略', '离线任务集与轨迹评分报告'],
    milestones: ['状态与节点合同', 'Pregel 调度与 checkpoint', 'interrupt/resume', '评测与故障注入'],
    entry: '/tracks/langgraph'
  },
  {
    id: 'mini-langchain',
    index: '02',
    category: 'Agent 系统',
    title: '从零重建 Mini LangChain',
    stack: ['LangChain', 'Python', 'TypeScript'],
    summary: '从消息协议、Runnable 组合、模型适配、工具 schema 到 callback/trace，构造可扩展的最小框架。',
    evidence: ['同步与异步 invoke/stream 合同', '可插拔模型与工具适配器', '错误、重试与 tracing 中间件'],
    milestones: ['消息与配置模型', 'Runnable 组合子', '工具循环', 'middleware 与 trace'],
    entry: '/tracks/langchain'
  },
  {
    id: 'tiny-decoder',
    index: '03',
    category: '模型与训练',
    title: 'Tiny Decoder 训练实验室',
    stack: ['Transformer', 'PyTorch'],
    summary: '从 tokenizer、attention、MLP 和 residual 搭建 decoder，完成训练、采样、KV Cache 与性能剖析。',
    evidence: ['过拟合微型数据集的可重复实验', '梯度、显存与吞吐分析', '无 Cache 与有 Cache 的一致性测试'],
    milestones: ['张量与 attention', '完整 block', '训练闭环', '增量解码与 profiler'],
    entry: '/tracks/transformer'
  },
  {
    id: 'lora-diagnostics',
    index: '04',
    category: '模型与训练',
    title: 'LoRA 失效诊断台',
    stack: ['LoRA · PEFT', 'PyTorch'],
    summary: '实现 LoRA 注入与合并，围绕 rank、target module、量化和数据漂移建立诊断实验。',
    evidence: ['参数与梯度流向审计', 'merge/unmerge 数值一致性', '质量下降的消融与根因报告'],
    milestones: ['低秩层', '模块注入', '训练与合并', '量化与失败诊断'],
    entry: '/tracks/lora'
  },
  {
    id: 'serving-runtime',
    index: '05',
    category: '推理部署',
    title: '连续批处理推理服务',
    stack: ['vLLM', 'PyTorch', 'Transformer'],
    summary: '复现块式 KV Cache、请求调度和 continuous batching，暴露 OpenAI-compatible 流式接口。',
    evidence: ['吞吐、TTFT、TPOT 三类指标', '内存碎片与调度时间线', '取消、超时和背压测试'],
    milestones: ['KV block allocator', 'scheduler', 'decode loop', 'API 与压测'],
    entry: '/tracks/vllm'
  },
  {
    id: 'learning-workspace',
    index: '06',
    category: '前端工程',
    title: 'SSR-safe AI 学习工作区',
    stack: ['Nuxt', 'TypeScript'],
    summary: '实现静态部署、浏览器 AI 配置、代码工作区、离线状态、响应式布局和可观测交互。',
    evidence: ['SSR/SSG 与 hydration 一致性', '键盘、触屏与无障碍测试', 'CORS、密钥和本地代理威胁模型'],
    milestones: ['路由与状态归属', '编辑器交互', 'AI 协议', '构建部署与性能'],
    entry: '/tracks/nuxt'
  }
]

const visibleProjects = computed(() => activeFilter.value === '全部'
  ? projects
  : projects.filter(project => project.category === activeFilter.value))
</script>

<template>
  <main class="portal-page">
    <section class="portal-hero project-hero">
      <div class="portal-shell">
        <p class="portal-kicker"><span /> INTEGRATION PROJECTS</p>
        <h1>项目用来暴露<br>知识之间的断层。</h1>
        <p>每个项目都包含可运行交付、故障演练、评测证据和面试叙述。完成代码只是中点，解释边界和证明决策才是验收。</p>
      </div>
    </section>

    <section class="portal-shell project-catalogue">
      <nav class="project-filters" aria-label="项目类型">
        <button v-for="filter in filters" :key="filter" :class="{ active: activeFilter === filter }" @click="activeFilter = filter">{{ filter }}</button>
      </nav>

      <div class="project-grid">
        <article v-for="project in visibleProjects" :key="project.id" class="project-card">
          <header><span>{{ project.index }}</span><small>{{ project.category }}</small></header>
          <h2>{{ project.title }}</h2>
          <div class="project-stack"><i v-for="item in project.stack" :key="item">{{ item }}</i></div>
          <p>{{ project.summary }}</p>
          <section><b>必须交付的证据</b><ul><li v-for="item in project.evidence" :key="item">{{ item }}</li></ul></section>
          <ol><li v-for="(item, index) in project.milestones" :key="item"><span>{{ index + 1 }}</span>{{ item }}</li></ol>
          <NuxtLink :to="project.entry">进入前置课程 <span>→</span></NuxtLink>
        </article>
      </div>

      <section class="project-rubric">
        <div><p class="portal-kicker">REVIEW RUBRIC</p><h2>统一项目验收尺</h2><p>无论项目属于哪个技术栈，都用下面四类证据判断是否真正掌握。</p></div>
        <ul>
          <li><span>01</span><div><b>机制正确</b><p>状态、控制流、所有权和并发语义能被测试证明。</p></div></li>
          <li><span>02</span><div><b>失败可解释</b><p>超时、取消、恢复、资源耗尽和脏数据拥有明确路径。</p></div></li>
          <li><span>03</span><div><b>工程可观测</b><p>日志、指标、trace 与 profiler 能定位到具体阶段。</p></div></li>
          <li><span>04</span><div><b>取舍可辩护</b><p>能说明删掉什么、保留什么，以及生产版为何更复杂。</p></div></li>
        </ul>
      </section>
    </section>
  </main>
</template>
