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
  reviseCoursePlan,
  type ReviseCoursePlanInput,
  type ReviseCoursePlanResult,
} from '../course/product/courseRevision.js';

export type ReviseCoursePlanParams = ReviseCoursePlanInput;

class ReviseCoursePlanInvocation extends BaseToolInvocation<
  ReviseCoursePlanParams,
  ToolResult
> {
  constructor(params: ReviseCoursePlanParams) {
    super(params);
  }

  getDescription(): string {
    return `修订课程方案「${this.params.request.basePlanId}」。`;
  }

  async execute(_signal: AbortSignal): Promise<ToolResult> {
    try {
      const result = reviseCoursePlan(this.params);
      const resultJson = JSON.stringify({ revision: result }, null, 2);

      return {
        llmContent: `<course-revision>
${resultJson}
</course-revision>`,
        returnDisplay: formatDisplayResult(result),
        ...(result.status === 'blocked'
          ? {
              error: {
                message: formatIssues(result.validationIssues),
                type: ToolErrorType.EXECUTION_FAILED,
              },
            }
          : {}),
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        llmContent: `Error revising course plan: ${errorMessage}`,
        returnDisplay: `**课程方案修订失败**\n\nError: ${errorMessage}`,
        error: {
          message: errorMessage,
          type: ToolErrorType.EXECUTION_FAILED,
        },
      };
    }
  }
}

export class ReviseCoursePlanTool extends BaseDeclarativeTool<
  ReviseCoursePlanParams,
  ToolResult
> {
  static readonly Name: string = ToolNames.REVISE_COURSE_PLAN;

  constructor() {
    super(
      ReviseCoursePlanTool.Name,
      ToolDisplayNames.REVISE_COURSE_PLAN,
      '对课程结构化计划或 Course GDD 应用轻量修订，只修改 CourseSpec、CoursePlanOption 或 CourseGDD，不直接改生成后源码。',
      Kind.Think,
      {
        type: 'object',
        additionalProperties: false,
        properties: {
          request: {
            type: 'object',
            additionalProperties: false,
            required: ['basePlanId', 'changes'],
            properties: {
              basePlanId: { type: 'string', minLength: 1 },
              changes: {
                type: 'array',
                minItems: 1,
                items: {
                  type: 'object',
                  additionalProperties: true,
                  required: ['type'],
                  properties: {
                    type: {
                      enum: [
                        'change_depth',
                        'change_theme',
                        'change_character',
                        'change_palette',
                        'replace_question',
                        'disable_video',
                        'change_tts',
                      ],
                    },
                  },
                },
              },
            },
          },
          courseSpec: { type: 'object' },
          selectedPlan: { type: 'object' },
          courseGdd: { type: 'object' },
        },
        required: ['request'],
      },
      true,
      false,
    );
  }

  protected createInvocation(
    params: ReviseCoursePlanParams,
  ): ToolInvocation<ReviseCoursePlanParams, ToolResult> {
    return new ReviseCoursePlanInvocation(params);
  }
}

function formatDisplayResult(result: ReviseCoursePlanResult): string {
  const lines = [
    `**修订状态**：${result.status === 'ready' ? '可继续生成' : '需要处理阻断项'}`,
    `**已应用变更**：${result.appliedChanges.map((item) => item.summary).join('；') || '无'}`,
  ];

  if (result.validationIssues.length > 0) {
    lines.push(`**阻断项**：${formatIssues(result.validationIssues)}`);
  }
  if (result.warnings.length > 0) {
    lines.push(`**提醒**：${formatIssues(result.warnings)}`);
  }

  return lines.join('\n');
}

function formatIssues(
  issues: ReviseCoursePlanResult['validationIssues'],
): string {
  return issues
    .map((issue) => `${issue.path || '/'} ${issue.message}`)
    .join('；');
}
