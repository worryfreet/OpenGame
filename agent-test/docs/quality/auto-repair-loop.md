# MVP 3.0 自动修复循环与经验库

## 使用场景

本文档用于开发课程质量门禁后的自动修复、降级路径和模板经验沉淀。自动修复产出结构化决策、`AutoRepairAttempt` 记录和 `executionPlan` 执行链路；工具本身不直接调用 LLM、素材服务、TTS 服务或浏览器，但上层 Agent/SDK 必须按执行链路继续重写、复评、重试或降级验证。

## 修复对象

自动修复对象覆盖七类生成阶段：

- `plan`：课程方案精彩度不足、玩法循环弱或换皮问答时重写方案。
- `gdd`：Course GDD 结构不完整、教学层次或验证计划缺失时修订 GDD。
- `asset`：图片、视频或素材服务失败时降级为模板静态视觉，并把资产复杂度降为 `low`。
- `tts`：TTS 失败时生成字幕旁白降级，并要求 narration manifest 包含 `fallbackSubtitle`。
- `build`：模板构建或类型检查失败时修复阻断项后重跑验证。
- `browser`：浏览器 smoke 失败时调整流程或 runtime 状态节点后重跑关键路径。
- `quality`：综合质量门禁失败时回到受控链路重写方案或 GDD。

## 预算与轮数

自动修复必须兼容 `product/generationRecovery` 的 GuardianPolicy 概念：

- `maxRetryCount` 表示家长允许的自动重试预算，可作为产品层默认重试约束。
- `maxEstimatedCostCents` 是单次课程生成的累计成本上限，自动修复每次决策都要估算成本。
- 自动修复循环还可设置 `maxRounds`，默认 3 轮；超过轮数或预算时返回可解释错误。
- 每次可执行修复都必须记录 `AutoRepairAttempt`，包含目标、动作、轮次、估算成本、累计成本和 fallback 检查项。
- 每个非阻断决策必须返回 `executionPlan`。plan/quality 修复后必须重新调用 `score_course_quality`；gdd 修复后必须重新执行 Course GDD schema、闭环校验和质量复核；asset/tts/build/browser 修复后必须重新运行对应验证。

## 降级路径

降级只在可保留学习目标和课程结构时使用：

- 素材降级保留 Course GDD，清空视频计划，补充“图片生成失败使用模板占位图”和“视频失败使用静态过场”检查。
- TTS 降级保留旁白文本，补充“TTS 失败显示字幕”和“旁白 manifest 包含 fallbackSubtitle”检查。
- plan、gdd、build、browser、quality 默认继续受控修复；无法在预算内恢复时返回可解释错误。

## 经验库隐私规则

经验库只保存结构化摘要，不保存以下隐私或原始内容：

- 学生姓名
- 头像
- 语音样本
- 完整对话
- 原始学生输入
- 逐字对话

成功经验和失败经验都使用统一的 `TemplateExperienceSummary`，只包含学科、主题标签、年级段、模板族、玩法类型、学习目标标签、风格标签、结果标签和结构化 insight。相似检索基于这些结构化字段，不依赖原文 embedding 或原始对话。
