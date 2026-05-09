/**
 * @license
 * Copyright 2025 OpenGame Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  BaseDeclarativeTool,
  BaseToolInvocation,
  Kind,
  type ToolInvocation,
  type ToolResult,
} from './tools.js';
import { ToolErrorType } from './tool-error.js';
import { ToolDisplayNames, ToolNames } from './tool-names.js';
import type { CourseSpec } from '../course/schemas.js';
import {
  createIntakeSession,
  getCourseSpecFromReadyIntake,
  type CreateIntakeSessionInput,
  type IntakeSession,
} from '../course/product/intakeSession.js';
import type { GuardianPolicy } from '../course/product/guardianPolicy.js';
import type { StudentPreferenceProfile } from '../course/product/preferenceProfile.js';
import { validateCourseSpec } from '../course/validation.js';

export interface CompleteCourseIntakeParams {
  sessionId: string;
  rawInput: string;
  knownFields?: Partial<CourseSpec>;
  preferenceProfile?: StudentPreferenceProfile;
  guardianPolicy?: GuardianPolicy;
}

export interface CompleteCourseIntakeResult {
  intakeSession: IntakeSession;
  courseSpec?: CourseSpec;
}

class CompleteCourseIntakeInvocation extends BaseToolInvocation<
  CompleteCourseIntakeParams,
  ToolResult
> {
  constructor(params: CompleteCourseIntakeParams) {
    super(params);
  }

  getDescription(): string {
    return `补全课程输入会话 ${this.params.sessionId}，判断是否可进入课程方案生成。`;
  }

  async execute(_signal: AbortSignal): Promise<ToolResult> {
    try {
      const result = completeCourseIntake(this.params);
      const resultJson = JSON.stringify(result, null, 2);

      return {
        llmContent: `<course-intake-session>
${resultJson}
</course-intake-session>`,
        returnDisplay: formatDisplayResult(result),
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        llmContent: `Error completing course intake: ${errorMessage}`,
        returnDisplay: `**课程输入补全失败**\n\nError: ${errorMessage}`,
        error: {
          message: errorMessage,
          type: ToolErrorType.EXECUTION_FAILED,
        },
      };
    }
  }
}

export class CompleteCourseIntakeTool extends BaseDeclarativeTool<
  CompleteCourseIntakeParams,
  ToolResult
> {
  static readonly Name: string = ToolNames.COMPLETE_COURSE_INTAKE;

  constructor() {
    super(
      CompleteCourseIntakeTool.Name,
      ToolDisplayNames.COMPLETE_COURSE_INTAKE,
      '把学生自然语言、部分 CourseSpec、历史偏好和家长限制合并为 IntakeSession；信息足够时输出可进入 generate_course_plan 的 CourseSpec。',
      Kind.Think,
      {
        type: 'object',
        additionalProperties: false,
        properties: {
          sessionId: { type: 'string', minLength: 1 },
          rawInput: { type: 'string' },
          knownFields: { type: 'object' },
          preferenceProfile: { type: 'object' },
          guardianPolicy: { type: 'object' },
        },
        required: ['sessionId', 'rawInput'],
      },
      true,
      false,
    );
  }

  protected createInvocation(
    params: CompleteCourseIntakeParams,
  ): ToolInvocation<CompleteCourseIntakeParams, ToolResult> {
    return new CompleteCourseIntakeInvocation(params);
  }
}

export function completeCourseIntake(
  input: CreateIntakeSessionInput,
): CompleteCourseIntakeResult {
  const intakeSession = createIntakeSession(input);
  if (intakeSession.status !== 'ready_for_plan') {
    return { intakeSession };
  }

  const courseSpec = getCourseSpecFromReadyIntake(intakeSession);
  const validation = validateCourseSpec(courseSpec);
  if (!validation.valid || !validation.data) {
    throw new Error(
      `补全后的 CourseSpec 未通过校验：${validation.errors
        .map((issue) => `${issue.path || '/'} ${issue.message}`)
        .join('; ')}`,
    );
  }

  return {
    intakeSession,
    courseSpec: validation.data,
  };
}

function formatDisplayResult(result: CompleteCourseIntakeResult): string {
  const { intakeSession, courseSpec } = result;
  const lines = [
    `**课程输入状态**：${intakeSession.status}`,
    `**置信度**：${Math.round(intakeSession.confidence * 100)}%`,
  ];

  if (courseSpec) {
    lines.push(
      `**可生成方案**：${courseSpec.studentProfile.grade} 年级 ${courseSpec.subject}《${courseSpec.topic}》`,
    );
  }

  if (intakeSession.followUpQuestions.length > 0) {
    lines.push(
      `**需要追问**：${intakeSession.followUpQuestions
        .map((question) => question.prompt)
        .join('；')}`,
    );
  }

  if (intakeSession.guardianIssues.length > 0) {
    lines.push(
      `**家长限制处理**：${intakeSession.guardianIssues
        .map((issue) => issue.message)
        .join('；')}`,
    );
  }

  return lines.join('\n');
}
