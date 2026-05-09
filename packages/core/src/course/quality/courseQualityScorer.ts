/**
 * @license
 * Copyright 2025 OpenGame Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CoursePlanOption, CourseSpec } from '../schemas.js';
import { scoreCourseExcitement } from './excitementRubric.js';
import {
  reviewGameDirection,
  type GameDirectorIssue,
  type GameDirectorReview,
} from './gameDirector.js';
import {
  reviewPedagogy,
  type PedagogyIssue,
  type PedagogyReview,
} from './pedagogyReviewer.js';
import {
  scoreVisualConsistency,
  type VisualConsistencyIssue,
  type VisualConsistencyReview,
} from './visualConsistencyScorer.js';

export interface CourseQualityScore {
  pedagogyDepth: number;
  gameplayExcitement: number;
  ageFit: number;
  visualConsistency: number;
  playabilityRisk: number;
  safety: number;
  total: number;
  blockingIssues: string[];
  improvementActions: string[];
}

export interface CourseQualityReview {
  score: CourseQualityScore;
  passed: boolean;
  pedagogy: PedagogyReview;
  gameDirection?: GameDirectorReview;
  visualConsistencyReview: VisualConsistencyReview;
  studentFacingCopyReview: StudentFacingCopyReview;
}

export interface ScoreCourseQualityInput {
  courseSpec: CourseSpec;
  plan?: CoursePlanOption;
}

interface StudentFacingCopyReview {
  passed: boolean;
  issues: string[];
  improvementActions: string[];
}

export function scoreCourseQuality({
  courseSpec,
  plan,
}: ScoreCourseQualityInput): CourseQualityReview {
  const excitement = scoreCourseExcitement({ courseSpec, plan });
  const pedagogy = reviewPedagogy({ courseSpec, plan });
  const visualConsistencyReview = scoreVisualConsistency({ courseSpec, plan });
  const gameDirection = plan
    ? reviewGameDirection({ courseSpec, plan })
    : undefined;
  const studentFacingCopyReview = reviewStudentFacingCopy({
    courseSpec,
    plan,
  });

  const score: CourseQualityScore = {
    pedagogyDepth: pedagogy.score,
    gameplayExcitement: excitement.score.total,
    ageFit: scoreAgeFit(courseSpec, plan),
    visualConsistency: visualConsistencyReview.score,
    playabilityRisk: scorePlayabilityRisk(plan, gameDirection),
    safety: scoreSafety(courseSpec, plan),
    total: 0,
    blockingIssues: [
      ...excitement.issues
        .filter((issue) => issue.severity === 'blocking')
        .map((issue) => issue.message),
      ...collectBlockingIssues(pedagogy.issues),
      ...collectBlockingIssues(visualConsistencyReview.issues),
      ...(gameDirection ? collectBlockingIssues(gameDirection.issues) : []),
      ...studentFacingCopyReview.issues,
    ],
    improvementActions: [
      ...excitement.issues.map((issue) => issue.improvementAction),
      ...pedagogy.improvementActions,
      ...visualConsistencyReview.improvementActions,
      ...(gameDirection?.improvementActions ?? []),
      ...studentFacingCopyReview.improvementActions,
    ],
  };
  score.total = weightedTotal(score);
  score.blockingIssues = [...new Set(score.blockingIssues)];
  score.improvementActions = [...new Set(score.improvementActions)];

  return {
    score,
    passed:
      score.total >= 75 &&
      score.blockingIssues.length === 0 &&
      excitement.passed &&
      pedagogy.passed &&
      visualConsistencyReview.passed &&
      (gameDirection?.passed ?? true) &&
      studentFacingCopyReview.passed,
    pedagogy,
    gameDirection,
    visualConsistencyReview,
    studentFacingCopyReview,
  };
}

function scoreAgeFit(courseSpec: CourseSpec, plan?: CoursePlanOption): number {
  let score = plan?.score.ageFit ?? 70;
  const grade = courseSpec.studentProfile.grade;
  const uiDensity = courseSpec.styleSpec.uiDensity;

  if (grade <= 2 && uiDensity === 'high') {
    score -= 18;
  }
  if (
    grade >= 5 &&
    uiDensity === 'low' &&
    courseSpec.explanationDepth.depthLevel === 'challenge'
  ) {
    score -= 10;
  }
  if (
    courseSpec.durationMinutes >
    (courseSpec.studentProfile.guardianLimits?.maxSessionMinutes ?? 30)
  ) {
    score -= 16;
  }
  if (courseSpec.studentProfile.readingLevel === 'low' && grade <= 2) {
    score += 4;
  }
  return clampScore(score);
}

function scorePlayabilityRisk(
  plan: CoursePlanOption | undefined,
  gameDirection: GameDirectorReview | undefined,
): number {
  if (!plan) {
    return 50;
  }
  let score = plan.score.implementationStability;
  if (!plan.workflow || plan.workflow.nodes.length < 2) {
    score -= 18;
  }
  if (plan.assetComplexity === 'high') {
    score -= 6;
  }
  if (plan.risks.some((risk) => /不可控|高风险|无法|依赖/.test(risk))) {
    score -= 12;
  }
  if (gameDirection && !gameDirection.passed) {
    score -= 18;
  }
  return clampScore(score);
}

function scoreSafety(courseSpec: CourseSpec, plan?: CoursePlanOption): number {
  let score = plan?.score.safety ?? 80;
  const combinedText = [
    courseSpec.styleSpec.theme,
    courseSpec.styleSpec.characterStyle,
    courseSpec.styleSpec.visualMood,
    ...(plan?.scenePlan ?? []),
    ...(plan?.risks ?? []),
  ].join(' ');

  for (const forbidden of courseSpec.styleSpec.forbidden) {
    if (forbidden && combinedText.includes(forbidden)) {
      score -= 30;
    }
  }
  if (
    courseSpec.studentProfile.guardianLimits?.contentStrictness === 'strict' &&
    /惊吓|恐怖|血腥|暴力|擦边/.test(combinedText)
  ) {
    score -= 24;
  }
  return clampScore(score);
}

function weightedTotal(score: CourseQualityScore): number {
  return clampScore(
    score.pedagogyDepth * 0.22 +
      score.gameplayExcitement * 0.24 +
      score.ageFit * 0.14 +
      score.visualConsistency * 0.14 +
      score.playabilityRisk * 0.16 +
      score.safety * 0.1,
  );
}

function reviewStudentFacingCopy({
  courseSpec,
  plan,
}: ScoreCourseQualityInput): StudentFacingCopyReview {
  if (!plan) {
    return { passed: true, issues: [], improvementActions: [] };
  }

  const studentFacingTexts = [
    plan.title,
    plan.gameplayType,
    ...plan.learningLoop,
    ...plan.scenePlan,
    plan.recommendationReason,
    ...(plan.workflow?.nodes.flatMap((node) =>
      collectStudentFacingValues(node.config),
    ) ?? []),
  ];
  const combinedText = studentFacingTexts.join('\n');
  const exposesGoal =
    /学习目标|教学目标|掌握目标|本课目标|课程目标/.test(combinedText) ||
    courseSpec.learningGoals.some((goal) =>
      goal.length >= 6 && combinedText.includes(goal),
    );

  if (!exposesGoal) {
    return { passed: true, issues: [], improvementActions: [] };
  }

  return {
    passed: false,
    issues: [
      '学生可见文案直接暴露教学目标，应改成任务、谜题、角色行动或世界状态目标。',
    ],
    improvementActions: [
      '把学生端文案从“学习/掌握某目标”改写为游戏任务；家长报告和课程元数据仍保留明确学习目标。',
    ],
  };
}

function collectStudentFacingValues(value: unknown): string[] {
  if (typeof value === 'string') {
    return [value];
  }
  if (Array.isArray(value)) {
    return value.flatMap(collectStudentFacingValues);
  }
  if (value && typeof value === 'object') {
    return Object.values(value).flatMap(collectStudentFacingValues);
  }
  return [];
}

function collectBlockingIssues(
  issues: Array<PedagogyIssue | VisualConsistencyIssue | GameDirectorIssue>,
): string[] {
  return issues
    .filter((issue) => issue.severity === 'blocking')
    .map((issue) => issue.message);
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}
