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
  | 'knowledgeGameplayBinding';

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
