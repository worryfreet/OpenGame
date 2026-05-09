/**
 * @license
 * Copyright 2025 OpenGame Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import {
  analyzeCourseStudioGoal,
  buildCourseStudioPrompt,
} from './runCourseStudio.js';

describe('buildCourseStudioPrompt', () => {
  it('builds a native OpenGame course generation prompt from the learning goal', () => {
    const prompt = buildCourseStudioPrompt({
      goal: ' 四年级数学太空面积课 ',
    });

    expect(prompt).toContain('四年级数学太空面积课');
    expect(prompt).toContain(
      'OpenGame 原生生成链路、工具调用、配置、认证、沙箱与文件生成能力',
    );
    expect(prompt).toContain('最终产出一门可以运行和验收的游戏化课程');
    expect(prompt).toContain(
      '自动选择质量最高且实现稳定的推荐方案继续生成完整课程',
    );
    expect(prompt).toContain('不能只输出文字方案或静态页面');
  });

  it('asks for the learning goal when no goal is provided', () => {
    const prompt = buildCourseStudioPrompt();

    expect(prompt).toContain('请先询问学生的目标学习需求。');
    expect(prompt).toContain(
      'CLI 已尽量收集年级、学科、主题、学习目标和讲解深度',
    );
  });
});

describe('analyzeCourseStudioGoal', () => {
  it('keeps asking locally when the course goal is still incomplete', () => {
    const analysis = analyzeCourseStudioGoal('我想学习一元二次函数');

    expect(analysis.courseSpec).toBeUndefined();
    expect(analysis.requiredClarifications.map((item) => item.field)).toContain(
      'grade',
    );
  });

  it('accepts a completed quadratic function course goal before model execution', () => {
    const analysis = analyzeCourseStudioGoal(
      '初三数学，学习一元二次函数图像、顶点、开口方向和对称轴，标准难度，20分钟，做成函数图像闯关',
    );

    expect(analysis.blockedReasons).toEqual([]);
    expect(analysis.requiredClarifications).toEqual([]);
    expect(analysis.courseSpec?.studentProfile.grade).toBe(9);
    expect(analysis.courseSpec?.subject).toBe('数学');
    expect(analysis.courseSpec?.topic).toBe('一元二次函数');
    expect(analysis.courseSpec?.learningGoals).toContain(
      '理解二次函数图像特征',
    );
  });
});
