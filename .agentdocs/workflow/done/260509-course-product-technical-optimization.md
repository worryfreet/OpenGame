# 游戏化课程产品与技术优化方案任务

## 背景

用户希望从学生、家长、产品经理、技术架构等多角色视角，身临其境地分析当前游戏化课程产品还有哪些优化甚至重构空间。重点不是普通功能清单，而是发现影响最终体验的问题，尤其关注：

- 课程生成结果是否足够精彩有趣。
- 学生是否愿意持续玩下去。
- 家长是否会被吸引并愿意购买。
- AI 是否应该获得更大的开发权限，以及如何在可靠边界内放开。
- 从技术角度形成详细、可落地的优化方案。

## 已阅读上下文

- `.agentdocs/index.md`
- `.agentdocs/workflow/done/260509-course-studio-agent-entry.md`
- `.agentdocs/workflow/260508-mvp1-gameplay-optimization.md`
- `.agentdocs/prd/toc-course-mvp-3.md`
- `.agentdocs/prd/course-gameplay-taxonomy.md`
- `agent-test/docs/quality/excitement-rubric.md`
- `agent-test/docs/quality/one-shot-generation.md`
- `agent-test/docs/quality/quality-gates.md`
- `agent-test/docs/quality/auto-repair-loop.md`
- `agent-test/docs/course/validation_protocol.md`
- `packages/core/src/course/quality/courseQualityScorer.ts`
- `packages/core/src/course/quality/gameDirector.ts`

## 关键判断

- 当前项目已经有受控生成、质量门禁、自动修复、玩法库、playlet runtime 和 Agent 原生入口基础。
- 最大产品风险不是“能不能生成”，而是“生成结果是否一眼好玩、前 30 秒是否抓住学生、家长是否看得懂价值”。
- 当前“AI 只能写配置、不能写玩法引擎”的边界有稳定性优势，但会限制新奇玩法、界面动效、课程表现力和快速进化能力。
- 更合理的方向不是完全放开 AI，而是引入分层权限：AI 可在隔离目录生成新 playlet/场景/动效/验收逻辑，再通过类型检查、静态策略、浏览器 smoke、视觉回归和人工/自动审核晋级为可复用能力。

## TODO

- [x] 复核现有课程生成、质量门禁、玩法库和 Agent 入口文档。
- [x] 撰写多角色问题诊断与技术优化方案。
- [x] 将方案登记到 `.agentdocs/index.md`。
- [x] 完成格式检查并归档任务文档。

## 产出

- `.agentdocs/prd/course-product-technical-optimization.md`

## 任务回顾

- 本次形成了长期产品/技术方案文档，适合作为后续精彩度、AI playlet 沙箱、运行时体验验证和家长价值闭环改造的依据。
- 关键长期判断已写入产品文档，不需要额外新增全局记忆；后续具体实施时应按方案拆分新的 workflow 任务。
