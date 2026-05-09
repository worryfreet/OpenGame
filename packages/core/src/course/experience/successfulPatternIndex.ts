/**
 * @license
 * Copyright 2025 OpenGame Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  addTemplateExperience,
  findSimilarTemplateExperiences,
  type RawTemplateExperienceInput,
  type SimilarExperienceMatch,
  type SimilarExperienceQuery,
  type TemplateExperienceStore,
  type TemplateExperienceSummary,
} from './templateExperienceStore.js';

export interface SuccessfulPatternInput extends Omit<
  RawTemplateExperienceInput,
  'kind' | 'outcomeTags'
> {
  outcomeTags?: string[];
  qualityScore: number;
}

export function recordSuccessfulPattern(
  store: TemplateExperienceStore,
  input: SuccessfulPatternInput,
): TemplateExperienceStore {
  return addTemplateExperience(store, {
    ...input,
    kind: 'success',
    outcomeTags: [
      ...(input.outcomeTags ?? []),
      `quality:${clampScore(input.qualityScore)}`,
    ],
  });
}

export function findSimilarSuccessfulPatterns(
  store: TemplateExperienceStore,
  query: SimilarExperienceQuery,
): SimilarExperienceMatch[] {
  return findSimilarTemplateExperiences(
    {
      patterns: store.patterns.filter((pattern) => pattern.kind === 'success'),
    },
    query,
  );
}

export function listSuccessfulPatterns(
  store: TemplateExperienceStore,
): TemplateExperienceSummary[] {
  return store.patterns.filter((pattern) => pattern.kind === 'success');
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}
