# 游戏化课程产品与技术优化方案

## 定位

本文是游戏化课程产品下一阶段的技术优化方案，面向 OpenGame 当前课程生成链路。重点解决一个核心问题：

> 课程生成出来以后，是否真的精彩、有趣、可持续，让 1-6 年级小学生愿意玩下去，让家长愿意付费，并让 AI 在可靠边界内获得更大的创作与开发权限。

本文不替代现有受控链路。现有 `CourseSpec -> CoursePlanOption -> CourseGDD -> courseContent.json -> 模板/runtime/playlet -> validate_course_package` 仍是底座。优化方向是在底座上增加更强的体验导演、AI 生成权限分层、可玩性验证和产品化反馈闭环。

## 总体结论

当前系统已经具备课程生成的工程闭环，但真正的产品瓶颈在“生成体验质量”：

- 对学生而言，课程不能只是题目换皮，必须在前 30 秒建立身份、目标、操作反馈和状态变化。
- 对家长而言，购买理由不是“AI 生成课程”，而是“孩子愿意学、学得清楚、我看得见进步且安全可控”。
- 对产品而言，当前核心指标应从生成成功率升级为首局吸引力、互动完成率、复玩率、家长转化和课程质量分。
- 对技术而言，固定 playlet 底座保证稳定，但如果长期禁止 AI 生成新交互能力，会限制玩法上限。应引入 AI 开发沙箱，让 AI 能生成候选 playlet、场景动效、课程脚本和验证脚本，再通过多层门禁晋级。

优先级最高的重构不是先做更多界面，而是建立“精彩度生产系统”：体验蓝图、玩法导演、AI 可扩展 playlet、自动试玩评测、学生/家长反馈回流。

## 多角色诊断

### 1. 学生视角：1-6 年级真实使用体验

低年级学生的关键体验不是“学习目标明确”，而是：

- 我是谁：我在游戏里是什么角色。
- 我要做什么：当前任务是否一眼能懂。
- 我点了以后发生什么：是否立即有反馈。
- 我做对了有什么变化：是否解锁、修复、点亮、推进。
- 我做错了是否还想试：错误反馈是否温和、具体、有下一步。

当前风险：

- 课程方案容易在内部层面很完整，但学生可见端仍像“讲解 + 选择题 + 报告”。
- `learningLoop`、`scenePlan` 里有节奏词，但运行时首屏、按钮、反馈、动效不一定真的让学生感受到节奏。
- 低年级需要更强的视觉引导、语音引导、少字、多反馈；高年级需要挑战、策略、选择后果和成就感。
- 学生更在意“我改变了世界”，不在意“我完成了知识点覆盖”。

必须优化：

- 每门课生成 `StudentExperienceBlueprint`，明确首屏 30 秒、第一步操作、第一次成功、第一次错误、第一次奖励和最终结算。
- 按年级分层：
  - 1-2 年级：大按钮、少文字、语音/字幕、单一目标、即时正反馈、失败可重试。
  - 3-4 年级：多步任务、收集/修复/解锁、可视化错因、简单策略。
  - 5-6 年级：证据链、变量调参、项目验收、策略权衡、复盘报告。
- 每个 playlet 必须有“状态变化合同”：正确、错误、部分正确分别改变什么可见状态。

### 2. 家长视角：是否吸引我购买

家长购买的心理链路通常是：

1. 这东西孩子会不会喜欢。
2. 这是不是比刷题更有效。
3. 学了什么我能不能看懂。
4. 内容是否安全、适龄、可控。
5. 付费后是否能持续产生价值。

当前风险：

- 如果对外展示过多内部概念，例如 Agent、MVP、CourseSpec、workflow，会降低家长理解和信任。
- 家长不会因为“AI 参与多”而直接付费，家长要看到“孩子玩得进去 + 学习报告可信 + 下一课合理”。
- 如果生成等待时间长，但过程中没有可感知进度、预览和价值解释，家长会焦虑。
- 如果课程看起来像普通模板换皮，家长不会相信它值得付费。

必须优化：

