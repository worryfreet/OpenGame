/**
 * @license
 * Copyright 2025 OpenGame Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CourseArchetype } from './schemas.js';

export type SubjectCategory =
  | 'math'
  | 'chinese'
  | 'english'
  | 'science'
  | 'morality'
  | 'art'
  | 'general';

export interface SubjectTaxonomyEntry {
  category: SubjectCategory;
  label: string;
  aliases: string[];
  defaultArchetypes: CourseArchetype[];
  recommendedGameplayTypes: string[];
  firstBatchUnsupported: string[];
}

export const SUBJECT_TAXONOMY: SubjectTaxonomyEntry[] = [
  {
    category: 'math',
    label: '数学',
    aliases: ['数学', 'math', 'mathematics', '算术', '几何'],
    defaultArchetypes: ['course_ui', 'course_grid', 'course_td'],
    recommendedGameplayTypes: ['闯关练习', '网格推理', '经营建造', '塔防复习'],
    firstBatchUnsupported: ['开放物理沙盒'],
  },
  {
    category: 'chinese',
    label: '语文',
    aliases: ['语文', 'chinese', '阅读', '识字', '作文', '词语'],
    defaultArchetypes: ['course_ui', 'course_grid'],
    recommendedGameplayTypes: ['剧情选择', '阅读推理', '排序任务', '词语收集'],
    firstBatchUnsupported: ['长篇自由写作自动评分'],
  },
  {
    category: 'english',
    label: '英语',
    aliases: ['英语', 'english', '单词', '听力', '句型'],
    defaultArchetypes: ['course_ui', 'course_grid'],
    recommendedGameplayTypes: ['听说对话', '单词配对', '剧情任务'],
    firstBatchUnsupported: ['开放语音对话社交'],
  },
  {
    category: 'science',
    label: '科学',
    aliases: ['科学', 'science', '自然', '实验', '电路', '生态'],
    defaultArchetypes: ['course_grid', 'course_ui'],
    recommendedGameplayTypes: ['实验模拟', '分类观察', '流程推演'],
    firstBatchUnsupported: ['高仿真实验物理引擎'],
  },
  {
    category: 'morality',
    label: '道法/常识',
    aliases: ['道法', '道德与法治', '常识', '品德', '社会'],
    defaultArchetypes: ['course_ui'],
    recommendedGameplayTypes: ['情境选择', '案例判断', '任务地图'],
    firstBatchUnsupported: ['敏感现实争议内容'],
  },
  {
    category: 'art',
    label: '艺术/综合',
    aliases: ['艺术', '美术', '音乐', '综合', '劳动', '体育'],
    defaultArchetypes: ['course_ui'],
    recommendedGameplayTypes: ['创作任务', '节奏互动', '作品收集'],
    firstBatchUnsupported: ['复杂音游谱面生成'],
  },
];

export function normalizeSubject(input: string): string {
  return input.trim().toLowerCase();
}

export function resolveSubjectTaxonomy(
  subject: string,
): SubjectTaxonomyEntry {
  const normalizedSubject = normalizeSubject(subject);
  const matched = SUBJECT_TAXONOMY.find((entry) =>
    entry.aliases.some((alias) => normalizedSubject.includes(alias.toLowerCase())),
  );

  if (matched) {
    return matched;
  }

  return {
    category: 'general',
    label: subject.trim() || '综合',
    aliases: [subject],
    defaultArchetypes: ['course_ui'],
    recommendedGameplayTypes: ['剧情任务', '选择判断', '作品收集'],
    firstBatchUnsupported: ['开放式复杂仿真'],
  };
}

export function isKnownSubject(subject: string): boolean {
  return resolveSubjectTaxonomy(subject).category !== 'general';
}

