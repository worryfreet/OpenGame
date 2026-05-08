# course_td 课程模板设计规则

`course_td` 用于复习、巩固、策略选择和波次反馈。它复制自 `tower_defense`，但课程边界更窄：不用于第一次教授新概念。

## 适用边界

- 适合：高年级数学复习、科学概念辨析、英语词汇巩固、跨章节策略训练。
- 不适合：初次讲解新概念，优先使用 `course_ui`。
- 不适合：需要精确步骤推理或路径拼装的学习任务，优先使用 `course_grid`。

## 统一课程配置

所有复习内容必须来自 `src/courseContent.json`，`course.archetype` 必须是 `course_td`，且 `templateRules.reviewOnly` 必须为 `true`。

字段使用规则：

- `lessonUnits` 只写复习前置回顾，不承接完整新课讲解。
- `interactions` 写波次目标、资源奖励和策略反馈。
- `assessments` 写波次前或波次间的策略题。
- `report` 至少包含正确率、波次完成率和薄弱目标。

## 课程系统

- `ReviewWaveProgressManager`：校验复习型使用边界，按波次提供复习题，记录正确率，并给波次配置补齐基础节奏。

## 生成约束

- `course_td` 必须有明确复习前置，不能作为课程第一讲的唯一模板。
- 波次奖励必须与学习表现相关，但不能出现抽卡、赌博或诱导沉迷机制。
- 错误反馈必须包含错因标签和下一步提示。
- 仍然使用 `BaseTDScene` 的已存在 hook，例如 `getWaveDefinitions`、`getTowerTypes`、`onWaveComplete`。
- 不修改普通 `tower_defense` 模板；课程特化能力只放在 `course_td`。
