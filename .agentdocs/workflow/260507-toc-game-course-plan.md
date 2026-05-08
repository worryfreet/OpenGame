# ToC 个性化游戏化课程生成系统规划任务状态

## 任务背景

基于 OpenGame 二创一个直接面向小学一至六年级学生的 ToC 游戏化课程生成系统。用户输入年级、学科、主题、学习目标、个人兴趣、设计风格、配色、图片和自身情况等必选或可选信息后，AI 先做课程讲解深度判断、多维度游戏化方案分析与对比，再让学生/家长确认，最后生成可玩的游戏化课程。

该方向不是 PPT 生成，也不是教师备课工具。理想形态是学生直接体验、家长/监护人提供边界确认和安全控制的个性化学习游戏生成器。

## 文档归位

详细产品与落地方案已迁移到产品文档：

- `prd/toc-course-mvp-1.md`：MVP 1.0 受控生成闭环落地方案。
- `prd/toc-course-mvp-2.md`：MVP 2.0 产品化体验与持续使用能力路线。
- `prd/toc-course-mvp-3.md`：MVP 3.0 一句话高质量生成与核心生成能力跃迁路线。

本 workflow 文档只保留当前规划整理任务的背景、完成情况和下一步，不再承载完整 PRD。

## 当前完成情况

- [x] 明确产品定位：直接面向学生的 ToC 游戏化课程生成系统，家长/监护人提供边界确认和安全控制。
- [x] 明确 MVP 1.0/2.0/3.0 分层：1.0 跑通受控生成闭环，2.0 做产品化体验与持续使用，3.0 做一句话高质量生成和质量跃迁。
- [x] 完成 MVP 2.0 和 MVP 3.0 独立产品路线文档。
- [x] 将 MVP 1.0 详细落地方案迁移到 `prd/toc-course-mvp-1.md`。
- [x] 更新 `.agentdocs/index.md` 的产品文档入口。
- [x] 完成 MVP 1.0 阶段 0：代码基线与课程边界梳理。
- [x] 完成 MVP 1.0 阶段 1：课程 schema 与纯函数校验。
- [x] 完成 MVP 1.0 阶段 2：课程方案生成工具。
- [x] 完成 MVP 1.0 阶段 3：课程 GDD 工具。
- [x] 完成 MVP 1.0 阶段 4：课程模板族。
- [x] 完成 MVP 1.0 阶段 5：Course GDD 到 OpenGame 链路映射。
- [x] 完成 MVP 1.0 阶段 6：多模态资产与 TTS。
- [x] 完成 MVP 1.0 阶段 7：课程包验证工具。
- [x] 完成 MVP 1.0 阶段 8：CLI/SDK 使用入口。
- [x] 完成 MVP 1.0 阶段 9：端到端验证基准的静态装配与发布前验证。
- [x] 完成 MVP 1.0 整体验收 review 的第一轮补缺：真实课程模板生产 build 已打通。
- [x] 完成 MVP 1.0 整体验收 review 的第二轮补缺：真实 scaffold 与三类课程首轮场景已打通。
- [x] 完成 MVP 1.0 整体验收 review 的第三轮补缺：新增课程浏览器 smoke 验证入口和运行时状态标记。
- [x] 完成 MVP 1.0 整体验收 review 的第五轮收尾：新增固定课程基准与强制浏览器 smoke 脚本。
- [x] 完成 MVP 1.0 风险修复：`course_tts_manifest` 注册为正式工具，视频过场进入课程模板运行时。
- [ ] 在可启动 Chrome/Chromium 的环境中开启强制浏览器 smoke，复验无白屏、首轮互动和学习报告 UI。

## 当前状态

当前已完成阶段 0 的基线确认和课程 GDD 草案、阶段 1 的课程模型/学科映射/计划评分/纯函数校验、阶段 2 的课程方案生成工具、阶段 3 的 Course GDD 生成工具、阶段 4 的课程模板族、阶段 5 的 Course GDD 到 OpenGame scaffold 映射、阶段 6 的课程 TTS 服务和 narration manifest、阶段 7 的课程包验证工具、阶段 8 的 SDK/headless 使用入口、阶段 9 的跨学科基准 fixture 与课程包静态端到端验证，以及 MVP 1.0 整体验收 review 的多轮补缺。

后续优先在具备浏览器能力的环境中执行强制课程 smoke：以最终闭环目标继续反查无白屏、按钮可点、进入第一互动、完成一道题、反馈与学习报告 UI 可见。2026-05-08 10:04 已补充固定脚本：默认课程基准运行 `rtk npm run test:course`，强制浏览器 smoke 运行 `rtk npm run test:course:browser`。当前沙箱执行强制脚本仍失败于 Chrome 启动层：`code=null signal=SIGABRT`；默认课程基准通过。

## MVP 1.0 阶段 0：代码基线与课程边界

- [x] 阅读并确认 `packages/core/src/config/config.ts:createToolRegistry()` 的工具注册方式。
- [x] 阅读 `game-type-classifier.ts`、`generate-gdd.ts`、`generate-assets.ts` 的参数、返回格式和系统提示。
- [x] 阅读 `agent-test/templates/modules/ui_heavy`、`grid_logic`、`tower_defense` 的 Base 类和 template_api。
- [x] 确认课程新增能力不改坏普通游戏生成链路。
- [x] 输出 `agent-test/docs/course/course_gdd.md` 的格式草案。

### 阶段 0 关键结论

- 工具注册集中在 `Config.createToolRegistry()`，新增课程工具应沿用 `ToolNames`、`ToolDisplayNames`、静态 `Name` 和 `registerCoreTool(工具类, this)` 的模式。
- 普通游戏链路是 `classify_game_type -> 复制 core + archetype 模板 -> generate_gdd -> generate_game_assets/generate_tilemap -> 代码实现`，课程链路应新增工具和模板族，不能改写现有普通游戏工具语义。
- `generate_gdd` 输出的是面向普通游戏模板的技术 GDD，并会推动后续资产和代码实现；课程需要独立的 `generate_course_gdd`，再映射到 `course_ui/course_grid/course_td`。
- `generate_game_assets` 适合继续处理图片、背景、动画和普通 BGM/SFX；课程讲解旁白应独立走 TTS manifest，避免与普通 audio asset 混用。
- `ui_heavy` 现有 Dialogue、Quiz、Choice、Card 和 Battle/Chapter 基类最适合课程讲解与答题互动；`grid_logic` 适合分类、排序、步骤推理；`tower_defense` 仅适合复习巩固型课程。

### 阶段 0 验证

- [x] `rtk npm run typecheck --workspace=packages/core`
- [x] `rtk npm run test --workspace=packages/core -- src/config/config.test.ts`
- [x] `rtk npm run test --workspace=packages/core -- src/tools/tool-registry.test.ts`
- [ ] `game-type-classifier.ts` 当前没有对应测试文件，阶段 1 或阶段 2 新增课程工具测试时应同步补齐该工具的基础解析/降级测试。
- [x] 文档检查：`.agentdocs/index.md` 有当前任务文档索引。

## MVP 1.0 阶段 1：课程 schema 与纯函数校验

### 阶段 1 目标

- 新增课程核心模型层，先用纯函数承载课程输入、讲解深度、玩法候选和计划评分。
- 保持普通 OpenGame 游戏生成链路不变，不注册新工具、不接 LLM。
- 为阶段 2 的课程方案生成工具提供可复用的 schema、校验、映射和评分函数。

### 阶段 1 落地计划

- [x] 新增 `packages/core/src/course/schemas.ts`，定义 `CourseSpec`、`ExplanationDepthSpec`、`CoursePlanOption`、`CourseGDD` 和对应 JSON Schema。
- [x] 新增 `packages/core/src/course/subjectTaxonomy.ts`，维护全学科入口的别名、默认课程模板和不建议首批支持的玩法。
- [x] 新增 `packages/core/src/course/gameplayMapping.ts`，实现 `mapSubjectToGameplayCandidates()`，不调用 LLM。
- [x] 新增 `packages/core/src/course/planScoring.ts`，实现 `scoreCoursePlan()` 与基础方案构造函数。
- [x] 新增 `packages/core/src/course/validation.ts`，实现 `validateCourseSpec()`、`validateCoursePlanOption()`、`validateCoursePlanOptions()`。
- [x] 在 `packages/core/src/index.ts` 导出课程模型和纯函数，供后续工具与 SDK 复用。
- [x] 补充 `packages/core/src/course/*.test.ts` 单元测试。

