# MVP 2.0 家长控制与失败恢复

## 任务目标

完成 `.agentdocs/prd/toc-course-mvp-2.md` 阶段 6：让家长控制不只停留在输入层，而是贯穿 `CourseSpec`、`CourseGDD`、资产计划和发布校验；同时建立生成失败恢复模型，记录失败阶段、可复用产物、降级选项、重试次数和成本上限。

## 落地计划

- [x] 阅读现有产品层：`intakeSession.ts`、`guardianPolicy.ts`、`courseRevision.ts`、`nextCoursePlanner.ts`。
- [x] 扩展 `guardianPolicy.ts`：补齐策略校验、Course GDD 策略应用、资产阶段跳过判断和发布前策略校验。
- [x] 新增 `generationRecovery.ts`：定义恢复阶段、失败记录、可复用产物、降级选项、重试/成本预算和恢复决策。
- [x] 新增阶段 6 单元测试：覆盖时长策略、禁用视频、TTS 字幕降级、连续失败超过上限。
- [x] 输出 `agent-test/docs/product/mvp2-guardian-policy.md`。
- [x] 更新 `.agentdocs/index.md` 和 MVP 2.0 PRD 阶段 6 状态。

## 关键决策

- 家长策略属于产品边界层，默认先通过纯函数应用到结构化对象，不让后续素材、TTS 或发布工具临时猜测策略。
- 禁用视频时，`CourseGDD.assetPlan.video` 必须被清空，`validationPlan` 移除视频必检项，并补充静态过场/字幕 fallback 检查。
- TTS 失败不直接阻断课程，恢复层产出 `subtitle_fallback` 降级决策，后续仍必须由 `course_tts_manifest` 写入字幕 manifest，再由 `validate_course_package` 验证。
- 恢复策略以 `maxRetryCount` 和 `maxEstimatedCostCents` 双上限阻断，避免 ToC 场景中无限重试或隐性成本失控。

## 验证记录

- [x] `rtk npm run test --workspace=packages/core -- guardianPolicy generationRecovery intakeSession validate-course-package`
- [x] `rtk npm run typecheck --workspace=packages/core`
- [x] `rtk npm run lint --workspace=packages/core`
