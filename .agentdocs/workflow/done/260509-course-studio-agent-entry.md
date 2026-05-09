# Course Studio 回归 OpenGame Agent 入口重构

## 任务目标

Course Studio 不再做网页客户端、独立 TUI 或静态预览壳。它应回到 OpenGame 原始使用方式：用户输入学生的目标学习需求，CLI 经过原有配置、认证、沙箱、工具和 Agent 执行链路，最终输出一门游戏化课程。

## 原入口分析

- 普通入口：`opengame [query]` 或 `--prompt` 进入 `parseArguments()`，再由 `loadCliConfig()` 生成 `Config`。
- 交互入口：无 prompt 且 TTY 时进入 Ink `AppContainer`。
- 非交互入口：有 `prompt/query` 时进入 `runNonInteractive()`，调用模型流、执行工具、写文件，最终完成生成任务。
- 工具执行：`runNonInteractive()` 接收 prompt 后通过 `geminiClient.sendMessageStream()` 驱动 Agent，遇到 tool call 时用 `executeToolCall()` 执行核心工具。
- 课程能力：课程生成工具已注册在 core，SDK prompt 里已有一句话课程入口、方案生成、质量评分、确认后生成课程包等内部协议。

## 新设计

- `--course-studio` 不再提前 `process.exit(0)`，不再启动网页或独立 TUI。
- `--course-studio` 会把 `--course-goal`、`--prompt` 或 positional query 转成课程生成 prompt；当前是 TTY 时，先由 CLI 使用本地课程解析器检查年级、学科、主题、学习目标和讲解深度是否足够，不足则继续在 CLI 里收集补充信息，避免进入非交互模型后追问并退出。
- 生成 prompt 明确要求：沿用已收集的学习需求；信息充分后调用课程工具，最终产出可玩的游戏化课程；除安全阻断或完全无法判断课程方向外，不把普通追问作为最终结果。
- 之后继续走 OpenGame 原本的 `loadCliConfig()`、认证、沙箱、`runNonInteractive()` 和工具执行链路。
- 用户看见的是原 OpenGame CLI 的生成过程和最终产物，不是单独客户端壳。面向学生/家长的文案不得暴露 Agent、MVP、CourseSpec、Workflow、SDK、plan_only 等内部实现名词。
- 课程入口默认以完成课程为目标：信息足够时可自动选择课程工具返回的推荐方案继续生成；信息不足或用户偏好冲突时再追问。

## TODO

- [x] 分析原始 OpenGame prompt 到 Agent 的调用链。
- [x] 删除 Course Studio 网页客户端实现。
- [x] 将 `runCourseStudio` 改为构造课程生成 prompt 的纯工具。
- [x] 修改 `gemini.tsx`：`--course-studio` 注入 prompt 后继续走原链路。
- [x] 调整参数帮助文案和测试。
- [x] 运行 lint、typecheck、targeted test、build。
- [x] 更新索引和完成任务文档。

## 批判检查

- 入口已回到原生 CLI/Agent 链路，没有再启动网页、独立 TUI 或本地 HTTP 壳。
- `runNonInteractive()` 只有单轮用户输入，模型无 tool call 时会 return，外层随后 `process.exit(0)`；因此 Course Studio 不能依赖模型追问来继续收集信息，必须在进入 `runNonInteractive()` 前完成本地多轮需求收集。
- 课程入口现在复用 `promptToCourseSpec()` 做本地预检；补充信息会合并回原始学习需求，直到能得到 CourseSpec、被安全策略阻断或达到最大轮次。
- 当前实现仍尊重 OpenGame 原有权限模式：默认非交互允许写文件但不自动允许 shell。课程 prompt 已要求不能伪造构建/浏览器验证，权限不足时明确给出重跑命令。
- 通用课程工具仍保留方案确认边界；`--course-studio` 作为专用生成入口，通过 prompt 指示在无偏好冲突时自动选择推荐方案继续生成，避免一次性入口停留在纯方案预览。
