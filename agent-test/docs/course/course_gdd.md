# Course GDD 草案

本文档定义课程游戏生成链路中的 Course GDD 初版格式。Course GDD 位于课程方案确认之后、普通 OpenGame 模板代码生成之前，用来把课程目标、讲解深度、互动任务、资产与验证规则收敛为可执行规格。

## 生成位置

```text
CourseSpec
  -> generate_course_plan
  -> 用户确认 selectedPlanId
  -> generate_course_gdd
  -> 映射到 course_ui / course_grid / course_td 模板
  -> generate_game_assets + TTS
  -> 代码与配置生成
  -> validate_course_package
```

Course GDD 不替代现有 `generate_gdd`。普通游戏继续使用 `classify_game_type -> generate_gdd`；课程链路新增独立工具，最后再映射到课程模板族。

## 顶层结构

```ts
interface CourseGDD {
  courseSpec: CourseSpec;
  selectedPlan: CoursePlanOption;
  workflow?: CourseWorkflow;
  styleBible?: StyleBible;
  lessonUnits: LessonUnit[];
  interactionSpecs: InteractionSpec[];
  assessmentSpec: AssessmentSpec;
  assetPlan: CourseAssetPlan;
  narrationPlan: NarrationPlan;
  validationPlan: ValidationPlan;
}
```

## Section 0：课程与模板架构

必须说明：

- `courseArchetype`：只能是 `course_ui`、`course_grid`、`course_td`。
- 首场景 key：必须对应 `LevelManager.LEVEL_ORDER[0]`。
- 场景注册清单：必须列出需要写入 `main.ts` 的所有场景 key。
- 模板约束：说明该 Course GDD 依赖的模板 API，不允许引用未在模板文档中声明的 hook。

`course_ui` 优先用于讲解、剧情选择、对话、测验、卡片互动。`course_grid` 用于分类、排序、步骤推理、空间或流程任务。`course_td` 只用于复习巩固型课程，不承接概念初学。

## Section 0.5：玩法工作流

Course GDD 可以包含 `workflow`，也可以继承 `selectedPlan.workflow`。如果二者都缺失，mapper 只能生成兼容降级线性 workflow。

```ts
interface CourseWorkflow {
  startNodeId: string;
  nodes: PlayletNode[];
  edges: WorkflowEdge[];
  recoveryPolicy: 'retry_same' | 'hint_then_retry' | 'remediate_then_return';
}

interface PlayletNode {
  id: string;
  playletId: string;
  goalIds: string[];
  config: unknown;
  styleBindingId: string;
  enterTransition?: string;
  exitTransition?: string;
}

interface WorkflowEdge {
  from: string;
  to: string;
  when: 'success' | 'fail' | 'partial' | 'always';
}
```

硬性要求：

- `playletId` 只能引用 ready 玩法模板包。
- workflow 必须是 DAG，所有节点必须从 `startNodeId` 可达。
- 每个 learningGoal 映射后的 goalId 至少被一个 playlet node 覆盖。
- 玩法 node 的 `config` 只能包含内容、参数、反馈和素材引用，不能要求生成玩法引擎代码。
- 玩法之间通过 `enterTransition`、`exitTransition` 和 runtime 统一过渡，不允许模板自行跳转未知场景。

## Section 0.6：风格规范

```ts
interface StyleBible {
  theme: string;
  palette: string[];
  characterDirection: string;
  uiTokens: Record<string, string>;
  motionMood: string;
  audioMood: string;
  forbiddenElements: string[];
}
```

`StyleBible` 是素材、UI、动效、TTS 和视频过场的一致性入口。`forbiddenElements` 是策略字段，不应被当作正文内容命中安全扫描。

## Section 1：课程讲解单元

每个 `learningGoal` 至少对应一个 `lessonUnit`。

```ts
interface LessonUnit {
  id: string;
  learningGoal: string;
  concept: string;
  explanationScript: string;
  interactionTask: string;
  feedbackStrategy: string;
  assessmentPointId: string;
}
```

硬性要求：

- `standard`、`deep`、`challenge` 不允许只有题目，必须包含讲解、示例、互动练习、反馈。
- 例题解析必须写出关键推理步骤，不能只写“答案是 X”。
- `deep` 和 `challenge` 必须包含迁移任务或开放反思。

## Section 2：互动任务规格

```ts
interface InteractionSpec {
  id: string;
  lessonUnitId: string;
  type:
    | 'dialogue_choice'
    | 'quiz'
    | 'card_match'
    | 'grid_sort'
    | 'grid_path'
    | 'tower_review';
  prompt: string;
  expectedAction: string;
  feedback: {
    correct: string;
    incorrect: string;
    misconceptionTag: string;
    hint: string;
  };
}
```

每个互动任务必须能回溯到一个 `lessonUnit`，并且必须产出学习报告所需的行为证据。

## Section 3：评价与学习报告

```ts
interface AssessmentSpec {
  items: AssessmentItem[];
  masteryCriteria: string[];
}

interface AssessmentItem {
  id: string;
  learningGoal: string;
  prompt: string;
  options?: string[];
  correctIndex?: number;
  answer: string;
  explanation: string;
  misconceptionTag: string;
  hint: string;
}
```

评价题必须包含答案、解析、错因标签和下一步提示。学习报告至少覆盖学习目标掌握度、常见错因和建议复习点。

## Section 4：资产与旁白计划

```ts
interface CourseAssetPlan {
  images: Array<{
    key: string;
    description: string;
  }>;
  audio: Array<{
    key: string;
    description: string;
    audioType: 'bgm' | 'sfx';
  }>;
  video?: Array<{
    key: string;
    description: string;
    optional: boolean;
  }>;
}

interface NarrationPlan {
  segments: Array<{
    id: string;
    name: string;
    text: string;
    targetScene: string;
  }>;
}
```

讲解旁白走课程 TTS manifest，不混入 `generate_game_assets` 的普通音效语义。普通 BGM、点击、正确、错误等音效仍由 `generate_game_assets` 负责。

## Section 5：验证计划

```ts
interface ValidationPlan {
  requiredChecks: string[];
  browserFlow: string[];
  fallbackChecks: string[];
}
```

最低验证项：

- Course GDD schema 合法。
- 每个学习目标都有讲解、互动、反馈和评价闭环。
- 每道题都有解析、错因标签和提示。
- 场景 key 已注册，且 `LEVEL_ORDER[0]` 指向真实第一场景。
- `asset-pack.json`、TTS manifest 与代码引用一致。
- 适龄、安全、禁用内容扫描通过。

## Section 6：落地路线

Course GDD 必须输出文件级执行计划，但只允许面向课程模板族：

- 复制 `agent-test/templates/core`。
- 复制 `agent-test/templates/course_runtime`。
- 复制 workflow 选中的 `agent-test/templates/playlets/*` 模板包。
- 复制 `agent-test/templates/modules/course_*` 中选定模板。
- 合并课程专用 `courseContent.json` 或 `courseConfig.json`。
- 更新 `LevelManager.ts` 和 `main.ts`。
- 生成资产与旁白 manifest。
- 执行 build、test、浏览器首轮互动验证。

不允许在 Course GDD 中要求修改普通 `ui_heavy`、`grid_logic`、`tower_defense` 模板。
