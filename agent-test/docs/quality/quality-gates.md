# MVP 3.0 课程质量门禁

## 使用场景

开发课程质量评分、自动修复循环、生成工具集成或端到端回归时阅读。质量门禁在 CourseSpec 和 CoursePlanOption schema 校验之后执行，用来决定方案是否可以进入高成本 Course GDD、素材、TTS 和发布验证。

## 总评分字段

`CourseQualityScore` 固定包含：

- `pedagogyDepth`：教学深度，来自 `pedagogyReviewer`。
- `gameplayExcitement`：玩法精彩度，必须复用 `excitementRubric.scoreCourseExcitement()`。
- `ageFit`：年级、阅读水平、时长和 UI 密度适配。
- `visualConsistency`：角色、UI、主题、配色和禁用元素一致性。
- `playabilityRisk`：workflow、实现稳定性、素材复杂度和导演风险。
- `safety`：家长策略、禁用元素和不适龄内容风险。
- `studentFacingCopyReview`：学生可见文案检查，避免把教学目标生硬暴露成任务标题。
- `total`：加权总分。
- `blockingIssues`：阻断问题列表。
- `improvementActions`：可直接交给自动修复的动作列表。

## 默认门槛

- `total` 最低 75。
- 任一评审出现 blocking issue 时不得进入高成本生成。
- `gameplayExcitement` 的维度和最低分以 `excitement-rubric.md` 为准。
- `pedagogyDepth` 对 deep/challenge 课程必须包含概念层、误区和迁移任务。
- `visualConsistency` 出现角色或 UI/主题明显冲突时阻断。
- `playabilityRisk` 受到无 workflow、无状态变化、无反馈后果、高素材复杂度和不可控风险影响。
- 学生端 `title`、`scenePlan`、`learningLoop`、`recommendationReason` 和 workflow node config 不能直接出现“学习目标/教学目标/掌握目标/本课目标/课程目标”，也不能直接复述完整 `learningGoals`。学生看到的是游戏任务、谜题、角色行动和世界状态；家长报告、课程元数据和评测数据仍保留明确教学目标。
- `generate_course_gdd` 必须在工具边界内重新执行 `score_course_quality`，不能只依赖调用方已经跑过质量门禁。

## 教学深度门禁

`pedagogyReviewer` 必须识别：

- 浅层问答缺少足够概念层。
- 没有误区识别或错因反馈。
- deep/challenge 课程没有迁移任务。
- 反馈只给答案。
- 掌握证据没有覆盖所有学习目标。

## 视觉一致性门禁

`visualConsistencyScorer` 必须识别：

- 主题是空间站、森林、侦探、餐厅、法庭等明确世界时，角色方向明显不匹配。
- UI 或场景道具与主题冲突，例如空间站方案使用木牌、羊皮纸、城堡卷轴。
- 配色或视觉氛围不足以约束界面状态。
- 视觉文本出现 `styleSpec.forbidden` 禁用元素。

## 自动修复输入

质量门禁失败后，自动修复优先使用 `improvementActions`：

- 教学失败：补概念层、误区、迁移任务和步骤化反馈。
- 导演失败：补节奏节点、状态变化、反馈后果和知识到玩法的绑定。
- 视觉失败：统一角色、UI token、场景道具和配色。
- 精彩度失败：沿用 `excitementRubric` 的维度修复动作。
- 学生文案失败：保留 CourseSpec 中的明确学习目标，把学生端文案改写成任务化表达。

修复后必须重新运行质量评分，不能只修改文案后直接放行。
