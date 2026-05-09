# 第四轮真实 Playlet 实现

## 背景

MVP 2.0 阶段 0-6 已完成，当前进入 ready playlet 的真实玩法实现阶段。上一轮已完成 `playlet-找目标`、`playlet-找异常`、`playlet-连线匹配`。本轮继续完成 3 个 ready playlet，降低课程 scaffold 生成后落到通用占位玩法的比例。

## 本轮目标

- 将 `playlet-关键词提取` 从 `GenericPlayletScene` 改为专用 Phaser Scene。
- 将 `playlet-需求清单验收` 从 `GenericPlayletScene` 改为专用 Phaser Scene。
- 将 `playlet-框选标注` 从 `GenericPlayletScene` 改为专用 Phaser Scene。
- 保持所有 Scene 通过 `BasePlayletScene.finish()` 输出统一 `PlayletResult`，证据可进入学习报告。

## 落地计划

1. 复用已有真实 playlet 的目录结构和 UI 写法，避免新增 runtime 协议。
2. 为每个 playlet 补齐 `index.ts`、`schema.json`、`sample.json` 和 `manifest.json.renderer`。
3. 扩展 `playletCatalog.test.ts`，确保新增 playlet 不再使用通用 renderer。
4. 扩展 `courseGddMapper.test.ts`，确保 Course GDD workflow 会导入并注册新增 Scene。
5. 运行 core 相关测试、typecheck、lint；如有模板级 TypeScript 风险，再用临时 scaffold 执行 `tsc --noEmit`。

## TODO

- [x] 实现 3 个真实 playlet 模板。
- [x] 补充目录契约和 mapper 注册测试。
- [x] 运行并通过本轮必要验证。
- [x] 回顾是否需要沉淀长期文档或记忆。

## 执行结果

- `playlet-关键词提取` 已支持材料文本展示、关键词候选选择、正确/错误反馈和 `keywords` 证据输出。
- `playlet-需求清单验收` 已支持必需项、禁止项和显式 `expected` 判断，输出逐项验收状态证据。
- `playlet-框选标注` 已支持按比例坐标渲染标注区域，点击框选目标区域并避开干扰项。
- `playletCatalog.test.ts` 已把真实 playlet 契约覆盖扩大到 12 个。
- `courseGddMapper.test.ts` 已覆盖第四轮 3 个 Scene 的 import/register。

## 验证记录

- `rtk npm run test --workspace=packages/core -- playletCatalog courseGddMapper`
- `rtk npm run typecheck --workspace=packages/core`
- `rtk npm run lint --workspace=packages/core`
- `rtk npx tsc --noEmit --project /private/tmp/opengame-playlet-round4-check/tsconfig.json --pretty false`

## 回顾

本轮形成的长期信息已写回 `workflow/260508-mvp1-gameplay-optimization.md`；没有新增跨模块协议，暂不需要新建产品或工程文档。

## 验收标准

- `playlet-关键词提取` 支持从文本中选择关键词，反馈命中数量并产出关键词证据。
- `playlet-需求清单验收` 支持逐项验收需求，要求所有必需项通过、禁止项不得通过。
- `playlet-框选标注` 支持点击内容区域完成框选标注，要求选中所有目标区域且避免干扰项。
- `courseGddMapper` 生成的 `src/main.ts` 包含 3 个新增 Scene 的 import 和 `game.scene.add()` 注册。
- core 相关 test、typecheck、lint 全部通过。
