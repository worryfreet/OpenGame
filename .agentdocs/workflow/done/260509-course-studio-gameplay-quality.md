# Course Studio 游戏性质量修复

## 任务背景

用户通过 `npm run start --workspace=packages/cli -- --course-studio` 输入“四年级数学, 一元二次方程, 枪战”后，生成结果虽然能在 `http://localhost:5173/` 打开，但体验接近静态做题页：安全改写把“枪战”偏好过度抽象成“泡泡能量”，没有保留用户真正想要的瞄准、命中、操作物件等核心动作；课程玩法过于单一，缺少真实游戏节奏；最终回复也没有时间线、链路走向和参考资料，导致难以诊断生成链路问题。

## 顶级思想

- 速度优势：课程生成应优先复用核心底座模板、course runtime、ready playlet 和验证协议，避免从零生成普通 React 页面。
- 稳定优势：用 schema、mapper、素材/TTS/视频协议、自动修复和验证门禁把 AI 输出收敛到稳定链路。
- 全能优势：先做课程目标、玩法分类和教学动作映射，再用模板 + AI + 精准图片/视频生成提升表现质量。
- 图片和视频生成必须巧用：图片用于角色、场景、关键道具、概念卡和反馈状态；视频用于可选导入/章节过场或关键状态变化，并有静态和字幕降级。
- 本次实现重点是让 Course Studio 不再允许绕过受控链路，同时让安全改写保留用户的核心操作意图。

## 已定位问题

- `packages/cli/src/ui/course/runCourseStudio.ts` 的入口 prompt 只笼统要求“真实互动游戏体验”，没有强制使用 Course SDK 受控链路、玩法分类库、ready playlet 和课程质量门禁，模型可绕开工具手写 React/Vite 小页面。
- `packages/core/src/course/one-shot/promptToCourseSpec.ts` 未识别“枪战/射击/瞄准”等偏好，也没有适龄等价改写规则，容易被模型自由发挥成偏离学生意图的主题。
- `packages/core/src/tools/generate-course-plan.ts` 的方案生成 prompt 没有把“用户兴趣的核心动词”和“安全替代表达边界”明确传给模型。
- `packages/core/src/course/quality/gameDirector.ts` 已能识别部分换皮问答，但对“用户要求动作玩法却生成答题页”的拦截不足。
- SDK 类型仍限制 `StudentGrade` 为 1-6，与 core 已支持 1-12 的现状不一致。
- 现有提示没有强制调用 `generate_game_assets` 的图片/音频/视频链路，也没有要求说明生图、生视频、TTS 的执行或降级状态。

## 实施计划

- [x] 阶段 1：强化 Course Studio 入口提示，要求输出时间线、工具链路、参考资料，并禁止手写静态题目壳。
- [x] 阶段 2：补充一句话解析的动作兴趣识别和适龄安全改写，保留“瞄准/命中/操作物件”的玩法语义。
- [x] 阶段 3：强化课程方案生成 prompt 和质量门禁，要求至少 3 个 playlet、至少 2 类核心动作，并拦截动作偏好退化成问答页；补充素材/视频调用约束。
- [x] 阶段 4：补充单元测试，运行相关 lint/typecheck/test。
- [x] 阶段 5：任务回顾，更新长期记忆并整理任务文档状态。

## 实施结果

- `runCourseStudio` 入口已强制要求走课程工具、Course GDD mapper、course runtime 和 ready playlet，不允许绕过链路手写 React/Vite 静态题目页。
- 一句话解析已识别“枪战/射击/打枪”等动作偏好，改写为水枪靶场等适龄表达，同时写入“安全瞄准命中”“移动目标点击”等核心操作偏好。
- 课程方案生成已要求动作偏好保留 `playlet-点击射击` 或等价 action_fluency 节点，数学方程类推荐与 `playlet-等式平衡`、`playlet-坐标定位`、`playlet-滑杆调参` 等组合。
- 课程质量导演已新增 `actionPreferenceFit` 和 `gameplayVariety` 阻断项，拦截“学生要动作玩法但生成普通问答/单一做题”的方案。
- Course GDD 已要求 assetPlan.images 覆盖主场景、角色/引导员、关键道具、正确反馈状态、错误反馈状态；允许视频时建议规划可选过场视频，视频仍可降级。
- SDK 课程类型已与 core 保持 1-12 年级一致。

## 验证记录

- `npm run test --workspace=packages/core -- promptToCourseSpec courseQualityScorer validation generate-course-gdd generate-course-plan`
- `npm run test --workspace=packages/cli -- runCourseStudio`
- `npm run test --workspace=packages/sdk-typescript -- createCourseGame`
- `npm run typecheck --workspace=packages/core`
- `npm run lint --workspace=packages/core`
- `npm run typecheck --workspace=packages/cli`
- `npm run lint --workspace=packages/cli`
- `npm run typecheck --workspace=packages/sdk-typescript`
