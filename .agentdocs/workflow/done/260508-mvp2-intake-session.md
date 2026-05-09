# MVP 2.0 智能输入向导任务

## 任务背景

本任务按 `prd/toc-course-mvp-2.md` 推进 MVP 2.0 阶段 1。阶段 1 在阶段 0 的产品输入边界上，实现自然语言、部分 `CourseSpec`、历史偏好和家长限制合并成 `IntakeSession`，并在信息足够时转换为 MVP 1.0 的受控 `CourseSpec`。

## 本阶段目标

- [x] 新增或扩展 `packages/core/src/course/product/intakeSession.ts`，支持自然语言补全和低影响默认值。
- [x] 新增 `packages/core/src/tools/complete-course-intake.ts` 工具入口。
- [x] 补充 `packages/core/src/course/product/intakeSession.test.ts` 与工具测试。
- [x] `status === ready_for_plan` 时必须能转换成 1.0 的 `CourseSpec`。

## 落地计划

- [x] 梳理现有 `CourseSpec`、`GuardianPolicy`、`StudentPreferenceProfile` 和工具注册模式。
- [x] 初始化阶段任务文档并登记 `.agentdocs/index.md`。
- [x] 实现自然语言提取：年级、学科、主题、学习目标、风格、讲解深度、时长。
- [x] 对低影响字段使用默认值并记录 `assumptions`，只对高影响缺失字段追问。
- [x] 接入家长策略：禁用上传图片时移除参考图，时长超限时缩短。
- [x] 新增 `complete_course_intake` 工具并注册导出。
- [x] 跑单元测试、类型检查和 lint。

## 验证计划

- [x] “三年级面积太空风格”能补出年级、学科、主题、候选目标、风格。
- [x] 缺少年级时必须追问。
- [x] 家长禁用上传图片时，参考图字段被拒绝或降级。
- [x] ready 状态可转换成 `CourseSpec` 并通过 `validateCourseSpec()`。
- [x] `complete_course_intake` 工具返回结构化 `IntakeSession`。

## 阶段结论

阶段 1 已完成。后续阶段应复用 `complete_course_intake` 的输出作为产品输入入口；自然语言只在产品层补全和追问，进入 MVP 1.0 生成链路前仍必须落为受控 `CourseSpec`。