### 阶段 1 关键实现

- `validateCourseSpec()` 使用 AJV 校验结构，再叠加课程深度硬规则，包括年级、时长、监护人限制、上传图片限制、概念层、例题/练习/迁移任务、反馈深度和学习目标覆盖。
- `mapSubjectToGameplayCandidates()` 覆盖数学、语文、英语、科学、道法/常识、艺术/综合，并对未知学科降级到 `course_ui`，保留全学科入口。
- `scoreCoursePlan()` 输出 `learningFit`、`explanationDepthFit`、`fun`、`ageFit`、`implementationStability`、`cost`、`safety` 七个维度；`deep/challenge` 下浅层反馈和缺少迁移任务会压低深度得分。
- 每个新增代码文件均低于 1000 行。

### 阶段 1 验证

- [x] 单元测试覆盖全学科输入：数学、语文、英语、科学、道法、艺术。
- [x] 单元测试覆盖 `standard/deep` 深度缺少例题、误区或迁移任务时失败。
- [x] 单元测试覆盖上传图片关闭时 `referenceImages` 被拒绝。
- [x] 单元测试覆盖未知学科降级到 `course_ui`。
- [x] 单元测试覆盖 `deep` 深度下浅层方案评分被压低。
- [x] `rtk npm run test --workspace=packages/core -- course`
- [x] `rtk npm run typecheck --workspace=packages/core`
- [x] `rtk npm run lint --workspace=packages/core`

### 阶段 1 后续注意

- 阶段 2 实现 `generate_course_plan` 时必须复用 `validateCourseSpec()`、`mapSubjectToGameplayCandidates()`、`scoreCoursePlan()` 和 `validateCoursePlanOptions()`。
- 阶段 2 需要新增课程工具注册测试，并可顺手补齐 `game-type-classifier.ts` 基础解析/降级测试缺口。

## MVP 1.0 阶段 2：课程方案生成工具

### 阶段 2 目标

- 新增 `generate_course_plan` 工具，输入必须是结构化 `CourseSpec`，不接受自由文本 prompt。
- 工具内部复用阶段 1 的课程输入校验、学科到玩法候选映射、方案评分和方案 schema 校验。
- 模型输出必须是 JSON，并在生成 Course GDD 前明确等待用户确认 `selectedPlanId`。
- 保持普通游戏生成链路不变，只新增课程工具入口。

### 阶段 2 落地计划

- [x] 新增 `packages/core/src/tools/generate-course-plan.ts`，实现 `GenerateCoursePlanTool` 和执行器。
- [x] 在 `packages/core/src/tools/tool-names.ts` 增加 `GENERATE_COURSE_PLAN` / `GenerateCoursePlan`。
- [x] 在 `packages/core/src/config/config.ts` 注册 `GenerateCoursePlanTool`。
- [x] 在 `packages/core/src/index.ts` 导出 `generate-course-plan` 工具类型和实现。
- [x] 新增 `packages/core/src/tools/generate-course-plan.test.ts`，覆盖模型 JSON、畸形 JSON、深度不足方案和 CourseSpec 拒绝。
- [x] 更新 `packages/core/src/config/config.test.ts`，覆盖工具显式启用注册。

### 阶段 2 关键实现

- `GenerateCoursePlanTool` 使用 `courseSpecSchema` 作为参数 schema，并在执行前再次调用 `validateCourseSpec()`，确保结构化输入和课程深度规则都被拦截。
- 工具 prompt 会把 `mapSubjectToGameplayCandidates()` 与 `scoreCoursePlan()` 生成的候选玩法和基线评分提供给 reasoning 模型，约束模型只输出 `course_ui/course_grid/course_td`。
- 模型输出通过 `safeJsonParse()` 解析，再调用 `validateCoursePlanOptions()` 校验 CoursePlanOption 结构。
- 新增质量门槛：必须包含 `stable`、`balanced`、`creative` 三类方案；每个方案必须覆盖全部 learningGoals；learningLoop 必须包含讲解、示例、互动、反馈、评价；`standard/deep/challenge` 下 `explanationDepthFit` 不能低于 70。
- 工具返回内容包含 `<course-plan-options>` JSON 和系统提醒，要求等待用户确认 `selectedPlanId` 后再调用后续 `generate_course_gdd`。

### 阶段 2 验证

- [x] mock reasoning API，测试 JSON 正常解析。
- [x] mock malformed JSON，测试 `safeJsonParse` 可修复轻微畸形输出。
- [x] 测试无法解析为课程方案数组时返回工具错误。
- [x] 测试 `deep` 深度下浅层方案评分过低会被拒绝。
- [x] 测试不合格 `CourseSpec` 在调用模型前被拒绝。
- [x] 测试工具注册列表可以显式启用 `GenerateCoursePlan`。
- [x] `rtk npm run test --workspace=packages/core -- generate-course-plan`
- [x] `rtk npm run test --workspace=packages/core -- course`
- [x] `rtk npm run test --workspace=packages/core -- src/config/config.test.ts`
- [x] `rtk npm run typecheck --workspace=packages/core`
- [x] `rtk npm run lint --workspace=packages/core`

### 阶段 2 后续注意

- 阶段 3 实现 `generate_course_gdd` 时，输入必须包含 `CourseSpec`、用户确认的 `selectedPlanId` 和对应 `CoursePlanOption`，不能绕过阶段 2 的方案确认。
- 阶段 3 可复用阶段 2 返回的 `CoursePlanOption`，并在 Course GDD 生成后继续做 learningGoal 覆盖、误区、迁移任务和逐字稿分段校验。
- `game-type-classifier.ts` 的普通游戏基础测试缺口仍未补齐；阶段 2 未修改普通游戏分类链路，后续可作为独立质量补强处理。

## MVP 1.0 阶段 3：课程 GDD 工具

### 阶段 3 目标

- 新增 `generate_course_gdd` 工具，必须在用户确认 `selectedPlanId` 后才能调用。
- 生成结构化 `CourseGDD`，覆盖讲解单元、互动任务、评价题、资产计划、旁白计划和验证计划。
- 收紧 Course GDD schema 和跨字段校验，确保每个学习目标都有讲解、互动、反馈和评价闭环。
- 保持普通 `generate_gdd` 和普通游戏模板链路不变。

### 阶段 3 落地计划

- [x] 收紧 `packages/core/src/course/schemas.ts` 的 `courseGddSchema`，补齐 `lessonUnits`、`interactionSpecs`、`assessmentSpec`、`assetPlan`、`narrationPlan`、`validationPlan` 结构。
- [x] 在 `packages/core/src/course/validation.ts` 新增 `validateCourseGdd()`，校验学习目标闭环、引用一致性、讲解深度、视频限制和验证计划。
- [x] 新增 `packages/core/src/tools/generate-course-gdd.ts`，复用 reasoning provider、`safeJsonParse()`、CourseSpec/selectedPlan 校验和 Course GDD 校验。
- [x] 在 `tool-names.ts`、`config.ts`、`packages/core/src/index.ts` 注册并导出 `GenerateCourseGDDTool`。
- [x] 新增 `packages/core/src/tools/generate-course-gdd.test.ts`，覆盖用户确认、模型 JSON、深度缺陷和模型篡改输入。
- [x] 更新 `packages/core/src/config/config.test.ts`，覆盖 `GenerateCourseGDD` 显式启用时能注册。
- [x] 新增 `agent-test/docs/course/explanation_depth.md`、`gameplay_mapping.md`，并同步 `course_gdd.md` 到当前 schema。

### 阶段 3 关键实现

