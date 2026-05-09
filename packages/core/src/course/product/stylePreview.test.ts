/**
 * @license
 * Copyright 2025 OpenGame Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import type { CoursePlanOption, CourseSpec, StyleSpec } from '../schemas.js';
import {
  adjustCoursePlanDepth,
  buildCoursePlanConfirmationSummary,
  generateStylePreview,
} from './stylePreview.js';

describe('MVP 2.0 风格板预览与方案确认', () => {
  it('从 StyleSpec 生成风格板预览核心字段', () => {
    const preview = generateStylePreview({
      styleSpec: buildStyleSpec(),
      subject: '数学',
      topic: '面积',
      grade: 3,
      referenceImageAnalysis: '蓝色主色、清晰按钮、圆角角色轮廓',
    });

    expect(preview.palette).toEqual(['#2563EB', '#F59E0B', '#F8FAFC']);
    expect(preview.characterDirection).toContain('原创星际小助手');
    expect(preview.uiMood).toContain('信息层级清楚');
    expect(preview.referenceImageAnalysis).toBe(
      '蓝色主色、清晰按钮、圆角角色轮廓',
    );
    expect(preview.forbiddenElements).toContain('抽卡');
    expect(preview.previewPrompt).toContain('《面积》');
  });

  it('知名 IP 风格不会直接进入 previewPrompt', () => {
    const preview = generateStylePreview({
      styleSpec: {
        ...buildStyleSpec(),
        theme: '宝可梦太空训练营',
        characterStyle: '像皮卡丘一样的伙伴',
        forbidden: ['不要直接复制宝可梦'],
      },
      referenceImageAnalysis: '参考图有 Pokemon 式电气角色',
    });

    expect(preview.previewPrompt).not.toMatch(/宝可梦|皮卡丘|Pokemon/i);
    expect(preview.referenceImageAnalysis).not.toMatch(/Pokemon/i);
    expect(preview.safetyWarnings.length).toBeGreaterThan(0);
    expect(
      preview.forbiddenElements.some((item) => item.includes('知名 IP')),
    ).toBe(true);
  });

  it('方案确认摘要包含评分、风险、预计成本、预计时长和深度', () => {
    const summary = buildCoursePlanConfirmationSummary(
      buildCourseSpec(),
      buildOptions(),
    );

    expect(summary.options).toHaveLength(3);
    expect(summary.recommendedOptionId).toBe('balanced');
    expect(summary.options[0]).toMatchObject({
      id: 'stable',
      estimatedCostCents: 25,
      estimatedDurationMinutes: 25,
      explanationDepthLevel: 'standard',
    });
    expect(summary.options[0].explanationDepthSummary).toContain('迁移任务');
    expect(summary.options[0].risks).toEqual(['互动形式较保守。']);
  });

  it('讲解深度改为 deep 后重新计算成本、时长和深度要求', () => {
    const result = adjustCoursePlanDepth(
      buildCourseSpec(),
      buildOptions(),
      'deep',
    );

    expect(result.courseSpec.explanationDepth.depthLevel).toBe('deep');
    expect(result.courseSpec.explanationDepth.examplePlan.workedExamples).toBe(
      2,
    );
    expect(result.confirmationSummary.options[0].estimatedDurationMinutes).toBe(
      30,
    );
    expect(
      result.confirmationSummary.options.every(
        (option) => option.explanationDepthLevel === 'deep',
      ),
    ).toBe(true);
    expect(
      result.confirmationSummary.options[0].score.explanationDepthFit,
    ).toBe(88);
  });
});

function buildStyleSpec(): StyleSpec {
  return {
    theme: '太空基地',
    palette: ['#2563EB', '#F59E0B', '#F8FAFC'],
    visualMood: '明亮清晰',
    characterStyle: '星际小助手',
    uiDensity: 'medium',
    forbidden: ['抽卡'],
  };
}

function buildCourseSpec(): CourseSpec {
  return {
    subject: '数学',
    topic: '面积',
    learningGoals: ['理解面积含义', '区分面积和周长'],
    durationMinutes: 25,
    studentProfile: {
      grade: 3,
      age: 9,
      readingLevel: 'medium',
      interests: ['太空', '建造'],
      guardianLimits: {
        maxSessionMinutes: 30,
        allowUploadedImages: true,
        allowGeneratedVideo: false,
        contentStrictness: 'strict',
      },
    },
    styleSpec: buildStyleSpec(),
    explanationDepth: {
      depthLevel: 'standard',
      priorKnowledgeCheck: true,
      conceptLayers: [
        {
          concept: '面积',
          whyItMatters: '帮助学生理解图形占据空间大小。',
          misconceptionToAddress: ['把面积和周长混淆'],
          representation: 'visual_model',
        },
      ],
      examplePlan: {
        workedExamples: 1,
        guidedPractice: 2,
        independentChallenges: 2,
        transferTasks: 1,
      },
      feedbackDepth: 'step_by_step',
      masteryEvidence: ['能解释面积与周长的区别'],
    },
  };
}

function buildOptions(): CoursePlanOption[] {
  return [
    buildOption('stable', '稳妥讲解任务', 'course_ui', '剧情选择', 'low', {
      learningFit: 90,
      explanationDepthFit: 84,
      fun: 76,
      ageFit: 88,
      implementationStability: 92,
      cost: 92,
      safety: 96,
    }),
    buildOption(
      'balanced',
      '网格面积调查',
      'course_grid',
      '分类观察',
      'medium',
      {
        learningFit: 92,
        explanationDepthFit: 88,
        fun: 84,
        ageFit: 88,
        implementationStability: 84,
        cost: 76,
        safety: 96,
      },
    ),
    buildOption(
      'creative',
      '面积守护挑战',
      'course_grid',
      '流程推演',
      'medium',
      {
        learningFit: 88,
        explanationDepthFit: 86,
        fun: 88,
        ageFit: 88,
        implementationStability: 80,
        cost: 76,
        safety: 92,
      },
    ),
  ];
}

function buildOption(
  id: CoursePlanOption['id'],
  title: string,
  courseArchetype: CoursePlanOption['courseArchetype'],
  gameplayType: string,
  assetComplexity: CoursePlanOption['assetComplexity'],
  score: CoursePlanOption['score'],
): CoursePlanOption {
  return {
    id,
    title,
    courseArchetype,
    gameplayType,
    learningLoop: ['讲解', '示例', '互动练习', '反馈', '评价'],
    scenePlan: ['导入', '任务', '复盘'],
    assessmentPoints: ['理解面积含义', '区分面积和周长'],
    assetComplexity,
    score,
    recommendationReason: '适合本主题。',
    risks: id === 'stable' ? ['互动形式较保守。'] : ['需要控制任务数量。'],
  };
}
