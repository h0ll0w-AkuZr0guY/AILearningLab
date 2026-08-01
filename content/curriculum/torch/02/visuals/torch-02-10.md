---
lesson: "torch-02-10"
track: "torch"
decision: "读完正文仍看不见「三份集合合并后到底剩下哪几个键」：文字只能给出 ((ks|included)-excluded)&key_mask 这一行公式和四个集合的定义，却无法让人盯着某一次具体调用，看着某一个具体的键在哪一步被加进来、又在哪一步被剔除。这是一条顺序不可交换的集合运算链，用 flow 逐步推进 x.add_(1) 这一次真实调用，把每一步之后的候选集合完整列出来，才能让「为什么最终落到 AutogradCPU 而不是 CPU」变成看得见的事实。"
---

## 视觉实验

### 追踪一次 add_ 的键集合并

id: "torch-02-10-keyset-merge"
kind: "flow"
placement: "chapter:2"
summary: "以 requires_grad=True 的 CPU 张量执行 x.add_(1) 为例，逐步推进四步集合运算：先摆出张量键集，再并入 TLS include、减去 TLS exclude、与 key_mask 求交，最后取优先级最高的一位并演示 redispatch 逐层清位，直到落到 CPU 计算 kernel。"
caption: "每一步显示该步之后候选集合的完整内容与本步被增删的键；集合内容取自本机 torch 2.13.0 的实测读数，键的优先级顺序 CPU < BackendSelect < ADInplaceOrView < AutogradCPU < AutocastCPU 来自 DispatchKey 枚举定义，真实分发仍以 computeDispatchKeySet 源码与 TorchDispatchMode 的实测序列为准。"
actionLabel: "推进一步集合运算"

#### 步骤

- 张量键集 ks | 实参张量键集的并集是 DispatchKeySet(CPU, ADInplaceOrView, AutogradCPU, AutocastCPU)；注意把 requires_grad 换成 False 这一行读数完全不变，梯度标志不在键集里。
- 并入 TLS include | include 集合是 (BackendSelect, ADInplaceOrView)，求并后多出 BackendSelect，ADInplaceOrView 因为本来就在所以无变化，候选集合变成四位加一位共五个键。
- 减去 TLS exclude | exclude 集合是十个 Autocast* 键的全集，做差后 AutocastCPU 被剔除；这一步就是「autocast 默认关闭」的物理实现，进入 autocast() 上下文只是把对应键从这份 exclude 里移走。
- 与 key_mask 求交 | 查 aten::add_.Tensor 的分发表，BackendSelect 上没有注册 kernel（fallthrough），对应位从 mask 里清零，候选集合收敛成 (CPU, ADInplaceOrView, AutogradCPU)。
- 取最高位并逐层清位 | 按优先级取出 AutogradCPU 先执行建图，清掉该位后 redispatch 命中 ADInplaceOrView 递增版本计数，再清位后落到 CPU 真实计算，三层洋葱在同一个集合上完成。

#### 观察重点

- 推进到「减去 TLS exclude」前先预测：如果把整段代码放进 torch.inference_mode()，第一步的张量键集会少掉哪两位，第三步的 exclude 又会多出哪两个键，再用示例里的断言核对。
- 对照 aten::add.Tensor 重走一遍第四步：out-of-place 版本在 ADInplaceOrView 上同样是 fallthrough（实测 False），所以它的候选集合会比 add_ 少一层，这解释了为什么只有原地算子会递增版本号。
