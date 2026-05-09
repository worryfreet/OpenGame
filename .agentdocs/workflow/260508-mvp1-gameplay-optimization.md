# MVP 1.0 玩法分类融合优化任务

## 任务背景

用户新增了 `prd/gameplay-taxonomy/`，系统性梳理了不同学习阶段、核心认知动作和玩法超类。当前 OpenGame 课程链路已经完成 MVP 1.0 的受控生成闭环，但生成结果仍容易单调：模板少、玩法少、题目容易换皮、视觉和声音不够形成完整课程体验。

本任务目标是基于现有 MVP 1.0 代码和文档，制定一套能把“玩法分类库”融入课程生成链路的深度优化方案，让项目更接近“K12 教育全科目目标细分游戏化教学”的产品定位。

本文中的 MVP、CourseSpec、Course GDD、SDK、Workflow、playlet 等仅为内部工程概念，不得直接出现在学生/家长可见界面或课程文案中；用户侧统一使用课程目标、课程方向、课程流程、试玩、学习报告等自然语言。

## 已阅读上下文

- `.agentdocs/index.md`
- `.agentdocs/prd/toc-course-mvp-1.md`
- `.agentdocs/prd/toc-course-mvp-2.md`
- `.agentdocs/prd/toc-course-mvp-3.md`
- `.agentdocs/prd/course-gameplay-taxonomy.md`
- `.agentdocs/prd/gameplay-taxonomy/README.md`
- `.agentdocs/prd/gameplay-taxonomy/01-10*.md`
- `packages/core/src/course/schemas.ts`
- `packages/core/src/course/subjectTaxonomy.ts`
- `packages/core/src/course/gameplayMapping.ts`
- `packages/core/src/course/planScoring.ts`
- `packages/core/src/course/validation.ts`
- `packages/core/src/tools/generate-course-plan.ts`
- `packages/core/src/tools/generate-course-gdd.ts`
- `packages/core/src/course/courseGddMapper.ts`
- `agent-test/docs/course/course_gdd.md`
- `agent-test/docs/course/gameplay_mapping.md`
- `agent-test/docs/modules/course_ui/template_api.md`
- `agent-test/docs/modules/course_grid/template_api.md`
- `agent-test/docs/modules/course_td/template_api.md`
- `packages/sdk-typescript/src/course/createCourseGame.ts`

## 当前项目现状判断

已实现的稳定基础：

- `CourseSpec`、`ExplanationDepthSpec`、`CoursePlanOption`、`CourseGDD` 已结构化。
- `generate_course_plan` 能生成 3 个受控方案，并要求用户确认 `selectedPlanId`。
- `generate_course_gdd` 能把确认方案转为 Course GDD，并通过 mapper 生成 `courseContent.json`。
- 已有 `course_ui`、`course_grid`、`course_td` 三类课程模板族。
- 已有图片/BGM/SFX、课程 TTS、视频过场降级、课程包验证和 SDK/headless 入口。
- 已有 5 个跨学科课程 fixture 和默认课程基准测试。

主要短板：

- `mapSubjectToGameplayCandidates()` 当前仍是“学科 -> 模板族/玩法字符串”的粗映射，没有按学习目标、学习阶段、核心动作和误区暴露方式选玩法。
- `CoursePlanOption.gameplayType` 只是字符串，无法表达玩法超类、核心动作、操作证据、反馈后果和模板承载方式。
- `CourseGDD.interactionSpecs.type` 只有少量模板交互类型，不能覆盖玩法分类库中的分类、匹配、标注、流程接线、变量调参、诊断修复、角色决策、项目验收等动作。
- 三类课程模板是稳定底座，但目前更像“讲解 + 练习 + 报告”的容器，缺少可组合的 micro-gameplay renderer（微玩法渲染器）。
- 资产计划仍偏素材清单，没有形成风格导演层：角色、场景、UI、动画、音效、TTS 情绪和视频过场之间缺少统一的 style bible（风格规范）。
- 验证工具能检查课程闭环，但还不能检查“玩法是否真的承载学习动作”“是否连续重复同一种题型”“视觉/听觉/交互是否单调”。

