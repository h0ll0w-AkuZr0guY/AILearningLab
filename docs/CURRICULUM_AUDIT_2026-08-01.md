# 课程大纲审计与重构 TODO（2026-08-01）

> 九条非 Python 路线全量评估：按内核对齐度、实战导向性、粒度合理性、Mini 框架目标匹配度四维评判。
> 每条路线的优化建议标为 **保留/合并/拆分/删减**，并注明 **通用性设计/框架特性/架构思想**（应强化）vs **细枝末节/边缘实现**（应弱化或移除）。
> 执行时逐路线修改模块 catalog.md（新增/合并/重排序/删减课题），已精写正文后续按新顺序重新编号。

---

## 1. TypeScript（114 课 → 建议 ~60-70 课，核心线：类型系统 + 手撸 mini-checker）

### 当前问题
- **模块 01「JS 运行时地基」** 13 课全部 专家/困难，放在 Module 01 极度不友好：「上第一课就被 ECMAScript 规范引用、执行上下文、GC 吓跑」。
- 模块 02-09 几乎每模块固定 10 课，有明显的「模板凑数」嫌疑（例如模块 02 的函数参数逆变 + bivariance hack + 返回值协变 + 数组协变漏洞 四个极为接近的概念拆成 4 课）。
- 模块 06「类、装饰器…」与模块 09「声明文件…」里的 decorator/namespace/declaration merging 在日常 TS 开发占比极低，但对 mini-checker 目标也无贡献（checker 不实现装饰器 runtime）。
- 模块 10「Compiler API」和模块 11「类型系统面试」方向正确但课序混乱。

### 优化建议
1. **大幅重组模块 01**：保留头 3 课（值/引用、对象形状、闭包）作为「最小 JS 心智模型」，其余 10 课重新分散到后续模块作为「当 TS 需要解释这一行为时回到 JS 规范」的锚点课——降低 Module 01 的认知门槛。
2. **合并模块 02 + 03 + 04 中粒度过度细碎的课**：「参数协变+逆变+双变」→ 1 课；「typeof + instanceof + in + truthiness」→ 1 课；「infer + 分布式条件」→ 1 课。
3. **强化「手撸 mini-checker」主线**：每个模块末尾加一节「如果我们在 mini-checker 里要实现这个特性，需要改变什么数据结构/算法」——贯穿 from 01 to 10。
4. **删减/降级**：模块 06 的 decorator 新语义、parameter property、namespace emit、enum 运行时代价 → 降为 1 课「TS 的类型空间 vs 值空间与 emit 后剩余」，多余细节砍掉。
5. **模块 07「模块解析」** 是工程关键 → 保留并缩减为 5-6 课。
6. **模块 08「tsconfig」** 是日常必用 → 保留但合并家族开关为 1 课（把 strict 家族全写在一起比拆成 10 课更实用）。
7. **模块 10 Compiler API** → 保留为 Mini-Checker 实战模块；模块 11 面试实战 → 与 10 合并。

### 具体科目建议

#### 模块 01（13课→5课）：JS 最小心智模型 → 由浅入深
- ✅保留：01-01 值/规范 Reference；01-02 对象内部方法；01-05 闭包；01-06 this/箭头；01-10 event loop
- ⚠️降级/移动：01-03 GC → 移到高级模块；01-04 执行上下文 → 精简为闭包/this的前置知识；01-07 prototype → 合并到 01-02 一节；01-08 Proxy/Reflect → 留下为可选「高级 debug 工具」；01-09 Promise/Task → 合并进 01-10 event loop；01-11/12/13 ESM → 保留但移到模块 07（更自然的认知顺序）
- 🆕 模块 01 新标题：**「值、对象与执行模型」**（5课，中等→中等偏难）

#### 模块 02（10课→5课）：可赋值性与结构类型
- ✅保留：02-01 结构类型；02-02 freshness
- ➤合并：02-05+06+07+08 协变逆变→1课「函数的参数与返回类型兼容性」
- ➤合并：02-09+10 any/unknown/never/void→1课「顶层类型与底层类型」
- 🗑删减：02-03 可选属性（可在模块 04 mapped type 里顺带）、02-04 readonly 浅层（移到模块 08 工程策略）

