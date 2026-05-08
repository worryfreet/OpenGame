# MVP 1.0 受控生成闭环落地方案

## 定位

MVP 1.0 是 ToC 个性化游戏化课程生成系统的第一阶段产品与工程落地方案。它不追求完整商业化前端，也不追求一句话高质量生成，而是先证明一条可控、可验证、可扩展的核心生成链路：

```text
结构化课程输入
  -> 课程讲解深度确认
  -> 3 个游戏化课程方案
  -> 用户确认方案
  -> Course GDD
  -> 课程模板生成
  -> 多模态资产与 TTS
  -> 可运行 H5 游戏
  -> 自动验证与学习报告
```

MVP 1.0 的目标是跑通“全学科入口 + 深度课程规划 + 受控玩法族 + 可运行游戏 + 自动验证”。后续 MVP 2.0 负责产品化体验与持续使用，MVP 3.0 负责一句话高质量生成和核心生成质量跃迁。

## 代码级现状判断

OpenGame 当前是 CLI 代理工具链，不是传统 Web 应用。核心链路如下：

```text
scripts/start.js
  -> packages/cli/src/gemini.tsx
  -> packages/cli/src/nonInteractiveCli.ts / nonInteractive/session.ts
  -> packages/core/src/config/config.ts:createToolRegistry()
  -> packages/core/src/tools/*
  -> agent-test/templates/* + agent-test/docs/*
```

现有游戏生成链路的关键模块：

| 模块                                              | 当前作用                                                                                       | 二创处理                                                                                |
| ------------------------------------------------- | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `packages/core/src/tools/game-type-classifier.ts` | 按物理视角分类为 `platformer/top_down/grid_logic/tower_defense/ui_heavy`，并提示复制模板和文档 | 不直接改成课程分类器；新增课程玩法分类工具，保留原工具服务普通游戏生成                  |
| `packages/core/src/tools/generate-gdd.ts`         | 读取 `agent-test/docs/gdd/core.md`、模块 `design_rules.md`、`template_api.md` 后生成 Game GDD  | 新增 `generate_course_plan` 和 `generate_course_gdd`，Course GDD 再映射到 Game GDD      |
| `packages/core/src/tools/generate-assets.ts`      | 生成 background/image/animation/audio/tileset，写入 `public/assets/asset-pack.json`            | 保留为图片/普通音效底座；新增课程资产计划和 TTS manifest，不把讲解音频混入普通 SFX 语义 |
| `packages/core/src/services/providerConfig.ts`    | 按 reasoning/image/video/audio 四种 modality 解析供应商配置                                    | 复用；新增 TTS 本地服务配置不应塞入现有 audio provider，单独做 `courseTtsService`       |
| `agent-test/templates/modules/ui_heavy`           | 已有 Chapter/Battle/Quiz/Dialog/Card/Ending，最适合课程讲解与答题互动                          | 第一优先改造成课程模板族基础                                                            |
| `agent-test/templates/modules/grid_logic`         | 网格、回合、实体、格子交互，适合分类、排序、步骤推理                                           | 第二优先，承接数学/科学/语文排序推理                                                    |
| `agent-test/templates/modules/tower_defense`      | 路径、波次、塔、经济系统，适合高年级复习类游戏                                                 | 第三优先，先做课程包装，不先重写核心                                                    |
| `agent-test/docs/debug_protocol.md`               | 约束生成后 build/test/dev 和常见错误诊断                                                       | 扩展课程专用验证协议                                                                    |

## 核心产品判断

- 学科入口不限制：MVP 支持数学、语文、英语、科学、道法/常识、艺术/综合等全学科输入。
- 玩法复杂度受控：每个学科先映射到有限玩法族，避免任意学科任意玩法直接生成。
- 课程深度必须结构化确认：不能只生成表层讲解和几道题；必须确认讲解层级、例题层级、迁移任务和评价深度。
- 生成前必须方案确认：先生成多个方案和评分，再由学生/家长确认，确认后才进入高成本多模态生成。
- ToC 必须家长控制：学生体验直接面向学生，但账号、时长、付费、敏感信息和发布边界由家长/监护人控制。

## 当前版本范围

### 目标

- 支持全学科输入，但只开放 `course_ui`、`course_grid`、`course_td` 三类受控课程模板。
- 在生成前输出 3 个课程游戏方案，并让用户确认一个方案后再继续。
- 支持结构化课程讲解深度确认，避免课程内容停留在表层。
- 支持图片、普通音效、本地 TTS；视频只做可选开场或章节过场。
- 输出可运行 H5 游戏和基础学习报告。
- 主要使用 headless/SDK 跑通闭环，不优先建设完整 ToC 商业前端。

### 不做

- 不做模板市场。
- 不做班级、学校、教师管理后台。
- 不做开放插件生态。
- 不做陌生人社交或排行榜。
- 不做任意玩法的开放式游戏生成。
- 不把视频作为必需能力，视频失败必须能降级。

### 成功标准

