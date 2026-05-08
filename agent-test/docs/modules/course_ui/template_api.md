# course_ui 模板 API

`course_ui` 继承 `ui_heavy` 的场景、系统和 UI API，并新增课程配置与学习进度 API。

## 项目结构

```text
src/
  courseContent.json
  courseContent.ts
  gameConfig.json
  scenes/
    BaseChapterScene.ts
    BaseBattleScene.ts
    BaseEndingScene.ts
    ChapterSelectScene.ts
    _TemplateChapter.ts
    _TemplateBattle.ts
    _TemplateEnding.ts
  systems/
    LessonProgressManager.ts
    HintManager.ts
    LearningReportManager.ts
    DialogueManager.ts
    QuizManager.ts
    GameDataManager.ts
  ui/
    DialogueBox.ts
    QuizModal.ts
    ChoicePanel.ts
    StatusBar.ts
```

## 配置读取

```ts
import { courseContent, getAssessmentsForGoal } from '../courseContent';
import {
  LessonProgressManager,
  HintManager,
  LearningReportManager,
} from '../systems';
```

`courseContent.json` 是课程正文的唯一入口。`courseContent.ts` 提供类型和按目标/场景查询的辅助函数。

## 新增系统

### LessonProgressManager

```ts
const progress = new LessonProgressManager(courseContent);
progress.startGoal('goal-area-perimeter');
progress.completeLessonUnit('unit-area-perimeter');
progress.completeInteraction('interaction-sort-area-perimeter');
progress.completeAssessment('assessment-area-perimeter', true);
const allProgress = progress.getAllProgress();
```

### HintManager

```ts
const hints = new HintManager(courseContent);
const hint = hints.getHintForAssessment('assessment-area-perimeter');
const feedback = hints.getFailureFeedback('assessment-area-perimeter');
const usage = hints.getUsage();
```

### LearningReportManager

```ts
const reportManager = new LearningReportManager(courseContent);
const report = reportManager.buildReport(
  progress.getAllProgress(),
  hints.getUsage(),
);
```

## 推荐场景映射

- `BaseChapterScene`：读取 `lessonUnits` 和 `narration.segments`，负责讲解、例题和选择分支。
- `BaseBattleScene`：读取 `assessments`，使用 `QuizModal` 展示题目和解析。
- `BaseEndingScene`：读取 `LearningReportManager` 输出，展示掌握证据、正确率和薄弱目标。

## 必须保留的普通模板 API

继续遵守 `ui_heavy/template_api.md` 中的 hook 名称，不要发明不存在的 hook。尤其是：

- `initializeDialogues()`
- `createCharacters()`
- `onChoiceMade()`
- `initializeBattle()`
- `getQuestionBank()`
- `onQuizAnswered()`
- `getEndingData()`
