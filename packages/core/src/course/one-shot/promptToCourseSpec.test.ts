/**
 * @license
 * Copyright 2025 OpenGame Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import { validateCourseSpec } from '../validation.js';
import { promptToCourseSpec } from './promptToCourseSpec.js';

describe('promptToCourseSpec', () => {
  it('缺少年级时返回关键追问，不生成 CourseSpec', () => {
    const result = promptToCourseSpec({
      text: '给我做个太空风格的面积游戏课',
    });

    expect(result.courseSpec).toBeUndefined();
    expect(result.requiredClarifications).toContainEqual({
      id: 'one_shot_ask_grade',
      field: 'grade',
      prompt: '这节课面向几年级学生？',
      required: true,
    });
    expect(result.blockedReasons).toEqual([]);
    expect(result.inferredFields).toContain('subject');
  });

  it('完整一句话输入会生成可校验的 CourseSpec', () => {
    const result = promptToCourseSpec({
      text: '四年级英语单词闯关，像魔法学院但不要太幼稚',
    });

    expect(result.requiredClarifications).toEqual([]);
    expect(result.blockedReasons).toEqual([]);
    expect(result.courseSpec).toBeDefined();
    expect(result.courseSpec?.studentProfile.grade).toBe(4);
    expect(result.courseSpec?.subject).toBe('英语');
    expect(result.courseSpec?.topic).toBe('单词');
    expect(result.courseSpec?.studentProfile.preferredInteraction).toContain(
      '关卡闯关',
    );
    expect(result.courseSpec?.styleSpec.theme).toContain('魔法学院');
    expect(result.courseSpec?.styleSpec.theme).not.toContain('哈利波特');

    const validation = validateCourseSpec(result.courseSpec);
    expect(validation.valid).toBe(true);
  });

  it('支持初中函数类数学课程输入', () => {
    const result = promptToCourseSpec({
      text: '初三数学，学习一元二次函数图像、顶点、开口方向和对称轴，标准难度，20分钟，做成函数图像闯关',
    });

    expect(result.requiredClarifications).toEqual([]);
    expect(result.blockedReasons).toEqual([]);
    expect(result.courseSpec).toBeDefined();
    expect(result.courseSpec?.studentProfile.grade).toBe(9);
    expect(result.courseSpec?.subject).toBe('数学');
    expect(result.courseSpec?.topic).toBe('一元二次函数');
    expect(result.courseSpec?.learningGoals).toContain('理解二次函数图像特征');
    expect(validateCourseSpec(result.courseSpec).valid).toBe(true);
  });

  it('将枪战偏好改写为适龄水枪动作玩法并保留核心操作', () => {
    const result = promptToCourseSpec({
      text: '四年级数学, 一元二次方程, 枪战',
    });

    expect(result.requiredClarifications).toEqual([]);
    expect(result.blockedReasons).toEqual([]);
    expect(result.courseSpec).toBeDefined();
    expect(result.courseSpec?.styleSpec.theme).toContain('水枪靶场');
    expect(result.courseSpec?.studentProfile.interests).toContain('水枪靶场');
    expect(result.courseSpec?.studentProfile.preferredInteraction).toContain(
      '安全瞄准命中',
    );
    expect(result.courseSpec?.studentProfile.preferredInteraction).toContain(
      '移动目标点击',
    );
    expect(result.courseSpec?.styleSpec.forbidden).toEqual(
      expect.arrayContaining(['真实枪械', '子弹', '伤害表现']),
    );
    expect(JSON.stringify(result.courseSpec)).not.toContain('枪战');
    expect(result.assumptions).toContain(
      '已将枪战等动作偏好改写为水枪/靶场等适龄非伤害表达，并保留瞄准、命中、移动目标等核心操作。',
    );
    expect(validateCourseSpec(result.courseSpec).valid).toBe(true);
  });

  it('知名 IP 会被清洗为原创氛围并记录假设', () => {
    const result = promptToCourseSpec({
      text: '三年级英语单词闯关，像哈利波特一样',
    });

    expect(result.blockedReasons).toEqual([]);
    expect(result.courseSpec?.styleSpec.theme).toContain('原创魔法学院冒险');
    expect(result.courseSpec?.styleSpec.theme).not.toContain('哈利波特');
    expect(result.courseSpec?.styleSpec.forbidden).toContain('哈利波特 仿作');
    expect(result.assumptions).toContain(
      '已将知名 IP 表达改写为原创、安全的相近氛围。',
    );
    expect(validateCourseSpec(result.courseSpec).valid).toBe(true);
  });

  it('不适龄元素会阻断生成', () => {
    const result = promptToCourseSpec({
      text: '三年级数学面积，做成血腥恐怖闯关',
    });

    expect(result.courseSpec).toBeUndefined();
    expect(result.blockedReasons).toEqual([
      '输入包含不适龄元素“血腥”，已阻断生成。',
      '输入包含不适龄元素“恐怖”，已阻断生成。',
    ]);
  });

  it('返回结果不保存隐私原文', () => {
    const result = promptToCourseSpec({
      text: '四年级英语单词，孩子姓名张三，电话13800138000，邮箱kid@example.com',
    });
    const serialized = JSON.stringify(result);

    expect(result.courseSpec).toBeDefined();
    expect(serialized).not.toContain('张三');
    expect(serialized).not.toContain('13800138000');
    expect(serialized).not.toContain('kid@example.com');
    expect(serialized).not.toContain('孩子姓名张三');
    expect(result.assumptions).toContain(
      '已移除可能包含学生身份或联系方式的原文片段。',
    );
  });
});
