/**
 * @license
 * Copyright 2025 OpenGame Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import { ToolErrorType } from './tool-error.js';
import {
  completeCourseIntake,
  CompleteCourseIntakeTool,
} from './complete-course-intake.js';
import { buildDefaultGuardianPolicy } from '../course/product/guardianPolicy.js';

describe('CompleteCourseIntakeTool', () => {
  it('返回 ready IntakeSession 和可用于 generate_course_plan 的 CourseSpec', () => {
    const result = completeCourseIntake({
      sessionId: 'session_area_space',
      rawInput: '三年级面积太空风格',
    });

    expect(result.intakeSession.status).toBe('ready_for_plan');
    expect(result.courseSpec?.subject).toBe('数学');
    expect(result.courseSpec?.topic).toBe('面积');
    expect(result.courseSpec?.studentProfile.grade).toBe(3);
  });

  it('缺少年级时只返回追问，不输出 CourseSpec', () => {
    const result = completeCourseIntake({
      sessionId: 'session_missing_grade',
      rawInput: '我想学面积，做成太空风格',
    });

    expect(result.intakeSession.status).toBe('collecting');
    expect(result.courseSpec).toBeUndefined();
    expect(result.intakeSession.followUpQuestions).toContainEqual({
      id: 'ask_grade',
      field: 'grade',
      prompt: '这节课面向小学几年级学生？',
      required: true,
    });
  });

  it('工具执行输出结构化 intake session', async () => {
    const tool = new CompleteCourseIntakeTool();

    const result = await tool.buildAndExecute(
      {
        sessionId: 'session_tool',
        rawInput: '三年级面积太空风格',
        guardianPolicy: {
          ...buildDefaultGuardianPolicy('profile_1'),
          allowUploadedImages: false,
        },
      },
      new AbortController().signal,
    );

    expect(result.error).toBeUndefined();
    expect(result.llmContent).toContain('<course-intake-session>');
    expect(result.llmContent).toContain('"courseSpec"');
    expect(result.returnDisplay).toContain('ready_for_plan');
  });

  it('参数缺 sessionId 时由 schema 校验拦截', async () => {
    const tool = new CompleteCourseIntakeTool();

    const result = await tool.validateBuildAndExecute(
      {
        sessionId: '',
        rawInput: '三年级面积太空风格',
      },
      new AbortController().signal,
    );

    expect(result.error?.type).toBe(ToolErrorType.INVALID_TOOL_PARAMS);
    expect(result.error?.message).toContain('sessionId');
  });
});
