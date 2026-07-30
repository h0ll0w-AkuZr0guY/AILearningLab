import type { Lesson, Track, TrackId } from './curriculum'
import { getTopicGuide } from './topic-guides'
import type { GuideChapter, GuideStudyPlan, GuideVariant, TopicGuide } from './guide-types'

export interface OfficialSection {
  title: string
  url: string
  note: string
}

export interface SourceExcerpt {
  repo: string
  file: string
  symbol: string
  language: string
  code: string
  walkthrough: string[]
  url: string
}

export interface LessonDetail {
  curated: boolean
  official: OfficialSection
  source: SourceExcerpt
  overview: string[]
  chapters: GuideChapter[]
  mechanisms: string[]
  pitfalls: string[]
  variants: GuideVariant[]
  studyPlan: GuideStudyPlan
  example: string
  exampleLanguage: string
  selfCheckQuestion: string
  selfCheckAnswer: string
  referenceAnswer: string
  buildSteps: Array<{ title: string; body: string; code?: string }>
  annotatedSource: string
  sourceLabel: string
}

const section = (title: string, url: string, note: string): OfficialSection => ({ title, url, note })

const officialSections: Record<TrackId, OfficialSection[]> = {
  python: [
    section('Data model · Objects, values and types', 'https://docs.python.org/3/reference/datamodel.html#objects-values-and-types', 'Python 中名称绑定到对象；对象拥有身份、类型和值。可变性属于对象类型的语义，赋值本身不会复制对象。'),
    section('Data model · Customizing attribute access', 'https://docs.python.org/3/reference/datamodel.html#customizing-attribute-access', '属性访问由实例、类型、描述符与兜底钩子共同决定。data descriptor 的优先级高于实例字典。'),
    section('Execution model · Naming and binding', 'https://docs.python.org/3/reference/executionmodel.html#naming-and-binding', '函数执行会建立局部命名空间；闭包捕获自由变量所在的 cell，而非提前复制最终值。'),
    section('Expressions · Yield expressions', 'https://docs.python.org/3/reference/expressions.html#yield-expressions', 'yield 暂停生成器帧并保留执行状态；send、throw、close 都通过恢复该帧改变控制流。'),
    section('Compound statements · The try statement', 'https://docs.python.org/3/reference/compound_stmts.html#the-try-statement', '异常处理改变控制流，但 finally 的清理语义仍会在 return、break 和异常传播时执行。'),
    section('The import system', 'https://docs.python.org/3/reference/import.html#the-import-system', '导入先检查 sys.modules，再通过 finder、ModuleSpec 与 loader 创建并执行模块；失败时要处理半初始化状态。'),
    section('typing.Protocol', 'https://docs.python.org/3/library/typing.html#typing.Protocol', 'Protocol 用结构兼容表达接口，只要成员形状满足约束就能通过静态检查。'),
    section('asyncio Task groups', 'https://docs.python.org/3/library/asyncio-task.html#task-groups', 'TaskGroup 把子任务生命周期约束到词法作用域，并对失败与取消提供结构化传播。'),
    section('tracemalloc', 'https://docs.python.org/3/library/tracemalloc.html#tracemalloc', 'tracemalloc 记录 Python 内存分配栈，快照差分比单次内存数字更适合定位泄漏。'),
    section('CPython internals', 'https://devguide.python.org/internals/', 'CPython 将源码解析、符号分析、字节码生成和解释器执行连接成可观察的实现流水线。')
  ],
  typescript: [
    section('JavaScript modules and runtime boundary', 'https://www.typescriptlang.org/docs/handbook/2/modules.html#how-javascript-modules-are-defined', 'TypeScript 的类型在 emit 后大多消失，运行时仍遵循 JavaScript 的对象、原型、事件循环和模块语义。'),
    section('Type compatibility', 'https://www.typescriptlang.org/docs/handbook/type-compatibility.html#starting-out', 'TypeScript 主要采用结构类型：目标类型要求的成员都存在即可赋值，同时在函数参数等位置保留工程化权衡。'),
    section('Narrowing', 'https://www.typescriptlang.org/docs/handbook/2/narrowing.html#control-flow-analysis', 'checker 沿控制流记录可达路径上的类型事实，并在赋值、闭包或不可证明的副作用后撤销部分事实。'),
    section('Generics', 'https://www.typescriptlang.org/docs/handbook/2/generics.html#generic-constraints', '泛型将调用点信息传播到返回值；constraint 限制能力集合，而不应抹掉具体类型。'),
    section('More on functions', 'https://www.typescriptlang.org/docs/handbook/2/functions.html#function-overloads', '重载签名服务调用者，实现签名负责覆盖所有分支；调用者看不到实现签名。'),
    section('Classes', 'https://www.typescriptlang.org/docs/handbook/2/classes.html#member-visibility', 'TS private 主要是静态约束，ECMAScript #private 由运行时强制，两者的可观察性不同。'),
    section('Modules reference', 'https://www.typescriptlang.org/docs/handbook/modules/reference.html#the-module-compiler-option', '模块解析回答标识符对应哪个文件，module emit 回答输出由哪种加载器执行，这两层需要与部署环境一致。'),
    section('TSConfig reference', 'https://www.typescriptlang.org/tsconfig/#strict', 'strict 是一组健全性预算；exactOptionalPropertyTypes 与 noUncheckedIndexedAccess 会直接改变公共 API 的可证明边界。'),
    section('Declaration files', 'https://www.typescriptlang.org/docs/handbook/declaration-files/introduction.html', '.d.ts 描述消费者可见的运行时表面，设计重点是调用契约与版本兼容。'),
    section('Compiler API', 'https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API', 'Program 管理源文件和编译上下文，TypeChecker 把 AST 节点连接到 symbol 与 type。'),
    section('TypeScript FAQ', 'https://github.com/microsoft/TypeScript/wiki/FAQ', '复杂面试题的核心通常是可赋值性、推断和运行时边界，而非孤立的类型体操。')
  ],
  langchain: [
    section('Messages', 'https://docs.langchain.com/oss/python/langchain/messages', '消息对象同时承载角色、内容块、工具调用和供应商元数据，是模型、工具与持久化之间的稳定协议。'),
    section('Models', 'https://docs.langchain.com/oss/python/langchain/models', '模型适配层统一 invoke、stream、tool binding 与结构化输出，同时保留供应商能力差异。'),
    section('Structured output', 'https://docs.langchain.com/oss/python/langchain/structured-output', '结构化输出把自由文本转成可验证 schema；provider strategy 与 tool strategy 的故障面不同。'),
    section('Tools', 'https://docs.langchain.com/oss/python/langchain/tools', '工具由名称、描述、输入 schema 与执行函数组成；描述会进入模型上下文并直接影响调用决策。'),
    section('Agents', 'https://docs.langchain.com/oss/python/langchain/agents#agents', '标准 Agent 循环反复调用模型、执行工具并把结果追加为消息，直到没有工具调用或预算终止。'),
    section('Middleware overview', 'https://docs.langchain.com/oss/python/langchain/middleware/overview', 'middleware 在模型和工具调用前后插入横切逻辑，用于重试、限额、审计、摘要和人工审批。'),
    section('Short-term memory', 'https://docs.langchain.com/oss/python/langchain/short-term-memory', '短期记忆属于线程状态；长对话需要裁剪、摘要或外置，防止上下文成本持续增长。'),
    section('Retrieval', 'https://docs.langchain.com/oss/python/langchain/retrieval', 'RAG 将加载、切分、索引、检索和生成分层，每层都应拥有单独的评测指标。'),
    section('Test agents', 'https://docs.langchain.com/oss/python/langchain/test', '单元测试使用可预测模型隔离外部不确定性，轨迹评测再验证工具序列与最终结果。'),
    section('LangChain overview', 'https://docs.langchain.com/oss/python/langchain/overview', '最小框架需要稳定消息、模型、工具、运行配置、错误与可观测边界，而非堆叠大量 convenience API。')
  ],
  langgraph: [
    section('LangGraph overview', 'https://docs.langchain.com/oss/python/langgraph/overview', 'LangGraph 用显式 state、node 和 edge 表达长运行工作流，目标集中在耐久执行、人工介入与可观测性。'),
    section('Graph API · State', 'https://docs.langchain.com/oss/python/langgraph/graph-api#state', 'state schema 定义共享数据，reducer 定义并发更新如何合并；覆盖与追加需要明确区分。'),
    section('Graph API · Edges', 'https://docs.langchain.com/oss/python/langgraph/graph-api#edges', '边把路由从节点内部提取为可检查拓扑，条件边和 Command 分别适合不同的控制粒度。'),
    section('Persistence · Checkpoints', 'https://docs.langchain.com/oss/python/langgraph/persistence#checkpoints', 'checkpointer 在每个 super-step 保存快照并按 thread 组织，从而支持恢复、时间旅行与人工审批。'),
    section('Graph API', 'https://docs.langchain.com/oss/python/langgraph/graph-api', 'StateGraph 在 compile 时验证结构并生成 Pregel 风格运行时；节点只返回状态更新。'),
    section('Durable execution', 'https://docs.langchain.com/oss/python/langgraph/durable-execution', '可恢复执行要求副作用幂等或被事务性任务包装，否则 resume 可能重复外部动作。'),
    section('Interrupts', 'https://docs.langchain.com/oss/python/langgraph/interrupts', 'interrupt 把暂停点写入持久状态，恢复时使用 Command 提供人工输入。'),
    section('Subgraphs', 'https://docs.langchain.com/oss/python/langgraph/use-subgraphs', '子图通过输入输出状态合同隔离内部实现，可共享或隔离 checkpointer。'),
    section('Map-reduce and parallel branches', 'https://docs.langchain.com/oss/python/langgraph/graph-api#send', 'Send 能动态派生并行任务，reducer 负责确定性汇聚，取消与错误传播必须单独设计。'),
    section('LangSmith observability', 'https://docs.langchain.com/langsmith/observability-quickstart', 'trace 应区分模型、工具、路由和存储延迟，以便把质量问题定位到具体层。'),
    section('Agentic RAG', 'https://docs.langchain.com/oss/python/langgraph/agentic-rag', '检索图把 query rewrite、检索、评分和生成拆成可回放节点。'),
    section('Application structure', 'https://docs.langchain.com/oss/python/langgraph/application-structure', '生产图需要将配置、状态、节点、工具和部署入口分离，权限控制不能只依赖 prompt。'),
    section('Deployment overview', 'https://docs.langchain.com/langsmith/deployment-quickstart', '长任务服务需要 thread、stream、cancel、resume、租户隔离与配额共同工作。')
  ],
  deepagents: [
    section('Deep Agents overview', 'https://docs.langchain.com/oss/python/deepagents/overview', 'Deep Agents 在 Agent framework 之上提供 planning、文件系统、上下文管理和子代理等 harness 能力。'),
    section('Planning', 'https://docs.langchain.com/oss/python/deepagents/overview#planning-and-task-decomposition', 'write_todos 将计划外化为可观察状态，允许进度更新、失败标注与重新规划。'),
    section('Backends', 'https://docs.langchain.com/oss/python/deepagents/backends', 'backend protocol 把临时状态、真实文件、长期 store 和 sandbox 统一为文件工具表面。'),
    section('Sandboxes', 'https://docs.langchain.com/oss/python/deepagents/sandboxes', '执行代码需要资源限制、路径和网络策略；LocalShellBackend 只适合受控本地环境。'),
    section('Subagents', 'https://docs.langchain.com/oss/python/deepagents/subagents', 'task 工具把子任务和上下文交给专长代理，结果通过明确合同返回主代理。'),
    section('Long-term memory', 'https://docs.langchain.com/oss/python/deepagents/long-term-memory', '大输出可以落到文件或 store，再按需读回，减少主上下文的长期压力。'),
    section('Skills', 'https://docs.langchain.com/oss/python/deepagents/skills', 'skill 把指令、资源和工具组合固化为可版本化能力单元。'),
    section('Human-in-the-loop', 'https://docs.langchain.com/oss/python/deepagents/human-in-the-loop', '高风险工具调用应经过显式审批，trace、策略和回放共同构成生产治理证据。')
  ],
  nuxt: [
    section('Vue reactivity in depth', 'https://vuejs.org/guide/extras/reactivity-in-depth.html#how-reactivity-works-in-vue', 'Vue 通过 Proxy/Ref 的 get 追踪依赖、set 触发 effect；scheduler 决定更新何时真正执行。'),
    section('Rendering mechanism', 'https://vuejs.org/guide/extras/rendering-mechanism.html#virtual-dom', '模板编译为 render function，VNode patch 使用静态分析产生的标记减少运行时比较。'),
    section('Nuxt lifecycle hooks', 'https://nuxt.com/docs/4.x/api/advanced/hooks', 'Nuxt 生命周期横跨构建、服务器渲染、payload、hydration 和客户端导航，同一代码可能运行在不同环境。'),
    section('Rendering modes', 'https://nuxt.com/docs/4.x/guide/concepts/rendering#universal-rendering', '通用渲染先在服务器生成 HTML，再由浏览器 hydration 恢复交互；两端初始输出必须一致。'),
    section('Pages and routing', 'https://nuxt.com/docs/4.x/getting-started/routing#pages', '文件系统生成路由记录；嵌套目录、动态参数和父页面出口共同决定最终匹配。'),
    section('Data fetching', 'https://nuxt.com/docs/4.x/getting-started/data-fetching#the-need-for-usefetch-and-useasyncdata', 'useFetch/useAsyncData 把服务端结果写入 payload，hydration 时复用以避免双重请求。'),
    section('Server engine', 'https://nuxt.com/docs/4.x/guide/concepts/server-engine', 'Nitro 将 API、storage、route rules 与多平台 preset 组织为同一服务端输出模型。'),
    section('Nuxt modules', 'https://nuxt.com/docs/4.x/guide/going-further/modules', 'module 在构建阶段扩展 Nuxt，plugin 在运行时扩展应用；二者的生命周期与副作用边界不同。'),
    section('Performance', 'https://nuxt.com/docs/4.x/guide/best-practices/performance', '性能需要从资源瀑布、payload、hydration、交互和缓存证据共同评估。'),
    section('Prerendering', 'https://nuxt.com/docs/4.x/getting-started/prerendering#crawl-based-pre-rendering', 'nuxt generate 通过初始路由和页面链接爬取静态路径，动态页面必须可发现或显式声明。'),
    section('Nuxt architecture', 'https://nuxt.com/docs/4.x/guide/going-further/internals', '架构题需要同时说明状态归属、同构边界、失败策略、可观测性与渐进迁移。')
  ],
  transformer: [
    section('NumPy array fundamentals · scalar, vector, matrix and tensor', 'https://numpy.org/doc/stable/user/absolute_beginners.html#array-fundamentals', '0 维数组常被称为标量，1 维数组常被称为向量，2 维数组常被称为矩阵，更高维数组可继续表达 batch、time、head 等轴；程序中应优先使用 ndim 与 shape 描述它们。'),
    section('Tokenizer summary', 'https://huggingface.co/docs/transformers/main/tokenizer_summary', 'tokenizer 把 Unicode 文本映射为有限词表 ID，规范化和切分边界会影响长度、成本与能力。'),
    section('Attention', 'https://huggingface.co/docs/transformers/main/model_summary#attention-layers', 'scaled dot-product attention 计算 QKᵀ/√d，再用 mask 与 softmax 得到对 V 的加权组合。'),
    section('Model outputs', 'https://huggingface.co/docs/transformers/main/main_classes/output', '多头注意力在不同子空间并行建模，再 concat 投影回隐藏维度。'),
    section('KV cache', 'https://huggingface.co/docs/transformers/main/kv_cache#default-cache', '自回归生成缓存历史 K/V，使每一步只计算新 token 的投影，但缓存显存随层数和上下文增长。'),
    section('Normalization and model internals', 'https://huggingface.co/docs/transformers/main/model_summary#the-original-transformer', '残差提供梯度捷径，归一化位置会改变优化稳定性和深层信号传播。'),
    section('Training', 'https://huggingface.co/docs/transformers/main/training', '训练闭环需要数据批处理、loss、反向传播、优化器、调度器、混合精度和 checkpoint 一致工作。'),
    section('Generation', 'https://huggingface.co/docs/transformers/main_classes/text_generation#transformers.GenerationConfig', '生成策略改变质量、随机性、吞吐和可复现性；停止条件与 cache 同样属于 API 契约。'),
    section('PEFT integration', 'https://huggingface.co/docs/transformers/main/peft', '参数高效微调冻结大部分基础权重，只训练较小适配参数；数据与评测仍决定最终能力。'),
    section('Custom models', 'https://huggingface.co/docs/transformers/main/custom_models', '从零实现需要 config、模块、权重保存加载、训练和 generation 接口形成闭环。'),
    section('Model architectures', 'https://huggingface.co/docs/transformers/main/model_summary#transformers-are-big-models', 'encoder、decoder、MoE 与长上下文变体在计算、路由、通信和缓存上交换成本。'),
    section('Performance and scalability', 'https://huggingface.co/docs/transformers/main/performance', '系统设计要把模型质量、token 成本、延迟、显存、并发和安全指标放在同一预算中。')
  ],
  torch: [
    section('Tensor views', 'https://docs.pytorch.org/docs/stable/tensor_view.html#tensor-views', 'Tensor view 共享 storage，只改变 size、stride 与 offset；并非所有 reshape 都能保持零拷贝。'),
    section('Broadcasting semantics', 'https://docs.pytorch.org/docs/stable/notes/broadcasting.html#general-semantics', '广播通过逻辑扩展对齐维度，反向传播需要沿被扩展维度求和。'),
    section('Autograd mechanics', 'https://docs.pytorch.org/docs/stable/notes/autograd.html#how-autograd-encodes-the-history', '前向执行动态记录 Function 图，backward 从输出沿 VJP 传播并累积到叶子 Tensor。'),
    section('Extending autograd', 'https://docs.pytorch.org/docs/stable/notes/extending.html#extending-torch-autograd', '自定义 Function 必须保存反向真正需要的张量，并用 gradcheck 验证数值导数。'),
    section('torch.nn.Module', 'https://docs.pytorch.org/docs/stable/generated/torch.nn.Module.html#torch.nn.Module', 'Module 通过 __setattr__ 注册 Parameter、buffer 和子模块，state_dict 则是可序列化状态合同。'),
    section('Data loading', 'https://docs.pytorch.org/docs/stable/data.html#torch.utils.data.DataLoader', 'DataLoader 连接 Dataset、Sampler、collate 与 worker；随机种子和 checkpoint 决定可恢复性。'),
    section('CUDA semantics', 'https://docs.pytorch.org/docs/stable/notes/cuda.html#asynchronous-execution', 'CUDA kernel 默认异步提交，计时与错误定位需要理解同步点、stream 和 allocator。'),
    section('DistributedDataParallel', 'https://docs.pytorch.org/docs/stable/generated/torch.nn.parallel.DistributedDataParallel.html#distributeddataparallel', 'DDP 在各进程复制模型并通过梯度 bucket all-reduce 同步，数据采样必须按 rank 切分。'),
    section('torch.compile', 'https://docs.pytorch.org/docs/stable/generated/torch.compile.html#torch.compile', 'Dynamo 通过 guard 捕获 Python frame，AOTAutograd 生成反向图，Inductor 完成融合与代码生成。'),
    section('Dispatcher', 'https://docs.pytorch.org/docs/stable/notes/extending.html#adding-new-operators', 'dispatcher 根据 operator schema 和 dispatch key 选择 CPU、CUDA、Autograd 等 kernel。'),
    section('Export', 'https://docs.pytorch.org/docs/stable/export.html#torch-export', '部署需要冻结可导出的计算合同，并独立验证数值、性能和不支持算子。'),
    section('PyTorch profiler', 'https://docs.pytorch.org/docs/stable/profiler.html#torch-profiler', '性能诊断应把数据等待、kernel、通信、同步和显存峰值分开取证。')
  ],
  vllm: [
    section('Optimization and tuning', 'https://docs.vllm.ai/en/latest/configuration/optimization.html', '推理服务首先区分 prefill 与 decode，再用 TTFT、TPOT、吞吐和显存建立容量模型。'),
    section('Paged Attention', 'https://docs.vllm.ai/en/latest/design/paged_attention.html', 'KV cache 按固定 block 分配并通过 block table 间接寻址，降低连续大块分配造成的碎片。'),
    section('Scheduler', 'https://docs.vllm.ai/en/latest/api/vllm/v1/core/sched/scheduler.html', 'continuous batching 在 token 粒度混合新请求与解码请求，scheduler 用预算、抢占和公平策略决定每步工作。'),
    section('Engine', 'https://docs.vllm.ai/en/latest/api/vllm/v1/engine/async_llm.html', 'engine 将请求管理、调度、模型执行、并行 worker 与输出处理分层。'),
    section('OpenAI-compatible server', 'https://docs.vllm.ai/en/latest/serving/openai_compatible_server.html', '兼容服务需要对齐请求 schema、SSE chunk、usage、取消与错误，而不只匹配 URL。'),
    section('Sampling parameters', 'https://docs.vllm.ai/en/latest/api/vllm/sampling_params.html', 'temperature、top-p、beam 与 guided decoding 改变输出分布，也改变每请求的服务资源。'),
    section('LoRA adapters', 'https://docs.vllm.ai/en/latest/features/lora.html#serving-lora-adapters', '多 LoRA 共享基础模型并按请求选择 adapter，但 adapter cache、rank 和租户隔离会进入调度预算。'),
    section('Production metrics', 'https://docs.vllm.ai/en/latest/design/metrics.html', '生产调优要同时观察队列、TTFT、TPOT、KV cache 命中、GPU 利用率和抢占。')
  ],
  lora: [
    section('LoRA conceptual guide', 'https://huggingface.co/docs/peft/main/developer_guides/lora#lora', 'LoRA 冻结基础权重 W，并训练低秩更新 BA；rank 控制容量，alpha 控制缩放。'),
    section('Target modules', 'https://huggingface.co/docs/peft/main/developer_guides/lora#qLoRA-style-training', 'target_modules 决定适配参数注入位置；覆盖更多线性层会提高容量和显存。'),
    section('Initialization', 'https://huggingface.co/docs/peft/main/developer_guides/lora#initialization', '默认初始化使 adapter 起点接近恒等更新，不同初始化方法改变早期优化与低秩子空间。'),
    section('PEFT quicktour', 'https://huggingface.co/docs/peft/main/quicktour#train-a-peft-model', 'PeftModel 包装基础模型并只保存 adapter 状态，加载时必须匹配基础模型和配置。'),
    section('Quantization', 'https://huggingface.co/docs/peft/main/developer_guides/quantization#quantization', 'QLoRA 量化冻结的基础权重，以更高精度计算 adapter；显存还包含激活、梯度和优化器状态。'),
    section('Model merging', 'https://huggingface.co/docs/peft/main/developer_guides/model_merging#merge-method', 'merge 将 adapter 更新折叠进基础权重；多 adapter 合并需要检查权重、秩与任务冲突。'),
    section('LoRA variants', 'https://huggingface.co/docs/peft/main/developer_guides/lora#lora-variants', 'DoRA、RSLoRA、PiSSA 等变体针对幅值、缩放或初始化提出不同假设，应由消融实验选择。'),
    section('Checkpoint format', 'https://huggingface.co/docs/peft/main/developer_guides/checkpoint#peft-files', '训练诊断要连接数据格式、rank、目标层、基础模型版本、checkpoint 与业务评测。')
  ]
}

