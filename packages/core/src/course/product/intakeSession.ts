/**
 * @license
 * Copyright 2025 OpenGame Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  CourseSpec,
  ExplanationDepthLevel,
  ExplanationDepthSpec,
  ReadingLevel,
  StudentGrade,
  StyleSpec,
} from '../schemas.js';
import {
  applyGuardianPolicyToCourseSpec,
  type GuardianPolicy,
  type GuardianPolicyIssue,
} from './guardianPolicy.js';
import type { StudentPreferenceProfile } from './preferenceProfile.js';

export type IntakeSessionStatus = 'collecting' | 'ready_for_plan' | 'blocked';
export type IntakeFieldName =
  | 'grade'
  | 'subject'
  | 'topic'
  | 'learningGoals'
  | 'durationMinutes'
  | 'style'
  | 'explanationDepth';

export interface IntakeMissingField {
  field: IntakeFieldName;
  impact: 'high' | 'low';
  reason: string;
}

export interface IntakeQuestion {
  id: string;
  field: IntakeFieldName;
  prompt: string;
  required: boolean;
}

export interface IntakeAssumption {
  field: IntakeFieldName;
  value: unknown;
  reason: string;
}

export interface IntakeSession {
  sessionId: string;
  rawInput: string;
  knownFields: Partial<CourseSpec>;
  missingFields: IntakeMissingField[];
  followUpQuestions: IntakeQuestion[];
  assumptions: IntakeAssumption[];
  confidence: number;
  status: IntakeSessionStatus;
  guardianIssues: GuardianPolicyIssue[];
}

export interface CreateIntakeSessionInput {
  sessionId: string;
  rawInput: string;
  knownFields?: Partial<CourseSpec>;
  preferenceProfile?: StudentPreferenceProfile;
  guardianPolicy?: GuardianPolicy;
}

export function createIntakeSession(
  input: CreateIntakeSessionInput,
): IntakeSession {
  if (!input.sessionId.trim()) {
    throw new Error('IntakeSession 必须包含 sessionId。');
  }

  const extractedFields = mergePreferenceProfile(
    mergeNaturalLanguageFields(input.knownFields ?? {}, input.rawInput),
    input.preferenceProfile,
  );
  const defaultAssumptionFields = collectMissingFields(extractedFields);
  const knownFields = applyLowImpactDefaults(extractedFields);
  const policyResult =
    input.guardianPolicy && isCompleteCourseSpec(knownFields)
      ? applyGuardianPolicyToCourseSpec(knownFields, input.guardianPolicy)
      : undefined;
  const boundedKnownFields = policyResult?.courseSpec ?? knownFields;
  const missingFields = collectMissingFields(boundedKnownFields);
  const followUpQuestions = missingFields
    .filter((field) => field.impact === 'high')
    .map(buildFollowUpQuestion);
  const confidence = calculateConfidence(missingFields);

  return {
    sessionId: input.sessionId,
    rawInput: input.rawInput,
    knownFields: boundedKnownFields,
    missingFields,
    followUpQuestions,
    assumptions: buildAssumptions(boundedKnownFields, defaultAssumptionFields),
    confidence,
    status: resolveStatus(missingFields, policyResult?.issues ?? []),
    guardianIssues: policyResult?.issues ?? [],
  };
}

export function getCourseSpecFromReadyIntake(
  session: IntakeSession,
): CourseSpec {
  if (
    session.status !== 'ready_for_plan' ||
    !isCompleteCourseSpec(session.knownFields)
  ) {
    throw new Error(
      '只有 ready_for_plan 的 IntakeSession 可以转换为 CourseSpec。',
    );
  }

  return session.knownFields;
}

function mergePreferenceProfile(
  knownFields: Partial<CourseSpec>,
  preferenceProfile: StudentPreferenceProfile | undefined,
): Partial<CourseSpec> {
  if (!preferenceProfile) {
    return knownFields;
  }

  return {
    ...knownFields,
    studentProfile: {
      ...knownFields.studentProfile,
      grade: knownFields.studentProfile?.grade ?? preferenceProfile.grade,
      readingLevel:
        knownFields.studentProfile?.readingLevel ??
        preferenceProfile.readingLevel,
      interests:
        knownFields.studentProfile?.interests ?? preferenceProfile.interests,
      preferredInteraction:
        knownFields.studentProfile?.preferredInteraction ??
        preferenceProfile.preferredGameplayTypes,
    },
    styleSpec: knownFields.styleSpec
      ? {
          ...knownFields.styleSpec,
          palette:
            knownFields.styleSpec.palette ??
            preferenceProfile.preferredPalette ??
            [],
        }
      : knownFields.styleSpec,
  };
}

function mergeNaturalLanguageFields(
  knownFields: Partial<CourseSpec>,
  rawInput: string,
): Partial<CourseSpec> {
  const parsed = parseNaturalLanguageInput(rawInput);
  const topic = knownFields.topic ?? parsed.topic;
  const subject = knownFields.subject ?? parsed.subject ?? inferSubject(topic);
  const goals = knownFields.learningGoals ?? buildLearningGoals(topic, subject);
  const grade = knownFields.studentProfile?.grade ?? parsed.grade;
  const interests = knownFields.studentProfile?.interests?.length
    ? knownFields.studentProfile.interests
    : parsed.interests;
  const styleSpec =
    knownFields.styleSpec ??
    (parsed.theme || parsed.referenceImages.length > 0
      ? buildStyleSpec(parsed.theme, parsed.referenceImages)
      : undefined);
  const explanationDepth =
    knownFields.explanationDepth ??
    (topic && goals.length > 0
      ? buildExplanationDepth(parsed.depthLevel, topic, goals)
      : undefined);

  return {
    ...knownFields,
    subject,
    topic,
    learningGoals: goals.length > 0 ? goals : knownFields.learningGoals,
    durationMinutes: knownFields.durationMinutes ?? parsed.durationMinutes,
    studentProfile:
      grade || interests.length > 0 || knownFields.studentProfile
        ? ({
            ...knownFields.studentProfile,
            ...(grade ? { grade } : {}),
            interests,
            readingLevel:
              knownFields.studentProfile?.readingLevel ??
              inferReadingLevel(grade),
          } as CourseSpec['studentProfile'])
        : knownFields.studentProfile,
    styleSpec,
    explanationDepth,
  };
}

function applyLowImpactDefaults(
  knownFields: Partial<CourseSpec>,
): Partial<CourseSpec> {
  return {
    ...knownFields,
    durationMinutes: knownFields.durationMinutes ?? 20,
    studentProfile: knownFields.studentProfile
      ? {
          ...knownFields.studentProfile,
          interests: knownFields.studentProfile.interests ?? [],
          readingLevel:
            knownFields.studentProfile.readingLevel ??
            inferReadingLevel(knownFields.studentProfile.grade),
        }
      : knownFields.studentProfile,
    styleSpec:
      knownFields.styleSpec ??
      buildStyleSpec(knownFields.studentProfile?.interests?.[0], []),
  };
}

function collectMissingFields(
  input: Partial<CourseSpec>,
): IntakeMissingField[] {
  const missing: IntakeMissingField[] = [];

  if (!input.studentProfile?.grade) {
    missing.push(
      buildMissingField('grade', 'high', '缺少年级会影响内容难度和阅读水平。'),
    );
  }
  if (!input.subject?.trim()) {
    missing.push(
      buildMissingField('subject', 'high', '缺少学科无法选择课程目标和玩法。'),
    );
  }
  if (!input.topic?.trim()) {
    missing.push(
      buildMissingField('topic', 'high', '缺少主题无法生成课程主线。'),
    );
  }
  if (!input.learningGoals || input.learningGoals.length === 0) {
    missing.push(
      buildMissingField(
        'learningGoals',
        'high',
        '缺少学习目标无法验证课程闭环。',
      ),
    );
  }
  if (!input.explanationDepth) {
    missing.push(
      buildMissingField(
        'explanationDepth',
        'high',
        '缺少讲解深度无法进入受控生成。',
      ),
    );
  }
  if (!input.durationMinutes) {
    missing.push(
      buildMissingField(
        'durationMinutes',
        'low',
        '缺少时长时可使用默认 20 分钟。',
      ),
    );
  }
  if (!input.styleSpec) {
    missing.push(
      buildMissingField('style', 'low', '缺少风格时可使用清晰明亮默认风格。'),
    );
  }

  return missing;
}

function buildMissingField(
  field: IntakeFieldName,
  impact: IntakeMissingField['impact'],
  reason: string,
): IntakeMissingField {
  return { field, impact, reason };
}

function buildFollowUpQuestion(field: IntakeMissingField): IntakeQuestion {
  const promptByField: Record<IntakeFieldName, string> = {
    grade: '这节课面向几年级学生？',
    subject: '这节课属于哪个学科？',
    topic: '这节课想学习哪个具体主题？',
    learningGoals: '完成课程后，希望学生能掌握什么？',
    explanationDepth: '希望讲解深度是入门、标准、深入还是挑战？',
    durationMinutes: '这节课预计学习多长时间？',
    style: '希望课程使用什么主题或视觉风格？',
  };

  return {
    id: `ask_${field.field}`,
    field: field.field,
    prompt: promptByField[field.field],
    required: field.impact === 'high',
  };
}

function buildAssumptions(
  knownFields: Partial<CourseSpec>,
  missingFields: IntakeMissingField[],
): IntakeAssumption[] {
  const assumptions: IntakeAssumption[] = [];
  const missing = new Set(missingFields.map((field) => field.field));

  if (missing.has('durationMinutes')) {
    assumptions.push({
      field: 'durationMinutes',
      value: knownFields.durationMinutes ?? 20,
      reason: '未提供时长时，产品层默认按 20 分钟课程规划。',
    });
  }

  if (missing.has('style')) {
    assumptions.push({
      field: 'style',
      value: knownFields.styleSpec?.theme ?? '清晰明亮课程风格',
      reason: '低影响风格缺失可由兴趣偏好或默认明亮风格兜底。',
    });
  }

  return assumptions;
}

function calculateConfidence(missingFields: IntakeMissingField[]): number {
  const highImpactCount = missingFields.filter(
    (field) => field.impact === 'high',
  ).length;
  const lowImpactCount = missingFields.length - highImpactCount;
  return Math.max(
    0,
    Math.min(1, 1 - highImpactCount * 0.22 - lowImpactCount * 0.08),
  );
}

function resolveStatus(
  missingFields: IntakeMissingField[],
  guardianIssues: GuardianPolicyIssue[],
): IntakeSessionStatus {
  if (guardianIssues.some((issue) => issue.severity === 'error')) {
    return 'blocked';
  }
  if (missingFields.some((field) => field.impact === 'high')) {
    return 'collecting';
  }
  return 'ready_for_plan';
}

function isCompleteCourseSpec(input: Partial<CourseSpec>): input is CourseSpec {
  return Boolean(
    input.subject &&
    input.topic &&
    input.learningGoals?.length &&
    input.durationMinutes &&
    input.studentProfile?.grade &&
    input.studentProfile.interests &&
    input.styleSpec &&
    input.explanationDepth,
  );
}

interface ParsedNaturalLanguageInput {
  grade?: StudentGrade;
  subject?: string;
  topic?: string;
  interests: string[];
  theme?: string;
  durationMinutes?: number;
  depthLevel: ExplanationDepthLevel;
  referenceImages: string[];
}

function parseNaturalLanguageInput(
  rawInput: string,
): ParsedNaturalLanguageInput {
  const normalized = rawInput.trim();
  const grade = parseGrade(normalized);
  const subject = parseSubject(normalized);
  const topic = parseTopic(normalized, subject);
  const interests = parseInterests(normalized);
  const theme = parseTheme(normalized, interests);

  return {
    grade,
    subject,
    topic,
    interests,
    theme,
    durationMinutes: parseDuration(normalized),
    depthLevel: parseDepthLevel(normalized),
    referenceImages: parseReferenceImages(normalized),
  };
}

function parseGrade(input: string): StudentGrade | undefined {
  const match = input.match(
    /(一|二|三|四|五|六|七|八|九|十|十一|十二|1[0-2]|[1-9]|初一|初二|初三|高一|高二|高三)\s*年级|初一|初二|初三|高一|高二|高三/,
  );
  if (!match) return undefined;
  return toGrade(match[1] ?? match[0]);
}

function toGrade(value: string): StudentGrade | undefined {
  const map: Record<string, StudentGrade> = {
    一: 1,
    '1': 1,
    二: 2,
    '2': 2,
    三: 3,
    '3': 3,
    四: 4,
    '4': 4,
    五: 5,
    '5': 5,
    六: 6,
    '6': 6,
    七: 7,
    '7': 7,
    初一: 7,
    八: 8,
    '8': 8,
    初二: 8,
    九: 9,
    '9': 9,
    初三: 9,
    十: 10,
    '10': 10,
    高一: 10,
    十一: 11,
    '11': 11,
    高二: 11,
    十二: 12,
    '12': 12,
    高三: 12,
  };
  return map[value];
}

function parseSubject(input: string): string | undefined {
  const subjects = [
    '数学',
    '语文',
    '英语',
    '科学',
    '道法',
    '艺术',
    '美术',
    '音乐',
  ];
  return subjects.find((subject) => input.includes(subject));
}

function inferSubject(topic: string | undefined): string | undefined {
  if (!topic) return undefined;
  if (
    containsAny(topic, [
      '面积',
      '周长',
      '分数',
      '小数',
      '乘法',
      '除法',
      '单位',
      '函数',
      '方程',
      '代数',
    ])
  ) {
    return '数学';
  }
  if (containsAny(topic, ['阅读', '作文', '成语', '古诗', '修辞'])) {
    return '语文';
  }
  if (containsAny(topic, ['单词', '句型', '自然拼读'])) {
    return '英语';
  }
  if (containsAny(topic, ['植物', '动物', '生态', '电路', '实验'])) {
    return '科学';
  }
  return undefined;
}

function parseTopic(
  input: string,
  subject: string | undefined,
): string | undefined {
  const knownTopics = [
    '面积和周长',
    '面积',
    '周长',
    '分数',
    '小数',
    '一元二次函数',
    '二次函数',
    '一次函数',
    '函数',
    '一元二次方程',
    '方程',
    '乘法',
    '除法',
    '单位换算',
    '阅读理解',
    '古诗',
    '单词',
    '生态系统',
    '食物链',
  ];
  const topic = knownTopics.find((candidate) => input.includes(candidate));
  if (topic) return topic;

  const afterSubject = subject
    ? input.match(new RegExp(`${escapeRegExp(subject)}([^，。,.；;]+)`))?.[1]
    : undefined;
  const compact = afterSubject
    ?.replace(/做成.*$/, '')
    .replace(/风格.*$/, '')
    .trim();
  return compact || undefined;
}

function buildLearningGoals(
  topic: string | undefined,
  subject: string | undefined,
): string[] {
  if (!topic) return [];
  if (topic.includes('面积')) {
    return ['理解面积含义', '区分面积和周长'];
  }
  if (topic.includes('分数')) {
    return ['理解分数表示的整体与部分关系', '能比较简单分数大小'];
  }
  if (topic.includes('单位')) {
    return ['理解不同单位的含义', '能完成常见单位换算'];
  }
  if (topic.includes('二次函数')) {
    return ['理解二次函数图像特征', '能判断开口方向、顶点和对称轴'];
  }
  if (topic.includes('函数')) {
    return ['理解函数关系', '能结合图像和表达式解决问题'];
  }
  if (topic.includes('方程')) {
    return ['理解方程的解和等式关系', '能用方程解决问题'];
  }
  if (subject === '英语') {
    return [`理解${topic}的核心表达`, `能在情境中使用${topic}`];
  }
  return [`理解${topic}的核心概念`, `能应用${topic}完成练习`];
}

function parseInterests(input: string): string[] {
  const interests = [
    '太空',
    '星球',
    '恐龙',
    '机器人',
    '侦探',
    '海洋',
    '动物',
    '魔法',
    '足球',
    '建造',
  ];
  return unique(interests.filter((interest) => input.includes(interest)));
}

function parseTheme(input: string, interests: string[]): string | undefined {
  const styledInterest = interests.find((interest) =>
    input.includes(`${interest}风格`),
  );
  if (styledInterest) return styledInterest;

  const styleMatch = input.match(
    /([一二三四五六1-6]年级)?[^，。,.；;]*?([\u4e00-\u9fa5A-Za-z0-9]{1,12})\s*风格/,
  );
  if (styleMatch?.[2]) return styleMatch[2];
  const themeMatch = input.match(/做成([^，。,.；;]+)/);
  if (themeMatch) return themeMatch[1].replace(/风格$/, '').trim();
  return interests[0];
}

function parseDuration(input: string): number | undefined {
  const match = input.match(/(\d{1,2})\s*分钟/);
  if (!match) return undefined;
  const minutes = Number.parseInt(match[1], 10);
  if (Number.isNaN(minutes)) return undefined;
  return Math.min(60, Math.max(5, minutes));
}

function parseDepthLevel(input: string): ExplanationDepthLevel {
  if (containsAny(input, ['挑战', '竞赛', '拔高'])) return 'challenge';
  if (containsAny(input, ['深入', '深度', '拓展'])) return 'deep';
  if (containsAny(input, ['入门', '简单', '基础'])) return 'intro';
  return 'standard';
}

function parseReferenceImages(input: string): string[] {
  const matches = input.match(/https?:\/\/[^\s，。]+/g);
  return matches ? unique(matches) : [];
}

function buildStyleSpec(
  theme: string | undefined,
  referenceImages: string[] = [],
): StyleSpec {
  const safeTheme = theme?.trim() || '清晰明亮课程风格';
  const palette =
    safeTheme.includes('太空') || safeTheme.includes('星球')
      ? ['#0F172A', '#38BDF8', '#FACC15']
      : ['#2563EB', '#F97316', '#F8FAFC'];

  return {
    theme: safeTheme,
    palette,
    ...(referenceImages.length > 0 ? { referenceImages } : {}),
    visualMood: '明亮清晰',
    characterStyle: '友好的课程引导员',
    uiDensity: 'medium',
    forbidden: ['恐怖', '血腥', '抽卡', '知名 IP 仿作'],
  };
}

function buildExplanationDepth(
  depthLevel: ExplanationDepthLevel,
  topic: string,
  learningGoals: string[],
): ExplanationDepthSpec {
  const goalConcepts = learningGoals.map((goal) =>
    goal
      .replace(/^理解/, '')
      .replace(/^区分/, '')
      .replace(/^能/, '')
      .replace(/的核心概念$/, '')
      .trim(),
  );
  const concepts =
    depthLevel === 'intro' ? goalConcepts.slice(0, 1) : goalConcepts;

  return {
    depthLevel,
    priorKnowledgeCheck: depthLevel !== 'intro',
    conceptLayers: concepts.map((concept, index) => ({
      concept: concept || `${topic}概念${index + 1}`,
      whyItMatters: `帮助学生掌握${topic}并迁移到真实练习。`,
      misconceptionToAddress: buildMisconceptions(topic, concept),
      representation: inferRepresentation(topic),
    })),
    examplePlan: buildExamplePlan(depthLevel),
    feedbackDepth: depthLevel === 'intro' ? 'short_reason' : 'step_by_step',
    masteryEvidence: learningGoals.map(
      (goal) => `能${goal.replace(/^能/, '')}`,
    ),
  };
}

function buildMisconceptions(topic: string, concept: string): string[] {
  if (topic.includes('面积')) {
    return ['把面积和周长混淆', '忽略面积单位'];
  }
  if (topic.includes('单位')) {
    return ['单位进率混淆'];
  }
  return [`误解${concept || topic}的关键条件`];
}

function buildExamplePlan(
  depthLevel: ExplanationDepthLevel,
): ExplanationDepthSpec['examplePlan'] {
  if (depthLevel === 'intro') {
    return {
      workedExamples: 1,
      guidedPractice: 2,
      independentChallenges: 0,
      transferTasks: 0,
    };
  }
  if (depthLevel === 'deep') {
    return {
      workedExamples: 2,
      guidedPractice: 2,
      independentChallenges: 2,
      transferTasks: 1,
    };
  }
  if (depthLevel === 'challenge') {
    return {
      workedExamples: 2,
      guidedPractice: 2,
      independentChallenges: 3,
      transferTasks: 2,
    };
  }
  return {
    workedExamples: 2,
    guidedPractice: 2,
    independentChallenges: 1,
    transferTasks: 1,
  };
}

function inferRepresentation(
  topic: string,
): ExplanationDepthSpec['conceptLayers'][number]['representation'] {
  if (containsAny(topic, ['面积', '周长', '分数', '单位']))
    return 'visual_model';
  if (containsAny(topic, ['实验', '生态', '电路'])) return 'experiment';
  if (containsAny(topic, ['阅读', '古诗', '作文'])) return 'story';
  return 'case';
}

function inferReadingLevel(grade: StudentGrade | undefined): ReadingLevel {
  if (!grade || grade <= 2) return 'low';
  if (grade <= 6) return 'medium';
  return 'high';
}

function containsAny(input: string, keywords: string[]): boolean {
  return keywords.some((keyword) => input.includes(keyword));
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
