const stages = [
  {
    id: 'input',
    title: '用户输入与产品边界',
    short: '一句话、产品化输入或结构化表单',
    tags: ['ai', 'fixed', 'human'],
    summary:
      '把学生/家长的原始意图收敛到可控输入，不保存敏感原文，先判断是否需要追问或阻断。',
    steps: [
      [
        '一句话入口',
        'MVP 3 使用 createCourseGameFromPrompt()，只传 text、profile、偏好、学习状态和家长策略。',
      ],
      [
        '产品化输入',
        'MVP 2 用 complete_course_intake 合并自然语言、偏好、学习状态和监护人限制。',
      ],
      [
        '结构化入口',
        'MVP 1 直接传 CourseSpec，适合内部服务或已完成表单的前端。',
      ],
      [
        '边界检查',
        '年级、学科、深度、视频开关、上传限制和内容严格度先进入产品策略。',
      ],
    ],
    files: [
      'packages/sdk-typescript/src/course/createCourseGame.ts',
      'packages/core/src/tools/complete-course-intake.ts',
      'packages/core/src/course/product/intakeSession.ts',
      'agent-test/docs/product/mvp2-intake-flow.md',
    ],
    operations: [
      '收集 text / CourseSpec / preferenceProfile / learningState / guardianPolicy。',
      '低影响缺失字段自动默认并记录 assumptions。',
      '高影响字段缺失时生成 followUpQuestions，停止生成。',
      '涉及未成年人隐私的数据只保留结构化摘要。',
    ],
    io: '输入：用户表达、偏好、学习状态、家长策略。输出：可解析请求或追问/阻断结果。',
  },
  {
    id: 'spec',
    title: 'CourseSpec 受控规格',
    short: '把意图落到课程合同',
    tags: ['ai', 'fixed', 'check'],
    summary:
      'AI 可以补全年级、主题、目标、风格和讲解深度，但最终必须落入 CourseSpec schema。',
    steps: [
      [
        '一句话解析',
        'generate_one_shot_course_plan 调用 promptToCourseSpec，返回 CourseSpec、assumptions、clarifications 或 blockedReasons。',
      ],
      [
        '结构校验',
        'subject、topic、learningGoals、studentProfile、styleSpec 和 explanationDepth 必须完整。',
      ],
      [
        '深度补全',
        'standard/deep/challenge 需要概念层、误区、例题、迁移任务和反馈深度。',
      ],
      [
        '下一步裁决',
        'nextTool 只能是 generate_course_plan、clarify_with_user 或 blocked。',
      ],
    ],
    files: [
      'packages/core/src/tools/generate-one-shot-course-plan.ts',
      'packages/core/src/course/one-shot/promptToCourseSpec.ts',
      'packages/core/src/course/schemas.ts',
      'packages/core/src/course/validation.ts',
      'agent-test/docs/course/explanation_depth.md',
    ],
    operations: [
      '解析一句话并归一化为 CourseSpec。',
      '将隐含字段写入 inferredFields 和 assumptions。',
      '校验学习目标和讲解深度是否足够支撑课程。',
      '如果返回 clarify 或 blocked，外部 ToC 服务必须停下。',
    ],
    io: '输入：OneShotCourseRequest 或 IntakeSession。输出：CourseSpec 或追问/阻断。',
  },
  {
    id: 'plan',
    title: '3 个课程游戏方案',
    short: 'stable / balanced / creative',
    tags: ['ai', 'fixed', 'check'],
    summary:
      'AI 生成 3 个可比较方案；固定系统限制模板族、playlet、学习目标覆盖和 workflow DAG。',
    steps: [
      [
        '候选玩法',
        'mapSubjectToGameplayCandidates 根据学习目标、阶段和核心动作选择 course_ui、course_grid 或 course_td。',
      ],
      [
        '方案生成',
        'generate_course_plan 生成 stable、balanced、creative 三个 CoursePlanOption。',
      ],
      [
        '工作流',
        '每个方案必须包含 ready playlet 组成的 DAG，所有节点可达且覆盖 learningGoals。',
      ],
      [
        '方案摘要',
        'buildCoursePlanConfirmationSummary 形成用户可看懂的确认摘要。',
      ],
    ],
    files: [
      'packages/core/src/tools/generate-course-plan.ts',
      'packages/core/src/course/gameplayMapping.ts',
      'packages/core/src/course/planScoring.ts',
      'packages/core/src/course/playletCatalog.ts',
      'agent-test/docs/course/gameplay_mapping.md',
      '.agentdocs/prd/course-gameplay-taxonomy.md',
    ],
    operations: [
      '读取 CourseSpec 和候选玩法基线评分。',
      '生成 3 个方案，包含 gameplayType、scenePlan、learningLoop、assessmentPoints 和 risks。',
      '检查所有 learningGoal 至少进入评价点和 workflow 节点。',
      '提醒必须等待 selectedPlanId 确认后才能进入 GDD。',
    ],
    io: '输入：CourseSpec。输出：3 个 CoursePlanOption 和 confirmationSummary。',
  },
  {
    id: 'quality',
    title: '质量门禁与方案确认',
    short: '未确认不进入高成本生成',
    tags: ['ai', 'human', 'check', 'fixed'],
    summary:
      '方案先评分，低分走自动修复；通过后仍必须等待用户确认 selectedPlanId。',
    steps: [
      [
        '生成前评分',
        'score_course_quality 检查教学深度、玩法精彩度、适龄、安全、视觉一致和可玩风险。',
      ],
      ['自动修复', 'repair_course_generation 产出重写动作，修复后重新评分。'],
      [
        '用户确认',
        'plan_only 模式输出方案后停止，等待外部服务或用户选择 selectedPlanId。',
      ],
      ['轻量修订', 'revise_course_plan 只改结构化对象，不直接改生成后的源码。'],
    ],
    files: [
      'packages/core/src/course/quality/courseQualityScorer.ts',
      'packages/core/src/course/quality/autoRepairLoop.ts',
      'packages/sdk-typescript/src/course/reviseCoursePlan.ts',
      'agent-test/docs/quality/quality-gates.md',
      'agent-test/docs/quality/auto-repair-loop.md',
    ],
    operations: [
      '对推荐方案和阻断项打分。',
      '未通过时输出 improvementActions，不进入 generate_course_gdd。',
      '用户确认 selectedPlanId 后，才允许 confirmed_generation。',
      '修改深度、主题、题目、视频或 TTS 时重新校验结构。',
    ],
    io: '输入：CoursePlanOption。输出：质量评分、修复动作或已确认 selectedPlanId。',
  },
  {
    id: 'gdd',
    title: 'Course GDD 生成',
    short: '把确认方案扩成实现规格',
    tags: ['ai', 'fixed', 'check'],
    summary:
      'AI 扩写讲解、互动、反馈、评价、素材和旁白计划；工具边界再次确认方案未被绕过。',
    steps: [
      [
        '确认校验',
        'generate_course_gdd 要求 userConfirmed=true，且 selectedPlanId 与 selectedPlan.id 一致。',
      ],
      [
        '质量复核',
        '工具内部重新执行 score_course_quality，防止调用方跳过门禁。',
      ],
      [
        '课程扩写',
        '生成 lessonUnits、interactionSpecs、assessmentSpec、assetPlan、narrationPlan 和 validationPlan。',
      ],
      [
        '输入不可变',
        'CourseSpec 和 selectedPlan 必须逐字段保留，不允许 AI 改写已确认输入。',
      ],
    ],
    files: [
      'packages/core/src/tools/generate-course-gdd.ts',
      'packages/core/src/course/validation.ts',
      'packages/core/src/course/quality/courseQualityScorer.ts',
      'agent-test/docs/course/course_gdd.md',
      'agent-test/docs/course/explanation_depth.md',
    ],
    operations: [
      '读取 CourseSpec、selectedPlan、selectedPlanId 和 confirmationNote。',
      '生成完整 CourseGDD JSON。',
      '校验每个目标都有讲解、互动、评价和旁白分段。',
      '返回 course-scaffold 提醒下一步复制模板与写入配置。',
    ],
    io: '输入：已确认 CourseSpec + CoursePlanOption。输出：CourseGDD 和 scaffoldPlan。',
  },
  {
    id: 'scaffold',
    title: '模板装配与课程配置',
    short: 'GDD -> 可运行工程骨架',
    tags: ['fixed', 'ai', 'check'],
    summary:
      'mapper 把 Course GDD 转为模板复制指令和 courseContent；AI 只能写内容、配置、风格和素材计划。',
    steps: [
      [
        '模板选择',
        '根据 selectedPlan.courseArchetype 选择 course_ui、course_grid 或 course_td。',
      ],
      [
        '复制 runtime',
        '复制 course_runtime、playlets/shared、被 workflow 选中的 ready playlet 和核心模板。',
      ],
      [
        '写入配置',
        '生成 src/courseContent.json、src/main.ts 和 src/LevelManager.ts。',
      ],
      [
        '禁止越界',
        '生成阶段不允许新增玩法引擎 TS 文件，只能复用已登记 playlet。',
      ],
    ],
    files: [
      'packages/core/src/course/courseGddMapper.ts',
      'agent-test/templates/core',
      'agent-test/templates/course_runtime',
      'agent-test/templates/modules/course_ui',
      'agent-test/templates/modules/course_grid',
      'agent-test/templates/modules/course_td',
      'agent-test/templates/playlets/*',
    ],
    operations: [
      'mapCourseGddToOpenGameScaffold 生成 copyInstructions。',
      '把 lessonUnits、interactions、assessments、workflow、styleBible 写入 courseContent。',
      '注册课程场景和 LEVEL_ORDER。',
      '保留 course_td 只适合复习巩固的 warning。',
    ],
    io: '输入：CourseGDD。输出：课程工程目录、courseContent.json、入口文件和复制指令。',
  },
  {
    id: 'assets',
    title: '素材、旁白与降级',
    short: '图片/BGM/SFX + TTS manifest',
    tags: ['ai', 'fixed', 'check'],
    summary:
      '普通素材和课程旁白分离处理；TTS 失败时必须写字幕降级 manifest，而不是让课程断掉。',
    steps: [
      [
        '普通素材',
        'generate_game_assets 处理图片、BGM、SFX 和可选视频素材，写入 asset-pack.json。',
      ],
      [
        '讲解旁白',
        'course_tts_manifest 根据 narrationPlan 调用 lessonin 批量 TTS。',
      ],
      [
        '字幕降级',
        'skipTts 或 TTS 失败时写 fallbackSubtitle，validate 阶段作为 warning。',
      ],
      ['视频策略', '家长关闭视频时跳过视频生成并清空必需视频资产。'],
    ],
    files: [
      'packages/core/src/tools/generate-assets.ts',
      'packages/core/src/tools/course-tts-manifest.ts',
      'packages/core/src/course/tts/narrationManifest.ts',
      'packages/core/src/course/tts/lessoninTtsService.ts',
      'agent-test/docs/course/asset_manifest.md',
      'agent-test/docs/product/mvp2-guardian-policy.md',
    ],
    operations: [
      '根据 CourseGDD.assetPlan 生成素材 key 和 url。',
      '根据 CourseGDD.narrationPlan 生成 scriptList 批量请求。',
      '持久化 public/assets/asset-pack.json 和 narration-manifest.json。',
      '记录音频可播放数量和字幕降级数量。',
    ],
    io: '输入：CourseGDD、课程工程目录。输出：asset-pack.json、narration-manifest.json 和本地/远程素材。',
  },
  {
    id: 'validate',
    title: '课程包验证与自动恢复',
    short: '发布前阻断检查',
    tags: ['check', 'fixed', 'ai'],
    summary:
      '验证工具检查课程闭环、资产、旁白、场景、workflow 和安全规则；失败时走恢复策略。',
    steps: [
      [
        '结构验证',
        'validate_course_package 读取 CourseGDD、courseContent、asset-pack、narration manifest、main 和 LevelManager。',
      ],
      ['闭环验证', '每个 learningGoal 必须有讲解、互动反馈和评价解析。'],
      [
        '运行前验证',
        '场景注册、首场景、playlet 包文件和禁止新增引擎代码都会被检查。',
      ],
      [
        '失败恢复',
        'repair_course_generation 可对 quality、asset、tts、build、browser 等阶段提出修复或降级。',
      ],
    ],
    files: [
      'packages/core/src/tools/validate-course-package.ts',
      'packages/core/src/course/courseWorkflow.ts',
      'packages/core/src/course/playletCatalog.ts',
      'packages/core/src/course/product/generationRecovery.ts',
      'integration-tests/helpers/courseBrowserSmoke.ts',
      'integration-tests/course-generation.test.ts',
    ],
    operations: [
      '存在 error 时停止发布并报告 issue。',
      'TTS 有字幕 fallback 时仅 warning，不阻断课程。',
      '验证 workflow 无环、节点可达、目标覆盖和 playlet 包存在。',
      '随后运行 build/test/browser smoke，确认首轮互动与状态节点。',
    ],
    io: '输入：课程工程目录 + CourseGDD。输出：CoursePackageValidationReport、修复建议或通过状态。',
  },
  {
    id: 'output',
    title: '最终课程输出与续作',
    short: 'H5 课程包、学习报告、下一课',
    tags: ['fixed', 'ai', 'human'],
    summary:
      '通过验证后交付可运行 H5 游戏化课程，并把学习证据用于报告和下一节课程规划。',
    steps: [
      [
        '课程包',
        '输出可运行的 Web 游戏工程，课程内容由 courseContent.json 驱动。',
      ],
      [
        '学习报告',
        '运行时从 CourseStateStore 读取正确率、提示、错因、完成目标和掌握证据。',
      ],
      [
        '经验记录',
        'record_course_experience 记录成功/失败摘要，不保存学生原始输入。',
      ],
      [
        '下一课',
        'createNextCourseGame() 基于 learningReport、learningState 和偏好生成下一课 CourseSpec。',
      ],
    ],
    files: [
      'packages/sdk-typescript/src/course/createCourseGame.ts',
      'packages/core/src/course/experience/templateExperienceStore.ts',
      'packages/core/src/course/product/learningState.ts',
      'packages/core/src/course/product/nextCoursePlanner.ts',
      'agent-test/templates/course_runtime',
    ],
    operations: [
      '交付课程工程目录或部署后的 H5 入口。',
      '展示学生可见反馈和家长可见学习报告。',
      '把学习报告更新到 LearningState。',
      '进入下一课 plan_only，重新等待方案确认。',
    ],
    io: '输入：已验证课程包与运行数据。输出：H5 课程、学习报告、经验摘要和下一课请求。',
  },
];
const tagLabel = {
  fixed: '固定不变',
  ai: 'AI 改造',
  human: '人工确认',
  check: '质量验证',
};
let selectedId = stages[0].id;
let activeFilter = 'all';
const rail = document.getElementById('stageRail');
const cards = document.getElementById('stageCards');
const panel = document.getElementById('detailPanel');
const miniMap = document.getElementById('miniMap');
function render() {
  renderRail();
  renderMiniMap();
  renderCards();
  renderDetail();
}
function passesFilter(stage) {
  return activeFilter === 'all' || stage.tags.includes(activeFilter);
}
function renderRail() {
  rail.innerHTML = stages
    .map(
      (stage, index) => `
  <button class="${stage.id === selectedId ? 'active' : ''}" data-stage="${stage.id}">
    <span class="rail-index">${index + 1}</span>
    <span>
      <span class="rail-title">${stage.title}</span>
      <span class="rail-sub">${stage.short}</span>
    </span>
  </button>
`,
    )
    .join('');
}
function renderMiniMap() {
  miniMap.innerHTML = stages
    .map(
      (stage, index) => `
  <button class="mini-node ${stage.id === selectedId ? 'active' : ''}" data-stage="${stage.id}" style="cursor:pointer;">
    <strong>${index + 1}. ${stage.title}</strong>
    <span>${stage.short}</span>
  </button>
`,
    )
    .join('');
}
function renderCards() {
  cards.innerHTML = stages
    .map((stage, index) => {
      const hidden = passesFilter(stage) ? '' : 'hidden';
      return `
    <article class="stage-card ${stage.id === selectedId ? 'active' : ''} ${hidden}" data-stage="${stage.id}">
      <div class="stage-head">
        <div class="stage-number">${index + 1}</div>
        <div>
          <h3>${stage.title}</h3>
          <p>${stage.summary}</p>
        </div>
        <div>${stage.tags.map((tag) => `<span class="tag ${tag}">${tagLabel[tag]}</span>`).join('')}</div>
      </div>
      <div class="step-list">
        ${stage.steps
          .map(
            (step) => `
          <div class="step">
            <b>${step[0]}</b>
            <span>${step[1]}</span>
          </div>
        `,
          )
          .join('')}
      </div>
    </article>
  `;
    })
    .join('');
}
function renderDetail() {
  const stage = stages.find((item) => item.id === selectedId) || stages[0];
  panel.innerHTML = `
  <div class="detail-top">
    <div>${stage.tags.map((tag) => `<span class="tag ${tag}">${tagLabel[tag]}</span>`).join('')}</div>
    <h3>${stage.title}</h3>
    <p>${stage.summary}</p>
  </div>
  <div class="detail-body">
    <div class="detail-block">
      <h4>输入 / 输出</h4>
      <p style="margin:0;color:#415049;line-height:1.6;">${stage.io}</p>
    </div>
    <div class="detail-block">
      <h4>关键操作</h4>
      <ul>${stage.operations.map((item) => `<li>${item}</li>`).join('')}</ul>
    </div>
    <div class="detail-block">
      <h4>涉及文件</h4>
      <ul>${stage.files.map((item) => `<li><code>${item}</code></li>`).join('')}</ul>
    </div>
  </div>
`;
}
document.addEventListener('click', (event) => {
  const stageButton = event.target.closest('[data-stage]');
  if (stageButton) {
    selectedId = stageButton.dataset.stage;
    render();
  }
  const filterButton = event.target.closest('[data-filter]');
  if (filterButton) {
    activeFilter = filterButton.dataset.filter;
    document.querySelectorAll('[data-filter]').forEach((button) => {
      button.classList.toggle('active', button.dataset.filter === activeFilter);
    });
    renderCards();
  }
});
render();
