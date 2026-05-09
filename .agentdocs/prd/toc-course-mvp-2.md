# MVP 2.0 产品化体验与持续使用能力落地方案

## 定位

MVP 2.0 建立在 MVP 1.0 的受控生成闭环之上，它的目标是把“能生成课程游戏”变成“学生和家长愿意反复使用的 ToC 产品体验”。

## 依赖的 1.0 前置能力

- `CourseSpec`、`CoursePlanOption`、`CourseGDD` 已经结构化。
- `generate_course_plan` 能输出多个可比较方案。
- `generate_course_gdd` 能在用户确认后生成课程实现规格。
- `validate_course_package` 能产出课程、资产、运行和适龄安全验证结果。
- 至少存在 `course_ui`、`course_grid`、`course_td` 三类模板。
- 本地 TTS 和基础学习报告已接入。

## 核心目标

- 降低输入门槛：从结构化表单走向“学生自然表达 + 系统追问补齐”。
- 提升确认体验：让用户在生成前看懂方案差异、风格预览、课程深度和预计效果。
- 支持持续使用：记住学生偏好、历史弱点、上次生成风格和学习结果。
- 提供可控编辑：允许改主题、角色、配色、题目、讲解深度、TTS 风格和视频开关。
- 形成学习闭环：根据学习报告推荐下一节，而不是只生成一次游戏。

## 推荐新增目录与文件

```text
packages/core/src/course/product/
  intakeSession.ts
  preferenceProfile.ts
  learningState.ts
  stylePreview.ts
  courseRevision.ts
  nextCoursePlanner.ts
  guardianPolicy.ts
  generationRecovery.ts

packages/core/src/tools/
  complete-course-intake.ts
  generate-style-preview.ts
  revise-course-plan.ts
  generate-next-course-spec.ts

packages/sdk-typescript/src/course/
  createCourseGame.ts
  resumeCourseGeneration.ts
  reviseCoursePlan.ts
  types.ts

agent-test/docs/product/
  mvp2-intake-flow.md
  mvp2-style-preview.md
  mvp2-learning-memory.md
  mvp2-guardian-policy.md

integration-tests/
  course-product-intake.test.ts
  course-product-revision.test.ts
  course-product-next-course.test.ts
```

如果后续有独立 ToC 前端仓库，前端只消费 SDK 暴露的结构化接口；OpenGame 仓库内优先实现核心数据模型、工具和 SDK wrapper。

## 核心数据模型

```ts
interface IntakeSession {
  sessionId: string;
  rawInput: string;
  knownFields: Partial<CourseSpec>;
  missingFields: IntakeMissingField[];
  followUpQuestions: IntakeQuestion[];
  confidence: number;
  status: 'collecting' | 'ready_for_plan' | 'blocked';
}

interface StudentPreferenceProfile {
  profileId: string;
  grade: 1 | 2 | 3 | 4 | 5 | 6;
  interests: string[];
  preferredThemes: string[];
  preferredPalette?: string[];
  preferredGameplayTypes: string[];
  readingLevel: 'low' | 'medium' | 'high';
  ttsPreference?: { voice?: string; speed?: number; emotion?: string };
}

interface LearningState {
  profileId: string;
  subjectStates: Array<{
    subject: string;
    weakPoints: string[];
    masteredGoals: string[];
    misconceptionTags: string[];
    lastCoursePackageId?: string;
  }>;
}

interface StylePreview {
  styleSpec: StyleSpec;
  palette: string[];
  characterDirection: string;
  uiMood: string;
  referenceImageAnalysis?: string;
  forbiddenElements: string[];
  previewPrompt: string;
}

interface CourseRevisionRequest {
  basePlanId: string;
  changes: Array<
    | { type: 'change_depth'; value: ExplanationDepthSpec['depthLevel'] }
    | { type: 'change_theme'; value: string }
    | { type: 'replace_question'; questionId: string; requirement: string }
    | { type: 'disable_video' }
    | { type: 'change_tts'; voice?: string; speed?: number; emotion?: string }
  >;
}
```

