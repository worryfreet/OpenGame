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
  promptToCourseSpec,
  type OneShotCourseRequest,
  type PromptToCourseSpecResult,
} from '../course/one-shot/promptToCourseSpec.js';

export type GenerateOneShotCoursePlanParams = OneShotCourseRequest;

export interface GenerateOneShotCoursePlanResult {
  promptResult: PromptToCourseSpecResult;
  nextTool: 'generate_course_plan' | 'clarify_with_user' | 'blocked';
}

class GenerateOneShotCoursePlanInvocation extends BaseToolInvocation<
  GenerateOneShotCoursePlanParams,
  ToolResult
> {
  constructor(params: GenerateOneShotCoursePlanParams) {
    super(params);
  }

  getDescription(): string {
    return '把一句话课程目标补全为受控 CourseSpec，并判断能否进入课程方案生成。';
  }

  async execute(_signal: AbortSignal): Promise<ToolResult> {
    try {
      const result = generateOneShotCoursePlan(this.params);
      return {
        llmContent: `<one-shot-course-plan>
${JSON.stringify(result, null, 2)}
</one-shot-course-plan>`,
        returnDisplay: formatDisplayResult(result),
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        llmContent: `Error generating one-shot course plan: ${errorMessage}`,
        returnDisplay: `**一句话课程解析失败**\n\nError: ${errorMessage}`,
        error: {
          message: errorMessage,
          type: ToolErrorType.EXECUTION_FAILED,
        },
      };
    }
  }
}

export class GenerateOneShotCoursePlanTool extends BaseDeclarativeTool<
  GenerateOneShotCoursePlanParams,
  ToolResult
> {
  static readonly Name: string = ToolNames.GENERATE_ONE_SHOT_COURSE_PLAN;

  constructor() {
    super(
      GenerateOneShotCoursePlanTool.Name,
      ToolDisplayNames.GENERATE_ONE_SHOT_COURSE_PLAN,
      '把学生或家长的一句话课程目标解析为受控 CourseSpec；信息足够时提示继续调用 generate_course_plan，信息不足时只返回关键追问。',
      Kind.Think,
      {
        type: 'object',
        additionalProperties: false,
        properties: {
          text: { type: 'string', minLength: 1 },
          profileId: { type: 'string' },
          preferenceProfile: { type: 'object' },
          learningState: { type: 'object' },
          guardianPolicy: { type: 'object' },
        },
        required: ['text'],
      },
      true,
      false,
    );
  }

  protected createInvocation(
    params: GenerateOneShotCoursePlanParams,
  ): ToolInvocation<GenerateOneShotCoursePlanParams, ToolResult> {
    return new GenerateOneShotCoursePlanInvocation(params);
  }
}

export function generateOneShotCoursePlan(
  input: GenerateOneShotCoursePlanParams,
): GenerateOneShotCoursePlanResult {
  const promptResult = promptToCourseSpec(input);
  const nextTool =
    promptResult.blockedReasons.length > 0
      ? 'blocked'
      : promptResult.courseSpec
        ? 'generate_course_plan'
        : 'clarify_with_user';

  return {
    promptResult,
    nextTool,
  };
}

function formatDisplayResult(result: GenerateOneShotCoursePlanResult): string {
  const { promptResult } = result;
  const lines = [
    `**一句话解析置信度**：${Math.round(promptResult.confidence * 100)}%`,
    `**下一步**：${formatNextTool(result.nextTool)}`,
  ];

  if (promptResult.courseSpec) {
    lines.push(
      `**CourseSpec**：${promptResult.courseSpec.studentProfile.grade} 年级 ${promptResult.courseSpec.subject}《${promptResult.courseSpec.topic}》`,
    );
  }
  if (promptResult.requiredClarifications.length > 0) {
    lines.push(
      `**需要追问**：${promptResult.requiredClarifications
        .map((question) => question.prompt)
        .join('；')}`,
    );
  }
  if (promptResult.assumptions.length > 0) {
    lines.push(`**系统假设**：${promptResult.assumptions.join('；')}`);
  }
  if (promptResult.blockedReasons.length > 0) {
    lines.push(`**阻断原因**：${promptResult.blockedReasons.join('；')}`);
  }

  return lines.join('\n');
}

function formatNextTool(
  nextTool: GenerateOneShotCoursePlanResult['nextTool'],
): string {
  if (nextTool === 'generate_course_plan') {
    return '调用 generate_course_plan 生成 3 个受控课程游戏方案';
  }
  if (nextTool === 'clarify_with_user') {
    return '先向用户追问关键缺失信息';
  }
  return '停止生成并解释阻断原因';
}