- 生成前给家长看“课程预告片式摘要”：孩子将扮演什么角色、完成什么任务、会练到什么能力、预计多长时间。
- 生成后给家长看“双层报告”：
  - 一句话结论：孩子掌握了什么，哪里卡住。
  - 证据展开：在哪个任务中出错、用了几次提示、是否能迁移。
- 家长控制不应只是安全开关，还要有价值开关：时长、难度、题量、讲解深度、娱乐强度、是否要复习。
- 付费点应围绕“连续学习”和“高质量生成”设计，而不是单次生成。

### 3. 产品经理视角：功能与使用链路

产品当前要从“生成工具”转为“课程体验产品”。核心问题不是功能数量，而是主路径是否闭环：

```text
一句话需求
  -> 生成前预期管理
  -> 高质量课程生成
  -> 学生完成首局
  -> 家长看到价值
  -> 下一课自然发生
```

当前风险：

- 方案确认环节对工程安全很重要，但对普通用户可能太“工具化”。如果不能自动推荐并解释差异，会增加决策负担。
- 当前质量门禁偏工程侧，产品指标如首局吸引力、完成率、复玩意愿、家长信任不足。
- “精彩度”已有 rubric，但还没有形成产品指标和回归数据闭环。
- 课程生成失败或降级时，需要让家长理解“发生了什么、还能得到什么”，而不是只报技术失败。

必须优化：

- 用 `CoursePromise` 替代工程方案展示：标题、孩子身份、核心任务、互动类型、预计体验、家长价值。
- 默认自动选择推荐方案继续生成，只在冲突、高成本、低置信度或家长策略触发时要求确认。
- 新增产品指标：
  - 首屏可理解时间：10 秒内知道自己要做什么。
  - 首次互动时间：30 秒内完成第一次有效操作。
  - 首局完成率：完成至少 1 个 playlet。
  - 复玩触发率：点击下一课/再玩一次。
  - 家长报告打开率和收藏/购买转化。
- 生成过程展示应从“技术阶段”转为“课程正在搭建”：剧情、关卡、讲解、素材、旁白、检查。

### 4. 技术架构视角：现有方式的局限

现有方式的优点：

- 受控 schema 保证课程结构不会完全跑偏。
- `course_runtime + playlet` 能复用稳定玩法。
- `validate_course_package` 能阻断缺文件、缺资产、缺旁白、场景未注册等问题。
- 质量门禁已经覆盖教学深度、玩法精彩度、视觉一致、适龄和学生文案。

现有方式的局限：

- AI 主要写配置和内容，难以突破已有 playlet 的表达上限。
- 质量评分多数还是静态分析，不能充分判断真实运行时是否好玩。
- `CoursePlanOption` 和 `CourseGDD` 对“体验节奏、情绪曲线、奖励、失败体验”的表达仍偏弱。
- 玩法库虽然有 40 个 ready playlet，但真实可玩质量、动效、手感和视觉表现仍需要持续升级。
- 课程生成的成功经验还没有强绑定到下一次生成决策，经验库价值没有充分释放。

必须优化：

- 在 schema 中新增体验层，而不是只在 prompt 中描述好玩。
- 引入 AI 代码生成沙箱，让 AI 能生成候选 playlet 和场景表现，但不能直接污染稳定模板。
- 用自动试玩和视觉/交互 telemetry 验证“运行时精彩度”。
- 把成功课程沉淀为可检索 pattern，反哺方案生成和导演阶段。

## 核心重构方向：精彩度生产系统

### 方向 1：新增 Experience Blueprint

在 `CoursePlanOption` 或 `CourseGDD` 之上新增体验蓝图：

```ts
interface StudentExperienceBlueprint {
  openingHook: {
    role: string;
    worldProblem: string;
    firstVisibleGoal: string;
    firstActionWithinSeconds: number;
  };
  emotionCurve: Array<{
    stage: 'curiosity' | 'first_success' | 'challenge' | 'recovery' | 'mastery';
    scene: string;
    expectedFeeling: string;
    visibleChange: string;
  }>;
  rewardLoop: {
    shortCycleReward: string;
    mediumCycleUnlock: string;
    finalMasteryMoment: string;
  };
  failureExperience: {
    incorrectFeedbackStyle: 'gentle_hint' | 'diagnostic' | 'retry_with_change';
    recoveryAction: string;
    noShameCopy: string;
  };
}
```