- 5 个跨学科基准用例可生成、可 build、可 test、可浏览器自动走通第一轮互动。
- `standard/deep/challenge` 课程不会退化为表层问答。
- 每个学习目标都有讲解、互动、反馈和评价闭环。
- TTS、图片、视频、普通音效任一失败时，都有清晰降级路径。
- 课程包验证工具能拦截缺少讲解、缺少反馈、场景未注册、资产 key 不一致、不适龄内容等问题。

## 课程讲解深度模型

新增 `ExplanationDepthSpec`，作为生成前确认项和生成后验收项。

```ts
interface ExplanationDepthSpec {
  depthLevel: 'intro' | 'standard' | 'deep' | 'challenge';
  priorKnowledgeCheck: boolean;
  conceptLayers: Array<{
    concept: string;
    whyItMatters: string;
    misconceptionToAddress: string[];
    representation:
      | 'story'
      | 'visual_model'
      | 'formula'
      | 'experiment'
      | 'case'
      | 'dialogue';
  }>;
  examplePlan: {
    workedExamples: number;
    guidedPractice: number;
    independentChallenges: number;
    transferTasks: number;
  };
  feedbackDepth:
    | 'answer_only'
    | 'short_reason'
    | 'step_by_step'
    | 'socratic_hint';
  masteryEvidence: string[];
}
```

课程深度确认规则：

| 深度        | 适用场景             | 最低要求                                               |
| ----------- | -------------------- | ------------------------------------------------------ |
| `intro`     | 初次接触、低年级导入 | 1 个核心概念、1 个直观例子、2-3 个即时练习             |
| `standard`  | 常规学习             | 前置诊断、2-3 个概念层、2 个例题、3-5 个练习、错因反馈 |
| `deep`      | 系统学习或薄弱点补强 | 多表征讲解、常见误区、分步引导、迁移任务、学习报告     |
| `challenge` | 高年级拓展           | 开放问题、策略选择、多路径解法、反思复盘               |

验收硬规则：

- 每个 `learningGoal` 必须至少对应一个 `conceptLayer`、一个互动任务和一个评价点。
- `standard/deep/challenge` 不允许只有选择题；必须包含讲解、示例、互动练习、反馈四段。
- 题目 explanation 不能只写“答案是 X”，至少要说明关键推理步骤。
- 学生错误时必须给“错因类型”和“下一步提示”，不能只给 wrong/correct。

## 推荐新增目录与文件

主要开发目录按最小侵入原则分三层：

```text
packages/core/src/course/
  schemas.ts
  subjectTaxonomy.ts
  gameplayMapping.ts
  planScoring.ts
  validation.ts
  courseGddMapper.ts
  tts/
    lessoninTtsService.ts
    narrationManifest.ts

packages/core/src/tools/
  generate-course-plan.ts
  generate-course-gdd.ts
  validate-course-package.ts

agent-test/docs/course/
  course_gdd.md
  explanation_depth.md
  gameplay_mapping.md
  asset_manifest.md
  validation_protocol.md

agent-test/templates/modules/course_ui/
  src/scenes/
  src/systems/
  src/ui/
  src/gameConfig.json

agent-test/templates/modules/course_grid/
  src/...

agent-test/templates/modules/course_td/
  src/...

agent-test/course-fixtures/

integration-tests/
  course-generation.test.ts
```

不建议第一阶段直接修改 `ui_heavy`、`grid_logic`、`tower_defense` 原模板。正确方式是复制或组合出 `course_ui`、`course_grid`、`course_td`，里面复用原模板代码和接口，避免破坏普通游戏生成能力。

## 核心数据模型

```ts
interface StudentProfile {
  grade: 1 | 2 | 3 | 4 | 5 | 6;
  age?: number;
  readingLevel?: 'low' | 'medium' | 'high';
  interests: string[];
  weakPoints?: string[];
  preferredInteraction?: string[];
  guardianLimits?: {
    maxSessionMinutes: number;
    allowUploadedImages: boolean;
    allowGeneratedVideo: boolean;
    contentStrictness: 'normal' | 'strict';
  };
}

interface StyleSpec {
  theme: string;
  palette: string[];
  referenceImages?: string[];
  visualMood: string;
  characterStyle: string;
  uiDensity: 'low' | 'medium' | 'high';
  forbidden: string[];
}

interface CourseSpec {
  subject: string;
  topic: string;
  learningGoals: string[];
  durationMinutes: number;
  studentProfile: StudentProfile;
  styleSpec: StyleSpec;
  explanationDepth: ExplanationDepthSpec;
}

interface CoursePlanOption {
  id: string;
  title: string;
  courseArchetype: 'course_ui' | 'course_grid' | 'course_td';
  gameplayType: string;
  learningLoop: string[];
  scenePlan: string[];
  assessmentPoints: string[];
  assetComplexity: 'low' | 'medium' | 'high';
  score: {
    learningFit: number;
    explanationDepthFit: number;
    fun: number;
    ageFit: number;
    implementationStability: number;
    cost: number;
    safety: number;
  };
  recommendationReason: string;
  risks: string[];
}

interface CourseGDD {
  courseSpec: CourseSpec;
  selectedPlan: CoursePlanOption;
  lessonUnits: LessonUnit[];
  interactionSpecs: InteractionSpec[];
  assessmentSpec: AssessmentSpec;
  assetPlan: CourseAssetPlan;
  narrationPlan: NarrationPlan;
  validationPlan: ValidationPlan;
}
```

