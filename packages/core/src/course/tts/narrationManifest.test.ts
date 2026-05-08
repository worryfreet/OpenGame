/**
 * @license
 * Copyright 2025 OpenGame Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import type { CourseGDD } from '../schemas.js';
import {
  buildCourseNarrationManifest,
  buildLessoninBatchRequestFromCourseGdd,
  buildSubtitleOnlyNarrationManifest,
} from './narrationManifest.js';

describe('narrationManifest', () => {
  it('从 Course GDD 生成 lessonin 批量请求体', () => {
    const request = buildLessoninBatchRequestFromCourseGdd(buildCourseGdd(), {
      courseId: 'forest_course',
      basePath: 'Forest/audio/narration',
    });

    expect(request).toEqual({
      basePath: 'Forest/audio/narration',
      type: 'mp3',
      scriptList: [
        { name: 'lesson_food_chain', script: '食物链表示能量流动。' },
        {
          name: 'lesson_food_chain_review',
          script: '消费者通过取食获得能量。',
        },
      ],
    });
  });

  it('将 TTS 结果合并为持久 audio_uri manifest', () => {
    const manifest = buildCourseNarrationManifest({
      courseGdd: buildCourseGdd(),
      courseId: 'forest_course',
      outputDir: 'public/assets/narration',
      ttsResult: {
        items: [
          {
            name: 'lesson_food_chain',
            audio_uri: 'Forest/audio/narration/lesson_food_chain.mp3',
            audio_url: 'https://example.test/1.mp3',
          },
          {
            name: 'lesson_food_chain_review',
            audio_uri: 'Forest/audio/narration/lesson_food_chain_review.mp3',
          },
        ],
      },
    });

    expect(manifest.fallbackMode).toBe('none');
    expect(manifest.segments[0]).toMatchObject({
      id: 'lesson_food_chain',
      audio_uri: 'Forest/audio/narration/lesson_food_chain.mp3',
      local_path: 'public/assets/narration/lesson_food_chain.mp3',
      status: 'ready',
      fallbackSubtitle: '食物链表示能量流动。',
    });
  });

  it('TTS 失败时降级为字幕 manifest', () => {
    const manifest = buildSubtitleOnlyNarrationManifest(buildCourseGdd(), {
      courseId: 'forest_course',
      reason: new Error('connect refused'),
    });

    expect(manifest.fallbackMode).toBe('subtitle_only');
    expect(manifest.segments).toHaveLength(2);
    expect(manifest.segments.every((segment) => !segment.audio_uri)).toBe(true);
    expect(
      manifest.segments.every(
        (segment) => segment.status === 'fallback_subtitle',
      ),
    ).toBe(true);
    expect(manifest.warnings[0]).toContain('connect refused');
  });
});

function buildCourseGdd(): CourseGDD {
  return {
    courseSpec: {
      subject: '科学',
      topic: '食物链',
      learningGoals: ['理解食物链中的能量流动'],
      durationMinutes: 15,
      studentProfile: {
        grade: 5,
        interests: ['森林'],
        guardianLimits: {
          maxSessionMinutes: 20,
          allowUploadedImages: false,
          allowGeneratedVideo: false,
          contentStrictness: 'strict',
        },
      },
      styleSpec: {
        theme: '森林探险',
        palette: ['#2F8F46', '#F2C94C'],
        visualMood: '明亮',
        characterStyle: '卡通',
        uiDensity: 'medium',
        forbidden: ['恐怖'],
      },
      explanationDepth: {
        depthLevel: 'standard',
        priorKnowledgeCheck: true,
        conceptLayers: [
          {
            concept: '食物链',
            whyItMatters: '帮助理解生态系统能量流动。',
            misconceptionToAddress: ['按栖息地分类角色'],
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
        masteryEvidence: ['能解释能量从植物到动物的流动'],
      },
    },
    selectedPlan: {
      id: 'balanced',
      title: '森林食物链调查',
      courseArchetype: 'course_grid',
      gameplayType: 'grid_sort',
      learningLoop: ['讲解', '示例', '互动', '反馈', '评价'],
      scenePlan: ['导入', '网格分类'],
      assessmentPoints: ['理解食物链中的能量流动'],
      assetComplexity: 'low',
      score: {
        learningFit: 90,
        explanationDepthFit: 88,
        fun: 82,
        ageFit: 92,
        implementationStability: 85,
        cost: 80,
        safety: 95,
      },
      recommendationReason: '网格分类适合生态角色判断。',
      risks: [],
    },
    lessonUnits: [
      {
        id: 'lesson_food_chain',
        learningGoal: '理解食物链中的能量流动',
        concept: '食物链',
        explanationScript:
          '食物链表示能量从植物开始，经过动物取食逐步传递，每一步都要看能量来源。',
        interactionTask: '把植物、兔子和狐狸放到正确位置。',
        feedbackStrategy: '如果按栖息地分类，要提示改看能量来源。',
        assessmentPointId: 'assess_food_chain',
      },
    ],
    interactionSpecs: [
      {
        id: 'interact_food_chain',
        lessonUnitId: 'lesson_food_chain',
        type: 'grid_sort',
        prompt: '把生态角色放入正确位置。',
        expectedAction: '植物放生产者，兔子放消费者。',
        feedback: {
          correct: '分类正确。',
          incorrect: '先判断能量来源。',
          misconceptionTag: 'habitat_based_role',
          hint: '植物能自己制造养分。',
        },
      },
    ],
    assessmentSpec: {
      items: [
        {
          id: 'assess_food_chain',
          learningGoal: '理解食物链中的能量流动',
          prompt: '兔子为什么是消费者？',
          options: ['它吃植物获得能量', '它住在森林里'],
          correctIndex: 0,
          answer: '它吃植物获得能量',
          explanation: '消费者不能自己制造养分，兔子通过取食植物获得能量。',
          misconceptionTag: 'habitat_based_role',
          hint: '分类要看能量来源。',
        },
      ],
      masteryCriteria: ['能解释能量流动'],
    },
    assetPlan: {
      images: [{ key: 'forest_bg', description: '森林背景' }],
      audio: [
        { key: 'sfx_correct', description: '答对音效', audioType: 'sfx' },
      ],
    },
    narrationPlan: {
      segments: [
        {
          id: 'lesson_food_chain',
          name: '食物链讲解',
          text: '食物链表示能量流动。',
          targetScene: '导入',
        },
        {
          id: 'lesson_food_chain_review',
          name: '食物链讲解',
          text: '消费者通过取食获得能量。',
          targetScene: '网格分类',
        },
      ],
    },
    validationPlan: {
      requiredChecks: ['schema 合法', '学习目标闭环', '讲解', '互动', '评价'],
      browserFlow: ['进入导入', '完成互动'],
      fallbackChecks: ['TTS 失败显示字幕'],
    },
  };
}