#### 模块 03（10课→4课）：控制流分析与窄化
- ➤合并：03-01+02+03 typeof/instanceof/in→1课「运行时检查与类型窄化」，03-04 truthiness 合并进去
- ✅保留：03-05 discriminated union；03-07 user type predicate；03-09 alias control flow
- 🗑删减：03-06 never exhaustiveness（属于 03-05 的附属结论）、03-08 assertion function（极少用）、03-10 闭包收窄丢失（与 01-05 闭包合并）

#### 模块 04（10课→5课）：泛型与类型推断
- ✅保留：04-01 泛型推断；04-02 extends；04-04 keyof；04-05 mapped type（此为面试高频 + mini-checker 核心）
- ➤合并：04-06+07+08 conditional/infer/distributive→1课「条件类型与 infer」；04-09+10 模板字符串/递归→1课

#### 模块 05（10课→4课）：函数签名
- ➤合并：05-01+02 call/construct signature→1课；05-03 overload→保留；05-05+06+07 optional/rest/variadic→1课
- 🗑删减：05-04 this parameter（归入 01-06）、05-08 函数属性（伪需求）、05-09 callback 上下文（归入 04-01）、05-10 async→Promise（归入模块 01 event loop）

#### 模块 06（10课→3课）：类与 emit
- ➤合并：全模块压缩为 3 课：「类的类型空间与值空间」「implements 与 abstract class」「声明合并与 enum 代价」
- 🗑删减：decorator/parameter property 细节降为注释；namespace emit → 合并到声明合并

#### 模块 07（10课→5课）：模块解析
- ✅保留精简：moduleResolution modes、package exports、type-only import、esModuleInterop、declaration emit
- 🗑删减：typesVersions/source map/tree shaking/路径别名 → 降为「模块工程小贴士」附录而非独立课

#### 模块 08（10课→3课）：tsconfig 工程策略
- ➤合并：strict 家族→1课；noUnchecked/isolatedModules/project refs→1课「编译边界控制」；诊断/性能→1课

#### 模块 09（10课→3课）：类型库设计
- ➤合并：ambient/declare module/augmentation→1课；branding/opaque→1课；publish→1课

#### 模块 10+11（20课→6课）：Compiler API + Mini Checker 实战
- ✅保留：SourceFile/Node、TypeChecker、AST visitor、transform→作为 mini-checker 四步积木
- 🗑精简：printer/emitter/language service/watch/tsserver→降为参考文献
- 🆕 新增「手撸 mini-checker」实战模块：用前 9 个模块的知识，实现一个能检查「类型不匹配」「属性不存在」「函数参数个数不对」的小型 checker → **这是整条路线的终极产出**

### 课后联系
- 模块 01 闭包/this → 模块 02 函数类型兼容 → 模块 03 窄化（通过函数参数推断 narrow 类型）→ 模块 04 泛型 → 模块 05 签名 → …… → 模块 10 手撸 checker
- 每个模块末尾加「Mini Checker 视角」← 本模块概念在简化 checker 中怎么实现

### 实现优先级：最高。本路线 13 课已 curated，是「早期沉淀最多但课序最不友好」的路线，应优先重构。

---

## 2. LangGraph（132 课 → 建议 ~65-75 课，核心线：状态图引擎 + 手撸 mini BSP runtime）

### 当前问题
- **模块重叠严重**：模块 04「Checkpoint 与耐久执行」与模块 06「持久化与耐久执行」几乎同名同主题；模块 03「Edge、路由与循环」与模块 05「LangGraph 状态模型」大量重叠（状态模型 = state + edge + node，edge 又是模块 03）；模块 08「多 Agent」与模块 09「子图并行」高度接近。
- **模块 01「Graph 思维」全部 10 课为 困难/专家**，且第一课 langgraph-01-01「函数链为何不足」难度为困难——需要先理解「函数链的局限」才能建立「为什么需要图」的动机，这个前置知识本身是困难的。
- **模块 11「RAG 与知识系统」与模块 12「Agent 安全」** 是「LLM 应用工程」而非 LangGraph 框架核心——这些内容更适合放到 LangChain 或独立路线。
- **模块 13「多协议与部署」** 与 Nuxt/系统设计路线重复。

