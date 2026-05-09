# 游戏化课程生成流程图 HTML 任务

## 背景

用户希望用 HTML 形式清晰呈现“游戏化课程从用户输入到最终课程输出”的完整流程，重点区分固定不变的受控链路、AI 改造的生成与评审环节、大步骤/小步骤、每步涉及的文件和操作。

## 目标

- 输出一个可直接打开的静态 HTML 流程图。
- 流程图必须渐进式展示：先总览，再展开阶段、小步骤、文件与操作。
- 内容必须贴合当前 OpenGame 课程生成真实链路，不做纯概念图。
- 明确标注：
  - 固定链路：schema、确认门、模板、mapper、验证、质量门禁。
  - AI 改造：一句话解析、方案生成、质量评分、自动修复、Course GDD、素材/TTS 生成建议。
  - 人工/外部确认：追问、方案确认、阻断处理。

## 设计方向

- 视觉主题：生成流水线控制台。
- 信息结构：
  1. 顶部概览：从输入到课程包的全链路。
  2. 左侧阶段导航：输入、解析、方案、确认、GDD、模板、素材、验证、输出。
  3. 主区流程：每个阶段包含固定/AI/人工标记和关键小步骤。
  4. 右侧详情：选中阶段后展示涉及文件、工具、输入输出和操作。

## 关键代码事实

- 一句话入口：`packages/sdk-typescript/src/course/createCourseGame.ts` 的 `createCourseGameFromPrompt()`。
- 结构化入口：`createCourseGame({ mode: 'plan_only' })`。
- 确认后入口：`createCourseGame({ mode: 'confirmed_generation' })`。
- 一句话解析工具：`packages/core/src/tools/generate-one-shot-course-plan.ts`。
- 方案生成工具：`packages/core/src/tools/generate-course-plan.ts`。
- Course GDD 工具：`packages/core/src/tools/generate-course-gdd.ts`。
- 模板映射：`packages/core/src/course/courseGddMapper.ts`。
- TTS manifest：`packages/core/src/tools/course-tts-manifest.ts`。
- 发布前验证：`packages/core/src/tools/validate-course-package.ts`。
- 课程模板：`agent-test/templates/modules/course_ui`、`course_grid`、`course_td`，以及 `agent-test/templates/course_runtime`、`agent-test/templates/playlets/*`。

## TODO

- [x] 阅读 `.agentdocs/index.md` 和课程生成相关文档。
- [x] 梳理 SDK、工具、mapper、TTS 和验证链路。
- [x] 创建静态 HTML 流程图文件。
- [x] 本地打开验证视觉、交互和文本可读性。
- [x] 完成任务回顾，判断是否需要长期文档/记忆。

## 任务回顾

- 已新增 `docs/course-flow/course-generation-flow.html` 作为可直接打开的流程图入口，并拆分 `docs/course-flow/course-generation-flow.css`、`docs/course-flow/course-generation-flow.js`，确保单文件低于 1000 行。
- 内容覆盖从一句话输入、CourseSpec、3 个方案、质量门禁、Course GDD、模板装配、素材/TTS、课程包验证到最终输出和续作的完整链路。
- 本任务只产出用户可读流程图，没有形成新的长期工程约束或复用代码模式，因此不新增全局记忆。
