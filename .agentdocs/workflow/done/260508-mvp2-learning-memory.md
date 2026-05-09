# MVP 2.0 阶段 3：偏好记忆与学习状态记忆

## 任务目标

基于 `prd/toc-course-mvp-2.md` 的阶段 3，补齐持续使用所需的两类长期记忆：

- 偏好记忆保存兴趣、主题、配色、玩法倾向、阅读水平和 TTS 偏好。
- 学习状态记忆保存薄弱点、掌握目标、错因标签、提示次数、完成率和上次课程包。
- 两类记忆通过 `profileId` 关联，但保持字段和更新路径隔离。
- 默认只保存结构化摘要，不保存完整对话、原始学生输入和敏感个人信息。

## 当前边界

- 不修改 MVP 1.0 受控生成核心。
- 不进入 MVP 2.0 阶段 4 的课程修订和轻量编辑器。
- 本阶段只新增产品层纯函数、产品文档和测试，不注册新工具。

## 落地计划

- [x] 完善 `packages/core/src/course/product/preferenceProfile.ts`，增加偏好创建、更新、持久化清洗和删除能力。
- [x] 完善 `packages/core/src/course/product/learningState.ts`，增加学习报告清洗、错因/掌握目标合并、提示次数、完成率和删除能力。
- [x] 新增 `packages/core/src/course/product/learningMemory.test.ts`，覆盖记忆隔离、错因更新、隐私清洗、数据删除和跨 profile 拒绝。
- [x] 新增 `agent-test/docs/product/mvp2-learning-memory.md`，记录偏好与学习状态边界。
- [x] 更新 `prd/toc-course-mvp-2.md` 阶段 3 TODO。

## 验证计划

- [x] `rtk npm run test --workspace=packages/core -- src/course/product/learningMemory.test.ts src/course/product/intakeSession.test.ts`
- [x] `rtk npm run test --workspace=packages/core -- src/course/product`
- [x] `rtk npm run typecheck --workspace=packages/core`
- [x] `rtk npm run lint --workspace=packages/core`

## 阶段完成状态

本阶段已完成。后续 MVP 2.0 应进入阶段 4：轻量编辑器与课程修订。
