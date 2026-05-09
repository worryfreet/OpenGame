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

export interface FailurePatternInput extends Omit<
  RawTemplateExperienceInput,
  'kind' | 'outcomeTags'
> {
  failureReasonTags: string[];
  repairActionTags?: string[];
}

export function recordFailurePattern(
  store: TemplateExperienceStore,
  input: FailurePatternInput,
): TemplateExperienceStore {
  return addTemplateExperience(store, {
    ...input,
    kind: 'failure',
    outcomeTags: [
      ...input.failureReasonTags,
      ...(input.repairActionTags ?? []),
    ],
  });
}

export function findSimilarFailurePatterns(
  store: TemplateExperienceStore,
  query: SimilarExperienceQuery,
): SimilarExperienceMatch[] {
  return findSimilarTemplateExperiences(
    {
      patterns: store.patterns.filter((pattern) => pattern.kind === 'failure'),
    },
    query,
  );
}

export function listFailurePatterns(
  store: TemplateExperienceStore,
): TemplateExperienceSummary[] {
  return store.patterns.filter((pattern) => pattern.kind === 'failure');
}
