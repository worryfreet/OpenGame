# Course Studio Mac App 式客户端改造

状态：历史方案，已被 `workflow/260509-course-studio-agent-entry.md` 取代。后续不得以本文作为 Course Studio 入口方向依据；Course Studio 应回归 OpenGame Agent 生成入口，不做网页客户端、Mac App 式页面或独立 TUI。

## 任务目标

将 `npm run start --workspace=packages/cli -- --course-studio` 从 Ink TUI 改为本地可视化客户端启动方式：CLI 启动本地 Course Studio 会话并自动打开桌面应用感的窗口界面，不再进入终端 TUI。

界面需要覆盖课程输入从快速目标、详细偏好到完整填写的能力，但客户端不展示 MVP 等内部阶段概念。它必须支持缺失信息追问、课程进度展示、方案预览、最终游戏课程展示，并提供真实可点击的课程试玩交互。

## 已阅读上下文

- `.agentdocs/index.md`
- `.agentdocs/workflow/done/260509-mvp3-course-studio-client.md`
- `packages/cli/src/gemini.tsx`
- `packages/cli/src/config/config.ts`
- `packages/cli/src/ui/course/runCourseStudio.tsx`
- `packages/cli/src/ui/course/courseStudioModel.ts`
- `packages/sdk-typescript/src/course/createCourseGame.ts`
- `packages/core/src/course/product/intakeSession.ts`
- `packages/core/src/course/product/stylePreview.ts`

## 约束与关键决策

- 本轮用户明确不需要 `rtk` 前缀，验证命令直接执行。
- 不引入 Electron 等重型依赖；采用本地 HTTP 会话自动打开浏览器页面，界面按 macOS 应用窗口风格设计。
- CLI 只负责启动和承载本地客户端，不再 render Ink TUI。
- 本地界面的方案仍是低成本预览；完整课程生成继续遵循内部受控生成流程。
- 最终游戏课程展示先提供基于所选课程流程的可交互试玩模拟器，用于验证输入、方案、进度和反馈闭环。
- 客户端文案面向真实用户，不展示 MVP、CourseSpec、Workflow、Agent、SDK、plan_only 等技术名词。

## Agents Team

- Explorer A：只读分析 CLI Course Studio 启动入口和 Ink TUI 调用链。
- Explorer B：只读分析课程生成 MVP 1-3 产品/SDK 链路和可复用 API。
- Explorer C：只读分析 CLI 测试、构建和课程 smoke 验证约束。
- 主 Agent：负责阶段计划、实现、集成、测试、阶段性批判检查和最终产品 Review。

## 分阶段计划

### 阶段 1：入口与边界梳理

- [x] 确认 `--course-studio` 当前从 `gemini.tsx` 动态加载 `runCourseStudio()`。
- [x] 确认现有 TUI 位于 `packages/cli/src/ui/course/`，主要依赖 Ink。
- [x] 确认可复用本地预检模型 `analyzeCourseStudioGoal()` 和 core 课程质量 API。
- [x] 明确本轮不改普通 OpenGame TUI 和通用对话入口。

### 阶段 2：本地客户端服务

- [x] 用本地 HTTP server 替换 Ink render 入口。
- [x] 支持自动打开浏览器页面、端口自动分配、Ctrl+C 退出服务。
- [x] 提供 JSON API：读取状态、分析输入、选择方案、执行课程试玩动作。
- [x] 保留 `--course-goal` 预填一句话目标能力。

### 阶段 3：Mac App 式界面

- [x] 实现 macOS 窗口式 Course Studio 页面：标题栏、侧边流程、主工作区、右侧课程预览。
- [x] 实现快速目标、详细偏好、完整填写三种用户输入方式。
- [x] 展示追问、假设、阻断原因、课程信息摘要、风格预览和方案推荐度。
- [x] 展示课程进度轨道和选中方案课程流程。

### 阶段 4：最终课程展示与交互

- [x] 基于所选方案课程流程生成课程试玩状态。
- [x] 支持开始课程、选择行动、请求提示、提交判断、推进节点。
- [x] 展示完成率、提示次数、正确判断、最终学习报告摘要。
- [x] 确保学生可见文案不直接暴露内部学习目标。

### 阶段 5：批判检查、产品 Review 与修复

- [x] 阶段实现后检查是否仍存在 TUI 运行路径。
- [x] 检查界面是否真正覆盖多种输入和追问，而不是静态展示。
- [x] 检查交互是否能推动课程状态和最终报告。
- [x] 从产品视角检查信息密度、操作路径、空状态和错误状态。

### 阶段 6：测试与文档回顾

- [x] 更新/新增 Course Studio 模型和服务测试。
- [x] 更新 CLI 启动分支测试。
- [x] 运行相关 lint、typecheck、test、build。
- [x] 根据任务回顾更新索引；完成后将任务文档移动到 `workflow/done/`。

## 阶段性批判记录

- 入口检查：`runCourseStudio()` 不再 import Ink 或 readline，`--course-studio` 启动本地 HTTP 会话并自动打开页面；普通 OpenGame TUI 不受影响。
- 产品检查：客户端不再展示 MVP、Agent、SDK、Workflow、CourseSpec、plan_only 等技术名词；流程改为“快速目标、详细偏好、完整填写、课程方向、课程试玩、继续生成”等用户语言。
- 交互检查：真实 HTTP API 验证了追问态不生成方案、完整输入生成 3 个课程方向、课程试玩可推进到 100% 并生成学习报告摘要。
- 风险保留：当前“完整课程游戏”展示是基于课程流程的可交互试玩模拟器，真实课程包生成仍由后续完整生成链路执行。

## 验证记录

- `npm run test --workspace=packages/cli -- courseStudio gemini.test.tsx config.test.ts`
- `npm run lint --workspace=packages/cli -- --quiet`
- `npm run typecheck --workspace=packages/cli`
- `npm run build --workspace=packages/cli`
- 本地启动 `npm run start --workspace=packages/cli -- --course-studio --course-goal "四年级数学，太空基地主题，让孩子理解长方形面积公式不是死背。"` 后通过 HTTP API 验证页面、追问、方案选择和课程试玩闭环。
