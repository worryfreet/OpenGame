/**
 * @license
 * Copyright 2025 OpenGame Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CoursePlanOption, CourseSpec } from '../schemas.js';

export const EXCITEMENT_DIMENSIONS = [
  'goalClarity',
  'gameLoopStrength',
  'surpriseAndProgression',
  'feedbackRichness',
  'roleAndWorldAppeal',
  'challengeCurve',
] as const;

export type ExcitementDimension = (typeof EXCITEMENT_DIMENSIONS)[number];

export interface ExcitementScore {
  goalClarity: number;
  gameLoopStrength: number;
  surpriseAndProgression: number;
  feedbackRichness: number;
  roleAndWorldAppeal: number;
  challengeCurve: number;
  total: number;
}

export interface ExcitementRubricIssue {
  dimension: ExcitementDimension;
  severity: 'warning' | 'blocking';
  message: string;
  improvementAction: string;
}

export interface ScoreCourseExcitementInput {
  courseSpec: CourseSpec;
  plan?: CoursePlanOption;
}

export interface CourseExcitementReview {
  score: ExcitementScore;
  passed: boolean;
  issues: ExcitementRubricIssue[];
}

export const MIN_EXCITEMENT_TOTAL = 75;
export const MIN_EXCITEMENT_DIMENSION = 60;

export function scoreCourseExcitement({
  courseSpec,
  plan,
}: ScoreCourseExcitementInput): CourseExcitementReview {
  const score: ExcitementScore = {
    goalClarity: scoreGoalClarity(courseSpec),
    gameLoopStrength: scoreGameLoopStrength(plan),
    surpriseAndProgression: scoreSurpriseAndProgression(courseSpec, plan),
    feedbackRichness: scoreFeedbackRichness(courseSpec, plan),
    roleAndWorldAppeal: scoreRoleAndWorldAppeal(courseSpec),
    challengeCurve: scoreChallengeCurve(courseSpec, plan),
    total: 0,
  };
  score.total = averageScore(EXCITEMENT_DIMENSIONS.map((key) => score[key]));

  const issues = buildIssues(score, plan);
  return {
    score,
    passed:
      score.total >= MIN_EXCITEMENT_TOTAL &&
      EXCITEMENT_DIMENSIONS.every(
        (dimension) => score[dimension] >= MIN_EXCITEMENT_DIMENSION,
      ) &&
      !issues.some((issue) => issue.severity === 'blocking'),
    issues,
  };
}

function scoreGoalClarity(courseSpec: CourseSpec): number {
  let score = 62;
  const goalCount = courseSpec.learningGoals.length;
  if (goalCount >= 2 && goalCount <= 4) {
    score += 14;
  }
  if (courseSpec.topic.trim().length >= 2) {
    score += 6;
  }
  if (courseSpec.explanationDepth.masteryEvidence.length >= goalCount) {
    score += 10;
  }
  if (
    courseSpec.explanationDepth.conceptLayers.length >= Math.min(goalCount, 2)
  ) {
    score += 8;
  }
  return clampScore(score);
}

function scoreGameLoopStrength(plan?: CoursePlanOption): number {
  if (!plan) {
    return 58;
  }

  let score = 55;
  const loopText = plan.learningLoop.join(' ');
  const hasCoreLoop =
    containsAny(loopText, ['讲解', '观察', '示例']) &&
    containsAny(loopText, ['互动', '挑战', '操作', '练习']) &&
    containsAny(loopText, ['反馈', '复盘', '评价']);
  if (hasCoreLoop) {
    score += 20;
  }
  if (plan.scenePlan.length >= 3) {
    score += 9;
  }
  if (plan.assessmentPoints.length >= 2) {
    score += 6;
  }
  if (!/剧情任务|选择判断/.test(plan.gameplayType)) {
    score += 6;
  }
  if (plan.workflow && plan.workflow.nodes.length >= 2) {
    score += 6;
  }
  return clampScore(score);
}

function scoreSurpriseAndProgression(
  courseSpec: CourseSpec,
  plan?: CoursePlanOption,
): number {
  let score = 56;
  const sceneText = plan?.scenePlan.join(' ') ?? '';
  if (plan && plan.scenePlan.length >= 3) {
    score += 10;
  }
  if (
    containsAny(sceneText, [
      '解锁',
      '升级',
      '变化',
      '挑战',
      '机关',
      '关卡',
      '复盘',
    ])
  ) {
    score += 12;
  }
  if (courseSpec.explanationDepth.examplePlan.transferTasks > 0) {
    score += 8;
  }
  if (
    plan?.workflow &&
    plan.workflow.edges.length >= plan.workflow.nodes.length
  ) {
    score += 8;
  }
  if (courseSpec.studentProfile.interests.length >= 2) {
    score += 6;
  }
  return clampScore(score);
}

function scoreFeedbackRichness(
  courseSpec: CourseSpec,
  plan?: CoursePlanOption,
): number {
  let score = 52;
  const feedbackDepth = courseSpec.explanationDepth.feedbackDepth;
  if (feedbackDepth === 'short_reason') {
    score += 10;
  } else if (feedbackDepth === 'step_by_step') {
    score += 20;
  } else if (feedbackDepth === 'socratic_hint') {
    score += 22;
  }

  const misconceptionCount = courseSpec.explanationDepth.conceptLayers.reduce(
    (sum, layer) => sum + layer.misconceptionToAddress.length,
    0,
  );
  score += Math.min(misconceptionCount * 4, 12);
  if (courseSpec.explanationDepth.priorKnowledgeCheck) {
    score += 6;
  }
  if (plan?.learningLoop.some((step) => step.includes('反馈'))) {
    score += 6;
  }
  return clampScore(score);
}

function scoreRoleAndWorldAppeal(courseSpec: CourseSpec): number {
  let score = 54;
  const style = courseSpec.styleSpec;
  if (style.theme.trim().length >= 2) {
    score += 10;
  }
  if (style.characterStyle.trim().length >= 2) {
    score += 8;
  }
  if (style.visualMood.trim().length >= 2) {
    score += 6;
  }
  if (style.palette.length >= 2) {
    score += 6;
  }
  if (courseSpec.studentProfile.interests.length >= 1) {
    score += 8;
  }
  if (courseSpec.studentProfile.interests.length >= 2) {
    score += 4;
  }
  return clampScore(score);
}

function scoreChallengeCurve(
  courseSpec: CourseSpec,
  plan?: CoursePlanOption,
): number {
  const examplePlan = courseSpec.explanationDepth.examplePlan;
  let score = 50;
  if (examplePlan.workedExamples > 0) {
    score += 8;
  }
  if (examplePlan.guidedPractice > 0) {
    score += 8;
  }
  if (examplePlan.independentChallenges > 0) {
    score += 10;
  }
  if (examplePlan.transferTasks > 0) {
    score += 12;
  }
  if (courseSpec.explanationDepth.depthLevel === 'challenge') {
    score += examplePlan.transferTasks >= 2 ? 6 : -8;
  }
  if (plan && plan.scenePlan.length >= 3) {
    score += 6;
  }
  return clampScore(score);
}

function buildIssues(
  score: ExcitementScore,
  plan?: CoursePlanOption,
): ExcitementRubricIssue[] {
  const issues: ExcitementRubricIssue[] = [];
  for (const dimension of EXCITEMENT_DIMENSIONS) {
    if (score[dimension] < MIN_EXCITEMENT_DIMENSION) {
      issues.push({
        dimension,
        severity: 'blocking',
        message: `${dimension} 低于最低门槛。`,
        improvementAction: getImprovementAction(dimension),
      });
    }
  }

  if (!plan) {
    issues.push({
      dimension: 'gameLoopStrength',
      severity: 'warning',
      message: '缺少课程方案时只能评估输入和风格，玩法循环评分会偏保守。',
      improvementAction: '补充 CoursePlanOption 后重新评估玩法循环和推进节奏。',
    });
  }

  if (score.total < MIN_EXCITEMENT_TOTAL) {
    issues.push({
      dimension: 'surpriseAndProgression',
      severity: 'blocking',
      message: '课程整体精彩度低于进入高成本生成的门槛。',
      improvementAction: '强化状态变化、关卡推进、反馈密度和迁移挑战后重评。',
    });
  }

  return issues;
}

function getImprovementAction(dimension: ExcitementDimension): string {
  switch (dimension) {
    case 'goalClarity':
      return '收敛到 2-4 个学习目标，并补齐可观察的掌握证据。';
    case 'gameLoopStrength':
      return '补齐导入、核心操作、即时反馈和结算复盘的闭环。';
    case 'surpriseAndProgression':
      return '加入解锁、变化、升级或关卡推进，避免静态问答。';
    case 'feedbackRichness':
      return '用步骤化反馈或苏格拉底提示解释错因和下一步。';
    case 'roleAndWorldAppeal':
      return '把学生兴趣、角色方向、视觉氛围和配色绑定成统一世界。';
    case 'challengeCurve':
      return '按示例、引导练习、独立挑战、迁移任务组织难度曲线。';
    default:
      return assertNever(dimension);
  }
}

function containsAny(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => text.includes(keyword));
}

function averageScore(scores: number[]): number {
  return clampScore(
    scores.reduce((sum, score) => sum + score, 0) / Math.max(scores.length, 1),
  );
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function assertNever(value: never): never {
  throw new Error(`未支持的精彩度维度：${String(value)}`);
}
