# 真实 Playlet 第八轮实现

## 任务目标

在 MVP 2.0 阶段已完成后，继续按每轮 3 个的节奏，把 ready playlet 从 `GenericPlayletScene` 占位实现推进为真实可交互实现。本轮聚焦路径、结构装配和参数调节类学习动作：

- `playlet-迷宫寻路`
- `playlet-模块装配`
- `playlet-滑杆调参`

## 落地计划

- [x] 对照既有真实 playlet，确认 `BasePlayletScene` 完成契约、配置读取和学习证据写入方式。
- [x] 实现 `playlet-迷宫寻路`：支持网格路径点选、起终点与障碍物呈现、路径连续性校验、错误反馈和学习证据写入。
- [x] 实现 `playlet-模块装配`：支持组件库与装配槽点选、目标顺序校验、提示反馈和学习证据写入。
- [x] 实现 `playlet-滑杆调参`：支持多参数滑杆调节、目标区间校验、即时状态反馈和学习证据写入。
- [x] 更新 3 个 playlet 的 `manifest.json`、`schema.json` 和 `sample.json`。
- [x] 补充或复用 `playletCatalog.test.ts` 与 `courseGddMapper.test.ts`，确保不再使用通用 renderer 且 mapper 能注册本轮 Scene。
- [x] 运行完整本轮验证。

## 验证要求

- [x] `rtk npm run test --workspace=packages/core -- playletCatalog courseGddMapper`
- [x] `rtk npm run typecheck --workspace=packages/core`
- [x] `rtk npm run lint --workspace=packages/core`
- [x] 临时 scaffold 编译：复制 `course_runtime`、`playlets/shared` 和本轮 3 个 playlet 到仓库内临时课程目录，补最小 `src/courseContent.ts`，执行 `rtk ./node_modules/.bin/tsc --noEmit -p .tmp/course-playlet-round8-check/tsconfig.json`。

## 当前结论

已完成。本轮 3 个 playlet 已从通用占位替换为专用 Phaser Scene，并保持配置驱动、即时反馈、错误修正和学习证据写入。临时 scaffold 编译初次暴露迷宫起终点可空类型与滑杆错误列表推断问题，已修正并复验通过。
