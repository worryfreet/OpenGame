/**
 * @license
 * Copyright 2025 OpenGame Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import {
  createTemplateExperienceStore,
  findSimilarTemplateExperiences,
  sanitizeTemplateExperienceForPersistence,
  SENSITIVE_EXPERIENCE_FIELDS,
} from './templateExperienceStore.js';
import {
  findSimilarSuccessfulPatterns,
  recordSuccessfulPattern,
} from './successfulPatternIndex.js';
import {
  findSimilarFailurePatterns,
  recordFailurePattern,
} from './failurePatternIndex.js';

describe('MVP 3.0 模板经验库', () => {
  it('写入成功和失败经验时只保存结构化摘要', () => {
    const emptyStore = createTemplateExperienceStore();
    const successStore = recordSuccessfulPattern(emptyStore, {
      id: 'success_area_grid',
      subject: '数学',
      topicTags: ['面积', '网格'],
      grade: 3,
      courseArchetype: 'course_grid',
      gameplayType: '网格建造',
      learningGoalTags: ['面积含义'],
      styleTags: ['太空'],
      qualityScore: 86,
      insight: '面积概念适合用覆盖格子的状态变化表达。',
      studentName: '小明',
      rawStudentInput: '我想学面积',
    });
    const fullStore = recordFailurePattern(successStore, {
      id: 'failure_quiz_skin',
      subject: '数学',
      topicTags: ['面积'],
      grade: 3,
      courseArchetype: 'course_ui',
      gameplayType: '静态问答',
      learningGoalTags: ['面积含义'],
      styleTags: ['太空'],
      failureReasonTags: ['skin_quiz', 'no_state_change'],
      repairActionTags: ['rewrite_plan'],
      insight: '只做答题会让面积概念无法影响玩法状态。',
      rawConversation: '完整对话',
      avatarUri: 'file:///avatar.png',
    });

    expect(fullStore.patterns).toHaveLength(2);
    expect(fullStore.patterns[0]).toEqual(
      expect.objectContaining({
        kind: 'success',
        outcomeTags: ['quality:86'],
      }),
    );
    expect(fullStore.patterns[1]).toEqual(
      expect.objectContaining({
        kind: 'failure',
        outcomeTags: ['skin_quiz', 'no_state_change', 'rewrite_plan'],
      }),
    );
    for (const pattern of fullStore.patterns) {
      for (const field of SENSITIVE_EXPERIENCE_FIELDS) {
        expect(field in pattern).toBe(false);
      }
    }
  });

  it('隐私清洗会移除学生姓名、头像、语音样本、完整对话和原始输入', () => {
    const persisted = sanitizeTemplateExperienceForPersistence({
      id: 'success_fraction',
      kind: 'success',
      subject: '数学',
      topicTags: ['分数'],
      grade: 4,
      courseArchetype: 'course_grid',
      gameplayType: '分数拼图',
      learningGoalTags: ['等值分数'],
      styleTags: ['料理'],
      outcomeTags: ['quality:82'],
      insight: '把等值分数转成拼图覆盖更容易形成可观察证据。',
      studentName: '小红',
      avatarUri: 'file:///avatar.png',
      voiceSampleUri: 'file:///voice.wav',
      rawConversation: '完整对话',
      rawStudentInput: '学生原始输入',
      fullDialogue: '逐字对话',
    });

    expect(persisted).toEqual({
      id: 'success_fraction',
      kind: 'success',
      subject: '数学',
      topicTags: ['分数'],
      gradeBand: 'middle_primary',
      courseArchetype: 'course_grid',
      gameplayType: '分数拼图',
      learningGoalTags: ['等值分数'],
      styleTags: ['料理'],
      outcomeTags: ['quality:82'],
      insight: '把等值分数转成拼图覆盖更容易形成可观察证据。',
      createdAtIso: expect.any(String),
    });
  });

  it('按学科、年级段、玩法和标签进行相似检索', () => {
    const store = createTemplateExperienceStore([
      {
        id: 'success_area_grid',
        kind: 'success',
        subject: '数学',
        topicTags: ['面积', '网格'],
        grade: 3,
        courseArchetype: 'course_grid',
        gameplayType: '网格建造',
        learningGoalTags: ['面积含义', '单位覆盖'],
        styleTags: ['太空'],
        outcomeTags: ['quality:86'],
        insight: '网格覆盖能自然表达面积状态。',
      },
      {
        id: 'success_science_td',
        kind: 'success',
        subject: '科学',
        topicTags: ['生态'],
        grade: 5,
        courseArchetype: 'course_td',
        gameplayType: '塔防调参',
        learningGoalTags: ['变量控制'],
        styleTags: ['森林'],
        outcomeTags: ['quality:84'],
        insight: '变量控制适合用波次调参表达。',
      },
      {
        id: 'failure_area_quiz',
        kind: 'failure',
        subject: '数学',
        topicTags: ['面积'],
        grade: 3,
        courseArchetype: 'course_ui',
        gameplayType: '静态问答',
        learningGoalTags: ['面积含义'],
        styleTags: ['太空'],
        outcomeTags: ['skin_quiz'],
        insight: '静态问答缺少面积状态变化。',
      },
    ]);

    const allMatches = findSimilarTemplateExperiences(store, {
      subject: '数学',
      topicTags: ['面积'],
      grade: 3,
      courseArchetype: 'course_grid',
      gameplayType: '网格建造',
      learningGoalTags: ['面积含义'],
      styleTags: ['太空'],
      minimumScore: 0,
    });
    const successMatches = findSimilarSuccessfulPatterns(store, {
      subject: '数学',
      topicTags: ['面积'],
      grade: 3,
      courseArchetype: 'course_grid',
      gameplayType: '网格建造',
      learningGoalTags: ['面积含义'],
      minimumScore: 0,
    });
    const failureMatches = findSimilarFailurePatterns(store, {
      subject: '数学',
      topicTags: ['面积'],
      grade: 3,
      outcomeTags: ['skin_quiz'],
      minimumScore: 0,
    });

    expect(allMatches[0].pattern.id).toBe('success_area_grid');
    expect(allMatches[0].similarity).toBeGreaterThan(0.9);
    expect(successMatches.map((match) => match.pattern.id)).toEqual([
      'success_area_grid',
      'success_science_td',
    ]);
    expect(failureMatches[0].pattern.id).toBe('failure_area_quiz');
    expect(
      failureMatches.every((match) => match.pattern.kind === 'failure'),
    ).toBe(true);
  });
});
