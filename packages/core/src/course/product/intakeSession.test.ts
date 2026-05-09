/**
 * @license
 * Copyright 2025 OpenGame Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import type { CourseSpec } from '../schemas.js';
import {
  applyGuardianPolicyToCourseSpec,
  buildDefaultGuardianPolicy,
} from './guardianPolicy.js';
import {
  createIntakeSession,
  getCourseSpecFromReadyIntake,
} from './intakeSession.js';
import {
  createEmptyLearningState,
  updateLearningStateFromReport,
} from './learningState.js';
import {
  sanitizePreferenceForPersistence,
  SENSITIVE_PREFERENCE_FIELDS,
} from './preferenceProfile.js';

describe('MVP 2.0 产品输入边界', () => {
  it('从自然语言“三年级面积太空风格”补全 CourseSpec 核心字段', () => {
    const session = createIntakeSession({
      sessionId: 'session_nl_area_space',
      rawInput: '三年级面积太空风格',
    });

    expect(session.status).toBe('ready_for_plan');
    expect(session.knownFields.studentProfile?.grade).toBe(3);
    expect(session.knownFields.subject).toBe('数学');
    expect(session.knownFields.topic).toBe('面积');
    expect(session.knownFields.learningGoals).toEqual([
      '理解面积含义',
      '区分面积和周长',
    ]);
    expect(session.knownFields.styleSpec?.theme).toBe('太空');
    expect(session.followUpQuestions).toEqual([]);
    expect(session.assumptions).toContainEqual({
      field: 'durationMinutes',
      value: 20,
      reason: '未提供时长时，产品层默认按 20 分钟课程规划。',
    });

    const courseSpec = getCourseSpecFromReadyIntake(session);
    expect(courseSpec.durationMinutes).toBe(20);
    expect(courseSpec.explanationDepth.conceptLayers).toHaveLength(2);
  });

  it('缺少年级时保持 collecting 并生成追问', () => {
    const session = createIntakeSession({
      sessionId: 'session_missing_grade',
      rawInput: '我想学面积，做成太空风格',
    });

    expect(session.status).toBe('collecting');
    expect(session.missingFields).toContainEqual({
      field: 'grade',
      impact: 'high',
      reason: '缺少年级会影响内容难度和阅读水平。',
    });
    expect(session.followUpQuestions).toContainEqual({
      id: 'ask_grade',
      field: 'grade',
      prompt: '这节课面向小学几年级学生？',
      required: true,
    });
  });

  it('缺少学科时必须追问，不能进入 CourseSpec', () => {
    const session = createIntakeSession({
      sessionId: 'session_missing_subject',
      rawInput: '三年级面积太空风格',
      knownFields: {
        ...buildCourseSpec(),
        subject: '',
      },
    });

    expect(session.status).toBe('collecting');
    expect(
      session.followUpQuestions.map((question) => question.field),
    ).toContain('subject');
    expect(() => getCourseSpecFromReadyIntake(session)).toThrow(
      '只有 ready_for_plan 的 IntakeSession 可以转换为 CourseSpec。',
    );
  });

  it('低影响字段缺失时记录默认假设而不是追问', () => {
    const session = createIntakeSession({
      sessionId: 'session_low_impact',
      rawInput: '三年级数学面积，学会区分面积和周长',
      knownFields: {
        subject: '数学',
        topic: '面积',
        learningGoals: ['理解面积含义'],
        studentProfile: {
          grade: 3,
          interests: ['太空'],
        },
        explanationDepth: buildCourseSpec().explanationDepth,
      } as Partial<CourseSpec>,
    });

    expect(session.status).toBe('ready_for_plan');
    expect(session.followUpQuestions).toEqual([]);
    expect(session.knownFields.durationMinutes).toBe(20);
    expect(session.knownFields.styleSpec?.theme).toBe('太空');
    expect(session.assumptions).toContainEqual({
      field: 'durationMinutes',
      value: 20,
      reason: '未提供时长时，产品层默认按 20 分钟课程规划。',
    });
  });

  it('家长禁用上传图片时在 IntakeSession 中降级参考图', () => {
    const session = createIntakeSession({
      sessionId: 'session_policy_reference',
      rawInput: '三年级面积太空风格 https://example.com/reference.png',
      guardianPolicy: {
        ...buildDefaultGuardianPolicy('profile_1'),
        allowUploadedImages: false,
        maxSessionMinutes: 15,
      },
    });

    expect(session.status).toBe('ready_for_plan');
    expect(session.knownFields.durationMinutes).toBe(15);
    expect(session.knownFields.styleSpec?.referenceImages).toBeUndefined();
    expect(session.guardianIssues.map((issue) => issue.path)).toEqual([
      '/durationMinutes',
      '/styleSpec/referenceImages',
    ]);
  });

  it('家长禁用上传图片时移除参考图并写入限制', () => {
    const policy = {
      ...buildDefaultGuardianPolicy('profile_1'),
      allowUploadedImages: false,
      allowGeneratedVideo: false,
      maxSessionMinutes: 15,
    };
    const result = applyGuardianPolicyToCourseSpec(
      {
        ...buildCourseSpec(),
        durationMinutes: 30,
        styleSpec: {
          ...buildCourseSpec().styleSpec,
          referenceImages: ['https://example.com/child-reference.png'],
        },
      },
      policy,
    );

    expect(result.courseSpec?.durationMinutes).toBe(15);
    expect(result.courseSpec?.styleSpec.referenceImages).toBeUndefined();
    expect(result.courseSpec?.studentProfile.guardianLimits).toEqual({
      maxSessionMinutes: 15,
      allowUploadedImages: false,
      allowGeneratedVideo: false,
      contentStrictness: 'strict',
    });
    expect(result.issues.map((issue) => issue.path)).toEqual([
      '/durationMinutes',
      '/styleSpec/referenceImages',
    ]);
  });

  it('偏好持久化不会保留敏感字段', () => {
    const persisted = sanitizePreferenceForPersistence({
      profileId: 'profile_1',
      grade: 3,
      interests: ['太空', '太空', '建造'],
      preferredThemes: ['星际基地'],
      preferredGameplayTypes: ['拖拽分箱'],
      readingLevel: 'medium',
      studentName: '小明',
      avatarUri: 'file:///avatar.png',
      voiceSampleUri: 'file:///voice.wav',
      rawConversation: '完整对话',
      preciseTraits: ['精确画像'],
    });

    expect(persisted).toEqual({
      profileId: 'profile_1',
      grade: 3,
      interests: ['太空', '建造'],
      preferredThemes: ['星际基地'],
      preferredPalette: undefined,
      preferredGameplayTypes: ['拖拽分箱'],
      readingLevel: 'medium',
      ttsPreference: undefined,
    });
    for (const field of SENSITIVE_PREFERENCE_FIELDS) {
      expect(field in persisted).toBe(false);
    }
  });

  it('学习报告只更新学习状态，不污染偏好模型', () => {
    const state = updateLearningStateFromReport(
      createEmptyLearningState('profile_1'),
      {
        subject: '数学',
        weakPoints: ['单位混淆'],
        masteredGoals: ['理解面积含义'],
        misconceptionTags: ['area_unit_confusion'],
        coursePackageId: 'course_pkg_1',
      },
    );

    expect(state.subjectStates).toEqual([
      {
        subject: '数学',
        weakPoints: ['单位混淆'],
        masteredGoals: ['理解面积含义'],
        misconceptionTags: ['area_unit_confusion'],
        lastCoursePackageId: 'course_pkg_1',
      },
    ]);
    expect('interests' in state.subjectStates[0]).toBe(false);
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
      age: 9,
      readingLevel: 'medium',
      interests: ['太空', '建造'],
      guardianLimits: {
        maxSessionMinutes: 25,
        allowUploadedImages: true,
        allowGeneratedVideo: true,
        contentStrictness: 'strict',
      },
    },
    styleSpec: {
      theme: '太空基地',
      palette: ['#1F2937', '#F59E0B'],
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
      masteryEvidence: ['能解释面积和周长的区别'],
    },
  };
}
