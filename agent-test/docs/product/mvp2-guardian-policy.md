# MVP 2.0 家长控制与失败恢复

## 适用范围

本文档用于开发 ToC 未成年人产品边界、生成失败恢复和发布前校验。它补充 `mvp2-intake-flow.md` 中的 GuardianPolicy，不替代 Course GDD、资产 manifest 或课程包验证协议。

## GuardianPolicy 生效链路

家长策略必须按顺序进入四个层级：

1. 输入层：`complete_course_intake` 或产品层调用 `applyGuardianPolicyToCourseSpec()`，缩短超限时长、移除禁用上传参考图，并写入 `studentProfile.guardianLimits`。
2. GDD 层：调用 `applyGuardianPolicyToCourseGdd()`，同步 `CourseSpec`，并根据策略修正 `assetPlan` 与 `validationPlan`。
3. 素材层：调用 `getAssetGenerationGuard()` 判断哪些素材生成阶段必须跳过。禁用视频时不得调用视频资产生成。
4. 发布层：调用 `validateGuardianPolicyForPublish()` 或 `validate_course_package` 做阻断检查。存在 `error` 时不能发布。

## 策略规则

- `maxSessionMinutes`：单次课程时长上限。CourseSpec 超限时应自动缩短并记录 warning；发布包仍超限则阻断。
- `allowUploadedImages`：关闭时移除 `styleSpec.referenceImages`；发布包保留参考图则阻断。
- `allowGeneratedVideo`：关闭时清空 `assetPlan.video`，移除视频必检项，补充静态过场/字幕 fallback；素材阶段不得调用视频生成。
- `contentStrictness`：进入 `guardianLimits`，发布校验会按 normal/strict 追加不适龄词和消费诱导检查。
- `maxRetryCount`：生成失败恢复的自动重试上限。
- `maxEstimatedCostCents`：单次课程生成预算上限，恢复层按累计成本阻断。

## 失败恢复模型

生成恢复统一使用 `generationRecovery.ts`：

- `GenerationRecoveryState` 记录 session、profile、当前阶段、失败列表、可复用产物和累计成本。
- `recordGenerationFailure()` 在每次失败时记录阶段、原因、attemptNumber、成本和可复用产物。
- `decideGenerationRecovery()` 只返回结构化恢复决策，不直接执行工具。

可恢复阶段：

- `plan_confirmation`：可复用 CourseSpec 重试方案确认。
- `course_gdd`：可复用 CourseSpec 或已确认方案重试 GDD。
- `asset_generation`：可复用 CourseGDD，必要时降级为模板静态视觉。
- `tts`：降级为字幕旁白，继续课程包验证。
- `package_validation`：可复用 CourseGDD 与包目录修复阻断项。

阻断条件：

- 当前阶段缺少可靠恢复点。
- 同一阶段失败次数超过 `maxRetryCount`。
- 累计成本超过 `maxEstimatedCostCents`。

## TTS 降级

TTS 失败不直接阻断课程生成。恢复决策应返回 `subtitle_fallback`，后续必须调用 `course_tts_manifest` 写入包含 `fallbackSubtitle` 的 narration manifest。`validate_course_package` 对字幕降级只给 warning；缺少音频且无字幕 fallback 才阻断。

## 后续开发约束

- 新增生成阶段时，必须明确它是否可恢复，以及可复用产物是什么。
- 不允许在资产生成或发布阶段绕过 GuardianPolicy 重新启用上传图、视频或超时长课程。
- 恢复层只做决策，不直接调用 LLM、素材服务、TTS 服务或文件写入工具。
- 面向用户的错误必须解释失败阶段、已保留内容、下一步可重试或需要修改的输入。
