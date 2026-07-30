---
id: "{{LESSON_ID}}"
track: "{{TRACK_ID}}"
title: "{{LESSON_TITLE}}"
depth: "deep"
exampleLanguage: "{{EXAMPLE_LANGUAGE}}"
readingMinutes: {{READING_MINUTES}}
sourceMinutes: {{SOURCE_MINUTES}}
practiceMinutes: {{PRACTICE_MINUTES}}
reviewMinutes: {{REVIEW_MINUTES}}
---

<!--
使用说明：
1. 先在模块 catalog.md 中认领课题，再复制本文件或运行 corepack pnpm curriculum:new <track-id> <lesson-id>。
2. 删除全部 TODO 与本说明；不要改动机器契约二级标题。
3. 每个事实先核对官方文档和真实上游源码，再写中文解释。
4. 困难课至少 5 章、5 个复现积木；专家课至少 7 章、6 个复现积木。
5. 示例必须能运行，自检和面试问题必须给出站内答案。
-->

## 官方入口

title: "TODO：官方文档版本与精确章节标题"
url: "TODO：https://官方文档/页面#精确锚点"

TODO：说明这个章节明确承诺了什么、没有承诺什么，以及本课采用的版本边界。

## 真实源码

repo: "TODO：owner/repository"
file: "TODO：仓库内真实文件路径"
symbol: "TODO：核心函数、类型或算法入口"
language: "{{SOURCE_LANGUAGE}}"
url: "TODO：https://github.com/owner/repository/blob/<tag-or-sha>/path#Lx-Ly"

### 逐段讲解

- TODO：公开入口如何规范化参数。
- TODO：核心状态、数据结构或算法怎样变化。
- TODO：失败、取消、越界或兼容分支在哪里发生。
- TODO：返回值、副作用、所有权或生命周期如何落定。

### 源码节选

```{{SOURCE_LANGUAGE}}
TODO：保留最能解释机制的真实上游源码，删去无关兼容分支并补充中文注释。
```

## 导读

TODO：从一个具体、可复现的问题进入。说明学习者只会调用 API 时，会在哪个边界判断错误。

TODO：给出本课的核心心智模型，并用一个反例说明它能预测什么。

TODO：界定本课与前后课程的关系，写清拆分或合并理由。

## 分章正文

### 从可观察现象建立问题

kicker: "01 · OBSERVE"

TODO：给出最小输入、输出和异常现象。不要先堆术语。

#### 本章结论

TODO：一句能被实验验证的结论。

### 建立数据模型与不变量

kicker: "02 · MODEL"

TODO：定义状态、shape、协议、所有权或地址关系，并写出不变量。

#### 代码

```{{EXAMPLE_LANGUAGE}}
TODO：验证模型的最小实验。
```

#### 本章结论

TODO：说明哪些量会变、哪些量必须保持。

### 沿真实源码走一遍主路径

kicker: "03 · SOURCE"

TODO：把官方术语映射到真实文件、函数和关键分支。

#### 本章结论

TODO：说明公开行为如何由源码路径实现。

### 补齐失败路径与边界

kicker: "04 · FAILURE"

TODO：覆盖空输入、非法状态、并发、取消、数值、生命周期或版本兼容中的真实边界。

#### 本章结论

TODO：写清失败是抛错、返回状态、回退、复制还是重试。

### 从教学实现走向工程取舍

kicker: "05 · ENGINEERING"

TODO：比较复杂度、资源、可观测性、可测试性和替代方案。

#### 本章结论

TODO：给出选择规则，而非单一最佳实践。

<!-- 专家课在此继续增加至少两章，例如调试证据、生产事故或源码演化。 -->

## 核心机制

- TODO：机制 1，描述输入到输出的真实变化。
- TODO：机制 2，描述状态、内存或调度关系。
- TODO：机制 3，描述失败路径。
- TODO：机制 4，描述组合边界。

## 常见误区

- TODO：一个会“碰巧工作”的错误理解，并给出反例。
- TODO：一个所有权、生命周期或并发误区。
- TODO：一个只测结果、不测契约的验证误区。

## 实现变体

### 变体 A：最小显式实现

useWhen: "TODO：适用条件"
tradeoff: "TODO：获得什么、牺牲什么"

#### 代码

```{{EXAMPLE_LANGUAGE}}
TODO
```

### 变体 B：面向生产边界的实现

useWhen: "TODO：适用条件"
tradeoff: "TODO：获得什么、牺牲什么"

#### 代码

```{{EXAMPLE_LANGUAGE}}
TODO
```

## 可运行示例

```{{EXAMPLE_LANGUAGE}}
TODO：一份能独立运行的完整示例，包含正常路径、失败路径和断言。
```

## 搭积木复现

### 积木 1：定义最小数据结构

TODO：写清输入、输出和不变量。

### 积木 2：实现成功主路径

TODO：只保留核心算法，并加入最小断言。

### 积木 3：加入第一个失败路径

TODO：明确失败的可观察行为。

### 积木 4：加入变体并比较

TODO：用同一组用例比较两种实现。

### 积木 5：对照上游源码

TODO：逐项核对简化实现省略了哪些生产分支。

<!-- 专家课至少再增加一个复现积木。 -->

## 自检

### 问题

TODO：设计一道需要推演机制、引用源码并说明边界的问题。

### 站内答案

TODO：按“结论 → 机制 → 源码证据 → 可运行验证 → 工程取舍 → 适用边界”完整回答。
