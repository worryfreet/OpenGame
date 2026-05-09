/**
 * @license
 * Copyright 2025 OpenGame Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import type { CourseGDD, CoursePlanOption, CourseSpec } from '../schemas.js';
import { reviseCoursePlan } from './courseRevision.js';

describe('MVP 2.0 课程轻量修订', () => {
  it('修改讲解深度后同步更新 CourseSpec 和选中方案重评分', () => {
    const courseSpec = buildCourseSpec();
    const selectedPlan = buildCoursePlanOption();

    const result = reviseCoursePlan({
      request: {
        basePlanId: selectedPlan.id,
        changes: [{ type: 'change_depth', value: 'deep' }],
      },
      courseSpec,
      selectedPlan,
    });

    expect(result.status).toBe('ready');
    expect(result.courseSpec?.explanationDepth.depthLevel).toBe('deep');
    expect(result.courseSpec?.explanationDepth.examplePlan.workedExamples).toBe(
      2,
    );
    expect(result.courseSpec?.explanationDepth.examplePlan.transferTasks).toBe(
      1,
    );
    expect(result.selectedPlan?.score).not.toEqual(selectedPlan.score);
    expect(result.appliedChanges).toContainEqual(
      expect.objectContaining({ type: 'change_depth' }),
    );
  });

  it('深度改为 deep 后缺少迁移任务时阻断 CourseGDD', () => {
    const courseGdd = buildCourseGdd();
    courseGdd.lessonUnits = courseGdd.lessonUnits.map((unit) => ({
      ...unit,
      interactionTask: '完成基础分类练习。',
    }));
    courseGdd.assessmentSpec.masteryCriteria = [
      '能解释面积含义',
      '能区分面积和周长',
    ];
    courseGdd.validationPlan.requiredChecks = [
      'schema 合法',
      '学习目标闭环',
      '讲解深度',
      '互动反馈',
      '评价解析',
    ];

    const result = reviseCoursePlan({
      request: {
        basePlanId: courseGdd.selectedPlan.id,
        changes: [{ type: 'change_depth', value: 'deep' }],
      },
      courseGdd,
    });

    expect(result.status).toBe('blocked');
    expect(result.validationIssues).toContainEqual(
      expect.objectContaining({
        path: '/validationPlan',
        message: expect.stringContaining('迁移任务或反思复盘'),
      }),
    );
  });

  it('替换题目时要求答案、解析、错因和提示完整', () => {
    const courseGdd = buildCourseGdd();

    const result = reviseCoursePlan({
      request: {
        basePlanId: courseGdd.selectedPlan.id,
        changes: [
          {
            type: 'replace_question',
            questionId: 'assessment_area',
            question: {
              learningGoal: '理解面积含义',
              prompt: '为什么两个图形边界不同但面积可能相同？',
              answer: '因为面积看覆盖多少格。',
              explanation: '',
              misconceptionTag: 'perimeter_area_confusion',
              hint: '先数覆盖的方格。',
            },
          },
        ],
      },
      courseGdd,
    });

    expect(result.status).toBe('blocked');
    expect(result.validationIssues).toContainEqual(
      expect.objectContaining({
        path: '/assessmentSpec/items/assessment_area/explanation',
      }),
    );
  });

  it('禁用视频时清空视频资产并移除视频必检项', () => {
    const courseGdd = buildCourseGdd();

    const result = reviseCoursePlan({
      request: {
        basePlanId: courseGdd.selectedPlan.id,
        changes: [{ type: 'disable_video' }],
      },
      courseGdd,
    });

    expect(result.status).toBe('ready');
    expect(result.courseGdd?.assetPlan.video).toEqual([]);
    expect(
      result.courseGdd?.validationPlan.requiredChecks.some((item) =>
        /视频|video/i.test(item),
      ),
    ).toBe(false);
    expect(result.courseGdd?.validationPlan.fallbackChecks).toContain(
      '视频关闭时使用静态过场和字幕说明',
    );
  });
});

function buildCourseSpec(): CourseSpec {
  return {
    subject: '数学',
    topic: '面积和周长',
    learningGoals: ['理解面积含义', '区分面积和周长'],
    durationMinutes: 25,
    studentProfile: {
      grade: 3,
      readingLevel: 'medium',
      interests: ['太空', '建造'],
      guardianLimits: {
        maxSessionMinutes: 30,
        allowUploadedImages: false,
        allowGeneratedVideo: true,
        contentStrictness: 'strict',
      },
    },
    styleSpec: {
      theme: '太空基地',
      palette: ['#2563EB', '#F59E0B', '#F8FAFC'],
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
        {
          concept: '周长',
          whyItMatters: '帮助学生理解边界长度。',
          misconceptionToAddress: ['把周长当成方格数量'],
          representation: 'visual_model',
        },
      ],
      examplePlan: {
        workedExamples: 2,
        guidedPractice: 2,
        independentChallenges: 1,
        transferTasks: 0,
      },
      feedbackDepth: 'step_by_step',
      masteryEvidence: ['能解释面积含义', '能区分面积和周长'],
    },
  };
}

function buildCoursePlanOption(): CoursePlanOption {
  return {
    id: 'balanced',
    title: '太空网格面积调查',
    courseArchetype: 'course_grid',
    gameplayType: '网格建造',
    learningLoop: ['讲解', '示例', '互动练习', '反馈', '评价'],
    scenePlan: ['导入', '网格任务', '复盘'],
    assessmentPoints: ['理解面积含义', '区分面积和周长'],
    assetComplexity: 'medium',
    score: {
      learningFit: 90,
      explanationDepthFit: 82,
      fun: 84,
      ageFit: 88,
      implementationStability: 84,
      cost: 78,
      safety: 96,
    },
    recommendationReason: '网格操作适合面积概念。',
    risks: ['需要控制格子数量。'],
  };
}

function buildCourseGdd(): CourseGDD {
  const courseSpec = buildCourseSpec();
  const selectedPlan = buildCoursePlanOption();
  return {
    courseSpec,
    selectedPlan,
    lessonUnits: [
      {
        id: 'lesson_area',
        learningGoal: '理解面积含义',
        concept: '面积',
        explanationScript:
          '面积表示图形覆盖平面的大小。可以用相同大小的方格去铺满图形，再比较覆盖方格数量。',
        interactionTask: '数出两个太空舱地板覆盖的方格，并做一次迁移应用复盘。',
        feedbackStrategy:
          '正确时强化覆盖大小；错误时提示不要数边界，先看图形内部覆盖了多少格。',
        assessmentPointId: 'assessment_area',
      },
      {
        id: 'lesson_perimeter',
        learningGoal: '区分面积和周长',
        concept: '周长',
        explanationScript:
          '周长表示图形边界一圈的长度，面积表示内部覆盖大小。比较时要先判断问题问的是边界还是内部。',
        interactionTask:
          '把题目拖到面积或周长分类，并解释一个新图形的判断理由。',
        feedbackStrategy:
          '正确时连接关键词；错误时标记面积周长混淆，并给出下一步观察提示。',
        assessmentPointId: 'assessment_perimeter',
      },
    ],
    interactionSpecs: [
      {
        id: 'interaction_area',
        lessonUnitId: 'lesson_area',
        type: 'grid_count',
        prompt: '数一数太空舱地板覆盖了多少个方格。',
        expectedAction: '按内部覆盖方格计数。',
        feedback: {
          correct: '你数的是覆盖区域，所以这是面积。',
          incorrect: '不要沿着边界数，看看内部有多少格。',
          misconceptionTag: 'perimeter_area_confusion',
          hint: '面积看内部覆盖，周长看边界一圈。',
        },
      },
      {
        id: 'interaction_perimeter',
        lessonUnitId: 'lesson_perimeter',
        type: 'card_sort',
        prompt: '把任务卡分成面积问题和周长问题。',
        expectedAction: '根据问题关键词分类。',
        feedback: {
          correct: '分类正确，你抓住了内部和边界的区别。',
          incorrect: '先看题目问覆盖大小还是一圈长度。',
          misconceptionTag: 'keyword_misread',
          hint: '覆盖多少是面积，一圈多长是周长。',
        },
      },
    ],
    assessmentSpec: {
      items: [
        {
          id: 'assessment_area',
          learningGoal: '理解面积含义',
          prompt: '为什么数方格可以比较面积？',
          options: ['方格大小相同，数量表示覆盖大小', '方格越靠边越重要'],
          correctIndex: 0,
          answer: '因为相同方格的数量能表示覆盖大小。',
          explanation:
            '面积比较的是内部覆盖大小，当每个方格一样大时，覆盖方格越多，面积就越大。',
          misconceptionTag: 'unequal_unit_confusion',
          hint: '先确认每个方格一样大。',
        },
        {
          id: 'assessment_perimeter',
          learningGoal: '区分面积和周长',
          prompt: '求围栏长度时应该看面积还是周长？',
          options: ['周长', '面积'],
          correctIndex: 0,
          answer: '应该看周长。',
          explanation:
            '围栏沿着图形边界一圈铺设，求的是边界长度，所以应该使用周长而不是面积。',
          misconceptionTag: 'perimeter_area_confusion',
          hint: '围栏在边界上，不在内部覆盖区域。',
        },
      ],
      masteryCriteria: ['能迁移解释面积含义', '能复盘面积和周长区别'],
    },
    assetPlan: {
      images: [{ key: 'space_grid_bg', description: '太空基地网格背景' }],
      audio: [
        { key: 'sfx_correct', description: '答对提示音', audioType: 'sfx' },
      ],
      video: [
        {
          key: 'intro_video',
          description: '太空基地任务开场视频',
          optional: true,
        },
      ],
    },
    narrationPlan: {
      segments: [
        {
          id: 'lesson_area',
          name: '面积讲解',
          text: '面积表示内部覆盖大小。',
          targetScene: '导入',
        },
        {
          id: 'lesson_perimeter',
          name: '周长讲解',
          text: '周长表示边界一圈长度。',
          targetScene: '网格任务',
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
        '视频资源可跳过',
      ],
      browserFlow: ['进入导入', '播放 video 过场', '完成网格任务', '看到反馈'],
      fallbackChecks: ['TTS 失败显示字幕'],
    },
  };
}