- `GenerateCourseGDDTool` 输入为 `courseSpec`、`selectedPlan`、`selectedPlanId`、`userConfirmed`，未确认或 ID 不一致时在调用模型前拒绝。
- 工具 prompt 明确要求模型逐字段保留已确认的 `CourseSpec` 和 `selectedPlan`，解析后再次比较输入，防止模型改写已确认方案。
- `validateCourseGdd()` 叠加 schema 与课程闭环校验：每个 `learningGoal` 必须能找到对应 `lessonUnit`、`interactionSpec` 和 `assessmentSpec.items`。
- `deep/challenge` Course GDD 必须包含迁移、应用、反思或复盘信号；评价解析必须写出关键推理步骤，不能只给答案。
- 资产计划将普通 BGM/SFX 保留在 `assetPlan.audio`，讲解旁白进入 `narrationPlan.segments`，为阶段 6 的 TTS manifest 留出边界。

### 阶段 3 验证

- [x] 单测：缺少用户确认拒绝生成。
- [x] 单测：`deep` 深度下没有迁移或复盘任务时校验失败。
- [x] 单测：每个 learningGoal 都能反查到 lessonUnit、interactionSpec 和 assessment item。
- [x] 单测：模型改写已确认 CourseSpec 时拒绝。
- [x] 单测：监护人关闭生成视频时 Course GDD 不能规划视频资产。
- [x] 测试工具注册列表可以显式启用 `GenerateCourseGDD`。
- [x] `rtk npm run test --workspace=packages/core -- generate-course-gdd`
- [x] `rtk npm run test --workspace=packages/core -- course`
- [x] `rtk npm run test --workspace=packages/core -- src/config/config.test.ts`
- [x] `rtk npm run typecheck --workspace=packages/core`
- [x] `rtk npm run lint --workspace=packages/core`

### 阶段 3 后续注意

- 阶段 4 的三个课程模板必须统一读取 `courseContent.json` 或 `courseConfig.json`，字段应贴合当前 `CourseGDD` 的 `lessonUnits`、`interactionSpecs`、`assessmentSpec` 和 `narrationPlan`。
- 阶段 5 做 Course GDD 到 OpenGame 链路映射时，应复用 `selectedPlan.courseArchetype`，不要让课程链路回退到普通 `platformer/top_down/ui_heavy`。

## MVP 1.0 阶段 4：课程模板族

### 阶段 4 目标

- 新增 `course_ui`、`course_grid`、`course_td` 三个课程模板族，分别复用 `ui_heavy`、`grid_logic`、`tower_defense` 的成熟能力。
- 三个课程模板统一读取 `src/courseContent.json`，为阶段 5 的 Course GDD 映射提供稳定配置入口。
- 新增课程专用系统和模板 API 文档，但不改动普通游戏模板链路。

### 阶段 4 落地计划

- [x] 新增 `agent-test/templates/modules/course_ui`，复制 `ui_heavy` 基础能力。
- [x] 新增 `agent-test/templates/modules/course_grid`，复制 `grid_logic` 基础能力。
- [x] 新增 `agent-test/templates/modules/course_td`，复制 `tower_defense` 基础能力。
- [x] 三个模板新增 `src/courseContent.json` 和 `src/courseContent.ts`，统一课程正文、互动、评价、旁白和报告指标字段。
- [x] `course_ui` 新增 `LessonProgressManager`、`HintManager`、`LearningReportManager`。
- [x] `course_grid` 新增 `TaskObjectiveManager`、`StepFeedbackManager`。
- [x] `course_td` 新增 `ReviewWaveProgressManager`，强制 `reviewOnly` 复习边界。
- [x] 新增 `agent-test/docs/modules/course_ui|course_grid|course_td` 的 `design_rules.md` 和 `template_api.md`。
- [x] 新增 `packages/core/src/course/course-template-modules.test.ts`，持续校验课程模板结构、文档和统一配置。

### 阶段 4 关键实现

- `courseContent.json` 字段统一为 `course`、`learningGoals`、`lessonUnits`、`interactions`、`assessments`、`narration`、`report`、`templateRules`。
- `course_ui` 承接讲解、对话、选择、卡牌问答和报告；`course_grid` 承接分类、排序、路径和步骤推理；`course_td` 只承接复习、巩固和策略波次。
- `course_grid/src/utils.ts` 拆分为 `utils/core.ts`、`utils/grid.ts`、`utils/rendering.ts`，保留 `utils.ts` 兼容导出，避免复制模板新增文件超过 1000 行。
- `.agentdocs/index.md` 已登记三个课程模板 API，并记忆统一 `courseContent.json` 协议。

### 阶段 4 验证

- [x] `rtk npm run test --workspace=packages/core -- course-template-modules`
- [x] `rtk npm run test --workspace=packages/core -- course`
- [x] `rtk npm run typecheck --workspace=packages/core`
- [x] `rtk npm run lint --workspace=packages/core`
- [x] 新增课程模板源码独立 TypeScript 检查：`npx tsc --ignoreConfig --noEmit ... course_* 新增源码`
- [x] `npx prettier --check ...` 覆盖本阶段新增/改动文件。
- [x] 检查课程模板目录无复制产生的嵌套原模板目录。
- [x] 检查新增/复制代码文件不超过 1000 行。
- [ ] 临时装配 `course_ui` + `templates/core` 执行完整 `tsc --noEmit` 仍被 core 模板既有问题阻断：`GameOverUIScene.ts` 的 `Scene` 到 `Record<string, unknown>` 类型断言，以及 `src/test/setup.ts` 引用的 `canvas` 未安装。

### 阶段 4 后续注意

- 阶段 5 的 `courseGddMapper.ts` 应输出模板复制指令和 `courseContent.json` 内容，不要让三个模板各自定义新配置协议。
- `generate-course-gdd` 的下一步提示应与 mapper 输出保持一致，使用 `selectedPlan.courseArchetype` 指向 `course_ui/course_grid/course_td`。
- 阶段 9 创建最小示例工程前，应先修复 core 模板 `GameOverUIScene.ts` 类型断言并补齐 `canvas` 测试依赖，否则模板完整 `build/test` 会在课程代码之外失败。

## MVP 1.0 阶段 5：Course GDD 到 OpenGame 链路映射

### 阶段 5 目标

- 新增纯函数 mapper，把已校验 Course GDD 映射为课程模板 scaffold 计划。
- mapper 必须输出 `course_ui/course_grid/course_td` 模板复制指令和统一 `src/courseContent.json`，不回退到普通 `platformer/top_down/ui_heavy/grid_logic/tower_defense`。
- `generate_course_gdd` 返回内容中携带 scaffold 计划，明确后续工具顺序：普通素材、课程 TTS manifest、课程包验证。
- 保持普通 `classify_game_type` 和 `generate_gdd` 链路不变。

### 阶段 5 落地计划

- [x] 新增 `packages/core/src/course/courseGddMapper.ts`，实现 `mapCourseGddToOpenGameScaffold()`。
- [x] mapper 在映射前复用 `validateCourseGdd()`，确保无效 Course GDD 不能进入模板复制。
- [x] mapper 输出 `copyInstructions`，覆盖 `agent-test/templates/core/*`、选定 `agent-test/templates/modules/course_*/src/*`、课程模板文档和 `src/courseContent.json` 写入。
- [x] mapper 输出标准化 `CourseContentJson`，字段对齐阶段 4 模板协议：`course`、`learningGoals`、`lessonUnits`、`interactions`、`assessments`、`narration`、`report`、`templateRules`。
- [x] mapper 输出 `nextTools`：`generate_game_assets`、`course_tts_manifest`、`validate_course_package`。
- [x] 在 `packages/core/src/index.ts` 导出 `courseGddMapper`。
- [x] 更新 `packages/core/src/tools/generate-course-gdd.ts`，在 `<course-gdd>` 后追加 `<course-scaffold>` JSON，并把下一步提醒改为复制课程模板、写入 `courseContent.json`、生成普通素材/TTS/验证。
- [x] 新增 `packages/core/src/course/courseGddMapper.test.ts`，覆盖三种课程模板、禁止普通模板输出和无效 GDD 拒绝。
- [x] 更新 `packages/core/src/tools/generate-course-gdd.test.ts`，覆盖 scaffold 输出。