## 总体优化判断

MVP 1.0 不应依赖 AI 临场自由生成玩法代码。更稳妥的路线是：

1. 保留 `course_ui/course_grid/course_td` 三个受控模板族作为兼容底座。
2. 新增结构化 `PlayletCatalog`，把 `prd/gameplay-taxonomy/` 的具体玩法变成代码可用的数据。
3. 新增 `course_runtime + playlet template package`，让玩法像积木一样按 DAG 组合。
4. 第一轮交付 40 个 ready 具体玩法模板包，其余具体玩法进入 planned catalog。
5. 生成阶段只写配置、内容、风格、素材计划和旁白，不允许新增玩法引擎代码。
6. 新增反单调和教育有效性验证：操作必须等于学习动作，错误反馈必须暴露误区，多轮关卡必须有节奏变化。

## 分阶段 TODO

### 阶段 0：本次方案沉淀

- [x] 阅读 `.agentdocs` 索引、MVP 1/2/3 文档和新增玩法分类文档。
- [x] 阅读课程核心 schema、玩法映射、方案评分、GDD、mapper、模板 API 和 SDK 入口。
- [x] 判断当前链路与玩法分类库之间的主要断点。
- [x] 更新 `.agentdocs/index.md`，登记玩法分类文档和本任务文档。
- [x] 更新 `prd/toc-course-mvp-1.md`，加入玩法分类驱动的优化方案。

### 阶段 1：玩法分类结构化模型

- [x] 新增 `packages/core/src/course/playletCatalog.ts`，定义玩法超类、具体玩法、引擎族、ready/planned 状态、契约和占位资产。
- [x] 首批 40 个高频具体玩法标记为 `ready`，其余 74 个具体玩法标记为 `planned`。
- [x] 单测覆盖 ready 数量、超类覆盖、契约和 planned 玩法不可用。
- [ ] 新增 `packages/core/src/course/gameplayPatternCatalog.ts` 或在 `playletCatalog.ts` 上继续补充学习阶段、知识形态、目标动作和误区暴露规则。
- [ ] 新增 `GoalGameplayIntent`，描述每个学习目标的学习阶段、知识形态、核心动作、要暴露的误区和掌握证据。
- [ ] 新增 `GoalGameplayPlan`，把每个 `learningGoal` 映射到一个具体玩法 pattern 和 fallback pattern。
- [ ] 保留旧 `gameplayType` 字段兼容现有链路，但内部评分和 GDD 生成优先使用结构化玩法计划。
- [ ] 单测覆盖同一学科不同目标映射到不同玩法，例如数学的口算、面积几何、比例应用、证明推理不能落到同一种玩法。

### 阶段 1.5：玩法 DAG 工作流与 runtime 基础

- [x] 新增 `packages/core/src/course/courseWorkflow.ts`，定义 `CourseWorkflow`、`PlayletNode`、`WorkflowEdge`、`StyleBible` 和 DAG 校验。
- [x] `CoursePlanOption` 和 `CourseGDD` 支持可选 `workflow`，`CourseGDD` 支持可选 `styleBible`。
- [x] 新增 `agent-test/templates/course_runtime`，提供 `WorkflowRunner`、`CourseStateStore`、`TransitionManager` 和 workflow 场景。
- [x] 新增 `agent-test/templates/playlets/shared`，提供共享 `GenericPlayletScene`。
- [x] 新增 40 个 ready 具体玩法模板包，每个包包含 `manifest.json`、`schema.json`、`sample.json` 和 `index.ts`。

### 阶段 2：课程方案生成工具升级

- [x] `generate_course_plan` prompt 中加入 ready playlet 列表，要求每个方案输出 workflow DAG。
- [ ] `scoreCoursePlan()` 增加 `gameplayFit`、`variety`、`feedbackConsequence` 三类评分。
- [x] `validateCoursePlanOptions()` 通过 `validateCourseWorkflow()` 拦截 planned playlet、未知 playlet、不可达节点、环和目标覆盖缺失。
- [ ] `validateCoursePlanOptions()` 继续增加规则：连续目标不能全部使用同一 interaction type；`deep/challenge` 必须包含迁移、诊断、策略或创作类玩法之一。
- [ ] 方案展示中说明“为什么这个知识点适合这个玩法”，让学生/家长能理解方案差异。

