/**
 * @license
 * Copyright 2025 OpenGame Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import {
  COURSE_GOLDEN_CASES,
  buildGoldenCasePlanOption,
  type CourseGoldenCase,
} from '../packages/core/src/course/quality/goldenCases.js';
import { scoreCourseQuality } from '../packages/core/src/course/quality/courseQualityScorer.js';
import type {
  CoursePlanOption,
  CourseSpec,
} from '../packages/core/src/course/schemas.js';

describe('MVP 3.0 课程质量门禁集成', () => {
  it('golden case 默认方案通过质量门禁', () => {
    const goldenCase = COURSE_GOLDEN_CASES.find(
      (item) => item.id === 'science-g5-circuit-station',
    );
    expect(goldenCase).toBeDefined();

    const review = scoreCourseQuality({
      courseSpec: buildQualitySpec(goldenCase!.expectedSpec),
      plan: buildQualityPlan(goldenCase!),
    });

    expect(review.passed).toBe(true);
    expect(review.score.total).toBeGreaterThanOrEqual(
      goldenCase!.minimumExcitementScore,
    );
  });

  it('浅层换皮方案不能通过质量门禁', () => {
    const goldenCase = COURSE_GOLDEN_CASES.find(
      (item) => item.id === 'chinese-g6-argument-court',
    );
    expect(goldenCase).toBeDefined();
    const shallowPlan = {
      ...buildGoldenCasePlanOption(goldenCase!),
      workflow: undefined,
      gameplayType: '选择题答题',
      learningLoop: ['讲解', '选择题', '评价'],
      scenePlan: ['导入', '答题给分'],
      assessmentPoints: ['只覆盖一个目标'],
      score: {
        learningFit: 60,
        explanationDepthFit: 45,
        fun: 50,
        ageFit: 75,
        implementationStability: 55,
        cost: 90,
        safety: 90,
      },
      risks: ['浅层选择题，缺少状态变化。'],
    };

    const review = scoreCourseQuality({
      courseSpec: goldenCase!.expectedSpec,
      plan: shallowPlan,
    });

    expect(review.passed).toBe(false);
    expect(review.score.blockingIssues.length).toBeGreaterThan(0);
  });
});

function buildQualitySpec(courseSpec: CourseSpec): CourseSpec {
  return {
    ...courseSpec,
    styleSpec: {
      ...courseSpec.styleSpec,
      forbidden: [],
    },
  };
}

function buildQualityPlan(goldenCase: CourseGoldenCase): CoursePlanOption {
  const base = buildGoldenCasePlanOption(goldenCase);
  const [firstPlaylet = 'playlet-单选判断', secondPlaylet = firstPlaylet] =
    goldenCase.expectedPlanDirection.playletIds;
  const missionLabel = `${goldenCase.expectedSpec.styleSpec.theme}${goldenCase.expectedSpec.topic}`;
  return {
    ...base,
    workflow: {
      startNodeId: 'node_1',
      nodes: [
        {
          id: 'node_1',
          playletId: firstPlaylet,
          goalIds: ['goal_1'],
          config: {
            prompt: `拖拽并比较：修复${missionLabel}的第一处任务状态。`,
            successCriteria: '说明判断依据后推进任务状态。',
          },
          styleBindingId: 'default',
          exitTransition: `${goldenCase.expectedPlanDirection.stateChange}推进`,
        },
        {
          id: 'node_2',
          playletId: secondPlaylet,
          goalIds: ['goal_2'],
          config: {
            prompt: `排序并构建：完成${missionLabel}的迁移挑战。`,
            successCriteria: '正确解锁报告，错误进入提示重试。',
          },
          styleBindingId: 'default',
          enterTransition: '进入迁移挑战',
          exitTransition: '反馈后生成学习报告',
        },
      ],
      edges: [
        { from: 'node_1', to: 'node_2', when: 'success' },
      ],
      recoveryPolicy: 'remediate_then_return',
    },
    learningLoop: [
      '情境导入',
      '观察示例',
      '核心操作挑战',
      '状态变化反馈',
      '迁移复盘评价',
    ],
    scenePlan: [
      `${goldenCase.expectedSpec.styleSpec.theme}情境目标`,
      `拖拽比较 ${goldenCase.expectedSpec.topic} 核心挑战`,
      `${goldenCase.expectedPlanDirection.stateChange}状态推进`,
      `排序构建 ${goldenCase.expectedSpec.topic} 迁移挑战`,
      '错因提示回流',
      '迁移挑战与学习报告',
    ],
    recommendationReason:
      '学生需要拖拽、比较、排序并构建主题任务的判断过程，每次知识判断都会触发任务状态推进、错因提示或报告解锁。',
  };
}
