# 课程玩法映射协议

本文档约束课程链路如何从已确认方案映射到课程模板族。普通 OpenGame 游戏继续使用 `classify_game_type -> generate_gdd`，课程链路不能改写普通模板语义。

## 受控模板族

| courseArchetype | 适用课程                                                        | 首批职责                                       |
| --------------- | --------------------------------------------------------------- | ---------------------------------------------- |
| `course_ui`     | 语文、英语、道法/常识、低年级导入、剧情讲解、对话选择、测验卡片 | 承载讲解、对话、选择、卡片互动和学习报告。     |
| `course_grid`   | 数学、科学、英语词汇、语文排序、分类观察、流程推理              | 承载分类、排序、步骤推理、网格观察和迁移任务。 |
| `course_td`     | 高年级复习、巩固、策略选择                                      | 只承接复习巩固，不作为新概念初学模板。         |

## 玩法积木模板包

课程链路新增 `course_runtime + playlet template package` 架构。具体玩法不由 AI 临场写代码，而是从 `agent-test/templates/playlets/` 中复制已登记的玩法模板包。每个模板包必须包含：

- `manifest.json`：玩法 id、标题、超类、引擎族、状态和默认占位资产。
- `schema.json`：该玩法配置 schema。
- `sample.json`：最小可运行样例配置。
- `index.ts`：玩法包入口。第一阶段可以复用 `shared/GenericPlayletScene`，后续再替换为专用 renderer。

第一批可进入生成链路的玩法状态为 `ready`。`planned` 玩法只进入 catalog，不允许被 `generate_course_plan` 或 `CourseGDD.workflow` 选用。

## 映射硬规则

- Course GDD 的 `selectedPlan.courseArchetype` 只能是 `course_ui`、`course_grid`、`course_td`。
- Course GDD 不允许输出 `platformer`、`top_down`、`ui_heavy`、`grid_logic`、`tower_defense` 作为最终课程模板。
- 后续 scaffold 应复制 `agent-test/templates/core`、`agent-test/templates/course_runtime`、workflow 需要的 `agent-test/templates/playlets/*` 和 `agent-test/templates/modules/course_*` 中的选定兼容模板。
- 普通 `ui_heavy`、`grid_logic`、`tower_defense` 只能作为课程模板建设时的参考来源，不在生成链路中直接修改。
- 生成阶段不允许新增玩法引擎 TypeScript 文件；只能写 `courseContent.json`、玩法配置、风格配置、素材计划和旁白文本。
- workflow 必须是 DAG，所有节点从 `startNodeId` 可达，每个学习目标至少被一个 playlet node 覆盖。
- 玩法之间的切换统一由 `course_runtime` 和 `TransitionContract` 接管，不允许玩法模板自行随意跳转到未知场景。

## 生成后续步骤

`generate_course_gdd` 完成后，下一步应进入：

```text
Course GDD
  -> 复制 core + course_runtime + selected playlet packages + course_* 兼容模板
  -> 生成带 workflow/styleBible 的 courseContent.json
  -> generate_game_assets 处理图片与普通 BGM/SFX
  -> 课程 TTS 生成 narration manifest
  -> validate_course_package
```

如果素材、TTS 或视频失败，后续工具必须降级到占位图、字幕或无视频模式，不能中断核心课程互动。