### 阶段 3：Course GDD 与 mapper 协议升级

- [ ] 扩展 Course GDD，给 `lessonUnits` 和 `interactionSpecs` 增加可选的 `gameplayPatternId`、`coreAction`、`successEvidence`、`failureConsequence`。
- [x] 更新 `agent-test/docs/course/course_gdd.md` 和 `gameplay_mapping.md`，明确 workflow/playlet/styleBible 如何落到模板。
- [x] `courseGddMapper.ts` 将 workflow 和 styleBible 写入 `courseContent.json`，并输出 `course_runtime` 与 selected playlet packages 复制指令。
- [x] `validate_course_package` 校验 workflow、playlet 包文件和禁止生成玩法引擎 TS 代码。
- [ ] 校验 Course GDD：每个学习目标的互动动作必须与玩法超类一致，不能把“调参/诊断/创作”退化成普通选择题。

### 阶段 4：课程模板微玩法能力包

- [ ] `course_ui` 增强：选择判断、卡片匹配、证据配对、对话选择、摘要/改写、角色决策、需求清单验收。
- [x] `course_ui` 本轮真实 playlet：`playlet-关键词提取` 已支持材料阅读、关键词选择、命中反馈和学习证据写入。
- [x] `course_ui` 本轮真实 playlet：`playlet-需求清单验收` 已支持必需项/禁止项验收、逐项通过/未通过判断、错误反馈和学习证据写入。
- [x] `course_ui` 本轮真实 playlet：`playlet-框选标注` 已支持文本区域框选、目标/干扰区域校验、反馈提示和学习证据写入。
- [x] `course_grid` 本轮真实 playlet：`playlet-时间线排序` 已支持事件卡片排序、位置反馈、错误修正和学习证据写入。
- [x] `course_grid` 本轮真实 playlet：`playlet-流程接线` 已支持流程节点选择、可视接线、接线校验和学习证据写入。
- [x] `course_grid` 本轮真实 playlet：`playlet-条件组合推理` 已支持条件组合、结论选择、错因反馈和学习证据写入。
- [x] `course_grid` 本轮真实 playlet：`playlet-证据链拼接` 已支持证据卡选择、链条槽位填充、撤回、顺序校验、错因反馈和学习证据写入。
- [x] `course_grid` 本轮真实 playlet：`playlet-证明步骤补全` 已支持固定证明步骤、候选步骤选择、空位填入、证明顺序校验和学习证据写入。
- [x] `course_grid` 本轮真实 playlet：`playlet-口算挑战` 已支持多题口算、选项判断、错误重试、进度展示和正确率证据写入。
- [x] `course_ui` 本轮真实 playlet：`playlet-单选判断` 已支持逐项正确/不正确判断、错误修正、反馈提示和学习证据写入。
- [x] `course_ui` 首批真实 playlet：`playlet-卡片配对` 已从通用占位改为专用 Phaser Scene，支持左右卡片选择、配对校验、即时反馈和学习证据写入。
- [x] `course_ui` 本轮真实 playlet：`playlet-证据配对` 已支持结论与证据选择配对、即时错误反馈、完成校验和证据写入。
- [x] `course_ui` 本轮真实 playlet：`playlet-对话选择` 已支持多步骤对话、正确/错误回应反馈、分支推进和证据写入。
- [ ] `course_grid` 增强：拖拽分箱、步骤排序、流程接线、路径规划、坐标定位、模块装配、简单 A/B 对比。
- [x] `course_grid` 首批真实 playlet：`playlet-拖拽分箱` 已支持卡片拖拽入箱、正确/错误视觉反馈、完成校验和学习证据写入。
- [x] `course_grid` 首批真实 playlet：`playlet-步骤排序` 已支持步骤选择、上移/下移、提交校验、位置反馈和学习证据写入。
- [ ] `course_td` 增强：错题回炉、波次复习、资源分配、风险收益选择、策略复盘。
- [ ] 暂不优先新增完整 `course_lab` 或 `course_action` 模板；只有当实验调参、即时动作训练无法被三类模板稳定承载时再拆新模板。
- [ ] 每个微玩法都要通过 `courseContent.json` 配置驱动，避免把题目、反馈和状态机散落到生成代码里。

