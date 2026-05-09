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
import {
  planNextCourse,
  type NextCoursePlannerInput,
  type NextCoursePlannerResult,
} from '../course/product/nextCoursePlanner.js';

export type GenerateNextCourseSpecParams = NextCoursePlannerInput;

class GenerateNextCourseSpecInvocation extends BaseToolInvocation<
  GenerateNextCourseSpecParams,
  ToolResult
> {
  constructor(params: GenerateNextCourseSpecParams) {
    super(params);
  }

  getDescription(): string {
    return `为 profile ${this.params.profileId} 生成下一课 CourseSpec。`;
  }

  async execute(_signal: AbortSignal): Promise<ToolResult> {
    try {
      const result = planNextCourse(this.params);
      const resultJson = JSON.stringify({ nextCourse: result }, null, 2);

      return {
        llmContent: `<next-course-spec>
${resultJson}
</next-course-spec>`,
        returnDisplay: formatDisplayResult(result),
        ...(result.status === 'needs_intake'
          ? {
              error: {
                message: formatBlockingMessage(result),
                type: ToolErrorType.EXECUTION_FAILED,
              },
            }
          : {}),
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        llmContent: `Error generating next course spec: ${errorMessage}`,
        returnDisplay: `**下一课生成失败**\n\nError: ${errorMessage}`,
        error: {
          message: errorMessage,
          type: ToolErrorType.EXECUTION_FAILED,
        },
      };
    }
  }
}

export class GenerateNextCourseSpecTool extends BaseDeclarativeTool<
  GenerateNextCourseSpecParams,
  ToolResult
> {
  static readonly Name: string = ToolNames.GENERATE_NEXT_COURSE_SPEC;

  constructor() {
    super(
      GenerateNextCourseSpecTool.Name,
      ToolDisplayNames.GENERATE_NEXT_COURSE_SPEC,
      '基于学习报告、学习状态、历史偏好和上一课信息生成下一课 CourseSpec；学习状态不足时返回输入向导追问。',
      Kind.Think,
      {
        type: 'object',
        additionalProperties: false,
        properties: {
          profileId: { type: 'string', minLength: 1 },
          subject: { type: 'string' },
          previousCourseSpec: { type: 'object' },
          learningState: { type: 'object' },
          learningReport: { type: 'object' },
          preferenceProfile: { type: 'object' },
          previousGameplayType: { type: 'string' },
          requestedMode: {
            enum: ['next_lesson', 'reinforcement', 'same_topic_new_gameplay'],
          },
        },
        required: ['profileId'],
      },
      true,
      false,
    );
  }

  protected createInvocation(
    params: GenerateNextCourseSpecParams,
  ): ToolInvocation<GenerateNextCourseSpecParams, ToolResult> {
    return new GenerateNextCourseSpecInvocation(params);
  }
}

function formatDisplayResult(result: NextCoursePlannerResult): string {
  const lines = [
    `**续作状态**：${result.status === 'ready' ? '可生成下一课' : '需要补充信息'}`,
    `**续作模式**：${formatMode(result.rationale.mode)}`,
  ];

  if (result.courseSpec) {
    lines.push(
      `**下一课**：${result.courseSpec.studentProfile.grade} 年级 ${result.courseSpec.subject}《${result.courseSpec.topic}》`,
    );
    lines.push(`**学习目标**：${result.courseSpec.learningGoals.join('；')}`);
  }

  if (result.followUpQuestions.length > 0) {
    lines.push(
      `**需要追问**：${result.followUpQuestions
        .map((question) => question.prompt)
        .join('；')}`,
    );
  }

  return lines.join('\n');
}

function formatBlockingMessage(result: NextCoursePlannerResult): string {
  const questions = result.followUpQuestions
    .map((question) => question.prompt)
    .join('；');
  const issues = result.validationIssues
    .map((issue) => `${issue.path || '/'} ${issue.message}`)
    .join('；');
  return [questions, issues].filter(Boolean).join('；') || '下一课信息不足。';
}

function formatMode(
  mode: NextCoursePlannerResult['rationale']['mode'],
): string {
  const map: Record<NextCoursePlannerResult['rationale']['mode'], string> = {
    next_lesson: '下一节',
    reinforcement: '强化练习',
    same_topic_new_gameplay: '同主题新玩法',
  };
  return map[mode];
}