## 功能路线

| 功能         | 做法                                                                           | 带来的效果                                           | 复杂度 | 必要性 |
| ------------ | ------------------------------------------------------------------------------ | ---------------------------------------------------- | ------ | ------ |
| 智能输入向导 | 把自然语言、表单项和历史偏好合并成 `IntakeSession`；缺失高影响字段时生成追问   | 降低 prompt 门槛，让低龄学生和家长都能完成输入       | 中     | 必须   |
| 自然语言补全 | 用户输入“我想学三年级面积，做成太空风格”时，自动补齐候选目标、时长、玩法和深度 | 保留一句话体验雏形，但仍进入 1.0 的受控 `CourseSpec` | 中     | 必须   |
| 风格板预览   | 生成前输出 `StylePreview`，包含配色、角色方向、UI 情绪、参考图解析和禁止元素   | 减少生成后不满意，降低重生成成本                     | 中     | 必须   |
| 方案确认页   | 展示 3 个 `CoursePlanOption` 的评分、风险、成本、预计时长和讲解深度            | 用户知道自己选什么，降低黑盒感                       | 低-中  | 必须   |
| 课程深度调节 | 在方案确认时允许切换 `intro/standard/deep/challenge`，并重新跑计划评分         | 用户能明确控制讲解深浅，避免课程浅显                 | 中     | 必须   |
| 轻量编辑器   | 用 `CourseRevisionRequest` 修改结构化计划，不直接改生成后代码                  | 降低重生成成本，提高可控感                           | 高     | 重要   |
| 学生偏好记忆 | 保存兴趣、喜欢风格、常用学科、阅读水平、互动偏好                               | 下一次生成更准，减少重复输入                         | 中     | 重要   |
| 学习状态记忆 | 从学习报告提取薄弱点、错因类型、提示使用次数、完成情况                         | 支持连续学习和下一课推荐                             | 中     | 必须   |
| 学习报告深化 | 输出掌握点、错因、提示记录、下一课建议和推荐复习方式                           | 让产品从游戏生成变成学习陪伴                         | 中     | 必须   |
| 课程续作     | 用 `LearningReport -> CourseSpec` 生成“下一节”或“同主题强化练习”               | 提升留存和学习连续性                                 | 中-高  | 重要   |
| 家长控制台   | `guardianPolicy` 控制时长、内容边界、上传图片、数据删除、消费限制              | ToC 未成年人产品底线                                 | 中     | 必须   |
| 失败恢复     | 记录生成阶段、失败原因、可复用素材和降级选项                                   | 提高实际可用性，减少用户挫败                         | 中     | 必须   |

## 阶段 TODO

### 阶段 0：产品输入与状态边界

- [x] 明确 2.0 不改 1.0 的生成核心，只新增产品化输入、记忆、编辑和续作层。
- [x] 定义 `IntakeSession`、`StudentPreferenceProfile`、`LearningState`、`GuardianPolicy` 的最小字段。
- [x] 定义数据最小化规则：不保存学生真实姓名、头像、语音和精确画像；偏好与学习状态按 profileId 关联。
- [x] 输出 `agent-test/docs/product/mvp2-intake-flow.md`。

验证：

- [x] schema 单测覆盖缺失年级、缺失学科、上传图片被禁用、时长超限。
- [x] 隐私规则单测确保敏感字段不会进入持久化模型。

并行性：阶段 0 可并行调研，不建议并行改核心类型；由主 Agent 统一锁定字段。

### 阶段 1：智能输入向导

新增：

- [x] `packages/core/src/course/product/intakeSession.ts`
- [x] `packages/core/src/tools/complete-course-intake.ts`
- [x] `packages/core/src/course/product/intakeSession.test.ts`

实现要求：

- [x] 输入可以是自然语言、部分 `CourseSpec`、历史偏好和家长限制。
- [x] 输出 `IntakeSession`，明确 `knownFields`、`missingFields`、`followUpQuestions`、`confidence`。
- [x] 只有缺少高影响字段时才追问；低影响字段使用默认值并记录 assumption。
- [x] `status === ready_for_plan` 时必须能转换成 1.0 的 `CourseSpec`。

