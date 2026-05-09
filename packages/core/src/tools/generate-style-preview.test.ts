/**
 * @license
 * Copyright 2025 OpenGame Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import { ToolErrorType } from './tool-error.js';
import { GenerateStylePreviewTool } from './generate-style-preview.js';

describe('GenerateStylePreviewTool', () => {
  it('工具执行输出结构化风格板预览', async () => {
    const tool = new GenerateStylePreviewTool();

    const result = await tool.buildAndExecute(
      {
        styleSpec: {
          theme: '太空基地',
          palette: ['#2563EB', '#F59E0B'],
          visualMood: '明亮清晰',
          characterStyle: '星际小助手',
          uiDensity: 'medium',
          forbidden: ['抽卡'],
        },
        subject: '数学',
        topic: '面积',
        grade: 3,
      },
      new AbortController().signal,
    );

    expect(result.error).toBeUndefined();
    expect(result.llmContent).toContain('<course-style-preview>');
    expect(result.llmContent).toContain('"stylePreview"');
    expect(result.returnDisplay).toContain('太空基地');
  });

  it('缺少 StyleSpec 时由 schema 校验拦截', async () => {
    const tool = new GenerateStylePreviewTool();

    const result = await tool.validateBuildAndExecute(
      {} as never,
      new AbortController().signal,
    );

    expect(result.error?.type).toBe(ToolErrorType.INVALID_TOOL_PARAMS);
    expect(result.error?.message).toContain('styleSpec');
  });
});
