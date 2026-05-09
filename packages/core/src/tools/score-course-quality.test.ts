/**
 * @license
 * Copyright 2025 OpenGame Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import type { CoursePlanOption, CourseSpec } from '../course/schemas.js';
import { scoreCourseQuality } from '../course/quality/courseQualityScorer.js';
import { ScoreCourseQualityTool } from './score-course-quality.js';

describe('ScoreCourseQualityTool', () => {
  it('高质量课程方案通过质量门禁', () => {
    const review = scoreCourseQuality({
      courseSpec: buildCourseSpec(),
      plan: buildStrongPlan(),
    });

    expect(review.passed).toBe(true);
    expect(review.score.total).toBeGreaterThanOrEqual(75);
    expect(review.score.blockingIssues).toEqual([]);
  });

  it('浅层换皮问答方案被质量门禁阻断', () => {
    const spec = buildCourseSpec({
      explanationDepth: {
        ...buildCourseSpec().explanationDepth,
        conceptLayers: [
          {
            concept: '面积公式',
            whyItMatters: '用于计算长方形面积。',
            misconceptionToAddress: [],
            representation: 'formula',
          },
        ],
        examplePlan: {
          workedExamples: 1,
          guidedPractice: 1,
          independentChallenges: 1,
          transferTasks: 0,
        },
        feedbackDepth: 'answer_only',
        masteryEvidence: ['能背出公式'],
      },
    });
    const shallowPlan = {
      ...buildStrongPlan(),
      gameplayType: '选择题答题',
      workflow: undefined,
      learningLoop: ['讲解', '选择题', '评价'],
      scenePlan: ['导入', '答题给分'],
      assessmentPoints: ['解释面积公式的来源'],
      score: {
        learningFit: 55,
        explanationDepthFit: 40,
        fun: 45,
        ageFit: 80,
        implementationStability: 55,
        cost: 90,
        safety: 90,
      },
    };

    const review = scoreCourseQuality({ courseSpec: spec, plan: shallowPlan });

    expect(review.passed).toBe(false);
    expect(review.score.blockingIssues.length).toBeGreaterThan(0);
  });

  it('工具执行返回质量评分标签', async () => {
    const tool = new ScoreCourseQualityTool();

    const result = await tool.buildAndExecute(
      {
        courseSpec: buildCourseSpec(),
        plan: buildStrongPlan(),
      },
      new AbortController().signal,
    );

    expect(result.error).toBeUndefined();
    expect(result.llmContent).toContain('<course-quality-score>');
    expect(result.returnDisplay).toContain('门禁结果');
  });
});

export function buildCourseSpec(
  overrides: Partial<CourseSpec> = {},
): CourseSpec {
  const base: CourseSpec = {
    subject: '数学',
    topic: '长方形面积',
    learningGoals: ['解释面积公式的来源', '用面积公式解决情境问题'],
    durationMinutes: 25,
    studentProfile: {
      grade: 4,
      readingLevel: 'medium',
      interests: ['太空基地', '工程'],
      weakPoints: ['公式死记'],
      preferredInteraction: ['模块装配', '推理'],
      guardianLimits: {
        maxSessionMinutes: 30,
        allowUploadedImages: false,
        allowGeneratedVideo: false,
        contentStrictness: 'strict',
      },
    },
    styleSpec: {
      theme: '月球基地建设',
      palette: ['#2563EB', '#F59E0B', '#10B981'],
      visualMood: '明亮、有探索感',
      characterStyle: '基地工程师',
      uiDensity: 'medium',
      forbidden: [],
    },
    explanationDepth: {
      depthLevel: 'deep',
      priorKnowledgeCheck: true,
      conceptLayers: [
        {
          concept: '面积单位覆盖',
          whyItMatters: '理解公式来自单位面积的行列排列。',
          misconceptionToAddress: ['只背长乘宽，不知道为什么'],
          representation: 'visual_model',
        },
        {
          concept: '公式迁移',
          whyItMatters: '帮助学生把公式用于真实情境。',
          misconceptionToAddress: ['把周长和面积混淆'],
          representation: 'case',
        },
      ],
      examplePlan: {
        workedExamples: 2,
        guidedPractice: 2,
        independentChallenges: 2,
        transferTasks: 1,
      },
      feedbackDepth: 'step_by_step',
      masteryEvidence: ['能解释面积公式来源', '能解决基地铺板问题'],
    },
  };
  return {
    ...base,
    ...overrides,
  };
}

export function buildStrongPlan(): CoursePlanOption {
  return {
    id: 'balanced',
    title: '月球基地面积工程',
    courseArchetype: 'course_grid',
    gameplayType: '模块装配',
    workflow: {
      startNodeId: 'node_1',
      nodes: [
        {
          id: 'node_1',
          playletId: 'playlet-模块装配',
          goalIds: ['解释面积公式的来源'],
          config: {
            prompt: '用单位面积模块铺满基地地板。',
            successCriteria: '解释行列数量与面积的关系。',
          },
          styleBindingId: 'default',
          enterTransition: '基地地板等待规划。',
          exitTransition: '面积公式来源让任务状态推进。',
        },
        {
          id: 'node_2',
          playletId: 'playlet-等式平衡',
          goalIds: ['用面积公式解决情境问题'],
          config: {
            prompt: '把长、宽和面积公式配平。',
            successCriteria: '完成情境题计算。',
          },
          styleBindingId: 'default',
          enterTransition: '进入公式控制台。',
          exitTransition: '正确反馈会解锁基地区域，错误反馈给出错因提示。',
        },
      ],
      edges: [
        { from: 'node_1', to: 'node_2', when: 'success' },
        { from: 'node_2', to: 'node_1', when: 'partial' },
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
      '基地导入目标',
      '模块铺设核心关卡',
      '公式控制台状态变化',
      '错误提示回流',
      '迁移挑战报告',
    ],
    assessmentPoints: ['解释面积公式的来源', '用面积公式解决情境问题'],
    assetComplexity: 'medium',
    score: {
      learningFit: 90,
      explanationDepthFit: 86,
      fun: 88,
      ageFit: 90,
      implementationStability: 84,
      cost: 78,
      safety: 94,
    },
    recommendationReason:
      '模块装配能让面积公式来源改变基地任务状态，并用错因反馈推动重试。',
    risks: ['需要控制模块数量，避免操作负担过高。'],
  };
}
