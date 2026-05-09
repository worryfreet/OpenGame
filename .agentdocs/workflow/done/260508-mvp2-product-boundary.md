# MVP 2.0 产品输入与状态边界任务

## 任务背景

本任务按 `prd/toc-course-mvp-2.md` 推进 MVP 2.0 阶段 0。阶段 0 只建立产品化输入、偏好记忆、学习状态和家长策略的最小边界，不修改 MVP 1.0 的 CourseSpec、方案生成、Course GDD、模板、TTS 和课程包验证核心链路。

## 本阶段目标

- [x] 明确 2.0 不改 1.0 的生成核心，只新增产品化输入、记忆、编辑和续作层。
- [x] 定义 `IntakeSession`、`StudentPreferenceProfile`、`LearningState`、`GuardianPolicy` 的最小字段。
- [x] 定义数据最小化规则：不保存学生真实姓名、头像、语音和精确画像；偏好与学习状态按 `profileId` 关联。
- [x] 输出 `agent-test/docs/product/mvp2-intake-flow.md`。

## 落地计划

- [x] 新增 `packages/core/src/course/product/guardianPolicy.ts`，承接家长时长、上传图片、视频和内容严格度边界。
- [x] 新增 `packages/core/src/course/product/preferenceProfile.ts`，只保存兴趣、主题、配色、玩法和阅读/TTS 偏好。
- [x] 新增 `packages/core/src/course/product/learningState.ts`，只保存学科掌握点、薄弱点、错因和上次课程包。
- [x] 新增 `packages/core/src/course/product/intakeSession.ts`，表达自然输入进入 CourseSpec 前的字段完整性、追问和假设。
- [x] 在 `packages/core/src/index.ts` 导出 product 层最小 API。
- [x] 新增单元测试覆盖缺失年级、缺失学科、上传图片被禁用、时长超限和隐私最小化。

## 验证记录

- [x] `rtk npm run test --workspace=packages/core -- src/course/product`
- [x] `rtk npm run typecheck --workspace=packages/core`
- [x] `rtk npm run lint --workspace=packages/core`

## 阶段结论

阶段 0 已完成。MVP 2.0 后续阶段应在 product 层之上继续实现智能输入向导、风格预览、修订和续作工具，不应把自然语言输入、长期记忆或家长控制逻辑散落进 1.0 的生成工具内部。
