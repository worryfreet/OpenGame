# MVP 3.0 一句话高质量生成与核心生成能力跃迁落地方案

## 定位

MVP 3.0 聚焦一个核心成功标准：

> 用户一句话输入，就能稳定生成足够精彩、足够有教学深度、足够可玩的游戏化课程。

MVP 1.0 解决受控生成，MVP 2.0 解决 ToC 产品体验，MVP 3.0 解决生成质量跃迁。它要把“用户填写多个字段后能生成”升级为“用户一句话表达后，系统主动补全、创作、评审、修复，并生成高质量课程”。

## 依赖的 1.0/2.0 前置能力

- 1.0 的 `CourseSpec`、`CoursePlanOption`、`CourseGDD`、课程模板和验证工具稳定。
- 2.0 的输入向导、偏好记忆、学习状态、风格预览、课程续作可用。
- 已有跨学科生成基准用例和学习报告。
- 已有生成失败恢复、家长控制和成本上限。

## 核心目标

- 从表单生成升级到一句话生成。
- 从模板选择升级到 AI 主动创造最优玩法组合。
- 从能玩升级到精彩：节奏、惊喜、角色、反馈、关卡变化更强。
- 从可用课程升级到高质量教学：讲解深、反馈准、迁移任务自然嵌入。
- 从单次生成成功升级到稳定高成功率：自动评测、自动修复、模板经验沉淀。

## 推荐新增目录与文件

```text
packages/core/src/course/one-shot/
  promptToCourseSpec.ts
  clarificationPolicy.ts
  intentConfidence.ts

packages/core/src/course/quality/
  excitementRubric.ts
  courseQualityScorer.ts
  visualConsistencyScorer.ts
  pedagogyReviewer.ts
  gameDirector.ts
  autoRepairLoop.ts
  goldenCases.ts

packages/core/src/course/experience/
  templateExperienceStore.ts
  successfulPatternIndex.ts
  failurePatternIndex.ts

packages/core/src/tools/
  generate-one-shot-course-plan.ts
  score-course-quality.ts
  repair-course-generation.ts
  record-course-experience.ts

agent-test/docs/quality/
  one-shot-generation.md
  excitement-rubric.md
  quality-gates.md
  auto-repair-loop.md

agent-test/course-golden-cases/
  math/
  chinese/
  english/
  science/
  general/

integration-tests/
  course-one-shot-generation.test.ts
  course-quality-gates.test.ts
  course-auto-repair.test.ts
  course-golden-cases.test.ts
```

## 核心数据模型

```ts
interface OneShotCourseRequest {
  text: string;
  profileId?: string;
  preferenceProfile?: StudentPreferenceProfile;
  learningState?: LearningState;
  guardianPolicy?: GuardianPolicy;
}

interface PromptToCourseSpecResult {
  courseSpec?: CourseSpec;
  confidence: number;
  inferredFields: string[];
  assumptions: string[];
  requiredClarifications: IntakeQuestion[];
  blockedReasons: string[];
}

interface ExcitementScore {
  goalClarity: number;
  gameLoopStrength: number;
  surpriseAndProgression: number;
  feedbackRichness: number;
  roleAndWorldAppeal: number;
  challengeCurve: number;
  total: number;
}

interface CourseQualityScore {
  pedagogyDepth: number;
  gameplayExcitement: number;
  ageFit: number;
  visualConsistency: number;
  playabilityRisk: number;
  safety: number;
  total: number;
  blockingIssues: string[];
  improvementActions: string[];
}

interface AutoRepairAttempt {
  attemptId: string;
  sourceStage: 'plan' | 'gdd' | 'asset' | 'tts' | 'build' | 'browser' | 'quality';
  issue: string;
  action: string;
  result: 'fixed' | 'degraded' | 'failed';
  costEstimate: number;
}

interface CourseExperienceRecord {
  coursePackageId: string;
  courseSpecSummary: string;
  gameplayPattern: string;
  qualityScore: CourseQualityScore;
  validationReportSummary: string;
  reusablePatterns: string[];
  failurePatterns: string[];
}
```

## 能力路线

