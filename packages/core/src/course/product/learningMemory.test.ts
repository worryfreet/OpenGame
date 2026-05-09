/**
 * @license
 * Copyright 2025 OpenGame Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import {
  createEmptyLearningState,
  deleteLearningStateForProfile,
  deleteProfileLearningMemory,
  sanitizeLearningReportForPersistence,
  updateLearningStateFromReport,
} from './learningState.js';
import {
  createPreferenceProfile,
  deletePreferenceProfileForProfile,
  sanitizePreferenceForPersistence,
  SENSITIVE_PREFERENCE_FIELDS,
  updatePreferenceProfile,
} from './preferenceProfile.js';

describe('MVP 2.0 偏好记忆与学习状态记忆', () => {
  it('偏好更新只影响风格、玩法倾向和交互偏好，不写入学习弱点', () => {
    const profile = updatePreferenceProfile(
      createPreferenceProfile({
        profileId: 'profile_1',
        grade: 3,
        interests: ['太空'],
        preferredThemes: ['星际基地'],
        preferredPalette: ['#1F2937'],
        preferredGameplayTypes: ['card_match'],
        readingLevel: 'medium',
      }),
      {
        profileId: 'profile_1',
        interests: ['建造', '太空'],
        preferredThemes: ['月球实验室'],
        preferredPalette: ['#F59E0B'],
        preferredGameplayTypes: ['drag_sort'],
        ttsPreference: {
          voice: ' warm_child ',
          speed: 0.95,
          emotion: 'encouraging',
        },
      },
    );

    expect(profile).toEqual({
      profileId: 'profile_1',
      grade: 3,
      interests: ['太空', '建造'],
      preferredThemes: ['星际基地', '月球实验室'],
      preferredPalette: ['#1F2937', '#F59E0B'],
      preferredGameplayTypes: ['card_match', 'drag_sort'],
      readingLevel: 'medium',
      ttsPreference: {
        voice: 'warm_child',
        speed: 0.95,
        emotion: 'encouraging',
      },
    });
    expect('weakPoints' in profile).toBe(false);
    expect('misconceptionTags' in profile).toBe(false);
  });

  it('学习报告中的错因会累积到 LearningState.misconceptionTags', () => {
    const firstState = updateLearningStateFromReport(
      createEmptyLearningState('profile_1'),
      {
        profileId: 'profile_1',
        subject: '数学',
        weakPoints: ['单位混淆'],
        masteredGoals: ['理解面积含义'],
        misconceptionTags: ['area_unit_confusion'],
        hintUsageCount: 2,
        completionRate: 0.8,
        coursePackageId: 'course_pkg_1',
      },
    );
    const nextState = updateLearningStateFromReport(firstState, {
      profileId: 'profile_1',
      subject: '数学',
      weakPoints: ['单位混淆', '公式套用'],
      masteredGoals: ['区分面积和周长'],
      misconceptionTags: ['area_unit_confusion', 'formula_overfit'],
      hintUsageCount: 1,
      completionRate: 0.9,
      coursePackageId: 'course_pkg_2',
    });

    expect(nextState.subjectStates).toEqual([
      {
        subject: '数学',
        weakPoints: ['单位混淆', '公式套用'],
        masteredGoals: ['理解面积含义', '区分面积和周长'],
        misconceptionTags: ['area_unit_confusion', 'formula_overfit'],
        hintUsageCount: 3,
        completionRate: 0.9,
        lastCoursePackageId: 'course_pkg_2',
      },
    ]);
  });

  it('偏好更新不会修改学习状态，学习状态更新也不会修改偏好', () => {
    const profile = createPreferenceProfile({
      profileId: 'profile_1',
      grade: 4,
      interests: ['机器人'],
      preferredThemes: ['工厂'],
      preferredGameplayTypes: ['path_planning'],
      readingLevel: 'high',
    });
    const state = createEmptyLearningState('profile_1');

    const updatedProfile = updatePreferenceProfile(profile, {
      profileId: 'profile_1',
      preferredThemes: ['海底基地'],
    });
    const updatedState = updateLearningStateFromReport(state, {
      profileId: 'profile_1',
      subject: '科学',
      weakPoints: ['变量控制'],
      misconceptionTags: ['variable_control_missing'],
    });

    expect(updatedState).toEqual({
      profileId: 'profile_1',
      subjectStates: [
        {
          subject: '科学',
          weakPoints: ['变量控制'],
          masteredGoals: [],
          misconceptionTags: ['variable_control_missing'],
        },
      ],
    });
    expect(updatedProfile.preferredThemes).toEqual(['工厂', '海底基地']);
    expect(profile.preferredThemes).toEqual(['工厂']);
    expect(state.subjectStates).toEqual([]);
  });

  it('持久化偏好和学习报告时移除完整对话、真实姓名和原始输入', () => {
    const persistedProfile = sanitizePreferenceForPersistence({
      profileId: 'profile_1',
      grade: 3,
      interests: ['太空', '太空'],
      preferredThemes: ['星际基地'],
      preferredGameplayTypes: ['拖拽分箱'],
      readingLevel: 'medium',
      studentName: '小明',
      avatarUri: 'file:///avatar.png',
      voiceSampleUri: 'file:///voice.wav',
      rawConversation: '完整对话',
      preciseTraits: ['精确画像'],
    });
    const persistedReport = sanitizeLearningReportForPersistence({
      profileId: ' profile_1 ',
      subject: ' 数学 ',
      weakPoints: [' 单位混淆 ', '单位混淆'],
      masteredGoals: ['理解面积含义'],
      misconceptionTags: ['area_unit_confusion'],
      hintUsageCount: 2,
      completionRate: 0.8,
      coursePackageId: ' course_pkg_1 ',
      rawTranscript: '逐字学习过程',
      rawStudentInput: '学生原始输入',
      studentName: '小明',
    });

    expect(persistedProfile.interests).toEqual(['太空']);
    for (const field of SENSITIVE_PREFERENCE_FIELDS) {
      expect(field in persistedProfile).toBe(false);
    }
    expect(persistedReport).toEqual({
      profileId: 'profile_1',
      subject: '数学',
      weakPoints: ['单位混淆'],
      masteredGoals: ['理解面积含义'],
      misconceptionTags: ['area_unit_confusion'],
      hintUsageCount: 2,
      completionRate: 0.8,
      coursePackageId: 'course_pkg_1',
    });
    expect('rawTranscript' in persistedReport).toBe(false);
    expect('rawStudentInput' in persistedReport).toBe(false);
    expect('studentName' in persistedReport).toBe(false);
  });

  it('数据删除调用能清除 profile 关联偏好和学习状态', () => {
    const preference = createPreferenceProfile({
      profileId: 'profile_1',
      grade: 3,
      interests: ['太空'],
      preferredThemes: [],
      preferredGameplayTypes: [],
      readingLevel: 'medium',
    });
    const learningState = updateLearningStateFromReport(
      createEmptyLearningState('profile_1'),
      {
        profileId: 'profile_1',
        subject: '数学',
        misconceptionTags: ['area_unit_confusion'],
      },
    );

    expect(
      deletePreferenceProfileForProfile(preference, 'profile_1'),
    ).toBeUndefined();
    expect(
      deleteLearningStateForProfile(learningState, 'profile_1'),
    ).toBeUndefined();
    expect(
      deleteProfileLearningMemory(
        {
          preferences: [preference, { profileId: 'profile_2' }],
          learningStates: [
            learningState,
            createEmptyLearningState('profile_2'),
          ],
        },
        'profile_1',
      ),
    ).toEqual({
      preferences: [{ profileId: 'profile_2' }],
      learningStates: [createEmptyLearningState('profile_2')],
    });
  });

  it('拒绝跨 profile 写入偏好或学习状态', () => {
    const profile = createPreferenceProfile({
      profileId: 'profile_1',
      grade: 3,
      interests: [],
      preferredThemes: [],
      preferredGameplayTypes: [],
      readingLevel: 'medium',
    });

    expect(() =>
      updatePreferenceProfile(profile, {
        profileId: 'profile_2',
        preferredThemes: ['海底基地'],
      }),
    ).toThrow('偏好记忆更新必须使用相同的 profileId。');
    expect(() =>
      updateLearningStateFromReport(createEmptyLearningState('profile_1'), {
        profileId: 'profile_2',
        subject: '数学',
      }),
    ).toThrow('学习报告 profileId 必须与 LearningState 一致。');
  });
});
