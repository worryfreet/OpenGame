# MVP 3.0 阶段 0：精彩度标准与 Golden Cases

## 任务背景

MVP 3.0 的目标是让用户一句话输入后，系统稳定生成足够精彩、足够有教学深度、足够可玩的游戏化课程。阶段 0 先把“精彩课程”转化为结构化评分、可复用 golden cases 和测试门禁，作为后续一句话解析、质量评分、自动修复和经验库的基准。

## 阶段目标

- 新增精彩度评分模型，覆盖目标清晰、游戏循环、惊喜推进、反馈丰富、世界吸引力和挑战曲线。
- 新增跨学科、跨年级、跨风格 golden cases，包含一句话输入、期望 CourseSpec 摘要、期望玩法方向和最低质量分。
- 新增 schema/覆盖测试，确保每个学科和年级段都有回归样本。
- 补充质量文档，沉淀后续 Agent 与工具实现时必须遵循的质量标准。

## Agents Team

- 精彩度标准 Agent：只读分析 `excitementRubric.ts` 的评分维度、纯函数 API 和规则。
- Golden Cases Agent：只读分析 20-30 个跨学科、跨年级、跨风格样例覆盖。
- 测试与 Schema Agent：只读分析测试落点、schema 校验方式和导出项。
- 主 Agent：负责代码实现、文档整合、验证、阶段批判检查和最终复盘。

## TODO

- [x] 读取 MVP 3.0 PRD、项目索引、自动化记忆和现有课程代码。
- [x] 组建并行 Agents Team。
- [x] 新增 `packages/core/src/course/quality/excitementRubric.ts`。
- [x] 新增 `packages/core/src/course/quality/goldenCases.ts`。
- [x] 新增 `packages/core/src/course/quality/*.test.ts`。
- [x] 新增 `agent-test/docs/quality/excitement-rubric.md`。
- [x] 更新 `.agentdocs/index.md` 与 `packages/core/src/index.ts`。
- [x] 运行阶段验证：测试、typecheck、lint、prettier check。
- [x] 阶段复盘：批判视角检查并更新文档状态。

## 当前决策

- 阶段 0 不接入 LLM、不注册工具，不改变现有 `generate_course_plan` 或 Course GDD 链路。
- Golden cases 作为代码内静态基准先落在 core 包，文档目录用于解释评分标准；文件型样例目录可在后续阶段按需要生成。
- 评分 API 必须接受现有 `CourseSpec` 与可选 `CoursePlanOption`，保证后续质量门禁能复用。

## 阶段验证

- [x] `rtk npm run test --workspace=packages/core -- excitementRubric goldenCases`
- [x] `rtk npm run test --workspace=packages/core -- validation planScoring playletCatalog excitementRubric goldenCases`
- [x] `rtk npm run typecheck --workspace=packages/core`
- [x] `rtk npm run lint --workspace=packages/core`
- [x] `rtk ./node_modules/.bin/prettier --check packages/core/src/course/quality/excitementRubric.ts packages/core/src/course/quality/goldenCases.ts packages/core/src/course/quality/excitementRubric.test.ts packages/core/src/course/quality/goldenCases.test.ts agent-test/docs/quality/excitement-rubric.md agent-test/course-golden-cases/README.md .agentdocs/workflow/260509-mvp3-quality-baseline.md .agentdocs/index.md packages/core/src/index.ts`

## 阶段复盘

- 已完成阶段 0 的质量基线，但这还不是最终产品闭环；后续必须继续实现阶段 1 一句话解析、阶段 2 玩法导演和阶段 3 质量评分门禁。
- 本阶段没有改变现有生成工具链，因此不会让用户一句话直接生成课程，只为后续链路提供可测试标准。
- Golden cases 的 canonical 数据暂放在 core TS 模块中，文件型目录只保留说明，避免样例双写漂移。
- 当前精彩度评分是启发式纯函数，足够用于早期门禁和回归；后续接入 Course GDD 后应继续补 `scoreGddExcitement()` 或统一质量评分器。
