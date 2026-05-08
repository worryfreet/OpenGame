# course_grid 课程模板设计规则

`course_grid` 用于分类、排序、路径、步骤推理和操作反馈。它复制自 `grid_logic`，新增统一课程内容入口、任务目标管理和步骤反馈管理。

## 适用边界

- 适合：数学步骤推理、科学流程推演、语文词语分类、英语词义配对、综合任务排序。
- 不适合：长篇讲解和大量对话，优先使用 `course_ui`。
- 不适合：复习波次、防守资源和高频题组，优先使用 `course_td`。

## 统一课程配置

所有课程内容必须来自 `src/courseContent.json`，`course.archetype` 必须是 `course_grid`。

字段使用规则：

- `lessonUnits` 写清楚概念、例题和误区。
- `interactions` 描述网格任务，`type` 可为 `classification`、`sequence`、`path`、`matching` 或 GDD 中定义的受控类型。
- `assessments` 负责评价题和错因提示。
- `narration.segments` 用于场景字幕和后续 TTS。

## 课程系统

- `TaskObjectiveManager`：把 `interactions` 转成当前场景的任务目标，跟踪步骤完成情况。
- `StepFeedbackManager`：根据互动或评价题生成即时反馈、错因标签和下一步提示。

## 生成约束

- 每个学习目标至少对应一个网格互动和一个评价题。
- 步骤错误必须给出具体下一步提示，不能只显示 wrong。
- `deep/challenge` 深度必须包含迁移、应用或反思任务。
- 仍然使用 `BaseGridScene` 的已存在 hook，例如 `onCellClicked`、`onDirectionInput`、`checkWinCondition`。
- 不修改普通 `grid_logic` 模板；课程特化能力只放在 `course_grid`。
