# 课程讲解深度协议

本文档约束 `generate_course_gdd` 如何把 `ExplanationDepthSpec` 落到 Course GDD。讲解深度既是生成前确认项，也是生成后验收项。

## 通用闭环

每个 `learningGoal` 必须形成四段闭环：

- 讲解：`lessonUnits.explanationScript` 面向学生说明概念、用途和关键判断方法。
- 互动：`interactionSpecs` 绑定对应 `lessonUnitId`，让学生执行选择、排序、分类或推理。
- 反馈：`interactionSpecs.feedback` 和 `lessonUnits.feedbackStrategy` 必须包含正确反馈、错因类型和下一步提示。
- 评价：`assessmentSpec.items` 必须覆盖同一个 `learningGoal`，并包含答案、解析、错因标签和提示。

## 深度等级要求

| depthLevel | Course GDD 最低要求 |
| --- | --- |
| `intro` | 1 个核心概念，直观讲解，2-3 个即时练习，反馈可短但不能只写 correct/wrong。 |
| `standard` | 前置诊断已在 CourseSpec 确认；Course GDD 必须包含 2-3 个概念层对应的讲解、例题化解释、互动练习和错因反馈。 |
| `deep` | 必须显式处理常见误区，包含迁移应用或复盘任务，评价解析要写出关键推理步骤。 |
| `challenge` | 必须包含开放迁移、策略选择或反思复盘，允许多路径解法，但不能牺牲适龄安全。 |

## 禁止退化

- `standard/deep/challenge` 不允许只有选择题。
- 评价题 `explanation` 不允许只写“答案是 X”。
- 学生错误时不能只给 wrong/correct，必须给 `misconceptionTag` 和 `hint`。
- `deep/challenge` 下不能缺少“迁移、应用、反思、复盘、开放问题”等任务信号。

## 旁白要求

`narrationPlan.segments` 使用 `text` 存放逐字稿。每个讲解单元至少应有一个旁白分段，TTS 失败时后续工具应把 `text` 当作字幕 fallback。
