# 源码与官方文档知识图谱

`/source-map` 是独立于 curated 覆盖率的资料导航器。它使用课程路线与模块目录作为稳定骨架，再把已深化课程的精确证据挂成叶节点。这样，尚未精写的课题也可被检索、展开和认领，同时不会把未经核验的函数路径伪装成事实。

## 数据层级

```text
track.md
├─ source                    # 上游仓库根入口
├─ docs                      # 官方文档根入口
└─ catalog.md
   ├─ sourceScope            # 模块真实源码范围
   ├─ officialScope          # 模块官方资料范围
   └─ lessons                # 全部 planned / claimed / curated 课题
      └─ lesson.md           # curated 后补充精确文件、符号和章节锚点
```

页面不维护集中式 `source-map.ts` 清单。`app/pages/source-map.vue` 从 `curriculum.ts` 读取全部路线、模块和课题，再从 `topic-guides.ts` 读取已有课程的精确源码与官方入口。

## 两类节点

- 目录节点：来自 track 与 catalog，保证所有模块和 pending 课题都可见。它只链接真实仓库根、模块源码范围或官方范围。
- 已核验叶节点：来自单课 Markdown。它可以显示精确文件、核心函数和带锚点的官方章节，并链接站内精读。

目录节点缺少精确符号时，界面明确标为 `PLANNED`。认领课程的贡献者应先用目录节点估算官方文档、源码与测试范围，完成核验后再由 lesson Markdown 升级该叶节点。

## 交互与可访问性

- “源码图谱 / 官方文档图谱”共享同一课程骨架，切换时只改变证据通道。
- 路线、模块和课题均可搜索；搜索结果自动展开命中的模块。
- 模块使用带 `aria-expanded` 的原生按钮控制，叶节点可通过键盘聚焦和选择。
- 右侧 inspector 区分 `CURATED` 与 `PLANNED`，避免把规划标题当成已经验证的源码事实。
- 移动端把图谱与 inspector 改为单列，连线只承担空间提示，文字始终保留完整语义。

层级交互参考 W3C WAI-ARIA Tree View Pattern。当前实现保留原生按钮与链接的 Tab 行为，并以 `role=tree/treeitem/group` 暴露层级；若后续加入方向键漫游，必须完整实现焦点移动、Home/End 和展开/折叠合同，不能只加 ARIA 名称。
