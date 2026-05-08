/**
 * @license
 * Copyright 2025 OpenGame Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CourseGDD } from '../schemas.js';
import type {
  LessoninBatchAudioRequest,
  LessoninBatchAudioResult,
  LessoninTtsScript,
} from './lessoninTtsService.js';

export interface CourseNarrationManifestSegment {
  id: string;
  name: string;
  targetScene: string;
  text: string;
  audio_uri?: string;
  audio_url?: string;
  expire_at?: string;
  local_path?: string;
  fallbackSubtitle: string;
  status: 'ready' | 'fallback_subtitle';
}

export interface CourseNarrationManifest {
  courseId: string;
  basePath: string;
  type: 'mp3';
  outputDir: string;
  segments: CourseNarrationManifestSegment[];
  fallbackMode: 'none' | 'subtitle_only';
  warnings: string[];
}

export interface BuildNarrationManifestOptions {
  courseId?: string;
  basePath?: string;
  outputDir?: string;
}

export interface BuildNarrationManifestInput extends BuildNarrationManifestOptions {
  courseGdd: CourseGDD;
  ttsResult?: LessoninBatchAudioResult;
  ttsError?: unknown;
}

const DEFAULT_OUTPUT_DIR = 'public/assets/narration';

export function buildLessoninBatchRequestFromCourseGdd(
  courseGdd: CourseGDD,
  options: BuildNarrationManifestOptions = {},
): LessoninBatchAudioRequest {
  const courseId = options.courseId ?? buildCourseId(courseGdd);
  const usedNames = new Map<string, number>();
  return {
    basePath: options.basePath ?? `${courseId}/audio/narration`,
    type: 'mp3',
    scriptList: courseGdd.narrationPlan.segments.map((segment, index) => ({
      name: makeUniqueScriptName(
        sanitizeScriptName(
          segment.id || segment.name || `narration_${index + 1}`,
        ),
        usedNames,
      ),
      script: segment.text,
    })),
  };
}

export function buildCourseNarrationManifest(
  input: BuildNarrationManifestInput,
): CourseNarrationManifest {
  const courseId = input.courseId ?? buildCourseId(input.courseGdd);
  const basePath = input.basePath ?? `${courseId}/audio/narration`;
  const outputDir = input.outputDir ?? DEFAULT_OUTPUT_DIR;
  const request = buildLessoninBatchRequestFromCourseGdd(input.courseGdd, {
    courseId,
    basePath,
  });
  const audioByName = new Map(
    input.ttsResult?.items.map((item) => [item.name, item]) ?? [],
  );
  const warnings = input.ttsError
    ? [`TTS 失败，课程旁白降级为字幕：${toErrorMessage(input.ttsError)}`]
    : [];

  const segments = input.courseGdd.narrationPlan.segments.map(
    (segment, index): CourseNarrationManifestSegment => {
      const script = request.scriptList[index];
      const audio = script ? audioByName.get(script.name) : undefined;
      if (!audio) {
        return {
          id: segment.id,
          name: script?.name ?? sanitizeScriptName(segment.name),
          targetScene: segment.targetScene,
          text: segment.text,
          fallbackSubtitle: segment.text,
          status: 'fallback_subtitle',
        };
      }

      return {
        id: segment.id,
        name: audio.name,
        targetScene: segment.targetScene,
        text: segment.text,
        audio_uri: audio.audio_uri,
        ...(audio.audio_url ? { audio_url: audio.audio_url } : {}),
        ...(audio.expire_at ? { expire_at: audio.expire_at } : {}),
        local_path:
          audio.local_path ??
          `${outputDir.replace(/\/+$/, '')}/${audio.name}.mp3`,
        fallbackSubtitle: segment.text,
        status: 'ready',
      };
    },
  );

  for (const segment of segments) {
    if (segment.status === 'fallback_subtitle' && !input.ttsError) {
      warnings.push(`旁白「${segment.name}」缺少 TTS 结果，已降级为字幕。`);
    }
  }

  return {
    courseId,
    basePath,
    type: 'mp3',
    outputDir,
    segments,
    fallbackMode: segments.some(
      (segment) => segment.status === 'fallback_subtitle',
    )
      ? 'subtitle_only'
      : 'none',
    warnings,
  };
}

export function buildSubtitleOnlyNarrationManifest(
  courseGdd: CourseGDD,
  options: BuildNarrationManifestOptions & { reason?: unknown } = {},
): CourseNarrationManifest {
  return buildCourseNarrationManifest({
    courseGdd,
    courseId: options.courseId,
    basePath: options.basePath,
    outputDir: options.outputDir,
    ttsError: options.reason ?? '未调用 TTS 服务',
  });
}

export function sanitizeScriptName(name: string): string {
  const normalized = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64);

  return normalized || 'narration';
}

function makeUniqueScriptName(
  name: string,
  usedNames: Map<string, number>,
): string {
  const count = usedNames.get(name) ?? 0;
  usedNames.set(name, count + 1);
  return count === 0 ? name : `${name}_${count + 1}`;
}

function buildCourseId(gdd: CourseGDD): string {
  return sanitizeScriptName(
    `${gdd.courseSpec.subject}_${gdd.courseSpec.topic}_${gdd.selectedPlan.id}`,
  );
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export type { LessoninTtsScript };
