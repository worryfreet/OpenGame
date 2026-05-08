/**
 * @license
 * Copyright 2025 OpenGame Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

export interface LessoninTtsScript {
  name: string;
  script: string;
}

export interface LessoninBatchAudioRequest {
  basePath: string;
  type: 'mp3';
  scriptList: LessoninTtsScript[];
}

export interface LessoninBatchAudioItem {
  name: string;
  audio_uri: string;
  audio_url?: string;
  expire_at?: string;
  local_path?: string;
}

export interface LessoninBatchAudioResult {
  items: LessoninBatchAudioItem[];
}

export interface LessoninTtsServiceOptions {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  cookie?: string;
  headers?: Record<string, string>;
}

interface LessoninBatchApiResponse {
  code?: number;
  message?: string;
  data?: {
    items?: unknown;
  };
  items?: unknown;
}

const DEFAULT_LESSONIN_BASE_URL = 'http://127.0.0.1:8888';
const BATCH_AUDIO_PATH = '/api/v1/ai/generate/audio/v2/batch';

export class LessoninTtsService {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly cookie?: string;
  private readonly headers: Record<string, string>;

  constructor(options: LessoninTtsServiceOptions = {}) {
    this.baseUrl = trimTrailingSlash(
      options.baseUrl ?? DEFAULT_LESSONIN_BASE_URL,
    );
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.cookie = options.cookie;
    this.headers = options.headers ?? {};
  }

  async generateBatchAudio(
    request: LessoninBatchAudioRequest,
  ): Promise<LessoninBatchAudioResult> {
    validateBatchAudioRequest(request);

    const response = await this.fetchImpl(
      `${this.baseUrl}${BATCH_AUDIO_PATH}`,
      {
        method: 'POST',
        headers: this.buildHeaders(),
        body: JSON.stringify(request),
      },
    );

    if (!response.ok) {
      throw new Error(
        `Lessonin TTS 请求失败：HTTP ${response.status} ${response.statusText}`,
      );
    }

    const payload = (await response.json()) as LessoninBatchApiResponse;
    if (typeof payload.code === 'number' && payload.code !== 0) {
      throw new Error(
        `Lessonin TTS 业务错误：${payload.message ?? `code ${payload.code}`}`,
      );
    }

    return normalizeBatchAudioResponse(payload, request.scriptList);
  }

  private buildHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      ...this.headers,
      ...(this.cookie ? { Cookie: this.cookie } : {}),
    };
  }
}

export function validateBatchAudioRequest(
  request: LessoninBatchAudioRequest,
): void {
  if (!request.basePath.trim()) {
    throw new Error('Lessonin TTS basePath 不能为空。');
  }
  if (request.type !== 'mp3') {
    throw new Error('Lessonin TTS MVP 仅支持 mp3 输出。');
  }
  if (request.scriptList.length === 0) {
    throw new Error('Lessonin TTS scriptList 不能为空。');
  }

  const names = new Set<string>();
  for (const item of request.scriptList) {
    if (!isSafeScriptName(item.name)) {
      throw new Error(
        `Lessonin TTS scriptList.name「${item.name}」非法，不能包含路径分隔符或 ..。`,
      );
    }
    if (!item.script.trim()) {
      throw new Error(`Lessonin TTS script「${item.name}」不能为空。`);
    }
    if (names.has(item.name)) {
      throw new Error(`Lessonin TTS scriptList.name「${item.name}」重复。`);
    }
    names.add(item.name);
  }
}

function normalizeBatchAudioResponse(
  payload: LessoninBatchApiResponse,
  scripts: LessoninTtsScript[],
): LessoninBatchAudioResult {
  const rawItems = payload.data?.items ?? payload.items;
  if (!Array.isArray(rawItems)) {
    throw new Error('Lessonin TTS 响应缺少 data.items。');
  }

  const items = rawItems.map((item, index) =>
    normalizeBatchAudioItem(item, scripts[index]?.name),
  );
  const expectedNames = new Set(scripts.map((script) => script.name));
  const returnedNames = new Set(items.map((item) => item.name));

  for (const name of expectedNames) {
    if (!returnedNames.has(name)) {
      throw new Error(`Lessonin TTS 响应缺少脚本「${name}」的音频结果。`);
    }
  }

  return { items };
}

function normalizeBatchAudioItem(
  item: unknown,
  fallbackName?: string,
): LessoninBatchAudioItem {
  if (!item || typeof item !== 'object') {
    throw new Error('Lessonin TTS 响应 item 不是对象。');
  }

  const record = item as Record<string, unknown>;
  const name = stringField(record.name) ?? fallbackName;
  const audioUri = stringField(record.audio_uri);
  if (!name) {
    throw new Error('Lessonin TTS 响应 item 缺少 name。');
  }
  if (!audioUri) {
    throw new Error(`Lessonin TTS 响应 item「${name}」缺少 audio_uri。`);
  }

  return {
    name,
    audio_uri: audioUri,
    ...(stringField(record.audio_url)
      ? { audio_url: stringField(record.audio_url) }
      : {}),
    ...(stringField(record.expire_at)
      ? { expire_at: stringField(record.expire_at) }
      : {}),
    ...(stringField(record.local_path)
      ? { local_path: stringField(record.local_path) }
      : {}),
  };
}

function isSafeScriptName(name: string): boolean {
  return Boolean(
    name.trim() &&
    !name.includes('/') &&
    !name.includes('\\') &&
    !name.includes('..'),
  );
}

function stringField(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}
