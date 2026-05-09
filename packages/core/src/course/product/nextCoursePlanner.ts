/**
 * @license
 * Copyright 2025 OpenGame Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  CourseSpec,
  ExplanationDepthLevel,
  ExplanationDepthSpec,
  FeedbackDepthLevel,
  ReadingLevel,
  RepresentationType,
  StyleSpec,
} from '../schemas.js';
import {
  validateCourseSpec,
  type CourseValidationIssue,
} from '../validation.js';
import { createIntakeSession, type IntakeQuestion } from './intakeSession.js';
import {
  createEmptyLearningState,
  updateLearningStateFromReport,
  type LearningReportSummary,
  type LearningState,
  type SubjectLearningState,
} from './learningState.js';
import type { StudentPreferenceProfile } from './preferenceProfile.js';

export type NextCourseMode =
  | 'next_lesson'
  | 'reinforcement'
  | 'same_topic_new_gameplay';

export type NextCoursePlannerStatus = 'ready' | 'needs_intake';

export interface NextCoursePlannerInput {
  profileId: string;
  subject?: string;
  previousCourseSpec?: CourseSpec;
  learningState?: LearningState;
  learningReport?: LearningReportSummary;
  preferenceProfile?: StudentPreferenceProfile;
  previousGameplayType?: string;
  requestedMode?: NextCourseMode;
}

export interface NextCourseRationale {
  mode: NextCourseMode;
  masteredGoals: string[];
  weakPoints: string[];
  misconceptionTags: string[];
  hintUsageCount?: number;
  completionRate?: number;
  nextGoals: string[];
  avoidedGameplayTypes: string[];
}

export interface NextCoursePlannerResult {
  status: NextCoursePlannerStatus;
  courseSpec?: CourseSpec;
  updatedLearningState?: LearningState;
  rationale: NextCourseRationale;
  followUpQuestions: IntakeQuestion[];
  validationIssues: CourseValidationIssue[];
}

const DEFAULT_PALETTE = ['#2563EB', '#F59E0B', '#10B981'];

export function planNextCourse(
  input: NextCoursePlannerInput,
): NextCoursePlannerResult {
  assertProfileId(input.profileId);

  const updatedLearningState = resolveLearningState(input);
  const subjectState = resolveSubjectState(input, updatedLearningState);
  const rationale = buildRationale(input, subjectState);
  const missingQuestions = buildMissingQuestions(
    input,
    subjectState,
    rationale,
  );

  if (missingQuestions.length > 0) {
    return {
      status: 'needs_intake',
      updatedLearningState,
      rationale,
      followUpQuestions: missingQuestions,
      validationIssues: [],
    };
  }

  const courseSpec = buildNextCourseSpec(input, subjectState, rationale);
  const validation = validateCourseSpec(courseSpec);
  if (!validation.valid || !validation.data) {
    return {
      status: 'needs_intake',
      updatedLearningState,
      rationale,
      followUpQuestions: [
        {
          id: 'ask_next_course_fix',
          field: 'learningGoals',
          prompt: '下一课目标还不完整，需要补充希望强化的具体能力。',
          required: true,
        },
      ],
      validationIssues: validation.errors,
    };
  }

  return {
    status: 'ready',
    courseSpec: validation.data,
    updatedLearningState,
    rationale,
    followUpQuestions: [],
    validationIssues: [],
  };
}

function resolveLearningState(input: NextCoursePlannerInput): LearningState {
  const baseState =
    input.learningState ?? createEmptyLearningState(input.profileId);
  if (baseState.profileId !== input.profileId) {
    throw new Error('课程续作必须使用相同 profileId 的 LearningState。');
  }

  return input.learningReport
    ? updateLearningStateFromReport(baseState, {
        ...input.learningReport,
        profileId: input.learningReport.profileId ?? input.profileId,
      })
    : baseState;
}

function resolveSubjectState(
  input: NextCoursePlannerInput,
  learningState: LearningState,
): SubjectLearningState | undefined {
  const subject =
    input.subject ??
    input.learningReport?.subject ??
    input.previousCourseSpec?.subject;
  if (!subject) {
    return undefined;
  }

  return learningState.subjectStates.find((state) => state.subject === subject);
}

function buildRationale(
  input: NextCoursePlannerInput,
  subjectState: SubjectLearningState | undefined,
): NextCourseRationale {
  const weakPoints = subjectState?.weakPoints ?? [];
  const masteredGoals = subjectState?.masteredGoals ?? [];
  const misconceptionTags = subjectState?.misconceptionTags ?? [];
  const mode = resolveMode(input, subjectState);
  const nextGoals = buildNextGoals(input, weakPoints, masteredGoals, mode);

  return {
    mode,
    masteredGoals,
    weakPoints,
    misconceptionTags,
    hintUsageCount: subjectState?.hintUsageCount,
    completionRate: subjectState?.completionRate,
    nextGoals,
    avoidedGameplayTypes: input.previousGameplayType
      ? [input.previousGameplayType]
      : [],
  };
}

function resolveMode(
  input: NextCoursePlannerInput,
  subjectState: SubjectLearningState | undefined,
): NextCourseMode {
  if (input.requestedMode) {
    return input.requestedMode;
  }

  const hasWeakEvidence =
    (subjectState?.weakPoints.length ?? 0) > 0 ||
    (subjectState?.misconceptionTags.length ?? 0) > 0 ||
    (subjectState?.hintUsageCount ?? 0) >= 2 ||
    (subjectState?.completionRate ?? 1) < 0.75;
  if (hasWeakEvidence) {
    return 'reinforcement';
  }

  if (input.previousGameplayType) {
    return 'same_topic_new_gameplay';
  }

  return 'next_lesson';
}

function buildNextGoals(
  input: NextCoursePlannerInput,
  weakPoints: string[],
  masteredGoals: string[],
  mode: NextCourseMode,
): string[] {
  const topic = input.previousCourseSpec?.topic ?? '当前主题';
  const misconceptionGoals = weakPoints.flatMap((weakPoint) =>
    buildGoalsForWeakPoint(weakPoint, topic),
  );
  if (misconceptionGoals.length > 0) {
    return unique(misconceptionGoals).slice(0, 3);
  }

  if (mode === 'same_topic_new_gameplay') {
    return [`用新玩法复盘${topic}的关键概念`, `在不同情境中应用${topic}`];
  }

  const masteredHint = masteredGoals[masteredGoals.length - 1];
  return [
    masteredHint
      ? `在${masteredHint}基础上学习下一步概念`
      : `理解${topic}的下一步概念`,
    `能独立完成${topic}相关迁移练习`,
  ];
}

function buildGoalsForWeakPoint(weakPoint: string, topic: string): string[] {
  if (containsAny(weakPoint, ['单位混淆', '面积单位', '单位换算'])) {
    return [
      '理解面积单位的含义',
      '能进行面积单位换算',
      '能区分长度单位和面积单位',
    ];
  }
  if (containsAny(weakPoint, ['面积', '周长'])) {
    return ['区分面积和周长', '能选择正确公式解决问题'];
  }
  if (containsAny(weakPoint, ['公式', '套用'])) {
    return [`解释${topic}公式的来源`, `能判断公式适用条件`];
  }
  return [`针对${weakPoint}完成强化练习`, `能说明${weakPoint}的常见错误原因`];
}

function buildMissingQuestions(
  input: NextCoursePlannerInput,
  subjectState: SubjectLearningState | undefined,
  rationale: NextCourseRationale,
): IntakeQuestion[] {
  const questions: IntakeQuestion[] = [];
  const hasGrade =
    input.previousCourseSpec?.studentProfile.grade ??
    input.preferenceProfile?.grade;
  const subject =
    input.subject ??
    input.learningReport?.subject ??
    input.previousCourseSpec?.subject;
  const hasLearningEvidence =
    rationale.weakPoints.length > 0 ||
    rationale.masteredGoals.length > 0 ||
    rationale.misconceptionTags.length > 0 ||
    subjectState?.completionRate !== undefined;

  if (!hasGrade) {
    questions.push({
      id: 'ask_grade',
      field: 'grade',
      prompt: '下一课面向小学几年级学生？',
      required: true,
    });
  }
  if (!subject) {
    questions.push({
      id: 'ask_subject',
      field: 'subject',
      prompt: '下一课要延续哪个学科？',
      required: true,
    });
  }
  if (!hasLearningEvidence) {
    questions.push({
      id: 'ask_learning_state',
      field: 'learningGoals',
      prompt: '上一课学生掌握了什么、卡在哪里，或希望下一课强化什么？',
      required: true,
    });
  }

  return dedupeQuestions(questions);
}

function buildNextCourseSpec(
  input: NextCoursePlannerInput,
  subjectState: SubjectLearningState | undefined,
  rationale: NextCourseRationale,
): CourseSpec {
  const previous = input.previousCourseSpec;
  const preference = input.preferenceProfile;
  const subject =
    input.subject ??
    input.learningReport?.subject ??
    previous?.subject ??
    subjectState?.subject;
  const topic = buildNextTopic(previous?.topic, rationale);
  const grade = previous?.studentProfile.grade ?? preference?.grade;
  if (!subject || !grade) {
    throw new Error('生成下一课 CourseSpec 需要 subject 和 grade。');
  }

  return {
    subject,
    topic,
    learningGoals: rationale.nextGoals,
    durationMinutes: previous?.durationMinutes ?? 20,
    studentProfile: {
      grade,
      age: previous?.studentProfile.age,
      readingLevel: resolveReadingLevel(previous, preference),
      interests: unique([
        ...(previous?.studentProfile.interests ?? []),
        ...(preference?.interests ?? []),
      ]),
      weakPoints: rationale.weakPoints,
      preferredInteraction: buildPreferredInteraction(input),
      ttsPreference:
        previous?.studentProfile.ttsPreference ?? preference?.ttsPreference,
      guardianLimits: previous?.studentProfile.guardianLimits,
    },
    styleSpec: buildNextStyleSpec(previous?.styleSpec, preference, rationale),
    explanationDepth: buildExplanationDepth(rationale),
  };
}

function buildNextTopic(
  previousTopic: string | undefined,
  rationale: NextCourseRationale,
): string {
  if (rationale.nextGoals.some((goal) => goal.includes('面积单位'))) {
    return '面积单位换算';
  }
  if (rationale.mode === 'reinforcement') {
    return `${previousTopic ?? '当前主题'}强化练习`;
  }
  if (rationale.mode === 'same_topic_new_gameplay') {
    return `${previousTopic ?? '当前主题'}新玩法复盘`;
  }
  return `${previousTopic ?? '当前主题'}下一课`;
}

function buildPreferredInteraction(input: NextCoursePlannerInput): string[] {
  const previous =
    input.previousCourseSpec?.studentProfile.preferredInteraction ?? [];
  const preference = input.preferenceProfile?.preferredGameplayTypes ?? [];
  const merged = unique([...previous, ...preference]).filter(
    (item) => item !== input.previousGameplayType,
  );
  const fallback = input.previousGameplayType
    ? ['卡片配对', '拖拽分箱', '步骤排序'].filter(
        (item) => item !== input.previousGameplayType,
      )
    : ['拖拽分箱', '步骤排序'];
  return merged.length > 0 ? merged : fallback;
}

function buildNextStyleSpec(
  previousStyle: StyleSpec | undefined,
  preference: StudentPreferenceProfile | undefined,
  rationale: NextCourseRationale,
): StyleSpec {
  const preferredTheme =
    preference?.preferredThemes[0] ?? preference?.interests[0];
  const baseTheme =
    previousStyle?.theme ?? preferredTheme ?? '清晰明亮课程风格';
  const theme =
    rationale.mode === 'same_topic_new_gameplay' && preferredTheme
      ? `${preferredTheme}新任务`
      : baseTheme;

  return {
    theme,
    palette:
      previousStyle?.palette ?? preference?.preferredPalette ?? DEFAULT_PALETTE,
    referenceImages: previousStyle?.referenceImages,
    visualMood: previousStyle?.visualMood ?? '明亮清晰、反馈明确',
    characterStyle: previousStyle?.characterStyle ?? '原创友好的学习伙伴',
    uiDensity: previousStyle?.uiDensity ?? 'medium',
    forbidden: unique([
      ...(previousStyle?.forbidden ?? []),
      '抽卡付费',
      '恐怖惊吓',
    ]),
  };
}

function buildExplanationDepth(
  rationale: NextCourseRationale,
): ExplanationDepthSpec {
  const depthLevel = resolveDepthLevel(rationale);
  const feedbackDepth: FeedbackDepthLevel =
    depthLevel === 'intro' ? 'short_reason' : 'step_by_step';
  const representation: RepresentationType = rationale.nextGoals.some((goal) =>
    containsAny(goal, ['单位', '面积', '公式']),
  )
    ? 'visual_model'
    : 'story';

  return {
    depthLevel,
    priorKnowledgeCheck: true,
    conceptLayers: rationale.nextGoals.map((goal, index) => ({
      concept: goal.replace(/^能|^理解|^区分|^针对/, ''),
      whyItMatters:
        index === 0
          ? '帮助学生把上一课证据转化为下一步可练习目标。'
          : '用于检查学生是否能在新情境中迁移应用。',
      misconceptionToAddress: rationale.misconceptionTags,
      representation,
    })),
    examplePlan: {
      workedExamples: depthLevel === 'standard' ? 2 : 1,
      guidedPractice: 2,
      independentChallenges: depthLevel === 'intro' ? 0 : 1,
      transferTasks: depthLevel === 'intro' ? 0 : 1,
    },
    feedbackDepth,
    masteryEvidence: rationale.nextGoals.map((goal) => `学生可以${goal}`),
  };
}

function resolveDepthLevel(
  rationale: NextCourseRationale,
): ExplanationDepthLevel {
  if (
    (rationale.completionRate ?? 1) < 0.7 ||
    (rationale.hintUsageCount ?? 0) >= 3
  ) {
    return 'intro';
  }
  if (rationale.mode === 'next_lesson') {
    return 'deep';
  }
  return 'standard';
}

function resolveReadingLevel(
  previous: CourseSpec | undefined,
  preference: StudentPreferenceProfile | undefined,
): ReadingLevel | undefined {
  return previous?.studentProfile.readingLevel ?? preference?.readingLevel;
}

function assertProfileId(profileId: string): void {
  if (!profileId.trim()) {
    throw new Error('课程续作必须包含 profileId。');
  }
}

function containsAny(value: string, keywords: string[]): boolean {
  return keywords.some((keyword) => value.includes(keyword));
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function dedupeQuestions(questions: IntakeQuestion[]): IntakeQuestion[] {
  const seen = new Set<string>();
  return questions.filter((question) => {
    if (seen.has(question.id)) {
      return false;
    }
    seen.add(question.id);
    return true;
  });
}

export function buildNextCourseIntakeFallback(
  input: NextCoursePlannerInput,
): ReturnType<typeof createIntakeSession> {
  return createIntakeSession({
    sessionId: `${input.profileId}:next-course-intake`,
    rawInput: [
      input.subject ?? input.learningReport?.subject,
      input.learningReport?.weakPoints?.join('、'),
      input.learningReport?.masteredGoals?.join('、'),
    ]
      .filter(Boolean)
      .join(' '),
    knownFields: input.previousCourseSpec,
    preferenceProfile: input.preferenceProfile,
  });
}
