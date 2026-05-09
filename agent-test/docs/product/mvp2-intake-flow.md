# MVP 2.0 输入向导与状态边界

## 适用场景

本文档用于开发 MVP 2.0 的产品化输入、偏好记忆、学习状态和家长控制。它定义 CourseSpec 之前的产品层边界，不替代 MVP 1.0 的 `CourseSpec`、`CoursePlanOption`、`CourseGDD` 和课程包验证协议。

## 核心原则

- MVP 2.0 不改 MVP 1.0 受控生成核心，只在生成前增加输入补齐、记忆、编辑、续作和家长限制。
- 自然语言输入必须先进入 `IntakeSession`，只有 `status === ready_for_plan` 时才可转换为 `CourseSpec`。
- 缺少年级、学科、主题、学习目标或讲解深度时必须追问；缺少时长或风格时可使用默认值并记录 assumption。
- 家长策略优先级高于学生偏好和自然语言输入。
- 长期记忆只保存结构化摘要，不保存原始对话和敏感个人信息。

## 最小模型

### IntakeSession

`IntakeSession` 记录一次输入收集过程：

- `sessionId`：本次输入会话。
- `rawInput`：当前输入原文，仅用于本次会话，不进入长期持久化。
- `knownFields`：已经识别出的 `Partial<CourseSpec>`。
- `missingFields`：缺失字段及影响等级。
- `followUpQuestions`：只针对高影响缺失字段追问。
- `assumptions`：低影响缺失字段的默认假设。
- `confidence`：字段完整度置信度。
- `status`：`collecting`、`ready_for_plan` 或 `blocked`。

### StudentPreferenceProfile

偏好档案只影响风格、玩法倾向和交互偏好：

- `profileId`
- `grade`
- `interests`
- `preferredThemes`
- `preferredPalette`
- `preferredGameplayTypes`
- `readingLevel`
- `ttsPreference`

禁止保存学生真实姓名、头像、语音样本、完整对话和精确画像。

### LearningState

学习状态只影响课程目标、难度、错因和下一课推荐：

- `profileId`
- `subjectStates[].subject`
- `subjectStates[].weakPoints`
- `subjectStates[].masteredGoals`
- `subjectStates[].misconceptionTags`
- `subjectStates[].lastCoursePackageId`

学习状态不得写入兴趣偏好，避免把薄弱点误当成学生喜欢的主题。

### GuardianPolicy

家长策略影响 CourseSpec 生成、素材计划和发布校验：

- `maxSessionMinutes`
- `allowUploadedImages`
- `allowGeneratedVideo`
- `contentStrictness`
- `maxRetryCount`
- `maxEstimatedCostCents`

当输入与家长策略冲突时，产品层应优先缩短时长、移除参考图或关闭视频，而不是把冲突传给后续生成工具。

## 进入 CourseSpec 的条件

满足以下条件才可以调用 MVP 1.0 的 `generate_course_plan`：

- `IntakeSession.status === ready_for_plan`
- `knownFields` 可完整组成 `CourseSpec`
- 家长策略已经写入 `studentProfile.guardianLimits`
- 低影响缺失字段已有明确 assumption
- 不包含学生真实姓名、头像、语音样本、完整对话或精确画像

## 阶段 0 不做范围

- 不做自然语言解析和补全实现。
- 不注册新工具。
- 不改 `generate_course_plan`、`generate_course_gdd`、mapper、模板或验证工具。
- 不实现前端确认页。
