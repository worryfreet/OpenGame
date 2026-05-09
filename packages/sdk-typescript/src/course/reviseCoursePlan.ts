import type { Query } from '../query/Query.js';
import { query, type QueryOptions } from '../query/createQuery.js';
import type { CoursePlanOption, CourseSpec, ExplanationDepthLevel } from './createCourseGame.js';
import { mergeCourseQueryOptions } from './createCourseGame.js';

export interface CourseGDD {
  courseSpec: CourseSpec;
  selectedPlan: CoursePlanOption;
  workflow?: unknown;
  styleBible?: unknown;
  lessonUnits: unknown[];
  interactionSpecs: unknown[];
  assessmentSpec: {
    items: Array<{
      id: string;
      learningGoal: string;
      prompt: string;
      options?: string[];
      correctIndex?: number;
      answer: string;
      explanation: string;
      misconceptionTag: string;
      hint: string;
    }>;
    masteryCriteria: string[];
  };
  assetPlan: {
    images: unknown[];
    audio: unknown[];
    video?: unknown[];
  };
  narrationPlan: {
    segments: unknown[];
  };
  validationPlan: {
    requiredChecks: string[];
    browserFlow: string[];
    fallbackChecks: string[];
  };
}

export type CourseRevisionChange =
  | { type: 'change_depth'; value: ExplanationDepthLevel }
  | { type: 'change_theme'; value: string }
  | { type: 'change_character'; value: string }
  | { type: 'change_palette'; value: string[] }
  | {
      type: 'replace_question';
      questionId: string;
      question: {
        learningGoal: string;
        prompt: string;
        options?: string[];
        correctIndex?: number;
        answer: string;
        explanation: string;
        misconceptionTag: string;
        hint: string;
      };
    }
  | { type: 'disable_video' }
  | { type: 'change_tts'; voice?: string; speed?: number; emotion?: string };

export interface CourseRevisionRequest {
  basePlanId: string;
  changes: CourseRevisionChange[];
}

export interface ReviseCoursePlanOptions {
  request: CourseRevisionRequest;
  courseSpec?: CourseSpec;
  selectedPlan?: CoursePlanOption;
  courseGdd?: CourseGDD;
  options?: QueryOptions;
}

export function reviseCoursePlan(params: ReviseCoursePlanOptions): Query {
  validateReviseCoursePlanOptions(params);

  return query({
    prompt: buildReviseCoursePlanPrompt(params),
    options: mergeCourseQueryOptions({
      ...params.options,
      coreTools: ['ReviseCoursePlan', ...(params.options?.coreTools ?? [])],
    }),
  });
}

export function buildReviseCoursePlanPrompt(
  params: ReviseCoursePlanOptions,
): string {
  validateReviseCoursePlanOptions(params);

  return [
    '你正在通过 OpenGame SDK 执行课程轻量修订。',
    '',
    '目标：只调用 `revise_course_plan`，对结构化 CourseSpec、CoursePlanOption 或 CourseGDD 应用修订。',
    '硬性约束：',
    '- 不要直接修改生成后的源码文件。',
    '- 如果工具返回 blocked，停止并报告阻断项，不要继续生成。',
    '- 如果工具返回 ready，输出修订后的结构化对象，等待外部服务决定是否继续生成。',
    '',
    'revise_course_plan 参数 JSON：',
    '```json',
    stableJson({
      request: params.request,
      courseSpec: params.courseSpec,
      selectedPlan: params.selectedPlan,
      courseGdd: params.courseGdd,
    }),
    '```',
  ].join('\n');
}

function validateReviseCoursePlanOptions(
  params: ReviseCoursePlanOptions,
): void {
  if (!params.request?.basePlanId) {
    throw new Error('request.basePlanId 不能为空。');
  }
  if (!Array.isArray(params.request.changes) || params.request.changes.length === 0) {
    throw new Error('request.changes 至少需要一个修改项。');
  }
  if (!params.courseSpec && !params.selectedPlan && !params.courseGdd) {
    throw new Error('必须提供 courseSpec、selectedPlan 或 courseGdd。');
  }
}

function stableJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}
