---
lesson: "torch-01-02"
track: "torch"
decision: "本课存在可被分步观察、操作或数值验证的机制变化；视觉只解决这一处认知障碍，并在相邻正文锚点展示。"
---

## 视觉实验

### 逐帧对比「UntypedStorage、DataPtr 与别名生命周期：共享、所有权和序列化」的状态边界

id: "torch-01-02-main"
kind: "state"
placement: "chapter:2"
summary: "上一课把 Storage 当作字节层，本课继续追问“谁拥有这些字节、何时释放、怎样跨进程或文件保存”。如果只把 Storage 理解成 `void*`，就无法解释 CUDA allocator、memory mapping、from_blob 的自定义 deleter，也无法安全设计跨库零拷贝。"
caption: "左右状态卡只压缩本课的前态、现态与不变量；对象身份、生命周期或队列结论仍要用正文中的代码和源码分支验证。"
actionLabel: "播放状态变化"

#### 步骤

- Storage 是引用计数句柄，St | Storage 是引用计数句柄，StorageImpl 保存字节容量、DataPtr、allocator 与 resizable 状态。
- DataPtr 组合地址、devic | DataPtr 组合地址、device 与释放上下文，支持多种后端和外部内存。
- 多个 TensorImpl 可共享  | 多个 TensorImpl 可共享 StorageImpl，各自拥有 offset、shape 与 stride。
- Tensor.dataptr 指当前 | Tensor.data_ptr 指当前首元素，Storage.data_ptr 指字节起点，二者不保证相等。
- 序列化按 Storage 去重并记录 | 序列化按 Storage 去重并记录各 Tensor 元数据，从而保留别名关系。

#### 观察重点

- 把 Storage 当作只有裸指针，漏掉 deleter、device、allocator 与容量。
- 以 `Tensor.data_ptr`不同断言没有别名。
