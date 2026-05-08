/**
 * @license
 * Copyright 2025 OpenGame Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {
  BaseDeclarativeTool,
  BaseToolInvocation,
  Kind,
  type ToolInvocation,
  type ToolResult,
} from './tools.js';
import { ToolErrorType } from './tool-error.js';
import type { Config } from '../config/config.js';
import type { CourseGDD } from '../course/schemas.js';
import { courseGddSchema } from '../course/schemas.js';
import {
  buildCourseNarrationManifest,
  buildLessoninBatchRequestFromCourseGdd,
  buildSubtitleOnlyNarrationManifest,
  type CourseNarrationManifest,
} from '../course/tts/narrationManifest.js';
import { LessoninTtsService } from '../course/tts/lessoninTtsService.js';
import {
  validateCourseGdd,
  type CourseValidationIssue,
} from '../course/validation.js';
import { ToolDisplayNames, ToolNames } from './tool-names.js';

export interface CourseTtsManifestParams {
  packageDir: string;
  courseGdd: CourseGDD;
  manifestPath?: string;
  courseId?: string;
  basePath?: string;
  outputDir?: string;
  lessoninBaseUrl?: string;
  cookie?: string;
  headers?: Record<string, string>;
  skipTts?: boolean;
}

export interface CourseTtsManifestResult {
  manifestPath: string;
  manifest: CourseNarrationManifest;
  ttsAttempted: boolean;
  request: ReturnType<typeof buildLessoninBatchRequestFromCourseGdd>;
}

class CourseTtsManifestInvocation extends BaseToolInvocation<
  CourseTtsManifestParams,
  ToolResult
> {
  constructor(
    private config: Config,
    params: CourseTtsManifestParams,
  ) {
    super(params);
  }

  getDescription(): string {
    return `生成课程旁白 manifest：${this.params.packageDir}`;
  }

  async execute(signal: AbortSignal): Promise<ToolResult> {
    try {
      const result = await generateCourseTtsManifest(this.config, this.params, {
        signal,
      });
      const resultJson = JSON.stringify(result, null, 2);

      return {
        llmContent: `<course-tts-manifest>
${resultJson}
</course-tts-manifest>`,
        returnDisplay: formatDisplay(result),
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        llmContent: `Error generating course TTS manifest: ${errorMessage}`,
        returnDisplay: `**课程旁白 manifest 生成失败**\n\nError: ${errorMessage}`,
        error: {
          message: errorMessage,
          type: ToolErrorType.EXECUTION_FAILED,
        },
      };
    }
  }
}

export class CourseTtsManifestTool extends BaseDeclarativeTool<
  CourseTtsManifestParams,
  ToolResult
> {
  static readonly Name: string = ToolNames.COURSE_TTS_MANIFEST;

  constructor(private config: Config) {
    super(
      CourseTtsManifestTool.Name,
      ToolDisplayNames.COURSE_TTS_MANIFEST,
      '基于 Course GDD 调用本地 lessonin TTS 生成课程旁白 manifest；TTS 失败时自动写入字幕降级 manifest。',
      Kind.Execute,
      {
        type: 'object',
        additionalProperties: false,
        properties: {
          packageDir: { type: 'string', minLength: 1 },
          courseGdd: courseGddSchema,
          manifestPath: { type: 'string', minLength: 1 },
          courseId: { type: 'string', minLength: 1 },
          basePath: { type: 'string', minLength: 1 },
          outputDir: { type: 'string', minLength: 1 },
          lessoninBaseUrl: { type: 'string', minLength: 1 },
          cookie: { type: 'string', minLength: 1 },
          headers: {
            type: 'object',
            additionalProperties: { type: 'string' },
          },
          skipTts: { type: 'boolean' },
        },
        required: ['packageDir', 'courseGdd'],
      },
      false,
      true,
    );
  }

  protected override validateToolParamValues(
    params: CourseTtsManifestParams,
  ): string | null {
    const validation = validateCourseGdd(params.courseGdd);
    if (!validation.valid) {
      return `Course GDD 校验失败：${formatIssues(validation.errors)}`;
    }
    return null;
  }

  protected createInvocation(
    params: CourseTtsManifestParams,
  ): ToolInvocation<CourseTtsManifestParams, ToolResult> {
    return new CourseTtsManifestInvocation(this.config, params);
  }
}

export async function generateCourseTtsManifest(
  config: Config,
  params: CourseTtsManifestParams,
  options: { signal?: AbortSignal } = {},
): Promise<CourseTtsManifestResult> {
  const validation = validateCourseGdd(params.courseGdd);
  if (!validation.valid || !validation.data) {
    throw new Error(`Course GDD 校验失败：${formatIssues(validation.errors)}`);
  }

  const packageDir = resolvePackageDir(config, params.packageDir);
  const outputDir = params.outputDir ?? 'public/assets/narration';
  const manifestPath = resolveInsidePackage(
    packageDir,
    params.manifestPath ?? `${outputDir}/narration-manifest.json`,
  );
  const manifestOptions = {
    courseId: params.courseId,
    basePath: params.basePath,
    outputDir,
  };
  const request = buildLessoninBatchRequestFromCourseGdd(
    validation.data,
    manifestOptions,
  );

  let manifest: CourseNarrationManifest;
  let ttsAttempted = false;
  if (params.skipTts) {
    manifest = buildSubtitleOnlyNarrationManifest(validation.data, {
      ...manifestOptions,
      reason: 'skipTts=true',
    });
  } else {
    ttsAttempted = true;
    try {
      const service = new LessoninTtsService({
        baseUrl: params.lessoninBaseUrl,
        cookie: params.cookie,
        headers: params.headers,
        fetchImpl: buildAbortableFetch(options.signal),
      });
      const ttsResult = await service.generateBatchAudio(request);
      manifest = buildCourseNarrationManifest({
        courseGdd: validation.data,
        ...manifestOptions,
        ttsResult,
      });
    } catch (error) {
      manifest = buildSubtitleOnlyNarrationManifest(validation.data, {
        ...manifestOptions,
        reason: error,
      });
    }
  }

  await fs.mkdir(path.dirname(manifestPath), { recursive: true });
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));

  return {
    manifestPath,
    manifest,
    ttsAttempted,
    request,
  };
}

function buildAbortableFetch(signal: AbortSignal | undefined): typeof fetch {
  if (!signal) return fetch;
  return (input, init) => fetch(input, { ...init, signal });
}

function resolvePackageDir(config: Config, packageDir: string): string {
  if (path.isAbsolute(packageDir)) {
    return path.normalize(packageDir);
  }
  const root = getProjectRoot(config);
  return path.resolve(root, packageDir);
}

function resolveInsidePackage(packageDir: string, filePath: string): string {
  return path.isAbsolute(filePath) ? filePath : path.join(packageDir, filePath);
}

function getProjectRoot(config: Config): string {
  const maybeConfig = config as Config & { getProjectRoot?: () => string };
  return maybeConfig.getProjectRoot?.() ?? process.cwd();
}

function formatDisplay(result: CourseTtsManifestResult): string {
  const ready = result.manifest.segments.filter(
    (segment) => segment.status === 'ready',
  ).length;
  const fallback = result.manifest.segments.length - ready;
  return `**课程旁白 manifest 已生成**

- 文件：${result.manifestPath}
- TTS 调用：${result.ttsAttempted ? '已尝试' : '已跳过'}
- 可播放音频：${ready}
- 字幕降级：${fallback}
- fallbackMode：${result.manifest.fallbackMode}`;
}

function formatIssues(issues: CourseValidationIssue[]): string {
  return issues
    .map((issue) => `${issue.path || '/'} ${issue.message}`)
    .join('；');
}

