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
import type { GuardianPolicy } from '../course/product/guardianPolicy.js';
import {
  decideAutoRepair,
  recordAutoRepairAttempt,
  type AutoRepairIssue,
  type AutoRepairLoopOptions,
  type AutoRepairLoopState,
} from '../course/quality/autoRepairLoop.js';

export interface RepairCourseGenerationParams {
  state: AutoRepairLoopState;
  policy: GuardianPolicy;
  issue: AutoRepairIssue;
  options?: AutoRepairLoopOptions;
}

class RepairCourseGenerationInvocation extends BaseToolInvocation<
  RepairCourseGenerationParams,
  ToolResult
> {
  constructor(params: RepairCourseGenerationParams) {
    super(params);
  }

  getDescription(): string {
    return `为 ${this.params.issue.target} 阶段问题生成自动修复决策。`;
  }

  async execute(_signal: AbortSignal): Promise<ToolResult> {
    try {
      const decision = decideAutoRepair(this.params);
      const nextState = recordAutoRepairAttempt(this.params.state, decision);
      return {
        llmContent: `<course-generation-repair>
${JSON.stringify({ decision, nextState }, null, 2)}
</course-generation-repair>`,
        returnDisplay: formatDisplayResult(
          decision.status,
          decision.reason,
          decision.executionPlan,
        ),
        ...(decision.status === 'blocked'
          ? {
              error: {
                message: decision.reason,
                type: ToolErrorType.EXECUTION_FAILED,
              },
            }
          : {}),
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        llmContent: `Error repairing course generation: ${errorMessage}`,
        returnDisplay: `**课程生成修复失败**\n\nError: ${errorMessage}`,
        error: {
          message: errorMessage,
          type: ToolErrorType.EXECUTION_FAILED,
        },
      };
    }
  }
}

export class RepairCourseGenerationTool extends BaseDeclarativeTool<
  RepairCourseGenerationParams,
  ToolResult
> {
  static readonly Name: string = ToolNames.REPAIR_COURSE_GENERATION;

  constructor() {
    super(
      RepairCourseGenerationTool.Name,
      ToolDisplayNames.REPAIR_COURSE_GENERATION,
      '根据质量、素材、TTS、构建或浏览器问题生成自动修复决策，并记录 AutoRepairAttempt。',
      Kind.Think,
      {
        type: 'object',
        additionalProperties: false,
        properties: {
          state: { type: 'object' },
          policy: { type: 'object' },
          issue: { type: 'object' },
          options: { type: 'object' },
        },
        required: ['state', 'policy', 'issue'],
      },
      true,
      false,
    );
  }

  protected createInvocation(
    params: RepairCourseGenerationParams,
  ): ToolInvocation<RepairCourseGenerationParams, ToolResult> {
    return new RepairCourseGenerationInvocation(params);
  }
}

function formatDisplayResult(
  status: string,
  reason: string,
  executionPlan: string[],
): string {
  return [
    `**自动修复状态**：${status}`,
    `**原因**：${reason}`,
    `**执行链路**：${executionPlan.join(' -> ')}`,
  ].join('\n');
}
