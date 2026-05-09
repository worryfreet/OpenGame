# MVP 2.0 偏好记忆与学习状态记忆

## 读取场景

开发 MVP 2.0 偏好复用、学习报告摘要、下一课推荐、数据删除或记忆相关 SDK 时必读。

## 核心边界

- 偏好记忆只影响课程风格、玩法倾向、阅读水平、TTS 偏好和交互偏好。
- 学习状态只影响课程目标、难度、错因、提示使用情况和下一课推荐。
- 偏好记忆和学习状态必须通过 `profileId` 关联，但不能互相写入字段。
- 默认只保存结构化摘要，不保存学生真实姓名、头像、语音样本、完整对话、原始学生输入或精确画像。
- 删除 profile 关联数据时，偏好档案和学习状态必须一起清除。

## StudentPreferenceProfile 契约

`packages/core/src/course/product/preferenceProfile.ts` 提供偏好档案能力：

- `createPreferenceProfile()`：从结构化输入创建最小可持久化偏好档案。
- `sanitizePreferenceForPersistence()`：清洗敏感字段后返回可持久化模型。
- `updatePreferenceProfile()`：合并兴趣、主题、配色、玩法倾向和 TTS 偏好。
- `deletePreferenceProfileForProfile()`：按 `profileId` 删除偏好档案。

偏好档案允许保存：

- `profileId`
- `grade`
- `interests`
- `preferredThemes`
- `preferredPalette`
- `preferredGameplayTypes`
- `readingLevel`
- `ttsPreference`

偏好档案禁止保存：

- 学生真实姓名
- 头像或照片地址
- 语音样本
- 完整对话
- 精确画像或人格标签
- 学习弱点、错因和掌握情况

## LearningState 契约

`packages/core/src/course/product/learningState.ts` 提供学习状态能力：

- `createEmptyLearningState()`：创建空学习状态。
- `sanitizeLearningReportForPersistence()`：把学习报告压缩为结构化摘要。
- `updateLearningStateFromReport()`：按学科合并薄弱点、掌握目标、错因标签、提示次数和完成率。
- `deleteLearningStateForProfile()`：按 `profileId` 删除学习状态。
- `deleteProfileLearningMemory()`：同时清除 profile 关联的偏好和学习状态集合。

学习状态允许保存：

- `profileId`
- `subjectStates[].subject`
- `subjectStates[].weakPoints`
- `subjectStates[].masteredGoals`
- `subjectStates[].misconceptionTags`
- `subjectStates[].hintUsageCount`
- `subjectStates[].completionRate`
- `subjectStates[].lastCoursePackageId`

学习状态禁止保存兴趣偏好、主题偏好、完整学习过程逐字稿和学生原始输入。

## 隔离规则

- 偏好更新不能修改 `LearningState`，也不能写入 `weakPoints` 或 `misconceptionTags`。
- 学习报告更新不能修改 `StudentPreferenceProfile`，也不能把薄弱点作为兴趣或主题。
- 跨 `profileId` 的偏好更新和学习状态更新必须拒绝。
- 同一学科的学习状态可以累积错因和掌握目标；重复标签要去重。
- `hintUsageCount` 允许累积，`completionRate` 使用最近一次结构化报告值。

## 后续使用约束

- 智能输入向导可以读取偏好档案补齐低风险字段，但不能把学习弱点当作用户偏好。
- 课程续作可以读取学习状态决定下一课目标，但必须继承偏好时保持可解释边界。
- 家长数据删除入口必须同时调用偏好和学习状态删除逻辑。
