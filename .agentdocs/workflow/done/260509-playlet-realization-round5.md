# 真实 Playlet 第五轮实现

## 任务目标

在 MVP 2.0 阶段已完成后，继续按每轮 3 个的节奏，把 ready playlet 从 `GenericPlayletScene` 占位实现推进为真实可交互实现。本轮聚焦 sequence reasoning（顺序推理）类学习动作：

- `playlet-时间线排序`
- `playlet-流程接线`
- `playlet-条件组合推理`

## 落地计划

- [x] 对照既有真实 playlet，确认 BasePlayletScene 完成契约、配置读取和学习证据写入方式。
- [x] 实现 `playlet-时间线排序`：支持事件卡片选择、前移/后移、提交校验、位置反馈和学习证据写入。
- [x] 实现 `playlet-流程接线`：支持流程节点选择、连线校验、可视连线、错误反馈和学习证据写入。
- [x] 实现 `playlet-条件组合推理`：支持条件开关选择、结论选择、组合校验、错因反馈和学习证据写入。
- [x] 更新 3 个 playlet 的 `manifest.json`、`schema.json` 和 `sample.json`。
- [x] 补充 `playletCatalog.test.ts` 与 `courseGddMapper.test.ts`，确保不再使用通用 renderer 且 mapper 能注册本轮 Scene。
- [x] 运行完整本轮验证。

## 验证要求

- [x] `rtk npm run test --workspace=packages/core -- playletCatalog courseGddMapper`
- [x] `rtk npm run typecheck --workspace=packages/core`
- [x] `rtk npm run lint --workspace=packages/core`
- [x] 临时 scaffold 编译：复制 `course_runtime`、`playlets/shared` 和本轮 3 个 playlet 到仓库内临时课程目录，执行 `rtk ./node_modules/.bin/tsc --noEmit -p <tmp>/tsconfig.json`。

## 当前结论

已完成。本轮 3 个 playlet 已从通用占位替换为专用 Phaser Scene，并保持配置驱动、即时反馈、错误修正和学习证据写入。验证过程中发现并修复 `playlet-时间线排序` 内部字段覆盖 Phaser.Scene `events` 事件总线的隐性类型问题。
