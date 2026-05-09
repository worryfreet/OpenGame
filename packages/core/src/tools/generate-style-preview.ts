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
  generateStylePreview,
  type StylePreview,
  type StylePreviewInput,
} from '../course/product/stylePreview.js';

export type GenerateStylePreviewParams = StylePreviewInput;

class GenerateStylePreviewInvocation extends BaseToolInvocation<
  GenerateStylePreviewParams,
  ToolResult
> {
  constructor(params: GenerateStylePreviewParams) {
    super(params);
  }

  getDescription(): string {
    return `生成「${this.params.styleSpec.theme}」课程风格板预览。`;
  }

  async execute(_signal: AbortSignal): Promise<ToolResult> {
    try {
      const preview = generateStylePreview(this.params);
      const resultJson = JSON.stringify({ stylePreview: preview }, null, 2);

      return {
        llmContent: `<course-style-preview>
${resultJson}
</course-style-preview>`,
        returnDisplay: formatDisplayResult(preview),
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        llmContent: `Error generating style preview: ${errorMessage}`,
        returnDisplay: `**课程风格板预览失败**\n\nError: ${errorMessage}`,
        error: {
          message: errorMessage,
          type: ToolErrorType.EXECUTION_FAILED,
        },
      };
    }
  }
}

export class GenerateStylePreviewTool extends BaseDeclarativeTool<
  GenerateStylePreviewParams,
  ToolResult
> {
  static readonly Name: string = ToolNames.GENERATE_STYLE_PREVIEW;

  constructor() {
    super(
      GenerateStylePreviewTool.Name,
      ToolDisplayNames.GENERATE_STYLE_PREVIEW,
      '基于 StyleSpec 和参考图描述生成课程风格板预览，不进入完整素材生成，并阻断知名 IP 风格直接进入 previewPrompt。',
      Kind.Think,
      {
        type: 'object',
        additionalProperties: false,
        properties: {
          styleSpec: {
            type: 'object',
            additionalProperties: false,
            required: [
              'theme',
              'palette',
              'visualMood',
              'characterStyle',
              'uiDensity',
              'forbidden',
            ],
            properties: {
              theme: { type: 'string', minLength: 1 },
              palette: {
                type: 'array',
                items: { type: 'string', minLength: 1 },
                minItems: 1,
              },
              referenceImages: {
                type: 'array',
                items: { type: 'string', minLength: 1 },
              },
              visualMood: { type: 'string', minLength: 1 },
              characterStyle: { type: 'string', minLength: 1 },
              uiDensity: { enum: ['low', 'medium', 'high'] },
              forbidden: {
                type: 'array',
                items: { type: 'string', minLength: 1 },
              },
            },
          },
          subject: { type: 'string' },
          topic: { type: 'string' },
          grade: { type: 'integer', minimum: 1, maximum: 6 },
          referenceImageAnalysis: { type: 'string' },
        },
        required: ['styleSpec'],
      },
      true,
      false,
    );
  }

  protected createInvocation(
    params: GenerateStylePreviewParams,
  ): ToolInvocation<GenerateStylePreviewParams, ToolResult> {
    return new GenerateStylePreviewInvocation(params);
  }
}

function formatDisplayResult(preview: StylePreview): string {
  const lines = [
    `**风格主题**：${preview.styleSpec.theme}`,
    `**配色**：${preview.palette.join('、')}`,
    `**角色方向**：${preview.characterDirection}`,
    `**UI 情绪**：${preview.uiMood}`,
  ];

  if (preview.safetyWarnings.length > 0) {
    lines.push(`**安全处理**：${preview.safetyWarnings.join('；')}`);
  }

  return lines.join('\n');
}