作用：

- 让“好玩”进入结构化产物，而不是停留在 prompt 形容词。
- 让质量门禁能检查首屏、首次操作、奖励、失败回流。
- 让家长预览和学生首屏直接复用同一份体验设计。

落地文件建议：

- `packages/core/src/course/experience/studentExperienceBlueprint.ts`
- `packages/core/src/course/quality/experienceReviewer.ts`
- `agent-test/docs/quality/student-experience-blueprint.md`

### 方向 2：把“知识影响游戏状态”升级为硬合同

当前已有 gameDirector 检查状态变化，但还不够细。每个 playlet node 应显式声明：

```ts
interface LearningStateEffect {
  conceptDecision: string;
  correctEffect: string;
  incorrectEffect: string;
  partialEffect?: string;
  misconceptionRevealed: string;
  visibleWorldChange: string;
}
```

硬规则：

- 学生操作必须对应学习动作。
- 判断结果必须改变可见状态。
- 错误必须暴露误区。
- 至少一个后续节点要读取前一节点结果。

这能防止“题目只是门票，游戏状态只是装饰”的换皮问题。

### 方向 3：运行时精彩度评测

静态质量分不够。需要让系统自动试玩课程，采集运行时证据：

```text
打开课程
  -> 识别首屏是否有目标和主要操作
  -> 执行第一个 playlet 的正确/错误路径
  -> 检查状态是否变化
  -> 检查反馈是否出现
  -> 到达报告或下一节点
  -> 生成 RuntimeExperienceReport
```

新增报告：

```ts
interface RuntimeExperienceReport {
  firstMeaningfulActionMs: number;
  visibleGoalDetected: boolean;
  stateChangedAfterAction: boolean;
  feedbackDetected: boolean;
  recoveryPathDetected: boolean;
  reportReachable: boolean;
  consoleFatalErrors: string[];
  visualIssues: string[];
}
```

对应增强：

- `integration-tests/helpers/courseBrowserSmoke.ts` 从“能走通”升级为“能证明好玩要素存在”。
- `validate_course_package` 通过后必须进入 runtime smoke，不能只停在静态文件检查。
- 质量门禁新增 `runtimeExperience` 分项。

### 方向 4：AI 开发权限分层

用户提出“AI 的智力越来越聪明，应给 AI 开发权限”。这个方向是正确的，但不能等于让 AI 直接改稳定模板。推荐四级权限：

| 权限级别        | AI 可以做什么                                                              | 禁止做什么               | 晋级条件                                   |
| --------------- | -------------------------------------------------------------------------- | ------------------------ | ------------------------------------------ |
| L0 配置生成     | 写 `CourseSpec`、`CoursePlanOption`、`CourseGDD`、`courseContent.json`     | 写运行时代码             | schema + 质量门禁                          |
| L1 表现生成     | 写关卡文案、反馈、素材 prompt、动效参数、音效策略                          | 新增引擎逻辑             | 静态校验 + 浏览器 smoke                    |
| L2 沙箱 playlet | 在 `generated/playlets/<id>` 生成新 playlet 候选代码、schema、sample、测试 | 修改 core/runtime/shared | typecheck + lint + 单测 + smoke + 安全扫描 |
| L3 候选能力晋级 | 把多次通过的 playlet 提交为可复用候选                                      | 自动进入 ready catalog   | 人工审核或高置信自动审核                   |
| L4 稳定能力     | 进入 `agent-test/templates/playlets` ready 目录                            | 绕过回归                 | 全量回归 + golden cases                    |

关键设计：

- 新增 `GeneratedPlayletSandbox`，AI 只能写隔离目录。
- 新增 `playlet_review` 工具，检查 API 契约、安全、依赖、文件边界、渲染状态节点。
- 新增 `promote_playlet_candidate`，只有多次通过后才进入 ready catalog。
- 保持核心 runtime 不被 AI 直接改写，降低系统性风险。

