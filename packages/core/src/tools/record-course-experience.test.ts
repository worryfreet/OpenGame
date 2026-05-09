/**
 * @license
 * Copyright 2025 OpenGame Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import {
  createTemplateExperienceStore,
  type RawTemplateExperienceInput,
} from '../course/experience/templateExperienceStore.js';
import {
  RecordCourseExperienceTool,
  recordCourseExperience,
} from './record-course-experience.js';

describe('RecordCourseExperienceTool', () => {
  it('写入成功经验时只保留结构化模式，不保留敏感原文', () => {
    const result = recordCourseExperience({
      record: buildSuccessRecord({
        studentName: '小明',
        rawConversation: '学生完整对话不应持久化',
      }),
      query: {
        subject: '数学',
        topicTags: ['面积'],
        courseArchetype: 'course_grid',
      },
    });

    expect(result.store.patterns).toHaveLength(1);
    expect(result.store.patterns[0]?.kind).toBe('success');
    expect(JSON.stringify(result.store)).not.toContain('小明');
    expect(JSON.stringify(result.store)).not.toContain('完整对话');
    expect(result.matches).toHaveLength(1);
  });

  it('写入失败经验时返回相似失败模式', () => {
    const store = createTemplateExperienceStore([
      buildFailureRecord({ id: 'failure_existing' }),
    ]);
    const result = recordCourseExperience({
      store,
      record: buildFailureRecord({ id: 'failure_new' }),
      query: {
        subject: '数学',
        topicTags: ['面积'],
        courseArchetype: 'course_grid',
        gameplayType: '选择题答题',
      },
    });

    expect(result.store.patterns).toHaveLength(2);
    expect(
      result.matches.some((match) => match.pattern.kind === 'failure'),
    ).toBe(true);
  });

  it('工具执行输出经验库标签', async () => {
    const tool = new RecordCourseExperienceTool();

    const result = await tool.buildAndExecute(
      {
        record: buildSuccessRecord(),
        query: {
          subject: '数学',
          topicTags: ['面积'],
          courseArchetype: 'course_grid',
        },
      },
      new AbortController().signal,
    );

    expect(result.error).toBeUndefined();
    expect(result.llmContent).toContain('<course-experience-record>');
    expect(result.returnDisplay).toContain('经验库记录完成');
  });
});

function buildSuccessRecord(
  overrides: Partial<RawTemplateExperienceInput> = {},
): RawTemplateExperienceInput & { qualityScore: number } {
  return {
    id: 'success_area_grid',
    kind: 'success',
    subject: '数学',
    topicTags: ['面积', '公式来源'],
    grade: 4,
    courseArchetype: 'course_grid',
    gameplayType: '模块装配',
    learningGoalTags: ['公式来源', '情境应用'],
    styleTags: ['太空基地'],
    insight: '模块装配能把面积公式来源转成可观察操作。',
    qualityScore: 86,
    ...overrides,
  };
}

function buildFailureRecord(
  overrides: Partial<RawTemplateExperienceInput> = {},
): RawTemplateExperienceInput & { failureReasonTags: string[] } {
  return {
    id: 'failure_area_quiz',
    kind: 'failure',
    subject: '数学',
    topicTags: ['面积'],
    grade: 4,
    courseArchetype: 'course_grid',
    gameplayType: '选择题答题',
    learningGoalTags: ['公式来源'],
    styleTags: ['太空基地'],
    insight: '只做选择题会让面积公式退化为背诵。',
    failureReasonTags: ['浅层问答', '缺少状态变化'],
    ...overrides,
  };
}
