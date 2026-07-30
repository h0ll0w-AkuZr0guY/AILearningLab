---
track: "torch"
id: "torch-01"
order: 1
title: "01 · Tensor、Storage 与 Stride"
goal: "看穿 shape 下的 storage_offset、stride 与 view 语义。"
lab: "手算 stride，构造 transpose、slice、as_strided 实验。"
interview: "view 为什么不保证零拷贝成功？"
officialScope: "https://pytorch.org/docs/stable/"
sourceScope: "torch/csrc/autograd"
planningStatus: established
---

# 01 · Tensor、Storage 与 Stride

本文件是模块级课程目录，也是认领入口。增删、拆分或合并课题时先修改这里；正文文件只承载已经进入精写阶段的单课内容。

## torch-01-01

title: "Tensor 双层模型：TensorImpl 元数据如何解释同一块字节"
status: curated
owner: ""
difficulty: "困难"
difficultyReason: "需要把 Python Tensor、TensorImpl、StorageImpl、DataPtr 与视图元数据分层，并用同一 storage 的不同解释证明“值、对象、字节”不是同一层概念。"
learningValue: "基础必修"
learningValueScore: 5
estimatedMinutes: 140
granularity: "合并基础课"

## torch-01-02

title: "UntypedStorage、DataPtr 与别名生命周期：共享、所有权和序列化"
status: curated
owner: ""
difficulty: "专家"
difficultyReason: "Storage 同时牵涉字节所有权、allocator、device、引用计数、别名保真和序列化；还要区分 Tensor.data_ptr 与 storage.data_ptr 的偏移语义。"
learningValue: "高频核心"
learningValueScore: 5
estimatedMinutes: 170
granularity: "拆分专题"

## torch-01-03

title: "shape、numel、dtype、device 与 layout：张量合同的正交坐标"
status: curated
owner: ""
difficulty: "困难"
difficultyReason: "这些属性看似独立却共同约束可表示值、地址单位、算子分派和后端能力；meta、sparse 与 strided 张量又会打破“Tensor 必有普通内存”的直觉。"
learningValue: "基础必修"
learningValueScore: 5
estimatedMinutes: 145
granularity: "合并基础课"

## torch-01-04

title: "Stride 地址代数与连续性：从索引公式到 memory_format"
status: curated
owner: ""
difficulty: "专家"
difficultyReason: "必须从 storage_offset + Σ(index×stride) 推导任意索引地址，并区分 contiguous、channels_last、non-overlapping-and-dense 与仅仅能被某个 kernel 处理。"
learningValue: "高频核心"
learningValueScore: 5
estimatedMinutes: 180
granularity: "拆分专题"

## torch-01-05

title: "view、reshape 与 flatten：零拷贝兼容条件和复制回退"
status: curated
owner: ""
difficulty: "专家"
difficultyReason: "reshape 能否别名取决于连续子空间分块而非只看 numel；需要读 computeStride、view_impl 与 reshape 的真实分派，并验证 autograd 别名和复制回退。"
learningValue: "高频核心"
learningValueScore: 5
estimatedMinutes: 180
granularity: "拆分专题"

## torch-01-06

title: "transpose、permute 与 movedim：只改维度解释的零拷贝重排"
status: curated
owner: ""
difficulty: "困难"
difficultyReason: "维度顺序改变会同步置换 size/stride，却不移动 storage；其性能与后续 view 兼容性必须通过地址序列验证。"
learningValue: "基础必修"
learningValueScore: 5
estimatedMinutes: 140
granularity: "单点精讲"

## torch-01-07

title: "slice、select 与 narrow：storage_offset 和步长切片"
status: curated
owner: ""
difficulty: "困难"
difficultyReason: "基本索引通过 offset、size、stride 组合表达子区域，负索引、空切片和 step 会改变边界与连续性判断。"
learningValue: "基础必修"
learningValueScore: 5
estimatedMinutes: 145
granularity: "单点精讲"

## torch-01-08

title: "expand 与 repeat：零 stride 广播和真实物化"
status: curated
owner: ""
difficulty: "困难"
difficultyReason: "expand 用零 stride 让多个逻辑元素别名同一地址，repeat 则复制数据；写入安全、反向聚合和显存成本需要联合推演。"
learningValue: "高频核心"
learningValueScore: 5
estimatedMinutes: 150
granularity: "单点精讲"

## torch-01-09

title: "as_strided：滑窗能力、越界检查与重叠写未定义行为"
status: curated
owner: ""
difficulty: "专家"
difficultyReason: "任意 size/stride/offset 可以表达滑窗也能制造内部重叠；必须证明地址范围、写冲突和后端可移植性，不能把强大原语当普通 API。"
learningValue: "进阶关键"
learningValueScore: 5
estimatedMinutes: 175
granularity: "拆分专题"

## torch-01-10

title: "clone、contiguous 与 to：显式物化、所有权和设备迁移"
status: curated
owner: ""
difficulty: "困难"
difficultyReason: "三个 API 的复制条件、memory_format、autograd 历史和 device/dtype 迁移语义不同，需要用指针、stride 与 grad_fn 同时验收。"
learningValue: "高频核心"
learningValueScore: 5
estimatedMinutes: 150
granularity: "单点精讲"