建议目录：

```text
agent-test/generated/playlets/
  <candidate-id>/
    manifest.json
    schema.json
    sample.json
    index.ts
    candidate-report.json

packages/core/src/course/ai-dev/
  generatedPlayletPolicy.ts
  playletCandidateReview.ts
  playletPromotion.ts

packages/core/src/tools/
  generate-playlet-candidate.ts
  review-playlet-candidate.ts
  promote-playlet-candidate.ts
```

### 方向 5：多 Agent 生成流水线

目前很多能力在一个 Agent prompt 中串行表达。建议拆成角色清晰的内部阶段：

- 学习设计师：明确目标、误区、掌握证据。
- 游戏导演：设计身份、情境、节奏、奖励和失败体验。
- 玩法工程师：选择 ready playlet 或生成沙箱候选 playlet。
- 美术/音频导演：统一 style bible、素材计划、TTS 情绪。
- 质量评审：审教学、精彩度、适龄、安全、可玩性。
- 试玩员：自动浏览器试玩，输出 runtime 体验报告。

这些不一定要实现为真正多进程 Agent，可以先表现为工具链阶段和结构化 reviewer。但每个阶段必须产出可检查对象，不能只产出自然语言。

## 产品体验优化方案

### 学生端第一屏

学生看到的第一屏必须只有三个东西：

- 角色身份：例如“你是太空基地维修员”。
- 当前任务：例如“修好被错误面积数据卡住的能量门”。
- 主要操作：例如“拖动方格板，拼出正确覆盖区域”。

禁止：

- “本课学习目标是……”
- “请完成以下课程”
- 大段说明文字。
- 让低年级学生先读复杂规则。

### 课程节奏

每节课至少包含：

1. 10 秒内可理解的情境目标。
2. 30 秒内完成第一次操作。
3. 第一次成功后的可见变化。
4. 第一次错误后的可恢复提示。
5. 至少一次迁移挑战。
6. 结算时展示“我修好了什么/发现了什么/掌握了什么”。

### 家长预览

生成前给家长的不是内部方案，而是：

```text
孩子将扮演：太空基地维修员
要完成：修复面积能量门
主要互动：拖动方格、拼出区域、判断面积变化
会练到：面积公式的来源、面积和周长区别
预计时长：15-20 分钟
安全设置：无视频、字幕旁白、低文字密度
```

### 学习报告

报告必须把游戏证据翻译成家长语言：

- 不是“node_2 failed”，而是“孩子在区分面积和周长时用了 2 次提示”。
- 不是“accuracy 80%”，而是“能用方格覆盖解释面积，但迁移到不规则图形时仍需提示”。
- 下一课建议必须来自错因，而不是固定推荐。

## 技术实施路线

### 阶段 1：体验蓝图和硬门禁

目标：让精彩度从口号变成 schema。

新增：

- `StudentExperienceBlueprint`
- `LearningStateEffect`
- `experienceReviewer`
- `studentExperienceBlueprint.md`

改造：

- `generate_course_plan` 要求每个方案输出体验蓝图。
- `score_course_quality` 增加 `experienceDesign` 分项。
- `gameDirector` 检查首屏、首次操作、奖励、失败回流。

验收：

- 课程方案没有首屏钩子、首次操作或可见状态变化时阻断。
- 学生端文案仍不得暴露教学目标。

### 阶段 2：运行时体验 smoke

目标：从“能跑”升级到“能证明有互动吸引力”。

新增：

- `RuntimeExperienceReport`
- 浏览器 smoke 的正确路径和错误路径验证。
- DOM 状态节点扩展：`data-current-goal`、`data-feedback-state`、`data-world-state`。

验收：

- 自动完成第一轮正确操作后，必须检测到状态变化。
- 自动触发一次错误后，必须检测到提示或补救路径。
- 首屏无目标或无主要操作时失败。

### 阶段 3：AI playlet 沙箱

