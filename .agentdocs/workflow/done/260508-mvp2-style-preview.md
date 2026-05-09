# MVP 2.0 阶段 2：风格板预览与方案确认增强

## 任务目标

基于 `prd/toc-course-mvp-2.md` 的阶段 2，补齐生成前产品化确认能力：

- 在进入完整素材生成前，基于 `StyleSpec` 输出可解释、可校验的 `StylePreview`。
- 在方案确认时展示评分、风险、预计成本、预计时长和讲解深度差异。
- 支持讲解深度从 `standard` 调整到 `deep` 等级后重新计算方案评分，但不直接进入 Course GDD。
- 阻断知名 IP 风格直接进入 `previewPrompt`，避免把侵权或不可控风格传入后续素材生成。

## 当前边界

- 不修改 MVP 1.0 的受控生成核心，不改变 `generate_course_gdd` 的确认前置要求。
- 不进入 MVP 2.0 阶段 3 的偏好记忆和学习状态记忆。
- 本阶段只新增产品层纯函数、工具包装、工具注册、文档和测试。

## 落地计划

- [x] 新增 `packages/core/src/course/product/stylePreview.ts`，定义 `StylePreview`、风格安全归一化、方案确认摘要和深度调节重评分函数。
- [x] 新增 `packages/core/src/tools/generate-style-preview.ts`，把风格板预览作为正式核心工具暴露。
- [x] 在 `tool-names.ts`、`config.ts`、`index.ts` 注册并导出 `GenerateStylePreview`。
- [x] 补充 `agent-test/docs/product/mvp2-style-preview.md`，记录输入输出、禁用规则和确认页数据契约。
- [x] 补充单元测试，覆盖 StylePreview 字段、知名 IP 禁用、深度调整重评分和工具注册。

## 验证计划

- [x] `rtk npm run test --workspace=packages/core -- stylePreview generate-style-preview`
- [x] `rtk npm run test --workspace=packages/core -- generate-course-plan`
- [x] `rtk npm run test --workspace=packages/core -- src/config/config.test.ts`
- [x] `rtk npm run typecheck --workspace=packages/core`
- [x] `rtk npm run lint --workspace=packages/core`
- [x] `rtk npx prettier --check ...` 输出 `Prettier: All files formatted correctly`，但当前环境返回非零退出码。

## 阶段完成状态

本阶段已完成。后续 MVP 2.0 应进入阶段 3：偏好记忆与学习状态记忆。
