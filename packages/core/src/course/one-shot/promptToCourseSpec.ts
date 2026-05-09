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
import { validateCourseSpec } from '../validation.js';
import {
  applyGuardianPolicyToCourseSpec,
  type GuardianPolicy,
  type GuardianPolicyIssue,
} from '../product/guardianPolicy.js';
import {
  createIntakeSession,
  getCourseSpecFromReadyIntake,
  type IntakeAssumption,
  type IntakeQuestion,
} from '../product/intakeSession.js';
import type { LearningState } from '../product/learningState.js';
import type { StudentPreferenceProfile } from '../product/preferenceProfile.js';
import { evaluateOneShotClarifications } from './clarificationPolicy.js';
import { calculateOneShotIntentConfidence } from './intentConfidence.js';

export interface OneShotCourseRequest {
  text: string;
  profileId?: string;
  preferenceProfile?: StudentPreferenceProfile;
  learningState?: LearningState;
  guardianPolicy?: GuardianPolicy;
}

export interface PromptToCourseSpecResult {
  courseSpec?: CourseSpec;
  confidence: number;
  inferredFields: string[];
  assumptions: string[];
  requiredClarifications: IntakeQuestion[];
  blockedReasons: string[];
}

interface ParsedPrompt {
  grade?: StudentGrade;
  subject?: string;
  topic?: string;
  interests: string[];
  theme?: string;
  durationMinutes?: number;
  depthLevel: ExplanationDepthLevel;
  preferredInteraction: string[];
  knownIpMentions: string[];
  matureElements: string[];
  privacyHints: string[];
  depthConflict: boolean;
}

interface SafetyResult {
  sanitizedText: string;
  knownIpMentions: string[];
  matureElements: string[];
  privacyHints: string[];
}