## 学科到玩法族映射

| 学科      | 默认玩法族                         | 首批落地模板                            | 不建议首批支持       |
| --------- | ---------------------------------- | --------------------------------------- | -------------------- |
| 数学      | 闯关、网格、经营建造、塔防         | `course_ui`、`course_grid`、`course_td` | 开放物理沙盒         |
| 语文      | 剧情选择、阅读推理、排序、词语收集 | `course_ui`、`course_grid`              | 长篇自由写作自动评分 |
| 英语      | 听说对话、单词配对、剧情任务       | `course_ui`、`course_grid`              | 开放语音对话社交     |
| 科学      | 实验模拟、分类观察、流程推演       | `course_grid`、`course_ui`              | 高仿真实验物理引擎   |
| 道法/常识 | 情境选择、案例判断、任务地图       | `course_ui`                             | 敏感现实争议内容     |
| 艺术/综合 | 创作任务、节奏互动、作品收集       | `course_ui`                             | 复杂音游谱面生成     |

## 基于玩法分类的 MVP 1.0 深度优化

### 问题判断

当前 MVP 1.0 已经跑通“结构化输入 -> 方案确认 -> Course GDD -> 模板生成 -> 资产/TTS -> 验证”的闭环，但玩法选择仍偏粗：

- `subjectTaxonomy.ts` 和 `gameplayMapping.ts` 主要按学科映射模板族，无法区分同一学科内的不同知识形态。
- `CoursePlanOption.gameplayType` 是字符串，缺少玩法超类、核心动作、学习阶段、反馈机制和模板承载方式。
- `CourseGDD.interactionSpecs.type` 只覆盖少量互动类型，容易把深层目标退化成普通选择题。
- `validate_course_package` 当前能校验课程闭环，但还不能判断“游戏操作是否真的就是学习动作”。

这会导致生成游戏看起来只是换主题、换题干，而不是围绕学习目标改变玩法。

### 优化原则

- 学科不是玩法决定器。学科只提供素材语境，玩法由学习目标、学习阶段和学生核心动作决定。
- 不先扩成大量完整模板。MVP 1.0 继续保留 `course_ui/course_grid/course_td` 三个稳定模板族，在模板内部扩展微玩法能力包。
- 玩法必须结构化。生成链路不能只靠 prompt 要求“更有趣”，而要让每个 learningGoal 都落到可校验的 `GoalGameplayPlan`。
- 反馈必须暴露误区。玩法选择优先考虑哪种操作能让学生的错误自然显现，并能给出下一步提示。
- 多模态为教学服务。图片、动画、视频、TTS、音效都围绕课程风格和反馈后果组织，不作为孤立素材清单。

### 优化后的目标链路

```text
CourseSpec
  -> GoalGameplayIntent[]：拆出每个学习目标的阶段、知识形态、核心动作、误区和证据
  -> GameplayPatternCatalog：从玩法分类库选择 2-3 个候选玩法
  -> CoursePlanOption[]：聚合成稳定型、平衡型、创意型方案
  -> 用户确认 selectedPlanId
  -> CourseGDD：写入结构化玩法计划、互动证据、反馈后果和资产意图
  -> courseContent.json：模板读取微玩法配置
  -> 多模态资产/TTS/视频过场
  -> validate_course_package：验证课程闭环、玩法有效性、反单调和多模态降级
```

### 推荐新增核心模型

```ts
type LearningStage =
  | 'discover'
  | 'understand'
  | 'fluency'
  | 'transfer'
  | 'creation'
  | 'validation';

type GameplaySuperclass =
  | 'information_organization'
  | 'sequence_reasoning'
  | 'quantity_space_system'
  | 'experiment_simulation'
  | 'action_fluency'
  | 'language_communication'
  | 'diagnosis_verification'
  | 'strategy_roleplay'
  | 'creation_project'
  | 'composite_pattern';

interface GoalGameplayIntent {
  learningGoal: string;
  stage: LearningStage;
  knowledgeForm:
    | 'concept_boundary'
    | 'fact_memory'
    | 'structure'
    | 'process'
    | 'quantity_relation'
    | 'variable_rule'
    | 'logic_proof'
    | 'expression'
    | 'debugging'
    | 'value_tradeoff'
    | 'project_output';
  coreAction: string;
  misconceptionToExpose: string[];
  masteryEvidence: string[];
}

interface GameplayPattern {
  id: string;
  superclass: GameplaySuperclass;
  title: string;
  coreActions: string[];
  suitableStages: LearningStage[];
  supportedArchetypes: CourseArchetype[];
  interactionTypes: string[];
  feedbackMode:
    | 'instant_reason'
    | 'visual_consequence'
    | 'step_feedback'
    | 'socratic_hint'
    | 'project_rubric';
  assetNeeds: Array<
    'background' | 'cards' | 'icons' | 'character' | 'sfx' | 'tts' | 'video'
  >;
  templateReadiness: 'ready' | 'needs_renderer' | 'future_template';
}

interface GoalGameplayPlan {
  learningGoal: string;
  intent: GoalGameplayIntent;
  selectedPatternId: string;
  fallbackPatternId: string;
  courseArchetype: CourseArchetype;
  interactionType: string;
  successEvidence: string;
  failureConsequence: string;
}
```