| 能力 | 做法 | 带来的效果 | 复杂度 | 必要性 |
| --- | --- | --- | --- | --- |
| 一句话意图解析 | 从一句话中推断年级、学科、目标、风格、课程深度和互动偏好；不足时只问关键问题 | 输入极简，接近最终理想体验 | 高 | 必须 |
| 关键追问机制 | 只在缺少高影响信息时追问，例如年级、学科、深度或风格冲突 | 避免表单化回退，同时保证生成质量 | 中 | 必须 |
| 自动课程深度补全 | 自动补前置知识、误区、例题、迁移任务和反馈策略 | 避免一句话输入导致浅层内容 | 高 | 必须 |
| 玩法创造器 | 不只选模板，而是组合剧情、机制、反馈、关卡结构和学习任务 | 课程更精彩，突破换皮题库 | 高 | 必须 |
| 生成导演 Agent | 专门控制节奏、奖励、悬念、角色成长、反馈密度和关卡变化 | 提升游戏感和持续吸引力 | 高 | 重要 |
| 课程评审 Agent | 专门审教学目标、讲解深度、答案正确性、错因反馈和年级适配 | 提升教学质量和家长信任 | 高 | 必须 |
| 生成质量评分器 | 对趣味性、教学深度、适龄性、节奏、视觉完整度和可玩性打分 | 生成前后都有门禁 | 高 | 必须 |
| 自动修复循环 | 低分方案自动重写，运行失败自动修复，素材不合格自动替换 | 提升成功率和稳定性 | 高 | 必须 |
| 模板经验库 | 保存成功课程的结构、玩法、素材策略、失败原因和修复方式 | 越用越强，减少从零生成 | 中-高 | 重要 |
| 精彩度基准集 | 建立跨学科、跨年级、跨风格 golden cases，并定义精彩度指标 | 让“精彩”可测试、可回归 | 中 | 必须 |
| 高质量素材一致性 | 对角色、背景、UI、过场视频、TTS 情绪做一致性约束和复核 | 让课程看起来像完整作品，而不是拼贴 | 高 | 重要 |
| 多轮自我改稿 | 在用户确认前自动进行方案重写、节奏增强和教学补强 | 提高首版方案质量 | 高 | 重要 |

## 关键质量指标

- 教学深度：是否有前置诊断、概念层、误区、例题、迁移任务。
- 游戏精彩度：是否有明确目标、状态变化、奖励节奏、关卡变化、角色反馈。
- 风格一致性：角色、背景、UI、音频和视频是否统一。
- 适龄性：阅读量、操作复杂度、反馈方式是否适合年级。
- 可玩性：能否稳定开始、推进、失败、胜利、重玩和结算。
- 生成稳定性：是否能在失败时自动修复或降级。

## 阶段 TODO

### 阶段 0：精彩度标准与 golden cases

新增：

- [ ] `packages/core/src/course/quality/excitementRubric.ts`
- [ ] `packages/core/src/course/quality/goldenCases.ts`
- [ ] `agent-test/docs/quality/excitement-rubric.md`
- [ ] `agent-test/course-golden-cases/*`

实现要求：

- [ ] 定义“精彩课程”的结构化评价：目标清晰、循环强度、惊喜推进、反馈丰富、世界吸引力、挑战曲线。
- [ ] 建立 20-30 个跨学科、跨年级、跨风格 golden cases。
- [ ] 每个 golden case 包含一句话输入、期望 CourseSpec、期望玩法方向、最低质量分。
- [ ] golden cases 不用于直接训练，只作为回归和评测基准。

验证：

- [ ] golden case schema 校验。
- [ ] 每个学科至少 3 个 case。
- [ ] 每个年级段至少 2 个 case。

并行性：

- 任务 0A：课程 Agent 负责学科和年级覆盖。
- 任务 0B：游戏设计 Agent 负责精彩度 rubric。
- 任务 0C：测试 Agent 负责 golden case schema。

### 阶段 1：一句话意图解析

新增：

- [ ] `packages/core/src/course/one-shot/promptToCourseSpec.ts`
- [ ] `packages/core/src/course/one-shot/clarificationPolicy.ts`
- [ ] `packages/core/src/course/one-shot/intentConfidence.ts`
- [ ] `packages/core/src/tools/generate-one-shot-course-plan.ts`

实现要求：

