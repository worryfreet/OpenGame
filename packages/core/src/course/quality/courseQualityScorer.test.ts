/**
 * @license
 * Copyright 2025 OpenGame Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import type { CoursePlanOption, CourseSpec } from '../schemas.js';
import { reviewGameDirection } from './gameDirector.js';
import { reviewPedagogy } from './pedagogyReviewer.js';
import { scoreCourseQuality } from './courseQualityScorer.js';

describe('MVP 3.0 课程质量评分', () => {
  it('浅层问答缺少概念层、误区和迁移任务时失败', () => {
    const review = reviewPedagogy({
      courseSpec: buildShallowQuizSpec(),
      plan: buildShallowQuizPlan(),
    });
    const quality = scoreCourseQuality({
      courseSpec: buildShallowQuizSpec(),
      plan: buildShallowQuizPlan(),
    });

    expect(review.passed).toBe(false);
    expect(review.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ dimension: 'conceptLayer' }),
        expect.objectContaining({ dimension: 'misconception' }),
        expect.objectContaining({ dimension: 'transferTask' }),
      ]),
    );
    expect(quality.passed).toBe(false);
    expect(quality.score.pedagogyDepth).toBeLessThan(60);
    expect(quality.score.blockingIssues.length).toBeGreaterThan(0);
  });

  it('没有状态变化和反馈后果的方案被导演阻断', () => {
    const review = reviewGameDirection({
      courseSpec: buildStrongSpec(),
      plan: buildNoStateChangePlan(),
    });
    const quality = scoreCourseQuality({
      courseSpec: buildStrongSpec(),
      plan: buildNoStateChangePlan(),
    });

    expect(review.passed).toBe(false);
    expect(review.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ dimension: 'stateChange' }),
        expect.objectContaining({ dimension: 'feedbackConsequence' }),
      ]),
    );
    expect(quality.passed).toBe(false);
    expect(quality.score.playabilityRisk).toBeLessThan(70);
  });

  it('角色和 UI 主题明显冲突时视觉一致性降分', () => {
    const quality = scoreCourseQuality({
      courseSpec: buildVisualConflictSpec(),
      plan: buildVisualConflictPlan(),
    });

    expect(quality.passed).toBe(false);
    expect(quality.score.visualConsistency).toBeLessThan(70);
    expect(quality.visualConsistencyReview.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ dimension: 'characterThemeConflict' }),
        expect.objectContaining({ dimension: 'uiThemeConflict' }),
      ]),
    );
  });

  it('学生可见文案直接暴露教学目标时被阻断', () => {
    const quality = scoreCourseQuality({
      courseSpec: buildStrongSpec(),
      plan: {
        ...buildStrongPlan(),
        title: '学习目标：识别电路闭合条件',
        scenePlan: ['本课目标是识别电路闭合条件', '完成维修任务'],
      },
    });

    expect(quality.passed).toBe(false);
    expect(quality.studentFacingCopyReview.passed).toBe(false);
    expect(quality.score.blockingIssues).toContain(
      '学生可见文案直接暴露教学目标，应改成任务、谜题、角色行动或世界状态目标。',
    );
  });
});

function buildStrongSpec(overrides: Partial<CourseSpec> = {}): CourseSpec {
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
      palette: ['#2563EB', '#F59E0B', '#10B981'],
      visualMood: '明亮、有探索感',
      characterStyle: '电路工程师',
      uiDensity: 'medium',
      forbidden: ['惊吓', '血腥'],
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

function buildShallowQuizSpec(): CourseSpec {
  return buildStrongSpec({
    learningGoals: ['记住电路知识', '完成电路选择题'],
    styleSpec: {
      theme: '练习题闯关',
      palette: ['#2563EB'],
      visualMood: '普通',
      characterStyle: '学生',
      uiDensity: 'medium',
      forbidden: ['惊吓'],
    },
    explanationDepth: {
      depthLevel: 'deep',
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

function buildVisualConflictSpec(): CourseSpec {
  return buildStrongSpec({
    styleSpec: {
      theme: '空间站电路维修',
      palette: ['#2563EB', '#F59E0B'],
      visualMood: '明亮、有探索感',
      characterStyle: '森林骑士',
      uiDensity: 'medium',
      forbidden: ['惊吓'],
    },
  });
}

function buildShallowQuizPlan(): CoursePlanOption {
  return {
    id: 'weak',
    title: '电路知识选择题',
    courseArchetype: 'course_ui',
    gameplayType: '剧情任务',
    learningLoop: ['讲解', '答题', '答对加分'],
    scenePlan: ['题目场景'],
    assessmentPoints: ['记住电路知识', '完成电路选择题'],
    assetComplexity: 'low',
    score: {
      learningFit: 55,
      explanationDepthFit: 35,
      fun: 40,
      ageFit: 80,
      implementationStability: 90,
      cost: 90,
      safety: 90,
    },
    recommendationReason: '用选择题检查记忆，答对加分。',
    risks: [],
  };
}

function buildNoStateChangePlan(): CoursePlanOption {
  return {
    id: 'no-state',
    title: '空间站电路讲解',
    courseArchetype: 'course_ui',
    gameplayType: '讲解问答',
    learningLoop: ['情境导入', '观察示例', '互动练习', '评价'],
    scenePlan: ['空间站导入', '电路选择题', '结尾评价'],
    assessmentPoints: ['识别电路闭合条件', '排查灯泡不亮的原因'],
    assetComplexity: 'low',
    score: {
      learningFit: 78,
      explanationDepthFit: 74,
      fun: 58,
      ageFit: 86,
      implementationStability: 86,
      cost: 88,
      safety: 92,
    },
    recommendationReason: '用问答确认学生是否理解闭合电路。',
    risks: [],
  };
}

function buildStrongPlan(): CoursePlanOption {
  return {
    id: 'strong',
    title: '空间站电路维修',
    courseArchetype: 'course_grid',
    gameplayType: '开关组合',
    workflow: {
      startNodeId: 'switch',
      nodes: [
        {
          id: 'switch',
          playletId: 'playlet-开关组合',
          goalIds: ['goal_1'],
          config: {
            prompt: '调整开关让维修舱重新通电。',
            successCriteria: '灯泡点亮并说明维修依据。',
          },
          styleBindingId: 'station',
        },
        {
          id: 'repair',
          playletId: 'playlet-模块定位',
          goalIds: ['goal_2'],
          config: {
            prompt: '定位导致灯泡不亮的模块。',
            successCriteria: '根据证据完成维修。',
          },
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
      '状态变化反馈',
      '迁移复盘评价',
    ],
    scenePlan: ['空间站导入', '开关组合改变回路状态', '迁移挑战报告'],
    assessmentPoints: ['识别电路闭合条件', '排查灯泡不亮的原因'],
    assetComplexity: 'medium',
    score: {
      learningFit: 92,
      explanationDepthFit: 90,
      fun: 90,
      ageFit: 90,
      implementationStability: 86,
      cost: 78,
      safety: 94,
    },
    recommendationReason: '学生排查电路会改变任务状态，并触发反馈后果。',
    risks: [],
  };
}

function buildVisualConflictPlan(): CoursePlanOption {
  return {
    id: 'visual-conflict',
    title: '空间站维修',
    courseArchetype: 'course_grid',
    gameplayType: '开关组合',
    workflow: {
      startNodeId: 'switch',
      nodes: [
        {
          id: 'switch',
          playletId: 'playlet-开关组合',
          goalIds: ['goal_1'],
          config: {
            prompt: '调整开关让回路闭合。',
            successCriteria: '灯泡点亮并说明原因。',
          },
          styleBindingId: 'station',
        },
        {
          id: 'repair',
          playletId: 'playlet-模块定位',
          goalIds: ['goal_2'],
          config: {
            prompt: '定位导致灯泡不亮的模块。',
            successCriteria: '根据证据完成维修。',
          },
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
      '状态变化反馈',
      '迁移复盘评价',
    ],
    scenePlan: [
      '空间站导入',
      '木牌和羊皮纸 UI 显示电路题',
      '开关组合改变回路状态',
      '错因反馈后回流重试',
      '迁移挑战与学习报告',
    ],
    assessmentPoints: ['识别电路闭合条件', '排查灯泡不亮的原因'],
    assetComplexity: 'medium',
    score: {
      learningFit: 90,
      explanationDepthFit: 88,
      fun: 90,
      ageFit: 90,
      implementationStability: 84,
      cost: 76,
      safety: 94,
    },
    recommendationReason: '学生排查电路会改变任务状态，并触发反馈后果。',
    risks: [],
  };
}