旧字段 `CoursePlanOption.gameplayType` 可以继续保留用于展示和兼容，但方案评分、GDD 生成和验证应优先读取 `GoalGameplayPlan`。

### 玩法超类到现有模板的承载关系

| 玩法超类           | MVP 1.0 优先承载                    | 需要补强的微玩法                                 |
| ------------------ | ----------------------------------- | ------------------------------------------------ |
| 信息识别与组织     | `course_ui`、`course_grid`          | 找目标、分类分箱、卡片配对、证据配对、标注纠错   |
| 序列逻辑与推理     | `course_grid`、`course_ui`          | 步骤排序、时间线、流程接线、证据链、证明补全     |
| 数量空间与系统建构 | `course_grid`、`course_td`          | 等式平衡、坐标定位、路线规划、模块装配、节点网络 |
| 实验模拟与变量调参 | `course_grid`、后续 `course_lab`    | 滑杆调参、A/B 对比、控制变量、多轮迭代           |
| 动作熟练与即时反应 | `course_td`、后续 `course_action`   | 快问快答、错题回炉、节奏复现、限时识别           |
| 语言表达与沟通     | `course_ui`                         | 改写润色、句式构造、对话选择、摘要、论证表达     |
| 诊断调试与验证     | `course_grid`、`course_ui`          | 故障定位、原因归因、修复操作、回归测试           |
| 策略经营与角色决策 | `course_td`、`course_ui`            | 资源分配、风险收益、路线调度、多角色决策         |
| 创作生产与项目制   | `course_ui`、后续 `course_creation` | 分镜板、画布排版、规则描述、作品验收             |
| 复合玩法模式       | 三类模板组合                        | 观察+分类、调参+对比、拼装+测试、创作+验收       |

`course_lab`、`course_action`、`course_creation` 不进入 MVP 1.0 第一优先实现。只有当现有三类模板无法稳定承载某类玩法，并且已有足够 fixture 证明需求高频时，再拆出新模板。

### 生成工具优化点

- `mapSubjectToGameplayCandidates()` 应升级为按目标映射：先生成 `GoalGameplayIntent[]`，再根据玩法分类库选 pattern。
- `scoreCoursePlan()` 增加三类评分：`gameplayFit`、`variety`、`feedbackConsequence`。
- `generate_course_plan` 输出的 3 个方案必须解释每个 learningGoal 为什么选择该玩法，而不是只给模板名。
- `generate_course_gdd` 必须把玩法 pattern 写入 `lessonUnits`、`interactionSpecs` 或新增 `goalGameplayPlans`，供 mapper 和模板读取。
- `courseGddMapper.ts` 写入 `courseContent.json` 时保留玩法结构，避免模板只能看到题目和反馈文本。

### 模板优化点

- `course_ui` 重点补强低操作门槛的认知玩法：选择判断、卡片匹配、证据配对、对话沟通、摘要改写、角色决策、作品验收。
- `course_grid` 重点补强结构和过程玩法：分类分箱、步骤排序、流程接线、路径规划、坐标定位、模块装配、简单对比实验。
- `course_td` 重点补强复习和策略玩法：错题回炉、波次复习、资源分配、风险收益选择、策略复盘。
- 所有微玩法必须通过 `courseContent.json` 配置驱动，不能把题目、答案和错因硬编码进多个生成文件。

### 多模态优化点

MVP 1.0 应在 `StyleSpec` 和 `assetPlan` 之间增加轻量风格导演层：

- 生成前确认角色、场景、UI、配色、动效、音效、TTS 情绪和视频过场的一致方向。
- 图片资产不只生成背景，还要覆盖概念卡、反馈图标、角色表情、关键道具和 UI 状态。
- 音效要绑定学习反馈：正确、错因、提示、阶段完成、风险上升、作品通过等状态都应有明确听觉反馈。
- 视频只做章节转场或导入，不阻断课程主流程；缺视频时必须有静态过场和字幕 fallback。

### 新增质量门禁

- 每个 learningGoal 必须有 `GoalGameplayPlan`，包含学习阶段、核心动作、玩法 pattern、成功证据和失败后果。
- 同一课程不能连续全部使用单选题；除非是明确的熟练训练，否则至少要有两类互动动作。
- `deep/challenge` 至少包含迁移、诊断、策略或创作中的一种玩法。
- 操作动作必须与学习动作一致：学分类就真的分类，学流程就真的排序/接线，学变量就真的调参，学诊断就真的定位/修复。
- 错误反馈必须指出误区，并在场景状态、报告指标或下一步任务中留下痕迹。
- 多模态资产必须服务课程状态：视觉、听觉或字幕反馈至少覆盖关键成功、错误和阶段完成。

