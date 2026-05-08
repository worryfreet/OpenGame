/**
 * @license
 * Copyright 2025 OpenGame Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it, vi } from 'vitest';
import {
  LessoninTtsService,
  validateBatchAudioRequest,
  type LessoninBatchAudioRequest,
} from './lessoninTtsService.js';

describe('LessoninTtsService', () => {
  it('按 lessonin 批量接口格式发送 scriptList 并读取 audio_uri', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        code: 0,
        data: {
          items: [
            {
              name: 'intro',
              audio_uri: 'course/audio/intro.mp3',
              audio_url: 'https://example.test/intro.mp3',
              expire_at: '2026-05-09T00:00:00Z',
            },
          ],
        },
      }),
    } as Response);
    const service = new LessoninTtsService({
      baseUrl: 'http://127.0.0.1:8888/',
      fetchImpl,
      cookie: 'sid=test',
      headers: { 'X-Test': 'yes' },
    });

    const request: LessoninBatchAudioRequest = {
      basePath: 'course/audio',
      type: 'mp3',
      scriptList: [{ name: 'intro', script: '欢迎进入课程。' }],
    };
    const result = await service.generateBatchAudio(request);

    expect(fetchImpl).toHaveBeenCalledWith(
      'http://127.0.0.1:8888/api/v1/ai/generate/audio/v2/batch',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: 'sid=test',
          'X-Test': 'yes',
        },
        body: JSON.stringify(request),
      }),
    );
    expect(result.items[0]).toMatchObject({
      name: 'intro',
      audio_uri: 'course/audio/intro.mp3',
    });
  });

  it('拒绝非法或重复的 scriptList.name', () => {
    expect(() =>
      validateBatchAudioRequest({
        basePath: 'course/audio',
        type: 'mp3',
        scriptList: [{ name: '../intro', script: 'text' }],
      }),
    ).toThrow('非法');

    expect(() =>
      validateBatchAudioRequest({
        basePath: 'course/audio',
        type: 'mp3',
        scriptList: [
          { name: 'intro', script: 'text' },
          { name: 'intro', script: 'text' },
        ],
      }),
    ).toThrow('重复');
  });

  it('业务错误或缺少 audio_uri 时失败，不伪造成功结果', async () => {
    const serviceWithBusinessError = new LessoninTtsService({
      fetchImpl: vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ code: 500, message: 'tts failed' }),
      } as Response),
    });

    await expect(
      serviceWithBusinessError.generateBatchAudio({
        basePath: 'course/audio',
        type: 'mp3',
        scriptList: [{ name: 'intro', script: 'text' }],
      }),
    ).rejects.toThrow('tts failed');

    const serviceWithoutAudioUri = new LessoninTtsService({
      fetchImpl: vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          code: 0,
          data: { items: [{ name: 'intro', audio_url: 'temporary-url' }] },
        }),
      } as Response),
    });

    await expect(
      serviceWithoutAudioUri.generateBatchAudio({
        basePath: 'course/audio',
        type: 'mp3',
        scriptList: [{ name: 'intro', script: 'text' }],
      }),
    ).rejects.toThrow('缺少 audio_uri');
  });
});
