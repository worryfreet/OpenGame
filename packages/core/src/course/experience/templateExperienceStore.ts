/**
 * @license
 * Copyright 2025 OpenGame Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CourseArchetype, StudentGrade } from '../schemas.js';

export type ExperiencePatternKind = 'success' | 'failure';

export interface TemplateExperienceSummary {
  id: string;
  kind: ExperiencePatternKind;
  subject: string;
  topicTags: string[];
  gradeBand: 'lower_primary' | 'middle_primary' | 'upper_primary';
  courseArchetype: CourseArchetype;
  gameplayType: string;
  learningGoalTags: string[];
  styleTags: string[];
  outcomeTags: string[];
  insight: string;
  createdAtIso: string;
}

export interface RawTemplateExperienceInput extends Omit<
  Partial<TemplateExperienceSummary>,
  'kind' | 'createdAtIso'
> {
  kind: ExperiencePatternKind;
  createdAtIso?: string;
  grade?: StudentGrade;
  studentName?: string;
  avatarUri?: string;
  voiceSampleUri?: string;
  rawConversation?: string;
  rawStudentInput?: string;
  fullDialogue?: string;
}

export interface TemplateExperienceStore {
  patterns: TemplateExperienceSummary[];
}

export interface SimilarExperienceQuery {
  subject?: string;
  topicTags?: string[];
  grade?: StudentGrade;
  courseArchetype?: CourseArchetype;
  gameplayType?: string;
  learningGoalTags?: string[];
  styleTags?: string[];
  outcomeTags?: string[];
  limit?: number;
  minimumScore?: number;
}

export interface SimilarExperienceMatch {
  pattern: TemplateExperienceSummary;
  similarity: number;
}

export const SENSITIVE_EXPERIENCE_FIELDS = [
  'studentName',
  'avatarUri',
  'voiceSampleUri',
  'rawConversation',
  'rawStudentInput',
  'fullDialogue',
] as const;

export function createTemplateExperienceStore(
  patterns: RawTemplateExperienceInput[] = [],
): TemplateExperienceStore {
  return {
    patterns: patterns.map((pattern) =>
      sanitizeTemplateExperienceForPersistence(pattern),
    ),
  };
}

export function sanitizeTemplateExperienceForPersistence(
  input: RawTemplateExperienceInput,
): TemplateExperienceSummary {
  const id = input.id?.trim();
  if (!id) {
    throw new Error('经验模式必须包含 id。');
  }
  const subject = input.subject?.trim();
  if (!subject) {
    throw new Error('经验模式必须包含 subject。');
  }
  const courseArchetype = input.courseArchetype;
  if (!courseArchetype) {
    throw new Error('经验模式必须包含 courseArchetype。');
  }
  const gameplayType = input.gameplayType?.trim();
  if (!gameplayType) {
    throw new Error('经验模式必须包含 gameplayType。');
  }
  const insight = input.insight?.trim();
  if (!insight) {
    throw new Error('经验模式必须包含结构化 insight。');
  }

  return {
    id,
    kind: input.kind,
    subject,
    topicTags: normalizeTags(input.topicTags),
    gradeBand: input.gradeBand ?? gradeToBand(input.grade),
    courseArchetype,
    gameplayType,
    learningGoalTags: normalizeTags(input.learningGoalTags),
    styleTags: normalizeTags(input.styleTags),
    outcomeTags: normalizeTags(input.outcomeTags),
    insight,
    createdAtIso: input.createdAtIso ?? new Date().toISOString(),
  };
}

export function addTemplateExperience(
  store: TemplateExperienceStore,
  input: RawTemplateExperienceInput,
): TemplateExperienceStore {
  const pattern = sanitizeTemplateExperienceForPersistence(input);
  return {
    patterns: [
      ...store.patterns.filter((existing) => existing.id !== pattern.id),
      pattern,
    ],
  };
}

export function findSimilarTemplateExperiences(
  store: TemplateExperienceStore,
  query: SimilarExperienceQuery,
): SimilarExperienceMatch[] {
  const limit = query.limit ?? 5;
  const minimumScore = query.minimumScore ?? 0.2;

  return store.patterns
    .map((pattern) => ({
      pattern,
      similarity: scoreSimilarity(pattern, query),
    }))
    .filter((match) => match.similarity >= minimumScore)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);
}

export function gradeToBand(
  grade: StudentGrade | undefined,
): TemplateExperienceSummary['gradeBand'] {
  if (grade === undefined || grade <= 2) {
    return 'lower_primary';
  }
  if (grade <= 4) {
    return 'middle_primary';
  }
  return 'upper_primary';
}

function scoreSimilarity(
  pattern: TemplateExperienceSummary,
  query: SimilarExperienceQuery,
): number {
  let score = 0;
  let weight = 0;

  [score, weight] = addExactScore(
    score,
    weight,
    pattern.subject,
    query.subject,
    2,
  );
  [score, weight] = addExactScore(
    score,
    weight,
    pattern.courseArchetype,
    query.courseArchetype,
    1.5,
  );
  [score, weight] = addExactScore(
    score,
    weight,
    pattern.gameplayType,
    query.gameplayType,
    1.5,
  );
  if (query.grade !== undefined) {
    [score, weight] = addExactScore(
      score,
      weight,
      pattern.gradeBand,
      gradeToBand(query.grade),
      1,
    );
  }
  [score, weight] = addSetScore(
    score,
    weight,
    pattern.topicTags,
    query.topicTags,
    2,
  );
  [score, weight] = addSetScore(
    score,
    weight,
    pattern.learningGoalTags,
    query.learningGoalTags,
    2,
  );
  [score, weight] = addSetScore(
    score,
    weight,
    pattern.styleTags,
    query.styleTags,
    1,
  );
  [score, weight] = addSetScore(
    score,
    weight,
    pattern.outcomeTags,
    query.outcomeTags,
    1,
  );

  return weight === 0 ? 0 : Number((score / weight).toFixed(3));
}

function addExactScore<T extends string>(
  score: number,
  weight: number,
  patternValue: T,
  queryValue: T | undefined,
  itemWeight: number,
): [number, number] {
  if (!queryValue) {
    return [score, weight];
  }
  return [
    score + (patternValue === queryValue ? itemWeight : 0),
    weight + itemWeight,
  ];
}

function addSetScore(
  score: number,
  weight: number,
  patternValues: string[],
  queryValues: string[] | undefined,
  itemWeight: number,
): [number, number] {
  const normalizedQuery = normalizeTags(queryValues);
  if (normalizedQuery.length === 0) {
    return [score, weight];
  }

  const patternSet = new Set(patternValues);
  const overlap = normalizedQuery.filter((value) =>
    patternSet.has(value),
  ).length;
  return [
    score + (overlap / normalizedQuery.length) * itemWeight,
    weight + itemWeight,
  ];
}

function normalizeTags(values: string[] | undefined): string[] {
  return [
    ...new Set((values ?? []).map((value) => value.trim()).filter(Boolean)),
  ];
}