### 优化建议
1. **合并重叠模块**：04+06 → 1 个「Checkpoint 与耐久执行」模块；03+05 → 1 个「边、路由与图组合」模块；08+09 → 1 个「多 Agent 与子图」模块。模块数从 13 减到 ~9。
2. **降低模块 01 门槛**：第一课改为「从一次对话流程的 if-else 地狱到图的动机」（简单难度，用伪代码讲故事），保留「Pregel super-step」为第 3-4 课。
3. **删减 RAG/安全/部署**：模块 11（RAG）→ 移到 LangChain 路线；模块 12（安全）→ 降为 1 课「Agent 安全最佳实践」放在模块 08 末尾；模块 13（部署）→ 移到 Nuxt/独立系统设计路线。
4. **强化「手撸 mini BSP」**：模块 02 学习完 State/Reducer 后，立即接一个实战模块「手撸 mini-LangGraph」——实现 StateGraph Builder、Node 执行、Pregel super-step、Checkpoint、reducer 归并。
5. **保留的核心模块**：
   - M1: Graph 思维与执行模型（10→6 课，降低难度）
   - M2: State、Reducer 与消息（10 课，保留已 curated）
   - M3: 边、路由与图组合（合并 03+05，压缩到 6-8 课）
   - M4: Checkpoint 与耐久执行（合并 04+06，压缩到 6-8 课）
   - M5: 多 Agent 与子图（合并 08+09，压缩到 8 课）
   - M6: 人工审批与记忆（10→6 课）
   - M7: 评估、可观测与生产化（10 课，保留但降低优先级）
   - M8: 手撸 mini-LangGraph（新增，6 课实战）

### 具体合并映射

#### 模块 03（Edge/路由）↔ 模块 05（状态模型）
- 共同核心：条件边、循环终止、fan-out/fan-in、路由可测试性、StateGraph 建图、graph compile
- 合并为 1 个模块「边、路由与状态模型」（8 课）

#### 模块 04（Checkpoint）↔ 模块 06（持久化）
- 共同核心：checkpointer 接口、thread id、snapshot history、pending writes、idempotency key
- 合并为 1 个模块「Checkpoint 与耐久执行」（6 课）

#### 模块 08（多 Agent）↔ 模块 09（子图）
- 共同核心：subgraph 组合、上下文隔离、并行 fan-out、结果聚合、角色合同
- 合并为 1 个模块「多 Agent 与子图组合」（8 课）

### 课后联系
- M1 图思维 → M2 状态定义 → M3 边/路由/循环 → M4 checkpoint → M5 多 Agent → M6 人工审批 → M7 观测/评测 → M8 手撸 mini-LangGraph
- 每个模块结束时指向下一个模块："当我们有了状态和边，如何让执行可以暂停和恢复？(→M4)"

---

## 3. PyTorch（120 课 → 建议 ~60-70 课，核心线：Tensor 内部模型 + 手撸 mini autograd）

### 当前问题
- 模块 01-02 共 20 课已全部 curated，质量高（tensor 双层模型、stride、view/reshape、索引、广播、einsum、dispatch……），但模块 01（tensor/storage/stride）与模块 02（索引/广播/算子）之间边界清晰，无需大幅调整。
- 模块 03-12 共 100 课全部 pending，且每模块 10 课的模板化设计明显。
- 模块 07「CUDA 与 GPU」（10 课）是**硬件相关细节**，对「手撸 mini autograd」目标贡献有限（mini 框架跑 CPU 就够了）——降为 1-2 课概述。
- 模块 08「分布式训练」（10 课）**严重边缘化**——分布式是 infra 工程，不是 mini 框架目标。
- 模块 09「torch.compile/dynamo」（10 课）——JIT/编译优化属于高级主题，mini 框架不需要。
- 模块 11「模型压缩部署」（10 课）——部署工程，独立于核心教学线。

### 优化建议
1. **保留模块 01-02 不变**（已 20/20 curated 且质量高）。
2. **压缩模块 03-06 作为「从 tensor 到 autograd」的核心链**——每条缩到 5-6 课而非 10 课。
3. **删减/降级模块 07-12**：保留核心（CUDA 概念 1-2 课、分布式概念 1 课、compile 概念 1 课、部署 1 课），其余细枝末节降为文档链接。
4. **新增「手撸 mini-torch」模块**：把 autograd 的 backward graph、自定义 Function、nn.Module 参数管理、optimizer 组合成一个小型完整框架，作为整条路线的终极产出。
5. **难度递进**：模块 01 tensor 基础（中等→困难）→ 模块 02 索引/广播（困难）→ 模块 03 autograd 图（困难）→ 模块 04 自定义 Function（专家）→ 模块 05 nn.Module（中等）→ 模块 06 数据管线（中等）→ **手撸 mini-torch**（专家）→ 其余作高级选修。

