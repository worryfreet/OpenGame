# MVP 2.0 学习报告深化与课程续作

## 目标

完成 MVP 2.0 阶段 5：从 1.0 的学习报告与已沉淀的学习状态中提取掌握点、错因、提示使用情况和下一步目标，生成下一课 `CourseSpec`，并通过 core tool 与 SDK 暴露给 ToC 产品层。

## 边界

- 只新增产品化续作层，不修改 MVP 1.0 课程生成核心。
- 下一课必须复用必要偏好，例如年级、阅读水平、兴趣、配色和 TTS 偏好，但不能盲目重复同一玩法。
- 学习状态不足时不生成 `CourseSpec`，返回输入向导可消费的追问。
- 学习报告只保存结构化摘要，不保存完整对话、学生真实姓名或原始输入。

## 落地计划

- [x] 新增 `packages/core/src/course/product/nextCoursePlanner.ts`，实现报告解析、学习状态合并和下一课决策。
- [x] 新增 `packages/core/src/tools/generate-next-course-spec.ts`，注册 `generate_next_course_spec` 工具。
- [x] 扩展 `packages/sdk-typescript/src/course/createCourseGame.ts`，提供课程续作 SDK wrapper。
- [x] 补齐 core、tool、SDK 测试，覆盖单位混淆强化、偏好继承且玩法变化、状态不足时追问。
- [x] 更新 MVP 文档和索引文档，任务完成后归档本任务文档。

## 验证计划

- `rtk npx vitest run packages/core/src/course/product/nextCoursePlanner.test.ts packages/core/src/tools/generate-next-course-spec.test.ts`
- `rtk npx vitest run packages/sdk-typescript/test/unit/createCourseGame.test.ts`
- `rtk npm run typecheck --workspace=packages/core --if-present`
- `rtk npm run typecheck --workspace=packages/sdk-typescript --if-present`
