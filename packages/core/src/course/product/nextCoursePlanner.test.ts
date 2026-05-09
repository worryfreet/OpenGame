/**
 * @license
 * Copyright 2025 OpenGame Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import type { CourseSpec } from '../schemas.js';
import { createEmptyLearningState } from './learningState.js';
import { planNextCourse } from './nextCoursePlanner.js';
import { createPreferenceProfile } from './preferenceProfile.js';

describe('MVP 2.0 学习报告深化与课程续作', () => {
  it('错因“单位混淆”生成面积单位强化课程', () => {
    const result = planNextCourse({
      profileId: 'profile_1',
      previousCourseSpec: buildCourseSpec(),
      previousGameplayType: '网格建造',
      learningReport: {
        profileId: 'profile_1',
        subject: '数学',
        weakPoints: ['单位混淆'],
        masteredGoals: ['理解面积含义'],
        misconceptionTags: ['area_unit_confusion'],
        hintUsageCount: 3,
        completionRate: 0.68,
        coursePackageId: 'course_pkg_area_1',
      },
    });

    expect(result.status).toBe('ready');
    expect(result.courseSpec?.topic).toBe('面积单位换算');
    expect(result.courseSpec?.learningGoals).toEqual([
      '理解面积单位的含义',
      '能进行面积单位换算',
      '能区分长度单位和面积单位',
    ]);
    expect(result.courseSpec?.studentProfile.weakPoints).toEqual(['单位混淆']);
    expect(
      result.courseSpec?.studentProfile.preferredInteraction,
    ).not.toContain('网格建造');
    expect(result.courseSpec?.explanationDepth.depthLevel).toBe('intro');
    expect(result.updatedLearningState?.subjectStates[0]).toEqual({
      subject: '数学',
      weakPoints: ['单位混淆'],
      masteredGoals: ['理解面积含义'],
      misconceptionTags: ['area_unit_confusion'],
      hintUsageCount: 3,
      completionRate: 0.68,
      lastCoursePackageId: 'course_pkg_area_1',
    });
  });

  it('继承太空偏好，但同主题新玩法不盲目重复上一玩法', () => {
    const result = planNextCourse({
      profileId: 'profile_1',
      subject: '数学',
      previousCourseSpec: buildCourseSpec(),
      learningState: {
        profileId: 'profile_1',
        subjectStates: [
          {
            subject: '数学',
            weakPoints: [],
            masteredGoals: ['理解面积含义', '区分面积和周长'],
            misconceptionTags: [],
            completionRate: 0.95,
          },
        ],
      },
      preferenceProfile: createPreferenceProfile({
        profileId: 'profile_1',
        grade: 3,
        interests: ['太空'],
        preferredThemes: ['星际基地'],
        preferredPalette: ['#0F172A', '#F59E0B'],
        preferredGameplayTypes: ['网格建造', '卡片配对'],
        readingLevel: 'medium',
      }),
      previousGameplayType: '网格建造',
    });

    expect(result.status).toBe('ready');
    expect(result.rationale.mode).toBe('same_topic_new_gameplay');
    expect(result.courseSpec?.styleSpec.theme).toBe('星际基地新任务');
    expect(result.courseSpec?.studentProfile.interests).toEqual([
      '太空',
      '建造',
    ]);
    expect(result.courseSpec?.studentProfile.preferredInteraction).toEqual([
      '卡片配对',
    ]);
  });

  it('学习状态不足时不生成课程，返回追问', () => {
    const result = planNextCourse({
      profileId: 'profile_1',
      subject: '数学',
      learningState: createEmptyLearningState('profile_1'),
      preferenceProfile: createPreferenceProfile({
        profileId: 'profile_1',
        grade: 3,
        interests: ['太空'],
        preferredThemes: [],
        preferredGameplayTypes: [],
        readingLevel: 'medium',
      }),
    });

    expect(result.status).toBe('needs_intake');
    expect(result.courseSpec).toBeUndefined();
    expect(result.followUpQuestions).toContainEqual({
      id: 'ask_learning_state',
      field: 'learningGoals',
      prompt: '上一课学生掌握了什么、卡在哪里，或希望下一课强化什么？',
      required: true,
    });
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
      interests: ['太空', '建造'],
      preferredInteraction: ['网格建造'],
      guardianLimits: {
        maxSessionMinutes: 25,
        allowUploadedImages: false,
        allowGeneratedVideo: false,
        contentStrictness: 'strict',
      },
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