## 分阶段工程 TODO

### 阶段 0：代码基线与课程边界

- [ ] 阅读并确认 `packages/core/src/config/config.ts:createToolRegistry()` 的工具注册方式。
- [ ] 阅读 `game-type-classifier.ts`、`generate-gdd.ts`、`generate-assets.ts` 的参数、返回格式和系统提示。
- [ ] 阅读 `agent-test/templates/modules/ui_heavy`、`grid_logic`、`tower_defense` 的 Base 类和 template_api。
- [ ] 确认课程新增能力不改坏普通游戏生成链路。
- [ ] 输出 `agent-test/docs/course/course_gdd.md` 的格式草案。

验证：

- [ ] `rtk npm run typecheck --workspace=packages/core`
- [ ] `rtk npm run test --workspace=packages/core -- --run packages/core/src/tools/game-type-classifier.ts` 或对应相关测试。
- [ ] 文档检查：`.agentdocs/index.md` 有当前任务文档索引。

并行性：阶段 0 不建议并行改代码；可以并行阅读，但需要一个主 Agent 汇总边界。

### 阶段 1：课程 schema 与纯函数校验

新增：

- [ ] `packages/core/src/course/schemas.ts`
- [ ] `packages/core/src/course/subjectTaxonomy.ts`
- [ ] `packages/core/src/course/gameplayMapping.ts`
- [ ] `packages/core/src/course/planScoring.ts`
- [ ] `packages/core/src/course/validation.ts`
- [ ] `packages/core/src/course/*.test.ts`

实现要求：

- [ ] 用 JSON Schema/AJV 风格定义 `CourseSpec`、`ExplanationDepthSpec`、`CoursePlanOption`、`CourseGDD`。
- [ ] `validateCourseSpec()` 校验年级、学科、目标、时长、风格和讲解深度。
- [ ] `mapSubjectToGameplayCandidates()` 返回可用玩法族，不调用 LLM。
- [ ] `scoreCoursePlan()` 对学习匹配、讲解深度、适龄、安全、成本、稳定性打分。

验证：

- [ ] 单元测试覆盖全学科输入。
- [ ] 单元测试覆盖 `standard/deep` 深度缺少例题、误区或迁移任务时失败。
- [ ] 单元测试覆盖上传图片关闭时 `referenceImages` 被拒绝或降级。
- [ ] `rtk npm run test --workspace=packages/core -- course`
- [ ] `rtk npm run typecheck --workspace=packages/core`

可并行任务：

- 任务 1A：schema Agent 负责 `schemas.ts` 和 schema 单测。
- 任务 1B：课程 Agent 负责 `subjectTaxonomy.ts`、`gameplayMapping.ts` 和映射单测。
- 任务 1C：验证 Agent 负责 `validation.ts`、`planScoring.ts` 和深度/安全/成本评分单测。

合并点：三个任务都完成后，由主 Agent 统一检查类型导出、命名和循环依赖。

### 阶段 2：课程方案生成工具

新增：

- [ ] `packages/core/src/tools/generate-course-plan.ts`
- [ ] `packages/core/src/tools/generate-course-plan.test.ts`
- [ ] `packages/core/src/tools/tool-names.ts` 增加 `GENERATE_COURSE_PLAN`
- [ ] `packages/core/src/config/config.ts` 注册 `GenerateCoursePlanTool`
- [ ] `packages/core/src/index.ts` 导出课程模型和工具

实现要求：

- [ ] 工具输入为结构化 `CourseSpec`，不是自由文本 prompt。
- [ ] 工具内部复用 `resolveProviderConfig('reasoning')`。
- [ ] 模型输出必须是 JSON，解析使用 `safeJsonParse`，再走 `validateCoursePlanOptions()`。
- [ ] 至少生成 3 个方案：稳定型、平衡型、创意型。
- [ ] 每个方案必须带 `explanationDepthFit` 和推荐理由。
- [ ] 工具返回内容中必须提示“等待用户确认 selectedPlanId 后再生成 Course GDD”。

验证：

- [ ] mock reasoning API，测试 JSON 正常解析。
- [ ] mock malformed JSON，测试 `safeJsonParse` 或错误返回。
- [ ] 测试浅层方案在 `deep` depthLevel 下评分被压低或拒绝。
- [ ] `rtk npm run test --workspace=packages/core -- generate-course-plan`
- [ ] `rtk npm run lint --workspace=packages/core`

可并行任务：

- 任务 2A：工具 Agent 负责 `generate-course-plan.ts` 主体、参数 schema、ToolNames 和注册。
- 任务 2B：提示 Agent 负责课程方案生成 system prompt，确保输出 JSON 和深度约束。
- 任务 2C：测试 Agent 负责 mock fetch、malformed JSON、深度不足拒绝测试。

