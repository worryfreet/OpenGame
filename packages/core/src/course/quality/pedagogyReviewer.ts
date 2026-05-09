/**
 * @license
 * Copyright 2025 OpenGame Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CoursePlanOption, CourseSpec } from '../schemas.js';

export type PedagogyIssueDimension =
  | 'conceptLayer'
  | 'misconception'
  | 'transferTask'
  | 'feedbackDepth'
  | 'masteryEvidence';

export interface PedagogyIssue {
  dimension: PedagogyIssueDimension;
  severity: 'warning' | 'blocking';
  message: string;
  improvementAction: string;
}

export interface PedagogyReview {
  score: number;
  passed: boolean;
  issues: PedagogyIssue[];
  improvementActions: string[];
}

export interface ReviewPedagogyInput {
  courseSpec: CourseSpec;
  plan?: CoursePlanOption;
}

export function reviewPedagogy({
  courseSpec,
  plan,
}: ReviewPedagogyInput): PedagogyReview {
  const issues: PedagogyIssue[] = [];
  const depth = courseSpec.explanationDepth;
  const conceptLayerCount = depth.conceptLayers.length;
  const misconceptionCount = depth.conceptLayers.reduce(
    (sum, layer) => sum + layer.misconceptionToAddress.length,
    0,
  );
  const transferTasks = depth.examplePlan.transferTasks;

  if (conceptLayerCount < Math.min(courseSpec.learningGoals.length, 2)) {
    issues.push({
      dimension: 'conceptLayer',
      severity: 'blocking',
      message: '课程缺少足够的概念层，容易退化为浅层问答。',
      improvementAction: '为核心学习目标补充概念、价值说明和可视化或案例表征。',
    });
  }

  if (misconceptionCount === 0) {
    issues.push({
      dimension: 'misconception',
      severity: 'blocking',
      message: '课程没有识别学生可能出现的误区。',
      improvementAction: '为每个核心概念补充常见误区，并在反馈中解释错因。',
    });
  }

  if (transferTasks === 0 && isDeepEnough(courseSpec)) {
    issues.push({
      dimension: 'transferTask',
      severity: 'blocking',
      message: '课程缺少迁移任务，无法证明学生能在新情境中使用知识。',
      improvementAction: '增加至少一个换情境、换材料或换约束的迁移挑战。',
    });
  } else if (transferTasks === 0) {
    issues.push({
      dimension: 'transferTask',
      severity: 'warning',
      message: '课程没有迁移任务，掌握证据偏弱。',
      improvementAction: '为结尾补充一个低成本迁移检查。',
    });
  }

  if (depth.feedbackDepth === 'answer_only') {
    issues.push({
      dimension: 'feedbackDepth',
      severity: 'blocking',
      message: '反馈只给答案，不能支持概念理解和错因修正。',
      improvementAction:
        '把反馈升级为步骤化说明或苏格拉底提示，包含下一步操作建议。',
    });
  }

  if (depth.masteryEvidence.length < courseSpec.learningGoals.length) {
    issues.push({
      dimension: 'masteryEvidence',
      severity: 'warning',
      message: '掌握证据没有覆盖全部学习目标。',
      improvementAction: '为每个学习目标补充可观察的掌握证据。',
    });
  }

  if (plan && looksLikeShallowQuiz(courseSpec, plan)) {
    issues.push({
      dimension: 'conceptLayer',
      severity: 'blocking',
      message: '方案以静态答题为主，概念层、误区和迁移任务没有进入玩法。',
      improvementAction:
        '把问题改造成分类、排序、装配、实验或决策任务，并把错因反馈接入回流。',
    });
  }

  const score = scorePedagogy(courseSpec, plan, issues);
  return {
    score,
    passed:
      score >= 70 && !issues.some((issue) => issue.severity === 'blocking'),
    issues,
    improvementActions: [
      ...new Set(issues.map((issue) => issue.improvementAction)),
    ],
  };
}

function looksLikeShallowQuiz(
  courseSpec: CourseSpec,
  plan: CoursePlanOption,
): boolean {
  const text = [
    plan.gameplayType,
    ...plan.learningLoop,
    ...plan.scenePlan,
    plan.recommendationReason,
  ].join(' ');
  const shallowSignals = ['答题', '问答', '选择题', '给分', '刷题', '答对加分'];
  const lacksDepth =
    courseSpec.explanationDepth.conceptLayers.length <= 1 ||
    courseSpec.explanationDepth.conceptLayers.every(
      (layer) => layer.misconceptionToAddress.length === 0,
    ) ||
    courseSpec.explanationDepth.examplePlan.transferTasks === 0;

  return lacksDepth && shallowSignals.some((signal) => text.includes(signal));
}

function scorePedagogy(
  courseSpec: CourseSpec,
  plan: CoursePlanOption | undefined,
  issues: PedagogyIssue[],
): number {
  const depth = courseSpec.explanationDepth;
  let score = 48;
  score += Math.min(depth.conceptLayers.length * 10, 24);
  score += Math.min(
    depth.conceptLayers.reduce(
      (sum, layer) => sum + layer.misconceptionToAddress.length,
      0,
    ) * 6,
    18,
  );
  score += Math.min(depth.examplePlan.transferTasks * 10, 20);
  score += depth.priorKnowledgeCheck ? 6 : 0;
  score += feedbackDepthBonus(depth.feedbackDepth);
  if (
    (plan?.assessmentPoints?.length ?? 0) >= courseSpec.learningGoals.length
  ) {
    score += 4;
  }
  score -= issues.filter((issue) => issue.severity === 'blocking').length * 14;
  score -= issues.filter((issue) => issue.severity === 'warning').length * 6;
  return clampScore(score);
}

function feedbackDepthBonus(
  feedbackDepth: CourseSpec['explanationDepth']['feedbackDepth'],
): number {
  switch (feedbackDepth) {
    case 'answer_only':
      return 0;
    case 'short_reason':
      return 6;
    case 'step_by_step':
      return 12;
    case 'socratic_hint':
      return 14;
    default:
      return 0;
  }
}

function isDeepEnough(courseSpec: CourseSpec): boolean {
  return (
    courseSpec.explanationDepth.depthLevel === 'deep' ||
    courseSpec.explanationDepth.depthLevel === 'challenge'
  );
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}