### 阶段 5 关键实现

- `CourseScaffoldPlan` 包含 `archetype`、`courseId`、`templateModule`、`templateDocs`、`copyInstructions`、`writeFiles`、`nextTools` 和 `warnings`，后续 SDK/CLI 可直接消费。
- `CourseContentJson` 通过学习目标顺序生成稳定 `goal_1`、`goal_2` ID，并从 Course GDD 的 lesson、interaction、assessment 和 narration 字段派生模板可读配置。
- 三种模板各自设置固定场景 key 和报告指标：`course_ui` 使用 `LessonScene/PracticeScene/BattleScene`，`course_grid` 使用 `GridLessonScene/GridPracticeScene`，`course_td` 使用 `ReviewPrepScene/ReviewWaveScene`。
- `course_td` 的 `templateRules.reviewOnly` 固定为 `true`，如果 GDD 文本未体现复习/巩固边界则给 warning，不阻断映射。
- `generate_course_gdd` 现在会把 mapper 输出直接放入 `<course-scaffold>`，减少后续代理从自然语言提醒里二次推断 scaffold 的风险。

### 阶段 5 验证

- [x] mapper 单测覆盖三种模板。
- [x] mapper 单测保证不会输出原始 `platformer/top_down/ui_heavy/grid_logic/tower_defense` 模板。
- [x] mapper 单测覆盖无效 Course GDD 映射前失败。
- [x] 集成测试检查课程工具注册列表包含课程工具：`rtk npm run test --workspace=packages/core -- src/config/config.test.ts`
- [x] `rtk npm run test --workspace=packages/core -- courseGddMapper generate-course-gdd`
- [x] `rtk npm run test --workspace=packages/core -- course`
- [x] `rtk npm run typecheck --workspace=packages/core`
- [x] `rtk npm run lint --workspace=packages/core`
- [x] `rtk ./node_modules/.bin/prettier --check packages/core/src/course/courseGddMapper.ts packages/core/src/course/courseGddMapper.test.ts packages/core/src/tools/generate-course-gdd.ts packages/core/src/tools/generate-course-gdd.test.ts packages/core/src/index.ts`
- [x] 检查新增/改动代码文件不超过 1000 行。

### 阶段 5 后续注意

- 阶段 6 应消费 `CourseGDD.narrationPlan.segments` 或 mapper 生成的 `courseContent.narration.segments`，生成 `public/assets/narration/` 下的音频与 manifest。
- `course_tts_manifest` 已在风险修复中升级为正式注册工具，`nextTools` 不再只是自然语言占位。
- 并行运行多个 Vitest coverage 命令仍可能触发 `coverage/.tmp` 清理竞争；单独重跑 `config.test.ts` 已通过。

## MVP 1.0 阶段 6：多模态资产与 TTS

### 阶段 6 目标

- 新增课程 TTS 服务，把 Course GDD 的 `narrationPlan.segments` 转成本地 lessonin-server 批量请求。
- 新增 narration manifest 构建逻辑，持久化 `audio_uri`，并在 TTS 失败或缺少音频时降级为字幕。
- 明确普通图片/BGM/SFX、课程 TTS 和可选视频的资产边界，保持普通 `generate_game_assets` 链路不变。
- 本阶段只提供纯函数和服务能力，不注册新工具；阶段 7 的验证工具再消费 manifest。

### 阶段 6 落地计划

- [x] 新增 `packages/core/src/course/tts/lessoninTtsService.ts`，实现 lessonin 批量 TTS 请求、请求校验和响应校验。
- [x] 新增 `packages/core/src/course/tts/narrationManifest.ts`，实现 `buildLessoninBatchRequestFromCourseGdd()`、`buildCourseNarrationManifest()` 和字幕降级 manifest。
- [x] 在 `packages/core/src/index.ts` 导出课程 TTS 服务和 manifest 构建函数。
- [x] 新增 `agent-test/docs/course/asset_manifest.md`，记录普通素材、TTS、视频和降级协议。
- [x] 更新 `.agentdocs/index.md`，登记资产协议文档，并写入课程旁白统一走 `packages/core/src/course/tts` 的长期记忆。
- [x] 新增 `lessoninTtsService.test.ts` 和 `narrationManifest.test.ts`，覆盖批量请求、响应解析、非法脚本名、业务错误、`audio_uri` manifest 和字幕降级。

### 阶段 6 关键实现

- lessonin 批量请求严格使用 `{basePath,type,scriptList[{name,script}]}`，`type` 固定为 `mp3`，`scriptList.name` 会拒绝路径分隔符、`..` 和重复值。
- `LessoninTtsService` 支持注入 `fetchImpl`、cookie 和自定义 header，方便 SDK/CLI 或本地服务测试复用。
- `normalizeBatchAudioResponse()` 要求每条结果都有持久字段 `audio_uri`，服务业务错误或缺少 `audio_uri` 会直接失败，不伪造成功结果。
- `buildLessoninBatchRequestFromCourseGdd()` 优先使用旁白分段 `id` 生成稳定文件名，并保证同一批次内唯一。
- `buildCourseNarrationManifest()` 将 TTS 结果合并为 `CourseNarrationManifest`，每段保留 `fallbackSubtitle`；TTS 失败或缺少音频时 `fallbackMode` 进入 `subtitle_only`。

### 阶段 6 验证

- [x] mock 本地 TTS HTTP 服务，测试批量请求体。
- [x] 测试 TTS 失败时生成可读字幕并降级为无音频模式。
- [x] manifest 校验：每个 narration segment 有 text、targetScene、audio_uri 或 fallback。
- [x] `rtk npm run test --workspace=packages/core -- tts narrationManifest`
- [x] `rtk npm run test --workspace=packages/core -- course`
- [x] `rtk npm run typecheck --workspace=packages/core`
- [x] `rtk npm run lint --workspace=packages/core`
- [x] `rtk ./node_modules/.bin/prettier --check packages/core/src/course/tts/lessoninTtsService.ts packages/core/src/course/tts/narrationManifest.ts packages/core/src/course/tts/lessoninTtsService.test.ts packages/core/src/course/tts/narrationManifest.test.ts packages/core/src/index.ts .agentdocs/index.md agent-test/docs/course/asset_manifest.md`
- [x] 检查新增代码文件不超过 1000 行。

### 阶段 6 后续注意

- 阶段 7 的 `validate-course-package` 应读取 narration manifest，缺少 TTS 文件但存在 `fallbackSubtitle` 时只给 warning，不阻断发布。
- 阶段 7 应补齐 `agent-test/docs/course/validation_protocol.md`，把 `asset-pack.json`、`narrationManifest`、场景注册、`LEVEL_ORDER[0]` 和适龄安全扫描纳入统一输出。
- `course_tts_manifest` 已在后续风险修复中封装为正式工具，复用本阶段纯函数和字幕降级能力。

## MVP 1.0 阶段 7：课程包验证工具

### 阶段 7 目标

- 新增 `validate_course_package` 工具，作为课程包发布前的阻断性检查。
- 统一输出 `error`、`warning`、`info`，让生成链路能明确判断是否继续 build/test/browser 验证。
- 检查 Course GDD、`courseContent.json`、`asset-pack.json`、narration manifest、场景注册、首场景和适龄安全规则。

### 阶段 7 落地计划

- [x] 新增 `packages/core/src/tools/validate-course-package.ts`，实现课程包验证工具和可复用 `validateCoursePackage()`。
- [x] 在 `tool-names.ts` 增加 `VALIDATE_COURSE_PACKAGE` / `ValidateCoursePackage`。
- [x] 在 `config.ts` 注册 `ValidateCoursePackageTool`。
- [x] 在 `packages/core/src/index.ts` 导出课程包验证工具。
- [x] 新增 `packages/core/src/tools/validate-course-package.test.ts`，覆盖阻断和降级用例。
- [x] 新增 `agent-test/docs/course/validation_protocol.md`，记录课程包验证协议。
- [x] 更新 `.agentdocs/index.md`，登记验证协议并写入课程发布前验证记忆。

