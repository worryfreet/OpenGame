/**
 * @license
 * Copyright 2025 OpenGame Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import type { CourseGDD, CourseSpec } from './schemas.js';
import { validateCourseGdd, validateCourseSpec } from './validation.js';

describe('validateCourseSpec', () => {
  it.each([
    ['数学', '面积和周长'],
    ['语文', '识字与词语匹配'],
    ['英语', '天气单词和句型'],
    ['科学', '简单电路'],
    ['道法', '公共场景规则'],
    ['艺术', '颜色和构图'],
  ])('接受全学科入口：%s', (subject, topic) => {
    const spec = buildCourseSpec({ subject, topic });

    const result = validateCourseSpec(spec);

    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it('拒绝不在中小学范围内的年级', () => {
    const spec = buildCourseSpec();
    spec.studentProfile.grade = 13 as CourseSpec['studentProfile']['grade'];

    const result = validateCourseSpec(spec);

    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.path.includes('grade'))).toBe(
      true,
    );
  });

  it('拒绝 standard 深度缺少例题、练习和误区覆盖', () => {
    const spec = buildCourseSpec({
      explanationDepth: {
        depthLevel: 'standard',
        priorKnowledgeCheck: true,
        conceptLayers: [
          {
            concept: '面积',
            whyItMatters: '帮助理解图形占据空间的大小。',
            misconceptionToAddress: [],
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
        masteryEvidence: ['能解释面积和周长的区别'],
      },
    });

    const result = validateCourseSpec(spec);

    expect(result.valid).toBe(false);
    expect(result.errors.map((error) => error.message).join('\n')).toMatch(
      /standard 深度/,
    );
  });

  it('拒绝 deep 深度缺少迁移任务或常见误区', () => {
    const spec = buildCourseSpec({
      explanationDepth: {
        ...buildCourseSpec().explanationDepth,
        depthLevel: 'deep',
        conceptLayers: [
          {
            concept: '生态系统',
            whyItMatters: '帮助学生理解生物之间的相互依赖。',
            misconceptionToAddress: [],
            representation: 'case',
          },
          {
            concept: '食物链',
            whyItMatters: '帮助学生解释能量流动。',
            misconceptionToAddress: [],
            representation: 'visual_model',
          },
        ],
        examplePlan: {
          workedExamples: 2,
          guidedPractice: 2,
          independentChallenges: 2,
          transferTasks: 0,
        },
      },
    });

    const result = validateCourseSpec(spec);

    expect(result.valid).toBe(false);
    expect(result.errors.map((error) => error.message).join('\n')).toContain(
      'deep 深度必须包含多层概念、常见误区和迁移任务',
    );
  });

  it('监护人关闭上传图片时拒绝 referenceImages', () => {
    const spec = buildCourseSpec({
      styleSpec: {
        ...buildCourseSpec().styleSpec,
        referenceImages: ['https://example.com/reference.png'],
      },
      studentProfile: {
        ...buildCourseSpec().studentProfile,
        guardianLimits: {
          maxSessionMinutes: 20,
          allowUploadedImages: false,
          allowGeneratedVideo: true,
          contentStrictness: 'strict',
        },
      },
    });

    const result = validateCourseSpec(spec);

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({
      path: '/styleSpec/referenceImages',
      message: '监护人关闭上传图片时，不允许提供 referenceImages。',
    });
  });
});

describe('validateCourseGdd', () => {
  it('接受学习目标有讲解、互动和评价闭环的 Course GDD', () => {
    const result = validateCourseGdd(buildCourseGdd());

    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it('拒绝学习目标缺少互动任务闭环', () => {
    const gdd = buildCourseGdd();
    gdd.interactionSpecs = gdd.interactionSpecs.filter(
      (interaction) => interaction.lessonUnitId !== 'lesson_perimeter',
    );

    const result = validateCourseGdd(gdd);

    expect(result.valid).toBe(false);
    expect(result.errors.map((error) => error.message).join('\n')).toContain(
      '必须同时有讲解、互动和评价闭环',
    );
  });

  it('拒绝监护人关闭生成视频时规划视频资产', () => {
    const gdd = buildCourseGdd();
    gdd.assetPlan.video = [
      {
        key: 'intro_video',
        description: '开场视频',
        optional: true,
      },
    ];
    gdd.courseSpec.studentProfile.guardianLimits = {
      maxSessionMinutes: 25,
      allowUploadedImages: true,
      allowGeneratedVideo: false,
      contentStrictness: 'strict',
    };

    const result = validateCourseGdd(gdd);

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({
      path: '/assetPlan/video',
      message: '监护人关闭生成视频时，Course GDD 不允许规划视频资产。',
    });
  });
});

function buildCourseSpec(overrides: Partial<CourseSpec> = {}): CourseSpec {
  const base: CourseSpec = {
    subject: '数学',
    topic: '面积和周长',
    learningGoals: ['理解面积含义', '区分面积和周长'],
    durationMinutes: 20,
    studentProfile: {
      grade: 3,
      age: 9,
      readingLevel: 'medium',
      interests: ['太空', '建造'],
      weakPoints: ['图形概念混淆'],
      preferredInteraction: ['选择', '拖拽'],
      guardianLimits: {
        maxSessionMinutes: 25,
        allowUploadedImages: true,
        allowGeneratedVideo: true,
        contentStrictness: 'strict',
      },
    },
    styleSpec: {
      theme: '太空基地',
      palette: ['#1F2937', '#F59E0B', '#38BDF8'],
      visualMood: '明亮清晰',
      characterStyle: '友好的小助手',
      uiDensity: 'medium',
      forbidden: ['恐怖', '抽卡'],
    },
    explanationDepth: {
      depthLevel: 'standard',
      priorKnowledgeCheck: true,
      conceptLayers: [
        {
          concept: '面积',
          whyItMatters: '帮助学生理解图形占据空间的大小。',
          misconceptionToAddress: ['把面积和边长相加混淆'],
          representation: 'visual_model',
        },
        {
          concept: '周长',
          whyItMatters: '帮助学生理解图形边界长度。',
          misconceptionToAddress: ['把周长当成方格数量'],
          representation: 'formula',
        },
      ],
      examplePlan: {
        workedExamples: 2,
        guidedPractice: 2,
        independentChallenges: 2,
        transferTasks: 1,
      },
      feedbackDepth: 'step_by_step',
      masteryEvidence: ['能解释面积含义', '能区分面积和周长'],
    },
  };

  return {
    ...base,
    ...overrides,
    studentProfile: {
      ...base.studentProfile,
      ...overrides.studentProfile,
    },
    styleSpec: {
      ...base.styleSpec,
      ...overrides.styleSpec,
    },
    explanationDepth: {
      ...base.explanationDepth,
      ...overrides.explanationDepth,
    },
  };
}

function buildCourseGdd(): CourseGDD {
  const courseSpec = buildCourseSpec();
  return {
    courseSpec,
    selectedPlan: {
      id: 'balanced',
      title: '面积网格任务',
      courseArchetype: 'course_grid',
      gameplayType: '网格推理',
      learningLoop: ['讲解', '示例', '互动练习', '反馈', '评价'],
      scenePlan: ['导入', '网格练习', '迁移复盘'],
      assessmentPoints: ['理解面积含义', '区分面积和周长'],
      assetComplexity: 'medium',
      score: {
        learningFit: 90,
        explanationDepthFit: 84,
        fun: 82,
        ageFit: 88,
        implementationStability: 85,
        cost: 78,
        safety: 94,
      },
      recommendationReason: '网格任务适合呈现面积和周长差异。',
      risks: ['需要控制题目数量，避免时间超出。'],
    },
    lessonUnits: [
      {
        id: 'lesson_area',
        learningGoal: '理解面积含义',
        concept: '面积',
        explanationScript:
          '面积表示图形覆盖了多少平面空间，可以用小方格数量帮助理解。数面积时要数覆盖区域，而不是只看边界。',
        interactionTask: '在网格中标出覆盖区域，并完成一个生活场景迁移应用。',
        feedbackStrategy:
          '正确时强化覆盖区域；错误时标记把边界当面积的错因，并提示回到方格模型。',
        assessmentPointId: 'assessment_area',
      },
      {
        id: 'lesson_perimeter',
        learningGoal: '区分面积和周长',
        concept: '周长',
        explanationScript:
          '周长表示图形边界一圈的长度，和面积关注的覆盖区域不同。比较时先判断题目问的是边界还是内部。',
        interactionTask: '判断多个图形任务问面积还是周长，并做迁移复盘。',
        feedbackStrategy:
          '正确时说明边界与内部差异；错误时标记概念混淆，并给下一步观察提示。',
        assessmentPointId: 'assessment_perimeter',
      },
    ],
    interactionSpecs: [
      {
        id: 'interaction_area',
        lessonUnitId: 'lesson_area',
        type: 'grid_sort',
        prompt: '选出表示面积的方格区域。',
        expectedAction: '点击覆盖区域内的小方格。',
        feedback: {
          correct: '你数的是覆盖区域，这是面积。',
          incorrect: '再看题目问的是内部覆盖还是边界一圈。',
          misconceptionTag: 'area_perimeter_confusion',
          hint: '面积看内部，周长看边界。',
        },
      },
      {
        id: 'interaction_perimeter',
        lessonUnitId: 'lesson_perimeter',
        type: 'quiz',
        prompt: '给围栏长度应该算面积还是周长？',
        expectedAction: '选择周长。',
        feedback: {
          correct: '围栏沿边界一圈，所以是周长。',
          incorrect: '围栏不覆盖内部空间，它沿着边界。',
          misconceptionTag: 'boundary_area_confusion',
          hint: '一圈边界对应周长。',
        },
      },
    ],
    assessmentSpec: {
      items: [
        {
          id: 'assessment_area',
          learningGoal: '理解面积含义',
          prompt: '为什么数小方格可以表示面积？',
          options: ['因为小方格覆盖内部空间', '因为边长越多面积越大'],
          correctIndex: 0,
          answer: '因为小方格覆盖内部空间。',
          explanation:
            '面积关注图形内部覆盖的空间，小方格是同样大小的面积单位，数它们就能比较覆盖大小。',
          misconceptionTag: 'count_boundary_as_area',
          hint: '想一想小方格是在内部还是边界上。',
        },
        {
          id: 'assessment_perimeter',
          learningGoal: '区分面积和周长',
          prompt: '给花坛围边需要计算什么？',
          options: ['周长', '面积'],
          correctIndex: 0,
          answer: '周长。',
          explanation:
            '围边沿着花坛边界铺设，要求的是边界一圈的长度，所以应计算周长。',
          misconceptionTag: 'area_perimeter_confusion',
          hint: '看到边界一圈，优先想到周长。',
        },
      ],
      masteryCriteria: ['能解释面积含义', '能迁移区分面积和周长任务'],
    },
    assetPlan: {
      images: [{ key: 'grid_bg', description: '明亮网格背景' }],
      audio: [
        { key: 'sfx_correct', description: '正确提示音', audioType: 'sfx' },
      ],
    },
    narrationPlan: {
      segments: [
        {
          id: 'lesson_area',
          name: '面积讲解',
          text: '面积表示图形覆盖了多少平面空间。',
          targetScene: '导入',
        },
        {
          id: 'lesson_perimeter',
          name: '周长讲解',
          text: '周长表示图形边界一圈的长度。',
          targetScene: '网格练习',
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
      browserFlow: ['进入导入', '完成第一题', '看到反馈'],
      fallbackChecks: ['TTS 失败显示字幕', '素材失败使用占位图'],
    },
  };
}