const sourceCatalog: Record<TrackId, SourceExcerpt[]> = {
  python: [
    { repo: 'python/cpython', file: 'Objects/object.c', symbol: 'PyObject_GetAttr', language: 'c', code: 'PyObject *\nPyObject_GetAttr(PyObject *v, PyObject *name)\n{\n    PyTypeObject *tp = Py_TYPE(v);\n    if (tp->tp_getattro != NULL) {\n        return (*tp->tp_getattro)(v, name);\n    }\n    /* error path omitted */\n}', walkthrough: ['从 Py_TYPE(v) 取得运行时类型。', '属性协议最终分派到类型槽 tp_getattro。', '失败路径负责构造可解释的 AttributeError。'], url: 'https://github.com/python/cpython/blob/main/Objects/object.c' },
    { repo: 'python/cpython', file: 'Python/ceval.c', symbol: 'PyEval_EvalCode', language: 'c', code: 'PyObject *\nPyEval_EvalCode(PyObject *co, PyObject *globals, PyObject *locals)\n{\n    PyThreadState *tstate = _PyThreadState_GET();\n    return PyEval_EvalCodeEx(co, globals, locals,\n                            NULL, 0, NULL, 0, NULL, 0, NULL, NULL);\n}', walkthrough: ['入口取得当前线程状态。', 'code、globals 与 locals 共同定义执行上下文。', '真正的帧执行继续下沉到解释器内部。'], url: 'https://github.com/python/cpython/blob/main/Python/ceval.c' },
    { repo: 'python/cpython', file: 'Lib/asyncio/taskgroups.py', symbol: 'TaskGroup.create_task', language: 'python', code: 'def create_task(self, coro, *, name=None, context=None, **kwargs):\n    if not self._entered:\n        raise RuntimeError(\"TaskGroup has not been entered\")\n    if self._exiting and not self._tasks:\n        raise RuntimeError(\"TaskGroup is finished\")\n    task = self._loop.create_task(coro, name=name, context=context, **kwargs)\n    self._tasks.add(task)\n    task.add_done_callback(self._on_task_done)\n    return task', walkthrough: ['先验证结构化并发的生命周期状态。', '新 Task 被登记到集合。', 'done callback 汇聚成功、异常与取消。'], url: 'https://github.com/python/cpython/blob/main/Lib/asyncio/taskgroups.py' }
  ],
  typescript: [
    { repo: 'microsoft/TypeScript', file: 'src/compiler/checker.ts', symbol: 'isTypeAssignableTo', language: 'typescript', code: 'function isTypeAssignableTo(source: Type, target: Type): boolean {\n  return isTypeRelatedTo(source, target, assignableRelation);\n}', walkthrough: ['公开问题被归约成 type relation。', 'assignableRelation 作为缓存与规则集合参与比较。', '复杂对象、联合与函数类型继续递归检查。'], url: 'https://github.com/microsoft/TypeScript/blob/main/src/compiler/checker.ts' },
    { repo: 'microsoft/TypeScript', file: 'src/compiler/program.ts', symbol: 'createProgram', language: 'typescript', code: 'export function createProgram(\n  rootNamesOrOptions: readonly string[] | CreateProgramOptions,\n  _options?: CompilerOptions,\n  _host?: CompilerHost,\n  _oldProgram?: Program,\n  _configFileParsingDiagnostics?: readonly Diagnostic[],\n): Program {\n  /* normalize inputs, build graph, bind and check lazily */\n}', walkthrough: ['归一化 rootNames、options 与 host。', '建立 SourceFile 依赖图并复用旧 Program。', 'binder 与 checker 通过 Program 暴露统一上下文。'], url: 'https://github.com/microsoft/TypeScript/blob/main/src/compiler/program.ts' },
    { repo: 'microsoft/TypeScript', file: 'src/compiler/moduleNameResolver.ts', symbol: 'resolveModuleName', language: 'typescript', code: 'export function resolveModuleName(\n  moduleName: string,\n  containingFile: string,\n  compilerOptions: CompilerOptions,\n  host: ModuleResolutionHost,\n  cache?: ModuleResolutionCache,\n): ResolvedModuleWithFailedLookupLocations {\n  /* select resolver and cache lookup result */\n}', walkthrough: ['输入同时包含模块名与所在文件。', 'compilerOptions 决定 NodeNext、Bundler 等策略。', '失败查找路径也会保留用于诊断和 watch。'], url: 'https://github.com/microsoft/TypeScript/blob/main/src/compiler/moduleNameResolver.ts' }
  ],
  langchain: [
    { repo: 'langchain-ai/langchain', file: 'libs/langchain/langchain/agents/factory.py', symbol: 'create_agent', language: 'python', code: 'def create_agent(\n    model,\n    tools=None,\n    *,\n    system_prompt=None,\n    middleware=(),\n    response_format=None,\n    state_schema=None,\n    context_schema=None,\n    checkpointer=None,\n    store=None,\n):\n    \"\"\"Creates an agent graph that calls tools in a loop.\"\"\"\n    ...', walkthrough: ['把 model、tools 和 middleware 归一化。', '构建模型节点、工具节点与条件路由。', '返回已编译的 LangGraph，而非隐藏的黑盒循环。'], url: 'https://github.com/langchain-ai/langchain/blob/master/libs/langchain/langchain/agents/factory.py' },
    { repo: 'langchain-ai/langchain', file: 'libs/core/langchain_core/tools/base.py', symbol: 'BaseTool.run', language: 'python', code: 'def run(\n    self,\n    tool_input,\n    verbose=None,\n    start_color=\"green\",\n    color=\"green\",\n    callbacks=None,\n    *,\n    tags=None,\n    metadata=None,\n    run_name=None,\n    run_id=None,\n    config=None,\n    tool_call_id=None,\n    **kwargs,\n):\n    ...', walkthrough: ['解析并验证 tool_input。', '建立 callback/run 上下文。', '统一包装执行结果与 ToolException。'], url: 'https://github.com/langchain-ai/langchain/blob/master/libs/core/langchain_core/tools/base.py' },
    { repo: 'langchain-ai/langchain', file: 'libs/core/langchain_core/runnables/base.py', symbol: 'RunnableSequence.invoke', language: 'python', code: 'def invoke(self, input, config=None, **kwargs):\n    config = config_with_context(ensure_config(config), self.steps)\n    run_manager = callback_manager.on_chain_start(...)\n    for i, step in enumerate(self.steps):\n        input = step.invoke(input, patch_config(config, ...))\n    return input', walkthrough: ['统一运行配置与上下文。', '逐 step 传播输入和 callback。', '异常通过 run manager 形成可观测失败轨迹。'], url: 'https://github.com/langchain-ai/langchain/blob/master/libs/core/langchain_core/runnables/base.py' }
  ],
  langgraph: [
    { repo: 'langchain-ai/langgraph', file: 'libs/langgraph/langgraph/graph/state.py', symbol: 'StateGraph.add_node', language: 'python', code: 'def add_node(\n    self,\n    node,\n    action=None,\n    *,\n    defer=False,\n    metadata=None,\n    input_schema=None,\n    retry_policy=None,\n    cache_policy=None,\n    destinations=None,\n):\n    ...', walkthrough: ['注册节点名与 runnable。', '记录输入 schema、重试和 cache 策略。', 'compile 时再验证边、入口和冲突。'], url: 'https://github.com/langchain-ai/langgraph/blob/main/libs/langgraph/langgraph/graph/state.py' },
    { repo: 'langchain-ai/langgraph', file: 'libs/prebuilt/langgraph/prebuilt/tool_node.py', symbol: 'ToolNode', language: 'python', code: 'class ToolNode(RunnableCallable):\n    \"\"\"A node that runs tools requested in the last AIMessage.\"\"\"\n\n    def __init__(self, tools, *, name=\"tools\", tags=None,\n                 handle_tool_errors=True, messages_key=\"messages\"):\n        ...', walkthrough: ['从最后一条 AIMessage 读取 tool_calls。', '验证工具注册表并支持并行执行。', '把结果规范化为 ToolMessage 或 Command。'], url: 'https://github.com/langchain-ai/langgraph/blob/main/libs/prebuilt/langgraph/prebuilt/tool_node.py' },
    { repo: 'langchain-ai/langgraph', file: 'libs/checkpoint/langgraph/checkpoint/base/__init__.py', symbol: 'BaseCheckpointSaver', language: 'python', code: 'class BaseCheckpointSaver(Generic[V]):\n    def get_tuple(self, config: RunnableConfig) -> CheckpointTuple | None:\n        raise NotImplementedError\n\n    def put(self, config, checkpoint, metadata, new_versions):\n        raise NotImplementedError', walkthrough: ['config 中的 thread 信息定位执行历史。', 'CheckpointTuple 同时携带状态、metadata 与 pending writes。', '具体存储实现必须保持版本和写入顺序。'], url: 'https://github.com/langchain-ai/langgraph/tree/main/libs/checkpoint' }
  ],
  deepagents: [
    { repo: 'langchain-ai/deepagents', file: 'libs/deepagents/deepagents/graph.py', symbol: 'create_deep_agent', language: 'python', code: 'def create_deep_agent(\n    model=None,\n    tools=None,\n    *,\n    system_prompt=None,\n    middleware=(),\n    subagents=None,\n    backend=None,\n    interrupt_on=None,\n    skills=None,\n    memory=None,\n    ...\n):\n    ...', walkthrough: ['组装 planning、filesystem 与 subagent middleware。', 'backend 决定文件工具背后的真实存储。', '最终仍委托 LangChain create_agent 构建运行图。'], url: 'https://github.com/langchain-ai/deepagents/tree/main/libs/deepagents/deepagents' },
    { repo: 'langchain-ai/deepagents', file: 'libs/deepagents/deepagents/backends/protocol.py', symbol: 'BackendProtocol', language: 'python', code: 'class BackendProtocol(Protocol):\n    def ls_info(self, path: str) -> list[FileInfo]: ...\n    def read(self, file_path: str, offset: int = 0, limit: int = 2000): ...\n    def write(self, file_path: str, content: str): ...\n    def edit(self, file_path: str, old_string: str, new_string: str): ...', walkthrough: ['协议定义 agent 可见的文件系统表面。', '实现可映射到 state、store、磁盘或 sandbox。', '权限和路径规范化必须位于 backend 边界。'], url: 'https://github.com/langchain-ai/deepagents/tree/main/libs/deepagents/deepagents/backends' },
    { repo: 'langchain-ai/deepagents', file: 'libs/deepagents/deepagents/middleware/subagents.py', symbol: 'SubAgentMiddleware', language: 'python', code: 'class SubAgentMiddleware(AgentMiddleware):\n    \"\"\"Adds a task tool for delegating work to subagents.\"\"\"\n\n    def __init__(self, *, default_model, default_tools, subagents=None,\n                 default_middleware=None, general_purpose_agent=True):\n        ...', walkthrough: ['把子代理配置编译成可调用 runnable。', 'task 工具只暴露描述、输入和结果合同。', '子代理上下文不会无条件污染主消息历史。'], url: 'https://github.com/langchain-ai/deepagents/tree/main/libs/deepagents/deepagents/middleware' }
  ],
  nuxt: [
    { repo: 'nuxt/nuxt', file: 'packages/nuxt/src/app/composables/asyncData.ts', symbol: 'useAsyncData', language: 'typescript', code: 'export function useAsyncData<DataT, DataE>(\n  key: string,\n  handler: (ctx: NuxtApp, options: { signal: AbortSignal }) => Promise<DataT>,\n  options?: AsyncDataOptions<DataT>,\n): AsyncData<DataT, DataE> {\n  const nuxtApp = useNuxtApp()\n  const initialFetch = () => handler(nuxtApp, { signal: controller.signal })\n  /* hydrate, dedupe and cache by key */\n}', walkthrough: ['key 将服务端数据与客户端 hydration 对齐。', 'handler 接收 AbortSignal 处理取消。', '共享 ref、dedupe 与 payload cache 共同决定请求行为。'], url: 'https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/app/composables/asyncData.ts' },
    { repo: 'nuxt/nuxt', file: 'packages/nuxt/src/app/nuxt.ts', symbol: 'createNuxtApp', language: 'typescript', code: 'export function createNuxtApp(options: CreateOptions) {\n  const nuxtApp: NuxtApp = {\n    _id: options.id || appId || \"nuxt-app\",\n    vueApp: options.vueApp,\n    payload: shallowReactive(options.ssrContext?.payload || {}),\n    provide: undefined,\n    hook: nuxtAppHooks.hook,\n    callHook: nuxtAppHooks.callHook,\n    ...\n  }\n  return nuxtApp\n}', walkthrough: ['创建每次渲染/客户端应用的上下文。', 'payload 连接 SSR 输出与 hydration。', 'hooks、provide 与 runWithContext 承载框架扩展点。'], url: 'https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/app/nuxt.ts' },
    { repo: 'nuxt/nuxt', file: 'packages/nuxt/src/pages/runtime/router.options.ts', symbol: 'routerOptions', language: 'typescript', code: 'export default <RouterConfig>{\n  scrollBehavior(to, from, savedPosition) {\n    const nuxtApp = useNuxtApp()\n    const behavior = useRouter().options?.scrollBehaviorType ?? \"auto\"\n    /* coordinate navigation hooks and saved positions */\n  },\n}', walkthrough: ['路由滚动行为同时考虑 history savedPosition。', '等待页面与 transition 生命周期完成。', 'hash、顶端与自定义策略最终归一化为 ScrollToOptions。'], url: 'https://github.com/nuxt/nuxt/tree/main/packages/nuxt/src/pages/runtime' }
  ],
  transformer: [
    { repo: 'huggingface/transformers', file: 'src/transformers/generation/utils.py', symbol: 'GenerationMixin.generate', language: 'python', code: 'def generate(\n    self,\n    inputs=None,\n    generation_config=None,\n    logits_processor=None,\n    stopping_criteria=None,\n    prefix_allowed_tokens_fn=None,\n    synced_gpus=None,\n    assistant_model=None,\n    streamer=None,\n    **kwargs,\n):\n    ...', walkthrough: ['合并模型默认值与 GenerationConfig。', '准备输入、cache、logits processor 和停止条件。', '根据配置分派 greedy、sampling、beam 等解码循环。'], url: 'https://github.com/huggingface/transformers/blob/main/src/transformers/generation/utils.py' },
    { repo: 'huggingface/transformers', file: 'src/transformers/modeling_utils.py', symbol: 'PreTrainedModel.from_pretrained', language: 'python', code: '@classmethod\ndef from_pretrained(\n    cls,\n    pretrained_model_name_or_path,\n    *model_args,\n    config=None,\n    cache_dir=None,\n    ignore_mismatched_sizes=False,\n    force_download=False,\n    local_files_only=False,\n    token=None,\n    revision=\"main\",\n    **kwargs,\n):\n    ...', walkthrough: ['解析 config、revision 与本地/远端文件。', '构造模型后加载并校验 state_dict。', '处理 dtype、device map、量化和权重缺失诊断。'], url: 'https://github.com/huggingface/transformers/blob/main/src/transformers/modeling_utils.py' },
    { repo: 'huggingface/transformers', file: 'src/transformers/trainer.py', symbol: 'Trainer.training_step', language: 'python', code: 'def training_step(self, model, inputs, num_items_in_batch=None):\n    model.train()\n    if hasattr(self.optimizer, \"train\"):\n        self.optimizer.train()\n    inputs = self._prepare_inputs(inputs)\n    with self.compute_loss_context_manager():\n        loss = self.compute_loss(model, inputs, num_items_in_batch=num_items_in_batch)\n    self.accelerator.backward(loss)\n    return loss.detach()', walkthrough: ['切换训练状态并准备设备上的 batch。', '在正确精度上下文计算 loss。', '通过 accelerator 统一反向与分布式行为。'], url: 'https://github.com/huggingface/transformers/blob/main/src/transformers/trainer.py' }
  ],
  torch: [
    { repo: 'pytorch/pytorch', file: 'torch/nn/modules/module.py', symbol: 'Module._call_impl', language: 'python', code: 'def _call_impl(self, *args, **kwargs):\n    forward_call = self._slow_forward if torch._C._get_tracing_state() else self.forward\n    if not (self._backward_hooks or self._forward_hooks or\n            self._forward_pre_hooks or _global_forward_hooks):\n        return forward_call(*args, **kwargs)\n    /* hook orchestration omitted */', walkthrough: ['无 hook 时走最短 forward 路径。', '存在 hook 时按 pre、forward、post、backward 顺序编排。', '异常路径仍要执行 always_call hooks。'], url: 'https://github.com/pytorch/pytorch/blob/main/torch/nn/modules/module.py' },
    { repo: 'pytorch/pytorch', file: 'torch/autograd/function.py', symbol: 'Function.apply', language: 'python', code: '@classmethod\ndef apply(cls, *args, **kwargs):\n    def bind_default_args(func, *args, **kwargs):\n        signature = inspect.signature(func)\n        bound_args = signature.bind(*args, **kwargs)\n        bound_args.apply_defaults()\n        return bound_args.args\n    is_setup_ctx_defined = _is_setup_context_defined(cls.setup_context)\n    if is_setup_ctx_defined:\n        args = bind_default_args(cls.forward, *args, **kwargs)\n    return super().apply(*args, **kwargs)', walkthrough: ['对 setup_context 风格 forward 绑定默认参数。', '进入 C++ autograd Function 基类执行。', '输出 Tensor 的 grad_fn 连接到反向 Node。'], url: 'https://github.com/pytorch/pytorch/blob/main/torch/autograd/function.py' },
    { repo: 'pytorch/pytorch', file: 'torch/__init__.py', symbol: 'torch.compile', language: 'python', code: 'def compile(\n    model=None,\n    *,\n    fullgraph=False,\n    dynamic=None,\n    backend=\"inductor\",\n    mode=None,\n    options=None,\n    disable=False,\n):\n    if model is None:\n        return functools.partial(compile, ...)\n    return torch._dynamo.optimize(backend=backend, ...)(model)', walkthrough: ['支持装饰器与直接调用两种入口。', '配置 Dynamo 捕获策略和 backend。', '返回包装函数，首次执行时按 guard 编译并缓存。'], url: 'https://github.com/pytorch/pytorch/blob/main/torch/__init__.py' }
  ],
  vllm: [
    { repo: 'vllm-project/vllm', file: 'vllm/v1/core/sched/scheduler.py', symbol: 'Scheduler.schedule', language: 'python', code: 'def schedule(self) -> SchedulerOutput:\n    scheduled_new_reqs = []\n    scheduled_resumed_reqs = []\n    scheduled_running_reqs = []\n    num_scheduled_tokens = {}\n    token_budget = self.max_num_scheduled_tokens\n    /* schedule running, waiting and cached requests */\n    return SchedulerOutput(...)', walkthrough: ['每一步从统一 token_budget 开始。', '先处理运行中请求，再考虑等待与恢复请求。', '输出显式记录 token、block、抢占和 encoder 工作。'], url: 'https://github.com/vllm-project/vllm/blob/main/vllm/v1/core/sched/scheduler.py' },
    { repo: 'vllm-project/vllm', file: 'vllm/v1/core/kv_cache_manager.py', symbol: 'KVCacheManager.allocate_slots', language: 'python', code: 'def allocate_slots(\n    self,\n    request: Request,\n    num_tokens: int,\n    new_computed_blocks=None,\n    num_lookahead_tokens=0,\n    delay_cache_blocks=False,\n) -> KVCacheBlocks | None:\n    \"\"\"Allocate KV cache blocks for a request.\"\"\"\n    ...', walkthrough: ['根据已有 computed blocks 计算新增容量。', '不足时返回 None 让 scheduler 决定抢占或等待。', 'block pool 与 request block table 同步更新。'], url: 'https://github.com/vllm-project/vllm/blob/main/vllm/v1/core/kv_cache_manager.py' },
    { repo: 'vllm-project/vllm', file: 'vllm/v1/engine/async_llm.py', symbol: 'AsyncLLM.generate', language: 'python', code: 'async def generate(\n    self,\n    prompt,\n    sampling_params,\n    request_id,\n    *,\n    tokenization_kwargs=None,\n    lora_request=None,\n    trace_headers=None,\n    priority=0,\n):\n    q = await self.add_request(...)\n    finished = False\n    while not finished:\n        out = q.get_nowait() or await q.get()\n        finished = out.finished\n        yield out', walkthrough: ['请求进入异步 engine queue。', '输出队列把调度循环与 API streaming 解耦。', '取消、异常和 finished 都映射到生成器生命周期。'], url: 'https://github.com/vllm-project/vllm/blob/main/vllm/v1/engine/async_llm.py' }
  ],
  lora: [
    { repo: 'huggingface/peft', file: 'src/peft/tuners/lora/layer.py', symbol: 'LoraLayer.update_layer', language: 'python', code: 'def update_layer(\n    self,\n    adapter_name,\n    r,\n    lora_alpha,\n    lora_dropout,\n    init_lora_weights,\n    use_rslora,\n    use_dora=False,\n    lora_bias=False,\n):\n    if r <= 0:\n        raise ValueError(\"`r` should be a positive integer\")\n    self.r[adapter_name] = r\n    self.lora_alpha[adapter_name] = lora_alpha\n    ...', walkthrough: ['验证 rank 并保存 adapter 配置。', '创建 dropout、A、B 等可训练模块。', '初始化与 scaling 策略决定初始等价性。'], url: 'https://github.com/huggingface/peft/blob/main/src/peft/tuners/lora/layer.py' },
    { repo: 'huggingface/peft', file: 'src/peft/mapping_func.py', symbol: 'get_peft_model', language: 'python', code: 'def get_peft_model(\n    model,\n    peft_config,\n    adapter_name=\"default\",\n    mixed=False,\n    autocast_adapter_dtype=True,\n    revision=None,\n    low_cpu_mem_usage=False,\n):\n    model_config = BaseTuner.get_model_config(model)\n    peft_config.base_model_name_or_path = model.__dict__.get(\"name_or_path\", None)\n    return PeftModel(model, peft_config, adapter_name=adapter_name, ...)', walkthrough: ['读取基础模型配置与名称。', '选择 PeftModel 或 mixed adapter 包装。', '包装器负责注入模块、切换 adapter 与 checkpoint。'], url: 'https://github.com/huggingface/peft/blob/main/src/peft/mapping_func.py' },
    { repo: 'huggingface/peft', file: 'src/peft/tuners/lora/layer.py', symbol: 'Linear.merge', language: 'python', code: 'def merge(self, safe_merge=False, adapter_names=None):\n    adapter_names = check_adapters_to_merge(self, adapter_names)\n    for active_adapter in adapter_names:\n        if active_adapter in self.lora_A.keys():\n            base_layer = self.get_base_layer()\n            delta_weight = self.get_delta_weight(active_adapter)\n            base_layer.weight.data += delta_weight\n            self.merged_adapters.append(active_adapter)', walkthrough: ['选择尚未合并的 adapter。', '由 A、B 与 scaling 计算 delta_weight。', 'safe merge 还会验证 NaN；unmerge 必须保持可逆顺序。'], url: 'https://github.com/huggingface/peft/blob/main/src/peft/tuners/lora/layer.py' }
  ]
}