- [ ] 输入 `OneShotCourseRequest`，输出 `PromptToCourseSpecResult`。
- [ ] 解析结果必须落到 MVP 1.0 的 `CourseSpec`，不能绕过受控链路。
- [ ] 缺少年级、学科、深度冲突或家长策略冲突时进入关键追问。
- [ ] 低影响字段使用偏好记忆和默认值补齐，并记录 assumptions。

验证：

- [ ] “给我做个太空风格的面积游戏课”如果缺少年级，必须追问。
- [ ] “四年级英语单词闯关，像魔法学院但不要太幼稚”能生成 CourseSpec。
- [ ] 输入包含知名 IP 或不适龄元素时被清洗或拒绝。

可并行任务：

- 任务 1A：解析 Agent 负责 `promptToCourseSpec.ts`。
- 任务 1B：追问 Agent 负责 `clarificationPolicy.ts`。
- 任务 1C：测试 Agent 负责 golden case 输入测试。

### 阶段 2：玩法创造器与生成导演

新增：

- [ ] `packages/core/src/course/quality/gameDirector.ts`
- [ ] `agent-test/docs/quality/one-shot-generation.md`

实现要求：

- [ ] 在 `CoursePlanOption` 之上新增玩法增强层，组合剧情、机制、反馈、关卡结构。
- [ ] 输出必须仍落到 `course_ui/course_grid/course_td` 或它们的组合，不开放任意模板。
- [ ] 生成导演负责节奏：导入、第一次成功、第一次挑战、反馈强化、阶段目标、结算复盘。
- [ ] 不允许知识点只作为答题门槛，必须影响游戏状态。

验证：

- [ ] 同一主题至少能生成稳定型、平衡型、精彩型三个不同强度方案。
- [ ] 每个方案都有状态变化和关卡推进。
- [ ] 检查不出现“答对加分但知识点不影响玩法”的换皮方案。

可并行任务：

- 任务 2A：玩法 Agent 负责玩法组合规则。
- 任务 2B：导演 Agent 负责节奏和反馈规则。
- 任务 2C：校验 Agent 负责换皮检测。

### 阶段 3：课程评审与质量评分

新增：

- [ ] `packages/core/src/course/quality/courseQualityScorer.ts`
- [ ] `packages/core/src/course/quality/pedagogyReviewer.ts`
- [ ] `packages/core/src/course/quality/visualConsistencyScorer.ts`
- [ ] `packages/core/src/tools/score-course-quality.ts`
- [ ] `agent-test/docs/quality/quality-gates.md`

实现要求：

- [ ] 质量评分输出 `CourseQualityScore`，包含教学深度、游戏精彩度、适龄性、视觉一致性、可玩风险、安全。
- [ ] 课程评审 Agent 给出结构化 `blockingIssues` 和 `improvementActions`。
- [ ] 质量门禁分生成前和生成后：生成前拦低质方案，生成后拦运行/素材/课程问题。
- [ ] 低于门槛时不能进入高成本资产生成。

验证：

- [ ] 浅层问答方案在 `pedagogyDepth` 上失败。
- [ ] 没有状态变化的方案在 `gameplayExcitement` 上失败。
- [ ] 角色和 UI 风格冲突时 `visualConsistency` 降分。

可并行任务：

- 任务 3A：教学评审 Agent 负责 `pedagogyReviewer.ts`。
- 任务 3B：精彩度 Agent 负责 `courseQualityScorer.ts`。
- 任务 3C：视觉 Agent 负责 `visualConsistencyScorer.ts`。
- 任务 3D：工具 Agent 负责 `score-course-quality.ts`。

### 阶段 4：自动修复循环

新增：

- [ ] `packages/core/src/course/quality/autoRepairLoop.ts`
- [ ] `packages/core/src/tools/repair-course-generation.ts`
- [ ] `agent-test/docs/quality/auto-repair-loop.md`

实现要求：

- [ ] 修复对象包括 plan、gdd、asset、tts、build、browser、quality。
- [ ] 每次修复记录 `AutoRepairAttempt`。
- [ ] 必须有最大轮数、最大成本和可降级路径。
- [ ] 修复失败时输出明确失败原因和可给用户的选择。

验证：

- [ ] 低质量 plan 自动重写一次并重新评分。
- [ ] 缺少素材时自动替换或降级。
- [ ] build 失败时进入代码修复流程，但超过上限会停止。
- [ ] TTS 失败时降级为字幕，不阻断课程包。

可并行任务：