const DEFAULT_DURATION_MINUTES = 20;
const DEFAULT_STYLE_THEME = '清晰明亮课程风格';
const KNOWN_IP_PATTERNS = [
  '哈利波特',
  '霍格沃茨',
  'Harry Potter',
  'Hogwarts',
  '迪士尼',
  'Disney',
  '漫威',
  'Marvel',
  '奥特曼',
  'Ultraman',
  '宝可梦',
  'Pokemon',
  'Pokémon',
  '皮卡丘',
  'Pikachu',
  '冰雪奇缘',
  'Frozen',
  '星球大战',
  'Star Wars',
  '哆啦A梦',
  'Doraemon',
];
const MATURE_ELEMENT_PATTERNS = [
  '血腥',
  '暴力',
  '赌博',
  '抽卡',
  '恐怖',
  '成人',
  '酒吧',
  '恋爱养成',
];
const PRIVACY_PATTERNS = [
  /(?:姓名|名字|叫)\s*[:：]?\s*[\u4e00-\u9fa5A-Za-z]{2,12}/g,
  /1[3-9]\d{9}/g,
  /[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g,
];

export function promptToCourseSpec(
  request: OneShotCourseRequest,
): PromptToCourseSpecResult {
  const safety = sanitizeOneShotText(request.text);
  const parsed = parsePrompt(safety.sanitizedText, safety);
  const inferredFields: string[] = [];
  const assumptions: string[] = [];
  const knownFields = buildKnownFields(
    parsed,
    request.preferenceProfile,
    request.learningState,
    inferredFields,
    assumptions,
  );

  const preliminaryClarification = evaluateOneShotClarifications({
    courseSpec: knownFields,
    guardianPolicy: request.guardianPolicy,
    safetyBlockedReasons: buildSafetyBlockedReasons(parsed),
    depthConflict: parsed.depthConflict,
  });

  if (
    preliminaryClarification.requiredClarifications.length > 0 ||
    preliminaryClarification.blockedReasons.length > 0
  ) {
    return {
      confidence: calculateOneShotIntentConfidence({
        missingFields: preliminaryClarification.missingFields,
        inferredFieldCount: inferredFields.length,
        assumptionCount: assumptions.length,
        safetyAdjustmentCount:
          parsed.knownIpMentions.length + parsed.privacyHints.length,
        blockedReasonCount: preliminaryClarification.blockedReasons.length,
      }),
      inferredFields,
      assumptions,
      requiredClarifications: preliminaryClarification.requiredClarifications,
      blockedReasons: preliminaryClarification.blockedReasons,
    };
  }

  const intakeSession = createIntakeSession({
    sessionId: buildEphemeralSessionId(request.profileId),
    rawInput: safety.sanitizedText,
    knownFields,
    preferenceProfile: request.preferenceProfile,
    guardianPolicy: request.guardianPolicy,
  });
  const intakeBlockedReasons = intakeSession.guardianIssues
    .filter((issue) => issue.severity === 'error')
    .map((issue) => issue.message);

  if (intakeSession.status !== 'ready_for_plan') {
    const clarification = evaluateOneShotClarifications({
      courseSpec: intakeSession.knownFields,
      guardianPolicy: request.guardianPolicy,
      guardianIssues: intakeSession.guardianIssues,
      safetyBlockedReasons: [
        ...buildSafetyBlockedReasons(parsed),
        ...intakeBlockedReasons,
      ],
      depthConflict: parsed.depthConflict,
    });

    return {
      confidence: calculateOneShotIntentConfidence({
        missingFields: clarification.missingFields,
        inferredFieldCount: inferredFields.length,
        assumptionCount: assumptions.length + intakeSession.assumptions.length,
        safetyAdjustmentCount:
          parsed.knownIpMentions.length + parsed.privacyHints.length,
        blockedReasonCount: clarification.blockedReasons.length,
      }),
      inferredFields,
      assumptions: mergeAssumptions(
        assumptions,
        formatIntakeAssumptions(intakeSession.assumptions),
      ),
      requiredClarifications: clarification.requiredClarifications,
      blockedReasons: clarification.blockedReasons,
    };
  }

  const courseSpec = getCourseSpecFromReadyIntake(intakeSession);
  const validation = validateCourseSpec(courseSpec);
  if (!validation.valid) {
    return {
      confidence: calculateOneShotIntentConfidence({
        missingFields: [],
        inferredFieldCount: inferredFields.length,
        assumptionCount: assumptions.length + intakeSession.assumptions.length,
        safetyAdjustmentCount:
          parsed.knownIpMentions.length + parsed.privacyHints.length,
        blockedReasonCount: validation.errors.length,
      }),
      inferredFields,
      assumptions: mergeAssumptions(
        assumptions,
        formatIntakeAssumptions(intakeSession.assumptions),
      ),
      requiredClarifications: [],
      blockedReasons: validation.errors.map((issue) => issue.message),
    };
  }

  const finalSpec = validation.data ?? courseSpec;
  const policyResult = request.guardianPolicy
    ? applyGuardianPolicyToCourseSpec(finalSpec, request.guardianPolicy)
    : undefined;
  const boundedSpec = policyResult?.courseSpec ?? finalSpec;
  const policyBlockedReasons = collectPolicyBlockedReasons(
    policyResult?.issues ?? [],
  );

  return {
    courseSpec: policyBlockedReasons.length > 0 ? undefined : boundedSpec,
    confidence: calculateOneShotIntentConfidence({
      missingFields: [],
      inferredFieldCount: inferredFields.length,
      assumptionCount: assumptions.length + intakeSession.assumptions.length,
      safetyAdjustmentCount:
        parsed.knownIpMentions.length + parsed.privacyHints.length,
      blockedReasonCount: policyBlockedReasons.length,
    }),
    inferredFields,
    assumptions: mergeAssumptions(
      assumptions,
      formatIntakeAssumptions(intakeSession.assumptions),
      formatPolicyWarnings(policyResult?.issues ?? []),
    ),
    requiredClarifications: [],
    blockedReasons: policyBlockedReasons,
  };
}

function sanitizeOneShotText(text: string): SafetyResult {
  const trimmed = text.trim();
  const knownIpMentions = KNOWN_IP_PATTERNS.filter((pattern) =>
    new RegExp(escapeRegExp(pattern), 'i').test(trimmed),
  );
  const matureElements = MATURE_ELEMENT_PATTERNS.filter((pattern) =>
    trimmed.includes(pattern),
  );
  const privacyHints = PRIVACY_PATTERNS.flatMap((pattern) =>
    Array.from(trimmed.matchAll(pattern), (match) => match[0]),
  );
  let sanitizedText = trimmed;

  for (const pattern of knownIpMentions) {
    sanitizedText = sanitizedText.replace(
      new RegExp(escapeRegExp(pattern), 'gi'),
      inferSafeIpAlternative(pattern),
    );
  }
  for (const pattern of matureElements) {
    sanitizedText = sanitizedText.replace(
      new RegExp(escapeRegExp(pattern), 'g'),
      '适龄冒险',
    );
  }
  for (const pattern of PRIVACY_PATTERNS) {
    sanitizedText = sanitizedText.replace(pattern, '学生');
  }

  return {
    sanitizedText,
    knownIpMentions,
    matureElements,
    privacyHints,
  };
}

function parsePrompt(input: string, safety: SafetyResult): ParsedPrompt {
  return {
    grade: parseGrade(input),
    subject: parseSubject(input),
    topic: parseTopic(input, parseSubject(input)),
    interests: parseInterests(input),
    theme: parseTheme(input),
    durationMinutes: parseDuration(input),
    depthLevel: parseDepthLevel(input),
    preferredInteraction: parsePreferredInteraction(input),
    knownIpMentions: safety.knownIpMentions,
    matureElements: safety.matureElements,
    privacyHints: safety.privacyHints,
    depthConflict: hasDepthConflict(input),
  };
}

function buildKnownFields(
  parsed: ParsedPrompt,
  preferenceProfile: StudentPreferenceProfile | undefined,
  learningState: LearningState | undefined,
  inferredFields: string[],
  assumptions: string[],
): Partial<CourseSpec> {
  const subject = parsed.subject ?? inferSubject(parsed.topic, learningState);
  const topic =
    parsed.topic ?? inferTopicFromLearningState(subject, learningState);
  const grade = parsed.grade ?? preferenceProfile?.grade;
  const readingLevel =
    preferenceProfile?.readingLevel ?? inferReadingLevel(grade);
  const interests = mergeUnique([
    ...parsed.interests,
    ...(preferenceProfile?.interests ?? []),
    ...(preferenceProfile?.preferredThemes ?? []),
  ]);
  const learningGoals = buildLearningGoals(topic, subject, learningState);
  const depth = topic
    ? buildExplanationDepth(parsed.depthLevel, topic, learningGoals)
    : undefined;
  const styleSpec = buildStyleSpec(
    parsed.theme ?? preferenceProfile?.preferredThemes[0],
    parsed,
    preferenceProfile,
    assumptions,
  );

  addInferred(inferredFields, 'subject', subject, parsed.subject);
  addInferred(inferredFields, 'topic', topic, parsed.topic);
  addInferred(inferredFields, 'studentProfile.grade', grade, parsed.grade);
  addInferred(inferredFields, 'learningGoals', learningGoals.length > 0);
  addInferred(inferredFields, 'explanationDepth', Boolean(depth));
  if (!parsed.durationMinutes) {
    assumptions.push('未提供课程时长，默认按 20 分钟设计。');
  }
  if (!parsed.theme && !preferenceProfile?.preferredThemes.length) {
    assumptions.push('未提供明确视觉风格，默认使用清晰明亮课程风格。');
  }
  if (parsed.knownIpMentions.length > 0) {
    assumptions.push('已将知名 IP 表达改写为原创、安全的相近氛围。');
  }
  if (parsed.privacyHints.length > 0) {
    assumptions.push('已移除可能包含学生身份或联系方式的原文片段。');
  }

  return {
    subject,
    topic,
    learningGoals,
    durationMinutes: parsed.durationMinutes ?? DEFAULT_DURATION_MINUTES,
    studentProfile: grade
      ? {
          grade,
          interests,
          readingLevel,
          preferredInteraction: mergeUnique([
            ...parsed.preferredInteraction,
            ...(preferenceProfile?.preferredGameplayTypes ?? []),
          ]),
          ttsPreference: preferenceProfile?.ttsPreference,
        }
      : undefined,
    styleSpec,
    explanationDepth: depth,
  };
}

function buildStyleSpec(
  theme: string | undefined,
  parsed: ParsedPrompt,
  preferenceProfile: StudentPreferenceProfile | undefined,
  assumptions: string[],
): StyleSpec {
  const safeTheme = theme?.trim() || DEFAULT_STYLE_THEME;
  const palette =
    preferenceProfile?.preferredPalette &&
    preferenceProfile.preferredPalette.length > 0
      ? preferenceProfile.preferredPalette
      : inferPalette(safeTheme);
  const forbidden = mergeUnique([
    '知名 IP 仿作',
    '血腥',
    '恐怖',
    '抽卡',
    '不适龄恋爱',
    ...parsed.knownIpMentions.map((mention) => `${mention} 仿作`),
    ...parsed.matureElements,
  ]);

  if (parsed.matureElements.length > 0) {
    assumptions.push('已从风格设定中移除不适龄元素。');
  }

  return {
    theme: safeTheme,
    palette,
    visualMood: inferVisualMood(safeTheme),
    characterStyle: inferCharacterStyle(safeTheme),
    uiDensity: 'medium',
    forbidden,
  };
}

function buildLearningGoals(
  topic: string | undefined,
  subject: string | undefined,
  learningState: LearningState | undefined,
): string[] {
  if (!topic) return [];
  const weakPoints = findWeakPoints(subject, learningState);

  if (topic.includes('面积')) {
    return ['理解面积含义', '区分面积和周长'];
  }
  if (topic.includes('单词') || subject === '英语') {
    return [`理解${topic}的核心词义`, `能在语境中正确使用${topic}`];
  }
  if (topic.includes('分数')) {
    return ['理解分数表示的整体与部分关系', '能比较简单分数大小'];
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
  if (topic.includes('生态') || topic.includes('食物链')) {
    return ['理解生态系统中的关系', '能解释简单食物链变化'];
  }

  return [
    `理解${topic}的核心概念`,
    weakPoints[0]
      ? `针对${weakPoints[0]}完成巩固练习`
      : `能应用${topic}完成练习`,
  ];
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
      .replace(/^能在/, '')
      .replace(/^能/, '')
      .replace(/^针对/, '')
      .replace(/完成巩固练习$/, '')
      .trim(),
  );
  const concepts =
    depthLevel === 'intro' ? goalConcepts.slice(0, 1) : goalConcepts;

  return {
    depthLevel,
    priorKnowledgeCheck: depthLevel !== 'intro',
    conceptLayers: concepts.map((concept, index) => ({
      concept: concept || `${topic}概念${index + 1}`,
      whyItMatters: `帮助学生把${topic}用于游戏任务和真实练习。`,
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
  return ['数学', '语文', '英语', '科学', '道法', '艺术', '美术', '音乐'].find(
    (subject) => input.includes(subject),
  );
}

function inferSubject(
  topic: string | undefined,
  learningState: LearningState | undefined,
): string | undefined {
  if (topic) {
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
    if (containsAny(topic, ['单词', '词汇', '句型', '自然拼读'])) {
      return '英语';
    }
    if (
      containsAny(topic, ['植物', '动物', '生态', '电路', '实验', '食物链'])
    ) {
      return '科学';
    }
  }
  return learningState?.subjectStates[0]?.subject;
}

function parseTopic(
  input: string,
  subject: string | undefined,
): string | undefined {
  const knownTopics = [
    '面积和周长',
    '面积',
    '周长',
    '英语单词',
    '单词',
    '词汇',
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
    '生态系统',
    '食物链',
  ];
  const topic = knownTopics.find((candidate) => input.includes(candidate));
  if (topic === '英语单词') return '单词';
  if (topic) return topic;

  const afterSubject = subject
    ? input.match(new RegExp(`${escapeRegExp(subject)}([^，。,.；;]+)`))?.[1]
    : undefined;
  return afterSubject
    ?.replace(/闯关.*$/, '')
    .replace(/像.*$/, '')
    .replace(/但.*$/, '')
    .replace(/做成.*$/, '')
    .replace(/风格.*$/, '')
    .trim();
}

function inferTopicFromLearningState(
  subject: string | undefined,
  learningState: LearningState | undefined,
): string | undefined {
  const subjectState = learningState?.subjectStates.find(
    (state) => state.subject === subject,
  );
  return subjectState?.weakPoints[0] ?? subjectState?.masteredGoals[0];
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
    '魔法学院',
    '足球',
    '建造',
  ];
  return mergeUnique(interests.filter((interest) => input.includes(interest)));
}

function parseTheme(input: string): string | undefined {
  if (input.includes('不要太幼稚') && input.includes('魔法学院')) {
    return '原创魔法学院冒险';
  }
  const styledInterest = parseInterests(input).find((interest) =>
    input.includes(`${interest}风格`),
  );
  if (styledInterest) return styledInterest;
  const likeMatch = input.match(/像([^，。,.；;但]+)(?:但|，|。|,|\.|；|;|$)/);
  if (likeMatch?.[1]) return `${likeMatch[1].trim()}氛围`;
  const themeMatch = input.match(/做成([^，。,.；;]+)/);
  if (themeMatch?.[1]) return themeMatch[1].replace(/风格$/, '').trim();
  const styleMatch = input.match(/([\u4e00-\u9fa5A-Za-z0-9]{1,12})\s*风格/);
  return styleMatch?.[1]?.trim();
}

function parseDuration(input: string): number | undefined {
  const match = input.match(/(\d{1,2})\s*分钟/);
  if (!match) return undefined;
  const minutes = Number.parseInt(match[1], 10);
  return Number.isNaN(minutes) ? undefined : Math.min(60, Math.max(5, minutes));
}

function parseDepthLevel(input: string): ExplanationDepthLevel {
  if (containsAny(input, ['挑战', '竞赛', '拔高'])) return 'challenge';
  if (containsAny(input, ['深入', '深度', '拓展'])) return 'deep';
  if (containsAny(input, ['入门', '简单', '基础'])) return 'intro';
  return 'standard';
}

function hasDepthConflict(input: string): boolean {
  return (
    containsAny(input, ['入门', '简单', '基础']) &&
    containsAny(input, ['挑战', '竞赛', '拔高', '深入', '深度'])
  );
}

function parsePreferredInteraction(input: string): string[] {
  const interactions: string[] = [];
  if (containsAny(input, ['闯关', '关卡'])) interactions.push('关卡闯关');
  if (containsAny(input, ['塔防', '防守'])) interactions.push('策略防守');
  if (containsAny(input, ['匹配', '连线'])) interactions.push('匹配连线');
  if (containsAny(input, ['建造', '拼装'])) interactions.push('建造拼装');
  return interactions;
}

function inferSafeIpAlternative(pattern: string): string {
  if (
    containsAny(pattern, ['哈利波特', '霍格沃茨', 'Harry Potter', 'Hogwarts'])
  ) {
    return '原创魔法学院冒险';
  }
  if (containsAny(pattern, ['星球大战', 'Star Wars'])) {
    return '原创星际冒险';
  }
  if (
    containsAny(pattern, ['宝可梦', 'Pokemon', 'Pokémon', '皮卡丘', 'Pikachu'])
  ) {
    return '原创伙伴收集冒险';
  }
  if (containsAny(pattern, ['漫威', 'Marvel'])) {
    return '原创英雄小队冒险';
  }
  if (containsAny(pattern, ['迪士尼', 'Disney', '冰雪奇缘', 'Frozen'])) {
    return '原创童话冒险';
  }
  return '原创冒险';
}

function buildSafetyBlockedReasons(parsed: ParsedPrompt): string[] {
  return parsed.matureElements
    .filter((item) => item !== '抽卡')
    .map((item) => `输入包含不适龄元素“${item}”，已阻断生成。`);
}

function collectPolicyBlockedReasons(issues: GuardianPolicyIssue[]): string[] {
  return issues
    .filter((issue) => issue.severity === 'error')
    .map((issue) => issue.message);
}

function formatPolicyWarnings(issues: GuardianPolicyIssue[]): string[] {
  return issues
    .filter((issue) => issue.severity === 'warning')
    .map((issue) => issue.message);
}

function formatIntakeAssumptions(assumptions: IntakeAssumption[]): string[] {
  return assumptions.map((assumption) => assumption.reason);
}

function mergeAssumptions(...groups: string[][]): string[] {
  return mergeUnique(groups.flat());
}

function addInferred(
  inferredFields: string[],
  field: string,
  value: unknown,
  explicitValue?: unknown,
): void {
  if (value !== undefined && value !== false && explicitValue === undefined) {
    inferredFields.push(field);
  }
}

function findWeakPoints(
  subject: string | undefined,
  learningState: LearningState | undefined,
): string[] {
  return (
    learningState?.subjectStates.find((state) => state.subject === subject)
      ?.weakPoints ?? []
  );
}

function inferPalette(theme: string): string[] {
  if (containsAny(theme, ['太空', '星球', '星际'])) {
    return ['#0F172A', '#38BDF8', '#FACC15'];
  }
  if (containsAny(theme, ['魔法', '学院'])) {
    return ['#1E3A8A', '#D97706', '#F8FAFC'];
  }
  return ['#2563EB', '#F97316', '#F8FAFC'];
}

function inferVisualMood(theme: string): string {
  if (theme.includes('不要太幼稚')) return '克制清晰';
  if (containsAny(theme, ['魔法', '学院'])) return '神秘但适龄';
  return '明亮清晰';
}

function inferCharacterStyle(theme: string): string {
  if (containsAny(theme, ['魔法', '学院'])) {
    return '原创学院导师和学习伙伴';
  }
  if (containsAny(theme, ['太空', '星球', '星际'])) {
    return '原创星际引导员';
  }
  return '友好的课程引导员';
}

function buildMisconceptions(topic: string, concept: string): string[] {
  if (topic.includes('面积')) return ['把面积和周长混淆', '忽略面积单位'];
  if (topic.includes('单词')) return ['只记中文含义，无法在语境中使用'];
  if (topic.includes('分数')) return ['把分子分母含义混淆'];
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
  if (containsAny(topic, ['面积', '周长', '分数', '单位', '函数', '方程']))
    return 'visual_model';
  if (containsAny(topic, ['实验', '生态', '电路'])) return 'experiment';
  if (containsAny(topic, ['阅读', '古诗', '作文', '单词', '词汇']))
    return 'story';
  return 'case';
}

function inferReadingLevel(grade: StudentGrade | undefined): ReadingLevel {
  if (!grade || grade <= 2) return 'low';
  if (grade <= 6) return 'medium';
  return 'high';
}

function buildEphemeralSessionId(profileId: string | undefined): string {
  return `one_shot:${profileId?.trim() || 'anonymous'}`;
}

function containsAny(input: string, keywords: string[]): boolean {
  return keywords.some((keyword) => input.includes(keyword));
}

function mergeUnique(values: Array<string | undefined>): string[] {
  return [
    ...new Set(values.map((value) => value?.trim()).filter(Boolean)),
  ] as string[];
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
