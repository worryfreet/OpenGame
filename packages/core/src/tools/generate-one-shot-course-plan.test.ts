/**
 * @license
 * Copyright 2025 OpenGame Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import {
  GenerateOneShotCoursePlanTool,
  generateOneShotCoursePlan,
} from './generate-one-shot-course-plan.js';

describe('GenerateOneShotCoursePlanTool', () => {
  it('完整一句话输入返回可进入 generate_course_plan 的 CourseSpec', () => {
    const result = generateOneShotCoursePlan({
      text: '四年级数学，太空基地主题，让孩子理解长方形面积公式不是死背。',
    });

    expect(result.nextTool).toBe('generate_course_plan');
    expect(result.promptResult.courseSpec?.studentProfile.grade).toBe(4);
    expect(result.promptResult.courseSpec?.subject).toBe('数学');
    expect(result.promptResult.courseSpec?.topic).toContain('面积');
  });

  it('缺少年级时只返回关键追问，不进入方案生成', () => {
    const result = generateOneShotCoursePlan({
      text: '我想学面积，做成太空基地风格。',
    });

    expect(result.nextTool).toBe('clarify_with_user');
    expect(result.promptResult.courseSpec).toBeUndefined();
    expect(result.promptResult.requiredClarifications).toContainEqual(
      expect.objectContaining({
        field: 'grade',
        required: true,
      }),
    );
  });

  it('初中函数类课程可直接进入课程方案生成', () => {
    const result = generateOneShotCoursePlan({
      text: '初三数学，学习一元二次函数图像、顶点、开口方向和对称轴，标准难度，20分钟，做成函数图像闯关',
    });

    expect(result.nextTool).toBe('generate_course_plan');
    expect(result.promptResult.courseSpec?.studentProfile.grade).toBe(9);
    expect(result.promptResult.courseSpec?.subject).toBe('数学');
    expect(result.promptResult.courseSpec?.topic).toBe('一元二次函数');
  });

  it('工具执行输出 one-shot 标签和建议下一步', async () => {
    const tool = new GenerateOneShotCoursePlanTool();

    const result = await tool.buildAndExecute(
      {
        text: '四年级数学，太空基地主题，让孩子理解长方形面积公式不是死背。',
      },
      new AbortController().signal,
    );

    expect(result.error).toBeUndefined();
    expect(result.llmContent).toContain('<one-shot-course-plan>');
    expect(result.llmContent).toContain('generate_course_plan');
    expect(result.returnDisplay).toContain('CourseSpec');
  });
});
