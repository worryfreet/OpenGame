# course_td 模板 API

`course_td` 继承 `tower_defense` 的塔防场景、波次、经济、塔和敌人 API，并新增复习波次进度 API。

## 项目结构

```text
src/
  courseContent.json
  courseContent.ts
  gameConfig.json
  scenes/
    BaseTDScene.ts
    UIScene.ts
    _TemplateTDLevel.ts
  systems/
    WaveManager.ts
    EconomyManager.ts
    ReviewWaveProgressManager.ts
  towers/
    BaseTower.ts
    _TemplateTower.ts
  enemies/
    BaseTDEnemy.ts
    _TemplateTDEnemy.ts
```

## 配置读取

```ts
import { courseContent } from '../courseContent';
import { ReviewWaveProgressManager } from '../systems';
```

`courseContent.json` 是复习题、波次反馈和报告指标的唯一入口。生成代码时不要把复习题散落在 `WaveManager`、场景和 UI 文件中。

## 新增系统

### ReviewWaveProgressManager

```ts
const review = new ReviewWaveProgressManager(courseContent);
const prompt = review.getReviewPromptForWave(1);
const result = review.resolveWaveAnswer(1, selectedIndex);
const pacedWaves = review.applyReviewPacing(this.getWaveDefinitions());
const accuracy = review.getAccuracy();
```

构造时会检查 `templateRules.reviewOnly`，避免把 `course_td` 用成新概念首讲模板。

## 推荐场景映射

- `getWaveDefinitions()`：先生成普通波次，再用 `ReviewWaveProgressManager.applyReviewPacing()` 补齐复习节奏。
- `onWaveStart()`：展示当前波次复习题或策略提示。
- `onWaveComplete()`：根据本波答题和防守表现给反馈。
- `onAllWavesComplete()`：进入学习报告或结算场景。
- `onGoldChanged()`：资源变化可以反映学习表现，但不能设计抽卡或随机付费机制。

## 必须保留的普通模板 API

继续遵守 `tower_defense/template_api.md` 中的 hook 名称，不要发明不存在的 hook。尤其是：

- `getGridConfig()`
- `getPathWaypoints()`
- `createEnvironment()`
- `getWaveDefinitions()`
- `getTowerTypes()`
- `createEnemy()`
- `onWaveStart()`
- `onWaveComplete()`
- `onAllWavesComplete()`
