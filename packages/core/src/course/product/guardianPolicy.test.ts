/**
 * @license
 * Copyright 2025 OpenGame Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import type { CourseGDD, CoursePlanOption, CourseSpec } from '../schemas.js';
import {
  applyGuardianPolicyToCourseGdd,
  applyGuardianPolicyToCourseSpec,
  buildDefaultGuardianPolicy,
  getAssetGenerationGuard,
  validateGuardianPolicyForPublish,
} from './guardianPolicy.js';

describe('MVP 2.0 家长控制', () => {
  it('超过家长设置时长的 CourseSpec 会被缩短并写入限制', () => {
    const result = applyGuardianPolicyToCourseSpec(buildCourseSpec(), {
      ...buildDefaultGuardianPolicy('profile_1'),
      maxSessionMinutes: 15,
    });

    expect(result.valid).toBe(true);
    expect(result.courseSpec?.durationMinutes).toBe(15);
    expect(result.courseSpec?.studentProfile.guardianLimits).toEqual({
      maxSessionMinutes: 15,
      allowUploadedImages: false,
      allowGeneratedVideo: false,
      contentStrictness: 'strict',
    });
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        path: '/durationMinutes',
        severity: 'warning',
      }),
    );
  });

  it('禁用视频时清空 CourseGDD 视频资产并移除视频必检项', () => {
    const courseGdd = buildCourseGdd();
    const result = applyGuardianPolicyToCourseGdd(courseGdd, {
      ...buildDefaultGuardianPolicy('profile_1'),
      allowGeneratedVideo: false,
    });

    expect(result.valid).toBe(true);
    expect(result.courseGdd?.assetPlan.video).toEqual([]);
    expect(result.courseGdd?.validationPlan.requiredChecks).not.toContain(
      '视频资产可播放',
    );
    expect(result.courseGdd?.validationPlan.browserFlow).not.toContain(
      '播放视频过场',
    );
    expect(result.courseGdd?.validationPlan.fallbackChecks).toContain(
      '视频关闭时使用静态过场和字幕说明',
    );
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        path: '/assetPlan/video',
        message: '家长关闭生成视频，视频资产计划已移除。',
      }),
    );
  });

  it('资产生成门禁会阻止视频资产生成', () => {
    const guard = getAssetGenerationGuard(buildCourseGdd(), {
      ...buildDefaultGuardianPolicy('profile_1'),
      allowGeneratedVideo: false,
    });

    expect(guard.shouldGenerateVideo).toBe(false);
    expect(guard.shouldGenerateImages).toBe(true);
    expect(guard.blockedReasons).toContainEqual(
      expect.objectContaining({
        path: '/assetPlan/video',
        message: '家长关闭生成视频，必须跳过视频资产生成。',
      }),
    );
  });

  it('发布前发现策略没有落到 CourseGDD 时阻断', () => {
    const result = validateGuardianPolicyForPublish(buildCourseGdd(), {
      ...buildDefaultGuardianPolicy('profile_1'),
      maxSessionMinutes: 15,
      allowGeneratedVideo: false,
    });

    expect(result.passed).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: '/courseSpec/durationMinutes' }),
        expect.objectContaining({ path: '/assetPlan/video' }),
        expect.objectContaining({
          path: '/courseSpec/studentProfile/guardianLimits',
        }),
      ]),
    );
  });
});

function buildCourseSpec(): CourseSpec {
  return {
    subject: '数学',
    topic: '面积',
    learningGoals: ['理解面积含义', '区分面积和周长'],
    durationMinutes: 30,
    studentProfile: {
      grade: 3,
      readingLevel: 'medium',
      interests: ['太空'],
      guardianLimits: {
        maxSessionMinutes: 30,
        allowUploadedImages: true,
        allowGeneratedVideo: true,
        contentStrictness: 'normal',
      },
    },
    styleSpec: {
      theme: '太空基地',
      palette: ['#2563EB', '#F59E0B', '#F8FAFC'],
      referenceImages: ['https://example.com/reference.png'],
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
          whyItMatters: '帮助学生理解覆盖大小。',
          misconceptionToAddress: ['把面积和周长混淆'],
          representation: 'visual_model',
        },
        {
          concept: '周长',
          whyItMatters: '帮助学生理解边界长度。',
          misconceptionToAddress: ['把周长当成方格数'],
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
    scenePlan: ['GridLessonScene', 'GridPracticeScene'],
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
  return {
    courseSpec: buildCourseSpec(),
    selectedPlan: buildCoursePlanOption(),
    lessonUnits: [
      {
        id: 'lesson_area',
        learningGoal: '理解面积含义',
        concept: '面积',
        explanationScript: '面积表示图形覆盖平面的大小，可以用方格数量比较。',
        interactionTask: '数出太空舱覆盖的方格。',
        feedbackStrategy: '错误时提示不要数边界，先看内部覆盖。',
        assessmentPointId: 'assessment_area',
      },
      {
        id: 'lesson_perimeter',
        learningGoal: '区分面积和周长',
        concept: '周长',
        explanationScript: '周长表示图形一圈边界的长度，不等于覆盖面积。',
        interactionTask: '比较两个图形的面积和周长。',
        feedbackStrategy: '错误时提示先区分内部覆盖和外圈边界。',
        assessmentPointId: 'assessment_perimeter',
      },
    ],
    interactionSpecs: [],
    assessmentSpec: {
      items: [],
      masteryCriteria: ['能解释面积含义', '能区分面积和周长'],
    },
    assetPlan: {
      images: [{ key: 'space_bg', description: '太空网格背景' }],
      audio: [
        { key: 'sfx_correct', description: '答对提示音', audioType: 'sfx' },
      ],
      video: [
        { key: 'intro_video', description: '课程开场视频', optional: true },
      ],
    },
    narrationPlan: { segments: [] },
    validationPlan: {
      requiredChecks: ['schema 合法', '学习目标闭环', '视频资产可播放'],
      browserFlow: ['进入课程', '播放视频过场', '完成互动'],
      fallbackChecks: ['TTS 失败显示字幕'],
    },
  };
}