### 阶段 7 关键实现

- 工具输入为生成后的 `packageDir` 和结构化 `courseGdd`；默认读取 `src/courseContent.json`、`public/assets/asset-pack.json`、`public/assets/narration/narration-manifest.json`、`src/main.ts`、`src/LevelManager.ts`。
- Course GDD 先复用 `validateCourseGdd()`；不合法时直接阻断。
- `courseContent.json` 必须覆盖全部学习目标，并且每个目标都有讲解、互动反馈和评价闭环。
- `asset-pack.json` 必须包含 Course GDD 规划的图片、BGM、SFX key；素材 URL 异常时 warning。
- narration manifest 必须覆盖所有旁白分段；缺少 `audio_uri` 且没有字幕降级时 error，缺本地音频但有 `fallbackSubtitle` 时 warning。
- `main.ts` 需要注册课程配置引用的场景；`LevelManager.LEVEL_ORDER[0]` 必须指向已注册首场景。
- 适龄安全扫描只检查面向学生展示的正文、题目、反馈、资产说明和场景名，避免把 `styleSpec.forbidden` 本身误判为命中内容。

### 阶段 7 验证

- [x] 单测：缺少 explanation 失败。
- [x] 单测：缺少 TTS 文件但有 fallback 时 warning，不阻断。
- [x] 单测：缺少 scene 注册失败。
- [x] 工具注册测试覆盖 `ValidateCoursePackage` 显式启用。
- [x] `rtk npm run test --workspace=packages/core -- validate-course-package`
- [x] `rtk npm run test --workspace=packages/core -- src/config/config.test.ts`
- [x] `rtk npm run test --workspace=packages/core -- course`
- [x] `rtk npm run typecheck --workspace=packages/core`
- [x] `rtk npm run lint --workspace=packages/core`
- [x] `rtk ./node_modules/.bin/prettier --check packages/core/src/tools/validate-course-package.ts packages/core/src/tools/validate-course-package.test.ts packages/core/src/tools/tool-names.ts packages/core/src/config/config.ts packages/core/src/config/config.test.ts packages/core/src/index.ts .agentdocs/index.md .agentdocs/workflow/260507-toc-game-course-plan.md agent-test/docs/course/validation_protocol.md`

### 阶段 7 后续注意

- 阶段 8 如果封装 SDK/headless 入口，应把 `validate_course_package` 放在生成流程的 build/test/browser 验证之前。
- 阶段 9 端到端基准需要补真实生成包的 build/test/browser 验证；当前阶段 7 只做结构与产物一致性检查。

## MVP 1.0 阶段 8：CLI/SDK 使用入口

### 阶段 8 目标

- 第一阶段不改交互 UI，不新增 `--course-spec` CLI 参数，先让外部 ToC 服务能通过 SDK/headless 跑通课程链路。
- 新增 `createCourseGame(courseSpec)` wrapper，默认只生成 3 个课程方案并停在方案确认边界。
- 已确认方案后，SDK wrapper 能构造受控 prompt，引导代理按 `generate_course_gdd -> scaffold -> generate_game_assets -> course_tts_manifest -> validate_course_package` 推进。
- 定义 stream-json 课程阶段进度事件，方便 ToC 前端展示生成进度。

### 阶段 8 落地计划

- [x] 新增 `packages/sdk-typescript/src/course/createCourseGame.ts`。
- [x] 在 `packages/sdk-typescript/src/index.ts` 导出课程 SDK wrapper、类型和进度 tracker。
- [x] `createCourseGame()` 默认合并课程链路所需 `coreTools`，并启用 `includePartialMessages`。
- [x] `buildCourseGamePrompt()` 支持 `plan_only` 与 `confirmed_generation` 两种模式。
- [x] `createCourseProgressTracker()` 从 SDK assistant tool_use/tool_result/result 消息生成课程阶段事件。
- [x] 新增 `packages/sdk-typescript/test/unit/createCourseGame.test.ts`，覆盖 prompt、确认边界、工具白名单和进度事件。
- [x] 修复 SDK workspace lint 脚本，让它显式使用仓库根部 ESLint 9 入口，避免本地旧嵌套依赖加载 flat config 时崩溃。

### 阶段 8 关键实现

- `plan_only` 模式只允许调用 `generate_course_plan`，并明确禁止调用 `generate_course_gdd`、复制模板或生成素材，保证方案确认不会被 SDK 默认绕过。
- `confirmed_generation` 模式强制要求 `selectedPlan`、`selectedPlanId`，并校验二者一致；prompt 中要求 `userConfirmed: true`。
- SDK 默认 `coreTools` 包含 `GenerateCoursePlan`、`GenerateCourseGDD`、`GenerateAssets`、`CourseTTSManifest`、`ValidateCoursePackage` 和必要文件/命令工具，调用方传入的 `coreTools` 会去重合并。
- 进度 tracker 当前映射 `generate_course_plan`、`generate_course_gdd`、`generate_game_assets`、`course_tts_manifest`、`validate_course_package` 和最终 result。

### 阶段 8 验证

- [x] `rtk npm run test --workspace=packages/sdk-typescript -- createCourseGame`
- [x] `rtk npm run test --workspace=packages/sdk-typescript`
- [x] `rtk npm run typecheck --workspace=packages/sdk-typescript`
- [x] `rtk npm run lint --workspace=packages/sdk-typescript`
- [x] `rtk npm run typecheck --workspace=packages/core`
- [x] `rtk npx prettier --check packages/sdk-typescript/src/course/createCourseGame.ts packages/sdk-typescript/test/unit/createCourseGame.test.ts packages/sdk-typescript/src/index.ts packages/sdk-typescript/package.json package-lock.json .agentdocs/workflow/260507-toc-game-course-plan.md`

### 阶段 8 后续注意

- 阶段 9 需要用 SDK/headless 入口驱动 5 个跨学科 fixture，至少先覆盖方案生成、确认后 GDD/scaffold 输出和课程包验证。
- 阶段 9 前应处理 `course_ui + templates/core` 完整 `tsc --noEmit` 的既有阻断：`GameOverUIScene.ts` 类型断言与 `src/test/setup.ts` 的 `canvas` 依赖。
- `course_tts_manifest` 已有显式工具和 SDK 进度映射；后续 ToC 前端可直接展示课程旁白 manifest 阶段。

## MVP 1.0 阶段 9：端到端验证基准

### 阶段 9 目标

- 新增 5 个跨学科课程基准 fixture，覆盖小学一至六年级、`intro/standard/deep/challenge` 深度和 `course_ui/course_grid/course_td` 三类受控模板。
- 新增可自动运行的端到端静态装配测试：从 fixture 构造 Course GDD，映射 scaffold，装配临时课程包，执行 `validate_course_package`，并验证首轮互动与学习报告闭环。
- 修复阶段 9 发现的课程包验证误报，确保发布前验证能拦截真实缺失 asset key，同时不被模板注释或 Phaser loader URL 误导。
- 尽量推进真实模板 build 验证，并记录仍阻断的问题。

### 阶段 9 落地计划

