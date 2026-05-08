# 代理文档索引

## 当前任务文档

`workflow/260507-toc-game-course-plan.md` - ToC 个性化游戏化课程生成系统规划整理任务状态和当前 TODO。
`workflow/260508-mvp1-gameplay-optimization.md` - 基于玩法分类库优化 MVP 1.0 课程生成链路的现状分析、方案和实施 TODO。

## 已完成任务文档

`workflow/done/260508-create-diff-pet.md` - 创建名为 Diff 的 Codex 自定义宠物，记录生成、姿态、验证和打包结果。
`workflow/done/260508-ai-literacy-lesson1-sample.md` - 基于课程总剧情大纲 Lesson 1 生成 AI 素养游戏化课程样例。

## 产品文档

`prd/toc-course-mvp-1.md` - MVP 1.0 受控生成闭环落地方案。
`prd/toc-course-mvp-2.md` - MVP 2.0 产品化体验与持续使用能力路线。
`prd/toc-course-mvp-3.md` - MVP 3.0 一句话高质量生成与核心生成能力跃迁路线。
`prd/course-gameplay-taxonomy.md` - 跨学科课程游戏玩法类型库总览，进行课程玩法选型、模板扩展或反单调校验时必读。
`prd/gameplay-taxonomy/README.md` - 按学生核心动作组织的玩法超类索引，设计具体知识点玩法前必读。

## 课程生成工程文档

`../agent-test/docs/course/course_gdd.md` - Course GDD 初版格式草案，开发课程 GDD 工具或课程模板映射时必读。
`../agent-test/docs/course/explanation_depth.md` - 课程讲解深度协议，开发 Course GDD 校验、课程模板反馈或学习报告时必读。
`../agent-test/docs/course/gameplay_mapping.md` - 课程玩法映射协议，开发 Course GDD 到课程模板链路或课程模板族时必读。
`../agent-test/docs/course/asset_manifest.md` - 课程素材、TTS 旁白和视频降级协议，开发课程多模态资产或验证工具时必读。
`../agent-test/docs/course/validation_protocol.md` - 课程包验证协议，开发 `validate_course_package`、端到端验证或发布前检查时必读。
`../agent-test/docs/modules/course_ui/template_api.md` - 课程 UI 模板 API，开发讲解、对话、问答和学习报告模板时必读。
`../agent-test/docs/modules/course_grid/template_api.md` - 课程网格模板 API，开发分类、排序、路径和步骤反馈模板时必读。
`../agent-test/docs/modules/course_td/template_api.md` - 课程塔防模板 API，开发复习波次和策略巩固模板时必读。

## 全局重要记忆

- 与用户沟通、代理文档和代码注释统一使用中文；必要英文术语首次出现时补充中文说明。
- Shell 命令必须使用 `rtk` 前缀。
- 当前项目原始定位是从自然语言生成可玩的 Web 游戏；二创方向应保留 OpenGame 作为互动游戏生成底座，在其上新增课程规划、风格规划、未成年人保护和课程验证层。
- 课程玩法选型必须先看学习目标、学习阶段和学生核心动作，再参考学科；学科只提供素材语境，不能直接决定玩法。后续课程方案生成要优先使用 `prd/gameplay-taxonomy/` 的玩法超类，而不是只按学科映射到模板。
- 课程模板族统一使用 `src/courseContent.json` 作为课程正文、互动、评价、旁白和报告指标入口；后续 Course GDD 映射不应为 `course_ui/course_grid/course_td` 各自发明不同配置协议。
- Course GDD 到 OpenGame scaffold 统一走 `packages/core/src/course/courseGddMapper.ts`，由 mapper 输出课程模板复制指令、`src/courseContent.json`、真实 `src/main.ts` 和 `src/LevelManager.ts`，不允许在后续工具中重新散落拼装课程模板协议或伪造入口。
- 课程讲解旁白统一走 `packages/core/src/course/tts`，批量请求 lessonin-server 时使用 `scriptList[{name,script}]`，持久化 `audio_uri`，TTS 失败时必须生成字幕降级 manifest。
- `course_tts_manifest` 已注册为正式核心工具，显示名为 `CourseTTSManifest`；SDK 课程链路必须把它纳入 `coreTools`，不要再把它当作自然语言流程名。
- 课程视频过场统一走 `courseContent.videoTransitions` 和各 `course_*` 模板的 `VideoTransitionManager.ts`；视频素材必须进入 `asset-pack.json`，运行时支持播放、点击/SPACE 跳过和缺资源静态过场降级。
- 课程包发布前必须调用 `validate_course_package`，其 `error` 阻断后续发布；TTS 缺本地音频但有字幕 fallback 时只作为 warning。
- 课程浏览器 smoke 验证入口在 `integration-tests/helpers/courseBrowserSmoke.ts`；默认课程基准运行 `rtk npm run test:course`，强制浏览器 smoke 运行 `rtk npm run test:course:browser`，课程模板需维护 `[data-course-runtime-status]` 状态节点。
- 课程玩法积木统一走 `packages/core/src/course/playletCatalog.ts` 和 `packages/core/src/course/courseWorkflow.ts`；首批 40 个具体玩法为 `ready`，其余玩法必须保持 `planned`，生成链路不得选择 `planned` 玩法。
- 课程工作流采用 DAG：`courseContent.workflow` 必须无环、节点可达、覆盖所有学习目标；复习回流通过 `recoveryPolicy` 表达，不写成真实循环。
- Course GDD mapper 必须复制 `agent-test/templates/course_runtime`、`agent-test/templates/playlets/shared` 和 workflow 选中的 ready playlet 包；AI 生成阶段只能写配置、内容、风格和素材 manifest，不允许新增玩法引擎 TS 文件。
- 玩法之间统一通过 `WorkflowRunner`、`CourseStateStore` 和 `TransitionManager` 过渡，playlet 只输出 `PlayletResult`，学习报告从统一状态读取证据。
- 课程 SDK/headless 入口统一走 `packages/sdk-typescript/src/course/createCourseGame.ts`；默认 `plan_only` 只生成方案并等待 `selectedPlanId` 确认，确认后才进入 Course GDD、scaffold、素材、TTS 和课程包验证。
- 课程模板生产 build 使用 `agent-test/templates/core/tsconfig.json`，必须排除 `src/test` 且不依赖 Vitest 类型；三类 `course_*` 模板的 `gameConfig.json` 必须保留 core `main.ts` 依赖的 `screenSize`、`debugConfig.debug`、`renderConfig.pixelArt`。
