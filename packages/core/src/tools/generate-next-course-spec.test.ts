/**
 * @license
 * Copyright 2025 OpenGame Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import type { CourseSpec } from '../course/schemas.js';
import { ToolErrorType } from './tool-error.js';
import { GenerateNextCourseSpecTool } from './generate-next-course-spec.js';

describe('GenerateNextCourseSpecTool', () => {
  it('工具执行输出结构化下一课 CourseSpec', async () => {
    const tool = new GenerateNextCourseSpecTool();

    const result = await tool.buildAndExecute(
      {
        profileId: 'profile_1',
        previousCourseSpec: buildCourseSpec(),
        previousGameplayType: '网格建造',
        learningReport: {
          profileId: 'profile_1',
          subject: '数学',
          weakPoints: ['单位混淆'],
          masteredGoals: ['理解面积含义'],
          misconceptionTags: ['area_unit_confusion'],
        },
      },
      new AbortController().signal,
    );

    expect(result.error).toBeUndefined();
    expect(result.llmContent).toContain('<next-course-spec>');
    expect(result.llmContent).toContain('"topic": "面积单位换算"');
    expect(result.returnDisplay).toContain('可生成下一课');
  });

  it('学习状态不足时返回追问和工具错误', async () => {
    const tool = new GenerateNextCourseSpecTool();

    const result = await tool.buildAndExecute(
      {
        profileId: 'profile_1',
        subject: '数学',
        learningState: {
          profileId: 'profile_1',
          subjectStates: [],
        },
        preferenceProfile: {
          profileId: 'profile_1',
          grade: 3,
          interests: ['太空'],
          preferredThemes: [],
          preferredGameplayTypes: [],
          readingLevel: 'medium',
        },
      },
      new AbortController().signal,
    );

    expect(result.error?.type).toBe(ToolErrorType.EXECUTION_FAILED);
    expect(result.llmContent).toContain('"status": "needs_intake"');
    expect(result.returnDisplay).toContain('需要补充信息');
  });

  it('参数缺 profileId 时由 schema 校验拦截', async () => {
    const tool = new GenerateNextCourseSpecTool();

    const result = await tool.validateBuildAndExecute(
      {
        profileId: '',
      },
      new AbortController().signal,
    );

    expect(result.error?.type).toBe(ToolErrorType.INVALID_TOOL_PARAMS);
    expect(result.error?.message).toContain('profileId');
  });
});

function buildCourseSpec(): CourseSpec {
  return {
    subject: '数学',
    topic: '面积和周长',
    learningGoals: ['理解面积含义', '区分面积和周长'],
    durationMinutes: 20,
    studentProfile: {
      grade: 3,
      readingLevel: 'medium',
      interests: ['太空'],
      preferredInteraction: ['网格建造'],
    },
    styleSpec: {
      theme: '太空基地',
      palette: ['#0F172A', '#F59E0B'],
      visualMood: '明亮清晰',
      characterStyle: '星际小助手',
      uiDensity: 'medium',
      forbidden: ['抽卡'],
    },
    explanationDepth: {
      depthLevel: 'standard',
      priorKnowledgeCheck: true,
      conceptLayers: [
        {
          concept: '面积',
          whyItMatters: '帮助学生理解图形覆盖大小。',
          misconceptionToAddress: ['把面积和周长混淆'],
          representation: 'visual_model',
        },
      ],
      examplePlan: {
        workedExamples: 2,
        guidedPractice: 2,
        independentChallenges: 1,
        transferTasks: 1,
      },
      feedbackDepth: 'step_by_step',
      masteryEvidence: ['能解释面积含义'],
    },
  };
}