- [x] 新增 `agent-test/course-fixtures/grade1-chinese-word-match.json`，覆盖一年级语文识字/词语匹配，`intro` 深度，`course_ui`。
- [x] 新增 `agent-test/course-fixtures/grade3-math-area-perimeter.json`，覆盖三年级数学面积周长，`standard` 深度，`course_grid`。
- [x] 新增 `agent-test/course-fixtures/grade4-english-listening-dialogue.json`，覆盖四年级英语听辨和句型对话，`standard` 深度，`course_ui`。
- [x] 新增 `agent-test/course-fixtures/grade5-science-circuit.json`，覆盖五年级科学简单电路，`deep` 深度，`course_grid`。
- [x] 新增 `agent-test/course-fixtures/grade6-math-ratio-fraction.json`，覆盖六年级数学比例和分数应用，`challenge` 深度，`course_td`。
- [x] 新增 `integration-tests/course-generation.test.ts`，动态加载 core 课程模块，避免 integration TypeScript 项目引用依赖 core dist。
- [x] 集成测试覆盖 CourseSpec 校验、Course GDD 校验、scaffold 映射、模板复制、`courseContent.json` 写入、asset pack、narration 字幕降级 manifest、场景注册、`LEVEL_ORDER[0]` 和学习报告闭环。
- [x] 修复 `validate-course-package` 注释误报：资产 key 扫描先剥离 TypeScript 行注释和块注释。
- [x] 修复 `validate-course-package` Phaser loader 误报：`this.load.image('key', 'url')` 只提取第一个参数作为 asset key，避免把 URL 当 key。
- [x] 补充 `validate-course-package.test.ts` 回归用例，确保注释中的素材 key 不算运行时引用。
- [x] 补充 `validate-course-package.test.ts` 回归用例，确保 `generate_game_assets` 写出的分组 `asset-pack.json` 格式不会被误判为缺少素材 key。
- [x] 修复 `agent-test/templates/core/src/scenes/GameOverUIScene.ts` 的 Phaser Scene 到 `Record<string, unknown>` 类型断言。

### 阶段 9 关键实现

- 5 个 fixture 都使用结构化 `CourseSpec`，不是自由文本；每个都能通过 `validateCourseSpec()` 的学科、监护人、讲解深度、概念层和学习目标覆盖校验。
- `integration-tests/course-generation.test.ts` 在测试内构造基准 Course GDD，再使用真实 `mapCourseGddToOpenGameScaffold()` 和 `validateCoursePackage()`，验证阶段 3、5、7 的链路能组合工作。
- 临时课程包按 mapper 输出复制 `agent-test/templates/core` 和对应 `course_*` 模板源码，并写入真实 `src/main.ts`、`src/LevelManager.ts`、`src/courseContent.json`、`public/assets/asset-pack.json`、`public/assets/narration/narration-manifest.json`。
- 集成测试显式覆盖模板内置必需素材 key：`course_ui` 需要 `__DEFAULT`，`course_grid` 需要 `level1_bg`，`course_td` 需要 `tower_bullet`。
- TTS 失败路径用 `fallback_subtitle` manifest 验证，要求 `validate_course_package` 输出 warning 但不阻断。
- 首轮互动与学习报告闭环通过课程配置模拟：每个目标完成讲解、互动、评价后，完成目标数等于学习目标数，正确率为 1，评价题具备 hint 和 misconceptionTag。

### 阶段 9 验证

- [x] `rtk npm run test:integration:sandbox:none -- course-generation.test.ts`
- [x] `rtk npm run test --workspace=packages/core -- validate-course-package`
- [x] `rtk npm run test --workspace=packages/core -- course`
- [x] `rtk npm run typecheck --workspace=packages/core`
- [x] `rtk npm run lint --workspace=packages/core`
- [x] `rtk ./node_modules/.bin/eslint integration-tests/course-generation.test.ts`
- [x] `rtk ./node_modules/.bin/prettier --check agent-test/course-fixtures/*.json integration-tests/course-generation.test.ts packages/core/src/tools/validate-course-package.ts packages/core/src/tools/validate-course-package.test.ts agent-test/templates/core/src/scenes/GameOverUIScene.ts`
- [x] 检查本轮新增/改动代码文件均低于 1000 行：`integration-tests/course-generation.test.ts` 526 行，`validate-course-package.ts` 893 行，`validate-course-package.test.ts` 549 行。
- [ ] `rtk npx tsc --noEmit -p integration-tests/tsconfig.json` 仍有 integration-tests 既有错误，但已确认没有 `course-generation.test.ts` 相关错误；输出显示剩余 13 个错误来自既有测试文件。
- [x] 临时 `course_ui/course_grid/course_td + templates/core` 真实装配后执行 `npm install && npm run build` 均通过；安装验证使用 `/private/tmp` 临时 npm cache，避免用户本地 `~/.npm` 权限问题影响结果。

### 阶段 9 后续注意

- 阶段 9 已完成可自动化的静态端到端装配、发布前验证和真实模板生产 build，但还不是完整浏览器可玩验证。
- 整体验收 review 已处理模板生产 build 不应编译 `src/test/setup.ts` 的问题，并确认课程模板 `gameConfig.json` 必须保留 core `main.ts` 依赖的 `screenSize`、`debugConfig.debug`、`renderConfig.pixelArt`。
- 下一步应按用户要求从更高视角检查 MVP 1.0 是否满足最终目标；如果发现缺陷，应先给出修复方案，再继续进入补缺阶段。

## MVP 1.0 整体验收 review：第一轮真实 build 补缺

### 本轮目标

- 从 MVP 1.0 最终闭环目标反查阶段 0-9 的明显缺陷和隐藏问题。
- 优先处理阶段 9 已记录的真实课程模板 build 缺口，确认三类受控模板不是只通过静态装配测试。
- 不改变普通游戏生成链路，不引入新测试框架。

### 落地计划

- [x] 复现阶段 9 记录的生产 build 阻断点。
- [x] 修复 `agent-test/templates/core/tsconfig.json`，让生产 build 排除 `src/test`，并移除生产 `types` 中的 `vitest`。
- [x] 修复 `course_grid/src/gameConfig.json`，补回 core `main.ts` 需要的 `debugConfig.debug`。
- [x] 更新 `course-template-modules.test.ts`，持续校验生产 `tsconfig` 不编译测试 setup，且三类课程模板保留 core 必需配置字段。
- [x] 临时真实装配 `course_ui`、`course_grid`、`course_td`，分别执行 `npm install && npm run build`。
- [x] 串行运行课程核心测试、课程包验证、集成基准、typecheck、lint 和格式检查。
- [x] 记录浏览器自动交互验证的当前阻断和下一步。

### 关键修复

- `agent-test/templates/core/tsconfig.json` 现在通过 `exclude: ["src/test"]` 把 headless 测试环境排除出生产 `tsc --noEmit`，避免 `src/test/setup.ts` 的测试依赖影响 H5 build。
- 同一 `tsconfig` 的 `compilerOptions.types` 改为 `[]`，避免生产 build 强制要求 Vitest 类型库。
- `course_grid/src/gameConfig.json` 补齐 `debugConfig.debug`，与 `course_ui`、`course_td` 以及 core `main.ts` 的读取契约保持一致。
- `course-template-modules.test.ts` 使用 TypeScript 官方 parser 读取 JSONC 格式的 `tsconfig.json`，并校验三类课程模板的 `gameConfig.json` 都保留 `screenSize.width`、`screenSize.height`、`debugConfig.debug`、`renderConfig.pixelArt`。

### 验证结果

- [x] 临时真实装配 `course_ui + templates/core`：`npm install && npm run build` 通过。
- [x] 临时真实装配 `course_grid + templates/core`：`npm install && npm run build` 通过。
- [x] 临时真实装配 `course_td + templates/core`：`npm install && npm run build` 通过。
- [x] `rtk npm run test --workspace=packages/core -- course-template-modules`
- [x] `rtk npm run test --workspace=packages/core -- validate-course-package`
- [x] `rtk npm run test:integration:sandbox:none -- course-generation.test.ts`
- [x] `rtk npm run typecheck --workspace=packages/core`
- [x] `rtk npm run lint --workspace=packages/core`
- [x] `rtk npm run test --workspace=packages/core -- course`
- [x] `rtk ./node_modules/.bin/prettier --check agent-test/templates/core/tsconfig.json agent-test/templates/modules/course_grid/src/gameConfig.json packages/core/src/course/course-template-modules.test.ts`

### 剩余风险与下一步

- 浏览器自动交互验证仍未完成：当前 Chrome DevTools MCP 因 profile 冲突不可用，仓库也没有 Playwright/Puppeteer 可复用；下一轮应优先修复浏览器验证入口或在用户允许后引入最小浏览器测试依赖。
- 真实 build 输出仍提示字体资源 `/assets/fronts/...` 在 build time 未解析，会在 runtime 按原路径加载；这不阻断构建，但下一轮浏览器验证应确认字体缺失不会造成首屏白屏或不可读。
- `npm install` 使用用户默认 `~/.npm` 时遇到 cache 权限问题；本轮验证使用 `/private/tmp` 临时 npm cache 绕过。若后续本机常规安装仍失败，需要修复用户 npm cache 权限，而不是修改项目依赖。

