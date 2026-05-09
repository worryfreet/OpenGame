# MVP 3.0 一句话高质量课程生成实施任务

## 任务目标

实现 MVP 3.0：用户在可视化或工具入口用一句话表达课程学习目标后，系统能补全 CourseSpec、生成精彩且有教学深度的游戏化课程方案，并通过质量评分、自动修复、经验沉淀和端到端回归保证稳定输出。

最终体验必须保持在既有受控链路内：一句话输入先落到 `CourseSpec`，再进入 `generate_course_plan`、`generate_course_gdd`、素材/TTS、课程包验证，不允许绕过课程 schema 或自由生成玩法引擎代码。

## 已阅读上下文

- `.agentdocs/index.md`
- `.agentdocs/prd/toc-course-mvp-3.md`
- `.agentdocs/workflow/260507-toc-game-course-plan.md`
- `.agentdocs/workflow/260508-mvp1-gameplay-optimization.md`
- `packages/core/src/course/schemas.ts`
- `packages/core/src/course/product/intakeSession.ts`
- `packages/core/src/course/product/generationRecovery.ts`
- `packages/core/src/course/quality/excitementRubric.ts`
- `packages/core/src/course/quality/goldenCases.ts`
- `packages/core/src/tools/generate-course-plan.ts`
- `packages/core/src/tools/generate-course-gdd.ts`
- `packages/core/src/tools/validate-course-package.ts`

## Agent Team

- 主 Agent：负责总架构、文档、集成、最终产品视角 Review 和验证修复。
- One-shot 解析 Agent：只读探索 CourseSpec、MVP2 输入向导和一句话解析缺口。
- Quality/Repair Agent：只读探索质量评分、精彩度、验证和恢复链路缺口。
- Tools/Integration Agent：只读探索工具注册、工具测试和集成测试模式。
- 后续 Worker Agent：按阶段拥有互不重叠文件范围，完成具体实现后由主 Agent 合并检查。

## 分阶段计划

### 阶段 1：一句话意图解析与工具入口

- [x] 新增 `packages/core/src/course/one-shot/promptToCourseSpec.ts`
- [x] 新增 `packages/core/src/course/one-shot/clarificationPolicy.ts`
- [x] 新增 `packages/core/src/course/one-shot/intentConfidence.ts`
- [x] 新增 `packages/core/src/tools/generate-one-shot-course-plan.ts`
- [x] 注册并导出新工具
- [x] 单测覆盖缺少年级追问、完整输入生成 CourseSpec、知名 IP/不适龄清洗或阻断

### 阶段 2：玩法导演增强

- [x] 新增 `packages/core/src/course/quality/gameDirector.ts`
- [x] `generate_course_plan` 后通过 `score_course_quality` 要求状态变化、节奏节点和非换皮玩法
- [x] 新增 `agent-test/docs/quality/one-shot-generation.md`
- [x] 单测覆盖方案状态变化、关卡推进和换皮问答阻断

### 阶段 3：课程评审与质量评分

- [x] 新增 `packages/core/src/course/quality/pedagogyReviewer.ts`
- [x] 新增 `packages/core/src/course/quality/visualConsistencyScorer.ts`
- [x] 新增 `packages/core/src/course/quality/courseQualityScorer.ts`
- [x] 新增 `packages/core/src/tools/score-course-quality.ts`
- [x] 新增 `agent-test/docs/quality/quality-gates.md`
- [x] 单测覆盖浅层问答、无状态变化、视觉冲突的降分和阻断

### 阶段 4：自动修复循环

- [x] 新增 `packages/core/src/course/quality/autoRepairLoop.ts`
- [x] 新增 `packages/core/src/tools/repair-course-generation.ts`
- [x] 新增 `agent-test/docs/quality/auto-repair-loop.md`
- [x] 单测覆盖低质量 plan 重写、素材降级、TTS 字幕降级、成本/轮数上限

### 阶段 5：模板经验库

- [x] 新增 `packages/core/src/course/experience/templateExperienceStore.ts`
- [x] 新增 `packages/core/src/course/experience/successfulPatternIndex.ts`
- [x] 新增 `packages/core/src/course/experience/failurePatternIndex.ts`
- [x] 新增 `packages/core/src/tools/record-course-experience.ts`
- [x] 单测覆盖成功/失败经验写入、隐私清洗和相似检索

### 阶段 6：端到端回归与产品 Review

- [x] 新增 `integration-tests/course-one-shot-generation.test.ts`
- [x] 新增 `integration-tests/course-quality-gates.test.ts`
- [x] 新增 `integration-tests/course-auto-repair.test.ts`
- [x] 新增 `integration-tests/course-golden-cases.test.ts`
- [x] 产品视角 Review：检查一句话输入是否真的减少表单负担、方案是否精彩、教学目标是否隐藏但明确
- [x] 运行必要 lint/typecheck/test 并修复问题

## 质量回顾要求

每阶段完成后执行：

- [x] 主 Agent 从批判视角检查该阶段代码是否绕过受控链路、是否过度设计、是否存在换皮题库风险。
- [x] 更新本任务文档 TODO 状态。
- [x] 关闭该阶段不再需要的 Agent。

最终完成前执行：

- [x] 判断是否有新的长期约束需要写入 `.agentdocs/index.md` 或专题文档。
- [x] 如果本任务全部完成，将该文档移动到 `.agentdocs/workflow/done/` 并从索引当前任务移除。

## 最终产品 Review

- 一句话入口已从“可选 oneShotText + 外部 CourseSpec”补齐为 `createCourseGameFromPrompt()`，可视化界面只需传自然语言目标和可选 profile/偏好/学习状态/家长策略。
- 方案质量门禁已覆盖教学深度、玩法精彩度、视觉一致性、适龄、安全、可玩风险和学生可见文案；`generate_course_gdd` 会重新评分，避免调用方绕过门禁。
- “隐藏但明确教学目标”采用双层表达：`CourseSpec`、评价、家长报告保留明确 `learningGoals`；学生端任务、场景和 workflow config 使用游戏任务、谜题和世界状态表达。
- 自动修复从单纯 attempt 记录增强为包含 `executionPlan` 的受控修复链路，要求质量、GDD、素材、TTS、构建和浏览器问题修复后重新验证。

## 最终验证

- `rtk npm run lint --workspace=packages/core`
- `rtk npm run typecheck --workspace=packages/core`
- `rtk npm run typecheck --workspace=packages/sdk-typescript`
- `rtk npm run test --workspace=packages/sdk-typescript -- createCourseGame.test.ts`
- `rtk npm run test --workspace=packages/core -- generate-one-shot-course-plan score-course-quality repair-course-generation record-course-experience courseQualityScorer autoRepairLoop templateExperienceStore generate-course-gdd config.test.ts courseGddMapper playletCatalog`
- `rtk npm run test:integration:sandbox:none -- course-one-shot-generation.test.ts course-quality-gates.test.ts course-auto-repair.test.ts course-golden-cases.test.ts`
- `rtk npm run test:course`
