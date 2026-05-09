# MVP 2.0 风格板预览与方案确认

## 读取场景

开发 MVP 2.0 生成前确认体验、风格板预览、方案确认页、讲解深度调节或前端/SDK 相关展示时必读。

## 核心边界

- 风格板预览只基于 `StyleSpec`、课程上下文和参考图描述生成，不直接触发图片、视频、音频或完整素材生成。
- 风格板预览输出面向生成前确认，后续素材生成仍必须以确认后的 CourseSpec、CoursePlanOption 和 Course GDD 为准。
- 方案确认页展示结构化摘要，不允许绕过 `selectedPlanId` 确认直接调用 `generate_course_gdd`。
- 讲解深度调节只重新计算 `CourseSpec.explanationDepth` 和方案评分摘要，不直接修改已生成源码。

## StylePreview 契约

`packages/core/src/course/product/stylePreview.ts` 输出：

- `styleSpec`：经过安全归一化的风格输入。
- `palette`：确认页可直接展示的配色。
- `characterDirection`：原创角色方向，不包含知名 IP 直引。
- `uiMood`：UI 情绪和信息密度描述。
- `referenceImageAnalysis`：只保留参考图构图、色彩和 UI 倾向，不保存图片本体。
- `forbiddenElements`：用户禁用元素与系统补充的风格安全禁用项。
- `previewPrompt`：可进入后续风格图或素材提示的原创风格提示词。
- `safetyWarnings`：被移除或降级的知名 IP 风格引用。

## 风格安全规则

- `previewPrompt` 不能直接包含知名 IP 名称、角色名或要求“像某作品一样”的表达。
- 当前阻断类别包括：宝可梦、迪士尼/冰雪奇缘、马里奥/任天堂、漫威、哈利波特、小黄人、Minecraft 等高风险直引。
- 参考图只允许沉淀抽象分析，不能把原图地址、儿童照片或可识别个人信息写入预览模型。
- 被阻断的 IP 引用应进入 `safetyWarnings` 和 `forbiddenElements`，后续素材生成继续继承禁用。

## 方案确认摘要

`buildCoursePlanConfirmationSummary(courseSpec, options)` 输出每个方案的确认页摘要：

- 基础信息：`id`、`title`、`courseArchetype`、`gameplayType`。
- 评分：学习匹配、讲解深度匹配、趣味、适龄、安全、成本和稳定性。
- 风险：直接复用 `CoursePlanOption.risks`，前端不应隐藏。
- 预计成本：基于素材复杂度和课程时长估算，用于比较方案，不代表实际计费。
- 预计时长：基于课程时长、讲解深度和 workflow 节点数估算。
- 讲解深度摘要：展示例题、引导练习、独立挑战、迁移任务和深度匹配。

## 讲解深度调节

`adjustCoursePlanDepth(courseSpec, options, depthLevel)` 用于确认页切换 `intro/standard/deep/challenge`：

- 输出新的 `CourseSpec` 和重算后的确认摘要。
- `standard/deep/challenge` 会确保必要的先验检查、例题、练习、迁移任务和逐步反馈。
- 该函数只重评方案，不生成 Course GDD，不触发素材生成。

