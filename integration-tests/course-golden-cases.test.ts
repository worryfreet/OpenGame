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
  summarizeGoldenCaseCoverage,
} from '../packages/core/src/course/quality/goldenCases.js';
import { scoreCourseQuality } from '../packages/core/src/course/quality/courseQualityScorer.js';
import type {
  CoursePlanOption,
  CourseSpec,
} from '../packages/core/src/course/schemas.js';
import { validateCourseSpec } from '../packages/core/src/course/validation.js';

describe('MVP 3.0 golden cases 集成回归', () => {
  it('golden cases 覆盖多学科和小学 1-6 年级', () => {
    const summary = summarizeGoldenCaseCoverage();

    expect(summary.total).toBeGreaterThanOrEqual(20);
    expect(Object.values(summary.bySubject).every((count) => count > 0)).toBe(
      true,
    );
    expect(Object.values(summary.byGrade).every((count) => count > 0)).toBe(
      true,
    );
  });

  it('所有 golden case 的期望 CourseSpec 和默认方案通过低成本质量回归', () => {
    for (const goldenCase of COURSE_GOLDEN_CASES) {
      const validation = validateCourseSpec(goldenCase.expectedSpec);
      expect(
        validation.errors,
        `${goldenCase.id} CourseSpec 不应有校验错误`,
      ).toEqual([]);
      expect(validation.valid).toBe(true);

      const review = scoreCourseQuality({
        courseSpec: buildQualitySpec(goldenCase.expectedSpec),
        plan: buildQualityPlan(goldenCase),
      });
      expect(
        {
          id: goldenCase.id,
          score: review.score.total,
          passed: review.passed,
        },
        `${goldenCase.id} 应通过质量门禁`,
      ).toMatchObject({ passed: true });
    }
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
