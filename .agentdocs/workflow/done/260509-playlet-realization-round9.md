# 真实 Playlet 第九轮实现

## 任务目标

在 MVP 2.0 阶段与前八轮真实 playlet 已完成后，继续按每轮 3 个的节奏，把 ready playlet 从 `GenericPlayletScene` 占位实现推进为真实可交互实现。本轮聚焦数量、空间和实验模拟中的规则校验型学习动作：

- `playlet-等式平衡`
- `playlet-图形拼装`
- `playlet-开关组合`

## 落地计划

- [x] 对照现有真实 playlet，确认配置归一化、即时反馈、提交校验和学习证据写入方式。
- [x] 实现 `playlet-等式平衡`：支持左右两侧表达式、可选数值/符号候选、点选填空、平衡校验和学习证据写入。
- [x] 实现 `playlet-图形拼装`：支持图形零件与目标槽点选装配、位置/形状校验、错误反馈和学习证据写入。
- [x] 实现 `playlet-开关组合`：支持多开关状态切换、目标状态校验、结果提示和学习证据写入。
- [x] 更新 3 个 playlet 的 `manifest.json`、`schema.json` 和 `sample.json`。
- [x] 补充 `playletCatalog.test.ts` 与 `courseGddMapper.test.ts`，确保不再使用通用 renderer 且 mapper 能注册本轮 Scene。
- [x] 运行完整本轮验证。

## 验证要求

- [x] `rtk npm run test --workspace=packages/core -- playletCatalog courseGddMapper courseGddMapper.playletRound9`
- [x] `rtk npm run typecheck --workspace=packages/core`
- [x] `rtk npm run lint --workspace=packages/core`
- [x] 临时 scaffold 编译：复制 `course_runtime`、`playlets/shared` 和本轮 3 个 playlet 到仓库内临时课程目录，补最小 `src/courseContent.ts`，执行 `rtk ./node_modules/.bin/tsc --noEmit -p .tmp/course-playlet-round9-check/tsconfig.json`。

## 当前结论

已完成。本轮 3 个 playlet 已从通用占位替换为专用 Phaser Scene，并补齐 manifest、schema、sample 与 mapper/catalog 覆盖。验证阶段发现 `courseGddMapper.test.ts` 超过 1000 行，已提取共享测试夹具并拆出第九轮专用测试文件，保持单文件行数约束。
