# 真实 Playlet 第三轮实现

## 目标

在 MVP 2.0 阶段已完成后，继续按每轮 3 个的节奏，把 ready playlet 从 `GenericPlayletScene` 占位实现推进为真实可交互实现。本轮聚焦高频 UI 学习动作：

- `playlet-找目标`
- `playlet-找异常`
- `playlet-连线匹配`

## 整体 Review 结论

- MVP 2.0 阶段 0-6 已在 PRD 和归档 workflow 文档中标记完成，产品层能力覆盖输入向导、风格预览、方案确认、记忆、修订、续作、家长控制和失败恢复。
- 当前更高价值的缺口是 ready playlet 仍有大量通用占位实现，导致 Course GDD workflow 虽能运行，但具体学习动作不够真实。
- 后续优先级应继续放在阶段 4：真实 playlet 能力包，逐步让 ready 玩法都由配置驱动的专用 Scene 承载。

## 落地计划

- [x] 核对 MVP 2.0 PRD 和已完成 workflow，确认所有阶段任务完成。
- [x] 选择本轮 3 个可复用 UI 玩法。
- [x] 实现 `playlet-找目标`：支持目标卡片选择、提交校验、错误修正和学习证据写入。
- [x] 实现 `playlet-找异常`：支持异常项选择、即时反馈、提交校验和学习证据写入。
- [x] 实现 `playlet-连线匹配`：支持左右选择配对、可视连线、即时反馈和学习证据写入。
- [x] 更新 manifest、schema、sample 和 catalog 测试。
- [x] 运行 core 测试、typecheck、lint，并记录验证结果。

## 验证计划

- `rtk npm run test --workspace=packages/core -- playletCatalog courseGddMapper`
- `rtk npm run typecheck --workspace=packages/core`
- `rtk npm run lint --workspace=packages/core`

## 验证记录

- [x] `rtk npm run test --workspace=packages/core -- playletCatalog courseGddMapper`
- [x] `rtk npm run typecheck --workspace=packages/core`
- [x] `rtk npm run lint --workspace=packages/core`
- [x] 临时 scaffold 编译：复制 `course_runtime`、`playlets/shared` 和本轮 3 个 playlet 到仓库内临时课程目录，执行 `rtk ./node_modules/.bin/tsc --noEmit -p <tmp>/tsconfig.json` 通过。

## 阶段完成状态

已完成。本轮 3 个 playlet 已从通用占位替换为专用 Phaser Scene，并维持 `BasePlayletScene.finish()` 输出学习证据的统一契约。
