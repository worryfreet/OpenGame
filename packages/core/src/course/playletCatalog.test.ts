/**
 * @license
 * Copyright 2025 OpenGame Contributors
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import {
  GAMEPLAY_SUPERCLASSES,
  PLAYLET_TEMPLATES,
  READY_PLAYLET_TEMPLATES,
  getPlayletTemplate,
  isReadyPlaylet,
} from './playletCatalog.js';

describe('playletCatalog', () => {
  it('首批 40 个具体玩法模板为 ready，其余玩法进入 planned 池', () => {
    const ready = PLAYLET_TEMPLATES.filter(
      (template) => template.status === 'ready',
    );
    const planned = PLAYLET_TEMPLATES.filter(
      (template) => template.status === 'planned',
    );

    expect(ready).toHaveLength(40);
    expect(READY_PLAYLET_TEMPLATES).toHaveLength(40);
    expect(planned.length).toBeGreaterThan(60);
    expect(PLAYLET_TEMPLATES).toHaveLength(114);
  });

  it('首批玩法覆盖全部玩法超类', () => {
    const readySuperclasses = new Set(
      READY_PLAYLET_TEMPLATES.map((template) => template.superclass),
    );

    expect([...readySuperclasses].sort()).toEqual(
      [...GAMEPLAY_SUPERCLASSES].sort(),
    );
  });

  it('每个 ready playlet 都声明 schema、输出事件、过渡契约和占位资产', () => {
    for (const template of READY_PLAYLET_TEMPLATES) {
      expect(template.configSchema).toMatchObject({
        type: 'object',
      });
      expect(template.outputContract.resultEvent).toBe('playlet_completed');
      expect(template.transitionContract.supportsSubtitleFallback).toBe(true);
      expect(template.defaultAssets.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('planned 玩法不能被当作 ready 玩法使用', () => {
    const planned = getPlayletTemplate('playlet-找不同');

    expect(planned?.status).toBe('planned');
    expect(isReadyPlaylet('playlet-找不同')).toBe(false);
  });
});