目标：给 AI 开发权限，但不破坏稳定底座。

新增：

- `generate_playlet_candidate`
- `review_playlet_candidate`
- `GeneratedPlayletPolicy`
- 候选 playlet 隔离目录。

约束：

- AI 只能写候选目录。
- 不允许新增网络请求、任意文件读写、外部依赖。
- 必须提供 manifest、schema、sample、index 和最小测试。
- 必须通过 typecheck、lint、模板编译和浏览器 smoke。

验收：

- 一个新交互需求若 ready playlet 无法承载，AI 能生成候选 playlet 并在隔离目录跑通。
- 候选失败不会影响稳定课程生成。

### 阶段 4：候选能力晋级机制

目标：让 AI 生成能力可沉淀，而不是每次从零写。

新增：

- `playletCandidateRegistry`
- `promotionScore`
- `successfulPatternIndex` 和 playlet 关联。

晋级规则：

- 同一候选 playlet 至少通过 3 个不同课程样例。
- 通过安全扫描、无 fatal console error、无明显视觉遮挡。
- 有稳定 schema 和 sample。
- 人工审核或高置信自动审核后进入 ready catalog。

### 阶段 5：家长价值与续作闭环

目标：从一次性生成转为连续产品。

改造：

- 学习报告输出错因、掌握证据和下一课建议。
- `LearningState` 增加体验偏好摘要，例如孩子喜欢的玩法、放弃点、最常用提示。
- `createNextCourseGame()` 使用错因和体验偏好生成下一课，而不是只沿用主题。

验收：

- 下一课能解释“为什么推荐这个玩法和难度”。
- 家长能看到连续 3 节课的进步曲线。

## 关键技术风险与应对

### 风险 1：放开 AI 写代码导致不稳定

应对：

- 只允许写隔离候选目录。
- 所有候选必须经过静态策略、typecheck、lint、模板编译、浏览器 smoke。
- 候选失败自动回退 ready playlet。

### 风险 2：质量评分被 prompt 欺骗

应对：

- 静态评分必须结合运行时 smoke。
- 评分依据尽量来自结构化字段和 DOM 状态，而不是模型自评。
- golden cases 加入“换皮问答”负样本。

### 风险 3：过度追求好玩损害学习

应对：

- 学习目标、误区和掌握证据仍是硬合同。
- 游戏难度不能来自操作刁难，除非目标就是反应训练。
- 家长报告必须能追溯每个学习目标的证据。

### 风险 4：生成成本过高

应对：

- 默认优先 ready playlet 和低成本素材。
- AI playlet 只在 ready playlet 无法承载时触发。
- 自动修复受 `maxRetryCount` 和 `maxEstimatedCostCents` 约束。
- 高成本视频默认可选，不作为课程完成必要条件。

## 推荐优先级

### P0：立即做

- Experience Blueprint schema。
- LearningStateEffect 状态变化合同。
- gameDirector 和 quality scorer 接入体验蓝图。
- 浏览器 smoke 增加首屏、首次操作、反馈、状态变化检查。

### P1：下一阶段做

- AI playlet 沙箱生成和 review 工具。
- 候选 playlet 隔离目录与最小测试协议。
- 家长预览和学习报告的结构化输出。

### P2：稳定后做

- playlet 候选晋级机制。
- 多 Agent 内部分工。
- 经验库驱动的个性化玩法推荐。
- 家长连续学习仪表盘。

## 最终目标状态

理想状态不是“AI 生成一堆课程文件”，而是：

```text
孩子一句话想学
  -> 系统理解学习目标和兴趣
  -> AI 导演一段有角色、有任务、有反馈的学习体验
  -> 稳定底座承载已验证玩法
  -> AI 在沙箱中补足新玩法和表现力
  -> 自动试玩证明课程真的可玩、好玩、可学
  -> 家长看到可信报告
  -> 下一课自然接上
```

这个方向能同时满足三件事：

- 学生愿意继续玩。
- 家长看得见价值并愿意付费。
- AI 的能力被释放，但不会牺牲系统稳定性和未成年人产品安全。
