# 真实 Playlet 第七轮实现

## 任务目标

在 MVP 2.0 阶段已完成后，继续按每轮 3 个的节奏，把 ready playlet 从 `GenericPlayletScene` 占位实现推进为真实可交互实现。本轮聚焦诊断定位与空间定位类学习动作：

- `playlet-失败输出归因`
- `playlet-模块定位`
- `playlet-坐标定位`

## 落地计划

- [x] 对照既有真实 playlet，确认 `BasePlayletScene` 完成契约、配置读取和学习证据写入方式。
- [x] 实现 `playlet-失败输出归因`：支持失败输出观察、原因卡选择、提交校验、错因反馈和学习证据写入。
- [x] 实现 `playlet-模块定位`：支持模块图卡片定位、目标模块点选、提交校验、提示反馈和学习证据写入。
- [x] 实现 `playlet-坐标定位`：支持网格坐标点选、目标坐标校验、错误重试、进度反馈和学习证据写入。
- [x] 更新 3 个 playlet 的 `manifest.json`、`schema.json` 和 `sample.json`。
- [x] 补充或复用 `playletCatalog.test.ts` 与 `courseGddMapper.test.ts`，确保不再使用通用 renderer 且 mapper 能注册本轮 Scene。
- [x] 运行完整本轮验证。

## 验证要求

- [x] `rtk npm run test --workspace=packages/core -- playletCatalog courseGddMapper`
- [x] `rtk npm run typecheck --workspace=packages/core`
- [x] `rtk npm run lint --workspace=packages/core`
- [x] 临时 scaffold 编译：复制 `course_runtime`、`playlets/shared` 和本轮 3 个 playlet 到仓库内临时课程目录，补最小 `src/courseContent.ts`，执行 `rtk ./node_modules/.bin/tsc --noEmit -p .tmp/course-playlet-round7-check/tsconfig.json`。

## 当前结论

已完成。本轮 3 个 playlet 已从通用占位替换为专用 Phaser Scene，并保持配置驱动、即时反馈、错误修正和学习证据写入。临时 scaffold 编译初次缺少 `courseContent` 必需字段，补齐检查桩后通过，未发现新增 playlet 类型错误。
