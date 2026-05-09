/**
 * @license
 * Copyright 2025 OpenGame Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  CourseGDD,
  CoursePlanOption,
  CourseSpec,
  ExplanationDepthLevel,
} from '../schemas.js';
import {
  validateCourseGdd,
  validateCoursePlanOption,
  validateCourseSpec,
  type CourseValidationIssue,
} from '../validation.js';
import { adjustCoursePlanDepth } from './stylePreview.js';

export type CourseRevisionTarget = 'course_spec' | 'course_plan' | 'course_gdd';

export type CourseRevisionChange =
  | { type: 'change_depth'; value: ExplanationDepthLevel }
  | { type: 'change_theme'; value: string }
  | { type: 'change_character'; value: string }
  | { type: 'change_palette'; value: string[] }
  | {
      type: 'replace_question';
      questionId: string;
      question: RevisionAssessmentQuestion;
    }
  | { type: 'disable_video' }
  | { type: 'change_tts'; voice?: string; speed?: number; emotion?: string };

export interface RevisionAssessmentQuestion {
  learningGoal: string;
  prompt: string;
  options?: string[];
  correctIndex?: number;
  answer: string;
  explanation: string;
  misconceptionTag: string;
  hint: string;
}

export interface CourseRevisionRequest {
  basePlanId: string;
  changes: CourseRevisionChange[];
}

export interface ReviseCoursePlanInput {
  request: CourseRevisionRequest;
  courseSpec?: CourseSpec;
  selectedPlan?: CoursePlanOption;
  courseGdd?: CourseGDD;
}

export interface CourseRevisionAppliedChange {
  type: CourseRevisionChange['type'];
  target: CourseRevisionTarget;
  summary: string;
}

export interface ReviseCoursePlanResult {
  courseSpec?: CourseSpec;
  selectedPlan?: CoursePlanOption;
  courseGdd?: CourseGDD;
  appliedChanges: CourseRevisionAppliedChange[];
  validationIssues: CourseValidationIssue[];
  warnings: CourseValidationIssue[];
  status: 'ready' | 'blocked';
}

interface RevisionWorkingState {
  courseSpec?: CourseSpec;
  selectedPlan?: CoursePlanOption;
  courseGdd?: CourseGDD;
  appliedChanges: CourseRevisionAppliedChange[];
  validationIssues: CourseValidationIssue[];
  warnings: CourseValidationIssue[];
}

export function reviseCoursePlan(
  input: ReviseCoursePlanInput,
): ReviseCoursePlanResult {
  validateRevisionInput(input);

  const state: RevisionWorkingState = {
    courseSpec: cloneValue(input.courseSpec),
    selectedPlan: cloneValue(input.selectedPlan),
    courseGdd: cloneValue(input.courseGdd),
    appliedChanges: [],
    validationIssues: [],
    warnings: [],
  };

  for (const change of input.request.changes) {
    applyRevisionChange(state, change);
  }

  syncNestedCourseGddState(state);
  collectValidationResults(state);

  return {
    courseSpec: state.courseSpec,
    selectedPlan: state.selectedPlan,
    courseGdd: state.courseGdd,
    appliedChanges: state.appliedChanges,
    validationIssues: state.validationIssues,
    warnings: state.warnings,
    status: state.validationIssues.length > 0 ? 'blocked' : 'ready',
  };
}

function validateRevisionInput(input: ReviseCoursePlanInput): void {
  if (!input.request.basePlanId.trim()) {
    throw new Error('CourseRevisionRequest 必须包含 basePlanId。');
  }
  if (input.request.changes.length === 0) {
    throw new Error('CourseRevisionRequest 至少需要一个修改项。');
  }
  if (!input.courseSpec && !input.selectedPlan && !input.courseGdd) {
    throw new Error(
      '课程修订必须提供 CourseSpec、CoursePlanOption 或 CourseGDD。',
    );
  }

  const selectedPlan = input.courseGdd?.selectedPlan ?? input.selectedPlan;
  if (selectedPlan && selectedPlan.id !== input.request.basePlanId) {
    throw new Error('basePlanId 必须与待修订方案 id 一致。');
  }
}

function applyRevisionChange(
  state: RevisionWorkingState,
  change: CourseRevisionChange,
): void {
  switch (change.type) {
    case 'change_depth':
      applyDepthChange(state, change.value);
      break;
    case 'change_theme':
      applyThemeChange(state, change.value);
      break;
    case 'change_character':
      applyCharacterChange(state, change.value);
      break;
    case 'change_palette':
      applyPaletteChange(state, change.value);
      break;
    case 'replace_question':
      applyQuestionReplacement(state, change.questionId, change.question);
      break;
    case 'disable_video':
      applyDisableVideo(state);
      break;
    case 'change_tts':
      applyTtsChange(state, change);
      break;
    default:
      assertNever(change);
  }
}

function applyDepthChange(
  state: RevisionWorkingState,
  depthLevel: ExplanationDepthLevel,
): void {
  const spec = state.courseGdd?.courseSpec ?? state.courseSpec;
  if (!spec) {
    addIssue(
      state,
      '/courseSpec',
      '修改讲解深度需要提供 CourseSpec 或 CourseGDD。',
    );
    return;
  }

  const options = [state.courseGdd?.selectedPlan ?? state.selectedPlan].filter(
    Boolean,
  ) as CoursePlanOption[];
  const adjustment =
    options.length > 0
      ? adjustCoursePlanDepth(spec, options, depthLevel)
      : undefined;
  const adjusted = adjustment
    ? adjustment.courseSpec
    : {
        ...spec,
        explanationDepth: {
          ...spec.explanationDepth,
          depthLevel,
        },
      };
  const adjustedPlanScore = adjustment?.confirmationSummary.options.find(
    (option) => option.id === options[0]?.id,
  )?.score;

  state.courseSpec = adjusted;
  if (state.selectedPlan && adjustedPlanScore) {
    state.selectedPlan = {
      ...state.selectedPlan,
      score: adjustedPlanScore,
    };
  }
  if (state.courseGdd) {
    state.courseGdd = {
      ...state.courseGdd,
      courseSpec: adjusted,
      selectedPlan: adjustedPlanScore
        ? {
            ...state.courseGdd.selectedPlan,
            score: adjustedPlanScore,
          }
        : state.courseGdd.selectedPlan,
    };
  }
  state.appliedChanges.push({
    type: 'change_depth',
    target: state.courseGdd ? 'course_gdd' : 'course_spec',
    summary: `讲解深度调整为 ${depthLevel}。`,
  });
}

function applyThemeChange(state: RevisionWorkingState, theme: string): void {
  const normalizedTheme = theme.trim();
  if (!normalizedTheme) {
    addIssue(state, '/styleSpec/theme', '主题不能为空。');
    return;
  }

  updateStyleSpec(state, { theme: normalizedTheme });
  if (state.courseGdd?.styleBible) {
    state.courseGdd = {
      ...state.courseGdd,
      styleBible: {
        ...state.courseGdd.styleBible,
        theme: normalizedTheme,
      },
    };
  }
  state.appliedChanges.push({
    type: 'change_theme',
    target: state.courseGdd ? 'course_gdd' : 'course_spec',
    summary: `主题调整为「${normalizedTheme}」。`,
  });
}

function applyCharacterChange(
  state: RevisionWorkingState,
  characterStyle: string,
): void {
  const normalizedCharacter = characterStyle.trim();
  if (!normalizedCharacter) {
    addIssue(state, '/styleSpec/characterStyle', '角色方向不能为空。');
    return;
  }

  updateStyleSpec(state, { characterStyle: normalizedCharacter });
  if (state.courseGdd?.styleBible) {
    state.courseGdd = {
      ...state.courseGdd,
      styleBible: {
        ...state.courseGdd.styleBible,
        characterDirection: normalizedCharacter,
      },
    };
  }
  state.appliedChanges.push({
    type: 'change_character',
    target: state.courseGdd ? 'course_gdd' : 'course_spec',
    summary: `角色方向调整为「${normalizedCharacter}」。`,
  });
}

function applyPaletteChange(
  state: RevisionWorkingState,
  palette: string[],
): void {
  const normalizedPalette = dedupeNonEmpty(palette);
  if (normalizedPalette.length === 0) {
    addIssue(state, '/styleSpec/palette', '配色至少需要一个有效颜色。');
    return;
  }

  updateStyleSpec(state, { palette: normalizedPalette });
  if (state.courseGdd?.styleBible) {
    state.courseGdd = {
      ...state.courseGdd,
      styleBible: {
        ...state.courseGdd.styleBible,
        palette: normalizedPalette,
      },
    };
  }
  state.appliedChanges.push({
    type: 'change_palette',
    target: state.courseGdd ? 'course_gdd' : 'course_spec',
    summary: `配色调整为 ${normalizedPalette.join('、')}。`,
  });
}

function applyQuestionReplacement(
  state: RevisionWorkingState,
  questionId: string,
  question: RevisionAssessmentQuestion,
): void {
  if (!state.courseGdd) {
    addIssue(state, '/courseGdd', '替换题目需要提供 CourseGDD。');
    return;
  }

  const validationIssues = validateRevisionQuestion(questionId, question);
  if (validationIssues.length > 0) {
    state.validationIssues.push(...validationIssues);
    return;
  }

  const itemIndex = state.courseGdd.assessmentSpec.items.findIndex(
    (item) => item.id === questionId,
  );
  if (itemIndex < 0) {
    addIssue(
      state,
      `/assessmentSpec/items/${questionId}`,
      `找不到待替换题目「${questionId}」。`,
    );
    return;
  }

  const nextItems = [...state.courseGdd.assessmentSpec.items];
  nextItems[itemIndex] = {
    ...nextItems[itemIndex],
    ...question,
    id: questionId,
  };
  state.courseGdd = {
    ...state.courseGdd,
    assessmentSpec: {
      ...state.courseGdd.assessmentSpec,
      items: nextItems,
    },
  };
  state.appliedChanges.push({
    type: 'replace_question',
    target: 'course_gdd',
    summary: `替换评价题「${questionId}」。`,
  });
}

function applyDisableVideo(state: RevisionWorkingState): void {
  if (!state.courseGdd) {
    addIssue(state, '/courseGdd', '关闭视频需要提供 CourseGDD。');
    return;
  }

  state.courseGdd = {
    ...state.courseGdd,
    courseSpec: {
      ...state.courseGdd.courseSpec,
      studentProfile: {
        ...state.courseGdd.courseSpec.studentProfile,
        guardianLimits: state.courseGdd.courseSpec.studentProfile.guardianLimits
          ? {
              ...state.courseGdd.courseSpec.studentProfile.guardianLimits,
              allowGeneratedVideo: false,
            }
          : undefined,
      },
    },
    assetPlan: {
      ...state.courseGdd.assetPlan,
      video: [],
    },
    validationPlan: {
      ...state.courseGdd.validationPlan,
      requiredChecks: removeVideoChecks(
        state.courseGdd.validationPlan.requiredChecks,
      ),
      browserFlow: removeVideoChecks(
        state.courseGdd.validationPlan.browserFlow,
      ),
      fallbackChecks: dedupeNonEmpty([
        ...removeVideoChecks(state.courseGdd.validationPlan.fallbackChecks),
        '视频关闭时使用静态过场和字幕说明',
      ]),
    },
  };
  state.courseSpec = state.courseGdd.courseSpec;
  state.appliedChanges.push({
    type: 'disable_video',
    target: 'course_gdd',
    summary: '已关闭视频资产并更新验证计划。',
  });
}

function applyTtsChange(
  state: RevisionWorkingState,
  change: Extract<CourseRevisionChange, { type: 'change_tts' }>,
): void {
  const spec = state.courseGdd?.courseSpec ?? state.courseSpec;
  if (!spec) {
    addIssue(
      state,
      '/courseSpec',
      '修改 TTS 风格需要提供 CourseSpec 或 CourseGDD。',
    );
    return;
  }

  const ttsPreference = {
    ...spec.studentProfile.ttsPreference,
    voice: normalizeOptional(change.voice),
    speed: change.speed,
    emotion: normalizeOptional(change.emotion),
  };
  const cleanedTtsPreference = Object.fromEntries(
    Object.entries(ttsPreference).filter(([, value]) => value !== undefined),
  );
  const nextSpec = {
    ...spec,
    studentProfile: {
      ...spec.studentProfile,
      ttsPreference: cleanedTtsPreference,
    } as CourseSpec['studentProfile'],
  };

  state.courseSpec = nextSpec;
  if (state.courseGdd) {
    state.courseGdd = {
      ...state.courseGdd,
      courseSpec: nextSpec,
    };
  }
  state.appliedChanges.push({
    type: 'change_tts',
    target: state.courseGdd ? 'course_gdd' : 'course_spec',
    summary: '已更新 TTS 风格偏好。',
  });
}

function updateStyleSpec(
  state: RevisionWorkingState,
  patch: Partial<CourseSpec['styleSpec']>,
): void {
  const spec = state.courseGdd?.courseSpec ?? state.courseSpec;
  if (!spec) {
    addIssue(
      state,
      '/courseSpec',
      '修改风格需要提供 CourseSpec 或 CourseGDD。',
    );
    return;
  }

  const nextSpec = {
    ...spec,
    styleSpec: {
      ...spec.styleSpec,
      ...patch,
    },
  };
  state.courseSpec = nextSpec;
  if (state.courseGdd) {
    state.courseGdd = {
      ...state.courseGdd,
      courseSpec: nextSpec,
    };
  }
}

function syncNestedCourseGddState(state: RevisionWorkingState): void {
  if (!state.courseGdd) {
    return;
  }
  state.courseSpec = state.courseGdd.courseSpec;
  state.selectedPlan = state.courseGdd.selectedPlan;
}

function collectValidationResults(state: RevisionWorkingState): void {
  if (state.courseGdd) {
    const result = validateCourseGdd(state.courseGdd);
    state.validationIssues.push(...result.errors);
    state.warnings.push(...result.warnings);
    return;
  }

  if (state.courseSpec) {
    const result = validateCourseSpec(state.courseSpec);
    state.validationIssues.push(...result.errors);
    state.warnings.push(...result.warnings);
  }

  if (state.selectedPlan) {
    const result = validateCoursePlanOption(state.selectedPlan);
    state.validationIssues.push(...result.errors);
    state.warnings.push(...result.warnings);
  }
}

function validateRevisionQuestion(
  questionId: string,
  question: RevisionAssessmentQuestion,
): CourseValidationIssue[] {
  const issues: CourseValidationIssue[] = [];
  const basePath = `/assessmentSpec/items/${questionId}`;
  if (!questionId.trim()) {
    issues.push({
      path: '/assessmentSpec/items',
      message: 'questionId 不能为空。',
    });
  }
  for (const [key, value] of Object.entries({
    learningGoal: question.learningGoal,
    prompt: question.prompt,
    answer: question.answer,
    explanation: question.explanation,
    misconceptionTag: question.misconceptionTag,
    hint: question.hint,
  })) {
    if (!value.trim()) {
      issues.push({ path: `${basePath}/${key}`, message: `${key} 不能为空。` });
    }
  }
  if (question.explanation.trim().length < 20) {
    issues.push({
      path: `${basePath}/explanation`,
      message: '替换题目必须提供能说明关键推理步骤的 explanation。',
    });
  }
  if (question.options && question.options.length > 0) {
    if (question.options.length < 2) {
      issues.push({
        path: `${basePath}/options`,
        message: '选择题至少需要 2 个选项。',
      });
    }
    if (
      question.correctIndex === undefined ||
      question.correctIndex < 0 ||
      question.correctIndex >= question.options.length
    ) {
      issues.push({
        path: `${basePath}/correctIndex`,
        message: 'correctIndex 必须指向 options 中的正确答案。',
      });
    }
  }
  return issues;
}

function removeVideoChecks(checks: string[]): string[] {
  return checks.filter((item) => !/视频|video/i.test(item));
}

function addIssue(
  state: RevisionWorkingState,
  path: string,
  message: string,
): void {
  state.validationIssues.push({ path, message });
}

function dedupeNonEmpty(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function normalizeOptional(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function cloneValue<T>(value: T | undefined): T | undefined {
  return value === undefined ? undefined : structuredClone(value);
}

function assertNever(value: never): never {
  throw new Error(`不支持的课程修订类型：${JSON.stringify(value)}`);
}
