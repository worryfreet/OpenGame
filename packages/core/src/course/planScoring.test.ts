/**
 * @license
 * Copyright 2025 OpenGame Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import type { CourseSpec } from './schemas.js';
import { mapSubjectToGameplayCandidates } from './gameplayMapping.js';
import { buildCoursePlanOption, scoreCoursePlan } from './planScoring.js';

describe('scoreCoursePlan', () => {
  it('为候选玩法生成完整评分维度', () => {
    const spec = buildCourseSpec();
    const candidate = mapSubjectToGameplayCandidates(spec)[0];

    const score = scoreCoursePlan({ courseSpec: spec, candidate });

    expect(Object.keys(score).sort()).toEqual([
      'ageFit',
      'cost',
      'explanationDepthFit',
      'fun',
      'implementationStability',
      'learningFit',
      'safety',
    ]);
    expect(score.learningFit).toBeGreaterThan(0);
  });

  it('deep 深度下浅层反馈会压低 explanationDepthFit', () => {
    const spec = buildCourseSpec({
      explanationDepth: {
        ...buildCourseSpec().explanationDepth,
        depthLevel: 'deep',
        feedbackDepth: 'answer_only',
        examplePlan: {
          workedExamples: 2,
          guidedPractice: 2,
          independentChallenges: 2,
          transferTasks: 0,
        },
      },
    });
    const candidate = mapSubjectToGameplayCandidates(spec).find(
      (item) => item.archetype === 'course_ui',
    );

    expect(candidate).toBeDefined();
    const score = scoreCoursePlan({ courseSpec: spec, candidate: candidate! });

    expect(score.explanationDepthFit).toBeLessThan(60);
  });

  it('构造计划选项时保留学习目标作为评价点', () => {
    const spec = buildCourseSpec();
    const candidate = mapSubjectToGameplayCandidates(spec)[0];

    const option = buildCoursePlanOption(spec, candidate, 'stable');

    expect(option.id).toBe('stable');
    expect(option.assessmentPoints).toEqual(spec.learningGoals);
    expect(option.learningLoop).toContain('反馈');
  });
});

function buildCourseSpec(overrides: Partial<CourseSpec> = {}): CourseSpec {
  const base: CourseSpec = {
    subject: '科学',
    topic: '生态系统',
    learningGoals: ['解释食物链', '识别生态系统中的角色'],
    durationMinutes: 25,
    studentProfile: {
      grade: 5,
      interests: ['探险', '收集'],
      guardianLimits: {
        maxSessionMinutes: 30,
        allowUploadedImages: true,
        allowGeneratedVideo: false,
        contentStrictness: 'strict',
      },
    },
    styleSpec: {
      theme: '森林调查',
      palette: ['#14532D', '#FDE68A'],
      visualMood: '自然明亮',
      characterStyle: '调查员',
      uiDensity: 'medium',
      forbidden: ['惊吓'],
    },
    explanationDepth: {
      depthLevel: 'deep',
      priorKnowledgeCheck: true,
      conceptLayers: [
        {
          concept: '生产者',
          whyItMatters: '帮助理解能量来源。',
          misconceptionToAddress: ['把所有植物和动物作用混为一谈'],
          representation: 'case',
        },
        {
          concept: '消费者',
          whyItMatters: '帮助理解食物链关系。',
          misconceptionToAddress: ['只按体型判断捕食关系'],
          representation: 'visual_model',
        },
      ],
      examplePlan: {
        workedExamples: 2,
        guidedPractice: 2,
        independentChallenges: 2,
        transferTasks: 1,
      },
      feedbackDepth: 'step_by_step',
      masteryEvidence: ['能画出食物链', '能解释角色关系'],
    },
  };

  return {
    ...base,
    ...overrides,
    studentProfile: {
      ...base.studentProfile,
      ...overrides.studentProfile,
    },
    styleSpec: {
      ...base.styleSpec,
      ...overrides.styleSpec,
    },
    explanationDepth: {
      ...base.explanationDepth,
      ...overrides.explanationDepth,
    },
  };
}