### 具体删减映射
- 模块 07 CUDA/GPU：10→2 课（「GPU 计算模型概述」「CUDA 与 PyTorch 后端接口」）
- 模块 08 分布式：10→1 课（「PyTorch 分布式：概念与选型」）
- 模块 09 torch.compile：10→1 课（「JIT 编译与 Dynamo 概念」）
- 模块 10 源码扩展：保留 3 课（register op / dispatch key / autograd Function 扩展）
- 模块 11 模型部署：10→1 课（「模型导出与部署选项」）
- 模块 12 面试：保留 5 课核心问答题
- 🆕 模块 13 手撸 mini-torch（6 课新增）

### 模块重组后
1. Tensor、Storage 与 Stride（10 课 ✓）
2. 索引、广播与算子语义（10 课 ✓）
3. Autograd 图与反向传播（10→5 课）
4. 自定义 Autograd Function（10→5 课）
5. nn.Module 与模型构造（10→6 课）
6. 数据加载与管线（10→5 课）
7. 高级选修：GPU/CUDA/分布式/编译/部署（核心概述 4 课）
8. **手撸 mini-torch**（6 课）
9. 源码扩展与面试实战（8 课）

---

## 4. LangChain（120 课 → 建议 ~45-55 课，核心线：LLM 框架抽象 + 手撸 mini-LangChain）

### 当前问题
- 10 个模块 × 12 课 = 120 课，但只有 5 课 curated。其余 115 课的目录设计有大量「RAG 全栈」「Provider 适配细节」「Tool 生态遍历」等脱离「LLM 框架核心抽象」的内容。
- 模块 03「Prompt 模板与 Output 解析」的 12 课——output parser 不是框架核心（LLM 输出解析是 prompt engineering 问题，不是框架架构问题）。
- 模块 07「RAG 检索与知识库」的 12 课——RAG 是应用模式，不是框架抽象层。
- 模块 09「高级 Chain 模式」的 12 课——应该在「Runnable 组合」模块中一起讲，不需要独立模块。
- 模块 10「手撸 LangChain」是正确方向但课数过多（12 课）。

### 优化建议
1. **核心五个模块 → 四个核心模块**：
   - M1: Core 抽象与消息契约（保留已 curated 5 课 + 扩展 3 课 batch/stream/error，共 8 课）
   - M2: Runnable 组合与 Chain 模式（合并模块 05+09，6 课）
   - M3: Tool 与 Agent Loop（模块 04+06，8 课）
   - M4: 手撸 mini-LangChain（压缩模块 10，6 课实战）
2. **删减/降级**：
   - 模块 03「Prompt/Output」→ 压缩为 1 课放进模块 01（PromptTemplate 作为 Runnable 的一个子类即可）
   - 模块 07「RAG」→ 删除或移到独立的「RAG 系统设计」路线（LangGraph 已有 RAG 模块，只需一个；建议 LangGraph 保留 RAG，LangChain 删除）
   - 模块 08「Memory/Context」→ 压缩为 1-2 课（上下文窗口管理是 prompt 层的关注点，非框架核心）
   - 模块 06「Middleware & Hooks」→ 保留为 M2 内容的扩展
3. **强化「Runnable 接口」为框架唯一抽象**：所有内容围绕 `invoke / batch / stream / bind / with_config` 展开——这是 LangChain 最核心的设计思想（与 vLLM scheduler 的统一 token 预算属于同类「单一抽象简化系统」）。
4. **模块 02「Provider 适配与 Fallback」** → 压缩为 4-5 课（只讲 BaseChatModel 接口规范与 provider 切换机制，不逐一遍历 OpenAI/Anthropic/Google 的产品细节）。

### 重组后模块
1. Core 抽象与消息契约（8 课）
2. Runnable 组合与 Chain 模式（6 课）
3. Tool 系统与 Agent Loop（8 课）
4. **手撸 mini-LangChain**（6 课）
5. Provider 适配与工程策略（5 课）
6. Memory、Context 与生产实践（5 课）