const exampleFor = (track: Track, lesson: Lesson) => {
  const title = lesson.title.replaceAll('`', '')
  const examples: Record<TrackId, string> = {
    python: `# ${title}：先构造可观察事实，再解释机制
def probe():
    before = {}
    subject = {"topic": ${JSON.stringify(title)}}
    before["identity"] = id(subject)
    before["type"] = type(subject).__name__
    # TODO: 加入本节机制对应的操作
    assert before["identity"] == id(subject)
    return before

print(probe())`,
    typescript: `// ${title}：把静态契约与运行时证据放在一起
type Evidence<T> = { input: T; accepted: boolean; reason: string }

function verify<T>(input: T, predicate: (value: T) => boolean): Evidence<T> {
  const accepted = predicate(input)
  return { input, accepted, reason: accepted ? "contract holds" : "counterexample" }
}

console.log(verify(${JSON.stringify(title)}, value => value.length > 0))`,
    langchain: `# ${title}：最小可替换抽象
from dataclasses import dataclass
from typing import Protocol

@dataclass
class Message:
    role: str
    content: str

class Runnable(Protocol):
    def invoke(self, value, config=None): ...

def trace(step: Runnable, value):
    result = step.invoke(value, {"topic": ${JSON.stringify(title)}})
    return {"input": value, "output": result}`,
    langgraph: `# ${title}：显式状态更新与可重放节点
from typing import TypedDict

class State(TypedDict):
    value: int
    events: list[str]

def node(state: State) -> dict:
    return {
        "value": state["value"] + 1,
        "events": [f"${title}: advanced"],
    }

assert node({"value": 0, "events": []})["value"] == 1`,
    deepagents: `# ${title}：用协议隔离 harness 与真实环境
from typing import Protocol

class Backend(Protocol):
    def read(self, path: str) -> str: ...
    def write(self, path: str, content: str) -> None: ...

def execute_task(backend: Backend, task: str):
    backend.write("/todo.txt", task)
    return backend.read("/todo.txt")

# TODO: 实现 MemoryBackend，并验证路径越界失败`,
    nuxt: `<script setup lang="ts">
// ${title}：同时验证 SSR 与客户端恢复
const state = useState('lesson:${lesson.id}', () => ({ count: 0 }))
const increment = () => { state.value.count += 1 }
</script>

<template>
  <button @click="increment">${title}: {{ state.count }}</button>
</template>`,
    transformer: `# ${title}：让形状成为可执行断言
import torch

B, T, D = 2, 8, 32
x = torch.randn(B, T, D)
assert x.shape == (B, T, D)

def block(x: torch.Tensor) -> torch.Tensor:
    # TODO: 实现本节对应机制，并保留 shape invariant
    return x

assert block(x).shape == x.shape`,
    torch: `# ${title}：同时检查数值、梯度与 storage
import torch

x = torch.randn(4, 8, requires_grad=True)
y = x.square().mean()
y.backward()

assert x.grad is not None
assert x.grad.shape == x.shape
print({"topic": ${JSON.stringify(title)}, "stride": x.stride(), "loss": y.item()})`,
    vllm: `# ${title}：用离散事件模拟服务约束
from dataclasses import dataclass

@dataclass
class Request:
    request_id: str
    remaining_tokens: int

def schedule(waiting: list[Request], token_budget: int):
    selected = []
    for req in waiting:
        grant = min(req.remaining_tokens, token_budget)
        selected.append((req.request_id, grant))
        token_budget -= grant
        if token_budget == 0:
            break
    return selected`,
    lora: `# ${title}：直接验证 ΔW = B @ A
import torch

d_in, d_out, rank = 16, 12, 4
W = torch.randn(d_out, d_in, requires_grad=False)
A = torch.randn(rank, d_in, requires_grad=True)
B = torch.zeros(d_out, rank, requires_grad=True)

def linear(x):
    delta = B @ A
    return x @ (W + delta).T

x = torch.randn(2, d_in)
assert linear(x).shape == (2, d_out)`
  }
  return examples[track.id]
}

