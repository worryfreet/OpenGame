# 课程包验证协议

本文档约束 `validate_course_package` 对生成后课程游戏包的阻断规则和降级规则。该工具运行在 Course GDD、课程模板写入、普通素材生成和 TTS manifest 之后，浏览器端到端验证之前。

## 输入

必需输入：

- `packageDir`：生成后的 H5 游戏工程目录。
- `courseGdd`：已确认方案生成出的 Course GDD。

默认读取路径：

- `src/courseContent.json`
- `public/assets/asset-pack.json`
- `public/assets/narration/narration-manifest.json`
- `src/main.ts`
- `src/LevelManager.ts`

## 输出分级

`validate_course_package` 输出 `error`、`warning`、`info` 三类 issue：

- `error`：阻断发布和后续浏览器验证，必须先修复。
- `warning`：允许继续，但需要在报告中保留降级或风险说明。
- `info`：用于记录已通过的检查或后续建议。

只有 `error` 数量为 0 时，课程包才算通过阻断性验证。

## 阻断检查

### Course GDD

- Course GDD 必须通过 schema 和 `validateCourseGdd()`。
- 每个 `learningGoal` 必须同时有讲解、互动和评价闭环。
- `standard/deep/challenge` 题目解析不能只写答案，必须说明关键推理步骤。
- 每道评价题必须包含 `correctIndex`、`explanation`、`misconceptionTag` 和 `hint`。

### 课程配置

- `src/courseContent.json` 必须存在且为合法 JSON。
- `course.archetype` 必须与 Course GDD 的 `selectedPlan.courseArchetype` 一致。
- 每个学习目标必须写入 `learningGoals`，并能关联到讲解单元、互动反馈和评价题。

### 资产

- `public/assets/asset-pack.json` 必须存在且为合法 JSON。
- Course GDD 中规划的图片、BGM、SFX key 必须出现在 asset-pack 中。
- asset-pack 中每个素材必须有可加载 `url`。
- 素材 URL 不是 `assets/` 或 HTTP URL 时输出 warning，交给运行时验证进一步确认。

### 旁白

- 课程包必须写入 narration manifest，即使 TTS 失败也要写字幕降级 manifest。
- 每个 `CourseGDD.narrationPlan.segments` 都必须出现在 manifest 中。
- 每个旁白分段必须有 `audio_uri`，或在 TTS 失败时有 `fallbackSubtitle`。
- 缺少本地音频文件但存在字幕降级时输出 warning，不阻断。

### 场景

- `src/main.ts` 必须注册课程内容中引用的所有场景。
- `src/LevelManager.ts` 的 `LEVEL_ORDER[0]` 必须存在。
- `LEVEL_ORDER[0]` 指向的首场景必须已在 `main.ts` 中注册。

### 适龄安全

- 扫描 Course GDD 和 `courseContent.json` 中面向学生展示的正文、题目、反馈、资产说明和场景名。
- 命中监护人禁止项或默认不适龄词时阻断。
- `strict` 模式下额外阻断赌博、成瘾、诱导分享和真实品牌 IP 风险。

## 降级规则

- TTS 文件缺失但存在 `fallbackSubtitle`：warning，不阻断。
- 普通素材 URL 异常但有 asset-pack 注册：warning，后续 build/browser 验证继续确认。
- 视频资产仍遵循 Course GDD 校验：MVP 1.0 只能可选，监护人关闭生成视频时不得规划。

## 后续验证

课程包通过本工具后，仍必须继续执行：

- `rtk npm run build`
- `rtk npm run test`
- 无头浏览器打开首屏，检查无白屏和 fatal console error。
- 自动完成第一轮互动并确认反馈与学习报告可达。

### 课程浏览器 smoke

`integration-tests/course-generation.test.ts` 已接入 `integration-tests/helpers/courseBrowserSmoke.ts`：

- 默认模式会尝试使用系统 Chrome/Chromium + Chrome DevTools Protocol 打开临时课程包；如果当前环境无法启动浏览器，则记录跳过原因，不把静态端到端验证误判为失败。
- 默认课程基准命令：`rtk npm run test:course`。
- 强制浏览器 smoke 命令：`rtk npm run test:course:browser`，适合本机非沙箱或 CI 浏览器环境；Chrome 不可用、首屏白屏、fatal console error、无法进入学习报告都会失败。
- 三类课程模板需要维护隐藏运行时状态节点 `[data-course-runtime-status]`，其中 `data-stage` 至少覆盖 `lesson`、`practice`、`assessment` 或 `report`，用于自动化判定课程闭环是否可达。