模块数从 10 减到 6，课数从 120 减到 ~40-45。

---

## 5. Transformer（120 课 → 建议 ~50-60 课，核心线：理解注意力 + 手撸 mini-GPT）

### 当前问题
- 10 课 curated 为 foundation 短文，需按深化标准重写。
- 模块 02「Tokenization」10 课——tokenizer 细节（BPE 编码算法、vocabulary 构建）是 NLP 预处理工程，不算 Transformer 框架核心，建议压缩到 2-3 课。
- 模块 03-04-05（Attention/Multi-head/Block）粒度很细（30 课），可以合并为 2 个模块（Attention 机制 8 课 + Transformer Block 6 课）。
- 模块 06「训练目标与优化」（10 课）与模块 07「数据、评估与采样」（10 课）属于「训练工程」，mini-GPT 需要的只是核心（loss 计算、optimizer、lr schedule），其余可以减。
- 模块 08「高效 Attention」（10 课）——flash attention、KV cache 量化等属于推理优化工程，mini-GPT 目标不需要（跑在 CPU 上用标准 attention 即可）。
- 模块 09「微调与对齐」——属于应用层，独立于核心教学线。
- 模块 11「模型变体」——encoder-only/decoder-only 等架构对比是好内容，保留。
- 模块 10「手撸 mini-GPT」+ 模块 12「LLM 系统面试」→ 合并为终极实战模块。

### 优化建议
1. **核心五个模块**：
   - M1: 线性代数与张量基础（10→6 课，跳过太基础的向量空间，直接从矩阵乘法/softmax 算起）
   - M2: Tokenization 与输入表示（10→3 课）
   - M3: Attention 机制（合并 03+04，16→8 课）
   - M4: Transformer Block 与训练基础（合并 05+06+07 核心部分，20→8 课）
   - M5: 手撸 mini-GPT + 变体 + 面试（合并 10+11+12 核心，10 课）
2. **删减/降级**：
   - 模块 08「高效 Attention」→ 降为 M3 的「高级话题」1 课（flash attention 概念）
   - 模块 09「微调」→ 保留给 LoRA 路线（Transformer 只需「什么是 fine-tuning」1 句概述）

### 课后递进
- M1 矩阵 → M2 文本怎么变成数字 → M3 注意力让词看见彼此 → M4 把它们叠成 Block 训练 → M5 手撸一个能讲故事的 mini-GPT

---

## 6. vLLM（92 课 → 建议 ~45-55 课，核心线：推理服务性能模型 + 手撸 mini scheduler）

### 当前问题
- 模块 01 的 5 课已 curated 且质量高，形成了完整的「性能模型」心智模型。后续模块 02-08 共 87 课全部 pending、模板化（模块 02-04 各 11-12 课，模块 05-08 各 12 课）。
- 模块 02「PagedAttention」11 课——PagedAttention 是 vLLM 的核心创新，值得深入但要控制粒度（物理页、逻辑页、hash、eviction、prefix caching 可在 6-7 课讲透）。
- 模块 03「Scheduler」11 课与模块 01 已精写的调度内容高度重叠（vllm-01-01/03 已经讲了 schedule、token budget、preemption）。应整合而非重复。
- 模块 04「Engine/Executor」：12 课讲引擎执行循环——对「手撸 mini scheduler」目标过于细节。
- 模块 06「Sampling」12 课——sampling 是 LLM 推理的通用组件，vLLM 只是调用。压缩为 1-2 课。
- 模块 07「LoRA/量化」12 课——属于独立路线（LoRA PEFT），vLLM 只需 1 课「vLLM 中的 LoRA 服务」。

### 优化建议
1. **保留模块 01 不变**（5/11 已 curated，6 pending 待继续）。
2. **整合模块 02+03+04** 为核心「KV Cache + Scheduler + Engine」：
   - PagedAttention（7 课）→ Scheduler（合并模块 03+01 剩余，8 课）→ Engine Executor（5 课）
3. **模块 05「OpenAI API 服务」** 保留为实践模块（但压缩到 6 课）。
4. **删减**：模块 06 Sampling → 2 课（「LLM 采样策略概述」「vLLM 中的采样实现」）；模块 07 LoRA → 1 课（「vLLM 中的 LoRA 服务」）；模块 08 观测调优 → 保留 3 课核心指标。