## MVP 1.0 整体验收 review：第二轮真实 scaffold 与课程场景补缺

### 本轮目标

- 补齐上一轮 review 遗留的更深层工程缺口：Course GDD mapper 不应只输出 `courseContent.json`，还必须输出真实可运行的课程入口。
- 让三类课程模板在复制后具备首轮可交互场景，能进入讲解、互动、评价和学习报告闭环。
- 继续尝试浏览器自动化验证，并在环境受限时如实记录阻断。

### 落地计划

- [x] 更新 `packages/core/src/course/courseGddMapper.ts`，在 scaffold `writeFiles` 中输出真实 `src/main.ts` 和 `src/LevelManager.ts`。
- [x] 新增 `course_ui` 的 `CourseUIScenes.ts`，提供 `LessonScene`、`PracticeScene`、`BattleScene`，贯通讲解、互动、评价和学习报告。
- [x] 新增 `course_grid` 的 `CourseGridScenes.ts`，提供 `GridLessonScene`、`GridPracticeScene`，贯通网格讲解、步骤反馈和报告。
- [x] 新增 `course_td` 的 `CourseTDScenes.ts`，提供 `ReviewPrepScene`、`ReviewWaveScene`，保持复习波次边界并生成报告。
- [x] 更新 `integration-tests/course-generation.test.ts`，让临时课程包消费 mapper 的真实 `writeFiles`，不再伪造 `main.ts` 和 `LevelManager.ts`。
- [x] 更新 mapper 单测，持续校验 `courseContent.json`、`main.ts`、`LevelManager.ts` 都随 scaffold 输出。
- [x] 补充 `validate_course_package` 回归测试，覆盖 `generate_game_assets` 的分组 asset-pack 格式。
- [x] 装配一年级语文 `course_ui` 临时真实课程包并执行 `npm install && npm run build`。

### 关键修复

- `mapCourseGddToOpenGameScaffold()` 现在输出三类课程模板对应的真实 `main.ts` 注册逻辑和 `LevelManager.LEVEL_ORDER`，避免生成链路在浏览器运行前还依赖代理临时猜写入口文件。
- 三类课程模板新增的课程场景只依赖统一 `courseContent.json`，不会重新发明模板协议；`course_ui` 复用 `LessonProgressManager`、`HintManager`、`LearningReportManager`，`course_grid` 复用 `TaskObjectiveManager`、`StepFeedbackManager`，`course_td` 复用 `ReviewWaveProgressManager`。
- 端到端集成测试从静态伪入口升级为消费 mapper 真实入口文件，降低“验证通过但真实 scaffold 不可运行”的风险。
- `validate_course_package` 已通过测试确认兼容 `generate_game_assets` 实际生成的 `{images:{files:[]}, audio:{files:[]}}` 分组 asset-pack 格式。

### 验证结果

- [x] 临时真实装配 `course_ui + templates/core`：`npm install && npm run build` 通过。
- [x] `rtk npm run test --workspace=packages/core -- courseGddMapper course-template-modules validate-course-package`
- [x] `rtk npm run test:integration:sandbox:none -- course-generation.test.ts`
- [x] `rtk npm run typecheck --workspace=packages/core`
- [x] `rtk npm run lint --workspace=packages/core`
- [x] `rtk ./node_modules/.bin/eslint --no-ignore integration-tests/course-generation.test.ts agent-test/templates/modules/course_ui/src/scenes/CourseUIScenes.ts agent-test/templates/modules/course_grid/src/scenes/CourseGridScenes.ts agent-test/templates/modules/course_td/src/scenes/CourseTDScenes.ts`
- [x] `rtk ./node_modules/.bin/prettier --check packages/core/src/course/courseGddMapper.ts packages/core/src/course/courseGddMapper.test.ts packages/core/src/tools/validate-course-package.test.ts integration-tests/course-generation.test.ts agent-test/templates/modules/course_ui/src/scenes/CourseUIScenes.ts agent-test/templates/modules/course_grid/src/scenes/CourseGridScenes.ts agent-test/templates/modules/course_td/src/scenes/CourseTDScenes.ts`

### 剩余风险与下一步

- 浏览器自动化验证仍受当前运行环境限制：Browser Use 没有发现可用 in-app browser backend；Chrome DevTools MCP 仍因固定 profile 冲突不可用；系统 Chrome headless 在 sandbox 下被 signal 6 终止；Computer Use 请求 Chrome 控制被 MCP 授权拒绝。
- 本轮已启动临时 Vite 服务并确认真实课程包 build 通过，但未能在当前环境完成“自动点击开始、完成一道题、看到学习报告”的浏览器执行证据。
- 下一轮如果环境允许，应优先使用 Browser Use 或可隔离 userDataDir 的 Chrome DevTools 实例复验 `http://127.0.0.1`，检查无白屏、开始按钮、首轮互动、反馈和学习报告可见。

## MVP 1.0 整体验收 review：第三轮浏览器 smoke 验证入口

### 本轮目标

- 将上一轮遗留的浏览器自动交互验证，从“环境受限的手工待办”推进为仓库内可重复执行的 smoke 入口。
- 不引入 Playwright/Puppeteer 等新测试框架，优先复用系统 Chrome、Vite 和 Node 22 自带 WebSocket。
- 给三类课程模板提供稳定的运行时状态标记，便于自动化判断讲解、互动、评价和学习报告是否可达。

### 落地计划

- [x] 新增 `integration-tests/helpers/courseBrowserSmoke.ts`，用 Chrome DevTools Protocol 启动独立 user data dir 的 headless Chrome，并通过 Vite 打开临时课程包。
- [x] 在 `integration-tests/course-generation.test.ts` 新增三类模板代表 fixture 的浏览器 smoke 测试，默认 Chrome 不可用时记录跳过，`OPENGAME_REQUIRE_COURSE_BROWSER_SMOKE=true` 时强制失败。
- [x] 为 `course_ui`、`course_grid`、`course_td` 的课程场景补充隐藏 DOM 状态节点 `[data-course-runtime-status]`，记录当前 `data-stage` 和 `data-scene`。
- [x] smoke 流程覆盖标题页启动、进入练习或复习波次、完成代表互动/评价、等待 `data-stage="report"`，并检查 canvas 非空与 fatal console error。
- [x] 在当前沙箱中运行默认集成测试，并额外运行强制模式确认失败原因可读。

### 关键实现

- `runCourseBrowserSmoke()` 不依赖浏览器测试框架；它直接启动 Chrome DevTools 端口，连接 WebSocket，使用 `Page`、`Runtime`、`Input`、`Log` 等 CDP domain 驱动页面。
- 临时课程包通过仓库 `node_modules` 软链复用依赖，不再在 smoke 中执行 `npm install`，降低自动验证成本。
- 三类课程模板的状态节点只写入隐藏 DOM，不改变可见 UI；报告阶段统一写入 `data-stage="report"`。
- 默认模式下，当前环境如果无法启动 Chrome，会返回 skipped，让现有 `course-generation.test.ts` 仍可覆盖静态装配和发布前验证；强制模式用于 CI 或本机可浏览器环境。

### 验证结果