验证：

- [x] “三年级面积太空风格”能补出年级、学科、主题、候选目标、风格。
- [x] 缺少年级时必须追问。
- [x] 家长禁用上传图片时，参考图字段被拒绝或降级。

可并行任务：

- 任务 1A：schema Agent 负责 `IntakeSession` 类型和校验。
- 任务 1B：工具 Agent 负责 `complete-course-intake`。
- 任务 1C：测试 Agent 负责自然语言补全和追问测试。

### 阶段 2：风格板预览与方案确认增强

新增：

- [x] `packages/core/src/course/product/stylePreview.ts`
- [x] `packages/core/src/tools/generate-style-preview.ts`
- [x] `agent-test/docs/product/mvp2-style-preview.md`

实现要求：

- [x] `StylePreview` 从 `StyleSpec` 和参考图描述生成，不直接进入完整素材生成。
- [x] 方案确认展示 `CoursePlanOption` 的评分、风险、预计成本、预计时长、讲解深度差异。
- [x] 课程深度调节后重新调用 1.0 的计划评分，不直接进入 GDD。

验证：

- [x] 风格板输出必须包含 palette、characterDirection、uiMood、forbiddenElements。
- [x] 深度从 `standard` 改为 `deep` 后，方案的成本和深度要求变化可见。
- [x] 禁止知名 IP 风格直接进入 previewPrompt。

可并行任务：

- 任务 2A：风格 Agent 负责 `stylePreview.ts` 和工具。
- 任务 2B：确认页数据 Agent 负责方案确认数据聚合。
- 任务 2C：安全 Agent 负责风格禁用规则测试。

### 阶段 3：偏好记忆与学习状态记忆

新增：

- [x] `packages/core/src/course/product/preferenceProfile.ts`
- [x] `packages/core/src/course/product/learningState.ts`
- [x] `agent-test/docs/product/mvp2-learning-memory.md`

实现要求：

- [x] 偏好记忆只影响风格、玩法倾向和交互偏好。
- [x] 学习状态只影响课程目标、难度、错因和下一课推荐。
- [x] 两类记忆必须分离，避免把学习弱点误当成兴趣偏好。
- [x] 默认只保存结构化摘要，不保存完整对话和原始学生输入。

验证：

- [x] 偏好更新不会修改学习状态。
- [x] 学习报告中的错因能更新 `LearningState.misconceptionTags`。
- [x] 数据删除调用能清除 profile 关联偏好和学习状态。

可并行任务：

- 任务 3A：偏好 Agent 负责 `preferenceProfile.ts`。
- 任务 3B：学习状态 Agent 负责 `learningState.ts`。
- 任务 3C：隐私 Agent 负责数据最小化和删除测试。

### 阶段 4：轻量编辑器与课程修订

新增：

- [x] `packages/core/src/course/product/courseRevision.ts`
- [x] `packages/core/src/tools/revise-course-plan.ts`
- [x] `packages/sdk-typescript/src/course/reviseCoursePlan.ts`

实现要求：

- [x] 只允许编辑结构化计划：主题、深度、题目、角色/配色、视频开关、TTS 风格。
- [x] 修改后重新校验 `CourseSpec`、`CoursePlanOption` 或 `CourseGDD`，不能直接改生成后源码。
- [x] 修改题目时必须重新校验答案、解析、错因和提示。
- [x] 关闭视频时自动更新 assetPlan 和 validationPlan。

验证：

- [x] 改讲解深度后，缺少例题或迁移任务会失败。
- [x] 替换题目但缺少 explanation 会失败。
- [x] 禁用视频后 CourseGDD 中不能再有必需视频资产。

可并行任务：

- 任务 4A：修订模型 Agent 负责 `courseRevision.ts`。
- 任务 4B：工具 Agent 负责 `revise-course-plan`。
- 任务 4C：SDK Agent 负责 `reviseCoursePlan.ts`。

