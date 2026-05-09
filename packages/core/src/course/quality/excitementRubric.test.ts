/**
 * @license
 * Copyright 2025 OpenGame Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import type { CoursePlanOption, CourseSpec } from '../schemas.js';
import {
  EXCITEMENT_DIMENSIONS,
  MIN_EXCITEMENT_TOTAL,
  scoreCourseExcitement,
} from './excitementRubric.js';

describe('scoreCourseExcitement', () => {
  it('输出固定精彩度维度和总分', () => {
    const review = scoreCourseExcitement({
      courseSpec: buildCourseSpec(),
      plan: buildStrongPlan(),
    });

    expect(Object.keys(review.score).sort()).toEqual(
      [...EXCITEMENT_DIMENSIONS, 'total'].sort(),
    );
    for (const value of Object.values(review.score)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(100);
    }
    expect(review.passed).toBe(true);
    expect(review.score.total).toBeGreaterThanOrEqual(MIN_EXCITEMENT_TOTAL);
  });

  it('完整玩法循环显著高于静态换皮问答', () => {
    const courseSpec = buildCourseSpec();
    const strong = scoreCourseExcitement({
      courseSpec,
      plan: buildStrongPlan(),
    });
    const weak = scoreCourseExcitement({
      courseSpec: buildShallowCourseSpec(),
      plan: buildWeakPlan(),
    });

    expect(strong.score.total).toBeGreaterThan(weak.score.total + 15);
    expect(weak.passed).toBe(false);
    expect(weak.issues.some((issue) => issue.severity === 'blocking')).toBe(
      true,
    );
  });

  it('缺少方案时不修改输入对象且给出保守评分提醒', () => {
    const courseSpec = buildCourseSpec();
    const before = JSON.stringify(courseSpec);

    const review = scoreCourseExcitement({ courseSpec });

    expect(JSON.stringify(courseSpec)).toBe(before);
    expect(review.score.gameLoopStrength).toBeLessThan(60);
    expect(review.issues).toContainEqual(
      expect.objectContaining({
        dimension: 'gameLoopStrength',
        severity: 'blocking',
      }),
    );
  });
});

function buildCourseSpec(overrides: Partial<CourseSpec> = {}): CourseSpec {
  const base: CourseSpec = {
    subject: '科学',
    topic: '简单电路',
    learningGoals: ['识别电路闭合条件', '排查灯泡不亮的原因'],
    durationMinutes: 25,
    studentProfile: {
      grade: 5,
      readingLevel: 'medium',
      interests: ['空间站', '维修'],
      guardianLimits: {
        maxSessionMinutes: 30,
        allowUploadedImages: false,
        allowGeneratedVideo: false,
        contentStrictness: 'strict',
      },
    },
    styleSpec: {
      theme: '空间站电路维修',
      palette: ['#2563EB', '#F59E0B'],
      visualMood: '明亮、有探索感',
      characterStyle: '电路工程师',
      uiDensity: 'medium',
      forbidden: ['惊吓'],
    },
    explanationDepth: {
      depthLevel: 'deep',
      priorKnowledgeCheck: true,
      conceptLayers: [
        {
          concept: '闭合电路',
          whyItMatters: '帮助学生判断灯泡为什么亮。',
          misconceptionToAddress: ['只看有没有电池，不看回路是否闭合'],
          representation: 'visual_model',
        },
        {
          concept: '故障排查',
          whyItMatters: '帮助学生按证据定位问题。',
          misconceptionToAddress: ['随机更换元件而不看证据'],
          representation: 'case',
        },
      ],
      examplePlan: {
        workedExamples: 2,
        guidedPractice: 2,
        independentChallenges: 2,
        transferTasks: 1,
      },
      feedbackDepth: 'socratic_hint',
      masteryEvidence: ['能说明闭合条件', '能定位灯泡不亮的原因'],
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

function buildShallowCourseSpec(): CourseSpec {
  return buildCourseSpec({
    learningGoals: ['记住电路知识'],
    studentProfile: {
      grade: 5,
      interests: [],
    },
    styleSpec: {
      theme: '练习题',
      palette: ['#2563EB'],
      visualMood: '普通',
      characterStyle: '学生',
      uiDensity: 'medium',
      forbidden: ['惊吓'],
    },
    explanationDepth: {
      depthLevel: 'intro',
      priorKnowledgeCheck: false,
      conceptLayers: [
        {
          concept: '电路',
          whyItMatters: '考试会用到。',
          misconceptionToAddress: [],
          representation: 'formula',
        },
      ],
      examplePlan: {
        workedExamples: 0,
        guidedPractice: 1,
        independentChallenges: 0,
        transferTasks: 0,
      },
      feedbackDepth: 'answer_only',
      masteryEvidence: ['能答题'],
    },
  });
}

function buildStrongPlan(): CoursePlanOption {
  return {
    id: 'strong',
    title: '简单电路 · 开关组合',
    courseArchetype: 'course_grid',
    gameplayType: '开关组合',
    workflow: {
      startNodeId: 'switch',
      nodes: [
        {
          id: 'switch',
          playletId: 'playlet-开关组合',
          goalIds: ['goal_1'],
          config: {},
          styleBindingId: 'station',
        },
        {
          id: 'repair',
          playletId: 'playlet-模块定位',
          goalIds: ['goal_2'],
          config: {},
          styleBindingId: 'station',
        },
      ],
      edges: [
        { from: 'switch', to: 'repair', when: 'success' },
        { from: 'repair', to: 'switch', when: 'partial' },
      ],
      recoveryPolicy: 'hint_then_retry',
    },
    learningLoop: [
      '情境导入',
      '观察示例',
      '核心操作挑战',
      '即时反馈',
      '复盘评价',
    ],
    scenePlan: [
      '空间站导入',
      '开关组合核心关卡',
      '任务状态推进解锁变化',
      '迁移挑战与学习报告',
    ],
    assessmentPoints: ['识别电路闭合条件', '排查灯泡不亮的原因'],
    assetComplexity: 'medium',
    score: {
      learningFit: 90,
      explanationDepthFit: 88,
      fun: 92,
      ageFit: 90,
      implementationStability: 84,
      cost: 76,
      safety: 94,
    },
    recommendationReason: '操作开关会改变电路状态，反馈能暴露误区。',
    risks: [],
  };
}

function buildWeakPlan(): CoursePlanOption {
  return {
    id: 'weak',
    title: '简单电路 · 选择题',
    courseArchetype: 'course_ui',
    gameplayType: '剧情任务',
    learningLoop: ['讲解', '答题', '给分'],
    scenePlan: ['题目场景'],
    assessmentPoints: ['记住电路知识'],
    assetComplexity: 'low',
    score: {
      learningFit: 60,
      explanationDepthFit: 40,
      fun: 45,
      ageFit: 80,
      implementationStability: 90,
      cost: 90,
      safety: 90,
    },
    recommendationReason: '用选择题检查记忆。',
    risks: [],
  };
}
