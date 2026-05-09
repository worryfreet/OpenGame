# MVP 3.0 Course Studio 客户端界面任务

状态：历史方案，已被当前 Agent 入口重构取代。后续 Course Studio 不再做 Ink TUI、本地客户端或网页壳，只作为 OpenGame 原始 Agent 生成链路的课程 prompt 入口。

## 任务目标

补齐 MVP 3.0 的可视化手动测试入口：不做网页，基于现有 Ink 终端客户端实现一个丝滑的 Course Studio，让用户可以在本地客户端中输入一句话课程目标，看到解析、追问/阻断、质量门禁、方案预览和生成链路提示。

客户端必须复用已有受控链路，不允许为了界面绕过 `CourseSpec`、`generate_one_shot_course_plan`、`generate_course_plan`、`score_course_quality` 和确认后 Course GDD 流程。

## 已阅读上下文

- `.agentdocs/index.md`
- `.agentdocs/prd/toc-course-mvp-3.md`
- `.agentdocs/workflow/done/260509-mvp3-one-shot-quality.md`
- `packages/cli/src/gemini.tsx`
- `packages/cli/src/config/config.ts`
- `packages/cli/src/ui/AppContainer.tsx`
- `packages/sdk-typescript/src/course/createCourseGame.ts`

## 分阶段计划

### 阶段 1：客户端入口与任务边界

- [x] 新增 CLI 参数或模式，启动 Course Studio 客户端界面。
- [x] 保留普通 OpenGame CLI 行为不变。
- [x] 明确界面只做课程入口，不替代课程生成核心链路。

### 阶段 2：Course Studio TUI

- [x] 实现 Course Studio 主界面：输入区、阶段轨道、解析结果、方案/质量预览、操作提示。
- [x] 支持键盘输入、Enter 解析、Ctrl+C/ESC 退出。
- [x] 视觉上保持客户端工作台风格，避免网页化或营销页。

### 阶段 3：MVP 3.0 链路接入

- [x] 输入一句话后调用 `generateOneShotCoursePlan()` 本地解析。
- [x] 信息不足时显示关键追问；阻断时显示原因。
- [x] 信息充分时构造 3 个本地快速预估方案，并运行 `scoreCourseQuality()` 展示门禁结果与分项。
- [x] 明确提示完整 Agent 生成链路使用 `createCourseGameFromPrompt({ mode: 'plan_only' })`，正式方案仍由 `generate_course_plan` 生成并复评。

### 阶段 4：验证与文档

- [x] 补 CLI 参数解析测试。
- [x] 补 Course Studio 组件测试。
- [x] 更新 `.agentdocs/index.md` 和必要产品/质量文档。
- [x] 运行相关 lint/typecheck/test/build。

## 质量回顾要求

- [x] 检查界面是否真的能让用户手动测试 MVP 3.0，而不是只显示静态说明。
- [x] 检查是否绕过受控课程生成链路。
- [x] 检查是否引入网页或不必要的新框架。
- [x] 任务完成后移动到 `workflow/done/` 并更新索引。

## 关键决策

- Course Studio 使用现有 Ink 终端客户端，不做网页、不引入 Electron。
- 普通 CLI 不静态加载 Course Studio；仅在 `--course-studio` 分支内动态加载客户端入口。
- TUI 中的 3 个方案是本地快速预估，用于手动判断 CourseSpec、玩法方向和质量门禁分项；正式生成链路仍必须由 Agent 调用 `generate_one_shot_course_plan`、`generate_course_plan`、`score_course_quality`、`repair_course_generation` 和确认后的 `generate_course_gdd`。
- 界面提供学生视角/内部视角切换：学生视角隐藏直白教学目标，内部视角展示 CourseSpec、评价点和质量分项。

## 验证记录

- `rtk npm run build --workspace=packages/core`
- `rtk npm run typecheck --workspace=packages/cli`
- `rtk npm run lint --workspace=packages/cli -- --quiet`
- `rtk npm run test --workspace=packages/cli -- courseStudio config.test.ts`
- `rtk npm run build --workspace=packages/cli`