### 阶段 5：多模态风格导演层

- [x] 新增轻量 `StyleBible`，把主题、配色、角色方向、UI tokens、动效情绪、音频情绪和禁用元素写入 `courseContent.json`。
- [ ] 扩展 `assetPlan`，区分概念图、关卡背景、角色表情、UI 图标、反馈动画、转场视频、BGM、SFX、TTS 情绪。
- [ ] 生成素材前先锁定风格板，后续图片、视频、音效和模板 UI 都引用同一个风格计划。
- [ ] 校验风格一致性：同一课程不允许出现互相冲突的角色风格、配色和场景语义。

### 阶段 6：质量验证与反单调门禁

- [ ] `validate_course_package` 增加玩法有效性检查：操作是否对应学习动作、错误是否暴露误区、反馈是否改变场景状态。
- [ ] 增加反单调检查：同一课程不能连续多轮只做单选；至少有两种互动动作或明确的阶段推进。
- [ ] 增加多模态检查：每个核心场景至少有视觉反馈和音效/TTS/字幕中的一种反馈，视频缺失必须降级。
- [ ] 增加“换皮题库”检查：若知识点只影响题干和答案、不影响任务状态或反馈后果，则作为 warning 或 error。

### 阶段 7：跨学科基准扩充

- [ ] 在现有 5 个 fixture 基础上增加玩法覆盖基准，至少覆盖 10 个玩法超类中的 7 个。
- [ ] 为每个玩法超类准备一个最小 CourseSpec 和期望 `GoalGameplayPlan`。
- [ ] 增加 golden cases：同一学科不同学习阶段必须生成不同玩法链。
- [ ] 浏览器 smoke 不只点击一道题，还要验证微玩法状态变化、反馈展示和学习报告记录。

## MVP 1.0 与 MVP 2.0/3.0 的关系

- 本优化属于 MVP 1.0 的质量补强，不替代 MVP 2.0 的产品化输入、偏好记忆和学习续作。
- MVP 2.0 可以复用本优化中的 `GoalGameplayIntent` 做智能追问：当缺少学习阶段、目标程度或偏好玩法时，只追问高影响字段。
- MVP 3.0 的一句话高质量生成应建立在本优化之上：先把一句话转成结构化目标和玩法计划，再进入受控生成，而不是直接自由生成游戏。

## 本轮实施结果

