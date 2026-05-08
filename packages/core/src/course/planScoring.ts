/**
 * @license
 * Copyright 2025 OpenGame Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  AssetComplexity,
  CourseArchetype,
  CoursePlanOption,
  CoursePlanScore,
  CourseSpec,
  ExplanationDepthSpec,
} from './schemas.js';
import { isDepthAllowed, type GameplayCandidate } from './gameplayMapping.js';

export interface ScoreCoursePlanInput {
  courseSpec: CourseSpec;
  candidate: GameplayCandidate;
  assetComplexity?: AssetComplexity;
  risks?: string[];
}

export function scoreCoursePlan({
  courseSpec,
  candidate,
  assetComplexity = 'medium',
  risks = [],
}: ScoreCoursePlanInput): CoursePlanScore {
  const explanationDepthFit = scoreExplanationDepth(
    courseSpec.explanationDepth,
    candidate.archetype,
    candidate.maxRecommendedDepth,
  );
  const safety = scoreSafety(courseSpec, risks);
  const cost = scoreCost(assetComplexity, courseSpec);

  return {
    learningFit: scoreLearningFit(courseSpec, candidate),
    explanationDepthFit,
    fun: scoreFun(candidate.archetype, courseSpec),
    ageFit: scoreAgeFit(courseSpec, candidate.archetype),
    implementationStability: candidate.stability,
    cost,
    safety,
  };
}

export function buildCoursePlanOption(
  courseSpec: CourseSpec,
  candidate: GameplayCandidate,
  id: string,
): CoursePlanOption {
  const assetComplexity = defaultAssetComplexity(candidate.archetype);
  const score = scoreCoursePlan({ courseSpec, candidate, assetComplexity });

  return {
    id,
    title: `${courseSpec.topic} · ${candidate.gameplayType}`,
    courseArchetype: candidate.archetype,
    gameplayType: candidate.gameplayType,
    learningLoop: ['讲解', '示例', '互动练习', '反馈', '评价'],
    scenePlan: ['导入场景', '核心任务场景', '反馈复盘场景'],
    assessmentPoints: courseSpec.learningGoals,
    assetComplexity,
    score,
    recommendationReason: candidate.fitReason,
    risks: [],
  };
}

function scoreLearningFit(
  courseSpec: CourseSpec,
  candidate: GameplayCandidate,
): number {
  const goalCount = courseSpec.learningGoals.length;
  const base = candidate.archetype === 'course_td' ? 72 : 86;
  const goalBonus = goalCount >= 2 && goalCount <= 4 ? 6 : 0;
  return clampScore(base + goalBonus);
}

function scoreExplanationDepth(
  depth: ExplanationDepthSpec,
  archetype: CourseArchetype,
  maxDepth: ExplanationDepthSpec['depthLevel'],
): number {
  let score = 88;
  if (!isDepthAllowed(depth.depthLevel, maxDepth)) {
    score -= 28;
  }
  if (depth.depthLevel !== 'intro' && !depth.priorKnowledgeCheck) {
    score -= 10;
  }
  if (
    depth.depthLevel === 'deep' &&
    depth.examplePlan.transferTasks < 1
  ) {
    score -= 18;
  }
  if (
    depth.depthLevel === 'challenge' &&
    depth.examplePlan.transferTasks < 2
  ) {
    score -= 20;
  }
  if (depth.feedbackDepth === 'answer_only' && depth.depthLevel !== 'intro') {
    score -= 22;
  }
  if (archetype === 'course_td' && depth.depthLevel === 'intro') {
    score -= 18;
  }
  return clampScore(score);
}

function scoreFun(archetype: CourseArchetype, courseSpec: CourseSpec): number {
  const interestBonus = Math.min(courseSpec.studentProfile.interests.length * 3, 9);
  const baseByArchetype: Record<CourseArchetype, number> = {
    course_ui: 78,
    course_grid: 82,
    course_td: 86,
  };
  return clampScore(baseByArchetype[archetype] + interestBonus);
}

function scoreAgeFit(
  courseSpec: CourseSpec,
  archetype: CourseArchetype,
): number {
  const grade = courseSpec.studentProfile.grade;
  if (archetype === 'course_td' && grade <= 2) {
    return 62;
  }
  if (archetype === 'course_grid' && grade === 1) {
    return 76;
  }
  return 88;
}

function scoreCost(
  assetComplexity: AssetComplexity,
  courseSpec: CourseSpec,
): number {
  const baseByComplexity: Record<AssetComplexity, number> = {
    low: 92,
    medium: 76,
    high: 58,
  };
  const videoPenalty = courseSpec.studentProfile.guardianLimits
    ?.allowGeneratedVideo
    ? 0
    : 4;
  return clampScore(baseByComplexity[assetComplexity] + videoPenalty);
}

function scoreSafety(courseSpec: CourseSpec, risks: string[]): number {
  const strictBonus =
    courseSpec.studentProfile.guardianLimits?.contentStrictness === 'strict'
      ? 4
      : 0;
  const riskPenalty = Math.min(risks.length * 8, 32);
  const forbiddenPenalty = Math.min(courseSpec.styleSpec.forbidden.length * 2, 10);
  return clampScore(92 + strictBonus - riskPenalty - forbiddenPenalty);
}

function defaultAssetComplexity(archetype: CourseArchetype): AssetComplexity {
  switch (archetype) {
    case 'course_ui':
      return 'low';
    case 'course_grid':
      return 'medium';
    case 'course_td':
      return 'high';
    default:
      return assertNever(archetype);
  }
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function assertNever(value: never): never {
  throw new Error(`未支持的课程模板类型：${String(value)}`);
}
