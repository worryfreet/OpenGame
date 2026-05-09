/**
 * @license
 * Copyright 2025 OpenGame Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import { ToolErrorType } from './tool-error.js';
import { ReviseCoursePlanTool } from './revise-course-plan.js';

describe('ReviseCoursePlanTool', () => {
  it('工具执行输出结构化课程修订结果', async () => {
    const tool = new ReviseCoursePlanTool();

    const result = await tool.buildAndExecute(
      {
        request: {
          basePlanId: 'balanced',
          changes: [{ type: 'change_theme', value: '海底实验室' }],
        },
        courseSpec: {
          subject: '数学',
          topic: '面积',
          learningGoals: ['理解面积含义'],
          durationMinutes: 15,
          studentProfile: {
            grade: 3,
            interests: ['海洋'],
          },
          styleSpec: {
            theme: '太空基地',
            palette: ['#2563EB'],
            visualMood: '明亮清晰',
            characterStyle: '学习助手',
            uiDensity: 'medium',
            forbidden: ['抽卡'],
          },
          explanationDepth: {
            depthLevel: 'intro',
            priorKnowledgeCheck: false,
            conceptLayers: [
              {
                concept: '面积',
                whyItMatters: '帮助理解覆盖大小。',
                misconceptionToAddress: ['把面积和周长混淆'],
                representation: 'visual_model',
              },
            ],
            examplePlan: {
              workedExamples: 1,
              guidedPractice: 1,
              independentChallenges: 1,
              transferTasks: 0,
            },
            feedbackDepth: 'short_reason',
            masteryEvidence: ['能解释面积含义'],
          },
        },
      },
      new AbortController().signal,
    );

    expect(result.error).toBeUndefined();
    expect(result.llmContent).toContain('<course-revision>');
    expect(result.llmContent).toContain('"status": "ready"');
    expect(result.returnDisplay).toContain('海底实验室');
  });

  it('阻断项会作为工具执行错误返回', async () => {
    const tool = new ReviseCoursePlanTool();

    const result = await tool.buildAndExecute(
      {
        request: {
          basePlanId: 'balanced',
          changes: [{ type: 'change_theme', value: '   ' }],
        },
        selectedPlan: {
          id: 'balanced',
          title: '面积任务',
          courseArchetype: 'course_grid',
          gameplayType: '网格建造',
          learningLoop: ['讲解', '互动', '反馈'],
          scenePlan: ['导入', '任务'],
          assessmentPoints: ['理解面积含义'],
          assetComplexity: 'low',
          score: {
            learningFit: 80,
            explanationDepthFit: 80,
            fun: 80,
            ageFit: 80,
            implementationStability: 80,
            cost: 80,
            safety: 90,
          },
          recommendationReason: '适合面积学习。',
          risks: [],
        },
      },
      new AbortController().signal,
    );

    expect(result.error?.type).toBe(ToolErrorType.EXECUTION_FAILED);
    expect(result.error?.message).toContain('主题不能为空');
    expect(result.returnDisplay).toContain('需要处理阻断项');
  });

  it('缺少 request 时由 schema 校验拦截', async () => {
    const tool = new ReviseCoursePlanTool();

    const result = await tool.validateBuildAndExecute(
      {} as never,
      new AbortController().signal,
    );

    expect(result.error?.type).toBe(ToolErrorType.INVALID_TOOL_PARAMS);
    expect(result.error?.message).toContain('request');
  });
});
