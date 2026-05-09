/**
 * @license
 * Copyright 2025 OpenGame Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import { COURSE_GOLDEN_CASES } from '../packages/core/src/course/quality/goldenCases.js';
import { generateOneShotCoursePlan } from '../packages/core/src/tools/generate-one-shot-course-plan.js';

describe('MVP 3.0 一句话课程生成集成', () => {
  it('golden case 一句话输入能低成本落到 CourseSpec，不触发真实模型', () => {
    const goldenCase = COURSE_GOLDEN_CASES.find(
      (item) => item.id === 'math-g4-area-planet',
    );
    expect(goldenCase).toBeDefined();

    const result = generateOneShotCoursePlan({
      text: goldenCase!.oneShotInput,
    });

    expect(result.nextTool).toBe('generate_course_plan');
    expect(result.promptResult.courseSpec?.subject).toBe('数学');
    expect(result.promptResult.courseSpec?.topic).toContain('面积');
  });

  it('关键字段不足时停在追问，不进入真实生成链路', () => {
    const result = generateOneShotCoursePlan({
      text: '想做一个太空基地风格的面积游戏。',
    });

    expect(result.nextTool).toBe('clarify_with_user');
    expect(result.promptResult.courseSpec).toBeUndefined();
    expect(result.promptResult.requiredClarifications.length).toBeGreaterThan(
      0,
    );
  });
});