- 已实现 `PlayletCatalog` 和 `CourseWorkflow` 基础架构，首批 40 个具体玩法模板包为 `ready`，其余玩法为 `planned`。
- 已新增 `course_runtime`、共享 `GenericPlayletScene` 和 40 个 playlet 模板包骨架，每个 ready 包包含 `manifest.json`、`schema.json`、`sample.json` 和 `index.ts`。
- `CoursePlanOption`、`CourseGDD`、`courseContent.json` 已支持 workflow 和 StyleBible；mapper 会复制 runtime、shared playlet 和 workflow 选中的玩法包。
- `generate_course_plan` 和 `generate_course_gdd` 已要求保留 DAG 编排、目标覆盖和风格规范；生成阶段不得写玩法引擎代码。
- `validate_course_package` 已拦截未知玩法、planned 玩法、不可达/成环/目标缺失 workflow、缺失 playlet 包文件和生成阶段新增玩法引擎 TS 文件。
- 集成 smoke 已支持 workflow 课程，能够从标题页进入第一个 playlet，逐节点完成并到达统一学习报告；临时测试包会写入占位图片/音频，验证缺素材时仍可运行。
- 2026-05-09 第一轮完成 3 个真实 playlet：`playlet-卡片配对`、`playlet-拖拽分箱`、`playlet-步骤排序`。同时让 `WorkflowEntryScene` 和 `BasePlayletScene.finish()` 按 `playletId` 分发到专用 Scene，并让 `courseGddMapper.ts` 在生成 `main.ts` 时自动 import/register workflow 选中的 playlet Scene。默认课程基准通过；强制浏览器 smoke 仍受当前环境 Chrome `SIGABRT` 启动失败限制。
- 2026-05-09 第二轮完成 3 个真实 playlet：`playlet-单选判断`、`playlet-证据配对`、`playlet-对话选择`。三个玩法均改为配置驱动的专用 Phaser Scene，更新 manifest renderer、sample 和 schema；`playletCatalog.test.ts` 覆盖 6 个真实 playlet 不再使用通用 renderer，`courseGddMapper.test.ts` 覆盖 mapper 对本轮 3 个 Scene 的 import/register。验证通过：`rtk npm run test --workspace=packages/core -- playletCatalog courseGddMapper`、`rtk npm run typecheck --workspace=packages/core`、`rtk npm run lint --workspace=packages/core`、临时课程模板 TypeScript 编译。
- 2026-05-09 第三轮完成 3 个真实 playlet：`playlet-找目标`、`playlet-找异常`、`playlet-连线匹配`。三个玩法均支持配置驱动交互、即时反馈、错误修正和学习证据写入；`playletCatalog.test.ts` 覆盖 9 个真实 playlet 不再使用通用 renderer，`courseGddMapper.test.ts` 覆盖 mapper 对本轮 3 个 Scene 的 import/register。验证通过：`rtk npm run test --workspace=packages/core -- playletCatalog courseGddMapper`、`rtk npm run typecheck --workspace=packages/core`、`rtk npm run lint --workspace=packages/core`、临时课程模板 TypeScript 编译。
- 2026-05-09 第四轮完成 3 个真实 playlet：`playlet-关键词提取`、`playlet-需求清单验收`、`playlet-框选标注`。三个玩法均从通用占位改为专用 Phaser Scene，支持配置驱动、即时反馈、错误修正和学习证据写入；`playletCatalog.test.ts` 覆盖 12 个真实 playlet 不再使用通用 renderer，`courseGddMapper.test.ts` 覆盖 mapper 对本轮 3 个 Scene 的 import/register。验证通过：`rtk npm run test --workspace=packages/core -- playletCatalog courseGddMapper`、`rtk npm run typecheck --workspace=packages/core`、`rtk npm run lint --workspace=packages/core`、临时课程模板 TypeScript 编译。
- 2026-05-09 第五轮完成 3 个真实 playlet：`playlet-时间线排序`、`playlet-流程接线`、`playlet-条件组合推理`。三个玩法均从通用占位改为专用 Phaser Scene，覆盖 sequence reasoning（顺序推理）的排序、流程因果和条件组合动作；`playletCatalog.test.ts` 覆盖 15 个真实 playlet 不再使用通用 renderer，`courseGddMapper.test.ts` 覆盖 mapper 对本轮 3 个 Scene 的 import/register。验证通过：`rtk npm run test --workspace=packages/core -- playletCatalog courseGddMapper`、`rtk npm run typecheck --workspace=packages/core`、`rtk npm run lint --workspace=packages/core`、临时课程模板 TypeScript 编译。
- 2026-05-09 第六轮完成 3 个真实 playlet：`playlet-证据链拼接`、`playlet-证明步骤补全`、`playlet-口算挑战`。三个玩法均从通用占位改为专用 Phaser Scene，覆盖推理证明与数学基础训练动作；`playletCatalog.test.ts` 覆盖 18 个真实 playlet 不再使用通用 renderer，`courseGddMapper.test.ts` 覆盖 mapper 对本轮 3 个 Scene 的 import/register。验证通过：`rtk npm run test --workspace=packages/core -- playletCatalog courseGddMapper`、`rtk npm run typecheck --workspace=packages/core`、`rtk npm run lint --workspace=packages/core`、临时课程模板 TypeScript 编译。

## 当前优先级

最高优先级继续是阶段 4：按每轮 3 个的节奏，把 ready playlet 从通用占位逐步替换为真实可交互实现。下一轮可优先选择 `playlet-等式平衡`、`playlet-坐标定位`、`playlet-图形拼装`，继续补齐数量空间系统类学习动作覆盖。
