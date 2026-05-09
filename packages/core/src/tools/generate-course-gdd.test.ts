/**
 * @license
 * Copyright 2025 OpenGame Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Config } from '../config/config.js';
import type {
  CourseGDD,
  CoursePlanOption,
  CourseSpec,
} from '../course/schemas.js';
import { GenerateCourseGDDTool } from './generate-course-gdd.js';

describe('GenerateCourseGDDTool', () => {
  const config = {
    getOpenGameProviders: () => ({}),
    getProjectRoot: () => process.cwd(),
  } as Config;
  const modelConfig = {
    apiKey: 'test-key',
    baseUrl: 'https://example.test/v1',
    modelName: 'course-gdd-generator',
  };

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('拒绝未经过用户确认的方案', async () => {
    const tool = new GenerateCourseGDDTool(config, modelConfig);
    const params = buildParams({ userConfirmed: false });

    const result = await tool.validateBuildAndExecute(
      params,
      new AbortController().signal,
    );

    expect(result.error?.message).toContain('必须先让用户确认 selectedPlanId');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('拒绝未通过质量门禁的已确认方案', async () => {
    const tool = new GenerateCourseGDDTool(config, modelConfig);
    const params = buildParams({
      selectedPlan: {
        ...buildSelectedPlan(),
        id: 'weak',
        title: '生态知识选择题',
        learningLoop: ['讲解', '答题', '答对加分'],
        scenePlan: ['题目场景'],
        workflow: undefined,
        score: {
          learningFit: 45,
          explanationDepthFit: 35,
          fun: 30,
          ageFit: 80,
          implementationStability: 82,
          cost: 90,
          safety: 90,
        },
        recommendationReason: '用选择题检查记忆。',
      },
    });

    const result = await tool.validateBuildAndExecute(
      params,
      new AbortController().signal,
    );

    expect(result.error?.message).toContain('未通过课程质量门禁');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('解析模型 JSON 并返回课程模板映射提醒', async () => {
    const params = buildParams();
    mockModelResponse({ courseGdd: buildCourseGdd(params) });
    const tool = new GenerateCourseGDDTool(config, modelConfig);

    const result = await tool.buildAndExecute(
      params,
      new AbortController().signal,
    );

    expect(result.error).toBeUndefined();
    expect(result.llmContent).toContain('<course-gdd>');
    expect(result.llmContent).toContain('<course-scaffold>');
    expect(result.llmContent).toContain('src/courseContent.json');
    expect(result.llmContent).toContain('course_ui/course_grid/course_td');
    expect(result.returnDisplay).toContain('course_grid');
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('拒绝 deep 深度下缺少迁移或复盘的 Course GDD', async () => {
    const params = buildParams();
    const invalidGdd = buildCourseGdd(params);
    invalidGdd.lessonUnits = invalidGdd.lessonUnits.map((unit) => ({
      ...unit,
      interactionTask: '完成分类练习并查看反馈。',
    }));
    invalidGdd.validationPlan.requiredChecks = [
      'schema 合法',
      '学习目标闭环',
      '讲解深度',
      '互动反馈',
      '评价解析',
    ];
    invalidGdd.assessmentSpec.masteryCriteria = ['能解释食物链'];
    mockModelResponse({ courseGdd: invalidGdd });
    const tool = new GenerateCourseGDDTool(config, modelConfig);

    const result = await tool.buildAndExecute(
      params,
      new AbortController().signal,
    );

    expect(result.error?.message).toContain('迁移任务或反思复盘');
  });

  it('拒绝模型改写已确认的 CourseSpec', async () => {
    const params = buildParams();
    const mutatedGdd = buildCourseGdd(params);
    mutatedGdd.courseSpec.topic = '被改写的主题';
    mockModelResponse({ courseGdd: mutatedGdd });
    const tool = new GenerateCourseGDDTool(config, modelConfig);

    const result = await tool.buildAndExecute(
      params,
      new AbortController().signal,
    );

    expect(result.error?.message).toContain('courseSpec 被改写');
  });
});

function mockModelResponse(payload: unknown): void {
  vi.mocked(global.fetch).mockResolvedValue({
    ok: true,
    json: async () => ({
      choices: [{ message: { content: JSON.stringify(payload) } }],
    }),
  } as Response);
}

function buildParams(
  overrides: Partial<{
    courseSpec: CourseSpec;
    selectedPlan: CoursePlanOption;
    selectedPlanId: string;
    userConfirmed: boolean;
  }> = {},
) {
  const courseSpec = overrides.courseSpec ?? buildCourseSpec();
  const selectedPlan = overrides.selectedPlan ?? buildSelectedPlan();
  return {
    courseSpec,
    selectedPlan,
    selectedPlanId: overrides.selectedPlanId ?? selectedPlan.id,
    userConfirmed: overrides.userConfirmed ?? true,
    confirmationNote: '家长确认使用平衡型方案。',
  };
}

function buildCourseSpec(): CourseSpec {
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
      depthLevel: 'deep',
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

function buildSelectedPlan(): CoursePlanOption {
  return {
    id: 'balanced',
    title: '生态网格调查',
    courseArchetype: 'course_grid',
    gameplayType: '分类观察',
    workflow: {
      startNodeId: 'evidence',
      nodes: [
        {
          id: 'evidence',
          playletId: 'playlet-证据配对',
          goalIds: ['goal_1', 'goal_2'],
          config: {
            prompt: '先搜集森林调查证据，把动物取食线索和角色卡配对。',
            successCriteria: '证据配对正确后解锁生态网格。',
          },
          styleBindingId: 'forest',
        },
        {
          id: 'classify',
          playletId: 'playlet-拖拽分箱',
          goalIds: ['goal_1'],
          config: {
            prompt: '调查森林角色，把生产者和消费者拖入不同生态格。',
            successCriteria: '分类正确后点亮生态能量流。',
          },
          styleBindingId: 'forest',
        },
        {
          id: 'chain',
          playletId: 'playlet-步骤排序',
          goalIds: ['goal_2'],
          config: {
            prompt: '按能量流动顺序修复食物链路径。',
            successCriteria: '路径连通并解释每个角色关系。',
          },
          styleBindingId: 'forest',
        },
      ],
      edges: [
        { from: 'evidence', to: 'classify', when: 'success' },
        { from: 'classify', to: 'chain', when: 'success' },
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
      '森林调查员搜证导入',
      '证据配对解锁生态网格',
      '网格分类点亮生态状态',
      '迁移挑战与复盘',
    ],
    assessmentPoints: ['解释食物链', '识别生态系统中的角色'],
    assetComplexity: 'medium',
    score: {
      learningFit: 90,
      explanationDepthFit: 84,
      fun: 82,
      ageFit: 88,
      implementationStability: 85,
      cost: 80,
      safety: 94,
    },
    recommendationReason:
      '学生先以森林调查员身份搜证，再用证据完成网格分类；生态能量流状态会随操作点亮，反馈会引导学生修复关系。',
    risks: ['需要控制网格数量，避免认知负担。'],
  };
}

function buildCourseGdd(params = buildParams()): CourseGDD {
  return {
    courseSpec: clone(params.courseSpec),
    selectedPlan: clone(params.selectedPlan),
    lessonUnits: [
      {
        id: 'lesson_food_chain',
        learningGoal: '解释食物链',
        concept: '食物链',
        explanationScript:
          '食物链表示能量从生产者开始，沿着吃与被吃的关系传递。先找到能自己制造养分的植物，再观察动物之间的取食关系，就能判断箭头方向。',
        interactionTask: '把森林角色拖到正确顺序，并完成一次迁移应用复盘。',
        feedbackStrategy:
          '正确时强调能量流向；错误时标记捕食关系混淆，并提示先找生产者。',
        assessmentPointId: 'assessment_food_chain',
      },
      {
        id: 'lesson_roles',
        learningGoal: '识别生态系统中的角色',
        concept: '生产者和消费者',
        explanationScript:
          '生态系统中的角色可以按获取能量的方式区分。植物通常是生产者，动物多为消费者，判断时不能只看体型大小。',
        interactionTask: '分类森林角色，并说明一个新场景中的迁移判断理由。',
        feedbackStrategy:
          '正确时连接判断依据；错误时标记按体型判断的错因，并给出下一步观察提示。',
        assessmentPointId: 'assessment_roles',
      },
    ],
    interactionSpecs: [
      {
        id: 'interaction_food_chain',
        lessonUnitId: 'lesson_food_chain',
        type: 'grid_sort',
        prompt: '把草、兔子、狐狸放入正确的食物链顺序。',
        expectedAction: '按能量流向完成排序。',
        feedback: {
          correct: '顺序正确，能量从生产者流向消费者。',
          incorrect: '顺序还不对，先找能自己制造养分的角色。',
          misconceptionTag: 'energy_flow_reversed',
          hint: '先找植物，再看谁吃谁。',
        },
      },
      {
        id: 'interaction_roles',
        lessonUnitId: 'lesson_roles',
        type: 'card_match',
        prompt: '把角色卡片分到生产者或消费者。',
        expectedAction: '按获取能量方式分类。',
        feedback: {
          correct: '分类正确，你用了能量来源作为依据。',
          incorrect: '不要只看体型大小，想一想它怎样获得能量。',
          misconceptionTag: 'size_based_role_guess',
          hint: '植物通常能自己制造养分。',
        },
      },
    ],
    assessmentSpec: {
      items: [
        {
          id: 'assessment_food_chain',
          learningGoal: '解释食物链',
          prompt: '为什么草应该放在食物链开头？',
          options: ['因为草是生产者', '因为草体型最小'],
          correctIndex: 0,
          answer: '因为草是生产者。',
          explanation:
            '草能通过光合作用制造养分，是能量进入食物链的起点，所以应放在开头。',
          misconceptionTag: 'size_based_order',
          hint: '判断开头时先看谁能制造养分。',
        },
        {
          id: 'assessment_roles',
          learningGoal: '识别生态系统中的角色',
          prompt: '兔子为什么是消费者？',
          options: ['因为它吃植物获得能量', '因为它生活在森林'],
          correctIndex: 0,
          answer: '因为兔子吃植物获得能量。',
          explanation:
            '消费者不能像植物一样自己制造养分，需要通过取食获得能量，兔子吃植物所以是消费者。',
          misconceptionTag: 'habitat_based_role',
          hint: '角色分类要看能量来源。',
        },
      ],
      masteryCriteria: [
        '能解释食物链中的能量流向',
        '能迁移判断新角色的分类理由',
      ],
    },
    assetPlan: {
      images: [
        { key: 'forest_scene_bg', description: '明亮森林调查主场景背景' },
        { key: 'guide_character', description: '生态调查员角色立绘' },
        { key: 'role_cards_prop', description: '森林角色卡片关键道具' },
        { key: 'success_state', description: '正确反馈点亮生态状态图' },
        { key: 'failure_state', description: '错误反馈提示状态图' },
      ],
      audio: [
        { key: 'sfx_correct', description: '答对提示音', audioType: 'sfx' },
      ],
    },
    narrationPlan: {
      segments: [
        {
          id: 'lesson_food_chain',
          name: '食物链讲解',
          text: '食物链表示能量从生产者开始传递。',
          targetScene: '导入',
        },
        {
          id: 'lesson_roles',
          name: '生态角色讲解',
          text: '按获取能量的方式区分生产者和消费者。',
          targetScene: '网格分类',
        },
      ],
    },
    validationPlan: {
      requiredChecks: [
        'schema 合法',
        '学习目标闭环',
        '讲解深度',
        '互动反馈',
        '评价解析',
      ],
      browserFlow: ['进入导入', '完成网格分类', '看到反馈'],
      fallbackChecks: ['TTS 失败显示字幕', '视频关闭不阻断流程'],
    },
  };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
