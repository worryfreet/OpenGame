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
    expect(prompt).toContain('不能只输出文字方案、静态页面');
    expect(prompt).toContain(
      '不得绕过 Course GDD mapper 手写 React/Vite 静态题目页',
    );
    expect(prompt).toContain('调用 `generate_game_assets` 生成或登记关键图片');
    expect(prompt).toContain('优先规划 1 个可选开场或章节过场视频');
    expect(prompt).toContain('讲解旁白必须调用 `course_tts_manifest`');
    expect(prompt).toContain('本次生成时间线');
    expect(prompt).toContain('链路走向和参考资料');
    expect(prompt).toContain('必须先提炼用户核心诉求');
    expect(prompt).toContain('明显模板换皮');
    expect(prompt).toContain('AI 必须在受控边界内发挥创造力');
  });

  it('要求所有偏好都做核心诉求保真而不是只处理枪战', () => {
    const prompt = buildCourseStudioPrompt({
      goal: '五年级语文阅读理解，侦探推理风格',
    });

    expect(prompt).toContain('用户偏好必须语义保真');
    expect(prompt).toContain('喜欢侦探就保留搜证/推理/排除嫌疑');
    expect(prompt).toContain('禁止生成一眼能看出是同一套模板替换题干的课程');
  });

  it('对动作类偏好要求适龄改写但保留核心动作', () => {
    const prompt = buildCourseStudioPrompt({
      goal: '四年级数学, 一元二次方程, 枪战',
    });

    expect(prompt).toContain('喜欢动作就保留瞄准/移动/节奏/命中');
    expect(prompt).toContain('真实枪械改成水枪、泡沫飞镖或能量靶');
    expect(prompt).toContain('不得退化成抽象泡泡或普通答题');
    expect(prompt).toContain('至少包含 3 个 playlet 节点');
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
