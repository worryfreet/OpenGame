# AI 素养 Lesson 1 游戏化课程样例生成

## 任务目标

基于 `.agentdocs/examples/课程总剧情大纲_v6.md` 中 Lesson 1「什么是智能｜蓝核资格检测」，生成一门可运行、可验证的游戏化课程样例。

## 课程定位

- 受众：小学 4-6 年级，默认五年级。
- 主题：什么是智能。
- 剧情：学生作为蓝核修复队实习生进入地球蓝核指挥中心，完成「蓝核资格检测」。
- 核心知识：感知、理解、学习、决策，以及四环组合成智能行为回路。
- 模板选择：`course_ui`，原因是本课以剧情讲解、行为卡判断、情境选择和资格判定为主，适合对话选择与学习报告闭环。

## 课程包落点

- 输出目录：`agent-test/games/ai-literacy-lesson1-bluecore`
- 课程内容配置：`agent-test/games/ai-literacy-lesson1-bluecore/src/courseContent.json`
- 课程 GDD：`agent-test/games/ai-literacy-lesson1-bluecore/course-gdd.json`
- 旁白降级 manifest：`agent-test/games/ai-literacy-lesson1-bluecore/public/assets/narration/narration-manifest.json`
- 普通素材 manifest：`agent-test/games/ai-literacy-lesson1-bluecore/public/assets/asset-pack.json`
- 临时生成脚本：`.tmp/generate-ai-literacy-lesson1.ts`

## 使用方式

在课程包目录运行：

```bash
rtk npm install --no-package-lock --ignore-scripts
rtk npm run dev -- --host 127.0.0.1 --port 8080
```

当前已启动预览服务：

```text
http://127.0.0.1:8080/
```

进入标题页后按 Enter 进入课程。

## 验证结果

- [x] 重新执行 `.tmp/generate-ai-literacy-lesson1.ts` 生成课程包。
- [x] `validateCourseSpec()`、`validateCourseGdd()`、`validateCoursePackage()` 通过。
- [x] `validateCoursePackage()` 输出 `errors: 0`，`warnings: 4`。
- [x] 4 个 warning 均为 `narration_subtitle_fallback`，原因是未调用本地 lessonin TTS 服务，当前以字幕降级承接旁白。
- [x] `rtk ./node_modules/.bin/prettier --check ...` 覆盖生成脚本、任务文档、课程 JSON 和标题页。
- [x] 课程内容 sanity 检查通过：3 个讲解单元、3 个互动、3 个评价题，深度字段和反馈字段完整。
- [x] `rtk npm run build` 在课程包目录通过。
- [x] `rtk npm run test -- --passWithNoTests` 通过；当前样例包没有独立测试文件。
- [x] 本地 dev server HTTP 检查 `200 OK`。
- [x] Headless Chrome 截图确认 Phaser 画布可渲染。

## 已知边界

- 当前样例没有调用本地 lessonin TTS 服务，所以旁白为字幕降级，不含真实音频文件。
- 当前样例没有生成真实图片、音效和视频素材，只写入 manifest 占位。课程流程不被阻断，但视觉和听觉表现仍是模板级别。
- 首屏标题已替换为课程标题；进入课程后承接 `LessonScene -> PracticeScene -> BattleScene -> 学习报告`。

## TODO

- [x] 构造 Lesson 1 CourseSpec 和 Course GDD。
- [x] 调用 `mapCourseGddToOpenGameScaffold()` 输出课程模板文件。
- [x] 复制 `agent-test/templates/core` 和 `agent-test/templates/modules/course_ui/src`。
- [x] 写入 asset-pack 与字幕降级 narration manifest。
- [x] 执行 `validateCourseSpec()`、`validateCourseGdd()`、`validateCoursePackage()`。
- [x] 执行课程包 `tsc --noEmit` 和 `npm run build`。
- [x] 尝试启动课程包 dev server，给出可访问地址。