合并点：工具注册必须最后统一处理，避免多个 Agent 同时改 `config.ts` 和 `tool-names.ts`。

### 阶段 3：课程 GDD 工具

新增：

- [ ] `packages/core/src/tools/generate-course-gdd.ts`
- [ ] `packages/core/src/tools/generate-course-gdd.test.ts`
- [ ] `agent-test/docs/course/course_gdd.md`
- [ ] `agent-test/docs/course/explanation_depth.md`
- [ ] `agent-test/docs/course/gameplay_mapping.md`
- [ ] `tool-names.ts` 增加 `GENERATE_COURSE_GDD`
- [ ] `config.ts` 注册 `GenerateCourseGDDTool`

实现要求：

- [ ] 输入必须包含 `CourseSpec`、`CoursePlanOption`、用户确认字段。
- [ ] 输出 `CourseGDD`，包含 `lessonUnits`、`interactionSpecs`、`assessmentSpec`、`assetPlan`、`narrationPlan`、`validationPlan`。
- [ ] `lessonUnits` 中每个知识点必须有讲解脚本、互动任务、反馈策略。
- [ ] `assessmentSpec` 中每题必须有答案、解析、错因、提示。
- [ ] `narrationPlan` 输出逐字稿分段，供本地 TTS 批量生成。
- [ ] 工具返回中明确下一步映射到 `course_ui/course_grid/course_td`。

验证：

- [ ] 单测：缺少用户确认拒绝生成。
- [ ] 单测：`deep` 深度下没有误区或迁移任务时校验失败。
- [ ] 单测：每个 learningGoal 都能反查到 lessonUnit 和 assessmentPoint。
- [ ] `rtk npm run test --workspace=packages/core -- generate-course-gdd`

可并行任务：

- 任务 3A：文档 Agent 负责 `agent-test/docs/course/course_gdd.md`、`explanation_depth.md`、`gameplay_mapping.md`。
- 任务 3B：工具 Agent 负责 `generate-course-gdd.ts`，读取课程文档并调用 reasoning provider。
- 任务 3C：校验 Agent 负责 CourseGDD 深度校验、目标覆盖校验和测试。
- 任务 3D：资产规划 Agent 负责 `assetPlan`、`narrationPlan`、`validationPlan` 的数据结构。

合并点：`CourseGDD` 类型由任务 3C 拥有，其他 Agent 只能引用，不能各自定义一份。

### 阶段 4：课程模板族

新增目录：

- [ ] `agent-test/templates/modules/course_ui`
- [ ] `agent-test/templates/modules/course_grid`
- [ ] `agent-test/templates/modules/course_td`
- [ ] `agent-test/docs/modules/course_ui/design_rules.md`
- [ ] `agent-test/docs/modules/course_ui/template_api.md`
- [ ] `agent-test/docs/modules/course_grid/design_rules.md`
- [ ] `agent-test/docs/modules/course_grid/template_api.md`
- [ ] `agent-test/docs/modules/course_td/design_rules.md`
- [ ] `agent-test/docs/modules/course_td/template_api.md`

实现策略：

- [ ] `course_ui` 从 `ui_heavy` 复制基础能力，保留 `BaseChapterScene`、`BaseBattleScene`、`QuizModal`、`DialogueBox`，新增课程专用系统：`LessonProgressManager`、`HintManager`、`LearningReportManager`。
- [ ] `course_grid` 从 `grid_logic` 复制基础能力，新增知识点驱动的 `TaskObjectiveManager` 和步骤反馈。
- [ ] `course_td` 从 `tower_defense` 复制基础能力，限制为复习/巩固型，不承接概念初学。
- [ ] 所有课程模板都要有统一 `courseContent.json` 或 `courseConfig.json`，减少生成代码量。

验证：

- [ ] 对每个模板创建最小示例工程。
- [ ] 示例工程执行 `rtk npm run build`。
- [ ] 示例工程执行 `rtk npm run test`。
- [ ] 检查 `LevelManager.LEVEL_ORDER[0]`、`main.ts` 场景注册和 asset key。

可并行任务：

- 任务 4A：`course_ui` Agent 负责复制并改造 `ui_heavy`，新增 `LessonProgressManager`、`HintManager`、`LearningReportManager`。
- 任务 4B：`course_grid` Agent 负责复制并改造 `grid_logic`，新增 `TaskObjectiveManager` 和步骤反馈。
- 任务 4C：`course_td` Agent 负责复制并改造 `tower_defense`，限制复习型课程循环。
- 任务 4D：模板文档 Agent 负责 `agent-test/docs/modules/course_*` 的 `design_rules.md` 和 `template_api.md`。

合并点：三个模板必须统一读取 `courseContent.json` 或 `courseConfig.json`，字段名由主 Agent 先定，不允许各模板各写一套。

### 阶段 5：Course GDD 到 OpenGame 链路映射

修改/新增：

