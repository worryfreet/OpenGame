/**
 * @license
 * Copyright 2025 OpenGame Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  CourseArchetype,
  CourseSpec,
  ExplanationDepthLevel,
} from './schemas.js';
import {
  resolveSubjectTaxonomy,
  type SubjectCategory,
} from './subjectTaxonomy.js';

export interface GameplayCandidate {
  archetype: CourseArchetype;
  gameplayType: string;
  subjectCategory: SubjectCategory;
  fitReason: string;
  stability: number;
  maxRecommendedDepth: ExplanationDepthLevel;
}

const DEPTH_ORDER: Record<ExplanationDepthLevel, number> = {
  intro: 1,
  standard: 2,
  deep: 3,
  challenge: 4,
};

export function isDepthAllowed(
  requested: ExplanationDepthLevel,
  maximum: ExplanationDepthLevel,
): boolean {
  return DEPTH_ORDER[requested] <= DEPTH_ORDER[maximum];
}

export function mapSubjectToGameplayCandidates(
  courseSpec: CourseSpec,
): GameplayCandidate[] {
  const taxonomy = resolveSubjectTaxonomy(courseSpec.subject);
  const depth = courseSpec.explanationDepth.depthLevel;
  const gameplayByArchetype = pickGameplayTypes(taxonomy.recommendedGameplayTypes);

  return taxonomy.defaultArchetypes.map((archetype, index) => {
    const maxRecommendedDepth = getMaxDepth(archetype);
    const depthPenalty = isDepthAllowed(depth, maxRecommendedDepth) ? 0 : 18;
    return {
      archetype,
      gameplayType: gameplayByArchetype[index] ?? gameplayByArchetype[0],
      subjectCategory: taxonomy.category,
      fitReason: buildFitReason(taxonomy.label, archetype),
      stability: Math.max(50, getBaseStability(archetype) - depthPenalty),
      maxRecommendedDepth,
    };
  });
}

function pickGameplayTypes(recommended: string[]): string[] {
  return recommended.length > 0 ? recommended : ['剧情任务'];
}

function getBaseStability(archetype: CourseArchetype): number {
  switch (archetype) {
    case 'course_ui':
      return 92;
    case 'course_grid':
      return 84;
    case 'course_td':
      return 72;
    default:
      return assertNever(archetype);
  }
}

function getMaxDepth(archetype: CourseArchetype): ExplanationDepthLevel {
  switch (archetype) {
    case 'course_ui':
      return 'deep';
    case 'course_grid':
      return 'challenge';
    case 'course_td':
      return 'challenge';
    default:
      return assertNever(archetype);
  }
}

function buildFitReason(label: string, archetype: CourseArchetype): string {
  switch (archetype) {
    case 'course_ui':
      return `${label}内容可通过讲解、对话、选择和即时反馈形成稳定闭环。`;
    case 'course_grid':
      return `${label}内容可拆成分类、排序或步骤推理任务。`;
    case 'course_td':
      return `${label}内容适合在已学习后用波次挑战做复习巩固。`;
    default:
      return assertNever(archetype);
  }
}

function assertNever(value: never): never {
  throw new Error(`未支持的课程模板类型：${String(value)}`);
}