- [x] `rtk npm run test:integration:sandbox:none -- course-generation.test.ts`
- [x] `rtk ./node_modules/.bin/eslint integration-tests/course-generation.test.ts integration-tests/helpers/courseBrowserSmoke.ts`
- [x] `rtk ./node_modules/.bin/eslint --no-ignore agent-test/templates/modules/course_ui/src/scenes/CourseUIScenes.ts agent-test/templates/modules/course_grid/src/scenes/CourseGridScenes.ts agent-test/templates/modules/course_td/src/scenes/CourseTDScenes.ts`
- [x] `rtk npm run test --workspace=packages/core -- course-template-modules`
- [x] `rtk ./node_modules/.bin/prettier --check integration-tests/course-generation.test.ts integration-tests/helpers/courseBrowserSmoke.ts agent-test/templates/modules/course_ui/src/scenes/CourseUIScenes.ts agent-test/templates/modules/course_grid/src/scenes/CourseGridScenes.ts agent-test/templates/modules/course_td/src/scenes/CourseTDScenes.ts`
- [x] 强制模式验证：`rtk env OPENGAME_REQUIRE_COURSE_BROWSER_SMOKE=true npm run test:integration:sandbox:none -- course-generation.test.ts` 在当前沙箱按预期失败，原因是 `Chrome 无法在当前环境启动：code=null signal=SIGABRT`。

### 剩余风险与下一步

- 当前沙箱仍无法产出真实浏览器通过截图或点击证据；这不是课程代码逻辑问题，而是 Chrome headless 无法启动。下一步应在本机非沙箱或 CI 浏览器环境运行强制模式，确认三类模板都能真实走到学习报告。
- Browser Use 和 Chrome DevTools MCP 仍分别受 IAB backend/profile 冲突限制；本轮新增的 CDP runner 是绕开 MCP profile 冲突的仓库级入口。
- 若强制模式在可用浏览器环境发现 UI 坐标漂移，应优先让课程模板暴露更稳定的测试钩子，而不是扩大点击坐标容忍。

## MVP 1.0 整体验收 review：第四轮浏览器环境复验

### 本轮目标

- 只处理最后一个未完成验收项：在当前环境开启强制浏览器 smoke，争取取得无白屏、首轮互动和学习报告 UI 的真实自动化证据。
- 若浏览器能力仍不可用，确认失败发生在浏览器启动/接管层，而不是课程包装配、Vite 服务或课程运行时代码。
- 不引入新测试框架，不修改课程业务代码。

### 执行结果

- [x] 复查 `integration-tests/helpers/courseBrowserSmoke.ts` 和 `integration-tests/course-generation.test.ts`，确认强制模式会把浏览器 skipped 转为失败。
- [x] 执行强制 smoke：`rtk env OPENGAME_REQUIRE_COURSE_BROWSER_SMOKE=true GEMINI_SANDBOX=false npx vitest run --root ./integration-tests course-generation.test.ts -t '浏览器 smoke' --retry=0 --pool=threads --poolOptions.threads.singleThread=true`，失败点仍为 `Chrome 无法在当前环境启动：code=null signal=SIGABRT`。
- [x] 直接探测系统 Chrome：`rtk "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --no-sandbox ...`，进程以 signal 6 终止，说明不是测试 helper 参数缺失。
- [x] 尝试 Chrome DevTools MCP：仍因 `/Users/shawn/.cache/chrome-devtools-mcp/chrome-profile` 已运行而无法创建/接管页面。
- [x] 按 Browser Use 技能初始化 in-app browser：失败原因为未发现 Codex IAB backend。
- [x] 执行默认课程集成测试：`rtk env GEMINI_SANDBOX=false npx vitest run --root ./integration-tests course-generation.test.ts --retry=0 --pool=threads --poolOptions.threads.singleThread=true` 通过，4 个测试全部 passed。

### 当前判断

- 课程 MVP 1.0 的代码侧阶段 0-9 与三轮整体 review 补缺已完成；本轮没有发现需要新增代码修复的业务缺陷。
- 唯一未完成项仍是环境前提：当前 Codex 沙箱无法启动或接管可用浏览器，因此不能产出真实点击与截图证据。
- 下一次有非沙箱 Chrome/Chromium 或 CI 浏览器环境时，应直接运行强制命令，不需要重复排查 Browser Use、Chrome DevTools MCP 或系统 Chrome 基础启动。

## MVP 1.0 整体验收 review：第五轮浏览器 smoke 脚本化收尾

### 本轮目标

- 把最后一个外部环境依赖的强制浏览器 smoke 验证，沉淀为稳定 npm 脚本，避免后续依赖手工拼接长命令。
- 更新课程验证协议，让默认课程基准和强制浏览器 smoke 有清晰入口。
- 不修改课程业务代码，不重复排查当前沙箱 Chrome 能力。

### 落地计划

- [x] 在根 `package.json` 新增 `test:course`，固定运行课程端到端基准。
- [x] 在根 `package.json` 新增 `test:course:browser`，固定开启 `OPENGAME_REQUIRE_COURSE_BROWSER_SMOKE=true` 并只运行浏览器 smoke 用例。
- [x] 更新 `agent-test/docs/course/validation_protocol.md`，记录两个课程验证命令。
- [x] 运行默认课程基准，确认静态端到端装配、发布前验证和默认浏览器跳过逻辑仍通过。
- [x] 运行强制浏览器脚本，确认当前环境失败信息仍明确指向 Chrome 启动层。

### 验证结果

- [x] `rtk npm run test:course` 通过，4 个测试全部 passed。
- [x] `rtk ./node_modules/.bin/prettier --check package.json agent-test/docs/course/validation_protocol.md`
- [x] `rtk npm run test:course:browser` 在当前沙箱按预期失败，原因是 `Chrome 无法在当前环境启动：code=null signal=SIGABRT`。

### 当前判断

- MVP 1.0 课程生成代码侧闭环已经具备固定验证入口：默认基准可在当前环境跑通，强制浏览器 smoke 可在具备 Chrome/Chromium 的本机非沙箱或 CI 环境作为发布前门槛。
- 当前仓库内不再缺少浏览器 smoke 的工程入口；剩余未完成项是运行环境提供可启动浏览器，并执行 `rtk npm run test:course:browser` 取得真实通过证据。

## MVP 1.0 风险修复：TTS 工具注册与视频过场运行时

### 本轮目标

- 修复 `course_tts_manifest` 只是 scaffold 流程名、不是正式注册工具的风险。
- 修复视频只停留在 Course GDD/asset 协议层，课程模板没有真实运行时播放体验的风险。

### 落地结果

- [x] 新增 `packages/core/src/tools/course-tts-manifest.ts`，输入 `packageDir + courseGdd`，默认调用 lessonin 批量 TTS，写入 `public/assets/narration/narration-manifest.json`。
- [x] `skipTts=true` 或 TTS 调用失败时，工具写入字幕降级 manifest，不阻断课程生成链路。
- [x] 在 `ToolNames`、`ToolDisplayNames`、`Config.createToolRegistry()`、`packages/core/src/index.ts` 中接入 `course_tts_manifest / CourseTTSManifest`。
- [x] SDK 课程 wrapper 将 `CourseTTSManifest` 纳入默认 `coreTools`，并把 `course_tts_manifest` 纳入进度 tracker。
- [x] mapper 将 `assetPlan.video` 映射为 `courseContent.videoTransitions`，`validate_course_package` 将视频素材纳入 `asset-pack.json` key 检查。
- [x] 三套课程模板新增 `VideoTransitionManager.ts`，支持播放 Phaser video、点击或 SPACE 跳过、视频缺失时静态过场降级。
- [x] 三套课程首个讲解/复习场景接入 `playOptionalVideoTransition()`。

### 验证结果

- [x] `rtk npm run test --workspace=packages/core -- course-tts-manifest courseGddMapper course-template-modules validate-course-package config.test.ts`
- [x] `rtk npm run test --workspace=packages/core -- course`
- [x] `rtk npm run test --workspace=packages/sdk-typescript -- createCourseGame`
- [x] `rtk npm run typecheck --workspace=packages/core`
- [x] `rtk npm run typecheck --workspace=packages/sdk-typescript`
- [x] 三套模板在临时课程包中分别执行 `tsc --noEmit` 通过：`course_ui`、`course_grid`、`course_td`。

### 当前判断

- 前两个风险已转为已修复状态：TTS 旁白 manifest 已有正式工具入口，视频过场已有模板运行时体验和降级路径。
- 浏览器 smoke 的剩余限制仍是环境层：需要可启动 Chrome/Chromium 的本机非沙箱或 CI 环境运行 `rtk npm run test:course:browser`，取得真实点击和截图证据。