- [ ] 新增 `packages/core/src/course/courseGddMapper.ts`
- [ ] 课程分类结果映射到 OpenGame 模板复制指令。
- [ ] 扩展 `game-type-classifier.ts` 的提示不建议直接改；更合适是 `generate-course-gdd` 返回课程模板 scaffold 指令。
- [ ] 让生成链路遵循：`generate_course_plan -> 用户确认 -> generate_course_gdd -> 复制 course_* 模板 -> generate_game_assets -> TTS -> 代码/配置生成 -> validate_course_package`。

验证：

- [ ] mapper 单测覆盖三种模板。
- [ ] mapper 单测保证不会输出原始 `platformer/top_down`，除非后续明确支持。
- [ ] 集成测试检查工具注册列表包含课程工具。

可并行任务：

- 任务 5A：mapper Agent 负责 `courseGddMapper.ts`。
- 任务 5B：工具提示 Agent 负责 `generate-course-gdd` 返回 scaffold 指令。
- 任务 5C：集成测试 Agent 负责工具注册和模板选择测试。

合并点：scaffold 指令和 mapper 输出必须一致，由主 Agent 做一次端到端 dry run。

### 阶段 6：多模态资产与 TTS

新增：

- [ ] `packages/core/src/course/tts/lessoninTtsService.ts`
- [ ] `packages/core/src/course/tts/narrationManifest.ts`
- [ ] `packages/core/src/course/tts/lessoninTtsService.test.ts`
- [ ] `agent-test/docs/course/asset_manifest.md`

实现要求：

- [ ] 逐字稿音频使用本地 lessonin 服务，批量请求格式保持 `scriptList[{name, script}]`。
- [ ] TTS 输出写入 `public/assets/narration/`。
- [ ] manifest 使用 `audio_uri` 作为持久字段。
- [ ] 普通点击/反馈音效继续走 `generate_game_assets` 的 `audio`。
- [ ] 过场视频只用于开场/章节转场，第一阶段必须可关闭。

验证：

- [ ] mock 本地 TTS HTTP 服务，测试批量请求体。
- [ ] 测试 TTS 失败时生成可读字幕并降级为无音频模式。
- [ ] manifest 校验：每个 narration segment 有 text、targetScene、audio_uri 或 fallback。

可并行任务：

- 任务 6A：TTS Agent 负责 `lessoninTtsService.ts` 和 mock HTTP 测试。
- 任务 6B：manifest Agent 负责 `narrationManifest.ts` 和文件存在校验。
- 任务 6C：资产协议 Agent 负责 `agent-test/docs/course/asset_manifest.md`，明确普通 SFX、BGM、TTS、视频边界。

合并点：TTS 输出路径和 `audio_uri` 字段必须与模板加载方式一致。

### 阶段 7：课程包验证工具

新增：

- [ ] `packages/core/src/tools/validate-course-package.ts`
- [ ] `packages/core/src/tools/validate-course-package.test.ts`
- [ ] `agent-test/docs/course/validation_protocol.md`
- [ ] `tool-names.ts` 增加 `VALIDATE_COURSE_PACKAGE`
- [ ] `config.ts` 注册 `ValidateCoursePackageTool`

验证内容：

- [ ] `CourseGDD` schema 合法。
- [ ] 每个学习目标有讲解、互动、评价闭环。
- [ ] 每道题有 `correctIndex`、`explanation`、`misconceptionTag`、`hint`。
- [ ] `asset-pack.json` 中 key 与代码引用一致。
- [ ] `narrationManifest` 中音频文件存在或有字幕 fallback。
- [ ] `main.ts` 注册所有场景。
- [ ] `LevelManager.LEVEL_ORDER[0]` 指向真实第一场景。
- [ ] 禁止词/IP/不适龄规则扫描通过。

验证：

- [ ] 单测：缺少 explanation 失败。
- [ ] 单测：缺少 TTS 文件但有 fallback 时 warning，不阻断。
- [ ] 单测：缺少 scene 注册失败。
- [ ] `rtk npm run test --workspace=packages/core -- validate-course-package`

可并行任务：

- 任务 7A：结构校验 Agent 负责 CourseGDD、learningGoal、assessment 校验。
- 任务 7B：工程校验 Agent 负责 `asset-pack.json`、`main.ts`、`LevelManager.ts`、文件存在校验。
- 任务 7C：安全校验 Agent 负责 IP、暴力、恐怖、抽卡、诱导沉迷规则。
- 任务 7D：测试 Agent 负责失败用例 fixtures。

合并点：`validate-course-package` 输出必须分 error/warning/info，方便生成链路判断是否阻断发布。

### 阶段 8：CLI/SDK 使用入口

实现策略：

- [ ] 第一阶段不急着改交互 UI，先用 headless/SDK 跑通。
- [ ] `packages/sdk-typescript/src/query/createQuery.ts` 已能传 `prompt` 和 `options`，适合外部 ToC 服务调用。
- [ ] 后续可新增一个 wrapper：`createCourseGame(courseSpec)`，内部构造 prompt，引导代理按课程链路调用工具。
- [ ] 如果需要独立 CLI，可在 `packages/cli/src/config/config.ts` 增加 `--course-spec`，但这不是第一优先。