- 任务 4A：修复策略 Agent 负责 `autoRepairLoop.ts`。
- 任务 4B：工具 Agent 负责 `repair-course-generation.ts`。
- 任务 4C：测试 Agent 负责失败注入 fixtures。

### 阶段 5：模板经验库

新增：

- [ ] `packages/core/src/course/experience/templateExperienceStore.ts`
- [ ] `packages/core/src/course/experience/successfulPatternIndex.ts`
- [ ] `packages/core/src/course/experience/failurePatternIndex.ts`
- [ ] `packages/core/src/tools/record-course-experience.ts`

实现要求：

- [ ] 记录成功课程的结构、玩法、素材策略、质量分、验证结果。
- [ ] 记录失败课程的失败阶段、失败原因、修复方式和是否可复用。
- [ ] 经验库只保存结构化摘要，不保存学生隐私。
- [ ] 生成新方案时可以检索相近成功模式和失败模式。

验证：

- [ ] 成功课程能写入 successful pattern。
- [ ] 失败课程能写入 failure pattern。
- [ ] 隐私字段不会进入经验库。
- [ ] 相似 CourseSpec 能检索到相关模式。

可并行任务：

- 任务 5A：存储 Agent 负责 `templateExperienceStore.ts`。
- 任务 5B：成功索引 Agent 负责 `successfulPatternIndex.ts`。
- 任务 5C：失败索引 Agent 负责 `failurePatternIndex.ts`。
- 任务 5D：隐私测试 Agent 负责经验库脱敏测试。

### 阶段 6：一句话生成端到端回归

新增：

- [ ] `integration-tests/course-one-shot-generation.test.ts`
- [ ] `integration-tests/course-quality-gates.test.ts`
- [ ] `integration-tests/course-auto-repair.test.ts`
- [ ] `integration-tests/course-golden-cases.test.ts`

实现要求：

- [ ] 每个 golden case 走完整链路：一句话输入、解析、追问或补全、方案、评分、GDD、生成、验证。
- [ ] 质量门禁失败时不进入资产生成。
- [ ] 自动修复后的课程必须重新评分和验证。
- [ ] 回归测试记录每类失败的原因分布。

验证：

- [ ] golden cases 通过率达到设定阈值。
- [ ] 低质方案拦截率可观测。
- [ ] 自动修复成功率可观测。
- [ ] 成本上限生效。

可并行任务：

- 任务 6A：one-shot 集成 Agent 负责一句话生成测试。
- 任务 6B：quality gates Agent 负责质量门禁测试。
- 任务 6C：repair Agent 负责自动修复测试。
- 任务 6D：metrics Agent 负责通过率和失败原因统计。

## 端到端验证矩阵

| 验证层 | 验证目标 | 推荐落点 |
| --- | --- | --- |
| 一句话解析 | 极简输入能转成 CourseSpec 或关键追问 | `promptToCourseSpec.test.ts` |
| 追问策略 | 只追问高影响缺失字段 | `clarificationPolicy.test.ts` |
| 精彩度 | 方案有目标、循环、惊喜、反馈、挑战曲线 | `excitementRubric.test.ts` |
| 教学质量 | 深度、误区、例题、迁移、反馈完整 | `pedagogyReviewer.test.ts` |
| 质量门禁 | 低质量方案不能进入高成本生成 | `course-quality-gates.test.ts` |
| 自动修复 | plan/gdd/asset/tts/build/browser/quality 可修复或降级 | `course-auto-repair.test.ts` |
| 经验库 | 成功/失败模式可记录、检索且脱敏 | `templateExperienceStore.test.ts` |
| golden cases | 跨学科、跨年级、跨风格稳定回归 | `course-golden-cases.test.ts` |

## 不做或延后

- 开放模板市场。
- 第三方插件生态。
- 大规模班级协作。
- 多端商业发行。
- 陌生人社交。

这些都要等“一句话高质量生成”稳定后再考虑。

## 成功标准

- 用户一句话输入后，系统大多数情况下无需长表单即可生成可确认方案。
- 生成方案在教学深度、游戏精彩度、适龄性、风格一致性上都有结构化评分。
- 低质量方案能自动重写，不直接进入高成本生成。
- 运行失败或素材失败能自动修复或降级。
- golden cases 回归通过，证明生成质量不是偶然结果。
