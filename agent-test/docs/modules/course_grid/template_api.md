# course_grid 模板 API

`course_grid` 继承 `grid_logic` 的网格、实体、回合和动画系统，并新增课程任务目标 API。

## 项目结构

```text
src/
  courseContent.json
  courseContent.ts
  gameConfig.json
  scenes/
    BaseGridScene.ts
    UIScene.ts
    _TemplateGridLevel.ts
  entities/
    BaseGridEntity.ts
    _TemplateEntity.ts
  systems/
    BoardManager.ts
    TurnManager.ts
    AnimationQueue.ts
    TaskObjectiveManager.ts
    StepFeedbackManager.ts
```

## 配置读取

```ts
import { courseContent, getInteractionsForGoal } from '../courseContent';
import { TaskObjectiveManager, StepFeedbackManager } from '../systems';
```

`courseContent.json` 是课程任务、题目和报告指标的唯一入口。生成场景代码时优先读取配置，不要把题目和反馈硬编码到多个文件。

## 新增系统

### TaskObjectiveManager

```ts
const objectives = new TaskObjectiveManager(courseContent);
const sceneObjectives = objectives.getObjectivesForScene(this.scene.key);
objectives.completeStep(
  'interaction-connect-circuit',
  'assessment-circuit-path',
);
const ratio = objectives.getCompletionRatio();
```

### StepFeedbackManager

```ts
const feedbackManager = new StepFeedbackManager(courseContent);
const feedback = feedbackManager.buildInteractionFeedback(
  'interaction-connect-circuit',
  false,
);
const assessmentFeedback = feedbackManager.buildAssessmentFeedback(
  'assessment-circuit-path',
  1,
);
```

## 推荐场景映射

- `getBoardConfig()`：根据 Course GDD 的任务地图生成网格。
- `createEntities()`：放置概念卡、步骤节点、目标格或路径节点。
- `onCellClicked()`：完成分类、排序或路径选择。
- `checkWinCondition()`：读取 `TaskObjectiveManager.getCompletionRatio()` 判断课程任务是否完成。
- `onEntityMoved()`：触发步骤反馈或目标完成。

## 必须保留的普通模板 API

继续遵守 `grid_logic/template_api.md` 中的 hook 名称，不要发明不存在的 hook。尤其是：

- `getBoardConfig()`
- `createEnvironment()`
- `createEntities()`
- `checkWinCondition()`
- `checkLoseCondition()`
- `onCellClicked()`
- `onDirectionInput()`
- `onEntityClicked()`
