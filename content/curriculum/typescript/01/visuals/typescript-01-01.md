---
lesson: "typescript-01-01"
track: "typescript"
decision: "本课存在可被分步观察、操作或数值验证的机制变化；视觉只解决这一处认知障碍，并在相邻正文锚点展示。"
---

## 视觉实验

### 逐帧对比「ECMAScript 值、规范 Reference 与相等算法」的状态边界

id: "typescript-01-01-main"
kind: "state"
placement: "chapter:2"
summary: "“基本类型按值传递，对象按引用传递”只能当入门助记，继续推导就会误导。ECMAScript 的函数调用一律把一个语言值交给参数 binding。对象本身也是一个值，只是它具有不可描述、不可伪造的 identity，并且属性可变；把同一个对象值绑定给两个名称后，两边观察到同一身份上的修改。语言并没有一种名为 Reference 的对象指针值暴露给程序。"
caption: "左右状态卡只压缩本课的前态、现态与不变量；对象身份、生命周期或队列结论仍要用正文中的代码和源码分支验证。"
actionLabel: "播放状态变化"

#### 步骤

- Identifier/Propert | Identifier/Property 求值先产生 Reference Record，GetValue/PutValue 再执行实际读写。
- 赋值、参数和返回传递语言值 | 赋值、参数和返回传递语言值；同一对象值写进多个 binding 后形成 alias。
- ===、SameValue、Same | ===、SameValue、SameValueZero 对 Number 特例不同，对普通 Object 都比较 identity。
- TypeScript 类型在 emi | TypeScript 类型在 emit 后大多擦除，运行时仍按 ECMAScript 值和内部方法执行。
- 不可变更新用新 identity 表 | 不可变更新用新 identity 表示变化，通过结构共享控制复制成本。

#### 观察重点

- 画出“变量盒子里装对象指针”，随后误以为 JavaScript 能传递 lexical binding 的地址。
- 用 JSON.stringify 比较对象，遗漏 undefined、Symbol、BigInt、循环、原型和 key 顺序语义。
