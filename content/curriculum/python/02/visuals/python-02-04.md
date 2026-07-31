---
lesson: "python-02-04"
track: "python"
decision: "本课的学习障碍集中在属性查找、描述符优先级与方法绑定。读完文字后仍需把 descriptor 类型和实例同名键组合起来判断胜者，因此用可切换 playground 展示四种真实命中路径。"
---

## 视觉实验

### 切换 descriptor 条件，观察真正的命中层

id: "python-02-04-main"
kind: "playground"
placement: "example"
component: "python-02-04/descriptor-priority"
summary: "切换 data descriptor、实例字典、non-data descriptor 与普通类属性场景，直接观察 object.__getattribute__ 在哪一层停止查找。"
caption: "深色卡片表示当前场景的命中层，淡化卡片表示条件不成立或无需继续；优先级以 Descriptor Guide 和本课可运行断言为证据。"
actionLabel: "切换查找场景"

#### 步骤

- data descriptor | 类属性同时实现 __get__ 与 __set__/__delete__，访问实例属性时由 data descriptor 直接获胜。
- 实例字典 | 类属性只有 __get__，且实例字典存在同名键；实例值遮蔽 non-data descriptor。
- non-data descriptor | 实例字典没有同名键，函数等 non-data descriptor 才通过 __get__ 绑定。
- 普通类属性 | 没有 descriptor 和实例键时，沿 MRO 返回类字典中的普通值。

#### 观察重点

- 推进前先预测下一步会改变属性查找、描述符优先级与方法绑定中的哪一项，并指出至少一个必须保持不变的条件。
- 视觉省略了平台、实现和版本分支；涉及 CPython 私有细节时，回到本课官方入口、源码路径与运行示例复核。
