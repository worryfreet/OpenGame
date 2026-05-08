/**
 * @license
 * Copyright 2025 OpenGame Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import type { CourseSpec } from './schemas.js';
import { mapSubjectToGameplayCandidates } from './gameplayMapping.js';
import { resolveSubjectTaxonomy } from './subjectTaxonomy.js';

describe('mapSubjectToGameplayCandidates', () => {
  it('数学映射到三个受控课程模板', () => {
    const candidates = mapSubjectToGameplayCandidates(buildCourseSpec('数学'));

    expect(candidates.map((candidate) => candidate.archetype)).toEqual([
      'course_ui',
      'course_grid',
      'course_td',
    ]);
    expect(candidates.every((candidate) => candidate.stability > 0)).toBe(true);
  });

  it('科学优先映射到网格推理和 UI 讲解模板', () => {
    const candidates = mapSubjectToGameplayCandidates(buildCourseSpec('科学'));

    expect(candidates.map((candidate) => candidate.archetype)).toEqual([
      'course_grid',
      'course_ui',
    ]);
  });

  it('未知学科降级到 course_ui，保留全学科入口', () => {
    const taxonomy = resolveSubjectTaxonomy('棋类策略');
    const candidates = mapSubjectToGameplayCandidates(buildCourseSpec('棋类策略'));

    expect(taxonomy.category).toBe('general');
    expect(candidates).toHaveLength(1);
    expect(candidates[0].archetype).toBe('course_ui');
  });
});

function buildCourseSpec(subject: string): CourseSpec {
  return {
    subject,
    topic: '主题',
    learningGoals: ['目标一'],
    durationMinutes: 15,
    studentProfile: {
      grade: 4,
      interests: ['探索'],
    },
    styleSpec: {
      theme: '探索任务',
      palette: ['#0F766E'],
      visualMood: '清晰',
      characterStyle: '伙伴',
      uiDensity: 'medium',
      forbidden: [],
    },
    explanationDepth: {
      depthLevel: 'intro',
      priorKnowledgeCheck: false,
      conceptLayers: [
        {
          concept: '概念',
          whyItMatters: '用于理解主题。',
          misconceptionToAddress: [],
          representation: 'case',
        },
      ],
      examplePlan: {
        workedExamples: 1,
        guidedPractice: 2,
        independentChallenges: 0,
        transferTasks: 0,
      },
      feedbackDepth: 'short_reason',
      masteryEvidence: ['完成一次判断'],
    },
  };
}