验证：

- [ ] SDK 集成测试：给 mock CourseSpec，期望调用课程工具。
- [ ] stream-json 输出包含阶段进度，便于 ToC 前端展示生成进度。

可并行任务：

- 任务 8A：SDK Agent 负责 `createCourseGame(courseSpec)` wrapper 设计。
- 任务 8B：CLI Agent 评估是否需要 `--course-spec`，若需要再实现。
- 任务 8C：进度流 Agent 负责 stream-json 阶段事件约定。

合并点：第一阶段以 SDK/headless 为准，CLI 参数不阻塞 1.0。

### 阶段 9：端到端验证基准

新增：

- [ ] `agent-test/course-fixtures/`
- [ ] `integration-tests/course-generation.test.ts`
- [ ] `agent-test/templates/modules/course_ui/src/test/course-flow.test.ts`

基准用例至少覆盖：

- [ ] 一年级语文：识字/词语匹配，低阅读量。
- [ ] 三年级数学：面积周长，standard 深度。
- [ ] 四年级英语：单词听辨和句型对话。
- [ ] 五年级科学：电路或生态系统，deep 深度。
- [ ] 六年级数学：比例/分数应用，challenge 深度。

每个用例验收：

- [ ] `rtk npm run build`
- [ ] `rtk npm run test`
- [ ] 无头浏览器启动，检查无白屏、无 fatal console error。
- [ ] 自动点击开始、进入第一互动、完成一道题、进入反馈。
- [ ] 校验 learning report 生成。

可并行任务：

- 任务 9A：fixtures Agent 负责 5 个跨学科 CourseSpec fixture。
- 任务 9B：浏览器 Agent 负责无头浏览器启动、点击、console error 捕获。
- 任务 9C：报告 Agent 负责 learning report 输出校验。
- 任务 9D：CI Agent 负责把测试命令接入 `npm run test:ci` 或独立 course test 命令。

合并点：端到端测试可能慢，先独立命令运行；稳定后再进入 CI。

## 全方位验证矩阵

| 验证层     | 验证目标                                       | 推荐落点                                       |
| ---------- | ---------------------------------------------- | ---------------------------------------------- |
| schema     | 输入、课程方案、CourseGDD 合法                 | `packages/core/src/course/*.test.ts`           |
| 课程深度   | 讲解不浅显，包含前置、概念层、例题、迁移、反馈 | `validation.ts` + `validate-course-package.ts` |
| 玩法映射   | 全学科入口映射到受控玩法族                     | `gameplayMapping.test.ts`                      |
| 工具注册   | 课程工具能出现在 ToolRegistry                  | `packages/core/src/config/config.test.ts`      |
| 模型输出   | LLM JSON 可解析且不合格时失败                  | 工具单元测试 + mock fetch                      |
| 模板编译   | 课程模板最小工程可 build                       | 模板 fixture                                   |
| 游戏流程   | 开始、暂停、完成、失败、重玩、结算             | 模板内 Vitest                                  |
| 浏览器可玩 | 无白屏、按钮可点、场景可达                     | Playwright/无头浏览器集成测试                  |
| 资产完整性 | asset-pack、TTS、字幕、视频 key 对齐           | `validate-course-package`                      |
| 适龄安全   | IP、暴力、恐怖、抽卡、诱导沉迷拦截             | 安全规则库 + 校验工具                          |
| 回退       | 资产/TTS/视频失败可降级                        | 失败注入测试                                   |

## 多角色执行分工

| 角色           | 代码范围                                                                    | 主要产出                                                                 |
| -------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| 课程模型 Agent | `packages/core/src/course/*`                                                | schema、学科映射、深度校验、评分函数                                     |
| 工具链 Agent   | `packages/core/src/tools/*`、`config.ts`、`tool-names.ts`                   | `generate_course_plan`、`generate_course_gdd`、`validate_course_package` |
| 模板 Agent     | `agent-test/templates/modules/course_*`、`agent-test/docs/modules/course_*` | 课程 Phaser 模板和模板 API 文档                                          |
| 多模态 Agent   | `packages/core/src/course/tts/*`、`generate-assets` 适配文档                | TTS 服务、narration manifest、素材协议                                   |
| 验证 Agent     | `packages/core/src/course/validation.ts`、`integration-tests/*`             | 单元/集成/浏览器验证                                                     |
| 产品入口 Agent | SDK wrapper、ToC 前端服务外部仓库或后续 CLI                                 | 结构化输入、方案确认、进度流、学习报告                                   |

## 后续开工约束

- 保留普通 OpenGame 游戏生成能力，课程能力以新增模块和新增模板族实现。
- 课程深度是结构化字段，不允许只靠 prompt 口头要求“讲深一点”。
- 每个阶段必须先补测试再进入下一阶段。
- 任意生成失败必须有降级路径：少视频、无 TTS、低成本图片、稳定模板。
- 复杂开发阶段完成后更新对应 workflow 任务文档 TODO 状态。
