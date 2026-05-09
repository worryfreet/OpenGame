# MVP 2.0 阶段 4：轻量编辑器与课程修订

## 任务目标

基于 `prd/toc-course-mvp-2.md` 的阶段 4，补齐生成前和 Course GDD 后的结构化修订能力：

- 只允许编辑结构化计划，不直接改生成后的课程源码。
- 支持修改主题、讲解深度、题目、角色/配色、视频开关和 TTS 风格。
- 修改后重新校验 `CourseSpec`、`CoursePlanOption` 或 `CourseGDD`。
- 替换题目时必须校验答案、解析、错因和提示。
- 禁用视频时同步更新 `assetPlan` 与 `validationPlan`。

## 当前边界

- 本阶段不实现可视化前端编辑器，只提供产品层纯函数、核心工具和 SDK wrapper。
- 本阶段不重新生成 Course GDD，只对已有结构化对象应用确定性变更。
- 若修订导致对象不满足现有课程校验，应返回阻断项，不自动绕过校验。

## 落地计划

- [x] 新增 `packages/core/src/course/product/courseRevision.ts`，定义修订请求、结果、变更应用和校验。
- [x] 新增 `packages/core/src/tools/revise-course-plan.ts`，提供 `revise_course_plan` 核心工具。
- [x] 新增 `packages/sdk-typescript/src/course/reviseCoursePlan.ts`，暴露 SDK wrapper 和 prompt 构造。
- [x] 注册工具名、显示名、config core tool、核心导出和 SDK 导出。
- [x] 新增阶段 4 单元测试，覆盖深度校验、题目校验、禁用视频和 SDK 工具集。
- [x] 更新 `prd/toc-course-mvp-2.md` 阶段 4 TODO。

## 验证计划

- [x] `rtk npm run test --workspace=packages/core -- src/course/product/courseRevision.test.ts src/tools/revise-course-plan.test.ts`
- [x] `rtk npm run test --workspace=@opengame/sdk -- test/unit/reviseCoursePlan.test.ts`
- [x] `rtk npm run typecheck --workspace=packages/core`
- [x] `rtk npm run typecheck --workspace=@opengame/sdk`
- [x] `rtk npm run lint --workspace=packages/core`
- [x] `rtk npm run lint --workspace=@opengame/sdk`

## 阶段完成状态

已完成。阶段 4 已提供结构化课程修订纯函数、`revise_course_plan` 核心工具和 SDK wrapper；修订只作用于 `CourseSpec`、`CoursePlanOption` 或 `CourseGDD`，阻断项由统一课程校验返回。
