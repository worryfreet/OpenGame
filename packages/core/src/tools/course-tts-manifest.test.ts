/**
 * @license
 * Copyright 2025 OpenGame Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Config } from '../config/config.js';
import type {
  CourseGDD,
  CoursePlanOption,
  CourseSpec,
} from '../course/schemas.js';
import { CourseTtsManifestTool } from './course-tts-manifest.js';

describe('CourseTtsManifestTool', () => {
  let tempDir: string;
  let config: Config;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'course-tts-tool-'));
    config = {
      getProjectRoot: () => tempDir,
    } as Config;
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('调用 lessonin 批量 TTS 并写入 ready manifest', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        code: 0,
        data: {
          items: [
            {
              name: 'lesson_food_chain',
              audio_uri: 'course/audio/lesson_food_chain.mp3',
              audio_url: 'https://example.test/lesson_food_chain.mp3',
            },
          ],
        },
      }),
    } as Response);
    vi.stubGlobal('fetch', fetchMock);
    const tool = new CourseTtsManifestTool(config);

    const result = await tool.buildAndExecute(
      {
        packageDir: 'generated-course',
        courseGdd: buildCourseGdd(),
        courseId: 'course',
        lessoninBaseUrl: 'https://lessonin.test',
      },
      new AbortController().signal,
    );

    expect(result.error).toBeUndefined();
    expect(result.llmContent).toContain('"fallbackMode": "none"');
    expect(result.llmContent).toContain('"ttsAttempted": true');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://lessonin.test/api/v1/ai/generate/audio/v2/batch',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"scriptList"'),
      }),
    );

    const manifest = JSON.parse(
      await fs.readFile(
        path.join(
          tempDir,
          'generated-course/public/assets/narration/narration-manifest.json',
        ),
        'utf-8',
      ),
    ) as { segments: Array<{ status: string; audio_uri?: string }> };
    expect(manifest.segments[0]).toMatchObject({
      status: 'ready',
      audio_uri: 'course/audio/lesson_food_chain.mp3',
    });
  });

  it('TTS 请求失败时写入字幕降级 manifest，不阻断工具调用', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('connect refused')),
    );
    const tool = new CourseTtsManifestTool(config);

    const result = await tool.buildAndExecute(
      {
        packageDir: 'generated-course',
        courseGdd: buildCourseGdd(),
      },
      new AbortController().signal,
    );

    expect(result.error).toBeUndefined();
    expect(result.llmContent).toContain('"fallbackMode": "subtitle_only"');
    expect(result.llmContent).toContain('connect refused');
  });

  it('skipTts=true 时直接写入字幕 manifest 且不调用 fetch', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const tool = new CourseTtsManifestTool(config);

    const result = await tool.buildAndExecute(
      {
        packageDir: 'generated-course',
        courseGdd: buildCourseGdd(),
        skipTts: true,
      },
      new AbortController().signal,
    );

    expect(result.error).toBeUndefined();
    expect(result.llmContent).toContain('"ttsAttempted": false');
    expect(result.llmContent).toContain('skipTts=true');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

function buildCourseSpec(): CourseSpec {
  return {
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
        {
          concept: '消费者',
          whyItMatters: '帮助判断动物在食物链中的能量来源。',
          misconceptionToAddress: ['只按体型大小判断生态角色'],
          representation: 'case',
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
  };
}

function buildSelectedPlan(): CoursePlanOption {
  return {
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
  };
}

function buildCourseGdd(): CourseGDD {
  return {
    courseSpec: buildCourseSpec(),
    selectedPlan: buildSelectedPlan(),
    lessonUnits: [
      {
        id: 'lesson_food_chain',
        learningGoal: '理解食物链中的能量流动',
        concept: '食物链',
        explanationScript:
          '食物链表示能量从植物开始，经过动物取食逐步传递。判断时要先找到能自己制造养分的生产者，再观察消费者通过吃什么获得能量，这样才能说明能量从哪里来、到哪里去。',
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
      ],
    },
    validationPlan: {
      requiredChecks: ['schema 合法', '学习目标闭环', '讲解', '互动', '评价'],
      browserFlow: ['进入导入', '完成互动'],
      fallbackChecks: ['TTS 失败显示字幕'],
    },
  };
}