### 课后递进
- M1 性能模型（prefill/decode、TTFT、带宽）→ M2 PagedAttention（KV 怎么存）→ M3 Scheduler（怎么调度）→ M4 Engine（怎么跑起来）→ M5 API 服务（怎么暴露给外界）→ **手撸 mini-scheduler**（6 课新增）

---

## 7. LoRA PEFT（88 课 → 建议 ~35-45 课，核心线：低秩适配 + 手撸 mini-LoRA）

### 当前评估
- 8 模块 × 11 课 = 88 课，全部 pending。主题集中在「LoRA 的数学/注入/训练/合并/变体/评测」——核心对路，但存在膨胀（模块 02「目标层」11 课——哪些层加 LoRA 是经验调参问题，不是独 11 课的深度；模块 05「QLoRA 内存预算」11 课——可以压缩为 3-4 课）。

### 优化建议
- 合并模块 01+03（数学 + 初始化/缩放）→ 1 个 LaRA 设计课
- 模块 02+04（注入 + 训练循环）→ 1 个 LaRA 训练课
- 模块 05 QLoRA 压缩为 3 课
- 模块 06 合并/路由 → 保留 4 课
- 模块 07 变体 → 保留 3 课代表作
- 模块 08 评测 → 保留 4 课核心
- 🆕 手撸 mini-LoRA（6 课）
- 总计约 40 课

---

## 8. Nuxt（110 课 → 建议 ~50-60 课，核心线：Vue 响应式内核 + 同构渲染 + 手撸 mini-Nuxt）

### 当前评估
- 11 模块，0 curated。设计与 Vue/Nuxt 全栈知识点吻合度较高，但存在过度拆分。
- 模块 01（Vue 响应式）与模块 02（编译渲染）可以作为「Vue 深度核心」合并为一个 10 课的大模块——先理解 proxy/track/trigger，再理解 template→render→patch。
- 模块 05「路由」10 课偏多（文件路由是规约，不是 10 课深度学习点）。
- 模块 10「Nuxt 源码」与模块 03/04/07 大量重叠。
- 🆕 添加「手撸 mini-Nuxt」模块作为终极产出。

### 合并建议
- M1: Vue 响应式 + 编译（合并 01+02，10 课）
- M2: Nuxt 生命周期与 SSR（合并 03+04，8 课）
- M3: 路由与数据（合并 05+06，8 课）
- M4: Server/Nitro（模块 07，6 课）
- M5: 模块与插件（模块 08，5 课）
- M6: 性能与部署（合并 09+10，6 课）
- M7: 手撸 mini-Nuxt（新增，6 课）
- M8: 前端面试实战（模块 11，5 课）
- 总计约 54 课

---

## 9. Deep Agents（92 课 → 建议 ~40-50 课，核心线：Agent 运行时 + 手撸 mini-agent）

### 当前评估
- 8 模块，0 curated。主题是 Agent 的基础设施（Harness、Todo/规划、文件系统、Shell/Sandbox、子代理、Memory、Skill、治理）——方向对，但模块 04「Shell/Sandbox」与模块 05「子代理」各 12 课偏多。
- 合并建议：模块 01+02（Harness + Todo/规划）→ 一个「Agent 基础」模块（6 课）；模块 03+04（文件系统 + Shell）→「Agent 工具环境」模块（8 课）；模块 06+07（Memory + Skill）→「Agent 能力扩展」模块（6 课）；模块 05+08 保留核心 + 手撸 mini-agent（8 课）。
- 总计约 45 课。

---

## 执行计划

按优化优先级：
1. **TypeScript**（13 curated，课序最差，优先重构）→ 预计 ~65 课
2. **LangGraph**（20 curated，模块重叠最严重）→ 预计 ~70 课
3. **PyTorch**（20 curated，课质量高但后续模板化严重）→ 预计 ~65 课
4. **LangChain**（5 curated，120 课膨胀严重）→ 预计 ~45 课
5. **vLLM**（5 curated，基础好，精简要后续模块）→ 预计 ~50 课
6. **Transformer**（10 curated foundation，需按深化重写+精简）→ 预计 ~55 课
7. **LoRA / Nuxt / Deep Agents**（0 curated，纯目录规划调整）→ 各 ~40-55 课

**总课数估值**：当前 1088 → 优化后约 520-580（约减半），已精写 73 课按新编号重排。
