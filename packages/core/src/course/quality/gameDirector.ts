/**
 * @license
 * Copyright 2025 OpenGame Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CoursePlanOption, CourseSpec } from '../schemas.js';

export type GameDirectorIssueDimension =
  | 'pacing'
  | 'stateChange'
  | 'feedbackConsequence'
  | 'knowledgeGameplayBinding'
  | 'actionPreferenceFit'
  | 'intentFit'
  | 'gameplayVariety'
  | 'antiTemplateOriginality';

export interface GameDirectorIssue {
  dimension: GameDirectorIssueDimension;
  severity: 'warning' | 'blocking';
  message: string;
  improvementAction: string;
}

export interface GameDirectorReview {
  score: number;
  passed: boolean;
  pacingNodes: string[];
  stateChanges: string[];
  feedbackConsequences: string[];
  issues: GameDirectorIssue[];
  improvementActions: string[];
}

export interface ReviewGameDirectionInput {
  courseSpec: CourseSpec;
  plan: CoursePlanOption;
}

export function reviewGameDirection({
  courseSpec,
  plan,
}: ReviewGameDirectionInput): GameDirectorReview {
  const text = collectPlanText(plan);
  const pacingNodes = detectPacingNodes(courseSpec, plan);
  const stateChanges = detectStateChanges(plan, text);
  const feedbackConsequences = detectFeedbackConsequences(plan, text);
  const issues: GameDirectorIssue[] = [];

  if (pacingNodes.length < 3) {
    issues.push({
      dimension: 'pacing',
      severity: 'blocking',
      message: '课程方案缺少导入、核心挑战、推进结算构成的节奏节点。',
      improvementAction:
        '把 scenePlan 拆成情境目标、核心操作、状态推进、迁移挑战和学习报告。',
    });
  }

  if (stateChanges.length === 0) {
    issues.push({
      dimension: 'stateChange',
      severity: 'blocking',
      message: '课程方案没有可观察的游戏状态变化。',
      improvementAction:
        '让知识判断改变路线、资源、角色状态、机关、关卡进度或任务状态。',
    });
  }

  if (feedbackConsequences.length === 0) {
    issues.push({
      dimension: 'feedbackConsequence',
      severity: 'blocking',
      message: '课程方案没有说明反馈会带来什么玩法后果。',
      improvementAction:
        '补充正确、错误和部分正确后的提示、回流、解锁或重试后果。',
    });
  }

  if (!hasKnowledgeGameplayBinding(courseSpec, plan, text)) {
    issues.push({
      dimension: 'knowledgeGameplayBinding',
      severity: 'blocking',
      message: '学习目标只出现在评价点中，没有影响核心玩法决策。',
      improvementAction:
        '把每个学习目标绑定到一个需要学生操作的节点、规则或状态变化。',
    });
  }

  if (looksLikeSkinQuiz(plan, text) && stateChanges.length === 0) {
    issues.push({
      dimension: 'knowledgeGameplayBinding',
      severity: 'blocking',
      message: '方案呈现为“答对加分”的换皮问答，知识点不影响玩法。',
      improvementAction:
        '用可操作的分类、排序、装配、调参或路径选择替代静态加分题。',
    });
  }

  if (hasActionPreference(courseSpec) && !hasActionPlaylet(plan, text)) {
    issues.push({
      dimension: 'actionPreferenceFit',
      severity: 'blocking',
      message:
        '学生偏好动作玩法，但方案没有保留瞄准、命中或移动目标等核心操作。',
      improvementAction:
        '加入 playlet-点击射击、接落物或节奏点击，并用水枪靶场、泡沫飞镖等适龄非伤害表达承载动作。',
    });
  }

  if (!hasUserIntentFit(courseSpec, plan, text)) {
    issues.push({
      dimension: 'intentFit',
      severity: 'blocking',
      message: '课程方案没有保留用户偏好的核心体验，只把偏好当作表层主题。',
      improvementAction:
        '先提取用户偏好的核心动作和情绪，再把它落到 playlet、状态变化、素材方向和反馈后果中。',
    });
  }

  if (!hasGameplayVariety(plan, text)) {
    issues.push({
      dimension: 'gameplayVariety',
      severity: 'blocking',
      message: '课程互动动作过于单一，容易退化成连续做题。',
      improvementAction:
        '至少组合两类核心动作，例如瞄准命中、等式平衡、坐标定位、调参、排序或装配。',
    });
  }

  if (!hasAntiTemplateOriginality(courseSpec, plan, text)) {
    issues.push({
      dimension: 'antiTemplateOriginality',
      severity: 'blocking',
      message: '课程方案模板味过重，缺少本次课程独有的角色、任务和奖励状态。',
      improvementAction:
        '补充围绕本次主题定制的角色身份、世界问题、道具/资源、奖励解锁和错因反馈，避免只替换题干。',
    });
  }

  const score = scoreDirection(
    pacingNodes,
    stateChanges,
    feedbackConsequences,
    issues,
    plan,
  );
  const improvementActions = uniqueActions(issues);

  return {
    score,
    passed:
      score >= 70 && !issues.some((issue) => issue.severity === 'blocking'),
    pacingNodes,
    stateChanges,
    feedbackConsequences,
    issues,
    improvementActions,
  };
}

export function directCoursePlan({
  courseSpec,
  plan,
}: ReviewGameDirectionInput): CoursePlanOption {
  const review = reviewGameDirection({ courseSpec, plan });
  if (review.passed) {
    return plan;
  }

  const pacingNodes = buildDefaultPacingNodes(courseSpec, plan);
  const directedLearningLoop = mergeOrdered(plan.learningLoop, [
    '情境导入',
    '观察示例',
    '核心操作挑战',
    '状态变化反馈',
    '迁移复盘评价',
  ]);

  return {
    ...plan,
    learningLoop: directedLearningLoop,
    scenePlan: mergeOrdered(plan.scenePlan, pacingNodes),
    recommendationReason: appendSentence(
      plan.recommendationReason,
      `导演补全要求：学生对「${courseSpec.learningGoals[0] ?? courseSpec.topic}」的判断必须触发任务状态变化和反馈后果。`,
    ),
    risks: mergeOrdered(plan.risks, review.improvementActions),
  };
}

function detectPacingNodes(
  courseSpec: CourseSpec,
  plan: CoursePlanOption,
): string[] {
  const textItems = [...plan.scenePlan, ...plan.learningLoop];
  const nodes: string[] = [];
  if (containsAny(textItems.join(' '), ['导入', '情境', '目标', '任务'])) {
    nodes.push(`${courseSpec.styleSpec.theme || courseSpec.topic}情境目标`);
  }
  if (containsAny(textItems.join(' '), ['示例', '观察', '演示'])) {
    nodes.push('观察示例');
  }
  if (
    containsAny(textItems.join(' '), ['挑战', '互动', '操作', '练习', '关卡'])
  ) {
    nodes.push(`${plan.gameplayType}核心挑战`);
  }
  if (
    containsAny(textItems.join(' '), ['解锁', '推进', '升级', '变化', '状态'])
  ) {
    nodes.push('状态推进');
  }
  if (
    containsAny(textItems.join(' '), ['迁移', '复盘', '评价', '报告', '结算'])
  ) {
    nodes.push('迁移复盘');
  }
  if (plan.workflow && plan.workflow.nodes.length >= 2) {
    nodes.push('多节点关卡推进');
  }
  return [...new Set(nodes)];
}

function detectStateChanges(plan: CoursePlanOption, text: string): string[] {
  const changes: string[] = [];
  const keywords = [
    '状态',
    '解锁',
    '升级',
    '推进',
    '变化',
    '改变',
    '资源',
    '路线',
    '路径',
    '命中',
    '瞄准',
    '移动目标',
    '装填',
    '水量',
    '角度',
    '靶',
    '机关',
    '关卡',
    '进度',
    '能量',
    '生命',
    '库存',
    '参数',
    '回路',
    '预算',
    '生态',
    '任务',
  ];

  for (const keyword of keywords) {
    if (text.includes(keyword)) {
      changes.push(keyword);
    }
  }
  if (
    plan.workflow &&
    plan.workflow.nodes.length >= 2 &&
    plan.workflow.edges.length > 0
  ) {
    changes.push('workflow 节点推进');
  }
  return [...new Set(changes)];
}

function detectFeedbackConsequences(
  plan: CoursePlanOption,
  text: string,
): string[] {
  const consequences: string[] = [];
  const keywords = [
    '反馈',
    '提示',
    '错因',
    '重试',
    '回流',
    '补救',
    '解锁',
    '修复',
    '后果',
    '结算',
  ];
  for (const keyword of keywords) {
    if (text.includes(keyword)) {
      consequences.push(keyword);
    }
  }
  if (
    plan.workflow?.edges.some(
      (edge) => edge.when === 'fail' || edge.when === 'partial',
    )
  ) {
    consequences.push('失败或部分正确回流');
  }
  return [...new Set(consequences)];
}

function hasKnowledgeGameplayBinding(
  courseSpec: CourseSpec,
  plan: CoursePlanOption,
  text: string,
): boolean {
  const operationalText = [
    plan.gameplayType,
    plan.recommendationReason,
    ...plan.scenePlan,
    JSON.stringify(plan.workflow?.nodes ?? []),
  ].join(' ');
  const coveredGoals = courseSpec.learningGoals.filter((goal) =>
    plan.assessmentPoints.some((point) => point.includes(goal)),
  );
  if (coveredGoals.length < courseSpec.learningGoals.length) {
    return false;
  }

  const workflowGoalCoverage = new Set(
    plan.workflow?.nodes.flatMap((node) => node.goalIds) ?? [],
  );
  const workflowCoversGoals =
    workflowGoalCoverage.size >= courseSpec.learningGoals.length &&
    courseSpec.learningGoals.every((_goal, index) =>
      workflowGoalCoverage.has(`goal_${index + 1}`),
    );
  const hasGoalInOperation = courseSpec.learningGoals.some((goal) =>
    containsMeaningfulPart(operationalText, goal),
  );
  const hasActionVerb = containsAny(text, [
    '拖拽',
    '瞄准',
    '命中',
    '射击',
    '水枪',
    '排序',
    '连接',
    '装配',
    '调参',
    '选择路线',
    '排查',
    '定位',
    '比较',
    '预测',
    '构建',
    '控制',
    '分配',
  ]);

  return (hasGoalInOperation || workflowCoversGoals) && hasActionVerb;
}

function hasActionPreference(courseSpec: CourseSpec): boolean {
  const text = [
    ...courseSpec.studentProfile.interests,
    ...(courseSpec.studentProfile.preferredInteraction ?? []),
    courseSpec.styleSpec.theme,
  ].join(' ');
  return containsAny(text, [
    '水枪',
    '靶场',
    '射击',
    '瞄准',
    '命中',
    '移动目标',
    '点击射击',
  ]);
}

function hasUserIntentFit(
  courseSpec: CourseSpec,
  plan: CoursePlanOption,
  text: string,
): boolean {
  const intent = buildUserIntentProfile(courseSpec);
  if (intent.keywords.length === 0) {
    return true;
  }

  const hasSurfaceAnchor = intent.keywords.some((keyword) =>
    text.includes(keyword),
  );
  const coveredActionCount = intent.coreActions.filter((action) =>
    text.includes(action),
  ).length;
  const hasPlayletFit = intent.playletHints.some((hint) => text.includes(hint));

  return hasSurfaceAnchor && (coveredActionCount >= 1 || hasPlayletFit);
}

function hasActionPlaylet(plan: CoursePlanOption, text: string): boolean {
  const playletIds = plan.workflow?.nodes.map((node) => node.playletId) ?? [];
  return (
    playletIds.some((id) =>
      ['playlet-点击射击', 'playlet-接落物', 'playlet-节奏点击'].includes(id),
    ) || containsAny(text, ['瞄准', '命中', '移动目标', '装填', '水枪', '靶场'])
  );
}

function hasGameplayVariety(plan: CoursePlanOption, text: string): boolean {
  const playletIds = plan.workflow?.nodes.map((node) => node.playletId) ?? [];
  const uniquePlaylets = new Set(playletIds);
  if (
    uniquePlaylets.size >= 2 &&
    detectActionFamilies(playletIds, text).size >= 2
  ) {
    return true;
  }
  return detectActionFamilies(playletIds, text).size >= 2;
}

function detectActionFamilies(playletIds: string[], text: string): Set<string> {
  const families = new Set<string>();
  const addIf = (family: string, keywords: string[]) => {
    if (
      playletIds.some((id) =>
        keywords.some((keyword) => id.includes(keyword)),
      ) ||
      containsAny(text, keywords)
    ) {
      families.add(family);
    }
  };

  addIf('action', ['点击射击', '接落物', '节奏点击', '瞄准', '命中', '水枪']);
  addIf('quantity', ['等式平衡', '口算挑战', '坐标定位', '图形拼装', '方程']);
  addIf('simulation', ['滑杆调参', '控制变量', 'A/B', '调参', '参数']);
  addIf('sequence', ['步骤排序', '流程接线', '证据链', '证明步骤']);
  addIf('organization', ['拖拽分箱', '连线匹配', '卡片配对', '找目标']);
  addIf('diagnosis', ['模块定位', '失败输出归因', '回归测试', '排查']);

  return families;
}

function hasAntiTemplateOriginality(
  courseSpec: CourseSpec,
  plan: CoursePlanOption,
  text: string,
): boolean {
  const userWords = [
    courseSpec.topic,
    courseSpec.styleSpec.theme,
    ...courseSpec.studentProfile.interests,
    ...(courseSpec.studentProfile.preferredInteraction ?? []),
  ].filter((word) => word.length >= 2);
  const userWordHits = userWords.filter((word) => text.includes(word)).length;
  const hasSpecificWorldState = containsAny(text, [
    '角色',
    '身份',
    '世界',
    '任务',
    '道具',
    '资源',
    '解锁',
    '奖励',
    '徽章',
    '修复',
    '建造',
    '调查',
    '经营',
    '创作',
    '验收',
  ]);
  const genericSceneCount = plan.scenePlan.filter((scene) =>
    /^(导入|练习|复盘|报告|结尾评价|题目场景|核心任务场景)$/.test(scene.trim()),
  ).length;
  const mostlyGenericScenes =
    plan.scenePlan.length > 0 && genericSceneCount >= plan.scenePlan.length - 1;

  return userWordHits >= 2 && hasSpecificWorldState && !mostlyGenericScenes;
}

function buildUserIntentProfile(courseSpec: CourseSpec): {
  keywords: string[];
  coreActions: string[];
  playletHints: string[];
} {
  const source = [
    ...courseSpec.studentProfile.interests,
    ...(courseSpec.studentProfile.preferredInteraction ?? []),
    courseSpec.styleSpec.theme,
  ].join(' ');

  const profiles = [
    {
      match: ['侦探', '推理', '调查', '破案'],
      keywords: ['侦探', '推理', '调查', '线索', '证据'],
      coreActions: ['搜证', '推理', '排除', '定位', '证据'],
      playletHints: ['证据配对', '证据链', '找异常', '条件组合推理'],
    },
    {
      match: ['建造', '拼装', '搭建', '创造'],
      keywords: ['建造', '拼装', '搭建', '材料', '结构'],
      coreActions: ['放置', '拼装', '升级', '验收', '测试'],
      playletHints: ['图形拼装', '模块装配', '需求清单验收'],
    },
    {
      match: ['经营', '管理', '资源', '商店', '农场'],
      keywords: ['经营', '管理', '资源', '预算', '收益'],
      coreActions: ['分配', '调度', '权衡', '收益', '风险'],
      playletHints: ['资源分配', '多角色决策', '调参-plus-对比'],
    },
    {
      match: ['太空', '探索', '星球', '冒险', '空间站'],
      keywords: ['太空', '探索', '星球', '航线', '基地', '空间站'],
      coreActions: ['探索', '导航', '定位', '修复', '解锁'],
      playletHints: ['迷宫寻路', '坐标定位', '模块定位'],
    },
    {
      match: ['射击', '水枪', '靶场', '瞄准', '命中'],
      keywords: ['射击', '水枪', '靶场', '瞄准', '命中'],
      coreActions: ['瞄准', '命中', '移动目标', '装填', '节奏'],
      playletHints: ['点击射击', '接落物', '节奏点击'],
    },
  ];

  for (const profile of profiles) {
    if (containsAny(source, profile.match)) {
      return {
        keywords: profile.keywords,
        coreActions: profile.coreActions,
        playletHints: profile.playletHints,
      };
    }
  }

  return { keywords: [], coreActions: [], playletHints: [] };
}

function looksLikeSkinQuiz(plan: CoursePlanOption, text: string): boolean {
  return (
    containsAny(text, ['答对加分', '答题', '问答', '选择题', '给分', '刷题']) ||
    /剧情任务|单选|quiz/i.test(plan.gameplayType)
  );
}

function scoreDirection(
  pacingNodes: string[],
  stateChanges: string[],
  feedbackConsequences: string[],
  issues: GameDirectorIssue[],
  plan: CoursePlanOption,
): number {
  let score = 45;
  score += Math.min(pacingNodes.length * 8, 32);
  score += Math.min(stateChanges.length * 5, 20);
  score += Math.min(feedbackConsequences.length * 5, 18);
  if (plan.workflow && plan.workflow.nodes.length >= 2) {
    score += 8;
  }
  score -= issues.filter((issue) => issue.severity === 'blocking').length * 18;
  score -= issues.filter((issue) => issue.severity === 'warning').length * 8;
  return clampScore(score);
}

function buildDefaultPacingNodes(
  courseSpec: CourseSpec,
  plan: CoursePlanOption,
): string[] {
  const firstGoal = courseSpec.learningGoals[0] ?? courseSpec.topic;
  return [
    `${courseSpec.styleSpec.theme || courseSpec.topic}情境目标`,
    `观察 ${firstGoal} 的可视化示例`,
    `${plan.gameplayType}核心操作挑战`,
    `知识判断触发任务状态变化`,
    `错因反馈后回流或解锁下一关`,
    `迁移挑战与学习报告`,
  ];
}

function collectPlanText(plan: CoursePlanOption): string {
  return [
    plan.title,
    plan.gameplayType,
    ...plan.learningLoop,
    ...plan.scenePlan,
    ...plan.assessmentPoints,
    plan.recommendationReason,
    ...plan.risks,
    JSON.stringify(plan.workflow ?? {}),
  ].join(' ');
}

function containsMeaningfulPart(text: string, goal: string): boolean {
  const parts = goal
    .split(/[，。、；：\s]+/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 2);
  return parts.some((part) => text.includes(part));
}

function containsAny(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => text.includes(keyword));
}

function mergeOrdered(base: string[], additions: string[]): string[] {
  const result = [...base];
  for (const item of additions) {
    if (
      !result.some(
        (existing) => existing.includes(item) || item.includes(existing),
      )
    ) {
      result.push(item);
    }
  }
  return result;
}

function appendSentence(text: string, sentence: string): string {
  return text.includes(sentence)
    ? text
    : `${text}${text.endsWith('。') ? '' : '。'}${sentence}`;
}

function uniqueActions(issues: GameDirectorIssue[]): string[] {
  return [...new Set(issues.map((issue) => issue.improvementAction))];
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}