const commentPrefix = (language: string) => language === 'c' || language === 'typescript' ? '//' : '#'

const exampleLanguageFor = (track: Track, topicGuide?: TopicGuide) => {
  if (topicGuide?.exampleLanguage) return topicGuide.exampleLanguage
  if (track.id === 'typescript') return 'typescript'
  if (track.id === 'nuxt') return 'vue'
  return 'python'
}

const genericBuildSteps = (track: Track, lesson: Lesson, source: SourceExcerpt) => [
  {
    title: `积木 1：用自己的话定义「${lesson.title}」`,
    body: `先回答它接收什么、产生什么、会不会修改状态。定义必须能被一个反例证伪，避免停留在名词解释。`
  },
  {
    title: '积木 2：实现最小成功路径',
    body: `只保留一个入口、一种输入和一种输出。暂时不加入缓存、重试、并行或兼容分支，让核心数据流能够单步追踪。`
  },
  {
    title: '积木 3：补上第一个失败路径',
    body: `选择空输入、类型不匹配、取消、越界或状态冲突中的一种，明确它应该抛错、返回状态还是触发恢复。`
  },
  {
    title: `积木 4：对照 ${source.symbol}`,
    body: `把上游函数分成参数归一化、核心算法、状态更新和错误处理四段，只移植与你当前实现有关的部分。`
  }
]

