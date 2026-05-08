/**
 * @license
 * Copyright 2025 OpenGame Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Config } from '../config/config.js';
import type { CoursePlanOption, CourseSpec } from '../course/schemas.js';
import { GenerateCoursePlanTool } from './generate-course-plan.js';

describe('GenerateCoursePlanTool', () => {
  const config = {
    getOpenGameProviders: () => ({}),
  } as Config;
  const modelConfig = {
    apiKey: 'test-key',
    baseUrl: 'https://example.test/v1',
    modelName: 'course-planner',
  };

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('解析模型 JSON 并返回等待用户确认的提醒', async () => {
    mockModelResponse({ options: buildOptions() });
    const tool = new GenerateCoursePlanTool(config, modelConfig);

    const result = await tool.buildAndExecute(
      { courseSpec: buildCourseSpec() },
      new AbortController().signal,
    );

    expect(result.error).toBeUndefined();
    expect(result.llmContent).toContain('generate_course_gdd');
    expect(result.llmContent).toContain('selectedPlanId');
    expect(result.returnDisplay).toContain('stable');
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('使用 safeJsonParse 修复轻微畸形 JSON', async () => {
    const malformedJson = JSON.stringify({ options: buildOptions() }).replace(
      /"stable"/,
      "'stable'",
    );
    mockRawModelResponse(malformedJson);
    const tool = new GenerateCoursePlanTool(config, modelConfig);

    const result = await tool.buildAndExecute(
      { courseSpec: buildCourseSpec() },
      new AbortController().signal,
    );

    expect(result.error).toBeUndefined();
    expect(result.llmContent).toContain('"balanced"');
  });

  it('拒绝无法解析为课程方案数组的模型输出', async () => {
    mockRawModelResponse('not json at all');
    const tool = new GenerateCoursePlanTool(config, modelConfig);

    const result = await tool.buildAndExecute(
      { courseSpec: buildCourseSpec() },
      new AbortController().signal,
    );

    expect(result.error?.message).toContain('课程方案 JSON 不符合 schema');
  });

  it('拒绝 deep 深度下 explanationDepthFit 过低的浅层方案', async () => {
    const shallowOptions = buildOptions().map((option) => ({
      ...option,
      score: {
        ...option.score,
        explanationDepthFit: 45,
      },
    }));
    mockModelResponse({ options: shallowOptions });
    const tool = new GenerateCoursePlanTool(config, modelConfig);

    const result = await tool.buildAndExecute(
      { courseSpec: buildCourseSpec({ depthLevel: 'deep' }) },
      new AbortController().signal,
    );

    expect(result.error?.message).toContain('explanationDepthFit 低于 70');
  });

  it('在调用模型前拒绝不合格 CourseSpec', async () => {
    const tool = new GenerateCoursePlanTool(config, modelConfig);
    const invalidSpec = buildCourseSpec();
    invalidSpec.learningGoals = [];

    const result = await tool.validateBuildAndExecute(
      { courseSpec: invalidSpec },
      new AbortController().signal,
    );

    expect(result.error?.message).toContain('learningGoals');
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

function mockModelResponse(payload: unknown): void {
  mockRawModelResponse(JSON.stringify(payload));
}

function mockRawModelResponse(content: string): void {
  vi.mocked(global.fetch).mockResolvedValue({
    ok: true,
    json: async () => ({
      choices: [{ message: { content } }],
    }),
  } as Response);
}

function buildCourseSpec(
  overrides: { depthLevel?: CourseSpec['explanationDepth']['depthLevel'] } = {},
): CourseSpec {
  return {
    subject: '科学',
    topic: '生态系统',
    learningGoals: ['解释食物链', '识别生态系统中的角色'],
    durationMinutes: 25,
    studentProfile: {
      grade: 5,
      age: 11,
      readingLevel: 'medium',
      interests: ['探险', '收集'],
      weakPoints: ['概念混淆'],
      preferredInteraction: ['分类', '选择'],
      guardianLimits: {
        maxSessionMinutes: 30,
        allowUploadedImages: true,
        allowGeneratedVideo: false,
        contentStrictness: 'strict',
      },
    },
    styleSpec: {
      theme: '森林调查',
      palette: ['#14532D', '#FDE68A', '#38BDF8'],
      visualMood: '自然明亮',
      characterStyle: '调查员',
      uiDensity: 'medium',
      forbidden: ['惊吓', '抽卡'],
    },
    explanationDepth: {
      depthLevel: overrides.depthLevel ?? 'deep',
      priorKnowledgeCheck: true,
      conceptLayers: [
        {
          concept: '生产者',
          whyItMatters: '帮助理解能量来源。',
          misconceptionToAddress: ['把所有植物和动物作用混为一谈'],
          representation: 'case',
        },
        {
          concept: '消费者',
          whyItMatters: '帮助理解食物链关系。',
          misconceptionToAddress: ['只按体型判断捕食关系'],
          representation: 'visual_model',
        },
      ],
      examplePlan: {
        workedExamples: 2,
        guidedPractice: 2,
        independentChallenges: 2,
        transferTasks: 1,
      },
      feedbackDepth: 'step_by_step',
      masteryEvidence: ['能画出食物链', '能解释角色关系'],
    },
  };
}

function buildOptions(): CoursePlanOption[] {
  const score = {
    learningFit: 90,
    explanationDepthFit: 82,
    fun: 80,
    ageFit: 88,
    implementationStability: 86,
    cost: 80,
    safety: 94,
  };

  return [
    {
      id: 'stable',
      title: '森林讲解任务',
      courseArchetype: 'course_ui',
      gameplayType: '剧情选择',
      learningLoop: ['讲解', '示例', '互动练习', '反馈', '评价'],
      scenePlan: ['导入', '角色辨认', '复盘'],
      assessmentPoints: ['解释食物链', '识别生态系统中的角色'],
      assetComplexity: 'low',
      score,
      recommendationReason: '对话和选择稳定承载讲解。',
      risks: ['互动形式较保守，但实现稳定。'],
    },
    {
      id: 'balanced',
      title: '生态网格调查',
      courseArchetype: 'course_grid',
      gameplayType: '分类观察',
      learningLoop: ['讲解', '示例', '互动练习', '反馈', '评价'],
      scenePlan: ['导入', '网格分类', '迁移挑战'],
      assessmentPoints: ['解释食物链', '识别生态系统中的角色'],
      assetComplexity: 'medium',
      score,
      recommendationReason: '网格分类适合角色关系推理。',
      risks: ['需要控制格子任务数量，避免认知负担。'],
    },
    {
      id: 'creative',
      title: '食物链守护挑战',
      courseArchetype: 'course_grid',
      gameplayType: '流程推演',
      learningLoop: ['讲解', '示例', '互动练习', '反馈', '评价'],
      scenePlan: ['导入', '路径推演', '复盘报告'],
      assessmentPoints: ['解释食物链', '识别生态系统中的角色'],
      assetComplexity: 'medium',
      score,
      recommendationReason: '流程推演能体现迁移任务。',
      risks: ['创意玩法需要限制分支数量。'],
    },
  ];
}
