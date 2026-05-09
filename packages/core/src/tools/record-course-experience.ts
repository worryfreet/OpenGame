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
  addTemplateExperience,
  createTemplateExperienceStore,
  type RawTemplateExperienceInput,
  type SimilarExperienceQuery,
  type TemplateExperienceStore,
} from '../course/experience/templateExperienceStore.js';
import {
  findSimilarSuccessfulPatterns,
  recordSuccessfulPattern,
  type SuccessfulPatternInput,
} from '../course/experience/successfulPatternIndex.js';
import {
  findSimilarFailurePatterns,
  recordFailurePattern,
  type FailurePatternInput,
} from '../course/experience/failurePatternIndex.js';

export interface RecordCourseExperienceParams {
  store?: TemplateExperienceStore;
  record:
    | SuccessfulPatternInput
    | FailurePatternInput
    | RawTemplateExperienceInput;
  query?: SimilarExperienceQuery;
}

class RecordCourseExperienceInvocation extends BaseToolInvocation<
  RecordCourseExperienceParams,
  ToolResult
> {
  constructor(params: RecordCourseExperienceParams) {
    super(params);
  }

  getDescription(): string {
    return '记录课程成功或失败经验摘要，并返回相似经验检索结果。';
  }

  async execute(_signal: AbortSignal): Promise<ToolResult> {
    try {
      const result = recordCourseExperience(this.params);
      return {
        llmContent: `<course-experience-record>
${JSON.stringify(result, null, 2)}
</course-experience-record>`,
        returnDisplay: `**经验库记录完成**：当前 ${result.store.patterns.length} 条模式，匹配 ${result.matches.length} 条。`,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        llmContent: `Error recording course experience: ${errorMessage}`,
        returnDisplay: `**课程经验记录失败**\n\nError: ${errorMessage}`,
        error: {
          message: errorMessage,
          type: ToolErrorType.EXECUTION_FAILED,
        },
      };
    }
  }
}

export class RecordCourseExperienceTool extends BaseDeclarativeTool<
  RecordCourseExperienceParams,
  ToolResult
> {
  static readonly Name: string = ToolNames.RECORD_COURSE_EXPERIENCE;

  constructor() {
    super(
      RecordCourseExperienceTool.Name,
      ToolDisplayNames.RECORD_COURSE_EXPERIENCE,
      '把成功或失败课程经验写入结构化经验库摘要；不保存学生姓名、头像、语音样本、完整对话或原始输入。',
      Kind.Think,
      {
        type: 'object',
        additionalProperties: false,
        properties: {
          store: { type: 'object' },
          record: { type: 'object' },
          query: { type: 'object' },
        },
        required: ['record'],
      },
      true,
      false,
    );
  }

  protected createInvocation(
    params: RecordCourseExperienceParams,
  ): ToolInvocation<RecordCourseExperienceParams, ToolResult> {
    return new RecordCourseExperienceInvocation(params);
  }
}

export function recordCourseExperience(params: RecordCourseExperienceParams): {
  store: TemplateExperienceStore;
  matches: ReturnType<typeof findSimilarSuccessfulPatterns>;
} {
  const baseStore = params.store ?? createTemplateExperienceStore();
  const nextStore = isFailurePattern(params.record)
    ? recordFailurePattern(baseStore, params.record)
    : isSuccessfulPattern(params.record)
      ? recordSuccessfulPattern(baseStore, params.record)
      : addTemplateExperience(
          baseStore,
          params.record as RawTemplateExperienceInput,
        );
  const matches = params.query
    ? [
        ...findSimilarSuccessfulPatterns(nextStore, params.query),
        ...findSimilarFailurePatterns(nextStore, params.query),
      ].sort((a, b) => b.similarity - a.similarity)
    : [];

  return {
    store: nextStore,
    matches,
  };
}

function isFailurePattern(
  record: RecordCourseExperienceParams['record'],
): record is FailurePatternInput {
  return 'failureReasonTags' in record;
}

function isSuccessfulPattern(
  record: RecordCourseExperienceParams['record'],
): record is SuccessfulPatternInput {
  return 'qualityScore' in record;
}
