---
lesson: "torch-01-01"
track: "torch"
decision: "本课存在可被分步观察、操作或数值验证的机制变化；视觉只解决这一处认知障碍，并在相邻正文锚点展示。"
---

## 视觉实验

### 逐帧对比「Tensor 双层模型：TensorImpl 元数据如何解释同一块字节」的状态边界

id: "torch-01-01-main"
kind: "state"
placement: "chapter:2"
summary: "很多初学者把 Tensor 想成“有 shape 的多维数组”。这个说法能写模型，却不足以解释 transpose 为什么几乎不花时间、切片为什么会改到原张量、reshape 为什么有时复制、有时零拷贝。更可靠的模型是两层：Storage 持有一维字节，TensorImpl 持有如何读取这些字节的元数据。数值来自两层共同作用。"
caption: "左右状态卡只压缩本课的前态、现态与不变量；对象身份、生命周期或队列结论仍要用正文中的代码和源码分支验证。"
actionLabel: "播放状态变化"

#### 步骤

- 普通 strided Tensor  | 普通 strided Tensor 由 Storage 字节所有权与 TensorImpl 解释元数据共同定义。
- 逻辑元素地址为 storageoff | 逻辑元素地址为 storage_offset 与各维索引乘 stride 的和，再乘 dtype.itemsize。
- view 创建新的解释对象并共享 S | view 创建新的解释对象并共享 Storage；clone 创建新 Storage；普通赋值只共享 Python 对象。
- StorageImpl 的引用计数让 | StorageImpl 的引用计数让任一别名存活时底层内存继续存活。
- shape/stride/offse | shape/stride/offset 是视图特有元数据，多个 TensorImpl 可对同一字节给出不同坐标系。

#### 观察重点

- 只比较 `Tensor.data_ptr()`判断是否共享 Storage，忽略不同 storage_offset 会得到不同首元素指针。
- 把 `numel()*element_size()`当作 view 保留内存，漏算它引用的大 Storage。