const fallbackStudyPlan = (estimatedMinutes: number): GuideStudyPlan => {
  const readingMinutes = Math.max(10, Math.round(estimatedMinutes * 0.3))
  const sourceMinutes = Math.max(8, Math.round(estimatedMinutes * 0.22))
  const practiceMinutes = Math.max(10, Math.round(estimatedMinutes * 0.35))
  return {
    readingMinutes,
    sourceMinutes,
    practiceMinutes,
    reviewMinutes: Math.max(5, estimatedMinutes - readingMinutes - sourceMinutes - practiceMinutes)
  }
}

export function getLessonDetail(track: Track, lesson: Lesson): LessonDetail {
  const topicGuide = getTopicGuide(track.id, lesson.id, lesson.title)
  const sections = officialSections[track.id]
  const sources = sourceCatalog[track.id]
  const official = topicGuide?.official || sections[Math.min(lesson.moduleOrder - 1, sections.length - 1)]
  const source = topicGuide?.source || sources[(lesson.moduleOrder - 1) % sources.length]
  const sourceComment = commentPrefix(source.language)
  const annotatedSource = topicGuide?.source
    ? source.code
    : `${source.walkthrough.map((item, index) => `${sourceComment} ${index + 1}. ${item}`).join('\n')}\n\n${source.code}`
  const isTeachingSource = source.file.startsWith('教学版实现')
  return {
    curated: Boolean(topicGuide),
    official,
    source,
    overview: topicGuide?.overview?.length ? topicGuide.overview : [
      `${lesson.title} 是本节真正要掌握的能力。先把它还原为具体问题：调用者交给系统什么数据，系统依据哪些规则处理，结果以什么形式返回，失败时又能观察到什么。`,
      lesson.why,
      `官方文档给出的关键约束是：${official.note} 本节会把这条约束放进一个可运行的最小实现，再逐步补上错误处理、状态和工程取舍。`
    ],
    chapters: topicGuide?.chapters || [],
    mechanisms: topicGuide?.mechanisms?.length ? topicGuide.mechanisms : [
      `输入与表示：明确「${lesson.title}」处理的数据结构、类型、shape 或状态字段。`,
      `核心变换：只描述输入如何一步步变为输出，先排除缓存、兼容层等辅助逻辑。`,
      `失败边界：确定无效输入、重复调用、并发或取消时的可观察行为。`,
      `组合方式：说明这个积木如何被上一层函数调用，以及它会继续调用哪些更小的积木。`
    ],
    pitfalls: topicGuide?.pitfalls?.length ? topicGuide.pitfalls : [
      `只记调用形式，没有用具体输入手算或单步执行「${lesson.title}」的状态变化。`,
      `一开始照搬上游全部参数与兼容分支，导致核心算法被工程噪声淹没。`,
      `缺少失败用例和断言，直到多个函数组合后才发现底层契约理解错误。`
    ],
    variants: topicGuide?.variants || [],
    studyPlan: topicGuide?.studyPlan || fallbackStudyPlan(lesson.estimatedMinutes),
    example: topicGuide?.example || exampleFor(track, lesson),
    exampleLanguage: exampleLanguageFor(track, topicGuide),
    buildSteps: topicGuide?.buildSteps?.length ? topicGuide.buildSteps : genericBuildSteps(track, lesson, source),
    annotatedSource,
    sourceLabel: isTeachingSource
      ? '核心架构教学版 · 对应上游 torch.matmul'
      : topicGuide?.source
        ? '课题对应的真实上游源码 · 已补充中文阅读注释'
        : '模块级上游源码 · 待替换为课题精确入口',
    selfCheckQuestion: topicGuide?.selfCheckQuestion || `如果去掉「${lesson.title}」所代表的抽象，业务代码会在哪个边界变得脆弱？请先给出反例，再说明当前设计如何消除它。`,
    selfCheckAnswer: topicGuide?.selfCheckAnswer || `去掉「${lesson.title}」所代表的抽象后，调用者需要自行维护输入校验、状态变化、错误传播和恢复逻辑。最先变脆弱的通常是跨边界行为：同一能力在多个调用点出现不一致实现，失败路径缺少统一语义，也难以追踪。当前设计把这些规则收拢到 ${source.symbol} 附近的明确入口，通过统一协议和不变量降低重复实现；代价是多一层抽象、配置和调试路径，因此简单的一次性流程未必值得引入。`,
    referenceAnswer: topicGuide?.selfCheckAnswer || `结论：${lesson.title} 的价值在于把「${lesson.module}」中的关键约束变成可组合、可测试的协议。\n\n机制：调用从公开接口进入，核心状态在边界处被验证，再由 ${source.symbol} 完成分派或状态更新；成功结果和失败信息沿同一条协议返回。${official.note}\n\n源码证据：上游实现位于 ${source.repo} 的 ${source.file}，入口符号为 ${source.symbol}。阅读时应优先确认参数归一化、分派条件和错误路径。\n\n工程取舍：它用额外封装换取一致性、可观测性和替换能力；在低复杂度、无复用需求的场景中，直接实现可能更清楚。\n\n验证方式：运行本页最小示例，再补充空输入、重复执行和失败恢复三个用例，并对照上游测试确认行为。`
  }
}
