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
import type { CoursePlanOption, CourseSpec } from '../course/schemas.js';
import { coursePlanOptionSchema, courseSpecSchema } from '../course/schemas.js';
import {
  scoreCourseQuality,
  type CourseQualityReview,
} from '../course/quality/courseQualityScorer.js';

export interface ScoreCourseQualityParams {
  courseSpec: CourseSpec;
  plan?: CoursePlanOption;
}

class ScoreCourseQualityInvocation extends BaseToolInvocation<
  ScoreCourseQualityParams,
  ToolResult
> {
  constructor(params: ScoreCourseQualityParams) {
    super(params);
  }

  getDescription(): string {
    return '对课程方案进行教学深度、精彩度、适龄、安全和可玩风险质量评分。';
  }

  async execute(_signal: AbortSignal): Promise<ToolResult> {
    try {
      const review = scoreCourseQuality(this.params);
      return {
        llmContent: `<course-quality-score>
${JSON.stringify({ review }, null, 2)}
</course-quality-score>`,
        returnDisplay: formatDisplayReview(review),
        ...(review.passed
          ? {}
          : {
              error: {
                message: `课程质量门禁未通过：${review.score.blockingIssues.join('；')}`,
                type: ToolErrorType.EXECUTION_FAILED,
              },
            }),
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        llmContent: `Error scoring course quality: ${errorMessage}`,
        returnDisplay: `**课程质量评分失败**\n\nError: ${errorMessage}`,
        error: {
          message: errorMessage,
          type: ToolErrorType.EXECUTION_FAILED,
        },
      };
    }
  }
}

export class ScoreCourseQualityTool extends BaseDeclarativeTool<
  ScoreCourseQualityParams,
  ToolResult
> {
  static readonly Name: string = ToolNames.SCORE_COURSE_QUALITY;

  constructor() {
    super(
      ScoreCourseQualityTool.Name,
      ToolDisplayNames.SCORE_COURSE_QUALITY,
      '对 CourseSpec 和可选 CoursePlanOption 进行 MVP 3.0 质量门禁评分；低质量方案不能进入高成本资产生成。',
      Kind.Think,
      {
        type: 'object',
        additionalProperties: false,
        properties: {
          courseSpec: courseSpecSchema,
          plan: coursePlanOptionSchema,
        },
        required: ['courseSpec'],
      },
      true,
      false,
    );
  }

  protected createInvocation(
    params: ScoreCourseQualityParams,
  ): ToolInvocation<ScoreCourseQualityParams, ToolResult> {
    return new ScoreCourseQualityInvocation(params);
  }
}

function formatDisplayReview(review: CourseQualityReview): string {
  const score = review.score;
  const lines = [
    `**课程质量总分**：${score.total}`,
    `**教学深度**：${score.pedagogyDepth}`,
    `**游戏精彩度**：${score.gameplayExcitement}`,
    `**适龄性**：${score.ageFit}`,
    `**视觉一致性**：${score.visualConsistency}`,
    `**可玩风险**：${score.playabilityRisk}`,
    `**安全性**：${score.safety}`,
    `**门禁结果**：${review.passed ? '通过' : '未通过'}`,
  ];
  if (score.blockingIssues.length > 0) {
    lines.push(`**阻断问题**：${score.blockingIssues.join('；')}`);
  }
  if (score.improvementActions.length > 0) {
    lines.push(`**改进动作**：${score.improvementActions.join('；')}`);
  }
  return lines.join('\n');
}