### 阶段 5：学习报告深化与课程续作

新增：

- [x] `packages/core/src/course/product/nextCoursePlanner.ts`
- [x] `packages/core/src/tools/generate-next-course-spec.ts`
- [x] `packages/sdk-typescript/src/course/createCourseGame.ts`

实现要求：

- [x] 从 1.0 的 `LearningReport` 提取掌握点、错因、提示使用情况和下一步目标。
- [x] 输出新的 `CourseSpec`，可以是下一节、强化练习或同主题新玩法。
- [x] 下一课必须继承必要偏好，但不能盲目重复相同玩法。
- [x] 如果学习状态不足，回退到输入向导追问。

验证：

- [x] 错因“单位混淆”能生成单位换算或面积单位强化课程。
- [x] 用户偏好太空风格能被继承，但允许新主题变化。
- [x] 学习状态缺失时不生成课程，返回追问。

可并行任务：

- 任务 5A：报告解析 Agent 负责 LearningReport 到 LearningState。
- 任务 5B：续作 Agent 负责 `nextCoursePlanner.ts`。
- 任务 5C：SDK Agent 负责 `createCourseGame.ts` 产品化 wrapper。

### 阶段 6：家长控制与失败恢复

新增：

- [x] `packages/core/src/course/product/guardianPolicy.ts`
- [x] `packages/core/src/course/product/generationRecovery.ts`
- [x] `agent-test/docs/product/mvp2-guardian-policy.md`

实现要求：

- [x] 家长控制必须影响 CourseSpec 生成、资产计划和发布校验。
- [x] 失败恢复记录当前阶段、失败原因、可复用产物、可降级选项。
- [x] 支持从方案确认、CourseGDD、资产生成、TTS、验证失败处恢复。
- [x] 重试必须有次数和成本上限。

验证：

- [x] 超过家长设置时长的课程被拒绝或缩短。
- [x] 禁用视频时不会调用视频资产生成。
- [x] TTS 失败后可降级为字幕模式并继续验证。
- [x] 连续失败超过上限后返回可解释错误。

可并行任务：

- 任务 6A：家长控制 Agent 负责 `guardianPolicy.ts`。
- 任务 6B：恢复 Agent 负责 `generationRecovery.ts`。
- 任务 6C：集成测试 Agent 负责失败恢复场景。

## 端到端验证矩阵

| 验证层   | 验证目标                                      | 推荐落点                                             |
| -------- | --------------------------------------------- | ---------------------------------------------------- |
| 输入向导 | 自然语言能补齐 CourseSpec，缺高影响字段会追问 | `course-product-intake.test.ts`                      |
| 风格预览 | 生成前能输出风格板且不触发完整素材生成        | `stylePreview.test.ts`                               |
| 方案确认 | 评分、风险、成本、深度差异可展示              | `revise-course-plan.test.ts`                         |
| 记忆隔离 | 偏好记忆和学习状态互不污染                    | `preferenceProfile.test.ts`、`learningState.test.ts` |
| 课程修订 | 修改结构化计划后重新校验                      | `courseRevision.test.ts`                             |
| 课程续作 | LearningReport 能生成下一课 CourseSpec        | `course-product-next-course.test.ts`                 |
| 家长控制 | 时长、上传图片、视频、消费限制生效            | `guardianPolicy.test.ts`                             |
| 失败恢复 | 中断、重试、降级、复用上次方案                | `generationRecovery.test.ts`                         |

## 不做范围

- 不做模板市场。
- 不做多人社交。
- 不做班级系统。
- 不做开放插件。
- 不做大规模知识图谱。

## 成功标准

- 用户可以不写复杂 prompt，通过输入向导完成生成。
- 用户能在生成前理解方案差异，并能调整课程深度。
- 第二次生成能复用学生偏好和学习状态。
- 学习报告能自然导向下一节课程。
- 家长控制和隐私最小化成为默认流程。
