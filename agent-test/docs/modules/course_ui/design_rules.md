# course_ui 课程模板设计规则

`course_ui` 用于讲解、对话、选择、卡牌问答和学习报告，是课程链路的默认稳定模板。它复制自 `ui_heavy`，但新增统一课程内容入口和课程专用系统。

## 适用边界

- 适合：语文阅读与词语、英语对话与听辨、数学概念讲解、科学情境判断、道法/常识案例选择、艺术综合任务。
- 不适合：需要空间路径推理的网格任务，优先使用 `course_grid`。
- 不适合：高频波次和复习刷题节奏，优先使用 `course_td`。

## 统一课程配置

所有课程内容必须先写入 `src/courseContent.json`，再由场景读取，不要把课程正文、题库和报告指标散落在多个场景文件中。

必须保留字段：

- `course`：课程元信息，`archetype` 必须是 `course_ui`。
- `learningGoals`：学习目标和掌握证据。
- `lessonUnits`：讲解脚本、例题、误区、互动和评价引用。
- `interactions`：选择、对话或卡牌互动任务。
- `assessments`：题目、选项、答案、解析、错因标签和提示。
- `narration.segments`：TTS 或字幕降级使用的逐字稿片段。
- `report`：学习报告指标和掌握证据。

## 课程系统

- `LessonProgressManager`：记录每个学习目标的讲解、互动和评价完成情况。
- `HintManager`：按评价题输出错因提示，并记录提示使用次数。
- `LearningReportManager`：根据进度和提示使用生成基础学习报告。

## 生成约束

- 标准、深入和挑战深度不能只有选择题，必须包含讲解、示例、互动、反馈和评价。
- 所有错误反馈必须包含 `misconceptionTag` 和下一步提示。
- 题目解析不能只写“答案是 X”，必须写出关键推理。
- `course_ui` 可以承担新概念讲解，但仍应优先复用 `BaseChapterScene`、`BaseBattleScene`、`QuizModal`、`DialogueBox` 和课程系统。
- 不修改普通 `ui_heavy` 模板；课程特化能力只放在 `course_ui`。
